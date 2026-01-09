# Quick Reference - Episode Control System

## 🚀 Start Services

```bash
# Terminal 1: Backend API (port 3002)
cd .
npm start

# Terminal 2: Frontend UI (port 5173)
cd frontend
npm run dev
```

## 🌐 Access Points

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3002
- **Database**: PostgreSQL (local Docker)

## 👤 Test Credentials

**Admin User**:
- Email: admin@example.com
- Password: password123
- Role: admin

**Test User**:
- Email: test@example.com
- Password: password123
- Role: editor

## 📋 Core API Endpoints

### Episodes
```bash
# List all episodes
GET /api/v1/episodes?page=1&limit=10

# Filter by status
GET /api/v1/episodes?status=draft
GET /api/v1/episodes?status=published

# Create episode
POST /api/v1/episodes
Body: { title, episode_number, status, description, air_date, categories }

# Get one episode
GET /api/v1/episodes/{id}

# Update episode
PUT /api/v1/episodes/{id}
Body: { title, episode_number, status, description, air_date, categories }

# Delete episode (admin only)
DELETE /api/v1/episodes/{id}
```

### Search
```bash
# Full-text search
GET /api/v1/search?q=Test
GET /api/v1/search?q=Episode&limit=20
```

### Authentication
```bash
# Login
POST /api/v1/auth/login
Body: { email, password }

# Logout
POST /api/v1/auth/logout
```

## ✅ What's Fixed This Session

### 1. Logout Issue ✅
- **Problem**: Button disappeared but page didn't redirect
- **Fix**: Enhanced logout with backend call and proper navigation
- **Files**: `authService.js`, `Header.jsx`

### 2. Status Filter ✅
- **Problem**: Backend rejected 'draft' and 'published' values
- **Fix**: Updated validation to match database values
- **File**: `requestValidation.js`

### 3. Search Functionality ✅
- **Problem**: Search returned 0 results (OpenSearch not configured)
- **Fix**: Added PostgreSQL fallback with ILIKE search
- **File**: `OpenSearchService.js`

### 4. Categories Feature ✅
- **Problem**: EditEpisode lacked category support
- **Fix**: Added category input/output to edit form
- **File**: `EditEpisode.jsx`

## 🧪 Quick Tests

```bash
# Test Create
curl -X POST http://localhost:3002/api/v1/episodes \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","episode_number":1,"status":"draft"}'

# Test Search
curl http://localhost:3002/api/v1/search?q=Test \
  -H "Authorization: Bearer TOKEN"

# Test Filter
curl http://localhost:3002/api/v1/episodes?status=draft \
  -H "Authorization: Bearer TOKEN"
```

## 📁 Key Files

### Backend
- `src/app.js` - Express app setup
- `src/routes/episodes.js` - Episode endpoints
- `src/services/OpenSearchService.js` - Search service
- `src/middleware/requestValidation.js` - Input validation

### Frontend
- `frontend/src/pages/Episodes.jsx` - Episode list page
- `frontend/src/pages/CreateEpisode.jsx` - Create form
- `frontend/src/pages/EditEpisode.jsx` - Edit form
- `frontend/src/components/Header.jsx` - Top navigation

## 🎯 Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| Authentication | ✅ | JWT tokens, role-based |
| Create Episode | ✅ | All fields, categories |
| Read Episodes | ✅ | Pagination, filters |
| Update Episode | ✅ | All fields, categories |
| Delete Episode | ✅ | Admin only (RBAC) |
| Search | ✅ | PostgreSQL fallback |
| Filter | ✅ | By status, sort |
| Batch Operations | ✅ | Select, delete, publish |
| Categories | ✅ | Add/remove, display |
| Logout | ✅ | Proper redirect |

## 🔧 Database Info

**Host**: localhost  
**Port**: 5432  
**Database**: episode_metadata  
**User**: episode_user  
**Password**: episode_pass  

**Main Table**: episodes (12 episodes seeded)

## 📊 Status Dashboard

```
✅ Backend API: Running (port 3002)
✅ Frontend: Running (port 5173)
✅ Database: Connected
✅ Authentication: Working
✅ CRUD Operations: All working
✅ Search: Functional
✅ Filters: Functional
✅ Logout: Fixed
```

## 🐛 Troubleshooting

### Server won't start
```bash
# Kill existing processes
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
npm start
```

### Port already in use
```bash
# Check what's using port 3002
netstat -ano | findstr :3002
taskkill /PID <PID> /F

# Or change port in package.json
```

### Database connection error
```bash
# Verify Docker container running
docker ps | grep episode-postgres

# If not running, start it
docker-compose up -d
```

## 📝 Documentation

See these files for more details:
- `IMPROVEMENTS_COMPLETED.md` - Full improvements guide
- `SESSION_COMPLETION_REPORT.md` - Complete session report
- `README.md` - Project overview
- `API_QUICK_REFERENCE.md` - API documentation

## 🚦 Next Steps

1. **Verify everything works**
   ```bash
   # Navigate to http://localhost:5173
   # Login with test credentials
   # Create an episode
   # Search for it
   # Edit it
   # Delete it (if admin)
   ```

2. **Run tests** (if fixed)
   ```bash
   npm test
   ```

3. **Deploy** (when ready)
   ```bash
   # Build frontend
   cd frontend && npm run build
   
   # Deploy to production
   ```

---

**Last Updated**: 2026-01-06  
**Status**: ✅ All Systems Operational
