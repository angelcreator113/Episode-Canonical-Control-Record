# AWS Infrastructure Setup Guide - Episode Metadata API

**Region:** us-east-1  
**Last Updated:** January 5, 2026

---

## 📋 Phased Infrastructure Approach

```
PHASE 1 (NOW - Weeks 1-4): Local Development ✅
├─ Docker PostgreSQL (what you have)
├─ LocalStack S3 (fake S3 locally)
├─ Build all features
├─ Cost: $0/month
└─ Fast iteration

PHASE 2 (Weeks 5-6): AWS Staging Setup
├─ RDS PostgreSQL (staging)
├─ Real S3 buckets
├─ Deploy to AWS (staging environment)
├─ Test with real cloud services
├─ Cost: ~$30-50/month
└─ Validate everything works

PHASE 3 (Weeks 7-8): AWS Production
├─ Production environment (separate from staging)
├─ Auto-scaling setup
├─ CloudFront CDN
├─ Monitoring & alerts
├─ Cost: $100-200/month
└─ Ready for users

PHASE 4 (Ongoing): Scale & Optimize
├─ Add more features
├─ Scale based on usage
├─ Optimize costs
├─ Cost: $100-500/month (scales with users)
└─ Continuous improvement
```

---

# PHASE 1: Local Development Setup

## 🎯 Objective

Run Episode Metadata API locally with:
- **Database:** Docker PostgreSQL (already working ✅)
- **Object Storage:** LocalStack S3 (local fake S3)
- **Costs:** $0/month
- **Benefits:** Fast iteration, no cloud bills, everything offline

---

## Part 1: LocalStack Setup

LocalStack simulates AWS services locally. Perfect for development.

### Step 1: Update docker-compose.yml

Add LocalStack service to your existing docker-compose.yml:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: episode-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: episode_metadata
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  localstack:
    image: localstack/localstack:latest
    container_name: episode-localstack
    ports:
      - "4566:4566"  # LocalStack main endpoint
      - "4571:4571"  # S3 endpoint
    environment:
      - SERVICES=s3,sqs,sns
      - DEBUG=1
      - DATA_DIR=/tmp/localstack/data
      - DOCKER_HOST=unix:///var/run/docker.sock
      - AWS_DEFAULT_REGION=us-east-1
      - AWS_ACCESS_KEY_ID=test
      - AWS_SECRET_ACCESS_KEY=test
    volumes:
      - "${TMPDIR:-.}/.localstack:/tmp/localstack"
      - "/var/run/docker.sock:/var/run/docker.sock"
    healthcheck:
      test: ["CMD", "awslocal", "s3", "ls"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

### Step 2: Start LocalStack

```bash
# Start both PostgreSQL and LocalStack
docker-compose up -d

# Verify they're running
docker-compose ps
```

Expected output:
```
NAME                COMMAND                  STATUS
episode-postgres    "docker-entrypoint.s…"   Up (healthy)
episode-localstack  "docker-entrypoint.sh"   Up (healthy)
```

### Step 3: Verify LocalStack is Ready

```bash
# Test S3 connectivity
curl -X GET http://localhost:4566/
# Should return: running

# List buckets (should be empty)
curl -X GET http://localhost:4566/
```

---

## Part 2: Configure Application for LocalStack

### Step 1: Create .env.local for Development

```env
# Server
NODE_ENV=development
PORT=3002
HOST=localhost

# Database (Local Docker PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=episode_metadata
DB_USER=postgres
DB_PASSWORD=postgres

# JWT (Development secrets)
JWT_SECRET=dev-secret-key-minimum-32-characters-long-1234567890
JWT_EXPIRY=1h
JWT_REFRESH_EXPIRY=7d

# AWS Configuration (LocalStack)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test

# LocalStack Endpoints (Critical!)
AWS_S3_ENDPOINT=http://localhost:4566
AWS_SQS_ENDPOINT=http://localhost:4566
AWS_SNS_ENDPOINT=http://localhost:4566

# S3 Buckets (LocalStack)
S3_BUCKET_EPISODES=brd-episodes-dev
S3_BUCKET_THUMBNAILS=brd-thumbnails-dev
S3_BUCKET_TEMP=brd-temp-dev

# Feature Flags
FEATURE_S3_UPLOADS_ENABLED=true
FEATURE_SEARCH_ENABLED=false  # Set to true when OpenSearch is ready

# Logging
LOG_LEVEL=debug
```

### Step 2: Create LocalStack Initialization Script

Save as `scripts/init-localstack.sh`:

```bash
#!/bin/bash

# Initialize LocalStack S3 buckets for development

ENDPOINT_URL="http://localhost:4566"
REGION="us-east-1"

echo "🔧 Initializing LocalStack for Episode Metadata API..."
echo "Endpoint: $ENDPOINT_URL"
echo "Region: $REGION"

# Function to create bucket
create_bucket() {
  local bucket_name=$1
  echo "📦 Creating bucket: $bucket_name"
  
  aws s3 mb "s3://$bucket_name" \
    --endpoint-url "$ENDPOINT_URL" \
    --region "$REGION" || echo "⚠️  Bucket may already exist"
  
  echo "✓ Bucket ready: $bucket_name"
}

# Create development buckets
create_bucket "brd-episodes-dev"
create_bucket "brd-thumbnails-dev"
create_bucket "brd-temp-dev"

# Create SQS queue (optional)
echo "📬 Creating SQS queue..."
aws sqs create-queue \
  --queue-name brd-job-queue-dev \
  --endpoint-url "$ENDPOINT_URL" \
  --region "$REGION" || echo "⚠️  Queue may already exist"

echo "✅ LocalStack initialization complete!"
echo ""
echo "Buckets ready:"
aws s3 ls --endpoint-url "$ENDPOINT_URL" --region "$REGION"
```

### Step 3: Make Script Executable and Run

```bash
chmod +x scripts/init-localstack.sh
./scripts/init-localstack.sh
```

Or on Windows (PowerShell):

```powershell
# Create PowerShell version: scripts/init-localstack.ps1

$endpointUrl = "http://localhost:4566"
$region = "us-east-1"

Write-Host "🔧 Initializing LocalStack for Episode Metadata API..." -ForegroundColor Cyan

# Set AWS credentials for LocalStack
$env:AWS_ACCESS_KEY_ID = "test"
$env:AWS_SECRET_ACCESS_KEY = "test"
$env:AWS_DEFAULT_REGION = $region

# Create buckets
$buckets = @("brd-episodes-dev", "brd-thumbnails-dev", "brd-temp-dev")

foreach ($bucket in $buckets) {
    Write-Host "📦 Creating bucket: $bucket"
    aws s3 mb "s3://$bucket" --endpoint-url $endpointUrl --region $region 2>&1 | Out-Null
    Write-Host "✓ Bucket ready: $bucket" -ForegroundColor Green
}

# Create SQS queue
Write-Host "📬 Creating SQS queue..."
aws sqs create-queue --queue-name brd-job-queue-dev --endpoint-url $endpointUrl --region $region 2>&1 | Out-Null

Write-Host "✅ LocalStack initialization complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Buckets ready:" -ForegroundColor Cyan
aws s3 ls --endpoint-url $endpointUrl --region $region
```

---

## Part 3: Update Application Code

### Step 1: Configure AWS SDK for LocalStack

Update [src/config/aws.js](src/config/aws.js):

```javascript
const AWS = require('aws-sdk');

const isDevelopment = process.env.NODE_ENV === 'development';
const isLocalStack = isDevelopment && process.env.AWS_S3_ENDPOINT;

// Configure AWS SDK
const config = {
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
};

// For LocalStack: point to local endpoint
if (isLocalStack) {
  config.s3 = {
    endpoint: process.env.AWS_S3_ENDPOINT,
    s3ForcePathStyle: true,
    signatureVersion: 'v4',
  };
  
  config.sqs = {
    endpoint: process.env.AWS_SQS_ENDPOINT,
  };
  
  config.sns = {
    endpoint: process.env.AWS_SNS_ENDPOINT,
  };
}

AWS.config.update(config);

module.exports = {
  s3: new AWS.S3({ ...config.s3 }),
  sqs: new AWS.SQS({ ...config.sqs }),
  sns: new AWS.SNS({ ...config.sns }),
};
```

### Step 2: Add S3 Upload Helpers

Create [src/services/s3Service.js](src/services/s3Service.js):

```javascript
const AWS = require('aws-sdk');
const config = require('../config/aws');

class S3Service {
  constructor() {
    this.s3 = config.s3;
    this.bucket = process.env.S3_BUCKET_EPISODES || 'brd-episodes-dev';
  }

  /**
   * Upload file to S3
   * @param {Buffer} fileBuffer - File content
   * @param {string} fileName - File name
   * @param {string} contentType - MIME type
   * @returns {Promise<{url: string, key: string}>}
   */
  async uploadFile(fileBuffer, fileName, contentType = 'application/octet-stream') {
    const key = `episodes/${Date.now()}-${fileName}`;
    
    const params = {
      Bucket: this.bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      ACL: 'private',
      Metadata: {
        'uploaded-at': new Date().toISOString(),
      },
    };

    try {
      const result = await this.s3.upload(params).promise();
      return {
        url: result.Location,
        key: result.Key,
        eTag: result.ETag,
      };
    } catch (error) {
      console.error('S3 upload error:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Download file from S3
   * @param {string} key - S3 object key
   * @returns {Promise<Buffer>}
   */
  async downloadFile(key) {
    const params = {
      Bucket: this.bucket,
      Key: key,
    };

    try {
      const result = await this.s3.getObject(params).promise();
      return result.Body;
    } catch (error) {
      console.error('S3 download error:', error);
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }

  /**
   * Delete file from S3
   * @param {string} key - S3 object key
   */
  async deleteFile(key) {
    const params = {
      Bucket: this.bucket,
      Key: key,
    };

    try {
      await this.s3.deleteObject(params).promise();
      return true;
    } catch (error) {
      console.error('S3 delete error:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * List files in S3
   * @param {string} prefix - Folder prefix
   * @returns {Promise<Array>}
   */
  async listFiles(prefix = 'episodes/') {
    const params = {
      Bucket: this.bucket,
      Prefix: prefix,
    };

    try {
      const result = await this.s3.listObjectsV2(params).promise();
      return (result.Contents || []).map(item => ({
        key: item.Key,
        size: item.Size,
        modified: item.LastModified,
      }));
    } catch (error) {
      console.error('S3 list error:', error);
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  /**
   * Get signed URL for file access
   * @param {string} key - S3 object key
   * @param {number} expiresIn - Expiration in seconds (default: 1 hour)
   * @returns {Promise<string>}
   */
  async getSignedUrl(key, expiresIn = 3600) {
    const params = {
      Bucket: this.bucket,
      Key: key,
      Expires: expiresIn,
    };

    try {
      return await this.s3.getSignedUrlPromise('getObject', params);
    } catch (error) {
      console.error('Signed URL error:', error);
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  }
}

module.exports = new S3Service();
```

---

## Part 4: Testing LocalStack Integration

### Test 1: Upload a File

```bash
# Create test file
echo "This is a test episode" > test-episode.txt

# Upload using curl
curl -X POST http://localhost:3002/api/v1/episodes/upload \
  -H "Content-Type: application/octet-stream" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  --data-binary @test-episode.txt

# Response should include S3 URL
# {
#   "url": "s3://brd-episodes-dev/episodes/1704451234567-test-episode.txt",
#   "key": "episodes/1704451234567-test-episode.txt"
# }
```

### Test 2: List Buckets

```bash
# Using AWS CLI with LocalStack
aws s3 ls --endpoint-url http://localhost:4566

# Expected output:
# 2026-01-05 12:00:00 brd-episodes-dev
# 2026-01-05 12:00:00 brd-thumbnails-dev
# 2026-01-05 12:00:00 brd-temp-dev
```

### Test 3: List Objects in Bucket

```bash
aws s3 ls s3://brd-episodes-dev --endpoint-url http://localhost:4566
```

### Test 4: Full Smoke Test

```bash
#!/bin/bash
# Test all services

echo "1️⃣  Testing PostgreSQL..."
docker exec episode-postgres psql -U postgres -d episode_metadata -c "SELECT COUNT(*) FROM episodes;" || echo "❌ PostgreSQL failed"

echo ""
echo "2️⃣  Testing LocalStack S3..."
aws s3 ls --endpoint-url http://localhost:4566 || echo "❌ LocalStack failed"

echo ""
echo "3️⃣  Testing API Health..."
curl -s http://localhost:3002/health | jq . || echo "❌ API failed"

echo ""
echo "4️⃣  Testing API Episodes..."
curl -s http://localhost:3002/api/v1/episodes?limit=1 | jq . || echo "❌ Episodes endpoint failed"

echo ""
echo "✅ All services operational!"
```

---

## Part 5: Development Workflow

### Quick Start (After Initial Setup)

```bash
# 1. Start services
docker-compose up -d

# 2. Wait for health
docker-compose ps  # Verify "healthy" status

# 3. Initialize LocalStack (if first time)
./scripts/init-localstack.sh

# 4. Start backend
npm start

# 5. Start frontend (in another terminal)
cd frontend && npm run dev

# API available at: http://localhost:3002
# Frontend available at: http://localhost:5173
```

### Development Tips

**Access LocalStack S3 directly:**
```bash
aws s3 ls s3://brd-episodes-dev/ \
  --endpoint-url http://localhost:4566 \
  --region us-east-1
```

**View LocalStack logs:**
```bash
docker-compose logs -f localstack
```

**Reset LocalStack (wipe all data):**
```bash
docker-compose down
docker volume rm episode-localstack_data  # If you named it
docker-compose up -d
./scripts/init-localstack.sh
```

**Monitor S3 uploads in real-time:**
```bash
docker-compose exec localstack bash
# Inside container:
aws s3 ls s3://brd-episodes-dev/ --endpoint-url http://localhost:4566 --recursive
```

---

## Part 6: Troubleshooting

### LocalStack Won't Start

```bash
# Check logs
docker-compose logs localstack

# Restart
docker-compose restart localstack

# Full reset
docker-compose down
docker-compose up -d
```

### S3 Endpoint Connection Refused

```
Error: connect ECONNREFUSED 127.0.0.1:4566
```

**Solution:**
1. Verify LocalStack is running: `docker-compose ps`
2. Check firewall isn't blocking port 4566
3. Ensure `.env.local` has correct endpoint: `AWS_S3_ENDPOINT=http://localhost:4566`

### Buckets Not Persisting

LocalStack data is stored in `/tmp/localstack` by default (temporary).

To persist:
```yaml
# In docker-compose.yml, update localstack service:
volumes:
  - ./localstack-data:/tmp/localstack/data  # Persistent directory
```

### AWS SDK Signature Errors

If you see signature mismatch errors:

```bash
# 1. Verify credentials in .env.local:
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test

# 2. Verify endpoint configuration in aws.js includes:
s3ForcePathStyle: true
signatureVersion: 'v4'
```

---

## Next Steps: Phase 2 Preparation

When ready to move to AWS staging (Weeks 5-6):

1. **Create AWS Account** (if not already done)
2. **Create AWS RDS Instance** for PostgreSQL
3. **Create Real S3 Buckets** in your AWS account
4. **Update .env.staging** with real AWS credentials
5. **Deploy to AWS** using `docker-compose -f docker-compose.prod.yml`

See [PHASE_2_AWS_SETUP.md](PHASE_2_AWS_SETUP.md) for detailed instructions.

---

## Summary: PHASE 1 Complete ✅

**What You Now Have:**
- ✅ Local PostgreSQL (Docker)
- ✅ Local S3 (LocalStack)
- ✅ $0/month infrastructure costs
- ✅ Offline development capability
- ✅ Fast iteration loop
- ✅ No AWS account needed (yet)

**Ready For:**
- Building all features
- Testing S3 integration locally
- Testing SQS/SNS locally (optional)
- Sharing development environment with team

**Time to completion:** ~15-20 minutes of setup

---

**Next Phase:** When features are built and tested locally, migrate to PHASE 2 (AWS Staging) with real cloud services.

**Questions?** Check:
1. [docker-compose logs localstack](http://)
2. [AWS SDK Configuration Docs](https://docs.aws.amazon.com/sdk-for-javascript/)
3. [LocalStack Documentation](https://docs.localstack.cloud/)
