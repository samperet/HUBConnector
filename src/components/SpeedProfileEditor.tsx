import type { ChangeEvent } from 'react'
import type { AngularSpeedProfile, LinearSpeedProfile, ProfileShape } from '../types'

interface BaseProps {
  shapeLabel?: string
  onShapeChange?: (shape: ProfileShape) => void
  inheritLabel?: string
}

interface LinearProps extends BaseProps {
  type: 'linear'
  profile: LinearSpeedProfile
  onChange: (profile: LinearSpeedProfile) => void
}

interface AngularProps extends BaseProps {
  type: 'angular'
  profile: AngularSpeedProfile
  onChange: (profile: AngularSpeedProfile) => void
}

type LinearFieldKey = 'startMmS' | 'cruiseMmS' | 'endMmS' | 'accelMmS2' | 'decelMmS2'
type AngularFieldKey =
  | 'startDegS'
  | 'cruiseDegS'
  | 'endDegS'
  | 'accelDegS2'
  | 'decelDegS2'

export type SpeedProfileEditorProps = LinearProps | AngularProps

const parseNumber = (value: string, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

interface RenderParams<T, K extends keyof T> {
  profile: T
  shapeLabel?: string
  inheritLabel?: string
  handleShapeChange: (event: ChangeEvent<HTMLSelectElement>) => void
  handleFieldChange: (key: K) => (event: ChangeEvent<HTMLInputElement>) => void
  toggleInherit: (event: ChangeEvent<HTMLInputElement>) => void
  labelSuffix: string
  accelSuffix: string
  keys: {
    start: K
    cruise: K
    end: K
    accel: K
    decel: K
  }
}

const renderProfileFields = <T extends LinearSpeedProfile | AngularSpeedProfile, K extends keyof T>({
  profile,
  shapeLabel,
  inheritLabel,
  handleShapeChange,
  handleFieldChange,
  toggleInherit,
  labelSuffix,
  accelSuffix,
  keys,
}: RenderParams<T, K>) => {
  const startValue = Number(profile[keys.start] ?? 0)
  const cruiseValue = Number(profile[keys.cruise] ?? 0)
  const endValue = Number(profile[keys.end] ?? 0)
  const accelValue = Number(profile[keys.accel] ?? 0)
  const decelValue = Number(profile[keys.decel] ?? 0)

  return (
    <div className="profile-editor">
      <div className="field-row">
        <label>
          {shapeLabel ?? 'Shape'}
          <select value={profile.shape} onChange={handleShapeChange}>
            <option value="trapezoid">Trapezoidal</option>
            <option value="s_curve">S-curve</option>
          </select>
        </label>
        <label className="inherit-toggle">
          <input
            type="checkbox"
            checked={Boolean(profile.inheritStart)}
            onChange={toggleInherit}
          />
          {inheritLabel ?? 'Inherit start speed'}
        </label>
      </div>
      <div className="field-grid">
        <label>
          Start
          <input
            type="number"
            value={startValue}
            onChange={handleFieldChange(keys.start)}
          />
          <span className="unit">{labelSuffix}</span>
        </label>
        <label>
          Cruise
          <input
            type="number"
            value={cruiseValue}
            onChange={handleFieldChange(keys.cruise)}
          />
          <span className="unit">{labelSuffix}</span>
        </label>
        <label>
          End
          <input
            type="number"
            value={endValue}
            onChange={handleFieldChange(keys.end)}
          />
          <span className="unit">{labelSuffix}</span>
        </label>
        <label>
          Accel
          <input
            type="number"
            value={accelValue}
            onChange={handleFieldChange(keys.accel)}
          />
          <span className="unit">{accelSuffix}</span>
        </label>
        <label>
          Decel
          <input
            type="number"
            value={decelValue}
            onChange={handleFieldChange(keys.decel)}
          />
          <span className="unit">{accelSuffix}</span>
        </label>
      </div>
    </div>
  )
}

export const SpeedProfileEditor = (props: SpeedProfileEditorProps) => {
  if (props.type === 'linear') {
    const { profile, onChange } = props
    const handleShapeChange = (event: ChangeEvent<HTMLSelectElement>) => {
      const shape = event.target.value as ProfileShape
      props.onShapeChange?.(shape)
      onChange({ ...profile, shape })
    }

    const handleFieldChange = (key: LinearFieldKey) =>
      (event: ChangeEvent<HTMLInputElement>) => {
        const fallback = profile[key]
        const value = parseNumber(
          event.target.value,
          typeof fallback === 'number' ? fallback : 0,
        )
        onChange({ ...profile, [key]: value })
      }

    const toggleInherit = (event: ChangeEvent<HTMLInputElement>) => {
      onChange({ ...profile, inheritStart: event.target.checked })
    }

    return renderProfileFields<LinearSpeedProfile, LinearFieldKey>({
      profile,
      shapeLabel: props.shapeLabel,
      inheritLabel: props.inheritLabel,
      handleShapeChange,
      handleFieldChange,
      toggleInherit,
      labelSuffix: 'mm/s',
      accelSuffix: 'mm/s²',
      keys: {
        start: 'startMmS',
        cruise: 'cruiseMmS',
        end: 'endMmS',
        accel: 'accelMmS2',
        decel: 'decelMmS2',
      },
    })
  }

  const { profile, onChange } = props
  const handleShapeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const shape = event.target.value as ProfileShape
    props.onShapeChange?.(shape)
    onChange({ ...profile, shape })
  }

  const handleFieldChange = (key: AngularFieldKey) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const fallback = profile[key]
      const value = parseNumber(
        event.target.value,
        typeof fallback === 'number' ? fallback : 0,
      )
      onChange({ ...profile, [key]: value })
    }

  const toggleInherit = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...profile, inheritStart: event.target.checked })
  }

  return renderProfileFields<AngularSpeedProfile, AngularFieldKey>({
    profile,
    shapeLabel: props.shapeLabel,
    inheritLabel: props.inheritLabel,
    handleShapeChange,
    handleFieldChange,
    toggleInherit,
    labelSuffix: 'deg/s',
    accelSuffix: 'deg/s²',
    keys: {
      start: 'startDegS',
      cruise: 'cruiseDegS',
      end: 'endDegS',
      accel: 'accelDegS2',
      decel: 'decelDegS2',
    },
  })
}

export default SpeedProfileEditor
