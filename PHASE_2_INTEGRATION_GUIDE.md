# Phase 2 Integration Guide

## Quick Start (5 Minutes)

### 1. Prerequisites Check
```bash
# Verify Node.js
node --version  # Should be 18.x or higher

# Verify npm
npm --version

# Verify Git
git --version
```

### 2. Install Dependencies
```bash
npm install aws-sdk @opensearch-project/opensearch multer sharp uuid pg pg-hstore
```

### 3. Setup Environment
```bash
# Copy template
cp .env.phase2.example .env.phase2

# Edit with your AWS credentials
nano .env.phase2
# OR on Windows:
# notepad .env.phase2
```

### 4. Run Migrations
```bash
npm run migrate
# This creates the FileStorage table
```

### 5. Start Application
```bash
npm start
# Application ready at http://localhost:3000
```

---

## Integration Points

### 1. Update app.js to Mount New Routes

**Before:**
```javascript
const episodesRouter = require('./src/routes/episodes');
app.use('/api/episodes', episodesRouter);
```

**After:**
```javascript
const episodesRouter = require('./src/routes/episodes');
const filesRouter = require('./src/routes/files');
const searchRouter = require('./src/routes/search');
const jobsRouter = require('./src/routes/jobs');

app.use('/api/episodes', episodesRouter);
app.use('/api/files', filesRouter);
app.use('/api/search', searchRouter);
app.use('/api/jobs', jobsRouter);
```

### 2. Update Models Index File

**File**: `src/models/index.js`

Add at the end:
```javascript
db.FileStorage = require('./FileStorage')(sequelize, DataTypes);

// Add associations
db.Episode.hasMany(db.FileStorage, { as: 'files', foreignKey: 'episode_id' });
db.FileStorage.belongsTo(db.Episode, { foreignKey: 'episode_id' });

db.ProcessingQueue.hasOne(db.FileStorage, { foreignKey: 'processing_job_id' });
db.FileStorage.belongsTo(db.ProcessingQueue, { foreignKey: 'processing_job_id' });
```

### 3. Initialize OpenSearch on Startup

**File**: `src/app.js` or `src/index.js`

Add after database sync:
```javascript
const OpenSearchService = require('./services/OpenSearchService');

async function initializeServices() {
  try {
    // Initialize OpenSearch index
    await OpenSearchService.initializeIndex();
    console.log('✅ OpenSearch index initialized');
  } catch (error) {
    console.error('⚠️ OpenSearch initialization failed:', error.message);
    // Application can continue without OpenSearch (feature flag)
  }
}

// Call during app startup
initializeServices();
```

### 4. Start SQS Worker (Optional - For Local Testing)

**Create**: `src/workers/sqs-worker.js`

```javascript
const JobQueueService = require('../services/JobQueueService');
const logger = require('../utils/logger');

async function startWorker() {
  logger.info('Starting SQS worker...');
  
  const stopWorker = await JobQueueService.processQueue(
    async (message) => {
      try {
        const jobData = JSON.parse(message.Body);
        logger.info('Processing job:', jobData.jobId);
        
        // Handle different job types
        switch (jobData.type) {
          case 'index_file':
            // Index file in OpenSearch
            break;
          case 'generate_thumbnail':
            // Generate thumbnail with Sharp
            break;
          case 'extract_frames':
            // Extract video frames
            break;
        }
        
        // Acknowledge message
        await JobQueueService.acknowledgeMessage(message.ReceiptHandle);
      } catch (error) {
        logger.error('Job processing failed:', error);
        // Message will be retried based on DLQ config
      }
    },
    parseInt(process.env.SQS_WORKER_CONCURRENCY || '5')
  );

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('Shutting down worker...');
    stopWorker();
    process.exit(0);
  });
}

if (require.main === module) {
  startWorker().catch((error) => {
    console.error('Worker failed:', error);
    process.exit(1);
  });
}

module.exports = startWorker;
```

**Add to package.json**:
```json
{
  "scripts": {
    "start": "node src/index.js",
    "start:worker": "node src/workers/sqs-worker.js"
  }
}
```

---

## Testing the Integration

### Test 1: Health Check All Services

```bash
# Test S3 connectivity
curl -X GET http://localhost:3000/health/s3

# Test OpenSearch
curl -X GET http://localhost:3000/health/opensearch

# Test SQS
curl -X GET http://localhost:3000/health/sqs
```

### Test 2: File Upload

```bash
# Create test file
echo "test content" > test.txt

# Upload file
curl -X POST http://localhost:3000/api/files/{episodeId}/upload \
  -H "Authorization: Bearer {token}" \
  -F "file=@test.txt" \
  -F "fileType=script"

# Expected response:
# {
#   "id": "uuid",
#   "episodeId": "uuid",
#   "fileName": "test.txt",
#   "uploadStatus": "completed",
#   "jobId": "uuid"
# }
```

### Test 3: Search

```bash
# Search for episodes
curl -X GET 'http://localhost:3000/api/search?q=episode&size=10' \
  -H "Authorization: Bearer {token}"

# Get filters
curl -X GET http://localhost:3000/api/search/filters \
  -H "Authorization: Bearer {token}"
```

### Test 4: Job Management

```bash
# Create job
curl -X POST http://localhost:3000/api/jobs \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "generate_thumbnail",
    "episodeId": "uuid",
    "fileId": "uuid"
  }'

# Get job status
curl -X GET http://localhost:3000/api/jobs/{jobId} \
  -H "Authorization: Bearer {token}"

# List jobs
curl -X GET 'http://localhost:3000/api/jobs?status=pending&limit=10' \
  -H "Authorization: Bearer {token}"

# Retry job
curl -X POST http://localhost:3000/api/jobs/{jobId}/retry \
  -H "Authorization: Bearer {token}"
```

---

## File Upload Flow (Visual)

```
User Interface
    ↓
    └─→ POST /api/files/{episodeId}/upload
         ↓
    [uploadValidation middleware]
         ↓
         ├─ Check file size
         ├─ Check MIME type
         └─ Check against soft/hard limits
         ↓
    fileController.uploadFile()
         ↓
         ├─→ Create FileStorage record (status: pending)
         ├─→ S3Service.uploadFile()
         │    ↓
         │    └─→ AWS S3 (encrypted)
         │
         └─→ Update FileStorage (status: completed, s3_etag, s3_version_id)
         ↓
    JobQueueService.enqueueJob()
         ↓
         └─→ AWS SQS (job queued)
         ↓
         [Return to Client]
         {jobId, uploadStatus, indexingStatus}
         
[Async Processing - Lambda/Worker]
    SQS receives message
         ↓
    Lambda/Worker processes:
         ├─→ Download file from S3
         ├─→ Generate metadata (size, duration, format)
         ├─→ Generate thumbnail if image
         ├─→ Extract frames if video
         └─→ OpenSearchService.indexEpisode()
         ↓
    Update FileStorage (indexing_status: indexed)
```

---

## Error Handling Flows

### File Upload Fails
```
Upload fails → Update FileStorage (status: failed, upload_error: message)
           ↓
           Return 500 error to client
           ↓
           User can retry upload
```

### Job Processing Fails (First Time)
```
Job fails → SQS retries message (configurable max attempts)
        ↓
        If max retries exceeded → Message → Dead Letter Queue
        ↓
        Admin can review/retry from DLQ endpoint
```

### OpenSearch Not Available
```
If OpenSearch down → FileStorage still uploads to S3
                  ↓
                  indexing_status remains "pending"
                  ↓
                  File available for download via S3
                  ↓
                  Search not functional until OpenSearch recovers
                  ↓
                  (Optional) Use feature flag to disable search UI
```

---

## Monitoring & Logging

### Enable Debug Logging
```bash
# In .env.phase2
LOG_LEVEL=debug

# Or start with debug:
DEBUG=* npm start
```

### Check CloudWatch Logs (AWS Console)

**S3 Upload Progress**:
```
CloudWatch Logs → /aws/lambda/brd-thumbnail-generator-dev
```

**OpenSearch Health**:
```
AWS Console → OpenSearch Domains → brd-episodes-dev → Monitoring
```

**SQS Queue Status**:
```
SQS Console → brd-job-queue-dev → Monitor Queue
```

### Key Metrics to Monitor

1. **S3 Uploads**
   - Upload success rate
   - Average file size
   - Upload latency

2. **OpenSearch**
   - Cluster health (Green/Yellow/Red)
   - Indexing rate
   - Search latency

3. **SQS Queue**
   - Messages in queue
   - Messages in flight
   - DLQ message count

4. **Lambda**
   - Invocation count
   - Error rate
   - Duration
   - Memory usage

---

## Feature Flags (Optional)

Add to `src/config/featureFlags.js`:

```javascript
const flags = {
  S3_UPLOADS_ENABLED: process.env.FEATURE_S3_UPLOADS_ENABLED !== 'false',
  OPENSEARCH_ENABLED: process.env.FEATURE_OPENSEARCH_ENABLED !== 'false',
  JOB_QUEUE_ENABLED: process.env.FEATURE_JOB_QUEUE_ENABLED !== 'false',
  LAMBDA_THUMBNAILS_ENABLED: process.env.FEATURE_LAMBDA_THUMBNAILS_ENABLED !== 'false',
};

module.exports = flags;
```

### Usage in Controllers:
```javascript
const flags = require('../config/featureFlags');

async uploadFile(req, res) {
  if (!flags.S3_UPLOADS_ENABLED) {
    return res.status(503).json({error: 'File uploads temporarily disabled'});
  }
  // ... continue with upload
}
```

---

## Rollback Plan (If Needed)

### Quick Rollback (Database Only)
```bash
# Undo migration
npm run migrate:undo
# This removes FileStorage table
```

### Full Rollback (Code + Database)
```bash
# Undo migration
npm run migrate:undo

# Remove routes from app.js
# Remove service initializations
# Redeploy application
```

### During Incident
```bash
# Disable feature via flag
FEATURE_S3_UPLOADS_ENABLED=false npm start
# Application stays up, uploads rejected gracefully
```

---

## Next Steps After Integration

1. ✅ **Code Review** - Review all 13 new files
2. ✅ **Integration Testing** - Test file upload → search → job flow
3. ✅ **Load Testing** - Test with 5-10GB files
4. ✅ **Security Review** - Validate IAM policies, encryption
5. ✅ **Performance Testing** - Measure upload/search latency
6. ✅ **Documentation** - Update API docs, user guides
7. ✅ **Deployment** - Deploy to staging, then production
8. ✅ **Monitoring** - Set up CloudWatch dashboards, alerts

---

## Common Issues & Solutions

### Issue: "ENOENT: no such file or directory, open '.env.phase2'"
**Solution**: Create .env.phase2 from template:
```bash
cp .env.phase2.example .env.phase2
```

### Issue: "AccessDenied: User is not authorized to perform: s3:PutObject"
**Solution**: Check AWS credentials and IAM policy:
```bash
aws sts get-caller-identity
```

### Issue: "OpenSearch cluster is in red status"
**Solution**: Check CloudWatch logs and increase storage/compute

### Issue: "SQS messages not being processed"
**Solution**: Verify Lambda has SQS event source mapping and correct IAM role

### Issue: "File upload succeeds but doesn't appear in search"
**Solution**: Check indexing_status is 'indexed', verify OpenSearch initialization

---

## Performance Optimization Tips

1. **S3 Uploads**
   - Use multipart upload for files >100MB
   - Enable transfer acceleration
   - Use S3 Intelligent-Tiering

2. **OpenSearch**
   - Enable auto-refresh optimization
   - Use bulk indexing for batch operations
   - Configure appropriate shard count

3. **Job Queue**
   - Tune SQS visibility timeout
   - Adjust worker concurrency based on CPU
   - Enable long-polling for efficiency

4. **Lambda**
   - Increase memory allocation for faster execution
   - Use EBS volumes for temporary storage
   - Cache dependencies in Lambda layers

