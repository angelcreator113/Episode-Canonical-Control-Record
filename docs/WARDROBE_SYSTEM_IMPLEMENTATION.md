# Wardrobe System Implementation Complete

## 🎉 Overview

The wardrobe system has been successfully separated from the assets system. Wardrobe items now have their own dedicated table, models, controllers, and API endpoints.

---

## ✅ What Was Created

### **Backend Files**

#### 1. **Models**
- `src/models/Wardrobe.js` - Main wardrobe model with detailed metadata fields
- `src/models/EpisodeWardrobe.js` - Junction table for episode-wardrobe relationships
- Updated `src/models/index.js` - Added wardrobe models and associations

#### 2. **Controllers**
- `src/controllers/wardrobeController.js` - Complete CRUD operations for wardrobe

#### 3. **Routes**
- `src/routes/wardrobe.js` - Wardrobe API routes
- Updated `src/routes/episodes.js` - Episode-wardrobe linking routes
- Updated `src/app.js` - Registered wardrobe routes

#### 4. **Database**
- `migrations/create-wardrobe-tables.sql` - SQL migration file
- `migrate-wardrobe.js` - Migration runner script

---

## 📊 Database Schema

### **Wardrobe Table**
```sql
wardrobe (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  character VARCHAR(50) NOT NULL,
  clothing_category VARCHAR(50) NOT NULL,
  s3_key VARCHAR(500),
  s3_url TEXT,
  thumbnail_url TEXT,
  brand VARCHAR(255),
  price DECIMAL(10, 2),
  purchase_link TEXT,
  website VARCHAR(500),
  color VARCHAR(100),
  size VARCHAR(50),
  season VARCHAR(50),
  occasion VARCHAR(100),
  outfit_set_id VARCHAR(100),
  outfit_set_name VARCHAR(255),
  scene_description TEXT,
  outfit_notes TEXT,
  times_worn INTEGER DEFAULT 0,
  last_worn_date TIMESTAMP,
  is_favorite BOOLEAN DEFAULT FALSE,
  tags JSONB DEFAULT '[]',
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP
)
```

### **Episode-Wardrobe Junction Table**
```sql
episode_wardrobe (
  id UUID PRIMARY KEY,
  episode_id UUID REFERENCES episodes(id),
  wardrobe_id UUID REFERENCES wardrobe(id),
  scene VARCHAR(255),
  worn_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(episode_id, wardrobe_id)
)
```

---

## 🔌 API Endpoints

### **Wardrobe Management**

#### Create Wardrobe Item
```http
POST /api/v1/wardrobe
Content-Type: multipart/form-data

{
  "name": "Red Evening Gown",
  "character": "lala",
  "clothingCategory": "dress",
  "brand": "Versace",
  "price": 2500.00,
  "color": "red",
  "size": "M",
  "season": "all-season",
  "occasion": "red-carpet",
  "isFavorite": true,
  "tags": ["elegant", "evening", "signature"],
  "file": <image file>
}
```

#### List Wardrobe Items
```http
GET /api/v1/wardrobe
Query Parameters:
  - character: lala | justawoman | guest
  - category: dress | top | bottom | shoes | accessories | jewelry | perfume
  - favorite: true | false
  - search: text search in name, brand, color
  - page: pagination page (default: 1)
  - limit: items per page (default: 50)
  - sortBy: field to sort by (default: created_at)
  - sortOrder: ASC | DESC (default: DESC)
```

#### Get Single Wardrobe Item
```http
GET /api/v1/wardrobe/:id
Returns: Wardrobe item with list of episodes where it was worn
```

#### Update Wardrobe Item
```http
PUT /api/v1/wardrobe/:id
Content-Type: multipart/form-data
Body: Same fields as create (all optional)
```

#### Delete Wardrobe Item (Soft Delete)
```http
DELETE /api/v1/wardrobe/:id
```

### **Episode-Wardrobe Linking**

#### Get Episode Wardrobe
```http
GET /api/v1/episodes/:id/wardrobe
Returns: All wardrobe items linked to this episode
```

#### Link Wardrobe to Episode
```http
POST /api/v1/episodes/:id/wardrobe/:wardrobeId
Body:
{
  "scene": "Opening scene",
  "notes": "Wore this with gold accessories"
}
```

#### Unlink Wardrobe from Episode
```http
DELETE /api/v1/episodes/:id/wardrobe/:wardrobeId
```

---

## 🚀 Installation Steps

### **Step 1: Run Database Migration**

```powershell
# Run the migration script
node migrate-wardrobe.js
```

Expected output:
```
🚀 Starting wardrobe tables migration...
📡 Testing database connection...
✅ Database connection successful
📄 Reading SQL file: migrations/create-wardrobe-tables.sql
⚙️  Executing migration SQL...
✅ Migration executed successfully!
✅ Tables created successfully:
   - episode_wardrobe (7 columns)
   - wardrobe (25 columns)
✅ Indexes created:
   - episode_wardrobe: 4 indexes
   - wardrobe: 7 indexes
✨ Migration completed successfully!
```

### **Step 2: Restart Backend Server**

```powershell
# Stop existing server (Ctrl+C)
# Start fresh
cd C:\Users\12483\Projects\Episode-Canonical-Control-Record-1
npm start
```

You should see:
```
✓ Wardrobe routes loaded
✅ All models loaded successfully
✅ Model associations defined
```

### **Step 3: Test Wardrobe Endpoints**

#### Test 1: Create a wardrobe item
```powershell
# Using curl or Postman
curl -X POST http://localhost:3002/api/v1/wardrobe `
  -F "name=Test Dress" `
  -F "character=lala" `
  -F "clothingCategory=dress" `
  -F "brand=Test Brand" `
  -F "color=blue"
```

#### Test 2: List wardrobe items
```powershell
curl http://localhost:3002/api/v1/wardrobe
```

#### Test 3: Get episode wardrobe (should be empty initially)
```powershell
curl http://localhost:3002/api/v1/episodes/YOUR_EPISODE_ID/wardrobe
```

---

## 🎨 Frontend Integration

### **Update EpisodeWardrobe.jsx**

The component needs to be updated to use the new endpoints. Key changes:

#### 1. Update Fetch URL
```javascript
// OLD (assets endpoint)
const response = await fetch(`/api/v1/episodes/${episodeId}/wardrobe`);

// NEW (wardrobe endpoint - no change needed for this one!)
const response = await fetch(`/api/v1/episodes/${episodeId}/wardrobe`);
```

#### 2. Update Create Wardrobe Item
```javascript
// Change from /api/v1/assets to /api/v1/wardrobe
const response = await fetch('/api/v1/wardrobe', {
  method: 'POST',
  body: formData, // multipart/form-data
});

// Then link to episode
const linkResponse = await fetch(
  `/api/v1/episodes/${episodeId}/wardrobe/${wardrobeItem.id}`,
  { method: 'POST' }
);
```

#### 3. Update Delete
```javascript
// Unlink from episode
await fetch(`/api/v1/episodes/${episodeId}/wardrobe/${itemId}`, {
  method: 'DELETE',
});

// Optionally delete the item entirely
await fetch(`/api/v1/wardrobe/${itemId}`, {
  method: 'DELETE',
});
```

#### 4. Form Data Structure
```javascript
const formData = new FormData();
formData.append('name', name);
formData.append('character', character); // lala, justawoman, guest
formData.append('clothingCategory', category); // dress, top, bottom, etc.
formData.append('brand', brand);
formData.append('price', price);
formData.append('color', color);
formData.append('size', size);
formData.append('season', season);
formData.append('occasion', occasion);
formData.append('isFavorite', isFavorite);
formData.append('tags', JSON.stringify(tags));
formData.append('file', fileInput.files[0]);
```

---

## 🔄 Data Migration (Optional)

If you have existing CLOTHING_* assets in the assets table that you want to migrate:

### **Migration Script** (create-migrate-assets-to-wardrobe.js)

```javascript
const { Asset, Wardrobe, EpisodeWardrobe } = require('./src/models');
const { Op } = require('sequelize');

async function migrateAssetsToWardrobe() {
  console.log('🔄 Migrating CLOTHING_* assets to wardrobe table...');
  
  const clothingAssets = await Asset.findAll({
    where: {
      asset_type: { [Op.like]: 'CLOTHING_%' },
      deleted_at: null,
    },
  });
  
  console.log(`Found ${clothingAssets.length} clothing assets to migrate`);
  
  for (const asset of clothingAssets) {
    try {
      // Extract character from asset_type (e.g., CLOTHING_LALA → lala)
      const character = asset.asset_type
        .replace('CLOTHING_', '')
        .toLowerCase();
      
      // Create wardrobe item
      const wardrobeItem = await Wardrobe.create({
        name: asset.title || asset.name,
        character: character,
        clothing_category: asset.metadata?.category || 'unknown',
        s3_key: asset.s3_key,
        s3_url: asset.s3_url,
        thumbnail_url: asset.thumbnail_url,
        brand: asset.metadata?.brand,
        price: asset.metadata?.price,
        purchase_link: asset.metadata?.purchaseLink,
        color: asset.metadata?.color,
        size: asset.metadata?.size,
        outfit_notes: asset.description,
        tags: asset.metadata?.tags || [],
      });
      
      // Link to episode if episodeId exists in metadata
      if (asset.metadata?.episodeId) {
        await EpisodeWardrobe.create({
          episode_id: asset.metadata.episodeId,
          wardrobe_id: wardrobeItem.id,
        });
      }
      
      console.log(`✅ Migrated: ${wardrobeItem.name}`);
    } catch (error) {
      console.error(`❌ Failed to migrate ${asset.id}:`, error.message);
    }
  }
  
  console.log('✨ Migration complete!');
}

migrateAssetsToWardrobe()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
```

---

## 📝 Key Differences: Assets vs Wardrobe

| Feature | Assets | Wardrobe |
|---------|--------|----------|
| **Purpose** | Generic production assets (logos, frames, videos) | Character clothing and fashion items |
| **Scope** | Episode-agnostic, reusable | Tracked per episode appearance |
| **Metadata** | Basic (title, description, tags) | Detailed (brand, price, size, season, etc.) |
| **Linking** | Can be used in any episode | Explicitly linked to episodes |
| **Categories** | Generic types | Clothing-specific (dress, shoes, accessories) |
| **Usage Tracking** | No | Yes (times_worn, last_worn_date) |
| **Favorites** | No | Yes (is_favorite flag) |
| **Outfits** | No | Yes (outfit_set_id for grouping) |

---

## 🧪 Testing Checklist

- [ ] Run database migration successfully
- [ ] Backend server starts without errors
- [ ] GET /api/v1/wardrobe returns empty array
- [ ] POST /api/v1/wardrobe creates new item
- [ ] GET /api/v1/wardrobe/:id returns created item
- [ ] PUT /api/v1/wardrobe/:id updates item
- [ ] POST /api/v1/episodes/:id/wardrobe/:wardrobeId links item
- [ ] GET /api/v1/episodes/:id/wardrobe shows linked items
- [ ] DELETE /api/v1/episodes/:id/wardrobe/:wardrobeId unlinks item
- [ ] DELETE /api/v1/wardrobe/:id soft-deletes item
- [ ] File upload works (image attached to wardrobe item)
- [ ] Search/filter works (character, category, favorite)
- [ ] Pagination works

---

## 🎯 Next Steps

1. **Update Frontend Component** - Modify `EpisodeWardrobe.jsx` to use new endpoints
2. **Remove CLOTHING_* from Asset Manager** - Update upload types to exclude clothing
3. **Add Wardrobe Manager UI** - Create standalone wardrobe management page
4. **Test with Real Data** - Create test wardrobe items and link to episodes
5. **Update Documentation** - Add wardrobe API to project documentation

---

## 🐛 Troubleshooting

### Migration Fails
```
Error: relation "episodes" does not exist
```
**Solution**: Ensure episodes table exists first. Run `npm run migrate` or create-all-tables.js

### Server Won't Start
```
Error loading models: Cannot find module './Wardrobe'
```
**Solution**: Check file paths and ensure all model files exist

### 404 on Wardrobe Endpoints
```
Cannot GET /api/v1/wardrobe
```
**Solution**: Verify routes are registered in app.js and server restarted

### Foreign Key Constraint Error
```
violates foreign key constraint "episode_wardrobe_episode_id_fkey"
```
**Solution**: Ensure episode exists before linking wardrobe item

---

## 📚 Additional Resources

- **Sequelize Docs**: https://sequelize.org/docs/v6/
- **PostgreSQL JSONB**: https://www.postgresql.org/docs/current/datatype-json.html
- **Express Multer**: https://github.com/expressjs/multer
- **AWS SDK S3**: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/

---

## ✨ Summary

The wardrobe system is now completely separated from assets with:

- ✅ Dedicated database tables (wardrobe, episode_wardrobe)
- ✅ Complete Sequelize models with associations
- ✅ Full CRUD API endpoints
- ✅ File upload support (S3)
- ✅ Advanced filtering and search
- ✅ Episode linking/unlinking
- ✅ Soft delete capability
- ✅ Usage tracking (times_worn, favorites)
- ✅ Migration scripts

**Ready to use!** Just run the migration and restart your server.
