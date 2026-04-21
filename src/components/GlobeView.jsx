import { useEffect, useRef, useMemo, useState } from 'react'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { interpRows } from '../utils/interpRows'

Cesium.Ion.defaultAccessToken = ''

const FM_COLORS = {
  ANGL: '#9ece6a', RTH: '#f7768e', CRUZ: '#7dcfff',
  MANU: '#565f89', ACRO: '#ff9e64', HOLD: '#bb9af7',
  NAVWP: '#e0af68', POSHOLD: '#bb9af7', ALTHOLD: '#ff79c6',
  LAND: '#f7768e',
}
function fmColor(m) { return FM_COLORS[m] || '#7aa2f7' }

function buildPlaneCanvas() {
  const S = 96
  const c = document.createElement('canvas')
  c.width = S; c.height = S
  const g = c.getContext('2d')
  const cx = S / 2, cy = S / 2

  // ── Drop shadow pass ─────────────────────────────────────────────────────
  g.save()
  g.shadowColor = 'rgba(0,0,0,0.55)'
  g.shadowBlur  = 7
  g.shadowOffsetX = 1.5; g.shadowOffsetY = 3

  // Main wings (swept, tapered)
  g.beginPath()
  g.moveTo(cx,     cy - 12)
  g.lineTo(cx - 44, cy + 10)
  g.lineTo(cx - 40, cy + 16)
  g.lineTo(cx,     cy + 4)
  g.lineTo(cx + 40, cy + 16)
  g.lineTo(cx + 44, cy + 10)
  g.closePath()
  g.fillStyle = '#8a8fa8'; g.fill()

  // Fuselage
  g.beginPath()
  g.ellipse(cx, cy, 7, 40, 0, 0, Math.PI * 2)
  g.fillStyle = '#9094aa'; g.fill()
  g.restore()

  // ── Wings with gradient ───────────────────────────────────────────────────
  g.beginPath()
  g.moveTo(cx,     cy - 12)
  g.lineTo(cx - 44, cy + 10)
  g.lineTo(cx - 40, cy + 16)
  g.lineTo(cx,     cy + 4)
  g.lineTo(cx + 40, cy + 16)
  g.lineTo(cx + 44, cy + 10)
  g.closePath()
  const wGrad = g.createLinearGradient(cx - 44, 0, cx + 44, 0)
  wGrad.addColorStop(0,    '#5a6080')
  wGrad.addColorStop(0.28, '#a8adc0')
  wGrad.addColorStop(0.5,  '#d0d4e4')
  wGrad.addColorStop(0.72, '#a8adc0')
  wGrad.addColorStop(1,    '#5a6080')
  g.fillStyle = wGrad; g.fill()

  // Wing leading-edge highlight
  g.beginPath()
  g.moveTo(cx,     cy - 12)
  g.lineTo(cx - 44, cy + 10)
  g.lineTo(cx - 42, cy + 8)
  g.lineTo(cx,     cy - 14)
  g.lineTo(cx + 42, cy + 8)
  g.lineTo(cx + 44, cy + 10)
  g.closePath()
  g.fillStyle = 'rgba(255,255,255,0.14)'; g.fill()

  // ── Fuselage with radial gradient ────────────────────────────────────────
  g.beginPath()
  g.ellipse(cx, cy, 7, 40, 0, 0, Math.PI * 2)
  const fGrad = g.createRadialGradient(cx - 2, cy - 10, 1, cx, cy, 14)
  fGrad.addColorStop(0,   '#eceef8')
  fGrad.addColorStop(0.6, '#b0b4c8')
  fGrad.addColorStop(1,   '#70748a')
  g.fillStyle = fGrad; g.fill()

  // Fuselage spine line
  g.beginPath()
  g.moveTo(cx, cy - 38); g.lineTo(cx, cy + 38)
  g.strokeStyle = 'rgba(255,255,255,0.2)'; g.lineWidth = 1; g.stroke()

  // ── Nose cone ────────────────────────────────────────────────────────────
  g.beginPath()
  g.ellipse(cx, cy - 41, 4.5, 7, 0, 0, Math.PI * 2)
  const nGrad = g.createRadialGradient(cx - 1, cy - 43, 1, cx, cy - 41, 6)
  nGrad.addColorStop(0, '#f0f2ff'); nGrad.addColorStop(1, '#8084a0')
  g.fillStyle = nGrad; g.fill()

  // ── Horizontal stabiliser ────────────────────────────────────────────────
  g.beginPath()
  g.moveTo(cx,     cy + 28)
  g.lineTo(cx - 22, cy + 40)
  g.lineTo(cx - 19, cy + 44)
  g.lineTo(cx,     cy + 34)
  g.lineTo(cx + 19, cy + 44)
  g.lineTo(cx + 22, cy + 40)
  g.closePath()
  const sGrad = g.createLinearGradient(cx - 22, 0, cx + 22, 0)
  sGrad.addColorStop(0, '#5a6080'); sGrad.addColorStop(0.5, '#9094a8'); sGrad.addColorStop(1, '#5a6080')
  g.fillStyle = sGrad; g.fill()

  // ── Vertical stabiliser ──────────────────────────────────────────────────
  g.beginPath()
  g.roundRect(cx - 2.5, cy + 26, 5, 14, 2)
  g.fillStyle = '#7c8098'; g.fill()

  // ── Cockpit ──────────────────────────────────────────────────────────────
  g.beginPath()
  g.ellipse(cx, cy - 22, 3.5, 6, 0, 0, Math.PI * 2)
  const cGrad = g.createRadialGradient(cx - 1, cy - 24, 1, cx, cy - 22, 5)
  cGrad.addColorStop(0, 'rgba(160,210,255,0.9)')
  cGrad.addColorStop(1, 'rgba(40,80,140,0.7)')
  g.fillStyle = cGrad; g.fill()
  g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 0.8; g.stroke()

  // ── Nav lights ───────────────────────────────────────────────────────────
  g.beginPath(); g.arc(cx - 44, cy + 10, 3, 0, Math.PI * 2)
  g.fillStyle = '#ff3333'; g.fill()
  g.beginPath(); g.arc(cx + 44, cy + 10, 3, 0, Math.PI * 2)
  g.fillStyle = '#33ee55'; g.fill()

  // Light glow
  const drawGlow = (x, y, col) => {
    g.save(); g.globalAlpha = 0.35
    g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2)
    const gl = g.createRadialGradient(x, y, 0, x, y, 6)
    gl.addColorStop(0, col); gl.addColorStop(1, 'transparent')
    g.fillStyle = gl; g.fill(); g.restore()
  }
  drawGlow(cx - 44, cy + 10, '#ff3333')
  drawGlow(cx + 44, cy + 10, '#33ee55')

  return c
}

function updateHud(el, r) {
  if (!el || !r) return
  const fm   = r['FM'] || '—'
  const alt  = r['Alt(m)'] ?? 0
  const vspd = r['VSpd(m/s)'] ?? 0
  const spd  = r['GSpd(kmh)'] ?? 0
  const hdg  = r['Hdg(°)'] ?? 0
  el.innerHTML = [
    `<span style="color:${fmColor(fm)};font-weight:700">${fm}</span>`,
    `<span style="color:#9ece6a">ALT</span> ${alt.toFixed(1)}<small>m</small>`,
    `<span style="color:#7dcfff">V/S</span> ${vspd >= 0 ? '+' : ''}${vspd.toFixed(1)}<small>m/s</small>`,
    `<span style="color:#f7768e">PCH</span> ${(r._pitchDeg ?? 0).toFixed(1)}°`,
    `<span style="color:#7aa2f7">RLL</span> ${(r._rollDeg ?? 0).toFixed(1)}°`,
    `<span style="color:#e0af68">HDG</span> ${hdg.toFixed(0)}°`,
    `<span style="color:#ff9e64">SPD</span> ${spd.toFixed(0)}<small>km/h</small>`,
  ].join('<br/>')
}

// Lerp a heading angle correctly through the shortest arc
function lerpHdg(from, to, t) {
  let diff = ((to - from + 540) % 360) - 180
  return from + diff * t
}

export default function GlobeView({ rows, cursorIndex, virtualTimeRef }) {
  const containerRef  = useRef(null)
  const stateRef      = useRef(null)   // { viewer, smooth: {pos, hdg, dist} }
  const curRowRef     = useRef(null)   // latest interpolated row (updated in preRender)
  const autoRef       = useRef(true)
  const hudRef        = useRef(null)
  const hudTimerRef   = useRef(null)
  const [autoMode, setAutoMode] = useState(true)

  const gpsRows = useMemo(() => rows.filter(r => r._lat != null && r._lon != null), [rows])

  // ── Build scene once ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || gpsRows.length < 2) return


    const viewer = new Cesium.Viewer(containerRef.current, {
      geocoder: false, homeButton: false, sceneModePicker: false,
      navigationHelpButton: false, animation: false, timeline: false,
      baseLayerPicker: false, fullscreenButton: false,
      selectionIndicator: false, infoBox: false,
    })

    // Hide credits
    const cc = viewer.cesiumWidget?.creditContainer
    if (cc) cc.style.display = 'none'

    // Satellite imagery — ArcGIS (no key), fallback to OSM
    viewer.imageryLayers.removeAll()
    Cesium.ArcGisMapServerImageryProvider
      .fromUrl('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer')
      .then(p => viewer.imageryLayers.addImageryProvider(p))
      .catch(() =>
        Cesium.OpenStreetMapImageryProvider.fromUrl('https://tile.openstreetmap.org/')
          .then(p => viewer.imageryLayers.addImageryProvider(p))
      )

    // ── FM-coloured path segments ────────────────────────────────────────────
    let prevFM = null, segPts = []
    const flush = () => {
      if (segPts.length < 2) return
      viewer.entities.add({
        polyline: {
          positions: segPts.slice(), clampToGround: false, width: 3,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.25,
            color: Cesium.Color.fromCssColorString(fmColor(prevFM)),
          }),
        },
      })
    }
    for (const r of gpsRows) {
      const fm = r['FM'] || 'UNKNOWN'
      const pt = Cesium.Cartesian3.fromDegrees(r._lon, r._lat, Math.max(0, r['Alt(m)'] || 0))
      if (fm !== prevFM) { flush(); segPts = segPts.length ? [segPts[segPts.length - 1]] : []; prevFM = fm }
      segPts.push(pt)
    }
    flush()

    // Start / end dots
    const addDot = (r, color) => viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(r._lon, r._lat, Math.max(0, r['Alt(m)'] || 0)),
      point: { pixelSize: 9, color: Cesium.Color.fromCssColorString(color), outlineColor: Cesium.Color.WHITE, outlineWidth: 2, disableDepthTestDistance: Infinity },
    })
    addDot(gpsRows[0], '#9ece6a')
    addDot(gpsRows[gpsRows.length - 1], '#f7768e')

    // ── Aircraft billboard — canvas-rendered model ───────────────────────────
    const planeCanvas = buildPlaneCanvas()

    viewer.entities.add({
      position: new Cesium.CallbackProperty(() => {
        const r = curRowRef.current
        if (!r || r._lat == null) return Cesium.Cartesian3.fromDegrees(gpsRows[0]._lon, gpsRows[0]._lat, 0)
        return Cesium.Cartesian3.fromDegrees(r._lon, r._lat, Math.max(0, r['Alt(m)'] || 0))
      }, false),
      billboard: {
        image: planeCanvas,
        width: 56, height: 56,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        rotation: new Cesium.CallbackProperty(
          () => -Cesium.Math.toRadians(curRowRef.current?.['Hdg(°)'] || 0), false
        ),
        alignedAxis: Cesium.Cartesian3.UNIT_Z,
        disableDepthTestDistance: Infinity,
      },
    })

    // Altitude stem
    viewer.entities.add({
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          const r = curRowRef.current
          if (!r || r._lat == null) return []
          const alt = Math.max(0, r['Alt(m)'] || 0)
          return [
            Cesium.Cartesian3.fromDegrees(r._lon, r._lat, 0),
            Cesium.Cartesian3.fromDegrees(r._lon, r._lat, alt),
          ]
        }, false),
        width: 1.5,
        material: new Cesium.ColorMaterialProperty(
          Cesium.Color.fromCssColorString('#ff9e64').withAlpha(0.35)
        ),
      },
    })

    // ── Per-frame: interpolate row + smooth camera ───────────────────────────
    const smooth = { pos: null, hdg: 0, dist: 500 }
    let lastHudUpdate = 0

    viewer.scene.preRender.addEventListener(() => {
      // Always interpolate current row for aircraft billboard/stem
      const vt = virtualTimeRef?.current ?? rows[0]._tSec
      const r  = interpRows(rows, vt)
      if (!r || r._lat == null) return
      curRowRef.current = r

      // Throttle HUD updates to ~10fps
      const now = performance.now()
      if (now - lastHudUpdate > 100) {
        lastHudUpdate = now
        const hud = hudRef.current
        if (hud) updateHud(hud, r)
      }

      if (!autoRef.current) return

      const alt    = Math.max(0, r['Alt(m)'] || 0)
      const spdMs  = (r['GSpd(kmh)'] || 0) / 3.6
      const target = Cesium.Cartesian3.fromDegrees(r._lon, r._lat, alt)
      const hdg    = r['Hdg(°)'] || 0

      // Dynamic distance: base 150m + 10m per m/s + 3m per metre altitude
      const targetDist = Math.max(150, Math.min(2000, spdMs * 10 + alt * 3 + 150))

      if (!smooth.pos) {
        smooth.pos  = target.clone()
        smooth.hdg  = hdg
        smooth.dist = targetDist
      } else {
        // Position tracks fairly closely so the aircraft marker stays accurate
        Cesium.Cartesian3.lerp(smooth.pos, target, 0.05, smooth.pos)
        // Heading rotates very slowly — camera lags 2-4s behind turns (intentional)
        smooth.hdg  = lerpHdg(smooth.hdg, hdg, 0.012)
        // Zoom eases in even more gently so it never lurches
        smooth.dist += (targetDist - smooth.dist) * 0.02
      }

      viewer.camera.lookAt(
        smooth.pos,
        new Cesium.HeadingPitchRange(
          Cesium.Math.toRadians(smooth.hdg + 180),
          Cesium.Math.toRadians(-38),
          smooth.dist,
        )
      )
    })

    // Initial fly-to overview
    const lons = gpsRows.map(r => r._lon), lats = gpsRows.map(r => r._lat)
    const pad = 0.008
    viewer.camera.flyTo({
      destination: Cesium.Rectangle.fromDegrees(
        Math.min(...lons) - pad, Math.min(...lats) - pad,
        Math.max(...lons) + pad, Math.max(...lats) + pad,
      ),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-50), roll: 0 },
      duration: 2,
      complete: () => {
        // Enable auto-follow after initial fly-in
        smooth.pos = null
      },
    })

    stateRef.current = { viewer, smooth }
    curRowRef.current = gpsRows[0]

    return () => {
      stateRef.current = null
      try { viewer.destroy() } catch (_) {}
    }
  }, [gpsRows])

  // ── Toggle auto / manual ───────────────────────────────────────────────────
  const toggleAuto = () => {
    const next = !autoMode
    setAutoMode(next)
    autoRef.current = next
    const s = stateRef.current
    if (!s) return
    if (!next) {
      // Release camera lock so user can pan freely
      s.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY)
    } else {
      // Snap smooth position to current row on next preRender tick
      s.smooth.pos = null
    }
  }

  // HUD is now driven by the preRender loop — no useEffect needed here

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <div ref={hudRef} className="globe-hud" />
      <button
        className={`globe-auto-btn${autoMode ? ' active' : ''}`}
        onClick={toggleAuto}
        title={autoMode ? 'Click to take manual control' : 'Click to re-enable auto follow'}
      >
        {autoMode ? '⊙ AUTO' : '✥ MANUAL'}
      </button>
    </div>
  )
}
