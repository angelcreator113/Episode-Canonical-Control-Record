# MIME Type Fix - dev.primepisodes.com

## Problem Summary

**Issue:** dev.primepisodes.com is displaying raw HTML source code instead of rendering the React app.

**Root Cause:** The server is returning `Content-Type: application/json; charset=utf-8` for the HTML file instead of `text/html`.

## Diagnosis

### Test Results
```bash
curl -I http://dev.primepisodes.com/
```

**Current Response:**
```
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8  # ← WRONG!
Content-Length: 867
X-Frame-Options: SAMEORIGIN
```

**Expected Response:**
```
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8  # ← CORRECT
Content-Length: 867
```

### Why This Happens

1. **Nginx Configuration Issue:** Nginx at `/etc/nginx/sites-available/episode` is configured to serve static files from `/var/www/html/`, BUT:
   - Either the frontend files don't exist there
   - OR Nginx is proxying ALL requests to the Node.js backend (port 3002)

2. **Node.js Backend Interference:** The Express backend has middleware (`express.json()`, `helmet()`) that sets response headers. When the backend serves the HTML file (which shouldn't happen), it incorrectly sets `Content-Type: application/json`.

## Solution

### Option A: Quick Fix (Nginx + Frontend Deploy)

**This is the recommended solution for production.**

1. **Build frontend locally:**
   ```bash
   cd frontend
   npm install
   npm run build
   ```

2. **Upload to EC2 server:**
   ```bash
   # Method 1: SCP (if you have SSH key)
   scp -r dist/* ubuntu@3.94.166.174:/tmp/frontend-build/
   
   # Method 2: Use S3 as intermediate
   aws s3 sync dist/ s3://your-bucket/frontend-build/
   # Then on EC2: aws s3 sync s3://your-bucket/frontend-build/ /var/www/html/
   ```

3. **On the EC2 server, deploy files:**
   ```bash
   sudo rm -rf /var/www/html.backup
   sudo mv /var/www/html /var/www/html.backup
   sudo mkdir -p /var/www/html
   sudo mv /tmp/frontend-build/* /var/www/html/
   sudo chown -R www-data:www-data /var/www/html
   sudo chmod -R 755 /var/www/html
   ```

4. **Update Nginx configuration:**
   ```bash
   sudo nano /etc/nginx/sites-available/episode
   ```

   **Paste this config:**
   ```nginx
   server {
       listen 80 default_server;
       server_name dev.primepisodes.com;
       
       root /var/www/html;
       index index.html;

       # Force correct MIME types for JS files
       location ~* \.js$ {
           add_header Content-Type "application/javascript; charset=utf-8" always;
           expires 1y;
           add_header Cache-Control "public, immutable";
       }
       
       # Force correct MIME types for CSS files
       location ~* \.css$ {
           add_header Content-Type "text/css; charset=utf-8" always;
           expires 1y;
           add_header Cache-Control "public, immutable";
       }
       
       # Other static assets
       location ~* \.(png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
           expires 1y;
           add_header Cache-Control "public, immutable";
       }

       # API proxy to Node.js backend
       location /api/ {
           proxy_pass http://localhost:3002;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }

       # Health check endpoint
       location /health {
           proxy_pass http://localhost:3002/health;
           proxy_http_version 1.1;
       }

       # SPA fallback - serve index.html for all other routes
       location / {
           try_files $uri $uri/ /index.html;
           add_header Content-Type "text/html; charset=utf-8" always;
           add_header Cache-Control "no-cache, no-store, must-revalidate";
       }
   }
   ```

5. **Restart Nginx:**
   ```bash
   sudo ln -sf /etc/nginx/sites-available/episode /etc/nginx/sites-enabled/episode
   sudo rm -f /etc/nginx/sites-enabled/default
   sudo nginx -t
   sudo systemctl restart nginx
   sudo systemctl status nginx
   ```

6. **Verify the fix:**
   ```bash
   # Check root URL
   curl -I http://dev.primepisodes.com/
   # Should show: Content-Type: text/html
   
   # Check JS files
   curl -I http://dev.primepisodes.com/assets/index-[hash].js
   # Should show: Content-Type: application/javascript
   
   # Check backend API still works
   curl http://dev.primepisodes.com/api/v1/health
   # Should return JSON
   ```

### Option B: Backend-Only Serving (Temporary Fix)

If you can't access the server to configure Nginx, you can fix the Node.js backend:

1. **Update** `src/app.js` (already done):
   ```javascript
   app.use(helmet({
     contentSecurityPolicy: false, // Disable CSP interference
   }));
   app.use(express.json({ 
     limit: '10mb', 
     type: 'application/json' // Only parse JSON content-type requests
   }));
   ```

2. **Restart the backend:**
   ```bash
   pm2 restart episode-app
   ```

**Note:** This is less efficient than having Nginx serve static files, but will work as a temporary fix.

## Files Modified

### Local Changes
- [src/app.js](src/app.js#L158-L163) - Fixed `helmet()` and `express.json()` middleware configuration
- [fix-mime-type-deployment.ps1](fix-mime-type-deployment.ps1) - Deployment script (needs SSH key)
- [deploy-frontend-fix.ps1](deploy-frontend-fix.ps1) - Alternative deployment script
- [FIX-MIME-TYPE-MANUAL.ps1](FIX-MIME-TYPE-MANUAL.ps1) - Manual fix instructions

### Server Changes Needed
- `/etc/nginx/sites-available/episode` - Nginx configuration
- `/var/www/html/` - Frontend build files deployment

## Testing Checklist

After applying the fix:

- [ ] Root URL returns `Content-Type: text/html`
  ```bash
  curl -I http://dev.primepisodes.com/
  ```

- [ ] JavaScript files return `Content-Type: application/javascript`
  ```bash
  curl -I http://dev.primepisodes.com/assets/index-*.js
  ```

- [ ] CSS files return `Content-Type: text/css`
  ```bash
  curl -I http://dev.primepisodes.com/assets/index-*.css
  ```

- [ ] React app renders correctly in browser
  - Open http://dev.primepisodes.com/
  - Should see the actual React UI, not HTML source code

- [ ] API endpoints still work
  ```bash
  curl http://dev.primepisodes.com/api/v1/health
  ```

- [ ] Browser console shows no MIME type errors
  - Open DevTools → Console
  - No "MIME type mismatch" errors

## Next Steps

1. **Immediate:** Apply Option A (Nginx + Frontend Deploy) on the EC2 server
2. **Test:** Verify all endpoints return correct Content-Type headers
3. **Monitor:** Check browser DevTools for any remaining MIME type warnings
4. **Document:** Update deployment procedures to ensure correct Nginx configuration

## Additional Resources

- [Nginx MIME types documentation](https://nginx.org/en/docs/http/ngx_http_core_module.html#types)
- [Express static serving](https://expressjs.com/en/starter/static-files.html)
- Current Nginx config: [nginx-primepisodes.conf](nginx-primepisodes.conf)
