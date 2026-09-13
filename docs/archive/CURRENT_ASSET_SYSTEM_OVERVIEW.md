# Current Asset System Overview

## 📦 System Architecture

### Upload Flow
```
Episode Assets Tab → Upload Assets → Select Role → Auto-Derive Type → Upload to S3 → Link to Episode
```

### Key Files

1. **Frontend Upload Component**: `frontend/src/components/EpisodeAssetsTab.jsx`
2. **Asset Manager Page**: `frontend/src/pages/AssetManager.jsx`
3. **Backend Routes**: `src/routes/assets.js`
4. **Database Model**: `src/models/Asset.js`
5. **Latest Migration**: `src/migrations/20260208102717-add-asset-categories.js`

---

## 🎯 Current Asset Roles

### 🎭 CHARACTERS (4 roles)
```
CHAR.HOST.LALA                        → "Lala (Host)"
CHAR.HOST.JUSTAWOMANINHERPRIME        → "Just a Woman in Her Prime (Host)"
CHAR.GUEST.1                          → "Guest 1"
CHAR.GUEST.2                          → "Guest 2"
```

### 🎨 ICONS (17 roles) ✨ NEW: 8 Additional Icons
```
🔊 VOICE ICONS (Persistent - Slot 1)
UI.ICON.VOICE.IDLE                    → "Voice Icon (Idle)" ✨ NEW
UI.ICON.VOICE.ACTIVE                  → "Voice Icon (Active)" ✨ NEW

⚡ ACTION ICONS (Slot 2)
UI.ICON.CLOSET                        → "Icon: Closet"
UI.ICON.JEWELRY_BOX                   → "Icon: Jewelry Box"
UI.ICON.TODO_LIST                     → "Icon: To-Do List"
UI.ICON.PURSE                         → "Icon: Purse" ✨ NEW
UI.ICON.PERFUME                       → "Icon: Perfume"
UI.ICON.LOCATION                      → "Icon: Location Pin"
UI.ICON.SPEECH                        → "Icon: Speech Bubble"
UI.ICON.POSE                          → "Icon: Pose"
UI.ICON.RESERVED                      → "Icon: Reserved"
UI.ICON.HOLDER.MAIN                   → "Icon Holder"

🔔 NOTIFICATION ICONS (Slot 3)
UI.ICON.MAIL                          → "Icon: Mail" ✨ NEW
UI.ICON.BESTIE_NEWS                   → "Icon: Bestie News" ✨ NEW
UI.ICON.COINS                         → "Icon: Coins" ✨ NEW

🏛️ PERSISTENT ICONS (Slot 5)
UI.ICON.GALLERY                       → "Icon: Gallery" ✨ NEW
UI.ICON.CAREER_HISTORY                → "Icon: Career History" ✨ NEW
```

### 🏷️ BRANDING (1 role)
```
BRAND.SHOW.TITLE_GRAPHIC              → "Show Title Graphic"
```

### 🖼️ BACKGROUNDS & CHROME (4 roles)
```
BG.MAIN                               → "Background Image"
UI.MOUSE.CURSOR                       → "Mouse Cursor"
UI.BUTTON.EXIT                        → "Exit Button"
UI.BUTTON.MINIMIZE                    → "Minimize Button"
```

**TOTAL: 26 Asset Roles** (was 18, +8 new icon roles)

---

## 🗄️ Database Schema

### Asset Model Fields

```javascript
{
  id: UUID (Primary Key),
  asset_type: STRING,              // Legacy - kept for backward compatibility
  asset_role: STRING,              // NEW: Hierarchical role (e.g., CHAR.HOST.LALA)
  asset_group: ENUM,               // Identity bucket: LALA, SHOW, GUEST, EPISODE, WARDROBE
  asset_scope: ENUM,               // GLOBAL, SHOW, EPISODE
  show_id: UUID,                   // If scoped to SHOW
  episode_id: UUID,                // If scoped to EPISODE
  purpose: ENUM,                   // MAIN, TITLE, ICON, BACKGROUND
  allowed_uses: ARRAY<TEXT>,       // What this asset CAN be used for
  is_global: BOOLEAN,              // Global vs scoped availability
  name: STRING,
  s3_url_raw: TEXT,                // Original upload URL
  s3_url_processed: TEXT,          // Processed version (background removed, etc.)
  s3_key_raw: TEXT,
  file_name: STRING,
  content_type: STRING,
  media_type: STRING,
  width: INTEGER,
  height: INTEGER,
  file_size_bytes: INTEGER,
  approval_status: STRING,
  metadata: JSONB,
  processing_status: STRING,       // none, processing_bg_removal, bg_removed, etc.
  processing_metadata: JSONB,
  deleted_at: DATE                 // Soft delete
}
```

---

## 🎯 Upload Modal (EpisodeAssetsTab.jsx)

### Current Dropdown Structure

```jsx
<optgroup label="🎭 CHARACTERS">
  <option value="CHAR.HOST.LALA">Lala (Host)</option>
  <option value="CHAR.HOST.JUSTAWOMANINHERPRIME">Just a Woman in Her Prime (Host)</option>
  <option value="CHAR.GUEST.1">Guest 1</option>
  <option value="CHAR.GUEST.2">Guest 2</option>
</optgroup>

<optgroup label="🎯 ICONS - Voice (Slot 1 - Persistent)">
  <option value="UI.ICON.VOICE.IDLE">Voice Icon (Idle) ✨ NEW</option>
  <option value="UI.ICON.VOICE.ACTIVE">Voice Icon (Active) ✨ NEW</option>
</optgroup>

<optgroup label="🎯 ICONS - Action (Slot 2)">
  <option value="UI.ICON.CLOSET">Icon: Closet</option>
  <option value="UI.ICON.JEWELRY_BOX">Icon: Jewelry Box</option>
  <option value="UI.ICON.TODO_LIST">Icon: To-Do List</option>
  <option value="UI.ICON.PURSE">Icon: Purse ✨ NEW</option>
  <option value="UI.ICON.PERFUME">Icon: Perfume</option>
  <option value="UI.ICON.LOCATION">Icon: Location Pin</option>
  <option value="UI.ICON.SPEECH">Icon: Speech Bubble</option>
  <option value="UI.ICON.POSE">Icon: Pose</option>
  <option value="UI.ICON.RESERVED">Icon: Reserved</option>
  <option value="UI.ICON.HOLDER.MAIN">Icon Holder</option>
</optgroup>

<optgroup label="🎯 ICONS - Notification (Slot 3)">
  <option value="UI.ICON.MAIL">Icon: Mail ✨ NEW</option>
  <option value="UI.ICON.BESTIE_NEWS">Icon: Bestie News ✨ NEW</option>
  <option value="UI.ICON.COINS">Icon: Coins ✨ NEW</option>
</optgroup>

<optgroup label="🎯 ICONS - Persistent (Slot 5)">
  <option value="UI.ICON.GALLERY">Icon: Gallery ✨ NEW</option>
  <option value="UI.ICON.CAREER_HISTORY">Icon: Career History ✨ NEW</option>
</optgroup>

<optgroup label="🏷️ BRANDING">
  <option value="BRAND.SHOW.TITLE_GRAPHIC">Show Title Graphic</option>
</optgroup>

<optgroup label="🖼️ BACKGROUNDS & CHROME">
  <option value="BG.MAIN">Background Image</option>
  <option value="UI.MOUSE.CURSOR">Mouse Cursor</option>
  <option value="UI.BUTTON.EXIT">Exit Button</option>
  <option value="UI.BUTTON.MINIMIZE">Minimize Button</option>
</optgroup>
```

---

## 🔄 Auto-Derivation Logic

### Role → Type Mapping (getAssetTypeFromRole)

```javascript
CHAR.HOST.LALA               → PROMO_LALA
CHAR.HOST.JUSTAWOMANINHERPRIME → PROMO_JUSTAWOMANINHERPRIME
CHAR.GUEST.*                 → PROMO_GUEST
UI.ICON.*                    → BRAND_LOGO
BRAND.SHOW.*                 → PROMO_JUSTAWOMANINHERPRIME
BRAND.*                      → BRAND_LOGO
BG.*                         → BACKGROUND_IMAGE
UI.MOUSE.*                   → BACKGROUND_IMAGE
UI.BUTTON.*                  → BACKGROUND_IMAGE
```

---

## 🖥️ Asset Manager Page (AssetManager.jsx)

### Main Categories

```javascript
ALL: { label: 'All Assets', icon: '📦' }
CHARACTERS: { label: 'Characters', icon: '👥' }
ICONS: { label: 'Icons', icon: '🎨' }
BRANDING: { label: 'Branding', icon: '🏷️' }
BACKGROUNDS: { label: 'Backgrounds', icon: '🖼️' }
```

### Features
- ✅ Grid/List view toggle
- ✅ Search & filter by category
- ✅ Bulk operations (delete, label, download)
- ✅ Preview modal with download buttons
- ✅ Background removal processing
- ✅ Link existing assets to episodes

---

## 📊 Categories vs Roles vs Groups

| Concept | Purpose | Values |
|---------|---------|--------|
| **asset_role** | Canonical hierarchical identifier | `CHAR.HOST.LALA`, `UI.ICON.CLOSET`, etc. |
| **asset_group** | Identity bucket | `LALA`, `SHOW`, `GUEST`, `EPISODE`, `WARDROBE` |
| **asset_type** | Legacy field | `PROMO_LALA`, `BRAND_LOGO`, `BACKGROUND_IMAGE`, etc. |
| **purpose** | Category | `MAIN`, `TITLE`, `ICON`, `BACKGROUND` |
| **category** | Simple classification | `background`, `raw_footage`, `wardrobe`, `prop`, `graphic` |

---

## 🚀 API Endpoints

### Assets
```
POST   /api/v1/assets                    - Upload new asset
GET    /api/v1/assets                    - List all assets (with filters)
GET    /api/v1/assets/:id                - Get asset by ID
PUT    /api/v1/assets/:id                - Update asset
DELETE /api/v1/assets/:id                - Soft delete asset
POST   /api/v1/assets/:id/process-background - Process background removal
GET    /api/v1/assets/:id/download/:type - Generate download URL
```

### Episode Assets
```
GET    /api/v1/episodes/:episodeId/assets           - List episode assets
POST   /api/v1/episodes/:episodeId/assets           - Link assets to episode
DELETE /api/v1/episodes/:episodeId/assets/:assetId  - Unlink asset from episode
```

---

## 🔑 Key Features

### 1. Upload Flow
1. User selects **asset_role** from dropdown
2. System **auto-derives asset_type** from role
3. File uploads to S3 with metadata
4. Asset record created in database
5. Asset linked to episode

### 2. Background Removal
- Uses Runway ML or remove.bg API
- Creates `s3_url_processed` version
- Tracks `processing_status`
- Stores processing metadata

### 3. Download System
- Generates signed S3 URLs
- Supports both raw and processed versions
- Links open in new tab for download

### 4. Asset Picker
- EnhancedAssetPicker component
- Allows linking existing assets to episodes
- Supports multi-select

---

## 📝 Notes

1. **Upload Location**: Assets must be uploaded via Episode Assets tab (not directly to Asset Manager)
2. **Asset Scope**: Each asset can be GLOBAL, SHOW-scoped, or EPISODE-scoped
3. **Soft Delete**: Assets have `deleted_at` field for soft deletion
4. **Processing**: Background removal is optional and creates a separate processed version
5. **Metadata**: JSONB field stores additional processing parameters and results

---

## 🎯 Current System Status

Currently your system supports:
- ✅ 4 character roles
- ✅ **17 icon roles** (was 9, +8 new roles) ✨
- ✅ 1 branding role
- ✅ 4 background/chrome roles

**Total: 26 roles** (was 18, +8 new icon roles)

### ✨ Recent Additions (2026-02-09)

**8 New Icon Roles Added:**
1. `UI.ICON.VOICE.IDLE` - Persistent voice control (Slot 1)
2. `UI.ICON.VOICE.ACTIVE` - Active voice state (Slot 1)
3. `UI.ICON.PURSE` - Purse/bag access (Slot 2)
4. `UI.ICON.MAIL` - Mail notification (Slot 3)
5. `UI.ICON.BESTIE_NEWS` - Bestie news notification (Slot 3)
6. `UI.ICON.COINS` - Coins/currency notification (Slot 3)
7. `UI.ICON.GALLERY` - Gallery/career history (Slot 5)
8. `UI.ICON.CAREER_HISTORY` - Career achievements (Slot 5)

**Icon Cue Timeline System Integrated:**
- Database: 17 icon slot mappings created
- Backend: 49 API endpoints for icon cues, cursor paths, music cues, production packages
- Frontend: IconCueTimeline page, ProductionPackageExporter component
- AI Integration: Claude API for icon cue generation
- S3 Bucket: `episode-metadata-production-packages` for ZIP exports

See [ICON_CUE_TIMELINE_INSTALLATION_COMPLETE.md](ICON_CUE_TIMELINE_INSTALLATION_COMPLETE.md) for full details.

**Note:** The system is architected to easily add more roles - just add them to the dropdown in EpisodeAssetsTab.jsx!
