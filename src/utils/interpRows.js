/**
 * Interpolate all flight-relevant fields between the two rows
 * surrounding the given virtual time `vt` (seconds from start).
 */
export function interpRows(rows, vt) {
  if (!rows || !rows.length) return null
  if (vt <= rows[0]._tSec) return rows[0]
  const last = rows.length - 1
  if (vt >= rows[last]._tSec) return rows[last]

  // Binary search: find lo s.t. rows[lo]._tSec <= vt < rows[lo+1]._tSec
  let lo = 0, hi = last
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (rows[mid]._tSec <= vt) lo = mid; else hi = mid
  }

  const a = rows[lo], b = rows[lo + 1]
  const dt = b._tSec - a._tSec
  const t = dt > 0 ? (vt - a._tSec) / dt : 0

  const lerp = (x, y) =>
    x != null && y != null ? x + (y - x) * t : (x ?? y ?? null)

  // Angle lerp through shortest arc
  const lerpAngle = (x, y) => {
    if (x == null || y == null) return x ?? y ?? null
    const d = ((y - x + 540) % 360) - 180
    return x + d * t
  }

  return {
    ...a,
    _tSec:        vt,
    _lat:         lerp(a._lat, b._lat),
    _lon:         lerp(a._lon, b._lon),
    'Alt(m)':     lerp(a['Alt(m)'],     b['Alt(m)']),
    'GSpd(kmh)':  lerp(a['GSpd(kmh)'],  b['GSpd(kmh)']),
    'Hdg(°)':     lerpAngle(a['Hdg(°)'], b['Hdg(°)']),
    'VSpd(m/s)':  lerp(a['VSpd(m/s)'],  b['VSpd(m/s)']),
    _pitchDeg:    lerp(a._pitchDeg,    b._pitchDeg),
    _rollDeg:     lerp(a._rollDeg,     b._rollDeg),
    _yawDeg:      lerp(a._yawDeg,      b._yawDeg),
  }
}
