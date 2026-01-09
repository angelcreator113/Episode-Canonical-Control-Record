@echo off
REM Quick Startup Script for Episode Metadata Application
REM This script starts both backend and frontend in the correct configuration

setlocal enabledelayedexpansion

echo.
echo ╔════════════════════════════════════════════════════════════════════╗
echo ║         Episode Metadata Application - Synchronized Startup         ║
echo ╚════════════════════════════════════════════════════════════════════╝
echo.

REM Check if Docker is running
echo [1/4] Checking Docker status...
docker ps >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)
echo ✅ Docker is running

REM Start Docker containers
echo.
echo [2/4] Starting Docker services (PostgreSQL + LocalStack)...
cd "c:\Users\12483\prime studios\BRD\Episode-Canonical-Control-Record"
docker-compose up -d >nul 2>&1
if errorlevel 1 (
    echo ⚠️ Docker services might already be running
) else (
    echo ✅ Docker services started
    timeout /t 3 /nobreak
)

REM Kill existing Node processes
echo.
echo [3/4] Cleaning up existing Node processes...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak

REM Start Backend
echo.
echo [4/4] Starting application...
echo.
echo ╭─────────────────────────────────────────────────────────────────╮
echo │ BACKEND: Starting on http://localhost:3002                      │
echo │ FRONTEND: Will start on http://localhost:5173                   │
echo │ DATABASE: PostgreSQL on localhost:5432                          │
echo ╰─────────────────────────────────────────────────────────────────╯
echo.

REM Start backend in background
echo Starting backend API...
start /B cmd /C "cd "c:\Users\12483\prime studios\BRD\Episode-Canonical-Control-Record" && npm start"
timeout /t 5 /nobreak

REM Start frontend in background
echo Starting frontend dev server...
start /B cmd /C "cd "c:\Users\12483\prime studios\BRD\Episode-Canonical-Control-Record\frontend" && npm run dev"
timeout /t 3 /nobreak

echo.
echo ✅ Application startup initiated!
echo.
echo 📍 ACCESS POINTS:
echo    Frontend: http://localhost:5173
echo    Backend API: http://localhost:3002
echo    API Docs: http://localhost:3002/api-docs (if available)
echo.
echo 🔍 TEST CONNECTIONS:
echo    curl http://localhost:3002/ping
echo    curl http://localhost:5173
echo.
echo 📋 LOGS:
echo    Backend: Check the backend terminal window
echo    Frontend: Check the frontend terminal window
echo.
echo 🛑 TO STOP: Close terminal windows or run "taskkill /F /IM node.exe"
echo.
pause
