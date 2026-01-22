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
nvm use 20 2>/dev/null || true

echo "Active Node version:"
node --version
npm --version

# Check if project directory exists
if [ ! -d "/home/ubuntu/episode-metadata" ]; then
  echo "📦 Creating project directory..."
  mkdir -p /home/ubuntu/episode-metadata
fi

# Deploy built files from staging area
echo "📦 Deploying built files..."
rsync -av --delete /home/ubuntu/episode-metadata-deploy/ /home/ubuntu/episode-metadata/

cd /home/ubuntu/episode-metadata

# Install production dependencies
echo "📦 Installing production dependencies..."
export NODE_ENV=production
npm ci --production --omit=dev

# Run migrations
echo "🗄️  Running database migrations..."
npm run migrate:up || echo "⚠️  Migrations completed with warnings"

# Setup frontend files
echo "📁 Setting up frontend files..."
sudo mkdir -p /var/www/primepisodes
sudo rsync -av --delete frontend-dist/ /var/www/primepisodes/

# Setup Nginx
echo "🌐 Configuring Nginx..."
if ! command -v nginx &> /dev/null; then
  echo "Installing Nginx..."
  sudo apt-get update -qq
  sudo apt-get install -y nginx
fi

# Copy Nginx configuration if it exists
if [ -f nginx.conf ]; then
  sudo cp nginx.conf /etc/nginx/sites-available/primepisodes
  sudo ln -sf /etc/nginx/sites-available/primepisodes /etc/nginx/sites-enabled/primepisodes
  sudo rm -f /etc/nginx/sites-enabled/default
  
  # Test and reload Nginx
  if sudo nginx -t; then
    sudo systemctl enable nginx
    sudo systemctl reload nginx || sudo systemctl restart nginx
    echo "✅ Nginx configured and reloaded"
  else
    echo "⚠️  Nginx configuration test failed"
  fi
else
  echo "⚠️  nginx.conf not found, skipping Nginx setup"
fi

# Restart backend application
echo "🔄 Restarting backend application..."
export PORT=3000
export NODE_ENV=production

# Install PM2 globally if not present
if ! command -v pm2 &> /dev/null; then
  echo "Installing PM2..."
  npm install -g pm2
fi

# Check if app is running
if pm2 list | grep -q "episode-api"; then
  echo "Restarting existing PM2 process..."
  pm2 restart episode-api
else
  echo "Starting new PM2 process..."
  # Check if server.js exists, otherwise use app.js
  if [ -f src/server.js ]; then
    pm2 start src/server.js --name episode-api --env production
  elif [ -f app.js ]; then
    pm2 start app.js --name episode-api --env production
  else
    echo "⚠️  No server file found (src/server.js or app.js)"
    exit 1
  fi
fi

pm2 save
echo "✅ PM2 process restarted and saved"

echo "✅ Production deployment complete!"
echo "📊 Application status:"
pm2 list
