#!/bin/bash
# Quick frontend server diagnostic

echo "=== Frontend Server Diagnostic ==="
echo ""

echo "1. Checking if Nginx is installed and running:"
if command -v nginx &> /dev/null; then
    echo "   ✓ Nginx is installed"
    sudo systemctl status nginx --no-pager | head -5
else
    echo "   ✗ Nginx not found"
fi
echo ""

echo "2. Checking Apache (alternative web server):"
if command -v apache2 &> /dev/null; then
    echo "   ✓ Apache is installed"
    sudo systemctl status apache2 --no-pager | head -5
else
    echo "   ✗ Apache not found"
fi
echo ""

echo "3. Checking Nginx configuration:"
if [ -f /etc/nginx/sites-enabled/default ]; then
    echo "   Default Nginx config:"
    sudo cat /etc/nginx/sites-enabled/default | grep -E "(root|location)" | head -20
else
    echo "   ✗ No default Nginx config found"
fi
echo ""

echo "4. Checking deployment directories:"
for dir in /var/www/html /var/www/episode-frontend /home/ubuntu/deploy; do
    if [ -d "$dir" ]; then
        echo "   ✓ $dir exists"
        ls -la "$dir" | head -10
        echo ""
    else
        echo "   ✗ $dir does not exist"
    fi
done

echo "5. Checking what process is listening on port 80:"
sudo netstat -tlnp | grep ":80" || echo "   Nothing listening on port 80"
echo ""

echo "=== End Diagnostic ==="
