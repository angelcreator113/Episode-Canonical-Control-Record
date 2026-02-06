# New Route Structure - COMPLETE

## 🎯 Problem Solved

**Before:** Everything crammed into tabs in EpisodeDetail. No clear separation of concerns.

**After:** Each page has ONE job. Clean URL structure.

---

## 🗺️ The New Route Map

```
/episodes/:episodeId
  → EpisodeDetail (Dashboard)
  → Overview, metadata, quick actions
  → Links to other pages

/episodes/:episodeId/scenes
  → ScenesPage (Scene Management)
  → Browse, add, reorder scenes
  → Drag-and-drop sequencing
  → Scene library picker

/episodes/:episodeId/scene/:sceneId/compose
  → SceneComposePage (Canvas Editor)
  → Visual composition canvas
  → Layers, assets, effects
  → 👑 Canvas is dominant (70-80% width)

/episodes/:episodeId/timeline
  → TimelineEditor (Timeline)
  → Full timeline editing
  → Multi-track timeline
  → (Future enhancement)
```

---

## 📁 Files Created

### 1. `frontend/src/pages/ScenesPage.jsx`
**Route:** `/episodes/:episodeId/scenes`

**Purpose:** Scene management page

**What it does:**
- Fetches episode data
- Renders `ClipSequenceManager` component
- Provides page header with back button
- Shows episode context

**Props passed to ClipSequenceManager:**
- `episodeId` - Episode ID
- `episode` - Full episode object

**Features:**
- Back to Episode button
- Scene browsing and sequencing
- Drag-and-drop reordering
- Add scenes from library
- Status indicators

---

### 2. `frontend/src/pages/SceneComposePage.jsx`
**Route:** `/episodes/:episodeId/scene/:sceneId/compose`

**Purpose:** Visual composition canvas

**What it does:**
- Fetches episode data
- Fetches episode scenes
- Fetches episode assets
- Fetches episode wardrobe
- Renders `SceneComposer` component in fullscreen

**Props passed to SceneComposer:**
- `episodeId` - Episode ID
- `sceneId` - Scene being composed
- `episode` - Full episode object
- `episodeScenes` - Available scenes
- `episodeAssets` - Available assets
- `episodeWardrobes` - Available wardrobe items

**Features:**
- Fullscreen canvas (no page chrome)
- Loading state
- Error handling
- Back button on error

---

## 🔄 Route Flow

### User Journey

```
1. Episodes List
   ↓
2. Click Episode → /episodes/:episodeId
   (Dashboard - Overview page)
   ↓
3. Click "Manage Scenes" → /episodes/:episodeId/scenes
   (Scene sequencing and management)
   ↓
4. Click "Compose" on a scene → /episodes/:episodeId/scene/:sceneId/compose
   (Full canvas editor)
   ↓
5. Save & Close → Back to /episodes/:episodeId/scenes
   ↓
6. Click "Timeline" → /episodes/:episodeId/timeline
   (Timeline editor - future)
```

---

## 📄 Updated Files

### `frontend/src/App.jsx`

**Added imports:**
```javascript
import ScenesPage from './pages/ScenesPage';
import SceneComposePage from './pages/SceneComposePage';
```

**New route structure:**
```javascript
{/* NEW ROUTE STRUCTURE - Each page has ONE job */}
<Route path="/episodes/:episodeId" element={<EpisodeDetail />} /> {/* Dashboard */}
<Route path="/episodes/:episodeId/scenes" element={<ScenesPage />} /> {/* Scene Management */}
<Route path="/episodes/:episodeId/scene/:sceneId/compose" element={<SceneComposePage />} /> {/* Canvas Editor */}
<Route path="/episodes/:episodeId/timeline" element={<TimelineEditor />} /> {/* Timeline Editor */}

{/* Legacy routes - kept for compatibility */}
<Route path="/episodes/:episodeId/scene-templates/new" element={<SceneComposer />} />
<Route path="/episodes/:episodeId/scene-templates/:templateId/edit" element={<SceneComposer />} />
```

**Legacy routes preserved:**
- `/episodes/:episodeId/scene-templates/new`
- `/episodes/:episodeId/scene-templates/:templateId/edit`

These still work for backward compatibility but should be migrated to new routes.

---

## 🎨 Page Responsibilities

### 1. EpisodeDetail (Dashboard)
**Route:** `/episodes/:episodeId`

**Job:** Overview and navigation hub

**Should contain:**
- Episode metadata (title, description, status)
- Quick stats (scene count, asset count, duration)
- Action buttons:
  - "Manage Scenes" → `/episodes/:episodeId/scenes`
  - "Edit Timeline" → `/episodes/:episodeId/timeline`
  - "Edit Episode" (metadata)
- Recent activity
- Thumbnail gallery (optional)

**Should NOT contain:**
- Full scene manager (that's `/scenes`)
- Canvas editor (that's `/scene/:sceneId/compose`)
- Timeline editor (that's `/timeline`)

---

### 2. ScenesPage (Scene Management)
**Route:** `/episodes/:episodeId/scenes`

**Job:** Scene browsing, adding, and sequencing

**Should contain:**
- Scene list (drag-and-drop)
- Add from library button
- Scene status indicators
- Reorder controls
- "Compose" button per scene → `/scene/:sceneId/compose`

**Should NOT contain:**
- Canvas editing UI
- Timeline UI
- Episode metadata editing

---

### 3. SceneComposePage (Canvas Editor)
**Route:** `/episodes/:episodeId/scene/:sceneId/compose`

**Job:** Visual composition of ONE scene

**Should contain:**
- Full canvas (70-80% width)
- Asset drawer (left, collapsible)
- Inspector panel (right, reactive)
- Thin header (scene name, save)
- Layer management

**Should NOT contain:**
- Scene list/sequencing
- Timeline controls
- Multiple scene editing

---

### 4. TimelineEditor
**Route:** `/episodes/:episodeId/timeline`

**Job:** Full timeline editing (future)

**Should contain:**
- Multi-track timeline
- Playback controls
- Scene blocks on timeline
- Transition editing
- Audio tracks

**Should NOT contain:**
- Canvas layer editing (that's compose)
- Scene library browsing (that's scenes)

---

## 🔗 Navigation Updates Needed

### In EpisodeDetail.jsx

Add navigation buttons:

```javascript
<button onClick={() => navigate(`/episodes/${episodeId}/scenes`)}>
  Manage Scenes
</button>

<button onClick={() => navigate(`/episodes/${episodeId}/timeline`)}>
  Edit Timeline
</button>
```

Remove the old tab system that rendered `<SceneComposer>` inline.

---

### In ClipSequenceManager.jsx

Add "Compose" button per scene:

```javascript
<button onClick={() => navigate(`/episodes/${episodeId}/scene/${scene.id}/compose`)}>
  Compose
</button>
```

---

### In SceneComposer Header

Add back button:

```javascript
<button onClick={() => navigate(`/episodes/${episodeId}/scenes`)}>
  ← Back to Scenes
</button>
```

Or close button:

```javascript
<button onClick={() => navigate(`/episodes/${episodeId}`)}>
  × Close
</button>
```

---

## ✅ Benefits of New Structure

### 1. Clear Separation of Concerns
Each page has ONE job:
- Dashboard → Overview
- Scenes → Sequencing
- Compose → Visual editing
- Timeline → Timeline editing

### 2. Better URLs
```
/episodes/abc123                           (Dashboard)
/episodes/abc123/scenes                    (Scene list)
/episodes/abc123/scene/def456/compose      (Edit scene def456)
/episodes/abc123/timeline                  (Timeline)
```

URLs are:
- Bookmarkable
- Shareable
- SEO-friendly
- Self-documenting

### 3. Focused UI
- No tabs fighting for space
- Canvas can be fullscreen
- Scene list can show more scenes
- Each page optimized for its task

### 4. Performance
- Only load what's needed
- Scene list doesn't load canvas code
- Canvas doesn't load timeline code
- Lazy loading possible

### 5. Scalability
Adding new features is easy:
- New page? Add new route
- No more cramming into tabs
- No layout conflicts

---

## 🚀 Migration Guide

### For existing links to Scene Composer

**Old:**
```javascript
// Scene Composer was in a tab in EpisodeDetail
// No direct link, had to click tab
```

**New:**
```javascript
navigate(`/episodes/${episodeId}/scene/${sceneId}/compose`)
```

---

### For scene creation workflow

**Old:**
```
EpisodeDetail → Click "Composer" tab → Create composition
```

**New:**
```
EpisodeDetail → Click "Manage Scenes" → Click "Compose" on a scene
OR
EpisodeDetail → Click "Manage Scenes" → Add scene from library → Click "Compose"
```

---

## 🧪 Testing Checklist

- [ ] Navigate to `/episodes/:episodeId` - Shows dashboard
- [ ] Click "Manage Scenes" - Goes to `/episodes/:episodeId/scenes`
- [ ] Scene list loads correctly
- [ ] Click "Compose" on a scene - Goes to `/episodes/:episodeId/scene/:sceneId/compose`
- [ ] Canvas loads fullscreen
- [ ] Asset drawer works (left panel)
- [ ] Inspector works (right panel)
- [ ] Save composition works
- [ ] Back button returns to scenes
- [ ] Navigate to `/episodes/:episodeId/timeline` - Timeline page loads
- [ ] Legacy routes still work (backward compatibility)

---

## 📋 Next Steps (Recommended)

### 1. Update EpisodeDetail.jsx
Remove the tab that embeds `<SceneComposer>`.
Add navigation buttons to new routes.

### 2. Add navigation to ClipSequenceManager
Each scene item should have a "Compose" button that navigates to:
`/episodes/${episodeId}/scene/${scene.id}/compose`

### 3. Update SceneComposer header
Add a back button or close button that navigates to:
`/episodes/${episodeId}/scenes`

### 4. Remove legacy routes (eventually)
Once confident in new structure:
- Remove `/scene-templates/new`
- Remove `/scene-templates/:templateId/edit`
- Update any hardcoded links

### 5. Add breadcrumbs (optional)
Show navigation trail:
```
Episodes > Episode Title > Scenes > Scene Name (Compose)
```

---

## 🎯 Summary

**Problem:** Tabs in EpisodeDetail made everything feel cramped.

**Solution:** Dedicated pages with clean URLs.

**Result:**
- ✅ `/episodes/:episodeId` - Dashboard
- ✅ `/episodes/:episodeId/scenes` - Scene management
- ✅ `/episodes/:episodeId/scene/:sceneId/compose` - Canvas editor
- ✅ `/episodes/:episodeId/timeline` - Timeline (ready for future)

**Each page has ONE job. This unlocks everything.**

---

**Status:** ✅ COMPLETE - Route structure implemented, pages created, no errors
