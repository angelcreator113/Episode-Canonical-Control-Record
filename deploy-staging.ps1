# ============================================================================
# STAGING ENVIRONMENT DEPLOYMENT SCRIPT (PowerShell)
# ============================================================================
# Deploy to staging environment
# Usage: .\deploy-staging.ps1 -Action deploy
# Actions: deploy, rollback, restart, logs, health
# ============================================================================

param(
    [ValidateSet('deploy', 'rollback', 'restart', 'logs', 'health')]
    [string]$Action = 'deploy'
)

# Configuration
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Environment = 'staging'
$Timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$BackupDir = Join-Path $ProjectDir 'backups\staging'
$LogFile = Join-Path $ProjectDir "logs\deploy_staging_${Timestamp}.log"

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

# Health check function
function Test-Health {
    Write-Log "Checking application health..."
    for ($i = 0; $i -lt 30; $i++) {
        try {
            $response = Invoke-WebRequest -Uri 'http://localhost:3002/api/v1/health' -UseBasicParsing -ErrorAction Stop
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
    Write-Log "Starting staging deployment..."
    
    if (-not (Test-Path "$ProjectDir\.env.staging")) {
        Write-Error-Log ".env.staging file not found"
    }
    
    # Backup database
    Write-Log "Creating database backup..."
    $backupFile = Join-Path $BackupDir "db_backup_${Timestamp}.sql"
    try {
        docker-compose -f docker-compose.staging.yml exec -T postgres pg_dump -U postgres episode_metadata > $backupFile
    }
    catch {
        Write-Warning-Log "Database backup skipped"
    }
    
    # Install dependencies
    Write-Log "Installing dependencies..."
    npm ci
    Set-Location frontend
    npm ci
    Set-Location ..
    
    # Build frontend
    Write-Log "Building frontend..."
    Set-Location frontend
    npm run build
    Set-Location ..
    
    # Stop containers
    Write-Log "Stopping existing containers..."
    docker-compose -f docker-compose.staging.yml down --remove-orphans -ErrorAction SilentlyContinue
    
    # Start services
    Write-Log "Starting services..."
    docker-compose -f docker-compose.staging.yml up -d
    
    Start-Sleep -Seconds 5
    
    # Run migrations
    Write-Log "Running database migrations..."
    docker-compose -f docker-compose.staging.yml exec -T app npm run migrate:up
    
    # Health check
    Test-Health
    
    Write-Success "Staging deployment completed successfully!"
}

# Restart function
function Restart-Services {
    Write-Log "Restarting staging environment..."
    docker-compose -f docker-compose.staging.yml restart
    Test-Health
    Write-Success "Restart completed successfully!"
}

# Logs function
function Get-Logs {
    docker-compose -f docker-compose.staging.yml logs -f app
}

# Health check function
function Get-Health {
    Write-Log "Checking staging environment health..."
    Write-Host "`n[Docker Containers]" -ForegroundColor Cyan
    docker-compose -f docker-compose.staging.yml ps
    
    Write-Host "`n[Application Health]" -ForegroundColor Cyan
    try {
        $response = Invoke-RestMethod -Uri 'http://localhost:3002/api/v1/health' -ErrorAction Stop
        $response | ConvertTo-Json
    }
    catch {
        Write-Host "Application not responding"
    }
}

# Main execution
Write-Log "=== Staging Environment Deployment (PowerShell) ==="
Write-Log "Environment: $Environment"
Write-Log "Action: $Action"

Set-Location $ProjectDir

switch ($Action) {
    'deploy' { Start-Deploy }
    'restart' { Restart-Services }
    'logs' { Get-Logs }
    'health' { Get-Health }
    default { Write-Error-Log "Unknown action: $Action" }
}

Write-Log "Done!"
