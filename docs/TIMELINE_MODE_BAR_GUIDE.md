# Timeline Mode Bar - Quick Reference

## What's New

The timeline now uses a **mode-based interface** with a tool dock instead of multiple competing panels.

## Mode Bar (Left Edge - 72px)

### Available Modes

1. **📦 Assets Mode**
   - Browse episode assets
   - Drag assets to timeline
   - Filter by folder and type
   - Currently active by default

2. **👗 Wardrobe Mode**
   - Track outfit continuity across scenes
   - View wardrobe by character
   - Coming soon

3. **🎤 Voice & Audio Mode**
   - Add narration tracks
   - Audio effects and mixing
   - Coming soon

4. **✨ Effects Mode**
   - Visual effects library
   - Transitions and filters
   - Animations
   - Coming soon

5. **⚙️ Properties Mode**
   - Edit selected scene properties
   - Edit selected placement properties
   - Timing and positioning controls
   - Active when something is selected

## How to Use

### Switching Modes
- **Click a mode button** to switch to that mode
- The contextual panel changes to show relevant tools
- Active mode is highlighted in blue

### Toggling the Panel
- **Click the active mode again** to hide the panel
- **Click the ◀/▶ button** at bottom to toggle
- Timeline expands when panel is hidden

### Keyboard Shortcuts
- Numbers `1-5`: Switch to mode (Assets, Wardrobe, Voice, Effects, Properties)
- `` ` `` (backtick): Toggle panel visibility
- `Tab`: Cycle through modes

## Context Panel (320px)

The context panel content changes based on the active mode:

### Assets Mode
- **Tabs**: Assets | Wardrobe
- **Search**: Filter by name
- **Folders**: Organized by type (Promo, Overlays, etc.)
- **Drag & Drop**: Drag items to timeline

### Properties Mode
- **Scene Info**: When a scene is selected
  - Title, type, duration
  - Scene order and metadata
- **Placement Info**: When a placement is selected
  - Asset/wardrobe details
  - Timing (start, duration, end)
  - Attachment point and offset
  - Visual role
  - Delete button

### Future Modes
- Wardrobe, Voice, Effects will have dedicated UIs
- Placeholder screens shown for now

## Benefits

✅ **Focus**: One task at a time  
✅ **Clarity**: Explicit modes instead of hidden panels  
✅ **Space**: Timeline gets more room  
✅ **Scalability**: Easy to add new modes (Music, Captions, etc.)  
✅ **Muscle Memory**: Modes stay in same position  

## Layout Structure

```
┌───┬──────────┬─────────────────────────────────────┐
│   │          │      Preview (Collapsible)          │
│ M │          ├─────────────────────────────────────┤
│ o │ Context  │                                     │
│ d │ Panel    │         Timeline Editor             │
│ e │          │                                     │
│   │ (320px)  │    - Scene track (prominent)        │
│ B │          │    - Asset lanes (visible)          │
│ a │ Changes  │    - Zoom & scrubbing               │
│ r │ based on │    - Collapsible groups             │
│   │ mode     │                                     │
│ 72│          │                                     │
│ px│          │                                     │
└───┴──────────┴─────────────────────────────────────┘
```

## Design Philosophy

**Before**: Multiple panels competing for attention  
**After**: One mode, one panel, one focus

This matches professional video editors like:
- **CapCut**: Left tool dock with mode switching
- **Premiere Pro**: Panel-based workspaces
- **DaVinci Resolve**: Page-based editing

The timeline remains scene-first and composition-focused - this is purely a UI improvement for navigating tools as episodes get more complex.
