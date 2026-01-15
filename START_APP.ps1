#!/usr/bin/env pwsh
# Quick Startup Script for Episode Metadata Application (PowerShell)
# This script starts both backend and frontend with proper configuration

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         Episode Metadata Application - Synchronized Startup         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "[1/4] Checking Docker status..." -ForegroundColor Yellow
try {
    docker ps | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
}
catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Start Docker containers
Write-Host ""
Write-Host "[2/4] Starting Docker services (PostgreSQL + LocalStack)..." -ForegroundColor Yellow
Set-Location "c:\Users\12483\prime studios\BRD\Episode-Canonical-Control-Record"
$dockerOutput = docker-compose up -d 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ Docker services might already be running" -ForegroundColor Yellow
}
else {
    Write-Host "✅ Docker services started" -ForegroundColor Green
}
Start-Sleep -Seconds 3

# Kill existing Node processes
Write-Host ""
Write-Host "[3/4] Cleaning up existing Node processes..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Display startup info
Write-Host ""
Write-Host "[4/4] Starting application..." -ForegroundColor Yellow
Write-Host ""
Write-Host "╭─────────────────────────────────────────────────────────────────╮" -ForegroundColor Cyan
Write-Host "│ BACKEND: Starting on http://localhost:3002                      │" -ForegroundColor Cyan
Write-Host "│ FRONTEND: Will start on http://localhost:5173                   │" -ForegroundColor Cyan
Write-Host "│ DATABASE: PostgreSQL on localhost:5432                          │" -ForegroundColor Cyan
Write-Host "╰─────────────────────────────────────────────────────────────────╯" -ForegroundColor Cyan
Write-Host ""

# Start backend in background
Write-Host "Starting backend API..." -ForegroundColor White
$backendProcess = Start-Process -FilePath "cmd" -ArgumentList "/c npm start" `
    -WorkingDirectory "c:\Users\12483\prime studios\BRD\Episode-Canonical-Control-Record" `
    -PassThru -NoNewWindow
Write-Host "Backend PID: $($backendProcess.Id)" -ForegroundColor DarkGray
Start-Sleep -Seconds 5

# Start frontend in background
Write-Host "Starting frontend dev server..." -ForegroundColor White
$frontendProcess = Start-Process -FilePath "cmd" -ArgumentList "/c npm run dev" `
    -WorkingDirectory "c:\Users\12483\prime studios\BRD\Episode-Canonical-Control-Record\frontend" `
    -PassThru -NoNewWindow
Write-Host "Frontend PID: $($frontendProcess.Id)" -ForegroundColor DarkGray
Start-Sleep -Seconds 3

# Display access information
Write-Host ""
Write-Host "✅ Application startup initiated!" -ForegroundColor Green
Write-Host ""
Write-Host "📍 ACCESS POINTS:" -ForegroundColor Cyan
Write-Host "   Frontend:  http://localhost:5173" -ForegroundColor White
Write-Host "   Backend:   http://localhost:3002" -ForegroundColor White
Write-Host "   Database:  localhost:5432 (PostgreSQL)" -ForegroundColor White
Write-Host ""
Write-Host "🔍 VERIFY CONNECTIONS:" -ForegroundColor Cyan
Write-Host "   Backend:   curl http://localhost:3002/ping" -ForegroundColor DarkGray
Write-Host "   Frontend:  curl http://localhost:5173" -ForegroundColor DarkGray
Write-Host ""
Write-Host "📋 PROCESS IDs:" -ForegroundColor Cyan
Write-Host "   Backend:   $($backendProcess.Id)" -ForegroundColor DarkGray
Write-Host "   Frontend:  $($frontendProcess.Id)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "🛑 TO STOP:" -ForegroundColor Cyan
Write-Host "   Get-Process node | Stop-Process -Force" -ForegroundColor DarkGray
Write-Host ""

Write-Host "Keeping processes running... Press Ctrl+C to stop." -ForegroundColor Yellow
try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
}
finally {
    Write-Host ""
    Write-Host "Shutting down application..." -ForegroundColor Yellow
    Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "✅ Application stopped" -ForegroundColor Green
}
