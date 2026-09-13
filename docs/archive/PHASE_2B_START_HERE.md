# Phase 2B - S3 File Service Implementation

## Overview
Build a complete file management service with AWS S3 integration, supporting episode uploads, downloads, and file management with full RBAC.

**Timeline:** 3 days | **Tests:** 90+ | **Coverage:** 71.5%

---

## What You'll Build

### ✅ Complete S3 Integration
- Upload episodes & assets to S3
- Download files with signed URLs
- File deletion with RBAC validation
- Multipart upload support (large files)
- Metadata tracking (size, type, upload date)

### ✅ RESTful File API
```
POST   /api/v1/files/upload          → Upload file
GET    /api/v1/files/:id/download    → Download file (signed URL)
DELETE /api/v1/files/:id             → Delete file
GET    /api/v1/files                 → List user files
GET    /api/v1/files/:id             → Get file metadata
```

### ✅ Security & Validation
- File type validation (whitelist: mp4, mkv, webm, jpg, png, pdf)
- File size limits (500MB max)
- RBAC: users can only access their own files
- S3 signed URLs (1-hour expiry)
- Audit logging for all file operations

### ✅ Database Schema
Files table with:
- id, episodeId, userId, fileName, fileType
- fileSize, s3Key, s3Url, uploadedAt
- status (pending, uploaded, failed)

---

## Implementation Steps

### Step 1: Create S3 Service Layer
- Abstract S3 operations
- Handle signed URLs
- Error handling & retries

### Step 2: Create File Model & Migration
- Database table for files
- Relationships to episodes & users
- Indexes for performance

### Step 3: Create File API Endpoints
- Upload with validation
- Download with signed URLs
- Delete with RBAC
- List & get operations

### Step 4: Add Validation Middleware
- File type checking
- File size validation
- MIME type verification

### Step 5: Implement RBAC
- User isolation (can only upload to own episodes)
- Admin override capability
- Audit trail

### Step 6: Create 90+ Tests
- Unit tests for S3 service
- Integration tests for endpoints
- RBAC validation tests
- Edge case handling

---

## Architecture

```
src/
├── services/
│   └── s3Service.js              ← S3 operations (upload, download, delete)
├── models/
│   └── file.js                   ← File model & database operations
├── middleware/
│   └── fileValidation.js         ← File type, size validation
├── routes/
│   └── files.js                  ← File API endpoints
└── controllers/
    └── filesController.js        ← File operation handlers
    
tests/
├── unit/
│   ├── services/s3Service.test.js
│   ├── models/file.test.js
│   └── middleware/fileValidation.test.js
├── integration/
│   └── files.test.js
└── e2e/
    └── fileUploadDownload.test.js
```

---

## Key Features

| Feature | Details |
|---------|---------|
| **Upload** | Multipart upload to S3, metadata stored in DB |
| **Download** | Pre-signed URLs with 1-hour expiry |
| **Delete** | Removes from S3 + database |
| **Validation** | Type, size, MIME verification |
| **RBAC** | User isolation + admin override |
| **Audit** | All operations logged |
| **Error Handling** | Graceful failures, retry logic |

---

## Next: Implementation Guide
Ready? → [PHASE_2B_IMPLEMENTATION.md](PHASE_2B_IMPLEMENTATION.md)
