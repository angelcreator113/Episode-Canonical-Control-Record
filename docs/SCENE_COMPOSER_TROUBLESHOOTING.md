# Scene Composer - Troubleshooting Guide

## Common Issues & Solutions

### Issue: "No scenes yet" message persists

**Cause:** Database migration not executed or scenes table not properly extended

**Solution:**
```powershell
cd backend
npx sequelize-cli db:migrate
# Restart backend server
```

**Verify:**
```sql
-- In PostgreSQL:
\d scenes
-- Should show: layout, duration_auto, status columns
```

---

### Issue: "Failed to load scenes" error

**Cause:** Backend API endpoints not registered or server not running

**Solution:**
1. Check backend console for errors
2. Verify routes are loaded:
```javascript
// In backend/src/routes/episodes.js
// Should have these routes:
POST /api/v1/scenes/:id/calculate-duration
GET /api/v1/scenes/:id/completeness
POST /api/v1/scenes/:id/assets
```

3. Test API directly:
```powershell
curl http://localhost:3001/api/v1/episodes/{episodeId}/scenes
```

---

### Issue: EnhancedAssetPicker not opening

**Cause:** Import path incorrect or component not found

**Solution:**
1. Verify import path in panels:
```javascript
import EnhancedAssetPicker from '../../../Assets/EnhancedAssetPicker';
```

2. Check EnhancedAssetPicker exists:
```powershell
Get-ChildItem -Path "frontend\src\components\Assets\EnhancedAssetPicker.jsx" -Recurse
```

3. If component is in different location, update import paths in:
   - BackgroundPanel.jsx
   - CharacterSlotsPanel.jsx
   - UIElementsPanel.jsx

---

### Issue: Drag-drop not working

**Cause:** react-beautiful-dnd not installed

**Solution:**
```powershell
cd frontend
npm install react-beautiful-dnd
npm start
```

---

### Issue: Icons not displaying

**Cause:** lucide-react not installed

**Solution:**
```powershell
cd frontend
npm install lucide-react
npm start
```

---

### Issue: "Cannot read property 'id' of undefined" in SceneComposer

**Cause:** episodeId not passed correctly

**Solution:**
1. Verify EditEpisode.jsx integration:
```jsx
<SceneComposer episodeId={episodeId} />
```

2. Check episodeId is available:
```jsx
const { episodeId } = useParams();
console.log('Episode ID:', episodeId);
```

---

### Issue: Canvas background not showing

**Cause:** Asset URL not properly configured or CORS issue

**Solution:**
1. Check asset has valid s3_key or url:
```javascript
console.log('Background asset:', backgroundAsset);
```

2. Verify S3 bucket CORS settings allow your domain

3. Check browser console for CORS errors

---

### Issue: Video preview shows black screen

**Cause:** Video URL not accessible or format not supported

**Solution:**
1. Check video asset URL:
```javascript
console.log('Video URL:', primaryClip?.asset?.url);
```

2. Verify video format is MP4 (most compatible)

3. Test video URL directly in browser

4. Check video element error:
```javascript
videoRef.current.addEventListener('error', (e) => {
  console.error('Video error:', e);
});
```

---

### Issue: Duration not auto-calculating

**Cause:** Database function not created or video clips missing metadata

**Solution:**
1. Verify database function exists:
```sql
SELECT prosrc FROM pg_proc WHERE proname = 'calculate_scene_duration';
```

2. Check video assets have duration metadata:
```sql
SELECT id, name, metadata->>'duration' 
FROM assets 
WHERE allowed_uses @> '["SCENE"]'::jsonb;
```

3. Manually trigger calculation:
```javascript
await sceneService.calculateDuration(sceneId);
```

---

### Issue: Scene properties not updating

**Cause:** API call failing or state not refreshing

**Solution:**
1. Check browser console for API errors

2. Verify sceneService method calls:
```javascript
console.log('Updating scene:', sceneId, updates);
```

3. Add error handling:
```javascript
try {
  await sceneService.updateScene(sceneId, updates);
} catch (err) {
  console.error('Update failed:', err.response?.data || err.message);
}
```

---

### Issue: Assets not positioning on canvas

**Cause:** Metadata not saving or zoom calculation issue

**Solution:**
1. Check metadata structure:
```javascript
console.log('Asset metadata:', asset.metadata);
// Should have: { x, y, scale, layer }
```

2. Verify updateSceneAssetMetadata call:
```javascript
await sceneService.updateSceneAssetMetadata(sceneId, assetId, {
  metadata: { x, y, scale, layer }
});
```

---

## Development Mode Issues

### Hot Reload Not Working

**Solution:**
```powershell
# Frontend
cd frontend
Remove-Item -Recurse -Force node_modules/.cache
npm start
```

---

### Build Errors

**Check for:**
- Missing dependencies: `npm install`
- TypeScript errors: Check import paths
- CSS import errors: Verify file extensions

---

## Performance Issues

### Slow Scene Loading

**Optimize:**
1. Add pagination to scene list
2. Implement virtual scrolling for large lists
3. Lazy load scene assets

### Canvas Lag

**Optimize:**
1. Reduce zoom level
2. Limit number of assets per scene
3. Use thumbnail images instead of full resolution

---

## Database Issues

### Migration Fails

**Solution:**
```powershell
# Check migration status
cd backend
npx sequelize-cli db:migrate:status

# Undo last migration
npx sequelize-cli db:migrate:undo

# Re-run migration
npx sequelize-cli db:migrate
```

### Constraint Violations

**Check:**
1. Foreign key constraints on scene_assets table
2. Asset exists before binding to scene
3. Role key matches asset_roles table

---

## Network Issues

### CORS Errors

**Backend Solution (backend/src/server.js):**
```javascript
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
```

### API Timeout

**Increase timeout:**
```javascript
// In sceneService.js
const response = await api.get(url, {
  timeout: 30000 // 30 seconds
});
```

---

## Quick Diagnostic Checklist

Run these checks if Scene Composer isn't working:

1. ✅ Backend running: `http://localhost:3001/health`
2. ✅ Frontend running: `http://localhost:3000`
3. ✅ Database connected: Check backend console
4. ✅ Migration executed: `npx sequelize-cli db:migrate:status`
5. ✅ Dependencies installed: `npm list react-beautiful-dnd lucide-react`
6. ✅ Episode exists: Navigate to Edit Episode page
7. ✅ Tab renders: Click "🎞️ Scene Composer" tab
8. ✅ API responds: Browser Network tab shows 200 responses

---

## Getting Help

If issue persists:

1. Check browser console (F12)
2. Check backend terminal for errors
3. Check database logs
4. Review implementation summary: `SCENE_COMPOSER_PHASE1_IMPLEMENTATION_SUMMARY.md`
5. Review API docs: `SCENE_COMPOSER_API_DOCUMENTATION.md`
