# PHASE_5_QUICK_START.md

# Phase 5 - Quick Start Guide
## Get Running in 5 Minutes

**Last Updated:** January 5, 2026  
**For:** Developers, DevOps, Project Managers

---

## TL;DR - Start Here

### Quick Setup (First Time)
```bash
# 1. Clone and install
git clone <repo>
cd Episode-Canonical-Control-Record
npm install
cd frontend && npm install && cd ..

# 2. Setup database
docker run -d --name episode-postgres \
  -e POSTGRES_DB=episode_metadata \
  -e POSTGRES_USER=app_user \
  -e POSTGRES_PASSWORD=password123 \
  -p 5432:5432 postgres:15

# 3. Configure environment
cp .env.example .env
# Edit .env with your settings

# 4. Run migrations
npm run migrate:up

# 5. Start servers (two terminals)
# Terminal 1:
npm start

# Terminal 2:
cd frontend && npm run dev
```

**Done!** Visit http://localhost:5173

---

## 🚀 Running the System

### Backend Server
```bash
# Development
npm start
# Runs on http://localhost:3002

# Production
NODE_ENV=production npm start

# Staging
NODE_ENV=staging npm start

# With PM2
pm2 start ecosystem.config.js
pm2 logs
```

### Frontend Server
```bash
cd frontend

# Development
npm run dev
# Runs on http://localhost:5173

# Build for production
npm run build
```

### Both Servers (Recommended Setup)
```bash
# Terminal 1
npm start

# Terminal 2
cd frontend && npm run dev
```

---

## 🧪 Testing

### Run All Tests
```bash
npm test
```

### Integration Tests Only
```bash
npm test -- tests/integration/
```

### Watch Mode (Auto-rerun)
```bash
npm test -- --watch
```

### Specific Test File
```bash
npm test -- tests/integration/auth.integration.test.js
```

### Coverage Report
```bash
npm test -- --coverage
```

---

## 📝 Common Tasks

### Add Environment Variable
1. Edit `.env` file
2. Add variable: `VARIABLE_NAME=value`
3. Restart server: `npm start`

### Run Database Migration
```bash
npm run migrate:up      # Apply pending migrations
npm run migrate:down    # Rollback last migration
npm run migrate:reset   # Start fresh
```

### Login to System
```bash
# Any email + 6+ char password works
Email: test@example.com
Password: password123

# Get test token directly
curl -X POST http://localhost:3002/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Upload Asset
```bash
curl -X POST http://localhost:3002/api/v1/assets \
  -F "file=@image.jpg" \
  -F "assetType=PROMO_LALA" \
  -F 'metadata={"title":"Main Promo"}'
```

### Get Episodes
```bash
curl http://localhost:3002/api/v1/episodes?page=1&limit=10
```

---

## 🔍 Debugging

### Check Backend Health
```bash
curl http://localhost:3002/health
curl http://localhost:3002/api/v1
```

### View Logs
```bash
# Terminal logs
tail -f logs/app.log

# With PM2
pm2 logs episode-api
```

### Database Issues
```bash
# Connect to database
psql -h localhost -U app_user -d episode_metadata

# List tables
\dt

# Check table structure
\d episodes
```

### Port Already in Use
```bash
# Find process using port 3002
lsof -i :3002

# Kill process
kill -9 <PID>

# Or use different port
PORT=3003 npm start
```

### CORS Issues
```bash
# Check CORS headers
curl -i -X OPTIONS http://localhost:3002/api/v1/episodes \
  -H "Origin: http://localhost:5173"

# Should see Access-Control-Allow-Origin header
```

---

## 📚 API Quick Reference

### Authentication
```bash
# Login
POST /api/v1/auth/login
Body: {"email":"user@example.com","password":"password123"}

# Logout
POST /api/v1/auth/logout
Header: Authorization: Bearer <token>

# Refresh Token
POST /api/v1/auth/refresh
Body: {"refreshToken":"..."}

# Get Current User
GET /api/v1/auth/me
Header: Authorization: Bearer <token>
```

### Episodes
```bash
# List
GET /api/v1/episodes?page=1&limit=10&status=approved

# Detail
GET /api/v1/episodes/{id}
```

### Assets
```bash
# Upload
POST /api/v1/assets
Body: file + assetType + metadata

# Get
GET /api/v1/assets/{id}

# List Approved
GET /api/v1/assets/approved/PROMO_LALA

# List Pending
GET /api/v1/assets/pending
```

---

## 🐳 Docker Commands

### Run with Docker Compose
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Remove everything
docker-compose down -v
```

### Build Images
```bash
# Backend
docker build -t episode-api:1.0 .

# Frontend
docker build -f frontend/Dockerfile -t episode-web:1.0 ./frontend

# Run
docker run -p 3002:3002 episode-api:1.0
```

---

## 📊 Key Files

### Configuration
- `.env` - Environment variables
- `.env.example` - Template
- `package.json` - Dependencies
- `jest.config.js` - Test configuration

### Backend
- `src/app.js` - Express app setup
- `src/server.js` - Server startup
- `src/routes/` - API endpoints
- `src/controllers/` - Business logic
- `src/middleware/` - Middleware (auth, validation)
- `src/services/` - External services

### Frontend
- `frontend/src/App.jsx` - Root component
- `frontend/src/pages/` - Page components
- `frontend/src/services/authService.js` - Auth logic
- `frontend/index.html` - HTML entry point
- `frontend/vite.config.js` - Vite configuration

### Tests
- `tests/integration/auth.integration.test.js` - Auth tests
- `tests/integration/episodes.integration.test.js` - Episode tests
- `tests/integration/assets.integration.test.js` - Asset tests

### Documentation
- `docs/API_REFERENCE.md` - API documentation
- `PHASE_5_PRODUCTION_CHECKLIST.md` - Deployment guide
- `PHASE_5_COMPLETION_SUMMARY.md` - Status report

---

## ⚙️ Environment Variables

### Required (All Environments)
```
NODE_ENV=development          # development, staging, or production
PORT=3002                     # API server port
DB_HOST=localhost             # Database host
DB_PORT=5432                  # Database port
DB_NAME=episode_metadata      # Database name
DB_USER=app_user              # Database user
DB_PASSWORD=password123       # Database password
JWT_SECRET=your-32-char-min-secret-key
```

### Optional
```
JWT_EXPIRY=1h                 # Token expiration time
JWT_REFRESH_EXPIRY=7d         # Refresh token expiration
AWS_REGION=us-east-1          # AWS region
AWS_S3_BUCKET=bucket-name     # S3 bucket
LOG_LEVEL=info                # Logging level
```

---

## 🚀 Deployment Checklist

### Before Deploying
- [ ] All tests passing: `npm test`
- [ ] Environment variables set
- [ ] Database migrations run: `npm run migrate:up`
- [ ] Health check passing: `curl localhost:3002/health`

### Deployment Command
```bash
# Production
NODE_ENV=production npm install --production
NODE_ENV=production npm run migrate:up
NODE_ENV=production npm start

# Or with PM2
pm2 start ecosystem.config.js --env production
```

### After Deploying
- [ ] Health endpoint responding
- [ ] Login working
- [ ] Episodes loading
- [ ] Assets uploading
- [ ] Logs showing no errors

---

## 🆘 Getting Help

### Documentation
- API Reference: `docs/API_REFERENCE.md`
- Deployment: `PHASE_5_PRODUCTION_CHECKLIST.md`
- Status Report: `PHASE_5_COMPLETION_SUMMARY.md`

### Endpoints
- API Info: `GET /api/v1`
- Health: `GET /health`
- Health Details: `GET /health/detailed`

### Logs
```bash
npm start 2>&1 | tee logs/app.log
pm2 logs episode-api
tail -f logs/error.log
```

### Common Issues & Solutions
| Issue | Solution |
|-------|----------|
| Port 3002 in use | Kill process: `lsof -i :3002` then `kill -9 <PID>` |
| DB connection failed | Check DB running: `psql -h localhost -U app_user` |
| CORS error | Check Origins in `src/app.js` CORS config |
| Invalid token | Re-login: `POST /api/v1/auth/login` |
| Test failing | Clear node_modules: `rm -rf node_modules && npm install` |

---

## 📞 Quick Links

- **Git Repository:** [your-repo-url]
- **API Docs:** `docs/API_REFERENCE.md`
- **Test Results:** `npm test`
- **Deployment Guide:** `PHASE_5_PRODUCTION_CHECKLIST.md`
- **Status Report:** `PHASE_5_COMPLETION_SUMMARY.md`

---

## ✅ Verification Commands

```bash
# Backend running?
curl http://localhost:3002/health

# Frontend running?
curl http://localhost:5173

# Database connected?
npm run db:test

# All tests passing?
npm test

# Specific endpoint working?
curl http://localhost:3002/api/v1/episodes

# Authentication working?
curl -X POST http://localhost:3002/api/v1/auth/login \
  -d '{"email":"test@example.com","password":"password123"}' \
  -H "Content-Type: application/json"
```

---

## ⏱️ Typical Startup Time

- Backend: 5-10 seconds
- Frontend: 10-15 seconds
- Database: 5-10 seconds
- **Total:** ~30 seconds from start to ready

---

**Ready to go!** 🚀

For more detailed information, see the comprehensive documentation in `/docs/` and root markdown files.
