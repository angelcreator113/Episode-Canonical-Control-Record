# Quick Reference: GitHub Actions Deployment Control

## 🎯 Setup Checklist

### Step 1: Configure GitHub Environments
Go to: `https://github.com/YOUR_USERNAME/Episode-Canonical-Control-Record-1/settings/environments`

#### Create 3 Environments:

**1. development**
- ✅ No protection rules
- URL: `https://dev.episodes.primestudios.dev`

**2. staging**
- ✅ Required reviewers: You + team
- ✅ Minimum: 1 approval
- URL: `https://staging.episodes.primestudios.dev`
- Secret: `STAGING_DATABASE_URL` = 
  ```
  postgresql://postgres:Ayanna123!!@episode-control-staging.csnow208wqtv.us-east-1.rds.amazonaws.com:5432/episode_metadata
  ```

**3. production**
- ✅ Required reviewers: You + seniors
- ✅ Minimum: 1-2 approvals
- ✅ Deployment branches: `main` only
- ✅ Optional: 5-minute wait timer
- URL: `https://www.primepisodes.com`
- Secret: `PRODUCTION_DATABASE_URL` = 
  ```
  postgresql://postgres:Ayanna123!!@episode-control-prod.csnow208wqtv.us-east-1.rds.amazonaws.com:5432/episode_metadata
  ```

### Step 2: Add Repository Secrets
Go to: `Settings → Secrets and variables → Actions → New repository secret`

```
AWS_ACCESS_KEY_ID = your-aws-access-key
AWS_SECRET_ACCESS_KEY = your-aws-secret-key
```

## 🚀 How to Deploy

### Development (Auto):
```bash
git checkout dev
git add .
git commit -m "feat: new feature"
git push origin dev
```
✅ **Deploys automatically** - no approval needed

### Staging (Manual Approval):
```bash
git checkout staging
git merge dev
git push origin staging
```
⏳ Go to GitHub Actions → **Review pending** → **Approve**

### Production (Manual Approval + Safety):
```bash
git checkout main
git merge staging  
git push origin main
```
⏳ Go to GitHub Actions → **Review pending** → **Approve**
⏳ Optional 5-min wait timer before deployment

## 📱 Manual Trigger (Any Environment)
1. Go to GitHub → **Actions** tab
2. Click **"CI/CD Deploy Pipeline"**
3. Click **"Run workflow"**
4. Select environment: `development`, `staging`, or `production`
5. Click **"Run workflow"**

## ✅ Approval Process

When you see **"Review pending deployments"**:
1. Click the yellow banner
2. Review:
   - Commit SHA
   - Changes being deployed
   - Database migrations
3. Click **"Approve and deploy"** or **"Reject"**

## 🛑 Emergency Rollback

If deployment fails or causes issues:
```bash
# Revert last commit
git revert HEAD
git push origin main

# Or redeploy previous version
git checkout PREVIOUS_COMMIT_SHA
git push -f origin main
```

## 📊 Current Configuration

| Environment | Database | Auto-Deploy | Approval | Branch |
|------------|----------|-------------|----------|--------|
| Development | episode-control-dev | ✅ Yes | ❌ No | dev |
| Staging | episode-control-staging | ❌ No | ✅ Required | staging |
| Production | episode-control-prod | ❌ No | ✅✅ Required | main |

## 🔗 Quick Links

- **GitHub Actions**: `https://github.com/YOUR_USERNAME/Episode-Canonical-Control-Record-1/actions`
- **Environments**: `https://github.com/YOUR_USERNAME/Episode-Canonical-Control-Record-1/settings/environments`
- **Secrets**: `https://github.com/YOUR_USERNAME/Episode-Canonical-Control-Record-1/settings/secrets/actions`

## ⚡ Common Commands

```bash
# Test all database connections
node test-all-databases.js

# Create database (if needed)
$env:NODE_ENV="staging"; node create-database.js

# Check git status
git status

# View recent commits
git log --oneline -10

# Switch branches
git checkout dev      # Development
git checkout staging  # Staging
git checkout main     # Production
```

## 🎓 Remember

1. **Always test on dev first**
2. **Staging must pass before production**
3. **Review changes before approving**
4. **Database migrations run automatically**
5. **Production gets backed up before deployment**
