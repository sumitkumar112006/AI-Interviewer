"use client";
import React, { useEffect, useRef, useState } from "react";
import { User, Lock, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import './login-form.scss';

// Vertex shader source code
const vertexSmokeySource = `
  attribute vec4 a_position;
  void main() {
    gl_Position = a_position;
  }
`;

// Fragment shader source code for the smokey background effect
const fragmentSmokeySource = `
precision mediump float;

uniform vec2 iResolution;
uniform float iTime;
uniform vec2 iMouse;
uniform vec3 u_color;

void mainImage(out vec4 fragColor, in vec2 fragCoord){
    vec2 uv = fragCoord / iResolution;
    vec2 centeredUV = (2.0 * fragCoord - iResolution.xy) / min(iResolution.x, iResolution.y);

    float time = iTime * 0.4;

    // Normalize mouse input (0.0 - 1.0) and remap to -1.0 ~ 1.0
    vec2 mouse = iMouse / iResolution;
    vec2 rippleCenter = 2.0 * mouse - 1.0;

    vec2 distortion = centeredUV;
    // Apply distortion for a wavy, smokey effect
    for (float i = 1.0; i < 8.0; i++) {
        distortion.x += 0.5 / i * cos(i * 2.0 * distortion.y + time + rippleCenter.x * 3.1415);
        distortion.y += 0.5 / i * cos(i * 2.0 * distortion.x + time + rippleCenter.y * 3.1415);
    }

    // Create a glowing wave pattern with smooth gradient roll-off
    float wave = abs(sin(distortion.x + distortion.y + time));
    float glow = smoothstep(0.92, 0.18, wave);

    fragColor = vec4(u_color * glow, 1.0);
}

void main() {
    mainImage(gl_FragColor, gl_FragCoord.xy);
}
`;

/**
 * Valid blur sizes supported by Tailwind CSS.
 */
type BlurSize = "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";

/**
 * Props for the SmokeyBackground component.
 */
export interface SmokeyBackgroundProps {
  backdropBlurAmount?: string;
  color?: string;
  className?: string;
}

/**
 * A mapping from blur size names to Tailwind CSS classes.
 */
const blurClassMap: Record<BlurSize, string> = {
  none: "backdrop-blur-none",
  sm: "backdrop-blur-sm",
  md: "backdrop-blur-md",
  lg: "backdrop-blur-lg",
  xl: "backdrop-blur-xl",
  "2xl": "backdrop-blur-2xl",
  "3xl": "backdrop-blur-3xl",
};

/**
 * A React component that renders an interactive WebGL shader background.
 */
export function SmokeyBackground({
  backdropBlurAmount = "none",
  color = "#1E40AF", // Default dark blue
  className = "",
}: SmokeyBackgroundProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const smoothedMouseRef = useRef({ x: 0, y: 0 });
  const isHoveringRef = useRef(false);
  const colorRef = useRef(color);

  useEffect(() => {
    colorRef.current = color;
  }, [color]);

  // Helper to convert hex color to RGB (0-1 range)
  const hexToRgb = (hex: string): [number, number, number] => {
    const r = parseInt(hex.substring(1, 3), 16) / 255;
    const g = parseInt(hex.substring(3, 5), 16) / 255;
    const b = parseInt(hex.substring(5, 7), 16) / 255;
    return [r, g, b];
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let isDestroyed = false;
    let animationId: number | null = null;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      depth: false,
      stencil: false,
      antialias: false,
      powerPreference: "high-performance"
    });
    if (!gl) {
      console.error("WebGL not supported");
      return;
    }

    const compileShader = (type: number, source: string): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compilation error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSmokeySource);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSmokeySource);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program linking error:", gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const iResolutionLocation = gl.getUniformLocation(program, "iResolution");
    const iTimeLocation = gl.getUniformLocation(program, "iTime");
    const iMouseLocation = gl.getUniformLocation(program, "iMouse");
    const uColorLocation = gl.getUniformLocation(program, "u_color");

    const handleResize = () => {
      if (!canvas || isDestroyed) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.floor((canvas.clientWidth || window.innerWidth) * dpr);
      const height = Math.floor((canvas.clientHeight || window.innerHeight) * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        smoothedMouseRef.current = { x: width / 2, y: height / 2 };
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    handleResize();

    const startTime = performance.now();

    const render = () => {
      if (isDestroyed) return;

      if (!document.hidden) {
        const currentTime = (performance.now() - startTime) / 1000;
        const width = canvas.width;
        const height = canvas.height;

        const [r, g, b] = hexToRgb(colorRef.current);
        gl.uniform3f(uColorLocation, r, g, b);

        gl.uniform2f(iResolutionLocation, width, height);
        gl.uniform1f(iTimeLocation, currentTime);

        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const targetX = isHoveringRef.current ? mousePosRef.current.x * dpr : width / 2;
        const targetY = isHoveringRef.current ? height - mousePosRef.current.y * dpr : height / 2;

        // Luxurious smooth liquid lerp for organic cursor tracking
        smoothedMouseRef.current.x += (targetX - smoothedMouseRef.current.x) * 0.05;
        smoothedMouseRef.current.y += (targetY - smoothedMouseRef.current.y) * 0.05;

        gl.uniform2f(
          iMouseLocation,
          smoothedMouseRef.current.x,
          smoothedMouseRef.current.y
        );

        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }

      animationId = requestAnimationFrame(render);
    };

    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mousePosRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const handleMouseEnter = () => { isHoveringRef.current = true; };
    const handleMouseLeave = () => { isHoveringRef.current = false; };

    window.addEventListener("resize", handleResize, { passive: true });
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    canvas.addEventListener("mouseenter", handleMouseEnter, { passive: true });
    canvas.addEventListener("mouseleave", handleMouseLeave, { passive: true });

    render();

    return () => {
      isDestroyed = true;
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseenter", handleMouseEnter);
      canvas.removeEventListener("mouseleave", handleMouseLeave);

      if (positionBuffer) gl.deleteBuffer(positionBuffer);
      if (program) {
        if (vertexShader) {
          gl.detachShader(program, vertexShader);
          gl.deleteShader(vertexShader);
        }
        if (fragmentShader) {
          gl.detachShader(program, fragmentShader);
          gl.deleteShader(fragmentShader);
        }
        gl.deleteProgram(program);
      }
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return (
    <div className={`absolute inset-0 w-full h-full overflow-hidden ${className}`}>
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}

export interface LoginFormProps {
  email?: string;
  setEmail?: (val: string) => void;
  password?: string;
  setPassword?: (val: string) => void;
  onSubmit?: (e: React.FormEvent) => void;
  onGoogleLogin?: () => void;
  onForgotPassword?: () => void;
  onSignUp?: () => void;
  error?: string;
  infoMessage?: string;
  loading?: boolean;
}

/**
 * A glassmorphism-style login form component with animated labels and Google login.
 */
export function LoginForm({
  email: externalEmail,
  setEmail: externalSetEmail,
  password: externalPassword,
  setPassword: externalSetPassword,
  onSubmit: externalOnSubmit,
  onGoogleLogin,
  onForgotPassword,
  onSignUp,
  error,
  infoMessage,
  loading = false,
}: LoginFormProps = {}) {
  const [localEmail, setLocalEmail] = useState("");
  const [localPassword, setLocalPassword] = useState("");

  const email = externalEmail !== undefined ? externalEmail : localEmail;
  const setEmail = externalSetEmail || setLocalEmail;

  const password = externalPassword !== undefined ? externalPassword : localPassword;
  const setPassword = externalSetPassword || setLocalPassword;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (externalOnSubmit) {
      externalOnSubmit(e);
    }
  };

  return (
    <div className="login-card-container w-full max-w-[400px] p-8 space-y-6 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl relative z-20">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white tracking-tight">Welcome Back</h2>
        <p className="mt-2 text-sm text-gray-300">Sign in to continue</p>
      </div>

      {infoMessage && (
        <div className="p-3 text-xs rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-200">
          {infoMessage}
        </div>
      )}

      {error && (
        <div className="p-3 text-xs rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form className="space-y-6" onSubmit={handleSubmit}>
        {/* Email Input Field */}
        <div className="login-input-group relative">
          <User className="input-icon" size={18} />
          <input
            type="email"
            id="floating_email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="glass-input-field"
            placeholder="Email address" 
            required
            disabled={loading}
          />
        </div>

        {/* Password Input Field */}
        <div className="login-input-group relative">
          <Lock className="input-icon" size={18} />
          <input
            type="password"
            id="floating_password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="glass-input-field"
            placeholder="Password"
            required
            disabled={loading}
          />
        </div>

        <div className="flex items-center justify-between">
          <a
            href={onForgotPassword ? "#" : "/login"}
            onClick={(e) => {
              if (onForgotPassword) {
                e.preventDefault();
                onForgotPassword();
              }
            }}
            className="text-xs text-gray-300 hover:text-white transition cursor-pointer"
          >
            Forgot Password?
          </a>
        </div>
        
        <button
          type="submit"
          disabled={loading}
          className="group w-full flex items-center justify-center py-3 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 transition-all duration-300 disabled:opacity-60 cursor-pointer"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Signing In...
            </span>
          ) : (
            <>
              Sign In
              <ArrowRight className="ml-2 h-5 w-5 transform group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>

        {/* Divider */}
        <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-400/30"></div>
            <span className="flex-shrink mx-4 text-gray-400 text-xs">OR CONTINUE WITH</span>
            <div className="flex-grow border-t border-gray-400/30"></div>
        </div>

        {/* Google Login Button */}
        <button
          type="button"
          onClick={onGoogleLogin}
          disabled={loading}
          className="google-login-btn"
          aria-label="Sign in with Google"
        >
          <svg
            className="google-icon"
            width={20}
            height={20}
            viewBox="0 0 48 48"
            style={{ width: '20px', height: '20px', minWidth: '20px', minHeight: '20px', maxWidth: '20px', maxHeight: '20px', flexShrink: 0 }}
          >
            <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039L38.802 8.841C34.553 4.806 29.613 2.5 24 2.5C11.983 2.5 2.5 11.983 2.5 24s9.483 21.5 21.5 21.5S45.5 36.017 45.5 24c0-1.538-.135-3.022-.389-4.417z"></path>
            <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12.5 24 12.5c3.059 0 5.842 1.154 7.961 3.039l5.839-5.841C34.553 4.806 29.613 2.5 24 2.5C16.318 2.5 9.642 6.723 6.306 14.691z"></path>
            <path fill="#4CAF50" d="M24 45.5c5.613 0 10.553-2.306 14.802-6.341l-5.839-5.841C30.842 35.846 27.059 38 24 38c-5.039 0-9.345-2.608-11.124-6.481l-6.571 4.819C9.642 41.277 16.318 45.5 24 45.5z"></path>
            <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l5.839 5.841C44.196 35.123 45.5 29.837 45.5 24c0-1.538-.135-3.022-.389-4.417z"></path>
          </svg>
          <span className="google-text">Sign in with Google</span>
        </button>

      </form>
       <p className="text-center text-xs text-gray-400">
        Don't have an account?{" "}
        <a 
          href={onSignUp ? "#" : "/register"} 
          onClick={(e) => {
            if (onSignUp) {
              e.preventDefault();
              onSignUp();
            }
          }}
          className="font-semibold text-blue-400 hover:text-blue-300 transition cursor-pointer"
        >
          Sign Up
        </a>
      </p>
    </div>
  );
}
