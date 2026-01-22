@echo off
echo Waiting for server to be ready...
timeout /t 3 /nobreak >nul
echo.
echo Running E2E Tests...
echo.
node test-search-complete-e2e.js
pause
