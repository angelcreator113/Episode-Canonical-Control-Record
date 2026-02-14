# RDS Monitor and Migration Executor
# Monitors RDS until available, then runs migrations

$region = "us-east-1"
$targetDatabase = "episode-control-dev"
$checkIntervalSeconds = 30
$maxWaitMinutes = 15
$maxChecks = ($maxWaitMinutes * 60) / $checkIntervalSeconds

Write-Host "`nStarting RDS Monitor..." -ForegroundColor Cyan
Write-Host "Checking every $checkIntervalSeconds seconds for up to $maxWaitMinutes minutes" -ForegroundColor Gray

$checkCount = 0
$available = $false
$endpoint = $null

while ($checkCount -lt $maxChecks) {
    $checkCount++
    $timestamp = Get-Date -Format "HH:mm:ss"
    Write-Host "`n[$timestamp] Check #$checkCount" -ForegroundColor Yellow
    
    $result = aws rds describe-db-instances --db-instance-identifier $targetDatabase --region $region --query "DBInstances[0].{Status:DBInstanceStatus,Endpoint:Endpoint.Address,Port:Endpoint.Port}" 2>&1 | ConvertFrom-Json
    
    if ($result -and $result.Status) {
        if ($result.Status -eq "available") {
            $endpoint = $result.Endpoint
            $port = $result.Port
            Write-Host "STATUS: AVAILABLE" -ForegroundColor Green
            Write-Host "ENDPOINT: $endpoint`:$port" -ForegroundColor Green
            $available = $true
            break
        } else {
            Write-Host "STATUS: $($result.Status)" -ForegroundColor Gray
        }
    }
    
    if ($checkCount -lt $maxChecks) {
        Start-Sleep -Seconds $checkIntervalSeconds
    }
}

if (-not $available) {
    Write-Host "`nERROR: RDS not available after $maxWaitMinutes minutes" -ForegroundColor Red
    exit 1
}

Write-Host "`nRDS is ready! Running migrations..." -ForegroundColor Green

# Save endpoint
$endpointText = "$endpoint`:$port"
Set-Content -Path "rds-endpoint-dev.txt" -Value "Endpoint: $endpointText"
Write-Host "Saved endpoint to rds-endpoint-dev.txt" -ForegroundColor Gray

# Run migrations
npm run migrate

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nMigrations completed!" -ForegroundColor Green
} else {
    Write-Host "`nMigrations failed!" -ForegroundColor Red
    exit 1
}
