# 🔴 URGENT FIX: Stale Build Assets (404 Errors)

## Current Problem
The browser is requesting `index-0R0_Vp7X.css` and other files that don't exist (404 errors). This means:
- The deployed `index.html` references OLD filenames
- But those old files were deleted/replaced with new hashed filenames
- This is a **build artifact mismatch**, not a MIME type issue

## Root Cause
Vite generates hashed filenames (e.g., `index-AbC123.js`) that change with each build. If:
1. Old `index.html` isn't overwritten, OR
2. Vite cache causes stale references, OR  
3. Build partially fails but PM2 still serves old files

Then you get 404 errors for non-existent assets.

## Immediate Fix (SSH to Server)

### Step 1: SSH to the server
```bash
ssh ubuntu@<EC2_HOST>
```

### Step 2: Run the force clean rebuild script
```bash
cd ~/episode-metadata

# Stop the app
pm2 stop episode-api

# Clean everything
cd frontend
rm -rf dist node_modules/.vite node_modules/.cache .vite
npm ci
NODE_ENV=production npm run build

# Verify the build
ls -lh dist/assets/
cat dist/index.html | grep -o 'src="/assets/[^"]*\.js"'

# Restart the app
cd ..
pm2 restart episode-api
pm2 logs episode-api --lines 50
```

### Step 3: Test immediately
```bash
# On server
curl -I http://localhost:3002/health

# Check what index.html references
curl -s http://localhost:3002/ | grep -o 'src="/assets/[^"]*\.js"'

# Test one of those files
curl -I http://localhost:3002/assets/index-XXXXX.js
```

## Alternative: Use the Script

I've created a script that does all of this automatically:

```bash
# On your local machine, copy the script to server:
scp scripts/force-clean-rebuild.sh ubuntu@<EC2_HOST>:~/

# Then SSH and run it:
ssh ubuntu@<EC2_HOST>
chmod +x ~/force-clean-rebuild.sh
./force-clean-rebuild.sh
```

## After Server Fix

1. **Hard refresh your browser**: `Ctrl + Shift + R`
2. **Clear browser cache** if needed
3. **Check DevTools Network tab**: All `/assets/*.js` should be 200 OK

## Prevention (Committed to Repo)

I've updated the deployment script to:
- ✅ More aggressively clear Vite caches (`node_modules/.vite`, `node_modules/.cache`)
- ✅ Verify JS files exist before restarting PM2
- ✅ Better build verification

## Why This Happened

The MIME type fix we made was **correct and necessary**, but it exposed this pre-existing build cache issue. The old catch-all route was hiding the 404s by serving `index.html` for missing files (which gave MIME type errors). Now that we fixed the routing, the 404s are properly exposed.

## Next Deployment

The updated deployment script will prevent this from happening again. Push the changes:

```bash
git add .github/scripts/deploy-to-ec2.sh scripts/force-clean-rebuild.sh
git commit -m "Fix: Add aggressive Vite cache clearing to prevent stale builds"
git push origin dev
```

## Verification Checklist

After running the fix on the server:
- [ ] Browser loads without 404 errors
- [ ] All `/assets/*.js` files return 200 OK
- [ ] Content-Type is `application/javascript; charset=utf-8`
- [ ] React app renders correctly
- [ ] No MIME type errors in console

---

**TL;DR**: The routing fix is correct. The server just needs a clean rebuild to generate fresh assets that match the index.html references. SSH to the server and run the cleanup commands above.
