# Database Setup Scripts

## 📚 Overview

Scripts to set up and verify databases across all environments (dev, staging, production).

## 🚀 Quick Start

### 1. Verify All Database Connections
```powershell
.\verify-databases.ps1
```

### 2. Set Up All Databases
```powershell
.\setup-databases.ps1 -Environment all -SeedData
```

### 3. Test Individual Environment
```powershell
# Test connection
$env:NODE_ENV="development"
npm run db:test

# Run migrations
npm run db:setup:dev
```

## 📋 Scripts

### `setup-databases.ps1`
**Purpose:** Set up and configure databases with migrations and optional seed data

**Usage:**
```powershell
# Set up dev environment
.\setup-databases.ps1 -Environment dev -SeedData

# Set up staging environment
.\setup-databases.ps1 -Environment staging -SeedData

# Set up production (no seed data)
.\setup-databases.ps1 -Environment production

# Set up all environments
.\setup-databases.ps1 -Environment all

# Skip migrations (only seed)
.\setup-databases.ps1 -Environment dev -SkipMigrations -SeedData

# Verify schema after setup
.\setup-databases.ps1 -Environment staging -Verify
```

**Parameters:**
- `-Environment <dev|staging|production|all>` - Which environment(s) to set up
- `-SkipMigrations` - Skip running database migrations
- `-SeedData` - Seed database with test data (skipped for production)
- `-Verify` - Verify database schema after setup

### `verify-databases.ps1`
**Purpose:** Verify database connections without making changes

**Usage:**
```powershell
# Verify all databases
.\verify-databases.ps1

# Verify specific environment
.\verify-databases.ps1 -Environment dev
```

**Output:**
- Database host, port, name, user
- SSL status
- Connection test result
- Summary of all environments

### `db-test-connection.js`
**Purpose:** Node.js script to test database connection and show details

**Usage:**
```bash
# Test current environment
npm run db:test

# Test specific environment
cross-env NODE_ENV=staging npm run db:test
```

**Output:**
- PostgreSQL version
- Database name and size
- List of tables
- Record counts for main tables

## 🔧 NPM Scripts

Added to `package.json`:

```json
"db:test": "node db-test-connection.js",
"db:setup:dev": "cross-env NODE_ENV=development node-pg-migrate up",
"db:setup:staging": "cross-env NODE_ENV=staging node-pg-migrate up",
"db:setup:production": "cross-env NODE_ENV=production node-pg-migrate up"
```

## 📝 Prerequisites

### Required Environment Variables

Each environment needs these variables set in their respective `.env` files:

**Development (`.env.development`):**
```env
DATABASE_URL=postgresql://user:password@dev-rds-host:5432/episode_metadata?sslmode=require
DB_HOST=dev-rds-host.rds.amazonaws.com
DB_PORT=5432
DB_NAME=episode_metadata
DB_USER=postgres
DB_PASSWORD=your-password
DATABASE_SSL=true
```

**Staging (`.env.staging`):**
```env
DATABASE_URL=postgresql://user:password@staging-rds-host:5432/episode_metadata?sslmode=require
DB_HOST=staging-rds-host.rds.amazonaws.com
DB_PORT=5432
DB_NAME=episode_metadata
DB_USER=${DB_USER_STAGING}
DB_PASSWORD=${DB_PASSWORD_STAGING}
DATABASE_SSL=true
```

**Production (`.env.production`):**
```env
DATABASE_URL=postgresql://user:password@prod-rds-host:5432/episode_metadata?sslmode=require
DB_HOST=prod-rds-host.rds.amazonaws.com
DB_PORT=5432
DB_NAME=episode_metadata
DB_USER=${DB_USER_PROD}
DB_PASSWORD=${DB_PASSWORD_PROD}
DATABASE_SSL=true
```

### AWS RDS Setup

Each environment should have its own RDS instance:

1. **Development RDS**
   - Instance: `db.t3.micro` or `db.t3.small`
   - Storage: 20-50 GB
   - Multi-AZ: No
   - Backups: 1 day retention

2. **Staging RDS**
   - Instance: `db.t3.small` or `db.t3.medium`
   - Storage: 50-100 GB
   - Multi-AZ: Optional
   - Backups: 7 day retention

3. **Production RDS**
   - Instance: `db.t3.medium` or larger
   - Storage: 100+ GB
   - Multi-AZ: **Yes** (recommended)
   - Backups: 30 day retention
   - Encryption: **Enabled**

### Security Group Rules

Allow PostgreSQL access (port 5432) from:
- Your local IP (for dev work)
- GitHub Actions runners (for CI/CD)
- Application servers (ECS, Lambda, etc.)

## 🔄 Typical Workflow

### Initial Setup (First Time)

```powershell
# 1. Verify all RDS instances are accessible
.\verify-databases.ps1

# 2. Set up dev with test data
.\setup-databases.ps1 -Environment dev -SeedData

# 3. Set up staging with test data
.\setup-databases.ps1 -Environment staging -SeedData

# 4. Set up production (empty)
.\setup-databases.ps1 -Environment production
```

### Adding New Migration

```powershell
# 1. Create migration
npm run migrate:create add-new-table

# 2. Edit migration file in src/migrations/

# 3. Test on dev
npm run db:setup:dev

# 4. Verify
npm run db:test

# 5. Push to staging
git push origin staging
# GitHub Actions will run migrations

# 6. After QA, push to production
git push origin main
# GitHub Actions will run migrations
```

### Database Refresh

```powershell
# Refresh dev database with latest migrations
.\setup-databases.ps1 -Environment dev -SeedData -Verify

# Refresh staging (no seed data)
.\setup-databases.ps1 -Environment staging -Verify
```

## 🆘 Troubleshooting

### Connection Timeouts

1. Check security group allows your IP
2. Verify RDS instance is running
3. Check VPC settings if RDS is in private subnet
4. Use VPN if required

### Authentication Failed

1. Verify credentials in `.env` file
2. Check user exists in database
3. Verify password is correct
4. Check SSL/TLS settings

### Migration Failures

1. Check database has sufficient permissions
2. Verify migration file syntax
3. Check for conflicting migrations
4. Review migration logs

### Missing Tables

1. Run migrations: `npm run db:setup:dev`
2. Check migration status
3. Verify migration files are correct

## 📞 Support

For issues:
1. Check logs: `.\setup-databases.ps1 -Environment dev -Verify`
2. Test connection: `npm run db:test`
3. Review AWS RDS console
4. Check application logs

## 🔐 Security Notes

- **Never commit** `.env.production` file
- Use AWS Secrets Manager for production credentials
- Rotate passwords regularly
- Enable encryption at rest
- Use IAM authentication when possible
- Monitor database access logs
