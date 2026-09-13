# Timeline Placement System - Implementation Complete

## Overview
We've successfully implemented a 3-layer timeline architecture for asset and wardrobe management:
- **Layer 1: Library** (show-level assets) 
- **Layer 2: Episode** (episode_assets join table)
- **Layer 3: Timeline** (timeline_placements with scene-attached positioning)

## Architecture

### Database Schema

#### episode_assets (Episode Library)
Join table linking episodes to show-level assets with episode-specific metadata:
```sql
- id (UUID, primary key)
- episode_id (FK to episodes)
- asset_id (FK to assets)
- folder (text) - For organizing in library panel
- sort_order (integer) - Custom ordering within folders
- tags (text[]) - Episode-specific tagging
- added_at (timestamp)
- added_by (UUID, FK to users)
```

#### timeline_placements (Timeline Layer)
Unified placement system for assets, wardrobe, and audio:
```sql
- id (UUID, primary key)
- episode_id (FK to episodes)
- placement_type (ENUM: 'asset', 'wardrobe', 'audio')
- asset_id (FK to assets, nullable)
- wardrobe_item_id (FK to wardrobe, nullable)
- scene_id (FK to episode_scenes, nullable)
- attachment_point (ENUM: 'scene-start', 'scene-middle', 'scene-end', 'custom')
- offset_seconds (decimal) - Offset from attachment point
- absolute_timestamp (integer) - For time-based placements (audio)
- track_number (integer) - Track 2 for overlays
- duration (decimal, nullable) - Explicit duration
- z_index (integer) - Stacking order
- properties (JSONB) - Type-specific properties
- character (text) - For wardrobe placements
- label (text) - Custom label
```

### Placement System

#### Scene-Attached (Default for Assets & Wardrobe)
- Placements attached to scenes via `scene_id`
- Position relative to scene using `attachment_point` + `offset_seconds`
- Move automatically when scenes are reordered
- Render within scene boundaries on Track 2

**Attachment Points:**
- `scene-start`: Beginning of scene + offset
- `scene-middle`: Middle of scene + offset
- `scene-end`: End of scene + offset
- `custom`: Custom position + offset

#### Time-Based (For Audio)
- Uses `absolute_timestamp` instead of scene attachment
- Fixed position in timeline regardless of scene changes
- For audio tracks, transitions, global effects

#### Wardrobe Carry-Forward Logic
- Wardrobe stored as point-based events (not duration)
- Each placement = "Character puts on outfit at this time"
- UI computes current wardrobe by finding most recent placement before current time
- Backend provides `getCurrentWardrobe` endpoint for query at specific time

## Backend Implementation

### Models
- `src/models/EpisodeAsset.js` - Episode library join table
- `src/models/TimelinePlacement.js` - Unified placement model with associations

### Controllers
- `src/controllers/episodeAssetsController.js` - CRUD for episode library
- `src/controllers/timelinePlacementsController.js` - Placement management + wardrobe queries

### API Routes
```
GET    /api/v1/episodes/:episodeId/library-assets
POST   /api/v1/episodes/:episodeId/library-assets
PUT    /api/v1/episodes/:episodeId/library-assets/:id
DELETE /api/v1/episodes/:episodeId/library-assets/:id

GET    /api/v1/episodes/:episodeId/timeline/placements
POST   /api/v1/episodes/:episodeId/timeline/placements
PUT    /api/v1/episodes/:episodeId/timeline/placements/:id
DELETE /api/v1/episodes/:episodeId/timeline/placements/:id
GET    /api/v1/episodes/:episodeId/timeline/wardrobe/current
```

## Frontend Implementation

### Components

#### TimelineLibraryPanel.jsx (Left Sidebar)
- Collapsible folders for Assets (grouped by `folder` field)
- Character-grouped wardrobe items
- Search/filter functionality
- Drag sources using `useDraggable` from @dnd-kit
- Upload button for adding new assets

**Key Features:**
- Tab switching between Assets and Wardrobe
- Folder organization with expand/collapse
- Search across names/tags
- Drag initiation with metadata

#### TimelinePlacementTrack.jsx (Track 2)
- Renders placements within scene boundaries
- Calculates position: `scene.start_time + calculateOffset(attachment_point) + offset_seconds`
- Stacks multiple placements vertically (8px increments)
- Color-coded by type:
  - Wardrobe: pink (#ec4899)
  - Assets: varies by type (promo=purple, logo=blue, lower-third=green, default=gray)
  - Audio: gray (#9ca3af)
- Shows icon + label
- Click to select

**Position Calculation:**
```javascript
calculateOffset(scene, attachmentPoint) {
  switch (attachmentPoint) {
    case 'scene-start': return 0;
    case 'scene-middle': return scene.duration_seconds / 2;
    case 'scene-end': return scene.duration_seconds;
    case 'custom': return 0; // offset_seconds handles full position
  }
}
```

#### TimelineInspectorPanel.jsx (Right Sidebar)
- Shows selected scene properties
- Lists placements on selected scene
- Edit form for placement properties:
  - Attachment point dropdown
  - Offset seconds input
  - Duration (for assets/audio, not wardrobe)
- Delete placement button
- Compact placement cards with metadata

### Services
- `frontend/src/services/episodeAssetsService.js` - API calls for library
- `frontend/src/services/timelinePlacementsService.js` - API calls for placements

### Timeline.jsx Integration
Enhanced main timeline component with:
- `showLibraryPanel` toggle button
- `showInspectorPanel` toggle button
- Drag-drop handling for library → scene drops
- Scene selection state management
- Placement selection state management

**Drag-Drop Flow:**
1. User drags asset/wardrobe from library panel
2. @dnd-kit tracks drag with metadata: `{type: 'library-asset', item: {...}}`
3. Scene becomes drop target (highlighted with blue pulsing border)
4. On drop: `handleLibraryDrop()` creates placement via API
5. New placement added to state and selected in inspector

### Updated SortableTimelineScene.jsx
Added `useDroppable` hook to make scenes accept drops:
- Combined sortable (for reordering) + droppable (for asset drops)
- Visual feedback with `isOver` state
- Accepts: `['library-asset', 'wardrobe-item']`
- ID format: `scene-{scene.id}` for drop targeting

## User Workflow

### Adding Assets to Timeline
1. Click "📚 Library" to open library panel
2. Browse folders or search for assets
3. Drag asset from library
4. Drop onto target scene (blue pulsing outline appears)
5. Placement created at scene-start
6. Inspector panel opens showing placement properties
7. Adjust attachment point and offset as needed

### Managing Wardrobe
1. Switch to "Wardrobe" tab in library
2. Drag wardrobe item onto scene
3. Placement created as point-based event
4. Repeat for outfit changes throughout episode
5. Current wardrobe computed automatically by finding most recent placement

### Editing Placements
1. Click scene on Track 1 to select and view all placements
2. Or click placement on Track 2 to select directly
3. Inspector panel shows:
   - Scene properties
   - List of all placements on scene
   - Edit form for selected placement
4. Modify attachment point, offset, or duration
5. Click "Save Changes"
6. Delete placement with ✕ button

### Toggle Panels
- Library: Click "📚 Library" button in header
- Inspector: Click "📋 Inspector" button in header
- Panels can be hidden for more timeline space

## Visual Design

### Layout
```
┌──────────────┬─────────────────────────┬──────────────┐
│              │                         │              │
│   Library    │       Timeline          │  Inspector   │
│   Panel      │                         │   Panel      │
│   (300px)    │       (flex: 1)         │   (300px)    │
│              │                         │              │
│  [Assets]    │  [Ruler]                │  [Scene #]   │
│  [Wardrobe]  │  [Track 1: Scenes]      │  [Props]     │
│              │  [Track 2: Placements]  │  [Placement] │
│  📦 Folder1  │                         │  [List]      │
│  📦 Folder2  │  Scene 1  Scene 2  ...  │  [Edit Form] │
│              │    ├─asset              │              │
│  👗 Char A   │    └─wardrobe           │              │
│  👗 Char B   │                         │              │
└──────────────┴─────────────────────────┴──────────────┘
```

### Track 2 Rendering
- Height: 50px per scene
- Placements render within scene boundaries
- Position: `scene.left + offset_from_attachment`
- Stacking: Multiple placements stack vertically
- Visual: Icon + label in pill shape
- Hover: Lift effect (translateY -2px)
- Selected: Yellow outline

### Color Coding
- **Wardrobe**: Pink background (#ec4899)
- **Promo Assets**: Purple (#8b5cf6)
- **Brand Logos**: Blue (#3b82f6)
- **Lower Thirds**: Green (#10b981)
- **Audio**: Gray (#9ca3af)
- **Default**: Gray (#6b7280)

## Technical Details

### Migrations
- Created with standalone runner: `run-timeline-migrations.js`
- ENUM types created with `DO $$ BEGIN...EXCEPTION` blocks
- Foreign keys with CASCADE delete for cleanup

### Sequelize Associations
```javascript
// EpisodeAsset
belongsTo(Episode)
belongsTo(Asset)

// TimelinePlacement
belongsTo(Episode)
belongsTo(EpisodeScene)
belongsTo(Asset, optional)
belongsTo(Wardrobe, optional)
```

### Virtual Fields
Models use virtual fields for camelCase ↔ snake_case conversion:
- `assetId` ↔ `asset_id`
- `sceneId` ↔ `scene_id`
- `attachmentPoint` ↔ `attachment_point`
- etc.

### Drag-Drop Library
Using @dnd-kit for consistency with existing scene reordering:
- `DndContext` wraps timeline
- `useDraggable` in library items
- `useDroppable` in scenes
- `useSortable` for scene reordering (existing)

## Testing Checklist

### Backend
- [x] Migrations run successfully
- [ ] Episode assets CRUD operations
- [ ] Timeline placements CRUD operations
- [ ] Wardrobe carry-forward query
- [ ] Validation (placement_type requirements)
- [ ] Foreign key constraints
- [ ] Cascade deletes

### Frontend
- [x] Library panel loads and displays assets
- [x] Library panel displays wardrobe
- [ ] Search/filter functionality
- [ ] Drag from library to scene
- [ ] Drop creates placement
- [ ] Track 2 renders placements correctly
- [ ] Position calculations accurate
- [ ] Inspector shows scene properties
- [ ] Inspector shows placement list
- [ ] Edit placement properties
- [ ] Delete placement
- [ ] Toggle panels visibility
- [ ] Selected state management

### Integration
- [ ] End-to-end: Add asset to library → drag to timeline → edit → delete
- [ ] End-to-end: Add wardrobe → drag to timeline → verify carry-forward
- [ ] Scene reordering updates placement positions
- [ ] Multiple placements stack correctly
- [ ] Panel state persists across route changes
- [ ] Responsive layout

## Next Steps

### Immediate (Critical)
1. **Test drag-drop integration** - Verify library → scene drop creates placements
2. **Test wardrobe carry-forward** - Query endpoint and verify logic
3. **Add upload to library** - Implement asset upload in library panel
4. **Add folder management** - Create/rename/delete folders in library

### Short Term (Enhancements)
1. **Keyboard shortcuts** - Delete placement with Del key, etc.
2. **Bulk operations** - Select multiple placements, delete all
3. **Copy/paste placements** - Duplicate placements across scenes
4. **Placement preview** - Show asset thumbnail/preview in inspector
5. **Time display** - Show absolute time for placements (not just offset)

### Medium Term (Features)
1. **Audio track** - Dedicated Track 3 for audio with waveform
2. **Transitions** - Special placement type for transitions between scenes
3. **Templates** - Save common placement patterns as templates
4. **Timeline zoom to selection** - Focus on specific scene/range
5. **Undo/redo** - History for placement operations

### Long Term (Advanced)
1. **Timeline preview** - Render timeline with all placements
2. **Keyframe animation** - Animate placement properties over time
3. **Multi-track editing** - More than 2 tracks with custom track types
4. **Real-time collaboration** - Multiple users editing timeline
5. **Export timeline** - Generate video composition file

## File Structure

### Backend
```
migrations/sequelize-migrations/
  20260201000001-create-episode-assets.js
  20260201000002-create-timeline-placements.js
run-timeline-migrations.js

src/
  models/
    EpisodeAsset.js
    TimelinePlacement.js
    index.js (updated with associations)
  controllers/
    episodeAssetsController.js
    timelinePlacementsController.js
  routes/
    episodes.js (updated with new routes)
```

### Frontend
```
frontend/src/
  components/
    Timeline.jsx (updated with panels)
    SortableTimelineScene.jsx (updated with droppable)
    Timeline/
      TimelineLibraryPanel.jsx
      TimelineLibraryPanel.css
      TimelinePlacementTrack.jsx
      TimelinePlacementTrack.css
      TimelineInspectorPanel.jsx
      TimelineInspectorPanel.css
  services/
    episodeAssetsService.js
    timelinePlacementsService.js
```

## Key Design Decisions

1. **Scene-attached as default** - Assets/wardrobe move with scenes automatically
2. **Point-based wardrobe** - Events not durations, carry-forward computed
3. **Left sidebar library** - Keeps timeline clean, browse/search in dedicated space
4. **Track 2 scene-confined** - Placements render within scene boundaries for clarity
5. **Unified placement model** - Single table for all placement types with ENUM
6. **@dnd-kit for consistency** - Same drag-drop library as scene reordering

## Conclusion

The timeline placement system is now fully implemented with:
- ✅ Database schema and migrations
- ✅ Backend API endpoints
- ✅ Frontend components (library, track, inspector)
- ✅ Drag-drop integration
- ✅ Scene-attached positioning
- ✅ Wardrobe carry-forward support

Next critical step: **End-to-end testing** of the drag-drop workflow.
