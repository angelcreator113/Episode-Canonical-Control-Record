#!/bin/bash
# ============================================================================
# DEPLOYMENT SCRIPT - Production Deployment Automation
# ============================================================================
# Usage: ./deploy.sh [environment] [action]
# Example: ./deploy.sh production deploy
#          ./deploy.sh staging rollback
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENVIRONMENT="${1:-production}"
ACTION="${2:-deploy}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/episode-metadata"
LOG_FILE="/var/log/episode-metadata/deploy_${TIMESTAMP}.log"

# Ensure log directory exists
mkdir -p /var/log/episode-metadata
mkdir -p "$BACKUP_DIR"

log() {
  echo -e "${CYAN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
  echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
  exit 1
}

success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# ============================================================================
# PRE-DEPLOYMENT CHECKS
# ============================================================================

pre_deployment_checks() {
  log "Running pre-deployment checks..."

  # Check if environment file exists
  if [ ! -f "$PROJECT_DIR/.env.${ENVIRONMENT}" ]; then
    error "Environment file .env.${ENVIRONMENT} not found"
  fi
  
  # Check if Node.js is installed
  if ! command -v node &> /dev/null; then
    error "Node.js is not installed"
  fi
  
  # Check if npm is installed
  if ! command -v npm &> /dev/null; then
    error "npm is not installed"
  fi

  # Check if git is installed (for version tracking)
  if ! command -v git &> /dev/null; then
    warning "git is not installed - version tracking disabled"
  fi

  # Check disk space (need at least 2GB)
  AVAILABLE_SPACE=$(df /app | awk 'NR==2 {print $4}')
  if [ "$AVAILABLE_SPACE" -lt 2097152 ]; then
    error "Insufficient disk space (need 2GB, have ${AVAILABLE_SPACE}KB)"
  fi

  success "Pre-deployment checks passed"
}

# ============================================================================
# BACKUP CURRENT DEPLOYMENT
# ============================================================================

backup_current() {
  log "Backing up current deployment..."

  if [ ! -d "/app/episode-metadata" ]; then
    log "No current deployment to backup"
    return 0
  fi

  BACKUP_PATH="$BACKUP_DIR/backup_${TIMESTAMP}"
  mkdir -p "$BACKUP_PATH"
  
  # Backup application code
  cp -r /app/episode-metadata "$BACKUP_PATH/app" || error "Failed to backup application"
  
  # Backup database
  if command -v pg_dump &> /dev/null; then
    log "Backing up database..."
    pg_dump -h "$DB_HOST" -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_PATH/db_${TIMESTAMP}.sql.gz"
    success "Database backup created"
  fi

  # Backup .env files
  cp "$PROJECT_DIR/.env.${ENVIRONMENT}" "$BACKUP_PATH/.env.${ENVIRONMENT}" || true

  success "Backup created at $BACKUP_PATH"
  echo "$BACKUP_PATH" > "$PROJECT_DIR/.last_backup"
}

# ============================================================================
# DEPLOYMENT STEPS
# ============================================================================

deploy() {
  log "Starting deployment to ${ENVIRONMENT} environment..."

  # Step 1: Backup
  backup_current

  # Step 2: Update code
  log "Updating application code..."
  cd "$PROJECT_DIR"
  git pull origin main || warning "git pull failed - continuing with local code"

  # Step 3: Load environment
  log "Loading environment configuration..."
  export $(cat "$PROJECT_DIR/.env.${ENVIRONMENT}" | grep -v '^#' | xargs)

  # Step 4: Install dependencies
  log "Installing dependencies..."
  npm ci --production || error "npm install failed"

  # Step 5: Build frontend (if applicable)
  if [ -d "$PROJECT_DIR/frontend" ]; then
    log "Building frontend..."
    cd "$PROJECT_DIR/frontend"
    npm ci || error "Frontend npm install failed"
    npm run build || error "Frontend build failed"
    success "Frontend built successfully"
  fi

  # Step 6: Run migrations
  log "Running database migrations..."
  cd "$PROJECT_DIR"
  npm run migrate:up || error "Database migration failed"

  # Step 7: Run tests
  log "Running tests..."
  npm test -- --coverage || warning "Some tests failed - review logs"

  # Step 8: Health check
  log "Verifying deployment..."
  sleep 5
  
  HEALTH_CHECK=$(curl -s http://localhost:${PORT:-3002}/health || echo "{}")
  if echo "$HEALTH_CHECK" | grep -q "healthy"; then
    success "Deployment verified - API is healthy"
  else
    error "Health check failed: $HEALTH_CHECK"
  fi

  success "Deployment to ${ENVIRONMENT} completed successfully!"
}

# ============================================================================
# ROLLBACK PROCEDURE
# ============================================================================

rollback() {
  log "Starting rollback procedure..."

  if [ ! -f "$PROJECT_DIR/.last_backup" ]; then
    error "No backup found for rollback"
  fi

  BACKUP_PATH=$(cat "$PROJECT_DIR/.last_backup")
  
  if [ ! -d "$BACKUP_PATH" ]; then
    error "Backup directory not found: $BACKUP_PATH"
  fi

  log "Rolling back application from $BACKUP_PATH..."

  # Stop application
  systemctl stop episode-metadata || true

  # Restore code
  rm -rf /app/episode-metadata
  cp -r "$BACKUP_PATH/app" /app/episode-metadata || error "Failed to restore application"

  # Restore database (if backup exists)
  if [ -f "$BACKUP_PATH/db_"*.sql.gz ]; then
    log "Rolling back database..."
    gunzip < "$BACKUP_PATH/db_"*.sql.gz | psql -h "$DB_HOST" -U "$DB_USER" "$DB_NAME" || \
      error "Database rollback failed"
  fi

  # Start application
  systemctl start episode-metadata || error "Failed to start application after rollback"

  success "Rollback completed successfully"
}

# ============================================================================
# SMOKE TESTS
# ============================================================================

smoke_tests() {
  log "Running smoke tests..."

  BASE_URL="http://localhost:${PORT:-3002}"

  # Test 1: Health check
  log "Test 1: Health check..."
  HEALTH=$(curl -s "$BASE_URL/health")
  if echo "$HEALTH" | grep -q "healthy"; then
    success "Health check passed"
  else
    error "Health check failed"
  fi

  # Test 2: Login
  log "Test 2: Login endpoint..."
  LOGIN=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"password123"}')
  
  if echo "$LOGIN" | grep -q "accessToken"; then
    TOKEN=$(echo "$LOGIN" | jq -r '.data.accessToken')
    success "Login test passed"
    
    # Test 3: Protected endpoint
    log "Test 3: Protected endpoint (/me)..."
    ME=$(curl -s "$BASE_URL/api/v1/auth/me" \
      -H "Authorization: Bearer $TOKEN")
    
    if echo "$ME" | grep -q "email"; then
      success "Protected endpoint test passed"
    else
      error "Protected endpoint test failed"
    fi
  else
    error "Login test failed"
  fi

  # Test 4: Episodes endpoint
  log "Test 4: Episodes endpoint..."
  EPISODES=$(curl -s "$BASE_URL/api/v1/episodes")
  if echo "$EPISODES" | grep -q "data"; then
    success "Episodes endpoint test passed"
  else
    error "Episodes endpoint test failed"
  fi

  success "All smoke tests passed!"
}

# ============================================================================
# MONITORING SETUP
# ============================================================================

setup_monitoring() {
  log "Setting up monitoring and logging..."

  # Create systemd service file
  cat > /etc/systemd/system/episode-metadata.service <<EOF
[Unit]
Description=Episode Metadata API
After=network.target postgresql.service

[Service]
Type=simple
User=episode
WorkingDirectory=/app/episode-metadata
EnvironmentFile=/app/episode-metadata/.env.${ENVIRONMENT}
ExecStart=/usr/bin/node /app/episode-metadata/src/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  success "Systemd service created"

  # Setup log rotation
  cat > /etc/logrotate.d/episode-metadata <<EOF
/var/log/episode-metadata/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 episode episode
}
EOF

  success "Log rotation configured"
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
  echo -e "${CYAN}"
  echo "╔════════════════════════════════════════════════════╗"
  echo "║     EPISODE METADATA API - DEPLOYMENT SCRIPT        ║"
  echo "╚════════════════════════════════════════════════════╝"
  echo -e "${NC}"
  
  log "Environment: $ENVIRONMENT"
  log "Action: $ACTION"
  log "Timestamp: $TIMESTAMP"

  case "$ACTION" in
    deploy)
      pre_deployment_checks
      deploy
      smoke_tests
      setup_monitoring
      ;;
    rollback)
      rollback
      smoke_tests
      ;;
    backup)
      backup_current
      ;;
    test)
      smoke_tests
      ;;
    *)
      error "Unknown action: $ACTION. Use: deploy, rollback, backup, or test"
      ;;
  esac

  log "Deployment script completed"
}

# Run main function
main
