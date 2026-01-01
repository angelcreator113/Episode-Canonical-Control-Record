# ⚡ QUICK REFERENCE GUIDE

## Essential Commands (Keep Bookmarked!)

### 🏃 Local Development (Daily)
```bash
# Start dev server (hot reload)
npm run dev

# Run all tests
npm test

# Check code quality
npm run lint
npm run lint:fix    # Auto-fix lint issues
npm run format      # Auto-format code

# Database
npm run migrate:up    # Run pending migrations
npm run seed          # Load test data
```

### 🐳 Docker (Local Environment)
```bash
# Start all local services (PostgreSQL + Redis)
docker-compose up -d

# View logs
docker-compose logs -f postgres
docker-compose logs -f api

# Stop services
docker-compose down

# Clean everything (removes data!)
docker-compose down -v
```

### 📚 Database (psql)
```bash
# Connect to local dev database
psql -U postgres -d episode_metadata_dev

# Common commands
\dt                    # List tables
\d episodes            # Describe table
SELECT * FROM episodes; -- Query
\q                     # Quit

# Connect to AWS RDS
psql -h episode-metadata-db-dev.xxxxx.us-east-1.rds.amazonaws.com \
  -U postgres -d postgres
```

### 🔧 Git Workflow (Feature Branch)
```bash
# Create feature branch
git checkout develop
git pull origin develop
git checkout -b feature/xyz-description

# Make changes, test, commit
git add .
git commit -m "feat: description of changes"

# Push & create PR
git push origin feature/xyz-description
# Then create PR on GitHub

# After merge, cleanup
git branch -d feature/xyz-description
```

### 📤 Deployment
```bash
# Deploy to Staging
git checkout develop
git pull origin develop
# Changes auto-deploy on merge

# Deploy to Production
git checkout main
git pull origin main
# Manual approval required in GitHub Actions
```

### ☁️ AWS (Common)
```bash
# List all resources
aws ec2 describe-vpcs --query 'Vpcs[*].[VpcId,Tags]'
aws rds describe-db-instances --query 'DBInstances[*].DBInstanceIdentifier'
aws s3 ls | grep episode-metadata

# View logs
aws logs tail /ecs/episode-metadata-api-dev --follow
aws logs tail /ecs/episode-metadata-api-production --follow

# Check deployment status
aws ecs describe-services \
  --cluster episode-metadata-cluster-staging \
  --services episode-metadata-api-service
```

---

## 📋 Project Files Quick Links

| File | Purpose | Edit? |
|------|---------|-------|
| `.env.example` | Env var template | Reference only |
| `package.json` | Dependencies & scripts | When adding packages |
| `README.md` | Project overview | Keep updated |
| `PHASE_0_CHECKLIST.md` | Week 1 tasks | Check off daily |
| `docs/AWS_SETUP.md` | AWS commands | Reference for Phase 0 |
| `docs/ENV_VARIABLES.md` | Env var reference | When confused about config |
| `docs/DEPLOYMENT.md` | How to deploy | Before deploying |
| `src/app.js` | Express entry point | Phase 2+ |
| `src/config/` | Configuration files | Reference during dev |
| `tests/unit/app.test.js` | Example test | Pattern for other tests |
| `.github/workflows/ci-cd.yml` | CI/CD pipeline | Only if changing pipeline |

---

## 🔑 Key Information

### Project Details
- **Name**: Episode Metadata API
- **Show**: "Styling Adventures w Lala"
- **Repository**: `angelcreator113/Episode-Canonical-Control-Record`
- **AWS Account**: `637423256673`
- **Team**: 2 Full-Stack Developers
- **Timeline**: 8-10 weeks (Jan 1 - Feb 14, 2026)
- **Budget**: ~$275/month (dev + staging + prod)

### Tech Stack
- **Runtime**: Node.js 20.x
- **Framework**: Express.js 4.x
- **Database**: PostgreSQL 15 (AWS RDS)
- **Authentication**: AWS Cognito
- **Storage**: AWS S3
- **Container**: Docker + ECS Fargate
- **CI/CD**: GitHub Actions
- **Testing**: Jest
- **Code Quality**: ESLint + Prettier

### Development Accounts
- **Admin**: admin@episodeidentityform.com
- **Editor**: editor@episodeidentityform.com
- **Viewer**: viewer@episodeidentityform.com

### Important URLs
- **Local API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health
- **Staging API**: https://api-staging.example.com (coming Phase 5)
- **Production API**: https://api.example.com (coming Phase 5)
- **GitHub**: https://github.com/angelcreator113/Episode-Canonical-Control-Record

### Key Contacts
| Role | Name | Contact |
|------|------|---------|
| Project Lead | [Your Name] | Slack: #episode-metadata |
| DevOps Dev | Developer #1 | [Contact] |
| Full-Stack Dev | Developer #2 | [Contact] |

---

## 🎯 Daily Checklist

**Every morning:**
- [ ] Pull latest from develop: `git pull origin develop`
- [ ] Check GitHub Projects board for assignments
- [ ] Read standups from yesterday
- [ ] Review any failing CI/CD pipelines

**Before committing:**
- [ ] Tests pass: `npm test`
- [ ] Linting passes: `npm run lint`
- [ ] Code formatted: `npm run format`
- [ ] Commit message is clear
- [ ] PR description is detailed

**Before merging to develop:**
- [ ] Code review approval (1 person)
- [ ] CI pipeline green
- [ ] No merge conflicts
- [ ] Tests coverage adequate

**Before deploying to production:**
- [ ] Tested in staging
- [ ] No critical bugs
- [ ] Database migrations ready
- [ ] Team approval
- [ ] Backup taken (if needed)

---

## 🚨 Emergency Procedures

### If CI/CD Pipeline Fails
1. **Check GitHub Actions**: Go to repo → Actions tab
2. **Read error message**: Click on failed job
3. **Common fixes**:
   - Test failed? Run locally: `npm test`
   - Lint failed? Fix: `npm run lint:fix`
   - Build failed? Check Dockerfile, logs
4. **Push fix**: Commit and push to same branch

### If Staging Deployment Fails
1. **Check deployment**: GitHub Actions → Production Deploy job
2. **Review logs**: `aws logs tail /ecs/episode-metadata-api-staging --follow`
3. **Options**:
   - Fix forward: Commit fix, push to develop
   - Rollback: Revert last commit, push

### If Database Connection Fails
```bash
# Check if PostgreSQL running
docker ps | grep postgres

# Check connection string
cat .env | grep DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Restart Docker
docker-compose restart postgres
```

### If You Lose AWS Credentials
1. **Contact IT/Admin**: Need new credentials
2. **Update locally**: Edit `.env` file
3. **Update GitHub**: Go to Settings → Secrets & update
4. **Update AWS**: Generate new access keys

---

## 📚 Learning Resources

### Node.js & Express
- [Express.js Docs](https://expressjs.com)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

### PostgreSQL
- [PostgreSQL Docs](https://www.postgresql.org/docs)
- [Psql Cheat Sheet](https://postgrescheatsheet.com)

### AWS
- [AWS CLI Documentation](https://docs.aws.amazon.com/cli)
- [AWS Best Practices](https://aws.amazon.com/architecture/well-architected)

### Testing
- [Jest Docs](https://jestjs.io)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

### Code Quality
- [Clean Code](https://www.oreilly.com/library/view/clean-code-a/9780136083238)
- [ESLint Rules](https://eslint.org/docs/rules)

---

## 🔐 Security Reminders

**NEVER do these:**
- ❌ Commit .env file (git will warn you)
- ❌ Commit AWS credentials
- ❌ Share passwords in Slack
- ❌ Use weak passwords (min 12 chars)
- ❌ Disable security group rules
- ❌ Run as root in Docker

**ALWAYS do these:**
- ✅ Use AWS Secrets Manager for secrets
- ✅ Enable MFA on AWS account
- ✅ Review IAM permissions regularly
- ✅ Keep dependencies updated: `npm audit fix`
- ✅ Rotate credentials every 90 days
- ✅ Use HTTPS (AWS handles this)
- ✅ Limit database access to needed services

---

## 💰 Cost Management

**Monthly estimates:**
- Development: $35
- Staging: $80
- Production: $160
- **Total**: ~$275/month

**Cost alerts:**
- 🟢 Alert 1: $100/month
- 🟡 Alert 2: $300/month
- 🔴 Alert 3: $500/month

**Cost-saving tips:**
- Use dev environment when possible
- Delete unused resources
- Monitor S3 storage
- Check CloudWatch retention periods
- Review unused NAT Gateway charges

---

## ✅ Pre-Launch Checklist (Week 10)

Before February 14 launch:

**Code Quality:**
- [ ] Test coverage > 80%
- [ ] No linting errors
- [ ] No security vulnerabilities
- [ ] All deprecated dependencies updated

**Documentation:**
- [ ] All API endpoints documented
- [ ] Troubleshooting guide complete
- [ ] Runbooks for common issues
- [ ] Changelog updated

**Infrastructure:**
- [ ] All monitoring alerts configured
- [ ] CloudWatch dashboards created
- [ ] Backups tested & working
- [ ] Scaling policies configured
- [ ] SSL certificates valid

**Team Readiness:**
- [ ] All team members trained
- [ ] Runbooks reviewed
- [ ] Escalation procedures documented
- [ ] On-call rotation established

**User Acceptance:**
- [ ] UAT testing complete
- [ ] Stakeholder sign-off
- [ ] Release notes prepared
- [ ] User communication sent

---

## 🚀 Success Indicators

**By End of Phase 0 (Week 1):**
- ✅ AWS infrastructure deployed
- ✅ GitHub repo configured
- ✅ Local development working
- ✅ CI/CD pipeline green

**By End of Phase 1 (Week 3):**
- ✅ Database schema complete
- ✅ Core API endpoints working
- ✅ 70%+ test coverage
- ✅ Can seed data successfully

**By End of Phase 3 (Week 7):**
- ✅ All MVP features implemented
- ✅ Staging environment stable
- ✅ 80%+ test coverage
- ✅ Performance benchmarks met

**By Launch (Week 10):**
- ✅ Production deployment smooth
- ✅ Team trained & confident
- ✅ Monitoring & alerts active
- ✅ Zero critical bugs

---

**Last Updated**: January 1, 2026  
**Keep This Handy!** 🔖
