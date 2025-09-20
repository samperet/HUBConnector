import { ChangeEvent, useMemo, useRef } from 'react'
import { usePathStore } from '../store/usePathStore'
import { applyMotorInversion, arcMotorDegrees, lineMotorDegrees, turnMotorDegrees } from '../utils/kinematics'
import { validateDocument, canExport } from '../utils/validation'
import { generatePybricksScript, generateSvgExport } from '../utils/exporters'
import { AngularSpeedProfile, LinearSpeedProfile } from '../types'
import type { GhostState } from './PathCanvas'

const estimateLinearDuration = (length: number, profile: LinearSpeedProfile) => {
  const speeds = [profile.startMmS ?? 0, profile.cruiseMmS ?? 0, profile.endMmS ?? 0]
  const avg = speeds.reduce((sum, value) => sum + value, 0) / speeds.length || 1
  return length / Math.max(avg, 1)
}

const estimateAngularDuration = (angle: number, profile: AngularSpeedProfile) => {
  const speeds = [profile.startDegS ?? 0, profile.cruiseDegS ?? 0, profile.endDegS ?? 0]
  const avg = speeds.reduce((sum, value) => sum + value, 0) / speeds.length || 1
  return Math.abs(angle) / Math.max(avg, 1)
}

const formatDuration = (seconds: number) => `${seconds.toFixed(2)} s`

interface SidePanelProps {
  ghostState: GhostState | null
}

export const SidePanel = ({ ghostState }: SidePanelProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const {
    doc,
    resolved,
    exportModel,
    importModel,
  } = usePathStore((state) => ({
    doc: state.doc,
    resolved: state.resolved,
    exportModel: state.exportModel,
    importModel: state.importModel,
  }))

  const validationWarnings = useMemo(
    () => [...validateDocument(doc), ...resolved.warnings],
    [doc, resolved.warnings],
  )
  const exportable = canExport(validationWarnings)

  const segmentMetrics = useMemo(() => {
    return resolved.segments.map((segment) => {
      if (segment.type === 'line' && segment.segment.type === 'line') {
        const length = Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y)
        const degrees = lineMotorDegrees(length, doc.robot)
        const duration = estimateLinearDuration(length, segment.segment.profile)
        const inverted = applyMotorInversion(degrees.left, degrees.right, doc.robot)
        return { segment, left: inverted.left, right: inverted.right, duration }
      }
      if (segment.type === 'arc' && segment.segment.type === 'arc') {
        const radius = segment.segment.radiusMm
        const angle = segment.segment.angleDeg
        const length = Math.abs((Math.PI * radius * angle) / 180)
        const degrees = arcMotorDegrees(radius, angle, doc.robot)
        const duration = estimateLinearDuration(length, segment.segment.profile)
        const inverted = applyMotorInversion(degrees.left, degrees.right, doc.robot)
        return { segment, left: inverted.left, right: inverted.right, duration }
      }
      if (segment.type === 'turn' && segment.segment.type === 'turn') {
        const degrees = turnMotorDegrees(segment.segment.angleDeg, doc.robot)
        const duration = estimateAngularDuration(segment.segment.angleDeg, segment.segment.profile)
        const inverted = applyMotorInversion(degrees.left, degrees.right, doc.robot)
        return { segment, left: inverted.left, right: inverted.right, duration }
      }
      return { segment, left: 0, right: 0, duration: 0 }
    })
  }, [resolved.segments, doc.robot])

  const handleExportJson = () => {
    const model = exportModel()
    const blob = new Blob([JSON.stringify(model, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${doc.meta.title || 'path'}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleExportPybricks = () => {
    const script = generatePybricksScript(doc, resolved.segments)
    const blob = new Blob([script], { type: 'text/x-python' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${doc.meta.title || 'path'}.py`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleExportSvg = () => {
    const svg = generateSvgExport(doc, resolved.segments)
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${doc.meta.title || 'path'}.svg`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleImportJson = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    file.text().then((text) => {
      try {
        const model = JSON.parse(text)
        importModel(model)
      } catch (error) {
        console.error('Failed to import path', error)
      }
    })
  }

  return (
    <aside className="side-panel">
      <h2>Path summary</h2>
      <div className="segment-list">
        {segmentMetrics.map(({ segment, left, right, duration }) => (
          <div
            key={segment.id}
            className={`segment-card ${segment.autoGenerated ? 'auto' : ''}`}
          >
            <header>
              <strong>{segment.segment.label ?? segment.id}</strong>
              {segment.autoGenerated && <span className="badge">auto</span>}
            </header>
            <div className="metric-row">
              <span>Type</span>
              <span>{segment.type}</span>
            </div>
            <div className="metric-row">
              <span>Left motor</span>
              <span>{left.toFixed(1)}°</span>
            </div>
            <div className="metric-row">
              <span>Right motor</span>
              <span>{right.toFixed(1)}°</span>
            </div>
            <div className="metric-row">
              <span>Est. duration</span>
              <span>{formatDuration(duration)}</span>
            </div>
          </div>
        ))}
      </div>
      <section>
        <h3>Validation</h3>
        {validationWarnings.length === 0 && <p>No validation issues.</p>}
      {validationWarnings.map((warning) => (
        <div key={warning.id} className={`warning ${warning.severity}`}>
          {warning.message}
        </div>
      ))}
    </section>
      {ghostState?.pose && (
        <section>
          <h3>Ghost pose</h3>
          <div className="summary-row">
            <span>X</span>
            <strong>{ghostState.pose.x.toFixed(1)} mm</strong>
          </div>
          <div className="summary-row">
            <span>Y</span>
            <strong>{ghostState.pose.y.toFixed(1)} mm</strong>
          </div>
          <div className="summary-row">
            <span>Heading</span>
            <strong>{ghostState.pose.headingDeg.toFixed(1)}°</strong>
          </div>
          <div className="summary-row">
            <span>Progress</span>
            <strong>{Math.round(ghostState.progress * 100)}%</strong>
          </div>
          <p className="hint">Segment: {ghostState.segmentId ?? 'n/a'}</p>
        </section>
      )}
      <section>
        <h3>Import / Export</h3>
        <div className="export-buttons">
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            Import JSON
          </button>
          <button type="button" onClick={handleExportJson}>Export JSON</button>
          <button type="button" onClick={handleExportPybricks} disabled={!exportable}>
            Export Pybricks
          </button>
          <button type="button" onClick={handleExportSvg}>Export SVG</button>
        </div>
        <input
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          ref={fileInputRef}
          onChange={handleImportJson}
        />
        {!exportable && <p className="hint">Resolve errors to enable Pybricks export.</p>}
      </section>
    </aside>
  )
}

export default SidePanel
