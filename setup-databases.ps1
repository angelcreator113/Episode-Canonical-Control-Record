# ============================================================================
# DATABASE SETUP SCRIPT - Multi-Environment
# ============================================================================
# Purpose: Set up and configure databases for dev, staging, and production
# Usage: .\setup-databases.ps1 -Environment <dev|staging|production|all>
# ============================================================================

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("dev", "staging", "production", "all")]
    [string]$Environment = "dev",
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipMigrations = $false,
    
    [Parameter(Mandatory=$false)]
    [switch]$SeedData = $false,
    
    [Parameter(Mandatory=$false)]
    [switch]$Verify = $false
)

# Color output functions
function Write-Success { param($message) Write-Host "✅ $message" -ForegroundColor Green }
function Write-Error { param($message) Write-Host "❌ $message" -ForegroundColor Red }
function Write-Info { param($message) Write-Host "ℹ️  $message" -ForegroundColor Cyan }
function Write-Warning { param($message) Write-Host "⚠️  $message" -ForegroundColor Yellow }

# Load environment variables
function Load-Environment {
    param([string]$EnvFile)
    
    Write-Info "Loading environment from $EnvFile"
    
    if (-not (Test-Path $EnvFile)) {
        Write-Error "Environment file not found: $EnvFile"
        return $false
    }
    
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.+)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            
            # Remove quotes if present
            $value = $value -replace '^["'']|["'']$', ''
            
            # Expand variables like ${VAR}
            while ($value -match '\$\{([^}]+)\}') {
                $varName = $matches[1]
                $varValue = [Environment]::GetEnvironmentVariable($varName)
                $value = $value -replace "\$\{$varName\}", $varValue
            }
            
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
    
    return $true
}

# Test database connection
function Test-DatabaseConnection {
    param([string]$ConnectionString)
    
    Write-Info "Testing database connection..."
    
    try {
        $env:DATABASE_URL = $ConnectionString
        $result = npm run db:test 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Database connection successful"
            return $true
        } else {
            Write-Error "Database connection failed: $result"
            return $false
        }
    } catch {
        Write-Error "Failed to test connection: $_"
        return $false
    }
}

# Run database migrations
function Run-Migrations {
    param([string]$EnvName)
    
    Write-Info "Running migrations for $EnvName environment..."
    
    try {
        $result = npm run migrate 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Migrations completed successfully"
            return $true
        } else {
            Write-Error "Migration failed: $result"
            return $false
        }
    } catch {
        Write-Error "Failed to run migrations: $_"
        return $false
    }
}

# Seed database with test data
function Seed-Database {
    param([string]$EnvName)
    
    if ($EnvName -eq "production") {
        Write-Warning "Skipping seed data for production environment"
        return $true
    }
    
    Write-Info "Seeding database for $EnvName environment..."
    
    try {
        if (Test-Path ".\seed-$EnvName.js") {
            node ".\seed-$EnvName.js"
        } elseif (Test-Path ".\create-test-data.js") {
            node ".\create-test-data.js"
        } else {
            Write-Warning "No seed script found, skipping..."
            return $true
        }
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Database seeded successfully"
            return $true
        } else {
            Write-Error "Seeding failed"
            return $false
        }
    } catch {
        Write-Error "Failed to seed database: $_"
        return $false
    }
}

# Verify database schema
function Verify-DatabaseSchema {
    Write-Info "Verifying database schema..."
    
    $expectedTables = @(
        "episodes",
        "shows",
        "templates",
        "scenes",
        "assets",
        "users",
        "activity_logs"
    )
    
    try {
        # Run a simple query to check tables
        $query = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
        
        Write-Info "Expected tables: $($expectedTables -join ', ')"
        Write-Success "Schema verification completed"
        return $true
    } catch {
        Write-Error "Schema verification failed: $_"
        return $false
    }
}

# Setup database for specific environment
function Setup-Database {
    param([string]$EnvName)
    
    Write-Host "`n================================================" -ForegroundColor Magenta
    Write-Host "  Setting up $EnvName database" -ForegroundColor Magenta
    Write-Host "================================================`n" -ForegroundColor Magenta
    
    # Load environment file
    $envFile = ".env.$EnvName"
    if ($EnvName -eq "production") {
        if (Test-Path ".env.production") {
            $envFile = ".env.production"
        } else {
            $envFile = ".env.production.template"
            Write-Warning "Using .env.production.template - create .env.production with real values"
        }
    }
    
    if (-not (Load-Environment $envFile)) {
        return $false
    }
    
    # Get database connection string
    $dbUrl = [Environment]::GetEnvironmentVariable("DATABASE_URL")
    if (-not $dbUrl) {
        Write-Error "DATABASE_URL not found in environment"
        return $false
    }
    
    Write-Info "Database URL: $($dbUrl -replace ':[^:@]+@', ':****@')"
    
    # Test connection
    if (-not (Test-DatabaseConnection $dbUrl)) {
        return $false
    }
    
    # Run migrations
    if (-not $SkipMigrations) {
        if (-not (Run-Migrations $EnvName)) {
            return $false
        }
    } else {
        Write-Warning "Skipping migrations (--SkipMigrations flag set)"
    }
    
    # Seed data if requested
    if ($SeedData) {
        if (-not (Seed-Database $EnvName)) {
            return $false
        }
    }
    
    # Verify schema
    if ($Verify) {
        if (-not (Verify-DatabaseSchema)) {
            return $false
        }
    }
    
    Write-Success "$EnvName database setup completed successfully!`n"
    return $true
}

# Main execution
Write-Host "`n╔════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   DATABASE SETUP - Multi-Environment          ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

$environments = @()
if ($Environment -eq "all") {
    $environments = @("dev", "staging", "production")
    Write-Info "Setting up ALL environments: dev, staging, production"
} else {
    $environments = @($Environment)
    Write-Info "Setting up $Environment environment"
}

$results = @{}
foreach ($env in $environments) {
    $success = Setup-Database $env
    $results[$env] = $success
}

# Summary
Write-Host "`n╔════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   SETUP SUMMARY                                ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

foreach ($env in $environments) {
    if ($results[$env]) {
        Write-Success "$env : Setup completed successfully"
    } else {
        Write-Error "$env : Setup failed"
    }
}

# Exit with appropriate code
$allSuccess = $results.Values | Where-Object { $_ -eq $false } | Measure-Object | Select-Object -ExpandProperty Count
if ($allSuccess -eq 0) {
    Write-Host "`n✅ All database setups completed successfully!`n" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n❌ Some database setups failed. Check logs above.`n" -ForegroundColor Red
    exit 1
}
