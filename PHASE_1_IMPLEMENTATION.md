# Phase 1: Database Schema & Core API

## Overview

Phase 1 focuses on building the foundational database layer and RESTful API for episode metadata management. This phase completes the infrastructure setup from Phase 0 with a fully functional backend API ready for frontend integration.

## Completed Tasks

### ✅ Database Schema Design (1A)
- Designed 5-table relational database schema
  - `episodes` - Core episode metadata
  - `metadata_storage` - ML/AI analysis results
  - `thumbnails` - Image metadata and S3 references
  - `processing_queue` - Async job tracking
  - `activity_logs` - Audit trail

### ✅ Sequelize Models (1A)
Created fully-featured ORM models with:
- **Episode Model** (305 lines)
  - 18 fields covering episode details, ratings, S3 references
  - Soft delete support (paranoid mode)
  - Instance methods: `softDelete()`, `restore()`, `updateStatus()`, `getS3Info()`
  - Class methods: `findActive()`, `findBySeason()`, `getPendingProcessing()`
  - Scopes: `active`, `deleted`, `processing`, `failed`
  - Indexes: unique (show/season/episode), air_date, processing_status, deleted_at

- **MetadataStorage Model** (150 lines)
  - JSON fields for flexible ML/AI analysis results
  - Instance methods: `updateExtractedText()`, `addTags()`, `setDetectedScenes()`
  - Class methods: `getForEpisode()`, `createOrUpdate()`

- **Thumbnail Model** (200 lines)
  - S3 integration with URL builders
  - Instance methods: `getS3Url()`, `getCloudfrontUrl()`, `setQualityRating()`
  - Class methods: `getPrimary()`, `findByType()`, `findFrame()`, `createPrimary()`
  - Support for primary, cover, poster, and frame thumbnails

- **ProcessingQueue Model** (240 lines)
  - SQS message tracking with retry logic
  - Instance methods: `startProcessing()`, `complete()`, `fail()`, `retry()`, `canRetry()`
  - Class methods: `createJob()`, `findPending()`, `findFailed()`, `findRetryable()`, `getStats()`
  - Support for thumbnail_generation, metadata_extraction, transcription jobs

- **ActivityLog Model** (180 lines)
  - Comprehensive audit trail with IP and user-agent tracking
  - Class methods: `logActivity()`, `getUserHistory()`, `getResourceHistory()`, `getAuditTrail()`
  - Support for view, create, edit, delete, download, upload actions

### ✅ Database Migrations
Created 5 migration files using Sequelize CLI:
1. `20240101000001-create-episodes.js` - Episodes table with indexes
2. `20240101000002-create-metadata-storage.js` - Metadata storage table
3. `20240101000003-create-thumbnails.js` - Thumbnails table with unique s3Key
4. `20240101000004-create-processing-queue.js` - Processing queue with SQS tracking
5. `20240101000005-create-activity-logs.js` - Activity logs for audit trail

### ✅ Core API Endpoints (1B)
Implemented RESTful Episode API:
- `GET /api/v1/episodes` - List episodes with pagination
- `GET /api/v1/episodes/:id` - Get single episode with all relationships
- `GET /api/v1/episodes/:id/status` - Get processing status
- `POST /api/v1/episodes` - Create new episode
- `PUT /api/v1/episodes/:id` - Update episode
- `DELETE /api/v1/episodes/:id` - Soft delete episode
- `POST /api/v1/episodes/:id/enqueue` - Enqueue for processing

### ✅ Application Integration
- Initialized database connection in app.js
- Updated health check endpoint to include database status
- Mounted episode routes on `/api/v1/episodes`
- Added API info endpoint on `/api/v1`

## Project Structure

```
src/
├── app.js                           # Express app with database initialization
├── config/
│   ├── database.js                 # Environment-specific DB config
│   ├── environment.js              # Feature flags and settings
│   ├── aws.js                      # AWS SDK configuration
│   └── sequelize.js                # Sequelize configuration
├── models/
│   ├── index.js                    # Sequelize instance + associations
│   ├── Episode.js                  # Episode model
│   ├── MetadataStorage.js          # Metadata model
│   ├── Thumbnail.js                # Thumbnail model
│   ├── ProcessingQueue.js          # Processing queue model
│   └── ActivityLog.js              # Activity log model
├── controllers/
│   ├── episodeController.js        # Episode CRUD operations
│   └── [other controllers]         # To be created
├── routes/
│   ├── episodes.js                 # Episode endpoints
│   └── [other routes]              # To be created
├── middleware/
│   └── [to be created]             # Auth, RBAC, error handling
├── migrations/
│   ├── 20240101000001-create-episodes.js
│   ├── 20240101000002-create-metadata-storage.js
│   ├── 20240101000003-create-thumbnails.js
│   ├── 20240101000004-create-processing-queue.js
│   └── 20240101000005-create-activity-logs.js
└── services/
    └── [to be created]             # Business logic services
```

## Database Connection

### Local Development
```bash
# Using Docker PostgreSQL
HOST=localhost
PORT=5432
DB_NAME=episode_metadata_dev
DB_USER=admin
DB_PASSWORD=password
```

### RDS Environments (Once Available)
Endpoints will be stored in AWS Secrets Manager:
- Development: `episode-metadata-rds-dev`
- Staging: `episode-metadata-rds-staging`
- Production: `episode-metadata-rds-prod`

## Running Migrations

### Create new migration
```bash
npx sequelize-cli migration:generate --name migration-name
```

### Run migrations
```bash
# Development
npx sequelize-cli db:migrate --env development

# Staging
npx sequelize-cli db:migrate --env staging

# Production
npx sequelize-cli db:migrate --env production
```

### Rollback
```bash
# Undo last migration
npx sequelize-cli db:migrate:undo

# Undo all migrations
npx sequelize-cli db:migrate:undo:all
```

## API Usage Examples

### Create Episode
```bash
curl -X POST http://localhost:3000/api/v1/episodes \
  -H "Content-Type: application/json" \
  -d '{
    "showName": "Styling Adventures w Lala",
    "seasonNumber": 1,
    "episodeNumber": 1,
    "episodeTitle": "First Episode",
    "airDate": "2024-01-15T00:00:00Z",
    "director": "Director Name",
    "durationMinutes": 30
  }'
```

### List Episodes
```bash
curl http://localhost:3000/api/v1/episodes?page=1&limit=20&status=pending
```

### Get Episode with Details
```bash
curl http://localhost:3000/api/v1/episodes/1
```

### Update Episode
```bash
curl -X PUT http://localhost:3000/api/v1/episodes/1 \
  -H "Content-Type: application/json" \
  -d '{
    "processingStatus": "completed",
    "episodeTitle": "Updated Title"
  }'
```

### Enqueue for Processing
```bash
curl -X POST http://localhost:3000/api/v1/episodes/1/enqueue \
  -H "Content-Type: application/json" \
  -d '{
    "jobTypes": ["thumbnail_generation", "metadata_extraction"],
    "jobConfig": {
      "quality": "high",
      "formats": ["png", "jpg"]
    }
  }'
```

## Testing

### Unit Tests (To Be Created)
```bash
npm test
```

### Database Tests
```bash
npm run test:db
```

### API Integration Tests
```bash
npm run test:api
```

## Next Steps (Phase 1C+)

### Phase 1C: Authentication & Authorization
- [ ] Cognito JWT validation middleware
- [ ] RBAC middleware (admin, editor, viewer)
- [ ] Activity logging middleware
- [ ] Error handling middleware

### Phase 1D: Additional Controllers
- [ ] ThumbnailController (image management)
- [ ] MetadataController (ML/AI results)
- [ ] ProcessingController (job tracking)

### Phase 1E: Testing
- [ ] Unit tests for models
- [ ] Integration tests for API endpoints
- [ ] Database transaction tests
- [ ] Error handling tests

### Phase 1F: Documentation
- [ ] Swagger/OpenAPI documentation
- [ ] API response schema definitions
- [ ] Error code reference
- [ ] Database schema ERD diagram

## Blockers & Dependencies

### Phase 0D: RDS Provisioning (In Progress)
- Status: Waiting for RDS instances to reach "available" state
- Impact: Cannot test against production RDS endpoints yet
- Workaround: Using local Docker PostgreSQL for development
- Timeline: Expected 10-15 minutes from RDS creation

### GitHub Push (In Progress)
- Status: Waiting for secret scanning alerts to be dismissed
- Impact: Code not yet pushed to GitHub remote
- Workaround: Code is safe in local git repository
- Timeline: Expected dismissal within 1 hour

## Environment Variables

Create a `.env` file in project root:

```env
# Node Environment
NODE_ENV=development
PORT=3000
API_VERSION=v1

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=admin
DB_PASSWORD=password
DB_NAME=episode_metadata_dev
DB_POOL_MIN=2
DB_POOL_MAX=10
SQL_LOGGING=false

# AWS (from Phase 0)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<from Secrets Manager>
AWS_SECRET_ACCESS_KEY=<from Secrets Manager>

# Cognito
COGNITO_USER_POOL_ID=<from Phase 0>
COGNITO_CLIENT_ID=<from Phase 0>
COGNITO_REGION=us-east-1

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

## Performance Considerations

### Indexes
- Unique index on (showName, seasonNumber, episodeNumber) for fast episode lookup
- Index on air_date for chronological queries
- Index on processingStatus for status-based filtering
- Index on deletedAt for soft delete queries
- Composite indexes on frequently queried combinations

### Query Optimization
- Use appropriate `include` clauses to avoid N+1 queries
- Pagination with limit/offset for large result sets
- Database connection pooling configured per environment
- Read replicas planned for production (Phase 2)

### Caching Strategy (Phase 2)
- Redis caching for frequently accessed episodes
- Cache invalidation on updates
- TTL-based cache expiration

## Monitoring & Logging

### Database Logging
Enable SQL logging in development:
```env
SQL_LOGGING=true
```

### Activity Audit Trail
All user actions logged to `activity_logs` table:
- User ID (from Cognito)
- Action type (view, create, edit, delete, etc.)
- Resource type and ID
- Old/new values for changes
- IP address and user agent

### Performance Metrics (Phase 2)
- Query execution times
- Database connection pool stats
- API response times by endpoint
- Error rates and types

## Related Documentation

- [AWS Setup Guide](docs/AWS_SETUP.md) - Phase 0 infrastructure
- [Environment Variables](docs/ENV_VARIABLES.md) - Configuration reference
- [Deployment Guide](docs/DEPLOYMENT.md) - CI/CD and production setup
- [Phase 1 Plan](PHASE_1_PLAN.md) - Detailed development plan

## Contact & Support

- **Database Issues**: Check logs, verify connection string, check RDS status
- **API Issues**: Review error response, check request format
- **Migration Issues**: Check migration file syntax, review Sequelize docs
- **Performance Issues**: Review indexes, analyze slow queries, check connection pool

---

**Status**: Phase 1A & 1B Complete ✅  
**Next**: Phase 1C (Authentication & Authorization)  
**Timeline**: Phase 1 completion expected within 10 days
