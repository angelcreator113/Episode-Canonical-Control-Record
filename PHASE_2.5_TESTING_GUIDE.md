# Phase 2.5 End-to-End Testing Guide

## ✅ Test Status: READY

**Date:** January 2, 2026  
**Phase:** 2.5 Media Pipeline (Runway ML + Sharp)  
**Scope:** Asset upload → Background removal → Composition → Thumbnail generation

---

## 🚀 Pre-Test Setup

### Servers Running ✅
- **Backend:** http://localhost:3002 (Express API)
- **Frontend:** http://localhost:5173 (React UI)
- **Database:** RDS PostgreSQL (connected)
- **S3:** AWS S3 buckets (configured)

### Test Data Ready ✅
- **test-images/test-lala.png** (300x300, PROMO_LALA)
- **test-images/test-guest.png** (300x300, PROMO_GUEST)
- **test-images/test-frame.png** (1920x1080, EPISODE_FRAME)

---

## 📋 Test Workflow

### Phase 2.5 Feature: Runway ML Background Removal

**Endpoint:** `PUT /api/v1/assets/:id/process`

The system implements AI-powered background removal using the Runway ML API:

1. Admin selects an asset with pending status
2. Clicks "🎨 Process Background" button in AssetManager
3. System calls Runway ML API to remove background
4. Returns PNG with transparent background
5. **Fallback:** If API fails, returns original image (graceful)
6. Asset moves to "✅ APPROVED" status
7. Processed image saved to S3

**Expected Result:** Asset background removed, S3 has processed version

---

### Phase 2.5 Feature: Sharp Thumbnail Compositing

**Endpoint:** `POST /api/v1/compositions/:id/generate-thumbnails`

The system generates 2 MVP format social media thumbnails:

1. Admin creates composition with 3 assets:
   - Background (frame)
   - Lala (processed asset)
   - Guest (processed asset)

2. Clicks "🎨 Generate Thumbnails" button in ThumbnailComposer

3. System generates 2 formats using Sharp:
   - **YouTube:** 1920x1080 (16:9 landscape)
   - **Instagram Feed:** 1080x1080 (1:1 square)

4. Each thumbnail has:
   - Background resized to format size
   - Semi-transparent overlay
   - Lala positioned left/center
   - Guest positioned right/center
   - Episode title + number as text overlay

5. All generated as JPEG (90% quality, progressive)

6. Uploaded to S3: `thumbnails/composite/{episode_id}/{format}-{timestamp}.jpg`

**Expected Result:** 2 thumbnail images ready for social media

---

## 🎬 Manual Test Steps

### Step 1: Upload First Asset (PROMO_LALA)

1. **Frontend:** Open http://localhost:5173
2. **Navigate:** Asset Manager → Upload Section
3. **Select File:** `test-images/test-lala.png`
4. **Asset Type:** PROMO_LALA
5. **Upload:** Click upload button
6. **Result:** Asset appears in "Pending Assets" tab with "⏳ PENDING" status

**Expected Time:** < 10 seconds

---

### Step 2: Test Background Removal

1. **Find Asset:** In "Pending Assets" tab, find the uploaded PROMO_LALA asset
2. **Process:** Click "🎨 Process Background" button
3. **Loading:** Shows spinner while processing
4. **Result:** Asset moves to "✅ APPROVED" tab
5. **Verification:** Asset status changes to APPROVED

**Expected Time:** 5-30 seconds (depends on Runway ML API)

**Note:** If Runway ML API is unavailable, system falls back to original image. Asset still gets approved.

---

### Step 3: Upload Guest and Frame Assets

1. **Repeat Step 1** for `test-images/test-guest.png`
   - Asset Type: PROMO_GUEST
   - Result: In Pending → Process → Approved

2. **Repeat Step 1** for `test-images/test-frame.png`
   - Asset Type: EPISODE_FRAME
   - Result: In Pending → Process → Approved

**Result:** 3 approved assets ready for composition

---

### Step 4: Create Composition

1. **Navigate:** Thumbnail Composer
2. **Template:** Select any available template
3. **Assets:** Select the 3 approved assets:
   - Background: test-frame
   - Lala: test-lala
   - Guest: test-guest
4. **Create:** Click "🎨 Create Composition"
5. **Result:** Composition appears in "Draft Compositions" section

**Expected Time:** < 5 seconds

---

### Step 5: Generate Thumbnails

1. **Find Composition:** In "Draft Compositions" section
2. **Generate:** Click "🎨 Generate Thumbnails" button
3. **Loading:** Shows spinner while generating
4. **Result:** 
   - Shows "✅ Thumbnails Generated"
   - Lists 2 generated formats:
     - YOUTUBE: 1920x1080
     - INSTAGRAM_FEED: 1080x1080
5. **Preview:** Click "📥 View" links to preview in browser

**Expected Time:** 5-15 seconds (Sharp compositing)

---

### Step 6: Verify S3 Uploads

**Check these S3 paths exist:**

```
episode-metadata-storage-dev/
  ├── promotional/lala/
  │   ├── raw/          (uploaded test-lala.png)
  │   └── processed/    (processed with background removal)
  │
  ├── promotional/guest/
  │   ├── raw/          (uploaded test-guest.png)
  │   └── processed/    (processed with background removal)
  │
  ├── episode/frame/
  │   └── raw/          (uploaded test-frame.png)
  │
  └── thumbnails/composite/
      └── {episode_id}/
          ├── YOUTUBE-{timestamp}.jpg          (1920x1080)
          └── INSTAGRAM_FEED-{timestamp}.jpg   (1080x1080)
```

**Expected Files:**
- 3 raw assets (uploads)
- Up to 3 processed assets (after Runway ML)
- 2 thumbnail formats (after generation)

---

### Step 7: Visual Inspection

1. **Download:** From S3 or click "📥 View" links in UI
2. **Inspect YouTube Thumbnail:** 1920x1080 format
   - Background (green) resized to landscape
   - Semi-transparent overlay visible
   - Lala (pink) on left side
   - Guest (blue) on right side
   - Text overlay with episode info
3. **Inspect Instagram Thumbnail:** 1080x1080 format
   - Background (green) resized to square
   - Same compositing, different aspect ratio
   - Text overlay adapted to square format

**Expected Result:** Professional-looking composite thumbnails

---

## 🔍 Success Criteria

### Asset Processing ✅
- [ ] Asset uploads to "Pending Assets"
- [ ] "Process Background" button is clickable
- [ ] Processing completes (spinning → done)
- [ ] Asset moves to "Approved Assets"
- [ ] Database shows approval_status = APPROVED
- [ ] S3 has processed image file

### Thumbnail Generation ✅
- [ ] Composition creates successfully
- [ ] "Generate Thumbnails" button appears
- [ ] Generation completes (spinning → done)
- [ ] Shows "✅ Thumbnails Generated"
- [ ] Lists 2 formats (YouTube + Instagram)
- [ ] S3 has 2 thumbnail JPEG files
- [ ] Thumbnails are valid images with compositing

### End-to-End ✅
- All 7 steps complete without errors
- All database records created
- All S3 files present and valid
- Visual inspection shows correct compositing

---

## 🐛 Troubleshooting

### Issue: 401 Auth Error
**Solution:** Ensure logged in with valid AWS Cognito credentials

### Issue: Upload fails
**Solution:** Check file size < 500MB, format is PNG/JPG

### Issue: Background removal doesn't remove background
**Solution:** 
- Check RUNWAY_ML_API_KEY is set in .env
- API might not support image format
- System falls back to original image (OK for testing)

### Issue: Thumbnails look wrong
**Solution:**
- Check Sharp library installed: `npm list sharp`
- Check test images are correct dimensions
- Verify composition has all 3 assets

### Issue: S3 files not appearing
**Solution:**
- Check AWS credentials in .env
- Verify S3 bucket names are correct
- Check CloudWatch logs for upload errors

---

## 📊 Expected Timings

| Step | Feature | Time |
|------|---------|------|
| 1 | Asset upload | < 10s |
| 2 | Background removal | 5-30s |
| 3 | Upload 2 more assets | < 20s |
| 4 | Create composition | < 5s |
| 5 | Generate 2 thumbnails | 5-15s |
| **Total** | **Full test** | **< 2 min** |

---

## 📈 Performance Metrics

After completing the test, you should see:

**Backend Performance:**
- Asset processing: < 30 seconds
- Thumbnail generation: < 15 seconds

**File Sizes:**
- PROMO_LALA processed: 50-200 KB
- YOUTUBE thumbnail: 150-300 KB
- INSTAGRAM thumbnail: 100-250 KB

**S3 Uploads:**
- 5-7 total files
- All images valid JPEG/PNG
- All files < 500 MB

---

## 🎯 Phase 2.5 Completion Checklist

- [x] Backend services created (RunwayMLService, ThumbnailGeneratorService)
- [x] API endpoints implemented (asset processing, thumbnail generation)
- [x] Frontend UI updated (AssetManager, ThumbnailComposer)
- [x] Test infrastructure ready (test images, test scripts)
- [x] Servers running (backend + frontend)
- [ ] **Manual E2E test completed**
- [ ] **S3 uploads verified**
- [ ] **Visual inspection passed**
- [ ] **All tests passing**

---

## 📝 Test Report Template

After completing the manual test, generate a report with:

```
PHASE 2.5 TESTING REPORT
Date: ___________
Tester: ___________

✅ PASSED:
- Asset uploads working
- Background removal functional
- Thumbnail generation successful
- S3 files verified
- Visual inspection satisfactory

⚠️ WARNINGS (if any):
- [List any non-critical issues]

❌ FAILURES (if any):
- [List any blocking issues]

SUMMARY:
Phase 2.5 is [READY FOR PRODUCTION / NEEDS FIXES]
```

---

## 🚀 Next Phase

Once Phase 2.5 testing is complete:

**Phase 3 - Async Lambda Processing:**
- S3 event triggers
- SQS queue integration
- Lambda thumbnail generation
- All 8 social media formats
- Auto-approval on completion

---

## 📞 Support

**Questions about Phase 2.5?**
- Check: [PHASE_2.5_IMPLEMENTATION_COMPLETE.md](PHASE_2.5_IMPLEMENTATION_COMPLETE.md)
- Logs: Browser console (frontend), terminal (backend)
- Database: Check PostgreSQL for asset/composition records

**Issues?**
1. Check .env file has all required keys
2. Verify servers are running on correct ports
3. Check CloudWatch logs for AWS API errors
4. Review test images are valid PNGs

---

**Test Status:** ✅ READY  
**Last Updated:** January 2, 2026  
**Phase 2.5 Target:** Complete E2E test and verify all features
