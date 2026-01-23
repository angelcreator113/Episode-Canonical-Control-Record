# Migration Testing Guide

## Why Test Migrations Locally?

Testing migrations before deploying prevents:
- ❌ Failed deployments due to SQL errors
- ❌ Data type mismatches (like integer vs uuid)
- ❌ Missing table references
- ❌ Index creation errors
- ❌ Constraint violations

## Setup Options

### Option 1: Docker (Recommended)

**Pros:** Isolated, clean database every time, matches production environment

```bash
# Start test database
docker-compose -f docker-compose.test.yml up -d

# Test migrations
node test-migrations-local.js

# Stop test database
docker-compose -f docker-compose.test.yml down
```

### Option 2: Local PostgreSQL

**Pros:** Faster, no Docker required

**Requirements:**
- PostgreSQL 15 installed locally
- User: postgres, Password: postgres (or update test-migrations-local.js)

```bash
# Test migrations
node test-migrations-local.js
```

### Option 3: GitHub Actions (Automatic)

**Pros:** Tests automatically on every push/PR

Migrations are automatically tested when you:
- Push to dev branch
- Create a pull request
- Modify any migration file

Check: https://github.com/angelcreator113/Episode-Canonical-Control-Record/actions

---

## Workflow: Testing Before Deployment

### 1. Create Migration

```bash
# Create new migration file
npm run migrate:create my-migration-name
```

### 2. Write Migration

Edit the generated file in `migrations/` folder

### 3. Test Locally

```bash
# Option A: Using test script (recommended)
node test-migrations-local.js

# Option B: Direct migration run
npm run migrate:up
```

### 4. Fix Any Errors

Common issues:
- Wrong data types (integer vs uuid)
- Missing table references
- Column name typos
- Missing indexes

### 5. Deploy

```bash
git add migrations/
git commit -m "Add migration: description"
git push origin dev
```

---

## Common Migration Errors

### Error: Foreign key constraint cannot be implemented

**Cause:** Data type mismatch

```javascript
// ❌ Wrong - shows.id is uuid
show_id: {
  type: 'integer',
  references: 'shows',
}

// ✅ Correct
show_id: {
  type: 'uuid',
  references: 'shows',
}
```

### Error: Relation does not exist

**Cause:** Table hasn't been created yet

```javascript
// ✅ Solution: Check if table exists first
pgm.sql(`
  DO $$ 
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wardrobe') THEN
      ALTER TABLE wardrobe ADD COLUMN library_item_id integer;
    END IF;
  END $$;
`);
```

### Error: Column already exists

**Cause:** Migration ran multiple times

```javascript
// ✅ Solution: Use IF NOT EXISTS
pgm.sql(`
  ALTER TABLE episodes ADD COLUMN IF NOT EXISTS show_id uuid;
`);
```

---

## Migration Best Practices

### 1. Always Test Locally First

```bash
# Before every commit
node test-migrations-local.js
```

### 2. Use Transactions

Migrations automatically run in transactions, but be careful with:
- Multiple ALTER TABLE statements
- Large data migrations
- Index creation on large tables

### 3. Make Migrations Idempotent

Use `IF NOT EXISTS` and `IF EXISTS` checks so migrations can be safely re-run.

### 4. Keep Migrations Small

One logical change per migration file:
- ✅ Good: `add-show-id-to-episodes.js`
- ❌ Bad: `add-all-new-features.js`

### 5. Test Rollback

```bash
npm run migrate:down
npm run migrate:up
```

### 6. Document Complex Migrations

Add comments explaining:
- Why the change is needed
- What data is affected
- Any manual steps required

---

## Troubleshooting

### Docker not working?

```bash
# Check Docker is running
docker --version

# View database logs
docker-compose -f docker-compose.test.yml logs postgres-test
```

### PostgreSQL not installed locally?

**Option 1:** Install PostgreSQL
- Windows: https://www.postgresql.org/download/windows/
- Mac: `brew install postgresql@15`
- Linux: `sudo apt-get install postgresql-15`

**Option 2:** Use Docker instead

### Migrations still failing in CI?

Check GitHub Actions logs:
1. Go to https://github.com/angelcreator113/Episode-Canonical-Control-Record/actions
2. Click on failed workflow
3. Expand "Test migrations" step
4. Review error message

---

## Quick Reference

```bash
# Test migrations locally
node test-migrations-local.js

# Run migrations manually
npm run migrate:up

# Rollback last migration
npm run migrate:down

# Create new migration
npm run migrate:create my-migration

# Start test database (Docker)
docker-compose -f docker-compose.test.yml up -d

# Stop test database (Docker)
docker-compose -f docker-compose.test.yml down

# View migration status
npm run migrate:status
```

---

## Next Steps

1. ✅ Set up local testing (Option 1 or 2)
2. ✅ Test existing migrations
3. ✅ Create pre-commit hook (optional)
4. ✅ Document team workflow

**Remember:** Always test locally before pushing! 🚀
