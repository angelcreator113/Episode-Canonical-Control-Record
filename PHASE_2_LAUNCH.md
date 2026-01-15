# PHASE 2 LAUNCH - AWS Infrastructure & Staging Setup

**Start Date**: January 7, 2026  
**Estimated Duration**: 10 working days  
**Phase 1 Status**: ✅ COMPLETE (95%)  

---

## Phase 2 Overview

**Phase 2** focuses on AWS infrastructure, S3 file management, search capabilities, and asynchronous job processing.

### Key Components
1. **S3 File Upload Service** - Store episodes, thumbnails, assets
2. **OpenSearch Integration** - Full-text search on episodes
3. **SQS Job Queue** - Asynchronous processing (thumbnails, transcoding)
4. **Lambda Functions** - Serverless thumbnail generation
5. **File Validation** - Upload validation, scanning
6. **Job Management** - Queue monitoring, retry logic

### Target Coverage
- **Tests**: 380+ new tests (Unit + Integration)
- **Code Coverage**: 74-75% overall
- **API Endpoints**: 15+ new endpoints for files, search, jobs

---

## Phase 2 Timeline (10 Days)

| Days | Phase | Focus | Coverage |
|------|-------|-------|----------|
| **1-2** | AWS Setup | S3, OpenSearch, SQS, Lambda | - |
| **2-4** | S3 & Files | Upload, validation, storage | 71.5% |
| **4-6** | Search | OpenSearch integration | 72.5% |
| **6-8** | Job Queue | SQS, async processing | 73.5% |
| **8-10** | Lambda & Polish | Thumbnail generation, testing | 74-75% |

---

## What's Included in Phase 2

### AWS Infrastructure (AWS Team - Days 1-2)
```
✓ S3 Buckets (3 environments × 3 buckets = 9 total)
  - episodes/ - Raw episode files
  - thumbnails/ - Generated thumbnail images
  - temp/ - Temporary working space

✓ OpenSearch Domain
  - t3.small instance type
  - 100GB storage
  - Full-text search indexes

✓ SQS Queues
  - Main queue for thumbnail jobs
  - Dead Letter Queue (DLQ) for failed jobs

✓ Lambda Functions
  - Thumbnail generator triggered by S3 events
  - SQS batch processor for queued jobs

✓ IAM Roles & Policies
  - Lambda execution role
  - S3 access policies
  - SQS permissions
```

### Development Implementation (Dev Team - Days 2-10)
```
✓ S3Service
  - Upload files to S3
  - Generate pre-signed URLs
  - Manage file lifecycle

✓ FileValidationService
  - Validate file types (jpg, png, mp4, etc.)
  - Check file sizes
  - Scan for malware

✓ OpenSearchService
  - Index episodes and assets
  - Full-text search
  - Faceted filtering

✓ JobQueueService
  - Send jobs to SQS
  - Monitor job status
  - Handle retries and DLQ

✓ File Controller
  - GET /files/upload (pre-signed URL)
  - POST /files/upload (handle upload)
  - GET /files/:id (retrieve file)

✓ Search Controller
  - GET /search (query)
  - GET /search/:type (by type)
  - POST /search/index (index episodes)

✓ Job Controller
  - GET /jobs (list)
  - GET /jobs/:id (detail)
  - POST /jobs/retry (retry failed)
```

### Test Coverage
```
✓ 230 Unit Tests
  - S3Service: 40 tests
  - FileValidationService: 35 tests
  - OpenSearchService: 45 tests
  - JobQueueService: 40 tests
  - Controllers: 70 tests

✓ 150 Integration Tests
  - File upload flow
  - Search indexing
  - Job processing
  - Error handling
```

---

## Getting Started

### Step 1: AWS Setup (2-4 hours)
For **AWS/DevOps Team**:
- Follow [PHASE_2_AWS_SETUP.md](PHASE_2_AWS_SETUP.md)
- Create all AWS resources
- Save endpoint URLs
- Share credentials with dev team

### Step 2: Development Preparation (30 minutes)
For **Development Team**:
```bash
# Install dependencies
npm install aws-sdk @opensearch-project/opensearch multer sharp uuid

# Create environment file
cp .env.phase2.example .env.phase2

# Edit with AWS credentials from AWS team
# - S3 bucket names
# - OpenSearch endpoint
# - SQS queue URLs
# - Lambda function ARN

# Run migrations
npm run migrate

# Verify connections
npm run test:aws
```

### Step 3: Implementation (Days 2-10)
For **Development Team**:
- Implement S3Service (Day 2-3)
- Implement FileValidationService (Day 3-4)
- Implement file upload controller (Day 4)
- Implement OpenSearchService (Day 5-6)
- Implement search controller (Day 6-7)
- Implement JobQueueService (Day 7-8)
- Implement job controller (Day 8-9)
- Write tests and achieve 74-75% coverage (Day 9-10)

---

## Key Files to Review

### Documentation
- **[PHASE_2_AWS_SETUP.md](PHASE_2_AWS_SETUP.md)** - AWS provisioning guide
- **[PHASE_2_IMPLEMENTATION_SUMMARY.md](PHASE_2_IMPLEMENTATION_SUMMARY.md)** - Implementation details
- **[PHASE_2_INTEGRATION_GUIDE.md](PHASE_2_INTEGRATION_GUIDE.md)** - Integration instructions
- **[PHASE_2_START_HERE.md](PHASE_2_START_HERE.md)** - Quick start guide

### Services to Implement
- `src/services/S3Service.js` - File storage and retrieval
- `src/services/FileValidationService.js` - File validation
- `src/services/OpenSearchService.js` - Full-text search
- `src/services/JobQueueService.js` - Async job processing

### Controllers to Implement
- `src/controllers/fileController.js` - File upload/download
- `src/controllers/searchController.js` - Search endpoints
- `src/controllers/jobController.js` - Job management

### Routes
- `src/routes/files.js` - File routes
- `src/routes/search.js` - Search routes
- `src/routes/jobs.js` - Job routes

---

## Success Criteria

### Day 1-2: AWS Setup ✓
- [x] S3 buckets created and accessible
- [x] S3 versioning and encryption enabled
- [x] OpenSearch domain healthy
- [x] SQS queues with DLQ configured
- [x] Lambda function deployed
- [x] All endpoints saved in .env.phase2

### Day 2-4: S3 Implementation ✓
- [ ] S3Service implemented and tested
- [ ] FileValidationService implemented
- [ ] File controller working
- [ ] Upload endpoint accepting files
- [ ] Coverage: 71.5%

### Day 4-6: Search Implementation ✓
- [ ] OpenSearchService implemented
- [ ] Search controller working
- [ ] Episodes indexed in OpenSearch
- [ ] Search queries returning results
- [ ] Coverage: 72.5%

### Day 6-8: Job Queue Implementation ✓
- [ ] JobQueueService implemented
- [ ] Job controller working
- [ ] Jobs queued to SQS
- [ ] Job status monitoring working
- [ ] DLQ handling verified
- [ ] Coverage: 73.5%

### Day 8-10: Lambda & Testing ✓
- [ ] Lambda function processing jobs
- [ ] Thumbnail generation working
- [ ] Error handling and retries working
- [ ] All 380+ tests passing
- [ ] Coverage: 74-75%
- [ ] Code reviewed and documented

---

## Current System Status

### Backend
- ✅ Running on port 3002
- ✅ Health check passing
- ✅ All Phase 1 endpoints working
- ✅ Database connected

### Frontend
- ✅ Ready on port 5173
- ✅ Components built
- ✅ Asset library functional

### Database
- ✅ PostgreSQL connected
- ✅ Phase 1 schema complete
- ✅ Migrations ready for Phase 2

---

## Common Questions

**Q: When do we start writing code?**  
A: After AWS setup is complete (2-4 hours). Development can begin on Day 2.

**Q: Can we parallelize AWS and development?**  
A: Yes! Dev team can review code and set up environments while AWS team provisions resources.

**Q: What if AWS resources fail to provision?**  
A: See PHASE_2_AWS_SETUP.md troubleshooting section. Most issues resolve with IAM permissions.

**Q: How long does OpenSearch provisioning take?**  
A: 45-60 minutes. Start this first, do other tasks while waiting.

**Q: Can we use LocalStack for testing?**  
A: Yes, LocalStack can simulate AWS services locally for testing.

---

## Next Steps

### Right Now (Next 5 minutes)
1. Read [PHASE_2_AWS_SETUP.md](PHASE_2_AWS_SETUP.md) overview section
2. Determine AWS team and dev team
3. Start AWS provisioning

### Within 1 Hour
1. AWS team: Begin creating S3 buckets
2. Dev team: Review [PHASE_2_IMPLEMENTATION_SUMMARY.md](PHASE_2_IMPLEMENTATION_SUMMARY.md)
3. Prepare environment files

### End of Day 1 (4-6 hours)
1. AWS resources provisioned (or close)
2. .env.phase2 created
3. Development environment ready
4. Tests configured

### Day 2+
1. Implement services and controllers
2. Write tests
3. Achieve coverage targets
4. Deploy to staging

---

## Support & Documentation

- 📖 **AWS Guide**: [PHASE_2_AWS_SETUP.md](PHASE_2_AWS_SETUP.md)
- 🚀 **Implementation**: [PHASE_2_IMPLEMENTATION_SUMMARY.md](PHASE_2_IMPLEMENTATION_SUMMARY.md)
- 🔗 **Integration**: [PHASE_2_INTEGRATION_GUIDE.md](PHASE_2_INTEGRATION_GUIDE.md)
- ⚡ **Quick Start**: [PHASE_2_START_HERE.md](PHASE_2_START_HERE.md)
- ✅ **Verification**: [PHASE_2_VERIFICATION_REPORT.md](PHASE_2_VERIFICATION_REPORT.md)

---

## Ready? 🚀

1. **AWS Team**: Start with [PHASE_2_AWS_SETUP.md](PHASE_2_AWS_SETUP.md)
2. **Dev Team**: Review [PHASE_2_IMPLEMENTATION_SUMMARY.md](PHASE_2_IMPLEMENTATION_SUMMARY.md)
3. **Everyone**: Bookmark this document for reference

**Let's build it!** 🎉
