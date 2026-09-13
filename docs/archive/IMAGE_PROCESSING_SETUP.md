# Image Processing Setup Guide

## ✅ Implementation Complete

All image processing features have been successfully implemented with the following improvements:
- **Performance**: Only checks processing status for selected slot asset
- **Caching**: Returns cached versions to avoid redundant API calls
- **Error Handling**: Comprehensive error tracking with status updates
- **UX**: Clear loading states, status indicators, and helpful tips

---

## 📋 What Was Implemented

### 1. Database Changes ✅
**File**: `migrations/2026-01-28-add-image-processing-fields.sql`
- Added `s3_url_no_bg` - Stores background-removed image URL
- Added `s3_url_enhanced` - Stores enhanced image URL
- Added `processing_status` - Tracks current processing state
- Added `processing_metadata` - JSON field for detailed processing info
- Added performance index on `processing_status`

### 2. Backend Model Updates ✅
**File**: `src/models/Asset.js`
- Updated Asset model with new fields
- Added comments documenting field purposes
- Maintains backward compatibility with existing assets

### 3. Backend API Routes ✅
**File**: `backend/src/routes/imageProcessing.js`
**Endpoints**:
- `POST /api/v1/assets/:id/remove-background` - Remove.bg integration
- `POST /api/v1/assets/:id/enhance` - Cloudinary enhancement
- `GET /api/v1/assets/:id/processing-status` - Check processing state
- `POST /api/v1/assets/:id/reset-processing` - Reset for re-processing

**Features**:
- Caching to avoid redundant API calls
- Detailed logging for debugging
- Error tracking with status updates
- Placeholder comments for auth and rate limiting

### 4. Route Registration ✅
**File**: `src/app.js`
- Registered image processing routes at `/api/v1/assets/*`
- Added graceful error handling if routes fail to load

### 5. Frontend UI ✅
**File**: `frontend/src/pages/ThumbnailComposer.jsx`
**New Features**:
- Image processing buttons in slot properties panel
- Real-time status indicators (✅ Background Removed, ✨ Enhanced)
- Loading states during processing (⏳ Removing..., ⏳ Enhancing...)
- Optimized status checking (only for selected slot)
- Smart URL priority: Enhanced → No BG → Thumbnail → Raw
- CHARACTER-only filtering (processing only available for character assets)
- Helpful tips and guidance

### 6. NPM Packages ✅
**Installed**:
- `form-data` - For multipart form uploads to Remove.bg
- `cloudinary` - For image enhancement transformations

---

## 🔧 Required Configuration

### Environment Variables
Add these to your `.env` file:

```env
# Remove.bg API (Background Removal)
REMOVE_BG_API_KEY=your_remove_bg_api_key_here

# Cloudinary (Image Enhancement)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### Get API Keys:

#### Remove.bg
1. Go to https://www.remove.bg/api
2. Sign up for free account (50 free images/month)
3. Get API key from dashboard
4. Add to `.env` as `REMOVE_BG_API_KEY`

#### Cloudinary
1. Go to https://cloudinary.com/users/register/free
2. Create free account
3. Get credentials from dashboard:
   - Cloud Name
   - API Key
   - API Secret
4. Add all three to `.env`

---

## 🚀 Running the Migration

```bash
# Option 1: Using node-pg-migrate (if configured)
npm run migrate up

# Option 2: Direct SQL execution
psql -U your_username -d your_database -f migrations/2026-01-28-add-image-processing-fields.sql

# Option 3: Using your existing migration script (if available)
node migrations/migrate.js
```

**Verify Migration**:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'assets' 
  AND column_name IN ('s3_url_no_bg', 's3_url_enhanced', 'processing_status', 'processing_metadata');
```

---

## 🧪 Testing the Features

### 1. Start Your Servers
```bash
# Terminal 1: Backend
cd backend
npm start

# Terminal 2: Frontend
cd frontend
npm run dev
```

### 2. Test Workflow
1. Navigate to any episode with character assets
2. Open Thumbnail Composer
3. Click on a character slot (CHAR.HOST.LALA, CHAR.GUEST.1, etc.)
4. In the properties panel, you'll see:
   - **🎨 Image Processing** section (CHARACTER slots only)
   - **🎨 Remove Background** button
   - **✨ Enhance Image** button
5. Click "Remove Background" → Wait for processing → See ✅ status
6. Click "Enhance Image" → Wait for processing → See ✨ status
7. Canvas will auto-reload with processed images

### 3. Verify API Responses
```bash
# Check processing status
curl http://localhost:3002/api/v1/assets/YOUR_ASSET_ID/processing-status

# Expected response:
{
  "status": "SUCCESS",
  "data": {
    "asset_id": "uuid-here",
    "processing_status": "enhanced",
    "has_bg_removed": true,
    "has_enhanced": true,
    "metadata": { ... }
  }
}
```

---

## 📊 How It Works

### Image Processing Flow

1. **User Action**: Clicks "Remove Background" or "Enhance Image"
2. **Frontend**: 
   - Sets `processingAsset` state (shows loading UI)
   - Calls backend API endpoint
3. **Backend**:
   - Checks if already processed (returns cached if yes)
   - Updates `processing_status` to "processing_bg_removal" or "processing_enhancement"
   - Calls external API (Remove.bg or Cloudinary)
   - Uploads result to S3 (for background removal)
   - Updates asset with new URL and metadata
   - Sets `processing_status` to "bg_removed" or "enhanced"
4. **Frontend**:
   - Updates `processingStatus` state
   - Reloads composition (triggers `buildAssetMap`)
   - `buildAssetMap` prioritizes processed versions
   - Canvas refreshes with new image

### URL Priority System
```javascript
// buildAssetMap checks URLs in this order:
const assetUrl = 
  ca.asset.s3_url_enhanced ||           // 1. Enhanced (best)
  ca.asset.s3_url_no_bg ||              // 2. No background
  ca.asset.metadata?.thumbnail_url ||   // 3. Thumbnail
  ca.asset.s3_url_raw ||                // 4. Raw original
  ca.asset.s3_url;                      // 5. Fallback
```

---

## 🛡️ Security & Performance Notes

### TODO: Add Authentication
The routes have placeholder comments for auth:
```javascript
// TODO: Add authentication check
// if (!req.user) return res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
```

### TODO: Add Rate Limiting
Protect against API quota exhaustion:
```javascript
// TODO: Add rate limiting check
// const usage = await checkMonthlyUsage('bg_removal');
// if (usage >= process.env.MONTHLY_REMOVEBG_LIMIT) {
//   return res.status(429).json({ status: 'ERROR', message: 'Monthly quota exceeded' });
// }
```

### Performance Optimization
- **Frontend**: Only checks processing status for selected slot (not all assets)
- **Backend**: Caches processed results (checks `s3_url_no_bg` and `s3_url_enhanced` before processing)
- **Database**: Index on `processing_status` for fast queries

---

## 🐛 Troubleshooting

### Images Not Processing
**Check**:
1. API keys in `.env` are correct
2. Backend console for error messages
3. Network tab in browser DevTools for API responses
4. Asset has valid `s3_url_raw` or `s3_url`

### "API Key Not Configured" Error
```bash
# Verify .env file exists and is loaded
echo $REMOVE_BG_API_KEY
echo $CLOUDINARY_CLOUD_NAME

# Restart backend server after adding keys
```

### Processing Status Not Updating
- Check browser console for errors
- Verify `checkProcessingStatus` is being called
- Ensure asset ID matches between frontend and backend

### Processed Images Not Showing
- Check S3 upload succeeded (backend logs)
- Verify CORS is configured on S3 bucket
- Hard refresh browser (Ctrl+Shift+R) to clear cache

---

## 💡 Usage Tips

1. **Always remove background before enhancement** for best results
2. **CHARACTER slots only** - Processing buttons only appear for character assets
3. **Cache-friendly** - Re-processing resets the cache and creates new versions
4. **Status indicators** show what processing has been applied:
   - ✅ Background Removed
   - ✨ Image Enhanced
5. **Disabled states** prevent accidental double-processing while operations are running

---

## 📈 Future Enhancements (Optional)

- [ ] Add sliders for enhancement settings (skin_smooth, saturation, etc.)
- [ ] Batch processing for multiple assets
- [ ] Preview before/after comparison
- [ ] Custom enhancement presets
- [ ] Progress bars for long operations
- [ ] Usage tracking dashboard
- [ ] Webhook notifications for async processing
- [ ] Support for video assets

---

## 📝 API Reference

### Remove Background
```http
POST /api/v1/assets/:id/remove-background
Content-Type: application/json

Response:
{
  "status": "SUCCESS",
  "message": "Background removed successfully",
  "data": {
    "asset_id": "uuid",
    "url": "https://s3.../no-bg.png",
    "original_url": "https://s3.../original.jpg"
  }
}
```

### Enhance Image
```http
POST /api/v1/assets/:id/enhance
Content-Type: application/json

Body:
{
  "skin_smooth": 50,
  "saturation": 20,
  "vibrance": 20,
  "contrast": 10,
  "sharpen": 20
}

Response:
{
  "status": "SUCCESS",
  "message": "Image enhanced successfully",
  "data": {
    "asset_id": "uuid",
    "url": "https://cloudinary.../enhanced.jpg",
    "settings": { ... }
  }
}
```

### Check Status
```http
GET /api/v1/assets/:id/processing-status

Response:
{
  "status": "SUCCESS",
  "data": {
    "asset_id": "uuid",
    "processing_status": "enhanced",
    "has_bg_removed": true,
    "has_enhanced": true,
    "metadata": { ... }
  }
}
```

### Reset Processing
```http
POST /api/v1/assets/:id/reset-processing
Content-Type: application/json

Body:
{
  "reset_type": "all" | "bg_removal" | "enhancement"
}

Response:
{
  "status": "SUCCESS",
  "message": "Processing reset successfully",
  "data": { "asset_id": "uuid" }
}
```

---

## ✅ Implementation Checklist

- [x] Database migration created
- [x] Asset model updated
- [x] Backend routes implemented
- [x] Routes registered in app.js
- [x] Frontend UI updated
- [x] NPM packages installed
- [ ] Environment variables configured (USER ACTION REQUIRED)
- [ ] Migration executed (USER ACTION REQUIRED)
- [ ] API keys obtained (USER ACTION REQUIRED)
- [ ] Testing completed (USER ACTION REQUIRED)

---

## 🎉 Ready to Use!

Once you've:
1. Added API keys to `.env`
2. Run the database migration
3. Restarted your backend server

You'll have fully functional image processing with background removal and enhancement capabilities!

**Questions?** Check the console logs - they're comprehensive and will help debug any issues.
