# 🎨 Visual Scene Composer - User Guide

## Overview
Your Video Composition Workspace now includes a **Photoshop-style visual editing toolkit** for creating professional video compositions with layered elements.

---

## ✨ New Features Implemented

### 1. **Visual Editing Toolbar**
Located at the top of the canvas, this toolbar provides quick access to editing tools:

#### Tools Available:
- **✅ Select & Move (V)** - Select and drag layers around the canvas
- **↔️ Resize & Scale (R)** - Resize layers with visual handles
- **✂️ Remove Background (B)** - AI-powered background removal for images

#### Quick Actions (when layer selected):
- **📐 Fit Canvas** - Resize layer to fill the entire canvas
- **⊹ Center** - Center the selected layer on the canvas
- **🗑️ Delete** - Remove the selected layer

---

### 2. **Background Removal Integration**

#### How to Remove Backgrounds:
1. Select an **image asset** layer on the canvas
2. Click the **✂️ Remove BG** button in the toolbar (or press `B`)
3. Wait for processing (uses your existing RunwayML/RemoveBG API)
4. The processed image with transparent background will replace the original

#### Requirements:
- Only works on **image assets** (not videos or scenes)
- Requires API keys configured: `RUNWAY_ML_API_KEY` or `REMOVEBG_API_KEY`
- Processing typically takes 2-5 seconds

---

### 3. **Enhanced Layer Controls**

#### Resize Handles:
- **8 resize handles** appear when a layer is selected
- **Corner handles** (⭘) - Resize proportionally
- **Edge handles** (▬) - Resize in one direction
- Handles have **hover animations** for better visibility

#### Transform Controls:
- **Position (X, Y)** - Move layer precisely with numeric inputs
- **Size (W, H)** - Set exact dimensions
- **Opacity (0-100%)** - Control transparency with slider
- **Rotation (-180° to 180°)** - Rotate layer with slider
- **Layer Order** - Bring forward/send backward buttons

#### Visual Feedback:
- **Real-time position overlay** (bottom-right) shows:
  - Current position (X, Y)
  - Current size (Width × Height)
- **Smart snap guides** (pink lines) appear when:
  - Aligning to canvas center
  - Aligning to canvas edges
  - Aligning to other layers
  - Snapping to grid (20px)

---

## ⌨️ Keyboard Shortcuts

### Tool Selection:
- **V** - Select & Move tool
- **R** - Resize & Scale tool
- **B** - Remove Background (when image selected)

### Layer Management:
- **Delete / Backspace** - Delete selected layer
- **Arrow Up** - Bring layer forward
- **Arrow Down** - Send layer backward
- **Shift** (hold) - Temporarily disable snap guides

### History:
- **Ctrl/Cmd + Z** - Undo
- **Ctrl/Cmd + Y** (or Ctrl/Cmd + Shift + Z) - Redo

---

## 🎯 Canvas Workspace Features

### Grid & Guides:
- **Grid** - 20px grid for precise alignment (toggle in toolbar)
- **Rulers** - Horizontal & vertical rulers (toggle in toolbar)
- **Snap Guides** - Smart alignment guides (toggle in toolbar)

### Zoom Controls:
- **25%** - Overview zoom
- **50%** - Half size
- **100%** - Actual size
- **200%** - Detail zoom

### Format Selection:
Choose your target platform to set canvas dimensions:
- **📺 YouTube** (16:9) - 1920×1080
- **📷 Instagram** (1:1) - 1080×1080
- **📱 IG Story** (9:16) - 1080×1920
- **🎵 TikTok** (9:16) - 1080×1920
- **🐦 Twitter** (16:9) - 1280×720
- **💼 LinkedIn** (16:9) - 1920×1080
- **👥 Facebook** (16:9) - 1280×720

---

## 🎬 Workflow Example

### Creating a Composition:

1. **Select Format**
   - Choose target platform (YouTube, Instagram, etc.)

2. **Add Content**
   - Click scenes/assets/wardrobe from left panel
   - Assign roles (Primary, Background, Overlay, etc.)

3. **Arrange Layers**
   - Select layers from bottom layer panel
   - Drag to position on canvas
   - Use resize handles to scale
   - Adjust opacity/rotation in right inspector panel

4. **Apply Effects**
   - Select image assets
   - Click **Remove BG** to remove backgrounds
   - Fine-tune positioning with numeric inputs

5. **Organize**
   - Use **Fit Canvas** for background layers
   - Use **Center** for logos/overlays
   - Lock layers (🔒) to prevent accidental changes
   - Hide layers (👁️) to temporarily remove from view

6. **Save & Export**
   - Auto-saves every 2 seconds
   - Click **Save** to manually save
   - Click **Open in Timeline** for final video editing

---

## 🎨 Layer Roles & Purpose

### Scene Roles:
- **🎬 Primary Content** - Main video content
- **📹 B-Roll** - Supporting footage
- **➡️ Transition** - Scene transitions
- **🎞️ Video Overlay** - Overlay video clips

### Asset Roles:
- **🖼️ Primary Visual** - Main visual element
- **🌄 Background** - Background layer (fills canvas)
- **✨ Overlay** - Foreground overlay (logos, graphics)
- **🎨 Effect/Filter** - Visual effects

### Wardrobe Roles:
- **👗 Costume Reference** - Character costume/outfit
- **✨ Wardrobe Overlay** - Overlay wardrobe items
- **🎨 Background Item** - Background wardrobe elements

---

## 💡 Pro Tips

### Layer Management:
- **Background layers** automatically fill the entire canvas
- **Primary layers** are locked by default to prevent accidental moves
- **Overlay layers** support full transform controls

### Precision Editing:
- Use **numeric inputs** in inspector panel for pixel-perfect positioning
- Hold **Shift** while dragging to disable snap guides for free positioning
- Use **grid** and **rulers** for consistent spacing

### Performance:
- Hide layers you're not working on to improve performance
- Lock layers to prevent accidental changes
- Use layer order buttons instead of dragging in layer panel

### Background Removal:
- Works best on images with clear subjects
- Processing happens on the server (no local resources used)
- Original image is preserved; processed version is stored separately

---

## 🔧 Technical Details

### API Integration:
The background removal feature connects to:
- **POST** `/api/v1/assets/:assetId/process-background`
- Uses existing `RunwayMLService` or `RemoveBG` service
- Results are cached with S3 storage

### Transform Storage:
Layer transforms are stored in composition data:
```javascript
{
  x: number,        // Position X (pixels)
  y: number,        // Position Y (pixels)
  width: number,    // Width (pixels)
  height: number,   // Height (pixels)
  scale: number,    // Scale multiplier
  opacity: number,  // 0-100
  rotation: number, // -180 to 180 degrees
  visible: boolean, // Show/hide
  locked: boolean,  // Lock/unlock
  zIndex: number    // Layer order
}
```

### Canvas Rendering:
- All layers rendered with CSS transforms for performance
- Hardware acceleration enabled
- Real-time visual feedback during drag/resize operations

---

## 🐛 Troubleshooting

### Background Removal Not Working:
- ✅ Ensure API keys are configured in `.env`
- ✅ Check that selected layer is an **image asset** (not video)
- ✅ Verify network connection to API endpoint
- ✅ Check browser console for error messages

### Layer Not Moving:
- ✅ Check if layer is **locked** (🔒 icon visible)
- ✅ Ensure layer is **visible** (not hidden)
- ✅ Background/Primary layers may have restricted movement

### Transform Not Saving:
- ✅ Wait for auto-save indicator (saves every 2 seconds)
- ✅ Click manual **Save** button if needed
- ✅ Check browser console for save errors

---

## 📚 Related Documentation

- [Timeline.css](frontend/src/components/Scenes/Timeline.css) - Timeline styling
- [VideoCompositionWorkspace.jsx](frontend/src/components/VideoCompositionWorkspace.jsx) - Main component
- [AssetService.js](src/services/AssetService.js) - Background removal service
- [RunwayMLService.js](src/services/RunwayMLService.js) - AI processing service

---

## 🚀 Future Enhancements

Potential additions to consider:
- [ ] Crop tool with aspect ratio presets
- [ ] Text layer support with font controls
- [ ] Blur/shadow effects panel
- [ ] Layer blending modes
- [ ] Animation timeline for layer movements
- [ ] Template library for quick starts
- [ ] Batch background removal
- [ ] Export preview with rendering

---

**Last Updated:** February 3, 2026  
**Version:** 1.0.0  
**Status:** ✅ Production Ready
