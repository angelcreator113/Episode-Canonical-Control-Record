# API Documentation

## Episode Metadata API - Complete Reference

**Version:** v1  
**Base URL:** `/api/v1`  
**Protocol:** HTTP/HTTPS  
**Environment:** Development | Staging | Production

---

## Table of Contents

1. [Authentication](#authentication)
2. [Episodes](#episodes)
3. [Assets](#assets)
4. [Thumbnails](#thumbnails)
5. [Metadata](#metadata)
6. [Processing Queue](#processing-queue)
7. [Error Handling](#error-handling)
8. [Rate Limiting](#rate-limiting)

---

## Authentication

### POST /auth/login

Authenticates a user and returns JWT tokens.

**Request**
```bash
curl -X POST http://localhost:3002/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

**Request Body**
| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| email | string | Yes | Valid email format, max 254 chars |
| password | string | Yes | Min 6 chars, max 512 chars |
| groups | array | No | List of group names |
| role | string | No | USER, ADMIN, EDITOR |

**Response 200 OK**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "Bearer",
    "expiresIn": 3600000,
    "user": {
      "email": "user@example.com",
      "name": "John Doe",
      "groups": ["USER", "EDITOR"],
      "role": "USER"
    }
  }
}
```

**Response 400 Bad Request**
```json
{
  "error": "Validation failed",
  "details": [
    "Email format is invalid",
    "Password must be at least 6 characters"
  ]
}
```

**Response 429 Too Many Requests**
```json
{
  "error": "Too many login attempts, please try again later"
}
```

---

### POST /auth/refresh

Refresh an expired access token using a refresh token.

**Request**
```bash
curl -X POST http://localhost:3002/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

**Response 200 OK**
```json
{
  "success": true,
  "message": "Token refreshed",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "Bearer",
    "expiresIn": 3600000
  }
}
```

---

### POST /auth/logout

Revoke the current access token.

**Request**
```bash
curl -X POST http://localhost:3002/api/v1/auth/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response 200 OK**
```json
{
  "success": true,
  "message": "Logout successful",
  "data": {
    "loggedOut": true
  }
}
```

**Response 401 Unauthorized**
```json
{
  "error": "Unauthorized",
  "message": "Missing authorization header"
}
```

---

### GET /auth/me

Get authenticated user information.

**Request**
```bash
curl http://localhost:3002/api/v1/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response 200 OK**
```json
{
  "success": true,
  "message": "User information retrieved",
  "data": {
    "user": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "email": "user@example.com",
      "name": "John Doe",
      "groups": ["USER", "EDITOR"],
      "role": "USER",
      "tokenUse": "access",
      "issuedAt": 1704384000,
      "expiresAt": 1704387600
    }
  }
}
```

---

### POST /auth/validate

Validate a JWT token.

**Request**
```bash
curl -X POST http://localhost:3002/api/v1/auth/validate \
  -H "Content-Type: application/json" \
  -d '{
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

**Response 200 OK**
```json
{
  "success": true,
  "message": "Token is valid",
  "data": {
    "valid": true,
    "expiresAt": "2026-01-05T20:00:00.000Z",
    "user": {
      "email": "user@example.com",
      "role": "USER"
    }
  }
}
```

---

## Episodes

### GET /episodes

List all episodes with pagination and filtering.

**Request**
```bash
curl "http://localhost:3002/api/v1/episodes?page=1&limit=10&status=approved&search=test"
```

**Query Parameters**
| Parameter | Type | Default | Validation |
|-----------|------|---------|-----------|
| page | integer | 1 | Min 1 |
| limit | integer | 10 | 1-100 |
| status | string | null | pending, approved, rejected, archived |
| search | string | null | Max 500 chars |

**Response 200 OK**
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "title": "Episode 1: The Beginning",
      "status": "approved",
      "episode_number": 1,
      "air_date": "2024-01-01",
      "description": "First episode of the series",
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-02T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "pages": 5
  }
}
```

---

### GET /episodes/:id

Get detailed information about a specific episode.

**Request**
```bash
curl http://localhost:3002/api/v1/episodes/123e4567-e89b-12d3-a456-426614174000
```

**Path Parameters**
| Parameter | Type | Validation |
|-----------|------|-----------|
| id | UUID | Valid UUID format |

**Response 200 OK**
```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "title": "Episode 1: The Beginning",
    "status": "approved",
    "episode_number": 1,
    "air_date": "2024-01-01",
    "description": "First episode of the series",
    "duration_seconds": 3600,
    "metadata": {
      "writer": "John Doe",
      "director": "Jane Smith",
      "cast": ["Actor 1", "Actor 2"]
    },
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-02T00:00:00.000Z"
  }
}
```

**Response 404 Not Found**
```json
{
  "error": "Episode not found"
}
```

---

## Assets

### POST /assets

Upload a new promotional asset.

**Request**
```bash
curl -X POST http://localhost:3002/api/v1/assets \
  -F "file=@image.jpg" \
  -F "assetType=PROMO_LALA" \
  -F 'metadata={"title":"Main Promo","campaign":"Season 1"}'
```

**Form Fields**
| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| file | file | Yes | JPEG, PNG, GIF, WebP, max 100MB |
| assetType | string | Yes | PROMO_LALA, PROMO_JUSTAWOMANINPERPRIME, PROMO_GUEST, BRAND_LOGO, EPISODE_FRAME |
| metadata | JSON | No | Valid JSON object |

**Response 201 Created**
```json
{
  "status": "SUCCESS",
  "message": "Asset uploaded successfully",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "PROMO_LALA - 1704384000000",
    "asset_type": "PROMO_LALA",
    "url": "https://mock-s3-bucket.s3.amazonaws.com/promotional/lala/raw/...",
    "s3_url": "https://mock-s3-bucket.s3.amazonaws.com/promotional/lala/raw/...",
    "metadata": {
      "title": "Main Promo",
      "campaign": "Season 1",
      "approval_status": "PENDING"
    },
    "created_at": "2024-01-05T18:00:00.000Z"
  }
}
```

**Response 400 Bad Request**
```json
{
  "error": "Validation failed",
  "details": [
    "assetType must be one of: PROMO_LALA, PROMO_JUSTAWOMANINPERPRIME, PROMO_GUEST, BRAND_LOGO, EPISODE_FRAME",
    "Metadata must be valid JSON"
  ]
}
```

---

### GET /assets/:id

Get asset details by ID.

**Request**
```bash
curl http://localhost:3002/api/v1/assets/123e4567-e89b-12d3-a456-426614174000
```

**Response 200 OK**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "PROMO_LALA - 1704384000000",
    "asset_type": "PROMO_LALA",
    "url": "https://...",
    "s3_url": "https://...",
    "metadata": {
      "approval_status": "APPROVED"
    }
  }
}
```

---

### GET /assets/approved/:type

List approved assets by type.

**Request**
```bash
curl http://localhost:3002/api/v1/assets/approved/PROMO_LALA
```

**Response 200 OK**
```json
{
  "status": "SUCCESS",
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "PROMO_LALA - 1704384000000",
      "asset_type": "PROMO_LALA",
      "url": "https://...",
      "metadata": {
        "approval_status": "APPROVED"
      }
    }
  ],
  "count": 1
}
```

---

### GET /assets/pending

List pending assets awaiting approval.

**Request**
```bash
curl http://localhost:3002/api/v1/assets/pending
```

**Response 200 OK**
```json
{
  "status": "SUCCESS",
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174001",
      "name": "PROMO_LALA - 1704384000001",
      "asset_type": "PROMO_LALA",
      "url": "https://...",
      "metadata": {
        "approval_status": "PENDING"
      }
    }
  ],
  "count": 1
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Request succeeded |
| 201 | Created | Resource created |
| 400 | Bad Request | Validation failed |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Internal error |

### Error Response Format

```json
{
  "error": "Error type",
  "message": "Error description",
  "code": "ERROR_CODE",
  "details": ["Specific error details"]
}
```

---

## Rate Limiting

- **Login endpoint:** 5 requests per 15 minutes
- **Token refresh:** 10 requests per minute
- **Other endpoints:** No limit (development mode)

---

## Security Headers

All responses include these security headers:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'
```

---

## CORS Configuration

Allowed origins:
- http://localhost:3000
- http://localhost:5173
- http://127.0.0.1:5173
- http://127.0.0.1:3000

Allowed methods: GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS

---

## Authentication

All protected endpoints require an Authorization header:

```bash
Authorization: Bearer <accessToken>
```

---

## Examples

### Complete Login & API Call Workflow

```bash
# 1. Login
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3002/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }')

ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.accessToken')

# 2. Get episodes with token
curl http://localhost:3002/api/v1/episodes \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json"

# 3. Logout
curl -X POST http://localhost:3002/api/v1/auth/logout \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

---

## Troubleshooting

### 401 Unauthorized
- Check token is valid
- Verify Authorization header format
- Token may have expired, refresh with refresh token

### 429 Too Many Requests
- Wait before retrying
- (Development: rate limiting skipped)

### 400 Bad Request
- Validate all required fields
- Check parameter types
- Verify email/UUID formats

---

For more information, see DEPLOYMENT.md
