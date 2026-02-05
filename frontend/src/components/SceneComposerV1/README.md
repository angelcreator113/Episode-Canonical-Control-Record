# Scene Composer v1 - Architecture Documentation

## Overview
Scene Composer v1 is a **spatial layout design tool** for creating reusable scene templates. It is **not a timeline editor** - there is no playback, duration, or trimming.

**One-Sentence Job:** Design and save a reusable spatial scene layout (template).

## Routes
- **New Template:** `/episodes/:episodeId/scene-templates/new`
- **Edit Template:** `/episodes/:episodeId/scene-templates/:templateId/edit`

## Page Structure

```
┌───────────────────────────────────────────────┐
│ Scene Composer Header                          │
│ ← Back | Scene Name | Format | Save Template   │
├───────────────┬───────────────────────────────┤
│ Asset Drawer  │                               │
│ (Scenes,      │        CANVAS STAGE            │
│  Assets,      │        (HERO - 70-80%)         │
│  Wardrobe)    │                               │
│               │                               │
├───────────────┴───────────────┬───────────────┤
│ Scene Elements (Layers)        │ Inspector     │
│                               │ (Contextual)  │
└────────────────────────────────┴───────────────┘
```

## File Structure

```
SceneComposer/
├── SceneComposer.jsx        # Main container (state management)
├── CanvasStage.jsx          # Canvas with drag/drop/resize
├── SceneElementsPanel.jsx   # Elements list (layers)
├── InspectorPanel.jsx       # Properties for selected element
├── AssetDrawer.jsx          # Left drawer (scenes/assets/wardrobes)
├── SceneComposer.css        # All styles
├── index.js                 # Export
└── README.md                # This file
```

## Component Responsibilities

### SceneComposer.jsx (Main Container)
- **State Management:** template, elements, selectedElementId, dirty flag
- **Data Loading:** Load template from backend
- **Data Saving:** Transform elements to backend format
- **Format Selection:** YouTube, TikTok, Instagram
- **Routing:** Handle back navigation with dirty check

### CanvasStage.jsx
- **Canvas Rendering:** Display elements at correct positions
- **Drag & Drop:** Move elements around canvas
- **Resize:** 8 resize handles (corners + edges)
- **Snap Guides:** Snap to canvas edges, center, and other elements
- **Zoom Controls:** 25%, 50%, 100%, 200%
- **Selection:** Click to select elements

### SceneElementsPanel.jsx
- **Elements List:** Show all elements sorted by z-index
- **Visibility Toggle:** Show/hide elements
- **Lock Toggle:** Lock/unlock elements
- **Reorder:** Move elements up/down in z-index
- **Selection:** Click to select element

### InspectorPanel.jsx
- **Transform Properties:** X, Y, Width, Height, Rotation, Scale
- **Role Assignment:** Background, Hero, Primary, Overlay, Lower Third, etc.
- **Z-Index:** Manual z-index control
- **Delete:** Remove element from scene

### AssetDrawer.jsx
- **Tabs:** Scenes, Assets, Wardrobe
- **Asset Loading:** Load from episode
- **Add to Canvas:** Click to add element to scene

## Data Contract

### SceneTemplate Structure (Backend)
```javascript
{
  id: string,
  episodeId: string,
  name: string,
  format: 'youtube' | 'tiktok' | 'instagram',
  canvasSize: { width: number, height: number },
  version: number,
  
  // v1 - Spatial only (NO timing fields)
  elements: [{
    id: string,
    type: 'image' | 'video' | 'text',
    role: 'background' | 'hero' | 'overlay' | 'lower-third',
    assetId: string,
    
    transform: {
      x: number,
      y: number,
      width: number,
      height: number,
      rotation: number,
      scale: number
    },
    
    zIndex: number,
    locked: boolean,
    hidden: boolean
  }],
  
  createdAt: string,
  updatedAt: string
}
```

### Transform to Backend Format
The backend expects the old format with `scenes`, `assets`, `wardrobes`, and `layer_transforms`. The component transforms the new element structure to this format when saving.

## Features (v1 Scope)

### ✅ Allowed
- Choose format (YouTube, TikTok, Instagram)
- Place elements on canvas
- Resize & move elements
- Snap to guides (canvas edges, center, other elements)
- Assign roles (background, hero, overlay, etc.)
- Lock/hide elements
- Reorder elements (z-index)
- Save template
- Canvas zoom

### ❌ Forbidden (Not v1)
- Timeline
- Playback
- Duration
- Trimming
- Transitions
- Effects
- Background removal
- Export settings
- Multiple scenes/keyframes
- Animation

**Rule:** If it involves **time**, it's not v1.

## API Integration

### Endpoints Used
- `GET /api/v1/episodes/:episodeId/scene-templates` - Load templates
- `GET /api/v1/episodes/:episodeId/scene-templates/:id` - Load template
- `POST /api/v1/episodes/:episodeId/scene-templates` - Create template
- `PUT /api/v1/episodes/:episodeId/scene-templates/:id` - Update template
- `GET /api/v1/episodes/:episodeId` - Load scenes/assets/wardrobes

### Backend Compatibility
The backend still uses the old `/video-compositions` endpoint name. The frontend uses `/scene-templates` in URLs but the actual API calls go to the correct backend endpoint.

## Canvas System

### Canvas Sizes
- **YouTube:** 1920 × 1080 (16:9)
- **TikTok:** 1080 × 1920 (9:16)
- **Instagram:** 1080 × 1080 (1:1)

### Zoom Levels
- 25%, 50%, 100%, 200%
- Default: 50% (shows full canvas on most screens)

### Snap Threshold
- 5 pixels (tight snap for precision)

### Snap Targets
- Canvas edges (0, width, height)
- Canvas center (centerX, centerY)
- Other element edges
- Other element centers

## Element Roles

### Role → Z-Index Mapping
```javascript
{
  'background': 0,    // Full-canvas background
  'primary': 1,       // Main scene
  'hero': 2,          // Featured content
  'b-roll': 3,        // Secondary footage
  'costume': 3,       // Wardrobe items
  'overlay': 4,       // Graphics/logos
  'lower-third': 5,   // Text overlays
  'effect': 6         // Visual effects
}
```

## State Management

### Main State
- `template` - Current template metadata
- `elements` - Array of elements on canvas
- `selectedElementId` - Currently selected element
- `dirty` - Has unsaved changes

### Canvas State (CanvasStage)
- `isDragging` - Is dragging an element
- `isResizing` - Is resizing an element
- `dragStart` - Mouse position when drag started
- `initialTransform` - Transform when drag/resize started
- `resizeHandle` - Which resize handle is active
- `snapGuides` - Current snap guide lines
- `canvasZoom` - Current zoom level

## Exit Condition (v1 Complete)

Scene Composer v1 is **complete** when a user can:
1. Open composer
2. Place assets on canvas
3. Arrange scene spatially
4. Save template
5. Reopen it later and see the same layout

**No playback required.**

## Migration Notes

### From Old SceneComposer.jsx
The old `SceneComposer.jsx` (tab version in EpisodeDetail) is **deprecated**. It had:
- ❌ Background removal
- ❌ Social media size presets
- ❌ Timeline-like features
- ❌ Export settings

The new v1:
- ✅ Standalone page (owns the screen)
- ✅ Cleaner component structure
- ✅ Focused on spatial layout only
- ✅ No forbidden features

### Backward Compatibility
The old tab version remains in `/components/SceneComposer.jsx` for backward compatibility. It will be removed once all users migrate to the standalone version.

## Future (v2+)

Features intentionally **excluded** from v1 that may come later:
- Timeline/playback
- Duration & trimming
- Transitions & effects
- Background removal
- Export/render
- Animation keyframes
- Multi-scene sequences

These require a fundamentally different data model (time-based) and are out of scope for v1.

---

**Remember:** Scene Composer v1 is about **space**, not **time**.
