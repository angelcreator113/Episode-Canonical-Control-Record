# Phase 3 Prerequisites & Setup Guide

**Date:** January 4, 2026  
**Status:** READY TO SETUP  
**Estimated Setup Time:** 2-3 hours

---

## Table of Contents

1. [AWS Account Setup](#aws-account-setup)
2. [Runway ML Setup](#runway-ml-setup)
3. [Local Environment Setup](#local-environment-setup)
4. [Environment Variables](#environment-variables)
5. [Database Setup](#database-setup)
6. [Verification Checklist](#verification-checklist)
7. [Troubleshooting](#troubleshooting)

---

## AWS Account Setup

### Prerequisites
- AWS Account (create at https://aws.amazon.com if you don't have one)
- Admin or IAM user access

### Step 1: Create S3 Bucket

1. **Go to AWS S3 Console:**
   - https://s3.console.aws.amazon.com/s3/

2. **Create new bucket:**
   - Click "Create bucket"
   - Bucket name: `episode-thumbnails-dev` (or your preference)
   - Region: `us-east-1` (or your closest region)
   - Block public access: **KEEP CHECKED** (we'll use signed URLs)
   - Click "Create bucket"

3. **Create folder structure:**
   - Click on your bucket
   - Create folder: `thumbnails/`
   - Inside that, create: `composite/` and `raw/`
   - Final structure:
     ```
     episode-thumbnails-dev/
     ├── thumbnails/
     │   ├── composite/    (final generated thumbnails)
     │   └── raw/          (original uploads)
     ```

### Step 2: Create IAM User for S3

1. **Go to IAM Console:**
   - https://console.aws.amazon.com/iam/

2. **Create new user:**
   - Click "Users" → "Create user"
   - Username: `episode-thumbnail-service`
   - Uncheck "AWS Management Console access" (API only)
   - Click "Next"

3. **Attach permissions:**
   - Click "Attach policies directly"
   - Create inline policy:
     - Policy name: `S3ThumbnailBucketPolicy`
     - Policy document:
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Effect": "Allow",
           "Action": [
             "s3:PutObject",
             "s3:GetObject",
             "s3:DeleteObject",
             "s3:ListBucket"
           ],
           "Resource": [
             "arn:aws:s3:::episode-thumbnails-dev",
             "arn:aws:s3:::episode-thumbnails-dev/*"
           ]
         }
       ]
     }
     ```
   - Click "Create policy"

4. **Generate access keys:**
   - Click on the new user
   - Go to "Security credentials" tab
   - Click "Create access key"
   - Use case: "Other"
   - Copy:
     - `AWS_ACCESS_KEY_ID`
     - `AWS_SECRET_ACCESS_KEY`
   - **Save these securely** - you won't see them again!

### Step 3: Get Bucket Details

1. **Bucket Name:** `episode-thumbnails-dev`
2. **Region:** `us-east-1` (or your chosen region)
3. **Keep these ready for `.env` file**

---

## Runway ML Setup

### Prerequisites
- Credit card (free tier available with $10 credit)
- Email for account

### Step 1: Create Runway Account

1. **Go to Runway:**
   - https://runwayml.com/

2. **Sign up:**
   - Click "Sign up"
   - Email/password or OAuth
   - Complete verification

3. **Create organization:**
   - Setup workspace name
   - Accept terms

### Step 2: Generate API Key

1. **Go to API settings:**
   - Click profile → "Settings"
   - Find "API Keys" or "Tokens"

2. **Create new API key:**
   - Click "Generate API Key"
   - Name: `Episode Thumbnail Generator`
   - Copy the key: `RUNWAY_ML_API_KEY`
   - **Save securely** - won't be shown again!

3. **Check credit:**
   - New accounts get ~$10 credit
   - Each background removal request costs ~$0.01
   - Estimate: 1000 requests = $10

### Step 3: Test API Access

1. **Test endpoint:**
   ```bash
   curl -H "Authorization: Bearer YOUR_RUNWAY_ML_API_KEY" \
     https://api.runwayml.com/v1/user
   ```

2. **Expected response:**
   ```json
   {
     "id": "user_...",
     "email": "your@email.com"
   }
   ```

---

## Local Environment Setup

### Step 1: Install Dependencies

```bash
# Navigate to project root
cd "c:\Users\12483\prime studios\BRD\Episode-Canonical-Control-Record"

# Install AWS SDK v3
npm install @aws-sdk/client-s3 @aws-sdk/lib-storage

# Install Sharp for image processing
npm install sharp

# Install JWT for authentication
npm install jsonwebtoken

# Install dotenv if not already installed
npm install dotenv
```

### Step 2: Verify Installations

```bash
# Check all packages installed
npm list @aws-sdk/client-s3 sharp jsonwebtoken dotenv

# Should show:
# ├── @aws-sdk/client-s3@3.x.x
# ├── sharp@0.x.x
# ├── jsonwebtoken@9.x.x
# └── dotenv@16.x.x
```

### Step 3: Setup Node Modules

```bash
# Clear cache
npm cache clean --force

# Reinstall all dependencies
npm install

# Verify Sharp builds correctly
npm rebuild sharp
```

**Note on Sharp:** If you get build errors on Windows:
```bash
# Install Windows build tools
npm install --global windows-build-tools

# Then rebuild
npm rebuild sharp
```

---

## Environment Variables

### Step 1: Create `.env` file

1. **Navigate to project root**
2. **Create `.env` file** (copy from `.env.example` if it exists):
   ```bash
   cp .env.example .env
   ```

### Step 2: Fill in AWS Credentials

```env
# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...  # From IAM user creation
AWS_SECRET_ACCESS_KEY=...  # From IAM user creation
AWS_S3_BUCKET=episode-thumbnails-dev
AWS_S3_THUMBNAIL_PREFIX=thumbnails/composite

# S3 Signed URL expiration (seconds)
AWS_S3_SIGNED_URL_EXPIRY=3600
```

### Step 3: Fill in Runway ML

```env
# Runway ML Configuration
RUNWAY_ML_API_KEY=...  # From Runway API settings
RUNWAY_ML_ENABLED=true
RUNWAY_ML_TIMEOUT=30000  # 30 seconds
```

### Step 4: Add JWT Secret

```env
# Authentication
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_EXPIRY=24h
```

**Generate JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy the output and paste into JWT_SECRET=...
```

### Step 5: Add Database Config

```env
# Database (when RDS is ready)
DB_HOST=your-rds-endpoint.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=episode_management
DB_USER=postgres
DB_PASSWORD=...
DB_SSL=true

# For now (development):
DB_HOST=localhost
DB_PORT=5432
DB_NAME=episode_management_dev
DB_USER=postgres
DB_PASSWORD=postgres
```

### Step 6: Full `.env` Example

```env
# ========== Environment ==========
NODE_ENV=development
PORT=3002
FRONTEND_URL=http://localhost:5173

# ========== AWS S3 ==========
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=episode-thumbnails-dev
AWS_S3_THUMBNAIL_PREFIX=thumbnails/composite
AWS_S3_SIGNED_URL_EXPIRY=3600

# ========== Runway ML ==========
RUNWAY_ML_API_KEY=...
RUNWAY_ML_ENABLED=true
RUNWAY_ML_TIMEOUT=30000

# ========== Authentication ==========
JWT_SECRET=...  # From crypto command above
JWT_EXPIRY=24h

# ========== Database ==========
DB_HOST=localhost
DB_PORT=5432
DB_NAME=episode_management_dev
DB_USER=postgres
DB_PASSWORD=postgres
DB_SSL=false

# ========== Image Processing ==========
IMAGE_MAX_SIZE=52428800  # 50MB
THUMBNAIL_QUALITY=85
THUMBNAIL_COMPRESSION=true
```

### Step 7: Secure Your `.env`

```bash
# Add to .gitignore (if not already there)
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
echo ".env.*.local" >> .gitignore

# Verify .env is in .gitignore
cat .gitignore | grep ".env"
```

---

## Database Setup

### Option A: PostgreSQL Local (Development)

```bash
# Install PostgreSQL if needed
# Windows: Download from https://www.postgresql.org/download/windows/
# macOS: brew install postgresql
# Linux: sudo apt-get install postgresql

# Start PostgreSQL service
# Windows: Services → Start PostgreSQL
# macOS: brew services start postgresql
# Linux: sudo service postgresql start

# Create database
psql -U postgres
```

Then in psql:
```sql
CREATE DATABASE episode_management_dev;
\c episode_management_dev
```

### Option B: PostgreSQL Docker

```bash
# Run PostgreSQL in Docker
docker run --name postgres-dev \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=episode_management_dev \
  -p 5432:5432 \
  -d postgres:15

# Verify
docker ps | grep postgres-dev
```

### Create Tables

```bash
# Run migrations
npm run migrate

# Or manually:
cd src/migrations
psql -U postgres -d episode_management_dev -f 001_create_tables.sql
```

---

## Verification Checklist

### ✅ AWS Setup
- [ ] S3 bucket created: `episode-thumbnails-dev`
- [ ] Folder structure: `thumbnails/composite/` and `thumbnails/raw/`
- [ ] IAM user created: `episode-thumbnail-service`
- [ ] Access keys generated and saved
- [ ] S3 policy attached to IAM user
- [ ] Test API call successful

### ✅ Runway ML Setup
- [ ] Runway account created
- [ ] API key generated
- [ ] Credit balance visible (should be ~$10)
- [ ] Test API call successful

### ✅ Local Setup
- [ ] All npm packages installed
- [ ] Sharp builds successfully
- [ ] `.env` file created
- [ ] All credentials filled in `.env`
- [ ] JWT_SECRET generated
- [ ] `.env` added to `.gitignore`

### ✅ Database Setup
- [ ] PostgreSQL running
- [ ] Database `episode_management_dev` created
- [ ] Tables created via migrations
- [ ] Connection test successful

### ✅ Code Verification
- [ ] Backend starts: `npm start`
- [ ] No environment variable errors
- [ ] Frontend starts: `cd frontend && npm run dev`
- [ ] Both ports accessible (3002 backend, 5173 frontend)

---

## Verification Tests

### Test 1: AWS S3 Connection

```bash
# Create test file: test-aws.js
cat > test-aws.js << 'EOF'
const { S3Client, ListObjectsV2Command } = require("@aws-sdk/client-s3");

const client = new S3Client({ region: process.env.AWS_REGION });

async function test() {
  const command = new ListObjectsV2Command({ 
    Bucket: process.env.AWS_S3_BUCKET 
  });
  try {
    const response = await client.send(command);
    console.log("✅ S3 Connection successful!");
    console.log("Bucket:", process.env.AWS_S3_BUCKET);
    console.log("Objects:", response.KeyCount || 0);
  } catch (error) {
    console.error("❌ S3 Connection failed:", error.message);
  }
}

test();
EOF

# Run test
node test-aws.js

# Expected output:
# ✅ S3 Connection successful!
# Bucket: episode-thumbnails-dev
# Objects: 0
```

### Test 2: Runway ML Connection

```bash
# Create test file: test-runway.js
cat > test-runway.js << 'EOF'
const fetch = require("node-fetch");

async function test() {
  try {
    const response = await fetch("https://api.runwayml.com/v1/user", {
      headers: {
        "Authorization": `Bearer ${process.env.RUNWAY_ML_API_KEY}`,
        "Content-Type": "application/json"
      }
    });
    const data = await response.json();
    if (response.ok) {
      console.log("✅ Runway ML Connection successful!");
      console.log("User:", data.email);
    } else {
      console.error("❌ Runway ML error:", data.message);
    }
  } catch (error) {
    console.error("❌ Connection failed:", error.message);
  }
}

test();
EOF

# Run test
node test-runway.js

# Expected output:
# ✅ Runway ML Connection successful!
# User: your@email.com
```

### Test 3: Database Connection

```bash
# Create test file: test-db.js
cat > test-db.js << 'EOF'
const { sequelize } = require("./src/config/database");

async function test() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connection successful!");
    console.log("Database:", process.env.DB_NAME);
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
  }
}

test();
EOF

# Run test
node test-db.js

# Expected output:
# ✅ Database connection successful!
# Database: episode_management_dev
```

---

## Troubleshooting

### Problem: "AWS credentials not found"
**Solution:**
```bash
# Verify .env file exists
ls -la .env

# Check environment variables
echo $AWS_ACCESS_KEY_ID

# If empty, reload .env
source .env

# Verify again
echo $AWS_ACCESS_KEY_ID
```

### Problem: "Sharp build failed on Windows"
**Solution:**
```bash
# Install build tools
npm install --global windows-build-tools

# Rebuild
npm rebuild sharp

# Or use pre-built binary
npm install --save sharp --build-from-source
```

### Problem: "S3 Access Denied"
**Solution:**
```bash
# Check IAM policy allows S3 actions
# Verify bucket name matches exactly
# Check region is correct
# Test with AWS CLI:
aws s3 ls s3://episode-thumbnails-dev --region us-east-1
```

### Problem: "Runway ML API key invalid"
**Solution:**
```bash
# Verify key format (should start with "bearer_")
echo $RUNWAY_ML_API_KEY

# Test with curl
curl -H "Authorization: Bearer $RUNWAY_ML_API_KEY" \
  https://api.runwayml.com/v1/user

# Check Runway dashboard for key
```

### Problem: "Port 3002 already in use"
**Solution:**
```bash
# Windows:
netstat -ano | findstr :3002
taskkill /PID <PID> /F

# macOS/Linux:
lsof -ti:3002 | xargs kill -9
```

---

## Next Steps

Once all prerequisites are verified ✅:

1. **Start Backend:**
   ```bash
   npm start
   # Should show: "listening on port 3002"
   ```

2. **Start Frontend:**
   ```bash
   cd frontend
   npm run dev
   # Should show: "http://localhost:5173"
   ```

3. **Verify Both Running:**
   - Backend: http://localhost:3002/health
   - Frontend: http://localhost:5173

4. **Ready for Phase 3:**
   - Task 1: Authentication Implementation
   - Task 2: Sharp Integration
   - Task 3: Runway ML Integration

---

## Support

If you encounter issues:

1. **Check logs:** `npm start 2>&1 | tee startup.log`
2. **Verify all `.env` variables are set**
3. **Run verification tests** from "Verification Tests" section
4. **Check AWS/Runway dashboards** for limits/errors

**You're now ready for Phase 3 implementation!** 🚀

---

**Completed by:** GitHub Copilot  
**Date:** January 4, 2026  
**Next Phase:** Authentication Implementation
