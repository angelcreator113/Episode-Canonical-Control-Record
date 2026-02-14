# Scene Thumbnails - Enabled and Fixed ✅

**Date:** January 24, 2026  
**Status:** Enabled

## What Was Fixed

### 1. ✅ VideoProcessingService Metadata Extraction
**Issue:** Code was trying to use ffprobe JSON output format, but ffprobe.exe wasn't available

**Fix:** Updated to parse ffmpeg's stderr output directly
- Uses regex to extract duration (HH:MM:SS.ss format)
- Parses video resolution (widthxheight)
- Extracts bitrate from output
- Falls back gracefully if parsing fails

```javascript
// Before (required ffprobe):
const ffprobeCmd = `"${this.ffmpegPath}" -i "${inputPath}" -v quiet -print_format json -show_format -show_streams`;
const { stdout } = await execAsync(ffprobeCmd);
const metadata = JSON.parse(stdout);

// After (uses ffmpeg directly):
const ffprobeCmd = `"${this.ffmpegPath}" -i "${inputPath}" -hide_banner`;
const { stdout, stderr } = await execAsync(ffprobeCmd);
const output = stderr || stdout; // ffmpeg outputs to stderr

// Parse duration: "Duration: 00:01:23.45"
const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);

// Parse resolution: "1920x1080"
const videoMatch = output.match(/Stream.*Video:.*?(\d{3,5})x(\d{3,5})/);
```

### 2. ✅ S3Service Usage in Controller
**Issue:** Controller was trying to instantiate S3Service with `new S3Service()` but it's exported as a singleton

**Fix:** Updated to use the exported singleton
```javascript
// Before:
const s3Service = new S3Service();

// After:
const s3Service = require('../services/S3Service');
```

### 3. ✅ Thumbnail Generation Already Implemented
**Status:** Thumbnail generation was already working correctly!

The code already includes:
- Generate thumbnail at 3 seconds (or 20% into video, whichever is less)
- Upload thumbnail to S3 at `shows/{showId}/scene-library/{sceneId}/thumbnail.jpg`
- Store thumbnail URL in database `thumbnail_url` field
- Display thumbnails in frontend grid view

---

## How Thumbnails Work

### Upload Flow with Thumbnails
```
1. User uploads video
   ↓
2. Video uploaded to S3
   ↓
3. Scene record created with status: "processing"
   ↓
4. Background job starts (100ms delay):
   ├─ Download video from S3 to buffer
   ├─ Extract metadata using ffmpeg
   ├─ Generate thumbnail (320px wide JPEG)
   ├─ Upload thumbnail to S3
   └─ Update scene record:
      ├─ thumbnail_url: S3 URL
      ├─ duration_seconds: extracted duration
      ├─ resolution: "1920x1080"
      ├─ file_size_bytes: file size
      └─ processing_status: "ready"
```

### Thumbnail Specifications
- **Format:** JPEG
- **Width:** 320px
- **Height:** Auto (maintains aspect ratio)
- **Timestamp:** 3 seconds OR 20% into video (whichever is less)
- **S3 Path:** `shows/{showId}/scene-library/{sceneId}/thumbnail.jpg`

### Frontend Display
Thumbnails are displayed in:
- ✅ Scene Library Picker (grid view)
- ✅ Episode Detail page (scene cards)
- ✅ Scene Detail page (video player poster)
- ✅ Scene Library page (main grid)

All components check both `thumbnailUrl` and `thumbnail_url` for compatibility.

---

## Testing Thumbnails

### 1. Upload a Test Video
```bash
curl -X POST http://localhost:3002/api/v1/scene-library/upload \
  -F "file=@test-video.mp4" \
  -F "showId=<your-show-id>" \
  -F "title=Test Scene"
```

### 2. Check Processing Status
```bash
curl http://localhost:3002/api/v1/scene-library/{scene-id}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "scene-uuid",
    "title": "Test Scene",
    "thumbnail_url": "https://bucket.s3.region.amazonaws.com/shows/.../thumbnail.jpg",
    "duration_seconds": 45.5,
    "resolution": "1920x1080",
    "processing_status": "ready"
  }
}
```

### 3. Verify Thumbnail in Browser
- Navigate to Scene Library in frontend
- Thumbnails should appear in grid
- Click scene to see full preview

---

## What to Expect

### During Upload (First Few Seconds)
- Scene appears with placeholder icon 🎥
- Status shows "Processing..."
- No thumbnail yet

### After Processing (~5-10 seconds)
- Thumbnail appears automatically
- Duration badge shows correct time
- Resolution displayed (e.g., "1920x1080")
- Status becomes "Ready"

### If Processing Fails
- Status shows "Failed"
- Error message stored in `processing_error`
- Original video remains in S3
- Can retry processing or delete scene

---

## Troubleshooting

### Thumbnails Not Appearing

**Check 1: S3 Permissions**
```bash
# Verify bucket allows public read
aws s3api get-bucket-acl --bucket episode-metadata-storage-dev
```

**Check 2: Processing Status**
```bash
curl http://localhost:3002/api/v1/scene-library?processingStatus=failed
```

**Check 3: Server Logs**
Look for these log messages:
- `🎬 Starting video processing for scene {id}`
- `📊 Extracting video metadata...`
- `✅ Metadata extracted: { duration, width, height }`
- `🖼️  Generating thumbnail...`
- `☁️  Uploading thumbnail to S3...`
- `✅ Video processing complete for scene {id}`

**Check 4: ffmpeg is Working**
```powershell
& "C:\Users\12483\Projects\Episode-Canonical-Control-Record-1\bin\ffmpeg.exe" -version
```

### Common Issues

**Issue:** "ffmpeg not found"
**Fix:** Verify ffmpeg.exe exists in `bin/` folder

**Issue:** Thumbnail URL returns 403
**Fix:** Update S3 bucket policy to allow public read:
```json
{
  "Effect": "Allow",
  "Principal": "*",
  "Action": "s3:GetObject",
  "Resource": "arn:aws:s3:::episode-metadata-storage-dev/*"
}
```

**Issue:** Processing status stuck on "processing"
**Fix:** Check server logs for errors, restart background job processing

---

## Configuration

### Environment Variables Required
```env
# S3 Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key-id
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_PRIMARY_BUCKET=episode-metadata-storage-dev

# ffmpeg (handled automatically)
# Located at: bin/ffmpeg.exe
```

### Thumbnail Settings (in code)
```javascript
// Thumbnail generation options
const thumbnailTimestamp = Math.min(3, metadata.duration * 0.2);
const thumbnailOptions = {
  timestamp: thumbnailTimestamp, // 3s or 20% into video
  width: 320,                    // 320px wide
  height: null,                  // Auto aspect ratio
};
```

---

## Summary

✅ **Thumbnails are fully enabled and working**

The system will automatically:
1. Generate thumbnails when videos are uploaded
2. Store them in S3 with organized paths
3. Display them in all relevant UI components
4. Handle errors gracefully with fallback placeholders

**No additional setup required** - just upload a video and watch the thumbnail appear after processing completes (~5-10 seconds).
