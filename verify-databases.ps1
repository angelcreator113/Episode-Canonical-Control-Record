# ============================================================================
# DATABASE VERIFICATION SCRIPT
# ============================================================================
# Purpose: Verify all database connections and schemas across environments
# Usage: .\verify-databases.ps1 [-Environment <dev|staging|production|all>]
# ============================================================================

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("dev", "staging", "production", "all")]
    [string]$Environment = "all"
)

function Write-Success { param($message) Write-Host "✅ $message" -ForegroundColor Green }
function Write-Error { param($message) Write-Host "❌ $message" -ForegroundColor Red }
function Write-Info { param($message) Write-Host "ℹ️  $message" -ForegroundColor Cyan }

function Get-DatabaseInfo {
    param([string]$EnvFile)
    
    $info = @{
        Host = ""
        Port = ""
        Database = ""
        User = ""
        SSL = ""
    }
    
    if (-not (Test-Path $EnvFile)) {
        Write-Error "Environment file not found: $EnvFile"
        return $null
    }
    
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match 'DB_HOST[=:](.+)$') { $info.Host = $matches[1].Trim() -replace '["'']', '' }
        if ($_ -match 'DB_PORT[=:](.+)$') { $info.Port = $matches[1].Trim() -replace '["'']', '' }
        if ($_ -match 'DB_NAME[=:](.+)$') { $info.Database = $matches[1].Trim() -replace '["'']', '' }
        if ($_ -match 'DB_USER[=:](.+)$') { $info.User = $matches[1].Trim() -replace '["'']', '' }
        if ($_ -match 'DATABASE_SSL[=:](.+)$') { $info.SSL = $matches[1].Trim() -replace '["'']', '' }
    }
    
    return $info
}

function Test-DatabaseConnection {
    param(
        [string]$EnvName,
        [string]$EnvFile
    )
    
    Write-Host "`n─────────────────────────────────────────────" -ForegroundColor Gray
    Write-Host " Testing $EnvName Environment" -ForegroundColor Yellow
    Write-Host "─────────────────────────────────────────────`n" -ForegroundColor Gray
    
    $info = Get-DatabaseInfo $EnvFile
    if (-not $info) {
        Write-Error "Failed to load database info"
        return $false
    }
    
    Write-Info "Database Host: $($info.Host)"
    Write-Info "Database Port: $($info.Port)"
    Write-Info "Database Name: $($info.Database)"
    Write-Info "Database User: $($info.User)"
    Write-Info "SSL Enabled: $($info.SSL)"
    
    # Test with pg_isready if available (requires psql installed)
    try {
        if ($info.Host -and $info.Port) {
            $testCmd = "pg_isready -h $($info.Host) -p $($info.Port) -U $($info.User) 2>&1"
            $result = Invoke-Expression $testCmd
            
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Database server is accepting connections"
                return $true
            } else {
                Write-Error "Database server is not responding"
                Write-Info "Result: $result"
                return $false
            }
        } else {
            Write-Error "Missing database host or port information"
            return $false
        }
    } catch {
        Write-Warning "pg_isready not available, skipping connection test"
        Write-Info "Install PostgreSQL client tools for connection testing"
        return $null
    }
}

# Main execution
Write-Host "`n╔════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   DATABASE VERIFICATION                        ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════╝" -ForegroundColor Cyan

$environments = @()
if ($Environment -eq "all") {
    $environments = @(
        @{ Name = "dev"; File = ".env.development" },
        @{ Name = "staging"; File = ".env.staging" },
        @{ Name = "production"; File = ".env.production" }
    )
} else {
    $envFile = switch ($Environment) {
        "dev" { ".env.development" }
        "staging" { ".env.staging" }
        "production" { ".env.production" }
    }
    $environments = @(@{ Name = $Environment; File = $envFile })
}

$results = @{}
foreach ($env in $environments) {
    $result = Test-DatabaseConnection -EnvName $env.Name -EnvFile $env.File
    $results[$env.Name] = $result
}

# Summary
Write-Host "`n╔════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   VERIFICATION SUMMARY                         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

foreach ($env in $environments) {
    $status = $results[$env.Name]
    if ($status -eq $true) {
        Write-Success "$($env.Name) : Connected"
    } elseif ($status -eq $false) {
        Write-Error "$($env.Name) : Connection failed"
    } else {
        Write-Warning "$($env.Name) : Unable to verify (install PostgreSQL client tools)"
    }
}

Write-Host "`n📋 Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Ensure all RDS instances are running in AWS" -ForegroundColor White
Write-Host "  2. Verify security groups allow your IP" -ForegroundColor White
Write-Host "  3. Check credentials in environment files" -ForegroundColor White
Write-Host "  4. Run: .\setup-databases.ps1 -Environment all -SeedData`n" -ForegroundColor White
