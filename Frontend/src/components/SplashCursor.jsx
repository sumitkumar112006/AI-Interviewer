import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * SplashCursor
 * High-performance WebGL fluid/smoke simulation (Pavel Dobryakov-style)
 * Pure WebGL with zero external dependencies.
 */
export default function SplashCursor() {
    const canvasRef = useRef(null);

    useEffect(() => {
        // Accessibility check: disable if user prefers reduced motion
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (motionQuery.matches) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        let animationId = null;
        let isDestroyed = false;

        const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 768;

        const CONFIG = {
            SIM_RESOLUTION: 128,
            DYE_RESOLUTION: isMobile ? 512 : 768,
            DENSITY_DISSIPATION: 2.2,
            VELOCITY_DISSIPATION: 0.7,
            PRESSURE: 0.1,
            PRESSURE_ITERATIONS: 12,
            CURL: 1.8,
            SPLAT_RADIUS: 0.07,
            SPLAT_FORCE: 1400,
            TRANSPARENT: true
        };

        const BLUE_SHADES = [
            { r: 0.1176, g: 0.2510, b: 1.0 },     // #1e40ff
            { r: 0.1451, g: 0.3882, b: 0.9216 },  // #2563eb
            { r: 0.2314, g: 0.5098, b: 0.9647 },  // #3b82f6
            { r: 0.1176, g: 0.2275, b: 0.5412 }   // #1e3a8a
        ];

        function generateBlueColor() {
            const shade = BLUE_SHADES[Math.floor(Math.random() * BLUE_SHADES.length)];
            const intensity = 0.15;
            return {
                r: shade.r * intensity,
                g: shade.g * intensity,
                b: shade.b * intensity
            };
        }

        // Pointer tracking
        const pointer = {
            x: 0,
            y: 0,
            prevX: 0,
            prevY: 0,
            dx: 0,
            dy: 0,
            down: false,
            moved: false,
            firstMove: true,
            color: generateBlueColor()
        };

        const { gl, ext } = getWebGLContext(canvas);
        if (!gl) return;

        // Base vertex shader
        const baseVertexShader = compileShader(gl, gl.VERTEX_SHADER, `
            precision highp float;
            attribute vec2 aPosition;
            varying vec2 vUv;
            varying vec2 vL;
            varying vec2 vR;
            varying vec2 vT;
            varying vec2 vB;
            uniform vec2 texelSize;

            void main () {
                vUv = aPosition * 0.5 + 0.5;
                vL = vUv - vec2(texelSize.x, 0.0);
                vR = vUv + vec2(texelSize.x, 0.0);
                vT = vUv + vec2(0.0, texelSize.y);
                vB = vUv - vec2(0.0, texelSize.y);
                gl_Position = vec4(aPosition, 0.0, 1.0);
            }
        `);

        // Clear shader
        const clearProgram = new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, `
            precision mediump float;
            precision mediump sampler2D;
            varying highp vec2 vUv;
            uniform sampler2D uTexture;
            uniform float value;

            void main () {
                gl_FragColor = value * texture2D(uTexture, vUv);
            }
        `));

        // Display shader with alpha transparency so dark backgrounds show through cleanly
        const displayProgram = new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, `
            precision highp float;
            precision highp sampler2D;
            varying vec2 vUv;
            uniform sampler2D uTexture;

            void main () {
                vec3 c = texture2D(uTexture, vUv).rgb;
                float a = max(c.r, max(c.g, c.b));
                if (a < 0.003) {
                    gl_FragColor = vec4(0.0);
                    return;
                }
                gl_FragColor = vec4(c, a);
            }
        `));

        // Splat shader
        const splatProgram = new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, `
            precision highp float;
            precision highp sampler2D;
            varying vec2 vUv;
            uniform sampler2D uTarget;
            uniform float aspectRatio;
            uniform vec3 color;
            uniform vec2 point;
            uniform float radius;

            void main () {
                vec2 p = vUv - point.xy;
                p.x *= aspectRatio;
                vec3 splat = exp(-dot(p, p) / radius) * color;
                vec3 base = texture2D(uTarget, vUv).xyz;
                gl_FragColor = vec4(base + splat, 1.0);
            }
        `));

        // Advection shader with bilinear filtering fallback
        const advectionShaderSource = `
            precision highp float;
            precision highp sampler2D;
            varying vec2 vUv;
            uniform sampler2D uVelocity;
            uniform sampler2D uSource;
            uniform vec2 texelSize;
            uniform float dt;
            uniform float dissipation;

            vec4 bilerp (sampler2D sam, vec2 p, vec2 tSize) {
                vec2 st = p / tSize - 0.5;
                vec2 i = floor(st);
                vec2 f = fract(st);
                vec4 a = texture2D(sam, (i + vec2(0.5, 0.5)) * tSize);
                vec4 b = texture2D(sam, (i + vec2(1.5, 0.5)) * tSize);
                vec4 c = texture2D(sam, (i + vec2(0.5, 1.5)) * tSize);
                vec4 d = texture2D(sam, (i + vec2(1.5, 1.5)) * tSize);
                return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
            }

            void main () {
                vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
                #ifdef MANUAL_FILTERING
                vec4 result = bilerp(uSource, coord, texelSize);
                #else
                vec4 result = texture2D(uSource, coord);
                #endif
                float decay = 1.0 + dissipation * dt;
                gl_FragColor = result / decay;
            }
        `;

        const advectionProgram = new Program(
            gl,
            baseVertexShader,
            compileShader(gl, gl.FRAGMENT_SHADER, advectionShaderSource, ext.supportLinearFiltering ? null : ['MANUAL_FILTERING'])
        );

        // Divergence shader
        const divergenceProgram = new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, `
            precision mediump float;
            precision mediump sampler2D;
            varying highp vec2 vUv;
            varying highp vec2 vL;
            varying highp vec2 vR;
            varying highp vec2 vT;
            varying highp vec2 vB;
            uniform sampler2D uVelocity;

            void main () {
                float L = texture2D(uVelocity, vL).x;
                float R = texture2D(uVelocity, vR).x;
                float T = texture2D(uVelocity, vT).y;
                float B = texture2D(uVelocity, vB).y;

                vec2 C = texture2D(uVelocity, vUv).xy;
                if (vL.x < 0.0) { L = -C.x; }
                if (vR.x > 1.0) { R = -C.x; }
                if (vT.y > 1.0) { T = -C.y; }
                if (vB.y < 0.0) { B = -C.y; }

                float div = 0.5 * (R - L + T - B);
                gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
            }
        `));

        // Curl shader
        const curlProgram = new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, `
            precision mediump float;
            precision mediump sampler2D;
            varying highp vec2 vUv;
            varying highp vec2 vL;
            varying highp vec2 vR;
            varying highp vec2 vT;
            varying highp vec2 vB;
            uniform sampler2D uVelocity;

            void main () {
                float L = texture2D(uVelocity, vL).y;
                float R = texture2D(uVelocity, vR).y;
                float T = texture2D(uVelocity, vT).x;
                float B = texture2D(uVelocity, vB).x;
                float vorticity = R - L - T + B;
                gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
            }
        `));

        // Vorticity confinement shader
        const vorticityProgram = new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, `
            precision highp float;
            precision highp sampler2D;
            varying vec2 vUv;
            varying vec2 vL;
            varying vec2 vR;
            varying vec2 vT;
            varying vec2 vB;
            uniform sampler2D uVelocity;
            uniform sampler2D uCurl;
            uniform float curl;
            uniform float dt;

            void main () {
                float L = texture2D(uCurl, vL).x;
                float R = texture2D(uCurl, vR).x;
                float T = texture2D(uCurl, vT).x;
                float B = texture2D(uCurl, vB).x;
                float C = texture2D(uCurl, vUv).x;

                vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
                force /= length(force) + 0.0001;
                force *= curl * C;
                force.y *= -1.0;

                vec2 vel = texture2D(uVelocity, vUv).xy;
                gl_FragColor = vec4(vel + force * dt, 0.0, 1.0);
            }
        `));

        // Pressure Poisson solver shader (Jacobi iterations)
        const pressureProgram = new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, `
            precision mediump float;
            precision mediump sampler2D;
            varying highp vec2 vUv;
            varying highp vec2 vL;
            varying highp vec2 vR;
            varying highp vec2 vT;
            varying highp vec2 vB;
            uniform sampler2D uPressure;
            uniform sampler2D uDivergence;

            void main () {
                float L = texture2D(uPressure, vL).x;
                float R = texture2D(uPressure, vR).x;
                float T = texture2D(uPressure, vT).x;
                float B = texture2D(uPressure, vB).x;
                float divergence = texture2D(uDivergence, vUv).x;
                float pressure = (L + R + B + T - divergence) * 0.25;
                gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
            }
        `));

        // Gradient subtract shader
        const gradSubtractProgram = new Program(gl, baseVertexShader, compileShader(gl, gl.FRAGMENT_SHADER, `
            precision mediump float;
            precision mediump sampler2D;
            varying highp vec2 vUv;
            varying highp vec2 vL;
            varying highp vec2 vR;
            varying highp vec2 vT;
            varying highp vec2 vB;
            uniform sampler2D uPressure;
            uniform sampler2D uVelocity;

            void main () {
                float L = texture2D(uPressure, vL).x;
                float R = texture2D(uPressure, vR).x;
                float T = texture2D(uPressure, vT).x;
                float B = texture2D(uPressure, vB).x;
                vec2 velocity = texture2D(uVelocity, vUv).xy;
                velocity.xy -= vec2(R - L, T - B);
                gl_FragColor = vec4(velocity, 0.0, 1.0);
            }
        `));

        // Full screen quad buffer with viewport management
        const blit = (() => {
            gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
            gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(0);

            return (destination) => {
                if (destination == null) {
                    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
                    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                } else {
                    gl.viewport(0, 0, destination.width, destination.height);
                    gl.bindFramebuffer(gl.FRAMEBUFFER, destination.fbo);
                }
                gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
            };
        })();

        // Double FBOs for advection / pressure swap
        let density, velocity, divergence, curl, pressure;

        function initFramebuffers() {
            const simRes = getResolution(CONFIG.SIM_RESOLUTION);
            const dyeRes = getResolution(CONFIG.DYE_RESOLUTION);

            const texType = ext.halfFloatTexType;
            const rgba = ext.formatRGBA;
            const rg = ext.formatRG;
            const r = ext.formatR;
            const filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;

            gl.disable(gl.BLEND);

            density = createDoubleFBO(gl, dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, texType, filtering);
            velocity = createDoubleFBO(gl, simRes.width, simRes.height, rg.internalFormat, rg.format, texType, filtering);
            divergence = createFBO(gl, simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
            curl = createFBO(gl, simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
            pressure = createDoubleFBO(gl, simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
        }

        function getResolution(resolution) {
            let aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
            if (aspectRatio < 1) aspectRatio = 1 / aspectRatio;

            const min = Math.round(resolution);
            const max = Math.round(resolution * aspectRatio);

            if (gl.drawingBufferWidth > gl.drawingBufferHeight) {
                return { width: max, height: min };
            } else {
                return { width: min, height: max };
            }
        }

        function resizeCanvas() {
            const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
            const width = Math.floor(window.innerWidth * dpr);
            const height = Math.floor(window.innerHeight * dpr);
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
            }
            gl.viewport(0, 0, canvas.width, canvas.height);
            initFramebuffers();
        }

        resizeCanvas();

        let lastUpdateTime = performance.now();

        // Splat application
        function splat(x, y, dx, dy, color) {
            splatProgram.bind();
            gl.uniform1i(splatProgram.uniforms.uTarget, velocity.read.attach(0));
            gl.uniform1f(splatProgram.uniforms.aspectRatio, canvas.width / canvas.height);
            gl.uniform2f(splatProgram.uniforms.point, x, y);
            gl.uniform3f(splatProgram.uniforms.color, dx, dy, 0.0);
            gl.uniform1f(splatProgram.uniforms.radius, correctRadius(CONFIG.SPLAT_RADIUS / 100.0));
            blit(velocity.write);
            velocity.swap();

            gl.uniform1i(splatProgram.uniforms.uTarget, density.read.attach(0));
            gl.uniform3f(splatProgram.uniforms.color, color.r, color.g, color.b);
            blit(density.write);
            density.swap();
        }

        function correctRadius(radius) {
            const aspectRatio = canvas.width / canvas.height;
            if (aspectRatio > 1) radius *= aspectRatio;
            return radius;
        }

        function update(currentTime) {
            if (isDestroyed) return;

            // Pause processing when tab is in background
            if (document.hidden) {
                lastUpdateTime = currentTime;
                animationId = requestAnimationFrame(update);
                return;
            }

            let dt = (currentTime - lastUpdateTime) / 1000;
            dt = Math.min(dt, 0.016667);
            lastUpdateTime = currentTime;

            // Continuous subtle smoke trailing with smooth sub-splat interpolation
            if (pointer.moved) {
                pointer.moved = false;
                const dist = Math.hypot(pointer.dx, pointer.dy);
                const steps = Math.min(Math.max(Math.round(dist * 60), 1), 4);
                for (let i = 1; i <= steps; i++) {
                    const t = i / steps;
                    const sx = pointer.prevX + (pointer.x - pointer.prevX) * t;
                    const sy = pointer.prevY + (pointer.y - pointer.prevY) * t;
                    splat(sx, sy, (pointer.dx * CONFIG.SPLAT_FORCE) / steps, (pointer.dy * CONFIG.SPLAT_FORCE) / steps, pointer.color);
                }
            }

            // 1. Curl calculation
            curlProgram.bind();
            gl.uniform2f(curlProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
            gl.uniform1i(curlProgram.uniforms.uVelocity, velocity.read.attach(0));
            blit(curl);

            // 2. Vorticity confinement
            vorticityProgram.bind();
            gl.uniform2f(vorticityProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
            gl.uniform1i(vorticityProgram.uniforms.uVelocity, velocity.read.attach(0));
            gl.uniform1i(vorticityProgram.uniforms.uCurl, curl.attach(1));
            gl.uniform1f(vorticityProgram.uniforms.curl, CONFIG.CURL);
            gl.uniform1f(vorticityProgram.uniforms.dt, dt);
            blit(velocity.write);
            velocity.swap();

            // 3. Divergence calculation
            divergenceProgram.bind();
            gl.uniform2f(divergenceProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
            gl.uniform1i(divergenceProgram.uniforms.uVelocity, velocity.read.attach(0));
            blit(divergence);

            // 4. Clear pressure using CONFIG.PRESSURE
            clearProgram.bind();
            gl.uniform1i(clearProgram.uniforms.uTexture, pressure.read.attach(0));
            gl.uniform1f(clearProgram.uniforms.value, CONFIG.PRESSURE);
            blit(pressure.write);
            pressure.swap();

            // 5. Pressure Poisson solve
            pressureProgram.bind();
            gl.uniform2f(pressureProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
            gl.uniform1i(pressureProgram.uniforms.uDivergence, divergence.attach(0));
            for (let i = 0; i < CONFIG.PRESSURE_ITERATIONS; i++) {
                gl.uniform1i(pressureProgram.uniforms.uPressure, pressure.read.attach(1));
                blit(pressure.write);
                pressure.swap();
            }

            // 6. Subtract gradient from velocity
            gradSubtractProgram.bind();
            gl.uniform2f(gradSubtractProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
            gl.uniform1i(gradSubtractProgram.uniforms.uPressure, pressure.read.attach(0));
            gl.uniform1i(gradSubtractProgram.uniforms.uVelocity, velocity.read.attach(1));
            blit(velocity.write);
            velocity.swap();

            // 7. Advect velocity
            advectionProgram.bind();
            gl.uniform2f(advectionProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
            gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read.attach(0));
            gl.uniform1i(advectionProgram.uniforms.uSource, velocity.read.attach(0));
            gl.uniform1f(advectionProgram.uniforms.dt, dt);
            gl.uniform1f(advectionProgram.uniforms.dissipation, CONFIG.VELOCITY_DISSIPATION);
            blit(velocity.write);
            velocity.swap();

            // 8. Advect dye
            gl.uniform2f(advectionProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
            gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read.attach(0));
            gl.uniform1i(advectionProgram.uniforms.uSource, density.read.attach(1));
            gl.uniform1f(advectionProgram.uniforms.dissipation, CONFIG.DENSITY_DISSIPATION);
            blit(density.write);
            density.swap();

            // 9. Display transparent dye to screen
            gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.clearColor(0.0, 0.0, 0.0, 0.0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.disable(gl.BLEND);
            displayProgram.bind();
            gl.uniform1i(displayProgram.uniforms.uTexture, density.read.attach(0));
            blit(null);

            animationId = requestAnimationFrame(update);
        }

        animationId = requestAnimationFrame(update);

        // Window event pointer tracking
        function updatePointer(clientX, clientY) {
            const x = clientX / window.innerWidth;
            const y = 1.0 - clientY / window.innerHeight; // flip Y for WebGL

            if (pointer.firstMove) {
                pointer.prevX = x;
                pointer.prevY = y;
                pointer.firstMove = false;
            }

            let dx = x - pointer.prevX;
            let dy = y - pointer.prevY;

            pointer.prevX = x;
            pointer.prevY = y;

            const aspect = window.innerWidth / window.innerHeight;
            if (aspect > 1.0) {
                dx *= aspect;
            }

            pointer.x = x;
            pointer.y = y;
            pointer.dx = dx;
            pointer.dy = dy;
            pointer.moved = Math.abs(dx) > 0.0001 || Math.abs(dy) > 0.0001;
            if (pointer.moved) {
                pointer.color = generateBlueColor();
            }
        }

        const handleMouseMove = (e) => {
            updatePointer(e.clientX, e.clientY);
        };

        const handleMouseDown = (e) => {
            pointer.down = true;
            updatePointer(e.clientX, e.clientY);
            splat(pointer.x, pointer.y, (Math.random() - 0.5) * 500, (Math.random() - 0.5) * 500, generateBlueColor());
        };

        const handleMouseUp = () => {
            pointer.down = false;
        };

        const handleTouchMove = (e) => {
            if (e.targetTouches.length > 0) {
                updatePointer(e.targetTouches[0].clientX, e.targetTouches[0].clientY);
            }
        };

        const handleTouchStart = (e) => {
            if (e.targetTouches.length > 0) {
                pointer.down = true;
                updatePointer(e.targetTouches[0].clientX, e.targetTouches[0].clientY);
                splat(pointer.x, pointer.y, (Math.random() - 0.5) * 400, (Math.random() - 0.5) * 400, generateBlueColor());
            }
        };

        const handleTouchEnd = () => {
            pointer.down = false;
        };

        const handleMouseLeave = () => {
            pointer.firstMove = true;
            pointer.moved = false;
        };

        const handleResize = () => {
            resizeCanvas();
        };

        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        window.addEventListener('mousedown', handleMouseDown, { passive: true });
        window.addEventListener('mouseup', handleMouseUp, { passive: true });
        window.addEventListener('touchmove', handleTouchMove, { passive: true });
        window.addEventListener('touchstart', handleTouchStart, { passive: true });
        window.addEventListener('touchend', handleTouchEnd, { passive: true });
        window.addEventListener('mouseleave', handleMouseLeave);
        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            isDestroyed = true;
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchend', handleTouchEnd);
            window.removeEventListener('mouseleave', handleMouseLeave);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    if (typeof document === 'undefined') return null;

    return createPortal(
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                pointerEvents: 'none',
                zIndex: 1
            }}
        />,
        document.body
    );
}

/* ==========================================================================
   WebGL Helper Classes & Utilities
   ========================================================================== */

function getWebGLContext(canvas) {
    const params = {
        alpha: true,
        premultipliedAlpha: true,
        depth: false,
        stencil: false,
        antialias: false,
        preserveDrawingBuffer: false
    };

    let gl = canvas.getContext('webgl2', params);
    const isWebGL2 = Boolean(gl);
    if (!isWebGL2) {
        gl = canvas.getContext('webgl', params) || canvas.getContext('experimental-webgl', params);
    }
    if (!gl) return { gl: null, ext: null };

    let halfFloat;
    let supportLinearFiltering;

    if (isWebGL2) {
        gl.getExtension('EXT_color_buffer_float');
        supportLinearFiltering = Boolean(gl.getExtension('OES_texture_float_linear'));
    } else {
        halfFloat = gl.getExtension('OES_texture_half_float');
        supportLinearFiltering = Boolean(gl.getExtension('OES_texture_half_float_linear'));
    }

    gl.clearColor(0.0, 0.0, 0.0, 0.0);

    const halfFloatTexType = isWebGL2 ? gl.HALF_FLOAT : (halfFloat ? halfFloat.HALF_FLOAT_OES : gl.UNSIGNED_BYTE);

    let formatRGBA, formatRG, formatR;

    if (isWebGL2) {
        formatRGBA = getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, halfFloatTexType);
        formatRG = getSupportedFormat(gl, gl.RG16F, gl.RG, halfFloatTexType);
        formatR = getSupportedFormat(gl, gl.R16F, gl.RED, halfFloatTexType);
    } else {
        formatRGBA = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
        formatRG = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
        formatR = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
    }

    return {
        gl,
        ext: {
            formatRGBA,
            formatRG,
            formatR,
            halfFloatTexType,
            supportLinearFiltering
        }
    };
}

function getSupportedFormat(gl, internalFormat, format, type) {
    if (!supportRenderTextureFormat(gl, internalFormat, format, type)) {
        switch (internalFormat) {
            case gl.R16F:
                return getSupportedFormat(gl, gl.RG16F, gl.RG, type);
            case gl.RG16F:
                return getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, type);
            default:
                return null;
        }
    }
    return { internalFormat, format };
}

function supportRenderTextureFormat(gl, internalFormat, format, type) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    return status === gl.FRAMEBUFFER_COMPLETE;
}

function compileShader(gl, type, source, keywords) {
    source = addKeywords(source, keywords);
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
    }
    return shader;
}

function addKeywords(source, keywords) {
    if (!keywords) return source;
    let keywordsString = '';
    keywords.forEach((keyword) => {
        keywordsString += '#define ' + keyword + '\n';
    });
    return keywordsString + source;
}

class Program {
    constructor(gl, vertexShader, fragmentShader) {
        this.gl = gl;
        this.program = gl.createProgram();
        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.linkProgram(this.program);

        this.uniforms = {};
        const uniformCount = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < uniformCount; i++) {
            const uniformName = gl.getActiveUniform(this.program, i).name;
            this.uniforms[uniformName] = gl.getUniformLocation(this.program, uniformName);
        }
    }

    bind() {
        this.gl.useProgram(this.program);
    }
}

function createFBO(gl, w, h, internalFormat, format, type, param) {
    gl.activeTexture(gl.TEXTURE0);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);

    return {
        texture,
        fbo,
        width: w,
        height: h,
        texelSizeX: 1.0 / w,
        texelSizeY: 1.0 / h,
        attach(id) {
            gl.activeTexture(gl.TEXTURE0 + id);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            return id;
        }
    };
}

function createDoubleFBO(gl, w, h, internalFormat, format, type, param) {
    let fbo1 = createFBO(gl, w, h, internalFormat, format, type, param);
    let fbo2 = createFBO(gl, w, h, internalFormat, format, type, param);

    return {
        width: w,
        height: h,
        texelSizeX: fbo1.texelSizeX,
        texelSizeY: fbo1.texelSizeY,
        get read() {
            return fbo1;
        },
        set read(value) {
            fbo1 = value;
        },
        get write() {
            return fbo2;
        },
        set write(value) {
            fbo2 = value;
        },
        swap() {
            const temp = fbo1;
            fbo1 = fbo2;
            fbo2 = temp;
        }
    };
}
