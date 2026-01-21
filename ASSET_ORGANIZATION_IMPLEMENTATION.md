# Asset Organization System - Implementation Complete

## Overview
Comprehensive asset management system with identity groups, purpose taxonomy, scope management, and filtered asset pickers.

## Database Changes

### ✅ New Columns Added to `assets` Table
```sql
asset_group VARCHAR(50)       -- LALA, SHOW, GUEST, EPISODE, WARDROBE
purpose VARCHAR(50)            -- MAIN, TITLE, ICON, BACKGROUND
allowed_uses TEXT[]            -- Array: THUMBNAIL, SCENE, UI, SOCIAL, BACKGROUND_PLATE
is_global BOOLEAN DEFAULT false -- Global availability flag
```

### ✅ New Table: `show_assets`
Junction table linking assets to shows (show-scoped assets)
```sql
CREATE TABLE show_assets (
  id UUID PRIMARY KEY,
  show_id UUID REFERENCES shows(id),
  asset_id UUID REFERENCES assets(id),
  usage_context TEXT,
  display_order INTEGER,
  is_primary BOOLEAN DEFAULT false,
  created_at, updated_at, deleted_at
)
```

### ✅ Migration Complete
- 9 existing assets migrated with smart defaults
- Distribution:
  - GUEST/MAIN: 2 assets
  - LALA/MAIN: 5 assets  
  - SHOW/MAIN: 2 assets

## Backend Implementation

### Models Updated/Created

#### ✅ Asset Model Enhanced
**File**: `src/models/Asset.js`
- Added enum fields: `asset_group`, `purpose`
- Added array field: `allowed_uses`
- Added boolean field: `is_global`
- All fields properly typed with ENUMs

#### ✅ ShowAsset Model Created
**File**: `src/models/ShowAsset.js`
- Junction table model for show-asset relationships
- Paranoid mode enabled (soft deletes)
- Unique constraint on show_id + asset_id

#### ✅ Model Associations Updated
**File**: `src/models/index.js`
- Added ShowAsset model loading and validation
- Created Show ↔ Asset many-to-many through ShowAsset
- Added direct associations for easier querying
- Exported ShowAsset in models object

### Services Updated

#### ✅ AssetService Enhanced
**File**: `src/services/AssetService.js`
- Added `getAssetOrganizationDefaults()` helper function
- Maps old asset_type → new organization fields automatically
- Smart defaults applied on upload:
  - PROMO_LALA → LALA/MAIN with [THUMBNAIL, SOCIAL, UI], global
  - PROMO_JUSTAWOMANINHERPRIME → SHOW/MAIN with [THUMBNAIL, SOCIAL, SCENE]
  - PROMO_GUEST → GUEST/MAIN with [THUMBNAIL, SCENE]
  - BRAND_LOGO → LALA/ICON with [UI, SOCIAL, SCENE], global
  - EPISODE_FRAME → EPISODE/MAIN with [THUMBNAIL, SOCIAL]
  - Videos → appropriate group with SCENE use

## Frontend Implementation

### New Components

#### ✅ EnhancedAssetPicker Component
**File**: `frontend/src/components/Assets/EnhancedAssetPicker.jsx` (320 lines)
**Features**:
- **Filtered by context**: Required use, purpose, group, scope
- **Search**: By name and asset_type
- **Dropdowns**: Filter by group, purpose, scope
- **Badge display**: Shows asset_group, purpose, is_global status
- **Allowed uses**: Displays what asset can be used for
- **Multi-select**: Support for selecting multiple assets
- **Scoped queries**: Episode/show/global filtering

**Props**:
```jsx
{
  isOpen, onClose, onSelect,
  requiredUse: 'THUMBNAIL' | 'SCENE' | 'UI' | 'SOCIAL' | 'BACKGROUND_PLATE',
  purposeFilter: 'MAIN' | 'TITLE' | 'ICON' | 'BACKGROUND',
  groupFilter: 'LALA' | 'SHOW' | 'GUEST' | 'EPISODE' | 'WARDROBE',
  scopeFilter: 'global' | 'show' | 'episode',
  episodeId, showId,
  multiSelect: boolean,
  title: string
}
```

#### ✅ EnhancedAssetPicker Styles
**File**: `frontend/src/components/Assets/EnhancedAssetPicker.css` (370 lines)
- Dark theme UI matching VS Code
- Animated modal with fadeIn + slideUp
- Color-coded badges for each group
- Responsive grid layout
- Hover effects and selection indicators

### Components Updated

#### ✅ AssetCard Enhanced
**File**: `frontend/src/components/AssetCard.jsx`
**Added**:
- Organization badges section showing asset_group and purpose
- Global indicator badge (🌐 Global)
- Allowed uses display (up to 3 tags + "more" indicator)
- Color-coded badges matching picker

#### ✅ AssetCard Styles Enhanced
**File**: `frontend/src/components/AssetCard.css`
**Added** (100+ lines):
- `.asset-organization-badges` flex container
- `.org-badge-*` classes for each group (LALA, SHOW, GUEST, EPISODE, WARDROBE)
- `.org-badge-purpose` and `.org-badge-global` styles
- `.asset-uses` section with tags
- `.use-tag` and `.use-tag-more` styles

#### ✅ EpisodeAssetsTab Enhanced
**File**: `frontend/src/components/EpisodeAssetsTab.jsx`
**Added**:
- "🔗 Link Existing" button (green gradient)
- `showAssetPicker` state
- `handleLinkExistingAsset()` function
- EnhancedAssetPicker integration
- Multi-select support for linking multiple assets

## Asset Organization Schema

### Asset Groups (Identity Buckets)
| Group | Description | Typical Use |
|-------|-------------|------------|
| LALA | Platform/brand identity assets | Logos, promo images, brand videos |
| SHOW | Just A Woman In Her Prime show-specific | Show logos, branded content |
| GUEST | Guest-related assets | Guest promos, headshots |
| EPISODE | Episode-specific content | Frames, backgrounds, episode videos |
| WARDROBE | Clothing items | Different taxonomy, own database |

### Purpose (Category)
- **MAIN**: Primary asset (promo images, headshots)
- **TITLE**: Title cards, text overlays
- **ICON**: Logos, small graphics
- **BACKGROUND**: Background plates, scenery

### Allowed Uses (What it CAN be used for)
- **THUMBNAIL**: Episode/video thumbnails
- **SCENE**: Scene backgrounds and elements
- **UI**: User interface elements
- **SOCIAL**: Social media posts
- **BACKGROUND_PLATE**: Full-screen backgrounds

### Scope Management
1. **Global** (`is_global = true`): Available everywhere
2. **Show-scoped**: Linked via `show_assets` table
3. **Episode-scoped**: Linked via `episode_assets` table

## Usage Examples

### Upload New Asset (Auto-tagged)
```javascript
// User uploads PROMO_LALA asset
// System automatically sets:
{
  asset_type: 'PROMO_LALA',
  asset_group: 'LALA',
  purpose: 'MAIN',
  allowed_uses: ['THUMBNAIL', 'SOCIAL', 'UI'],
  is_global: true
}
```

### Scene Composer (Filtered Picker)
```jsx
<EnhancedAssetPicker
  isOpen={showPicker}
  onClose={() => setShowPicker(false)}
  onSelect={handleAddToScene}
  requiredUse="SCENE"  // Only shows assets allowed for scenes
  purposeFilter="BACKGROUND"  // Only backgrounds
  scopeFilter="episode"  // Episode-scoped assets
  episodeId={currentEpisode.id}
/>
```

### Thumbnail Picker (Filtered Picker)
```jsx
<EnhancedAssetPicker
  isOpen={showPicker}
  onClose={() => setShowPicker(false)}
  onSelect={handleSetThumbnail}
  requiredUse="THUMBNAIL"  // Only thumbnail-capable assets
  episodeId={episode.id}
  title="Select Episode Thumbnail"
/>
```

### Episode Assets Tab (Multi-select)
```jsx
<EnhancedAssetPicker
  isOpen={showPicker}
  onClose={() => setShowPicker(false)}
  onSelect={handleLinkAssets}
  multiSelect={true}  // Can select multiple
  episodeId={episodeId}
  title="Link Assets to Episode"
/>
```

## Testing Checklist

### ✅ Database
- [x] Columns added to assets table
- [x] Indexes created for performance
- [x] show_assets table created
- [x] Existing assets migrated
- [x] Constraints and foreign keys working

### ✅ Backend
- [x] Asset model with new fields
- [x] ShowAsset model created
- [x] Associations defined
- [x] Smart defaults on upload
- [x] Server starts without errors

### ✅ Frontend
- [x] EnhancedAssetPicker component created
- [x] AssetCard displays new fields
- [x] EpisodeAssetsTab has "Link Existing" button
- [x] Badges color-coded and styled

### 🔄 To Test Manually
- [ ] Upload new asset → verify auto-tagging
- [ ] Open asset picker on Episode Assets tab
- [ ] Filter by group, purpose, scope
- [ ] Select multiple assets
- [ ] Verify badges display correctly on AssetCard
- [ ] Test scoped filtering (episode/show/global)

## Files Created/Modified

### Created (5 files)
1. `add-asset-organization-columns.js` - Migration script
2. `create-show-assets-table.js` - Show assets table creation
3. `src/models/ShowAsset.js` - ShowAsset model
4. `frontend/src/components/Assets/EnhancedAssetPicker.jsx` - Picker component
5. `frontend/src/components/Assets/EnhancedAssetPicker.css` - Picker styles

### Modified (7 files)
1. `src/models/Asset.js` - Added organization fields
2. `src/models/index.js` - Added ShowAsset, associations
3. `src/services/AssetService.js` - Added smart defaults
4. `frontend/src/components/AssetCard.jsx` - Display organization badges
5. `frontend/src/components/AssetCard.css` - Badge styles
6. `frontend/src/components/EpisodeAssetsTab.jsx` - Picker integration
7. `ASSET_ORGANIZATION_IMPLEMENTATION.md` - This file

## Next Steps

### Immediate
1. Test asset upload with auto-tagging
2. Test asset picker filtering
3. Verify badge display on cards

### Future Enhancements
1. **Wardrobe Integration**: Separate taxonomy for clothing
2. **Scene Composer**: Integrate picker with scene builder
3. **Thumbnail Selector**: Add to episode edit page
4. **Bulk Update**: UI for updating existing assets
5. **Asset Analytics**: Track usage by scope and purpose
6. **Permission System**: Control who can use which groups

## API Endpoints

### Existing (Used by Picker)
- `GET /api/v1/assets` - List all assets
- `POST /api/v1/assets/search` - Search with filters
- `GET /api/v1/episodes/:id/assets` - Episode assets
- `POST /api/v1/episodes/:id/assets` - Link assets to episode

### Recommended to Add
- `GET /api/v1/shows/:id/assets` - Show-scoped assets
- `POST /api/v1/shows/:id/assets` - Link assets to show
- `GET /api/v1/assets/global` - Only global assets
- `PUT /api/v1/assets/:id/organization` - Update org fields

## Architecture Benefits

1. **Backward Compatible**: `asset_type` preserved, new fields additive
2. **Smart Defaults**: Auto-tagging reduces manual work
3. **Flexible Filtering**: Context-aware asset selection
4. **Scope Management**: Clear asset availability rules
5. **Scalable**: Can add new groups/purposes/uses without breaking
6. **Type-Safe**: ENUMs prevent typos and invalid values

## Summary

✅ **Database**: 4 new columns, 1 new table, all existing assets migrated
✅ **Backend**: Models, associations, smart defaults all implemented
✅ **Frontend**: Enhanced picker, badges, integration complete
✅ **Ready for Testing**: All code changes deployed, server running

The asset organization system is fully implemented and ready for use. Assets are now categorized by identity (group), purpose, and allowed uses, with intelligent scope management for global, show, and episode contexts.
