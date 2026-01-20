# Start Backend and Frontend Servers
# Run this script to start both servers in separate windows

Write-Host "🚀 Starting Episode Control Servers..." -ForegroundColor Cyan

# Kill any existing node processes for this project
Write-Host "🧹 Cleaning up old processes..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Where-Object {$_.Path -like "*Projects\Episode-Canonical-Control-Record-1*"} | Stop-Process -Force -ErrorAction SilentlyContinue

Start-Sleep -Seconds 1

# Start Backend Server
Write-Host "📡 Starting Backend Server (Port 3002)..." -ForegroundColor Green
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$PSScriptRoot'; Write-Host '🔧 BACKEND SERVER' -ForegroundColor Magenta; npm run dev"
)

Start-Sleep -Seconds 3

# Start Frontend Server
Write-Host "🎨 Starting Frontend Server (Port 5173)..." -ForegroundColor Green
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$PSScriptRoot\frontend'; Write-Host '🎨 FRONTEND SERVER' -ForegroundColor Cyan; npm run dev"
)

Start-Sleep -Seconds 4

Write-Host "✅ Servers starting..." -ForegroundColor Green
Write-Host "📍 Backend:  http://localhost:3002" -ForegroundColor Yellow
Write-Host "📍 Frontend: http://localhost:5173" -ForegroundColor Yellow
Write-Host ""
Write-Host "Opening browser..." -ForegroundColor Cyan
Start-Sleep -Seconds 2
Start-Process 'http://localhost:5173'
