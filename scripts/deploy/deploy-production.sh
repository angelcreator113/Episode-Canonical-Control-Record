#!/bin/bash
# ============================================================================
# PRODUCTION ENVIRONMENT DEPLOYMENT SCRIPT
# ============================================================================
# Deploy to production environment
# Usage: ./deploy-production.sh [action]
# Actions: deploy, rollback, restart, logs, health, backup
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
ENVIRONMENT="production"
ACTION="${1:-deploy}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${PROJECT_DIR}/backups/production"
LOG_FILE="${PROJECT_DIR}/logs/deploy_production_${TIMESTAMP}.log"

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

# Confirmation prompt for production
confirm_production() {
  echo -e "${RED}⚠️  WARNING: You are about to deploy to PRODUCTION${NC}"
  echo "This will affect live users. Proceed? (type 'yes' to continue)"
  read -r confirmation
  if [ "$confirmation" != "yes" ]; then
    error "Production deployment cancelled"
  fi
}

# Health check function
health_check() {
  log "Checking application health..."
  for i in {1..30}; do
    if curl -sf http://localhost:3003/api/v1/health > /dev/null 2>&1; then
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
  confirm_production
  
  log "Starting production deployment..."
  
  # Load environment
  if [ ! -f "$PROJECT_DIR/.env.production" ]; then
    error ".env.production file not found. Please create it from .env.production.template"
  fi
  
  # Create full backup before deployment
  log "Creating full backup (database + files)..."
  docker-compose -f docker-compose.production.yml exec -T postgres pg_dump -U ${DB_USER_PROD:-postgres} episode_metadata > "$BACKUP_DIR/db_backup_${TIMESTAMP}.sql" || error "Database backup failed"
  tar czf "$BACKUP_DIR/files_backup_${TIMESTAMP}.tar.gz" -C "$PROJECT_DIR" "frontend/build" "dist" 2>/dev/null || warning "Files backup skipped"
  
  # Pull latest code
  log "Pulling latest code..."
  git pull origin main-clean || error "Git pull failed"
  
  # Verify code integrity
  log "Running tests..."
  npm ci
  npm run lint || warning "Linting errors detected"
  npm run test -- --coverage || warning "Tests failed"
  
  cd frontend && npm ci && npm run build || error "Frontend build failed"
  cd ..
  
  # Stop existing containers gracefully
  log "Stopping containers gracefully..."
  docker-compose -f docker-compose.production.yml down --remove-orphans || true
  
  # Start services
  log "Starting services..."
  docker-compose -f docker-compose.production.yml up -d
  
  # Wait for database to be ready
  log "Waiting for database to be ready..."
  sleep 10
  
  # Run migrations
  log "Running database migrations..."
  docker-compose -f docker-compose.production.yml exec -T app npm run migrate:up || error "Migrations failed"
  
  # Health check
  health_check
  
  # Verify critical endpoints
  log "Verifying critical endpoints..."
  curl -sf http://localhost:3003/api/v1/episodes > /dev/null || error "Episodes endpoint check failed"
  curl -sf http://localhost:3003/api/v1/assets > /dev/null || error "Assets endpoint check failed"
  
  # Create success record
  echo "$(date): Production deployment succeeded (${TIMESTAMP})" >> "$BACKUP_DIR/deployment_log.txt"
  
  success "Production deployment completed successfully!"
  log "Backup directory: $BACKUP_DIR"
}

# Rollback function
rollback() {
  confirm_production
  
  log "Rolling back to previous version..."
  
  # Find latest backup
  LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/db_backup_*.sql 2>/dev/null | head -1)
  if [ -z "$LATEST_BACKUP" ]; then
    error "No backup found for rollback"
  fi
  
  log "Restoring database from $LATEST_BACKUP..."
  docker-compose -f docker-compose.production.yml exec -T postgres psql -U ${DB_USER_PROD:-postgres} episode_metadata < "$LATEST_BACKUP" || error "Database restore failed"
  
  # Restart containers
  docker-compose -f docker-compose.production.yml restart app
  
  health_check
  
  # Create rollback record
  echo "$(date): Production rollback performed (${TIMESTAMP})" >> "$BACKUP_DIR/deployment_log.txt"
  
  success "Rollback completed successfully!"
}

# Restart function
restart() {
  confirm_production
  
  log "Restarting production environment..."
  docker-compose -f docker-compose.production.yml restart
  health_check
  success "Restart completed successfully!"
}

# Logs function
logs() {
  docker-compose -f docker-compose.production.yml logs -f app
}

# Health check function
health() {
  log "Checking production environment health..."
  echo -e "\n${CYAN}Docker Containers:${NC}"
  docker-compose -f docker-compose.production.yml ps
  
  echo -e "\n${CYAN}Application Health:${NC}"
  curl -s http://localhost:3003/api/v1/health | jq . || echo "Application not responding"
  
  echo -e "\n${CYAN}Database Connection:${NC}"
  docker-compose -f docker-compose.production.yml exec -T postgres pg_isready -U ${DB_USER_PROD:-postgres} && echo "Database: OK" || echo "Database: FAILED"
  
  echo -e "\n${CYAN}Redis Connection:${NC}"
  docker-compose -f docker-compose.production.yml exec -T redis redis-cli ping && echo "Redis: OK" || echo "Redis: FAILED"
  
  echo -e "\n${CYAN}Backup Status:${NC}"
  ls -lh "$BACKUP_DIR" | tail -5
}

# Backup function
backup() {
  log "Creating production backup..."
  docker-compose -f docker-compose.production.yml exec -T postgres pg_dump -U ${DB_USER_PROD:-postgres} episode_metadata > "$BACKUP_DIR/db_backup_${TIMESTAMP}.sql" || error "Database backup failed"
  tar czf "$BACKUP_DIR/files_backup_${TIMESTAMP}.tar.gz" -C "$PROJECT_DIR" "frontend/build" "dist" 2>/dev/null || warning "Files backup skipped"
  success "Backup completed: $BACKUP_DIR"
}

# Main execution
log "=== Production Environment Deployment ==="
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
  backup)
    backup
    ;;
  *)
    error "Unknown action: $ACTION. Supported actions: deploy, rollback, restart, logs, health, backup"
    ;;
esac

log "Done!"
