# Episode Canonical Control Record - Quick Start Guide

## ✅ System Status: SYNCHRONIZED & READY

All files and configurations have been verified and synchronized. The application is ready to run.

---

## 🚀 Quick Start (30 seconds)

### Option 1: PowerShell (Recommended)
```powershell
cd "c:\Users\12483\prime studios\BRD\Episode-Canonical-Control-Record"
.\START_APP.ps1
```

### Option 2: Batch File
```cmd
cd "c:\Users\12483\prime studios\BRD\Episode-Canonical-Control-Record"
START_APP.bat
```

### Option 3: Manual Steps
```powershell
# Terminal 1: Start Docker & Backend
cd "c:\Users\12483\prime studios\BRD\Episode-Canonical-Control-Record"
docker-compose up -d
npm start

# Terminal 2: Start Frontend
cd "c:\Users\12483\prime studios\BRD\Episode-Canonical-Control-Record\frontend"
npm run dev
```

---

## 📍 Access Points

Once running:

| Service | URL | Status |
|---------|-----|--------|
| Frontend | http://localhost:5173 | ✅ |
| Backend API | http://localhost:3002 | ✅ |
| API Health | http://localhost:3002/ping | ✅ |
| PostgreSQL | localhost:5432 | ✅ |
| LocalStack | localhost:4566 | ✅ |

---

## 🔍 Verify Everything Works

```powershell
# Check backend is running
curl http://localhost:3002/ping

# Check frontend is running
curl http://localhost:5173

# Check Docker containers
docker ps | Select-String "episode-"
```

---

## 📁 Architecture

```
Episode-Canonical-Control-Record/
├── src/                          # Backend API (Express.js)
│   ├── app.js                    # Express app
│   ├── server.js                 # HTTP server
│   ├── models/                   # Database models
│   ├── routes/                   # API routes
│   ├── controllers/              # Request handlers
│   └── middleware/               # Express middleware
│
├── frontend/                      # React Frontend (Vite)
│   ├── src/
│   │   ├── pages/                # Page components
│   │   ├── components/           # Reusable components
│   │   ├── services/             # API clients
│   │   └── App.jsx               # Main component
│   ├── vite.config.js            # Vite configuration
│   └── package.json
│
├── .env                          # Backend environment config
├── docker-compose.yml            # Docker services
├── package.json                  # Backend dependencies
├── START_APP.ps1                 # PowerShell startup script
└── START_APP.bat                 # Batch startup script
```

---

## ⚙️ Key Configuration Files

### Backend (.env)
```
PORT=3002
DB_HOST=localhost
DB_PORT=5432
DB_NAME=episode_metadata
DB_USER=postgres
DB_PASSWORD=postgres
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3002
```

### Frontend (frontend/.env)
```
VITE_API_URL=http://localhost:3002
VITE_ENV=development
```

### API Client (frontend/src/services/api.js)
- Uses `VITE_API_URL` environment variable
- Automatically includes JWT tokens
- Handles authentication

---

## 🔐 Authentication

### Default Test Credentials
```
Email:    test@example.com
Password: password123
Role:     USER
Groups:   USER, EDITOR
```

### Get Auth Token (PowerShell)
```powershell
$token = ((Invoke-WebRequest -Uri "http://localhost:3002/api/v1/auth/login" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body (@{ email = "test@example.com"; password = "password123" } | ConvertTo-Json) `
  -UseBasicParsing).Content | ConvertFrom-Json).data.accessToken

Write-Host "Token: $token"
```

---

## 📦 What's Fixed/Synchronized

### Frontend API Configuration
- ✅ `frontend/.env` - Correct port 3002
- ✅ `frontend/src/services/api.js` - Uses environment variable
- ✅ `frontend/src/services/authService.js` - Uses environment variable
- ✅ `frontend/src/pages/CompositionManagement.jsx` - Fixed hard-coded URL
- ✅ `frontend/src/components/VersionTimeline.jsx` - Fixed hard-coded URLs
- ✅ `frontend/src/components/CompositionEditor.jsx` - Fixed hard-coded URL

### Backend Configuration
- ✅ `.env` - Port 3002, CORS for 5173
- ✅ `src/server.js` - Proper startup
- ✅ `src/app.js` - CORS and middleware configured
- ✅ Database models synced

### Docker
- ✅ `docker-compose.yml` - PostgreSQL + LocalStack configured
- ✅ Container names match configuration

---

## 🛠️ Troubleshooting

### Backend won't start
```powershell
# Kill existing Node processes
Get-Process node | Stop-Process -Force

# Check port 3002 is free
Get-NetTCPConnection -LocalPort 3002 -ErrorAction SilentlyContinue

# Check Docker is running
docker ps
```

### Frontend shows blank/errors
```powershell
# Clear Vite cache
cd frontend
Remove-Item -Path ".vite", "dist" -Force -Recurse -ErrorAction SilentlyContinue
npm run dev
```

### Database connection issues
```powershell
# Check PostgreSQL container
docker exec episode-postgres psql -U postgres -d episode_metadata -c "SELECT 1"

# View container logs
docker logs episode-postgres
```

### CORS errors
- Check `.env` ALLOWED_ORIGINS includes http://localhost:5173
- Check `src/app.js` CORS configuration
- Both are already fixed ✅

---

## 📚 API Examples

### Get Episodes
```powershell
curl -H "Authorization: Bearer $token" \
  "http://localhost:3002/api/v1/episodes?page=1&limit=10"
```

### Create Episode
```powershell
$body = @{
  title = "New Episode"
  episode_number = 1
  status = "draft"
  description = "Episode description"
} | ConvertTo-Json

curl -X POST \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d $body \
  "http://localhost:3002/api/v1/episodes"
```

### Search Episodes
```powershell
curl -H "Authorization: Bearer $token" \
  "http://localhost:3002/api/v1/search?q=keywords"
```

---

## 🔗 See Also

- [SYNC_VERIFICATION.md](./SYNC_VERIFICATION.md) - Detailed sync status
- [000_READ_ME_FIRST.md](./000_READ_ME_FIRST.md) - Project overview
- [ACTION_PLAN.md](./ACTION_PLAN.md) - Development roadmap

---

## 💡 Tips

- **Hot reload:** Both frontend (Vite) and backend (nodemon) support hot reload in dev mode
- **Database:** Sequelize automatically syncs tables on startup
- **Logging:** Check terminal windows for detailed logs
- **API docs:** Available at http://localhost:3002/api-docs (if configured)

---

## ✨ Ready to Go!

Everything is synchronized and ready. Start with the Quick Start command above.

Good luck! 🚀
