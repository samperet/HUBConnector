# HUBConnector

HUBConnector is an interactive planning studio for building precision paths for LEGO® SPIKE robots running Pybricks MicroPython. Draw 2D paths, configure robot kinematics, preview motion profiles, and export directly to a runnable Pybricks program.

> **Note**: The application uses millimetres for distance, degrees for orientation, and mm for arc radii to match the Pybricks execution environment.

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 20 or newer (the project is tested with Node 20 LTS).
- npm 10+ (ships with Node 20). Other package managers such as pnpm/yarn are not officially supported yet.

```bash
# from the project root (the folder that contains package.json)
npm install
npm run dev
```

> If you see `npm ERR! enoent Could not read package.json`, double-check that you are running the commands
> inside the extracted project folder (e.g. `HUBConnector/`) and that `package.json` exists in the current
> directory. macOS can sometimes open a Terminal window in your Downloads directory rather than inside the
> unzipped project—`cd` into the project first.

Open the dev server URL shown in the terminal. The layout includes:

- **Robot setup** – configure ports, wheel geometry, gear ratio, defaults, gyro PID, and manage saved robot profiles (persisted to `localStorage`).
- **Canvas editor** – pan/zoom, draw lines/arcs/turns/waypoints, adjust handles with snapping, and visualise auto-generated corners.
- **Inspector** – tune segment parameters, speed profiles (trapezoid/S-curve), labels, notes, enable/disable segments, and edit waypoints.
- **Summary** – review motor degree predictions, estimated durations, validation warnings, and export/import options.

## Key features

### Canvas & editing
- Infinite Konva canvas with grid, snapping, pan/zoom, ruler axes, and keyboard shortcuts (`N`, `G`, `⌫`, `⌘Z`/`⌘⇧Z`).
- Tools for **line**, **arc**, **turn-in-place**, and **waypoint** creation.
- Drag handles to change line length/heading, arc sweep, and arc radius, with live metric labels.
- Auto-generated corner handling: configurable fillet radius and fallback turn-in-place using gyro control.
- Animated waypoints and optional ghost animation (playback controls in the summary panel).

### Robot configuration
- Port mapping for left/right drive and named auxiliary motors with direction inversion toggles and nudge helpers.
- Wheel geometry presets plus synced diameter/circumference editing and gear ratio adjustments (with effective circumference preview).
- Track width gauge, default linear/angular speeds, and accel/decel settings.
- Gyro PID parameters (kp/ki/kd, sample rate, max correction, tolerance) with enable/disable toggle.
- Save, load, delete, and mark default robot profiles (persisted locally).

### Validation & export
- Validation checks for port uniqueness, wheel geometry, track width, arc radius vs. track width, and disabled segments (warnings displayed in summary).
- JSON import/export of the authoritative path model (`meta`, `robot`, `settings`, `segments`, `waypoints`).
- SVG export of the resolved geometry with labelled waypoints.
- Pybricks `.py` export producing a fully runnable script with helpers for lines, arcs, and gyro-stabilised turns, PID loop, and segment telemetry.

### Motion profiles & kinematics
- Per-segment trapezoidal or S-curve speed profiles with start/cruise/end speeds and accel/decel parameters (mm/s for translations, deg/s for turns).
- “Inherit start speed” toggles to chain segments smoothly.
- Automatic computation of motor rotations (mm → deg) respecting gear ratio, track width, and motor inversion.
- Estimated durations per segment, plus left/right motor degree predictions.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Generate a production build |
| `npm run preview` | Preview the production build |
| `npm run test` | Run unit tests (Vitest) for geometry & path resolution |
| `npm run lint` | Run ESLint checks |

## Tests

Unit tests cover wheel/track conversions and corner resolution logic. Run them with:

```bash
npm run test
```

## Contributing

1. Fork the repository and create a feature branch.
2. Ensure `npm run lint` and `npm run test` pass.
3. Submit a pull request describing your changes and attaching relevant screenshots or robot video captures if applicable.

## License

MIT © 2025 HUBConnector Contributors
