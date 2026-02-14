# 🚀 Scene Composer Phase 1 - Deployment Guide

**Date:** February 9, 2026  
**Version:** Phase 1 - Database + API

---

## ✅ What Was Implemented

### 1. Database Changes
- ✅ Extended `scenes` table with 4 new columns:
  - `layout` (JSONB) - Spatial composition data
  - `duration_auto` (BOOLEAN) - Auto vs manual duration
  - `status` (VARCHAR) - Scene completion status
  - Converted `duration_seconds` from INTEGER to DECIMAL(10,2)
- ✅ Added helper functions:
  - `calculate_scene_duration(UUID)` - Auto-calculate from clips
  - `check_scene_complete(UUID)` - Validate completeness
- ✅ Added indexes and constraints

### 2. Model Updates
- ✅ Extended `Scene` model with new fields
- ✅ Added camelCase aliases for API compatibility

### 3. API Endpoints
- ✅ 6 new scene composer endpoints:
  - `POST /scenes/:id/calculate-duration`
  - `GET /scenes/:id/completeness`
  - `POST /scenes/:id/assets`
  - `GET /scenes/:id/assets`
  - `PUT /scenes/:id/assets/:asset_id`
  - `DELETE /scenes/:id/assets/:asset_id`

### 4. Documentation
- ✅ Complete API documentation with examples
- ✅ Migration scripts with rollback
- ✅ This deployment guide

---

## 📋 Pre-Deployment Checklist

### Development Environment

- [ ] Node.js is running
- [ ] PostgreSQL database is accessible
- [ ] Environment variables are set (`.env`)
- [ ] Database backup created (just in case)

### Verify Current State

```bash
# Check if scenes table exists
node -e "const {models} = require('./src/models'); (async () => { const result = await models.sequelize.query('SELECT COUNT(*) FROM scenes', {type: models.sequelize.QueryTypes.SELECT}); console.log('Scenes exist:', result[0].count); process.exit(0); })();"

# Check if scene_assets table exists
node -e "const {models} = require('./src/models'); (async () => { const result = await models.sequelize.query('SELECT COUNT(*) FROM scene_assets', {type: models.sequelize.QueryTypes.SELECT}); console.log('Scene assets exist:', result[0].count); process.exit(0); })();"
```

---

## 🚀 Deployment Steps

### Step 1: Run Migration

```bash
cd c:\Users\12483\Projects\Episode-Canonical-Control-Record-1

# Run the migration
npx sequelize-cli db:migrate
```

**Expected Output:**
```
Sequelize CLI [Node: 18.x.x, CLI: 6.x.x, ORM: 6.x.x]

Loaded configuration file "config/database.js".
Using environment "development".
== 20260209000001-scene-composer-phase1: migrating =======
Starting Scene Composer Phase 1 migration...
Phase 1: Extending scenes table...
Phase 2: Adding constraints...
Phase 3: Adding indexes...
Phase 4: Updating existing data...
Phase 5: Creating helper functions...
✅ Scene Composer Phase 1 migration completed successfully
== 20260209000001-scene-composer-phase1: migrated (0.234s)
```

### Step 2: Verify Migration

```bash
# Check new columns exist
node -e "const {models} = require('./src/models'); (async () => { const result = await models.sequelize.query(\"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'scenes' AND column_name IN ('layout', 'duration_auto', 'status') ORDER BY column_name\", {type: models.sequelize.QueryTypes.SELECT}); console.log('New columns:'); result.forEach(r => console.log('-', r.column_name, ':', r.data_type)); process.exit(0); })();"

# Test helper functions
node -e "const {models} = require('./src/models'); (async () => { try { const result = await models.sequelize.query('SELECT calculate_scene_duration(\\'00000000-0000-0000-0000-000000000000\\'::UUID) as duration', {type: models.sequelize.QueryTypes.SELECT}); console.log('✅ calculate_scene_duration() works'); } catch(e) { console.log('❌', e.message); } process.exit(0); })();"
```

**Expected:**
```
New columns:
- duration_auto : boolean
- layout : jsonb
- status : character varying

✅ calculate_scene_duration() works
```

### Step 3: Restart Server

```bash
# Stop server
Get-Process node | Where-Object {$_.Path -like "*Episode-Canonical-Control-Record*"} | Stop-Process -Force

# Start server
node src/server.js
```

### Step 4: Test API Endpoints

#### Test 1: Create Scene
```bash
curl -X POST http://localhost:3000/api/v1/episodes/YOUR_EPISODE_ID/scenes \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Test Scene\",\"status\":\"planned\",\"duration_auto\":true}"
```

#### Test 2: Calculate Duration
```bash
curl -X POST http://localhost:3000/api/v1/scenes/YOUR_SCENE_ID/calculate-duration
```

#### Test 3: Check Completeness
```bash
curl http://localhost:3000/api/v1/scenes/YOUR_SCENE_ID/completeness
```

#### Test 4: Add Asset
```bash
curl -X POST http://localhost:3000/api/v1/scenes/YOUR_SCENE_ID/assets \
  -H "Content-Type: application/json" \
  -d "{\"asset_id\":\"YOUR_ASSET_ID\",\"role\":\"BG.MAIN\",\"metadata\":{\"position\":{\"x\":0,\"y\":0}}}"
```

#### Test 5: List Scene Assets
```bash
curl http://localhost:3000/api/v1/scenes/YOUR_SCENE_ID/assets
```

---

## ✅ Post-Deployment Verification

### Database Checks

```sql
-- 1. Check new columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'scenes'
  AND column_name IN ('layout', 'duration_seconds', 'duration_auto', 'status')
ORDER BY column_name;

-- 2. Check existing scenes updated
SELECT status, duration_auto, COUNT(*) 
FROM scenes 
GROUP BY status, duration_auto;

-- 3. Check helper functions
SELECT proname, pronargs 
FROM pg_proc 
WHERE proname IN ('calculate_scene_duration', 'check_scene_complete');

-- 4. Test duration calculation (replace UUID)
SELECT calculate_scene_duration('YOUR-SCENE-UUID'::UUID);

-- 5. Test completeness check
SELECT check_scene_complete('YOUR-SCENE-UUID'::UUID);
```

### API Health Checks

```bash
# Get all scenes for an episode
curl http://localhost:3000/api/v1/episodes/YOUR_EPISODE_ID/scenes

# Should return scenes with new fields:
# - status
# - duration_auto
# - layout
```

---

## 🐛 Troubleshooting

### Issue: Migration Fails

**Error:** `column "layout" already exists`

**Solution:** Column was added manually before migration. Safe to continue.

```bash
# Skip this migration
npx sequelize-cli db:migrate:undo:all --to 20260125000001-add-asset-role-system.js
```

### Issue: Function Already Exists

**Error:** `function calculate_scene_duration already exists`

**Solution:** Drop and recreate.

```sql
DROP FUNCTION IF EXISTS calculate_scene_duration(UUID);
DROP FUNCTION IF EXISTS check_scene_complete(UUID);
```

Then rerun migration.

### Issue: Server Won't Start

**Check:**
1. Port 3000 not in use: `Get-NetTCPConnection -LocalPort 3000`
2. Database connection: Check `.env` credentials
3. Model sync errors: Check console output

### Issue: API Returns 500

**Debug:**
```bash
# Check server logs
# Look for Sequelize errors

# Test model directly
node -e "const {models} = require('./src/models'); (async () => { const scene = await models.Scene.findOne(); console.log(scene.toJSON()); process.exit(0); })();"
```

---

## 🔄 Rollback Procedure

If something goes wrong:

```bash
# Rollback migration
npx sequelize-cli db:migrate:undo

# Or rollback to specific migration
npx sequelize-cli db:migrate:undo:all --to 20260125000001-add-asset-role-system.js
```

**Manual Rollback (SQL):**
```sql
-- Drop functions
DROP FUNCTION IF EXISTS check_scene_complete(UUID);
DROP FUNCTION IF EXISTS calculate_scene_duration(UUID);

-- Drop indexes
DROP INDEX IF EXISTS idx_scenes_status;

-- Drop constraint
ALTER TABLE scenes DROP CONSTRAINT IF EXISTS scenes_duration_check;

-- Remove columns (OPTIONAL - will lose data)
-- ALTER TABLE scenes DROP COLUMN IF EXISTS duration_auto;
-- ALTER TABLE scenes DROP COLUMN IF EXISTS layout;
-- ALTER TABLE scenes DROP COLUMN IF EXISTS status;
```

---

## 📊 Performance Considerations

### Indexes Added
- `idx_scenes_status` - Speeds up status filtering

### Query Performance
- Helper functions use joins, test with large datasets
- Scene assets queries include joins with assets table

### Optimization Tips
- Use `include_assets=false` when you don't need asset data
- Use `role_filter` to reduce scene asset results
- Consider pagination for episodes with 50+ scenes

---

## 🎯 Next Steps

After successful deployment:

1. **Frontend Integration**
   - Build Scene Composer UI components
   - Wire up asset picker
   - Implement canvas positioning

2. **Testing**
   - Create test scenes
   - Test with various asset types
   - Verify duration calculations

3. **Phase 2 Planning**
   - Markers system
   - Script integration
   - Timeline UI

---

## 📞 Support

If you encounter issues:

1. Check server logs: `node src/server.js` output
2. Check database logs: PostgreSQL error messages
3. Review API documentation: `SCENE_COMPOSER_API_DOCUMENTATION.md`
4. Test with curl commands provided above

---

**Deployment Completed:** _______________  
**Deployed By:** _______________  
**Status:** ⬜ Success  ⬜ Issues (describe below)

**Notes:**
_______________________________________
_______________________________________
_______________________________________
