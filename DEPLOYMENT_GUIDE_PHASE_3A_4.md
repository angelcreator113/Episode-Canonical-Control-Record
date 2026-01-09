# Phase 3A.4 Deployment Guide

## Quick Start Deployment

### Prerequisites
- Node.js 16+ installed
- PostgreSQL database running (Docker or local)
- Docker installed (for database management)
- Git repository initialized

### One-Command Deployment

```bash
# Complete deployment workflow
npm install && npm run migrate:up && npm test && npm start
```

---

## Step-by-Step Deployment

### 1. Pre-Deployment Validation

```bash
# Verify Node.js version
node --version  # Should be 16+

# Verify npm
npm --version

# Verify Docker
docker --version

# Check database connectivity
docker exec episode-postgres psql -U postgres -d episode_metadata -c "SELECT 1;"
```

### 2. Install Dependencies

```bash
cd c:\Users\12483\prime studios\BRD\Episode-Canonical-Control-Record

# Install all dependencies
npm install

# Verify installation
npm list | head -20
```

### 3. Database Migrations

```bash
# Run all pending migrations
npm run migrate:up

# Verify migrations
docker exec episode-postgres psql -U postgres -d episode_metadata -c "\dt"

# Expected tables:
# - activity_logs (Phase 3A)
# - notifications (Phase 3A)
# - user_presence (Phase 3A)
# - episodes (Phase 2D)
# - jobs (Phase 2D)
# - files (Phase 2D)
```

### 4. Run Test Suite

```bash
# Run all tests
npm test

# Expected output:
# PASS  tests/unit/controllers/episodes.test.js
# PASS  tests/integration/phase3a-integration.test.js
# ...
# Test Suites: 20 passed, 20 total
# Tests: 200+ passed, 200+ total
```

### 5. Start Services

#### Terminal 1 - Backend
```bash
# Start backend server (port 3002)
npm start

# Expected output:
# Server running on port 3002
# Database connected
# ActivityService initialized
# NotificationService initialized
# SocketService initialized
# PresenceService initialized
```

#### Terminal 2 - Frontend
```bash
# Navigate to frontend
cd frontend

# Start development server (port 5173)
npm run dev

# Expected output:
# VITE v4.x.x ready in xxx ms
# ➜  Local:   http://localhost:5173/
```

### 6. Verify Deployment

```bash
# Health check
curl http://localhost:3002/health

# Expected response:
# {
#   "status": "healthy",
#   "database": "connected",
#   "services": {
#     "ActivityService": "ready",
#     "NotificationService": "ready",
#     "SocketService": "ready",
#     "PresenceService": "ready"
#   }
# }
```

---

## Deployment Scenarios

### Scenario 1: Fresh Deployment (No Existing Data)

```bash
# 1. Clone/setup repository
git clone <repo-url>
cd Episode-Canonical-Control-Record

# 2. Install dependencies
npm install

# 3. Setup database
docker run -d -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  --name episode-postgres \
  postgres:14

# 4. Run migrations
npm run migrate:up

# 5. Run tests
npm test

# 6. Start application
npm start
```

### Scenario 2: Upgrade from Phase 3A.3 → 3A.4

```bash
# 1. Backup current database
docker exec episode-postgres pg_dump -U postgres episode_metadata > backup_3a3.sql

# 2. Update code
git pull origin main

# 3. Install new dependencies (if any)
npm install

# 4. Run new migrations
npm run migrate:up

# 5. Run tests to verify
npm test

# 6. Restart application
pkill -f "npm start"
npm start
```

### Scenario 3: Disaster Recovery

```bash
# 1. Backup before attempting recovery
docker exec episode-postgres pg_dump -U postgres episode_metadata > backup_recovery.sql

# 2. Reset database completely
docker exec episode-postgres psql -U postgres -d episode_metadata -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# 3. Restore from previous backup
docker exec -i episode-postgres psql -U postgres -d episode_metadata < backup_3a3.sql

# 4. Re-run migrations
npm run migrate:up

# 5. Restart and verify
npm test && npm start
```

---

## Configuration Management

### Environment Variables

Create `.env` file in project root:

```env
# Server Configuration
PORT=3002
NODE_ENV=production

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=episode_metadata
DB_USER=postgres
DB_PASSWORD=postgres

# Authentication
JWT_SECRET=your-secret-key-here
JWT_EXPIRY=7d

# Services
ACTIVITY_SERVICE_ENABLED=true
NOTIFICATION_SERVICE_ENABLED=true
SOCKET_SERVICE_ENABLED=true
PRESENCE_SERVICE_ENABLED=true

# S3/File Storage
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
S3_BUCKET=your-bucket

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log
```

### Service Configuration

#### ActivityService
```javascript
// src/services/ActivityService.js
const config = {
  batchSize: 100,      // Batch activity logs
  flushInterval: 5000, // Flush every 5 seconds
  retention: 90,       // Keep logs for 90 days
};
```

#### NotificationService
```javascript
// src/services/NotificationService.js
const config = {
  enableEmail: false,  // Enable email notifications
  enablePush: true,    // Enable push notifications
  retryAttempts: 3,    // Retry failed notifications
};
```

#### SocketService
```javascript
// src/services/SocketService.js
const config = {
  port: 3002,
  namespace: '/api/v1',
  reconnectDelay: 1000,
  maxConnections: 10000,
};
```

---

## Performance Tuning

### Database Optimization

```bash
# Create indexes on activity logs
docker exec episode-postgres psql -U postgres -d episode_metadata -c "
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at DESC);
"

# Create indexes on notifications
docker exec episode-postgres psql -U postgres -d episode_metadata -c "
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);
"

# Create indexes on presence
docker exec episode-postgres psql -U postgres -d episode_metadata -c "
CREATE INDEX idx_presence_resource ON user_presence(resource_type, resource_id);
"
```

### Application Optimization

```javascript
// Enable compression
const compression = require('compression');
app.use(compression());

// Enable connection pooling
const pool = new Pool({
  max: 20,              // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Enable caching
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
```

---

## Monitoring & Logging

### Log File Configuration

```bash
# Create logs directory
mkdir -p logs

# Monitor logs in real-time
tail -f logs/app.log

# Search for errors
grep ERROR logs/app.log

# Search for specific action
grep "activity" logs/app.log | tail -20
```

### Database Query Monitoring

```bash
# Monitor active queries
docker exec episode-postgres psql -U postgres -c \
  "SELECT pid, usename, application_name, query, state FROM pg_stat_activity WHERE state='active';"

# Monitor slow queries (log analysis)
docker exec episode-postgres psql -U postgres -d episode_metadata -c \
  "SET log_min_duration_statement = 1000;
   SET log_statement = 'all';"
```

### WebSocket Connection Monitoring

```javascript
// In src/services/SocketService.js
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  console.log(`Active connections: ${io.engine.clientsCount}`);

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Monitor from HTTP endpoint
app.get('/api/v1/socket/stats', (req, res) => {
  res.json({
    activeConnections: io.engine.clientsCount,
    rooms: io.sockets.adapter.rooms.size,
  });
});
```

---

## Rollback Procedures

### Quick Rollback (Last Commit)

```bash
# Stop application
pkill -f "npm start"

# Revert code changes
git reset --hard HEAD~1
git clean -fd

# Reinstall dependencies
npm install

# No database changes needed (Phase 3A.4 is additive)

# Restart
npm start
```

### Full Rollback (To Phase 3A.3)

```bash
# 1. Backup current data
docker exec episode-postgres pg_dump -U postgres episode_metadata > backup_full.sql

# 2. Stop application
pkill -f "npm start"

# 3. Revert code
git checkout phase-3a-3-stable  # or specific tag

# 4. Downgrade database (if needed)
npm run migrate:down

# 5. Reinstall dependencies
npm install

# 6. Restart
npm start

# 7. Verify
curl http://localhost:3002/health
```

### Database-Only Rollback

```bash
# If code is fine but data is corrupted

# 1. Restore from backup
docker exec -i episode-postgres psql -U postgres -d episode_metadata < backup_3a3.sql

# 2. Re-apply migrations
npm run migrate:up

# 3. Restart application
pkill -f "npm start"
npm start
```

---

## Troubleshooting Deployment

### Issue: Migration Fails

**Symptoms**: `npm run migrate:up` fails with SQL error

**Solution**:
```bash
# Check migration status
npm run migrate:status

# View migration file for errors
cat src/migrations/003_create_phase3a_tables.js

# Try manual migration
docker exec episode-postgres psql -U postgres -d episode_metadata -f migration.sql

# If still fails, check database state
docker exec episode-postgres psql -U postgres -d episode_metadata -c "\dt"
```

### Issue: Tests Failing

**Symptoms**: `npm test` shows failures

**Solution**:
```bash
# Run specific test file
npm test -- phase3a-integration.test.js

# Run with verbose output
npm test -- --verbose

# Check test environment
npm test -- --testTimeout=30000  # Increase timeout

# Reset test database
docker exec episode-postgres psql -U postgres -d episode_metadata -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
npm run migrate:up
npm test
```

### Issue: Services Won't Start

**Symptoms**: Backend starts but services not ready

**Solution**:
```bash
# Check logs
docker logs episode-app

# Verify database connection
docker exec episode-postgres psql -U postgres -d episode_metadata -c "SELECT 1;"

# Check service initialization
npm start 2>&1 | grep -i "service\|error\|initialized"

# Try with debug logging
DEBUG=* npm start
```

### Issue: Performance Degradation

**Symptoms**: Requests taking >500ms

**Solution**:
```bash
# Check database performance
docker exec episode-postgres psql -U postgres -d episode_metadata -c \
  "SELECT query, calls, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Check active connections
docker exec episode-postgres psql -U postgres -c \
  "SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;"

# Clear connection pool
# Restart application
pkill -f "npm start"
npm start
```

---

## Post-Deployment Checklist

- [ ] Backend running on port 3002
- [ ] Frontend running on port 5173
- [ ] Database migrations complete
- [ ] All tests passing (>200 tests)
- [ ] Activity logs being created
- [ ] Notifications being sent
- [ ] WebSocket events flowing
- [ ] Presence tracking working
- [ ] No errors in console logs
- [ ] Health check endpoint responding
- [ ] Admin can create episodes
- [ ] Users can see real-time updates
- [ ] File operations working
- [ ] Job processing working
- [ ] Search functionality working
- [ ] Performance acceptable (<200ms/request)

---

## Maintenance Tasks

### Daily
- [ ] Monitor logs for errors
- [ ] Check database size
- [ ] Verify all services running

### Weekly
- [ ] Backup database
- [ ] Review performance metrics
- [ ] Check for updates

### Monthly
- [ ] Archive old activity logs
- [ ] Optimize database indexes
- [ ] Review security logs

### Quarterly
- [ ] Full system test
- [ ] Capacity planning
- [ ] Documentation review

---

## Support & Escalation

### Level 1: Application Logs
```bash
# Check application logs
tail -f logs/app.log

# Look for ERROR, WARN, Exception
grep -E "ERROR|Exception|Failed" logs/app.log
```

### Level 2: Database Investigation
```bash
# Check database health
docker exec episode-postgres psql -U postgres -d episode_metadata -c "SELECT version();"

# Check table sizes
docker exec episode-postgres psql -U postgres -d episode_metadata -c \
  "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) 
   FROM pg_tables ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
```

### Level 3: System Performance
```bash
# Check system resources
docker stats episode-postgres
docker stats episode-app

# Monitor real-time activity
top  # Or similar system monitor
```

### Escalation Path
1. Check logs (Level 1)
2. Verify database (Level 2)
3. Check system resources (Level 3)
4. Contact development team with logs and metrics

---

## Additional Resources

- **Architecture**: See `PHASE_3A_4_ARCHITECTURE.md`
- **Integration Plan**: See `PHASE_3A_4_INTEGRATION_PLAN.md`
- **Completion Report**: See `PHASE_3A_4_COMPLETION_REPORT.md`
- **Test Files**: `tests/integration/phase3a-integration.test.js`

---

**Document Version**: 1.0  
**Last Updated**: January 7, 2026  
**Deployment Window**: Anytime (Phase 3A.4 is additive, no breaking changes)  
**Estimated Deployment Time**: 15-20 minutes
