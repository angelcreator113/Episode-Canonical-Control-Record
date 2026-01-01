# Next Session Quick Start Guide

## Objective
Complete Phase 0D (RDS endpoint retrieval) and begin Phase 1 (Database Schema & API Development)

## Prerequisites Status
- ✅ Phase 0A-0C, 0E-0J, 0K: Complete
- ⏳ Phase 0D: RDS provisioning (check status first)

---

## Step 1: Check RDS Status

```powershell
# Check if RDS instances are available
aws rds describe-db-instances --region us-east-1 \
  --query 'DBInstances[?contains(DBInstanceIdentifier, `episode-metadata`)].{Name:DBInstanceIdentifier,Status:DBInstanceStatus,Endpoint:Endpoint.Address}' \
  --output table
```

**Expected Output:** Status should be "available" for all 3 instances:
- episode-metadata-db-dev
- episode-metadata-db-staging
- episode-metadata-db-prod

Each will have an endpoint like: `episode-metadata-db-dev.xxx.us-east-1.rds.amazonaws.com`

---

## Step 2: Retrieve Database Endpoints

Once RDS shows "available", retrieve the actual endpoints:

```powershell
# Get dev endpoint
aws rds describe-db-instances --db-instance-identifier episode-metadata-db-dev \
  --region us-east-1 \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text

# Get staging endpoint
aws rds describe-db-instances --db-instance-identifier episode-metadata-db-staging \
  --region us-east-1 \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text

# Get production endpoint
aws rds describe-db-instances --db-instance-identifier episode-metadata-db-prod \
  --region us-east-1 \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text
```

---

## Step 3: Update Secrets Manager

Update each database secret with the real endpoints (replace `<endpoint>` with actual values):

```powershell
# Update dev database secret
aws secretsmanager update-secret \
  --secret-id episode-metadata/database-dev \
  --region us-east-1 \
  --secret-string '{
    "host":"<dev-endpoint>",
    "port":5432,
    "database":"episode_metadata_dev",
    "username":"admin",
    "password":"<password-from-rds-setup>"
  }'

# Update staging database secret
aws secretsmanager update-secret \
  --secret-id episode-metadata/database-staging \
  --region us-east-1 \
  --secret-string '{
    "host":"<staging-endpoint>",
    "port":5432,
    "database":"episode_metadata_staging",
    "username":"admin",
    "password":"<password-from-rds-setup>"
  }'

# Update production database secret
aws secretsmanager update-secret \
  --secret-id episode-metadata/database-prod \
  --region us-east-1 \
  --secret-string '{
    "host":"<prod-endpoint>",
    "port":5432,
    "database":"episode_metadata_prod",
    "username":"admin",
    "password":"<password-from-rds-setup>"
  }'
```

---

## Step 4: Update .env File

Update local `.env` file with development database credentials:

```bash
# .env
DB_HOST=<dev-endpoint-from-step-2>
DB_PORT=5432
DB_NAME=episode_metadata_dev
DB_USER=admin
DB_PASSWORD=<password-from-rds-setup>
DB_REGION=us-east-1
```

---

## Step 5: Dismiss GitHub Alerts & Push Repository

```powershell
# Visit GitHub security page
# https://github.com/angelcreator113/Episode-Canonical-Control-Record/security

# Dismiss the 2 secret scanning alerts (both are test credentials, invalidated)

# Then push the repository
git push origin develop --force
git push origin main --force

# Verify push successful
git log --oneline -3
```

---

## Step 6: Test Database Connection

```powershell
# From within the project directory

# Start Docker environment if not running
docker-compose up -d

# Test database connection
npm run db:test

# Expected: Connection successful message
```

---

## Step 7: Run Initial Migrations

```powershell
# Create database schema
npm run db:migrate

# Seed with test data (optional)
npm run db:seed
```

---

## Step 8: Verify CI/CD Pipeline

```powershell
# Create test branch for CI verification
git checkout -b test/ci-check

# Make a simple change to trigger CI (e.g., update README)
echo "# Test CI" >> TEST_CI_MARKER.txt

# Commit and push
git add .
git commit -m "Test CI pipeline trigger"
git push origin test/ci-check

# Visit GitHub Actions to monitor
# https://github.com/angelcreator113/Episode-Canonical-Control-Record/actions

# After verification, delete test branch
git checkout develop
git branch -D test/ci-check
git push origin -D test/ci-check
```

---

## Database Credentials Reference

**Credentials from setup-rds.ps1:**
- **Username:** admin
- **Password:** <check RDS console or Secrets Manager>
- **Databases:**
  - Dev: episode_metadata_dev
  - Staging: episode_metadata_staging
  - Prod: episode_metadata_prod

---

## Current Status Summary

| Item | Status |
|------|--------|
| AWS Infrastructure | ✅ Deployed |
| VPCs & Networks | ✅ Configured |
| S3 Buckets | ✅ Ready |
| Cognito Pools | ✅ Active |
| SQS Queues | ✅ Ready |
| Secrets Manager | ✅ Created (endpoints pending) |
| RDS Databases | ⏳ Provisioning |
| GitHub Repository | ✅ Initialized (push pending alerts) |
| CI/CD Pipeline | ✅ Configured |
| Local Environment | ✅ Running |

---

## Troubleshooting

### RDS Still Not Available After 20 Minutes
```powershell
# Check detailed status
aws rds describe-db-instances --db-instance-identifier episode-metadata-db-dev --region us-east-1

# Look for error in DBInstanceStatus and StatusInfos
```

### Database Connection Fails
```powershell
# Verify security group allows port 5432
aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=episode-metadata-db-sg-dev" \
  --region us-east-1

# Verify database is accepting connections
# Check RDS console for any issues
```

### GitHub Secrets Not Working in CI
```powershell
# Verify secrets are set
gh secret list --repo angelcreator113/Episode-Canonical-Control-Record

# Re-add if needed
gh secret set AWS_ACCESS_KEY_ID --repo angelcreator113/Episode-Canonical-Control-Record
```

---

## Next Phase Tasks

Once RDS is verified working:

### Phase 1A: Database Schema Design
- [ ] Define episode metadata schema
- [ ] Create Sequelize models
- [ ] Write database migrations
- [ ] Add fixtures/seed data

### Phase 1B: Core API Endpoints
- [ ] GET /episodes (list)
- [ ] GET /episodes/:id (detail)
- [ ] POST /episodes (create)
- [ ] PUT /episodes/:id (update)
- [ ] DELETE /episodes/:id (delete)

### Phase 1C: Integration Testing
- [ ] Database integration tests
- [ ] API endpoint tests
- [ ] Cognito authentication tests

---

## Useful Links

- **GitHub Repository:** https://github.com/angelcreator113/Episode-Canonical-Control-Record
- **GitHub Actions:** https://github.com/angelcreator113/Episode-Canonical-Control-Record/actions
- **AWS RDS Console:** https://us-east-1.console.aws.amazon.com/rds/
- **AWS Secrets Manager:** https://us-east-1.console.aws.amazon.com/secretsmanager/
- **ECR Repository:** https://us-east-1.console.aws.amazon.com/ecr/

---

## Important Notes

⚠️ **Keep Secure:**
- Never commit `ci-cd-credentials.json` to git
- Keep `.env` file local only
- Rotate AWS credentials periodically

📅 **Timeline:**
- Phase 0 Complete: January 1, 2026
- Phase 1 Target: January 7-14, 2026
- Go-Live Target: February 14, 2026

🚀 **Ready for Phase 1 Once:**
- [ ] RDS instances confirmed available
- [ ] Database endpoints retrieved and stored
- [ ] Secrets Manager updated
- [ ] GitHub repository pushed
- [ ] Local database connection verified
