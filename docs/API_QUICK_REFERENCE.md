# API Quick Reference Guide

## Base URL
```
http://localhost:3000/api/v1
```

## Authentication
```
Authorization: Bearer <JWT_TOKEN>
```

---

## Episodes

### List Episodes
```
GET /episodes
Query: page=1, limit=20, status=pending, season=1
Auth: Optional
```

### Get Episode
```
GET /episodes/:id
Auth: Optional
```

### Create Episode
```
POST /episodes
Auth: Required (editor+)
Body: {
  "showName": "Show Name",
  "seasonNumber": 1,
  "episodeNumber": 1,
  "episodeTitle": "Title",
  "airDate": "2024-01-01T00:00:00Z",
  "plotSummary": "...",
  "director": "...",
  "writer": "...",
  "durationMinutes": 30,
  "rating": 8.5,
  "genre": "Drama"
}
```

### Update Episode
```
PUT /episodes/:id
Auth: Required (editor+)
Body: {
  "episodeTitle": "New Title",
  "processingStatus": "completed"
}
```

### Delete Episode
```
DELETE /episodes/:id
Auth: Required (admin)
Query: hard=false (soft delete by default)
```

### Get Episode Status
```
GET /episodes/:id/status
Auth: Optional
```

### Enqueue Episode for Processing
```
POST /episodes/:id/enqueue
Auth: Required (editor+)
Body: {
  "jobTypes": ["thumbnail_generation", "metadata_extraction"],
  "jobConfig": { "quality": "high" }
}
```

---

## Thumbnails

### List Thumbnails
```
GET /thumbnails
Query: page=1, limit=20, episodeId=1, type=primary
Auth: Optional
```

### Get Thumbnail
```
GET /thumbnails/:id
Auth: Optional
```

### Create Thumbnail
```
POST /thumbnails
Auth: Required (editor+)
Body: {
  "episodeId": 1,
  "s3Bucket": "episodes-thumbnails-dev",
  "s3Key": "episode-1-primary.jpg",
  "fileSizeBytes": 102400,
  "mimeType": "image/jpeg",
  "widthPixels": 1280,
  "heightPixels": 720,
  "thumbnailType": "primary",
  "qualityRating": "high"
}
```

### Update Thumbnail
```
PUT /thumbnails/:id
Auth: Required (editor+)
Body: {
  "qualityRating": "excellent",
  "widthPixels": 1920
}
```

### Delete Thumbnail
```
DELETE /thumbnails/:id
Auth: Required (admin)
```

### Get Thumbnail URL
```
GET /thumbnails/:id/url
Query: cdn=false (use false for S3, true for CloudFront)
Auth: Optional
```

### Prepare Download
```
GET /thumbnails/:id/download
Auth: Optional
```

### Rate Quality
```
POST /thumbnails/:id/rate-quality
Auth: Required (editor+)
Body: {
  "rating": "high"  // low, medium, high, excellent
}
```

### Get Episode Thumbnails
```
GET /thumbnails/episode/:episodeId
Auth: Optional
```

### Get Primary Thumbnail
```
GET /thumbnails/episode/:episodeId/primary
Auth: Optional
```

---

## Metadata

### List Metadata
```
GET /metadata
Query: page=1, limit=20, episodeId=1
Auth: Optional
```

### Get Metadata
```
GET /metadata/:id
Auth: Optional
```

### Get Metadata Summary
```
GET /metadata/:id/summary
Auth: Optional
Response: Lightweight version without large JSON fields
```

### Create/Update Metadata
```
POST /metadata
Auth: Required (editor+)
Body: {
  "episodeId": 1,
  "extractedText": "...",
  "scenesDetected": [...],
  "sentimentAnalysis": {...},
  "visualObjects": {...},
  "transcription": "...",
  "tags": ["tag1", "tag2"],
  "categories": ["category1"],
  "processingDurationSeconds": 120
}
```

### Update Metadata
```
PUT /metadata/:id
Auth: Required (editor+)
Body: {
  "tags": ["tag1", "tag2"],
  "categories": ["action", "drama"]
}
```

### Delete Metadata
```
DELETE /metadata/:id
Auth: Required (admin)
```

### Get Episode Metadata
```
GET /metadata/episode/:episodeId
Auth: Optional
```

### Add Tags
```
POST /metadata/:id/add-tags
Auth: Required (editor+)
Body: {
  "tags": ["tag1", "tag2", "tag3"]
}
```

### Set Detected Scenes
```
POST /metadata/:id/set-scenes
Auth: Required (editor+)
Body: {
  "scenes": [
    { "timestamp": 10, "description": "Scene 1" },
    { "timestamp": 45, "description": "Scene 2" }
  ],
  "duration": 300
}
```

---

## Processing Queue

### List Jobs
```
GET /processing-queue
Query: page=1, limit=20, status=pending, jobType=thumbnail_generation
Auth: Optional
Response includes: summary with status breakdown
```

### Get Job
```
GET /processing-queue/:id
Auth: Optional
```

### Create Job
```
POST /processing-queue
Auth: Required (editor+)
Body: {
  "episodeId": 1,
  "jobType": "thumbnail_generation",  // or metadata_extraction, transcription
  "jobConfig": {}
}
```

### Update Job Status
```
PUT /processing-queue/:id
Auth: Required (editor+)
Body: {
  "status": "processing",  // pending, processing, completed, failed
  "errorMessage": null
}
```

### Retry Job
```
POST /processing-queue/:id/retry
Auth: Required (editor+)
Max retries: 3 by default
```

### Cancel Job
```
DELETE /processing-queue/:id
Auth: Required (admin)
Only cancels pending jobs
```

### Get Pending Jobs
```
GET /processing-queue/pending
Auth: Optional
```

### Get Failed Jobs
```
GET /processing-queue/failed
Auth: Optional
```

### Get Retryable Jobs
```
GET /processing-queue/retryable
Auth: Optional
```

### Get Episode Jobs
```
GET /processing-queue/episode/:episodeId
Auth: Optional
Response includes: summary with status and type breakdown
```

### Get Statistics
```
GET /processing-queue/stats
Auth: Optional
```

---

## System

### Health Check
```
GET /health
Auth: Optional
Response includes: database connection status
```

### API Info
```
GET /api/v1
Auth: Optional
Response includes: all available endpoints
```

---

## Error Codes

### Authentication Errors
```
401 AUTH_MISSING_TOKEN
401 AUTH_INVALID_FORMAT
401 AUTH_INVALID_TOKEN
401 AUTH_ERROR
```

### Authorization Errors
```
403 RBAC_INSUFFICIENT_ROLE
403 RBAC_INSUFFICIENT_PERMISSION
403 AUTH_GROUP_REQUIRED
```

### Validation Errors
```
422 VALIDATION_ERROR (with field-level details)
400 JOB_MAX_RETRIES_EXCEEDED
400 JOB_CANNOT_CANCEL
```

### Resource Errors
```
404 NOT_FOUND
409 CONFLICT (unique constraint)
```

### Service Errors
```
500 INTERNAL_ERROR
503 SERVICE_UNAVAILABLE
```

---

## Response Format

### Success (200, 201)
```json
{
  "data": { ... },
  "message": "Optional success message",
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

### Error (4xx, 5xx)
```json
{
  "error": "Error Type",
  "message": "Human-readable message",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "details": {
    "fields": { "fieldName": "error reason" }
  }
}
```

---

## Pagination

All list endpoints support pagination:
```
Query Parameters:
  page: 1-based page number (default: 1)
  limit: items per page (default: 20)

Response includes pagination info:
  pagination.page: current page
  pagination.limit: items per page
  pagination.total: total items
  pagination.pages: total pages
```

---

## Filtering

### Episodes Filtering
```
GET /episodes?status=pending&season=1
```

### Thumbnails Filtering
```
GET /thumbnails?episodeId=1&type=primary
```

### Metadata Filtering
```
GET /metadata?episodeId=1
```

### Jobs Filtering
```
GET /processing-queue?status=pending&jobType=thumbnail_generation
```

---

## Common Patterns

### Create and Enqueue (Two Steps)
```
# 1. Create episode
POST /episodes
Body: { showName, seasonNumber, episodeNumber, episodeTitle }

# 2. Enqueue for processing
POST /episodes/:id/enqueue
Body: { jobTypes: ["thumbnail_generation"] }
```

### Get Full Episode Data
```
GET /episodes/:id
Returns: episode with metadata, thumbnails, processing jobs
```

### Track Processing Progress
```
# Initial
GET /episodes/:id/status  → status: "processing"

# Check jobs
GET /processing-queue/episode/:id → see job details

# Job complete
GET /episodes/:id/status  → status: "completed"
GET /thumbnails/episode/:id → see generated thumbnails
GET /metadata/episode/:id → see extracted metadata
```

### Manage Tags
```
# Get current metadata
GET /metadata/:id

# Add new tags
POST /metadata/:id/add-tags
Body: { tags: ["new", "tags"] }

# Tags are merged (duplicates removed)
```

---

## Rate Limits (Phase 2)
Currently no rate limiting. To be added in Phase 2.

## Caching (Phase 2)
Currently no caching. Redis caching planned for Phase 2.

## WebSockets (Phase 2)
Real-time job status updates planned for Phase 2.

---

## Support

For issues:
1. Check `/health` endpoint for service status
2. Review error code and details in response
3. Check logs for detailed error information
4. Verify authentication token (not expired)
5. Confirm user has required role/permission

---

**Last Updated**: Phase 1 Complete
**API Version**: v1
**Status**: Production Ready (pending testing)
