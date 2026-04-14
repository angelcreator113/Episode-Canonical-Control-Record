# Session Handoff Document

**Date:** 2026-04-14
**Status:** Ready for next session pickup

---

## Part 1: What Was Built This Session

### 1. DREAM Cities System

Created the unified LalaVerse geography — 5 cities forming the D.R.E.A.M. acronym:

| Letter | City | Domain | Color |
|--------|------|--------|-------|
| **D** | Dazzle District | Fashion & Luxury | `#d4789a` |
| **R** | Radiance Row | Beauty & Wellness | `#a889c8` |
| **E** | Echo Park | Entertainment & Nightlife | `#c9a84c` |
| **A** | Ascent Tower | Tech & Innovation | `#6bba9a` |
| **M** | Maverick Harbor | Creator Economy & Counter-culture | `#7ab3d4` |

Each city has: neighborhoods/pins, universities, corporations, major events, resident archetypes, and cultural energy descriptions.

**Key files:**
- `frontend/src/data/dreamCities.js` — DREAM_CITIES, UNIVERSITIES, CORPORATIONS, WORLD_LAYERS data
- `frontend/src/components/DreamMap.jsx` — Interactive pan/zoom map with city hotspots, location pins, scene set thumbnails, Lala position indicator, edit mode for repositioning

**Backend:**
- `GET /api/v1/world/map/positions` — Load saved city positions
- `PUT /api/v1/world/map/positions` — Save custom city layouts (stored in PageContent)

---

### 2. Interactive World Map

`DreamMap.jsx` — Full interactive map component with:
- Pan (drag) and zoom (mouse wheel) controls
- City zone hotspots with glow effects and letter badges
- Location pins showing scene sets on hover
- Lala's position indicator with pulse animation
- Creator distribution by city sidebar
- Edit mode to reposition cities and persist to DB
- Gradient placeholder map (awaiting uploaded world render)

---

### 3. Four Consolidated Pages

Merged scattered world-building pages into 4 focused pages:

| New Page | Merges | Route | Tabs |
|----------|--------|-------|------|
| **WorldDashboard** | WorldSetupGuide + UniverseWorldState | `/world-dashboard` | Setup Progress, World State, Tensions |
| **WorldFoundation** | WorldInfrastructure + WorldLocations | `/world-foundation` | The Map, Locations, The Loop |
| **SocialSystems** | InfluencerSystems + Legends + Society | `/social-systems` | Archetypes, Legends/Society, Rules, Trends |
| **CultureEvents** | CulturalCalendar + CulturalMemory | `/culture-events` | Calendar, Memory, Legacy |

**WorldDashboard** provides a 7-step setup wizard:
1. World Foundation (DREAM cities, companies, universities)
2. Social Systems (influence, archetypes, economy)
3. Culture & Events (yearly rhythm, auto-spawn events)
4. Cultural Memory (legends, feuds, archives)
5. Locations & Venues (map, venues, scene sets)
6. Generate Feed (influencers, rivals, friends)
7. Create World Events (calendar auto-spawn)

---

### 4. Feed-to-Location Connection

Added location awareness to the social feed system:

- **Migration:** `20260725000001-add-location-to-social-profiles.js`
  - `home_location_id` FK on social_profiles → world_locations (where a creator lives)
  - `frequent_venues` JSONB array of location IDs they visit
- Location types: city, district, street, venue, property, interior, exterior, landmark, virtual, transitional
- Venue types: restaurant, club, bar, cafe, salon, spa, gallery, museum, boutique, gym, hotel, office, park, rooftop, theater
- Property types: penthouse, mansion, apartment, townhouse, studio, villa, loft, cottage

---

### 5. Phone Screen Renderer

`src/services/phoneScreenRenderer.js` + `src/models/FeedMoment.js`

Generates phone mockup PNGs showing what Lala sees on her phone during scenes:
- Types: notification, post, story, dm, live, ui_interaction
- Canvas-rendered with custom fonts, notch, status bar, rounded corners
- Each FeedMoment captures: trigger (profile, handle, action), screen content, dual voice script (JustAWoman vs Lala internal), narrative impact, financial context
- Stored in `feed_moments` table with associations to episodes, events, social_profiles

---

### 6. Auto-Remove-BG

Background removal integrated across asset pipeline:
- Primary: remove.bg API (via `REMOVEBG_API_KEY`)
- Fallback: RunwayML `removeBackground()`
- Applied when `removeBackground: true` flag is set during object/asset generation
- Used in wardrobe controller and scene studio controller
- **Key files:**
  - `src/services/objectGenerationService.js`
  - `src/services/AssetProcessingService.js`
  - `src/services/RunwayMLService.js`
  - `src/controllers/wardrobeController.js`
  - `src/controllers/sceneStudioController.js`

---

### 7. Culture & Events Redesign

`frontend/src/pages/CultureEvents.jsx` — Unified culture page with three tabs:

- **Calendar tab:** Yearly cultural events (award shows, birthdays, micro-events), event categories (fashion/beauty/entertainment/lifestyle/community/technology), auto-spawn world events with host/guest generation
- **Memory tab:** Cultural memory, legends, feuds, archives, anniversaries, nostalgia waves
- **Legacy tab:** How the world remembers significant moments
- Connected to world events via `location_id`
- Integrated with Feed via auto-generation of social posts about events

---

### 8. Franchise Brain Auto-Push

`frontend/src/components/PushToBrain.jsx` — Reusable "Push to Brain" button:
- Sends any page's `usePageData` state to the franchise brain ingest pipeline
- Creates entries as "Pending Review" status
- Available on: CultureEvents, SocialSystems, WorldFoundation, and other world-building pages
- **Route:** `POST /franchise-brain/push-from-page`

**Knowledge categories:** Franchise Laws, Character, Narrative, Locked Decision, Technical, Brand, World

---

### 9. All Fixes

- Feed profile generation connected to DREAM city locations
- Event auto-spawn linked to venue locations
- World state snapshots and timeline events in WorldDashboard
- Tension pairs tracking between characters/factions
- Setup status checks across all world-building subsystems

---

## Part 2: Screen Layer System Spec (Next Session Build)

### Current State

The Scene Studio already has a **production Canva-like editor** built on **Konva.js** (not Fabric.js):

**Existing infrastructure:**
- `frontend/src/components/SceneStudio/SceneStudio.jsx` — Main editor (~1000 lines)
- `frontend/src/components/SceneStudio/Canvas/StudioCanvas.jsx` — Konva canvas (~709 lines)
- `frontend/src/components/SceneStudio/Toolbar.jsx` — Tools, zoom, platform presets
- `frontend/src/components/SceneStudio/useSceneStudioState.js` — State + undo/redo (50 history)

**Canvas objects:** `Canvas/objects/` — ImageObject, VideoObject, TextObject, ShapeObject
**Mask/paint:** `Canvas/MaskLayer.jsx` — Brush painting for erase/inpaint
**Parallax:** `Canvas/ParallaxLayer.jsx` — Depth-based parallax effects

**Panels:**
- `panels/CreationPanel.jsx` — Asset creation
- `panels/InspectorPanel.jsx` (~800 lines) — Transform, appearance, layer controls, depth, color grading
- `panels/ObjectsPanel.jsx` — Object list/ordering
- `panels/SmartSuggestions.jsx` — AI suggestions

**Tabs:** TemplatesTab, GenerateTab (~1000 lines), LibraryTab, DecorTab, TextTab, ShapesTab, SceneStatesTab, UploadTab

**Existing platform presets:**
```javascript
youtube:   1920x1080  (16:9)
instagram: 1080x1920  (9:16)
tiktok:    1080x1920  (9:16)
square:    1080x1080  (1:1)
cinema:    2560x1440  (16:9)
```

**Backend models:**
- `src/models/Layer.js` — layer_number (1-5), type, opacity, blend_mode, z_index
- `src/models/SceneLayerConfiguration.js` — 5-layer JSONB structure, complexity tracking
- `src/models/LayerAsset.js` — Assets assigned to layers
- `src/models/LayerPreset.js` — System and user-created presets

**Migration:** `20260701000000-add-canvas-settings-to-scenes.js` — `canvas_settings` JSONB on scenes/scene_sets

---

### What to Build: Screen Layer System Extension

The next session should extend the existing SceneStudio with phone/device screen framing capabilities. Since Konva.js is already in use (NOT Fabric.js), build on the existing stack.

#### A. Safe Area Guides

Add device-specific safe area overlays to StudioCanvas:

```
┌─────────────────────────────────┐
│  Status bar zone (top 44px)     │
│  ┌───────────────────────────┐  │
│  │                           │  │
│  │    Content safe area      │  │
│  │                           │  │
│  │                           │  │
│  └───────────────────────────┘  │
│  Home indicator zone (bot 34px) │
└─────────────────────────────────┘
```

- Toggle on/off from Toolbar
- Semi-transparent overlays with dashed borders
- Different zones per device preset

#### B. Snap-to-Grid Enhancement

Extend existing grid system in StudioCanvas:
- Configurable grid size (8px, 16px, 24px, 32px)
- Snap threshold setting
- Smart guides between objects (already partially implemented)
- Grid visible toggle already exists in Toolbar

#### C. Device Frame Presets

Add 4 new frame presets to `PLATFORM_PRESETS` in Toolbar.jsx:

```javascript
iphone_15:     393x852   (iPhone 15 / 15 Pro)
iphone_15_max: 430x932   (iPhone 15 Pro Max)
android_pixel: 412x915   (Pixel 8)
fantasy_phone: 400x880   (LalaVerse custom device)
```

Each preset includes:
- Canvas dimensions
- Safe area insets (top, bottom, left, right)
- Notch/dynamic island shape data
- Home indicator style
- Corner radius

#### D. Layer Management Extensions

Extend the existing InspectorPanel layer controls:
- **Screen chrome layer** (status bar, notch, home indicator) — always on top
- **Content layers** — user-editable, between chrome and background
- **Background layer** — wallpaper/gradient behind content
- Layer grouping for device frame elements
- Lock device chrome layers by default

#### E. Export Pipeline

Extend the existing `onExport` in SceneStudio:
- Export with device frame overlay (PNG, 2x/3x)
- Export content only (no frame)
- Export as device mockup (with shadow, perspective, floating device render)
- Batch export all presets at once
- Quality settings (1x, 2x, 3x)

#### F. Text Tool Enhancement

Extend existing TextTab and TextObject:
- System font presets (San Francisco for iOS, Roboto for Android, custom for Fantasy)
- Text styles matching device UI (notification title, body, caption, badge)
- Auto-sizing to fit safe area width
- Text shadow and outline options

#### G. Template System Integration

Connect to existing TemplateStudio infrastructure:
- Save screen layouts as templates via `src/routes/sceneTemplates.js`
- Pre-seeded phone screen templates:
  - "Lala's Home Screen" — app grid layout
  - "Notification Stack" — notification center mockup
  - "DM Conversation" — chat bubbles layout
  - "Feed Post" — social media post frame
  - "Story View" — full-screen story with UI overlays

---

### Suggested File Architecture

New files to create (extending existing structure):

```
frontend/src/components/SceneStudio/
  frames/
    DeviceFrame.jsx          # Konva group rendering device chrome
    SafeAreaGuide.jsx        # Semi-transparent safe area overlay
    devicePresets.js         # Frame data (dimensions, insets, shapes)
  Canvas/
    objects/
      DeviceChromeObject.jsx # Renders notch, status bar, home indicator
  panels/
    tabs/
      FrameTab.jsx           # New tab: pick device frame, toggle safe areas
```

Extend existing files:
- `Toolbar.jsx` — Add phone presets to PLATFORM_PRESETS, safe area toggle
- `useSceneStudioState.js` — Add frame state, safe area state
- `StudioCanvas.jsx` — Render SafeAreaGuide and DeviceFrame layers
- `InspectorPanel.jsx` — Device chrome layer controls

---

### Backend Needs

Minimal backend additions — mostly frontend work:

1. **No new models needed** — use existing Layer, LayerPreset, SceneTemplate
2. **Seed data** — Add phone frame presets to LayerPreset table
3. **Template seeding** — Pre-create phone screen templates via existing `/api/v1/scene-templates`
4. **Asset storage** — Device frame PNGs (notch shapes, bezels) uploaded to S3 via existing asset pipeline

---

### Dependencies

Already installed (no new packages needed):
- `konva` ^10.2.0
- `react-konva` ^18.2.14
- `canvas` ^3.2.1 (backend)
- `html2canvas` ^1.4.1

---

### Priority Order

1. Device frame presets + `devicePresets.js` data file
2. `DeviceFrame.jsx` Konva component rendering chrome
3. `SafeAreaGuide.jsx` overlay
4. `FrameTab.jsx` panel tab for frame selection
5. Wire into StudioCanvas + Toolbar
6. Export pipeline extension
7. Template seeding
8. Text tool device font presets
