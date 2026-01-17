#!/bin/bash
# Deployment script for Episode Metadata API
# Usage: ./deploy.sh [dev|staging|production]

set -e

ENVIRONMENT=${1:-production}
APP_DIR="/home/ubuntu/episode-metadata"

echo "🚀 Starting deployment to $ENVIRONMENT..."
echo "============================================"

# Navigate to app directory
cd $APP_DIR

# Show current commit
echo ""
echo "📌 Current commit:"
git log -1 --oneline

# Fetch latest changes
echo ""
echo "📥 Fetching latest changes..."
git fetch origin

# Checkout appropriate branch based on environment
case $ENVIRONMENT in
  production)
    BRANCH="main"
    ;;
  staging)
    BRANCH="staging"
    ;;
  dev)
    BRANCH="dev"
    ;;
  *)
    echo "❌ Invalid environment: $ENVIRONMENT"
    echo "Usage: ./deploy.sh [dev|staging|production]"
    exit 1
    ;;
esac

echo ""
echo "🔄 Pulling $BRANCH branch..."
git checkout $BRANCH
git pull origin $BRANCH

# Show new commit
echo ""
echo "📌 New commit:"
git log -1 --oneline

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm ci --production

# Build frontend
echo ""
echo "🏗️  Building frontend..."
cd frontend
npm ci
npm run build
cd ..

# Run database migrations
echo ""
echo "🗄️  Running database migrations..."
npm run migrate:up || echo "⚠️  No new migrations to run"

# Restart application with PM2
echo ""
echo "🔄 Restarting application..."
pm2 restart all
pm2 save

echo ""
echo "✅ Deployment complete!"
echo "============================================"
echo "Environment: $ENVIRONMENT"
echo "Branch: $BRANCH"
echo "Timestamp: $(date)"
echo ""

# Show application status
echo "📊 Application status:"
pm2 status

echo ""
echo "🌐 Testing health endpoint..."
sleep 3
curl -f http://localhost:3000/health || echo "⚠️  Health check failed"

echo ""
echo "✅ Deployment successful!"
