import type { RobotConfig } from '../types'
import { toRadians } from './geometry'

export const wheelCircumference = (diameterMm: number) => Math.PI * diameterMm

export const effectiveWheelCircumference = (config: RobotConfig): number => {
  const baseCirc =
    config.wheel.source === 'diameter'
      ? wheelCircumference(config.wheel.diameterMm)
      : config.wheel.circumferenceMm
  return baseCirc / config.gearRatio
}

export const mmToMotorDegrees = (mm: number, config: RobotConfig): number => {
  const effCirc = effectiveWheelCircumference(config)
  return (mm / effCirc) * 360
}

export const lineMotorDegrees = (lengthMm: number, config: RobotConfig) => {
  const deg = mmToMotorDegrees(lengthMm, config)
  return { left: deg, right: deg }
}

export const turnMotorDegrees = (angleDeg: number, config: RobotConfig) => {
  const pathPerWheel =
    Math.PI * config.trackWidthMm * (angleDeg / 360)
  const left = mmToMotorDegrees(-pathPerWheel, config)
  const right = mmToMotorDegrees(pathPerWheel, config)
  return { left, right }
}

export const arcMotorDegrees = (
  radiusMm: number,
  angleDeg: number,
  config: RobotConfig,
) => {
  const angleRad = toRadians(angleDeg)
  const halfTrack = config.trackWidthMm / 2
  const leftMm = angleRad * (radiusMm - halfTrack)
  const rightMm = angleRad * (radiusMm + halfTrack)
  return {
    left: mmToMotorDegrees(leftMm, config),
    right: mmToMotorDegrees(rightMm, config),
  }
}

export const applyMotorInversion = (
  leftDeg: number,
  rightDeg: number,
  config: RobotConfig,
): { left: number; right: number } => {
  return {
    left: config.invert.left ? -leftDeg : leftDeg,
    right: config.invert.right ? -rightDeg : rightDeg,
  }
}
