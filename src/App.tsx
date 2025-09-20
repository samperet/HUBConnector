import { useEffect, useState } from 'react'
import ConfigPanel from './components/ConfigPanel'
import PathCanvas from './components/PathCanvas'
import InspectorPanel from './components/InspectorPanel'
import SidePanel from './components/SidePanel'
import { usePathStore } from './store/usePathStore'
import { useShallow } from 'zustand/react/shallow'
import type { GhostState } from './components/PathCanvas'
import './App.css'

const isEditableElement = (element: EventTarget | null) => {
  if (!(element instanceof HTMLElement)) return false
  const tag = element.tagName.toLowerCase()
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    element.isContentEditable ||
    (element as HTMLInputElement).type === 'number'
  )
}

function App() {
  const {
    doc,
    setMeta,
    settings,
    updateSettings,
    selection,
    removeSegment,
    removeWaypoint,
    undo,
    redo,
    reset,
  } = usePathStore(
    useShallow((state) => ({
      doc: state.doc,
      setMeta: state.setMeta,
      settings: state.doc.settings,
      updateSettings: state.updateSettings,
      selection: state.selection,
      removeSegment: state.removeSegment,
      removeWaypoint: state.removeWaypoint,
      undo: state.undo,
      redo: state.redo,
      reset: state.reset,
    })),
  )

  const [ghostState, setGhostState] = useState<GhostState | null>(null)

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (isEditableElement(event.target)) return
      const key = event.key.toLowerCase()
      const meta = event.metaKey || event.ctrlKey
      if (meta && key === 'z') {
        event.preventDefault()
        if (event.shiftKey) {
          redo()
        } else {
          undo()
        }
      } else if (meta && (key === 'y' || (key === 'z' && event.shiftKey))) {
        event.preventDefault()
        redo()
      } else if (!meta && key === 'g') {
        event.preventDefault()
        window.dispatchEvent(new CustomEvent('hubconnector:toggle-grid'))
      } else if (!meta && key === 'n') {
        event.preventDefault()
        reset()
      } else if (key === 'delete' || key === 'backspace') {
        if (selection.type === 'segment' && selection.id) {
          event.preventDefault()
          removeSegment(selection.id)
        }
        if (selection.type === 'waypoint' && selection.id) {
          event.preventDefault()
          removeWaypoint(selection.id)
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [selection, undo, redo, removeSegment, removeWaypoint, reset])

  const cornerSettings = settings.autoCorners

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="title-group">
          <input
            className="title-input"
            value={doc.meta.title}
            onChange={(event) => setMeta({ title: event.target.value })}
            placeholder="Project title"
          />
          <span className="meta">Last updated: {new Date(doc.meta.createdAt).toLocaleString()}</span>
        </div>
        <div className="header-actions">
          <button type="button" onClick={undo} title="Undo (⌘Z)">
            Undo
          </button>
          <button type="button" onClick={redo} title="Redo (⇧⌘Z)">
            Redo
          </button>
          <button type="button" onClick={reset} title="New path (N)">
            New
          </button>
        </div>
        <div className="corner-controls">
          <label>
            Corner handling
            <select
              value={cornerSettings.mode}
              onChange={(event) =>
                updateSettings({
                  autoCorners: {
                    ...cornerSettings,
                    mode: event.target.value as typeof cornerSettings.mode,
                  },
                })
              }
            >
              <option value="fillet_then_turn">Fillet then turn</option>
              <option value="turn_only">Turn only</option>
              <option value="off">Off</option>
            </select>
          </label>
          <label>
            Min radius
            <input
              type="number"
              value={cornerSettings.minRadiusMm}
              onChange={(event) =>
                updateSettings({
                  autoCorners: {
                    ...cornerSettings,
                    minRadiusMm: Number(event.target.value),
                  },
                })
              }
            />
          </label>
          <label>
            Max sweep
            <input
              type="number"
              value={cornerSettings.maxFilletSweepDeg}
              onChange={(event) =>
                updateSettings({
                  autoCorners: {
                    ...cornerSettings,
                    maxFilletSweepDeg: Number(event.target.value),
                  },
                })
              }
            />
            <span>°</span>
          </label>
        </div>
      </header>
      <div className="app-body">
        <ConfigPanel />
        <main className="workspace">
          <PathCanvas onGhostUpdate={setGhostState} />
        </main>
        <InspectorPanel />
        <SidePanel ghostState={ghostState} />
      </div>
    </div>
  )
}

export default App
