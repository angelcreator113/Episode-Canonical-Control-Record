# 🚀 Phase 3 Complete Deployment Guide

**Status**: Phase 3A & 3B Ready for Production  
**Date**: January 5, 2026  
**Duration**: Full deployment ~15-20 minutes

---

## 📋 Pre-Deployment Checklist

- [ ] Backend running (npm start)
- [ ] Frontend running (npm run dev)
- [ ] Database accessible
- [ ] AWS credentials configured (.env file)
- [ ] Node.js 20+ installed
- [ ] npm 9+ installed

---

## 🔧 Step 1: Stop Current Services

```powershell
# Kill all Node processes
taskkill /F /IM node.exe

# Wait for graceful shutdown
Start-Sleep -Seconds 2
```

---

## 💾 Step 2: Deploy Phase 3A (Versioning System)

### Run Migration

```bash
cd "c:\Users\12483\prime studios\BRD\Episode-Canonical-Control-Record"

# Method 1: Using npm script
npm run migrate:up

# Method 2: Using psql directly
psql -U postgres -d episode_metadata -f migrations/0003-add-composition-versioning.sql
```

**Verify Migration**:
```bash
# Check table exists
psql -U postgres -d episode_metadata -c "\dt composition_versions"

# Check trigger exists
psql -U postgres -d episode_metadata -c "SELECT * FROM pg_triggers WHERE tgname='tr_track_composition_changes';"

# Check view exists
psql -U postgres -d episode_metadata -c "\dv composition_version_changelog"
```

Expected output:
```
       Name        | Owner | Type  | Size
──────────────────┼───────┼───────┼──────
 composition_versions | postgres | table | 8192 bytes
```

---

## 🔎 Step 3: Deploy Phase 3B (Advanced Filtering)

### Run Filtering Indexes Migration

```bash
# Run indexes migration
npm run migrate:up

# Or manually:
psql -U postgres -d episode_metadata -f migrations/0004-add-filtering-indexes.sql
```

**Verify Indexes**:
```bash
psql -U postgres -d episode_metadata -c "
  SELECT indexname 
  FROM pg_indexes 
  WHERE tablename='thumbnail_compositions' 
  ORDER BY indexname;"
```

Expected indexes:
```
idx_composition_created_at
idx_composition_created_by
idx_composition_episode_created
idx_composition_episode_id
idx_composition_episode_status
idx_composition_name_search
idx_composition_selected_formats_gin
idx_composition_status
idx_composition_template_id
idx_composition_updated_at
```

---

## 🚀 Step 4: Start Services

### Terminal 1: Start Backend

```bash
cd "c:\Users\12483\prime studios\BRD\Episode-Canonical-Control-Record"
npm start
```

Expected output:
```
✅ AWS SDK v3 configured with credentials from profile: default
🔄 Attempting database connection...
✅ Database connection successful
🚀 Server running on port 3002
```

### Terminal 2: Start Frontend

```bash
cd "c:\Users\12483\prime studios\BRD\Episode-Canonical-Control-Record\frontend"
npm run dev
```

Expected output:
```
  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

---

## ✅ Step 5: Verify Deployment

### Health Checks

```bash
# Check backend
curl -s http://localhost:3002/health | jq

# Expected response:
{
  "status": "healthy",
  "timestamp": "2026-01-05T15:00:00Z",
  "database": "connected"
}
```

### Test Versioning Endpoints

```bash
# Get first composition ID
$compositionId = curl -s "http://localhost:3002/api/v1/episodes?limit=1" | jq -r '.data[0].id'

# Get composition versions
curl -s "http://localhost:3002/api/v1/compositions/$compositionId/versions" | jq

# Expected response:
{
  "status": "SUCCESS",
  "data": {
    "composition_id": "uuid",
    "current_version": 1,
    "versions": [...]
  }
}
```

### Test Filtering Endpoints

```bash
# Get filter options
curl -s "http://localhost:3002/api/v1/compositions/search/filters/options" | jq

# Test search
curl -s "http://localhost:3002/api/v1/compositions/search?limit=5" | jq

# Expected response:
{
  "status": "SUCCESS",
  "pagination": {
    "total_count": 6,
    "filtered_count": 5,
    "limit": 5,
    ...
  },
  "compositions": [...]
}
```

### Frontend Test

Open browser: http://localhost:5173/composer/default

Expected:
- [ ] Page loads without errors
- [ ] Console shows no errors
- [ ] Compositions render in gallery
- [ ] Can view composition details
- [ ] Thumbnail generation works

---

## 🔧 Step 6: Integrate Components (Optional)

If you want to show FilterPanel and VersionHistoryPanel in the UI:

### Update ThumbnailComposer.jsx

```jsx
// Add imports
import FilterPanel from '../components/FilterPanel';
import VersionHistoryPanel from '../components/VersionHistoryPanel';

// Add to component
<div className="composer-container">
  <FilterPanel
    episodeId={episodeId}
    onFiltersApply={handleFiltersApply}
    onFiltersReset={handleFiltersReset}
  />

  {/* Gallery with filtered compositions */}
  <div className="gallery">
    {compositions.map(comp => (
      <div key={comp.id} className="gallery-item">
        {comp.name}
        {/* Add version button or indicator */}
      </div>
    ))}
  </div>

  {/* Version history for selected composition */}
  {selectedComposition && (
    <VersionHistoryPanel
      compositionId={selectedComposition.id}
      compositionName={selectedComposition.name}
      onVersionReverted={handleVersionReverted}
    />
  )}
</div>
```

---

## 📊 Performance Verification

### Check Query Performance

```bash
# Connect to database
psql -U postgres -d episode_metadata

# Test index usage
EXPLAIN ANALYZE
SELECT * FROM thumbnail_compositions
WHERE status = 'published'
ORDER BY created_at DESC
LIMIT 10;

# Should show "Index Scan" not "Seq Scan"
```

---

## 🔐 Security Verification

### Check Indexes and Security

```bash
psql -U postgres -d episode_metadata -c "
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename = 'thumbnail_compositions'
LIMIT 5;"
```

All indexes should be present and correct.

---

## 📈 What's Now Available

### Phase 3A: Versioning System
```
✅ GET /api/v1/compositions/:id/versions
✅ GET /api/v1/compositions/:id/versions/:versionNumber
✅ GET /api/v1/compositions/:id/versions/:a/compare/:b
✅ POST /api/v1/compositions/:id/revert/:versionNumber
✅ GET /api/v1/compositions/:id/version-stats
✅ VersionHistoryPanel React component
```

### Phase 3B: Advanced Filtering
```
✅ GET /api/v1/compositions/search
✅ GET /api/v1/compositions/search/filters/options
✅ 10 database indexes for performance
✅ FilterPanel React component
✅ Multi-criteria search support
✅ Pagination and sorting
```

### Combined System
```
✅ Phase 2.5: Thumbnail generation + S3 upload
✅ Phase 3A: Version tracking + rollback
✅ Phase 3B: Advanced search + filtering
✅ Complete composition lifecycle management
```

---

## 🚨 Troubleshooting

### Frontend Error: "Unexpected token"

**Problem**: JSX parsing error  
**Solution**: 
```bash
# Clear npm cache
npm cache clean --force

# Reinstall dependencies
npm install

# Restart frontend
npm run dev
```

### Backend Error: "Table does not exist"

**Problem**: Migration didn't run  
**Solution**:
```bash
# Check migration status
psql -U postgres -d episode_metadata -c "\dt composition_versions"

# If missing, run manually:
psql -U postgres -d episode_metadata -f migrations/0003-add-composition-versioning.sql
```

### API Returns 500 Error

**Problem**: Server error  
**Solution**:
```bash
# Check backend console for error
# Common causes:
# 1. Database not connected
# 2. Migration not applied
# 3. AWS credentials missing

# Restart backend:
npm start
```

### Filtering Not Working

**Problem**: /search endpoint returns empty  
**Solution**:
```bash
# Verify indexes exist
psql -U postgres -d episode_metadata -c "\d+ thumbnail_compositions"

# Should show all indexes

# Test with no filters
curl -s "http://localhost:3002/api/v1/compositions/search"
```

---

## 📚 Documentation Files

Read these for detailed information:

1. **[PHASE_3_FEATURE_EXPANSION_PLAN.md](PHASE_3_FEATURE_EXPANSION_PLAN.md)** - Architecture overview
2. **[PHASE_3A_COMPOSITION_VERSIONING.md](PHASE_3A_COMPOSITION_VERSIONING.md)** - Versioning guide
3. **[PHASE_3B_ADVANCED_FILTERING_COMPLETE.md](PHASE_3B_ADVANCED_FILTERING_COMPLETE.md)** - Filtering guide
4. **[PHASE_3_QUICK_REFERENCE.md](PHASE_3_QUICK_REFERENCE.md)** - Code snippets

---

## ✨ Deployment Complete! ✅

Your system now has:
- ✅ Full thumbnail generation (Phase 2.5)
- ✅ Version tracking & rollback (Phase 3A)
- ✅ Advanced filtering & search (Phase 3B)

### Ready for Phase 3C?

When you're ready, Phase 3C (Batch Operations) will add:
- Batch composition operations (generate, delete, publish)
- Job queue system
- Real-time progress tracking
- Job history view

**Estimated Time**: 2-3 weeks

---

## 📞 Quick Reference

| Action | Command |
|--------|---------|
| Run migration | `npm run migrate:up` |
| Start backend | `npm start` |
| Start frontend | `cd frontend && npm run dev` |
| Check health | `curl http://localhost:3002/health` |
| Test versioning | `curl http://localhost:3002/api/v1/compositions/search` |
| View logs | Check backend console |

---

**Deployment Date**: January 5, 2026  
**Status**: ✅ READY FOR PRODUCTION  
**Next Phase**: Batch Operations (Phase 3C)

Enjoy your new features! 🚀
