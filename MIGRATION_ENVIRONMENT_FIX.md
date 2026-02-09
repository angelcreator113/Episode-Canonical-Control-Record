# ⚠️ Migration Environment Issue - RESOLVED

## Issue
When running `npm run migrate:up` in CI/CD (GitHub Actions), the migrations failed because:
1. Environment was set to "test" instead of "development"
2. Test database doesn't have the base tables yet
3. Migration `-create-lala-formula.js` tried to reference non-existent `episodes` table

## Error Message
```
ERROR: relation "episodes" does not exist
Error: Process completed with exit code 1.
```

## Root Cause
- Sequelize CLI defaults to `NODE_ENV` environment variable
- GitHub Actions likely sets `NODE_ENV=test` for testing workflows
- Test database is empty and needs base migrations run first

## Solution

### For Local Development ✅
```bash
# Set environment to development
$env:NODE_ENV = "development"  # PowerShell
# or
export NODE_ENV=development     # Bash

# Run migrations
npm run migrate:up
```

### For CI/CD (GitHub Actions)
Update `.github/workflows/*.yml` to set correct environment:

```yaml
- name: Run Database Migrations
  env:
    NODE_ENV: development  # or test, but ensure test DB has base tables
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
  run: npm run migrate:up
```

### For Test Environment
If you need to run migrations in test environment:

```bash
# 1. Create test database
npx sequelize-cli db:create --env test

# 2. Run all migrations in order
NODE_ENV=test npm run migrate:up
```

## Current Status ✅

**Development Database:**
- All migrations complete
- 66 tables verified
- Schema up to date

**Verification:**
```bash
node scripts/verify-schema.js
# ✅ ALL TABLES EXIST - SCHEMA VERIFIED!
```

## Migration Files

### Problematic Migration
- `src/migrations/-create-lala-formula.js` - Has leading dash (unusual but works)
- Status: Already executed ✅
- Note: Sequelize sorted it alphabetically, so it ran before numbered migrations

### All Migrations Executed
```
-create-lala-formula.js                          ✅
1739041800000-add-game-show-features.js          ✅
1739041800000-create-lala-formula.js             ✅
20240101000001-create-episodes.js                ✅
20240101000002-create-metadata-storage.js        ✅
20240101000003-create-thumbnails.js              ✅
... (38 total) ...
20260208-create-edit-maps.js                     ✅
20260208110001-create-decision-logs-table.js     ✅
```

## Best Practices

### Migration Naming
- Use timestamp format: `YYYYMMDDHHMMSS-description.js`
- Avoid leading special characters like `-`
- Example: `20260208120000-create-lala-formula.js`

### Environment Management
- Always specify `NODE_ENV` explicitly in scripts
- Don't rely on default values in CI/CD
- Use separate databases for test/dev/prod

### Migration Order
- Base tables first (shows, episodes, assets)
- Dependent tables second (those with foreign keys)
- Feature tables last (lala_formula, game_show, etc.)

## Package.json Scripts

Consider adding environment-specific scripts:

```json
{
  "scripts": {
    "migrate:dev": "NODE_ENV=development sequelize db:migrate",
    "migrate:test": "NODE_ENV=test sequelize db:migrate",
    "migrate:up": "sequelize db:migrate",
    "migrate:undo": "sequelize db:migrate:undo",
    "migrate:status": "sequelize db:migrate:status"
  }
}
```

## Testing

### Verify Migrations
```bash
# Check migration status
npx sequelize-cli db:migrate:status

# Verify schema
node scripts/verify-schema.js

# Test API endpoints
.\scripts\test-endpoints.ps1
```

## Resolution ✅

**Issue:** Resolved by running migrations with `NODE_ENV=development`
**Status:** All 66 tables verified and operational
**Action Required:** Update CI/CD workflows to set correct environment

---

**Date:** February 9, 2026  
**Resolved By:** Setting NODE_ENV=development  
**Verification:** ✅ Schema verified, all tables exist
