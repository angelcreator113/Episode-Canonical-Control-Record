# restart-server.ps1 - Quick server restart
Write-Host "🔄 Restarting server to load new animatic routes..." -ForegroundColor Cyan
Write-Host ""

# Find and kill existing Node processes (app.js)
$processes = Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
    $_.MainModule.FileName -like "*node.exe*"
}

if ($processes) {
    Write-Host "⏹️  Stopping existing server..." -ForegroundColor Yellow
    $processes | ForEach-Object {
        Stop-Process -Id $_.Id -Force
        Write-Host "   Killed process $($_.Id)" -ForegroundColor Gray
    }
    Start-Sleep -Seconds 1
    Write-Host ""
}

Write-Host "▶️  Starting server with new routes..." -ForegroundColor Green
Write-Host "   Run in workspace root: npm start" -ForegroundColor Gray
Write-Host ""
Write-Host "💡 Then test with: node test-animatic-routes.js" -ForegroundColor Cyan
Write-Host ""
