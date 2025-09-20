import { describe, expect, it } from 'vitest'
import {
  arcMotorDegrees,
  effectiveWheelCircumference,
  lineMotorDegrees,
  mmToMotorDegrees,
  turnMotorDegrees,
} from '../kinematics'
import { RobotConfig } from '../../types'

const mockRobot = (): RobotConfig => ({
  ports: { left: 'C', right: 'D', aux: [] },
  invert: { left: false, right: false, aux: {} },
  wheel: { source: 'diameter', diameterMm: 56, circumferenceMm: Math.PI * 56 },
  trackWidthMm: 120,
  gearRatio: 1,
  gyro: {
    enabled: true,
    kp: 2,
    ki: 0,
    kd: 0.3,
    sampleMs: 20,
    maxCorrectionDegS: 300,
    toleranceDeg: 1,
  },
  defaults: {
    lineMmS: 120,
    arcMmS: 100,
    turnDegS: 90,
    accelMmS2: 300,
    decelMmS2: 300,
  },
})

describe('kinematics helpers', () => {
  it('computes effective circumference from diameter and gear ratio', () => {
    const robot = mockRobot()
    expect(effectiveWheelCircumference(robot)).toBeCloseTo(Math.PI * 56)
    robot.gearRatio = 2
    expect(effectiveWheelCircumference(robot)).toBeCloseTo((Math.PI * 56) / 2)
  })

  it('converts millimetres to motor degrees', () => {
    const robot = mockRobot()
    const degrees = mmToMotorDegrees(Math.PI * 56, robot)
    expect(degrees).toBeCloseTo(360)
  })

  it('computes line motor degrees symmetrically', () => {
    const robot = mockRobot()
    const { left, right } = lineMotorDegrees(100, robot)
    expect(left).toBeCloseTo(right)
  })

  it('computes turn-in-place degrees with opposite directions', () => {
    const robot = mockRobot()
    const { left, right } = turnMotorDegrees(90, robot)
    expect(left).toBeCloseTo(-right)
    expect(right).toBeGreaterThan(0)
  })

  it('computes arc degrees respecting track width', () => {
    const robot = mockRobot()
    const { left, right } = arcMotorDegrees(200, 180, robot)
    expect(left).toBeLessThan(right)
    expect(Math.abs(right - left)).toBeGreaterThan(0)
  })
})
