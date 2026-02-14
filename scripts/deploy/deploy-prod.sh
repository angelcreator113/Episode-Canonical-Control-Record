#!/bin/bash
set -e

echo "🚀 Starting production deployment..."

# Navigate to home directory
cd ~

# Remove old directory
echo "📦 Cleaning up old code..."
sudo rm -rf Episode-Canonical-Control-Record

# Clone fresh repository
echo "📥 Cloning latest code..."
git clone https://github.com/angelcreator113/Episode-Canonical-Control-Record.git

# Navigate to frontend
cd Episode-Canonical-Control-Record/frontend

# Install dependencies
echo "📚 Installing dependencies..."
npm install

# Build
echo "🔨 Building frontend..."
npm run build

# Copy to web directory
echo "📤 Deploying to web server..."
sudo cp -r dist/* /var/www/html/

# Set proper permissions
echo "🔐 Setting permissions..."
sudo chown -R www-data:www-data /var/www/html/
sudo chmod -R 755 /var/www/html/

# Restart nginx
echo "🔄 Restarting nginx..."
sudo systemctl restart nginx

echo "✅ Deployment complete!"
echo "🌐 Your application is live at: http://52.91.217.230"
