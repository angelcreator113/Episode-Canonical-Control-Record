# MIGRATION EXECUTION - NETWORK ISSUE & SOLUTIONS

## Current Issue
The local Windows machine cannot resolve AWS RDS DNS names (ENOTFOUND error). This is a network configuration issue where the local DNS cannot reach AWS Route53 nameservers.

### Diagnostic Output
```
Testing connection to episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com:5432
Error: getaddrinfo ENOTFOUND episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com
nslookup: No internal type for both IPv4 and IPv6 Addresses (A+AAAA) records
```

### Infrastructure Status
- ✅ RDS: Available (episode-control-dev - AVAILABLE)
- ✅ Security Group: Updated to allow 0.0.0.0/0 on port 5432
- ✅ VPC DNS: Enabled (dns-hostnames, dns-support)
- ✅ Migrations: Ready (5 files in src/migrations/)
- ✅ Dependencies: Installed (sequelize, node-pg-migrate)
- ✅ Configuration: Complete (.env with endpoint)

**Network Blocker:**
Local DNS resolution not working → Need alternative approach

---

## Solution Options

### Option 1: Use AWS CloudShell (RECOMMENDED - Fastest)
AWS CloudShell runs in your AWS account with full access to RDS.

**Steps:**
1. Go to AWS Console → CloudShell (top navigation bar)
2. Run these commands in CloudShell:

```bash
# Clone repository (or download files)
git clone https://github.com/angelcreator113/Episode-Canonical-Control-Record.git
cd Episode-Canonical-Control-Record

# Install dependencies
npm install

# Run migrations
node migrate.js
```

**Expected Output:**
```
✓ Database connection successful
✓ All migrations completed successfully!
```

**Why This Works:**
- CloudShell runs IN AWS
- No DNS resolution needed (same network as RDS)
- Instant execution (30 seconds)
- No EC2 instances to manage

---

### Option 2: Create EC2 Instance in VPC
Launch an EC2 instance in the same VPC as RDS and run migrations from there.

**Steps:**
1. Launch EC2 instance (t3.micro, Amazon Linux 2) in the VPC
2. SSH into instance
3. Install Node.js: `sudo amazon-linux-extras install nodejs12 -y`
4. Clone repo and run migrations
5. Terminate instance

**Time:** ~5 minutes

---

### Option 3: Fix Local DNS (Advanced)
Use AWS-specific DNS servers or VPN access.

**Option 3a - Change Windows DNS:**
1. Settings → Network & Internet → Change adapter options
2. Right-click → Properties → IPv4 Properties
3. Use DNS servers:
   - Preferred: 1.1.1.1 (Cloudflare)
   - Alternate: 8.8.8.8 (Google)
4. Retry connection

**Option 3b - Use AWS Client VPN:**
Set up Client VPN to access RDS directly.

---

### Option 4: RDS Proxy / Bastion Host
Set up a Bastion host or RDS Proxy for external access.

**Time:** ~15-20 minutes

---

## RECOMMENDED PATH: CloudShell

**Why:**
- ✅ Works immediately (RDS already available)
- ✅ Fastest execution (~1 minute total)
- ✅ No additional infrastructure
- ✅ No local network configuration needed
- ✅ Secure (within AWS)

**Actions Required:**
1. Open AWS Console
2. Click CloudShell icon (top right)
3. Run migration commands

**Expected Timeline:**
- CloudShell startup: ~30 seconds
- Git clone: ~10 seconds
- npm install: ~30 seconds
- Migrations: ~10 seconds
- **Total: ~2 minutes**

---

## Immediate Next Steps

### To Execute Via CloudShell:
1. Go to AWS Console (https://console.aws.amazon.com)
2. Click the `>_` icon (CloudShell) in the top navigation
3. Run:
   ```bash
   git clone https://github.com/angelcreator113/Episode-Canonical-Control-Record.git
   cd Episode-Canonical-Control-Record
   npm install
   npm run migrate
   ```

### To Verify Migration Success:
```bash
# Connect to RDS and verify tables
psql -h episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com \
     -U postgres -d episode_metadata \
     -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public';"
```

Expected output:
```
     table_name     
-------------------
 episodes
 metadata_storage
 thumbnails
 processing_queue
 activity_logs
```

---

## Configuration Currently In Place

### .env (Complete)
```
DB_HOST=episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=episode_metadata
DB_USER=postgres
DB_PASSWORD=EpisodeControl2024!Dev
NODE_ENV=development
```

### RDS Status
- Instance: AVAILABLE
- Endpoint: episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com:5432
- Database: episode_metadata
- Security: 0.0.0.0/0:5432 allowed

### Migrations Ready
- Location: src/migrations/
- Count: 5 files
- Status: Ready to execute
- Tables to create:
  1. episodes
  2. metadata_storage
  3. thumbnails
  4. processing_queue
  5. activity_logs

---

## Once Migrations Complete

### 1. Verify Schema
```bash
psql -h episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com \
     -U postgres -d episode_metadata \
     -c "\dt"
```

### 2. Update Tests
Tests can now connect to real PostgreSQL:
```bash
npm test
```

### 3. Phase 1E Validation
Run 400+ tests against real database.

### 4. Proceed to Phase 1F
API documentation and performance optimization.

---

## Files Ready for Use

- ✅ [migrate.js](./migrate.js) - Migration runner
- ✅ [test-connection.js](./test-connection.js) - Connection validator
- ✅ [verify-database.ps1](./verify-database.ps1) - Schema verifier
- ✅ [RDS_READY_FOR_MIGRATIONS.md](./RDS_READY_FOR_MIGRATIONS.md) - Setup guide

---

## Support

If CloudShell approach doesn't work:
1. Check RDS is AVAILABLE: `aws rds describe-db-instances --db-instance-identifier episode-control-dev --region us-east-1`
2. Verify credentials in .env match RDS password
3. Check security group allows 0.0.0.0/0:5432
4. Try Option 2 (EC2 instance) if CloudShell unavailable

---

**Status:** Ready for migration execution via CloudShell or alternative method.
**Timeline to Phase 1A Complete:** 2-5 minutes after migrations execute.
**Next Review:** After migrations complete successfully.
