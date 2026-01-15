@echo off
REM Episode Canonical Control - Start Script (Windows)
REM Starts both backend API server and frontend development server

echo.
echo ========================================
echo   Episode Canonical Control System
echo   Phase 3 - Version 1.0
echo ========================================
echo.

setlocal enabledelayedexpansion

REM Check if Node.js is installed
node --version > nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    exit /b 1
)

REM Get the script directory
set "SCRIPT_DIR=%~dp0"

echo [1/4] Checking backend dependencies...
if not exist "%SCRIPT_DIR%node_modules" (
    echo [2/4] Installing backend dependencies...
    cd /d "%SCRIPT_DIR%"
    call npm install
) else (
    echo [2/4] Backend dependencies already installed
)

echo [3/4] Checking frontend dependencies...
if not exist "%SCRIPT_DIR%frontend\node_modules" (
    echo [4/4] Installing frontend dependencies...
    cd /d "%SCRIPT_DIR%frontend"
    call npm install
) else (
    echo [4/4] Frontend dependencies already installed
)

echo.
echo ========================================
echo   Starting Services...
echo ========================================
echo.

REM Start backend server
echo Starting backend API server (port 3002)...
cd /d "%SCRIPT_DIR%"
start "Episode API Server" cmd /k npm start

REM Wait for backend to start
timeout /t 5 /nobreak

REM Start frontend dev server
echo Starting frontend development server (port 5173)...
cd /d "%SCRIPT_DIR%frontend"
start "Episode Frontend Dev" cmd /k npm run dev

echo.
echo ========================================
echo   System Started Successfully!
echo ========================================
echo.
echo   Frontend:  http://localhost:5173
echo   API:       http://localhost:3002
echo   Health:    http://localhost:3002/health
echo.
echo   Close either terminal window to stop that service
echo   Close both windows to stop the system
echo.

exit /b 0
