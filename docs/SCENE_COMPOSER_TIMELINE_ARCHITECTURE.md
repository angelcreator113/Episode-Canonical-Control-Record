# Scene Composer & Timeline Editor — Architecture Reference

> **Purpose**: Complete structural reference so any developer can understand, modify, and extend these systems without introducing regressions. Read this **before** touching any code in these components.

---

## Table of Contents

1. [High-Level Overview](#1-high-level-overview)
2. [File Map](#2-file-map)
3. [Scene Composer](#3-scene-composer)
4. [Timeline Editor](#4-timeline-editor)
5. [Shared Components](#5-shared-components)
6. [Data Model / Scene Object Schema](#6-data-model--scene-object-schema)
7. [State Management & Data Flow](#7-state-management--data-flow)
8. [Scene Numbering System](#8-scene-numbering-system)
9. [Drag-and-Drop Architecture](#9-drag-and-drop-architecture)
10. [CSS Architecture & Known Pitfalls](#10-css-architecture--known-pitfalls)
11. [Critical Ordering Rules](#11-critical-ordering-rules)
12. [Adding New Features — Checklist](#12-adding-new-features--checklist)
13. [Known Gotchas & Lessons Learned](#13-known-gotchas--lessons-learned)

---

## 1. High-Level Overview

The application has two primary editing modes for episodes:

| Mode | Entry Point | Purpose |
|------|-------------|---------|
| **Scene Composer** | `/episodes/:episodeId` | Build individual scenes — set backgrounds, position characters, add UI elements |
| **Timeline Editor** | `/episodes/:episodeId/timeline` | Arrange scenes in time — set durations, add beats/markers/audio, preview playback |

Both modes share the same **scene data shape** and several **reusable sub-components** (Stage, SceneControlsPanel). Users navigate between them via the Mode dropdown in the Scene Composer header or the "← Back" button in the Timeline Editor.

### Component Hierarchy

```
App
├── SceneComposerFull (route: /episodes/:episodeId)
│   ├── Stage (center canvas)
│   │   ├── StageFrame (chrome/frame, safe zones)
│   │   └── StageRenderer (background, characters, UI elements)
│   ├── SceneControlsPanel (right panel)
│   └── Scene Flow panel (left — inline JSX, not a separate component)
│
└── TimelineEditor (route: /episodes/:episodeId/timeline)
    ├── PreviewMonitor (top — playback preview + controls)
    └── Timeline (bottom — multi-track timeline)
```

---

## 2. File Map

### Scene Composer Files

| File | Lines | Purpose |
|------|-------|---------|
| `frontend/src/components/SceneComposer/SceneComposerFull.jsx` | ~521 | Main page component, 3-panel layout, all scene CRUD + drag-drop |
| `frontend/src/components/SceneComposer/SceneComposerFull.css` | ~1983 | All Scene Composer styles (dark theme) |
| `frontend/src/components/SceneComposer/SceneControlsPanel.jsx` | ~158 | Right-side controls: background, characters, UI elements, safe zones, duration |
| `frontend/src/components/SceneComposer/Stage/Stage.jsx` | ~60 | Reusable canvas wrapper — composes StageFrame + StageRenderer |
| `frontend/src/components/SceneComposer/Stage/StageFrame.jsx` | ~63 | Frame chrome, aspect ratio locking, safe zone overlays, empty state |
| `frontend/src/components/SceneComposer/Stage/StageRenderer.jsx` | ~144 | Scene rendering engine: background, characters, UI elements, hit-testing |
| `frontend/src/components/SceneComposer/Stage/stage.css` | — | Stage-specific styles |
| `frontend/src/components/SceneComposer/AnimaticPreview.jsx` | — | Animatic preview (not currently wired into main flow) |

### Timeline Editor Files

| File | Lines | Purpose |
|------|-------|---------|
| `frontend/src/pages/TimelineEditor.jsx` | ~465 | Main page component, state management, all handlers, keyboard shortcuts |
| `frontend/src/components/Timeline/Timeline.jsx` | ~397 | Multi-track timeline: scenes, beats, characters, audio, markers, drag/resize |
| `frontend/src/components/Timeline/Timeline.css` | — | Timeline track/block styles, resize handles, drag states |
| `frontend/src/components/Timeline/PreviewMonitor.jsx` | ~156 | Preview canvas with play/pause, rewind, fast-forward, scrubber |
| `frontend/src/components/Timeline/PreviewMonitor.css` | — | Preview monitor sizing and control styles |
| `frontend/src/components/Timeline/TimelineEditor.css` | — | Overall layout: header, preview section, timeline section, controls bar |

---

## 3. Scene Composer

### SceneComposerFull.jsx — The Main Page

**Route**: `/episodes/:episodeId`
**CSS class**: `.scene-composer-full` (must match App.css selector — see §10)

#### Layout (3-panel)

```
┌──────────────────────────────────────────────────┐
│                  HEADER                          │
│  [← Back] [Episode Info] [Mode ▼] [Format ▼]   │
│                          [Continue to Export →]   │
├────────┬────────────────────────┬────────────────┤
│ Scene  │                        │  Controls      │
│ Flow   │     Stage Canvas       │  Panel         │
│ Panel  │                        │                │
│        │   (StageFrame +        │  Background    │
│ [1] ○  │    StageRenderer)      │  Characters    │
│ [2] ○  │                        │  UI Elements   │
│ [3] ○  │                        │  Safe Zones    │
│        │                        │  Duration      │
│ [+Add] │                        │                │
└────────┴────────────────────────┴────────────────┘
```

#### State Variables

| State | Type | Purpose |
|-------|------|---------|
| `platform` | `string` | Current format key: `'youtube'`, `'instagram'`, etc. |
| `episode` | `object\|null` | Episode metadata (id, number, title) |
| `scenes` | `array` | Array of scene objects (see §6) |
| `currentSceneIndex` | `number` | Index of the active scene |
| `currentTime` | `number` | Playback time (used by Stage for animation) |
| `loading` | `boolean` | Data loading state |
| `selected` | `object\|null` | `{ type: 'character'\|'ui'\|'background', id }` |
| `editLayoutEnabled` | `boolean` | Edit layout toggle (reserved for future) |
| `showSafeZones` | `boolean` | Whether safe zone overlays display on Stage |
| `showExportMenu` | `boolean` | Export dropdown visibility |
| `showPlatformMenu` | `boolean` | Platform dropdown visibility |
| `showModeMenu` | `boolean` | Mode dropdown visibility |
| `draggedSceneIndex` | `number\|null` | Index of scene being dragged |
| `dragOverSceneIndex` | `number\|null` | Index of scene being dragged over |

#### Key Handlers

| Handler | What It Does |
|---------|-------------|
| `loadEpisodeData()` | Loads mock episode + 1 scene. **TODO**: Replace with API call |
| `handlePlatformChange(key)` | Updates `platform` state. **TODO**: Save to API |
| `handleSetBackground()` | Prompt → sets `background_url` on current scene |
| `handleAddCharacter()` | Prompt → pushes character to current scene's `characters[]` |
| `handleAddUIElement()` | Prompt → pushes UI element to current scene's `ui_elements[]` |
| `handleExport(type)` | Stub for download/schedule/upload workflows |
| `handleSceneDragStart/End/Over/Leave/Drop` | HTML5 drag-drop scene reordering (see §9) |
| `handleDeleteScene(index, e)` | Removes scene, re-numbers remaining, guards last scene |
| **Add Scene** (inline onClick) | Pushes new scene with `Scene ${nextNum}` title |

### SceneControlsPanel.jsx — Right Panel

Stateless component receiving props from SceneComposerFull.

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `currentScene` | `object` | yes | The active scene object |
| `scenes` | `array` | yes | All scenes (for "X of Y" display) |
| `currentSceneIndex` | `number` | yes | Active scene index |
| `onSetBackground` | `function` | yes | Called when "Set Background" clicked |
| `onAddCharacter` | `function` | yes | Called when "Add Character" clicked |
| `onAddUIElement` | `function` | yes | Called when "Add UI Element" clicked |
| `onDurationChange` | `function` | yes | Called with input change event |
| `selected` | `object\|null` | no | Current selection for visual highlight |
| `isCompact` | `boolean` | no | Compact mode (default: false) |
| `showSafeZones` | `boolean` | no | Current safe zone state |
| `onToggleSafeZones` | `function` | no | Toggle callback |

**Renders**: Scene title, "X of Y" count, Set Background button, Add Character button, Add UI Element button, Safe Zones toggle, Duration number input (1-60 seconds).

---

## 4. Timeline Editor

### TimelineEditor.jsx — The Main Page

**Route**: `/episodes/:episodeId/timeline`

#### Layout

```
┌─────────────────────────────────────────────────┐
│ HEADER: [← Back] [Episode Info] [⌨️ Shortcuts] │
│                           [Continue to Export →] │
├─────────────────────────────────────────────────┤
│               PREVIEW MONITOR                    │
│          (PreviewMonitor component)              │
│    ⏪  ▶/⏸  ⏩   ─────●────── 0:05/0:23       │
├─────────────────────────────────────────────────┤
│ CONTROLS: [- 100% +] [Fit] | [+Scene] [+Beat]  │
│           [+Marker] [+Audio] | Speed: [1x▼] [🔁]│
├─────────────────────────────────────────────────┤
│ TIMELINE:                                        │
│ 🎬 Scenes  │▓▓▓ Intro ▓▓│▓▓ Main ▓▓│▓ Outro ▓│ │
│ ✨ Beats   │            │        ▲ │          │ │
│ 👤 Chars   │            │          │          │ │
│ 🎵 Audio   │            │          │          │ │
│             ▲ playhead                           │
└─────────────────────────────────────────────────┘
```

#### State Variables

| State | Type | Purpose |
|-------|------|---------|
| `episode` | `object\|null` | Episode metadata |
| `platform` | `string` | Format key |
| `scenes` | `array` | Scene objects |
| `beats` | `array` | `{ id, time, title, type, color }` |
| `characterClips` | `array` | `{ id, character, startTime, duration }` |
| `audioClips` | `array` | `{ id, name, startTime, duration, volume, audioUrl }` |
| `markers` | `array` | `{ id, time, label, color }` |
| `currentTime` | `number` | Playback position in seconds |
| `isPlaying` | `boolean` | Playback state |
| `zoom` | `number` | Timeline zoom level (0.5–3.0) |
| `loading` | `boolean` | Loading state |
| `playbackSpeed` | `number` | 0.25x – 2x |
| `loopMode` | `boolean` | Auto-loop playback |
| `selectedScene` | `string\|null` | Selected scene ID |
| `timelineWrapperRef` | `ref` | DOM ref for "Fit to View" calculation |

#### Computed Values (useMemo)

| Name | Dependencies | Description |
|------|-------------|-------------|
| `totalDuration` | `[scenes]` | Sum of all `scene.duration_seconds` |
| `getCurrentScene` | `[scenes, currentTime, totalDuration]` | Active scene at `currentTime` with `startTime`, `endTime`, `relativeTime` |

> **CRITICAL**: `totalDuration` and `getCurrentScene` **must be defined BEFORE** any `useEffect` that references them. Moving them below the effects will cause a crash. See §11.

#### Keyboard Shortcuts (registered in useEffect)

| Key | Action |
|-----|--------|
| Space | Play/Pause |
| ← (Left) | Rewind 5s |
| → (Right) | Fast Forward 5s |
| Home | Jump to start |
| End | Jump to end |
| L | Toggle loop mode |

> Shortcuts are ignored when focus is on `<input>` or `<textarea>`.

#### Key Handlers

| Handler | What It Does |
|---------|-------------|
| `handlePlayPause()` | Toggles `isPlaying` |
| `handleSeek(time)` | Clamps to [0, totalDuration], pauses playback |
| `handleRewind()` | `currentTime - 5`, clamped to 0 |
| `handleFastForward()` | `currentTime + 5`, clamped to totalDuration |
| `handleZoomIn/Out()` | ±0.25, range [0.5, 3.0] |
| `handleFitToView()` | Calculates zoom from `timelineWrapperRef.clientWidth` minus 140px label column, based on `totalDuration * 50` base |
| `handleAddScene()` | Appends scene with `Scene ${N}` title |
| `handleAddBeat/Marker/Audio()` | Creates at `currentTime` |
| `handleDeleteScene(id)` | Removes scene, re-numbers + re-titles remaining |
| `handleDeleteBeat/Marker(id)` | Removes from respective array |
| `handleUpdateSceneDuration(id, dur)` | Updates `duration_seconds` |
| `handleReorderScenes(from, to)` | Splice + re-number + re-title |
| `handleResizeScene(id, dur)` | Clamps to 0.5s min, rounds to 0.1s |
| `handleSpeedChange(speed)` | Sets playback speed multiplier |
| `handleToggleLoop()` | Toggles loop mode |

#### Playback Engine (useEffect)

Runs a 100ms `setInterval` when `isPlaying`:
- Advances `currentTime` by `0.1 * playbackSpeed` per tick
- If `currentTime >= totalDuration`: loops (if `loopMode`) or stops

### Timeline.jsx — Multi-Track Timeline

Presentational component. All mutations go through callback props.

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `scenes` | `array` | Scene objects |
| `beats` | `array` | Beat markers |
| `characterClips` | `array` | Character timeline clips |
| `audioClips` | `array` | Audio timeline clips |
| `markers` | `array` | Overlay markers |
| `currentTime` | `number` | Playback position |
| `totalDuration` | `number` | Total timeline duration |
| `zoom` | `number` | Zoom level |
| `onSeek` | `function` | Seek callback |
| `onSceneSelect` | `function` | Scene click callback |
| `onSceneDelete` | `function` | Scene delete callback |
| `onSceneDurationChange` | `function` | Duration change callback |
| `onBeatSelect` | `function` | Beat click callback |
| `onBeatDelete` | `function` | Beat delete callback |
| `onMarkerDrag` | `function` | Marker drag callback |
| `onMarkerDelete` | `function` | Marker delete callback |
| `onSceneReorder` | `function(fromIndex, toIndex)` | Scene reorder callback |
| `onSceneResize` | `function(sceneId, newDuration)` | Edge-resize callback |
| `selectedScene` | `string\|null` | Currently selected scene ID |

#### Internal State

| State | Purpose |
|-------|---------|
| `dragOverIndex` | Index being dragged over (for visual feedback) |
| `draggedIndex` | Index being dragged |
| `resizeRef` | `useRef` — tracks active resize operation: `{ sceneId, startX, startDuration, pixelsPerSecond }` |

#### Key Calculations

- `pixelsPerSecond = 50 * zoom`
- `timelineWidth = max(totalDuration * pixelsPerSecond, 800)`
- Scene position: accumulated duration of all preceding scenes
- Scene width: `(duration / totalDuration) * 100%`

#### Tracks (4 tracks + markers overlay)

1. **Scenes Track** — Draggable blocks with resize handles on right edge
2. **Beats Track** — Point markers at specific times
3. **Characters Track** — Duration clips
4. **Audio Track** — Duration clips
5. **Markers Overlay** — Vertical lines with labels

#### Edge-Resize System

1. `handleResizeStart(e, sceneId, currentDuration)` — captures `startX`, `startDuration`, `pixelsPerSecond` in `resizeRef`
2. Window-level `mousemove` listener calculates `deltaX / pps` → new duration
3. Window-level `mouseup` clears `resizeRef`
4. Minimum duration: 0.5s

### PreviewMonitor.jsx — Preview + Playback Controls

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `scenes` | `array` | All scenes |
| `currentTime` | `number` | Current playback time |
| `isPlaying` | `boolean` | Playing state |
| `totalDuration` | `number` | Total duration |
| `onPlayPause` | `function` | Toggle callback |
| `onSeek` | `function` | Seek callback |
| `onRewind` | `function` | Rewind 5s callback |
| `onFastForward` | `function` | Fast-forward 5s callback |

#### Computed Values

- `activeScene` (useMemo): Iterates scenes, accumulates durations, finds the scene containing `currentTime`. Returns `{ ...scene, startTime, relativeTime }` or `null`.

#### Display

- **Canvas area**: Shows active scene info (title, duration, relative time), background image, characters, UI elements
- **Controls bar**: ⏪ Rewind | ▶/⏸ Play/Pause | ⏩ Fast Forward | Time scrubber (range input) | Current/Total time display

---

## 5. Shared Components

### Stage (Stage.jsx)

Composition wrapper used by Scene Composer. Not currently used in Timeline Editor (PreviewMonitor has its own rendering).

```
Stage
├── StageFrame — Chrome, aspect ratio, safe zones, empty state
└── StageRenderer — Backgrounds, characters, UI elements, hit-testing
```

#### Stage Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `platform` | `object` | — | `{ width, height, ratio, name, icon }` |
| `scene` | `object` | — | Scene data |
| `currentTime` | `number` | — | Current time |
| `interactionMode` | `'view'\|'edit'` | `'view'` | Controls hit-testing behavior |
| `selected` | `object\|null` | — | Current selection |
| `onSelect` | `function` | — | Selection change callback |
| `onUpdatePosition` | `function` | — | Element position update callback |
| `showPlatformBadge` | `boolean` | `true` | Show format badge |
| `showSafeZones` | `boolean` | `false` | Show safe zone overlays |

#### StageFrame

- Applies CSS `aspect-ratio` from platform ratio (e.g., `16 / 9`)
- Renders safe zone overlays (`.stage-safe`, `.stage-title-safe`)
- Shows "No background set" message when empty
- Displays platform label (e.g., "YouTube (16:9)")

#### StageRenderer

- 3 rendering layers (back to front): Background → Characters → UI Elements
- In `'edit'` mode: elements are clickable/hoverable, cursor changes to `move`/`grab`
- Selection state: blue border highlight for selected elements
- Characters: Positioned absolutely with `transform: translate(-50%, -50%)`
- UI Elements: Positioned absolutely with configurable `backgroundColor`, `padding`, `borderRadius`, `width`, `height`

---

## 6. Data Model / Scene Object Schema

```javascript
{
  id: 'scene-1',                    // Unique identifier (string)
  scene_number: 1,                  // Display number (1-based, auto-updated)
  title: 'Intro',                   // Display title — can be custom or auto ("Scene N")
  duration_seconds: 5,              // Duration in seconds (number)
  background_url: null,             // Background image URL or null
  characters: [                     // Array of character objects
    {
      id: 'char-1',                 // Optional — falls back to `char-${index}`
      name: 'Character 1',
      imageUrl: null,               // Character image URL or null
      position: { x: '30%', y: '60%' }  // CSS positioning
    }
  ],
  ui_elements: [                    // Array of UI element objects
    {
      id: 'ui-1',                   // Optional — falls back to `ui-${index}`
      label: 'Scene Title',
      position: { x: '50%', y: '22%' },
      backgroundColor: 'rgba(102, 126, 234, 0.2)',
      padding: '12px 24px',
      borderRadius: '8px',
      width: '300px',
      height: 'auto'
    }
  ],
  dialogue_clips: []                // Reserved for future audio dialogue
}
```

### Beat Object (Timeline only)
```javascript
{ id: 'beat-1', time: 5.0, title: 'Beat 1', type: 'story', color: '#a855f7' }
```

### Marker Object (Timeline only)
```javascript
{ id: 'marker-1', time: 3.0, label: 'Marker 1', color: '#667eea' }
```

### Audio Clip Object (Timeline only)
```javascript
{ id: 'audio-1', name: 'Audio 1', startTime: 0, duration: 5.0, volume: 1.0, audioUrl: null }
```

---

## 7. State Management & Data Flow

Both Scene Composer and Timeline Editor use **local React state** (no global store). State flows **down** via props, mutations flow **up** via callbacks.

### Scene Composer Data Flow

```
SceneComposerFull (state owner)
│
├── scenes state ──→ Scene Flow panel (inline JSX)
│   └── onClick → setCurrentSceneIndex()
│   └── onDrop → handleSceneDrop() → setScenes()
│
├── scenes[currentSceneIndex] ──→ Stage
│   └── onSelect → setSelected()
│
└── scenes[currentSceneIndex] ──→ SceneControlsPanel
    └── onSetBackground → handleSetBackground() → setScenes()
    └── onAddCharacter → handleAddCharacter() → setScenes()
    └── onDurationChange → setScenes() (inline)
```

### Timeline Editor Data Flow

```
TimelineEditor (state owner)
│
├── scenes, currentTime, isPlaying ──→ PreviewMonitor
│   └── onPlayPause → handlePlayPause()
│   └── onSeek → handleSeek()
│   └── onRewind/onFastForward → handleRewind/handleFastForward()
│
└── scenes, beats, clips, markers, zoom ──→ Timeline
    └── onSceneReorder → handleReorderScenes() → setScenes()
    └── onSceneResize → handleResizeScene() → setScenes()
    └── onSceneDelete → handleDeleteScene() → setScenes()
    └── onSeek → handleSeek()
```

### Important: No Shared State Between Pages

Scene Composer and Timeline Editor each load their own mock data independently. Changes in one are **not** reflected in the other until a real API backend persists them.

---

## 8. Scene Numbering System

Scenes have two display-relevant fields:

| Field | Purpose | Auto-Updated? |
|-------|---------|---------------|
| `scene_number` | Used in the badge/number indicator | Yes — always `index + 1` |
| `title` | Display name in cards and timeline blocks | **Conditionally** — only if it matches `Scene N` pattern |

### Auto-Title Convention

- **Custom titles** (e.g., "Intro", "Main Content", "Outro") are **never** automatically changed during reorder or delete.
- **Auto-generated titles** matching `/^Scene \d+$/` (e.g., "Scene 2", "Scene 5") **are** updated to `Scene ${newIndex + 1}` during reorder or delete.

### Where Numbering Updates Happen

| File | Handler | Triggers |
|------|---------|----------|
| `SceneComposerFull.jsx` | `handleSceneDrop` | Drag-drop reorder |
| `SceneComposerFull.jsx` | `handleDeleteScene` | Scene deletion |
| `SceneComposerFull.jsx` | Add Scene (inline) | Adding new scene |
| `TimelineEditor.jsx` | `handleReorderScenes` | Timeline drag reorder |
| `TimelineEditor.jsx` | `handleDeleteScene` | Timeline scene deletion |
| `TimelineEditor.jsx` | `handleAddScene` | Adding new scene |

### The Re-numbering Pattern

```javascript
scenes.map((s, i) => ({
  ...s,
  scene_number: i + 1,
  title: /^Scene \d+$/.test(s.title) ? `Scene ${i + 1}` : s.title
}))
```

**If you add a new way to reorder/remove scenes, you MUST include this pattern** or scene numbers will desync from titles.

---

## 9. Drag-and-Drop Architecture

Both Scene Composer and Timeline use the **HTML5 Drag and Drop API** (not a library like react-dnd).

### Handlers (identical pattern in both components)

| Event | Handler | Action |
|-------|---------|--------|
| `dragstart` | `handleDragStart(e, index)` | Store dragged index, set opacity to 0.4–0.5, set `effectAllowed: 'move'` |
| `dragend` | `handleDragEnd(e)` | Restore opacity, clear drag state |
| `dragover` | `handleDragOver(e, index)` | `e.preventDefault()`, set `dropEffect: 'move'`, update `dragOverIndex` |
| `dragleave` | `handleDragLeave()` | Clear `dragOverIndex` |
| `drop` | `handleDrop(e, toIndex)` | `e.preventDefault() + e.stopPropagation()`, splice + renumber scenes |

### Visual Feedback CSS Classes

| Class | Applied When | Visual Effect |
|-------|-------------|---------------|
| `.dragging` | Element is being dragged | Reduced opacity, dashed border |
| `.drag-over` | Element is hovered during drag | Blue left border, slight transform |

### Scene Composer Additional Behavior

After reorder, `currentSceneIndex` is updated to track the moved scene:
- If the moved scene *was* the selected scene → set index to `toIndex`
- If the moved scene was above/below the selected scene → adjust ±1

---

## 10. CSS Architecture & Known Pitfalls

### Theme

- **Base background**: `#0a0a0f` (near-black)
- **Card/panel backgrounds**: `#1a1a24` (dark navy)
- **Accent color**: `#667eea` (purple-blue)
- **Text**: `#fff` primary, `rgba(255,255,255,0.5-0.7)` secondary

### CRITICAL: CSS Class Name Scoping

**Problem discovered**: Multiple pages use `.scene-card` class with different backgrounds. Without scoping, styles from one page leak into another.

**Rule**: Always scope component-specific classes under a parent selector.

| Component | Parent Scope | Example |
|-----------|-------------|---------|
| Scene Composer | `.scene-flow-panel .scene-card` | Dark background `#1a1a24` |
| Scene Library page | `.scene-library-page .scene-card` | White background for cards |

### App.css Global Overrides

```css
/* This sets WHITE background on all direct children of .app-content */
.app-content > * {
  background-color: #ffffff;
}

/* Scene Composer override — sets dark background */
.app-content > .scene-composer-full {
  background-color: #0a0a0f;
}

/* Full-screen pages override — transparent background */
.full-screen .app-content > * {
  background: transparent;
}
```

> **WARNING**: If you create a new full-screen dark page, you MUST either add it to App.css or use the `.full-screen` wrapper, otherwise it will have a white background.

### SceneComposerFull.css Potential Conflict Zones

The file is ~1983 lines. Be aware of:

1. **Duplicate `.scene-list` rule** at ~line 1022 which sets `max-height: 120px`. The Scene Flow panel has an override removing this.
2. **All `.scene-card` rules** are scoped under `.scene-flow-panel .scene-card` — do NOT add unscoped `.scene-card` rules.
3. **Drag state styles** (`.dragging`, `.drag-over`) are scoped to `.scene-flow-panel .scene-card.dragging` etc.

---

## 11. Critical Ordering Rules

### useMemo Before useEffect (TimelineEditor.jsx)

```javascript
// ✅ CORRECT ORDER — useMemo declarations FIRST
const totalDuration = useMemo(() => { ... }, [scenes]);
const getCurrentScene = useMemo(() => { ... }, [scenes, currentTime, totalDuration]);

// ✅ THEN useEffect hooks that reference them
useEffect(() => { loadEpisodeData(); }, [episodeId]);
useEffect(() => { /* playback loop using totalDuration */ }, [isPlaying, totalDuration, ...]);
useEffect(() => { /* keyboard shortcuts using totalDuration */ }, [totalDuration]);
```

**Moving `totalDuration` below the effects will crash the app** because the playback effect reads `totalDuration` before it's defined within the render cycle.

### Environment Variables

This project uses **Vite**, not Create React App:
- Correct: `import.meta.env.VITE_API_URL`
- **WRONG**: `process.env.REACT_APP_API_URL` (will be `undefined`)

---

## 12. Adding New Features — Checklist

### Adding a New Scene Property

1. Add the field to the scene object in `loadEpisodeData()` for both SceneComposerFull and TimelineEditor
2. Add the field to the "Add Scene" handler in both files
3. If it needs a UI control, add it to `SceneControlsPanel.jsx`
4. If it needs rendering, add it to `StageRenderer.jsx`

### Adding a New Timeline Track

1. Add state array in `TimelineEditor.jsx` (e.g., `const [newClips, setNewClips] = useState([])`)
2. Add handler functions (add, delete, update)
3. Pass array + handlers as props to `Timeline.jsx`
4. Add prop declarations in Timeline's function signature
5. Add a new track label in the labels column
6. Add a new `<div className="timeline-track">` for the content
7. Add corresponding CSS for the new track

### Adding a New Platform Format

Add entry to the `platforms` object in SceneComposerFull.jsx:
```javascript
const platforms = {
  // ...existing
  newFormat: { width: 1280, height: 720, ratio: '16:9', name: 'New Format', icon: '🆕' }
};
```
No other changes needed — the Stage component reads ratio from the platform object dynamically.

### Adding a New Keyboard Shortcut (Timeline)

Add a case to the `handleKeyPress` switch in the keyboard shortcuts `useEffect`:
```javascript
case 'n':
case 'N':
  handleAddScene();
  break;
```

---

## 13. Known Gotchas & Lessons Learned

| # | Gotcha | Impact | Prevention |
|---|--------|--------|------------|
| 1 | **CSS class collisions** — unscoped `.scene-card` from SceneLibrary leaked into SceneComposerFull | White cards on dark background | Always scope component classes under a parent selector |
| 2 | **App.css `.app-content > *` sets white background** | New full-screen pages rendered with white backgrounds | Add explicit override in App.css or wrap in `.full-screen` |
| 3 | **`totalDuration` useMemo must be before useEffect** | App crash — cannot read property of undefined | Never reorder hooks in TimelineEditor.jsx |
| 4 | **`process.env` doesn't work in Vite** | API URLs are `undefined` | Always use `import.meta.env.VITE_*` |
| 5 | **Scene titles vs scene numbers** — reorder updates `scene_number` but could leave `title` stale | "Scene 2" displayed at position 1 | Use the `/^Scene \d+$/` regex pattern when re-numbering |
| 6 | **Timeline resize uses window-level listeners** | Must clean up on unmount or resizeRef leak | The effect returns a cleanup function — don't remove it |
| 7 | **Scene IDs use `Date.now()`** in Timeline but `scene-${length+1}` in Composer | Potential ID collision if scenes are created quickly | Use `Date.now()` for all dynamic scene creation |
| 8 | **`handleSceneDrop` must also update `currentSceneIndex`** | Selected scene jumps to wrong position after reorder | Track the moved scene's destination index |
| 9 | **Fit to View** subtracts 140px for labels column | Incorrect zoom if label width changes | Update the magic number if label column width changes |
| 10 | **No shared state between Composer and Timeline** | Edits in one mode aren't visible in the other | Both load independent mock data — will need API integration |

---

## Quick Reference: Where to Find Things

| Want to... | Look in... |
|------------|-----------|
| Change scene card appearance | `SceneComposerFull.css` → `.scene-flow-panel .scene-card` |
| Change timeline block appearance | `Timeline.css` → `.scene-block` |
| Add playback controls | `PreviewMonitor.jsx` → controls section |
| Change canvas rendering | `StageRenderer.jsx` → layer rendering |
| Change canvas frame/chrome | `StageFrame.jsx` |
| Modify zoom behavior | `TimelineEditor.jsx` → `handleZoomIn/Out/FitToView` |
| Change playback speed options | `TimelineEditor.jsx` → speed `<select>` JSX |
| Add keyboard shortcuts | `TimelineEditor.jsx` → `handleKeyPress` useEffect |
| Modify drag-drop behavior | Scene Composer: `SceneComposerFull.jsx` → `handleSceneDrag*` / Timeline: `Timeline.jsx` → `handleDrag*` |
| Add safe zone overlays | `StageFrame.jsx` → `.stage-safe` / `.stage-title-safe` |

---

*Last updated: Session date — Scene numbering fix applied, full architecture documented.*
