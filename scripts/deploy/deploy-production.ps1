# ============================================================================
# PRODUCTION ENVIRONMENT DEPLOYMENT SCRIPT (PowerShell)
# ============================================================================
# Deploy to production environment
# Usage: .\deploy-production.ps1 -Action deploy
# Actions: deploy, rollback, restart, logs, health, backup
# ============================================================================

param(
    [ValidateSet('deploy', 'rollback', 'restart', 'logs', 'health', 'backup')]
    [string]$Action = 'deploy'
)

# Configuration
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Environment = 'production'
$Timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$BackupDir = Join-Path $ProjectDir 'backups\production'
$LogFile = Join-Path $ProjectDir "logs\deploy_production_${Timestamp}.log"

# Create directories
New-Item -Path (Split-Path -Parent $LogFile) -ItemType Directory -Force | Out-Null
New-Item -Path $BackupDir -ItemType Directory -Force | Out-Null

# Logging functions
function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    "[$timestamp] $Message" | Tee-Object -FilePath $LogFile -Append
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
    Write-Log "[SUCCESS] $Message"
}

function Write-Error-Log {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
    Write-Log "[ERROR] $Message"
    exit 1
}

function Write-Warning-Log {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
    Write-Log "[WARNING] $Message"
}

# Confirmation for production
function Test-ProductionConfirmation {
    Write-Host "`n⚠️  WARNING: You are about to deploy to PRODUCTION" -ForegroundColor Red
    Write-Host "This will affect live users. Proceed? (type 'yes' to continue)" -ForegroundColor Red
    $confirmation = Read-Host
    if ($confirmation -ne 'yes') {
        Write-Error-Log "Production deployment cancelled"
    }
}

# Health check function
function Test-Health {
    Write-Log "Checking application health..."
    for ($i = 0; $i -lt 30; $i++) {
        try {
            $response = Invoke-WebRequest -Uri 'http://localhost:3003/api/v1/health' -UseBasicParsing -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                Write-Success "Application is healthy"
                return $true
            }
        }
        catch {
            Write-Host -NoNewline "."
            Start-Sleep -Seconds 1
        }
    }
    Write-Error-Log "Application failed health check"
}

# Deploy function
function Start-Deploy {
    Test-ProductionConfirmation
    
    Write-Log "Starting production deployment..."
    
    if (-not (Test-Path "$ProjectDir\.env.production")) {
        Write-Error-Log ".env.production file not found"
    }
    
    # Backup database
    Write-Log "Creating database backup..."
    $backupFile = Join-Path $BackupDir "db_backup_${Timestamp}.sql"
    try {
        docker-compose -f docker-compose.production.yml exec -T postgres pg_dump -U postgres episode_metadata > $backupFile
    }
    catch {
        Write-Error-Log "Database backup failed"
    }
    
    # Install dependencies
    Write-Log "Installing dependencies..."
    npm ci
    Set-Location frontend
    npm ci
    npm run build
    Set-Location ..
    
    # Stop containers
    Write-Log "Stopping existing containers..."
    docker-compose -f docker-compose.production.yml down --remove-orphans -ErrorAction SilentlyContinue
    
    # Start services
    Write-Log "Starting services..."
    docker-compose -f docker-compose.production.yml up -d
    
    Start-Sleep -Seconds 10
    
    # Run migrations
    Write-Log "Running database migrations..."
    docker-compose -f docker-compose.production.yml exec -T app npm run migrate:up
    
    # Health check
    Test-Health
    
    Write-Success "Production deployment completed successfully!"
    Write-Log "Backup directory: $BackupDir"
}

# Backup function
function Start-Backup {
    Write-Log "Creating production backup..."
    $backupFile = Join-Path $BackupDir "db_backup_${Timestamp}.sql"
    try {
        docker-compose -f docker-compose.production.yml exec -T postgres pg_dump -U postgres episode_metadata > $backupFile
        Write-Success "Backup completed: $BackupDir"
    }
    catch {
        Write-Error-Log "Database backup failed"
    }
}

# Restart function
function Restart-Services {
    Test-ProductionConfirmation
    
    Write-Log "Restarting production environment..."
    docker-compose -f docker-compose.production.yml restart
    Test-Health
    Write-Success "Restart completed successfully!"
}

# Logs function
function Get-Logs {
    docker-compose -f docker-compose.production.yml logs -f app
}

# Health check function
function Get-Health {
    Write-Log "Checking production environment health..."
    Write-Host "`n[Docker Containers]" -ForegroundColor Cyan
    docker-compose -f docker-compose.production.yml ps
    
    Write-Host "`n[Application Health]" -ForegroundColor Cyan
    try {
        $response = Invoke-RestMethod -Uri 'http://localhost:3003/api/v1/health' -ErrorAction Stop
        $response | ConvertTo-Json
    }
    catch {
        Write-Host "Application not responding"
    }
}

# Main execution
Write-Log "=== Production Environment Deployment (PowerShell) ==="
Write-Log "Environment: $Environment"
Write-Log "Action: $Action"

Set-Location $ProjectDir

switch ($Action) {
    'deploy' { Start-Deploy }
    'restart' { Restart-Services }
    'logs' { Get-Logs }
    'health' { Get-Health }
    'backup' { Start-Backup }
    default { Write-Error-Log "Unknown action: $Action" }
}

Write-Log "Done!"
