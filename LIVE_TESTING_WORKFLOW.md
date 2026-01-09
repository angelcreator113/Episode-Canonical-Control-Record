# 🎬 Phase 2.5 Live Testing Workflow

**Start Time:** January 2, 2026  
**Status:** TESTING IN PROGRESS  
**Frontend:** http://localhost:5173 ✅ OPEN  
**Backend:** http://localhost:3002 ✅ RUNNING

---

## 📋 STEP 1: Upload PROMO_LALA Asset

### What You're Testing
Uploading an image for background removal processing

### Steps
1. **Open Frontend:** http://localhost:5173 (already open in browser)
2. **Navigate to:** Asset Manager (click menu or look for asset upload)
3. **Select File:** `test-images/test-lala.png`
4. **Asset Type:** Select `PROMO_LALA` from dropdown
5. **Click:** Upload button
6. **Wait:** File uploads to server
7. **Expected:** Asset appears in "Pending Assets" tab with status "⏳ PENDING"

### Success Indicators ✅
- [ ] Asset appears in list
- [ ] Status shows "⏳ PENDING"
- [ ] Asset ID visible (will use for processing)
- [ ] No error messages

### Troubleshooting
- **Upload fails?** Check file size (should be ~10KB)
- **Wrong type?** Ensure PROMO_LALA is selected
- **Not appearing?** Refresh the page

**Time:** ~10 seconds

---

## 📋 STEP 2: Process Background Removal (Runway ML)

### What You're Testing
Triggering AI background removal via Runway ML API

### Steps
1. **Find Asset:** In "Pending Assets" tab, find the test-lala asset
2. **Click Button:** "🎨 Process Background"
3. **Watch:** Spinner appears (processing in progress)
4. **Wait:** 5-30 seconds for processing
5. **Result:** 
   - Spinner stops
   - Asset disappears from Pending
   - Asset reappears in "✅ Approved Assets" tab
   - Status shows "✅ APPROVED"

### Success Indicators ✅
- [ ] Spinner appears immediately
- [ ] Processing completes (spinner stops)
- [ ] Asset moves to Approved tab
- [ ] Status changes to APPROVED
- [ ] No error messages
- [ ] Success message appears (optional)

### What's Happening Behind the Scenes
1. Frontend calls: `PUT /api/v1/assets/{assetId}/process`
2. Backend downloads image from S3
3. Backend calls Runway ML API to remove background
4. If API fails: Uses original image (graceful fallback)
5. Uploads processed image to S3
6. Updates database: `approval_status = APPROVED`
7. Returns updated asset to frontend

### Troubleshooting
- **Spinner never appears?** Check browser console for errors
- **Processing takes > 60s?** Runway ML API may be timing out (check .env for API key)
- **Asset doesn't move?** Try refreshing the page
- **See original image in S3?** That's OK - means API used fallback

**Time:** 5-30 seconds

---

## 📋 STEP 3: Upload PROMO_GUEST Asset

### What You're Testing
Uploading second asset (should work same as Step 1)

### Steps
1. **Repeat Step 1** but use:
   - File: `test-images/test-guest.png`
   - Type: `PROMO_GUEST`
2. **Repeat Step 2** to process it

### Expected Result
- Asset appears in Pending
- Process button works
- Asset moves to Approved

**Time:** ~40 seconds total (10s upload + 30s processing)

---

## 📋 STEP 4: Upload EPISODE_FRAME Asset

### What You're Testing
Uploading background frame asset

### Steps
1. **Repeat Step 1** but use:
   - File: `test-images/test-frame.png`
   - Type: `EPISODE_FRAME`
2. **Repeat Step 2** to process it

### Expected Result
- Asset appears in Pending
- Process button works
- Asset moves to Approved

**Time:** ~40 seconds total

---

## 📋 STEP 5: Create Composition

### What You're Testing
Creating a composition that references the 3 approved assets

### Steps
1. **Navigate to:** ThumbnailComposer (click menu)
2. **Select Template:** Choose any available template from dropdown
3. **Select Assets:**
   - **Background Frame:** Select the test-frame asset
   - **Lala Asset:** Select the test-lala asset
   - **Guest Asset:** Select the test-guest asset
4. **Click:** "🎨 Create Composition"
5. **Wait:** ~5 seconds for creation
6. **Expected:** Composition appears in "Draft Compositions" section

### Success Indicators ✅
- [ ] Composition form accepted all 3 assets
- [ ] Composition appears in draft list
- [ ] Shows episode ID, status "DRAFT"
- [ ] No error messages
- [ ] Success message appears

### What's Happening
1. Frontend calls: `POST /api/v1/compositions`
2. Backend creates composition record in database
3. Backend links to 3 assets
4. Returns new composition ID
5. Frontend displays in Draft Compositions

**Time:** ~5 seconds

---

## 📋 STEP 6: Generate Thumbnails (Sharp Compositing)

### What You're Testing
Creating 2 social media thumbnail formats from the composition

### Steps
1. **Find Composition:** In "Draft Compositions" section, find your test composition
2. **Click Button:** "🎨 Generate Thumbnails"
3. **Watch:** Spinner appears (generating...)
4. **Wait:** 5-15 seconds for thumbnail generation
5. **Result:**
   - Spinner stops
   - Button changes to "✅ Thumbnails Generated"
   - Below shows generated formats:
     - `YOUTUBE: 1920x1080`
     - `INSTAGRAM_FEED: 1080x1080`
   - Each shows file size (e.g., "245KB")
   - Each has "📥 View" link

### Success Indicators ✅
- [ ] Spinner appears immediately
- [ ] Generation completes (spinner stops)
- [ ] Shows 2 formats (YouTube + Instagram)
- [ ] Shows correct dimensions
   - YouTube: 1920x1080
   - Instagram: 1080x1080
- [ ] Shows file sizes
- [ ] "📥 View" links present
- [ ] No error messages

### What's Happening Behind the Scenes
1. Frontend calls: `POST /api/v1/compositions/{compId}/generate-thumbnails`
2. Backend downloads 3 assets from S3 (background, lala, guest)
3. Backend calls Sharp library to composite images:
   - Resize background to format dimensions
   - Add semi-transparent overlay
   - Position lala on left
   - Position guest on right
   - Add text overlay with episode info
4. Saves both formats as JPEG (90% quality)
5. Uploads to S3: `thumbnails/composite/{episode_id}/{format}-{timestamp}.jpg`
6. Updates database: `status = APPROVED`, `published_at = now`
7. Returns thumbnails array to frontend

**Time:** 5-15 seconds

---

## 📋 STEP 7: Verify Results

### What You're Checking
- Database records created
- S3 files uploaded
- Files are valid images
- Compositing looks correct

### Check 1: Frontend Display
In ThumbnailComposer, verify:
- [ ] Shows 2 thumbnail formats
- [ ] YouTube: 1920x1080
- [ ] Instagram: 1080x1080
- [ ] File sizes > 0KB
- [ ] "📥 View" links clickable

### Check 2: View Thumbnails
1. **Click** "📥 View" link for YouTube thumbnail
   - Should open image in new tab
   - Should be landscape (1920x1080)
   - Should show:
     - Green background (resized)
     - Pink asset on left
     - Blue asset on right
     - Text with episode info
2. **Click** "📥 View" link for Instagram thumbnail
   - Should open image in new tab
   - Should be square (1080x1080)
   - Same compositing, different aspect ratio

### Check 3: S3 Verification (Optional)
Via AWS Console, verify paths exist:
```
episode-metadata-storage-dev/
├── promotional/lala/
│   ├── raw/          ✅ test-lala.png
│   └── processed/    ✅ Processed PNG
├── promotional/guest/
│   ├── raw/          ✅ test-guest.png
│   └── processed/    ✅ Processed PNG
├── episode/frame/
│   └── raw/          ✅ test-frame.png
└── thumbnails/composite/{episodeId}/
    ├── YOUTUBE-*.jpg          ✅ 1920x1080
    └── INSTAGRAM_FEED-*.jpg   ✅ 1080x1080
```

### Check 4: Visual Inspection
Download thumbnails and verify:

**YouTube (1920x1080):**
- [ ] Image loads without errors
- [ ] Landscape orientation
- [ ] Background is green (from test frame)
- [ ] Pink square on left (lala)
- [ ] Blue square on right (guest)
- [ ] Text overlay readable
- [ ] No artifacts or corruption
- [ ] Professional appearance

**Instagram (1080x1080):**
- [ ] Image loads without errors
- [ ] Square orientation
- [ ] Same compositing as YouTube
- [ ] Text adapted to square format
- [ ] Professional appearance

### Success = All Checks Pass ✅

---

## 📊 Expected Timeline

| Step | Action | Time | Status |
|------|--------|------|--------|
| 1 | Upload test-lala.png | ~10s | ⏳ |
| 2 | Process background | 5-30s | ⏳ |
| 3 | Upload test-guest.png | ~10s | ⏳ |
| 2b | Process guest background | 5-30s | ⏳ |
| 4 | Upload test-frame.png | ~10s | ⏳ |
| 2c | Process frame background | 5-30s | ⏳ |
| 5 | Create composition | ~5s | ⏳ |
| 6 | Generate thumbnails | 5-15s | ⏳ |
| 7 | Verify results | ~5 min | ⏳ |
| | **TOTAL** | **~2 hours** | |

---

## 🚨 Troubleshooting Guide

### Issue: Upload fails with 401 error
**Solution:** 
- Ensure you're logged in via AWS Cognito
- Check browser console for auth errors
- Try refreshing page and logging in again

### Issue: Process Background button doesn't work
**Solution:**
- Check backend is running: http://localhost:3002/api/v1/episodes
- Check browser console for network errors
- Verify asset ID is correct
- Try refreshing page

### Issue: Background removal takes > 60 seconds
**Solution:**
- Runway ML API might be slow
- Check if API key is valid in .env
- API might be timing out (this is OK, system falls back to original)
- Check backend logs for errors

### Issue: Composition creation fails
**Solution:**
- Ensure all 3 assets are APPROVED status
- Check all fields are filled in
- Try selecting assets again
- Refresh page and try again

### Issue: Thumbnail generation fails
**Solution:**
- Verify composition status is "DRAFT"
- Check Sharp library is installed: `npm list sharp`
- Verify test images are correct size
- Check backend logs for errors
- Verify S3 bucket is accessible

### Issue: S3 files don't appear
**Solution:**
- Check AWS credentials in .env file
- Verify S3 bucket names are correct
- Check S3 bucket permissions
- Look at CloudWatch logs for upload errors
- Verify bucket exists in correct region

### Issue: Thumbnails look wrong
**Solution:**
- Check test images have correct colors:
  - test-lala.png = PINK
  - test-guest.png = BLUE
  - test-frame.png = GREEN
- Verify Sharp compositing is working
- Check if assets are positioned correctly
- Inspect actual files in S3

---

## ✅ Success Checklist

**Phase 2.5 Testing is COMPLETE when:**

```
UPLOADS:
  ✅ test-lala.png uploaded
  ✅ test-guest.png uploaded
  ✅ test-frame.png uploaded

PROCESSING:
  ✅ Background removal completes for all 3
  ✅ Assets show APPROVED status
  ✅ Processed images in S3

COMPOSITION:
  ✅ Composition created
  ✅ Shows in Draft Compositions
  ✅ All 3 assets referenced

THUMBNAIL GENERATION:
  ✅ Thumbnails generate successfully
  ✅ 2 formats created (YouTube + Instagram)
  ✅ Correct dimensions
  ✅ Files in S3

VISUAL INSPECTION:
  ✅ YouTube thumbnail valid image
  ✅ Instagram thumbnail valid image
  ✅ Compositing looks good
  ✅ No artifacts or errors
```

---

## 🎯 Current Status

```
Step 1 (Upload PROMO_LALA):      ⏳ READY
Step 2 (Process Background):     ⏳ READY
Step 3 (Upload PROMO_GUEST):     ⏳ READY
Step 4 (Upload EPISODE_FRAME):   ⏳ READY
Step 5 (Create Composition):     ⏳ READY
Step 6 (Generate Thumbnails):    ⏳ READY
Step 7 (Verify Results):         ⏳ READY
```

---

## 🚀 Ready to Start?

```
✅ Servers: Running (3002 + 5173)
✅ Test Images: Generated (test-images/)
✅ Frontend: Open (http://localhost:5173)
✅ Backend: Running
✅ Documentation: Complete

👉 BEGIN TESTING NOW
```

---

**Testing Status:** READY TO BEGIN ✅  
**Documentation:** COMPLETE  
**Next:** Execute Step 1 (Upload PROMO_LALA)

---

## 📝 Notes While Testing

Use this space to log results:

### Step 1 Results
- Asset uploaded: __________
- Asset ID: __________
- Status: __________

### Step 2 Results
- Processing started: __________
- Processing completed: __________
- Asset moved to Approved: YES / NO

### Step 6 Results
- Thumbnails generated: YES / NO
- YouTube format created: YES / NO
- Instagram format created: YES / NO
- File sizes: YouTube _____ KB, Instagram _____ KB

### Final Results
- All tests passed: YES / NO
- Issues encountered: ___________________________
- Visual inspection: Good / Needs improvement / Failed

---

**Good luck! 🎬**
