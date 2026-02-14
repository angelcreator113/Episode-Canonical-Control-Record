# Automated RDS Monitor + Migration Executor
# Continuously checks RDS status and runs migrations when available

param(
    [int]$CheckIntervalSeconds = 30
)

$region = "us-east-1"
$targetDatabase = "episode-control-dev"
$maxWaitMinutes = 15
$maxChecks = ($maxWaitMinutes * 60) / $CheckIntervalSeconds

Write-Host "`n╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  RDS Monitor + Migration Auto-Executor                        ║" -ForegroundColor Cyan
Write-Host "║  Will check every $CheckIntervalSeconds seconds for up to $maxWaitMinutes minutes         ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

$checkCount = 0
$available = $false
$endpoint = $null
$startTime = Get-Date

while ($checkCount -lt $maxChecks -and -not $available) {
    $checkCount++
    $elapsed = ((Get-Date) - $startTime).TotalSeconds
    $elapsedMin = [math]::Round($elapsed / 60, 1)
    
    Write-Host "`n[$elapsedMin min] Check #$checkCount - $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Yellow
    
    # Get RDS status
    $result = aws rds describe-db-instances `
        --db-instance-identifier $targetDatabase `
        --region $region `
        --query 'DBInstances[0].{Status:DBInstanceStatus,Endpoint:Endpoint.Address,Port:Endpoint.Port}' `
        2>&1 | ConvertFrom-Json
    
    if ($result -and $result.Status) {
        $status = $result.Status
        Write-Host "  Status: $status" -ForegroundColor $(if ($status -eq "available") { "Green" } else { "Gray" })
        
        if ($status -eq "available") {
            $available = $true
            $endpoint = $result.Endpoint
            $port = $result.Port
            Write-Host "  Endpoint: $endpoint`:$port" -ForegroundColor Green
            break
        }
    } else {
        Write-Host "  Status: Unknown/Not found" -ForegroundColor Gray
    }
    
    if ($checkCount -lt $maxChecks) {
        Write-Host "  Waiting $CheckIntervalSeconds seconds..." -ForegroundColor Gray
        Start-Sleep -Seconds $CheckIntervalSeconds
    }
}

if (-not $available) {
    Write-Host "`n✗ RDS did not become available after $maxWaitMinutes minutes" -ForegroundColor Red
    Write-Host "`nPlease check manually:" -ForegroundColor Yellow
    Write-Host "  powershell -File check-rds.ps1" -ForegroundColor Gray
    exit 1
}

Write-Host "`n✓ RDS is AVAILABLE!" -ForegroundColor Green
$displayEndpoint = "$endpoint`:$port"
Write-Host "  Endpoint: $displayEndpoint" -ForegroundColor Green

# Save endpoint to file
Write-Host "`nSaving endpoint..." -ForegroundColor Cyan
$endpointContent = "=== RDS Dev Endpoint ===`n$displayEndpoint`nDatabase: episode_metadata`nUsername: postgres"
Set-Content -Path "rds-endpoint-dev.txt" -Value $endpointContent
Write-Host "  Saved to rds-endpoint-dev.txt" -ForegroundColor Green

# Now run migrations
Write-Host "`n╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Running Database Migrations                                  ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

Write-Host "`nExecuting migrations..." -ForegroundColor Yellow

# Check if migrations directory exists
if (-not (Test-Path "src/migrations")) {
    Write-Host "✗ Migrations directory not found at src/migrations" -ForegroundColor Red
    exit 1
}

# Run migrations with npm
Write-Host "`n  Running: npm run migrate" -ForegroundColor Gray
npm run migrate

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✓ Migrations completed successfully!" -ForegroundColor Green
    
    Write-Host "`n╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║  READY FOR TESTING                                            ║" -ForegroundColor Green
    Write-Host "║  All systems online and ready!                                ║" -ForegroundColor Green
    Write-Host "╚═══════════════════════════════════════════════════════════════╝" -ForegroundColor Green
    
    Write-Host "`nNext steps:" -ForegroundColor Cyan
    Write-Host "  1. Verify database schema:" -ForegroundColor Gray
    Write-Host "     npm run verify-db" -ForegroundColor Gray
    Write-Host "  2. Run test suite:" -ForegroundColor Gray
    Write-Host "     npm test" -ForegroundColor Gray
} else {
    Write-Host "`n✗ Migration failed with exit code $LASTEXITCODE" -ForegroundColor Red
    exit 1
}

Write-Host "`nMonitoring and migration completed at $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Cyan
