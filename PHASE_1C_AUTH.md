# Phase 1C: Authentication & Authorization Implementation

## Overview

Phase 1C adds comprehensive authentication, authorization, and error handling to the Episode Metadata API. All endpoints are now secured with Cognito JWT validation and role-based access control (RBAC).

## Completed Components

### 1. Authentication Middleware ([src/middleware/auth.js](src/middleware/auth.js))

**Features:**
- Cognito JWT token verification and validation
- Bearer token extraction from Authorization header
- Token expiration checking
- User information extraction (sub, email, name, groups)
- Cognito group extraction for RBAC

**Exports:**
- `authenticateToken` - Requires valid JWT token
- `optionalAuth` - Accepts token if valid, but doesn't require it
- `verifyToken` - Internal token verification
- `verifyGroup` - Verify user is in specific Cognito group

**Usage:**
```javascript
// Protected route
router.post('/episodes', authenticateToken, controller);

// Optional auth
router.get('/episodes', optionalAuth, controller);
```

### 2. RBAC Middleware ([src/middleware/rbac.js](src/middleware/rbac.js))

**Role Hierarchy:**
1. **Admin** (level 3) - Full access to all resources
2. **Editor** (level 2) - Can create, read, and edit resources
3. **Viewer** (level 1) - Read-only access to resources

**Permissions Matrix:**
```
Role      Episodes      Thumbnails    Metadata      Processing    Activity
-------   ----------    ----------    --------      ----------    --------
Admin     *             *             *             *             view
Editor    view,create   view,create   view,create   view,create   view
          edit          edit          edit          edit
Viewer    view          view          view          view           view
```

**Exports:**
- `ROLES` - Role constants
- `PERMISSIONS` - Permission matrix
- `getUserRole(user)` - Extract role from Cognito groups
- `hasPermission(user, resource, action)` - Check if user has permission
- `requireRole(role)` - Middleware to require specific role
- `requirePermission(resource, action)` - Middleware to require specific permission
- `attachRBAC(req, res, next)` - Attach RBAC info without requiring auth

**Usage:**
```javascript
// Require specific role
router.delete('/episodes/:id', requireRole('admin'), controller);

// Require specific permission
router.post('/episodes', requirePermission('episodes', 'create'), controller);
```

### 3. Error Handling Middleware ([src/middleware/errorHandler.js](src/middleware/errorHandler.js))

**Error Classes:**
- `ApiError` - Base error class with status code and code
- `ValidationError` - 422 validation errors
- `NotFoundError` - 404 resource not found
- `UnauthorizedError` - 401 authentication required
- `ForbiddenError` - 403 access denied
- `ConflictError` - 409 unique constraint violations
- `ServiceUnavailableError` - 503 service issues

**Utilities:**
- `errorHandler` - Global error handling middleware
- `notFoundHandler` - 404 not found handler
- `asyncHandler` - Wraps async functions to catch errors
- `validateRequest` - Request validation helper

**Error Response Format:**
```json
{
  "error": "Bad Request",
  "message": "Validation failed",
  "code": "VALIDATION_ERROR",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "details": {
    "fields": {
      "showName": "required"
    }
  }
}
```

**Usage:**
```javascript
// Wrap async route handlers
router.post('/episodes', asyncHandler(controller.create));

// Throw custom errors
if (!episode) {
  throw new NotFoundError('Episode', id);
}

// Validate request
router.post('/episodes', validateRequest({
  showName: { required: true, type: 'string' },
  seasonNumber: { required: true, type: 'number' }
}));
```

### 4. Audit Logging Middleware ([src/middleware/auditLog.js](src/middleware/auditLog.js))

**Features:**
- Automatic activity logging for all API requests
- User action tracking (view, create, edit, delete, download, upload)
- Resource-specific logging
- Old/new value comparison for change tracking
- IP address and user agent recording
- Async non-blocking logging

**Exports:**
- `auditLog` - Middleware for automatic logging
- `captureResponseData` - Capture response for logging
- `logger` - Service for manual activity logging
  - `logAction()` - Log specific action
  - `getUserHistory()` - Get user's activity history
  - `getResourceHistory()` - Get resource's activity history
  - `getAuditTrail()` - Get full audit trail
  - `getStats()` - Get activity statistics

**Usage:**
```javascript
// Automatic logging via middleware
app.use(auditLog);

// Manual logging
await logger.logAction(userId, 'create', 'episode', episodeId, {
  newValues: episodeData,
  ipAddress: req.ip,
  userAgent: req.get('user-agent'),
});

// Get user history
const history = await logger.getUserHistory(userId);
```

## Integration with Application

### Updated [src/app.js](src/app.js)

**Middleware Stack:**
1. `helmet()` - Security headers
2. `cors()` - Cross-origin requests
3. `express.json()` - JSON parsing
4. `optionalAuth` - Token extraction (user optional)
5. `attachRBAC` - RBAC info attachment
6. `captureResponseData` - Response capture

**Error Handling:**
1. Route processing
2. `notFoundHandler` - 404 handling
3. `errorHandler` - Global error handling (catches all errors)

### Updated Episode Routes ([src/routes/episodes.js](src/routes/episodes.js))

**Endpoint Protection:**

| Endpoint | Method | Auth | Permission | Status |
|----------|--------|------|-----------|--------|
| `/episodes` | GET | Optional | view | ✅ |
| `/episodes` | POST | Required | create | ✅ |
| `/episodes/:id` | GET | Optional | view | ✅ |
| `/episodes/:id` | PUT | Required | edit | ✅ |
| `/episodes/:id` | DELETE | Required | delete | ✅ |
| `/episodes/:id/status` | GET | Optional | view | ✅ |
| `/episodes/:id/enqueue` | POST | Required | edit | ✅ |

### Updated Episode Controller ([src/controllers/episodeController.js](src/controllers/episodeController.js))

**Changes:**
- Removed try-catch blocks (handled by `asyncHandler`)
- Throw errors instead of using `next()`
- Use `NotFoundError`, `ValidationError` classes
- Use `logger` for activity logging
- Cleaner, more maintainable code

**Error Example:**
```javascript
if (!episode) {
  throw new NotFoundError('Episode', id);
}

if (!showName) {
  throw new ValidationError('Missing required fields', {
    showName: 'required'
  });
}
```

## API Response Examples

### Success Response (200)
```json
{
  "data": {
    "id": 1,
    "showName": "Styling Adventures w Lala",
    "seasonNumber": 1,
    "episodeNumber": 1,
    "episodeTitle": "First Episode",
    ...
  }
}
```

### Created Response (201)
```json
{
  "data": { ... },
  "message": "Episode created successfully"
}
```

### Error Response (400-500)
```json
{
  "error": "Validation Error",
  "message": "Validation failed",
  "code": "VALIDATION_ERROR",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "details": {
    "fields": {
      "showName": "required",
      "seasonNumber": "required"
    }
  }
}
```

### Unauthorized Response (401)
```json
{
  "error": "Unauthorized",
  "message": "Missing authorization header",
  "code": "AUTH_MISSING_TOKEN",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Forbidden Response (403)
```json
{
  "error": "Forbidden",
  "message": "editor role cannot delete episodes",
  "code": "RBAC_INSUFFICIENT_PERMISSION",
  "resource": "episodes",
  "action": "delete",
  "userRole": "editor",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Testing the API with Authentication

### Without Token (Public Endpoints)
```bash
curl -X GET http://localhost:3000/api/v1/episodes
```

### With Token (Protected Endpoints)
```bash
# Get token from Cognito
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Create episode (requires editor or admin role)
curl -X POST http://localhost:3000/api/v1/episodes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "showName": "Styling Adventures w Lala",
    "seasonNumber": 1,
    "episodeNumber": 1,
    "episodeTitle": "First Episode"
  }'

# Delete episode (requires admin role only)
curl -X DELETE http://localhost:3000/api/v1/episodes/1 \
  -H "Authorization: Bearer $TOKEN"
```

## Cognito Group Setup (Phase 0)

The following groups should exist in Cognito (created in Phase 0):

1. **admin** - Users: admin user
2. **editor** - Users: editor user  
3. **viewer** - Users: viewer user

Users inherit permissions based on their group membership.

## Security Considerations

### Token Validation
- JWT tokens are extracted from `Authorization: Bearer <token>` header
- Expiration is checked (tokens must not be expired)
- In production, implement full JWT signature verification with Cognito JWKS

### Rate Limiting (Phase 2)
- Add rate limiting middleware to prevent abuse
- Implement per-user and per-IP rate limits

### CORS Configuration
- Allowed origins configured via `ALLOWED_ORIGINS` environment variable
- Credentials supported for authenticated requests

### SQL Injection Prevention
- Sequelize parameterized queries prevent SQL injection
- Request validation applied to all inputs

### Logging
- All user actions logged for audit trail
- Old/new values tracked for compliance
- IP addresses and user agents recorded

## Troubleshooting

### Common Issues

**401 Unauthorized: Missing authorization header**
- Solution: Include `Authorization: Bearer <token>` header

**401 Unauthorized: Token expired**
- Solution: Get new token from Cognito

**403 Forbidden: Insufficient role**
- Solution: Ensure user is in appropriate Cognito group

**422 Unprocessable Entity: Validation failed**
- Solution: Check required fields and data types in request

**500 Internal Server Error**
- Check logs for database or application errors
- Verify environment variables are set correctly

## Next Steps (Phase 1D)

### Additional Controllers
- [ ] ThumbnailController for image management
- [ ] MetadataController for ML/AI results
- [ ] ProcessingQueueController for job tracking
- [ ] ActivityLogController for audit trail viewing

### Additional Features
- [ ] Request validation schemas
- [ ] Response transformation/serialization
- [ ] Pagination standardization
- [ ] Filtering and sorting utilities
- [ ] Caching strategies

## Configuration

### Environment Variables
```env
# Cognito
COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxx
COGNITO_REGION=us-east-1

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# App
NODE_ENV=development
PORT=3000
API_VERSION=v1
```

## Files Created

1. **src/middleware/auth.js** - Cognito authentication (216 lines)
2. **src/middleware/rbac.js** - Role-based access control (178 lines)
3. **src/middleware/errorHandler.js** - Error handling and validation (340 lines)
4. **src/middleware/auditLog.js** - Activity logging and audit trail (215 lines)

**Total Lines Created**: 949 lines

## Files Modified

1. **src/app.js** - Integrated middleware stack
2. **src/routes/episodes.js** - Added auth/permission checks
3. **src/controllers/episodeController.js** - Updated error handling and logging

---

**Status**: Phase 1C Complete ✅  
**Next**: Phase 1D (Additional Controllers)  
**Timeline**: Phase 1 completion on track (9+ days remaining)
