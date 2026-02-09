# 🎬 Canvas-First Scene Composer - Quick Start

## What Changed?

The Scene Composer was completely redesigned with a **canvas-first layout**:

### Old Layout
- Canvas in center (small)
- Right panel with everything
- Layer panel on left
- Lots of panels to manage

### New Layout
- **Canvas dominates** (70% of screen) ⭐
- **Media Bin** - Drawer (left, on-demand)
- **Inspector** - Drawer (right, on-demand)
- **Timeline** - Horizontal (bottom, collapsible)
- **Header** - Minimal with quick controls

---

## 🎯 Quick Workflow

### 1️⃣ Add Assets
```
Click 🖼️ button → Media Bin opens → Drag asset to canvas → Done!
```

### 2️⃣ Position Assets
```
Drag on canvas to move | Use blue corners to resize | Snap-to-grid enabled
```

### 3️⃣ Edit Properties
```
Click asset → Inspector opens → Change timing/opacity/rotation → Click X to close
```

### 4️⃣ Timeline Management
```
See all assets in timeline → Click to select → Drag to trim (if available)
```

---

## 🎮 Controls

### Header Controls (Top)
| Button | Function |
|--------|----------|
| 🎬 Dropdown | Select/create scenes |
| 🖼️ | Open Media Bin (backgrounds) |
| 🎬 | Open Media Bin (footage) |
| ✍️ | Open Media Bin (text/assets) |
| Preset ▼ | Select canvas size |
| 🔲 Snap | Toggle snap-to-grid |
| Grid | Toggle grid display |
| − / + | Zoom in/out |

### Canvas
- **Drag asset** = Move on canvas
- **Blue corner circles** = Resize
- **Click asset** = Select (opens Inspector)
- **Scroll** = Pan canvas (if space key)
- **+ / −** = Zoom

### Media Bin (Left Drawer)
- **All / Images / Videos** = Filter assets
- **Drag asset** = Add to canvas
- **X button** = Close drawer

### Inspector (Right Drawer)
- **Start Time** = When asset appears
- **End Time** = When asset ends
- **Duration** = Calculated automatically
- **Opacity slider** = Transparency (0-100%)
- **Rotation slider** = Spin asset (0-360°)
- **🗑️ Remove** = Delete asset

### Timeline (Bottom)
- **Colored blocks** = Assets with timing
- **Click block** = Select asset
- **▼ button** = Minimize timeline
- **▲ button** = Expand timeline

---

## 💡 Pro Tips

### Quick Asset Addition
1. Click 🖼️ button in header
2. Drag multiple assets to canvas
3. Media Bin stays open
4. Close with X when done

### Precise Positioning
1. Canvas has snap-to-grid (🔲)
2. Drag to align to 50px grid
3. Or turn off snap for pixel-perfect
4. Use Inspector for exact values

### Efficient Workflow
1. Open Media Bin once (stays open)
2. Drag all assets
3. Use Inspector to edit one at a time
4. Timeline shows everything at once

### Timeline View
1. See all assets visually
2. Colors match layer types
3. Click to jump to asset
4. Minimize when not editing timing

---

## 🎨 Visual Indicators

| Icon/Color | Meaning |
|-----------|---------|
| 🖼️ | Background images |
| 🎬 | Raw footage/video |
| ✍️ | Text and assets |
| 🎨 Colors | Layer types (green=assets, blue=text, orange=footage) |
| Purple ring | Selected on canvas |
| Blue block | Selected in timeline |
| Gray background | Minimized section |

---

## 🆘 Common Tasks

### Create a New Scene
```
1. Click scene dropdown (top-left)
2. Click "+ Create New Scene"
3. Name appears in dropdown
4. Click to select it
```

### Rename a Scene
```
1. Click scene dropdown
2. Click pencil icon next to name
3. Type new name
4. Press Enter to save
```

### Add Asset to Specific Layer
```
1. Click 🖼️ to open Media Bin
2. Drag asset to canvas
3. Asset goes to Raw Footage layer by default
4. Drag it to different layer after (if needed)
```

### Set Asset Duration
```
1. Click asset on canvas
2. Inspector opens (right side)
3. Set Start Time and End Time
4. Duration updates automatically
5. Close Inspector with X
```

### Zoom Canvas
```
Use header controls: − to zoom out, + to zoom out
Or keyboard: + key to zoom in, − key to zoom out
Or scroll wheel while holding Space
```

### Hide Timeline
```
Click ▼ button in timeline header
Click ▲ button to expand again
```

---

## ⌨️ Keyboard Shortcuts

| Keys | Function |
|------|----------|
| 1-5 | Select layer 1-5 |
| V | Toggle layer visibility |
| Delete | Remove selected asset |
| Ctrl+D | Duplicate asset |
| ← → ↑ ↓ | Move asset (1px) |
| Shift + arrows | Move asset (10px) |
| Escape | Deselect |
| + | Zoom in |
| − | Zoom out |
| 0 | Reset zoom |

---

## 🎬 Layout Diagram

```
┌─────────────────────────────────────────────┐
│ Scene | 🖼️ 🎬 ✍️ | Preset | 🔲 Grid | − + │  Header (12px)
├─────────────────────────────────────────────┤
│                                             │
│                                             │
│            CANVAS (70% of screen)           │  Click to select
│            (drag assets here)               │  Blue rings = selected
│                                             │
│                                             │
├─────────────────────────────────────────────┤
│ ⏱️ Timeline (shows all assets)    [▼ to minimize] │
│ Layer 2: [========] [=====]                 │
│ Layer 3: [===] [=====] [==]                 │
└─────────────────────────────────────────────┘

[Media Bin]  CANVAS  [Inspector]
  (left)    (main)      (right)
  (drawer)             (drawer)
```

---

## 📱 Browser Tips

- **Full screen**: Press F11 for fullscreen editing
- **Zoom**: Ctrl++ to zoom browser (if text too small)
- **Refresh**: If stuck, press Ctrl+R to reload
- **DevTools**: F12 to open console if error

---

## ⚡ Performance Tips

- Use snap-to-grid for faster alignment
- Minimize timeline when not adjusting timing
- Close Media Bin when not adding assets
- Use keyboard shortcuts for faster workflow
- Grid can be turned off if slowing down rendering

---

## 🐛 Troubleshooting

### Asset Won't Drag
- Make sure Media Bin is open
- Click asset thumbnail in Media Bin (not just hover)
- Drag directly to canvas

### Can't See Asset Properties
- Click asset on canvas
- Inspector should open on right side
- If not opening, try double-clicking

### Timeline Looks Wrong
- Click ▼ to minimize, then ▲ to expand
- May need to scroll in timeline
- Layer colors should match type icons

### Zoom Not Working
- Check if zoom buttons are visible in header
- Try +/− keys on keyboard
- Or use mouse scroll while holding Space

---

## ✨ What's Better

| Item | Before | Now |
|------|--------|-----|
| Canvas size | Small | **Huge!** |
| Editing focus | Scattered | Canvas-focused |
| Quick access | Hidden | Header buttons |
| Drawers | Always open | On-demand |
| Timeline | Vertical | Horizontal |
| Workflow | Many clicks | Fewer clicks |
| Professional | Good | **Excellent!** |

---

## 🎓 First-Time Setup

1. **Open Scene Composer** (Scene Composer tab)
2. **Initialize Layers** (if needed - big blue button)
3. **Click 🖼️** to open Media Bin
4. **Drag an asset** to canvas
5. **Click asset** on canvas to select
6. **Edit in Inspector** (right side)
7. **Close Inspector** with X
8. **Add more assets** or close Media Bin
9. **View in timeline** (bottom)

Done! You're editing! 🎉

---

## 💬 Quick Tips

✅ **Canvas is king** - Everything revolves around it
✅ **Drawers are optional** - Open only when needed
✅ **Timeline is visual** - See all assets at once
✅ **Shortcuts save time** - Learn keyboard commands
✅ **Auto-save works** - Changes saved automatically
✅ **Snap helps alignment** - Turn on for faster placement

---

**Status**: Ready to use!
**Questions**: See CANVAS_FIRST_REDESIGN.md for detailed docs

