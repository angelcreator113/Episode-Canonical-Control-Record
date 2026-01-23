# Wardrobe Library System - Implementation Plan

## Overview
Create a comprehensive wardrobe/closet library system that allows uploading items and outfit sets independently from episodes, with the ability to assign them to multiple episodes with full tracking and approval workflows.

---

## 1. Database Schema

### 1.1 New Table: `wardrobe_library`
Master library for all wardrobe items and outfit sets.

```sql
CREATE TABLE wardrobe_library (
  id SERIAL PRIMARY KEY,
  
  -- Basic Info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL, -- 'item' or 'set'
  
  -- Item Classification (for type='item')
  item_type VARCHAR(100), -- 'top', 'bottom', 'dress', 'shoes', 'accessory', etc.
  
  -- Storage
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  s3_key VARCHAR(500),
  
  -- Metadata (optional, can be overridden per episode)
  default_character VARCHAR(255),
  default_occasion VARCHAR(255),
  default_season VARCHAR(100),
  color VARCHAR(100),
  tags JSONB DEFAULT '[]',
  
  -- External References
  website TEXT,
  price DECIMAL(10,2),
  vendor VARCHAR(255),
  
  -- Show Association (optional - NULL means cross-show)
  show_id INTEGER REFERENCES shows(id),
  
  -- Usage Tracking
  total_usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP,
  view_count INTEGER DEFAULT 0,
  selection_count INTEGER DEFAULT 0,
  
  -- Audit
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_wardrobe_library_type ON wardrobe_library(type);
CREATE INDEX idx_wardrobe_library_item_type ON wardrobe_library(item_type);
CREATE INDEX idx_wardrobe_library_show_id ON wardrobe_library(show_id);
CREATE INDEX idx_wardrobe_library_deleted_at ON wardrobe_library(deleted_at);
CREATE INDEX idx_wardrobe_library_color ON wardrobe_library(color);
CREATE INDEX idx_wardrobe_library_tags ON wardrobe_library USING GIN(tags);
CREATE INDEX idx_wardrobe_library_search ON wardrobe_library USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '')));
```

### 1.2 New Table: `outfit_set_items`
Junction table linking outfit sets to individual wardrobe items.

```sql
CREATE TABLE outfit_set_items (
  id SERIAL PRIMARY KEY,
  
  -- References
  outfit_set_id INTEGER NOT NULL REFERENCES wardrobe_library(id) ON DELETE CASCADE,
  wardrobe_item_id INTEGER NOT NULL REFERENCES wardrobe_library(id) ON DELETE CASCADE,
  
  -- Order and organization
  position INTEGER DEFAULT 0,
  layer VARCHAR(50), -- 'base', 'mid', 'outer', 'accessory'
  is_optional BOOLEAN DEFAULT false,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT outfit_set_items_unique UNIQUE(outfit_set_id, wardrobe_item_id)
);

CREATE INDEX idx_outfit_set_items_set ON outfit_set_items(outfit_set_id);
CREATE INDEX idx_outfit_set_items_item ON outfit_set_items(wardrobe_item_id);
```

### 1.3 Update Table: `wardrobe`
Add library reference to existing wardrobe table.

```sql
ALTER TABLE wardrobe ADD COLUMN library_item_id INTEGER REFERENCES wardrobe_library(id);
CREATE INDEX idx_wardrobe_library_item ON wardrobe(library_item_id);
```

### 1.4 Update Table: `episode_wardrobe`
Add approval workflow and metadata overrides.

```sql
ALTER TABLE episode_wardrobe ADD COLUMN approval_status VARCHAR(50) DEFAULT 'pending'; -- 'pending', 'approved', 'rejected'
ALTER TABLE episode_wardrobe ADD COLUMN approved_by VARCHAR(255);
ALTER TABLE episode_wardrobe ADD COLUMN approved_at TIMESTAMP;
ALTER TABLE episode_wardrobe ADD COLUMN rejection_reason TEXT;

-- Metadata overrides (NULL means use library defaults)
ALTER TABLE episode_wardrobe ADD COLUMN override_character VARCHAR(255);
ALTER TABLE episode_wardrobe ADD COLUMN override_occasion VARCHAR(255);
ALTER TABLE episode_wardrobe ADD COLUMN override_season VARCHAR(100);

-- Scene assignment
ALTER TABLE episode_wardrobe ADD COLUMN scene_id INTEGER REFERENCES scenes(id);

CREATE INDEX idx_episode_wardrobe_approval ON episode_wardrobe(approval_status);
CREATE INDEX idx_episode_wardrobe_scene ON episode_wardrobe(scene_id);
```

### 1.5 New Table: `wardrobe_usage_history`
Track detailed usage history across episodes and shows.

```sql
CREATE TABLE wardrobe_usage_history (
  id SERIAL PRIMARY KEY,
  
  -- References
  library_item_id INTEGER NOT NULL REFERENCES wardrobe_library(id) ON DELETE CASCADE,
  episode_id INTEGER REFERENCES episodes(id),
  scene_id INTEGER REFERENCES scenes(id),
  show_id INTEGER REFERENCES shows(id),
  
  -- Usage details
  usage_type VARCHAR(50) NOT NULL, -- 'assigned', 'viewed', 'selected', 'approved', 'rejected', 'removed'
  character VARCHAR(255),
  occasion VARCHAR(255),
  
  -- Metadata
  user_id VARCHAR(255),
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_usage_history_library_item ON wardrobe_usage_history(library_item_id);
CREATE INDEX idx_usage_history_episode ON wardrobe_usage_history(episode_id);
CREATE INDEX idx_usage_history_show ON wardrobe_usage_history(show_id);
CREATE INDEX idx_usage_history_type ON wardrobe_usage_history(usage_type);
CREATE INDEX idx_usage_history_created_at ON wardrobe_usage_history(created_at DESC);
```

### 1.6 New Table: `wardrobe_library_references`
Track S3 file references to prevent deletion of in-use files.

```sql
CREATE TABLE wardrobe_library_references (
  id SERIAL PRIMARY KEY,
  
  library_item_id INTEGER NOT NULL REFERENCES wardrobe_library(id) ON DELETE CASCADE,
  s3_key VARCHAR(500) NOT NULL,
  reference_count INTEGER DEFAULT 1,
  file_size BIGINT,
  content_type VARCHAR(100),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_library_s3_key UNIQUE(library_item_id, s3_key)
);

CREATE INDEX idx_library_references_s3_key ON wardrobe_library_references(s3_key);
```

---

## 2. API Endpoints

### 2.1 Wardrobe Library Management

#### `POST /api/v1/wardrobe-library`
Upload new item or outfit set to library.
- Multipart form data with image upload
- S3 upload with thumbnail generation
- Required: name, type, image
- Optional: all metadata fields

#### `GET /api/v1/wardrobe-library`
List library items with filtering and search.
- Query params: type, item_type, show_id, character, occasion, season, color, tags, search, sort, page, limit
- Response includes usage stats

#### `GET /api/v1/wardrobe-library/:id`
Get single library item with full details.
- Includes usage history, episode assignments, outfit set composition

#### `PUT /api/v1/wardrobe-library/:id`
Update library item metadata.
- Cannot change type after creation
- Image update triggers S3 re-upload

#### `DELETE /api/v1/wardrobe-library/:id`
Soft delete with usage validation.
- Prevent deletion if actively used in episodes
- Return usage warning with episode list

### 2.2 Outfit Sets

#### `GET /api/v1/wardrobe-library/:id/items`
Get items in an outfit set.

#### `POST /api/v1/wardrobe-library/:id/items`
Add items to outfit set.
- Body: { wardrobe_item_ids: [1,2,3], positions: [...] }

#### `DELETE /api/v1/wardrobe-library/:setId/items/:itemId`
Remove item from outfit set.

### 2.3 Episode Assignment

#### `POST /api/v1/episodes/:episodeId/wardrobe/assign`
Assign library item(s) to episode.
- Body: { library_item_ids: [1,2,3], scene_id, character, occasion, season }
- Creates wardrobe entry with library_item_id reference
- Records usage history

#### `PUT /api/v1/episodes/:episodeId/wardrobe/:wardrobeId/approve`
Approve wardrobe item for episode.
- Body: { approved_by, notes }
- Updates approval_status to 'approved'

#### `PUT /api/v1/episodes/:episodeId/wardrobe/:wardrobeId/reject`
Reject wardrobe item for episode.
- Body: { rejected_by, reason }
- Updates approval_status to 'rejected'

#### `GET /api/v1/episodes/:episodeId/wardrobe/available`
Browse library items available for assignment to episode.
- Filters by show_id if episode belongs to show
- Excludes already assigned items (optional)

### 2.4 Usage Analytics

#### `GET /api/v1/wardrobe-library/:id/usage`
Get usage history and analytics for library item.
- Query params: show_id (filter by show)
- Returns: episode list, scene list, usage counts, timeline

#### `GET /api/v1/wardrobe-library/:id/usage/shows`
Get cross-show usage breakdown.

#### `POST /api/v1/wardrobe-library/:id/track-view`
Track view event (for analytics).

#### `POST /api/v1/wardrobe-library/:id/track-selection`
Track selection event (for analytics).

### 2.5 Search and Discovery

#### `GET /api/v1/wardrobe-library/search`
Advanced search with full-text and filters.
- Full-text search on name, description, tags
- Filters: type, color, occasion, season, show_id, never_used, last_used_days

#### `GET /api/v1/wardrobe-library/suggestions`
Get suggestions based on episode context.
- Based on show, character, occasion, season

---

## 3. Models

### 3.1 WardrobeLibrary Model
`src/models/WardrobeLibrary.js`

```javascript
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WardrobeLibrary = sequelize.define('WardrobeLibrary', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    description: DataTypes.TEXT,
    type: { type: DataTypes.STRING, allowNull: false }, // 'item' or 'set'
    itemType: { type: DataTypes.STRING, field: 'item_type' },
    imageUrl: { type: DataTypes.TEXT, allowNull: false, field: 'image_url' },
    thumbnailUrl: { type: DataTypes.TEXT, field: 'thumbnail_url' },
    s3Key: { type: DataTypes.STRING(500), field: 's3_key' },
    defaultCharacter: { type: DataTypes.STRING, field: 'default_character' },
    defaultOccasion: { type: DataTypes.STRING, field: 'default_occasion' },
    defaultSeason: { type: DataTypes.STRING, field: 'default_season' },
    color: DataTypes.STRING,
    tags: { type: DataTypes.JSONB, defaultValue: [] },
    website: DataTypes.TEXT,
    price: DataTypes.DECIMAL(10, 2),
    vendor: DataTypes.STRING,
    showId: { type: DataTypes.INTEGER, field: 'show_id' },
    totalUsageCount: { type: DataTypes.INTEGER, defaultValue: 0, field: 'total_usage_count' },
    lastUsedAt: { type: DataTypes.DATE, field: 'last_used_at' },
    viewCount: { type: DataTypes.INTEGER, defaultValue: 0, field: 'view_count' },
    selectionCount: { type: DataTypes.INTEGER, defaultValue: 0, field: 'selection_count' },
    createdBy: { type: DataTypes.STRING, field: 'created_by' },
    updatedBy: { type: DataTypes.STRING, field: 'updated_by' },
  }, {
    tableName: 'wardrobe_library',
    timestamps: true,
    underscored: true,
    paranoid: true,
  });

  return WardrobeLibrary;
};
```

### 3.2 OutfitSetItems Model
`src/models/OutfitSetItems.js`

### 3.3 WardrobeUsageHistory Model
`src/models/WardrobeUsageHistory.js`

### 3.4 Update Wardrobe Model
Add libraryItemId field and associations.

---

## 4. Controllers

### 4.1 WardrobeLibraryController
`src/controllers/wardrobeLibraryController.js`

Key methods:
- `uploadToLibrary` - Handle multipart upload, S3 storage, thumbnail generation
- `listLibrary` - List with filters, search, pagination
- `getLibraryItem` - Get with usage stats
- `updateLibraryItem` - Update metadata
- `deleteLibraryItem` - Soft delete with validation
- `assignToEpisode` - Create episode assignment
- `getUsageHistory` - Get usage analytics
- `trackView` / `trackSelection` - Analytics tracking

### 4.2 OutfitSetController Updates
Handle outfit set composition (add/remove items).

---

## 5. Routes

### 5.1 New Route File
`src/routes/wardrobeLibrary.js`

```javascript
const router = require('express').Router();
const controller = require('../controllers/wardrobeLibraryController');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/', authenticate, upload.single('image'), controller.uploadToLibrary);
router.get('/', authenticate, controller.listLibrary);
router.get('/search', authenticate, controller.searchLibrary);
router.get('/:id', authenticate, controller.getLibraryItem);
router.put('/:id', authenticate, upload.single('image'), controller.updateLibraryItem);
router.delete('/:id', authenticate, controller.deleteLibraryItem);

// Outfit set items
router.get('/:id/items', authenticate, controller.getOutfitItems);
router.post('/:id/items', authenticate, controller.addItemsToOutfit);
router.delete('/:setId/items/:itemId', authenticate, controller.removeItemFromOutfit);

// Usage
router.get('/:id/usage', authenticate, controller.getUsageHistory);
router.get('/:id/usage/shows', authenticate, controller.getCrossShowUsage);
router.post('/:id/track-view', authenticate, controller.trackView);
router.post('/:id/track-selection', authenticate, controller.trackSelection);

module.exports = router;
```

Register in `src/app.js`:
```javascript
app.use('/api/v1/wardrobe-library', require('./routes/wardrobeLibrary'));
```

---

## 6. Migration Strategy

### 6.1 Create Library Tables Migration
`migrations/YYYYMMDDHHMMSS-create-wardrobe-library-system.js`

### 6.2 Migrate Existing Data
`scripts/migrate-wardrobe-to-library.js`

Strategy:
1. Identify unique wardrobe items (by name, image URL)
2. Create library entries for unique items
3. Update wardrobe records with library_item_id
4. Handle duplicates intelligently

### 6.3 Add Columns to Existing Tables
`migrations/YYYYMMDDHHMMSS-add-library-columns.js`

---

## 7. S3 Integration

### 7.1 Upload Service
`src/services/s3Service.js`

Methods:
- `uploadWardrobeImage(file, userId)` - Upload with automatic thumbnail
- `deleteWardrobeImage(s3Key)` - Check references before deletion
- `generateThumbnail(imageBuffer)` - Create thumbnail using sharp
- `getSignedUrl(s3Key)` - Get temporary URL for display

### 7.2 Reference Tracking
Track all S3 keys and reference counts.
Prevent deletion if references exist.

---

## 8. Frontend Integration Points

### 8.1 Library Browser UI
- Grid/list view with filters
- Search bar with live results
- Filter panel: type, color, season, occasion, show, usage status
- Sort: newest, most used, never used, last used

### 8.2 Upload Modal
- Drag-drop image upload
- Form fields: name, type, item_type, color, etc.
- Tags input
- Optional: website, price, vendor

### 8.3 Assignment Flow
1. Browse library from episode editor
2. Preview item with usage history
3. Select and customize (character, occasion, scene)
4. Assign to episode

### 8.4 Approval Workflow
- Review assigned items
- Approve/reject with notes
- Track approval status per episode

### 8.5 Analytics Dashboard
- Most used items
- Usage by show
- Items never used
- Usage timeline

---

## 9. Implementation Phases

### Phase 1: Database & Models (Priority 1)
- Create all database tables
- Create Sequelize models
- Set up associations
- Create migration scripts
- Migrate existing data

### Phase 2: Core API (Priority 1)
- Upload to library endpoint
- List/search library endpoint
- Get library item endpoint
- Update/delete endpoints
- Basic assignment to episode

### Phase 3: Outfit Sets (Priority 2)
- Outfit set composition endpoints
- Add/remove items from sets
- Display outfit sets in library

### Phase 4: Approval Workflow (Priority 2)
- Approve/reject endpoints
- Status tracking
- Approval notifications

### Phase 5: Usage Tracking (Priority 2)
- Usage history recording
- Analytics endpoints
- Cross-show usage tracking
- View/selection tracking

### Phase 6: Advanced Features (Priority 3)
- Advanced search with full-text
- Suggestions based on context
- Duplicate detection
- Bulk operations
- Export/import functionality

---

## 10. Testing Requirements

### 10.1 Unit Tests
- Model validations
- Controller logic
- S3 service methods

### 10.2 Integration Tests
- Upload flow (multipart + S3)
- Assignment workflow
- Approval workflow
- Deletion with reference checking

### 10.3 E2E Tests
- Complete upload-to-episode flow
- Outfit set creation and assignment
- Cross-show usage tracking
- Analytics accuracy

---

## 11. Security Considerations

- Authentication required on all endpoints
- Validate file types and sizes for uploads
- Sanitize user inputs (names, descriptions, tags)
- Prevent SQL injection in search queries
- Rate limiting on upload endpoints
- S3 bucket permissions (private, signed URLs)

---

## 12. Performance Optimizations

- Eager loading for associations (usage history, outfit items)
- Database indexes on all foreign keys and filter columns
- Pagination on all list endpoints
- Caching for frequently accessed library items
- Thumbnail generation in background job
- CDN for image delivery

---

## 13. Questions Resolved

✅ Individual items and outfit sets: Both supported in unified table  
✅ Library item reusable across episodes: Yes, via library_item_id reference  
✅ Approval per episode: Yes, tracked in episode_wardrobe  
✅ Usage tracking: Full history with episodes, scenes, characters  
✅ Cross-show sharing: Yes, with per-show usage visibility  
✅ Metadata overrides: Yes, episode can override without changing library  
✅ S3 file sharing: Yes, same file referenced multiple times  
✅ Deletion protection: Yes, validation before deletion  
✅ Upload workflow: Direct to library, then assign  

---

## 14. Next Steps

1. Review this plan for completeness
2. Create database migration files
3. Implement models and associations
4. Build API endpoints (Phase 1 & 2)
5. Migrate existing wardrobe data
6. Test core functionality
7. Implement remaining phases

Ready to start implementation? Switch to agent mode!
