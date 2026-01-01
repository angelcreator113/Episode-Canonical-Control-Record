# Phase 2 Scaffolding Checklist

## ✅ COMPLETED - File Structure Scaffolding

### Models (1 new)
- [x] FileStorage.js - File metadata model with S3 integration

### Services (3 new)
- [x] S3Service.js - S3 upload/download/delete operations
- [x] FileValidationService.js - File size/type validation
- [x] OpenSearchService.js - Full-text search and indexing
- [x] JobQueueService.js - SQS job queue management

### Controllers (3 new)
- [x] fileController.js - File upload/download endpoints
- [x] searchController.js - Search and filter endpoints
- [x] jobController.js - Job queue management endpoints

### Middleware (2 new)
- [x] uploadValidation.js - File validation middleware
- [x] searchLogger.js - Search analytics middleware

### Routes (3 new)
- [x] files.js - File endpoint routes
- [x] search.js - Search endpoint routes
- [x] jobs.js - Job queue endpoint routes

### Migrations (1 new)
- [x] create-file-storage.js - FileStorage table migration

### Configuration (2 new)
- [x] .env.phase2.example - Environment variables template
- [x] PHASE_2_SCAFFOLDING_CHECKLIST.md - This checklist

---

## ⏳ PENDING - AWS Resources (User Responsibility)

### S3 Setup
- [ ] Create S3 bucket: `brd-episodes-dev`
- [ ] Create S3 bucket: `brd-thumbnails-dev`
- [ ] Create S3 bucket: `brd-temp-dev`
- [ ] Enable versioning on all buckets
- [ ] Configure CORS for browser uploads
- [ ] Enable encryption at rest

### OpenSearch Setup
- [ ] Create OpenSearch domain (t3.small, 100GB)
- [ ] Enable fine-grained access control
- [ ] Create admin user
- [ ] Get endpoint URL
- [ ] Test cluster health

### SQS Setup
- [ ] Create DLQ: `brd-job-dlq-dev`
- [ ] Create queue: `brd-job-queue-dev`
- [ ] Configure DLQ redrive policy
- [ ] Get queue URLs

### Lambda Setup
- [ ] Create IAM role: `brd-lambda-execution-dev`
- [ ] Create execution policy
- [ ] Create Lambda function: `brd-thumbnail-generator-dev`
- [ ] Create SQS event source mapping

### Environment Configuration
- [ ] Copy `.env.phase2.example` to `.env.phase2`
- [ ] Fill in AWS credentials
- [ ] Fill in S3 bucket names
- [ ] Fill in SQS queue URLs
- [ ] Fill in OpenSearch endpoint
- [ ] Test all connections

---

## 📋 NEXT STEPS (Development Team)

### Phase 2A - Core Implementation (Days 1-3)
- [ ] Update Episode model (add hasMany FileStorage)
- [ ] Update ProcessingQueue model (add new columns)
- [ ] Run migrations
- [ ] Create test stubs (S3Service, FileValidationService)
- [ ] Create test stubs (fileController)
- [ ] Create test stubs (searchController)
- [ ] Create test stubs (jobController)
- [ ] Install dependencies (aws-sdk, opensearch, multer, sharp)
- [ ] Implement S3Service.js fully
- [ ] Implement FileValidationService.js fully
- [ ] Implement fileController.js fully
- [ ] Write S3 upload/download unit tests

### Phase 2B - Search Integration (Days 2-4)
- [ ] Implement OpenSearchService.js fully
- [ ] Implement searchController.js fully
- [ ] Create OpenSearch index initialization
- [ ] Create index mapping for episodes
- [ ] Write OpenSearch unit tests
- [ ] Create file-to-search integration logic
- [ ] Write search integration tests

### Phase 2C - Job Queue (Days 3-5)
- [ ] Implement JobQueueService.js fully
- [ ] Implement jobController.js fully
- [ ] Create SQS message handler
- [ ] Create job retry logic with exponential backoff
- [ ] Write job queue unit tests
- [ ] Create SQS integration tests
- [ ] Test DLQ functionality

### Phase 2D - Lambda & Media Processing (Days 4-6)
- [ ] Create JobWorker.js (Lambda handler)
- [ ] Implement thumbnail generation with Sharp
- [ ] Implement video frame extraction
- [ ] Create Lambda CloudWatch logging
- [ ] Create Lambda error handling and retry
- [ ] Write Lambda unit tests
- [ ] Write end-to-end Lambda tests

### Phase 2E - Integration Testing (Days 5-7)
- [ ] Create file-upload.integration.test.js
- [ ] Create search.integration.test.js
- [ ] Create job-queue.integration.test.js
- [ ] Test full upload → indexing → search workflow
- [ ] Test job retry and DLQ handling
- [ ] Performance testing for large files (5-10GB)
- [ ] Load testing for concurrent uploads

### Phase 2F - Final Coverage Push (Days 8-10)
- [ ] Achieve 72% coverage with S3 features
- [ ] Achieve 73% coverage with OpenSearch
- [ ] Achieve 74-75% coverage with SQS/Lambda
- [ ] Fix any remaining uncovered error paths
- [ ] Clean up test artifacts
- [ ] Final documentation and deployment prep

---

## 📊 Expected Coverage Progression

| Phase | Coverage | Tests | Notes |
|-------|----------|-------|-------|
| Current (Phase 1) | 71.13% | 517/551 | Baseline after RDS blocker |
| Day 2 (S3 impl) | 71.5% | 542 | +25 unit tests for S3 |
| Day 4 (Search impl) | 72.2% | 577 | +35 tests for OpenSearch |
| Day 6 (Job queue) | 73.0% | 617 | +40 tests for SQS/Lambda |
| Day 8 (Integration) | 73.8% | 667 | +50 integration tests |
| Final (Day 10) | 74-75% | 700+ | +30 final coverage tests |

---

## 🎯 Success Criteria

- [x] All 13 core files scaffolded
- [x] AWS setup guide created
- [x] Environment template created
- [ ] AWS resources provisioned (user task)
- [ ] All unit tests passing (in progress)
- [ ] All integration tests passing (in progress)
- [ ] 74-75% coverage achieved (in progress)
- [ ] Full S3 upload pipeline working
- [ ] Full search workflow working
- [ ] Full job queue workflow working
- [ ] Lambda thumbnail generation working
- [ ] Error handling and retries working
- [ ] DLQ messages properly handled
- [ ] All code documented
- [ ] All tests documented
- [ ] Ready for production deployment

---

## 📝 Notes for Development Team

1. **Dependency Installation**: Before starting implementation, run:
   ```bash
   npm install aws-sdk @opensearch-project/opensearch multer sharp uuid
   ```

2. **Environment Variables**: Load `.env.phase2` in development:
   ```javascript
   require('dotenv').config({ path: '.env.phase2' });
   ```

3. **Database Migrations**: Run migrations before testing:
   ```bash
   npm run migrate
   ```

4. **OpenSearch Initialization**: Initialize index on app startup:
   ```javascript
   const OpenSearchService = require('./src/services/OpenSearchService');
   app.on('start', () => OpenSearchService.initializeIndex());
   ```

5. **SQS Worker**: Start worker in separate process:
   ```bash
   npm run start:worker
   ```

6. **Testing Strategy**: 
   - Unit tests: Mock S3, SQS, OpenSearch
   - Integration tests: Use LocalStack or AWS SAM for local testing
   - End-to-end tests: Use real AWS resources in development environment

7. **Code Review Points**:
   - Error handling for all S3 operations
   - Proper error message propagation
   - Request/response logging
   - Performance metrics collection
   - Security: Input validation, rate limiting
   - Concurrency: Handle simultaneous uploads
   - Cleanup: Handle incomplete uploads

---

## 📞 Support Resources

- **AWS Documentation**: https://docs.aws.amazon.com/
- **S3 Upload Best Practices**: https://docs.aws.amazon.com/AmazonS3/latest/userguide/
- **OpenSearch Docs**: https://opensearch.org/docs/
- **SQS Best Practices**: https://docs.aws.amazon.com/AWSSimpleQueueService/
- **Node.js Sharp**: https://sharp.pixelplumbing.com/
- **Lambda Documentation**: https://docs.aws.amazon.com/lambda/

