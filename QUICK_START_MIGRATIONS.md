# Quick Start: Test Migrations with Docker

**No PostgreSQL installation required!**

## Step 1: Start Test Database

```powershell
docker-compose -f docker-compose.test.yml up -d
```

This starts PostgreSQL in Docker on port 5433.

## Step 2: Test Migrations

```powershell
node test-migrations-local.js
```

## Step 3: Stop Database (when done)

```powershell
docker-compose -f docker-compose.test.yml down
```

---

## Troubleshooting

### "Docker not found"

Install Docker Desktop:
- Download: https://www.docker.com/products/docker-desktop/
- Install and restart computer
- Verify: `docker --version`

### "Port already in use"

Your local PostgreSQL is using port 5432. The Docker setup uses 5433 to avoid conflicts.

### "Password authentication failed"

Use Docker method above - it's pre-configured and doesn't require local PostgreSQL setup.

---

## Alternative: Use GitHub Actions

Don't want to set up Docker? Just push to dev and migrations will be tested automatically:

1. Make migration changes
2. Commit: `git add migrations/ && git commit -m "Update migrations"`
3. Push: `git push`
4. Check: https://github.com/angelcreator113/Episode-Canonical-Control-Record/actions

Migrations will be tested before deployment!
