import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { MotorPort } from '../types'
import { usePathStore } from '../store/usePathStore'
import { useShallow } from 'zustand/react/shallow'
import { validateRobotConfig } from '../utils/validation'

const MOTOR_PORTS: MotorPort[] = ['A', 'B', 'C', 'D', 'E', 'F']

const WheelPresets = [
  { label: '56 mm (SPIKE Prime)', diameter: 56 },
  { label: '62.4 mm', diameter: 62.4 },
  { label: '68.8 mm', diameter: 68.8 },
]

const formatNumber = (value: number, digits = 2) => Number.parseFloat(value.toFixed(digits))

export const ConfigPanel = () => {
  const {
    robot,
    updateRobot,
    updateRobotWheelDiameter,
    updateRobotWheelCircumference,
    robotProfiles,
    saveRobotProfile,
    loadRobotProfile,
    deleteRobotProfile,
    setDefaultProfile,
  } = usePathStore(
    useShallow((state) => ({
      robot: state.doc.robot,
      updateRobot: state.updateRobot,
      updateRobotWheelDiameter: state.updateRobotWheelDiameter,
      updateRobotWheelCircumference: state.updateRobotWheelCircumference,
      robotProfiles: state.robotProfiles,
      saveRobotProfile: state.saveRobotProfile,
      loadRobotProfile: state.loadRobotProfile,
      deleteRobotProfile: state.deleteRobotProfile,
      setDefaultProfile: state.setDefaultProfile,
    })),
  )

  const [profileName, setProfileName] = useState('')

  const warnings = useMemo(() => validateRobotConfig(robot), [robot])

  const handlePortChange = (role: 'left' | 'right', value: MotorPort) => {
    updateRobot({ ports: { ...robot.ports, [role]: value } })
  }

  const handleAuxChange = (index: number, value: MotorPort) => {
    const aux = robot.ports.aux.map((item, idx) =>
      idx === index ? { ...item, port: value } : item,
    )
    updateRobot({ ports: { ...robot.ports, aux } })
  }

  const handleAuxNameChange = (index: number, value: string) => {
    const aux = robot.ports.aux.map((item, idx) =>
      idx === index ? { ...item, id: value } : item,
    )
    updateRobot({ ports: { ...robot.ports, aux } })
  }

  const addAuxMotor = () => {
    const aux = [...robot.ports.aux, { id: `aux-${robot.ports.aux.length + 1}`, port: 'A' as MotorPort }]
    updateRobot({ ports: { ...robot.ports, aux } })
  }

  const removeAuxMotor = (index: number) => {
    const aux = robot.ports.aux.filter((_, idx) => idx !== index)
    updateRobot({ ports: { ...robot.ports, aux } })
  }

  const toggleInvert = (key: 'left' | 'right', value: boolean) => {
    updateRobot({ invert: { ...robot.invert, [key]: value } })
  }

  const toggleAuxInvert = (id: string, value: boolean) => {
    const currentAux = robot.invert.aux ?? {}
    updateRobot({ invert: { ...robot.invert, aux: { ...currentAux, [id]: value } } })
  }

  const handleDefaultsChange = (key: keyof typeof robot.defaults, value: number) => {
    updateRobot({ defaults: { ...robot.defaults, [key]: value } })
  }

  const handleGyroChange = <K extends keyof typeof robot.gyro>(
    key: K,
    value: (typeof robot.gyro)[K],
  ) => {
    updateRobot({ gyro: { ...robot.gyro, [key]: value } })
  }

  const handleProfileSave = (event: FormEvent) => {
    event.preventDefault()
    if (!profileName.trim()) return
    saveRobotProfile(profileName.trim(), false)
    setProfileName('')
  }

  return (
    <aside className="config-panel">
      <h2>Robot setup</h2>
      {warnings.length > 0 && (
        <div className="warning-list">
          {warnings.map((warning) => (
            <div key={warning.id} className={`warning ${warning.severity}`}>
              {warning.message}
            </div>
          ))}
        </div>
      )}
      <section>
        <h3>Motor mapping</h3>
        <div className="field-grid two">
          <label>
            Left motor
            <select
              value={robot.ports.left}
              onChange={(event) => handlePortChange('left', event.target.value as MotorPort)}
            >
              {MOTOR_PORTS.map((port) => (
                <option key={port} value={port}>
                  {port}
                </option>
              ))}
            </select>
          </label>
          <label>
            Right motor
            <select
              value={robot.ports.right}
              onChange={(event) => handlePortChange('right', event.target.value as MotorPort)}
            >
              {MOTOR_PORTS.map((port) => (
                <option key={port} value={port}>
                  {port}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="invert-row">
          <label>
            <input
              type="checkbox"
              checked={robot.invert.left}
              onChange={(event) => toggleInvert('left', event.target.checked)}
            />
            Left forward = {robot.invert.left ? 'CCW' : 'CW'}
          </label>
          <button
            type="button"
            onClick={() => console.info('Nudge left motor +45°')}
          >
            Nudge +45°
          </button>
          <button
            type="button"
            onClick={() => console.info('Nudge left motor -45°')}
          >
            Nudge -45°
          </button>
        </div>
        <div className="invert-row">
          <label>
            <input
              type="checkbox"
              checked={robot.invert.right}
              onChange={(event) => toggleInvert('right', event.target.checked)}
            />
            Right forward = {robot.invert.right ? 'CCW' : 'CW'}
          </label>
          <button
            type="button"
            onClick={() => console.info('Nudge right motor +45°')}
          >
            Nudge +45°
          </button>
          <button
            type="button"
            onClick={() => console.info('Nudge right motor -45°')}
          >
            Nudge -45°
          </button>
        </div>
        <div className="aux-list">
          <header>
            <strong>Auxiliary motors</strong>
            <button type="button" onClick={addAuxMotor}>
              Add
            </button>
          </header>
          {robot.ports.aux.map((aux, index) => (
            <div className="aux-item" key={aux.id}>
              <input
                type="text"
                value={aux.id}
                onChange={(event) => handleAuxNameChange(index, event.target.value)}
              />
              <select
                value={aux.port}
                onChange={(event) => handleAuxChange(index, event.target.value as MotorPort)}
              >
                {MOTOR_PORTS.map((port) => (
                  <option key={port} value={port}>
                    {port}
                  </option>
                ))}
              </select>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(robot.invert.aux?.[aux.id])}
                  onChange={(event) => toggleAuxInvert(aux.id, event.target.checked)}
                />
                Invert
              </label>
              <button type="button" onClick={() => removeAuxMotor(index)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3>Wheel geometry</h3>
        <div className="wheel-presets">
          {WheelPresets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => updateRobotWheelDiameter(preset.diameter)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <label>
          Diameter
          <div className="inline-input">
            <input
              type="number"
              value={formatNumber(robot.wheel.diameterMm, 3)}
              onChange={(event) => updateRobotWheelDiameter(Number(event.target.value))}
            />
            <span>mm</span>
          </div>
        </label>
        <label>
          Circumference
          <div className="inline-input">
            <input
              type="number"
              value={formatNumber(robot.wheel.circumferenceMm, 3)}
              onChange={(event) => updateRobotWheelCircumference(Number(event.target.value))}
            />
            <span>mm</span>
          </div>
        </label>
        <label>
          Gear ratio
          <div className="inline-input">
            <input
              type="number"
              step={0.01}
              value={robot.gearRatio}
              onChange={(event) => updateRobot({ gearRatio: Number(event.target.value) })}
            />
          </div>
        </label>
        <div className="track-width">
          <label>
            Track width
            <div className="inline-input">
              <input
                type="number"
                value={robot.trackWidthMm}
                onChange={(event) => updateRobot({ trackWidthMm: Number(event.target.value) })}
              />
              <span>mm</span>
            </div>
          </label>
          <div className="gauge">
            <div className="wheel" />
            <div className="bar" style={{ width: `${Math.min(robot.trackWidthMm, 300)}px` }} />
            <div className="wheel" />
          </div>
        </div>
      </section>
      <section>
        <h3>Defaults</h3>
        <div className="field-grid three">
          <label>
            Line speed
            <div className="inline-input">
              <input
                type="number"
                value={robot.defaults.lineMmS}
                onChange={(event) => handleDefaultsChange('lineMmS', Number(event.target.value))}
              />
              <span>mm/s</span>
            </div>
          </label>
          <label>
            Arc speed
            <div className="inline-input">
              <input
                type="number"
                value={robot.defaults.arcMmS}
                onChange={(event) => handleDefaultsChange('arcMmS', Number(event.target.value))}
              />
              <span>mm/s</span>
            </div>
          </label>
          <label>
            Turn speed
            <div className="inline-input">
              <input
                type="number"
                value={robot.defaults.turnDegS}
                onChange={(event) => handleDefaultsChange('turnDegS', Number(event.target.value))}
              />
              <span>deg/s</span>
            </div>
          </label>
          <label>
            Accel
            <div className="inline-input">
              <input
                type="number"
                value={robot.defaults.accelMmS2}
                onChange={(event) => handleDefaultsChange('accelMmS2', Number(event.target.value))}
              />
              <span>mm/s²</span>
            </div>
          </label>
          <label>
            Decel
            <div className="inline-input">
              <input
                type="number"
                value={robot.defaults.decelMmS2}
                onChange={(event) => handleDefaultsChange('decelMmS2', Number(event.target.value))}
              />
              <span>mm/s²</span>
            </div>
          </label>
        </div>
      </section>
      <section>
        <h3>Gyro & PID</h3>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={robot.gyro.enabled}
            onChange={(event) => handleGyroChange('enabled', event.target.checked)}
          />
          Enable gyro stabilization
        </label>
        <div className="field-grid three">
          <label>
            kp
            <input
              type="number"
              step={0.01}
              value={robot.gyro.kp}
              onChange={(event) => handleGyroChange('kp', Number(event.target.value))}
            />
          </label>
          <label>
            ki
            <input
              type="number"
              step={0.01}
              value={robot.gyro.ki}
              onChange={(event) => handleGyroChange('ki', Number(event.target.value))}
            />
          </label>
          <label>
            kd
            <input
              type="number"
              step={0.01}
              value={robot.gyro.kd}
              onChange={(event) => handleGyroChange('kd', Number(event.target.value))}
            />
          </label>
          <label>
            Max correction
            <div className="inline-input">
              <input
                type="number"
                value={robot.gyro.maxCorrectionDegS}
                onChange={(event) => handleGyroChange('maxCorrectionDegS', Number(event.target.value))}
              />
              <span>deg/s</span>
            </div>
          </label>
          <label>
            Sample period
            <div className="inline-input">
              <input
                type="number"
                value={robot.gyro.sampleMs}
                onChange={(event) => handleGyroChange('sampleMs', Number(event.target.value))}
              />
              <span>ms</span>
            </div>
          </label>
          <label>
            Heading tolerance
            <div className="inline-input">
              <input
                type="number"
                value={robot.gyro.toleranceDeg}
                onChange={(event) => handleGyroChange('toleranceDeg', Number(event.target.value))}
              />
              <span>°</span>
            </div>
          </label>
        </div>
      </section>
      <section>
        <h3>Profiles</h3>
        <form className="profile-form" onSubmit={handleProfileSave}>
          <input
            type="text"
            placeholder="Save current robot as..."
            value={profileName}
            onChange={(event) => setProfileName(event.target.value)}
          />
          <button type="submit">Save</button>
        </form>
        <ul className="profile-list">
          {robotProfiles.map((profile) => (
            <li key={profile.id}>
              <span>{profile.name}</span>
              {profile.isDefault && <span className="badge">default</span>}
              <div className="actions">
                <button type="button" onClick={() => loadRobotProfile(profile.id)}>
                  Load
                </button>
                <button type="button" onClick={() => setDefaultProfile(profile.id)}>
                  Make default
                </button>
                <button type="button" onClick={() => deleteRobotProfile(profile.id)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  )
}

export default ConfigPanel
