# Fix MIME Type Deployment Script
# This script:
# 1. Builds the frontend with proper settings
# 2. Deploys to EC2 /var/www/html/
# 3. Updates Nginx configuration to properly serve static files
# 4. Restarts services

$ErrorActionPreference = "Stop"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   Fix MIME Type - Deployment Script" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$EC2_HOST = "ubuntu@3.94.166.174"
$KEY_FILE = "C:\Users\12483\.ssh\Episode-Key-Pair.pem"
$PROJECT_ROOT = "C:\Users\12483\Projects\Episode-Canonical-Control-Record-1"

# Step 1: Build Frontend
Write-Host "[1/5] Building frontend..." -ForegroundColor Yellow
Push-Location "$PROJECT_ROOT\frontend"

try {
    Write-Host "  - Installing dependencies..." -ForegroundColor Gray
    npm install --silent 2>&1 | Out-Null
    
    Write-Host "  - Building production bundle..." -ForegroundColor Gray
    npm run build
    
    if (-not (Test-Path "dist\index.html")) {
        throw "Build failed - dist/index.html not found"
    }
    
    Write-Host "  ✓ Frontend built successfully" -ForegroundColor Green
}
catch {
    Write-Host "  ✗ Frontend build failed: $_" -ForegroundColor Red
    Pop-Location
    exit 1
}
finally {
    Pop-Location
}

# Step 2: Package frontend for deployment
Write-Host "`n[2/5] Packaging frontend..." -ForegroundColor Yellow
$BUILD_ARCHIVE = "$PROJECT_ROOT\frontend-build.tar.gz"

if (Test-Path $BUILD_ARCHIVE) {
    Remove-Item $BUILD_ARCHIVE -Force
}

Push-Location "$PROJECT_ROOT\frontend\dist"
tar -czf $BUILD_ARCHIVE *
Pop-Location

Write-Host "  ✓ Frontend packaged" -ForegroundColor Green

# Step 3: Upload to EC2
Write-Host "`n[3/5] Uploading to EC2..." -ForegroundColor Yellow
scp -i $KEY_FILE $BUILD_ARCHIVE "${EC2_HOST}:/tmp/frontend-build.tar.gz"

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Upload failed" -ForegroundColor Red
    exit 1
}

Write-Host "  ✓ Files uploaded" -ForegroundColor Green

# Step 4: Deploy on EC2
Write-Host "`n[4/5] Deploying on EC2..." -ForegroundColor Yellow

$DEPLOY_SCRIPT = @'
#!/bin/bash
set -e

echo "  - Extracting build..."
sudo rm -rf /var/www/html.backup 2>/dev/null || true
sudo mv /var/www/html /var/www/html.backup 2>/dev/null || true
sudo mkdir -p /var/www/html
cd /var/www/html
sudo tar -xzf /tmp/frontend-build.tar.gz
sudo chown -R www-data:www-data /var/www/html
sudo chmod -R 755 /var/www/html

echo "  - Verifying deployment..."
if [ ! -f "/var/www/html/index.html" ]; then
    echo "ERROR: index.html not found!"
    exit 1
fi

echo "  - Files deployed:"
ls -lh /var/www/html/

echo "  - Creating Nginx config..."
sudo tee /etc/nginx/sites-available/episode > /dev/null <<'NGINX_EOF'
server {
    listen 80 default_server;
    server_name dev.primepisodes.com www.primepisodes.com primepisodes.com 3.94.166.174;

    root /var/www/html;
    index index.html;

    # MIME type handling
    types {
        text/html                             html htm;
        text/css                              css;
        text/xml                              xml;
        application/javascript                js;
        application/json                      json;
        image/jpeg                            jpeg jpg;
        image/png                             png;
        image/gif                             gif;
        image/svg+xml                         svg svgz;
        image/x-icon                          ico;
        font/woff                             woff;
        font/woff2                            woff2;
    }

    # Default MIME type
    default_type application/octet-stream;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;

    # Frontend static files - MUST be first
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Content-Type $content_type;
    }

    # API proxy - backend requests
    location /api/ {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3002/health;
        proxy_http_version 1.1;
    }

    # React Router - SPA routing (MUST be last)
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
        add_header Content-Type "text/html; charset=utf-8";
    }
}
NGINX_EOF

echo "  - Enabling site..."
sudo ln -sf /etc/nginx/sites-available/episode /etc/nginx/sites-enabled/episode
sudo rm -f /etc/nginx/sites-enabled/default

echo "  - Testing Nginx config..."
sudo nginx -t

echo "  - Restarting Nginx..."
sudo systemctl restart nginx

echo "  - Verifying Nginx is running..."
sudo systemctl status nginx --no-pager -l

echo "✓ Deployment complete!"
'@

$DEPLOY_SCRIPT | ssh -i $KEY_FILE $EC2_HOST "bash -s"

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Deployment failed" -ForegroundColor Red
    exit 1
}

Write-Host "  ✓ Deployed successfully" -ForegroundColor Green

# Step 5: Verify
Write-Host "`n[5/5] Verifying deployment..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

try {
    $response = Invoke-WebRequest -Uri "http://dev.primepisodes.com/" -Method Get -UseBasicParsing -TimeoutSec 10
    $contentType = $response.Headers["Content-Type"][0]
    $hasHtml = $response.Content -match "<!doctype html>"
    
    Write-Host "`n  Response Details:" -ForegroundColor Gray
    Write-Host "    Status Code: $($response.StatusCode)" -ForegroundColor Gray
    Write-Host "    Content-Type: $contentType" -ForegroundColor Gray
    Write-Host "    Has HTML: $hasHtml" -ForegroundColor Gray
    
    if ($contentType -match "text/html" -and $hasHtml) {
        Write-Host "`n  Successfully deployed! Site is now serving HTML correctly!" -ForegroundColor Green
    }
    elseif ($contentType -match "application/json") {
        Write-Host "`n  Still returning application/json - may need cache clear" -ForegroundColor Yellow
        Write-Host "    Try: Ctrl+Shift+R in browser or wait for CDN cache to expire" -ForegroundColor Yellow
    }
    else {
        Write-Host "`n  Unexpected Content-Type: $contentType" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "  Verification failed: $_" -ForegroundColor Red
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   Deployment Complete!" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Test the site: http://dev.primepisodes.com/" -ForegroundColor White
Write-Host "Backend API: http://dev.primepisodes.com/api/v1/" -ForegroundColor White
Write-Host "Health: http://dev.primepisodes.com/health" -ForegroundColor White
