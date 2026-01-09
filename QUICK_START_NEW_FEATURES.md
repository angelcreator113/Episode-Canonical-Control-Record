# 🚀 Quick Start Guide - New Features

## Feature 1: Real Asset File Uploads

### For Users
1. Go to **Edit Episode** page
2. Scroll to **Assets & Resources** section
3. Click **"📤 Choose File"** button
4. Select an image (JPEG/PNG/GIF/WebP, max 100MB)
5. Watch the upload progress bar
6. Asset appears in the list immediately

### API Endpoint
```bash
POST /api/v1/assets
Content-Type: multipart/form-data

file: <image file>
assetType: "PROMO_LALA" | "BRAND_LOGO" | "EPISODE_FRAME" | ...
metadata: {"description": "..."}
```

### Response
```json
{
  "status": "SUCCESS",
  "data": {
    "id": "asset-id",
    "name": "uploaded file name",
    "type": "PROMO_LALA",
    "s3Url": "https://s3.amazonaws.com/...",
    "thumbnail": "...",
    "size": 2.5,
    "uploadedAt": "2026-01-07"
  }
}
```

---

## Feature 2: Custom Templates

### For Admins - Create Template
```bash
POST /api/v1/templates
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "name": "Quick Episode",
  "description": "Template for quick episode creation",
  "defaultStatus": "draft",
  "defaultCategories": ["News", "Featured"],
  "config": {
    "episodeNumbering": "auto",
    "thumbnailStyle": "centered"
  }
}
```

### For Users - Apply Template
1. Go to **Create Episode** page
2. Find **📋 Episode Templates** section
3. Click on a template card
4. Form fields auto-populate with template defaults
5. Continue with normal episode creation

### API Endpoints
```bash
GET /api/v1/templates
  → Returns all active templates

GET /api/v1/templates/:id
  → Returns specific template

POST /api/v1/templates (ADMIN ONLY)
  → Create new template

PUT /api/v1/templates/:id (ADMIN ONLY)
  → Update template

DELETE /api/v1/templates/:id (ADMIN ONLY)
  → Delete template
```

---

## Feature 3: Audit Trail Logging

### For Admins - View Logs
1. Go to **Navigation Menu** → **Audit Log** (admin only)
2. Use filters to search:
   - Action Type: Create, Edit, Delete, View, Upload
   - Resource Type: Episode, Asset, Template
   - User ID: Specific user
   - Date Range: Start and end dates
3. Click **Apply Filters**
4. Browse results with pagination

### Log Entry Example
```json
{
  "timestamp": "2026-01-07T12:34:56Z",
  "userId": "user-id-123",
  "action": "CREATE",
  "resource": "Episode",
  "resourceId": "ep-456",
  "newValues": {
    "title": "New Episode",
    "status": "draft"
  }
}
```

### API Endpoints
```bash
GET /api/v1/audit-logs
  ?action=create
  &resource=episode
  &userId=user-id
  &startDate=2026-01-01
  &endDate=2026-01-31
  &limit=50
  &offset=0

GET /api/v1/audit-logs/stats
  → Returns dashboard statistics

GET /api/v1/audit-logs/user/:userId
  → Returns logs for specific user
```

---

## 🔐 Permissions

| Feature | View | Create/Edit | Delete |
|---------|------|------------|--------|
| Assets | All users | All users | ADMIN |
| Templates | All users | ADMIN | ADMIN |
| Audit Logs | ADMIN | System | - |

---

## 🛠️ Frontend Integration Examples

### Using TemplateSelector
```jsx
import TemplateSelector from '../components/TemplateSelector';

function CreateEpisode() {
  const [formData, setFormData] = useState({...});

  const handleTemplateSelect = (template) => {
    setFormData({
      ...formData,
      status: template.defaultStatus,
      categories: template.defaultCategories,
    });
  };

  return (
    <div>
      <TemplateSelector onTemplateSelected={handleTemplateSelect} />
      {/* Form fields */}
    </div>
  );
}
```

### Using Enhanced AssetLibrary
```jsx
import AssetLibrary from '../components/AssetLibrary';

function EditEpisode() {
  const handleAssetSelect = (asset) => {
    console.log('Selected asset:', asset);
    // Use asset for composition, etc.
  };

  return (
    <div>
      <AssetLibrary 
        episodeId={episodeId}
        onAssetSelect={handleAssetSelect}
        readOnly={false}  // Enable uploads
      />
    </div>
  );
}
```

### Logging Actions
```jsx
import AuditLogger from '../services/AuditLogger';

// After creating an episode
const episode = await createEpisode(data);
await AuditLogger.logEpisodeCreate(episode, userId, username, req);

// After updating
const oldEpisode = {...};
const newEpisode = await updateEpisode(id, data);
await AuditLogger.logEpisodeUpdate(oldEpisode, newEpisode, userId, username, req);
```

---

## 📊 Useful Queries

### Get all assets of type
```bash
GET /api/v1/assets/approved/PROMO_LALA
```

### Get pending assets (for approval)
```bash
GET /api/v1/assets/pending
```

### Get user activity
```bash
GET /api/v1/audit-logs/user/user-123
```

### Get creation statistics
```bash
GET /api/v1/audit-logs/stats
```

---

## 🐛 Troubleshooting

### Upload fails with "File too large"
- Maximum file size is 100MB
- Compress your image before uploading

### Upload fails with "Invalid file type"
- Supported types: JPEG, PNG, GIF, WebP
- Convert your image to one of these formats

### Templates not showing
- Must be marked as `isActive: true`
- Must be logged in as admin to create

### Audit logs not visible
- Must have ADMIN role
- Logs only created for authenticated users
- Check date range filters

---

## 📝 Notes

- Asset uploads are stored in S3 (configured in environment)
- Template defaults are suggestions only - users can override
- Audit logs are permanent for compliance
- File upload progress is shown in real-time
- All timestamps are in UTC

---

## 🆘 Support

For issues:
1. Check browser console for JavaScript errors
2. Check server logs for API errors
3. Verify authentication tokens are valid
4. Check database connectivity
5. Verify S3 credentials for uploads

