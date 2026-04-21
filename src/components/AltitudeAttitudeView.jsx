import { useEffect, useRef, useMemo } from 'react'
import * as THREE from 'three'
import { interpRows } from '../utils/interpRows'

function buildPlane() {
  const g = new THREE.Group()
  g.rotation.order = 'YXZ'

  const mat = {
    body: new THREE.MeshLambertMaterial({ color: 0xd4d8e8 }),
    dark: new THREE.MeshLambertMaterial({ color: 0x4a5066 }),
    nose: new THREE.MeshLambertMaterial({ color: 0xe8eaf0 }),
    wing: new THREE.MeshLambertMaterial({ color: 0xc0c4d4 }),
    red:  new THREE.MeshLambertMaterial({ color: 0xff4444 }),
    green:new THREE.MeshLambertMaterial({ color: 0x44ff88 }),
    prop: new THREE.MeshLambertMaterial({ color: 0x888899 }),
  }

  // fuselage — elongated along -Z (nose faces camera)
  const fuse = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 4.8), mat.body)
  g.add(fuse)

  // nose cone
  const noseCone = new THREE.Mesh(new THREE.ConeGeometry(0.27, 1.0, 8), mat.nose)
  noseCone.rotation.x = Math.PI / 2
  noseCone.position.set(0, 0, -2.9)
  g.add(noseCone)

  // tail taper (slightly narrower box)
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 1.2), mat.dark)
  tail.position.set(0, 0, 2.5)
  g.add(tail)

  // main wings
  const wingGeo = new THREE.BoxGeometry(9.4, 0.12, 1.3)
  const wings = new THREE.Mesh(wingGeo, mat.wing)
  wings.position.set(0, 0.02, 0.2)
  g.add(wings)

  // wing sweep (leading edge detail via thin strip)
  const sweepL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 1.4), mat.dark)
  sweepL.position.set(-4.66, 0.02, 0.18)
  g.add(sweepL)
  const sweepR = sweepL.clone()
  sweepR.position.x = 4.66
  g.add(sweepR)

  // horizontal stabiliser
  const hStab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.1, 0.75), mat.wing)
  hStab.position.set(0, 0.08, 2.4)
  g.add(hStab)

  // vertical stabiliser
  const vStab = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.8), mat.wing)
  vStab.position.set(0, 0.5, 2.3)
  g.add(vStab)

  // nav lights
  const navL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), mat.red)
  navL.position.set(-4.7, 0.1, 0.2)
  g.add(navL)
  const navR = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), mat.green)
  navR.position.set(4.7, 0.1, 0.2)
  g.add(navR)

  // propeller group (spins)
  const propGroup = new THREE.Group()
  propGroup.position.set(0, 0, -3.4)
  const blade1 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.8, 0.08), mat.prop)
  const blade2 = blade1.clone()
  blade2.rotation.z = Math.PI / 2
  propGroup.add(blade1, blade2)
  // spinner
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.25, 8), mat.dark)
  spinner.rotation.x = Math.PI / 2
  spinner.position.z = -0.18
  propGroup.add(spinner)
  g.add(propGroup)

  return { group: g, propGroup }
}

function applyPose(s, row, baseAlt, altRange, hud, ruler) {
  const alt   = row['Alt(m)'] ?? 0
  const pitch = row._pitchDeg != null ? (row._pitchDeg * Math.PI) / 180 : 0
  const roll  = row._rollDeg  != null ? (row._rollDeg  * Math.PI) / 180 : 0
  const yaw   = row._yawDeg   != null ? (row._yawDeg   * Math.PI) / 180 : 0
  const SCALE = 14 / altRange
  const planeY = Math.max(0.5, (alt - baseAlt) * SCALE)

  s.plane.rotation.x = -pitch
  s.plane.rotation.z = -roll
  s.plane.rotation.y = yaw
  s.plane.position.y = planeY
  s.pole.scale.y     = planeY
  s.pole.position.y  = planeY / 2
  s.shadowCircle.material.opacity = Math.max(0.05, 0.35 - planeY * 0.015)
  s.camera.position.set(11, planeY + 4, 18)
  s.camera.lookAt(0, planeY, 0)

  if (hud) {
    const vspd = row['VSpd(m/s)'] ?? 0
    const spd  = row['GSpd(kmh)'] ?? 0
    const hdg  = row['Hdg(°)'] ?? 0
    hud.innerHTML = [
      `<span style="color:#9ece6a">ALT</span> ${alt.toFixed(1)}<small>m</small>`,
      `<span style="color:#7dcfff">V/S</span> ${vspd >= 0 ? '+' : ''}${vspd.toFixed(1)}<small>m/s</small>`,
      `<span style="color:#f7768e">PCH</span> ${(row._pitchDeg ?? 0).toFixed(1)}°`,
      `<span style="color:#7aa2f7">RLL</span> ${(row._rollDeg ?? 0).toFixed(1)}°`,
      `<span style="color:#e0af68">HDG</span> ${hdg.toFixed(0)}°`,
      `<span style="color:#ff9e64">SPD</span> ${spd.toFixed(0)}<small>km/h</small>`,
    ].join('<br/>')
  }
  if (ruler) updateRuler(ruler, alt, baseAlt, altRange)
}

export default function AltitudeAttitudeView({ rows, cursorIndex, virtualTimeRef }) {
  const canvasRef = useRef(null)
  const sceneRef  = useRef(null)
  const hudRef    = useRef(null)
  const rulerRef  = useRef(null)
  const baRef     = useRef(0)   // baseAlt — updated without re-render
  const arRef     = useRef(30)  // altRange

  // Keep altitude constants in sync with rows
  useMemo(() => {
    baRef.current = rows[0]?.['Alt(m)'] ?? 0
    const alts = rows.map(r => r['Alt(m)'] ?? 0)
    arRef.current = Math.max(30, Math.max(...alts) - Math.min(...alts))
  }, [rows])

  // Build scene once per flight (rows changing means new log loaded)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const W = canvas.clientWidth
    const H = canvas.clientHeight

    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(W, H)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x080f1a)
    scene.fog = new THREE.FogExp2(0x080f1a, 0.022)

    // Lights
    const ambient = new THREE.AmbientLight(0x8899cc, 0.6)
    scene.add(ambient)
    const sun = new THREE.DirectionalLight(0xffffff, 1.2)
    sun.position.set(8, 20, 10)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    scene.add(sun)
    const fill = new THREE.DirectionalLight(0x3355aa, 0.3)
    fill.position.set(-8, 5, -10)
    scene.add(fill)

    // Ground
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x1e360d })
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    ground.position.y = 0
    scene.add(ground)

    // Grid
    const grid = new THREE.GridHelper(80, 40, 0x2a4020, 0x2a4020)
    grid.position.y = 0.01
    scene.add(grid)

    // Altitude pole
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x566190, transparent: true, opacity: 0.6 })
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 1, 6)
    const pole = new THREE.Mesh(poleGeo, poleMat)
    scene.add(pole)

    // Shadow circle under plane
    const shadowMat = new THREE.MeshLambertMaterial({ color: 0x000000, transparent: true, opacity: 0.35 })
    const shadowCircle = new THREE.Mesh(new THREE.CircleGeometry(1.4, 16), shadowMat)
    shadowCircle.rotation.x = -Math.PI / 2
    shadowCircle.position.y = 0.02
    scene.add(shadowCircle)

    // Plane model
    const { group: plane, propGroup } = buildPlane()
    scene.add(plane)

    // Camera
    const camera = new THREE.PerspectiveCamera(52, W / H, 0.1, 600)
    camera.position.set(11, 6, 18)
    camera.lookAt(0, 2, 0)

    // Handle resize
    const ro = new ResizeObserver(() => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    })
    ro.observe(canvas)

    // Store refs for cursor-driven updates
    sceneRef.current = { renderer, scene, camera, plane, propGroup, pole, shadowCircle }

    // Animation loop — interpolates pose every frame
    let raf
    const animate = () => {
      raf = requestAnimationFrame(animate)
      propGroup.rotation.z += 0.18

      const vt  = virtualTimeRef?.current ?? rows[0]._tSec
      const row = interpRows(rows, vt)
      if (row) applyPose({ renderer, scene, camera, plane, propGroup, pole, shadowCircle }, row, baRef.current, arRef.current, hudRef.current, rulerRef.current)

      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      renderer.dispose()
      sceneRef.current = null
    }
  }, [])

  // Pose is now driven inside the rAF loop — no separate useEffect needed

  return (
    <div className="attitude-view">
      <canvas ref={canvasRef} className="attitude-canvas" />

      {/* Altitude ruler */}
      <div ref={rulerRef} className="alt-ruler" />

      {/* HUD */}
      <div ref={hudRef} className="attitude-hud" />

      <div className="attitude-label">ATTITUDE</div>
    </div>
  )
}

function updateRuler(el, currentAlt, baseAlt, altRange) {
  const step = altRange > 200 ? 50 : altRange > 80 ? 25 : 10
  const maxAlt = baseAlt + altRange
  const minAlt = baseAlt

  const ticks = []
  const first = Math.ceil(minAlt / step) * step
  for (let a = first; a <= maxAlt + step * 0.5; a += step) {
    const pct = ((a - minAlt) / altRange) * 100
    const clamp = Math.min(98, Math.max(2, 100 - pct))
    const isCurrent = Math.abs(a - currentAlt) < step * 0.5
    ticks.push(
      `<div class="ruler-tick${isCurrent ? ' ruler-tick-active' : ''}" style="top:${clamp}%">` +
      `<span class="ruler-val">${a}</span><span class="ruler-line"></span></div>`
    )
  }

  // Current altitude indicator
  const curPct = 100 - (((currentAlt - minAlt) / altRange) * 100)
  const clamped = Math.min(96, Math.max(3, curPct))
  ticks.push(
    `<div class="ruler-cursor" style="top:${clamped}%">` +
    `<span class="ruler-cursor-val">${currentAlt.toFixed(0)}</span>` +
    `<span class="ruler-cursor-arrow">◄</span></div>`
  )

  el.innerHTML = ticks.join('')
}
