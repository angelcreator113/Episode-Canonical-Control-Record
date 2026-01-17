# Branch Strategy & Deployment Guide

## 🌳 Branch Structure

Your repository now uses a **3-branch deployment strategy**:

```
dev ────────┐
            ├──> staging ────────┐
            │                     ├──> main (production)
```

### Branch Purposes

| Branch | Environment | Domain | Auto-Deploy | Purpose |
|--------|-------------|---------|-------------|----------|
| `dev` | Development | `dev.episodes.primestudios.dev` | ✅ Yes | Active development, feature testing |
| `staging` | Staging | `staging.episodes.primestudios.dev` | ✅ Yes | Pre-production testing, QA |
| `main` | Production | `www.primepisodes.com` | ✅ Yes | Live production environment |

## 🚀 Deployment Flow

### 1. Development (dev branch)
```bash
git checkout dev
# Make changes
git add .
git commit -m "feat: add new feature"
git push origin dev
```
**Triggers:** GitHub Actions automatically deploys to **Development** environment

### 2. Staging (staging branch)
```bash
git checkout staging
git merge dev
git push origin staging
```
**Triggers:** GitHub Actions automatically deploys to **Staging** environment

### 3. Production (main branch)
```bash
git checkout main
git merge staging
git push origin main
```
**Triggers:** GitHub Actions automatically deploys to **Production** environment

## 🔒 Branch Protection Rules

### Recommended Settings

Navigate to **GitHub → Settings → Branches → Add rule** for each branch:

#### For `main` (Production)
- ✅ Require pull request reviews before merging (2 approvals)
- ✅ Require status checks to pass before merging
  - ✅ `test` job must pass
  - ✅ `build` job must pass
- ✅ Require branches to be up to date before merging
- ✅ Do not allow bypassing the above settings
- ✅ Restrict who can push to matching branches (admins only)
- ❌ Allow force pushes: **Never**
- ❌ Allow deletions: **Never**

#### For `staging`
- ✅ Require pull request reviews before merging (1 approval)
- ✅ Require status checks to pass before merging
  - ✅ `test` job must pass
- ✅ Require branches to be up to date before merging
- ❌ Allow force pushes: **Never**

#### For `dev`
- ⚠️ Optional: Require status checks to pass before merging
  - ✅ `test` job must pass
- ✅ Allow direct pushes for faster development
- ⚠️ Allow force pushes: **Admins only** (use cautiously)

## 📋 Environment Variables

Each environment has its own configuration file:

| Environment | Config File | Domain | Database |
|-------------|-------------|--------|----------|
| Development | `.env.development` | `dev.episodes.primestudios.dev` | AWS RDS Dev |
| Staging | `.env.staging` | `staging.episodes.primestudios.dev` | AWS RDS Staging |
| Production | `.env.production` | `www.primepisodes.com` | AWS RDS Production |

### AWS Secrets Required

In GitHub → Settings → Secrets and variables → Actions, add:

```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
DB_HOST_DEV (optional if using IAM roles)
DB_HOST_STAGING
DB_HOST_PROD
DB_PASSWORD_DEV
DB_PASSWORD_STAGING
DB_PASSWORD_PROD
```

## 🔄 Workflow Triggers

`.github/workflows/deploy.yml` triggers on:

| Event | Branches | Actions |
|-------|----------|---------|
| Push | `dev` | Test → Build → Deploy to Development |
| Push | `staging` | Test → Build → Deploy to Staging |
| Push | `main` | Test → Build → Deploy to Production |
| Manual | Any | `workflow_dispatch` allows manual trigger |

## 🧪 Testing Workflow

### Before Merging to Main

1. **Push to dev** → Verify on `dev.episodes.primestudios.dev`
2. **Merge dev to staging** → QA tests on `staging.episodes.primestudios.dev`
3. **Smoke tests pass** → Merge staging to main
4. **Deploy to production** → Live on `www.primepisodes.com`

## 🎯 Quick Commands

### Create a new feature
```bash
git checkout dev
git pull origin dev
git checkout -b feature/new-feature
# Make changes
git add .
git commit -m "feat: add new feature"
git push origin feature/new-feature
# Create PR to dev branch
```

### Promote dev to staging
```bash
git checkout staging
git pull origin staging
git merge dev
git push origin staging
```

### Promote staging to production
```bash
git checkout main
git pull origin main
git merge staging
git push origin main
```

## ⚠️ Important Notes

1. **Never push directly to main** - Always go through staging first
2. **Test on dev first** - Catch issues early
3. **Staging is final QA** - Production should be a mirror of staging
4. **Use feature branches** - Branch from dev, PR back to dev
5. **Environment parity** - Keep dev/staging/prod configurations similar

## 📞 Support

If deployment fails:
1. Check GitHub Actions logs
2. Verify AWS credentials in Secrets
3. Ensure RDS instances are running
4. Check domain DNS configuration

## 🗑️ Deleted Branches

The following branches have been cleaned up:
- `production` (replaced by `main`)
- `main-clean` (renamed to `main`)
- `stage` (renamed to `staging`)

Remote branches `develop`, `origin/main-clean`, `origin/stage`, `origin/production` should be deleted on GitHub.
