# Session Handoff — World Building + Phone Hub

## Branch
`claude/financial-transaction-service-Sh6du`

## What Was Built This Session

### DREAM City System
- **5 unified cities** spelling D·R·E·A·M: Dazzle District (Fashion), Radiance Row (Beauty), Echo Park (Entertainment), Ascent Tower (Tech), Maverick Harbor (Creator Economy)
- **Migration** `20260725000000` renames old city enums (nova_prime → dazzle_district, etc.) across SocialProfile model
- **Backend** `CITY_CULTURE` mappings updated in `socialProfileRoutes.js`
- **Frontend** `feedConstants.js` LALAVERSE_CITIES updated
- **Data files** created in `frontend/src/data/`: dreamCities.js, influencerData.js, calendarData.js, memoryData.js

### Interactive DREAM Map (`frontend/src/components/DreamMap.jsx`)
- Image-based world map with uploadable background (S3)
- 5 city hotspots with pan/zoom (CSS transforms + wheel events)
- Draggable city repositioning (Edit Positions mode)
- City sidebar with location list + scene set thumbnails
- Opens as modal from 📍 in script beats (`EpisodeScriptTab.jsx`)
- **Backend routes** in `worldStudio.js`:
  - `POST /world/map/upload` — upload map image to S3
  - `GET /world/map` — get map image URL
  - `GET /world/map/positions` — get city positions
  - `PUT /world/map/positions` — save city positions
  - All use `PageContent` model with `conflictFields` upsert

### World Building Pages (7 → 4 consolidation)
All under FRANCHISE in sidebar:

| Page | Route | File | Content |
|------|-------|------|---------|
| World Dashboard | `/world-dashboard` | `WorldDashboard.jsx` | Setup progress (7 steps), world state snapshots, timeline, tension scanner |
| World Foundation | `/world-foundation` | `WorldFoundation.jsx` | DREAM map, city cards, universities, corporations, locations CRUD, The Loop |
| Social Systems | `/social-systems` | `SocialSystems.jsx` | 15 archetypes, 50 legends, famous 25, celebrity hierarchy, media outlets, relationships, economy, trends, algorithm, drama |
| Culture & Events | `/culture-events` | `CultureEvents.jsx` | Events by DREAM city, awards & media, history (memory + legacy) |

Culture & Events uses 3 sub-components:
- `frontend/src/components/Culture/EventsTab.jsx`
- `frontend/src/components/Culture/AwardsMediaTab.jsx`
- `frontend/src/components/Culture/HistoryTab.jsx`

### Feed → World Foundation Connection
- **Migration** `20260725000001`: `home_location_id` (UUID FK) + `frequent_venues` (JSONB) on social_profiles
- **Profile generation** (`socialProfileRoutes.js`): auto-creates signature venue per creator based on content category (fashion→Showroom, beauty→Studio, music→Studio, etc.)
- **Event automation** (`eventAutomationService.js`): `findVenue()` now checks host's frequent venues → host's city → category match → fallback
- **WorldLocation model**: `hasMany(SocialProfile, { as: 'residents' })`
- **Seed infrastructure** (`worldStudio.js`): 30 locations across 5 DREAM cities with addresses

### Cultural Events → DREAM Cities
- `calendarRoutes.js`: `CATEGORY_TO_DREAM_CITY` mapping + `dreamCityFromEvent()` helper
- Events tab shows By City (default) or By Month view
- Each event card shows city letter badge

### Franchise Brain Auto-Push
- `episodeCompletionService.js` Step 16: auto-creates franchise_knowledge entries on episode completion
- Pushes episode result + character state snapshot
- Supersedes previous state snapshot
- `franchiseBrainRoutes.js`: seed route checks table existence before counting

### Phone Hub (`frontend/src/components/PhoneHub.jsx`)
- Visual phone device with screen preview
- 13 screen type slots (Home, Feed, DMs, Invitation, Closet, Comments, Stories, Profile, Alerts, Camera, Shopping, Live, Map)
- 7 phone skins (Midnight, Rose Gold, Gold, Silver, White, Pink, Lavender)
- Custom frame upload
- Existing overlays map to screen slots by name/beat matching

### UI Overlays Tab Rewrite (`frontend/src/pages/UIOverlaysTab.jsx`)
- Phone Hub design: device preview left, screen grid right
- Detail panel with Generate, Upload, Download, Remove BG, Delete
- Modal stays open after actions (no scroll-to-top)
- Delete button on all overlay cards
- Tab persistence in URL (`?tab=overlays-tab`)

### Wardrobe Improvements
- `wardrobeLibraryController.js`: auto-remove-bg on upload via Remove.bg API (non-blocking)
- CSS: `object-fit: contain`, padding, warm gradient background, hover zoom

### Other Fixes
- `UniversePage.jsx`: load universe from `show.universe_id` instead of hardcoded UUID
- `WorldDashboard.jsx`: `safeFetch` for page-content checks, correct URL (`/page-content/` not `/page-data/`)
- `SidebarProgress.jsx`: light pink background
- `FranchiseBrain.jsx`: routes point to new consolidated pages
- `WorldSetupGuide.jsx`: step routes point to new pages
- Silent catch linting fixes in episodeCompletionService

---

## What's Next: Screen Layer System

### Vision
**Canva for interactive mobile UI scenes** — a canvas-based editor where you compose phone screen overlays by layering elements, snapping to safe areas, and exporting production-ready images.

### Features to Build

#### 1. Canvas Engine
- Use **Fabric.js** or **HTML5 Canvas** for layer compositing
- Each screen overlay becomes a canvas with multiple layers
- Layers: background, UI elements, text, icons, character images
- Render to PNG/WebP for export

#### 2. Safe Area System
- Toggle safe area overlay showing usable screen bounds
- Different safe areas per device (iPhone notch, Android status bar)
- Visual guides: top bar, bottom bar, side margins
- Prevents UI from getting cut off in video

#### 3. Snap-to-Screen Placement
- Drag UI elements within the phone screen bounds
- Snap to grid (8px or 16px grid)
- Snap to edges and center lines
- Lock to phone screen boundaries

#### 4. Layer Management
- Layer panel: reorder (drag), hide (eye icon), lock (lock icon)
- Layer types: image, text, shape, icon, gradient
- Opacity per layer
- Blend modes (normal, multiply, overlay)
- Group layers

#### 5. Preset Frames
- iPhone 15 Pro (Dynamic Island)
- iPhone SE (Home button)
- Android (status bar + nav bar)
- Fantasy Phone (custom brand device — LalaVerse branded)
- Each preset has correct safe areas + aspect ratio

#### 6. Export Pipeline
- Clean export: no guides, no frame, just the screen content
- Framed export: screen + device frame
- Video-ready: correct resolution for 1080p/4K
- Batch export: all screens at once
- Format options: PNG (transparent), JPEG, WebP

#### 7. Text Tool
- Add text layers with font picker (Lora for prose, DM Mono for UI)
- Text styling: size, color, weight, alignment
- Text presets: notification text, DM message, username, caption

#### 8. Template System
- Save screen compositions as reusable templates
- Pre-built templates: Instagram feed, DM conversation, notification center
- Templates reference show data (character names, event titles)

### Architecture Suggestion

```
frontend/src/
  components/
    ScreenEditor/
      ScreenCanvas.jsx      — Fabric.js canvas wrapper
      LayerPanel.jsx         — layer list with reorder/hide/lock
      ToolBar.jsx            — tools: select, text, image, shape
      SafeAreaOverlay.jsx    — device-specific safe area guides
      FrameSelector.jsx      — device frame picker
      ExportModal.jsx        — export options + download
  pages/
    UIOverlaysTab.jsx        — integrates ScreenEditor into Phone Hub
```

### Backend Needs
- Store layer compositions as JSONB on overlay records
- Export endpoint that renders canvas server-side (optional — can be client-only)
- Template CRUD (save/load screen templates)

### Key Dependencies
- `fabric` npm package (canvas manipulation)
- Possibly `html2canvas` for fallback rendering
- Device frame SVGs/PNGs for preset frames

---

## Key Files Modified This Session

### New Files Created
- `frontend/src/data/dreamCities.js`
- `frontend/src/data/influencerData.js`
- `frontend/src/data/calendarData.js`
- `frontend/src/data/memoryData.js`
- `frontend/src/components/DreamMap.jsx`
- `frontend/src/components/PhoneHub.jsx`
- `frontend/src/components/Culture/EventsTab.jsx`
- `frontend/src/components/Culture/AwardsMediaTab.jsx`
- `frontend/src/components/Culture/HistoryTab.jsx`
- `frontend/src/pages/WorldFoundation.jsx`
- `frontend/src/pages/SocialSystems.jsx`
- `frontend/src/pages/CultureEvents.jsx`
- `frontend/src/pages/WorldDashboard.jsx`
- `src/migrations/20260725000000-unify-dream-cities.js`
- `src/migrations/20260725000001-add-location-to-social-profiles.js`

### Significantly Modified
- `frontend/src/pages/UIOverlaysTab.jsx` — full rewrite as Phone Hub
- `frontend/src/components/layout/Sidebar.jsx` — world building under FRANCHISE
- `frontend/src/App.jsx` — new routes + lazy imports
- `src/routes/worldStudio.js` — map upload, positions, DREAM seed infrastructure
- `src/routes/socialProfileRoutes.js` — DREAM cities, auto-location assignment
- `src/routes/calendarRoutes.js` — DREAM city mapping for events
- `src/services/eventAutomationService.js` — venue finding with host preference
- `src/services/episodeCompletionService.js` — franchise brain auto-push
- `src/models/SocialProfile.js` — DREAM city enum + location fields
- `src/models/WorldLocation.js` — residents association
- `src/controllers/wardrobeLibraryController.js` — auto-remove-bg
- `frontend/src/pages/WardrobeBrowser.css` — card styling improvements
- `frontend/src/pages/WorldAdmin.jsx` — tab URL persistence

### CLAUDE.md Rules Followed
- Backend: Node.js/Express, Sequelize ORM, PostgreSQL
- Frontend: React 18 + Vite, vanilla CSS / inline styles
- Auth: optionalAuth middleware
- All models soft-delete (paranoid mode, deleted_at)
- Design tokens: parchment #FAF7F0, gold #B8962E, ink #2C2C2C
- Typography: DM Mono for UI labels
- Icons: lucide-react
- State: React hooks only
