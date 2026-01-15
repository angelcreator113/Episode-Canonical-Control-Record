# ✅ Phase 1 Complete - Certificate Issued | Now Configure Nginx

**Status:** ACM Certificate ISSUED ✅  
**Next:** Download certificate and configure Nginx for HTTPS

---

## Step 1: Download Certificate Files from AWS Console

1. **Go to AWS Console** → Certificate Manager
2. **Click on your primepisodes.com certificate**
3. **Look for the download section** (Usually shows certificate and key)
4. **Download three files:**
   - ✅ Certificate (PEM format) - `primepisodes.crt`
   - ✅ Private key (PEM format) - `primepisodes.key`
   - ✅ Certificate chain (PEM format) - `certificate-chain.pem`

**Files should be saved to your Downloads folder or similar**

---

## Step 2: Upload Certificate Files to Frontend Server

Run these commands from your local PowerShell:

```powershell
# Set paths to your downloaded files
$CERT_FILE = "C:\Path\To\Downloads\primepisodes.crt"
$KEY_FILE = "C:\Path\To\Downloads\primepisodes.key"
$CHAIN_FILE = "C:\Path\To\Downloads\certificate-chain.pem"

$SERVER = "ubuntu@52.91.217.230"
$KEY_PATH = "C:\Users\12483\episode-prod-key.pem"

# Create /tmp directory on server (if needed)
ssh -i $KEY_PATH $SERVER "mkdir -p /tmp/certs"

# Upload certificate files
scp -i $KEY_PATH $CERT_FILE "${SERVER}:/tmp/certs/primepisodes.crt"
scp -i $KEY_PATH $KEY_FILE "${SERVER}:/tmp/certs/primepisodes.key"
scp -i $KEY_PATH $CHAIN_FILE "${SERVER}:/tmp/certs/certificate-chain.pem"

Write-Host "✅ Certificate files uploaded"
```

---

## Step 3: Move Files to Proper Location on Server

SSH to frontend and move files:

```powershell
ssh -i C:\Users\12483\episode-prod-key.pem ubuntu@52.91.217.230
```

Then run these commands on the server:

```bash
# Move certificate files to proper locations
sudo mv /tmp/certs/primepisodes.crt /etc/ssl/certs/
sudo mv /tmp/certs/primepisodes.key /etc/ssl/private/
sudo mv /tmp/certs/certificate-chain.pem /etc/ssl/certs/

# Set proper permissions
sudo chmod 644 /etc/ssl/certs/primepisodes.crt
sudo chmod 600 /etc/ssl/private/primepisodes.key
sudo chmod 644 /etc/ssl/certs/certificate-chain.pem

# Verify files exist
ls -la /etc/ssl/certs/primepisodes.*
ls -la /etc/ssl/private/primepisodes.key

echo "✅ Certificates in place"
```

---

## Step 4: Configure Nginx for HTTPS

Still on the server, update Nginx configuration:

```bash
sudo tee /etc/nginx/sites-available/default > /dev/null << 'EOF'
# HTTP - Redirect all to HTTPS
server {
    listen 80;
    server_name www.primepisodes.com primepisodes.com;
    
    return 301 https://$server_name$request_uri;
}

# HTTPS - Secure connection
server {
    listen 443 ssl http2;
    server_name www.primepisodes.com primepisodes.com;
    
    # SSL Certificates from ACM
    ssl_certificate /etc/ssl/certs/primepisodes.crt;
    ssl_certificate_key /etc/ssl/private/primepisodes.key;
    
    # SSL Configuration for security
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # API Proxy to backend
    location /api/ {
        proxy_pass http://3.94.166.174:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Catch-all for any other requests
    location / {
        proxy_pass http://3.94.166.174:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
    }
}
EOF

echo "✅ Nginx configuration updated"
```

---

## Step 5: Test Nginx Configuration

Still on the server:

```bash
# Test the configuration file for syntax errors
sudo nginx -t

# Expected output:
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful
```

If there are errors, check:
- Certificate path is correct: `ls -la /etc/ssl/certs/primepisodes.crt`
- Key path is correct: `ls -la /etc/ssl/private/primepisodes.key`
- Permissions are right: `sudo chmod 644 /etc/ssl/certs/primepisodes.crt`

---

## Step 6: Reload Nginx

Still on the server:

```bash
# Reload Nginx (zero-downtime reload)
sudo systemctl reload nginx

# Verify it's running
sudo systemctl status nginx

# Should show: active (running)

echo "✅ Nginx reloaded with HTTPS"
```

---

## Step 7: Test HTTPS from Your Local Machine

Exit SSH and run these from your local PowerShell:

```powershell
# Test HTTPS endpoint
curl https://www.primepisodes.com/api/v1/episodes?limit=2

# Should return episode data with HTTPS

# Get response headers with certificate info
curl -I https://www.primepisodes.com/api/v1/episodes

# Check the certificate
curl --cacert c:\Users\12483\episode-prod-key.pem -v https://www.primepisodes.com/api/v1/episodes 2>&1 | Select-String -Pattern "certificate|subject|issuer"
```

**Expected Results:**
- ✅ Data returns via HTTPS
- ✅ Certificate shows as valid (no warnings)
- ✅ HTTP redirects to HTTPS

---

## Step 8: Verify HTTP Redirect to HTTPS

```powershell
# Test that HTTP redirects to HTTPS
curl -I http://www.primepisodes.com

# Expected:
# HTTP/1.1 301 Moved Permanently
# Location: https://www.primepisodes.com/
```

---

## 🧪 Full Verification Test

Run this complete test:

```powershell
Write-Host "Testing HTTPS Configuration..." -ForegroundColor Cyan
Write-Host ""

# Test 1: HTTPS API call
Write-Host "1. Testing HTTPS API..." -ForegroundColor Yellow
$response = curl -s https://www.primepisodes.com/api/v1/episodes?limit=1
if ($response) {
    Write-Host "   ✅ HTTPS API Working" -ForegroundColor Green
    $data = $response | ConvertFrom-Json
    Write-Host "   Episodes returned: $($data.pagination.total)" -ForegroundColor Green
} else {
    Write-Host "   ❌ HTTPS API Failed" -ForegroundColor Red
}

# Test 2: HTTP Redirect
Write-Host ""
Write-Host "2. Testing HTTP→HTTPS Redirect..." -ForegroundColor Yellow
$redirect = curl -I http://www.primepisodes.com 2>&1
if ($redirect -match "301|302|307") {
    Write-Host "   ✅ HTTP Redirect Working" -ForegroundColor Green
} else {
    Write-Host "   ❌ HTTP Redirect Failed" -ForegroundColor Red
}

# Test 3: Certificate
Write-Host ""
Write-Host "3. Testing Certificate..." -ForegroundColor Yellow
$cert = echo | openssl s_client -servername www.primepisodes.com -connect www.primepisodes.com:443 2>/dev/null | openssl x509 -noout -dates
if ($cert) {
    Write-Host "   ✅ Certificate Valid" -ForegroundColor Green
    Write-Host "   $cert" -ForegroundColor Green
} else {
    Write-Host "   ❌ Certificate Check Failed" -ForegroundColor Red
}

Write-Host ""
Write-Host "════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ PHASE 1 COMPLETE: HTTPS IS LIVE!" -ForegroundColor Green
Write-Host "════════════════════════════════════════════" -ForegroundColor Cyan
```

---

## ✅ Phase 1 Checklist

- [ ] Downloaded certificate files from ACM console
- [ ] Uploaded files to server via SCP
- [ ] Moved files to `/etc/ssl/certs/` and `/etc/ssl/private/`
- [ ] Updated Nginx configuration with HTTPS
- [ ] Ran `sudo nginx -t` successfully
- [ ] Reloaded Nginx with `sudo systemctl reload nginx`
- [ ] Tested HTTPS: `curl https://www.primepisodes.com/api/v1/episodes?limit=1`
- [ ] Verified HTTP redirect to HTTPS
- [ ] Confirmed certificate is valid

---

## 🚀 What's Next - Phase 2 (Option C)

Once you confirm HTTPS is working, we'll proceed to Phase 2:
- Create Application Load Balancer (ALB)
- Add HTTPS listeners
- Update Route53 to ALB
- Test high-availability setup

**Reply when you've completed the steps above and confirmed HTTPS is working!**

---

## ⚠️ Troubleshooting

### Nginx test fails
```bash
sudo nginx -T  # Shows detailed errors
sudo tail -f /var/log/nginx/error.log  # Real-time error log
```

### Certificate not found
```bash
sudo ls -la /etc/ssl/certs/primepisodes.crt
sudo ls -la /etc/ssl/private/primepisodes.key
```

### HTTPS not responding
```bash
sudo systemctl restart nginx
sudo systemctl status nginx
curl -v https://www.primepisodes.com  # Verbose output
```

### Redirect loop
- Ensure Nginx is properly configured (check Step 4)
- Check that backend is responding: `curl http://3.94.166.174:3002/api/v1/episodes`

