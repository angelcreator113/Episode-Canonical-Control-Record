# Asset Manager - Enhancements & Configuration Guide

## 🎉 Recently Implemented Features

### 1. **Multiple File Upload** ✅
- Upload multiple images/videos at once
- Visual upload queue with progress indicators
- Individual file status tracking (uploading, success, error)
- Clear all files button
- Sequential upload processing

### 2. **Inline Title Editing** ✅
- Double-click any asset name to edit
- Press **Enter** to save, **Esc** to cancel
- Visual pencil icon hint
- Auto-save on blur

### 3. **Robust Thumbnail Display** ✅
- Automatic fallback for failed image loads
- Placeholder images for mock S3 URLs
- Error detection with `onError` handler
- Asset type labels on placeholders

## 🗂️ S3 Folder Structure

### Current Configuration
Your assets are organized in S3 with the following structure:

```
s3://${AWS_S3_BUCKET}/
├── promotional/
│   ├── lala/
│   │   ├── raw/              # Original PROMO_LALA images
│   │   ├── processed/        # Background-removed versions
│   │   └── thumbnails/       # 300x300 thumbnails
│   ├── justawomaninherprime/
│   │   ├── raw/
│   │   ├── processed/
│   │   └── thumbnails/
│   └── guest/
│       ├── raw/
│       ├── processed/
│       └── thumbnails/
├── brand/
│   └── logo/
│       ├── raw/
│       └── thumbnails/
├── episode/
│   ├── frame/
│   │   ├── raw/
│   │   └── thumbnails/
│   └── video/
│       ├── raw/
│       └── thumbnails/
└── video/
    ├── promo/
    │   ├── raw/
    │   └── thumbnails/
    └── background/
        ├── raw/
        └── thumbnails/
```

### File Naming Convention
```
{timestamp}-{uuid}.{extension}
```
Example: `1768766865546-b3b9d937-aa46-48c3-ba89-07e646ef6ba9.jpg`

### S3 Configuration (.env)
```env
# Required for production
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_S3_BUCKET=episode-canonical-assets
AWS_REGION=us-east-1

# Optional: CloudFront CDN
CLOUDFRONT_DOMAIN=d123456789abcd.cloudfront.net
```

### Development vs Production

**Development (Current):**
- S3 uploads fail (no credentials)
- Backend returns mock URLs: `https://mock-s3.dev/...`
- Frontend displays placeholder images

**Production (With Credentials):**
- S3 uploads succeed
- Real URLs: `https://{bucket}.s3.amazonaws.com/...`
- Actual thumbnails and images display

## 🚀 Suggested Additional Enhancements

### High Priority

#### 1. **Drag & Drop Reordering**
- Drag assets to reorder them
- Save custom sort order
- Useful for organizing episode sequences

```jsx
// Implementation: Use react-beautiful-dnd
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
```

#### 2. **Asset Collections/Folders**
- Create custom collections (e.g., "Season 1 Promos")
- Add assets to multiple collections
- Filter by collection

```sql
-- New tables needed
CREATE TABLE asset_collections (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE asset_collection_items (
  collection_id UUID REFERENCES asset_collections(id),
  asset_id UUID REFERENCES assets(id),
  sort_order INT,
  PRIMARY KEY (collection_id, asset_id)
);
```

#### 3. **Advanced Search Filters**
- Date range picker (uploaded between X and Y)
- File size range
- Dimensions filter (width/height)
- Duration filter (for videos)
- Multiple label selection (AND/OR logic)

#### 4. **Batch Metadata Editor**
- Select multiple assets
- Edit description in bulk
- Add/remove labels in bulk (already implemented ✅)
- Set asset type in bulk

#### 5. **Asset Preview Modal**
- Click asset to open full-screen preview
- Navigation arrows (previous/next)
- Metadata display
- Quick actions (edit, delete, download)

```jsx
const AssetPreviewModal = ({ asset, onClose, onNext, onPrev }) => {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <img src={asset.s3_url_processed || asset.s3_url_raw} />
        <div className="modal-sidebar">
          <h2>{asset.name}</h2>
          <p>{asset.description}</p>
          {/* Actions */}
        </div>
      </div>
    </div>
  );
};
```

### Medium Priority

#### 6. **Download Assets**
- Single asset download
- Bulk download as ZIP
- Choose version (raw vs processed)

```javascript
// Backend route
router.get('/:id/download', async (req, res) => {
  const asset = await Asset.findByPk(req.params.id);
  const s3Stream = await s3.getObject({
    Bucket: BUCKET_NAME,
    Key: asset.s3_key_raw
  }).createReadStream();
  
  res.setHeader('Content-Disposition', `attachment; filename="${asset.name}"`);
  s3Stream.pipe(res);
});
```

#### 7. **Image Editing Tools**
- Crop tool
- Resize presets (1080x1080, 1920x1080, etc.)
- Apply filters
- Add watermark

Use libraries:
- `react-image-crop` for cropping
- `sharp` (backend) for processing

#### 8. **Asset Versioning**
- Keep history of edits
- Restore previous versions
- Compare versions side-by-side

```sql
CREATE TABLE asset_versions (
  id UUID PRIMARY KEY,
  asset_id UUID REFERENCES assets(id),
  version_number INT,
  s3_key VARCHAR(500),
  s3_url VARCHAR(1000),
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 9. **Usage Analytics Dashboard**
- Most used assets
- Recently uploaded
- Storage usage by type
- Charts and graphs

Use Chart.js or Recharts:
```jsx
import { BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
```

#### 10. **Asset Approval Workflow**
- Submit for review
- Reviewer comments
- Approve/reject
- Email notifications

### Low Priority (Nice to Have)

#### 11. **AI-Powered Tagging**
- Auto-detect objects in images
- Suggest labels based on content
- Face recognition for guest detection

Use AWS Rekognition:
```javascript
const rekognition = new AWS.Rekognition();
const result = await rekognition.detectLabels({
  Image: { S3Object: { Bucket, Key } },
  MaxLabels: 10
}).promise();
```

#### 12. **Color Palette Extraction**
- Extract dominant colors from images
- Filter by color
- Useful for brand consistency

Use `vibrant.js`:
```javascript
import Vibrant from 'node-vibrant';
const palette = await Vibrant.from(imageBuffer).getPalette();
```

#### 13. **Video Trimming**
- Trim video start/end
- Extract frames as images
- Generate animated thumbnails (GIF)

Use `ffmpeg`:
```javascript
const ffmpeg = require('fluent-ffmpeg');
ffmpeg(inputPath)
  .setStartTime(5)
  .setDuration(10)
  .output(outputPath)
  .run();
```

#### 14. **Duplicate Detection**
- Find similar/identical images
- Perceptual hashing (pHash)
- Suggest duplicates for removal

#### 15. **Asset Sharing**
- Generate public share links
- Set expiration time
- Password protection
- Embed codes

## 🔧 Technical Improvements

### 1. **Optimize Database Queries**
```javascript
// Add indexes for common queries
await sequelize.query(`
  CREATE INDEX idx_assets_type ON assets(asset_type);
  CREATE INDEX idx_assets_media_type ON assets(media_type);
  CREATE INDEX idx_assets_created ON assets(created_at DESC);
`);
```

### 2. **Implement Caching**
```javascript
// Use Redis for frequently accessed data
const redis = require('redis');
const client = redis.createClient();

// Cache asset list for 5 minutes
const cacheKey = 'assets:list:' + filters;
const cached = await client.get(cacheKey);
if (cached) return JSON.parse(cached);

const assets = await Asset.findAll(...);
await client.setex(cacheKey, 300, JSON.stringify(assets));
```

### 3. **Add WebSocket for Real-time Updates**
```javascript
// Notify all clients when asset is uploaded
io.on('connection', (socket) => {
  socket.on('asset:uploaded', (asset) => {
    io.emit('asset:new', asset);
  });
});

// Frontend auto-refreshes list
socket.on('asset:new', (asset) => {
  setAssets(prev => [asset, ...prev]);
});
```

### 4. **Progressive Image Loading**
```jsx
// Show blurred placeholder while loading
<img
  src={asset.thumbnail}
  srcSet={`${asset.s3_url_raw} 1x, ${asset.s3_url_processed} 2x`}
  loading="lazy"
/>
```

### 5. **Infinite Scroll**
```jsx
import InfiniteScroll from 'react-infinite-scroll-component';

<InfiniteScroll
  dataLength={assets.length}
  next={loadMoreAssets}
  hasMore={hasMore}
  loader={<Spinner />}
>
  {assets.map(asset => <AssetCard key={asset.id} asset={asset} />)}
</InfiniteScroll>
```

## 📊 Priority Roadmap

### Phase 1 (Immediate) - Already Done ✅
- [x] Multiple file upload
- [x] Inline title editing
- [x] Robust thumbnail fallback

### Phase 2 (Next Sprint)
- [ ] Asset preview modal
- [ ] Download functionality
- [ ] Advanced search filters
- [ ] Asset collections/folders

### Phase 3 (Future)
- [ ] Image editing tools
- [ ] Drag & drop reordering
- [ ] Usage analytics dashboard
- [ ] Asset versioning

### Phase 4 (Nice to Have)
- [ ] AI-powered tagging
- [ ] Video trimming
- [ ] Duplicate detection
- [ ] Real-time collaboration

## 🐛 Current Known Issues & Solutions

### Issue 1: Thumbnails Not Displaying (FIXED ✅)
**Problem:** S3 uploads fail in dev environment  
**Solution:** Implemented placeholder fallback with `onError` handler

### Issue 2: Large Video Uploads
**Problem:** Videos over 500MB fail  
**Potential Solutions:**
- Increase limit in backend
- Implement chunked upload
- Use S3 multipart upload API

### Issue 3: Background Removal API Costs
**Problem:** Runway ML charges per API call  
**Solutions:**
- Add cost tracking/limits
- Batch processing
- Alternative: rembg (open source)

## 🔐 Security Considerations

### 1. **File Validation**
```javascript
// Check MIME type
const allowedTypes = ['image/jpeg', 'image/png', 'video/mp4'];
if (!allowedTypes.includes(file.mimetype)) {
  throw new Error('Invalid file type');
}

// Check file size
if (file.size > 500 * 1024 * 1024) {
  throw new Error('File too large');
}

// Scan for malware (optional)
const clamav = require('clamscan');
const result = await clamav.scanBuffer(file.buffer);
```

### 2. **Rate Limiting**
```javascript
const rateLimit = require('express-rate-limit');

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 uploads per window
  message: 'Too many uploads, please try again later'
});

router.post('/upload', uploadLimiter, uploadAsset);
```

### 3. **S3 Bucket Security**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicRead",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::episode-canonical-assets/*/thumbnails/*"
    },
    {
      "Sid": "PrivateWrite",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::episode-canonical-assets/*"
    }
  ]
}
```

## 📈 Performance Optimization

### 1. **Image Optimization**
- Use WebP format (smaller size)
- Progressive JPEGs
- Lazy loading

### 2. **Video Optimization**
- Transcode to H.264
- Generate multiple resolutions
- Use HLS streaming for large videos

### 3. **CDN Configuration**
- CloudFront for global distribution
- Cache-Control headers
- Edge caching

## 🎯 Next Steps

1. **Test current features:**
   - Upload multiple files
   - Double-click to edit names
   - Verify placeholder images work

2. **Configure S3 for production:**
   - Add AWS credentials to `.env`
   - Test actual uploads
   - Verify thumbnails display

3. **Choose next enhancements:**
   - Review priority list above
   - Discuss with team
   - Create implementation plan

---

**Last Updated:** January 18, 2026  
**Version:** 2.0  
**Status:** Multiple upload & inline editing implemented ✅
