# Production Deployment Guide - Episode Metadata API

**Status:** ✅ READY FOR PRODUCTION  
**Date:** January 5, 2026  
**Test Results:** 829/829 tests passing (100%)

---

## 📋 Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Deployment Methods](#deployment-methods)
3. [Environment Configuration](#environment-configuration)
4. [Automated Deployment](#automated-deployment)
5. [Monitoring & Logging](#monitoring--logging)
6. [Rollback Procedures](#rollback-procedures)
7. [Troubleshooting](#troubleshooting)

---

## Pre-Deployment Checklist

### ✅ Application Status
- [x] All tests passing: 829/829 (100%)
- [x] Code reviewed and approved
- [x] Frontend built and optimized
- [x] Database migrations prepared
- [x] API endpoints verified
- [x] JWT authentication working
- [x] Rate limiting configured
- [x] CORS properly configured

### ✅ Infrastructure Requirements
- [ ] Production database provisioned (RDS recommended)
- [ ] AWS credentials configured
- [ ] S3 bucket created for assets
- [ ] OpenSearch cluster ready (if using search)
- [ ] SSL/TLS certificates obtained
- [ ] DNS configured
- [ ] Load balancer configured (optional)
- [ ] Backup storage configured

### ✅ Security Configuration
- [ ] JWT_SECRET set to unique 32+ character value
- [ ] Database passwords hardened
- [ ] AWS keys rotated
- [ ] SSH keys secured
- [ ] Firewall rules configured
- [ ] HTTPS enforced
- [ ] Security headers enabled
- [ ] Rate limiting thresholds set

---

## Deployment Methods

### Method 1: Docker Deployment (Recommended)

**Pros:** Isolated, scalable, consistent across environments  
**Cons:** Requires Docker installation

#### Prerequisites
```bash
docker --version  # v20.10+
docker-compose --version  # v1.29+
```

#### Deployment Steps

1. **Prepare Environment**
```bash
cd /path/to/episode-metadata
cp .env.production .env.prod.local
# Edit .env.prod.local with production secrets
nano .env.prod.local
```

2. **Build Docker Image**
```bash
docker-compose -f docker-compose.prod.yml build
```

3. **Start Services**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

4. **Verify Deployment**
```bash
# Check running containers
docker-compose -f docker-compose.prod.yml ps

# View API logs
docker-compose -f docker-compose.prod.yml logs -f api

# Health check
curl http://localhost:3002/health
```

---

### Method 2: systemd Service (Linux)

**Pros:** Native Linux integration, auto-restart, journalctl logging  
**Cons:** Linux-only, requires manual setup

#### Prerequisites
```bash
node --version  # v20+
npm --version   # v10+
systemctl --version  # systemd required
```

#### Deployment Steps

1. **Create Application Directory**
```bash
sudo mkdir -p /app/episode-metadata
sudo chown -R www-data:www-data /app/episode-metadata
cd /app/episode-metadata
```

2. **Clone and Setup**
```bash
git clone https://github.com/yourorgs/episode-metadata.git .
npm ci --production
cd frontend && npm ci && npm run build && cd ..
```

3. **Create systemd Service**
```bash
sudo tee /etc/systemd/system/episode-metadata.service > /dev/null <<EOF
[Unit]
Description=Episode Metadata API
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/app/episode-metadata
EnvironmentFile=/app/episode-metadata/.env.production
ExecStart=/usr/bin/node /app/episode-metadata/src/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=episode-metadata

[Install]
WantedBy=multi-user.target
EOF
```

4. **Start Service**
```bash
sudo systemctl daemon-reload
sudo systemctl enable episode-metadata
sudo systemctl start episode-metadata
sudo systemctl status episode-metadata
```

5. **View Logs**
```bash
sudo journalctl -u episode-metadata -f
sudo journalctl -u episode-metadata --since today
```

---

### Method 3: AWS Lambda + API Gateway

**Pros:** Serverless, auto-scaling, pay-per-use  
**Cons:** Cold starts, limited execution time

#### Deployment Steps

```bash
# 1. Install Serverless Framework
npm install -g serverless

# 2. Configure AWS credentials
aws configure

# 3. Deploy
serverless deploy -s production

# 4. Get API endpoint
serverless info -s production
```

---

## Environment Configuration

### .env.production Template

See `.env.production` in project root. Key variables:

```env
# Server
NODE_ENV=production
PORT=3002
HOST=0.0.0.0

# Database
DB_HOST=your-rds-endpoint.amazonaws.com
DB_PORT=5432
DB_NAME=episode_metadata
DB_USER=postgres
DB_PASSWORD=${RANDOM_STRONG_PASSWORD}

# JWT
JWT_SECRET=${RANDOM_32_CHAR_STRING}
JWT_EXPIRY=1h
JWT_REFRESH_EXPIRY=7d

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=${YOUR_ACCESS_KEY}
AWS_SECRET_ACCESS_KEY=${YOUR_SECRET_KEY}
S3_BUCKET=episode-assets-prod

# Monitoring
SENTRY_DSN=${YOUR_SENTRY_DSN}
LOG_LEVEL=info
```

### Generate Secure Secrets

```bash
# Generate JWT_SECRET (32+ characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate database password
openssl rand -base64 32
```

---

## Automated Deployment

### PowerShell Script (Windows)

```powershell
# Deploy to production
.\deploy.ps1 -Environment production -Action deploy

# Rollback to previous version
.\deploy.ps1 -Environment production -Action rollback

# Run smoke tests
.\deploy.ps1 -Environment production -Action test

# Backup current deployment
.\deploy.ps1 -Environment production -Action backup
```

### Bash Script (Linux)

```bash
chmod +x deploy.sh

# Deploy
./deploy.sh production deploy

# Rollback
./deploy.sh production rollback

# Test
./deploy.sh production test

# Backup
./deploy.sh production backup
```

### GitHub Actions CI/CD

```yaml
# Workflow triggers on push to main branch
# Automatically:
# 1. Runs all tests
# 2. Builds Docker image
# 3. Pushes to registry
# 4. Deploys to production
# 5. Runs smoke tests

# Configure GitHub secrets:
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
DOCKER_REGISTRY_TOKEN
DB_PASSWORD_PROD
JWT_SECRET_PROD
```

---

## Monitoring & Logging

### Application Health

```bash
# Health check endpoint
curl http://localhost:3002/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2026-01-05T22:50:29.321Z",
  "uptime": 246.5,
  "version": "v1",
  "environment": "production",
  "database": "connected"
}
```

### Key Metrics

Monitor these in production:

- **API Response Time** (p50, p95, p99)
- **Error Rate** (4xx, 5xx)
- **Database Query Time**
- **Memory Usage**
- **CPU Usage**
- **Disk Space**
- **Active Connections**
- **Request Rate** (RPS)

### Recommended Tools

1. **Error Tracking:** [Sentry](https://sentry.io/)
2. **Performance:** [New Relic](https://newrelic.com/) or [DataDog](https://www.datadoghq.com/)
3. **Logs:** AWS CloudWatch or ELK Stack
4. **Uptime:** [StatusPage.io](https://www.statuspage.io/)
5. **Alerts:** PagerDuty or Opsgenie

### View Logs

**Docker:**
```bash
docker-compose -f docker-compose.prod.yml logs -f api
docker-compose -f docker-compose.prod.yml logs -f postgres
```

**systemd:**
```bash
sudo journalctl -u episode-metadata -f
sudo tail -f /var/log/episode-metadata/app.log
```

---

## Rollback Procedures

### Quick Rollback

```bash
# If using deployment script:
./deploy.sh production rollback

# Or PowerShell:
.\deploy.ps1 -Environment production -Action rollback
```

### Manual Rollback

```bash
# 1. Stop current application
systemctl stop episode-metadata

# 2. Restore from backup
tar -xzf /backups/episode-metadata_backup_20260105.tar.gz -C /app/

# 3. Restore database (if needed)
gunzip < /backups/db_20260105.sql.gz | psql -U postgres episode_metadata

# 4. Restart
systemctl start episode-metadata

# 5. Verify
curl http://localhost:3002/health
```

### Database Rollback

```bash
# List migrations
npm run migrate:status

# Rollback single migration
npm run migrate:down

# Rollback to specific version
npm run migrate:down -- --target-version=20260101000001

# Reapply migrations
npm run migrate:up
```

---

## Smoke Tests

Run these after deployment:

```bash
# 1. Health Check
curl http://your-domain/health

# 2. Login
curl -X POST http://your-domain/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@example.com",
    "password":"password123"
  }'

# 3. Get Token from response, then test protected endpoint
curl http://your-domain/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"

# 4. Episodes List
curl http://your-domain/api/v1/episodes

# 5. Get Single Episode
curl http://your-domain/api/v1/episodes/EPISODE_ID

# 6. Assets List
curl http://your-domain/api/v1/assets

# 7. Logout
curl -X POST http://your-domain/api/v1/auth/logout \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Troubleshooting

### Application Won't Start

```bash
# Check logs
journalctl -u episode-metadata -n 50
docker-compose -f docker-compose.prod.yml logs api

# Verify environment variables
env | grep DATABASE_URL
echo $DB_HOST
echo $JWT_SECRET

# Test database connection
psql -h $DB_HOST -U $DB_USER -d episode_metadata -c "SELECT 1;"
```

### Database Migration Fails

```bash
# Check migration status
npm run migrate:status

# Check database directly
psql -U postgres -c "\dt"  # List tables

# Rollback and retry
npm run migrate:down
npm run migrate:up
```

### Port Already in Use

```bash
# Find process using port 3002
lsof -i :3002
netstat -tlnp | grep 3002

# Kill process
kill -9 <PID>

# Or change port
PORT=3003 npm start
```

### Out of Disk Space

```bash
# Check disk usage
df -h
du -sh /app/*

# Clean old logs
find /var/log/episode-metadata -mtime +30 -delete

# Archive logs
tar -czf logs_archive_$(date +%Y%m%d).tar.gz /var/log/episode-metadata/
rm /var/log/episode-metadata/*.log

# Clean Docker images
docker image prune -a
docker volume prune
```

### High Memory Usage

```bash
# Check Node process
ps aux | grep node

# Monitor memory
top -p <PID>

# Restart service
systemctl restart episode-metadata

# Check for memory leaks in logs
grep -i "heap\|memory\|leak" /var/log/episode-metadata/*.log
```

---

## Backup Strategy

### Automated Backups

```bash
# Add to crontab for daily backups at 2 AM
0 2 * * * pg_dump -h $DB_HOST -U $DB_USER episode_metadata | gzip > /backups/db_$(date +\%Y\%m\%d).sql.gz

# Cleanup old backups (keep 30 days)
0 3 * * * find /backups -name "db_*.sql.gz" -mtime +30 -delete
```

### Manual Backup

```bash
# Full database backup
pg_dump -h localhost -U postgres episode_metadata | gzip > db_backup_$(date +%Y%m%d).sql.gz

# Application backup
tar -czf app_backup_$(date +%Y%m%d).tar.gz /app/episode-metadata/

# Verify backup
gunzip -t db_backup_20260105.sql.gz
tar -tzf app_backup_20260105.tar.gz | head
```

### Restore from Backup

```bash
# Restore database
gunzip < db_backup_20260105.sql.gz | psql -U postgres episode_metadata

# Restore application
tar -xzf app_backup_20260105.tar.gz -C /

# Restart
systemctl restart episode-metadata
```

---

## Post-Deployment Checklist

- [ ] Health check passing
- [ ] All endpoints responding correctly
- [ ] Database queries executing
- [ ] Authentication working
- [ ] Logging active and accessible
- [ ] Backups scheduled and tested
- [ ] Monitoring alerts configured
- [ ] Team notified of deployment
- [ ] Documentation updated
- [ ] Rollback procedure tested

---

## Support & Escalation

### Issues During Deployment

1. **Check logs** - First source of truth
2. **Run smoke tests** - Identify specific failures
3. **Review changes** - What was modified?
4. **Rollback** - Revert to last known good
5. **Escalate** - Contact DevOps if unresolved

### Contact Information

- **Technical Issues:** devops@company.com
- **Security Issues:** security@company.com
- **Performance Issues:** sre@company.com
- **On-Call:** See PagerDuty

---

## Deployment Checklist Summary

```bash
# Before deployment
✅ All tests passing
✅ Code reviewed
✅ Environment configured
✅ Backups created
✅ Team notified

# During deployment
✅ Run deployment script
✅ Monitor logs
✅ Run smoke tests
✅ Verify all endpoints

# After deployment
✅ Health check
✅ Database verification
✅ Monitoring active
✅ Team informed
✅ Document issues
```

---

**Status:** ✅ PRODUCTION READY  
**Version:** 1.0.0  
**Last Updated:** January 5, 2026
