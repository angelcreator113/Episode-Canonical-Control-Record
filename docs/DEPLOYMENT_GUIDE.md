# 🚀 SERVER DEPLOYMENT GUIDE

> **HISTORICAL — DANGEROUS IF FOLLOWED.** Added 2026-09-13, basis
> `origin/main` at `083921002e36e9a8703bb6f82e06d0a9faaad5bd`. PROJECT_CONTEXT.md §9 names this
> file among those describing ECS / staging-branch / push-to-dev
> pipelines that never existed or are disabled, with copy-paste `aws`
> and migration commands against RDS. **Following any procedure below
> against the live AWS account, the canon RDS instance, or production
> recreates the May 30 incident path.** This document is not
> authoritative for any current deployment procedure.

## ⚠️ CURRENT STATUS: LOCAL DEVELOPMENT ONLY

**You are working on Windows. Servers are NOT set up yet.**

✅ **Currently Working:**
- Backend: http://localhost:3002
- Frontend: http://localhost:5174
- Worker: npm run dev:worker
- Database: Local PostgreSQL

---

## 🎯 WHAT TO DO RIGHT NOW

### ✅ Step 1: Merge Pull Request (Do This First!)

1. Browser should be open at: https://github.com/angelcreator113/Episode-Canonical-Control-Record/compare/main...dev
2. **Title:** `Week 2 Complete: AI Script Analysis + Raw Footage Upload + Scene Linking + FFmpeg Processing`
3. **Description:** Copy from `PR_DESCRIPTION.md`
4. Click **"Create pull request"**
5. Wait for checks ✅
6. Click **"Merge pull request"**

### ✅ Step 2: Continue Local Development

Your nginx configs are ready for future deployment, but you don't need them yet!

---

## 🌐 FUTURE: Server Deployment (When Ready)

### Prerequisites Needed:
- AWS EC2 instance
- Domain configured (primepisodes.com, dev.primepisodes.com)
- SSH access
- RDS database

### Quick Commands (For Future Use):

**Production (primepisodes.com):**
```bash
sudo cp nginx-primepisodes.conf /etc/nginx/sites-available/primepisodes
echo "PORT=3000" >> .env
pm2 start src/server.js --name episode-api
sudo systemctl reload nginx
```

**Dev (dev.primepisodes.com):**
```bash
sudo cp nginx-episode.conf /etc/nginx/sites-available/episode
echo "PORT=3002" >> .env
pm2 start src/server.js --name episode-dev
sudo systemctl reload nginx
```

---

## 📊 Deployment Status

- [x] **Phase 1:** Local development (CURRENT)
- [ ] **Phase 2:** Set up AWS infrastructure
- [ ] **Phase 3:** Initial server deployment
- [ ] **Phase 4:** CI/CD automation

**Focus on merging your PR now. Deployment comes later!** 🎉
