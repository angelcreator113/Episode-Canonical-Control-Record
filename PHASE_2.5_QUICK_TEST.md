# 🎬 Phase 2.5 Quick Test Checklist

## ✅ PRE-TEST (All Ready)

```
✅ Backend: npm run dev (port 3002)
✅ Frontend: http://localhost:5173
✅ Test Images: test-images/ folder
✅ Database: RDS connected
✅ S3: Configured
✅ Runway ML API: In .env
```

---

## 🎯 QUICK TEST WORKFLOW (7 Steps)

### 1️⃣ Upload PROMO_LALA
```
Frontend → AssetManager → Upload
File: test-images/test-lala.png
Type: PROMO_LALA
Expected: "⏳ PENDING" status
⏱️ 10 seconds
```

### 2️⃣ Process Background Removal
```
AssetManager → Pending Assets Tab
Click: "🎨 Process Background"
Expected: Spinner → "✅ APPROVED"
Note: Calls Runway ML API (may fall back to original)
⏱️ 5-30 seconds
```

### 3️⃣ Upload Guest Asset
```
Same as Step 1, but:
File: test-images/test-guest.png
Type: PROMO_GUEST
Expected: "✅ APPROVED" after processing
⏱️ 10-40 seconds
```

### 4️⃣ Upload Frame Asset
```
Same as Step 1, but:
File: test-images/test-frame.png
Type: EPISODE_FRAME
Expected: "✅ APPROVED" after processing
⏱️ 10-40 seconds
```

### 5️⃣ Create Composition
```
Frontend → ThumbnailComposer
Template: (select any)
Background: test-frame
Lala: test-lala
Guest: test-guest
Click: "🎨 Create Composition"
Expected: Appears in "Draft Compositions"
⏱️ 5 seconds
```

### 6️⃣ Generate Thumbnails
```
ThumbnailComposer → Draft Compositions
Click: "🎨 Generate Thumbnails"
Expected: Spinner → Shows 2 formats:
  • YOUTUBE: 1920x1080
  • INSTAGRAM_FEED: 1080x1080
⏱️ 5-15 seconds
```

### 7️⃣ Verify Results
```
Check:
  ✅ Database: asset & composition records created
  ✅ S3: Processed images and thumbnails uploaded
  ✅ Frontend: Lists generated formats with sizes
  ✅ Visual: Download and inspect compositing
⏱️ 2 minutes
```

---

## 🎬 Expected Results

### Database
```sql
SELECT * FROM Assets WHERE asset_type = 'PROMO_LALA';
-- Should show: 3 records with status APPROVED

SELECT * FROM ThumbnailCompositions WHERE status = 'APPROVED';
-- Should show: 1 record
```

### S3 Paths
```
episode-metadata-storage-dev/
├── promotional/lala/processed/    ✅ Processed image
├── promotional/guest/processed/   ✅ Processed image
├── episode/frame/raw/             ✅ Frame image
└── thumbnails/composite/*/
    ├── YOUTUBE-*.jpg              ✅ 1920x1080
    └── INSTAGRAM_FEED-*.jpg       ✅ 1080x1080
```

### UI Feedback
```
AssetManager:
  ✅ Approved Assets tab shows 3 items
  ✅ Each shows "✅ APPROVED" status

ThumbnailComposer:
  ✅ Composition created in Draft section
  ✅ "Generate Thumbnails" button shows "✅ Generated"
  ✅ Lists 2 thumbnail formats with metadata
```

---

## ⚡ Speed Summary

| Action | Time |
|--------|------|
| Upload asset | 5-10s |
| Process (Runway ML) | 5-30s |
| Create composition | 5s |
| Generate thumbnails (Sharp) | 5-15s |
| **Total Full Test** | **< 2 minutes** |

---

## 🚨 If Something Breaks

| Issue | Fix |
|-------|-----|
| 401 Auth error | Ensure logged in via Cognito |
| Upload fails | Check file size < 500MB |
| Background removal doesn't work | Runway ML API fallback is OK |
| Thumbnails wrong | Check Sharp library installed |
| S3 files missing | Check AWS credentials in .env |
| Server won't start | Kill node: `Get-Process -Name node \| Stop-Process -Force` |

---

## 📊 Success = All These Pass

- [x] Backend + Frontend running
- [ ] Asset 1: Upload → Process → Approve
- [ ] Asset 2: Upload → Process → Approve  
- [ ] Asset 3: Upload → Process → Approve
- [ ] Composition: Created with 3 assets
- [ ] Thumbnails: Generated (2 formats)
- [ ] S3: 7 files verified
- [ ] Visual: Compositing looks good

---

## 🎉 Phase 2.5 Complete When:

✅ All 7 test steps pass  
✅ No database errors  
✅ S3 files verified  
✅ Visual inspection OK  
✅ No blocking issues  

**Status:** Ready for Phase 3 (Async Lambda)

---

**Last Updated:** January 2, 2026  
**Estimated Test Time:** 2-3 hours including manual inspection  
**Difficulty:** Easy (UI-based, no code required)
