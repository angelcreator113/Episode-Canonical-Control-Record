# Phase 1: Database Schema & Core API Development
**Timeline:** January 1-14, 2026 (2 weeks)  
**Owner:** Both developers (parallel work)  
**Status:** 🚀 STARTING

---

## Phase 1 Overview

### Objectives
1. Design and implement episode metadata database schema
2. Create Sequelize ORM models with relationships
3. Implement database migrations
4. Build core REST API endpoints
5. Integrate with Cognito authentication
6. Create comprehensive test suite

### Success Criteria
- ✅ Database schema supports episode metadata, thumbnails, metadata storage
- ✅ All CRUD operations working (GET, POST, PUT, DELETE)
- ✅ Authentication integrated (Cognito + JWT)
- ✅ Authorization checks for user roles (admin/editor/viewer)
- ✅ Error handling and validation
- ✅ Database connection to AWS RDS verified
- ✅ S3 integration tested
- ✅ 80%+ test coverage

---

## Phase 1A: Database Schema Design (Days 1-3)

### 1A.1: Episode Metadata Table
**Purpose:** Store core episode information

```sql
CREATE TABLE episodes (
  id SERIAL PRIMARY KEY,
  show_name VARCHAR(255) NOT NULL,
  season_number INTEGER NOT NULL,
  episode_number INTEGER NOT NULL,
  episode_title VARCHAR(255) NOT NULL,
  air_date DATE,
  plot_summary TEXT,
  director VARCHAR(255),
  writer VARCHAR(255),
  duration_minutes INTEGER,
  rating DECIMAL(3,1),
  genre VARCHAR(100),
  
  -- Media references
  thumbnail_url VARCHAR(512),
  poster_url VARCHAR(512),
  video_url VARCHAR(512),
  
  -- S3 references
  raw_video_s3_key VARCHAR(512),
  processed_video_s3_key VARCHAR(512),
  metadata_json_s3_key VARCHAR(512),
  
  -- Status tracking
  processing_status VARCHAR(50), -- 'pending', 'processing', 'complete', 'failed'
  upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Soft delete
  deleted_at TIMESTAMP NULL,
  
  UNIQUE(show_name, season_number, episode_number),
  INDEX idx_show_season_episode (show_name, season_number, episode_number),
  INDEX idx_air_date (air_date),
  INDEX idx_processing_status (processing_status)
);
```

### 1A.2: Metadata Storage Table
**Purpose:** Store extracted/generated metadata

```sql
CREATE TABLE metadata_storage (
  id SERIAL PRIMARY KEY,
  episode_id INTEGER NOT NULL,
  
  -- OCR/text extraction
  extracted_text TEXT,
  
  -- ML/AI analysis
  scenes_detected JSON, -- Array of detected scenes with timestamps
  sentiment_analysis JSON,
  visual_objects JSONB, -- Detected objects/people
  transcription TEXT,
  
  -- Tags & categories
  tags JSON, -- Array of user-defined tags
  categories JSON, -- Genre, content warnings, etc.
  
  -- Processing metadata
  extraction_timestamp TIMESTAMP,
  processing_duration_seconds INTEGER,
  
  FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE,
  INDEX idx_episode_id (episode_id)
);
```

### 1A.3: Thumbnail Storage Table
**Purpose:** Manage thumbnail images for episodes

```sql
CREATE TABLE thumbnails (
  id SERIAL PRIMARY KEY,
  episode_id INTEGER NOT NULL,
  
  -- File info
  s3_bucket VARCHAR(255),
  s3_key VARCHAR(512), -- Unique key in S3
  file_size_bytes INTEGER,
  mime_type VARCHAR(50),
  
  -- Image metadata
  width_pixels INTEGER,
  height_pixels INTEGER,
  format VARCHAR(20),
  
  -- Thumbnail type
  thumbnail_type VARCHAR(50), -- 'primary', 'cover', 'poster'
  position_seconds INTEGER, -- For video frame thumbnails
  
  -- Generation
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  quality_rating DECIMAL(3,2),
  
  FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE,
  INDEX idx_episode_id (episode_id),
  INDEX idx_s3_key (s3_key)
);
```

### 1A.4: Processing Queue Table
**Purpose:** Track thumbnail generation jobs

```sql
CREATE TABLE processing_queue (
  id SERIAL PRIMARY KEY,
  episode_id INTEGER NOT NULL,
  
  job_type VARCHAR(50), -- 'thumbnail_generation', 'metadata_extraction'
  status VARCHAR(50), -- 'pending', 'processing', 'completed', 'failed'
  
  -- SQS reference
  sqs_message_id VARCHAR(255),
  sqs_receipt_handle VARCHAR(1024),
  
  -- Job details
  job_config JSON, -- Configuration for the job
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  
  FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE,
  INDEX idx_episode_status (episode_id, status),
  INDEX idx_job_status (status),
  INDEX idx_created_at (created_at)
);
```

### 1A.5: Activity Audit Log
**Purpose:** Track user actions for compliance

```sql
CREATE TABLE activity_logs (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255), -- Cognito user ID
  
  action_type VARCHAR(100), -- 'view', 'edit', 'delete', 'download'
  resource_type VARCHAR(100), -- 'episode', 'thumbnail', 'metadata'
  resource_id INTEGER, -- Episode ID or similar
  
  old_values JSON, -- Previous state for updates
  new_values JSON, -- New state for updates
  
  ip_address VARCHAR(45),
  user_agent TEXT,
  
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_user_timestamp (user_id, timestamp),
  INDEX idx_resource (resource_type, resource_id),
  INDEX idx_action_type (action_type)
);
```

---

## Phase 1B: Sequelize Models (Days 2-3)

**Models to Create:**
1. `Episode` - Main episode entity
2. `MetadataStorage` - Extracted metadata
3. `Thumbnail` - Thumbnail images
4. `ProcessingQueue` - Job tracking
5. `ActivityLog` - Audit logs

**Model Associations:**
- Episode hasMany MetadataStorage (one-to-many)
- Episode hasMany Thumbnails (one-to-many)
- Episode hasMany ProcessingQueue (one-to-many)

---

## Phase 1C: Database Migrations (Day 2)

Create Sequelize migrations for:
- Initial schema creation
- Indexes for performance
- Seed data with test episodes

---

## Phase 1D: Core API Endpoints (Days 3-5)

### Episodes Resource
- `GET /api/v1/episodes` - List all episodes (paginated)
- `GET /api/v1/episodes/:id` - Get episode details
- `POST /api/v1/episodes` - Create new episode (admin only)
- `PUT /api/v1/episodes/:id` - Update episode (admin/editor)
- `DELETE /api/v1/episodes/:id` - Delete episode (admin only)

### Thumbnails Resource
- `GET /api/v1/episodes/:id/thumbnails` - List episode thumbnails
- `GET /api/v1/thumbnails/:id` - Get thumbnail details
- `POST /api/v1/episodes/:id/thumbnails` - Upload thumbnail (editor+)
- `DELETE /api/v1/thumbnails/:id` - Delete thumbnail (admin)

### Metadata Resource
- `GET /api/v1/episodes/:id/metadata` - Get extracted metadata
- `POST /api/v1/episodes/:id/metadata` - Store metadata (system)
- `PUT /api/v1/episodes/:id/metadata` - Update metadata (admin)

### Processing Jobs Resource
- `GET /api/v1/processing-queue` - List all jobs
- `GET /api/v1/processing-queue/:id` - Get job status
- `POST /api/v1/episodes/:id/process` - Trigger thumbnail generation

---

## Phase 1E: Authentication & Authorization (Days 4-5)

### Cognito Integration
- Verify JWT tokens from Cognito
- Extract user groups from token
- Implement role-based access control (RBAC)

### Middleware
- `authMiddleware` - Verify authentication
- `rbacMiddleware` - Check user role permissions
- `auditMiddleware` - Log all actions

### Role Permissions
- **Admin:** Full CRUD on all resources
- **Editor:** Create/edit episodes and upload thumbnails
- **Viewer:** Read-only access to episodes and metadata

---

## Phase 1F: Testing (Days 4-6)

### Unit Tests
- Database model validations
- Business logic
- Utility functions

### Integration Tests
- Database operations
- API endpoints with various user roles
- Cognito authentication
- S3 integration
- SQS integration

### Test Coverage Target
- Minimum 80% code coverage
- All critical paths tested
- Error scenarios covered

---

## Deliverables

By end of Phase 1:
- ✅ Database schema implemented in AWS RDS
- ✅ Sequelize models with migrations
- ✅ RESTful API with all CRUD operations
- ✅ Cognito authentication integrated
- ✅ Role-based access control implemented
- ✅ Comprehensive test suite (80%+ coverage)
- ✅ API documentation (Swagger/OpenAPI)
- ✅ Error handling and logging

---

## Success Criteria

- [ ] All database tables created and tested
- [ ] All Sequelize models working with associations
- [ ] All API endpoints returning correct responses
- [ ] Authentication working with Cognito
- [ ] RBAC properly restricting access
- [ ] Test suite passing with 80%+ coverage
- [ ] Database connected to AWS RDS
- [ ] S3 bucket integration tested
- [ ] SQS queue integration ready for Lambda

---

## Potential Blockers

1. **RDS Provisioning** - Currently provisioning, expected ~10-15 min
   - Workaround: Use local PostgreSQL for development while waiting
   
2. **GitHub Push** - Pending secret scanning alert dismissal
   - Workaround: Commit to local repo, push when alerts dismissed

3. **S3 Integration** - Requires S3 bucket access
   - Status: Buckets created in Phase 0, ready to use

4. **Cognito Integration** - Requires valid user pools
   - Status: User pools created in Phase 0, ready to use

---

## Time Estimates

| Task | Days | Owner |
|------|------|-------|
| Database Schema Design | 1.5 | Dev #1 |
| Sequelize Models | 1.5 | Dev #1 |
| Migrations | 0.5 | Dev #1 |
| API Endpoints | 2 | Dev #2 |
| Auth & RBAC | 1 | Dev #2 |
| Testing | 2 | Both |
| Documentation | 1 | Dev #2 |
| **Total** | **9.5** | - |

**Budget:** 10 days (Phase 1 allocated 2 weeks = 10 working days)

---

## Files to Create

**Database & Models:**
- `src/models/Episode.js`
- `src/models/MetadataStorage.js`
- `src/models/Thumbnail.js`
- `src/models/ProcessingQueue.js`
- `src/models/ActivityLog.js`
- `src/db/sequelize.js` - Sequelize instance config

**Migrations:**
- `migrations/01-create-episodes.js`
- `migrations/02-create-metadata-storage.js`
- `migrations/03-create-thumbnails.js`
- `migrations/04-create-processing-queue.js`
- `migrations/05-create-activity-logs.js`

**API Routes:**
- `src/routes/episodes.js`
- `src/routes/thumbnails.js`
- `src/routes/metadata.js`
- `src/routes/processing.js`

**Controllers:**
- `src/controllers/episodeController.js`
- `src/controllers/thumbnailController.js`
- `src/controllers/metadataController.js`
- `src/controllers/processingController.js`

**Middleware:**
- `src/middleware/auth.js`
- `src/middleware/rbac.js`
- `src/middleware/audit.js`
- `src/middleware/errorHandler.js`

**Tests:**
- `tests/unit/models/*.test.js`
- `tests/integration/database/*.test.js`
- `tests/integration/api/*.test.js`

**Documentation:**
- `docs/API.md` - API documentation
- `docs/SCHEMA.md` - Database schema documentation
- `docs/AUTHENTICATION.md` - Auth flow documentation

---

## Next Steps (Now)

1. ✅ Create Phase 1 plan (this file)
2. Design episode metadata database schema
3. Create Sequelize models
4. Implement database migrations
5. Build API endpoints
6. Add authentication & authorization
7. Write comprehensive tests

**Parallel Background Tasks:**
- Monitor RDS provisioning (check every 5 min)
- Wait for GitHub push opportunity
- Update Secrets Manager when RDS available

Let's begin! 🚀
