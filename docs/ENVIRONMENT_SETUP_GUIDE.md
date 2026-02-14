# Environment Setup & Deployment Guide

## Overview

This project supports three environments:
- **Development** (.env.development) - Local development with Docker
- **Staging** (.env.staging) - Pre-production testing on AWS
- **Production** (.env.production) - Live environment

## Environment Configuration

### 1. Development Environment

**Setup:**
```bash
# Copy the template
cp .env.development .env

# Start local services
docker-compose up -d
npm install
npm start
```

**Features:**
- Local PostgreSQL database in Docker
- LocalStack for S3/SQS/SNS mocking
- Mock Cognito authentication
- Debug logging enabled
- No rate limiting

**Access Points:**
- API: http://localhost:3002
- Frontend: http://localhost:5173
- Database: localhost:5432
- LocalStack Console: http://localhost:4566

### 2. Staging Environment

**Prerequisites:**
- AWS account with appropriate permissions
- RDS PostgreSQL instance
- S3 buckets created
- Cognito user pool configured
- EC2 or ECS for deployment

**Setup:**
```bash
# Create staging environment file
cp .env.staging .env.staging.secrets
# Fill in actual values from AWS Secrets Manager

# Load staging secrets
export $(cat .env.staging.secrets | xargs)

# Deploy using Docker Compose
docker-compose -f docker-compose.staging.yml up -d
```

**Or using deployment script:**
```bash
# Linux/Mac
./deploy-staging.sh deploy

# Windows PowerShell
.\deploy-staging.ps1 -Action deploy
```

**Features:**
- AWS RDS PostgreSQL
- Real S3 buckets
- Real Cognito authentication
- Rate limiting enabled
- Email notifications via SendGrid
- Monitoring with Datadog/Sentry

**Access Points:**
- API: https://api-staging.episodes.primestudios.dev
- Frontend: https://staging.episodes.primestudios.dev
- Database: RDS endpoint

### 3. Production Environment

**Prerequisites:**
- Production AWS account
- Production RDS PostgreSQL instance
- Production S3 buckets
- Production Cognito pool
- Production ECS/Lambda setup
- SSL certificates configured

**Setup:**
```bash
# Create production environment file from template
cp .env.production.template .env.production
# Fill in ALL production values from AWS Secrets Manager

# IMPORTANT: NEVER commit .env.production to git!

# Deploy with confirmation prompt
./deploy-production.sh deploy

# Windows PowerShell
.\deploy-production.ps1 -Action deploy
```

**Features:**
- Production RDS PostgreSQL with failover
- S3 with versioning and lifecycle policies
- Real Cognito authentication
- Rate limiting enabled
- Email notifications
- Full monitoring and alerting
- Automated backups
- SSL/TLS encryption

**Access Points:**
- API: https://api.episodes.primestudios.dev
- Frontend: https://episodes.primestudios.dev

## Environment-Specific Commands

### Development
```bash
npm run dev                    # Start with hot reload
npm start                      # Start normally
npm run docker:compose:dev     # Start with Docker Compose
```

### Staging
```bash
npm run start:staging          # Start server in staging mode
npm run docker:compose:staging # Start with Docker Compose
npm run health:staging         # Check staging health
npm run deploy:staging         # Deploy to staging
```

### Production
```bash
npm run start:production       # Start server in production mode
npm run docker:compose:prod    # Start with Docker Compose
npm run health:production      # Check production health
npm run deploy:production      # Deploy to production
```

## Deployment Scripts

### Staging Deployment

**Linux/Mac:**
```bash
./deploy-staging.sh deploy      # Deploy to staging
./deploy-staging.sh rollback    # Rollback to previous version
./deploy-staging.sh restart     # Restart services
./deploy-staging.sh health      # Check health
./deploy-staging.sh logs        # View logs
```

**Windows PowerShell:**
```powershell
.\deploy-staging.ps1 -Action deploy      # Deploy
.\deploy-staging.ps1 -Action rollback    # Rollback
.\deploy-staging.ps1 -Action restart     # Restart
.\deploy-staging.ps1 -Action health      # Health check
.\deploy-staging.ps1 -Action logs        # View logs
```

### Production Deployment

**Linux/Mac:**
```bash
./deploy-production.sh deploy      # Deploy to production
./deploy-production.sh rollback    # Rollback to previous version
./deploy-production.sh restart     # Restart services
./deploy-production.sh health      # Check health
./deploy-production.sh logs        # View logs
./deploy-production.sh backup      # Create manual backup
```

**Windows PowerShell:**
```powershell
.\deploy-production.ps1 -Action deploy      # Deploy
.\deploy-production.ps1 -Action rollback    # Rollback
.\deploy-production.ps1 -Action restart     # Restart
.\deploy-production.ps1 -Action health      # Health check
.\deploy-production.ps1 -Action logs        # View logs
.\deploy-production.ps1 -Action backup      # Manual backup
```

## Secrets Management

### Development
- Secrets stored locally in .env (git-ignored)
- No sensitive data required for local testing
- Use mock values for development

### Staging & Production
- Use AWS Secrets Manager for all secrets
- Environment variables reference secret ARNs
- Rotation via AWS Secrets Manager

**To retrieve secrets:**
```bash
# Get staging secrets
aws secretsmanager get-secret-value \
  --secret-id episode-metadata-staging \
  --region us-east-1

# Get production secrets
aws secretsmanager get-secret-value \
  --secret-id episode-metadata-production \
  --region us-east-1
```

## Environment Variables Reference

### Application Config
- `NODE_ENV` - Environment (development/staging/production)
- `PORT` - API port (3002, 3003 for prod)
- `HOST` - Bind address (0.0.0.0)
- `API_VERSION` - API version prefix (v1)
- `ALLOWED_ORIGINS` - CORS allowed origins

### Database
- `DATABASE_URL` - Connection string
- `DB_HOST` - Database host
- `DB_PORT` - Database port (5432)
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `DATABASE_POOL_MIN` - Min connections (dev: 2, staging: 5, prod: 10)
- `DATABASE_POOL_MAX` - Max connections (dev: 10, staging: 20, prod: 30)

### AWS
- `AWS_REGION` - AWS region (us-east-1)
- `AWS_ACCOUNT_ID` - AWS account ID
- `AWS_S3_BUCKET` - Primary S3 bucket
- `S3_THUMBNAIL_BUCKET` - Thumbnail bucket

### Cognito
- `COGNITO_USER_POOL_ID` - Cognito pool ID
- `COGNITO_CLIENT_ID` - Cognito client ID
- `COGNITO_CLIENT_SECRET` - Client secret (staging/prod only)
- `COGNITO_REGION` - Cognito region

### JWT
- `JWT_SECRET` - JWT signing secret
- `JWT_EXPIRATION` - Token expiration (24h)
- `REFRESH_TOKEN_SECRET` - Refresh token secret
- `REFRESH_TOKEN_EXPIRATION` - Refresh expiration (7d)

### Monitoring
- `LOG_LEVEL` - Log level (debug/info/warn/error)
- `DATADOG_API_KEY` - Datadog API key (staging/prod)
- `SENTRY_DSN` - Sentry error tracking (staging/prod)

## Troubleshooting

### Port Already in Use
```bash
# Find process using port
lsof -i :3002  # Mac/Linux
netstat -ano | findstr :3002  # Windows

# Kill process
kill -9 <PID>  # Mac/Linux
taskkill /PID <PID> /F  # Windows
```

### Database Connection Failed
```bash
# Check database is running
docker-compose ps

# Check logs
docker-compose logs postgres

# Verify connection
psql -U postgres -h localhost -d episode_metadata
```

### Health Check Failed
```bash
# Check service logs
docker-compose logs app

# Test endpoint directly
curl http://localhost:3002/api/v1/health

# Check database connectivity
npm run db:verify
```

### Deployment Failed - Rollback
```bash
# For staging
./deploy-staging.sh rollback

# For production
./deploy-production.sh rollback
```

## Best Practices

1. **Never commit secrets** - Use .env files with git-ignore
2. **Test in staging first** - Always deploy to staging before production
3. **Backup before production deployment** - Scripts create automatic backups
4. **Review logs after deployment** - Check application logs for errors
5. **Monitor after deployment** - Watch Datadog/CloudWatch for anomalies
6. **Use semantic versioning** - Tag releases properly
7. **Document changes** - Update CHANGELOG.md for each deployment

## CI/CD Integration

GitHub Actions workflow (`.github/workflows/deploy.yml`):

```yaml
name: Deploy
on:
  push:
    branches: [main, staging]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Staging
        if: github.ref == 'refs/heads/staging'
        run: ./deploy-staging.sh deploy
      - name: Deploy to Production
        if: github.ref == 'refs/heads/main'
        run: ./deploy-production.sh deploy
```

## Support

For issues or questions about environments:
- Check logs: `docker-compose logs app`
- Test endpoints: `npm run health:staging` or `npm run health:production`
- Review AWS console for resource status
- Contact: dev@primestudios.dev
