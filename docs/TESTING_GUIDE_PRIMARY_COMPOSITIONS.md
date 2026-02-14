# End-to-End Testing Guide - Composition System

## Testing Overview

This guide walks through testing the complete composition system from creation to setting as primary.

---

## Prerequisites

### Running Services
- ✅ Backend server running on port 3002 (`node app.js`)
- ✅ Frontend dev server running on port 5173 (`npm run dev`)
- ✅ PostgreSQL database accessible
- ✅ All migrations executed

### Required Data
- At least one Show in database
- At least one Episode associated with Show
- At least one Thumbnail Template
- Assets uploaded for each required role (LaLa, Background Frame, etc.)

---

## Test Scenario 1: Create Composition & Set as Primary

### Step 1: Access Composition Wizard
1. Navigate to **Create Composition** (via navigation menu or direct link)
2. **Expected**: See 6-step wizard interface

### Step 2: Select Show & Episode
1. **Step 1 - Show Selection**: Select a show from dropdown
2. Click "Next"
3. **Step 2 - Episode Selection**: Select an episode from the filtered list
4. Click "Next"
5. **Expected**: Episode should have episode number and title visible

### Step 3: Select Template
1. **Step 3 - Template Selection**: Select a template (e.g., "Default YouTube Layout")
2. **Expected**: Template preview should show layout structure
3. Click "Next"

### Step 4: Assign Assets
1. **Step 4 - Asset Assignment**: For each required role:
   - LaLa → Select an asset with `asset_role = 'lala'`
   - Background Frame → Select an asset with `asset_role = 'background_frame'`
   - Guest (if required) → Select guest asset
   - JustAWoman (if required) → Select justawomen asset
2. **Expected**: All required roles highlighted in red until selected
3. Click "Next"

### Step 5: Select Output Formats
1. **Step 5 - Format Selection**: Check at least one format:
   - ✅ YouTube (1920×1080)
   - ✅ Instagram (1080×1080) - optional
   - ✅ Facebook (1200×630) - optional
2. Click "Next"

### Step 6: Review & Create
1. **Step 6 - Review**: Verify all selections:
   - Episode name ✓
   - Template name ✓
   - Asset previews ✓
   - Selected formats ✓
2. Click **"Create Composition"**
3. **Expected**: 
   - ⏳ Status: "Creating composition and generating thumbnails..."
   - ✅ Status: "Composition created! Redirecting..."
   - **Automatic redirect to `/compositions/{id}`**

### Step 7: Verify Composition Detail Page
1. **Expected** (after redirect):
   - Header shows composition name
   - Badges: v1, DRAFT (or READY)
   - **No "⭐ Primary" badge yet**
   - Metadata strip: Show, Episode, Template, Created date
   - "Set as Primary" button visible in header
2. Switch to **"📸 Outputs"** tab
3. **Expected**:
   - See selected formats in dropdown
   - See processing/ready status for each output
   - If PROCESSING: Wait for generation to complete
   - If READY: See thumbnail preview, download/copy buttons

### Step 8: Set as Primary
1. Ensure at least one output has status = READY
2. Click **"⭐ Set as Primary"** button
3. **Expected**: Confirmation dialog:
   > "Set this composition as the primary thumbnail for this episode? This will update the episode cover image."
4. Click **"OK"**
5. **Expected**:
   - Alert: "✅ Set as primary thumbnail! Episode cover updated."
   - **"⭐ Primary" badge appears in header**
   - "Set as Primary" button disappears
   - Page reflects updated state

### Step 9: Verify Database Updates
Open PostgreSQL client or run query:
```sql
SELECT 
  e.id,
  e.title,
  e.thumbnail_url,
  tc.id AS composition_id,
  tc.is_primary,
  co.image_url AS output_url
FROM episodes e
LEFT JOIN thumbnail_compositions tc ON tc.episode_id = e.id AND tc.is_primary = TRUE
LEFT JOIN composition_outputs co ON co.composition_id = tc.id AND co.status = 'READY'
WHERE e.title = 'Your Episode Title';
```

**Expected Results**:
- `e.thumbnail_url` matches `co.image_url`
- `tc.is_primary` = TRUE
- Only ONE row per episode

### Step 10: Verify Library View
1. Navigate to **Composition Library** (via navigation link or `/library`)
2. **Expected**:
   - See newly created composition in grid
   - **"⭐ Primary" badge visible** on composition card
   - Output count badge: "1/1 Ready" (or similar)
3. Click the card
4. **Expected**: Navigate back to detail page with primary badge

---

## Test Scenario 2: Switch Primary Composition

### Prerequisites
- Two compositions for the same episode
- Both compositions have at least one READY output

### Steps
1. Navigate to **Composition Library**
2. Find the **non-primary** composition for the episode
3. Click to open detail page
4. Click **"⭐ Set as Primary"**
5. Confirm dialog
6. **Expected**:
   - This composition now shows "⭐ Primary" badge
   - Alert: "✅ Set as primary thumbnail! Episode cover updated."
7. Navigate back to Library
8. Find the **previously primary** composition
9. Click to open detail page
10. **Expected**:
    - **NO "⭐ Primary" badge** (should be removed)
    - "Set as Primary" button now visible
11. Verify database:
    ```sql
    SELECT id, episode_id, is_primary, current_version
    FROM thumbnail_compositions
    WHERE episode_id = 'your-episode-id'
    ORDER BY created_at DESC;
    ```
12. **Expected**: Only ONE composition has `is_primary = TRUE`

---

## Test Scenario 3: Primary Composition Without Outputs

### Steps
1. Create a new composition but **don't generate outputs**
2. Navigate to detail page
3. **Expected**:
   - "Set as Primary" button is **disabled**
   - Tooltip: "Generate outputs first"
4. Try clicking (should do nothing)
5. Switch to Outputs tab
6. Generate at least one format
7. Wait for READY status
8. **Expected**:
   - "Set as Primary" button is now **enabled**
   - Can successfully set as primary

---

## Test Scenario 4: Episode Thumbnail Display

### Prerequisites
- Episode has a primary composition with READY outputs
- Episode's `thumbnail_url` is populated

### Steps to Verify (if Episode Detail page exists)
1. Navigate to **Episodes** page
2. Find the episode with primary composition
3. **Expected**: Episode thumbnail shows the primary composition's image
4. Click episode to open detail
5. **Expected**: Episode detail page shows thumbnail from primary composition

### Alternative Verification (API)
```bash
# Get episode details
curl http://localhost:3002/api/v1/episodes/{episode-id}
```

**Expected JSON**:
```json
{
  "id": "uuid",
  "title": "Episode Title",
  "thumbnail_url": "s3://bucket/compositions/uuid/youtube_1920x1080.png",
  ...
}
```

---

## Test Scenario 5: Library Filtering

### Steps
1. Navigate to **Composition Library**
2. Create compositions for multiple shows and episodes
3. Test **Show Filter**:
   - Select a show from dropdown
   - **Expected**: Only compositions for that show visible
4. Test **Status Filter**:
   - Select "DRAFT"
   - **Expected**: Only draft compositions visible
   - Select "READY"
   - **Expected**: Only ready compositions visible
5. Test **Search**:
   - Type episode name in search box
   - **Expected**: Only matching compositions visible
6. Test **Clear Filters**:
   - Click "Clear Filters"
   - **Expected**: All compositions visible again

---

## Test Scenario 6: Layout Editor Integration

### Steps
1. Open a composition detail page
2. Switch to **"✏️ Adjust Layout"** tab
3. **Expected**:
   - Konva canvas loads with template layout
   - All asset layers visible
   - Safe zone guides (5% margin, center cross, grid)
   - Right panel shows role list
4. **Drag an asset**:
   - Click and drag LaLa image
   - **Expected**: Position updates in real-time
   - Sliders in right panel update
5. **Scale an asset**:
   - Adjust "Scale" slider in right panel
   - **Expected**: Asset resizes on canvas
6. **Save Draft**:
   - Click "💾 Save Draft"
   - **Expected**: 
     - Alert: "Draft saved!"
     - Unsaved indicator disappears
     - Primary badge changes to "Unsaved Changes" (if visible)
7. **Apply & Regenerate**:
   - Click "✅ Apply & Regenerate"
   - **Expected**:
     - Confirmation: "This will increment the version and queue outputs for regeneration"
     - After confirm: version increments (v1 → v2)
     - Outputs tab shows PROCESSING status
     - Eventually READY with updated layout

---

## Expected Database State After Tests

### Episodes Table
```sql
SELECT id, title, thumbnail_url FROM episodes;
```
**Expected**:
- Episodes with primary compositions have `thumbnail_url` populated
- URL matches first READY output from primary composition

### Thumbnail Compositions Table
```sql
SELECT 
  id, 
  episode_id, 
  is_primary, 
  current_version, 
  has_unsaved_changes,
  draft_overrides
FROM thumbnail_compositions
ORDER BY created_at DESC;
```
**Expected**:
- Each episode has max ONE composition with `is_primary = TRUE`
- `current_version` increments after Apply & Regenerate
- `has_unsaved_changes = TRUE` after Save Draft (until applied)
- `draft_overrides` contains layout adjustments

### Composition Outputs Table
```sql
SELECT 
  composition_id,
  format,
  status,
  image_url,
  width,
  height
FROM composition_outputs
ORDER BY created_at DESC;
```
**Expected**:
- One row per (composition, format) pair
- Status: PROCESSING → READY (or FAILED)
- `image_url` populated for READY outputs
- Width/height match format specs

---

## Common Issues & Fixes

### Issue: "Set as Primary" button stays disabled
**Cause**: No READY outputs
**Fix**: 
1. Go to Outputs tab
2. Select a format
3. Click "Generate" or "Regenerate"
4. Wait for READY status

### Issue: Multiple compositions show as primary
**Cause**: Database constraint not enforced
**Fix**: Run migration again:
```bash
node add-is-primary-composition.js
```

### Issue: Episode thumbnail not updating
**Cause**: No READY outputs when setPrimary called
**Fix**: 
1. Generate outputs first
2. Set as primary again
3. Check backend console for:
   - ✅ "Updated episode {id} thumbnail_url"
   - OR ⚠️ "No READY outputs available"

### Issue: Primary badge not showing in UI
**Cause**: Frontend not receiving `is_primary` field
**Fix**:
1. Restart backend (to load updated models)
2. Clear browser cache
3. Reload composition detail page
4. Check Network tab: GET /compositions/:id should include `is_primary: true`

---

## Performance Considerations

### Query Optimization
- GET /compositions includes 4 joins (outputs, episode, show, template)
- For large datasets (1000+ compositions), consider:
  - Pagination
  - Lazy-loading outputs
  - Indexed is_primary column

### Current Performance
- Small datasets (< 100 compositions): Instant
- Medium datasets (100-1000): < 500ms
- Large datasets (1000+): May need optimization

---

## Success Criteria

✅ **All tests pass if**:
1. Composition creation redirects to detail page
2. Primary badge appears after setting
3. Episode `thumbnail_url` updates correctly
4. Only one composition per episode can be primary
5. Library shows primary badge
6. Navigation includes Composition Library link
7. No console errors during flow

---

## Status: Ready for Testing

Backend and frontend both updated and running with new primary composition features.
