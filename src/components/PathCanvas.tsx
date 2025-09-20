import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Line as KonvaLine, Circle, Shape, Text, Group } from 'react-konva'
import Konva from 'konva'
import classNames from 'classnames'
import { useElementSize } from '../hooks/useElementSize'
import { usePathStore } from '../store/usePathStore'
import { distance, headingBetween, normalizeDegrees, toRadians } from '../utils/geometry'
import { Pose, ResolvedSegment, Segment } from '../types'

const GRID_SPACING_MM = 50
const GRID_BOLD_INTERVAL = 5

interface HandleInfo {
  segmentId: string
  type: 'line-end' | 'arc-end' | 'arc-radius'
  position: { x: number; y: number }
  segment: Segment
  resolved: ResolvedSegment
}

interface GhostSample {
  pose: Pose
  segmentId: string
}

export interface GhostState {
  pose: Pose | null
  progress: number
  segmentId: string | null
}

interface PathCanvasProps {
  onGhostUpdate?: (state: GhostState) => void
}

const toWorldPoint = (stage: Konva.Stage, pointer: Konva.Vector2d) => {
  const scale = stage.scaleX()
  const stageX = stage.x()
  const stageY = stage.y()
  return {
    x: (pointer.x - stageX) / scale,
    y: (pointer.y - stageY) / scale,
  }
}

const snapValue = (value: number, spacing: number) => Math.round(value / spacing) * spacing

const GridLayer = ({ showRulers }: { showRulers: boolean }) => {
  const shapeRef = useRef<Konva.Shape>(null)
  const draw = useCallback((ctx: Konva.Context, shape: Konva.Shape) => {
    const stage = shape.getStage()
    if (!stage) return
    const scale = stage.scaleX()
    const width = stage.width()
    const height = stage.height()
    const offsetX = stage.x()
    const offsetY = stage.y()
    const worldLeft = (-offsetX) / scale
    const worldRight = (width - offsetX) / scale
    const worldTop = (-offsetY) / scale
    const worldBottom = (height - offsetY) / scale

    const firstX = Math.floor(worldLeft / GRID_SPACING_MM) * GRID_SPACING_MM
    const firstY = Math.floor(worldTop / GRID_SPACING_MM) * GRID_SPACING_MM

    ctx.beginPath()
    ctx.strokeStyle = '#2a2d3411'
    ctx.lineWidth = 1

    for (let x = firstX; x <= worldRight; x += GRID_SPACING_MM) {
      const screenX = x * scale + offsetX
      const bold = Math.round(Math.abs(x / GRID_SPACING_MM)) % GRID_BOLD_INTERVAL === 0
      ctx.strokeStyle = bold ? '#2a2d3433' : '#2a2d3411'
      ctx.beginPath()
      ctx.moveTo(screenX, 0)
      ctx.lineTo(screenX, height)
      ctx.stroke()
    }

    for (let y = firstY; y <= worldBottom; y += GRID_SPACING_MM) {
      const screenY = y * scale + offsetY
      const bold = Math.round(Math.abs(y / GRID_SPACING_MM)) % GRID_BOLD_INTERVAL === 0
      ctx.strokeStyle = bold ? '#2a2d3433' : '#2a2d3411'
      ctx.beginPath()
      ctx.moveTo(0, screenY)
      ctx.lineTo(width, screenY)
      ctx.stroke()
    }

    void showRulers

    ctx.beginPath()
    ctx.strokeStyle = '#0f172a55'
    ctx.lineWidth = 1.5
    const axisY = offsetY
    ctx.moveTo(0, axisY)
    ctx.lineTo(width, axisY)
    ctx.stroke()

    const axisX = offsetX
    ctx.beginPath()
    ctx.moveTo(axisX, 0)
    ctx.lineTo(axisX, height)
    ctx.stroke()
  }, [showRulers])

  useEffect(() => {
    shapeRef.current?.getLayer()?.batchDraw()
  })

  return <Shape ref={shapeRef} sceneFunc={(ctx, shape) => draw(ctx, shape)} />
}

const SegmentLabel = ({ text, x, y }: { text: string; x: number; y: number }) => (
  <Text x={x} y={y} text={text} fontSize={12} fontFamily="Inter, system-ui, sans-serif" fill="#0f172a" />
)

const generateGhostSamples = (segments: ResolvedSegment[]): GhostSample[] => {
  const samples: GhostSample[] = []
  segments.forEach((segment) => {
    if (segment.type === 'line') {
      const steps = 30
      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps
        const x = segment.start.x + (segment.end.x - segment.start.x) * t
        const y = segment.start.y + (segment.end.y - segment.start.y) * t
        const heading = segment.start.headingDeg + (segment.end.headingDeg - segment.start.headingDeg) * t
        samples.push({ pose: { x, y, headingDeg: heading }, segmentId: segment.segment.id })
      }
    } else if (segment.type === 'arc') {
      const points = segment.geometry.points
      const total = Math.max(points.length / 2 - 1, 1)
      for (let i = 0; i < points.length; i += 2) {
        const progress = (i / 2) / total
        const x = points[i]
        const y = points[i + 1]
        const heading = segment.start.headingDeg + (segment.end.headingDeg - segment.start.headingDeg) * progress
        samples.push({ pose: { x, y, headingDeg: heading }, segmentId: segment.segment.id })
      }
    } else {
      const steps = 32
      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps
        const heading = segment.start.headingDeg + (segment.end.headingDeg - segment.start.headingDeg) * t
        samples.push({
          pose: { x: segment.start.x, y: segment.start.y, headingDeg: heading },
          segmentId: segment.segment.id,
        })
      }
    }
  })
  return samples
}

export const PathCanvas = ({ onGhostUpdate }: PathCanvasProps) => {
  const { ref, size } = useElementSize<HTMLDivElement>()
  const stageRef = useRef<Konva.Stage>(null)
  const animationRef = useRef<number>()
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [showGrid, setShowGrid] = useState(true)
  const [snapToGrid, setSnapToGrid] = useState(true)
  const [angleSnap, setAngleSnap] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [frameIndex, setFrameIndex] = useState(0)

  const {
    resolved,
    tool,
    setTool,
    addLine,
    addArc,
    addTurn,
    addWaypoint,
    setSelection,
    updateSegment,
    doc,
  } = usePathStore((state) => ({
    resolved: state.resolved,
    tool: state.tool,
    setTool: state.setTool,
    addLine: state.addLine,
    addArc: state.addArc,
    addTurn: state.addTurn,
    addWaypoint: state.addWaypoint,
    setSelection: state.setSelection,
    updateSegment: state.updateSegment,
    doc: state.doc,
  }))

  const ghostSamples = useMemo(() => generateGhostSamples(resolved.segments), [resolved.segments])
  const ghostSample = ghostSamples[frameIndex]
  const ghostSegment = ghostSample
    ? resolved.segments.find((segment) => segment.segment.id === ghostSample.segmentId)
    : undefined

  useEffect(() => {
    setPosition({ x: size.width / 2, y: size.height / 2 })
  }, [size.width, size.height])

  useEffect(() => {
    const handleToggleGrid = () => setShowGrid((value) => !value)
    window.addEventListener('hubconnector:toggle-grid', handleToggleGrid)
    return () => window.removeEventListener('hubconnector:toggle-grid', handleToggleGrid)
  }, [])

  useEffect(() => {
    if (ghostSamples.length === 0) {
      setFrameIndex(0)
      onGhostUpdate?.({ pose: null, progress: 0, segmentId: null })
      return
    }
    const first = ghostSamples[0]
    setFrameIndex(0)
    onGhostUpdate?.({ pose: first.pose, progress: 0, segmentId: first.segmentId })
  }, [ghostSamples, onGhostUpdate])

  useEffect(() => {
    if (!playing) return
    const step = () => {
      setFrameIndex((current) => {
        const next = current + 1
        if (next >= ghostSamples.length) {
          const last = ghostSamples[ghostSamples.length - 1]
          onGhostUpdate?.({
            pose: last?.pose ?? null,
            progress: 1,
            segmentId: last?.segmentId ?? null,
          })
          setPlaying(false)
          return ghostSamples.length - 1
        }
        const sample = ghostSamples[next]
        onGhostUpdate?.({
          pose: sample.pose,
          progress: ghostSamples.length > 1 ? next / (ghostSamples.length - 1) : 0,
          segmentId: sample.segmentId,
        })
        animationRef.current = requestAnimationFrame(step)
        return next
      })
    }
    animationRef.current = requestAnimationFrame(step)
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [playing, ghostSamples, onGhostUpdate])

  const handleWheel = useCallback(
    (event: Konva.KonvaEventObject<WheelEvent>) => {
      event.evt.preventDefault()
      const stage = stageRef.current
      if (!stage) return
      const oldScale = scale
      const pointer = stage.getPointerPosition()
      if (!pointer) return
      const scaleBy = 1.05
      const direction = event.evt.deltaY > 0 ? -1 : 1
      const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy
      const worldPos = toWorldPoint(stage, pointer)
      const newPos = {
        x: pointer.x - worldPos.x * newScale,
        y: pointer.y - worldPos.y * newScale,
      }
      setScale(Math.min(Math.max(newScale, 0.2), 5))
      setPosition(newPos)
    },
    [scale],
  )

  const handleStageDragEnd = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    setPosition({ x: stage.x(), y: stage.y() })
  }, [])

  const handleStageClick = useCallback(() => {
      const stage = stageRef.current
      if (!stage) return
      if (tool === 'select') {
        setSelection({ type: 'none' })
        return
      }
      const pointer = stage.getPointerPosition()
      if (!pointer) return
      const world = toWorldPoint(stage, pointer)
      const snapped = snapToGrid
        ? {
            x: snapValue(world.x, GRID_SPACING_MM / 2),
            y: snapValue(world.y, GRID_SPACING_MM / 2),
          }
        : world

      if (tool === 'line') {
        const last = resolved.segments.at(-1)
        const start = last?.end ?? { x: 0, y: 0, headingDeg: 0 }
        const length = distance(start.x, start.y, snapped.x, snapped.y)
        const heading = headingBetween(start.x, start.y, snapped.x, snapped.y)
        addLine(length, angleSnap ? snapValue(heading, 15) : heading)
      }
      if (tool === 'arc') {
        const radius = Math.max(doc.robot.trackWidthMm / 2, 150)
        const angle = angleSnap ? snapValue(90, 15) : 90
        addArc(radius, angle)
      }
      if (tool === 'turn') {
        const angle = angleSnap ? 90 : 45
        addTurn(angle)
      }
      if (tool === 'waypoint') {
        addWaypoint({ x: snapped.x, y: snapped.y })
      }
    },
    [
      tool,
      resolved.segments,
      addLine,
      addArc,
      addTurn,
      addWaypoint,
      angleSnap,
      snapToGrid,
      doc.robot.trackWidthMm,
      setSelection,
    ],
  )

  const handles = useMemo<HandleInfo[]>(() => {
    const list: HandleInfo[] = []
    resolved.segments.forEach((segment) => {
      if (segment.autoGenerated) return
      if (segment.segment.type === 'line') {
        list.push({
          segmentId: segment.segment.id,
          type: 'line-end',
          position: { x: segment.end.x, y: segment.end.y },
          segment: segment.segment,
          resolved: segment,
        })
      }
      if (segment.segment.type === 'arc') {
        list.push({
          segmentId: segment.segment.id,
          type: 'arc-end',
          position: { x: segment.end.x, y: segment.end.y },
          segment: segment.segment,
          resolved: segment,
        })
        if (segment.geometry.center) {
          list.push({
            segmentId: segment.segment.id,
            type: 'arc-radius',
            position: {
              x: segment.geometry.center.x,
              y: segment.geometry.center.y,
            },
            segment: segment.segment,
            resolved: segment,
          })
        }
      }
    })
    return list
  }, [resolved.segments])

  const onHandleDragMove = useCallback(
    (handle: HandleInfo) => {
      const stage = stageRef.current
      if (!stage) return
      const pointer = stage.getPointerPosition()
      if (!pointer) return
      const world = toWorldPoint(stage, pointer)
      const snapped = snapToGrid
        ? {
            x: snapValue(world.x, GRID_SPACING_MM / 2),
            y: snapValue(world.y, GRID_SPACING_MM / 2),
          }
        : world

      if (handle.type === 'line-end' && handle.resolved.segment.type === 'line') {
        const start = handle.resolved.start
        const length = distance(start.x, start.y, snapped.x, snapped.y)
        let heading = headingBetween(start.x, start.y, snapped.x, snapped.y)
        if (angleSnap) heading = snapValue(heading, 5)
        updateSegment(handle.segmentId, {
          lengthMm: Math.max(1, length),
          headingDeg: heading,
        })
      }
      if (handle.type === 'arc-end' && handle.resolved.segment.type === 'arc') {
        const center = handle.resolved.geometry.center
        if (!center) return
        const startAngle = headingBetween(center.x, center.y, handle.resolved.start.x, handle.resolved.start.y)
        const endAngle = headingBetween(center.x, center.y, snapped.x, snapped.y)
        let delta = normalizeDegrees(endAngle - startAngle)
        if (angleSnap) delta = snapValue(delta, 5)
        updateSegment(handle.segmentId, {
          angleDeg: delta,
        })
      }
      if (handle.type === 'arc-radius' && handle.resolved.segment.type === 'arc') {
        const arc = handle.resolved.segment
        const entryHeading = arc.entryHeadingDeg ?? handle.resolved.start.headingDeg
        const dir = arc.angleDeg >= 0 ? 1 : -1
        const perp = toRadians(entryHeading + dir * 90)
        const dx = snapped.x - handle.resolved.start.x
        const dy = snapped.y - handle.resolved.start.y
        const projection = dx * Math.cos(perp) + dy * Math.sin(perp)
        const radius = Math.abs(projection)
        updateSegment(handle.segmentId, {
          radiusMm: Math.max(doc.robot.trackWidthMm / 2, radius),
        })
      }
    },
    [angleSnap, snapToGrid, updateSegment, doc.robot.trackWidthMm],
  )

  const onHandleDragStart = useCallback((handle: HandleInfo) => {
    setSelection({ type: 'segment', id: handle.segmentId })
  }, [setSelection])

  const toolButtons = [
    { id: 'select', label: 'Select' },
    { id: 'pan', label: 'Pan' },
    { id: 'line', label: 'Line' },
    { id: 'arc', label: 'Arc' },
    { id: 'turn', label: 'Turn' },
    { id: 'waypoint', label: 'Waypoint' },
  ] as const

  const progress = ghostSamples.length > 1 ? frameIndex / (ghostSamples.length - 1) : 0

  return (
    <div className="canvas-root">
      <div className="canvas-toolbar">
        <div className="tool-buttons">
          {toolButtons.map((button) => (
            <button
              key={button.id}
              className={classNames('tool-button', {
                active: tool === button.id,
              })}
              onClick={() => setTool(button.id)}
            >
              {button.label}
            </button>
          ))}
        </div>
        <div className="toggles">
          <label>
            <input
              type="checkbox"
              checked={showGrid}
              onChange={(event) => setShowGrid(event.target.checked)}
            />
            Grid
          </label>
          <label>
            <input
              type="checkbox"
              checked={snapToGrid}
              onChange={(event) => setSnapToGrid(event.target.checked)}
            />
            Snap
          </label>
          <label>
            <input
              type="checkbox"
              checked={angleSnap}
              onChange={(event) => setAngleSnap(event.target.checked)}
            />
            Angle snap
          </label>
        </div>
        <div className="ghost-controls">
          <button type="button" onClick={() => setPlaying((value) => !value)}>
            {playing ? 'Pause ghost' : 'Play ghost'}
          </button>
          <button
            type="button"
            onClick={() => {
              setPlaying(false)
              setFrameIndex(0)
              const first = ghostSamples[0]
              onGhostUpdate?.({
                pose: first?.pose ?? null,
                progress: 0,
                segmentId: first?.segmentId ?? null,
              })
            }}
          >
            Reset
          </button>
          <span className="ghost-progress">{Math.round(progress * 100)}%</span>
        </div>
      </div>
      <div className="canvas-stage" ref={ref}>
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          scaleX={scale}
          scaleY={scale}
          x={position.x}
          y={position.y}
          draggable={tool === 'pan'}
          onWheel={handleWheel}
          onDragEnd={handleStageDragEnd}
          onClick={handleStageClick}
        >
          <Layer>{showGrid && <GridLayer showRulers />}</Layer>
          <Layer>
            {resolved.segments.map((segment) => {
              if (segment.type === 'line') {
                return (
                  <Group key={segment.id}>
                    <KonvaLine
                      points={segment.geometry.points}
                      stroke={segment.autoGenerated ? '#6b728055' : '#2563eb'}
                      strokeWidth={segment.segment.enabled ? 2 : 1}
                      dash={segment.segment.enabled ? undefined : [8, 4]}
                      onClick={(evt) => {
                        evt.cancelBubble = true
                        setSelection({ type: 'segment', id: segment.segment.id })
                      }}
                    />
                    <SegmentLabel
                      text={`${segment.segment.label ?? segment.id} (${distance(
                        segment.start.x,
                        segment.start.y,
                        segment.end.x,
                        segment.end.y,
                      ).toFixed(1)} mm)`}
                      x={(segment.start.x + segment.end.x) / 2}
                      y={(segment.start.y + segment.end.y) / 2}
                    />
                  </Group>
                )
              }
              if (segment.type === 'arc') {
                return (
                  <Group key={segment.id}>
                    <KonvaLine
                      points={segment.geometry.points}
                      stroke={segment.autoGenerated ? '#f9731655' : '#f97316'}
                      strokeWidth={segment.segment.enabled ? 2 : 1}
                      dash={segment.segment.enabled ? undefined : [8, 4]}
                      lineCap="round"
                      onClick={(evt) => {
                        evt.cancelBubble = true
                        setSelection({ type: 'segment', id: segment.segment.id })
                      }}
                    />
                    <SegmentLabel
                      text={`${segment.segment.label ?? segment.id} (${segment.segment.type === 'arc' ? `${segment.segment.radiusMm.toFixed(1)} mm @ ${segment.segment.angleDeg.toFixed(1)}°` : ''})`}
                      x={segment.geometry.center ? segment.geometry.center.x : segment.start.x}
                      y={segment.geometry.center ? segment.geometry.center.y : segment.start.y}
                    />
                  </Group>
                )
              }
              return (
                <Group key={segment.id}>
                  <Circle
                    x={segment.start.x}
                    y={segment.start.y}
                    radius={8}
                    stroke="#111827"
                    strokeWidth={1.5}
                    dash={[4, 4]}
                    fill="#fff"
                    onClick={(evt) => {
                      evt.cancelBubble = true
                      setSelection({ type: 'segment', id: segment.segment.id })
                    }}
                  />
                  <SegmentLabel
                    text={`${segment.segment.label ?? segment.id} (${segment.segment.type === 'turn' ? `${segment.segment.angleDeg.toFixed(1)}°` : ''})`}
                    x={segment.start.x + 10}
                    y={segment.start.y + 10}
                  />
                </Group>
              )
            })}
            {handles.map((handle) => (
              <Circle
                key={`${handle.segmentId}-${handle.type}`}
                x={handle.position.x}
                y={handle.position.y}
                radius={6}
                fill="#ffffff"
                stroke="#2563eb"
                strokeWidth={1.5}
                draggable
                onDragMove={(evt) => onHandleDragMove(handle, evt)}
                onDragStart={() => onHandleDragStart(handle)}
                onClick={(evt) => {
                  evt.cancelBubble = true
                  setSelection({ type: 'segment', id: handle.segmentId })
                }}
              />
            ))}
            {doc.waypoints
              .filter((waypoint) => waypoint.enabled)
              .map((waypoint) => (
                <Group key={waypoint.id}>
                  <Circle
                    x={waypoint.x}
                    y={waypoint.y}
                    radius={8}
                    fill="#16a34a"
                    opacity={0.9}
                    onClick={(evt) => {
                      evt.cancelBubble = true
                      setSelection({ type: 'waypoint', id: waypoint.id })
                    }}
                  />
                  <Text
                    x={waypoint.x + 10}
                    y={waypoint.y - 5}
                    text={waypoint.name}
                    fontSize={12}
                    fill="#14532d"
                  />
                </Group>
              ))}
            {ghostSample && (
              <Group>
                <Circle
                  x={ghostSample.pose.x}
                  y={ghostSample.pose.y}
                  radius={10}
                  fill="rgba(15,23,42,0.25)"
                  stroke="#0f172a"
                  strokeWidth={2}
                />
                <KonvaLine
                  points={[
                    ghostSample.pose.x,
                    ghostSample.pose.y,
                    ghostSample.pose.x + 20 * Math.cos(toRadians(ghostSample.pose.headingDeg)),
                    ghostSample.pose.y + 20 * Math.sin(toRadians(ghostSample.pose.headingDeg)),
                  ]}
                  stroke="#0f172a"
                  strokeWidth={2}
                />
              </Group>
            )}
            {ghostSegment && ghostSegment.type === 'arc' && ghostSegment.geometry.center && (
              <Circle
                x={ghostSegment.geometry.center.x}
                y={ghostSegment.geometry.center.y}
                radius={6}
                fill="rgba(59, 130, 246, 0.25)"
                stroke="#2563eb"
                dash={[4, 4]}
              />
            )}
          </Layer>
        </Stage>
      </div>
    </div>
  )
}

export default PathCanvas
