# Scene Clips as Track 1 - CapCut Mental Model Implementation

## Problem Statement
The primary video for each scene was invisible on the timeline - only metadata existed. Users couldn't see their base footage, didn't know what they were dropping overlays onto, and couldn't understand scene duration visually.

## Solution
Transform Scenes lane into **Track 1** with visible, trimmable video/image clips - matching CapCut's mental model where the base footage is always visible as a clip.

---

## Implementation Complete

### ✅ Database Schema
**Existing Fields** (already in `episode_scenes` table):
- `trim_start` - DECIMAL(10,3) - Trim start point in seconds (default 0)
- `trim_end` - DECIMAL(10,3) - Trim end point in seconds (nullable)

**Migration Script**: [add-scene-trim-columns.sql](add-scene-trim-columns.sql)
- Initializes existing scenes with `trim_start = 0`
- Sets `trim_end = libraryScene.duration_seconds` for video scenes
- Leaves `trim_end = NULL` for images (uses explicit duration)

### ✅ Frontend - Scene Clip Component

**New Component**: `SceneClip` in [TimelineLanes.jsx](frontend/src/components/Timeline/TimelineLanes.jsx)

**Features**:
1. **Empty State** (no primary video/image)
   - Dashed border placeholder
   - "Drop Video Here" text
   - Shows scene # and title (slot is ready)
   - Accepts drag/drop from library panel

2. **Video/Image Clip** (with primary media)
   - Thumbnail background across full clip width
   - Metadata overlay: `#<scene_order> <title>`
   - Duration badge (top-right): `🎥 2:30` or `📷 5:00`
   - Selected state: blue glow + border
   - Hover: lift effect + tooltip

3. **Trim Handles**
   - Left edge: `[` grip - trims start
   - Right edge: `]` grip - trims end
   - Visible on hover, cursor: `ew-resize`
   - Blue highlight when active

4. **Tooltip Info**
   - Scene title
   - Duration
   - Type (Image/Video)
   - Source asset name

### ✅ CSS Styling

**New Classes** in [TimelineLanes.css](frontend/src/components/Timeline/TimelineLanes.css):

```css
.scene-clip                    /* Base clip styling */
.scene-clip-empty              /* Empty state with dashed border */
.scene-clip-selected           /* Selected clip (blue glow) */
.scene-clip-trimming           /* Active trim state */
.scene-clip-metadata           /* Overlay for # + title */
.scene-clip-duration-badge     /* Duration display (top-right) */
.scene-clip-tooltip            /* Hover info */
.scene-clip-trim-handle        /* Trim grips */
```

**Visual Design**:
- Empty: Gray dashed border, centered drop zone
- Clip: Thumbnail background, semi-transparent metadata overlay
- Selected: Blue border + outer glow (matches CapCut)
- Trim handles: Blue bars on edges, white bracket icons

---

## User Experience Changes

### Before ❌
- Scene metadata existed, but no visible video clip
- Users confused about where their footage was
- Overlays dropped into void (no visual target)
- Scene duration unclear without reading metadata
- No intuitive trimming

### After ✅
- **Track 1** shows actual video clips with thumbnails
- Immediate visual feedback: "This is my footage"
- Clear drop target for empty scenes
- Duration visible at a glance (badge + clip width)
- CapCut-style trim handles on edges
- Professional timeline UX

---

## Technical Implementation

### Duration Calculation Logic

**Videos** (trim-based duration):
```javascript
duration = trim_end - trim_start
// Example: 60s source, trim 10-25s = 15s scene duration
```

**Images** (explicit duration):
```javascript
duration = scene.duration_seconds || 5.0  // Default 5 seconds
// Resizable, but not trimmable
```

### Scene Clip Data Flow

1. **Load**: `scene.libraryScene` provides thumbnail, duration, mime_type
2. **Render**: `SceneClip` component shows clip with metadata
3. **Trim** (future): Edge drag updates `trim_start`/`trim_end` via API
4. **Replace** (future): Drag new asset onto clip updates `scene_library_id`
5. **Reorder** (future): Center drag updates `scene_order`

### Empty Scene Handling

```javascript
if (!scene.libraryScene?.id) {
  // Show dashed placeholder
  return <SceneClip isEmpty />;
}
```

Empty scenes:
- Still show scene # and title (slot exists)
- Accept drag/drop to set primary video
- Can have overlays/audio before primary is set
- Visual placeholder maintains timeline structure

---

## Integration Points

### Drag & Drop (Next Step)
Timeline.jsx needs handlers for:
- Dropping library asset onto empty scene → set `scene_library_id`
- Dropping onto existing clip → "Replace Primary Video?"
- Initialize trim values: `trim_start=0`, `trim_end=asset.duration`

### Trim Interaction (Next Step)
- Left handle drag → update `trim_start`
- Right handle drag → update `trim_end`
- API call: `PUT /api/episodes/:id/scenes/:sceneId/trim`
- Real-time preview update

### Replace Primary Video (Next Step)
Inspector panel "Replace Primary" button:
- Opens library browser
- Selecting asset updates `scene_library_id`
- Resets trim values to full new asset duration

### Scene Reordering (Next Step)
- Center drag → drag-to-reorder
- Updates `scene_order` for affected scenes
- Maintains trim values during reorder

---

## Migration Path

### Existing Scenes
**Automatic Initialization**:
1. Run `add-scene-trim-columns.sql`
2. Sets `trim_start = 0` for all scenes
3. Sets `trim_end = libraryScene.duration_seconds` for videos
4. Leaves `trim_end = NULL` for images (uses explicit duration)

**Result**: All existing scenes render correctly as full-length clips

### New Scenes
**On Creation**:
- If created from library asset: Auto-populate `scene_library_id`, set trim to full duration
- If created empty: `scene_library_id = NULL`, await user drag/drop

---

## API Endpoints Needed (Future)

### Update Trim
```
PUT /api/episodes/:episodeId/scenes/:sceneId/trim
Body: { trim_start: 10.5, trim_end: 25.3 }
```

### Replace Primary Video
```
PUT /api/episodes/:episodeId/scenes/:sceneId/primary
Body: { scene_library_id: "uuid" }
```

### Reorder Scenes
```
PUT /api/episodes/:episodeId/scenes/reorder
Body: { scenes: [{ id: "uuid", scene_order: 1 }, ...] }
```

---

## Testing Checklist

### Visual Rendering
- [x] Empty scenes show dashed placeholder with "Drop Video Here"
- [x] Scenes with video show thumbnail background
- [x] Scenes with images show thumbnail background
- [x] Metadata overlay shows #, title, duration
- [x] Duration badge shows media type icon (🎥/📷) + time
- [x] Selected state shows blue glow
- [x] Hover shows lift effect + tooltip

### Trim Handles
- [x] Trim handles visible on hover
- [x] Left handle shows `[` grip
- [x] Right handle shows `]` grip
- [ ] Dragging left handle updates trim_start (API integration needed)
- [ ] Dragging right handle updates trim_end (API integration needed)
- [ ] Trim updates reflected immediately in duration badge

### Empty State
- [x] Empty scenes maintain scene # and title
- [x] Empty scenes show drop zone indicator
- [ ] Drag/drop from library sets primary video (handler needed)
- [ ] After drop, clip renders with thumbnail

### Duration Display
- [x] Videos show calculated duration (trim_end - trim_start)
- [x] Images show explicit duration (default 5s)
- [x] Duration badge formatted as MM:SS
- [x] Media type icon shows correctly

---

## Known Limitations (V1)

### Not Yet Implemented
1. **Trim Interaction**: Handles render but don't update backend yet
2. **Drag/Drop**: Empty scenes accept drops visually but need handler
3. **Replace Primary**: UI exists but backend integration needed
4. **Reorder**: Center drag recognition not implemented
5. **Filmstrip View**: V1 uses single thumbnail, V2 can add frame preview

### Workarounds
- Users can still edit trim values via inspector panel (when built)
- Scene primary can be set via scene creation flow
- Reordering works via drag-to-reorder on scene cards (existing)

---

## Future Enhancements

### V2 Features
1. **Filmstrip Thumbnails**: Show video frames along clip width
2. **Waveform Overlay**: Audio waveform for video clips
3. **Trim Preview**: Live preview while dragging trim handles
4. **Snap to Playhead**: Trim handles snap to current time
5. **Keyboard Trim**: Arrow keys to frame-accurate trim
6. **Multi-Select Trim**: Trim multiple scenes at once
7. **Ripple Trim**: Trim affects downstream scene positions

### Advanced Features
- **Nested Clips**: Multiple video layers per scene (B-roll)
- **Slip/Slide**: Move trim window without changing duration
- **Speed Ramping**: Variable playback speed visualization
- **Markers**: Add markers to clips for notes/edits

---

## Impact Assessment

### Development Impact
- **Low**: Existing trim columns already in database
- **Medium**: CSS and component additions
- **High**: Drag/drop and trim interaction handlers (next phase)

### User Impact
- **Immediate**: Visual clarity - users see their footage
- **High**: Mental model shift - timeline now matches CapCut
- **Positive**: Reduced confusion, faster editing workflow

### Performance Impact
- **Minimal**: Renders same number of elements, just styled differently
- **Thumbnail Loading**: Existing thumbnail URLs, no new network calls
- **Hover Effects**: CSS transitions, GPU-accelerated

---

## Success Metrics

### Before (Baseline)
- Users reported confusion about where video was
- Overlays dropped with no visual context
- Scene duration unclear from timeline view

### After (Expected)
- ✅ Users immediately recognize Track 1 as base video
- ✅ Empty states clearly signal where to drop content
- ✅ Duration visible at a glance via badge + clip width
- ✅ Trim handles provide affordance for editing
- ✅ Professional timeline matches industry standard tools

---

**Status**: ✅ **Phase 1 Complete** - Visual rendering implemented  
**Next**: Phase 2 - Interaction handlers (trim, drag/drop, replace)

**Implementation Date**: February 2, 2026  
**Files Modified**: 3 (TimelineLanes.jsx, TimelineLanes.css, add-scene-trim-columns.sql)  
**Breaking Changes**: None (purely additive)
