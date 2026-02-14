# SSH into EC2 and Check Backend Status
# This script connects to your EC2 instance and checks the PM2 backend service

$EC2_KEY = "C:\Users\12483\episode-prod-key.pem"
$EC2_IP = "3.94.166.174"

Write-Host "`n=== EC2 Backend Diagnostics ===" -ForegroundColor Cyan

# Test which user works (ubuntu or ec2-user)
Write-Host "`n1. Testing SSH connection..." -ForegroundColor Cyan

$users = @("ubuntu", "ec2-user")
$workingUser = $null

foreach ($user in $users) {
    Write-Host "   Trying user: $user" -ForegroundColor Gray
    $result = ssh -i $EC2_KEY -o ConnectTimeout=5 -o StrictHostKeyChecking=no "${user}@${EC2_IP}" "echo 'Connected as $user'" 2>&1
    if ($LASTEXITCODE -eq 0) {
        $workingUser = $user
        Write-Host "   ✅ Connected as $workingUser" -ForegroundColor Green
        break
    }
}

if (-not $workingUser) {
    Write-Host "`n❌ Could not connect to EC2 instance" -ForegroundColor Red
    Write-Host "Please check:" -ForegroundColor Yellow
    Write-Host "  - EC2 instance is running" -ForegroundColor Yellow
    Write-Host "  - Security group allows SSH (port 22) from your IP" -ForegroundColor Yellow
    Write-Host "  - SSH key permissions are correct" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n2. Checking PM2 status..." -ForegroundColor Cyan
ssh -i $EC2_KEY -o StrictHostKeyChecking=no "${workingUser}@${EC2_IP}" @"
echo '=== PM2 Status ==='
pm2 status

echo -e '\n=== PM2 Episode API Details ==='
pm2 describe episode-api | grep -E 'status|uptime|restarts'

echo -e '\n=== Check if port 3002 is listening ==='
sudo ss -tlnp | grep 3002 || echo 'Nothing listening on port 3002'

echo -e '\n=== Recent PM2 Logs (last 30 lines) ==='
pm2 logs episode-api --lines 30 --nostream

echo -e '\n=== Test local health endpoint ==='
curl -s -w '\nHTTP Status: %{http_code}\n' http://localhost:3002/health || echo 'Health check failed'

echo -e '\n=== Check nginx status ==='
sudo systemctl status nginx | grep -E 'Active|running' || echo 'Nginx status unknown'

echo -e '\n=== Recent nginx error logs ==='
sudo tail -20 /var/log/nginx/error.log 2>/dev/null || echo 'No nginx error logs found'
"@

Write-Host "`n=== Quick Fix Commands ===" -ForegroundColor Cyan
Write-Host "If PM2 is not running, you can restart it by running:" -ForegroundColor Yellow
Write-Host "  ssh -i '$EC2_KEY' ${workingUser}@${EC2_IP}" -ForegroundColor Gray
Write-Host "  cd ~/episode-metadata" -ForegroundColor Gray
Write-Host "  pm2 restart episode-api" -ForegroundColor Gray
Write-Host "  pm2 logs episode-api" -ForegroundColor Gray

Write-Host "`nWould you like to:" -ForegroundColor Cyan
Write-Host "  1. Restart the backend (pm2 restart episode-api)" -ForegroundColor Yellow
Write-Host "  2. Open interactive SSH session" -ForegroundColor Yellow
Write-Host "  3. Exit" -ForegroundColor Yellow

$choice = Read-Host "`nEnter choice (1-3)"

switch ($choice) {
    "1" {
        Write-Host "`nRestarting backend..." -ForegroundColor Cyan
        ssh -i $EC2_KEY -o StrictHostKeyChecking=no "${workingUser}@${EC2_IP}" @"
cd ~/episode-metadata
pm2 restart episode-api
sleep 3
pm2 status
echo -e '\n=== Testing health endpoint after restart ==='
curl -s http://localhost:3002/health
"@
        Write-Host "`n✅ Restart complete. Test the site now: https://dev.primepisodes.com/diagnostics" -ForegroundColor Green
    }
    "2" {
        Write-Host "`nOpening SSH session..." -ForegroundColor Cyan
        Write-Host "Run these commands to check/restart backend:" -ForegroundColor Yellow
        Write-Host "  pm2 status" -ForegroundColor Gray
        Write-Host "  pm2 logs episode-api --lines 50" -ForegroundColor Gray
        Write-Host "  pm2 restart episode-api" -ForegroundColor Gray
        Write-Host ""
        ssh -i $EC2_KEY -o StrictHostKeyChecking=no "${workingUser}@${EC2_IP}"
    }
    default {
        Write-Host "`nExiting..." -ForegroundColor Gray
    }
}
