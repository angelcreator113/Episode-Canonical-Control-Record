#!/bin/bash
set -e
set -x

# Production deployment script
# Runs on EC2 server with pre-built files already uploaded

echo "🚀 Starting production deployment..."

# ── Pre-deploy: validate .env has required keys ──────────────────────────────
ENV_FILE="/home/ubuntu/episode-metadata/.env"
REQUIRED_KEYS="DB_HOST DB_NAME DB_USER DB_PASSWORD COGNITO_USER_POOL_ID COGNITO_CLIENT_ID JWT_SECRET"
MISSING=""
if [ -f "$ENV_FILE" ]; then
  for key in $REQUIRED_KEYS; do
    val=$(grep "^${key}=" "$ENV_FILE" | cut -d'=' -f2-)
    if [ -z "$val" ] || echo "$val" | grep -qE '^REPLACE_WITH'; then
      MISSING="$MISSING $key"
    fi
  done
  if [ -n "$MISSING" ]; then
    echo "❌ DEPLOYMENT BLOCKED: .env is missing required values:$MISSING"
    echo "   Edit $ENV_FILE and fill in production values."
    echo "   See .env.production.template for reference."
    exit 1
  fi
  echo "✓ .env validated — all required keys present"
else
  echo "⚠️  No .env file found at $ENV_FILE — ecosystem.config.js will use empty defaults"
  echo "   Copy .env.production.template to $ENV_FILE and fill in production values"
fi

# ── Disk cleanup: free space before anything else ─────────────────────────────
echo "🧹 Checking disk space..."
df -h / | tail -1
AVAIL_KB=$(df / | tail -1 | awk '{print $4}')
if [ "$AVAIL_KB" -lt 1048576 ] 2>/dev/null; then
  echo "⚠️  Low disk space detected — cleaning up..."
  # Remove old nvm node versions (keep only 20)
  if [ -d "$HOME/.nvm/versions/node" ]; then
    for dir in $HOME/.nvm/versions/node/v*; do
      case "$dir" in *v20*) continue ;; esac
      echo "  Removing old node: $(basename $dir)"
      rm -rf "$dir"
    done
  fi
  # Clear npm cache
  npm cache clean --force 2>/dev/null || true
  # Clear nvm source cache
  rm -rf "$HOME/.nvm/.cache" 2>/dev/null || true
  # Remove old PM2 logs
  rm -rf "$HOME/.pm2/logs/"*.log 2>/dev/null || true
  # Remove old deploy staging artifacts
  rm -rf /home/ubuntu/episode-metadata-deploy/* 2>/dev/null || true
  # Clear apt cache
  sudo apt-get clean 2>/dev/null || true
  sudo rm -rf /var/lib/apt/lists/* 2>/dev/null || true
  # Remove old journal logs (keep 50MB)
  sudo journalctl --vacuum-size=50M 2>/dev/null || true
  # Remove tmp files older than 2 days
  sudo find /tmp -type f -mtime +2 -delete 2>/dev/null || true
  echo "✓ Cleanup complete"
  df -h / | tail -1
fi

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
  git fetch origin
  git reset --hard origin/main
  git clean -fd
  echo "✓ Repository cleaned and synced to origin/main"
fi

echo "📦 Fetching latest code..."
git checkout main

cd /home/ubuntu/episode-metadata

# Install production dependencies
echo "📦 Installing backend dependencies..."
npm ci

# Build frontend
echo "🎨 Building frontend..."
cd frontend
echo "Removing old build artifacts and clearing all caches..."
rm -rf dist .vite .env.local .env.production.local .env.development.local
rm -rf ~/.pm2/logs/* 2>/dev/null || true
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

# Deploy frontend files to web root
echo "🎨 Deploying frontend to /var/www/html..."
sudo rm -rf /var/www/html/*
sudo cp -r frontend/dist/* /var/www/html/
sudo chown -R www-data:www-data /var/www/html
sudo chmod 755 /var/www/html /var/www/html/assets 2>/dev/null || true
echo "✓ Frontend files deployed"

# Deploy production nginx config (SSE streaming, 300s timeouts)
echo "🔧 Deploying nginx config..."
if [ -f nginx/episode-prod.conf ]; then
  # Deploy production config as a separate site (don't overwrite dev config)
  # Check if certbot SSL is already configured for the production site
  if [ -f /etc/nginx/sites-enabled/episode-prod ] && grep -q "ssl_certificate" /etc/nginx/sites-enabled/episode-prod; then
    echo "  SSL detected in existing config — preserving SSL, updating proxy settings only"
    # Update proxy settings in-place instead of overwriting (preserve certbot SSL)
    sudo sed -i 's/proxy_read_timeout [0-9]*s;/proxy_read_timeout 300s;/' /etc/nginx/sites-enabled/episode-prod
    sudo sed -i 's/proxy_send_timeout [0-9]*s;/proxy_send_timeout 300s;/' /etc/nginx/sites-enabled/episode-prod
    # Add proxy_buffering off if not already present
    if ! grep -q "proxy_buffering off" /etc/nginx/sites-enabled/episode-prod; then
      sudo sed -i '/proxy_read_timeout/a\        proxy_buffering off;            # Required for SSE streaming' /etc/nginx/sites-enabled/episode-prod
    fi
    # Add timeouts if not already present
    if ! grep -q "proxy_read_timeout" /etc/nginx/sites-enabled/episode-prod; then
      sudo sed -i '/proxy_http_version/a\        proxy_read_timeout 300s;\n        proxy_send_timeout 300s;\n        proxy_buffering off;' /etc/nginx/sites-enabled/episode-prod
    fi
  else
    sudo cp nginx/episode-prod.conf /etc/nginx/sites-enabled/episode-prod
    echo "  Deployed fresh config — run 'sudo certbot --nginx -d primepisodes.com -d www.primepisodes.com' for SSL"
  fi
  # Also update dev config proxy settings if present (both sites share the server)
  if [ -f /etc/nginx/sites-enabled/episode ]; then
    if ! grep -q "proxy_buffering off" /etc/nginx/sites-enabled/episode; then
      sudo sed -i '/proxy_read_timeout/a\        proxy_buffering off;            # Required for SSE streaming' /etc/nginx/sites-enabled/episode
      echo "  Updated dev nginx config with proxy_buffering off"
    fi
  fi
  if sudo nginx -t 2>&1; then
    sudo systemctl reload nginx
    echo "Nginx config deployed and reloaded"
  else
    # AK-4: do NOT delete the prod vhost and do NOT reload. nginx keeps serving its
    # current in-memory config; abort the deploy so a human fixes the config on disk.
    echo "DEPLOYMENT BLOCKED: nginx -t failed. Prod vhost left in place, nginx NOT reloaded."
    echo "   The running config is unchanged and still serving. Fix the config on disk before redeploying."
    exit 1
  fi
else
  echo "⚠️  No nginx/episode-prod.conf found — skipping nginx deploy"
fi

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

# Stop existing PRODUCTION process only (preserve dev episode-api@3002).
# Names per #746 ecosystem.config.js: prod=episode-api-prod-hotfix@3000, dev=episode-api@3002, worker=episode-worker (shared).
echo "Stopping production process..."
pm2 stop episode-api-prod-hotfix 2>/dev/null || true
pm2 delete episode-api-prod-hotfix 2>/dev/null || true
sleep 2

# Start with ecosystem config if it exists
if [ -f ecosystem.config.js ]; then
  echo "Starting production app + shared worker from ecosystem config..."
  # Prod app: default env in the file is already production-correct (3000); --env production is belt-and-suspenders.
  pm2 start ecosystem.config.js --only episode-api-prod-hotfix --env production --update-env
  # Shared worker (DB-2: one worker, no prod/dev split) — reload to pick up new code gracefully where possible.
  pm2 reload ecosystem.config.js --only episode-worker --update-env 2>/dev/null \
    || pm2 start ecosystem.config.js --only episode-worker --update-env
  # NOTE: dev app (episode-api@3002) is intentionally NOT touched by a prod deploy.
else
  echo "ecosystem.config.js not found — aborting to avoid mis-naming a process (see AK-3)."
  exit 1
fi

pm2 save --force
sleep 3
pm2 status

if ! pm2 list | grep -q "episode-api-prod-hotfix.*online"; then
  echo "❌ App is not online!"
  pm2 logs episode-api-prod-hotfix --lines 50 --nostream
  exit 1
fi

echo "✅ App is online!"
echo "🧪 Testing health endpoint..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  sleep 3
  HTTP_CODE=$(curl -s -o /tmp/health_response.json -w "%{http_code}" http://localhost:3000/health || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Health check passed (attempt $i)"
    cat /tmp/health_response.json
    echo ""
    break
  elif [ "$HTTP_CODE" = "503" ]; then
    echo "⚠️  Health check returned 503 (degraded) — app is running but DB may be disconnected (attempt $i)"
    cat /tmp/health_response.json 2>/dev/null || true
    echo ""
    break
  fi
  echo "  ⏳ Attempt $i/10 — HTTP $HTTP_CODE, waiting..."
  if [ "$i" -eq "10" ]; then
    echo "❌ Health check failed after 10 attempts (last HTTP $HTTP_CODE)"
    cat /tmp/health_response.json 2>/dev/null || true
    pm2 logs episode-api-prod-hotfix --lines 30 --nostream
    exit 1
  fi
done

echo "✅ Production deployment complete!"
echo "📊 Application status:"
pm2 list
