# Simple Frontend Deployment Script
$ErrorActionPreference = "Stop"

Write-Host "`n========== Deploying Frontend ==========" -ForegroundColor Cyan

$EC2_HOST = "ubuntu@3.94.166.174"
$KEY_FILE = "C:\Users\12483\.ssh\Episode-Key-Pair.pem"
$PROJECT = "C:\Users\12483\Projects\Episode-Canonical-Control-Record-1"

# Check if key exists
if (-not (Test-Path $KEY_FILE)) {
    Write-Host "ERROR: SSH key not found at $KEY_FILE" -ForegroundColor Red
    Write-Host "Looking for alternative key files..." -ForegroundColor Yellow
    
    $altKeys = @(
        "C:\Users\12483\Downloads\Episode-Key-Pair.pem",
        "C:\Users\12483\.aws\Episode-Key-Pair.pem",
        "$env:USERPROFILE\.ssh\id_rsa"
    )
    
    foreach ($key in $altKeys) {
        if (Test-Path $key) {
            Write-Host "Found key at: $key" -ForegroundColor Green
            $KEY_FILE = $key
            break
        }
    }
    
    if (-not (Test-Path $KEY_FILE)) {
        Write-Host "No valid SSH key found. Please provide path:" -ForegroundColor Red
        exit 1
    }
}

Write-Host "Using SSH key: $KEY_FILE" -ForegroundColor Green

# Build frontend
Write-Host "`n[1/4] Building frontend..." -ForegroundColor Yellow
Push-Location "$PROJECT\frontend"
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location
Write-Host "  ✓ Build complete" -ForegroundColor Green

# Package
Write-Host "`n[2/4] Packaging..." -ForegroundColor Yellow
$archive = "$PROJECT\frontend-deploy.tar.gz"
if (Test-Path $archive) { Remove-Item $archive }
Push-Location "$PROJECT\frontend\dist"
tar -czf $archive *
Pop-Location
Write-Host "  ✓ Packaged" -ForegroundColor Green

# Upload
Write-Host "`n[3/4] Uploading..." -ForegroundColor Yellow
scp -i $KEY_FILE $archive "${EC2_HOST}:/tmp/frontend.tar.gz"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Upload failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Uploaded" -ForegroundColor Green

# Deploy
Write-Host "`n[4/4] Deploying on server..." -ForegroundColor Yellow

$remoteScript = @"
#!/bin/bash
set -ex

# Extract
sudo rm -rf /var/www/html.old
sudo mv /var/www/html /var/www/html.old 2>/dev/null || true
sudo mkdir -p /var/www/html
cd /var/www/html
sudo tar -xzf /tmp/frontend.tar.gz
sudo chown -R www-data:www-data /var/www/html
sudo chmod -R 755 /var/www/html

# Update Nginx config
sudo tee /etc/nginx/sites-available/episode > /dev/null <<'EOF'
server {
    listen 80 default_server;
    server_name dev.primepisodes.com;
    root /var/www/html;
    index index.html;

    # Static files with correct MIME types
    location ~* \.(js)$ {
        add_header Content-Type "application/javascript; charset=utf-8";
        expires 1y;
    }
    
    location ~* \.(css)$ {
        add_header Content-Type "text/css; charset=utf-8";
        expires 1y;
    }
    
    location ~* \.(html)$ {
        add_header Content-Type "text/html; charset=utf-8";
        add_header Cache-Control "no-cache";
    }

    # API proxy
    location /api/ {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    location /health {
        proxy_pass http://localhost:3002/health;
    }

    # SPA fallback
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/episode /etc/nginx/sites-enabled/episode
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

echo "Deployment complete!"
"@

$remoteScript | ssh -i $KEY_FILE $EC2_HOST "bash -s"

if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Deployed!" -ForegroundColor Green
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "Test: http://dev.primepisodes.com/" -ForegroundColor White
} else {
    Write-Host "  ✗ Deployment failed" -ForegroundColor Red
    exit 1
}
