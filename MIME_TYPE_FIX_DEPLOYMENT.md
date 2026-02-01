# MIME Type Fix - Deployment Guide

## Problem Fixed
JavaScript bundles at `https://dev.primepisodes.com/assets/*.js` were returning HTML instead of JS, causing:
```
Failed to load module script: Expected a JavaScript module script but the server responded with MIME type 'text/html'.
```

## Root Cause
The Express catch-all route `app.get('*')` was intercepting `/assets/*.js` requests before `express.static()` could serve them, returning `index.html` instead of the actual JavaScript files.

## Changes Made

### 1. [src/app.js](src/app.js) - Fixed catch-all route
**Added explicit `/assets/` path check:**
```javascript
// CRITICAL: Skip requests for static assets folder
if (req.path.startsWith('/assets/')) {
  console.log('  → Skipping (assets folder)');
  return next();
}
```

**Improved express.static configuration:**
- Added `index: false` to prevent directory listings
- Added `fallthrough: true` to properly handle missing files
- Added explicit MIME types for `.js`, `.mjs`, `.css`, `.html`, `.json`
- Added `X-Content-Type-Options: nosniff` header

### 2. [.github/scripts/deploy-to-ec2.sh](.github/scripts/deploy-to-ec2.sh) - Added verification
**Added build verification step** that checks:
1. Extract all JS file references from `index.html`
2. Verify each referenced file exists in `dist/assets/`
3. Abort deployment if any files are missing

### 3. [deploy-package/backend/app.js](deploy-package/backend/app.js) - Consistency
Applied the same fixes to the deploy-package version for consistency.

## Deployment Instructions

### Option 1: Push to trigger CI/CD (Recommended)
```bash
# Commit the changes
git add src/app.js .github/scripts/deploy-to-ec2.sh deploy-package/backend/app.js
git commit -m "Fix: Add explicit /assets/ check to prevent catch-all route from intercepting static files"

# Push to dev branch to trigger deployment
git push origin dev
```

The GitHub Actions workflow will:
1. Build the frontend
2. Verify JS files exist (new check!)
3. Deploy to EC2
4. PM2 will restart with the fixed code

### Option 2: Manual deployment (faster for testing)
```bash
# SSH to EC2
ssh ubuntu@<EC2_HOST>

# Navigate to project
cd ~/episode-metadata

# Pull latest changes
git pull origin dev

# Clear PM2 cache
pm2 kill
rm -rf ~/.pm2/logs/* ~/.pm2/dump.pm2

# Rebuild frontend
cd frontend
rm -rf dist node_modules
npm ci
npm run build

# Verify build
ls -lah dist/assets/
cat dist/index.html | grep -o 'src="/assets/[^"]*\.js"'

cd ..

# Restart app
pm2 start ecosystem.config.js
pm2 logs episode-api
```

## Verification Steps

### 1. Check Browser Console
```
Open: https://dev.primepisodes.com
Look for: JS bundle loads successfully (no MIME type errors)
```

### 2. Check Network Tab
```
Filter: /assets/
Status: Should be 200 OK
Content-Type: application/javascript; charset=utf-8
Response: Should be JavaScript code, NOT HTML
```

### 3. Check PM2 Logs
```bash
pm2 logs episode-api | grep "Serving static file"
# Should see: 📦 Serving static file: /path/to/frontend/dist/assets/index-*.js
```

### 4. Test Direct Access
```bash
curl -I https://dev.primepisodes.com/assets/index-Fez2Z-5k.js
# Should return:
# HTTP/1.1 200 OK
# Content-Type: application/javascript; charset=utf-8
# X-Content-Type-Options: nosniff
```

### 5. Check Logs for Route Skipping
```bash
pm2 logs episode-api | grep "Catch-all route"
# When requesting /assets/*.js, should see:
# 📄 Catch-all route: /assets/index-Fez2Z-5k.js
#   → Skipping (assets folder)
```

## Why This Works

### Before Fix:
```
Request: GET /assets/index-Fez2Z-5k.js
  ↓
Express routing:
  1. ❌ express.static() - file exists but continues to next handler
  2. ✅ app.get('*') catches it
  3. Checks: path.extname() returns '.js' → calls next()
  4. But no other handler exists!
  5. ❌ Returns index.html (default behavior)
```

### After Fix:
```
Request: GET /assets/index-Fez2Z-5k.js
  ↓
Express routing:
  1. ✅ express.static() serves the file with correct MIME type
  2. Done! (never reaches catch-all)
  
OR if static file doesn't match:
  1. express.static() calls next()
  2. app.get('*') catches it
  3. Checks: path.startsWith('/assets/') → calls next()
  4. 404 handler returns proper 404
```

## Testing Checklist

- [ ] Frontend loads without MIME type errors
- [ ] JavaScript bundles return `Content-Type: application/javascript`
- [ ] CSS files return `Content-Type: text/css`
- [ ] React app renders correctly
- [ ] Client-side routing works (e.g., /episodes still serves index.html)
- [ ] API calls work (e.g., /api/v1/episodes)
- [ ] 404s for missing static files (not serving index.html for them)

## Rollback Plan

If issues occur:
```bash
ssh ubuntu@<EC2_HOST>
cd ~/episode-metadata
git checkout <previous-commit-hash>
pm2 restart episode-api
```

## Related Files
- [JS_BUNDLE_FIX.md](JS_BUNDLE_FIX.md) - Detailed analysis and diagnostic steps
- [src/app.js](src/app.js#L626) - Main application routing
- [.github/workflows/deploy-dev.yml](.github/workflows/deploy-dev.yml) - CI/CD pipeline
- [ecosystem.config.js](ecosystem.config.js) - PM2 configuration
