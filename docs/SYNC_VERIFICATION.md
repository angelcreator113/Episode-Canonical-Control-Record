# File & Application Synchronization Verification

**Last Updated:** January 7, 2026

## ✅ Synchronization Status

### Backend Configuration
- **API Port:** 3002 (`.env` PORT=3002)
- **Database:** PostgreSQL on localhost:5432
- **Database Name:** episode_metadata
- **Environment:** Node.js 20+

### Frontend Configuration
- **Dev Port:** 5173 (Vite default)
- **Backend URL:** http://localhost:3002 (Frontend .env and service files)
- **Package Manager:** npm

### Docker Services
- **PostgreSQL:** Container `episode-postgres` on port 5432
- **LocalStack:** Container `episode-localstack` on port 4566 (S3, SQS, SNS)

---

## 📋 Configuration Files Fixed

### Frontend API Configuration
1. **frontend/.env** ✅
   - VITE_API_URL=http://localhost:3002
   - VITE_ENV=development

2. **frontend/src/services/api.js** ✅
   - Uses NODE_ENV to set baseURL to 'http://localhost:3002' in development

3. **frontend/src/services/authService.js** ✅
   - Uses NODE_ENV to set API_BASE_URL to 'http://localhost:3002/api/v1' in development

4. **Hard-coded URLs Fixed:**
   - ✅ frontend/src/pages/CompositionManagement.jsx
   - ✅ frontend/src/components/VersionTimeline.jsx
   - ✅ frontend/src/components/CompositionEditor.jsx

### Backend Configuration
1. **.env** ✅
   - PORT=3002
   - DATABASE_URL=postgresql://postgres:postgres@localhost:5432/episode_metadata
   - ALLOWED_ORIGINS includes http://localhost:5173

2. **src/server.js** ✅
   - Properly configured to start on port 3002
   - Respects NODE_ENV for test mode

3. **src/app.js** ✅
   - CORS configured for localhost:5173 and localhost:3002
   - Includes /ping endpoint for health checks
   - Database sync configured for all models

---

## 🚀 Startup Instructions

### Prerequisites
- Docker Desktop running
- Node.js 20+ installed
- npm 9+ installed

### Step 1: Start Docker Services
```powershell
cd "c:\Users\12483\prime studios\BRD\Episode-Canonical-Control-Record"
docker-compose up -d
```

Verify containers:
```powershell
docker ps | Select-String "episode-"
```

### Step 2: Start Backend
```powershell
cd "c:\Users\12483\prime studios\BRD\Episode-Canonical-Control-Record"
npm install  # If needed
npm start
```

Expected output:
```
✓ Episode Metadata API listening on port 3002
✓ Environment: development
✓ API Version: v1
🔗 Ready to accept requests
✅ Database connection authenticated
✓ Syncing database tables...
```

### Step 3: Start Frontend (in a new terminal)
```powershell
cd "c:\Users\12483\prime studios\BRD\Episode-Canonical-Control-Record\frontend"
npm install  # If needed
npm run dev
```

Expected output:
```
  VITE v5.0.0  ready in XXX ms
  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

---

## ✅ Verification Tests

### Test 1: Backend Health
```powershell
curl -s "http://localhost:3002/ping" | ConvertFrom-Json
```
Expected: `{ "pong": true, "timestamp": "..." }`

### Test 2: Frontend Accessibility
```powershell
curl -s "http://localhost:5173" | Select-String "<title>"
```
Expected: Should contain HTML with title

### Test 3: API Authentication
```powershell
$token = ((Invoke-WebRequest -Uri "http://localhost:3002/api/v1/auth/login" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body (@{ email = "test@example.com"; password = "password123" } | ConvertTo-Json) `
  -UseBasicParsing).Content | ConvertFrom-Json).data.accessToken

Write-Host "Token: $token"
```

### Test 4: API Endpoints
```powershell
# Get episodes
Invoke-WebRequest -Uri "http://localhost:3002/api/v1/episodes?limit=5" `
  -Headers @{"Authorization"="Bearer $token"} `
  -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 2
```

---

## 📝 File Alignment Summary

| Component | Port | URL | Status |
|-----------|------|-----|--------|
| Backend API | 3002 | http://localhost:3002 | ✅ Synced |
| Frontend Dev | 5173 | http://localhost:5173 | ✅ Synced |
| PostgreSQL | 5432 | localhost:5432 | ✅ Synced |
| LocalStack | 4566 | localhost:4566 | ✅ Synced |

---

## 🔧 Common Issues & Solutions

### Issue: Frontend can't reach backend
- **Cause:** Wrong API URL in environment or services
- **Solution:** Check `frontend/.env` and `frontend/src/services/api.js`
- **Status:** ✅ FIXED

### Issue: CORS errors
- **Cause:** Origin not in ALLOWED_ORIGINS
- **Solution:** Check `.env` ALLOWED_ORIGINS includes http://localhost:5173
- **Status:** ✅ FIXED in src/app.js

### Issue: Database connection failed
- **Cause:** PostgreSQL not running
- **Solution:** Verify `docker ps` shows episode-postgres
- **Status:** Check docker-compose.yml

### Issue: Port already in use
- **Cause:** Service already running on port
- **Solution:** Stop processes with `Get-Process node | Stop-Process -Force`
- **Status:** Use provided terminal commands

---

## 📦 Database Migrations

The application uses Sequelize ORM with automatic sync. Key tables:
- `episodes` - Main episode data
- `thumbnails` - Thumbnail metadata
- `processing_queues` - Job queue
- `activity_logs` - Audit trail
- `file_storages` - File metadata
- `assets` - Asset library
- `thumbnail_compositions` - Composite thumbnails
- `thumbnail_templates` - Template definitions
- `episode_templates` - Episode templates

---

## ✨ All systems are now synchronized and ready to run!

