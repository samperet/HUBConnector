import type { PathDocument } from '../store/usePathStore'
import type { RobotConfig, ValidationWarning } from '../types'

const uniquePorts = (ports: string[]): boolean => new Set(ports).size === ports.length

export const validateRobotConfig = (robot: RobotConfig): ValidationWarning[] => {
  const warnings: ValidationWarning[] = []
  const ports = [robot.ports.left, robot.ports.right, ...robot.ports.aux.map((aux) => aux.port)]
  if (!uniquePorts(ports)) {
    warnings.push({
      id: 'robot-ports-unique',
      message: 'Motor ports must be unique.',
      severity: 'error',
      scope: 'robot',
    })
  }
  if (robot.wheel.diameterMm <= 0 || robot.wheel.circumferenceMm <= 0) {
    warnings.push({
      id: 'robot-wheel-size',
      message: 'Wheel diameter and circumference must be greater than zero.',
      severity: 'error',
      scope: 'robot',
    })
  }
  if (robot.trackWidthMm <= 0) {
    warnings.push({
      id: 'robot-track-width',
      message: 'Track width must be greater than zero.',
      severity: 'error',
      scope: 'robot',
    })
  }
  if (robot.gearRatio <= 0) {
    warnings.push({
      id: 'robot-gear-ratio',
      message: 'Gear ratio must be greater than zero.',
      severity: 'error',
      scope: 'robot',
    })
  }
  return warnings
}

export const validateDocument = (doc: PathDocument): ValidationWarning[] => {
  const warnings: ValidationWarning[] = []
  warnings.push(...validateRobotConfig(doc.robot))
  doc.segments.forEach((segment) => {
    if (!segment.enabled) return
    if (segment.type === 'line' && segment.lengthMm <= 0) {
      warnings.push({
        id: `segment-length-${segment.id}`,
        message: `Line segment ${segment.label ?? segment.id} length must be positive.`,
        severity: 'error',
        scope: 'segment',
        segmentId: segment.id,
      })
    }
    if (segment.type === 'arc') {
      if (segment.radiusMm < doc.robot.trackWidthMm / 2) {
        warnings.push({
          id: `segment-arc-radius-${segment.id}`,
          message: `Arc ${segment.label ?? segment.id} radius must be at least half the track width.`,
          severity: 'warning',
          scope: 'segment',
          segmentId: segment.id,
        })
      }
    }
    if (segment.type === 'turn' && segment.angleDeg === 0) {
      warnings.push({
        id: `segment-turn-${segment.id}`,
        message: `Turn ${segment.label ?? segment.id} angle must be non-zero.`,
        severity: 'warning',
        scope: 'segment',
        segmentId: segment.id,
      })
    }
  })
  return warnings
}

export const canExport = (warnings: ValidationWarning[]): boolean =>
  warnings.every((warning) => warning.severity !== 'error')
