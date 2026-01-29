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

echo "🛑 Stopping all Node processes..."
pkill -9 node || true
pm2 kill || true

echo "📦 Fetching latest code..."
git fetch origin
git checkout dev
git pull origin dev

echo "🔍 Verifying file content after git pull..."
echo "Current commit:"
git log -1 --oneline
echo ""
echo "First 35 lines of src/app.js:"
head -35 src/app.js
echo ""
echo "PM2 ecosystem config script path:"
grep "script:" ecosystem.config.js
echo ""

echo "�️ Clearing Node.js cache and node_modules..."
rm -rf node_modules package-lock.json
rm -rf ~/.pm2/dump.pm2

echo "📦 Installing backend dependencies (fresh install)..."
npm install

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
npm ci 2>&1 | tee npm-install.log
NPM_EXIT_CODE=${PIPESTATUS[0]}
if [ $NPM_EXIT_CODE -ne 0 ]; then
  echo "⚠️ npm ci failed with exit code $NPM_EXIT_CODE, trying npm install instead..."
  cat npm-install.log | tail -50
  npm install 2>&1 | tail -30
fi
echo "Running Vite build..."
NODE_ENV=production npm run build 2>&1 | tee build.log
BUILD_EXIT_CODE=${PIPESTATUS[0]}

if [ $BUILD_EXIT_CODE -ne 0 ]; then
  echo "❌ Frontend build failed with exit code $BUILD_EXIT_CODE"
  echo "Full build log:"
  cat build.log
  exit 1
fi

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
  echo "ALL asset files:"
  ls -lh dist/assets/
  echo "File hashes:"
  md5sum dist/assets/*.js
fi
echo "Checking index.html:"
cat dist/index.html
echo "Verifying index.html has script tags:"
grep -o '<script[^>]*src="[^"]*"' dist/index.html || echo "⚠️ No script tags found in index.html!"
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

# Fix episodes table ID column to be UUID (CRITICAL FIX)
echo "Fixing episodes table ID column to UUID..."
PGPASSWORD="Ayanna123!!" psql -h episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com \
  -U postgres \
  -d episode_metadata \
  -f fix-episodes-id-column.sql 2>&1 | head -30 || echo "Episodes ID fix completed..."

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

# Fix missing columns in assets table (critical for AssetService)
echo "Adding missing columns to assets table..."
PGPASSWORD="Ayanna123!!" psql -h episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com \
  -U postgres \
  -d episode_metadata \
  -f fix-assets-columns.sql 2>&1 | head -50 || echo "Assets columns fixed..."

# Add missing columns to assets table (legacy script - keeping for compatibility)
echo "Running legacy assets column additions..."
PGPASSWORD="Ayanna123!!" psql -h episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com \
  -U postgres \
  -d episode_metadata \
  -f add-missing-assets-columns.sql 2>&1 | head -20 || echo "Assets columns added..."

# Create compositions table if it doesn't exist
echo "Creating compositions table..."
PGPASSWORD="Ayanna123!!" psql -h episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com \
  -U postgres \
  -d episode_metadata \
  -f create-compositions-table.sql 2>&1 | head -30 || echo "Compositions table creation completed with warnings..."

# Fix missing columns in thumbnail_compositions table
echo "Adding missing columns to thumbnail_compositions table..."
PGPASSWORD="Ayanna123!!" psql -h episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com \
  -U postgres \
  -d episode_metadata \
  -f fix-thumbnail-compositions-columns.sql 2>&1 | head -40 || echo "Columns added/verified..."

# Create composition junction tables (composition_assets, composition_outputs)
echo "Creating composition junction tables..."
PGPASSWORD="Ayanna123!!" psql -h episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com \
  -U postgres \
  -d episode_metadata \
  -f create-composition-junction-tables.sql 2>&1 | head -30 || echo "Composition junction tables created..."

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

# CREATE JUNCTION TABLES AFTER MIGRATIONS (so they don't get dropped)
echo "🔧 Creating junction tables after migrations..."

# Create scenes table
echo "Creating scenes table..."
PGPASSWORD="Ayanna123!!" psql -h episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com \
  -U postgres \
  -d episode_metadata \
  -f create-scenes-table.sql 2>&1 | head -20 || echo "Scenes table created..."

# Create scene_templates table
echo "Creating scene_templates table..."
PGPASSWORD="Ayanna123!!" psql -h episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com \
  -U postgres \
  -d episode_metadata \
  -f create-scene-templates-table.sql 2>&1 | head -20 || echo "Scene templates table created..."

# Create episode_templates table
echo "Creating episode_templates table..."
PGPASSWORD="Ayanna123!!" psql -h episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com \
  -U postgres \
  -d episode_metadata \
  -f create-episode-templates-table.sql 2>&1 | head -20 || echo "Episode templates table created..."

# Create episode_wardrobe junction table
echo "Creating episode_wardrobe table..."
PGPASSWORD="Ayanna123!!" psql -h episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com \
  -U postgres \
  -d episode_metadata \
  -f create-episode-wardrobe-table.sql 2>&1 | head -20 || echo "Episode wardrobe table created..."

# Create episode_assets and fix episode_scripts
echo "Creating episode_assets and fixing episode_scripts..."
PGPASSWORD="Ayanna123!!" psql -h episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com \
  -U postgres \
  -d episode_metadata \
  -f create-missing-junction-tables.sql 2>&1 | head -20 || echo "Junction tables created..."

# Verify critical tables exist
echo "🔍 Verifying junction tables were created..."
PGPASSWORD="Ayanna123!!" psql -h episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com \
  -U postgres \
  -d episode_metadata \
  -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('episode_assets', 'episode_wardrobe') ORDER BY table_name;" 2>&1 || echo "Verification query failed"

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

# Check if app is online with retries
MAX_PM2_RETRIES=5
for attempt in $(seq 1 $MAX_PM2_RETRIES); do
  echo "🔍 Checking if app is online (attempt $attempt/$MAX_PM2_RETRIES)..."
  if pm2 list | grep -q "episode-api.*online"; then
    echo "✅ App is online!"
    break
  fi
  
  if [ $attempt -lt $MAX_PM2_RETRIES ]; then
    echo "⚠️ App not online yet, waiting 3 seconds..."
    sleep 3
  else
    echo "❌ App failed to come online after $MAX_PM2_RETRIES attempts"
    pm2 logs episode-api --lines 50 --nostream
    exit 1
  fi
done

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
