# ============================================================================
# DEPLOYMENT SCRIPT - Production Deployment Automation (PowerShell)
# ============================================================================
# Usage: .\deploy.ps1 -Environment production -Action deploy
#        .\deploy.ps1 -Environment staging -Action rollback
# ============================================================================

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('development', 'staging', 'production')]
    [string]$Environment,

    [Parameter(Mandatory=$true)]
    [ValidateSet('deploy', 'rollback', 'backup', 'test')]
    [string]$Action
)

# Configuration
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommandPath
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupDir = "C:\Backups\episode-metadata"
$LogDir = "C:\Logs\episode-metadata"
$LogFile = Join-Path $LogDir "deploy_${Timestamp}.log"

# Ensure directories exist
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $output = "[$timestamp] [$Level] $Message"
    Write-Host $output
    Add-Content -Path $LogFile -Value $output
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
    Write-Log $Message "SUCCESS"
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
    Write-Log $Message "ERROR"
    exit 1
}

function Write-Warning-Custom {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
    Write-Log $Message "WARNING"
}

# ============================================================================
# PRE-DEPLOYMENT CHECKS
# ============================================================================

function Test-PreDeploymentChecks {
    Write-Log "Running pre-deployment checks..."

    # Check environment file
    $envFile = Join-Path $ProjectDir ".env.$Environment"
    if (-not (Test-Path $envFile)) {
        Write-Error-Custom "Environment file not found: $envFile"
    }
    Write-Success "Environment file found"

    # Check Node.js
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Error-Custom "Node.js is not installed"
    }
    $nodeVersion = node --version
    Write-Success "Node.js installed: $nodeVersion"

    # Check npm
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Error-Custom "npm is not installed"
    }
    $npmVersion = npm --version
    Write-Success "npm installed: $npmVersion"

    # Check disk space (need at least 2GB)
    $diskSpace = (Get-Volume -DriveLetter C).SizeRemaining / 1GB
    if ($diskSpace -lt 2) {
        Write-Error-Custom "Insufficient disk space (need 2GB, have ${diskSpace}GB)"
    }
    Write-Success "Sufficient disk space available: ${diskSpace}GB"
}

# ============================================================================
# BACKUP CURRENT DEPLOYMENT
# ============================================================================

function Backup-CurrentDeployment {
    Write-Log "Backing up current deployment..."

    $appPath = "C:\Apps\episode-metadata"
    if (-not (Test-Path $appPath)) {
        Write-Log "No current deployment to backup"
        return
    }

    $backupPath = Join-Path $BackupDir "backup_$Timestamp"
    New-Item -ItemType Directory -Force -Path $backupPath | Out-Null

    # Backup application
    Write-Log "Backing up application code..."
    Copy-Item -Path $appPath -Destination (Join-Path $backupPath "app") -Recurse -Force
    Write-Success "Application backed up"

    # Backup environment file
    Copy-Item -Path (Join-Path $ProjectDir ".env.$Environment") `
              -Destination (Join-Path $backupPath ".env.$Environment") `
              -Force -ErrorAction SilentlyContinue

    Write-Success "Backup created at $backupPath"
    $backupPath | Out-File -FilePath (Join-Path $ProjectDir ".last_backup") -Force
}

# ============================================================================
# DEPLOYMENT
# ============================================================================

function Invoke-Deployment {
    Write-Log "Starting deployment to $Environment..."

    # Backup
    Backup-CurrentDeployment

    # Load environment
    Write-Log "Loading environment configuration..."
    $envFile = Join-Path $ProjectDir ".env.$Environment"
    Get-Content $envFile | ForEach-Object {
        if ($_ -and -not $_.StartsWith("#")) {
            $name, $value = $_.Split("=", 2)
            [Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim())
        }
    }

    # Install dependencies
    Write-Log "Installing dependencies..."
    Push-Location $ProjectDir
    npm ci --production
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "npm install failed"
    }
    Pop-Location

    # Build frontend
    $frontendPath = Join-Path $ProjectDir "frontend"
    if (Test-Path $frontendPath) {
        Write-Log "Building frontend..."
        Push-Location $frontendPath
        npm ci
        npm run build
        if ($LASTEXITCODE -ne 0) {
            Write-Error-Custom "Frontend build failed"
        }
        Write-Success "Frontend built successfully"
        Pop-Location
    }

    # Run migrations
    Write-Log "Running database migrations..."
    Push-Location $ProjectDir
    npm run migrate:up
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "Database migration failed"
    }
    Pop-Location

    # Run tests
    Write-Log "Running tests..."
    Push-Location $ProjectDir
    npm test -- --coverage
    if ($LASTEXITCODE -ne 0) {
        Write-Warning-Custom "Some tests failed - review logs"
    }
    Pop-Location

    # Health check
    Write-Log "Verifying deployment..."
    Start-Sleep -Seconds 5
    
    try {
        $health = Invoke-RestMethod -Uri "http://localhost:3002/health" -ErrorAction Stop
        if ($health.status -eq "healthy") {
            Write-Success "API is healthy"
        }
    }
    catch {
        Write-Error-Custom "Health check failed: $_"
    }

    Write-Success "Deployment to $Environment completed successfully!"
}

# ============================================================================
# ROLLBACK
# ============================================================================

function Invoke-Rollback {
    Write-Log "Starting rollback procedure..."

    $lastBackupFile = Join-Path $ProjectDir ".last_backup"
    if (-not (Test-Path $lastBackupFile)) {
        Write-Error-Custom "No backup found for rollback"
    }

    $backupPath = Get-Content $lastBackupFile
    if (-not (Test-Path $backupPath)) {
        Write-Error-Custom "Backup directory not found: $backupPath"
    }

    Write-Log "Rolling back from $backupPath"

    # Restore application
    $appPath = "C:\Apps\episode-metadata"
    if (Test-Path $appPath) {
        Remove-Item -Path $appPath -Recurse -Force
    }

    $sourceApp = Join-Path $backupPath "app"
    Copy-Item -Path $sourceApp -Destination $appPath -Recurse -Force

    Write-Success "Application restored"
    Write-Success "Rollback completed successfully"
}

# ============================================================================
# SMOKE TESTS
# ============================================================================

function Invoke-SmokeTests {
    Write-Log "Running smoke tests..."

    $baseUrl = "http://localhost:3002"

    # Test 1: Health check
    Write-Log "Test 1: Health check..."
    try {
        $health = Invoke-RestMethod -Uri "$baseUrl/health" -ErrorAction Stop
        if ($health.status -eq "healthy") {
            Write-Success "Health check passed"
        }
    }
    catch {
        Write-Error-Custom "Health check failed: $_"
    }

    # Test 2: Login
    Write-Log "Test 2: Login endpoint..."
    try {
        $loginBody = @{
            email = "test@example.com"
            password = "password123"
        } | ConvertTo-Json

        $login = Invoke-RestMethod -Uri "$baseUrl/api/v1/auth/login" `
                                   -Method Post `
                                   -Body $loginBody `
                                   -ContentType "application/json" `
                                   -ErrorAction Stop

        if ($login.data.accessToken) {
            $token = $login.data.accessToken
            Write-Success "Login test passed"

            # Test 3: Protected endpoint
            Write-Log "Test 3: Protected endpoint (/me)..."
            $me = Invoke-RestMethod -Uri "$baseUrl/api/v1/auth/me" `
                                    -Headers @{Authorization = "Bearer $token"} `
                                    -ErrorAction Stop
            
            if ($me.data.user.email) {
                Write-Success "Protected endpoint test passed"
            }
        }
    }
    catch {
        Write-Error-Custom "Login test failed: $_"
    }

    # Test 4: Episodes endpoint
    Write-Log "Test 4: Episodes endpoint..."
    try {
        $episodes = Invoke-RestMethod -Uri "$baseUrl/api/v1/episodes" -ErrorAction Stop
        if ($episodes.data) {
            Write-Success "Episodes endpoint test passed"
        }
    }
    catch {
        Write-Error-Custom "Episodes endpoint test failed: $_"
    }

    Write-Success "All smoke tests passed!"
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   EPISODE METADATA API - DEPLOYMENT SCRIPT         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Write-Log "Environment: $Environment"
Write-Log "Action: $Action"
Write-Log "Timestamp: $Timestamp"

switch ($Action) {
    "deploy" {
        Test-PreDeploymentChecks
        Invoke-Deployment
        Invoke-SmokeTests
    }
    "rollback" {
        Invoke-Rollback
        Invoke-SmokeTests
    }
    "backup" {
        Backup-CurrentDeployment
    }
    "test" {
        Invoke-SmokeTests
    }
    default {
        Write-Error-Custom "Unknown action: $Action. Use: deploy, rollback, backup, or test"
    }
}

Write-Log "Deployment script completed"
Write-Host ""
Write-Success "Operation completed successfully!"
