# Deploy to EC2 - Episode Canonical Control Record
# Run this script to deploy frontend to your EC2 instance

$EC2_IP = "3.94.166.174"
$KEY_FILE = "C:\Users\12483\episode-prod-key.pem"
$LOCAL_FRONTEND = "deploy-package\frontend-build"

Write-Host "🚀 Deploying frontend to EC2..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Upload frontend build
Write-Host "📦 Step 1: Uploading frontend files..." -ForegroundColor Yellow
scp -i $KEY_FILE -r $LOCAL_FRONTEND ubuntu@${EC2_IP}:/home/ubuntu/frontend-build-new

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Upload successful!" -ForegroundColor Green
} else {
    Write-Host "❌ Upload failed!" -ForegroundColor Red
    exit 1
}

# Step 2: SSH and deploy
Write-Host ""
Write-Host "⚙️  Step 2: Installing files on server..." -ForegroundColor Yellow

$COMMANDS = @"
# Backup old files if they exist
sudo rm -rf /var/www/html.backup
sudo mv /var/www/html /var/www/html.backup 2>/dev/null || true

# Copy new build
sudo mkdir -p /var/www/html
sudo cp -r /home/ubuntu/frontend-build-new/* /var/www/html/
sudo chown -R www-data:www-data /var/www/html
sudo chmod -R 755 /var/www/html

# Create Nginx config
sudo tee /etc/nginx/sites-available/episode > /dev/null <<'NGINXEOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    server_name _;
    root /var/www/html;
    index index.html;

    # Frontend - SPA routing
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3002/health;
    }
}
NGINXEOF

# Enable site and reload Nginx
sudo ln -sf /etc/nginx/sites-available/episode /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Frontend: http://3.94.166.174/"
echo "🔌 API: http://3.94.166.174/api/"
echo "❤️  Health: http://3.94.166.174/health"
"@

ssh -i $KEY_FILE ubuntu@$EC2_IP $COMMANDS

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "🎉 DEPLOYMENT SUCCESSFUL!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your application is now live at:" -ForegroundColor Cyan
    Write-Host "  🌐 Frontend: http://3.94.166.174/" -ForegroundColor White
    Write-Host "  🔌 API:      http://3.94.166.174/api/" -ForegroundColor White
    Write-Host "  ❤️  Health:  http://3.94.166.174/health" -ForegroundColor White
    Write-Host ""
    Write-Host "Test it:" -ForegroundColor Yellow
    Write-Host "  curl http://3.94.166.174/" -ForegroundColor Gray
    Write-Host "  curl http://3.94.166.174/health" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    exit 1
}
