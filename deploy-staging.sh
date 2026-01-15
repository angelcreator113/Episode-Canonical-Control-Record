#!/bin/bash
# ============================================================================
# STAGING ENVIRONMENT DEPLOYMENT SCRIPT
# ============================================================================
# Deploy to staging environment
# Usage: ./deploy-staging.sh [action]
# Actions: deploy, rollback, restart, logs, health
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENVIRONMENT="staging"
ACTION="${1:-deploy}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${PROJECT_DIR}/backups/staging"
LOG_FILE="${PROJECT_DIR}/logs/deploy_staging_${TIMESTAMP}.log"

# Ensure directories exist
mkdir -p "$(dirname "$LOG_FILE")"
mkdir -p "$BACKUP_DIR"

# Logging function
log() {
  echo -e "${CYAN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
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

# Health check function
health_check() {
  log "Checking application health..."
  for i in {1..30}; do
    if curl -sf http://localhost:3002/api/v1/health > /dev/null 2>&1; then
      success "Application is healthy"
      return 0
    fi
    echo -n "."
    sleep 1
  done
  error "Application failed health check"
}

# Deploy function
deploy() {
  log "Starting staging deployment..."
  
  # Load environment
  if [ ! -f "$PROJECT_DIR/.env.staging" ]; then
    error ".env.staging file not found. Please create it from .env.staging template"
  fi
  
  # Backup current state
  log "Creating backup..."
  docker-compose -f docker-compose.staging.yml exec -T postgres pg_dump -U ${DB_USER_STAGING:-postgres} episode_metadata > "$BACKUP_DIR/db_backup_${TIMESTAMP}.sql" 2>/dev/null || warning "Database backup skipped"
  
  # Pull latest code
  log "Pulling latest code..."
  git pull origin main-clean || warning "Git pull skipped"
  
  # Install dependencies
  log "Installing dependencies..."
  npm ci
  cd frontend && npm ci && cd ..
  
  # Build frontend
  log "Building frontend..."
  cd frontend && npm run build && cd ..
  
  # Stop existing containers
  log "Stopping existing containers..."
  docker-compose -f docker-compose.staging.yml down --remove-orphans || true
  
  # Start services
  log "Starting services..."
  docker-compose -f docker-compose.staging.yml up -d
  
  # Wait for database to be ready
  log "Waiting for database to be ready..."
  sleep 5
  
  # Run migrations
  log "Running database migrations..."
  docker-compose -f docker-compose.staging.yml exec -T app npm run migrate:up || warning "Migrations skipped"
  
  # Health check
  health_check
  
  success "Staging deployment completed successfully!"
}

# Rollback function
rollback() {
  log "Rolling back to previous version..."
  
  # Find latest backup
  LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/db_backup_*.sql 2>/dev/null | head -1)
  if [ -z "$LATEST_BACKUP" ]; then
    error "No backup found for rollback"
  fi
  
  log "Restoring database from $LATEST_BACKUP..."
  docker-compose -f docker-compose.staging.yml exec -T postgres psql -U ${DB_USER_STAGING:-postgres} episode_metadata < "$LATEST_BACKUP"
  
  # Restart containers
  docker-compose -f docker-compose.staging.yml restart app
  
  health_check
  success "Rollback completed successfully!"
}

# Restart function
restart() {
  log "Restarting staging environment..."
  docker-compose -f docker-compose.staging.yml restart
  health_check
  success "Restart completed successfully!"
}

# Logs function
logs() {
  docker-compose -f docker-compose.staging.yml logs -f app
}

# Health check function
health() {
  log "Checking staging environment health..."
  echo -e "\n${CYAN}Docker Containers:${NC}"
  docker-compose -f docker-compose.staging.yml ps
  
  echo -e "\n${CYAN}Application Health:${NC}"
  curl -s http://localhost:3002/api/v1/health | jq . || echo "Application not responding"
  
  echo -e "\n${CYAN}Database Connection:${NC}"
  docker-compose -f docker-compose.staging.yml exec -T postgres pg_isready -U ${DB_USER_STAGING:-postgres} && echo "Database: OK" || echo "Database: FAILED"
  
  echo -e "\n${CYAN}Redis Connection:${NC}"
  docker-compose -f docker-compose.staging.yml exec -T redis redis-cli ping && echo "Redis: OK" || echo "Redis: FAILED"
}

# Main execution
log "=== Staging Environment Deployment ==="
log "Environment: $ENVIRONMENT"
log "Action: $ACTION"

case "$ACTION" in
  deploy)
    deploy
    ;;
  rollback)
    rollback
    ;;
  restart)
    restart
    ;;
  logs)
    logs
    ;;
  health)
    health
    ;;
  *)
    error "Unknown action: $ACTION. Supported actions: deploy, rollback, restart, logs, health"
    ;;
esac

log "Done!"
