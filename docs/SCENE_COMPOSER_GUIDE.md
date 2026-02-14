# Scene Composer - Feature Quick Reference

## 🎬 Main Interface Areas

### 📍 Header (Top Section)
- **Left**: App logo and title
- **Center**: Scene selector dropdown (create/select/rename scenes)
- **Right bottom**: Canvas preset selector and dimensions (1920×1080)
- **Refresh button**: Reload current scene

### 📚 Layer Panel (Left Side)
- **5 layers** organized by type: Background → Raw Footage → Assets → Text → Audio
- **Features**:
  - 👁️ Eye icon: Show/hide layer
  - 🔢 Asset count badge: How many items in layer
  - Hover to see asset thumbnails (6×6px previews)
  - Click to select layer
  - Opacity slider appears on hover

### 🎨 Canvas (Center)
- Main composition editing area
- Features:
  - Drag assets to move them
  - Blue corner circles (4): Resize handles
  - Grid overlay (toggle with button)
  - Snap to 50px grid (toggle with button)
  - Zoom in/out controls

### 📋 Right Panel (Properties)
- **Sections**:
  - **Scene Metadata** (collapsible): Name, notes, recording settings
  - **Canvas Specs** (collapsible): Dimensions, safe zones
  - **Assets** (scrollable): All available assets with thumbnails
  - **Properties** (bottom half): Edit selected asset properties
- **Asset Filter buttons**: All / Img / Vid
- **Status footer**: Shows current editing state

### ⏱️ Timeline (Bottom)
- Visual timeline for clip timing
- Drag clip edges to trim
- Set In/Out points
- Playhead for scrubbing

---

## 🎯 Common Tasks

### Create a New Scene
1. Click scene dropdown at top (shows current scene name)
2. Click "**+ Create New Scene**" button at bottom of dropdown
3. New scene appears with default name (e.g., "Scene 2")
4. Optional: Click pencil ✏️ icon to rename immediately

### Rename a Scene
1. Click scene dropdown at top
2. Find the scene you want to rename
3. Click the pencil ✏️ icon next to scene name
4. Type new name
5. Press **Enter** to save or **Escape** to cancel

### Add Assets to Canvas
1. Find asset in 📁 **Assets** panel (right side, bottom)
2. **Drag and drop** onto canvas
3. Asset appears in Raw Footage layer (Layer 2)
4. Click and drag to position on canvas

### Move Asset Between Layers
1. Click layer in **📚 Layers** panel (left)
2. Asset's layer now selected
3. Drag asset from 📁 Assets panel to desired layer
4. Asset moves to new layer

### Edit Asset Position/Size
1. Click asset on canvas to select it
2. Use transform handles (blue circles) to resize
3. Or enter exact values in **📐 Canvas Controls** section (right panel):
   - X, Y: Position
   - W, H: Width/Height
   - Rotation: Degrees (0-360°)
   - Scale X/Y: Size multiplier

### Set Asset Timing
1. Click asset to select
2. Scroll down in right panel to **Timing** section
3. Set **Start Time** and **End Time** (in seconds)
4. Or drag clip edges in timeline at bottom

### Show/Hide Layers
1. In 📚 **Layers** panel, click 👁️ icon
2. Layer visibility toggles
3. Hidden layers appear dimmed (60% opacity)

### Adjust Layer Opacity
1. In 📚 **Layers** panel, hover over layer
2. Opacity slider appears
3. Drag to adjust (0-100%)
4. Percentage displays on right side

---

## 🎮 Keyboard Shortcuts

### Layer Selection
- **1-5**: Select layers by number
- **V**: Toggle selected layer visibility
- **L**: Toggle selected layer lock

### Asset Controls
- **Delete**: Remove selected asset
- **Ctrl+D**: Duplicate asset
- **← → ↑ ↓**: Move asset 1px
- **Shift + ← → ↑ ↓**: Move asset 10px
- **Escape**: Deselect all

### Canvas
- **+**: Zoom in
- **-**: Zoom out
- **0**: Reset zoom to 100%
- **Space + Drag**: Pan canvas (scroll)

### Scene Editing
- **Enter**: Save scene name (while editing)
- **Escape**: Cancel scene name edit

---

## 💡 Tips & Tricks

### 🔍 Better Visibility
- Use layer **show/hide** (👁️) to focus on specific layers
- Adjust **opacity** to see through layers
- Toggle **grid** on/off for alignment

### 🎨 Asset Organization
- Use **filters** (All/Img/Vid) to find assets quickly
- Drag from thumbnails in 📁 panel to canvas
- Hover over layers to see asset previews

### ⚡ Quick Actions
- **Right-click** on asset → Remove (with confirmation)
- **Hover** on layers → See asset thumbnails
- **Click** scene name → Dropdown opens

### 📐 Precise Positioning
- Enter exact X,Y values for pixel-perfect placement
- Enable **Snap to Grid** for alignment
- Use **Safe Zones** info in Canvas Specs

### 🎯 Help & Learning
- Click ❓ button (bottom-left) for **Quick Start Guide**
- Click ⌨️ button (bottom-right) for **Keyboard Shortcuts**
- Hover on controls for **tooltips**

---

## 🚀 Getting Started in 5 Minutes

1. **Create Scene** (1 min)
   - Click scene dropdown → Create New Scene

2. **Add Assets** (1 min)
   - Drag assets from 📁 panel to canvas
   - Watch them appear in Raw Footage layer

3. **Position Assets** (1 min)
   - Click asset on canvas
   - Drag to move, blue circles to resize
   - Or enter exact values (X, Y, W, H)

4. **Set Timing** (1 min)
   - Select asset
   - Set Start/End times in right panel
   - Or drag edges in timeline

5. **Organize** (1 min)
   - Move assets to appropriate layers
   - Adjust opacity and visibility as needed
   - Save automatically!

---

## ✨ Visual Indicators

| Indicator | Meaning |
|-----------|---------|
| 🔵 Blue ring | Selected layer/asset |
| 👁️ Eye icon | Layer is visible |
| 🚫 Eye icon | Layer is hidden |
| 🎨 Rainbow bg | Dragging asset over layer |
| 📊 Badge | Number of assets in layer |
| ⚫ Blue dot | Asset currently being edited |
| ⚪ Gray dot | No asset selected (Ready) |

---

## 🆘 Troubleshooting

### Asset doesn't appear on canvas
- Check if layer is visible (👁️ icon)
- Check layer opacity (should be > 0%)
- Try re-dragging asset from 📁 panel

### Can't see thumbnails
- Hover over layer in 📚 panel
- Thumbnails only appear on hover
- Assets must have preview images

### Scene not saving
- All changes save automatically
- Check status footer (bottom-right)
- Try refreshing browser if stuck

### Keyboard shortcuts not working
- Make sure canvas is focused (click canvas first)
- Some shortcuts may be browser-specific
- Check ⌨️ panel for full list

---

**Pro Tip**: Use the ❓ Quick Start Guide for interactive walkthrough!

