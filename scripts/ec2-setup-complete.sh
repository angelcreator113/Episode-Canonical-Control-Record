#!/bin/bash
# Complete setup script for EC2 instance - Install build tools and rebuild Sharp
# This script should be run on the EC2 instance via SSH

set -e

echo "🚀 EC2 Setup: Build Tools and Sharp Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "This script will:"
echo "  1. Install build-essential and required build tools"
echo "  2. Rebuild Sharp from source for this system"
echo "  3. Restart the episode-api application"
echo ""

# Check if running on Ubuntu/Debian
if ! command -v apt-get &> /dev/null; then
  echo "❌ Error: This script is designed for Ubuntu/Debian systems"
  exit 1
fi

# ============================================
# STEP 1: Install Build Tools (requires sudo)
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Step 1: Installing build tools"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$EUID" -eq 0 ]; then
  echo "✓ Running with sudo privileges"
  
  echo "📦 Updating package lists..."
  apt-get update -qq
  
  echo "🔨 Installing build-essential..."
  apt-get install -y build-essential
  
  echo "📦 Installing additional build dependencies..."
  apt-get install -y \
    python3 \
    python3-pip \
    pkg-config \
    libpixman-1-dev \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev
  
  echo "✅ Build tools installed successfully!"
else
  echo "⚠️  Build tools installation requires sudo privileges"
  echo "Running with sudo..."
  sudo apt-get update -qq
  sudo apt-get install -y build-essential python3 python3-pip pkg-config \
    libpixman-1-dev libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
  echo "✅ Build tools installed successfully!"
fi

echo ""
echo "📋 Installed versions:"
gcc --version | head -n1
make --version | head -n1
python3 --version

# ============================================
# STEP 2: Navigate to Project Directory
# ============================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📂 Step 2: Navigating to project directory"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -d ~/episode-metadata ]; then
  cd ~/episode-metadata
  echo "✓ Current directory: $(pwd)"
else
  echo "❌ Error: Project directory ~/episode-metadata not found"
  echo "Please ensure the project is cloned at ~/episode-metadata"
  exit 1
fi

# ============================================
# STEP 3: Rebuild Sharp from Source
# ============================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 Step 3: Rebuilding Sharp from source"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "🗑️ Removing existing Sharp installation..."
npm uninstall sharp 2>/dev/null || echo "  (Sharp was not previously installed)"

echo "📦 Installing Sharp with build-from-source flag..."
echo "  This may take a few minutes as Sharp compiles..."
npm install --build-from-source=sharp sharp

echo ""
echo "🔍 Verifying Sharp installation..."
if node -e "const sharp = require('sharp'); console.log('Sharp version:', sharp.versions.sharp); console.log('libvips version:', sharp.versions.vips);" 2>/dev/null; then
  echo "✅ Sharp is installed and working correctly!"
else
  echo "❌ Sharp verification failed"
  echo "Please check the build logs above for errors"
  exit 1
fi

# ============================================
# STEP 4: Restart Application
# ============================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 Step 4: Restarting application"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v pm2 &> /dev/null; then
  echo "🛑 Stopping episode-api..."
  pm2 stop episode-api 2>/dev/null || echo "  (episode-api was not running)"
  
  echo "🚀 Starting episode-api..."
  pm2 start episode-api
  
  echo "💾 Saving PM2 configuration..."
  pm2 save
  
  echo ""
  echo "📊 PM2 Status:"
  pm2 status
  
  echo ""
  echo "📋 Recent logs:"
  pm2 logs episode-api --lines 20 --nostream
else
  echo "⚠️  PM2 not found. Please restart your application manually."
fi

# ============================================
# COMPLETION
# ============================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎯 Summary:"
echo "  ✓ Build tools installed"
echo "  ✓ Sharp rebuilt from source"
echo "  ✓ Application restarted"
echo ""
echo "📋 Verification steps:"
echo "  1. Check application status: pm2 status"
echo "  2. Monitor logs: pm2 logs episode-api"
echo "  3. Test Sharp functionality in your application"
echo ""
echo "🔗 Useful commands:"
echo "  - Check Sharp version: node -e \"require('sharp').versions\""
echo "  - Restart app: pm2 restart episode-api"
echo "  - View logs: pm2 logs episode-api"
