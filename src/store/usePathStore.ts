import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import { formatISO } from 'date-fns'
import {
  ArcSegment,
  LineSegment,
  PathMeta,
  PathModel,
  PathSettings,
  RobotConfig,
  Segment,
  TurnSegment,
  Waypoint,
} from '../types'
import { resolveSegments } from '../utils/pathResolver'
import { wheelCircumference } from '../utils/kinematics'

export type ToolMode = 'select' | 'pan' | 'line' | 'arc' | 'turn' | 'waypoint'

export interface SelectionState {
  type: 'segment' | 'waypoint' | 'none'
  id?: string
}

export interface PathDocument {
  meta: PathMeta
  robot: RobotConfig
  settings: PathSettings
  segments: Segment[]
  waypoints: Waypoint[]
}

export interface RobotProfile {
  id: string
  name: string
  robot: RobotConfig
  isDefault: boolean
}

interface PathStoreState {
  doc: PathDocument
  past: PathDocument[]
  future: PathDocument[]
  selection: SelectionState
  tool: ToolMode
  robotProfiles: RobotProfile[]
  resolved: ReturnType<typeof resolveSegments>
  commit: (updater: (doc: PathDocument) => PathDocument) => void
  undo: () => void
  redo: () => void
  reset: () => void
  setTool: (tool: ToolMode) => void
  setSelection: (selection: SelectionState) => void
  addLine: (lengthMm: number, headingDeg: number) => void
  addArc: (radiusMm: number, angleDeg: number) => void
  addTurn: (angleDeg: number) => void
  addWaypoint: (payload?: { name?: string; x?: number; y?: number }) => void
  updateSegment: (id: string, update: Partial<Segment>) => void
  updateWaypoint: (id: string, update: Partial<Waypoint>) => void
  removeSegment: (id: string) => void
  removeWaypoint: (id: string) => void
  reorderSegment: (id: string, targetIndex: number) => void
  updateRobot: (update: Partial<RobotConfig>) => void
  updateRobotWheelDiameter: (diameterMm: number) => void
  updateRobotWheelCircumference: (circumferenceMm: number) => void
  updateSettings: (update: Partial<PathSettings>) => void
  setMeta: (update: Partial<PathMeta>) => void
  importModel: (model: PathModel) => void
  exportModel: () => PathModel
  saveRobotProfile: (name: string, makeDefault?: boolean) => void
  loadRobotProfile: (id: string) => void
  deleteRobotProfile: (id: string) => void
  setDefaultProfile: (id: string) => void
}

const ROBOT_PROFILE_KEY = 'hubconnector.robotProfiles.v1'

const defaultMeta = (): PathMeta => ({
  version: '1.2',
  units: { distance: 'mm', angle: 'deg' },
  title: 'Untitled Path',
  createdAt: formatISO(new Date()),
})

const defaultRobotConfig = (): RobotConfig => ({
  ports: {
    left: 'C',
    right: 'D',
    aux: [],
  },
  invert: {
    left: false,
    right: false,
    aux: {},
  },
  wheel: {
    source: 'diameter',
    diameterMm: 56,
    circumferenceMm: wheelCircumference(56),
  },
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

const defaultSettings = (): PathSettings => ({
  autoCorners: {
    mode: 'fillet_then_turn',
    minRadiusMm: 100,
    maxFilletSweepDeg: 120,
  },
})

const makeDefaultDocument = (): PathDocument => ({
  meta: defaultMeta(),
  robot: defaultRobotConfig(),
  settings: defaultSettings(),
  segments: [],
  waypoints: [],
})

const cloneDocument = (doc: PathDocument): PathDocument =>
  JSON.parse(JSON.stringify(doc))

const loadProfilesFromStorage = (): RobotProfile[] => {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(ROBOT_PROFILE_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as RobotProfile[]
  } catch (error) {
    console.error('Failed to parse robot profiles', error)
    return []
  }
}

const persistProfiles = (profiles: RobotProfile[]) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ROBOT_PROFILE_KEY, JSON.stringify(profiles))
}

export const usePathStore = create<PathStoreState>()(
  devtools((set, get) => ({
    doc: makeDefaultDocument(),
    past: [],
    future: [],
    selection: { type: 'none' },
    tool: 'select',
    robotProfiles: loadProfilesFromStorage(),
    resolved: resolveSegments({
      segments: [],
      settings: defaultSettings(),
      initialPose: { x: 0, y: 0, headingDeg: 0 },
    }),
    commit: (updater) => {
      set((state) => {
        const current = state.doc
        const nextDoc = updater(cloneDocument(current))
        const resolved = resolveSegments({
          segments: nextDoc.segments,
          settings: nextDoc.settings,
          initialPose: { x: 0, y: 0, headingDeg: 0 },
        })
        return {
          doc: nextDoc,
          past: [...state.past, current],
          future: [],
          resolved,
        }
      })
    },
    undo: () => {
      set((state) => {
        if (!state.past.length) return state
        const previous = state.past[state.past.length - 1]
        const past = state.past.slice(0, -1)
        const future = [state.doc, ...state.future]
        return {
          doc: previous,
          past,
          future,
          resolved: resolveSegments({
            segments: previous.segments,
            settings: previous.settings,
            initialPose: { x: 0, y: 0, headingDeg: 0 },
          }),
        }
      })
    },
    redo: () => {
      set((state) => {
        if (!state.future.length) return state
        const [next, ...rest] = state.future
        const past = [...state.past, state.doc]
        return {
          doc: next,
          past,
          future: rest,
          resolved: resolveSegments({
            segments: next.segments,
            settings: next.settings,
            initialPose: { x: 0, y: 0, headingDeg: 0 },
          }),
        }
      })
    },
    reset: () => {
      const doc = makeDefaultDocument()
      set({
        doc,
        past: [],
        future: [],
        selection: { type: 'none' },
        tool: 'select',
        resolved: resolveSegments({
          segments: doc.segments,
          settings: doc.settings,
          initialPose: { x: 0, y: 0, headingDeg: 0 },
        }),
      })
    },
    setTool: (tool) => set({ tool }),
    setSelection: (selection) => set({ selection }),
    addLine: (lengthMm, headingDeg) => {
      const id = nanoid()
      const segment: LineSegment = {
        id,
        type: 'line',
        lengthMm,
        headingDeg,
        enabled: true,
        label: `Line ${headingDeg.toFixed(1)}°`,
        profile: {
          shape: 'trapezoid',
          startMmS: 0,
          cruiseMmS: 120,
          endMmS: 0,
          accelMmS2: 300,
          decelMmS2: 300,
          inheritStart: true,
        },
      }
      get().commit((doc) => ({
        ...doc,
        segments: [...doc.segments, segment],
      }))
      set({ selection: { type: 'segment', id } })
    },
    addArc: (radiusMm, angleDeg) => {
      const id = nanoid()
      const lastResolved = get().resolved.segments.at(-1)
      const entryHeading = lastResolved?.end.headingDeg ?? 0
      const segment: ArcSegment = {
        id,
        type: 'arc',
        radiusMm,
        angleDeg,
        entryHeadingDeg: entryHeading,
        enabled: true,
        label: `Arc ${angleDeg.toFixed(1)}°`,
        profile: {
          shape: 's_curve',
          startMmS: 60,
          cruiseMmS: 100,
          endMmS: 60,
          accelMmS2: 250,
          decelMmS2: 250,
          inheritStart: true,
        },
      }
      get().commit((doc) => ({
        ...doc,
        segments: [...doc.segments, segment],
      }))
      set({ selection: { type: 'segment', id } })
    },
    addTurn: (angleDeg) => {
      const id = nanoid()
      const segment: TurnSegment = {
        id,
        type: 'turn',
        angleDeg,
        enabled: true,
        label: `Turn ${angleDeg.toFixed(1)}°`,
        profile: {
          shape: 'trapezoid',
          startDegS: 0,
          cruiseDegS: 90,
          endDegS: 0,
          accelDegS2: 400,
          decelDegS2: 400,
          inheritStart: true,
        },
        control: 'gyro',
      }
      get().commit((doc) => ({
        ...doc,
        segments: [...doc.segments, segment],
      }))
      set({ selection: { type: 'segment', id } })
    },
    addWaypoint: (payload) => {
      const id = nanoid()
      const waypoint: Waypoint = {
        id,
        name: payload?.name ?? `WP-${get().doc.waypoints.length + 1}`,
        x: payload?.x ?? 0,
        y: payload?.y ?? 0,
        enabled: true,
      }
      get().commit((doc) => ({
        ...doc,
        waypoints: [...doc.waypoints, waypoint],
      }))
      set({ selection: { type: 'waypoint', id } })
    },
    updateSegment: (id, update) => {
      get().commit((doc) => ({
        ...doc,
        segments: doc.segments.map((segment) =>
          segment.id === id ? ({ ...segment, ...update } as Segment) : segment,
        ),
      }))
    },
    updateWaypoint: (id, update) => {
      get().commit((doc) => ({
        ...doc,
        waypoints: doc.waypoints.map((waypoint) =>
          waypoint.id === id ? { ...waypoint, ...update } : waypoint,
        ),
      }))
    },
    removeSegment: (id) => {
      get().commit((doc) => ({
        ...doc,
        segments: doc.segments.filter((segment) => segment.id !== id),
      }))
      set({ selection: { type: 'none' } })
    },
    removeWaypoint: (id) => {
      get().commit((doc) => ({
        ...doc,
        waypoints: doc.waypoints.filter((wp) => wp.id !== id),
      }))
      set({ selection: { type: 'none' } })
    },
    reorderSegment: (id, targetIndex) => {
      get().commit((doc) => {
        const idx = doc.segments.findIndex((segment) => segment.id === id)
        if (idx === -1) return doc
        const nextSegments = [...doc.segments]
        const [segment] = nextSegments.splice(idx, 1)
        nextSegments.splice(targetIndex, 0, segment)
        return { ...doc, segments: nextSegments }
      })
    },
    updateRobot: (update) => {
      get().commit((doc) => ({
        ...doc,
        robot: { ...doc.robot, ...update },
      }))
    },
    updateRobotWheelDiameter: (diameterMm) => {
      get().commit((doc) => ({
        ...doc,
        robot: {
          ...doc.robot,
          wheel: {
            source: 'diameter',
            diameterMm,
            circumferenceMm: wheelCircumference(diameterMm),
          },
        },
      }))
    },
    updateRobotWheelCircumference: (circumferenceMm) => {
      get().commit((doc) => ({
        ...doc,
        robot: {
          ...doc.robot,
          wheel: {
            source: 'circumference',
            diameterMm: circumferenceMm / Math.PI,
            circumferenceMm,
          },
        },
      }))
    },
    updateSettings: (update) => {
      get().commit((doc) => ({
        ...doc,
        settings: { ...doc.settings, ...update },
      }))
    },
    setMeta: (update) => {
      get().commit((doc) => ({
        ...doc,
        meta: { ...doc.meta, ...update },
      }))
    },
    importModel: (model) => {
      set({
        doc: {
          meta: model.meta,
          robot: model.robot,
          settings: model.settings,
          segments: model.segments,
          waypoints: model.waypoints ?? [],
        },
        past: [],
        future: [],
        selection: { type: 'none' },
        resolved: resolveSegments({
          segments: model.segments,
          settings: model.settings,
          initialPose: { x: 0, y: 0, headingDeg: 0 },
        }),
      })
    },
    exportModel: () => {
      const state = get()
      return {
        meta: state.doc.meta,
        robot: state.doc.robot,
        settings: state.doc.settings,
        segments: state.doc.segments,
        waypoints: state.doc.waypoints,
      }
    },
    saveRobotProfile: (name, makeDefault) => {
      set((state) => {
        const profile: RobotProfile = {
          id: nanoid(),
          name,
          robot: cloneDocument({ ...state.doc }).robot,
          isDefault: Boolean(makeDefault),
        }
        const profiles = makeDefault
          ? state.robotProfiles.map((p) => ({ ...p, isDefault: false }))
          : state.robotProfiles
        const nextProfiles = [...profiles, profile]
        persistProfiles(nextProfiles)
        return { robotProfiles: nextProfiles }
      })
    },
    loadRobotProfile: (id) => {
      const profile = get().robotProfiles.find((p) => p.id === id)
      if (!profile) return
      get().commit((doc) => ({
        ...doc,
        robot: profile.robot,
      }))
    },
    deleteRobotProfile: (id) => {
      set((state) => {
        const nextProfiles = state.robotProfiles.filter((p) => p.id !== id)
        persistProfiles(nextProfiles)
        return { robotProfiles: nextProfiles }
      })
    },
    setDefaultProfile: (id) => {
      set((state) => {
        const nextProfiles = state.robotProfiles.map((profile) => ({
          ...profile,
          isDefault: profile.id === id,
        }))
        persistProfiles(nextProfiles)
        return { robotProfiles: nextProfiles }
      })
    },
  })),
)
