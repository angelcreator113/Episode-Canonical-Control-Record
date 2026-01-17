# Get RDS Endpoints Script
# Lists all RDS instances in your AWS account

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "  AWS RDS Instance Discovery" -ForegroundColor Cyan
Write-Host "============================================================`n" -ForegroundColor Cyan

Write-Host "Checking AWS CLI installation..." -ForegroundColor Yellow

# Check if AWS CLI is available
$awsExists = Get-Command aws -ErrorAction SilentlyContinue

if (-not $awsExists) {
    Write-Host "[INFO] AWS CLI not installed. Using AWS Console instead.`n" -ForegroundColor Yellow
    
    Write-Host "Please go to AWS Console and check:" -ForegroundColor Green
    Write-Host "1. Open: https://console.aws.amazon.com/rds/`n"
    Write-Host "2. Look at the 'Databases' section`n"
    Write-Host "3. Note down all DB instance identifiers you see`n"
    
    Write-Host "Current configuration:" -ForegroundColor Cyan
    Write-Host "=====================`n" -ForegroundColor Cyan
    
    if (Test-Path ".env.development") {
        $dev = Get-Content ".env.development" | Select-String "DB_HOST="
        Write-Host "Development: $dev" -ForegroundColor White
    }
    
    if (Test-Path ".env.staging") {
        $staging = Get-Content ".env.staging" | Select-String "DB_HOST="
        Write-Host "Staging:     $staging" -ForegroundColor White
    }
    
    if (Test-Path ".env.production") {
        $prod = Get-Content ".env.production" | Select-String "DB_HOST="
        Write-Host "Production:  $prod" -ForegroundColor White
    }
    
    Write-Host "`n[ACTION] Please verify these hostnames match your RDS instances`n" -ForegroundColor Yellow
    
} else {
    Write-Host "[INFO] AWS CLI found. Querying RDS instances...`n" -ForegroundColor Green
    
    try {
        $instances = aws rds describe-db-instances --query 'DBInstances[*].[DBInstanceIdentifier,Endpoint.Address,Endpoint.Port,DBInstanceStatus]' --output text 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "RDS Instances Found:" -ForegroundColor Green
            Write-Host "===================`n" -ForegroundColor Green
            Write-Host $instances
        } else {
            Write-Host "[ERROR] Failed to query RDS: $instances`n" -ForegroundColor Red
            Write-Host "Please check AWS Console manually." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "[ERROR] $($_.Exception.Message)`n" -ForegroundColor Red
    }
}

Write-Host "`n============================================================`n" -ForegroundColor Cyan
