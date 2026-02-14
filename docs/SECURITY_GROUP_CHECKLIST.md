# AWS RDS Security Group Configuration Checklist

## Current Status

### Development Database ✅
- **RDS Instance:** episode-control-dev
- **Security Group:** sg-002578912805d1930 (episode-metadata-db-sg-dev)
- **Status:** ✅ IP 108.216.160.136/32 whitelisted
- **Connection:** ✅ Working

### Staging Database ⏳
- **RDS Instance:** episode-prod-db
- **Security Group:** sg-0ba79cea46f35188f (episode-metadata-rds-staging)
- **Status:** ⏳ Needs IP whitelisting
- **Action Required:**
  1. Go to AWS Console → EC2 → Security Groups
  2. Select sg-0ba79cea46f35188f
  3. Edit inbound rules
  4. Add: Type=PostgreSQL, Port=5432, Source=108.216.160.136/32
  5. Save rules

### Production Database ⏳
- **RDS Instance:** episode-control-prod
- **Security Group:** sg-0164d0b20fbebacbb (episode-metadata-db-sg-prod)
- **Status:** ⏳ Needs IP whitelisting
- **Action Required:**
  1. Go to AWS Console → EC2 → Security Groups
  2. Select sg-0164d0b20fbebacbb
  3. Edit inbound rules
  4. Add: Type=PostgreSQL, Port=5432, Source=108.216.160.136/32
  5. Save rules
  6. ⚠️ **IMPORTANT:** Remove 0.0.0.0/0 rule if it exists (security risk)

## Quick Links
- [AWS RDS Console](https://console.aws.amazon.com/rds/)
- [AWS Security Groups](https://console.aws.amazon.com/ec2/#SecurityGroups)

## Test Command
After updating security groups, run:
```powershell
node test-all-databases.js
```

## RDS Credentials
- **Master Username:** postgres
- **Master Password:** Ayanna123!!
- **Database Name:** episode_metadata

## Optional: Rename Staging Database
To rename `episode-prod-db` to `episode-control-staging`:
```powershell
.\rename-rds-instance.ps1
```
