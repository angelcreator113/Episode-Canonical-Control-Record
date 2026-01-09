# Phase 2 Implementation Checklist

**Phase**: 2 - AWS Infrastructure & Staging  
**Duration**: 10 working days  
**Start Date**: January 7, 2026  
**Target Coverage**: 74-75%  

---

## Pre-Implementation (AWS Team)

### Day 1: AWS Setup
- [ ] **S3 Buckets Created** (30 min)
  - [ ] episode-canonical-episodes-dev
  - [ ] episode-canonical-thumbnails-dev
  - [ ] episode-canonical-temp-dev
  - [ ] All encrypted with AES-256
  - [ ] Versioning enabled on episodes & thumbnails
  - [ ] Public access blocked
  - [ ] Lifecycle policies configured

- [ ] **OpenSearch Domain Provisioned** (45-60 min)
  - [ ] Domain: episode-canonical-search-dev
  - [ ] Instance: t3.small
  - [ ] Storage: 100GB
  - [ ] HTTPS enabled
  - [ ] Node-to-node encryption enabled
  - [ ] Encryption at rest enabled
  - [ ] Endpoint URL saved

- [ ] **SQS Queues Created** (20 min)
  - [ ] Main queue: episode-canonical-jobs-dev
  - [ ] DLQ: episode-canonical-jobs-dlq-dev
  - [ ] Message retention: 14 days
  - [ ] Visibility timeout: 300 seconds
  - [ ] DLQ redrive policy configured

- [ ] **Lambda Function Deployed** (20 min)
  - [ ] Function: episode-canonical-thumbnail-processor
  - [ ] Runtime: Node.js 18.x
  - [ ] Memory: 1024 MB
  - [ ] Timeout: 300 seconds
  - [ ] Event source: SQS (batch size 10)

- [ ] **IAM Roles & Policies** (15 min)
  - [ ] Lambda execution role created
  - [ ] S3 access policy attached
  - [ ] SQS access policy attached
  - [ ] CloudWatch Logs policy attached

- [ ] **Environment File Created** (5 min)
  - [ ] .env.phase2 file created
  - [ ] All AWS credentials filled in
  - [ ] File added to .gitignore
  - [ ] Shared with dev team

---

## Day 1-2: Development Preparation

- [ ] **Dependencies Installed**
  ```bash
  npm install aws-sdk @opensearch-project/opensearch multer sharp uuid
  ```

- [ ] **Environment Configured**
  - [ ] .env.phase2 copied to project
  - [ ] AWS credentials verified
  - [ ] S3 bucket names verified
  - [ ] OpenSearch endpoint tested
  - [ ] SQS queue URLs verified

- [ ] **Database Ready**
  ```bash
  npm run migrate
  ```
  - [ ] Phase 2 migrations applied
  - [ ] Tables created
  - [ ] Indexes added

- [ ] **Tests Configured**
  - [ ] Jest configured for AWS services
  - [ ] Test database ready
  - [ ] Test S3 bucket (optional) ready

---

## Day 2-4: S3 File Upload Service

### Service Implementation
- [ ] **S3Service Created** (`src/services/S3Service.js`)
  ```javascript
  class S3Service {
    - uploadFile(buffer, key, metadata) → Promise
    - downloadFile(key) → Promise
    - deleteFile(key) → Promise
    - generatePresignedUrl(key, expiresIn) → string
    - getFileMetadata(key) → Promise
    - listFiles(prefix, maxKeys) → Promise
  }
  ```

- [ ] **FileValidationService Created** (`src/services/FileValidationService.js`)
  ```javascript
  class FileValidationService {
    - validateFileType(file, allowedTypes) → boolean
    - validateFileSize(file, maxSize) → boolean
    - validateContent(buffer) → boolean
    - scanForMalware(buffer) → Promise
  }
  ```

### API Implementation
- [ ] **File Controller** (`src/controllers/fileController.js`)
  - [ ] POST /api/v1/files/upload (pre-signed URL)
    - Returns S3 presigned URL for client upload
    - Input: filename, filesize
    - Output: { url, fields, key }
  
  - [ ] POST /api/v1/files (server-side upload)
    - Upload file from form data
    - Input: file (multipart)
    - Output: { fileId, key, url, size, type }
  
  - [ ] GET /api/v1/files/:id (retrieve file)
    - Download file from S3
    - Input: file ID
    - Output: file stream
  
  - [ ] DELETE /api/v1/files/:id (delete file)
    - Delete from S3
    - Input: file ID
    - Output: { success, deleted }

- [ ] **File Routes** (`src/routes/files.js`)
  - [ ] Route POST /upload
  - [ ] Route POST /
  - [ ] Route GET /:id
  - [ ] Route DELETE /:id
  - [ ] RBAC: EDITOR+ for upload, VIEWER+ for download, ADMIN for delete

### Testing
- [ ] **Unit Tests** (40 tests)
  - [ ] S3Service: 20 tests
    - uploadFile success/failure
    - downloadFile success/failure
    - deleteFile success/failure
    - generatePresignedUrl correctness
    - getFileMetadata success/failure
    - listFiles pagination
  
  - [ ] FileValidationService: 20 tests
    - validateFileType: image/video/document
    - validateFileSize: within/exceed limits
    - validateContent: valid/corrupted files
    - scanForMalware: clean/infected files

- [ ] **Integration Tests** (20 tests)
  - [ ] File upload flow end-to-end
  - [ ] File download flow end-to-end
  - [ ] File validation during upload
  - [ ] Pre-signed URL generation
  - [ ] Error handling (file too large, invalid type, etc.)

- [ ] **API Tests** (30 tests)
  - [ ] POST /api/v1/files/upload (401, 403, 200)
  - [ ] POST /api/v1/files (various file types)
  - [ ] GET /api/v1/files/:id (200, 404)
  - [ ] DELETE /api/v1/files/:id (200, 403, 404)

### Coverage Target
- **S3Service**: 85%+ coverage
- **FileValidationService**: 90%+ coverage
- **fileController**: 80%+ coverage
- **Overall Phase 2A**: 71.5% coverage

---

## Day 4-6: Search & Indexing Service

### Service Implementation
- [ ] **OpenSearchService Created** (`src/services/OpenSearchService.js`)
  ```javascript
  class OpenSearchService {
    - createIndex(indexName, schema) → Promise
    - indexDocument(indexName, id, document) → Promise
    - searchDocuments(indexName, query, filters) → Promise
    - updateDocument(indexName, id, updates) → Promise
    - deleteDocument(indexName, id) → Promise
    - bulkIndex(indexName, documents) → Promise
  }
  ```

### API Implementation
- [ ] **Search Controller** (`src/controllers/searchController.js`)
  - [ ] GET /api/v1/search (full-text search)
    - Query episodes, assets, templates
    - Input: q (query), type (episode|asset|template), filters
    - Output: [{ id, title, score, highlights }]
  
  - [ ] GET /api/v1/search/:type (search by type)
    - Search specific resource type
    - Input: q, filters
    - Output: results by type
  
  - [ ] POST /api/v1/search/index (bulk index)
    - Re-index all documents
    - Input: force (boolean)
    - Output: { indexed, errors }
  
  - [ ] GET /api/v1/search/status (search status)
    - Check search service health
    - Output: { healthy, indices, documents }

- [ ] **Search Routes** (`src/routes/search.js`)
  - [ ] Route GET / (search)
  - [ ] Route GET /:type (search by type)
  - [ ] Route POST /index (bulk index)
  - [ ] Route GET /status (status check)
  - [ ] RBAC: VIEWER+ for search, EDITOR+ for index

### Database Schema Updates
- [ ] **Search Index Table** (optional, for audit)
  - Columns: id, indexName, documentId, indexed_at, status
  - Indexes: documentId, indexed_at

### Testing
- [ ] **Unit Tests** (45 tests)
  - [ ] OpenSearchService: 30 tests
    - createIndex success/failure
    - indexDocument single/bulk
    - searchDocuments: text, filters, pagination
    - updateDocument success/failure
    - deleteDocument success/failure
    - Highlighting and scoring
  
  - [ ] Search Query Building: 15 tests
    - Simple text queries
    - Complex boolean queries
    - Filter combinations
    - Range queries

- [ ] **Integration Tests** (35 tests)
  - [ ] Index episodes end-to-end
  - [ ] Search episodes with filters
  - [ ] Update indexed documents
  - [ ] Delete indexed documents
  - [ ] Search across multiple types
  - [ ] Error handling (OpenSearch down, invalid query)

- [ ] **API Tests** (20 tests)
  - [ ] GET /api/v1/search (200, 400)
  - [ ] GET /api/v1/search/:type (200, 400, 404)
  - [ ] POST /api/v1/search/index (202, 403)
  - [ ] GET /api/v1/search/status (200)

### Coverage Target
- **OpenSearchService**: 85%+ coverage
- **searchController**: 80%+ coverage
- **Overall Phase 2B**: 72.5% coverage

---

## Day 6-8: Job Queue Service

### Service Implementation
- [ ] **JobQueueService Created** (`src/services/JobQueueService.js`)
  ```javascript
  class JobQueueService {
    - sendJob(jobType, payload) → Promise
    - getJobStatus(jobId) → Promise
    - retryJob(jobId) → Promise
    - getFailedJobs() → Promise
    - cleanupOldJobs(daysOld) → Promise
  }
  ```

### API Implementation
- [ ] **Job Controller** (`src/controllers/jobController.js`)
  - [ ] GET /api/v1/jobs (list jobs)
    - List all jobs with status
    - Input: status (pending|processing|completed|failed), limit
    - Output: [{ jobId, type, status, progress, createdAt, updatedAt }]
  
  - [ ] GET /api/v1/jobs/:id (job detail)
    - Get single job details
    - Input: job ID
    - Output: { jobId, type, status, progress, result, error, createdAt }
  
  - [ ] POST /api/v1/jobs/:id/retry (retry job)
    - Retry a failed job
    - Input: job ID
    - Output: { success, jobId, message }
  
  - [ ] GET /api/v1/jobs/failed (list failed jobs)
    - List jobs in DLQ
    - Input: limit
    - Output: [{ jobId, error, failureCount }]

- [ ] **Job Routes** (`src/routes/jobs.js`)
  - [ ] Route GET / (list)
  - [ ] Route GET /:id (detail)
  - [ ] Route POST /:id/retry (retry)
  - [ ] Route GET /failed (failed jobs)
  - [ ] RBAC: EDITOR+ for create, VIEWER+ for view, ADMIN for retry

### Database Schema Updates
- [ ] **Job Tracking Table** (if tracking locally)
  - Columns: jobId, jobType, status, progress, payload, result, error, attempts, createdAt, updatedAt
  - Indexes: status, createdAt, updatedAt

### Testing
- [ ] **Unit Tests** (40 tests)
  - [ ] JobQueueService: 25 tests
    - sendJob success/failure
    - getJobStatus all states
    - retryJob success/failure
    - getFailedJobs filtering
    - cleanupOldJobs deletion
  
  - [ ] Job Handling: 15 tests
    - Job serialization
    - Error handling
    - Retry logic

- [ ] **Integration Tests** (40 tests)
  - [ ] Complete job workflow
  - [ ] Job failure and retry
  - [ ] DLQ handling
  - [ ] Job status updates
  - [ ] Concurrent job processing
  - [ ] Error handling and recovery

- [ ] **API Tests** (20 tests)
  - [ ] GET /api/v1/jobs (200, 401)
  - [ ] GET /api/v1/jobs/:id (200, 404)
  - [ ] POST /api/v1/jobs/:id/retry (200, 404)
  - [ ] GET /api/v1/jobs/failed (200)

### Coverage Target
- **JobQueueService**: 85%+ coverage
- **jobController**: 80%+ coverage
- **Overall Phase 2C**: 73.5% coverage

---

## Day 8-10: Lambda & Final Testing

### Lambda Worker Enhancement
- [ ] **Thumbnail Processor Lambda** (update from initial deployment)
  ```javascript
  handler(event) {
    - Parse SQS message
    - Download source from S3
    - Generate thumbnails (3-5 sizes)
    - Upload to S3
    - Update database
    - Return success/error
  }
  ```

### Final Integration
- [ ] **Full Flow Testing**
  - [ ] Episode upload → S3 storage → Index in OpenSearch
  - [ ] Thumbnail creation → SQS job → Lambda processing
  - [ ] Search across all indexed content
  - [ ] Error handling and retries

- [ ] **Performance Testing**
  - [ ] S3 upload: 100MB file < 2 minutes
  - [ ] Search: < 200ms for typical queries
  - [ ] Job processing: < 5 minutes per thumbnail
  - [ ] Concurrent uploads: 10+ simultaneous

- [ ] **Security Testing**
  - [ ] File upload validation
  - [ ] Malware scanning
  - [ ] RBAC enforcement
  - [ ] Credential security

### Testing
- [ ] **Unit Tests** (50 tests)
  - [ ] Lambda handler logic
  - [ ] Error scenarios
  - [ ] Timeout handling

- [ ] **Integration Tests** (60 tests)
  - [ ] S3 + OpenSearch integration
  - [ ] SQS + Lambda integration
  - [ ] Complete workflows

- [ ] **API Tests** (30 tests)
  - [ ] All endpoints working
  - [ ] Error responses correct
  - [ ] Performance acceptable

### Coverage Target
- **Overall Phase 2**: 74-75% coverage
- **All new services**: 85%+ coverage
- **All controllers**: 80%+ coverage
- **All routes**: 75%+ coverage

### Documentation
- [ ] **API Documentation Updated**
  - [ ] New file endpoints documented
  - [ ] New search endpoints documented
  - [ ] New job endpoints documented
  - [ ] Examples provided for each

- [ ] **Deployment Guide Created**
  - [ ] AWS setup steps
  - [ ] Environment configuration
  - [ ] Service startup sequence

- [ ] **Troubleshooting Guide**
  - [ ] Common errors and solutions
  - [ ] Performance tuning
  - [ ] Monitoring tips

---

## Final Verification

### Day 10 Checklist
- [ ] All 380+ tests passing
- [ ] Code coverage at 74-75%
- [ ] All endpoints tested and working
- [ ] Performance benchmarks met
- [ ] Security review completed
- [ ] Documentation complete
- [ ] Code reviewed and merged
- [ ] Staging environment deployed
- [ ] Production ready for Phase 3

### Sign-Off
- [ ] **Development Team**: All tests passing, code reviewed
- [ ] **QA Team**: Performance and security verified
- [ ] **DevOps Team**: Infrastructure stable, monitoring in place
- [ ] **Product**: Features meet requirements

---

## Daily Standup Template

```
Date: [Date]
Day: [1-10]

✅ Completed:
- [Task 1]
- [Task 2]

🟡 In Progress:
- [Task 3]

🚫 Blocked:
- [Blocker if any]

📊 Coverage: [XX]%

⏭️ Next:
- [Tomorrow's tasks]
```

---

## Success Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Test Count | 380+ | ☐ |
| Code Coverage | 74-75% | ☐ |
| S3 Latency | <2s | ☐ |
| Search Latency | <200ms | ☐ |
| Job Processing | <5min | ☐ |
| Uptime | 99.9% | ☐ |
| Error Rate | <0.1% | ☐ |

---

## Important Notes

1. **OpenSearch takes 45-60 minutes** to provision. Start first, do other tasks while waiting.

2. **AWS credentials must be kept secure**. Never commit .env.phase2 to git.

3. **SQS has visibility timeout of 300 seconds**. Lambda must complete within that window.

4. **Lambda needs 1024MB memory** for thumbnail generation. Don't reduce without testing.

5. **S3 encryption adds ~5% latency** but is essential for production.

6. **Monthly costs ~$48** for dev environment. Clean up unused resources.

---

## Resources

- 📚 [PHASE_2_LAUNCH.md](PHASE_2_LAUNCH.md) - Overview
- 🏗️ [PHASE_2_AWS_SETUP.md](PHASE_2_AWS_SETUP.md) - AWS provisioning
- 💻 [PHASE_2_IMPLEMENTATION_SUMMARY.md](PHASE_2_IMPLEMENTATION_SUMMARY.md) - Implementation details
- 🔗 [PHASE_2_INTEGRATION_GUIDE.md](PHASE_2_INTEGRATION_GUIDE.md) - Integration instructions
- ✅ [PHASE_2_VERIFICATION_REPORT.md](PHASE_2_VERIFICATION_REPORT.md) - Verification checklist

---

**Ready? Let's build Phase 2!** 🚀
