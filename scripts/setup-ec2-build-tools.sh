#!/bin/bash
# Setup build tools on EC2 Ubuntu instance for Sharp compilation
# This script installs the necessary build dependencies for native modules like Sharp

set -e

echo "🔧 Setting up build tools on EC2 instance"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if running with sudo
if [ "$EUID" -ne 0 ]; then 
  echo "⚠️  This script needs to be run with sudo privileges"
  echo "Run: sudo bash $0"
  exit 1
fi

echo "📦 Updating package lists..."
apt-get update

echo "🔨 Installing build-essential (GCC, G++, Make, etc.)..."
apt-get install -y build-essential

echo "📦 Installing additional build dependencies for Sharp..."
# Sharp requires these for optimal performance and features
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

echo "✅ Build tools installation complete!"
echo ""
echo "📋 Installed packages:"
echo "  - build-essential (GCC $(gcc --version | head -n1))"
echo "  - make $(make --version | head -n1)"
echo "  - python3 $(python3 --version)"
echo ""
echo "🎯 Next steps:"
echo "  1. Navigate to your project: cd ~/episode-metadata"
echo "  2. Rebuild Sharp: npm uninstall sharp && npm install --build-from-source=sharp sharp"
echo "  3. Restart your application: pm2 restart episode-api"
