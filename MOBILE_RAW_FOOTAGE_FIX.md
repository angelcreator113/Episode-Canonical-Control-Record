# Mobile Raw Footage Upload Fix

## Issue
Videos uploaded from mobile phones to the Raw Footage section were failing.

## Root Cause
The `RawFootageUpload.jsx` component was missing mobile video format support in its `acceptedFormats` configuration, even though the backend was already configured to accept these formats.

## Fixes Applied

### 1. Mobile Format Support (Issue #1)

**File:** [frontend/src/components/RawFootageUpload.jsx](frontend/src/components/RawFootageUpload.jsx#L176-L185)

**Before:**
```javascript
const acceptedFormats = {
  'video/mp4': ['.mp4'],
  'video/quicktime': ['.mov'],
  'video/x-msvideo': ['.avi'],
  'video/webm': ['.webm']
};
```

**After:**
```javascript
const acceptedFormats = {
  'video/mp4': ['.mp4'],
  'video/quicktime': ['.mov'],           // iOS MOV files
  'video/x-m4v': ['.m4v'],              // iOS M4V files
  'video/3gpp': ['.3gp'],               // Android 3GP files
  'video/3gpp2': ['.3g2'],              // Android 3G2 files
  'video/x-msvideo': ['.avi'],          // Desktop AVI
  'video/webm': ['.webm'],              // Desktop WebM
  'video/x-matroska': ['.mkv']          // Desktop MKV
};
```

### 2. Video Thumbnail Generation (Issue #2)

**Problem:** Users couldn't see preview thumbnails when uploading videos.

**Solution:** Added client-side thumbnail generation that creates a preview image immediately when a video is selected.

**File:** [frontend/src/components/RawFootageUpload.jsx](frontend/src/components/RawFootageUpload.jsx#L177-L224)

**New Function Added:**
```javascript
const generateVideoThumbnail = (file) => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    
    video.onloadedmetadata = () => {
      // Seek to 1 second or 10% of duration
      video.currentTime = Math.min(1, video.duration * 0.1);
    };
    
    video.onseeked = () => {
      // Set canvas size and draw frame
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert to data URL
      const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
      URL.revokeObjectURL(video.src);
      resolve(thumbnail);
    };
    
    video.src = URL.createObjectURL(file);
  });
};
```

**Updated Upload Flow:**
- Generates thumbnail from video file before upload
- Stores thumbnail as base64 data URL
- Displays thumbnail immediately in the UI
- Falls back to S3 video for existing uploads

### Backend Status
✅ **Already configured correctly** - [src/routes/footage.js](src/routes/footage.js#L18-L38) already has:
- Mobile format MIME types
- File extension fallback validation
- Proper error messages

## Supported Formats

| Format | Extension | MIME Type | Platform |
|--------|-----------|-----------|----------|
| MP4 | .mp4 | video/mp4 | All |
| MOV | .mov | video/quicktime | iOS, Desktop |
| M4V | .m4v | video/x-m4v | iOS |
| 3GP | .3gp | video/3gpp | Android |
| 3G2 | .3g2 | video/3gpp2 | Android |
| AVI | .avi | video/x-msvideo | Desktop |
| WebM | .webm | video/webm | Desktop |
| MKV | .mkv | video/x-matroska | Desktop |

## Testing

### From Mobile Phone:
1. Open the application on your phone
2. Navigate to an Episode
3. Go to the "Raw Footage" tab
4. Click "Upload" or drag & drop
5. Select a video from your phone's gallery/photos
6. The upload should now work for:
   - iOS: MP4, MOV, M4V files
   - Android: MP4, 3GP, 3G2 files

### Expected Behavior:
- ✅ File picker shows video files
- ✅ Upload starts immediately after selection
- ✅ Progress bar shows upload status
- ✅ Video appears in the footage list after upload completes

## Status
✅ **FIXED** - Frontend rebuilt with mobile format support

## Implementation Date
February 9, 2026

## Related Documentation
- [MOBILE_VIDEO_UPLOAD_FIX.md](MOBILE_VIDEO_UPLOAD_FIX.md) - Previous fix for Scene Library
- [RawFootageUpload.jsx](frontend/src/components/RawFootageUpload.jsx) - Component source
- [footage.js](src/routes/footage.js) - Backend route
