# ✅ MIME Type Fix - Deployment Complete

## Status: 95% Complete - Final ALB Configuration Needed

### What Was Done ✅

1. **Frontend Build** ✅
   - Built production bundle: `npm run build`
   - Bundle size: ~2.6 MB (optimized)
   - Files: index.html + assets (JS, CSS, images)

2. **Server Deployment** ✅
   - Uploaded frontend build to EC2: `/var/www/html/`
   - Set proper permissions: `www-data:www-data`, `755`
   - Verified files are in place

3. **Nginx Configuration** ✅
   - Created `/etc/nginx/sites-available/episode`
   - Configured proper MIME types for JS, CSS, HTML
   - Set up SPA routing with `try_files`
   - Configured API proxy to `localhost:3002`
   - Enabled site and restarted Nginx
   - **Verified:** `curl http://localhost/` returns `Content-Type: text/html` ✅

### Root Cause Identified 🔍

**The Problem:**
- `dev.primepisodes.com` is behind an **Application Load Balancer (ALB)**
- ALB is currently routing to **EC2 port 3002** (Node.js backend)
- This **bypasses Nginx on port 80** entirely
- Result: Backend returns HTML with `Content-Type: application/json`

**Evidence:**
```bash
# On EC2 server (direct to Nginx port 80):
curl -I http://localhost/
→ Content-Type: text/html; charset=utf-8 ✅

# Through domain (ALB → EC2:3002):
curl -I http://dev.primepisodes.com/
→ Content-Type: application/json; charset=utf-8 ❌
→ Has Helmet headers (X-Frame-Options, etc.) → confirming Node.js response
```

### Final Step Required 🎯

**Update ALB Target Group to point to port 80 instead of 3002**

#### Option A: AWS Console (Manual - 2 minutes)

1. **Go to AWS Console:**
   - Services → EC2 → Target Groups
   - Or: https://console.aws.amazon.com/ec2/v2/home?region=us-east-1#TargetGroups

2. **Find Target Group:**
   - Look for target group containing "episode" or "prime" in the name
   - Current port: **3002**

3. **Edit Target:**
   - Select the target group
   - Click "Targets" tab
   - Select the EC2 instance
   - Click "Edit" → Change port from **3002** to **80**
   - Save changes

4. **Wait for Health Check:**
   - Status will show "unhealthy" briefly
   - After 30-60 seconds: "healthy" (green)

5. **Verify:**
   ```powershell
   Invoke-WebRequest -Uri "http://dev.primepisodes.com/" -UseBasicParsing | 
     Select-Object StatusCode, @{N='ContentType';E={$_.Headers.'Content-Type'}}
   ```
   Should return: `Content-Type: text/html; charset=utf-8`

#### Option B: AWS CLI (Automated)

```powershell
# 1. Find target group
$TG_ARN = (aws elbv2 describe-target-groups `
  --query "TargetGroups[?contains(TargetGroupName, 'episode')].TargetGroupArn" `
  --output text)

# 2. Get instance ID
$INSTANCE_ID = "i-02ae7608c531db485"

# 3. Deregister old target (port 3002)
aws elbv2 deregister-targets `
  --target-group-arn $TG_ARN `
  --targets "Id=$INSTANCE_ID,Port=3002"

# 4. Register new target (port 80)
aws elbv2 register-targets `
  --target-group-arn $TG_ARN `
  --targets "Id=$INSTANCE_ID,Port=80"

# 5. Wait for health check
Start-Sleep -Seconds 60

# 6. Verify
aws elbv2 describe-target-health --target-group-arn $TG_ARN
```

### Verification Checklist ☑️

After updating the ALB target:

- [ ] Root URL returns `text/html`:
  ```bash
  curl -I http://dev.primepisodes.com/
  ```

- [ ] JavaScript files return `application/javascript`:
  ```bash
  curl -I http://dev.primepisodes.com/assets/index-*.js
  ```

- [ ] CSS files return `text/css`:
  ```bash
  curl -I http://dev.primepisodes.com/assets/index-*.css
  ```

- [ ] React app renders in browser:
  - Open http://dev.primepisodes.com/
  - Should see the UI, not HTML source code
  - Browser console: no MIME type errors

- [ ] API endpoints still work:
  ```bash
  curl http://dev.primepisodes.com/api/v1/health
  # Should return JSON with backend health info
  ```

### Architecture After Fix

```
User Browser
     ↓
DNS (Route 53): dev.primepisodes.com
     ↓
Application Load Balancer (ALB)
     ↓ port 80
EC2 Instance: Nginx
     ├─ Static files → /var/www/html/ (HTML, JS, CSS)
     └─ API requests → localhost:3002 (Node.js backend)
```

### Files Modified

**Local (committed to repo):**
- [src/app.js](src/app.js) - Fixed helmet() and express.json() middleware
- [MIME_TYPE_FIX_GUIDE.md](MIME_TYPE_FIX_GUIDE.md) - Complete documentation

**Server (deployed):**
- `/var/www/html/*` - Frontend build files
- `/etc/nginx/sites-available/episode` - Nginx configuration
- `/etc/nginx/sites-enabled/episode` - Enabled site symlink

### Rollback Instructions (if needed)

If something breaks:

```bash
# 1. SSH to EC2
ssh -i ~/.ssh/episode-prod-key.pem ubuntu@3.94.166.174

# 2. Restore old frontend
sudo rm -rf /var/www/html
sudo mv /var/www/html.backup /var/www/html

# 3. Revert ALB target to port 3002
# (Use AWS Console or CLI to point back to 3002)

# 4. Restart services
sudo systemctl restart nginx
```

### Next Steps After Fix

1. ✅ Confirm site loads correctly in browser
2. 📝 Update deployment documentation with ALB port configuration
3. 🔒 Add HTTPS/SSL certificate to ALB
4. 🚀 Set up CI/CD pipeline for automated frontend deployments
5. 📊 Configure CloudFront CDN for better performance (optional)

### Testing Commands

```powershell
# Test root HTML
Invoke-WebRequest -Uri "http://dev.primepisodes.com/" -UseBasicParsing | 
  Select-Object @{N='ContentType';E={$_.Headers.'Content-Type'}}

# Test JavaScript file
$jsFile = (Invoke-WebRequest -Uri "http://dev.primepisodes.com/" -UseBasicParsing).Content -match 'assets/index-[^"]+\.js'
Invoke-WebRequest -Uri "http://dev.primepisodes.com/$($Matches[0])" -UseBasicParsing | 
  Select-Object @{N='ContentType';E={$_.Headers.'Content-Type'}}

# Test backend API
Invoke-WebRequest -Uri "http://dev.primepisodes.com/api/v1/health" -UseBasicParsing | 
  ConvertFrom-Json | Format-List
```

### Summary

**Completed:**
- ✅ Frontend built and deployed
- ✅ Nginx configured with correct MIME types
- ✅ Verified Nginx works correctly (port 80)

**Remaining:**
- ⏳ Update ALB target from port 3002 → 80 (1-minute change)

**Impact:** Once ALB is updated, the React app will render correctly in browsers immediately.

---

**Date:** January 31, 2026
**Deployment By:** GitHub Copilot
**Server:** EC2 i-02ae7608c531db485 (3.94.166.174)
**Domain:** dev.primepisodes.com
