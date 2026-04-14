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
- `frontend/src/data/dreamCities.js` — DREAM_CITIES, UNIVERSITIES, CORPORATIONS, WORLD_LAYERS
- `frontend/src/data/influencerData.js` — Archetypes, relationships, economy, trends
- `frontend/src/data/calendarData.js` — Award shows, celebrity hierarchy, media outlets
- `frontend/src/data/memoryData.js` — Memory types, archives, legends, feuds
- `frontend/src/components/DreamMap.jsx` — Interactive map component

**Backend:**
- **Migration** `20260725000000` — Renames old city enums (nova_prime → dazzle_district, etc.) across SocialProfile model
- `CITY_CULTURE` mappings updated in `socialProfileRoutes.js`
- `feedConstants.js` LALAVERSE_CITIES updated
- `GET/PUT /api/v1/world/map/positions` — Load/save city layouts (PageContent model)
- `POST /api/v1/world/map/upload` — Upload map image to S3
- `GET /api/v1/world/map` — Get map image URL

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
- Opens as modal from map pin icon in script beats (`EpisodeScriptTab.jsx`)

---

### 3. Four Consolidated Pages

Merged scattered world-building pages into 4 focused pages:

| New Page | Merges | Route | Tabs |
|----------|--------|-------|------|
| **WorldDashboard** | WorldSetupGuide + UniverseWorldState | `/world-dashboard` | Setup Progress, World State, Tensions |
| **WorldFoundation** | WorldInfrastructure + WorldLocations | `/world-foundation` | The Map, Locations, The Loop |
| **SocialSystems** | InfluencerSystems + Legends + Society | `/social-systems` | Archetypes, Legends/Society, Rules, Trends |
| **CultureEvents** | CulturalCalendar + CulturalMemory | `/culture-events` | Calendar, Memory, Legacy |

All under FRANCHISE in sidebar.

Culture & Events uses 3 sub-components: `Culture/EventsTab.jsx`, `Culture/AwardsMediaTab.jsx`, `Culture/HistoryTab.jsx`

SocialSystems covers: 15 archetypes, 50 legends, famous 25, celebrity hierarchy, media outlets, relationships, economy, trends, algorithm, drama mechanics.

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
- **Profile generation** (`socialProfileRoutes.js`): auto-creates signature venue per creator based on content category (fashion→Showroom, beauty→Studio, music→Studio, etc.)
- **Event automation** (`eventAutomationService.js`): `findVenue()` checks host's frequent venues → host's city → category match → fallback
- **WorldLocation model**: `hasMany(SocialProfile, { as: 'residents' })`
- **Seed infrastructure** (`worldStudio.js`): 30 locations across 5 DREAM cities with addresses
- Location types: city, district, street, venue, property, interior, exterior, landmark, virtual, transitional
- Venue types: restaurant, club, bar, cafe, salon, spa, gallery, museum, boutique, gym, hotel, office, park, rooftop, theater
- Property types: penthouse, mansion, apartment, townhouse, studio, villa, loft, cottage

---

### 5. Phone Hub + Screen Renderer

**Phone Hub** (`frontend/src/components/PhoneHub.jsx`):
- Visual phone device with screen preview
- 13 screen type slots: Home, Feed, DMs, Invitation, Closet, Comments, Stories, Profile, Alerts, Camera, Shopping, Live, Map
- 7 phone skins: Midnight, Rose Gold, Gold, Silver, White, Pink, Lavender
- Custom frame upload
- Existing overlays map to screen slots by name/beat matching

**UI Overlays Tab** (`frontend/src/pages/UIOverlaysTab.jsx`) — full rewrite:
- Phone Hub design: device preview left, screen grid right
- Detail panel with Generate, Upload, Download, Remove BG, Delete
- Modal stays open after actions (no scroll-to-top)
- Delete button on all overlay cards
- Tab persistence in URL (`?tab=overlays-tab`)

**Phone Screen Renderer** (`src/services/phoneScreenRenderer.js` + `src/models/FeedMoment.js`):
- Generates phone mockup PNGs showing what Lala sees on her phone during scenes
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
- `calendarRoutes.js`: `CATEGORY_TO_DREAM_CITY` mapping + `dreamCityFromEvent()` helper
- Events tab shows By City (default) or By Month view — each event card shows city letter badge
- Connected to world events via `location_id`
- Integrated with Feed via auto-generation of social posts about events

---

### 8. Franchise Brain Auto-Push

**Manual push** — `frontend/src/components/PushToBrain.jsx`:
- Reusable "Push to Brain" button on any world-building page
- Sends page's `usePageData` state to the franchise brain ingest pipeline
- Creates entries as "Pending Review" status
- Available on: CultureEvents, SocialSystems, WorldFoundation, and other pages
- **Route:** `POST /franchise-brain/push-from-page`

**Auto-push on episode completion** — `episodeCompletionService.js` Step 16:
- Auto-creates franchise_knowledge entries when an episode completes
- Pushes episode result + character state snapshot
- Supersedes previous state snapshot automatically
- `franchiseBrainRoutes.js`: seed route checks table existence before counting

**Knowledge categories:** Franchise Laws, Character, Narrative, Locked Decision, Technical, Brand, World

---

### 9. Wardrobe Improvements

- `wardrobeLibraryController.js`: auto-remove-bg on upload via Remove.bg API (non-blocking)
- CSS: `object-fit: contain`, padding, warm gradient background, hover zoom

---

### 10. All Fixes

- `UniversePage.jsx`: load universe from `show.universe_id` instead of hardcoded UUID
- `WorldDashboard.jsx`: `safeFetch` for page-content checks, correct URL (`/page-content/` not `/page-data/`)
- `SidebarProgress.jsx`: light pink background
- `FranchiseBrain.jsx`: routes point to new consolidated pages
- `WorldSetupGuide.jsx`: step routes point to new pages
- Silent catch linting fixes in episodeCompletionService
- Feed profile generation connected to DREAM city locations
- Event auto-spawn linked to venue locations
- World state snapshots and timeline events in WorldDashboard
- Tension pairs tracking between characters/factions

---

## Part 2: Screen Layer System Spec (Next Session Build)

### Vision

**Canva for phone screens** — extend the existing Scene Studio with device framing so you can compose what Lala sees on her phone as layered, exportable screen overlays.

### Current State — What Already Exists

The Scene Studio is a **production Canva-like editor** built on **Konva.js** (`konva` ^10.2.0, `react-konva` ^18.2.14). Do NOT introduce Fabric.js — everything builds on Konva.

#### Canvas Engine (already working)
| File | What it does |
|------|-------------|
| `SceneStudio/SceneStudio.jsx` (~1000 lines) | Main orchestrator — loads from API, manages panels, keyboard shortcuts, auto-save |
| `SceneStudio/Canvas/StudioCanvas.jsx` (~709 lines) | Konva `<Stage>` + `<Layer>` — renders objects, selection, zoom/pan, snap guides, background |
| `SceneStudio/Toolbar.jsx` | Tools (Select/Pan/Erase), zoom controls, platform presets, grid toggle, export |
| `SceneStudio/useSceneStudioState.js` (~639 lines) | Central state hook — all state + actions below |

#### State Hook — Key API (`useSceneStudioState`)
```javascript
// State you'll extend:
canvasSettings: { zoom, panX, panY, gridVisible, snapEnabled, backgroundColor, sceneStates }
objects: [{ id, type, x, y, width, height, rotation, opacity, layerOrder, isVisible, isLocked, groupId, depthLayer, ... }]

// Actions you'll call:
addObject(obj)              // adds to canvas, auto-increments layerOrder
updateCanvasSettings(changes) // merges into canvasSettings, marks dirty for data keys
serializeForSave()          // returns { objects, canvas_settings } for API save
loadFromApi(data, type)     // hydrates from GET response
groupObjects(ids)           // groups objects under shared groupId
```

#### Existing Object Types (`Canvas/objects/`)
- `ImageObject.jsx`, `VideoObject.jsx`, `TextObject.jsx`, `ShapeObject.jsx`
- Object type map in StudioCanvas: `{ image, video, text, shape, decor, overlay }`

#### Existing Panels & Tabs
- `InspectorPanel.jsx` (~800 lines) — Transform, opacity, blend modes (normal/multiply/screen/overlay/soft-light), depth layers (FG/MG/BG), time-of-day color grading, visibility/lock toggles
- `ObjectsPanel.jsx` — Layer list with reorder/hide/lock
- Tabs: `TemplatesTab`, `GenerateTab`, `LibraryTab`, `DecorTab`, `TextTab`, `ShapesTab`, `SceneStatesTab`, `UploadTab`

#### Existing Platform Presets (in `Toolbar.jsx`, exported as `PLATFORM_PRESETS`)
```javascript
youtube:   { width: 1920, height: 1080, label: 'YouTube 16:9' }
instagram: { width: 1080, height: 1920, label: 'Instagram 9:16' }
tiktok:    { width: 1080, height: 1920, label: 'TikTok 9:16' }
square:    { width: 1080, height: 1080, label: 'Square 1:1' }
cinema:    { width: 2560, height: 1440, label: 'Cinema 16:9' }
```

#### Existing Backend Models
- `Layer.js` — layer_number (1-5), type, opacity, blend_mode, z_index
- `SceneLayerConfiguration.js` — 5-layer JSONB, complexity tracking
- `LayerAsset.js` — Assets per layer
- `LayerPreset.js` — System + user presets with versioning, usage stats
- Migration `20260701000000` — `canvas_settings` JSONB column on scenes + scene_sets

#### Already Installed (no new packages)
- `konva` ^10.2.0, `react-konva` ^18.2.14, `canvas` ^3.2.1, `html2canvas` ^1.4.1

---

### What to Build

#### A. Device Frame Presets — `frames/devicePresets.js`

Add 4 phone presets. These extend `PLATFORM_PRESETS` but include safe area and chrome data:

```javascript
export const DEVICE_PRESETS = {
  iphone_15: {
    width: 393, height: 852,
    label: 'iPhone 15',
    cornerRadius: 55,
    safeArea: { top: 59, bottom: 34, left: 0, right: 0 },
    notch: 'dynamic_island',    // shape key for DeviceFrame
    homeIndicator: true,
  },
  iphone_15_max: {
    width: 430, height: 932,
    label: 'iPhone 15 Pro Max',
    cornerRadius: 55,
    safeArea: { top: 59, bottom: 34, left: 0, right: 0 },
    notch: 'dynamic_island',
    homeIndicator: true,
  },
  android_pixel: {
    width: 412, height: 915,
    label: 'Android Pixel 8',
    cornerRadius: 28,
    safeArea: { top: 36, bottom: 24, left: 0, right: 0 },
    notch: 'punch_hole',
    homeIndicator: false,        // uses nav bar
    navBar: { height: 48, style: 'gesture' },
  },
  fantasy_phone: {
    width: 400, height: 880,
    label: 'LalaVerse Phone',
    cornerRadius: 40,
    safeArea: { top: 44, bottom: 30, left: 0, right: 0 },
    notch: 'none',
    homeIndicator: true,
    brandColor: '#B8962E',       // gold accent
  },
};
```

**Integration:** Import into `Toolbar.jsx`, merge with `PLATFORM_PRESETS`. Add a visual separator between video presets and phone presets in the dropdown.

#### B. Safe Area Guides — `frames/SafeAreaGuide.jsx`

Konva `<Group>` rendered inside `StudioCanvas` above the background but below content objects:

```
┌─────────────────────────────────┐
│  Status bar zone (top inset)    │  ← semi-transparent overlay
│  ┌───────────────────────────┐  │
│  │                           │  │
│  │    Content safe area      │  │  ← dashed border
│  │                           │  │
│  └───────────────────────────┘  │
│  Home indicator zone (bottom)   │  ← semi-transparent overlay
└─────────────────────────────────┘
```

- Reads `safeArea` insets from active device preset
- Toggle via new `safeAreaVisible` key in `canvasSettings` (add to `VIEW_ONLY_KEYS` in state hook so it doesn't trigger save)
- Toolbar gets a new phone-shaped icon button next to the grid toggle
- Semi-transparent `rgba(0,0,0,0.15)` fill for unsafe zones, dashed stroke for safe area border

#### C. Device Frame Chrome — `frames/DeviceFrame.jsx`

Konva `<Group>` rendered on top of everything in `StudioCanvas`:

- **Status bar** — time, signal, battery icons as Konva `<Text>` elements positioned in the top safe area
- **Dynamic Island / Punch Hole / None** — drawn based on preset's `notch` key
- **Home Indicator** — thin rounded `<Rect>` centered at bottom
- **Device bezel** — rounded `<Rect>` with `cornerRadius` from preset, stroke only, no fill

Toggled via `deviceFrameVisible` in `canvasSettings` (also a `VIEW_ONLY_KEYS` entry).

#### D. Layer Management Extensions

Extend `InspectorPanel.jsx` and `ObjectsPanel.jsx`:

- When a device preset is active, auto-inject a locked "Device Chrome" group at the top of the layer stack
- Chrome group objects get `isLocked: true`, `groupId: 'device-chrome'` — they're visible in ObjectsPanel but greyed out / non-draggable
- Add a "Background" section in InspectorPanel when device mode is active: wallpaper image picker or gradient (stores in `canvasSettings.deviceBackground`)
- Existing `groupObjects`/`ungroupObjects` actions in state hook already support grouping

#### E. Export Pipeline Extension

Extend the existing `onExport` callback in `SceneStudio.jsx`:

| Export Mode | What it includes |
|-------------|-----------------|
| **Screen only** | Content layers — no chrome, no bezel |
| **With chrome** | Content + status bar + notch + home indicator |
| **Device mockup** | Full device with bezel, shadow, slight perspective tilt |
| **Batch** | All 4 device presets at once (ZIP download) |

- Quality: 1x (actual pixels), 2x, 3x multiplier
- Format: PNG (with alpha for mockup), JPEG, WebP
- Uses Konva's `stage.toDataURL()` — already available, just needs to toggle chrome layer visibility before capture

#### F. Text Tool — Device Font Presets

Extend `TextTab.jsx` and `TextObject.jsx`:

Add a "Phone UI" section with preset text styles:
- **Notification title** — SF Pro / Roboto, 15px, semibold
- **Notification body** — SF Pro / Roboto, 13px, regular
- **App label** — SF Pro / Roboto, 11px, regular
- **Badge count** — SF Pro / Roboto, 12px, bold, white on red circle
- **DM message** — system font, 16px, in chat bubble shape
- **Username** — DM Mono, 14px, bold (LalaVerse style)

Each preset creates a `TextObject` with pre-set `styleData` including font, size, weight, color.

#### G. Template System Integration

Connect to existing `src/routes/sceneTemplates.js` and `TemplatesTab.jsx`:

Pre-seed 5 phone screen templates (saved as SceneTemplate records):
1. **"Lala's Home Screen"** — App grid layout with wallpaper
2. **"Notification Stack"** — Notification center with 3 stacked cards
3. **"DM Conversation"** — Chat bubbles with typing indicator
4. **"Feed Post"** — Social media post frame (profile pic, image, likes, caption)
5. **"Story View"** — Full-screen story with top progress bar, username, reply input

Templates store their device preset key so loading a template auto-selects the right frame.

---

### New Files to Create

```
frontend/src/components/SceneStudio/
  frames/
    devicePresets.js         # DEVICE_PRESETS data (dimensions, insets, notch type)
    DeviceFrame.jsx          # Konva <Group> — status bar, notch, home indicator, bezel
    SafeAreaGuide.jsx        # Konva <Group> — safe area overlay + dashed border
  panels/
    tabs/
      FrameTab.jsx           # Panel tab — device picker, safe area toggle, background
```

### Files to Extend

| File | Changes |
|------|---------|
| `Toolbar.jsx` | Merge `DEVICE_PRESETS` into platform dropdown, add safe area toggle button |
| `useSceneStudioState.js` | Add `safeAreaVisible`, `deviceFrameVisible`, `deviceBackground` to `canvasSettings`; add all three to `VIEW_ONLY_KEYS` |
| `StudioCanvas.jsx` | Render `<SafeAreaGuide>` between background and objects layer; render `<DeviceFrame>` above all objects |
| `InspectorPanel.jsx` | Add device background section (wallpaper/gradient) when device preset active |
| `ObjectsPanel.jsx` | Show locked chrome group when device preset active |
| `SceneStudio.jsx` | Add `FrameTab` to left panel tabs; extend export modal with device export modes |
| `TextTab.jsx` | Add "Phone UI" preset section |

### Backend Needs

Minimal — mostly frontend work:

1. **No new models** — use existing Layer, LayerPreset, SceneTemplate
2. **Seed data** — Add phone frame presets to LayerPreset table via existing seed infrastructure
3. **Template seeding** — Pre-create 5 phone screen templates via `POST /api/v1/scene-templates`
4. **Assets** — Device frame PNGs (if using raster notch shapes) uploaded to S3 via existing asset pipeline; alternatively draw all chrome with Konva shapes (no assets needed)

### Priority Order

1. `devicePresets.js` — data file, no UI needed, unblocks everything
2. `SafeAreaGuide.jsx` + wire into `StudioCanvas` — immediate visual value
3. `DeviceFrame.jsx` — chrome rendering
4. `FrameTab.jsx` — device picker panel tab
5. Toolbar integration — presets dropdown + toggle buttons
6. State hook updates — `canvasSettings` keys + `VIEW_ONLY_KEYS`
7. Export pipeline — device export modes
8. Template seeding — 5 phone screen templates
9. `TextTab` phone UI presets

---

### Phone Hub Screen Expansion

The Phone Hub (`PhoneHub.jsx` + `UIOverlaysTab.jsx`) currently has 13 screen slots. Expand to **26 screens** covering Lala's full phone experience. Each screen is a designed overlay image (like the glassmorphism Messages mockup) that gets uploaded or AI-generated.

#### Current 13 Screens (in `SCREEN_TYPES` array)
`home`, `feed`, `dm`, `invite`, `wardrobe`, `comments`, `story`, `profile`, `notif`, `camera`, `shop`, `live`, `map`

#### New Screens to Add (13 more)

```javascript
// Add to SCREEN_TYPES in PhoneHub.jsx:
{ key: 'messages',    label: 'Messages',    icon: '✉️',  desc: 'Text conversations' },
{ key: 'calls',       label: 'Calls',       icon: '📞', desc: 'Call history & FaceTime' },
{ key: 'contacts',    label: 'Contacts',    icon: '👥', desc: 'Contact list' },
{ key: 'tasks',       label: 'Tasks',       icon: '✅', desc: 'To-do & reminders' },
{ key: 'brand_deals', label: 'Brand Deals', icon: '🤝', desc: 'Sponsorship offers' },
{ key: 'deadlines',   label: 'Deadlines',   icon: '⏰', desc: 'Upcoming due dates' },
{ key: 'stats',       label: 'Stats',       icon: '📊', desc: 'Analytics & metrics' },
{ key: 'creator_hub', label: 'Creator Hub', icon: '🎨', desc: 'Content management' },
{ key: 'settings',    label: 'Settings',    icon: '⚙️',  desc: 'Phone settings' },
{ key: 'accessories', label: 'Accessories', icon: '💎', desc: 'Jewelry & extras' },
{ key: 'gallery',     label: 'Gallery',     icon: '🖼️',  desc: 'Photo gallery' },
{ key: 'music',       label: 'Music',       icon: '🎵', desc: 'Now playing' },
{ key: 'wallet',      label: 'Wallet',      icon: '💳', desc: 'Payments & cards' },
```

#### Visual Style — Glassmorphism Theme

All screens follow the dreamy, sparkly aesthetic (reference: Messages mockup):
- **Background:** soft pink/lavender gradient with sparkle particles
- **Cards/rows:** frosted glass (`backdrop-filter: blur`, white 10-15% opacity)
- **Corners:** large radius (16-20px) on glass cards
- **Typography:** elegant serif for titles (like "Messages" in script), DM Mono for UI labels
- **Chrome:** rose gold bezel, status bar with time/signal/battery
- **Bottom nav:** frosted glass pill-shaped icons
- **Glow accents:** subtle gold/pink light effects at edges

#### Upload Workflow (already works, just needs more slots)

The upload flow in `UIOverlaysTab.jsx` already supports:
1. Click a screen slot card
2. Upload button opens file picker
3. Image uploads to S3 via `/api/v1/ui-overlays/:showId` route
4. Phone preview updates with the uploaded image
5. Generate button creates an AI-designed screen via Claude

The only code change needed: expand `SCREEN_TYPES` array in `PhoneHub.jsx` and organize the grid into sections.

#### Screen Grid Organization

Group the 26 screens in the UI grid by category:

| Section | Screens |
|---------|---------|
| **Core** | Home, Feed, Messages, DMs, Stories, Profile |
| **Communication** | Calls, Contacts, Comments, Live, Alerts |
| **Business** | Brand Deals, Stats, Creator Hub, Deadlines, Tasks |
| **Lifestyle** | Closet, Accessories, Shopping, Camera, Gallery |
| **World** | Map, Invitation, Music, Wallet, Settings |

#### File Changes

| File | Change |
|------|--------|
| `PhoneHub.jsx` | Add 13 new entries to `SCREEN_TYPES`, add `SCREEN_CATEGORIES` grouping |
| `UIOverlaysTab.jsx` | Render screen grid grouped by category with section headers |

---

### Screen Link System (Built This Session)

Interactive tap zones with icon overlays — lets you link app icons on the home screen (or any screen) to navigate between phone screens.

#### How It Works

1. Upload your home screen image (glassmorphism design with app icon placeholders)
2. Click **"Edit Links"** in the detail panel
3. **Draw rectangles** over each app icon on the screen image
4. For each zone: assign a **target screen** (dropdown of all SCREEN_TYPES) + upload a custom **icon overlay image**
5. **Save Links** persists to the overlay's asset metadata as JSONB
6. In the phone preview, tapping a zone **navigates to that screen** with a **back button** to return

#### Data Model

Screen links stored as JSONB array on the asset's `metadata.screen_links`:

```javascript
{
  screen_links: [
    { id: 'link-abc', x: 12, y: 45, w: 18, h: 10, target: 'messages', label: 'Messages', icon_url: 'https://s3.../icon.png' },
    { id: 'link-def', x: 38, y: 45, w: 18, h: 10, target: 'feed', label: 'Feed', icon_url: 'https://s3.../feed-icon.png' },
  ]
}
```

Positions are **percentages** (0-100) so they work at any resolution.

#### Backend Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/v1/ui-overlays/:showId/screen-links/:assetId` | `PUT` | Save screen_links array to asset metadata |
| `/api/v1/ui-overlays/:showId/screen-links/:assetId` | `GET` | Load screen_links from asset metadata |
| `/api/v1/ui-overlays/:showId/screen-links/:assetId/icon` | `POST` | Upload icon image for a specific link zone (multipart, fields: `icon`, `link_id`) |

#### New Files

| File | Purpose |
|------|---------|
| `frontend/src/components/ScreenLinkEditor.jsx` | Draw zones on screen, assign targets, upload icons, drag to reposition |

#### Modified Files

| File | Changes |
|------|---------|
| `frontend/src/components/PhoneHub.jsx` | `ScreenLinkOverlay` renders icon images + clickable hotspots, back button with nav history |
| `frontend/src/pages/UIOverlaysTab.jsx` | "Edit Links" button, `ScreenLinkEditor` panel, navigation state (handleNavigate/handleBack), link save/upload handlers |
| `src/routes/uiOverlayRoutes.js` | 3 new routes for screen links CRUD + icon upload, list endpoint returns `screen_links` |
