# Phase 2D: Job Queue Service - Implementation Guide

## Overview

Phase 2D implements an asynchronous job queue system for long-running operations (thumbnail generation, video processing, bulk uploads, etc.) using AWS SQS and Lambda.

**Timeline**: 3-4 days  
**Target Coverage**: 74%+  
**Expected Tests**: 100+ (job models, queue processor, lambda orchestrator, error recovery)

---

## Architecture

```
User Request (e.g., Upload Video)
    ↓
Create Job → SQS Queue → Lambda Processor → S3/Database Update
    ↓
Store Job Record ← Database ← Job Status Update
    ↓
Return Job ID to Client
```

## Components

### 1. Job Model (`src/models/job.js`)
**Purpose**: Database abstraction for job records  
**Responsibility**: CRUD operations, status tracking, retry logic

```javascript
// Job statuses
const JOB_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

// Core methods
Job.create(jobData) → Creates job record with status=pending
Job.getById(id) → Retrieve job with full details
Job.getByUserId(userId) → List user's jobs
Job.updateStatus(id, status, results) → Update job status
Job.retry(id, maxRetries) → Mark job for retry
Job.cancel(id) → Cancel pending job
```

### 2. Queue Service (`src/services/QueueService.js`)
**Purpose**: SQS integration for job queueing  
**Responsibility**: Send/receive messages, handle retries, manage DLQ

```javascript
QueueService.sendJob(jobData) → Send job to SQS queue
QueueService.processJob(jobData) → Handle job execution
QueueService.handleError(jobId, error) → Move to DLQ or retry
QueueService.getQueueStats() → Monitor queue health
```

### 3. Job Processor (`src/services/JobProcessor.js`)
**Purpose**: Worker process for job handling  
**Responsibility**: Poll queue, execute handlers, update DB

```javascript
JobProcessor.registerHandler(jobType, handler) → Register job type
JobProcessor.start() → Start polling SQS
JobProcessor.processMessage(message) → Execute job
JobProcessor.handleSuccess(jobId, result) → Mark complete
JobProcessor.handleFailure(jobId, error) → Handle error
```

### 4. Lambda Orchestrator (`src/services/LambdaOrchestrator.js`)
**Purpose**: Trigger Lambda functions for processing  
**Responsibility**: Invoke Lambda, track execution, collect results

```javascript
LambdaOrchestrator.invoke(functionName, payload) → Call Lambda
LambdaOrchestrator.waitForCompletion(jobId) → Poll for completion
LambdaOrchestrator.getExecutionLog(jobId) → Retrieve logs
```

### 5. Error Recovery (`src/services/ErrorRecovery.js`)
**Purpose**: Automatic retry and fallback strategies  
**Responsibility**: Exponential backoff, DLQ handling, alerts

```javascript
ErrorRecovery.exponentialBackoff(attempt, baseDelay) → Calculate retry delay
ErrorRecovery.moveToDLQ(jobId, reason) → Send to dead letter queue
ErrorRecovery.sendAlert(jobId, error) → Notify admins
ErrorRecovery.getFailureRate() → Monitor error trends
```

### 6. Job Controller (`src/controllers/jobController.js`)
**Purpose**: HTTP endpoints for job management  
**Responsibility**: RBAC enforcement, response formatting

```javascript
POST   /api/v1/jobs                  Create job (enqueue)
GET    /api/v1/jobs                  List user jobs
GET    /api/v1/jobs/:id              Get job status
PUT    /api/v1/jobs/:id/cancel       Cancel job
GET    /api/v1/jobs/:id/logs         Get execution logs
GET    /api/v1/jobs/stats/overview   Admin dashboard
```

---

## Database Schema

### Jobs Table
```sql
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  job_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  payload JSONB NOT NULL,
  results JSONB,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  next_retry_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_jobs_user_id_status ON jobs(user_id, status);
CREATE INDEX idx_jobs_status_created ON jobs(status, created_at);
CREATE INDEX idx_jobs_next_retry ON jobs(next_retry_at) WHERE status = 'failed';
CREATE INDEX idx_jobs_type ON jobs(job_type);
```

### Queue Messages Table
```sql
CREATE TABLE queue_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id),
  queue_url VARCHAR(500),
  message_id VARCHAR(255),
  receipt_handle VARCHAR(255),
  attempt INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Index for cleanup
CREATE INDEX idx_queue_messages_processed ON queue_messages(processed_at);
```

### Job Metrics Table
```sql
CREATE TABLE job_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id),
  metric_type VARCHAR(50),
  metric_value FLOAT,
  recorded_at TIMESTAMP DEFAULT NOW()
);

-- Index for analytics
CREATE INDEX idx_metrics_type_time ON job_metrics(metric_type, recorded_at);
```

---

## Implementation Phases

### Phase 2D-1: Core Job System (Days 1-2)
- [ ] Create Job model with all CRUD operations
- [ ] Implement Job model tests (16 tests)
- [ ] Create database migration for jobs tables
- [ ] Verify schema with integration tests (8 tests)

### Phase 2D-2: Queue Integration (Days 2-3)
- [ ] Implement QueueService with SQS integration
- [ ] Create QueueService unit tests (20 tests)
- [ ] Implement JobProcessor with message polling
- [ ] Create JobProcessor unit tests (18 tests)
- [ ] Integration tests for queue flow (12 tests)

### Phase 2D-3: Job Handler & Lambda (Days 3-4)
- [ ] Implement Lambda orchestrator
- [ ] Create handler registry pattern
- [ ] Implement 3+ job handlers (thumbnail, export, import)
- [ ] Lambda integration tests (15 tests)
- [ ] Error recovery tests (12 tests)

### Phase 2D-4: API & Monitoring (Days 4-5)
- [ ] Create Job controller with 6 endpoints
- [ ] Implement job dashboard endpoint
- [ ] Create integration tests for all endpoints (18 tests)
- [ ] Implement metrics collection
- [ ] Create monitoring/dashboard (optional)

---

## API Specifications

### Create Job
```http
POST /api/v1/jobs
Authorization: Bearer {token}
Content-Type: application/json

{
  "jobType": "thumbnail-generation",
  "payload": {
    "episodeId": "uuid",
    "videoUrl": "s3://bucket/video.mp4"
  }
}

Response 202 Accepted:
{
  "data": {
    "id": "job-uuid",
    "status": "pending",
    "jobType": "thumbnail-generation",
    "createdAt": "2026-01-07T00:00:00Z"
  }
}
```

### Get Job Status
```http
GET /api/v1/jobs/{id}
Authorization: Bearer {token}

Response 200 OK:
{
  "data": {
    "id": "job-uuid",
    "status": "processing",
    "progress": 45,
    "jobType": "thumbnail-generation",
    "createdAt": "2026-01-07T00:00:00Z",
    "startedAt": "2026-01-07T00:01:00Z",
    "estimatedCompletion": "2026-01-07T00:05:00Z"
  }
}
```

### List Jobs
```http
GET /api/v1/jobs?status=pending&limit=20&page=1
Authorization: Bearer {token}

Response 200 OK:
{
  "data": [
    { "id": "...", "status": "pending", "jobType": "..." },
    { "id": "...", "status": "processing", "jobType": "..." }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 150 }
}
```

### Cancel Job
```http
PUT /api/v1/jobs/{id}/cancel
Authorization: Bearer {token}

Response 200 OK:
{
  "data": {
    "id": "job-uuid",
    "status": "cancelled"
  }
}
```

### Get Job Logs
```http
GET /api/v1/jobs/{id}/logs
Authorization: Bearer {token}

Response 200 OK:
{
  "data": {
    "logs": [
      { "level": "info", "message": "Job started", "timestamp": "..." },
      { "level": "info", "message": "Processing", "timestamp": "..." }
    ],
    "errorMessage": null
  }
}
```

### Admin Dashboard
```http
GET /api/v1/jobs/stats/overview
Authorization: Bearer {admin-token}

Response 200 OK:
{
  "data": {
    "totalJobs": 1250,
    "byStatus": {
      "pending": 15,
      "processing": 8,
      "completed": 1200,
      "failed": 27
    },
    "averageProcessingTime": 45,
    "failureRate": 2.1,
    "queueDepth": 15
  }
}
```

---

## Test Coverage Plan

**Unit Tests (50+)**
- Job model: 16 tests (CRUD, status, retries)
- QueueService: 20 tests (send, receive, DLQ)
- JobProcessor: 18 tests (polling, handler execution)
- ErrorRecovery: 12 tests (backoff, fallback, alerts)

**Integration Tests (40+)**
- Job flow: 12 tests (create → queue → process)
- Lambda integration: 15 tests (invoke, wait, logs)
- Error scenarios: 13 tests (timeouts, failures, retries)

**Performance Tests (10+)**
- Queue throughput: 5 tests
- Lambda latency: 3 tests
- Error recovery: 2 tests

**Total: 100+ tests**

---

## Success Criteria

✅ Job creation and queueing works  
✅ SQS messages processed successfully  
✅ Lambda functions invoked and tracked  
✅ Automatic retry on failures  
✅ Dead letter queue for persistent failures  
✅ Job status accurately reflects state  
✅ Admin can view queue statistics  
✅ Users can cancel jobs  
✅ Error recovery activates within 30 seconds  
✅ 100+ tests, 74%+ coverage  

---

## Configuration

### SQS Queue Setup
```javascript
// In AWS or LocalStack:
// Queue: episode-jobs-queue
// DLQ: episode-jobs-dlq
// VisibilityTimeout: 300 (5 minutes)
// MessageRetentionPeriod: 86400 (1 day)
```

### Lambda Configuration
```javascript
// Functions to create/update:
// - process-thumbnails
// - process-exports
// - process-bulk-imports
// - cleanup-jobs
// Timeout: 900 seconds (15 minutes)
// Memory: 1024 MB
```

### Environment Variables
```env
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/...
SQS_DLQ_URL=https://sqs.us-east-1.amazonaws.com/...
JOB_PROCESSOR_INTERVAL=5000
MAX_JOB_RETRIES=3
INITIAL_RETRY_DELAY=5000
```

---

## Known Dependencies

- **Database**: PostgreSQL with jobs tables (migration needed)
- **AWS SQS**: Queue and DLQ must be created
- **AWS Lambda**: Functions must be deployed
- **Logger**: Uses existing logger service
- **Error Handler**: Uses existing error handling middleware
- **RBAC**: Uses existing role checks

---

## Next Steps After Phase 2D

1. **Phase 3A**: Real-time notifications (WebSocket job updates)
2. **Phase 3B**: Advanced job scheduling (cron jobs)
3. **Phase 3C**: Job workflow automation (multi-step pipelines)
4. **Phase 3D**: Analytics and performance dashboards

---

## Resources

- AWS SQS Documentation: https://docs.aws.amazon.com/sqs/
- Lambda Guide: https://docs.aws.amazon.com/lambda/
- Node.js Queue Patterns: https://medium.com/...
- Job Queue Best Practices: https://...

---

**Status**: Ready for Phase 2D implementation  
**Started**: January 7, 2026  
**Expected Completion**: January 10, 2026
