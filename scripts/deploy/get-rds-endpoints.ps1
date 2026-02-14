# ============================================================================
# GET AWS RDS ENDPOINTS - PowerShell Version
# ============================================================================
# Purpose: Retrieve RDS endpoints for all environments
# Requirements: AWS PowerShell module (Install-Module -Name AWSPowerShell.NetCore)
# ============================================================================

Write-Host "`n=====================================================" -ForegroundColor Cyan
Write-Host "   AWS RDS ENDPOINT RETRIEVAL                       " -ForegroundColor Cyan
Write-Host "=====================================================`n" -ForegroundColor Cyan

# Check if AWS PowerShell module is available
try {
    Import-Module AWSPowerShell.NetCore -ErrorAction Stop
    Write-Host "[INFO] AWS PowerShell module loaded successfully" -ForegroundColor Cyan
} catch {
    Write-Host "[ERROR] AWS PowerShell module not found" -ForegroundColor Red
    Write-Host "`nPlease install it using:" -ForegroundColor Yellow
    Write-Host "  Install-Module -Name AWSPowerShell.NetCore -Force -Scope CurrentUser`n" -ForegroundColor White
    
    Write-Host "Alternatively, use AWS Console:" -ForegroundColor Yellow
    Write-Host "  1. Go to: https://console.aws.amazon.com/rds" -ForegroundColor White
    Write-Host "  2. Click on each database instance" -ForegroundColor White
    Write-Host "  3. Copy the 'Endpoint' value`n" -ForegroundColor White
    exit 1
}

$instances = @(
    @{ Name = "episode-metadata-db-dev"; Env = "Development" },
    @{ Name = "episode-metadata-db-staging"; Env = "Staging" },
    @{ Name = "episode-metadata-db-prod"; Env = "Production" }
)

Write-Host "Looking for RDS instances...`n" -ForegroundColor Cyan

$endpoints = @{}

foreach ($instance in $instances) {
    try {
        Write-Host "[INFO] Checking $($instance.Env) ($($instance.Name))..." -ForegroundColor Cyan
        
        $db = Get-RDSDBInstance -DBInstanceIdentifier $instance.Name -ErrorAction Stop
        
        if ($db) {
            $endpoints[$instance.Env] = @{
                Identifier = $db.DBInstanceIdentifier
                Endpoint = $db.Endpoint.Address
                Port = $db.Endpoint.Port
                Status = $db.DBInstanceStatus
                Engine = $db.Engine
                EngineVersion = $db.EngineVersion
            }
            
            Write-Host "[SUCCESS] Found $($instance.Env) database" -ForegroundColor Green
        }
    } catch {
        Write-Host "[WARNING] $($instance.Env) database not found or not accessible" -ForegroundColor Yellow
        $endpoints[$instance.Env] = $null
    }
}

# Display results
Write-Host "`n=====================================================" -ForegroundColor Cyan
Write-Host "   DATABASE ENDPOINTS                               " -ForegroundColor Cyan
Write-Host "=====================================================`n" -ForegroundColor Cyan

foreach ($env in @("Development", "Staging", "Production")) {
    if ($endpoints[$env]) {
        $db = $endpoints[$env]
        Write-Host "[$env]" -ForegroundColor Yellow
        Write-Host "  Instance: $($db.Identifier)" -ForegroundColor White
        Write-Host "  Endpoint: $($db.Endpoint)" -ForegroundColor Green
        Write-Host "  Port: $($db.Port)" -ForegroundColor White
        Write-Host "  Status: $($db.Status)" -ForegroundColor White
        Write-Host "  Engine: $($db.Engine) $($db.EngineVersion)" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host "[$env]" -ForegroundColor Yellow
        Write-Host "  Status: Not found or not accessible" -ForegroundColor Red
        Write-Host ""
    }
}

# Generate connection strings
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "   CONNECTION STRINGS (TEMPLATE)                   " -ForegroundColor Cyan
Write-Host "=====================================================`n" -ForegroundColor Cyan

Write-Host "[NOTE] Replace YOUR_PASSWORD with actual database passwords`n" -ForegroundColor Yellow

foreach ($env in @("Development", "Staging", "Production")) {
    if ($endpoints[$env]) {
        $db = $endpoints[$env]
        $connString = "postgresql://postgres:YOUR_PASSWORD@$($db.Endpoint):$($db.Port)/episode_metadata?sslmode=require"
        Write-Host "[$env]" -ForegroundColor Yellow
        Write-Host $connString -ForegroundColor White
        Write-Host ""
    }
}

# Generate environment file updates
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "   ENVIRONMENT FILE UPDATES                        " -ForegroundColor Cyan
Write-Host "=====================================================`n" -ForegroundColor Cyan

if ($endpoints["Development"]) {
    Write-Host "Update .env.development:" -ForegroundColor Yellow
    Write-Host "DB_HOST=$($endpoints['Development'].Endpoint)" -ForegroundColor White
    Write-Host "DB_PORT=$($endpoints['Development'].Port)" -ForegroundColor White
    Write-Host ""
}

if ($endpoints["Staging"]) {
    Write-Host "Update .env.staging:" -ForegroundColor Yellow
    Write-Host "DB_HOST_STAGING=$($endpoints['Staging'].Endpoint)" -ForegroundColor White
    Write-Host "DB_USER_STAGING=postgres" -ForegroundColor White
    Write-Host "DB_PASSWORD_STAGING=YOUR_STAGING_PASSWORD" -ForegroundColor White
    Write-Host ""
}

if ($endpoints["Production"]) {
    Write-Host "Update .env.production:" -ForegroundColor Yellow
    Write-Host "DB_HOST_PROD=$($endpoints['Production'].Endpoint)" -ForegroundColor White
    Write-Host "DB_USER_PROD=postgres" -ForegroundColor White
    Write-Host "DB_PASSWORD_PROD=YOUR_PRODUCTION_PASSWORD" -ForegroundColor White
    Write-Host ""
}

Write-Host "`n[NEXT STEPS]" -ForegroundColor Yellow
Write-Host "1. Update environment files with endpoints above" -ForegroundColor White
Write-Host "2. Add database passwords to environment files" -ForegroundColor White
Write-Host "3. Run: .\verify-databases.ps1 to test connections" -ForegroundColor White
Write-Host "4. Run: .\setup-databases.ps1 -Environment all -SeedData`n" -ForegroundColor White
