#!/bin/bash
# Force clean rebuild and cache clear on dev server
# Run this on the EC2 instance to fix stale build issues

set -e

echo "🧹 FORCE CLEAN REBUILD - Dev Server"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd ~/episode-metadata

echo "🛑 Stopping PM2..."
pm2 stop episode-api || true

echo "🗑️ Removing ALL build artifacts and caches..."
rm -rf frontend/dist
rm -rf frontend/node_modules/.vite
rm -rf frontend/.vite
rm -rf node_modules/.cache

echo "📦 Installing frontend dependencies..."
cd frontend
npm ci

echo "🔨 Building frontend (FRESH)..."
rm -rf dist
NODE_ENV=production npm run build

echo "🔍 Verifying build..."
if [ ! -d "dist" ]; then
    echo "❌ Build failed - dist directory not created!"
    exit 1
fi

if [ ! -f "dist/index.html" ]; then
    echo "❌ Build failed - index.html not found!"
    exit 1
fi

echo "📄 Files in dist:"
ls -lh dist/

echo "📄 Files in dist/assets:"
ls -lh dist/assets/

echo "🔍 Extracting JS references from index.html..."
JS_REFS=$(grep -o 'src="/assets/[^"]*\.js"' dist/index.html | sed 's|src="||' | sed 's|"||')

echo "📋 JS files referenced in index.html:"
echo "$JS_REFS"

echo ""
echo "🔍 Verifying all referenced files exist..."
ALL_EXIST=true
for ref in $JS_REFS; do
    FILE_PATH="dist${ref}"
    if [ -f "$FILE_PATH" ]; then
        echo "  ✅ $ref exists"
    else
        echo "  ❌ $ref MISSING!"
        ALL_EXIST=false
    fi
done

if [ "$ALL_EXIST" = false ]; then
    echo ""
    echo "❌ BUILD VERIFICATION FAILED - Referenced files missing!"
    exit 1
fi

echo ""
echo "✅ Build verification passed!"

cd ..

echo "🔄 Restarting PM2..."
pm2 restart episode-api

echo "⏳ Waiting for app to start..."
sleep 5

echo "🧪 Testing health endpoint..."
curl -f http://localhost:3002/health || echo "⚠️ Health check failed"

echo ""
echo "✅ Clean rebuild complete!"
echo "🌐 Test: https://dev.primepisodes.com"
echo ""
echo "📋 Next steps:"
echo "  1. Hard refresh browser (Ctrl+Shift+R)"
echo "  2. Check DevTools Network tab"
echo "  3. Verify JS files load with 200 status"
