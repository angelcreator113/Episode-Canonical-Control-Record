# THUMBNAIL EDITING - QUICK REFERENCE

## Three Ways to Edit Thumbnails

### 1️⃣ **Direct API Call** (Fastest)
```bash
PUT http://localhost:3002/api/v1/thumbnails/:id

Authorization: Bearer [token]
Content-Type: application/json

{
  "qualityRating": "excellent",    # low, medium, high, excellent
  "widthPixels": 1920,
  "heightPixels": 1080,
  "format": "jpeg"                 # jpeg, png, webp, gif
}
```

✅ **Best for**: Programmatic updates, batch operations  
⏱️ **Time**: ~50ms  
🔑 **Requires**: Editor+ role token

---

### 2️⃣ **Edit Episode Page** (Visual)
Navigate to: `http://localhost:5173/episodes/[id]/edit`

Scroll to **"Generated Thumbnails"** section ⬇️

**Current features**:
- View all episode thumbnails
- See metadata (dimensions, URLs, creation date)
- Quality ratings
- S3 bucket references

**Manage via**: Use Method #1 (API) to edit properties

✅ **Best for**: Visual review, quick lookups  
⏱️ **Time**: Instant  
🔑 **Requires**: Any authenticated user

---

### 3️⃣ **Thumbnail Composer** (Create New)
Navigate to: `http://localhost:5173/compose`

**Workflow**:
```
1. Select Episode
2. Choose Template (YouTube, Instagram, Facebook, Twitter, TikTok)
3. Pick Assets (Lala image, Guest, Background frame)
4. Select Output Formats
5. Generate → Review → Publish → Set as Primary
```

✅ **Best for**: Creating new thumbnail variations  
⏱️ **Time**: 2-5 seconds generation  
🔑 **Requires**: Editor+ role

---

## API Endpoints for Thumbnail Management

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/api/v1/thumbnails` | List all thumbnails | Any |
| GET | `/api/v1/thumbnails/:id` | Get specific thumbnail | Any |
| PUT | `/api/v1/thumbnails/:id` | **EDIT** thumbnail | Editor+ |
| POST | `/api/v1/thumbnails/:id/set-primary` | Mark as primary | Editor+ |
| POST | `/api/v1/thumbnails/:id/publish` | Make official | Editor+ |
| DELETE | `/api/v1/thumbnails/:id` | Remove thumbnail | Admin |
| GET | `/api/v1/thumbnails/episode/:id` | Get by episode | Any |

---

## Example Edits

### Change Quality Rating
```bash
curl -X PUT http://localhost:3002/api/v1/thumbnails/abc-123 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "qualityRating": "excellent" }'
```

### Update Dimensions
```bash
curl -X PUT http://localhost:3002/api/v1/thumbnails/abc-123 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "widthPixels": 1920,
    "heightPixels": 1080,
    "format": "png"
  }'
```

### Set as Primary
```bash
curl -X POST http://localhost:3002/api/v1/thumbnails/abc-123/set-primary \
  -H "Authorization: Bearer $TOKEN"
```

---

## Components & Files

### Frontend Components
- **[ThumbnailSection.jsx](frontend/src/pages/EditEpisode.jsx#L20-L75)** - Displays thumbnails
- **[ThumbnailComposer.jsx](frontend/src/pages/ThumbnailComposer.jsx)** - Creates new thumbnails
- **[AssetLibrary.jsx](frontend/src/components/AssetLibrary.jsx)** - Manages assets

### Backend Routes
- **[src/routes/thumbnails.js](src/routes/thumbnails.js)** - All thumbnail endpoints
- **[src/controllers/thumbnailController.js](src/controllers/thumbnailController.js)** - Business logic

### Models
- **[src/models/Thumbnail.js](src/models/Thumbnail.js)** - Database schema

---

## Status

✅ **All Thumbnail Features Ready**
- Create: ✅ Via Composer
- Read: ✅ List & Detail endpoints
- Update: ✅ PUT endpoint (quality, dimensions)
- Delete: ✅ Admin endpoint
- Publish: ✅ Publication workflow
- Primary: ✅ Set as primary

🟢 **Backend Status**: Healthy (port 3002)  
🟢 **Frontend Status**: Ready (port 5173)  
🟢 **Database**: Connected  
🟢 **Auth**: JWT + RBAC active

---

## Common Tasks

### View Episode Thumbnails
```
1. Go to: /episodes/[episode-id]/edit
2. Scroll to "Generated Thumbnails"
3. See all thumbnails with metadata
```

### Rate Thumbnail Quality
```bash
PUT /api/v1/thumbnails/:id
{
  "qualityRating": "excellent"  # or "high", "medium", "low"
}
```

### Make Thumbnail Official (Primary)
```bash
POST /api/v1/thumbnails/:id/set-primary
```

### Create New Thumbnails
```
1. Go to: /compose
2. Select episode & template
3. Pick assets & formats
4. Click "Generate"
5. Click "Publish"
```

### Download Thumbnail
```bash
GET /api/v1/thumbnails/:id/url
# Returns S3 URL with public access
```

---

## Need Help?

- **Backend docs**: [PHASE_1_FINAL_STATUS.md](PHASE_1_FINAL_STATUS.md)
- **API reference**: [API_QUICK_REFERENCE.md](API_QUICK_REFERENCE.md)
- **All phase info**: [PHASE_1_VERIFICATION_CHECKLIST.md](PHASE_1_VERIFICATION_CHECKLIST.md)
- **Frontend components**: Check `frontend/src/pages/` and `frontend/src/components/`
- **Backend code**: Check `src/routes/` and `src/controllers/`

