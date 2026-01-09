# PHASE 1 Setup - Quick Start Guide

**Objective:** Get Episode Metadata API running locally with Docker PostgreSQL + LocalStack S3  
**Estimated Time:** 15-20 minutes  
**Cost:** $0/month

---

## ✅ Prerequisites

Before starting, ensure you have:

- [x] Docker installed (`docker --version` → v20.10+)
- [x] Docker Compose installed (`docker-compose --version` → v1.29+)
- [x] Node.js v20+ installed (`node --version`)
- [x] npm v10+ installed (`npm --version`)
- [x] AWS CLI v2 installed (`aws --version`)

If any are missing, install them first.

---

## 🚀 PHASE 1 Setup Steps

### Step 1: Start Database and LocalStack (5 minutes)

```powershell
# Navigate to project root
cd "c:\Users\12483\prime studios\BRD\Episode-Canonical-Control-Record"

# Start PostgreSQL and LocalStack services
docker-compose up -d

# Verify services are running
docker-compose ps
```

Expected output:
```
NAME                COMMAND                  STATUS
episode-postgres    "docker-entrypoint.s…"   Up (healthy)
episode-localstack  "docker-entrypoint.sh"   Up (healthy)
```

### Step 2: Initialize LocalStack S3 Buckets (3 minutes)

```powershell
# Run the initialization script
.\scripts\init-localstack.ps1
```

Expected output:
```
🔧 Initializing LocalStack for Episode Metadata API...
📦 Creating bucket: brd-episodes-dev
✓ Bucket ready: brd-episodes-dev
📦 Creating bucket: brd-thumbnails-dev
✓ Bucket ready: brd-thumbnails-dev
📦 Creating bucket: brd-temp-dev
✓ Bucket ready: brd-temp-dev
📬 Creating SQS queue: brd-job-queue-dev
✓ Queue ready: brd-job-queue-dev
✅ LocalStack initialization complete!
```

### Step 3: Verify LocalStack S3

```powershell
# List buckets
aws s3 ls --endpoint-url http://localhost:4566 --region us-east-1

# Expected output:
# 2026-01-05 12:00:00 brd-episodes-dev
# 2026-01-05 12:00:00 brd-thumbnails-dev
# 2026-01-05 12:00:00 brd-temp-dev
```

### Step 4: Configure Application

```powershell
# The .env.local file is already created
# Verify it exists and has correct values
type .env.local | Select-String "AWS_S3_ENDPOINT"

# Should output:
# AWS_S3_ENDPOINT=http://localhost:4566
```

### Step 5: Start Backend API (3 minutes)

```powershell
# Install dependencies (if not done)
npm install

# Start the backend (runs on port 3002)
npm start

# You should see:
# ✓ Server running on port 3002
# ✓ Database connected
# ✓ Environment: development
```

### Step 6: Start Frontend (in new terminal, 3 minutes)

```powershell
# Open NEW PowerShell terminal

# Navigate to frontend directory
cd "c:\Users\12483\prime studios\BRD\Episode-Canonical-Control-Record\frontend"

# Install dependencies
npm install

# Start dev server (runs on port 5173)
npm run dev

# You should see:
# VITE v5.0.0  ready in 123 ms
# ➜ Local:   http://localhost:5173/
```

---

## ✅ Verify Everything Works

### Test 1: Backend Health Check

```powershell
# In a new terminal
curl -s http://localhost:3002/health | ConvertFrom-Json | ConvertTo-Json

# Expected response:
{
  "status": "healthy",
  "timestamp": "2026-01-05T22:50:29.321Z",
  "uptime": 123.45,
  "version": "v1",
  "environment": "development",
  "database": "connected"
}
```

### Test 2: Login Test

```powershell
$body = @{
    email = "test@example.com"
    password = "password123"
} | ConvertTo-Json

curl -X POST "http://localhost:3002/api/v1/auth/login" `
  -H "Content-Type: application/json" `
  -d $body | ConvertFrom-Json | ConvertTo-Json

# Expected: 200 OK with JWT token
```

### Test 3: Episodes Endpoint

```powershell
curl -s "http://localhost:3002/api/v1/episodes?limit=5" | ConvertFrom-Json | ConvertTo-Json

# Expected: 200 OK with episodes data
```

### Test 4: Access Frontend

Open browser: **http://localhost:5173/**

You should see the Episode Metadata application dashboard.

---

## 📊 Current Status

| Component | Status | Port | Endpoint |
|-----------|--------|------|----------|
| PostgreSQL | ✅ Running | 5432 | localhost:5432 |
| LocalStack S3 | ✅ Running | 4566 | http://localhost:4566 |
| Backend API | ✅ Running | 3002 | http://localhost:3002 |
| Frontend | ✅ Running | 5173 | http://localhost:5173 |

---

## 🔧 Common Tasks During Development

### Check Database

```powershell
# List tables
docker exec episode-postgres psql -U postgres -d episode_metadata -c "\dt"

# Query episodes
docker exec episode-postgres psql -U postgres -d episode_metadata -c "SELECT id, title, status FROM episodes LIMIT 5;"

# Check users
docker exec episode-postgres psql -U postgres -d episode_metadata -c "SELECT id, email FROM users;"
```

### Check LocalStack S3

```powershell
# List all objects in episodes bucket
aws s3 ls s3://brd-episodes-dev/ --endpoint-url http://localhost:4566 --recursive

# Upload test file
echo "Test content" | aws s3 cp - s3://brd-episodes-dev/test.txt --endpoint-url http://localhost:4566

# Download test file
aws s3 cp s3://brd-episodes-dev/test.txt test-download.txt --endpoint-url http://localhost:4566

# Delete test file
aws s3 rm s3://brd-episodes-dev/test.txt --endpoint-url http://localhost:4566
```

### View Logs

```powershell
# Backend logs
npm start  # Already running in terminal

# Frontend logs
cd frontend && npm run dev  # Already running in terminal

# PostgreSQL logs
docker-compose logs -f postgres

# LocalStack logs
docker-compose logs -f localstack
```

### Run Tests

```powershell
# All tests
npm test

# Specific test file
npm test -- tests/integration/auth.integration.test.js

# Watch mode
npm test -- --watch

# With coverage
npm test -- --coverage
```

---

## ⚠️ Troubleshooting

### Services Won't Start

```powershell
# Check Docker is running
docker ps

# Try pulling latest images
docker-compose pull

# Full reset (warning: clears data)
docker-compose down -v
docker-compose up -d
```

### LocalStack S3 Connection Refused

```powershell
# Check service is healthy
docker-compose ps localstack

# Check port 4566 is open
netstat -ano | findstr :4566

# Restart LocalStack
docker-compose restart localstack
```

### Database Connection Failed

```powershell
# Check PostgreSQL is running
docker-compose ps postgres

# Check database exists
docker exec episode-postgres psql -U postgres -l | findstr episode_metadata

# Create database if needed
docker exec episode-postgres psql -U postgres -c "CREATE DATABASE episode_metadata;"
```

### Port Already in Use

```powershell
# Find what's using port 3002
netstat -ano | findstr :3002

# Kill the process (replace PID)
taskkill /PID <PID> /F

# Or use different port
$env:PORT=3003
npm start
```

---

## 📝 Development Workflow

**Typical day:**

```powershell
# Morning: Start services
docker-compose up -d

# Check health
docker-compose ps

# Start API
npm start

# Start frontend (new terminal)
cd frontend && npm run dev

# Develop...

# Run tests periodically
npm test

# Push changes
git add .
git commit -m "Feature: add something"
git push
```

---

## 🎯 What's Next?

### This Week (PHASE 1)
- ✅ Local environment setup - **DONE**
- [ ] Build core features
- [ ] Test S3 uploads locally
- [ ] Test API endpoints
- [ ] Run test suite

### Next Week (PHASE 2 Prep)
- Create AWS RDS instance
- Create real S3 buckets in AWS
- Prepare production environment variables
- Plan deployment

### Following Week (PHASE 2)
- Deploy to AWS staging
- Test with real cloud services
- Validate all integrations

---

## 📚 Reference

**Key Files:**
- `.env.local` - Development environment variables
- `docker-compose.yml` - Service definitions
- `scripts/init-localstack.ps1` - LocalStack setup script
- `AWS_INFRASTRUCTURE_SETUP.md` - Detailed infrastructure guide

**Commands:**
```powershell
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Run tests
npm test

# Start API
npm start

# Start frontend
cd frontend && npm run dev
```

---

## ✅ Success Checklist

- [ ] Docker services running (postgres + localstack)
- [ ] LocalStack S3 buckets created
- [ ] Backend API running on port 3002
- [ ] Frontend running on port 5173
- [ ] Health check returning healthy status
- [ ] Can login and access /me endpoint
- [ ] Can view episodes list
- [ ] S3 uploads working (test file uploaded)
- [ ] All tests passing (`npm test`)

---

**Ready to develop!** 🚀

Questions? Check the logs or see [AWS_INFRASTRUCTURE_SETUP.md](AWS_INFRASTRUCTURE_SETUP.md) for detailed documentation.
