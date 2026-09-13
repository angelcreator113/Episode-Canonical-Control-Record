# 🎨 Visual Scene Composer - Quick Reference

## Essential Tools

```
┌─────────────────────────────────────────────────────────┐
│  VISUAL EDITING TOOLBAR                                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ↖️ Select (V)   ↔️ Resize (R)   ✂️ Remove BG (B)     │
│                                                          │
│  📐 Fit Canvas   ⊹ Center   🗑️ Delete                  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| **Select Tool** | `V` |
| **Resize Tool** | `R` |
| **Remove Background** | `B` |
| **Delete Layer** | `Delete` or `Backspace` |
| **Bring Forward** | `↑` |
| **Send Backward** | `↓` |
| **Undo** | `Ctrl+Z` / `Cmd+Z` |
| **Redo** | `Ctrl+Y` / `Cmd+Y` |
| **Toggle Snap** | Hold `Shift` |

## Canvas Controls

```
Zoom:  25%  |  50%  |  100%  |  200%
Aids:  Grid |  Rulers |  Snap Guides
```

## Layer Transform Controls

### Resize Handles
```
    ⬤───⬤───⬤
    │         │
    ⬤    ✋   ⬤    8 handles for precise resizing
    │         │
    ⬤───⬤───⬤
```

### Inspector Properties
- **Position** (X, Y) - Precise pixel placement
- **Size** (W, H) - Exact dimensions
- **Opacity** (0-100%) - Transparency slider
- **Rotation** (-180° to 180°) - Angle control

## Background Removal

### Requirements:
✅ Image assets only (not videos)  
✅ API key configured  
✅ Processing time: ~2-5 seconds

### Steps:
1. Select image layer
2. Click **✂️ Remove BG** or press `B`
3. Wait for processing
4. Result automatically updates

## Platform Formats

| Platform | Icon | Ratio | Size |
|----------|------|-------|------|
| YouTube | 📺 | 16:9 | 1920×1080 |
| Instagram | 📷 | 1:1 | 1080×1080 |
| IG Story | 📱 | 9:16 | 1080×1920 |
| TikTok | 🎵 | 9:16 | 1080×1920 |
| Twitter | 🐦 | 16:9 | 1280×720 |

## Quick Workflow

```
1. Select Format (YouTube, Instagram, etc.)
   ↓
2. Add Content (Scenes, Assets, Wardrobe)
   ↓
3. Arrange Layers (Drag & Position)
   ↓
4. Apply Effects (Remove BG, Opacity, Rotation)
   ↓
5. Save & Export
```

## Pro Tips

💡 **Hold Shift** while dragging to disable snap guides  
💡 Use **numeric inputs** for pixel-perfect positioning  
💡 **Lock layers** (🔒) to prevent accidental changes  
💡 **Hide layers** (👁️) to declutter workspace  
💡 **Background layers** auto-fill entire canvas  
💡 Compositions **auto-save** every 2 seconds

## Snap Guides

Pink lines appear when aligning to:
- Canvas center (horizontal/vertical)
- Canvas edges (all sides)
- Other layers (edges, centers)
- Grid lines (20px intervals)

## Layer Roles

### Scenes
🎬 Primary | 📹 B-Roll | ➡️ Transition | 🎞️ Overlay

### Assets
🖼️ Primary | 🌄 Background | ✨ Overlay | 🎨 Effect

### Wardrobe
👗 Costume | ✨ Overlay | 🎨 Background

---

**Need Help?** See [VIDEO_COMPOSER_GUIDE.md](VIDEO_COMPOSER_GUIDE.md) for detailed documentation.
