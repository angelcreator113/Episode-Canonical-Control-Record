# Manual Fix Instructions for MIME Type Issue

Write-Host @"

========================================
 FIX FOR: dev.primepisodes.com 
 MIME Type Issue (HTML as JSON)
========================================

ROOT CAUSE:
-----------
Nginx is not serving static files from /var/www/html/
Instead, ALL requests (including /) are proxying to Node.js backend on port 3002
The backend is setting Content-Type: application/json for the HTML file

SOLUTION:
---------
1. Deploy frontend build to /var/www/html/
2. Configure Nginx to serve static files directly
3. Only proxy /api/* and /health to backend

STEPS TO FIX:
-------------

1. BUILD FRONTEND LOCALLY:
   cd C:\Users\12483\Projects\Episode-Canonical-Control-Record-1\frontend
   npm run build

2. CONNECT TO EC2:
   ssh -i ~/.ssh/Episode-Key-Pair.pem ubuntu@3.94.166.174

3. ON THE SERVER, RUN THESE COMMANDS:

# Deploy frontend files
sudo rm -rf /var/www/html.old
sudo mv /var/www/html /var/www/html.old
sudo mkdir -p /var/www/html

# Now upload frontend build from local machine with SCP:
# (From your Windows machine in a NEW terminal)
# scp -r frontend/dist/* ubuntu@3.94.166.174:/tmp/frontend-build/
#
# Then back on the server:
sudo mv /tmp/frontend-build/* /var/www/html/
sudo chown -R www-data:www-data /var/www/html
sudo chmod -R 755 /var/www/html

# Verify files exist
ls -la /var/www/html/

4. CREATE PROPER NGINX CONFIG:

sudo nano /etc/nginx/sites-available/episode

# PASTE THIS CONFIGURATION:
# ============================================
server {
    listen 80 default_server;
    server_name dev.primepisodes.com;
    
    root /var/www/html;
    index index.html;

    # Explicit MIME types for static assets
    location ~* \.js$ {
        types { application/javascript js; }
        default_type application/javascript;
        expires 1y;
        add_header Cache-Control "public";
    }
    
    location ~* \.css$ {
        types { text/css css; }
        default_type text/css;
        expires 1y;
        add_header Cache-Control "public";
    }
    
    location ~* \.(png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public";
    }

    # Backend API proxy
    location /api/ {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    # Health endpoint
    location /health {
        proxy_pass http://localhost:3002/health;
    }

    # SPA fallback for React Router
    location / {
        try_files \$uri \$uri/ /index.html;
        types { text/html html; }
        default_type text/html;
        add_header Cache-Control "no-cache";
    }
}
# ============================================

5. ENABLE CONFIG & RESTART:

sudo ln -sf /etc/nginx/sites-available/episode /etc/nginx/sites-enabled/episode
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

6. VERIFY:

curl -I http://dev.primepisodes.com/
# Should show: Content-Type: text/html

curl -I http://dev.primepisodes.com/assets/index-[hash].js
# Should show: Content-Type: application/javascript

========================================

ALTERNATIVE: If SSH key issue, use AWS Systems Manager Session Manager
Or upload via S3 and download on server

"@

Write-Host "`nTo proceed automatically, run these PowerShell commands:" -ForegroundColor Yellow
Write-Host "1. cd frontend; npm run build" -ForegroundColor Gray
Write-Host "2. Use WinSCP or FileZilla to upload dist/* to /var/www/html/" -ForegroundColor Gray
Write-Host "3. Or use AWS S3 as intermediate storage" -ForegroundColor Gray
