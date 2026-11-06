import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './LiquidBulgeTabBar.scss';

// ── Physical Spring Constants (from design spec: w0 = 13, zeta = 0.6) ────────
const W0 = 13;
const ZETA = 0.6;
const WD = W0 * Math.sqrt(1 - ZETA * ZETA); // 10.4
const ZETA_W0 = ZETA * W0; // 7.8
const VEL_COEFF = W0 / Math.sqrt(1 - ZETA * ZETA); // 16.25

/**
 * Analytical spring response for underdamped harmonic oscillator
 * x(t) = 1 - e^(-zeta*w0*t) * (cos(wd*t) + (zeta*w0/wd) * sin(wd*t))
 */
function springX(t) {
    if (t <= 0) return 0;
    return 1 - Math.exp(-ZETA_W0 * t) * (Math.cos(WD * t) + (ZETA_W0 / WD) * Math.sin(WD * t));
}

/**
 * Analytical velocity dx/dt (tabs per second for unit step)
 * dx/dt = (w0 / sqrt(1 - zeta^2)) * e^(-zeta*w0*t) * sin(wd*t)
 */
function springV(t) {
    if (t <= 0) return 0;
    return Math.exp(-ZETA_W0 * t) * (VEL_COEFF * Math.sin(WD * t));
}

export const LiquidBulgeTabBar = ({ activeReportId }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const path = location.pathname;

    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const animRef = useRef(null);
    const filterIdRef = useRef(`liquid-goo-${Math.random().toString(36).substring(2, 9)}`);

    // Define the 3 interview sub-tabs with custom public folder icons
    const tabs = useMemo(() => [
        {
            id: 'plan',
            label: 'Preparation Plan',
            path: activeReportId ? `/interview/${activeReportId}` : '/',
            match: (p) => p.startsWith('/interview/'),
            iconSrc: '/report.png'
        },
        {
            id: 'resume',
            label: 'Generate Resume',
            path: activeReportId ? `/resume/${activeReportId}` : '/',
            match: (p) => p.startsWith('/resume/'),
            iconSrc: '/resume.png'
        },
        {
            id: 'cover',
            label: 'Cover Letter Builder',
            path: activeReportId ? `/cover-letter/${activeReportId}` : '/',
            match: (p) => p.startsWith('/cover-letter/'),
            iconSrc: '/cv.png'
        }
    ], [activeReportId]);

    // Active tab index (0, 1, or 2)
    const activeIndex = useMemo(() => {
        const found = tabs.findIndex(t => t.match(path));
        return found !== -1 ? found : 0;
    }, [tabs, path]);

    // State for tap indicator / ripple animations
    const [tapRipple, setTapRipple] = useState(null); // { index, startTime }
    const [liquidPosition, setLiquidPosition] = useState(activeIndex);

    // Spring animation state stored in ref for zero-overhead requestAnimationFrame loops
    const springStateRef = useRef({
        currentP: activeIndex,
        fromP: activeIndex,
        targetP: activeIndex,
        startTime: null,
        animating: false
    });

    // Handle tab click
    const handleTabClick = (index, targetPath) => {
        if (index !== springStateRef.current.targetP) {
            springStateRef.current.fromP = springStateRef.current.currentP;
            springStateRef.current.targetP = index;
            springStateRef.current.startTime = performance.now();
            springStateRef.current.animating = true;
        }

        // Trigger tap ripple
        setTapRipple({
            index,
            startTime: performance.now()
        });

        if (targetPath && targetPath !== path) {
            navigate(targetPath);
        }
    };

    // Update target when path changes externally (e.g. browser back/forward or sidebar links)
    useEffect(() => {
        if (activeIndex !== springStateRef.current.targetP) {
            springStateRef.current.fromP = springStateRef.current.currentP;
            springStateRef.current.targetP = activeIndex;
            springStateRef.current.startTime = performance.now();
            springStateRef.current.animating = true;
        }
    }, [activeIndex]);

    // Render loop for the Liquid Canvas
    useEffect(() => {
        let isMounted = true;

        const render = () => {
            if (!isMounted) return;

            const canvas = canvasRef.current;
            const container = containerRef.current;
            if (!canvas || !container) {
                animRef.current = requestAnimationFrame(render);
                return;
            }

            const ctx = canvas.getContext('2d');
            const rect = container.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;

            if (width <= 0 || height <= 0) {
                animRef.current = requestAnimationFrame(render);
                return;
            }

            const dpr = window.devicePixelRatio || 1;
            if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
                canvas.width = width * dpr;
                canvas.height = height * dpr;
            }

            ctx.save();
            ctx.scale(dpr, dpr);
            ctx.clearRect(0, 0, width, height);

            const now = performance.now();
            const spring = springStateRef.current;

            let p = spring.targetP;
            let dpDt = 0;

            if (spring.animating && spring.startTime !== null) {
                const t = (now - spring.startTime) / 1000; // seconds
                const progress = springX(t);
                dpDt = (spring.targetP - spring.fromP) * springV(t);
                p = spring.fromP + (spring.targetP - spring.fromP) * progress;

                spring.currentP = p;

                if (t >= 0.95 && Math.abs(p - spring.targetP) < 0.002) {
                    p = spring.targetP;
                    dpDt = 0;
                    spring.currentP = spring.targetP;
                    spring.animating = false;
                }
            } else {
                p = spring.targetP;
                spring.currentP = p;
            }

            setLiquidPosition(p);

            // Bar Layout Geometry
            const numTabs = tabs.length;
            const tabWidth = width / numTabs;
            const barHeight = Math.min(52, height - 24);
            const barTop = height - barHeight - 4; // Bulge rises into upper 24px space
            const barRadius = barHeight / 2;

            // KIVI Brand Theme Gradient: Warm Coral (#ef7b5d) -> Sunset Ember (#f97316)
            const gradient = ctx.createLinearGradient(0, 0, width, 0);
            gradient.addColorStop(0, '#ef7b5d');
            gradient.addColorStop(1, '#f97316');

            ctx.fillStyle = gradient;
            ctx.strokeStyle = gradient;

            // 1. Draw Base Liquid Bar (Rounded Rectangle)
            ctx.beginPath();
            ctx.roundRect(0, barTop, width, barHeight, barRadius);
            ctx.fill();

            // 2. Compute Positions for Main Bulge & Followers
            // Helper to get tab center X for a given continuous position pos
            const getTabCenterX = (pos) => (pos + 0.5) * tabWidth;

            // Main bulge center X
            const mainX = Math.max(barRadius + 8, Math.min(width - barRadius - 8, getTabCenterX(p)));
            const mainR = 34; // Radius of main dome
            const mainY = barTop + 6; // Sits on top edge of the bar, extending 28px upward

            // Velocity stretch factor s = min(|dp/dt| * 0.05, 0.5)
            const s = Math.min(Math.abs(dpDt) * 0.05, 0.5);
            const scaleX = 1 + s;
            const scaleY = 1 / Math.sqrt(1 + s);

            // Followers delayed in time
            const tNow = spring.startTime ? (now - spring.startTime) / 1000 : 1;
            const getDelayedP = (delay) => {
                if (!spring.animating) return p;
                const tDelayed = Math.max(0, tNow - delay);
                return spring.fromP + (spring.targetP - spring.fromP) * springX(tDelayed);
            };

            const p1 = getDelayedP(0.03);
            const p2 = getDelayedP(0.06);
            const p3 = getDelayedP(0.09);

            const f1X = Math.max(barRadius, Math.min(width - barRadius, getTabCenterX(p1)));
            const f1Y = barTop + 8;
            const f1R = 28;

            const f2X = Math.max(barRadius, Math.min(width - barRadius, getTabCenterX(p2)));
            const f2Y = barTop + 9;
            const f2R = 22;

            const f3X = Math.max(barRadius, Math.min(width - barRadius, getTabCenterX(p3)));
            const f3Y = barTop + 10;
            const f3R = 18;

            // 3. Draw Connecting Liquid Neck from 0.09s follower to main circle
            ctx.beginPath();
            ctx.lineWidth = 26;
            ctx.lineCap = 'round';
            const neckStartX = Math.max(barRadius, Math.min(width - barRadius, f3X));
            const neckEndX = Math.max(barRadius, Math.min(width - barRadius, mainX));
            ctx.moveTo(neckStartX, f3Y);
            ctx.lineTo(neckEndX, mainY);
            ctx.stroke();

            // 4. Draw Followers (Sitting on top edge)
            ctx.beginPath();
            ctx.arc(f3X, f3Y, f3R, 0, Math.PI * 2);
            ctx.fill();

            ctx.beginPath();
            ctx.arc(f2X, f2Y, f2R, 0, Math.PI * 2);
            ctx.fill();

            ctx.beginPath();
            ctx.arc(f1X, f1Y, f1R, 0, Math.PI * 2);
            ctx.fill();

            // 5. Draw Stretched Main Circle
            ctx.save();
            ctx.translate(mainX, mainY);
            ctx.scale(scaleX, scaleY);
            ctx.beginPath();
            ctx.arc(0, 0, mainR, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // 6. Draw Tap Ripple if active
            if (tapRipple) {
                const elapsed = (now - tapRipple.startTime) / 1000;
                if (elapsed <= 0.4) {
                    const rippleProgress = elapsed / 0.4;
                    const rippleRadius = 23 + (52 - 23) * rippleProgress;
                    const rippleOpacity = 0.7 * (1 - rippleProgress);
                    const rippleX = getTabCenterX(tapRipple.index);
                    const rippleY = barTop + barHeight / 2;

                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(rippleX, rippleY, rippleRadius, 0, Math.PI * 2);
                    ctx.lineWidth = 3;
                    ctx.strokeStyle = `rgba(255, 255, 255, ${rippleOpacity})`;
                    ctx.stroke();
                    ctx.restore();
                }
            }

            ctx.restore();

            animRef.current = requestAnimationFrame(render);
        };

        animRef.current = requestAnimationFrame(render);

        return () => {
            isMounted = false;
            if (animRef.current) cancelAnimationFrame(animRef.current);
        };
    }, [tabs.length, tapRipple]);

    return (
        <div className="liquid-bulge-nav-wrapper">
            {/* SVG Filter for Gooey Liquid Threshold */}
            <svg className="liquid-goo-filter-svg" aria-hidden="true">
                <defs>
                    <filter id={filterIdRef.current}>
                        <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
                        <feColorMatrix
                            in="blur"
                            mode="matrix"
                            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -10"
                            result="goo"
                        />
                        <feComposite in="SourceGraphic" in2="goo" operator="atop" />
                    </filter>
                </defs>
            </svg>

            <div
                className="liquid-bulge-stage"
                ref={containerRef}
                role="tablist"
                aria-label="Interview Navigation"
            >
                {/* Background Liquid Canvas */}
                <canvas
                    ref={canvasRef}
                    className="liquid-canvas"
                    style={{ filter: `url(#${filterIdRef.current})` }}
                />

                {/* Interactive Tab Buttons with Dynamic Lift into Bulge */}
                <div className="liquid-tabs-container">
                    {tabs.map((tab, idx) => {
                        // c = clamp(1 - |p - i| * 1.25, 0, 1)
                        const c = Math.max(0, Math.min(1, 1 - Math.abs(liquidPosition - idx) * 1.25));
                        const opacity = 0.62 + 0.38 * c;
                        const lift = 20 * c; // Lifts 20px up into the liquid bulge
                        const scale = 1 + (3 * c) / 17;

                        const isSelected = activeIndex === idx;

                        return (
                            <button
                                key={tab.id}
                                type="button"
                                className={`liquid-tab-item ${isSelected ? 'active' : ''}`}
                                onClick={() => handleTabClick(idx, tab.path)}
                                role="tab"
                                aria-selected={isSelected}
                                aria-label={tab.label}
                                title={tab.label}
                                style={{
                                    transform: `translateY(-${lift}px) scale(${scale})`,
                                    opacity
                                }}
                            >
                                <span className="liquid-tab-icon">
                                    <img
                                        src={tab.iconSrc}
                                        alt={tab.label}
                                        className="liquid-tab-img"
                                        draggable="false"
                                    />
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default LiquidBulgeTabBar;

