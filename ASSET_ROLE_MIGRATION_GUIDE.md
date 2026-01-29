# Asset Role Migration Guide

## Overview
This guide walks you through migrating existing asset roles to the new canonical naming system.

## What Changed?

### Old Roles → New Canonical Roles
```
CHAR.HOST.PRIMARY        → CHAR.HOST.LALA
CHAR.CO_HOST.PRIMARY     → CHAR.HOST.JUSTAWOMANINHERPRIME
GUEST.REACTION.1         → CHAR.GUEST.1
GUEST.REACTION.2         → CHAR.GUEST.2
```

## Why This Change?

The new canonical roles:
- **Match template requirements exactly** - Templates expect `CHAR.HOST.LALA`, not `CHAR.HOST.PRIMARY`
- **Are more descriptive** - `CHAR.HOST.LALA` tells you it's Lala, not just "primary host"
- **Prevent composition errors** - Asset role picker won't work if names don't match
- **Enable AI processing** - Processing service needs canonical names to apply correct effects

## Pre-Migration Steps

### 1. Backup Your Database
```bash
# PostgreSQL backup
pg_dump your_database_name > backup_$(date +%Y%m%d_%H%M%S).sql

# Or using pgAdmin - right-click database → Backup
```

### 2. Check Current Asset Roles
```bash
# Connect to PostgreSQL
psql your_database_name

# View current asset role distribution
SELECT asset_role, COUNT(*) as count 
FROM assets 
WHERE asset_role IS NOT NULL 
GROUP BY asset_role 
ORDER BY count DESC;
```

Expected output:
```
       asset_role        | count
-------------------------+-------
 CHAR.HOST.PRIMARY       |   45
 CHAR.CO_HOST.PRIMARY    |   38
 BG.MAIN                 |   12
 GUEST.REACTION.1        |    8
 WARDROBE.ITEM.1         |   15
```

## Running the Migration

### Option 1: Automated Script (Recommended)
```bash
# Make sure you're in the project root
cd c:\Users\12483\Projects\Episode-Canonical-Control-Record-1

# Run the migration script
node migrate-asset-roles-to-canonical.js
```

Expected output:
```
🔧 Starting Asset Role Migration to Canonical Names...

📊 Found 91 assets to migrate

🔄 Migrating CHAR.HOST.PRIMARY → CHAR.HOST.LALA
   ✓ Updated 45 assets

🔄 Migrating CHAR.CO_HOST.PRIMARY → CHAR.HOST.JUSTAWOMANINHERPRIME
   ✓ Updated 38 assets

🔄 Migrating GUEST.REACTION.1 → CHAR.GUEST.1
   ✓ Updated 8 assets

🔄 Migrating GUEST.REACTION.2 → CHAR.GUEST.2
   ✓ Updated 0 assets

════════════════════════════════════════════════════════════
✅ Migration Complete! Updated 91 assets
════════════════════════════════════════════════════════════

📊 Current Asset Role Distribution:
────────────────────────────────────────────────────────────
   CHAR.HOST.LALA                           45 assets
   CHAR.HOST.JUSTAWOMANINHERPRIME           38 assets
   BG.MAIN                                  12 assets
   CHAR.GUEST.1                              8 assets
   WARDROBE.ITEM.1                          15 assets
────────────────────────────────────────────────────────────
```

### Option 2: Manual SQL (If Script Fails)
```sql
-- Start transaction
BEGIN;

-- Migration 1: CHAR.HOST.PRIMARY → CHAR.HOST.LALA
UPDATE assets 
SET asset_role = 'CHAR.HOST.LALA' 
WHERE asset_role = 'CHAR.HOST.PRIMARY';

-- Migration 2: CHAR.CO_HOST.PRIMARY → CHAR.HOST.JUSTAWOMANINHERPRIME
UPDATE assets 
SET asset_role = 'CHAR.HOST.JUSTAWOMANINHERPRIME' 
WHERE asset_role = 'CHAR.CO_HOST.PRIMARY';

-- Migration 3: GUEST.REACTION.1 → CHAR.GUEST.1
UPDATE assets 
SET asset_role = 'CHAR.GUEST.1' 
WHERE asset_role = 'GUEST.REACTION.1';

-- Migration 4: GUEST.REACTION.2 → CHAR.GUEST.2
UPDATE assets 
SET asset_role = 'CHAR.GUEST.2' 
WHERE asset_role = 'GUEST.REACTION.2';

-- Verify changes
SELECT asset_role, COUNT(*) 
FROM assets 
WHERE asset_role IN (
  'CHAR.HOST.LALA',
  'CHAR.HOST.JUSTAWOMANINHERPRIME',
  'CHAR.GUEST.1',
  'CHAR.GUEST.2'
)
GROUP BY asset_role;

-- If everything looks good, commit
COMMIT;

-- If something went wrong, rollback
-- ROLLBACK;
```

## Post-Migration Verification

### 1. Check Database
```sql
-- Verify no old roles remain
SELECT asset_role, COUNT(*) 
FROM assets 
WHERE asset_role IN (
  'CHAR.HOST.PRIMARY',
  'CHAR.CO_HOST.PRIMARY',
  'GUEST.REACTION.1',
  'GUEST.REACTION.2'
)
GROUP BY asset_role;
-- Should return 0 rows
```

### 2. Test Frontend
```bash
# Start backend (if not running)
npm run dev

# Navigate to Asset Manager
http://localhost:3000/assets

# Verify:
# ✓ Asset Role field shows canonical names in autocomplete
# ✓ Existing assets display canonical roles correctly
# ✓ Validation shows ✓ for canonical roles
```

### 3. Test Thumbnail Composer
```bash
# Navigate to composer
http://localhost:3000/composer/[episodeId]

# Test asset selection:
# ✓ Asset role picker shows assets with canonical roles
# ✓ CHAR.HOST.LALA assets appear under "Lala (Host)"
# ✓ CHAR.HOST.JUSTAWOMANINHERPRIME assets appear under "JustAWoman (Co-Host)"
# ✓ No "missing assets" warnings for required roles
```

## Troubleshooting

### Issue: "Cannot find module './src/models'"
```bash
# Make sure you're running from project root
cd c:\Users\12483\Projects\Episode-Canonical-Control-Record-1
node migrate-asset-roles-to-canonical.js
```

### Issue: "Connection refused"
```bash
# Check PostgreSQL is running
# Windows: Services → PostgreSQL → Start
# OR check your .env file has correct DATABASE_URL
```

### Issue: Migration runs but no assets updated
- Means all your assets already use canonical names! ✅
- Check current roles: `SELECT DISTINCT asset_role FROM assets;`

### Issue: Need to revert migration
```bash
# Restore from backup
psql your_database_name < backup_20240115_143000.sql

# Or manual SQL revert
UPDATE assets SET asset_role = 'CHAR.HOST.PRIMARY' WHERE asset_role = 'CHAR.HOST.LALA';
UPDATE assets SET asset_role = 'CHAR.CO_HOST.PRIMARY' WHERE asset_role = 'CHAR.HOST.JUSTAWOMANINHERPRIME';
UPDATE assets SET asset_role = 'GUEST.REACTION.1' WHERE asset_role = 'CHAR.GUEST.1';
UPDATE assets SET asset_role = 'GUEST.REACTION.2' WHERE asset_role = 'CHAR.GUEST.2';
```

## What Happens Next?

After migration:
1. **New uploads** will use canonical roles (AssetManager enforces this)
2. **Templates** will find assets correctly by role
3. **Processing** will work with role-specific settings
4. **Composition** will match assets to template slots properly

## Complete Canonical Roles Reference

### Characters (Required for most templates)
- `CHAR.HOST.LALA` - Lala (Primary Host) 👩
- `CHAR.HOST.JUSTAWOMANINHERPRIME` - JustAWoman (Co-Host) 💜
- `CHAR.GUEST.1` - Primary Guest 👤
- `CHAR.GUEST.2` - Secondary Guest 👥

### Backgrounds
- `BG.MAIN` - Main background image 🖼️
- `BG.PATTERN` - Background pattern or texture

### Wardrobe (8 slots)
- `WARDROBE.ITEM.1` through `WARDROBE.ITEM.8` - Outfit pieces

### UI Icons (8 types)
- `UI.ICON.CLOSET` 👗
- `UI.ICON.JEWELRY_BOX` 💎
- `UI.ICON.TODO_LIST` 📋
- `UI.ICON.SPEECH` 💬
- `UI.ICON.LOCATION` 📍
- `UI.ICON.PERFUME` 🧴
- `UI.ICON.CALENDAR` 📅
- `UI.ICON.COFFEE` ☕

### Branding
- `BRAND.SHOW.TITLE_GRAPHIC` - Show title/logo
- `BRAND.SHOW.LOGO` - Show logo only
- `BRAND.SPONSOR.LOGO` - Sponsor branding

### Text Overlays
- `TEXT.TITLE` - Episode title text
- `TEXT.SUBTITLE` - Episode subtitle
- `TEXT.CTA` - Call-to-action text

## Need Help?

- Check [frontend/src/constants/canonicalRoles.js](frontend/src/constants/canonicalRoles.js) for complete role definitions
- Review [src/constants/canonicalRoles.js](src/constants/canonicalRoles.js) for backend validation
- See [AssetManager.jsx](frontend/src/pages/AssetManager.jsx) for role suggestion logic
