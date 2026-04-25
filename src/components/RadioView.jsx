import { useEffect, useRef, useState } from 'react'
import { interpRows } from '../utils/interpRows'

// ── Geometry constants ────────────────────────────────────────────────────────
const GIMBAL_R = 44          // gimbal dish radius
const STICK_TRAVEL = 30      // max pixel travel of stick tip from center
const LEFT_GIMBAL = { cx: 118, cy: 236 }
const RIGHT_GIMBAL = { cx: 282, cy: 236 }

// Switch lever rotation: -1 = down (20°), 0 = mid (0°), +1 = up (-20°)
const switchRotation = v => (v == null ? 0 : -v * 22)
const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

export default function RadioView({ rows, cursorIndex, virtualTimeRef }) {
  // Transmitter mode: 2 = throttle on left (global default), 1 = throttle on right
  const [mode, setMode] = useState(2)

  // Refs for live-updated SVG nodes
  const leftStickRef = useRef(null)
  const leftDotRef = useRef(null)
  const rightStickRef = useRef(null)
  const rightDotRef = useRef(null)
  const throttleBarRef = useRef(null)
  const throttlePctRef = useRef(null)

  const switchRefs = {
    SA: useRef(null), SB: useRef(null), SC: useRef(null), SD: useRef(null),
    SE: useRef(null), SF: useRef(null), SG: useRef(null), SH: useRef(null),
  }
  const switchLabelRefs = {
    SA: useRef(null), SB: useRef(null), SC: useRef(null), SD: useRef(null),
    SE: useRef(null), SF: useRef(null), SG: useRef(null), SH: useRef(null),
  }

  const p1Ref = useRef(null)
  const p2Ref = useRef(null)
  const p3Ref = useRef(null)
  const sl1Ref = useRef(null)
  const sl2Ref = useRef(null)

  const lcdTimeRef = useRef(null)
  const lcdModeRef = useRef(null)
  const lcdAltRef = useRef(null)
  const lcdSpdRef = useRef(null)
  const lcdRssiRef = useRef(null)
  const lcdTxBatRef = useRef(null)

  // Live update loop — reads virtualTimeRef each frame, interpolates & pokes SVG
  useEffect(() => {
    let raf
    const tick = () => {
      const vt = virtualTimeRef?.current ?? rows[cursorIndex]?._tSec ?? 0
      const r = interpRows(rows, vt)
      if (r) {
        const rud = r._rudN ?? 0
        const ele = r._eleN ?? 0
        const thr = r._thrN ?? 0
        const ail = r._ailN ?? 0

        // Mode 2 default: LEFT = throttle+rudder, RIGHT = elevator+aileron
        // Mode 1: LEFT = elevator+rudder, RIGHT = throttle+aileron
        const leftX = rud
        const leftY = mode === 2 ? -thr : -ele
        const rightX = ail
        const rightY = mode === 2 ? -ele : -thr

        const lx = clamp(leftX, -1, 1) * STICK_TRAVEL
        const ly = clamp(leftY, -1, 1) * STICK_TRAVEL
        const rx = clamp(rightX, -1, 1) * STICK_TRAVEL
        const ry = clamp(rightY, -1, 1) * STICK_TRAVEL

        leftStickRef.current?.setAttribute('transform',
          `translate(${LEFT_GIMBAL.cx + lx} ${LEFT_GIMBAL.cy + ly})`)
        leftDotRef.current?.setAttribute('transform',
          `translate(${LEFT_GIMBAL.cx + lx} ${LEFT_GIMBAL.cy + ly})`)
        rightStickRef.current?.setAttribute('transform',
          `translate(${RIGHT_GIMBAL.cx + rx} ${RIGHT_GIMBAL.cy + ry})`)
        rightDotRef.current?.setAttribute('transform',
          `translate(${RIGHT_GIMBAL.cx + rx} ${RIGHT_GIMBAL.cy + ry})`)

        // Throttle bar on LCD (0-100%)
        const thrPct = Math.round(((thr + 1) / 2) * 100)
        if (throttleBarRef.current) {
          const fill = ((thr + 1) / 2) * 54  // bar width 54px
          throttleBarRef.current.setAttribute('width', String(fill))
        }
        if (throttlePctRef.current) {
          throttlePctRef.current.textContent = `${thrPct}%`
        }

        // Switches: rotate lever, update label
        for (const key of ['SA','SB','SC','SD','SE','SF','SG','SH']) {
          const v = r[key]
          const ref = switchRefs[key].current
          const labelRef = switchLabelRefs[key].current
          if (ref) {
            // Store base transform in data-base and append rotation
            const base = ref.dataset.base || ''
            ref.setAttribute('transform', `${base} rotate(${switchRotation(v)})`)
          }
          if (labelRef) {
            labelRef.textContent = v === 1 ? '▲' : v === -1 ? '▼' : '●'
            labelRef.setAttribute('fill',
              v === 1 ? '#9ece6a' : v === -1 ? '#f7768e' : '#7aa2f7')
          }
        }

        // Pots: rotate indicator line. -1 → -135°, 0 → 0°, +1 → +135°
        const potRot = v => (v == null ? 0 : clamp(v, -1, 1) * 135)
        p1Ref.current?.setAttribute('transform',
          `rotate(${potRot(r._p1N)} 186 296)`)
        p2Ref.current?.setAttribute('transform',
          `rotate(${potRot(r._p2N)} 200 296)`)
        p3Ref.current?.setAttribute('transform',
          `rotate(${potRot(r._p3N)} 214 296)`)

        // Sliders: vertical translate, -1 → top, +1 → bottom (length 70px)
        const slPos = v => (v == null ? 0 : -clamp(v, -1, 1) * 28)
        sl1Ref.current?.setAttribute('transform',
          `translate(0 ${slPos(r._sl1N)})`)
        sl2Ref.current?.setAttribute('transform',
          `translate(0 ${slPos(r._sl2N)})`)

        // LCD text
        if (lcdTimeRef.current) {
          const s = Math.max(0, Math.round(r._tSec))
          lcdTimeRef.current.textContent =
            `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
        }
        if (lcdModeRef.current) lcdModeRef.current.textContent = r['FM'] || '---'
        if (lcdAltRef.current) {
          const a = r['Alt(m)']
          lcdAltRef.current.textContent = a != null ? `${Math.round(a)}m` : '--'
        }
        if (lcdSpdRef.current) {
          const s = r['GSpd(kmh)']
          lcdSpdRef.current.textContent = s != null ? `${Math.round(s)}` : '--'
        }
        if (lcdRssiRef.current) {
          const s = r['1RSS(dB)']
          lcdRssiRef.current.textContent = s != null ? `${Math.round(s)}dB` : '--'
        }
        if (lcdTxBatRef.current) {
          const v = r['TxBat(V)']
          lcdTxBatRef.current.textContent = v != null ? `${v.toFixed(1)}V` : '--'
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [rows, virtualTimeRef, cursorIndex, mode])

  // ── Helpers to render the two types of switches ────────────────────────────
  // 3-position switch: tall rocker with 3 detents
  // 2-position switch: shorter, 2 states
  const Switch = ({ x, y, label, refKey, threePos = true }) => (
    <g>
      {/* Base housing */}
      <rect x={x - 6} y={y - 2} width={12} height={14} rx={2}
        fill="url(#switchBase)" stroke="#0a0a0a" strokeWidth={0.6} />
      {/* Lever (rotates about pivot at bottom) */}
      <g
        ref={switchRefs[refKey]}
        data-base={`translate(${x} ${y + 6})`}
        transform={`translate(${x} ${y + 6})`}
      >
        <rect x={-1.2} y={-20} width={2.4} height={20}
          fill="url(#leverGrad)" stroke="#0a0a0a" strokeWidth={0.4} />
        <circle cx={0} cy={-20} r={2.2} fill="url(#leverTip)" stroke="#0a0a0a" strokeWidth={0.4} />
      </g>
      {/* Label below */}
      <text x={x} y={y + 22} textAnchor="middle" fontSize="6.5"
        fill="#c0caf5" fontFamily="Segoe UI" fontWeight="600">
        {label}
      </text>
      {/* Live position indicator (arrow) */}
      <text
        ref={switchLabelRefs[refKey]}
        x={x + 9} y={y + 7} fontSize="5.5" fill="#7aa2f7" fontFamily="monospace">
        ●
      </text>
    </g>
  )

  // ── Trim button (cosmetic) ─────────────────────────────────────────────────
  const Trim = ({ x, y, horizontal = false }) => (
    <rect
      x={x} y={y}
      width={horizontal ? 18 : 4}
      height={horizontal ? 4 : 18}
      rx={1.5}
      fill="#2a2b3a" stroke="#0a0a0a" strokeWidth={0.4}
    />
  )

  return (
    <div className="radio-view">
      <div className="radio-header">
        <span className="radio-title">TRANSMITTER</span>
        <div className="radio-mode">
          <span className="radio-mode-label">Mode</span>
          <button
            className={`radio-mode-btn${mode === 2 ? ' active' : ''}`}
            onClick={() => setMode(2)}
            title="Mode 2: throttle on left stick (default worldwide)"
          >2</button>
          <button
            className={`radio-mode-btn${mode === 1 ? ' active' : ''}`}
            onClick={() => setMode(1)}
            title="Mode 1: throttle on right stick"
          >1</button>
        </div>
      </div>

      <svg viewBox="0 0 400 340" className="radio-svg" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Shell gradient: dark → darker → dark */}
          <linearGradient id="shellGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a2d3e" />
            <stop offset="30%" stopColor="#1c1e2b" />
            <stop offset="70%" stopColor="#171823" />
            <stop offset="100%" stopColor="#0d0e15" />
          </linearGradient>

          <linearGradient id="shellHighlight" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a3d52" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#3a3d52" stopOpacity="0" />
          </linearGradient>

          {/* Gimbal dish: darker center, lighter rim */}
          <radialGradient id="gimbalDish" cx="0.5" cy="0.5" r="0.6">
            <stop offset="0%" stopColor="#050608" />
            <stop offset="60%" stopColor="#0c0d14" />
            <stop offset="100%" stopColor="#272a3a" />
          </radialGradient>

          <radialGradient id="gimbalRim" cx="0.5" cy="0.35" r="0.7">
            <stop offset="0%" stopColor="#444758" />
            <stop offset="100%" stopColor="#1a1c28" />
          </radialGradient>

          {/* Stick shaft */}
          <linearGradient id="stickShaft" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1a1c28" />
            <stop offset="50%" stopColor="#5a5d72" />
            <stop offset="100%" stopColor="#1a1c28" />
          </linearGradient>

          {/* Stick knob — metallic */}
          <radialGradient id="stickKnob" cx="0.35" cy="0.3" r="0.7">
            <stop offset="0%" stopColor="#e8eaf5" />
            <stop offset="40%" stopColor="#8e92a8" />
            <stop offset="100%" stopColor="#2a2c3a" />
          </radialGradient>

          {/* LCD — classic green */}
          <linearGradient id="lcdBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a3a20" />
            <stop offset="100%" stopColor="#1a2414" />
          </linearGradient>

          {/* Switch base/lever */}
          <linearGradient id="switchBase" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3c3f52" />
            <stop offset="100%" stopColor="#1a1c28" />
          </linearGradient>

          <linearGradient id="leverGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#2a2c3a" />
            <stop offset="50%" stopColor="#9095aa" />
            <stop offset="100%" stopColor="#2a2c3a" />
          </linearGradient>

          <radialGradient id="leverTip" cx="0.35" cy="0.3" r="0.7">
            <stop offset="0%" stopColor="#e8eaf5" />
            <stop offset="60%" stopColor="#6a6d80" />
            <stop offset="100%" stopColor="#1a1c28" />
          </radialGradient>

          {/* Pot knob */}
          <radialGradient id="potKnob" cx="0.4" cy="0.35" r="0.65">
            <stop offset="0%" stopColor="#5a5d72" />
            <stop offset="60%" stopColor="#2a2c3a" />
            <stop offset="100%" stopColor="#0a0b12" />
          </radialGradient>

          {/* Slider groove */}
          <linearGradient id="sliderGroove" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0a0b12" />
            <stop offset="50%" stopColor="#1a1c28" />
            <stop offset="100%" stopColor="#0a0b12" />
          </linearGradient>

          {/* Drop-shadow filter */}
          <filter id="bodyShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
            <feOffset dx="0" dy="2" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.6" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ── Antennas ─────────────────────────────────────────────────────── */}
        <g>
          {/* Left antenna */}
          <line x1="78" y1="60" x2="78" y2="4" stroke="#2a2c3a" strokeWidth="2.4" strokeLinecap="round" />
          <line x1="78" y1="58" x2="78" y2="8" stroke="#5a5d72" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="78" cy="4" r="1.8" fill="#9095aa" />
          {/* Right antenna */}
          <line x1="322" y1="60" x2="322" y2="4" stroke="#2a2c3a" strokeWidth="2.4" strokeLinecap="round" />
          <line x1="322" y1="58" x2="322" y2="8" stroke="#5a5d72" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="322" cy="4" r="1.8" fill="#9095aa" />
        </g>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <g filter="url(#bodyShadow)">
          {/* Main shell */}
          <path
            d="M 30,60
               Q 30,50 40,50
               L 360,50
               Q 370,50 370,60
               L 370,290
               Q 370,310 345,318
               L 230,330
               Q 200,332 170,330
               L 55,318
               Q 30,310 30,290 Z"
            fill="url(#shellGrad)"
            stroke="#000"
            strokeWidth="1"
          />
          {/* Top highlight */}
          <path
            d="M 30,60
               Q 30,50 40,50
               L 360,50
               Q 370,50 370,60
               L 370,78
               L 30,78 Z"
            fill="url(#shellHighlight)"
          />
        </g>

        {/* ── Shoulder accent line ───────────────────────────────────────── */}
        <line x1="30" y1="95" x2="370" y2="95" stroke="#0a0b12" strokeWidth="0.8" opacity="0.7" />

        {/* ── Shoulder switches (SA SB on left, SC SD on right) ──────────── */}
        <Switch x={62} y={62} label="SA" refKey="SA" />
        <Switch x={95} y={62} label="SB" refKey="SB" />
        <Switch x={305} y={62} label="SC" refKey="SC" />
        <Switch x={338} y={62} label="SD" refKey="SD" />

        {/* ── LCD screen ─────────────────────────────────────────────────── */}
        <g>
          {/* Screen bezel */}
          <rect x="135" y="58" width="130" height="62" rx="5"
            fill="#0a0b12" stroke="#000" strokeWidth="0.8" />
          {/* Screen background */}
          <rect x="139" y="62" width="122" height="54" rx="2"
            fill="url(#lcdBg)" />
          {/* LCD scanline effect */}
          {Array.from({ length: 14 }).map((_, i) => (
            <line key={i}
              x1="139" y1={62 + i * 4}
              x2="261" y2={62 + i * 4}
              stroke="#000" strokeWidth="0.4" opacity="0.15" />
          ))}

          {/* LCD text — row 1: mode & time */}
          <text ref={lcdModeRef} x="143" y="74" fontSize="10"
            fill="#9ece6a" fontFamily="Consolas,monospace" fontWeight="700">
            ---
          </text>
          <text ref={lcdTimeRef} x="257" y="74" fontSize="10" textAnchor="end"
            fill="#9ece6a" fontFamily="Consolas,monospace" fontWeight="700">
            00:00
          </text>

          {/* Row 2: Alt & Spd */}
          <text x="143" y="87" fontSize="7" fill="#7aa2f7" fontFamily="Consolas,monospace">Alt</text>
          <text ref={lcdAltRef} x="165" y="87" fontSize="8"
            fill="#9ece6a" fontFamily="Consolas,monospace" fontWeight="600">--</text>
          <text x="205" y="87" fontSize="7" fill="#7aa2f7" fontFamily="Consolas,monospace">kmh</text>
          <text ref={lcdSpdRef} x="257" y="87" fontSize="8" textAnchor="end"
            fill="#9ece6a" fontFamily="Consolas,monospace" fontWeight="600">--</text>

          {/* Row 3: RSSI & TxBat */}
          <text x="143" y="99" fontSize="7" fill="#7aa2f7" fontFamily="Consolas,monospace">RSSI</text>
          <text ref={lcdRssiRef} x="171" y="99" fontSize="8"
            fill="#9ece6a" fontFamily="Consolas,monospace" fontWeight="600">--</text>
          <text x="205" y="99" fontSize="7" fill="#7aa2f7" fontFamily="Consolas,monospace">Tx</text>
          <text ref={lcdTxBatRef} x="257" y="99" fontSize="8" textAnchor="end"
            fill="#9ece6a" fontFamily="Consolas,monospace" fontWeight="600">--</text>

          {/* Throttle bar */}
          <rect x="141" y="106" width="54" height="6" rx="1"
            fill="#0a0b12" stroke="#2a3a20" strokeWidth="0.4" />
          <rect ref={throttleBarRef} x="141" y="106" width="0" height="6" rx="1"
            fill="#9ece6a" />
          <text x="200" y="112" fontSize="7" fill="#7aa2f7" fontFamily="Consolas,monospace">THR</text>
          <text ref={throttlePctRef} x="257" y="112" fontSize="7" textAnchor="end"
            fill="#9ece6a" fontFamily="Consolas,monospace" fontWeight="600">0%</text>
        </g>

        {/* ── Status LEDs ────────────────────────────────────────────────── */}
        <circle cx="120" cy="87" r="1.6" fill="#9ece6a" opacity="0.9">
          <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="280" cy="87" r="1.6" fill="#ff9e64" opacity="0.7" />

        {/* ── Front switches (SE SF left, SG SH right) ────────────────────── */}
        <Switch x={60} y={140} label="SE" refKey="SE" />
        <Switch x={90} y={140} label="SF" refKey="SF" />
        <Switch x={310} y={140} label="SG" refKey="SG" />
        <Switch x={340} y={140} label="SH" refKey="SH" />

        {/* ── Left slider SL1 (vertical) ─────────────────────────────────── */}
        <g>
          <rect x="17" y="170" width="8" height="70" rx="4" fill="url(#sliderGroove)" stroke="#000" strokeWidth="0.5" />
          <line x1="21" y1="175" x2="21" y2="235" stroke="#000" strokeWidth="0.3" opacity="0.5" />
          <g ref={sl1Ref}>
            <rect x="14" y="202" width="14" height="7" rx="2" fill="url(#potKnob)" stroke="#000" strokeWidth="0.5" />
            <line x1="16" y1="205.5" x2="26" y2="205.5" stroke="#5a5d72" strokeWidth="0.4" />
          </g>
          <text x="21" y="252" textAnchor="middle" fontSize="6" fill="#c0caf5" fontWeight="600">SL1</text>
        </g>

        {/* ── Right slider SL2 (vertical) ────────────────────────────────── */}
        <g>
          <rect x="375" y="170" width="8" height="70" rx="4" fill="url(#sliderGroove)" stroke="#000" strokeWidth="0.5" />
          <line x1="379" y1="175" x2="379" y2="235" stroke="#000" strokeWidth="0.3" opacity="0.5" />
          <g ref={sl2Ref}>
            <rect x="372" y="202" width="14" height="7" rx="2" fill="url(#potKnob)" stroke="#000" strokeWidth="0.5" />
            <line x1="374" y1="205.5" x2="384" y2="205.5" stroke="#5a5d72" strokeWidth="0.4" />
          </g>
          <text x="379" y="252" textAnchor="middle" fontSize="6" fill="#c0caf5" fontWeight="600">SL2</text>
        </g>

        {/* ── LEFT GIMBAL ────────────────────────────────────────────────── */}
        <g>
          {/* Outer well */}
          <circle cx={LEFT_GIMBAL.cx} cy={LEFT_GIMBAL.cy} r={GIMBAL_R + 4}
            fill="url(#gimbalRim)" stroke="#000" strokeWidth="0.8" />
          {/* Dish */}
          <circle cx={LEFT_GIMBAL.cx} cy={LEFT_GIMBAL.cy} r={GIMBAL_R}
            fill="url(#gimbalDish)" />
          {/* Crosshair */}
          <line x1={LEFT_GIMBAL.cx - GIMBAL_R + 8} y1={LEFT_GIMBAL.cy}
                x2={LEFT_GIMBAL.cx + GIMBAL_R - 8} y2={LEFT_GIMBAL.cy}
                stroke="#2a2c3a" strokeWidth="0.5" opacity="0.6" />
          <line x1={LEFT_GIMBAL.cx} y1={LEFT_GIMBAL.cy - GIMBAL_R + 8}
                x2={LEFT_GIMBAL.cx} y2={LEFT_GIMBAL.cy + GIMBAL_R - 8}
                stroke="#2a2c3a" strokeWidth="0.5" opacity="0.6" />
          {/* Deadband ring */}
          <circle cx={LEFT_GIMBAL.cx} cy={LEFT_GIMBAL.cy} r={4}
            fill="none" stroke="#2a2c3a" strokeWidth="0.5" opacity="0.5" />
          {/* Max travel ring */}
          <circle cx={LEFT_GIMBAL.cx} cy={LEFT_GIMBAL.cy} r={STICK_TRAVEL}
            fill="none" stroke="#2a2c3a" strokeWidth="0.4" strokeDasharray="2 2" opacity="0.4" />
          {/* Stick shaft + boot */}
          <circle ref={leftStickRef} cx="0" cy="0" r="9"
            transform={`translate(${LEFT_GIMBAL.cx} ${LEFT_GIMBAL.cy})`}
            fill="url(#stickShaft)" stroke="#0a0b12" strokeWidth="0.6" />
          {/* Stick knob */}
          <circle ref={leftDotRef} cx="0" cy="0" r="6"
            transform={`translate(${LEFT_GIMBAL.cx} ${LEFT_GIMBAL.cy})`}
            fill="url(#stickKnob)" stroke="#000" strokeWidth="0.4" />

          {/* Trim buttons around left gimbal */}
          <Trim x={LEFT_GIMBAL.cx - 9} y={LEFT_GIMBAL.cy + GIMBAL_R + 10} horizontal />
          <Trim x={LEFT_GIMBAL.cx - GIMBAL_R - 14} y={LEFT_GIMBAL.cy - 9} />

          {/* Axis labels */}
          <text x={LEFT_GIMBAL.cx} y={LEFT_GIMBAL.cy + GIMBAL_R + 22}
            textAnchor="middle" fontSize="6" fill="#7aa2f7" fontFamily="Consolas,monospace">
            {mode === 2 ? 'THR / RUD' : 'ELE / RUD'}
          </text>
        </g>

        {/* ── RIGHT GIMBAL ───────────────────────────────────────────────── */}
        <g>
          <circle cx={RIGHT_GIMBAL.cx} cy={RIGHT_GIMBAL.cy} r={GIMBAL_R + 4}
            fill="url(#gimbalRim)" stroke="#000" strokeWidth="0.8" />
          <circle cx={RIGHT_GIMBAL.cx} cy={RIGHT_GIMBAL.cy} r={GIMBAL_R}
            fill="url(#gimbalDish)" />
          <line x1={RIGHT_GIMBAL.cx - GIMBAL_R + 8} y1={RIGHT_GIMBAL.cy}
                x2={RIGHT_GIMBAL.cx + GIMBAL_R - 8} y2={RIGHT_GIMBAL.cy}
                stroke="#2a2c3a" strokeWidth="0.5" opacity="0.6" />
          <line x1={RIGHT_GIMBAL.cx} y1={RIGHT_GIMBAL.cy - GIMBAL_R + 8}
                x2={RIGHT_GIMBAL.cx} y2={RIGHT_GIMBAL.cy + GIMBAL_R - 8}
                stroke="#2a2c3a" strokeWidth="0.5" opacity="0.6" />
          <circle cx={RIGHT_GIMBAL.cx} cy={RIGHT_GIMBAL.cy} r={4}
            fill="none" stroke="#2a2c3a" strokeWidth="0.5" opacity="0.5" />
          <circle cx={RIGHT_GIMBAL.cx} cy={RIGHT_GIMBAL.cy} r={STICK_TRAVEL}
            fill="none" stroke="#2a2c3a" strokeWidth="0.4" strokeDasharray="2 2" opacity="0.4" />
          <circle ref={rightStickRef} cx="0" cy="0" r="9"
            transform={`translate(${RIGHT_GIMBAL.cx} ${RIGHT_GIMBAL.cy})`}
            fill="url(#stickShaft)" stroke="#0a0b12" strokeWidth="0.6" />
          <circle ref={rightDotRef} cx="0" cy="0" r="6"
            transform={`translate(${RIGHT_GIMBAL.cx} ${RIGHT_GIMBAL.cy})`}
            fill="url(#stickKnob)" stroke="#000" strokeWidth="0.4" />

          <Trim x={RIGHT_GIMBAL.cx - 9} y={RIGHT_GIMBAL.cy + GIMBAL_R + 10} horizontal />
          <Trim x={RIGHT_GIMBAL.cx + GIMBAL_R + 10} y={RIGHT_GIMBAL.cy - 9} />

          <text x={RIGHT_GIMBAL.cx} y={RIGHT_GIMBAL.cy + GIMBAL_R + 22}
            textAnchor="middle" fontSize="6" fill="#7aa2f7" fontFamily="Consolas,monospace">
            {mode === 2 ? 'ELE / AIL' : 'THR / AIL'}
          </text>
        </g>

        {/* ── Pots P1 P2 P3 between the gimbals, lower center ────────────── */}
        <g>
          {[{ ref: p1Ref, cx: 186, label: 'P1' },
            { ref: p2Ref, cx: 200, label: 'P2' },
            { ref: p3Ref, cx: 214, label: 'P3' }].map(p => (
            <g key={p.label}>
              <circle cx={p.cx} cy={296} r={5.5}
                fill="url(#potKnob)" stroke="#000" strokeWidth="0.5" />
              {/* Indicator line */}
              <line ref={p.ref} x1={p.cx} y1={296} x2={p.cx} y2={292}
                stroke="#9ece6a" strokeWidth="1.1" strokeLinecap="round" />
              <text x={p.cx} y={310} textAnchor="middle" fontSize="5.5"
                fill="#c0caf5" fontWeight="600">{p.label}</text>
            </g>
          ))}
        </g>

        {/* ── Speaker grille (decorative) ────────────────────────────────── */}
        <g opacity="0.6">
          {Array.from({ length: 4 }).map((_, r) =>
            Array.from({ length: 4 }).map((__, c) => (
              <circle key={`${r}-${c}`} cx={55 + c * 3} cy={275 + r * 3} r={0.8} fill="#0a0b12" />
            ))
          )}
          {Array.from({ length: 4 }).map((_, r) =>
            Array.from({ length: 4 }).map((__, c) => (
              <circle key={`${r}-${c}r`} cx={333 + c * 3} cy={275 + r * 3} r={0.8} fill="#0a0b12" />
            ))
          )}
        </g>

        {/* ── Brand ──────────────────────────────────────────────────────── */}
        <text x="200" y="325" textAnchor="middle" fontSize="7"
          fill="#7aa2f7" fontFamily="Segoe UI" fontWeight="700" letterSpacing="1.5">
          EdgeTX
        </text>
      </svg>
    </div>
  )
}
