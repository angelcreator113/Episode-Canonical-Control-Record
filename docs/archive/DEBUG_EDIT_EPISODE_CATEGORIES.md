# EditEpisode Categories Debug Guide

## Issue
Categories are not displaying when editing an episode, even though they should be loaded from the database.

## Root Cause Analysis

The code appears correct:
1. ✅ API controller includes `categories` in SELECT statement (line 80)
2. ✅ Frontend EditEpisode loads categories into state (line 65)
3. ✅ UI renders categories correctly (lines 312-327)

## Debug Steps

### Step 1: Verify API Response
Run this curl command in PowerShell to check if categories are returned:

```powershell
# Get a valid episode ID first
$response = Invoke-WebRequest -Uri "http://localhost:3002/api/v1/episodes" `
  -Headers @{"Authorization" = "Bearer YOUR_TOKEN"} `
  -ContentType "application/json"

$episodes = $response.Content | ConvertFrom-Json
$episodeId = $episodes.data[0].id

# Now fetch that episode
Invoke-WebRequest -Uri "http://localhost:3002/api/v1/episodes/$episodeId" `
  -Headers @{"Authorization" = "Bearer YOUR_TOKEN"} `
  -ContentType "application/json" | ConvertTo-Json
```

Expected response includes:
```json
{
  "data": {
    "id": "...",
    "title": "...",
    "episode_number": 1,
    "categories": ["tag1", "tag2"],  // Should see this field
    ...
  }
}
```

### Step 2: Check Browser Console
1. Open DevTools (F12)
2. Go to Network tab
3. Click Edit on an episode
4. Look for GET request to `/api/v1/episodes/{id}`
5. Check Response tab - should show `categories` field

### Step 3: Check Frontend State
Add console logging to EditEpisode.jsx:

```javascript
// After line 64 in fetchEpisode()
console.log('📋 Episode fetched:', episode);
console.log('📦 Categories:', episode.categories);
console.log('📦 Categories type:', typeof episode.categories);
console.log('📦 Is array?:', Array.isArray(episode.categories));

// After line 65 in newFormData
const newFormData = {
  ...
  categories: Array.isArray(episode.categories) ? episode.categories : [],
};
console.log('✅ FormData categories:', newFormData.categories);
```

### Step 4: Check Database Column
Verify the `categories` column exists and has data:

```sql
-- Connect to your database
SELECT id, title, categories FROM episodes LIMIT 5;

-- Check column type and definition
\d episodes
-- Look for: categories | character varying or text or jsonb
```

## Possible Issues & Solutions

### Issue 1: Column doesn't exist
```sql
-- Add the column if missing
ALTER TABLE episodes ADD COLUMN categories TEXT DEFAULT NULL;
-- Or if it should be an array:
ALTER TABLE episodes ADD COLUMN categories TEXT[] DEFAULT '{}';
```

### Issue 2: Categories stored as JSON string
If categories are stored as `'["tag1","tag2"]'` (string) instead of array:

```javascript
// In episodeController.js, add parsing after line 80
const episode = await Episode.findByPk(id, {
  attributes: ['id', 'episode_number', 'title', 'description', 'air_date', 'status', 'categories', 'created_at', 'updated_at'],
});

// Parse categories if it's a JSON string
if (episode && typeof episode.categories === 'string') {
  try {
    episode.categories = JSON.parse(episode.categories);
  } catch (e) {
    episode.categories = [];
  }
}
```

### Issue 3: Null categories in database
Categories might be NULL instead of empty array:

```javascript
// In frontend, already handled at line 65:
categories: Array.isArray(episode.categories) ? episode.categories : [],
// This should convert NULL to []
```

### Issue 4: Case sensitivity
Check if field name is `categories` not `category` or `tags`:

```javascript
// Search the Episode model for actual column name
// File: src/models/Episode.js
// Look for: categories, category, tags, or similar
```

## Testing Solution

### Test Case 1: Create Episode with Categories
1. Go to Create Episode page
2. Add some categories (e.g., "drama", "action")
3. Submit form
4. Check database: `SELECT categories FROM episodes WHERE id = 'YOUR_ID';`
5. Categories should be stored

### Test Case 2: Edit Episode with Categories
1. Go to list episodes
2. Click Edit on the episode created above
3. You should see "drama" and "action" in the categories section
4. Try adding a new category "comedy"
5. Remove "action"
6. Submit
7. Verify in database

### Test Case 3: Check API Response
1. In browser DevTools, go to Network tab
2. Go to Edit Episode page
3. Find GET request to `/api/v1/episodes/{id}`
4. Response should include `"categories": ["drama", "comedy"]`

## Quick Fix Checklist

- [ ] Run database check: `SELECT categories FROM episodes LIMIT 1;`
- [ ] Check if NULL or empty string
- [ ] Verify column type is TEXT or TEXT[]
- [ ] Check API response in DevTools Network tab
- [ ] Check browser console for errors
- [ ] Verify frontend state with console.log
- [ ] Test create episode with categories first
- [ ] Test edit episode to see if categories load
- [ ] Check toast notifications for errors

## Files to Review

1. **Backend**
   - [src/controllers/episodeController.js](src/controllers/episodeController.js#L80) - Line 80: categories in SELECT
   - [src/models/Episode.js](src/models/Episode.js) - Check column definition
   - [src/migrations/](src/migrations/) - Check migration for categories column

2. **Frontend**
   - [frontend/src/pages/EditEpisode.jsx](frontend/src/pages/EditEpisode.jsx#L65) - Line 65: categories loading
   - [frontend/src/pages/EditEpisode.jsx](frontend/src/pages/EditEpisode.jsx#L312) - Line 312: categories display

## If Still Not Working

1. Create test episode with categories via API directly:
```bash
curl -X POST http://localhost:3002/api/v1/episodes \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","episode_number":99,"categories":["test"]}'
```

2. Then try to edit that episode
3. If categories appear, the issue is with how existing categories are stored
4. If categories don't appear, check the Response in the API request

## Contact Points for Debugging

- **Backend logs**: `npm run dev` - watch for "Error in getEpisode" messages
- **Frontend logs**: Browser Console (F12)
- **Database**: Connect with psql or DBeaver
- **Network**: Browser DevTools Network tab

