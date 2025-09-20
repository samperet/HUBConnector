export const DEG2RAD = Math.PI / 180
export const RAD2DEG = 180 / Math.PI

export const nearlyEqual = (a: number, b: number, epsilon = 1e-6) =>
  Math.abs(a - b) <= epsilon

export const toRadians = (deg: number): number => deg * DEG2RAD
export const toDegrees = (rad: number): number => rad * RAD2DEG

export const normalizeDegrees = (deg: number): number => {
  let value = deg % 360
  if (value > 180) value -= 360
  if (value <= -180) value += 360
  return value
}

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

export const rotatePoint = (
  x: number,
  y: number,
  angleDeg: number,
  originX = 0,
  originY = 0,
): { x: number; y: number } => {
  const rad = toRadians(angleDeg)
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = x - originX
  const dy = y - originY
  return {
    x: originX + dx * cos - dy * sin,
    y: originY + dx * sin + dy * cos,
  }
}

export const distance = (ax: number, ay: number, bx: number, by: number): number =>
  Math.hypot(bx - ax, by - ay)

export const headingBetween = (ax: number, ay: number, bx: number, by: number): number => {
  const rad = Math.atan2(by - ay, bx - ax)
  return toDegrees(rad)
}

export const advancePose = (
  x: number,
  y: number,
  headingDeg: number,
  distanceMm: number,
): { x: number; y: number } => {
  const rad = toRadians(headingDeg)
  return {
    x: x + distanceMm * Math.cos(rad),
    y: y + distanceMm * Math.sin(rad),
  }
}
