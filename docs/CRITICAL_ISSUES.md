# 🚨 CRITICAL INFRASTRUCTURE ISSUES & FIX PLAN

## Current State (BROKEN)
```
✅ Development Environment:
   - RDS: episode-control-dev (WRONG NAME - should be episode-metadata-db-dev)
   - Cognito: us-east-1_mFVU52978 (CORRECT - in use)
   - Database: episode_metadata (CORRECT - 5 tables created)
   - Tests: 256/257 PASSING ✅

❌ Staging Environment:
   - RDS: NOT CREATED
   - Cognito: 3 DUPLICATE pools (us-east-1_VPrBfEn1f, us-east-1_jYkqo528H, us-east-1_wvs0J2Jho)
   - Database: NOT CREATED

❌ Production Environment:
   - RDS: NOT CREATED
   - Cognito: 3 DUPLICATE pools (us-east-1_643pfiGql, us-east-1_ohSQAOEtC, us-east-1_usfecvSkW)
   - Database: NOT CREATED

❌ Code Organization:
   - All 256+ tests written but only testing against dev
   - .env hardcoded to dev environment
   - No environment-specific configuration
   - No staging/prod deployment scripts
```

## Priority 1: CLEANUP (TODAY)
1. **Delete 8 duplicate/unused Cognito pools** (keep only us-east-1_mFVU52978)
   - Delete all `episode-metadata-users-staging` (3 pools)
   - Delete 2 duplicate `episode-metadata-users-dev` (keep us-east-1_mFVU52978)
   - Delete 2 duplicate `episode-metadata-users-prod` (will recreate)

2. **Rename RDS instance** (OR accept current name as acceptable variation)
   - Current: `episode-control-dev`
   - Should be: `episode-metadata-db-dev`
   - **NOTE:** Renaming RDS requires snapshot/restore - significant effort
   - **ALTERNATIVE:** Accept current naming and update documentation

## Priority 2: CREATE STAGING (NEXT SESSION)
1. Create `episode-metadata-db-staging` RDS
2. Create `episode-metadata-users-staging` Cognito pool
3. Create `episode_metadata_staging` database
4. Migrate schema (5 tables)

## Priority 3: CREATE PRODUCTION (NEXT SESSION)
1. Create `episode-metadata-db-prod` RDS
2. Create `episode-metadata-users-prod` Cognito pool
3. Create `episode_metadata_prod` database
4. Migrate schema (5 tables)
5. Setup with HA/Backups

## Required Code Changes
1. `.env` → `.env.development` (dev-specific)
2. Create `.env.staging` (staging-specific)
3. Create `.env.production` (prod-specific)
4. Update `npm` scripts to support environments:
   - `npm run migrate:dev` (current)
   - `npm run migrate:staging`
   - `npm run migrate:prod`
5. Update tests to connect to current environment

## Risk Assessment
- **CRITICAL:** Cognito pools are disorganized but not breaking anything
- **LOW:** RDS naming is cosmetic but affects ops/monitoring
- **HIGH:** Missing staging/prod prevents deployment readiness

---

## RECOMMENDATION

**Option A (AGGRESSIVE - Cleanup Today)**
1. Delete 8 duplicate Cognito pools manually via AWS CLI (< 5 min)
2. Rename RDS via snapshot (30-45 min, potential downtime)
3. Update .env and config files
4. Re-run tests to confirm working

**Option B (PRAGMATIC - Cleanup + Document)**
1. Delete 8 duplicate Cognito pools (< 5 min)
2. Accept `episode-control-dev` as dev identifier (just document it)
3. Move staging/prod creation to next session with better planning
4. Update .env to support multi-environment

**Option C (CONSERVATIVE - Document Only)**
1. Document current state and naming
2. Plan cleanup for next session
3. Continue with current dev setup
4. Focus on staging/prod planning

---

**RECOMMENDED:** Option B (Pragmatic) - Quick cleanup + planning
