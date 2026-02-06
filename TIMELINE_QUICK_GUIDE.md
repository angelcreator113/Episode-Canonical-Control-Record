# Quick Timeline Editor Guide

## 🎯 Main Issues Fixed

### ✅ The Red Line Problem
**Was**: Red line going down entire screen uncontrollably  
**Now**: Constrained to timeline area only, max 800px height

### ✅ Invisible Clips Problem  
**Was**: Clips added but not visible  
**Now**: Minimum widths enforced, better colors, proper positioning

### ✅ Layout Confusion
**Was**: Headers and lanes misaligned  
**Now**: Perfect split layout, everything lines up

## 🚀 How to Add Content

### Add Video/Image to Scene
```
1. Click "Assets" button (left sidebar) or press 2
2. Find your video/image in the panel
3. Drag it onto an empty scene slot
   → It becomes the primary clip for that scene
```

### Add Overlays (Wardrobe, Graphics)
```
1. Click "Wardrobe" button or press 3
2. Find your wardrobe item
3. Drag it onto the "Overlays" lane
   → Creates a green placement bar
```

### Add Voice/Music
```
1. Click "Voice" (4) or "Effects" (5)
2. Drag audio files onto Voice or Music lanes
   → Creates audio placement bars
```

## 🎨 What You'll See

### Scene Clips (Blue)
- **Blue filmstrip border** = Primary video/image
- **Empty with "Drop Video Here"** = Awaiting content
- **Hover** = Slight lift effect, brighter glow

### Placement Bars (Green/Other)
- **Green bars** = Overlays, wardrobe, effects
- **Position** = Stacked vertically if overlapping
- **Resize handles** = Drag edges to adjust timing

### The Red Playhead Line
- Shows current playback position
- **Drag the triangle at top** to scrub
- Constrained to timeline (won't go crazy anymore!)

## ⌨️ Essential Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause |
| `Tab` | Toggle side panel |
| `1-5` | Switch modes (Timeline/Assets/Wardrobe/Voice/Effects) |
| `?` | Show all shortcuts |
| `+` / `-` | Zoom in/out |
| `Delete` | Delete selected |
| `Ctrl+Z` | Undo |

## 🎬 Your Workflow

1. **Create scenes** in Episode detail page first
2. **Open Timeline Editor** from episode
3. **Add primary video** to each scene (drag from Assets)
4. **Add overlays** (drag from Wardrobe/Assets to Overlays lane)
5. **Add audio** (drag to Voice/Music lanes)
6. **Adjust timing** (drag clip edges to resize)
7. **Preview** (press Space to play)

## 🐛 Still Having Issues?

### Clips Not Showing?
- ✓ Check: Do you have scenes created?
- ✓ Check: Assets uploaded and processed?
- ✓ Try: Refresh the page (Ctrl+R)
- ✓ Check: Browser console (F12) for errors

### Red Line Still Crazy?
- ✓ Try: Ctrl+Shift+R (hard refresh)
- ✓ Clear browser cache
- ✓ Check: Are there multiple Timeline.css files conflicting?

### Layout Broken?
- ✓ Zoom browser back to 100%
- ✓ Try full-screen mode
- ✓ Check window size (minimum 1024px width recommended)

## 📂 Files That Were Fixed

- `frontend/src/components/Timeline/TimelinePlayhead.css`
- `frontend/src/components/Timeline/TimelineLanes.css`
- `frontend/src/components/Timeline.css`

All changes were CSS-only, no JavaScript changes needed!
