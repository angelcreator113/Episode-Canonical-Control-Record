# Deployment Guide

## How to Deploy to Staging & Production

---

## Development → Staging Pipeline

### Prerequisites
- Feature complete and tested locally
- All tests passing (`npm test`)
- Code follows linting rules (`npm run lint`)
- Feature branch created from `develop`

### Deployment Steps

#### Step 1: Create Feature Branch
```bash
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name
```

#### Step 2: Make Changes & Test
```bash
npm run dev              # Start local dev server
npm test                 # Run all tests
npm run lint             # Check code quality
npm run lint:fix         # Fix lint issues
```

#### Step 3: Commit & Push
```bash
git add .
git commit -m "feat: description of changes"
git push origin feature/your-feature-name
```

#### Step 4: Create Pull Request
1. Go to GitHub repository
2. Click "New Pull Request"
3. Base: `develop`, Compare: `feature/your-feature-name`
4. Fill in PR description:
   - What changed?
   - Why did you change it?
   - How to test?
5. Request review from team member

#### Step 5: Code Review
- Team reviews code
- Address any comments
- Get at least 1 approval

#### Step 6: Merge to Develop
```bash
# Merge via GitHub UI
# Or via command line:
git checkout develop
git pull origin develop
git merge feature/your-feature-name
git push origin develop
```

#### Step 7: Automatic Deployment
- GitHub Actions CI/CD pipeline triggers
- Tests run automatically
- Docker image built & pushed to ECR
- **Automatically deploys to Staging**

#### Step 8: Test in Staging
1. Access staging environment: `https://api-staging.example.com`
2. Run manual tests
3. Verify functionality
4. Test with QA team

---

## Staging → Production Pipeline

### Prerequisites
- Feature tested and validated in staging
- No critical bugs or issues
- Team approval for production release
- Database backups taken

### Deployment Steps

#### Step 1: Create Release PR
```bash
# From develop branch
git checkout develop
git pull origin develop

# Create release branch
git checkout -b release/v1.x.x
```

#### Step 2: Update Version
Edit `package.json`:
```json
{
  "version": "1.0.1"
}
```

#### Step 3: Create Pull Request to Main
1. Go to GitHub
2. Base: `main`, Compare: `release/v1.x.x`
3. Add release notes:
   - Features added
   - Bugs fixed
   - Breaking changes
4. Request approval from project lead

#### Step 4: Get Approval
- Project lead reviews PR
- Approval required before merge
- Infrastructure lead confirms readiness

#### Step 5: Merge to Main
```bash
# Merge via GitHub UI only (requires approval)
```

#### Step 6: Manual Production Deployment
GitHub Actions will:
1. Run all tests
2. Build Docker image
3. Push to ECR
4. **Wait for manual approval in GitHub Actions**

In GitHub Actions:
1. Go to Actions tab
2. Find the production deployment job
3. Click "Review Deployments"
4. Approve the deployment

#### Step 7: Verify Production
```bash
# Check API health
curl https://api.example.com/health

# Check database
psql -h episode-metadata-db-production.xxxxx.us-east-1.rds.amazonaws.com \
  -U postgres -d postgres \
  -c "SELECT version();"

# Monitor CloudWatch logs
aws logs tail /ecs/episode-metadata-api-production --follow
```

---

## Rollback Procedures

### If Staging Deployment Fails

```bash
# Revert the develop branch
git revert <commit-hash>
git push origin develop

# Or reset to last good state
git reset --hard <commit-hash>
git push origin develop --force
```

### If Production Deployment Fails

1. **Immediate**: Stop deployment in GitHub Actions
2. **Assess**: Check CloudWatch logs for errors
3. **Decide**: Rollback or fix forward?

#### Quick Rollback to Previous Version
```bash
# In AWS console or CLI
aws ecs update-service \
  --cluster episode-metadata-cluster-production \
  --service episode-metadata-api-service \
  --force-new-deployment \
  --region us-east-1

# This will redeploy the previous Docker image
```

#### Check Deployment Status
```bash
aws ecs describe-services \
  --cluster episode-metadata-cluster-production \
  --services episode-metadata-api-service \
  --query 'services[0].deployments'
```

---

## CI/CD Pipeline Visualization

```
Feature Branch
    ↓
Create PR to develop
    ↓
Code Review & Approval
    ↓
Merge to develop
    ↓
CI/CD Pipeline Triggers:
├─ Run Tests (Jest)
├─ Run Linter (ESLint)
├─ Build Docker Image
├─ Push to ECR
└─ Deploy to Staging (Auto)
    ↓
Manual Testing in Staging
    ↓
Create PR to main
    ↓
Code Review & Approval
    ↓
Merge to main
    ↓
CI/CD Pipeline Triggers:
├─ Run Tests (Jest)
├─ Run Linter (ESLint)
├─ Build Docker Image
├─ Push to ECR
└─ Wait for Manual Approval
    ↓
Approve in GitHub Actions
    ↓
Deploy to Production
    ↓
Verify Health Checks
    ↓
Monitor CloudWatch Logs
```

---

## GitHub Secrets Required

Store these in GitHub repo settings under Secrets:

**For Staging:**
```
AWS_ACCESS_KEY_ID          = Your staging AWS access key
AWS_SECRET_ACCESS_KEY      = Your staging AWS secret key
```

**For Production:**
```
AWS_PROD_ACCESS_KEY_ID     = Your production AWS access key
AWS_PROD_SECRET_ACCESS_KEY = Your production AWS secret key
```

---

## Monitoring & Alerting

### CloudWatch Logs
```bash
# Watch logs in real-time
aws logs tail /ecs/episode-metadata-api-production --follow

# Search for errors
aws logs filter-log-events \
  --log-group-name /ecs/episode-metadata-api-production \
  --filter-pattern "ERROR"
```

### CloudWatch Metrics
- CPU Utilization
- Memory Utilization
- HTTP Request Count
- API Response Time
- Error Rate

### Alarms (Set Up in Phase 5)
- High error rate (>5%)
- High response time (>1000ms)
- High memory usage (>80%)
- RDS CPU (>75%)
- RDS Storage (>80%)

---

## Deployment Checklist

Before Each Deployment:

- [ ] All tests passing
- [ ] Code reviewed and approved
- [ ] No lint errors
- [ ] Changelog updated
- [ ] Version number incremented
- [ ] Database migrations ready
- [ ] Backup taken (production only)
- [ ] Team notified
- [ ] Monitoring configured

Post-Deployment:

- [ ] Health checks passing
- [ ] No error spikes in logs
- [ ] Performance metrics normal
- [ ] User-facing features working
- [ ] Database responsive
- [ ] All external integrations connected
- [ ] Team validates changes

---

## Emergency Contacts

- **Dev Lead**: [Name] - [Phone]
- **Ops Lead**: [Name] - [Phone]
- **Product**: [Name] - [Phone]

---

## Support

For deployment issues:
1. Check CloudWatch logs
2. Review error in GitHub Actions
3. Contact dev team on Slack #episode-metadata
4. If critical: page on-call engineer
