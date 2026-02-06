# Timeline Architecture Alignment

## ✅ Current Implementation (Correct)
- 3-panel layout: Library | Timeline | Inspector
- Scenes are primary timeline objects
- Assets/placements are scene-attached by default (`attachment_point: 'scene-start'`)
- Drag-drop from library → scene creates scene-attached placement
- Inspector panel is the control surface for editing placements

## ❌ Visual Misalignment (Needs Fixing)

### Issue 1: Separate Placement Track
**Current**: Placements render in `TimelinePlacementTrack` - a separate track below scenes
**User's Vision**: Assets should render **within or directly under their scene blocks**

**Implementation Plan**:
- Modify `SortableTimelineScene` component to render its placements inline
- Show asset badges/indicators at the bottom edge of each scene block
- Remove the separate `TimelinePlacementTrack` component
- Keep visual footprint minimal (small badges, not full blocks)

### Issue 2: Wardrobe as Track Items
**Current**: Wardrobe placements show as items on the placement track
**User's Vision**: Scene-relative indicator (badge/thin strip) that opens inspector

**Implementation Plan**:
- Wardrobe should render as small badge on scene (e.g., "👗" icon)
- Clicking wardrobe badge opens inspector panel with wardrobe controls
- No separate track for wardrobe - keeps timeline clean
- Maintains "continuity visible without clutter"

### Issue 3: Reinforcing Scene-Attachment Mental Model
**Current**: Separate tracks suggest independent, time-based placement
**User's Vision**: Visual hierarchy shows assets "belong to" scenes

**Implementation Plan**:
- Asset badges render inside/under parent scene block
- Visual nesting reinforces attachment relationship
- Only truly time-based items (future audio track) would be independent

## 🎯 Implementation Priority

1. **High**: Fix wardrobe service method name ✅ DONE
2. **High**: Move asset rendering from separate track into scene blocks
3. **High**: Convert wardrobe to scene badges instead of track items
4. **Medium**: Add visual styling to reinforce parent-child relationship
5. **Low**: Hide/remove TimelinePlacementTrack component entirely

## Code Changes Required

### Files to Modify:
1. `SortableTimelineScene` - Add placement rendering within scene
2. `Timeline.jsx` - Remove TimelinePlacementTrack, add badge rendering
3. `Timeline.css` - Add styles for inline asset badges
4. `TimelineInspectorPanel.jsx` - Already works correctly as control surface

### Files to Keep:
- `timelinePlacementsService.js` - Backend API is correct
- `timelinePlacementsController.js` - Scene-attached placement logic is correct
- Drag-drop logic in `Timeline.jsx` - Already creates scene-attached placements

## Mental Model Reinforcement

**User's Vision**: "Assets belong to scenes unless explicitly time-based"

**Visual Hierarchy**:
```
┌─────────────────────────────────────┐
│ Scene Block (Primary)               │
│ ─────────────────────────────────── │
│                                     │
│ [Scene content / video preview]     │
│                                     │
│ ─────────────────────────────────── │
│ 📎 Asset 1  👗 Wardrobe  📎 Asset 2│ ← Badges at bottom
└─────────────────────────────────────┘
```

**Interaction**:
- Drag from library → Drop on scene → Badge appears in scene
- Click badge → Inspector opens with controls
- No free-floating placements (unless explicitly time-based audio later)

## Timeline Tracks (Final Architecture)

**Track 1 (Primary)**: Scenes with inline asset/wardrobe badges
**Track 2 (Future)**: Audio only - truly time-based, independent of scenes
**No Track 3**: Wardrobe integrated into scene badges

This keeps the timeline clean and reinforces that assets are scene-children, not timeline-siblings.
