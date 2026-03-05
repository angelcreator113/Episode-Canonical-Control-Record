# Deploy Backend to EC2 - Episode Canonical Control Record
# Syncs backend code to EC2 and restarts PM2
#
# IMPORTANT: PM2 runs from /home/ubuntu/episode-metadata/ (not the git repo dir).
# This script pulls latest code into the git repo, then copies route files,
# models, middleware, and app.js to the PM2 serving directory.

$ErrorActionPreference = "Stop"

$EC2_HOST = "ubuntu@52.91.217.230"
$KEY_FILE = "C:\Users\12483\episode-prod-key.pem"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   Deploying Backend to EC2" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Step 1: Pull latest code on EC2
Write-Host "[1/3] Pulling latest code..." -ForegroundColor Yellow

ssh -i $KEY_FILE $EC2_HOST "cd /home/ubuntu/Episode-Canonical-Control-Record && git pull origin dev"

if ($LASTEXITCODE -ne 0) {
    Write-Host "  Git pull failed" -ForegroundColor Red
    exit 1
}

Write-Host "  Pull successful" -ForegroundColor Green

# Step 2: Sync files from git repo to PM2 serving directory
Write-Host "`n[2/3] Syncing to PM2 serving directory..." -ForegroundColor Yellow

$SYNC_SCRIPT = @"
set -e
REPO=/home/ubuntu/Episode-Canonical-Control-Record
SERVE=/home/ubuntu/episode-metadata

echo "Syncing routes..."
cp -v \$REPO/src/routes/*.js \$SERVE/src/routes/

echo "Syncing app.js..."
cp -v \$REPO/app.js \$SERVE/app.js

echo "Syncing models..."
cp -v \$REPO/src/models/*.js \$SERVE/src/models/ 2>/dev/null || true

echo "Syncing middleware..."
cp -rv \$REPO/src/middleware/*.js \$SERVE/src/middleware/ 2>/dev/null || true

echo "Syncing services..."
cp -rv \$REPO/src/services/*.js \$SERVE/src/services/ 2>/dev/null || true

echo "Syncing server.js..."
cp -v \$REPO/src/server.js \$SERVE/src/server.js 2>/dev/null || true

echo "Syncing package.json..."
cp -v \$REPO/package.json \$SERVE/package.json

echo "Installing any new dependencies..."
cd \$SERVE && npm install --production --silent 2>&1 | tail -3

echo ""
echo "All files synced successfully!"
"@

$SYNC_SCRIPT | ssh -i $KEY_FILE $EC2_HOST "bash -s"

if ($LASTEXITCODE -ne 0) {
    Write-Host "  Sync failed" -ForegroundColor Red
    exit 1
}

Write-Host "  Sync successful" -ForegroundColor Green

# Step 3: Restart PM2
Write-Host "`n[3/3] Restarting PM2..." -ForegroundColor Yellow

ssh -i $KEY_FILE $EC2_HOST "pm2 restart episode-api && sleep 2 && pm2 status episode-api"

if ($LASTEXITCODE -ne 0) {
    Write-Host "  PM2 restart failed" -ForegroundColor Red
    exit 1
}

Write-Host "  PM2 restarted" -ForegroundColor Green

# Step 4: Quick health check
Write-Host "`n[4/4] Verifying..." -ForegroundColor Yellow

ssh -i $KEY_FILE $EC2_HOST "sleep 2 && curl -s -o /dev/null -w 'HTTP %{http_code}' http://localhost:3002/health || echo 'Health check failed'"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   Backend Deployment Complete!" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "API URL: http://dev.primepisodes.com/api/v1/" -ForegroundColor White
Write-Host "`nNote: PM2 serves from /home/ubuntu/episode-metadata/" -ForegroundColor Yellow
Write-Host "      Git repo is at /home/ubuntu/Episode-Canonical-Control-Record/" -ForegroundColor Yellow
