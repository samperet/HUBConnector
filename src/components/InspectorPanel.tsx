import { useMemo } from 'react'
import type { ChangeEvent } from 'react'
import { usePathStore } from '../store/usePathStore'
import type { ResolvedSegment, TurnControlMode } from '../types'
import { SpeedProfileEditor } from './SpeedProfileEditor'
import { distance } from '../utils/geometry'

const InputRow = ({
  label,
  value,
  onChange,
  unit,
  step,
}: {
  label: string
  value: number
  unit?: string
  step?: number
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}) => (
  <label className="input-row">
    <span>{label}</span>
    <input type="number" value={value} onChange={onChange} step={step} />
    {unit && <span className="unit">{unit}</span>}
  </label>
)

const SegmentSummary = ({ resolved }: { resolved: ResolvedSegment }) => {
  if (resolved.type === 'line') {
    return (
      <div className="summary-row">
        <span>Length</span>
        <strong>{distance(resolved.start.x, resolved.start.y, resolved.end.x, resolved.end.y).toFixed(1)} mm</strong>
      </div>
    )
  }
  if (resolved.type === 'arc') {
    return (
      <div className="summary-row">
        <span>Radius</span>
        <strong>{resolved.segment.type === 'arc' ? resolved.segment.radiusMm.toFixed(1) : ''} mm</strong>
      </div>
    )
  }
  return (
    <div className="summary-row">
      <span>Heading change</span>
      <strong>{resolved.segment.type === 'turn' ? resolved.segment.angleDeg.toFixed(1) : 0}°</strong>
    </div>
  )
}

export const InspectorPanel = () => {
  const {
    selection,
    updateSegment,
    updateWaypoint,
    resolved,
    doc,
  } = usePathStore((state) => ({
    selection: state.selection,
    updateSegment: state.updateSegment,
    updateWaypoint: state.updateWaypoint,
    resolved: state.resolved,
    doc: state.doc,
  }))

  const selectedSegment = useMemo(() => {
    if (selection.type !== 'segment') return undefined
    return resolved.segments.find((segment) => segment.segment.id === selection.id)
  }, [selection, resolved.segments])

  const selectedWaypoint = useMemo(() => {
    if (selection.type !== 'waypoint' || !selection.id) return undefined
    return doc.waypoints.find((waypoint) => waypoint.id === selection.id)
  }, [selection, doc.waypoints])

  if (selection.type === 'none' || (!selectedSegment && !selectedWaypoint)) {
    return (
      <aside className="inspector">
        <h2>Inspector</h2>
        <p>Select a segment or waypoint to edit its parameters.</p>
      </aside>
    )
  }

  if (selectedWaypoint) {
    return (
      <aside className="inspector">
        <h2>Waypoint</h2>
        <div className="segment-panel">
          <label>
            Name
            <input
              type="text"
              value={selectedWaypoint.name}
              onChange={(event) =>
                updateWaypoint(selectedWaypoint.id, { name: event.target.value })
              }
            />
          </label>
          <div className="field-grid two">
            <label>
              X position
              <input
                type="number"
                value={selectedWaypoint.x}
                onChange={(event) =>
                  updateWaypoint(selectedWaypoint.id, { x: Number(event.target.value) })
                }
              />
            </label>
            <label>
              Y position
              <input
                type="number"
                value={selectedWaypoint.y}
                onChange={(event) =>
                  updateWaypoint(selectedWaypoint.id, { y: Number(event.target.value) })
                }
              />
            </label>
          </div>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={selectedWaypoint.enabled}
              onChange={(event) =>
                updateWaypoint(selectedWaypoint.id, { enabled: event.target.checked })
              }
            />
            Enabled
          </label>
          <label>
            Notes
            <textarea
              value={selectedWaypoint.notes ?? ''}
              onChange={(event) =>
                updateWaypoint(selectedWaypoint.id, { notes: event.target.value })
              }
            />
          </label>
        </div>
      </aside>
    )
  }

  if (!selectedSegment) {
    return (
      <aside className="inspector">
        <h2>Inspector</h2>
        <p>The selected segment could not be found.</p>
      </aside>
    )
  }

  const segment = selectedSegment.segment

  const common = (
    <div className="segment-common">
      <label>
        Label
        <input
          type="text"
          value={segment.label ?? ''}
          onChange={(event) => updateSegment(segment.id, { label: event.target.value })}
        />
      </label>
      <label>
        Notes
        <textarea
          value={segment.notes ?? ''}
          onChange={(event) => updateSegment(segment.id, { notes: event.target.value })}
        />
      </label>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={segment.enabled}
          onChange={(event) => updateSegment(segment.id, { enabled: event.target.checked })}
        />
        Enabled
      </label>
      <SegmentSummary resolved={selectedSegment} />
    </div>
  )

  return (
    <aside className="inspector">
      <h2>Inspector</h2>
      {segment.type === 'line' && (
        <div className="segment-panel">
          {common}
          <InputRow
            label="Length"
            value={segment.lengthMm}
            unit="mm"
            onChange={(event) =>
              updateSegment(segment.id, { lengthMm: Number(event.target.value) })
            }
          />
          <InputRow
            label="Heading"
            value={segment.headingDeg}
            unit="°"
            step={0.1}
            onChange={(event) =>
              updateSegment(segment.id, { headingDeg: Number(event.target.value) })
            }
          />
          <SpeedProfileEditor
            type="linear"
            profile={segment.profile}
            onChange={(profile) => updateSegment(segment.id, { profile })}
          />
        </div>
      )}
      {segment.type === 'arc' && (
        <div className="segment-panel">
          {common}
          <InputRow
            label="Radius"
            value={segment.radiusMm}
            unit="mm"
            onChange={(event) =>
              updateSegment(segment.id, { radiusMm: Number(event.target.value) })
            }
          />
          <InputRow
            label="Angle"
            value={segment.angleDeg}
            unit="°"
            step={0.1}
            onChange={(event) =>
              updateSegment(segment.id, { angleDeg: Number(event.target.value) })
            }
          />
          <InputRow
            label="Entry heading"
            value={segment.entryHeadingDeg}
            unit="°"
            step={0.1}
            onChange={(event) =>
              updateSegment(segment.id, {
                entryHeadingDeg: Number(event.target.value),
              })
            }
          />
          <SpeedProfileEditor
            type="linear"
            profile={segment.profile}
            onChange={(profile) => updateSegment(segment.id, { profile })}
          />
        </div>
      )}
      {segment.type === 'turn' && (
        <div className="segment-panel">
          {common}
          <InputRow
            label="Angle"
            value={segment.angleDeg}
            unit="°"
            onChange={(event) =>
              updateSegment(segment.id, { angleDeg: Number(event.target.value) })
            }
          />
          <label>
            Control mode
            <select
              value={segment.control}
              onChange={(event) =>
                updateSegment(segment.id, { control: event.target.value as TurnControlMode })
              }
            >
              <option value="gyro">Gyro</option>
              <option value="encoders">Encoders</option>
            </select>
          </label>
          <SpeedProfileEditor
            type="angular"
            profile={segment.profile}
            onChange={(profile) => updateSegment(segment.id, { profile })}
          />
        </div>
      )}
    </aside>
  )
}

export default InspectorPanel
