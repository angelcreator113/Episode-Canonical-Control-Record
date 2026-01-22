#!/bin/bash
set -e
set -x

# Production deployment script
# Runs on EC2 server with pre-built files already uploaded

echo "🚀 Starting production deployment..."

# Load NVM and Node.js environment
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Ensure Node 20 is active
if ! node --version 2>/dev/null | grep -q "v20"; then
  echo "📦 Installing Node.js 20 via nvm..."
  if [ ! -d "$NVM_DIR" ]; then
    echo "Installing nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    source "$NVM_DIR/nvm.sh"
  fi
  nvm install 20
  nvm use 20
  nvm alias default 20
  echo "✓ Node.js 20 installed"
else
  echo "✓ Node.js 20 detected, ensuring it's active..."
  nvm use 20 2>/dev/null || true
  nvm alias default 20
fi

echo "Active Node version:"
node --version
npm --version
which node

# Ensure we have a clean repository setup
if [ ! -d ~/episode-metadata/.git ]; then
  echo "📁 Setting up fresh episode-metadata repository..."
  rm -rf ~/episode-metadata
  mkdir -p ~/episode-metadata
  cd ~/episode-metadata
  git clone https://github.com/angelcreator113/Episode-Canonical-Control-Record.git .
  echo "✓ Repository cloned successfully"
else
  echo "📁 Using existing repository..."
  cd ~/episode-metadata
  # Reset any local changes
  git reset --hard HEAD
  git clean -fd
  echo "✓ Repository cleaned"
fi

echo "📦 Fetching latest code..."
git fetch origin
git checkout main
git pull origin main

cd /home/ubuntu/episode-metadata

# Install production dependencies
echo "📦 Installing backend dependencies..."
npm ci

# Build frontend
echo "🎨 Building frontend..."
cd frontend
echo "Removing old build artifacts and clearing all caches..."
rm -rf dist node_modules .vite .env.local .env.production.local .env.development.local
rm -rf ~/.pm2/logs/* ~/.pm2/.pm2 2>/dev/null || true
echo "Installing frontend dependencies..."
npm ci 2>&1 | tail -20
echo "Running Vite build with production config..."
NODE_ENV=production npm run build 2>&1 | tee build.log

if [ ! -d "dist" ]; then
  echo "❌ Frontend build failed - dist directory not created"
  echo "Build log:"
  cat build.log
  exit 1
fi

if [ ! -f "dist/index.html" ]; then
  echo "❌ Frontend build incomplete - index.html not found in dist"
  echo "Dist contents:"
  ls -la dist/
  exit 1
fi

echo "✓ Frontend built successfully"
echo "Dist contents:"
ls -lh dist/
if [ -d "dist/assets" ]; then
  echo "Asset files:"
  ls -lh dist/assets/ | head -5
fi
echo "Verifying index.html has script tags:"
grep -o '<script[^>]*src="[^"]*"' dist/index.html || echo "⚠️ No script tags found!"
cd ..

# Run migrations
echo "🗄️  Running database migrations..."
export DATABASE_URL="${DATABASE_URL}"
export NODE_ENV=production
npm run migrate:up || echo "⚠️  Migrations completed with warnings"

# Run migrations
echo "🗄️  Running database migrations..."
export DATABASE_URL="${DATABASE_URL}"
export NODE_ENV=production
npm run migrate:up || echo "⚠️  Migrations completed with warnings"

# Restart backend application
echo "🔄 Restarting backend application..."
export PORT=3000
export NODE_ENV=production

# Install PM2 globally if not present
if ! command -v pm2 &> /dev/null; then
  echo "Installing PM2..."
  npm install -g pm2
fi

# Stop any existing processes
pm2 stop all || true
pm2 delete all || true
sleep 2
pkill -f "node.*app.js" || true
pkill -f "node.*episode" || true
sleep 1

# Start with ecosystem config if it exists, otherwise start manually
if [ -f ecosystem.config.js ]; then
  echo "📋 Starting with ecosystem config..."
  pm2 start ecosystem.config.js --update-env
else
  echo "📋 Starting with direct PM2 command..."
  if [ -f src/server.js ]; then
    pm2 start src/server.js --name episode-api --env production
  elif [ -f app.js ]; then
    pm2 start app.js --name episode-api --env production
  else
    echo "❌ No server file found (src/server.js or app.js)"
    exit 1
  fi
fi

pm2 save --force
sleep 3
pm2 status

if ! pm2 list | grep -q "episode-api.*online"; then
  echo "❌ App is not online!"
  pm2 logs episode-api --lines 50 --nostream
  exit 1
fi

echo "✅ App is online!"
echo "🧪 Testing health endpoint..."
sleep 3
curl -v http://localhost:3000/health 2>&1 | head -30 || echo "⚠️ Health check failed"

echo "✅ Production deployment complete!"
echo "📊 Application status:"
pm2 list
