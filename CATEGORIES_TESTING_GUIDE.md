# Frontend Categories Testing Guide

## Quick Start

**Both servers are running:**
- Backend: http://localhost:3002 ✅
- Frontend: http://localhost:5173 ✅

**Test Episode Ready:**
- ID: `6b1ce422-bc34-42a3-b96a-7697082657bf`
- Title: "Updated Title"
- Categories: `["comedy", "adventure"]`

---

## Test 1: EditEpisode - Verify Categories Load

### Steps:
1. Open http://localhost:5173 in your browser
2. Log in (if not already logged in)
   - Email: test@example.com
   - Password: password123
3. Go to Episodes list
4. Find the episode titled "Updated Title"
5. Click the **Edit** button

### Expected Results:
✅ Categories section should show:
- **Tags/Categories**
- Two category badges: "comedy" and "adventure"
- Each with an X button to remove

If you see `[]` or empty categories section:
- Open DevTools (F12)
- Go to Network tab
- Look for GET request to `/api/v1/episodes/{id}`
- Check Response tab - should include `"categories": ["comedy","adventure"]`

---

## Test 2: EditEpisode - Modify Categories

### Steps:
1. On the Edit Episode form (from Test 1)
2. Remove the "comedy" category (click the X)
3. Add a new category "sci-fi" (type and press Enter)
4. Click **Update Episode**

### Expected Results:
✅ Toast notification: "Episode updated successfully!"
✅ Redirects to episode detail page
✅ Categories should now show: `["adventure", "sci-fi"]`

### Verification:
- Database check:
```sql
SELECT categories FROM episodes 
WHERE id = '6b1ce422-bc34-42a3-b96a-7697082657bf';
-- Should return: ["adventure","sci-fi"]
```

---

## Test 3: CreateEpisode - Create with Categories

### Steps:
1. Go to http://localhost:5173/create-episode
2. Fill in:
   - **Title**: "New Episode with Categories"
   - **Episode Number**: 888
   - **Status**: draft
   - **Air Date**: 2025-01-20
   - **Description**: Test episode
   - **Categories**: 
     - Add "action" (type and press Enter)
     - Add "thriller" (type and press Enter)
     - Add "mystery" (type and press Enter)
3. Click **Create Episode**

### Expected Results:
✅ Toast notification: "Episode created successfully!"
✅ Redirects to episode detail page
✅ Episode detail shows all 3 categories
✅ Categories appear as badges

---

## Test 4: Episodes List - Categories Display

### Steps:
1. Go to http://localhost:5173/episodes
2. Look at the episode cards

### Expected Results:
✅ Category badges appear on episode cards
✅ Multiple categories show as multiple badges
✅ Categories are clickable/styled nicely

---

## Test 5: Search with Categories

### Steps:
1. Go to http://localhost:5173/episodes
2. In search box, type a category name (e.g., "action")
3. Press Enter or click Search

### Expected Results:
✅ Results include episodes with that category
✅ Category badges highlighted in results

---

## Troubleshooting

### Categories Not Loading in EditEpisode?

**Check 1: DevTools Network Tab**
1. Open DevTools (F12)
2. Go to Network tab
3. Go to edit page
4. Find GET request to `/api/v1/episodes/{id}`
5. Click on it
6. Go to Response tab
7. Look for `"categories": [...]`

**Check 2: Console Errors**
1. Open DevTools (F12)
2. Go to Console tab
3. Look for red error messages
4. Common error: Missing authorization token

**Check 3: Backend Status**
```powershell
# Check if backend is running
curl -s "http://localhost:3002/ping"
# Should return: pong (or similar)

# Check if database has categories
docker exec episode-postgres psql -U postgres -d episode_metadata -c "SELECT categories FROM episodes LIMIT 1;"
```

### Categories Not Saving?

**Check 1: Check Browser Console**
- F12 → Console
- Look for any red errors when submitting form
- Common: 401 Unauthorized (login expired)

**Check 2: Check Backend Logs**
```powershell
# Watch backend logs
Get-Job | Receive-Job
# Look for errors when updating
```

**Check 3: Verify Database**
```sql
SELECT id, title, categories FROM episodes 
WHERE id = 'YOUR_EPISODE_ID';
-- Categories should not be empty
```

---

## Browser Testing Checklist

- [ ] **Login**: Can log in with test@example.com / password123
- [ ] **EditEpisode**: Categories pre-load from database
- [ ] **EditEpisode**: Can add new categories
- [ ] **EditEpisode**: Can remove existing categories
- [ ] **EditEpisode**: Changes save correctly
- [ ] **CreateEpisode**: Can add categories while creating
- [ ] **CreateEpisode**: Categories save with new episode
- [ ] **List**: Categories display on episode cards
- [ ] **Detail**: Categories display on episode detail page
- [ ] **Mobile**: Categories visible on mobile viewport (375px)
- [ ] **Tablet**: Categories visible on tablet viewport (768px)
- [ ] **Desktop**: Categories visible on desktop (1920px)
- [ ] **No errors**: No red errors in browser console

---

## Test Results Template

Copy this and fill it out:

```
Test Results - Categories Feature
==================================

Browser: [Chrome/Firefox/Safari/Edge]
Resolution: [e.g., 1920x1080]
Date: [Today's date]

Test 1: EditEpisode Load Categories
Status: [✅ Pass / ❌ Fail]
Notes: 

Test 2: EditEpisode Modify Categories
Status: [✅ Pass / ❌ Fail]
Notes: 

Test 3: CreateEpisode with Categories
Status: [✅ Pass / ❌ Fail]
Notes: 

Test 4: List Episodes Display Categories
Status: [✅ Pass / ❌ Fail]
Notes: 

Test 5: Search with Categories
Status: [✅ Pass / ❌ Fail]
Notes: 

Overall Status: [✅ All Pass / ⚠️ Some Issues]
Issues Found: 
```

---

## Quick Reference

### API Endpoints (for manual testing)

**Get Episode with Categories**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3002/api/v1/episodes/6b1ce422-bc34-42a3-b96a-7697082657bf
```

**Create Episode with Categories**
```bash
curl -X POST http://localhost:3002/api/v1/episodes \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","episode_number":1,"categories":["action"]}'
```

**Update Categories**
```bash
curl -X PUT http://localhost:3002/api/v1/episodes/ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"categories":["new","tags"]}'
```

---

## Success Indicators

✅ **Everything working when:**
1. Can edit episode and see pre-loaded categories
2. Can add/remove categories
3. Changes save to database
4. Categories appear on list view
5. No console errors
6. No toast error messages
7. All CRUD operations work

---

## Next Phase After Categories Fixed

Once categories are fully tested:
1. Integration tests for categories
2. Test on different browsers
3. Performance testing
4. Move to Phase 4 - Testing & Polish
5. Then Phase 5 - Staging Deployment

---

**Status**: ✅ Ready for browser testing
**Backend**: Running on port 3002
**Frontend**: Running on port 5173
**Test Episode**: 6b1ce422-bc34-42a3-b96a-7697082657bf

