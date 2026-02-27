# Simple deployment script for dev site
$ErrorActionPreference = "Stop"

$EC2_HOST = "ubuntu@52.91.217.230"
$KEY_FILE = "C:\Users\12483\episode-prod-key.pem"
$PROJECT_ROOT = "C:\Users\12483\Projects\Episode-Canonical-Control-Record-1"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   Deploying to Dev Site" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Step 1: Build Frontend
Write-Host "[1/4] Building frontend..." -ForegroundColor Yellow
Push-Location "$PROJECT_ROOT\frontend"

try {
    npm install --silent 2>&1 | Out-Null
    npm run build
    
    if (-not (Test-Path "dist\index.html")) {
        throw "Build failed - dist/index.html not found"
    }
    
    Write-Host "  Build successful" -ForegroundColor Green
}
catch {
    Write-Host "  Build failed: $_" -ForegroundColor Red
    Pop-Location
    exit 1
}
finally {
    Pop-Location
}

# Step 2: Package
Write-Host "`n[2/4] Packaging..." -ForegroundColor Yellow
$BUILD_ARCHIVE = "$PROJECT_ROOT\frontend-build.tar.gz"

if (Test-Path $BUILD_ARCHIVE) {
    Remove-Item $BUILD_ARCHIVE -Force
}

Push-Location "$PROJECT_ROOT\frontend\dist"
tar -czf $BUILD_ARCHIVE *
Pop-Location

Write-Host "  Packaged successfully" -ForegroundColor Green

# Step 3: Upload to EC2
Write-Host "`n[3/4] Uploading to EC2..." -ForegroundColor Yellow
scp -i $KEY_FILE $BUILD_ARCHIVE "${EC2_HOST}:/tmp/frontend-build.tar.gz"

if ($LASTEXITCODE -ne 0) {
    Write-Host "  Upload failed" -ForegroundColor Red
    exit 1
}

Write-Host "  Uploaded successfully" -ForegroundColor Green

# Step 4: Deploy on EC2
Write-Host "`n[4/4] Deploying on EC2..." -ForegroundColor Yellow

ssh -i $KEY_FILE $EC2_HOST "set -e; echo 'Backing up...'; sudo rm -rf /var/www/html.backup 2>/dev/null || true; sudo mv /var/www/html /var/www/html.backup 2>/dev/null || true; echo 'Extracting...'; sudo mkdir -p /var/www/html; cd /var/www/html; sudo tar -xzf /tmp/frontend-build.tar.gz; sudo chown -R www-data:www-data /var/www/html; sudo chmod -R 755 /var/www/html; echo 'Restarting Nginx...'; sudo systemctl restart nginx; echo 'Deployment complete!'; ls -lh /var/www/html/"

if ($LASTEXITCODE -ne 0) {
    Write-Host "  Deployment failed" -ForegroundColor Red
    exit 1
}

Write-Host "  Deployment successful" -ForegroundColor Green

# Step 5: Verify
Write-Host "`n[5/5] Verifying deployment..." -ForegroundColor Yellow

Start-Sleep -Seconds 3

try {
    $response = Invoke-WebRequest -Uri "http://dev.primepisodes.com/" -Method Get -UseBasicParsing -TimeoutSec 10
    $contentType = $response.Headers["Content-Type"][0]
    
    Write-Host "  Status Code: $($response.StatusCode)" -ForegroundColor Gray
    Write-Host "  Content-Type: $contentType" -ForegroundColor Gray
    
    if ($response.StatusCode -eq 200) {
        Write-Host "`nDeployment verified successfully!" -ForegroundColor Green
    }
}
catch {
    Write-Host "  Verification warning: $_" -ForegroundColor Yellow
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   Deployment Complete!" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Site URL: http://dev.primepisodes.com/" -ForegroundColor White
Write-Host "API URL: http://dev.primepisodes.com/api/v1/" -ForegroundColor White
Write-Host "`nNote: Clear browser cache (Ctrl+Shift+R) to see changes" -ForegroundColor Yellow
