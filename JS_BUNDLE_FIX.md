# JavaScript Bundle Loading Fix - Dev Site

## Issue
Dev site (https://dev.primepisodes.com) fails to load JS bundles with error:
```
Failed to load module script: Expected a JavaScript module script but the server responded with MIME type 'text/html'.
```

## Root Cause Analysis

The error indicates that requests for `/assets/*.js` files are returning HTML (index.html) instead of the actual JavaScript files.

### Possible Causes:
1. **Assets not deployed** - The `frontend/dist/assets/` directory or files might be missing on the server
2. **Stale build** - Old build artifacts with different filenames in index.html vs actual files
3. **express.static not matching** - The static middleware might not be correctly serving files
4. **Catch-all route interfering** - The React Router catch-all `app.get('*')` might be intercepting requests

## Current Configuration

### Server Setup ([src/app.js](src/app.js#L626)):
- ✅ Uses `express.static(frontendDistPath)` to serve files
- ✅ Sets Content-Type explicitly for `.js` files: `application/javascript; charset=utf-8`
- ✅ Catch-all route checks `path.extname(req.path)` and calls `next()` for files with extensions

### Deployment Process ([.github/scripts/deploy-to-ec2.sh]()):
- ✅ Builds frontend with `npm run build` in frontend directory
- ✅ Creates `frontend/dist` directory with assets
- ✅ PM2 runs from `/home/ubuntu/episode-metadata`
- ✅ Server looks for dist at `../frontend/dist` relative to `src/app.js`

## Diagnostic Steps

### 1. Check if assets exist on server:
```bash
ssh ubuntu@<EC2_HOST>
ls -lah /home/ubuntu/episode-metadata/frontend/dist/
ls -lah /home/ubuntu/episode-metadata/frontend/dist/assets/
```

### 2. Check what index.html references:
```bash
cat /home/ubuntu/episode-metadata/frontend/dist/index.html | grep -o 'src="[^"]*"'
```

### 3. Check PM2 logs for static file serving:
```bash
pm2 logs episode-api --lines 100 | grep "Serving static file"
```

### 4. Test direct file access:
```bash
curl -I http://localhost:3002/assets/index-Fez2Z-5k.js
```

### 5. Check for multiple dist directories:
```bash
find /home/ubuntu -name "dist" -type d 2>/dev/null
```

## Solutions

### Fix 1: Ensure Clean Build & Deployment

Add explicit verification to deployment script before PM2 restart:

```bash
# In .github/scripts/deploy-to-ec2.sh, after frontend build:
echo "🔍 CRITICAL: Verifying dist/assets files match index.html references..."
DIST_ASSETS=$(ls -1 frontend/dist/assets/*.js | xargs -n1 basename)
HTML_REFS=$(grep -o 'src="/assets/[^"]*\.js"' frontend/dist/index.html | sed 's|src="/assets/||' | sed 's|"||')

echo "Files in dist/assets:"
echo "$DIST_ASSETS"
echo ""
echo "Files referenced in index.html:"
echo "$HTML_REFS"

# Check if all referenced files exist
for ref in $HTML_REFS; do
  if [ ! -f "frontend/dist/assets/$ref" ]; then
    echo "❌ CRITICAL: index.html references $ref but file not found!"
    exit 1
  fi
done

echo "✅ All JS references verified!"
```

### Fix 2: Improve Static File Handling

The current code is correct but let's add more robust handling:

```javascript
// In src/app.js, improve the static serving:
app.use(
  express.static(frontendDistPath, {
    maxAge: 0,
    etag: true,
    lastModified: true,
    index: false, // Prevent directory listings
    fallthrough: true, // Let other routes handle if file not found
    setHeaders: (res, filePath) => {
      console.log('📦 Serving static file:', filePath);
      
      // Set correct MIME types explicitly
      if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
        res.set('Content-Type', 'application/javascript; charset=utf-8');
      } else if (filePath.endsWith('.css')) {
        res.set('Content-Type', 'text/css; charset=utf-8');
      } else if (filePath.endsWith('.html')) {
        res.set('Content-Type', 'text/html; charset=utf-8');
      } else if (filePath.endsWith('.json')) {
        res.set('Content-Type', 'application/json; charset=utf-8');
      }
      
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('X-Content-Type-Options', 'nosniff');
    },
  })
);
```

### Fix 3: More Explicit Catch-All Route

Make the catch-all route more defensive:

```javascript
app.get('*', (req, res, next) => {
  try {
    console.log(`📄 Catch-all route: ${req.path}`);

    // Skip API routes
    if (
      req.path.startsWith('/api/') ||
      req.path === '/health' ||
      req.path === '/ping' ||
      req.path === '/debug'
    ) {
      console.log('  → Skipping (API route)');
      return next();
    }

    // Skip requests for static assets (CRITICAL)
    if (req.path.startsWith('/assets/')) {
      console.log('  → Skipping (assets folder)');
      return next();
    }

    // If file has extension, let 404 handler deal with it
    if (path.extname(req.path)) {
      console.log('  → Skipping (has extension)');
      return next();
    }

    // Serve index.html for SPA routes
    const indexPath = path.join(frontendDistPath, 'index.html');
    console.log(`  → Serving index.html from: ${indexPath}`);

    if (fs.existsSync(indexPath)) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(indexPath);
    } else {
      console.log('⚠️ index.html not found!');
      next();
    }
  } catch (error) {
    console.error('❌ Error in catch-all route:', error);
    next(error);
  }
});
```

## Immediate Action Plan

1. **Add explicit `/assets/` check** in catch-all route (most critical)
2. **Add build verification** to deployment script
3. **Add `index: false`** to express.static options
4. **Clear PM2 cache** and restart:
   ```bash
   pm2 kill
   rm -rf ~/.pm2/logs/* ~/.pm2/dump.pm2
   pm2 start ecosystem.config.js
   ```

## Testing After Fix

1. Check browser console - should load JS files successfully
2. Check Network tab - `/assets/*.js` should return 200 with `Content-Type: application/javascript`
3. Verify no index.html returned for asset requests
4. Test React app loads and routes work

## Prevention

Add to CI/CD:
- Verify dist/assets exists before deploy
- Verify index.html references match actual files
- Add health check that tests asset loading
- Consider using hash-based cache busting (already in place with Vite)
