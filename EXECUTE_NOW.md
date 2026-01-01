# CLOUDSHELL EXECUTION - QUICK START

## ✅ ZIP File Ready
- **File:** `episode-project.zip` (38 MB)
- **Location:** `C:\Users\12483\prime studios\BRD\`
- **Status:** Ready to upload

---

## 🚀 Execute These Steps in CloudShell

### Step 1: Open CloudShell (30 seconds)
1. Go to: https://console.aws.amazon.com
2. Click `>_` icon (top right, before your account name)
3. Wait for CloudShell prompt to appear

### Step 2: Upload ZIP File (1 minute)
1. Click "Actions" button (top toolbar)
2. Select "Upload file"
3. Browse to: `C:\Users\12483\prime studios\BRD\episode-project.zip`
4. Click "Upload"
5. Wait for completion message

### Step 3: Run Migrations (2 minutes)
Copy and paste these commands into CloudShell:

```bash
unzip episode-project.zip
cd Episode-Canonical-Control-Record
npm install
npm run migrate
```

**Expected Output:**
```
✓ Database connection successful
✓ All migrations completed successfully!
```

---

## 📊 Tables Created
Once migrations complete, 5 PostgreSQL tables will exist:

| Table | Purpose |
|-------|---------|
| episodes | Core episode metadata |
| metadata_storage | Episode storage details |
| thumbnails | Generated thumbnail records |
| processing_queue | Background job queue |
| activity_logs | Audit trail |

---

## ✅ Verify Migrations (Optional)

After migrations complete, run this in CloudShell to verify:

```bash
psql -h episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com \
     -U postgres -d episode_metadata \
     -c "\dt"
```

**Expected Output:**
```
                  List of relations
 Schema |        Name         | Type  |  Owner   
--------+---------------------+-------+----------
 public | activity_logs       | table | postgres
 public | episodes            | table | postgres
 public | metadata_storage    | table | postgres
 public | processing_queue    | table | postgres
 public | thumbnails          | table | postgres
(5 rows)
```

---

## 📋 Credentials (Already in .env inside ZIP)

```
Database: episode_metadata
User: postgres
Password: EpisodeControl2024!Dev
Host: episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com
Port: 5432
```

---

## ⏱️ Total Time: ~3-4 Minutes

| Step | Duration |
|------|----------|
| Open CloudShell | 30 sec |
| Upload ZIP | 1 min |
| Extract ZIP | 10 sec |
| npm install | 1 min |
| Run migrations | 30 sec |
| Verify | 30 sec |
| **TOTAL** | **~3.5 min** |

---

## ✅ After CloudShell

Once migrations complete in CloudShell:

1. **Return to local machine**
2. **Run:** `npm test`
   - Validates 400+ test cases
   - Tests connect to real PostgreSQL
   - Completes Phase 1E
3. **Phase 1 Complete!** ✅

---

## ⚠️ Troubleshooting

### If ZIP upload fails:
- Try uploading in smaller chunks
- Alternative: Manually recreate files in CloudShell

### If npm install fails:
```bash
npm --version  # Verify npm is installed
node --version  # Should be v14+
```

### If migrations fail:
```bash
# Check RDS is still available
aws rds describe-db-instances \
  --db-instance-identifier episode-control-dev \
  --region us-east-1
```

---

## 🎯 Status Summary

| Item | Status |
|------|--------|
| RDS Instance | ✅ AVAILABLE |
| Security Groups | ✅ Configured |
| VPC DNS | ✅ Enabled |
| ZIP File | ✅ Ready (38 MB) |
| Migrations | ✅ 5 files ready |
| Configuration | ✅ .env complete |
| **Ready to Execute** | **✅ YES** |

---

**Commands to Copy/Paste into CloudShell:**

```bash
unzip episode-project.zip && cd Episode-Canonical-Control-Record && npm install && npm run migrate
```

Or separately:
```bash
unzip episode-project.zip
cd Episode-Canonical-Control-Record
npm install
npm run migrate
```

---

Let me know when migrations complete! Then we'll run the test suite against the real database.
