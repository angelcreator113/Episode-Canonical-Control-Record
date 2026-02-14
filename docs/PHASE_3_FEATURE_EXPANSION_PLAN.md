# Phase 3: Feature Expansion - Versioning, Filtering & Batch Operations

## 🎯 Phase 3 Objectives

Extend Phase 2.5 with enterprise-grade features to support advanced composition management, historical tracking, and bulk operations.

---

## 📋 Feature 1: Composition Versioning System

### Purpose
Track composition changes over time, enable rollback to previous versions, and maintain audit trail.

### Data Model

#### New Table: `composition_versions`
```sql
CREATE TABLE composition_versions (
  id SERIAL PRIMARY KEY,
  composition_id UUID NOT NULL REFERENCES thumbnail_compositions(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  version_hash VARCHAR(64) UNIQUE,  -- SHA256 of composition state
  change_summary TEXT,
  changed_fields JSONB,  -- {background_asset: {old: uuid, new: uuid}}
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  is_published BOOLEAN DEFAULT FALSE,
  UNIQUE(composition_id, version_number)
);

CREATE INDEX idx_composition_versions_id ON composition_versions(composition_id);
CREATE INDEX idx_composition_versions_created ON composition_versions(created_at DESC);
```

#### Extended ThumbnailComposition
```
+ current_version: INTEGER DEFAULT 1
+ version_history: JSONB (denormalized for fast access)
+ last_modified_by: VARCHAR(100)
+ modification_timestamp: TIMESTAMP
```

### API Endpoints

#### Get Version History
```
GET /api/v1/compositions/:id/versions
Response:
{
  "composition_id": "uuid",
  "current_version": 2,
  "versions": [
    {
      "version_number": 2,
      "created_at": "2026-01-05T10:30:00Z",
      "created_by": "user@example.com",
      "change_summary": "Updated guest asset to new promotional image",
      "changed_fields": {
        "guest_asset_id": {
          "old": "old-uuid",
          "new": "new-uuid"
        }
      },
      "is_published": false
    },
    {
      "version_number": 1,
      "created_at": "2026-01-05T09:00:00Z",
      "created_by": "system",
      "change_summary": "Initial composition creation",
      "is_published": true
    }
  ]
}
```

#### Get Specific Version
```
GET /api/v1/compositions/:id/versions/:versionNumber
Response: Full composition state at that version
```

#### Revert to Version
```
POST /api/v1/compositions/:id/revert/:versionNumber
Body: { reason: "Reverting to previous design" }
Response:
{
  "status": "SUCCESS",
  "new_version": 3,
  "reverted_from": 2,
  "composition": {...}
}
```

### Frontend Integration

- Version dropdown in composition editor
- Timeline view of changes
- Side-by-side comparison of versions
- Revert button with confirmation dialog
- "Undo" button (quick revert to previous version)

---

## 🔍 Feature 2: Advanced Filtering & Search

### Filter Capabilities

#### Filter Types
1. **By Format**: YouTube, Instagram, TikTok, etc.
2. **By Status**: Draft, Published, Archived
3. **By Date Range**: Created, Modified, Published dates
4. **By Asset Usage**: Which assets are used
5. **By Template**: Which template was used
6. **By Modification**: Last modified by, modification date
7. **By Size**: File size range
8. **Custom Search**: Title, description text search

### API Endpoint

```
GET /api/v1/compositions/search
Query Parameters:
  - formats: "youtube,instagram" (comma-separated)
  - status: "draft|published|archived"
  - date_from: "2026-01-01"
  - date_to: "2026-01-31"
  - assets: "asset-uuid-1,asset-uuid-2" (all must be present)
  - template: "template-id"
  - created_by: "user@example.com"
  - search: "keyword search"
  - sort: "created_at|modified_at|name" (prefix with - for desc)
  - limit: 20
  - offset: 0

Response:
{
  "total_count": 42,
  "filtered_count": 12,
  "page": 1,
  "limit": 20,
  "compositions": [...]
}
```

### Database Optimization

```sql
CREATE INDEX idx_comp_format ON thumbnail_compositions USING GIN(selected_formats);
CREATE INDEX idx_comp_status ON thumbnail_compositions(status);
CREATE INDEX idx_comp_created ON thumbnail_compositions(created_at DESC);
CREATE INDEX idx_comp_modified ON thumbnail_compositions(updated_at DESC);
CREATE INDEX idx_comp_template ON thumbnail_compositions(template_id);
```

### Frontend Filters Panel

- Collapsible filter sidebar
- Multi-select dropdowns (Format, Status, Template)
- Date range picker
- Asset selector with preview
- Clear filters button
- Save filter presets
- Search box with autocomplete
- Results counter

---

## ⚡ Feature 3: Batch Operations System

### Operations Support

1. **Batch Generate Thumbnails**
   - Generate for multiple compositions
   - Progress tracking
   - Parallel processing with queue

2. **Batch Update Formats**
   - Apply format to multiple compositions
   - Regenerate thumbnails

3. **Batch Delete**
   - Delete multiple compositions
   - Confirm deletion
   - Cascade cleanup

4. **Batch Publish**
   - Publish multiple drafts
   - Version locking
   - Status update

5. **Batch Export**
   - Export metadata as CSV/JSON
   - Include S3 URLs
   - Scheduled exports

### Implementation: Job Queue System

#### New Table: `batch_jobs`
```sql
CREATE TABLE batch_jobs (
  id SERIAL PRIMARY KEY,
  job_type VARCHAR(50),  -- "generate_thumbnails", "delete", "publish", "export"
  status VARCHAR(20) DEFAULT 'pending',  -- pending, processing, completed, failed
  total_items INTEGER,
  processed_items INTEGER DEFAULT 0,
  composition_ids UUID[] NOT NULL,
  parameters JSONB,  -- operation-specific params
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_log TEXT,
  progress_percentage INTEGER DEFAULT 0
);

CREATE INDEX idx_batch_jobs_status ON batch_jobs(status);
CREATE INDEX idx_batch_jobs_created ON batch_jobs(created_at DESC);
```

### API Endpoints

#### Create Batch Job
```
POST /api/v1/batch-operations
Body:
{
  "operation": "generate_thumbnails",
  "composition_ids": ["uuid1", "uuid2", "uuid3"],
  "parameters": {
    "formats": ["youtube", "instagram"]
  }
}

Response:
{
  "job_id": 42,
  "status": "pending",
  "total_items": 3,
  "operation": "generate_thumbnails"
}
```

#### Get Job Status
```
GET /api/v1/batch-operations/:jobId
Response:
{
  "job_id": 42,
  "status": "processing",
  "total_items": 3,
  "processed_items": 2,
  "progress_percentage": 66,
  "estimated_remaining_seconds": 30,
  "items": [
    {
      "composition_id": "uuid1",
      "status": "completed",
      "result": {...}
    },
    {
      "composition_id": "uuid2",
      "status": "processing"
    },
    {
      "composition_id": "uuid3",
      "status": "pending"
    }
  ]
}
```

#### List Active Jobs
```
GET /api/v1/batch-operations?status=processing
Response: Array of job objects
```

#### Cancel Job
```
DELETE /api/v1/batch-operations/:jobId
Response: { "status": "cancelled" }
```

### Queue Processing

Implementation using Node.js worker threads or Bull queue:
- Background workers process jobs
- Progress tracked in database
- WebSocket updates for real-time progress
- Automatic retry on failure
- Dead letter queue for failed items

### Frontend Batch UI

- Composition list with checkboxes
- "Select All" and "Clear Selection" buttons
- Bulk action dropdown (Generate, Delete, Publish, Export)
- Confirmation dialog with item preview
- Progress modal with real-time updates
- Results summary when complete
- Job history view

---

## 🔄 Implementation Priority

### Phase 3A: Versioning (Weeks 1-2)
1. Create composition_versions table
2. Implement version tracking in composition updates
3. Create GET /versions endpoints
4. Implement revert functionality
5. Add version UI components

### Phase 3B: Advanced Filtering (Weeks 2-3)
1. Create database indexes
2. Implement filter logic in CompositionService
3. Create /search endpoint
4. Build filter panel UI
5. Add saved filters feature

### Phase 3C: Batch Operations (Weeks 3-4)
1. Create batch_jobs table
2. Implement job queue system
3. Create batch operation endpoints
4. Build batch selection UI
5. Add progress tracking

---

## 📊 Database Schema Changes

```sql
-- Versioning
ALTER TABLE thumbnail_compositions 
  ADD COLUMN current_version INTEGER DEFAULT 1,
  ADD COLUMN version_history JSONB DEFAULT '{}',
  ADD COLUMN last_modified_by VARCHAR(100),
  ADD COLUMN modification_timestamp TIMESTAMP DEFAULT NOW();

-- New tracking tables created in migrations
```

---

## 🎨 Frontend Architecture

### New Components

```
ThumbnailComposer/
  ├── GalleryView (existing)
  ├── VersionHistoryPanel (new)
  ├── FilterSidebar (new)
  ├── BatchOperationsPanel (new)
  └── JobProgressModal (new)

Services/
  ├── compositionService.js (extended)
  ├── versioningService.js (new)
  ├── filterService.js (new)
  └── batchService.js (new)
```

### State Management

```javascript
const [filters, setFilters] = useState({});
const [filteredCompositions, setFilteredCompositions] = useState([]);
const [selectedCompositions, setSelectedCompositions] = useState(new Set());
const [activeJob, setActiveJob] = useState(null);
const [versionHistory, setVersionHistory] = useState({});
```

---

## 🧪 Testing Strategy

### Unit Tests
- Version creation and comparison
- Filter logic and query building
- Batch operation logic

### Integration Tests
- Version revert workflow
- Filter with multiple conditions
- Batch job queue processing

### E2E Tests
- Full versioning workflow
- Advanced search with filters
- Batch thumbnail generation

---

## 📈 Performance Considerations

1. **Versioning**: Denormalize version_history in compositions table for fast reads
2. **Filtering**: Create strategic indexes on filtered columns
3. **Batch Jobs**: Use worker threads for parallel processing
4. **Caching**: Cache filter results (5-minute TTL)
5. **Pagination**: Always paginate batch results

---

## 🚀 Success Metrics

- ✅ All versions accessible with < 100ms latency
- ✅ Advanced filter with 10 conditions < 500ms
- ✅ Batch operations: 100 compositions process in < 5 minutes
- ✅ UI responsive with 60fps (filter + batch selection)
- ✅ 95%+ test coverage for new features

---

## 📚 Documentation Required

1. Version management guide
2. Advanced filtering tutorial
3. Batch operations workflow
4. API reference for all new endpoints
5. Database migration guide
6. UI component storybook

---

**Status**: Ready for implementation  
**Estimated Duration**: 4 weeks (with concurrent work)  
**Team Size**: 2-3 developers  
**Priority**: High (Phase 3A first, then B and C)
