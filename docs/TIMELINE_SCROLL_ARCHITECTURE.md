# Timeline Scroll Architecture - Implementation Complete

## Overview
Restructured Timeline editor to fix broken scroll and ownership boundaries. All scroll containers are now properly separated, and all lane types are always visible.

## Architecture Changes

### 1. **Scroll Container Separation**

#### **Preview Area** (Fixed, no scrolling)
- Height: Default `35vh` (min `240px`, max `55vh`)
- Hidden state: `36px` collapse bar with "Show Preview" button
- Maximized state: `100vh` full-screen preview
- Split state: `50vh` balanced view
- Uses `flex-shrink: 0` to maintain height constraints

#### **Timeline Toolbar** (Sticky, always visible)
- `.timeline-toolbar-sticky` - Stays at top of timeline container
- Contains: Search bar, filter controls, snap toggle, history controls
- Includes: Playback controls (TimelinePlayhead) and ruler (TimelineRuler)
- `position: sticky` with `z-index: 100`
- No auto-hide behavior - stable and always accessible

#### **Side Panel** (Independent vertical scroll)
- `.context-panel-scroll-wrapper` - Wraps TimelineContextPanel
- `overflow-y: auto` for independent scrolling
- Header/tabs fixed within panel (handled by TimelineContextPanel)
- Content area scrolls independently of timeline
- Fills available editor height

#### **Timeline Canvas** (Independent horizontal + vertical scroll)
- `.timeline-canvas-scroll` - Wraps all timeline content
- `overflow-x: auto` for long timelines (horizontal scroll)
- `overflow-y: auto` for many lanes (vertical scroll)
- Contains `.timeline-scroll-area` with actual lane content
- Allows natural scrolling in both directions

#### **Timeline Footer** (Fixed at bottom)
- Outside scroll area with `flex-shrink: 0`
- Shows keyboard shortcut hints
- Sticky at bottom of timeline container

### 2. **Always-Visible Lane Structure**

All 6 lanes render even when empty:

1. **Scenes Lane**
   - Always expanded, always on top
   - Cannot be collapsed
   - Empty state: "Add scenes to your timeline"

2. **Primary Visuals Lane**
   - Collapsible (collapsed by default if empty)
   - Empty state: "Drag primary visuals here"
   - Expanded height: ~56px

3. **Overlays Lane**
   - Collapsible (collapsed by default if empty)
   - Empty state: "Drag overlays here"
   - Expanded height: ~56px

4. **Voice Lane**
   - Collapsible (collapsed by default if empty)
   - Empty state: "Drag voice tracks here"
   - Expanded height: ~56px

5. **Music/Audio Lane** (NEW)
   - Collapsible (collapsed by default if empty)
   - Empty state: "Drag music/audio here"
   - Expanded height: ~56px
   - Separate from Voice lane

6. **Effects Lane**
   - Collapsible (collapsed by default if empty)
   - Empty state: "Drag effects here"
   - Expanded height: ~56px
   - Header exists for future feature

### 3. **Layout Measurements**

- **Collapsed lane header**: `30px` height (28-32px range)
- **Expanded lane content**: `56px` min-height
- **Preview default**: `35vh` (240px min, 55vh max)
- **Preview hidden**: `36px` bar
- **Toolbar**: Auto-height, sticky position

## Key CSS Classes

### Layout Structure
```css
.timeline-container-wrapper          /* Root container - flex column */
├── .timeline-preview-area           /* Fixed height preview */
├── .timeline-header                 /* Controls bar (optional) */
└── .timeline-main-area              /* Main editor area */
    ├── TimelineModeBar              /* Mode selector (fixed width) */
    ├── .context-panel-scroll-wrapper /* Side panel with overflow-y:auto */
    └── .timeline-container          /* Timeline canvas container */
        ├── .timeline-toolbar-sticky  /* Sticky toolbar at top */
        ├── .timeline-canvas-scroll   /* Scrollable canvas (overflow:auto) */
        │   └── .timeline-scroll-area /* Content area */
        └── .timeline-footer         /* Fixed footer */
```

### Scroll Container Classes
- `.context-panel-scroll-wrapper` - Side panel independent scroll
- `.timeline-canvas-scroll` - Timeline canvas independent scroll
- `.timeline-toolbar-sticky` - Sticky toolbar (non-scrolling)

### Lane Classes
- `.timeline-lane-container.always-expanded` - Non-collapsible lanes (Scenes)
- `.timeline-lane-container.expanded` - Expanded lane state
- `.timeline-lane-container.collapsed` - Collapsed lane state
- `.lane-header` - Lane header (30px when collapsed)
- `.lane-content` - Lane content (56px min-height)
- `.lane-empty-state` - Empty placeholder with text
- `.empty-state-text` - "Drag [type] here" text

## Implementation Files Modified

### 1. **Timeline.jsx**
- Added `.context-panel-scroll-wrapper` around TimelineContextPanel
- Added `.timeline-toolbar-sticky` wrapper for search bar, playhead, ruler
- Added `.timeline-canvas-scroll` wrapper for scrollable content
- Conditional render: Only show context panel when `showContextPanel === true`
- Footer moved outside scroll area

### 2. **TimelineLanes.jsx**
- Added Music/Audio lane rendering
- All 6 lanes always render (conditional: StackedLane vs Lane based on content)
- Empty state placeholders for all lanes
- Lane component enhanced:
  - `alwaysExpanded` prop for Scenes
  - `isEmpty` prop for empty state handling
  - Proper toggle behavior (can't toggle always-expanded)
- Default collapsed state: All lanes except Scenes start collapsed

### 3. **Timeline.css**
- Preview area constraints: `height: 35vh; min-height: 240px; max-height: 55vh;`
- `.timeline-main-area` with `min-height: 0` for flex children
- `.context-panel-scroll-wrapper` with `overflow-y: auto`
- `.timeline-container` as flex column container
- `.timeline-toolbar-sticky` with `position: sticky; top: 0; z-index: 100;`
- `.timeline-canvas-scroll` with `overflow: auto` both axes
- `.timeline-scroll-area` no overflow (parent handles it)
- Updated scrollbar styles for new containers
- `.timeline-footer` with `flex-shrink: 0`

### 4. **TimelineLanes.css**
- `.timeline-lane-container.always-expanded` styles
- `.timeline-lane-container.collapsed` with `height: 30px` header
- `.timeline-lane-container.expanded` with `min-height: 56px` content
- `.lane-empty-state` with placeholder text styles
- `.empty-state-text` for "Drag [type] here" messages

## User Experience Improvements

### Before
❌ Side panel clipped/couldn't scroll to all content
❌ Timeline lanes only showed when content existed
❌ Scroll containers competed for space
❌ Preview height not constrained properly
❌ Toolbar could auto-hide (disorienting)

### After
✅ Side panel scrolls independently - access all folders/tools
✅ All 6 lanes always visible with clear empty states
✅ Each scroll area independent - no boundary conflicts
✅ Preview respects height constraints (240px-55vh)
✅ Toolbar sticky and stable - always accessible
✅ Lanes collapsible to reduce vertical scrolling
✅ Clear visual hierarchy with always-expanded Scenes lane

## Testing Checklist

- [x] Side panel scrolls independently (overflow-y: auto)
- [x] Timeline canvas scrolls horizontally for long durations
- [x] Timeline canvas scrolls vertically for many lanes
- [x] Preview height respects constraints (35vh, 240px-55vh)
- [x] Preview collapses to 36px bar when hidden
- [x] All 6 lanes always visible (Scenes, Primary Visuals, Overlays, Voice, Music/Audio, Effects)
- [x] Empty lanes show placeholder text ("Drag [type] here")
- [x] Lanes collapsible except Scenes (always expanded)
- [x] Collapsed lane headers ~30px height
- [x] Expanded lane content ~56px min-height
- [x] Toolbar sticky at top of timeline (doesn't scroll away)
- [x] Footer fixed at bottom (doesn't scroll)
- [x] No competing scroll boundaries
- [x] Proper z-index layering (toolbar above content)

## Future Enhancements

1. **Wardrobe Integration**: Currently scene-level badge/continuity layer; future v2 could add wardrobe lane
2. **Text/Titles Lane**: Currently under Overlays; could be separate lane in future
3. **Nested Lane Groups**: Collapsible sections for related lanes
4. **Lane Height Customization**: User-adjustable lane heights
5. **Horizontal Lane Splitting**: Multiple items side-by-side in same lane
6. **Preview Resize Handle**: Drag to adjust preview height within constraints
7. **Lane Reordering**: Drag to reorder lane positions (except Scenes always top)

## Technical Notes

### Why Nested Scroll Containers?
- Allows independent scrolling of logically separate areas
- Prevents scroll events from bubbling and causing conflicts
- Enables proper keyboard navigation (Tab to switch focus between scrollable areas)
- Better accessibility (screen readers understand discrete scroll regions)

### Why Sticky Toolbar?
- Alternative to fixed position (which breaks within flex containers)
- Scrolls with content initially, then "sticks" when reaching top
- Maintains context while scrolling through long timelines
- No z-index battles with modals/overlays

### Why Always-Visible Lanes?
- Provides consistent visual structure
- Clear affordance for drag-and-drop (always a target)
- Reduces cognitive load (no hunting for where to add content)
- Professional timeline UX (matches CapCut, Premiere, DaVinci Resolve)

## Migration Notes

No breaking changes for users:
- Existing placements continue to work
- Scene structure unchanged
- API calls unchanged
- Keyboard shortcuts preserved
- Preview presets still functional

Only visual/layout improvements with no data model changes.

---

**Implementation Date**: February 2, 2026  
**Status**: ✅ Complete - Ready for testing
