#!/bin/bash
# Rebuild Sharp with build-from-source on EC2 instance
# This ensures Sharp is compiled for the specific system architecture

set -e

echo "🔧 Rebuilding Sharp from source"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Navigate to project directory
if [ -d ~/episode-metadata ]; then
  cd ~/episode-metadata
else
  echo "❌ Error: Project directory ~/episode-metadata not found"
  exit 1
fi

echo "📍 Current directory: $(pwd)"
echo ""

echo "🗑️ Removing existing Sharp installation..."
npm uninstall sharp 2>/dev/null || echo "  (Sharp was not installed)"

echo "📦 Installing Sharp with build-from-source..."
# This will compile Sharp specifically for this system
npm install --build-from-source=sharp sharp

echo "✅ Sharp rebuild complete!"
echo ""
echo "🔍 Verifying Sharp installation..."
node -e "const sharp = require('sharp'); console.log('Sharp version:', sharp.versions); console.log('✅ Sharp is working correctly!');" || {
  echo "❌ Sharp verification failed"
  echo "Please check the build logs above for errors"
  exit 1
}

echo ""
echo "🎯 Next steps:"
echo "  1. Restart your application: pm2 restart episode-api"
echo "  2. Verify application is working: pm2 logs episode-api"
echo "  3. Test Sharp functionality in your app"
