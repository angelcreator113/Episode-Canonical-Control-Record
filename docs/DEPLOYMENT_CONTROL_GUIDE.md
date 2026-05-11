# GitHub Actions Deployment Control Guide

## Overview
This guide explains how to set up environment protection rules for staging and production deployments, giving you full control over when deployments happen.

## 🎯 Deployment Flow

```
dev branch (push) → Auto-deploy to Development
    ↓
staging branch (push) → Requires Approval → Deploy to Staging
    ↓
main branch (push) → Requires Approval → Deploy to Production
```

## 🔒 Setting Up Environment Protection Rules

### 1. Configure GitHub Environments

Go to your repository settings and set up protection rules:

**URL:** https://github.com/YOUR_USERNAME/Episode-Canonical-Control-Record-1/settings/environments

### 2. Development Environment (Auto-Deploy)
1. Click **"New environment"** → Name: `development`
2. **No protection rules needed** - will auto-deploy on push to `dev`
3. Add environment URL: `https://dev.episodes.primestudios.dev`

### 3. Staging Environment (Manual Approval)
1. Click **"New environment"** → Name: `staging`
2. Enable **"Required reviewers"**
   - Add yourself and/or team members who can approve
   - Requires at least 1 approval before deployment
3. Add environment URL: `https://staging.episodes.primestudios.dev`
4. **Environment secrets:**
   - `STAGING_DATABASE_URL` = `postgresql://postgres:<REDACTED — see GitHub Actions secret PROD_DB_PASSWORD>@episode-control-staging.csnow208wqtv.us-east-1.rds.amazonaws.com:5432/episode_metadata`

### 4. Production Environment (Manual Approval + Protection)
1. Click **"New environment"** → Name: `production`
2. Enable **"Required reviewers"**
   - Add yourself and senior team members
   - Consider requiring 2+ approvals for production
3. Enable **"Wait timer"** (optional): 5-10 minutes
   - Gives time to cancel deployment if needed
4. Enable **"Deployment branches"** → Select `main` only
5. Add environment URL: `https://www.primepisodes.com`
6. **Environment secrets:**
   - `PRODUCTION_DATABASE_URL` = `postgresql://postgres:<REDACTED — see GitHub Actions secret PROD_DB_PASSWORD>@episode-control-prod.csnow208wqtv.us-east-1.rds.amazonaws.com:5432/episode_metadata`

## 🔑 Required GitHub Secrets

Go to: **Settings → Secrets and variables → Actions → New repository secret**

### Repository Secrets (Available to all environments):
- `AWS_ACCESS_KEY_ID` - Your AWS access key
- `AWS_SECRET_ACCESS_KEY` - Your AWS secret key

### Environment-Specific Secrets:
Set these in each environment's settings:

**Development:**
- Auto-uses .env.development

**Staging:**
- `STAGING_DATABASE_URL`

**Production:**
- `PRODUCTION_DATABASE_URL`

## 🚀 How to Deploy

### Automatic Deployments (Development):
```bash
git checkout dev
git add .
git commit -m "feat: new feature"
git push origin dev
```
✅ Automatically deploys to development

### Controlled Deployments (Staging):
```bash
# Option 1: Merge dev to staging
git checkout staging
git merge dev
git push origin staging
```
⏳ Waits for your approval in GitHub Actions tab

```bash
# Option 2: Manual trigger
# Go to GitHub → Actions → CI/CD Deploy Pipeline → Run workflow
# Select "staging" from dropdown
```

### Controlled Deployments (Production):
```bash
# Option 1: Merge staging to main
git checkout main
git merge staging
git push origin main
```
⏳ Waits for your approval + optional wait timer

```bash
# Option 2: Manual trigger
# Go to GitHub → Actions → CI/CD Deploy Pipeline → Run workflow
# Select "production" from dropdown
```

## ✅ Approving Deployments

When a deployment is waiting for approval:

1. Go to **GitHub → Actions** tab
2. Click on the running workflow
3. You'll see **"Review pending deployments"** button
4. Review the changes and click **"Approve and deploy"** or **"Reject"**

## 📋 Deployment Checklist

### Before Deploying to Staging:
- [ ] All tests passing on dev
- [ ] Features tested locally
- [ ] Database migrations tested
- [ ] No breaking changes

### Before Deploying to Production:
- [ ] Successfully tested on staging
- [ ] Database backup created (automatic in workflow)
- [ ] Migrations reviewed
- [ ] Team notified
- [ ] Monitoring ready
- [ ] Rollback plan ready

## 🔄 Current Workflow Status

**Development:**
- Database: `episode-control-dev` ✅
- Auto-deploys: ✅ Enabled
- Approvals: ❌ None required

**Staging:**
- Database: `episode-control-staging` ✅
- Auto-deploys: ❌ Disabled
- Approvals: ⏳ **Required (needs setup)**

**Production:**
- Database: `episode-control-prod` ✅
- Auto-deploys: ❌ Disabled
- Approvals: ⏳ **Required (needs setup)**

## 🛠️ Next Steps

1. **Set up GitHub Environments** (follow steps above)
2. **Add environment secrets** for database URLs
3. **Test the workflow:**
   ```bash
   # Make a small change
   echo "test" >> README.md
   git add README.md
   git commit -m "test: workflow"
   git push origin dev
   ```
4. **Verify development auto-deploys**
5. **Merge to staging and practice approval process**
6. **Set up AWS deployment commands** in workflow

## 📞 Support

If you encounter issues:
1. Check GitHub Actions logs
2. Verify environment secrets are set
3. Confirm AWS credentials are valid
4. Test database connections: `node test-all-databases.js`

## 🔗 Useful Links

- [GitHub Environments Documentation](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
- [AWS Actions Documentation](https://github.com/aws-actions)
- [Node.js Deployment Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
