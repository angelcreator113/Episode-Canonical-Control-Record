# Asset Roles System - Implementation Summary

## Overview
Implemented a comprehensive asset roles system to standardize how assets are categorized and used across the application, replacing the generic "uploads" approach with semantic role assignments.

## Database Migration ✅

### Tables Created
- **asset_roles**: Show-level role registry
  - `id` (UUID): Primary key
  - `show_id` (UUID): Foreign key to shows table
  - `role_key` (VARCHAR): Immutable identifier (HOST, GUEST_1, etc.)
  - `role_label` (VARCHAR): Editable display name
  - `category` (VARCHAR): Grouping (Characters, UI Icons, UI Chrome, Branding, Background)
  - `icon` (VARCHAR): Emoji for UI display
  - `color` (VARCHAR): Hex color for UI theming
  - `is_required` (BOOLEAN): Must be filled for composer export
  - `sort_order` (INTEGER): Display ordering
  - `description` (TEXT): Role purpose explanation
  - Unique constraint on `(show_id, role_key)`

### Columns Added
- **assets.role_key** (VARCHAR): References asset_roles.role_key

### Triggers Created
- `create_default_roles_for_show()`: Auto-populates 17 default roles for new shows
- `trigger_create_default_roles`: Fires after show insertion

### Default Roles (17 Total)

#### Characters (5 roles)
- **HOST** - Host (Lala) - *REQUIRED* 👩
- **CO_HOST** - Co-Host 👤
- **GUEST_1** - Guest 1 🎤
- **GUEST_2** - Guest 2 🎤
- **GUEST_3** - Guest 3 🎤

#### UI Icons (4 roles)
- **ICON_CLOSET** - Closet Icon 👗
- **ICON_JEWELRY** - Jewelry Box Icon 💎
- **ICON_SHOES** - Shoes Icon 👠
- **ICON_MAKEUP** - Makeup Icon 💄

#### UI Chrome (3 roles)
- **CHROME_CURSOR** - Cursor/Pointer 👆
- **CHROME_EXIT** - Exit Button ❌
- **CHROME_MINIMIZE** - Minimize Button ➖

#### Branding (3 roles)
- **BRAND_SHOW_TITLE** - Show Title Logo - *REQUIRED* ✨
- **BRAND_SUBTITLE** - Episode Subtitle 📝
- **BRAND_WATERMARK** - Watermark 🔖

#### Background (2 roles)
- **BACKGROUND_MAIN** - Background - *REQUIRED* 🌄
- **BACKGROUND_OVERLAY** - Background Overlay 🎨

## Backend Implementation ✅

### Models
**File**: `src/models/AssetRole.js`
- Sequelize model for asset_roles table
- Includes DEFAULT_ROLES constant array
- Factory function pattern matching app architecture

### Services
**File**: `src/services/AssetRoleService.js`
- `getRolesForShow(showId)`: Fetch all roles for a show
- `getRoleByKey(showId, roleKey)`: Get specific role
- `createRole(showId, roleData)`: Add custom role
- `updateRole(showId, roleKey, updates)`: Edit role properties
- `deleteRole(showId, roleKey)`: Remove custom role
- `assignRoleToAsset(assetId, roleKey)`: Assign role to asset
- `bulkAssignRoles(assignments)`: Bulk assignment [{assetId, roleKey}]
- `getAssetsByRole(showId, roleKey)`: Find assets with specific role
- `getLatestAssetsForRequiredRoles(showId)`: Get most recent asset per required role
- `validateRequiredRoles(showId)`: Check if all required roles have assets
- `getRoleUsageStats(showId)`: Count assets per role

### Routes
**File**: `src/routes/roles.js`
- `GET /api/v1/roles?showId=xxx`: List all roles for show
- `GET /api/v1/roles/stats?showId=xxx`: Role usage statistics
- `GET /api/v1/roles/:roleKey?showId=xxx`: Get specific role details
- `POST /api/v1/roles`: Create custom role
- `PUT /api/v1/roles/:roleKey`: Update role properties
- `DELETE /api/v1/roles/:roleKey`: Delete role
- `POST /api/v1/roles/bulk-assign`: Bulk assign roles to assets
- `GET /api/v1/roles/:roleKey/assets?showId=xxx`: Get assets for role
- `POST /api/v1/roles/validate-required?showId=xxx`: Validate required roles

## Frontend Constants ✅

**File**: `frontend/src/constants/assetRoles.js`
- `DEFAULT_ASSET_ROLES`: Array of all 17 default roles
- `getRoleByKey(roleKey)`: Lookup role by key
- `getRequiredRoles()`: Filter required roles only
- `groupRolesByCategory()`: Group roles for UI display
- `validateRequiredRoles(assets)`: Check if assets cover required roles

## Key Design Decisions

### 1. Show-Level vs Workspace-Level
✅ **Decision**: Show-level roles
- Rationale: App uses "shows" not "workspaces" as top-level entity
- Each show gets its own role registry
- Allows show-specific customization if needed

### 2. Single Role Per Asset
✅ **Decision**: One role per asset (role_key column)
- Rationale: Simple, deterministic, avoids conflicts
- Alternative (many-to-many) rejected for complexity

### 3. Keep asset_type
✅ **Decision**: Maintain both asset_type and role_key
- `asset_type`: Media classification (image, video, gif)
- `role_key`: Semantic usage slot (HOST, BACKGROUND_MAIN)
- Complementary, not redundant

### 4. Required Roles
✅ **Decision**: 3 required roles
- `HOST`: Primary show host
- `BRAND_SHOW_TITLE`: Show title/logo
- `BACKGROUND_MAIN`: Background image
- Blocks thumbnail composer export if missing

### 5. Immutable role_key, Editable role_label
✅ **Decision**: Keys fixed, labels customizable
- Code references role_key (stable)
- UI shows role_label (user-friendly)
- Users can rename "Host (Lala)" → "Main Host" without breaking code

## Testing Verification ✅

Ran test script confirming:
- ✅ Migration executed successfully
- ✅ UUID extension enabled
- ✅ asset_roles table created
- ✅ role_key column added to assets
- ✅ All 17 default roles inserted
- ✅ Trigger function created
- ✅ Server starts without errors
- ✅ Roles API routes loaded

## Next Steps (Frontend UI)

### 1. Role Management Page
**Location**: Settings → Asset Roles
- List all roles in table/grid
- Edit role labels, colors, icons
- Reorder roles (drag/drop)
- Toggle is_required flag
- Add custom roles
- Delete custom roles (prevent deletion of defaults)

### 2. Asset Edit Modal
**Location**: Asset Manager → Edit Asset
- Add "Role" dropdown field
- Show current role or "Unassigned"
- Filter dropdown by asset_type (e.g., videos only see HOST, CO_HOST, GUEST_*)
- Show role icon and color in dropdown

### 3. Bulk Role Assignment Tool
**Location**: Asset Manager → Bulk Actions
- Select multiple unassigned assets
- Suggest roles based on asset_type
- Assign same role to selection
- Show progress/confirmation

### 4. Asset Manager Role Filtering
**Location**: Asset Manager sidebar
- Add "Filter by Role" dropdown
- Group by category (Characters, UI, Branding, Background)
- Show asset count per role
- "Unassigned" option to find unmapped assets

### 5. Thumbnail Composer Integration
**Location**: Thumbnail Composer
- Declare required roles in template
- Auto-select latest asset per role
- Filter asset dropdowns by compatible roles
- Show warnings for missing required roles
- Block export if required roles unassigned
- Visual indicators (⚠️) for missing roles

### 6. Unassigned Asset Badge
**Location**: Asset cards throughout UI
- Show "Unassigned" badge on assets without role_key
- Orange/yellow color to indicate needs attention
- Quick-assign button on hover

## API Examples

### Get Roles for Show
```javascript
GET /api/v1/roles?showId=32bfbf8b-1f46-46dd-8a5d-3b705d324c1b

Response:
[
  {
    "id": "...",
    "show_id": "32bfbf8b-1f46-46dd-8a5d-3b705d324c1b",
    "role_key": "HOST",
    "role_label": "Host (Lala)",
    "category": "Characters",
    "icon": "👩",
    "color": "#ec4899",
    "is_required": true,
    "sort_order": 1,
    "description": "Primary show host"
  },
  ...
]
```

### Assign Role to Asset
```javascript
POST /api/v1/roles/bulk-assign
{
  "assignments": [
    { "assetId": "asset-uuid-1", "roleKey": "HOST" },
    { "assetId": "asset-uuid-2", "roleKey": "BACKGROUND_MAIN" }
  ]
}
```

### Validate Required Roles
```javascript
POST /api/v1/roles/validate-required?showId=xxx

Response:
{
  "valid": false,
  "missing": ["BRAND_SHOW_TITLE"],
  "filled": ["HOST", "BACKGROUND_MAIN"]
}
```

### Get Assets by Role
```javascript
GET /api/v1/roles/HOST/assets?showId=xxx

Response:
[
  {
    "id": "...",
    "name": "lala-host-v1.png",
    "asset_type": "image",
    "role_key": "HOST",
    "uploaded_at": "2025-01-30T10:00:00Z"
  }
]
```

## Files Created/Modified

### Created
- ✅ `add-asset-roles-table.sql`
- ✅ `run-roles-migration.js`
- ✅ `src/models/AssetRole.js`
- ✅ `src/services/AssetRoleService.js`
- ✅ `src/routes/roles.js`
- ✅ `frontend/src/constants/assetRoles.js`
- ✅ `test-roles.js`

### Modified
- ✅ `src/app.js` (added roles route registration)

## Documentation
- ✅ Migration script with inline comments
- ✅ Service methods with JSDoc comments
- ✅ Frontend constants with helper function descriptions
- ✅ This summary document

## Status: Backend Complete ✅
- Database schema: ✅
- Migration: ✅
- Models: ✅
- Services: ✅
- Routes: ✅
- API: ✅
- Frontend constants: ✅
- Server running: ✅

## Status: Frontend UI Pending
- Role management page: ⏳
- Asset edit modal integration: ⏳
- Bulk assignment tool: ⏳
- Asset Manager filtering: ⏳
- Composer integration: ⏳
- Unassigned badges: ⏳
