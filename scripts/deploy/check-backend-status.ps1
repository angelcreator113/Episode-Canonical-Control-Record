# Check Backend Server Status
# This script helps diagnose why the backend API isn't responding

Write-Host "`n=== Checking Backend Status ===" -ForegroundColor Cyan

# Check if EC2 SSH key is configured
if (-not $env:EC2_SSH_KEY) {
    Write-Host "⚠️  EC2_SSH_KEY environment variable not set" -ForegroundColor Yellow
    Write-Host "To connect to EC2, you need:" -ForegroundColor Yellow
    Write-Host "  1. Your EC2 SSH key file (.pem)" -ForegroundColor Yellow
    Write-Host "  2. Your EC2 host address" -ForegroundColor Yellow
    Write-Host ""
}

# Test if the frontend is reachable
Write-Host "`n1. Testing Frontend..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "https://dev.primepisodes.com" -Method GET -TimeoutSec 10 -UseBasicParsing
    Write-Host "✅ Frontend is accessible (HTTP $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "❌ Frontend is not accessible: $($_.Exception.Message)" -ForegroundColor Red
}

# Test if the health endpoint responds
Write-Host "`n2. Testing Backend Health Endpoint..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "https://dev.primepisodes.com/health" -Method GET -TimeoutSec 10 -UseBasicParsing
    Write-Host "✅ Backend health endpoint is responding (HTTP $($response.StatusCode))" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Gray
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "❌ Backend health endpoint failed (HTTP $statusCode)" -ForegroundColor Red
    if ($statusCode -eq 502) {
        Write-Host "   → 502 Bad Gateway means nginx can't reach the backend on port 3002" -ForegroundColor Yellow
    }
}

# Test if any API endpoint responds
Write-Host "`n3. Testing Backend API Endpoint..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "https://dev.primepisodes.com/api/v1/episodes" -Method GET -TimeoutSec 10 -UseBasicParsing
    Write-Host "✅ Backend API is responding (HTTP $($response.StatusCode))" -ForegroundColor Green
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "❌ Backend API failed (HTTP $statusCode)" -ForegroundColor Red
}

Write-Host "`n=== Diagnosis ===" -ForegroundColor Cyan

Write-Host @"

The 502 Bad Gateway error indicates that nginx (web server) cannot connect to the 
backend Node.js application on port 3002.

Common causes:
  1. PM2 process is not running or crashed
  2. Backend app failed to start due to error
  3. Database connection issues
  4. Port 3002 is not listening

To debug this, you need to SSH into your EC2 instance and check:

  # Check if PM2 is running
  pm2 status
  pm2 logs episode-api --lines 50

  # Check if anything is listening on port 3002
  sudo ss -tlnp | grep 3002
  # or
  sudo lsof -i :3002

  # Check nginx error logs
  sudo tail -50 /var/log/nginx/error.log

  # Restart the backend if needed
  cd ~/episode-metadata
  pm2 restart episode-api
  pm2 logs episode-api --lines 50

"@ -ForegroundColor Yellow

Write-Host "`nWould you like help creating an SSH command to connect to your EC2 instance? (y/n)" -ForegroundColor Cyan
