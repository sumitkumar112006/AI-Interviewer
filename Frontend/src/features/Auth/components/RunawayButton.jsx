import React, { useRef, useEffect, useState, useCallback } from 'react'

/**
 * RunawayButton — Elastic Tether Physics
 *
 * Two forces act simultaneously every frame:
 *   1. REPULSION: cursor within dangerRadius → push button away (inverse-square strength)
 *   2. SPRING:    always pull back toward origin (0,0) — the "tether"
 *
 * The result: button flees the cursor but is always pulled home,
 * creating a satisfying elastic / rubber-band feel.
 *
 * completedFields / totalFields control how hard it's to catch:
 *   0  fields → strong repulsion, weak spring  (hard to catch)
 *   partial   → medium repulsion, medium spring
 *   all done  → repulsion off, strong spring snap to origin
 */

// ── Tunable constants ──────────────────────────────────────────
const DANGER_RADIUS_FULL    = 160   // px — cursor detection range when empty
const DANGER_RADIUS_PARTIAL = 100   // px — shrinks as fields fill
const REPULSION_STRENGTH    = 18000 // inverse-square numerator (full state)
const PARTIAL_REPULSION     = 7000  // repulsion when partially filled
const SPRING_FULL           = 0.04  // spring stiffness (weak when all empty)
const SPRING_PARTIAL        = 0.07
const SPRING_LOCKED         = 0.22  // snaps home fast when all fields done
const DAMPING               = 0.78  // velocity damping (higher = less bouncy)
const ZONE_PAD              = 14    // px padding from zone edges
// ───────────────────────────────────────────────────────────────

const RunawayButton = ({
    completedFields,
    totalFields,
    onSubmit,
    loading = false,
    children,
}) => {
    const zoneRef   = useRef(null)
    const btnRef    = useRef(null)
    const rafRef    = useRef(null)
    const mouseRef  = useRef({ x: null, y: null })
    const posRef    = useRef({ x: 0, y: 0 })   // current displacement from origin
    const velRef    = useRef({ x: 0, y: 0 })   // velocity
    const isTouchRef= useRef(
        typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
    )

    const [isEscaping, setIsEscaping] = useState(false)
    const [isLocked,   setIsLocked]   = useState(false)
    const prevLockedRef = useRef(false)

    const allDone  = completedFields >= totalFields
    const noneFilled = completedFields === 0

    // ── Pick physics params based on form state ──
    const dangerRadius  = noneFilled ? DANGER_RADIUS_FULL : DANGER_RADIUS_PARTIAL
    const repulsion     = noneFilled ? REPULSION_STRENGTH : PARTIAL_REPULSION
    const springK       = allDone
        ? SPRING_LOCKED
        : noneFilled ? SPRING_FULL : SPRING_PARTIAL

    // ── Write absolute position to DOM (bypasses React re-render) ──
    const applyPos = useCallback((x, y) => {
        const btn  = btnRef.current
        const zone = zoneRef.current
        if (!btn || !zone) return

        const bw = btn.offsetWidth  || 140
        const bh = btn.offsetHeight ||  48
        const zw = zone.offsetWidth
        const zh = zone.offsetHeight

        // Origin = center of zone
        const originX = zw / 2
        const originY = zh / 2

        // Clamp so button never leaves zone
        const maxDx = originX - bw / 2 - ZONE_PAD
        const maxDy = originY - bh / 2 - ZONE_PAD

        const cx = Math.max(-maxDx, Math.min(maxDx, x))
        const cy = Math.max(-maxDy, Math.min(maxDy, y))

        posRef.current = { x: cx, y: cy }

        // Position button: absolute left/top relative to zone
        btn.style.left = `${originX + cx - bw / 2}px`
        btn.style.top  = `${originY + cy - bh / 2}px`
    }, [])

    // ── Main RAF physics loop ──
    const tick = useCallback(() => {
        const zone = zoneRef.current
        const btn  = btnRef.current
        if (!zone || !btn) { rafRef.current = requestAnimationFrame(tick); return }

        const mx = mouseRef.current.x
        const my = mouseRef.current.y

        let forceX = 0
        let forceY = 0
        let fleeing = false

        // ── 1. Repulsion force (only on non-touch, non-completed) ──
        if (!allDone && !isTouchRef.current && mx !== null && my !== null) {
            const zoneRect = zone.getBoundingClientRect()
            const bw = btn.offsetWidth  || 140
            const bh = btn.offsetHeight ||  48

            // Current button center in viewport coords
            const btnCx = zoneRect.left + zone.offsetWidth  / 2 + posRef.current.x
            const btnCy = zoneRect.top  + zone.offsetHeight / 2 + posRef.current.y

            const dx = btnCx - mx   // vector FROM cursor TO button
            const dy = btnCy - my
            const distSq = dx * dx + dy * dy
            const dist   = Math.sqrt(distSq)

            if (dist < dangerRadius && dist > 1) {
                // Inverse-square repulsion — exponentially stronger when very close
                const raw = repulsion / Math.max(distSq, 400)
                const clampedMag = Math.min(raw, 35) // cap max per-frame force

                forceX = (dx / dist) * clampedMag
                forceY = (dy / dist) * clampedMag
                fleeing = true
            }
        }

        // ── 2. Spring force — always pulls toward origin (0,0) ──
        forceX += -posRef.current.x * springK
        forceY += -posRef.current.y * springK

        // ── 3. Integrate velocity ──
        velRef.current.x = (velRef.current.x + forceX) * DAMPING
        velRef.current.y = (velRef.current.y + forceY) * DAMPING

        // ── 4. Apply position (clamped inside zone) ──
        applyPos(
            posRef.current.x + velRef.current.x,
            posRef.current.y + velRef.current.y,
        )

        // ── 5. Update escape glow state (throttled via fleeing flag) ──
        setIsEscaping(fleeing)

        rafRef.current = requestAnimationFrame(tick)
    }, [allDone, dangerRadius, repulsion, springK, applyPos])

    // ── Start / restart RAF when physics params change ──
    useEffect(() => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(tick)
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
    }, [tick])

    // ── Lock animation when all fields complete ──
    useEffect(() => {
        if (allDone && !prevLockedRef.current) {
            velRef.current = { x: 0, y: 0 }
            setIsLocked(true)
            prevLockedRef.current = true
            const t = setTimeout(() => setIsLocked(false), 800)
            return () => clearTimeout(t)
        }
        if (!allDone) {
            prevLockedRef.current = false
            setIsLocked(false)
        }
    }, [allDone])

    // ── Global mouse tracking ──
    useEffect(() => {
        if (isTouchRef.current) return
        const onMove  = (e) => { mouseRef.current = { x: e.clientX, y: e.clientY } }
        const onLeave = ()  => { mouseRef.current = { x: null, y: null } }
        window.addEventListener('mousemove',  onMove,  { passive: true })
        window.addEventListener('mouseleave', onLeave, { passive: true })
        return () => {
            window.removeEventListener('mousemove',  onMove)
            window.removeEventListener('mouseleave', onLeave)
        }
    }, [])

    // ── Initial placement at zone center ──
    useEffect(() => {
        // Small delay to let zone render and get real dimensions
        const t = setTimeout(() => applyPos(0, 0), 20)
        return () => clearTimeout(t)
    }, [applyPos])

    const btnClass = [
        'auth-runaway-btn',
        isEscaping && !allDone ? 'is-escaping' : '',
        isLocked               ? 'is-locked'   : '',
    ].filter(Boolean).join(' ')

    return (
        <div className="runaway-button-zone" ref={zoneRef}>
            <button
                ref={btnRef}
                type="submit"
                className={btnClass}
                onClick={onSubmit}
            >
                {loading ? (
                    <span className="auth-spinner" />
                ) : (
                    <>
                        {children}
                        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path
                                fillRule="evenodd"
                                d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
                                clipRule="evenodd"
                            />
                        </svg>
                    </>
                )}
            </button>
        </div>
    )
}

export default RunawayButton
