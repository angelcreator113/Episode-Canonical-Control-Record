# Quick EC2 Diagnostic Script
# Run this to check the status of your deployment

Write-Host "🔍 EC2 Deployment Diagnostics" -ForegroundColor Cyan
Write-Host "==============================`n" -ForegroundColor Cyan

# Get EC2 host from secrets (you'll need to replace this)
$EC2_HOST = Read-Host "Enter your EC2 Host IP or hostname"
$SSH_KEY = Read-Host "Enter path to your SSH key file (.pem)"

Write-Host "`n📊 Checking PM2 Status..." -ForegroundColor Yellow
ssh -i $SSH_KEY ubuntu@$EC2_HOST "pm2 status"

Write-Host "`n📋 Checking PM2 Logs (last 30 lines)..." -ForegroundColor Yellow
ssh -i $SSH_KEY ubuntu@$EC2_HOST "pm2 logs episode-api --lines 30 --nostream"

Write-Host "`n🔍 Checking if port 3002 is listening..." -ForegroundColor Yellow
ssh -i $SSH_KEY ubuntu@$EC2_HOST "sudo lsof -i :3002"

Write-Host "`n🧪 Testing health endpoint locally on EC2..." -ForegroundColor Yellow
ssh -i $SSH_KEY ubuntu@$EC2_HOST "curl -s http://localhost:3002/health"

Write-Host "`n🔍 Checking Node version..." -ForegroundColor Yellow
ssh -i $SSH_KEY ubuntu@$EC2_HOST "node --version && which node"

Write-Host "`n🔍 Checking PM2 Node version..." -ForegroundColor Yellow
ssh -i $SSH_KEY ubuntu@$EC2_HOST "pm2 show episode-api | grep -E 'node.js version|interpreter|script'"

Write-Host "`n📁 Checking if server file exists..." -ForegroundColor Yellow
ssh -i $SSH_KEY ubuntu@$EC2_HOST "ls -la ~/episode-metadata/src/server.js"

Write-Host "`n🔍 Recent error logs..." -ForegroundColor Yellow
ssh -i $SSH_KEY ubuntu@$EC2_HOST "tail -50 ~/episode-metadata/logs/error.log 2>/dev/null || echo 'No error log found'"

Write-Host "`nDiagnostics complete!" -ForegroundColor Green
