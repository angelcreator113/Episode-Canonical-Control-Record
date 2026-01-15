# PHASE 1 Infrastructure Setup Checklist

**Date Started:** January 5, 2026  
**Region:** us-east-1  
**Environment:** Local Development

---

## 📋 Pre-Setup Requirements

- [ ] Docker installed (`docker --version`)
- [ ] Docker Compose installed (`docker-compose --version`)
- [ ] Node.js v20+ installed (`node --version`)
- [ ] npm v10+ installed (`npm --version`)
- [ ] AWS CLI v2 installed (`aws --version`)
- [ ] PowerShell (Windows) or Bash (Mac/Linux)
- [ ] curl installed (`curl --version`)
- [ ] Git installed (`git --version`)

**Verification Command:**
```powershell
docker --version; docker-compose --version; node --version; npm --version; aws --version
```

---

## 🔧 Setup Steps Checklist

### Step 1: Review Documentation
- [ ] Read [INFRASTRUCTURE_SETUP_SUMMARY.md](INFRASTRUCTURE_SETUP_SUMMARY.md)
- [ ] Read [AWS_INFRASTRUCTURE_SETUP.md](AWS_INFRASTRUCTURE_SETUP.md)
- [ ] Read [PHASE_1_LOCAL_SETUP.md](PHASE_1_LOCAL_SETUP.md)
- [ ] Understand 4-phase infrastructure approach

### Step 2: Verify Configuration Files
- [ ] `.env.local` exists and has correct content
  ```powershell
  type .env.local | Select-String "AWS_S3_ENDPOINT"
  # Should output: AWS_S3_ENDPOINT=http://localhost:4566
  ```
- [ ] `docker-compose.yml` has postgres and localstack services
- [ ] `scripts/init-localstack.ps1` exists and is executable

### Step 3: Start Docker Services
- [ ] Navigate to project root
  ```powershell
  cd "c:\Users\12483\prime studios\BRD\Episode-Canonical-Control-Record"
  ```
- [ ] Pull latest images
  ```powershell
  docker-compose pull
  ```
- [ ] Start services
  ```powershell
  docker-compose up -d
  ```
- [ ] Verify services are healthy
  ```powershell
  docker-compose ps
  # MUST show both services with "Up (healthy)" status
  ```

### Step 4: Initialize LocalStack S3
- [ ] Run initialization script
  ```powershell
  .\scripts\init-localstack.ps1
  ```
- [ ] Verify buckets were created
  ```powershell
  aws s3 ls --endpoint-url http://localhost:4566 --region us-east-1
  # Should list 3 buckets: brd-episodes-dev, brd-thumbnails-dev, brd-temp-dev
  ```

### Step 5: Start Backend API
- [ ] Install npm dependencies (if needed)
  ```powershell
  npm install
  ```
- [ ] Start backend
  ```powershell
  npm start
  # Should show: ✓ Server running on port 3002
  ```
- [ ] Keep terminal open (DO NOT close)
- [ ] Test health endpoint in NEW terminal
  ```powershell
  curl http://localhost:3002/health
  # Should return JSON with status: healthy
  ```

### Step 6: Start Frontend
- [ ] Open NEW terminal (keep backend running)
- [ ] Navigate to frontend
  ```powershell
  cd frontend
  ```
- [ ] Start dev server
  ```powershell
  npm run dev
  # Should show: ➜ Local: http://localhost:5173/
  ```
- [ ] Keep terminal open

### Step 7: Verification Tests
- [ ] Health Check
  ```powershell
  curl http://localhost:3002/health
  # Expected: {"status":"healthy","database":"connected",...}
  ```
- [ ] Login Test
  ```powershell
  $body = @{ email="test@example.com"; password="password123" } | ConvertTo-Json
  curl -X POST http://localhost:3002/api/v1/auth/login -H "Content-Type: application/json" -d $body
  # Expected: 200 OK with JWT token
  ```
- [ ] Episodes Test
  ```powershell
  curl http://localhost:3002/api/v1/episodes?limit=1
  # Expected: 200 OK with episodes array
  ```
- [ ] Frontend Load
  ```
  Open browser: http://localhost:5173/
  # Expected: Application loads without errors
  ```

### Step 8: Run Test Suite
- [ ] Open NEW terminal (keep others running)
- [ ] Run tests
  ```powershell
  npm test
  # Expected: All tests pass (829/829)
  ```
- [ ] Check coverage (optional)
  ```powershell
  npm test -- --coverage
  ```

---

## ✅ Verification Tests

### Test 1: Docker Services Running
```powershell
docker-compose ps
```
**MUST SEE:**
```
NAME                COMMAND                  STATUS
episode-postgres    "docker-entrypoint.s…"   Up (healthy)
episode-localstack  "docker-entrypoint.sh"   Up (healthy)
```
- [ ] PostgreSQL healthy
- [ ] LocalStack healthy

### Test 2: LocalStack S3 Accessible
```powershell
aws s3 ls --endpoint-url http://localhost:4566 --region us-east-1
```
**MUST SEE:**
```
2026-01-05 12:00:00 brd-episodes-dev
2026-01-05 12:00:00 brd-thumbnails-dev
2026-01-05 12:00:00 brd-temp-dev
```
- [ ] brd-episodes-dev bucket exists
- [ ] brd-thumbnails-dev bucket exists
- [ ] brd-temp-dev bucket exists

### Test 3: API Health Endpoint
```powershell
curl http://localhost:3002/health | ConvertFrom-Json | ConvertTo-Json
```
**MUST SEE:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-05T22:50:29.321Z",
  "uptime": 123.45,
  "version": "v1",
  "environment": "development",
  "database": "connected"
}
```
- [ ] status: healthy
- [ ] database: connected
- [ ] environment: development

### Test 4: API Authentication
```powershell
$body = @{
    email = "test@example.com"
    password = "password123"
} | ConvertTo-Json

curl -X POST "http://localhost:3002/api/v1/auth/login" `
  -H "Content-Type: application/json" `
  -d $body | ConvertFrom-Json | ConvertTo-Json
```
**MUST SEE:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "user": {...}
  }
}
```
- [ ] HTTP 200 response
- [ ] Token returned
- [ ] User object present

### Test 5: API Episodes Endpoint
```powershell
curl "http://localhost:3002/api/v1/episodes?limit=1" | ConvertFrom-Json | ConvertTo-Json
```
**MUST SEE:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {...}
}
```
- [ ] HTTP 200 response
- [ ] Data array returned
- [ ] Pagination info included

### Test 6: Frontend Application
```
Open: http://localhost:5173/
```
**MUST SEE:**
- [ ] Application loads
- [ ] Dashboard visible
- [ ] No console errors
- [ ] Can click buttons
- [ ] Can navigate pages

### Test 7: Database Connection
```powershell
docker exec episode-postgres psql -U postgres -d episode_metadata -c "SELECT COUNT(*) FROM episodes;"
```
**MUST SEE:**
```
 count
-------
  XXX
```
- [ ] Database query succeeds
- [ ] Returns row count
- [ ] No connection errors

### Test 8: Test Suite
```powershell
npm test
```
**MUST SEE:**
```
PASS  tests/...
PASS  tests/...
...
Test Suites: 26 passed, 26 total
Tests:       823 passed, 6 skipped, 829 total
```
- [ ] All test suites pass
- [ ] No failing tests
- [ ] 829 tests running

---

## 🎯 Success Criteria

After completing all steps, you should be able to check ALL of these:

### Infrastructure ✅
- [ ] 2 Docker services running (postgres + localstack)
- [ ] Both services marked as "healthy"
- [ ] Port 5432 responding to PostgreSQL queries
- [ ] Port 4566 responding to S3 requests
- [ ] 3 S3 buckets created in LocalStack

### Application ✅
- [ ] Backend API starts on port 3002
- [ ] Frontend starts on port 5173
- [ ] API health endpoint returns "healthy"
- [ ] API connects to PostgreSQL database
- [ ] API connects to LocalStack S3

### Functionality ✅
- [ ] Can login via API
- [ ] Can create/read/update/delete episodes
- [ ] Can list episodes with pagination
- [ ] Can access protected endpoints with JWT
- [ ] Can upload files to S3 (LocalStack)

### Testing ✅
- [ ] All 829 tests pass
- [ ] No failed test suites
- [ ] No console errors in frontend
- [ ] No database errors
- [ ] API response times reasonable

---

## 📊 Status Dashboard

| Component | Status | Location | Action |
|-----------|--------|----------|--------|
| Docker PostgreSQL | [ ] | Port 5432 | `docker-compose ps` |
| LocalStack S3 | [ ] | Port 4566 | `aws s3 ls --endpoint-url...` |
| Backend API | [ ] | Port 3002 | `curl http://localhost:3002/health` |
| Frontend | [ ] | Port 5173 | http://localhost:5173 |
| Test Suite | [ ] | - | `npm test` |
| All Buckets Created | [ ] | - | `aws s3 ls --endpoint-url...` |
| All Endpoints Working | [ ] | - | Smoke tests |
| Database Connected | [ ] | - | Health endpoint |

---

## 🔧 Troubleshooting Checklist

If something fails, check:

### Docker Services Won't Start
- [ ] Docker Desktop is running
- [ ] Sufficient disk space (>5GB)
- [ ] Ports 5432 and 4566 not in use
- [ ] Try: `docker-compose down` then `docker-compose up -d`

### LocalStack S3 Not Accessible
- [ ] LocalStack container is healthy (`docker-compose ps`)
- [ ] Port 4566 is listening (`netstat -ano | findstr :4566`)
- [ ] Try: `docker-compose restart localstack`
- [ ] Check logs: `docker-compose logs localstack`

### API Won't Start
- [ ] PostgreSQL is healthy and connected
- [ ] Port 3002 not in use
- [ ] npm dependencies installed (`npm install`)
- [ ] `.env.local` exists with correct values
- [ ] Try: `npm start` with `NODE_ENV=development`

### Frontend Won't Start
- [ ] Port 5173 not in use
- [ ] npm dependencies installed (`npm install` in frontend/)
- [ ] Try: `npm run dev` from frontend directory
- [ ] Clear node_modules: `rm -r node_modules && npm install`

### Tests Failing
- [ ] All services are running
- [ ] Database is accessible
- [ ] Try: `npm test -- --clearCache`
- [ ] Check: `npm test -- --listTests` to see all tests

---

## 📝 Notes

**Completed Date:** _______________

**Issues Encountered:**
```
1. 
2. 
3. 
```

**Solutions Applied:**
```
1. 
2. 
3. 
```

**Next Steps:**
```
1. 
2. 
3. 
```

---

## ✨ You're Ready!

When all checks are complete and green, you're ready to start Phase 1 development! 🚀

**Current Status:** [ ] Setup Complete

**Next Action:** Start building Phase 1 features!

---

**Questions?** Check [PHASE_1_LOCAL_SETUP.md](PHASE_1_LOCAL_SETUP.md) or [AWS_INFRASTRUCTURE_SETUP.md](AWS_INFRASTRUCTURE_SETUP.md)
