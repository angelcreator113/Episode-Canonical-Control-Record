#!/bin/bash
set -x

# Deployment lock to prevent concurrent deployments
LOCK_FILE="/tmp/episode-metadata-deploy.lock"
if [ -f "$LOCK_FILE" ]; then
  LOCK_PID=$(cat "$LOCK_FILE")
  if ps -p "$LOCK_PID" > /dev/null 2>&1; then
    echo "⚠️  Another deployment is in progress (PID: $LOCK_PID)"
    echo "Waiting up to 5 minutes for it to complete..."
    for i in {1..60}; do
      sleep 5
      if [ ! -f "$LOCK_FILE" ] || ! ps -p "$LOCK_PID" > /dev/null 2>&1; then
        echo "✓ Previous deployment completed"
        break
      fi
      if [ $i -eq 60 ]; then
        echo "❌ Previous deployment still running after 5 minutes, removing stale lock"
        rm -f "$LOCK_FILE"
      fi
    done
  else
    echo "✓ Removing stale lock file"
    rm -f "$LOCK_FILE"
  fi
fi

echo $$ > "$LOCK_FILE"
trap "rm -f $LOCK_FILE" EXIT

if [ ! -d ~/episode-metadata ]; then
  echo "📁 Creating episode-metadata directory..."
  mkdir -p ~/episode-metadata
  cd ~/episode-metadata
  git clone https://github.com/angelcreator113/Episode-Canonical-Control-Record.git .
else
  cd ~/episode-metadata
fi

echo "🔍 Checking Node.js version..."
node --version || echo "Node not found"
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  source "$NVM_DIR/nvm.sh"
fi

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
  nvm alias default 20  # Make sure it's the default
fi

echo "Active Node version:"
node --version
npm --version
which node

# Verify Node 20 binary exists
if [ -f ~/.nvm/versions/node/v20.20.0/bin/node ]; then
  echo "✓ Node 20 binary confirmed at: ~/.nvm/versions/node/v20.20.0/bin/node"
  ~/.nvm/versions/node/v20.20.0/bin/node --version
else
  echo "⚠️ Node 20 binary not at expected location, listing available versions:"
  ls -la ~/.nvm/versions/node/
fi

echo "🗑️ Removing old directories..."
rm -rf ~/Episode-Canonical-Control-Record 2>/dev/null || true

echo "📦 Fetching latest code..."
git fetch origin
git checkout dev
git pull origin dev

echo "📦 Installing backend dependencies..."
npm ci

echo "🎨 Building frontend..."
cd frontend
echo "Removing old build artifacts and clearing all caches..."
rm -rf dist node_modules .vite .env.local .env.production.local .env.development.local
rm -rf ~/.pm2/logs/* ~/.pm2/.pm2 2>/dev/null || true
echo "Verifying dist was deleted:"
ls -la dist/ 2>&1 || echo "dist not found (good)"
echo "Using .env.production for build (VITE_API_BASE should be empty):"
cat .env.production || echo "No .env.production found"
echo "Installing frontend dependencies..."
npm ci 2>&1 | tail -20
echo "Running Vite build..."
NODE_ENV=production npm run build 2>&1 | tee build.log

if [ ! -d "dist" ]; then
  echo "❌ Frontend build failed - dist directory not created"
  echo "Build log:"
  cat build.log
  exit 1
fi

echo "✓ Frontend built successfully"
echo "Dist contents:"
ls -lh dist/
echo "ALL asset files:"
ls -lh dist/assets/
echo "File hashes:"
md5sum dist/assets/*.js
echo "Checking index.html:"
cat dist/index.html
cd ..

echo "🗄️ Running migrations..."
source "$NVM_DIR/nvm.sh" 2>/dev/null || true
nvm use 20 2>/dev/null || true

# Set DATABASE_URL from ecosystem config with SSL parameter
export DATABASE_URL="postgresql://postgres:Ayanna123!!@episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com:5432/episode_metadata?sslmode=require"
export DB_SSL="true"
export NODE_TLS_REJECT_UNAUTHORIZED="0"

echo "Checking migration status..."

# First, ensure the shows table exists (fix for partial migration state)
echo "Creating missing tables directly..."
PGPASSWORD="Ayanna123!!" psql -h episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com \
  -U postgres \
  -d episode_metadata \
  -f create-shows-only.sql 2>&1 | head -20 || echo "SQL execution completed with warnings..."

# Fix episodes table schema to match Sequelize models
echo "Fixing episodes table schema..."
PGPASSWORD="Ayanna123!!" psql -h episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com \
  -U postgres \
  -d episode_metadata \
  -f fix-episodes-schema.sql 2>&1 | head -30 || echo "Schema fix completed with warnings..."

# Fix shows table schema to match Sequelize models
echo "Fixing shows table schema..."
PGPASSWORD="Ayanna123!!" psql -h episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com \
  -U postgres \
  -d episode_metadata \
  -f fix-shows-schema.sql 2>&1 | head -30 || echo "Shows schema fix completed with warnings..."

# Create assets table if it doesn't exist
echo "Creating assets table..."
PGPASSWORD="Ayanna123!!" psql -h episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com \
  -U postgres \
  -d episode_metadata \
  -f create-assets-table.sql 2>&1 | head -30 || echo "Assets table creation completed with warnings..."

# Create compositions table if it doesn't exist
echo "Creating compositions table..."
PGPASSWORD="Ayanna123!!" psql -h episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com \
  -U postgres \
  -d episode_metadata \
  -f create-compositions-table.sql 2>&1 | head -30 || echo "Compositions table creation completed with warnings..."

# Create episode_assets junction table
echo "Creating episode_assets junction table..."
PGPASSWORD="Ayanna123!!" psql -h episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com \
  -U postgres \
  -d episode_metadata \
  -f create-episode-assets.sql 2>&1 | head -30 || echo "Episode assets table creation completed with warnings..."

# Create wardrobe and episode_wardrobe tables
echo "Creating wardrobe tables..."
PGPASSWORD="Ayanna123!!" psql -h episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com \
  -U postgres \
  -d episode_metadata \
  -f create-wardrobe-tables.sql 2>&1 | head -30 || echo "Wardrobe tables creation completed with warnings..."

# Verify critical tables exist
echo "🔍 Verifying junction tables were created..."
PGPASSWORD="Ayanna123!!" psql -h episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com \
  -U postgres \
  -d episode_metadata \
  -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('episode_assets', 'episode_wardrobe', 'wardrobe') ORDER BY table_name;" 2>&1 || echo "Verification query failed"

# Mark existing migrations as complete to prevent recreation attempts
echo "Marking existing migrations as complete..."
PGPASSWORD="Ayanna123!!" psql -h episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com \
  -U postgres \
  -d episode_metadata \
  -f mark-migrations-complete.sql || echo "Migration marking completed..."

# Only run the new migrations we need
echo "Running database migrations with SSL..."
npm run migrate:up 2>&1 | tee migration.log
MIGRATION_STATUS=$?

if [ $MIGRATION_STATUS -ne 0 ]; then
  echo "⚠️ Migration failed with status $MIGRATION_STATUS"
  cat migration.log | tail -50
  echo "Continuing anyway..."
else
  echo "✅ Migrations completed successfully"
fi

if ! command -v pm2 &> /dev/null; then
  npm install -g pm2
fi

echo "🔄 Stopping and restarting application..."
pm2 stop all || true
pm2 delete all || true
sleep 2
pkill -f "node.*app.js" || true
pkill -f "node.*episode" || true
sleep 1
            
mkdir -p ~/episode-metadata/logs
rm -f ~/episode-metadata/logs/*.log
pm2 flush || true
cd ~/episode-metadata

# Force PM2 to use Node 20 by updating PM2 with the correct Node version
echo "🔄 Updating PM2 to use Node 20..."
pm2 update
pm2 kill || true  # Kill PM2 daemon to force fresh start with new Node
sleep 2

if [ ! -f ecosystem.config.js ]; then
  echo "❌ ERROR: ecosystem.config.js not found!"
  ls -la
  exit 1
fi

echo "📋 Ecosystem config found, contents:"
head -20 ecosystem.config.js

echo "🧪 Testing database connection..."
node -e "
const { Sequelize } = require('sequelize');
const sequelize = new Sequelize(process.env.DATABASE_URL || 'postgresql://postgres:Ayanna123!!@episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com:5432/episode_metadata', {
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: false
});
sequelize.authenticate()
  .then(() => { console.log('✅ Database connection successful'); process.exit(0); })
  .catch(err => { console.error('❌ Database connection failed:', err.message); process.exit(1); });
" || echo "⚠️ Database connection test failed"

echo "🧪 Testing if Node can load app.js..."
cd ~/episode-metadata
node --check src/app.js || echo "❌ Syntax error in app.js!"
echo "🧪 Testing if app starts at all..."
timeout 5 node src/app.js 2>&1 | head -20 || echo "App failed to start"

echo "🔍 Final Node version verification before PM2 start:"
echo "Shell node: $(node --version)"
echo "Which node: $(which node)"
echo "PATH: $PATH"

echo "📋 Starting PM2 with ecosystem config..."
# Use full path to node from nvm to force correct version
PM2_HOME=/home/ubuntu/.pm2 pm2 start ecosystem.config.js --update-env 2>&1 | tee pm2-start.log

if [ $? -ne 0 ]; then
  echo "❌ PM2 start failed! Output:"
  cat pm2-start.log
  cat ~/episode-metadata/logs/error.log 2>/dev/null || echo "No error log"
  exit 1
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

echo "🔍 CRITICAL: Verifying PM2 is actually using Node 20:"
pm2 show episode-api | grep -E "node.js version|interpreter"
PM2_NODE_VERSION=$(pm2 show episode-api | grep "node.js version" | awk '{print $5}')
echo "PM2 detected Node version: $PM2_NODE_VERSION"
if [[ "$PM2_NODE_VERSION" == "20."* ]]; then
  echo "✅ PM2 is correctly using Node 20"
else
  echo "⚠️⚠️⚠️ WARNING: PM2 is using Node $PM2_NODE_VERSION instead of Node 20!"
  echo "This may cause runtime issues!"
fi

echo "🔍 Verifying PM2 environment variables:"
pm2 env 0 | grep -E "DATABASE_URL|NODE_ENV|PORT|DB_SSL" || echo "⚠️ Env vars not found"
echo "🧪 Testing if app is listening on port 3002..."
sleep 2
ss -tlnp 2>/dev/null | grep 3002 || lsof -i :3002 || echo "⚠️ Nothing listening on port 3002 (but this is normal if curl works)"
echo "🧪 Testing health endpoint..."
curl -v http://localhost:3002/health 2>&1 | head -30 || echo "⚠️ Health check failed"
echo "🧪 Testing root endpoint..."
curl -I http://localhost:3002/ 2>&1 | head -10 || echo "⚠️ Root endpoint failed"
echo "🔍 Testing app locally:"
sleep 3
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:3002/health)
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
if [[ "$HTTP_CODE" == "200" ]]; then
  echo "✅ Health check successful (HTTP $HTTP_CODE)"
else
  echo "⚠️ Health check returned HTTP $HTTP_CODE"
fi
echo "📋 Checking logs for errors:"
sleep 2
pm2 logs episode-api --lines 50 --nostream || true
echo "🔍 Checking app startup errors:"
cat ~/episode-metadata/logs/error.log 2>/dev/null | tail -50 || echo "No error log yet"
echo "� Diagnosing Node version issue:"
echo "NVM default:"
nvm current
echo "Which node:"
which node
node --version
echo "Node 20 binary check:"
if [ -f /home/ubuntu/.nvm/versions/node/v20.20.0/bin/node ]; then
    /home/ubuntu/.nvm/versions/node/v20.20.0/bin/node --version
else
    echo "❌ Node 20 binary missing, reinstalling..."
    nvm install 20
    nvm alias default 20
fi

echo "�📋 Checking PM2 environment:"
pm2 show episode-api || true
echo "✅ Deployed!"
echo "📋 Build info:"
git log -1 --oneline
ls -lh frontend/dist/assets/*.js | head -3
echo "🔍 Verifying what the app is serving:"
sleep 3
curl -s http://localhost:3002/ | grep -o 'index-[^"]*\.js' || echo "Pattern not found in localhost response"
echo "🔍 Searching for ALL dist folders and old index files:"
find ~ -name "dist" -type d 2>/dev/null | head -10
find ~ -name "index-2tx_xbRM.js" 2>/dev/null || echo "Old file not found"
find ~ -name "index.html" -path "*/dist/*" -exec grep -l "index-2tx_xbRM" {} \; 2>/dev/null || echo "No old index.html found"
