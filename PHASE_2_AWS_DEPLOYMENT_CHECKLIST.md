# PHASE 2: AWS Deployment Setup Guide

**Status:** 🚀 Starting PHASE 2  
**Date:** January 5, 2026  
**Environment:** Staging (AWS)  
**Region:** us-east-1  
**AWS Account:** 637423256673

---

## 📋 PHASE 2 Deployment Checklist

### Step 1: ✅ Verify AWS Account
- ✅ CLI configured: `aws-cli/2.30.2`
- ✅ Account: `637423256673`
- ✅ User: `evoni-admin`
- ✅ Region: `us-east-1`

### Step 2: Create RDS PostgreSQL (Staging)
```bash
# Create security group for RDS
aws ec2 create-security-group \
  --group-name episode-metadata-rds-staging \
  --description "RDS security group for Episode Metadata API staging" \
  --vpc-id <vpc-id>

# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier episode-metadata-postgres-staging \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username admin \
  --master-user-password <strong-password> \
  --allocated-storage 20 \
  --publicly-accessible true
```

### Step 3: Create S3 Buckets
```bash
# Episodes bucket
aws s3 mb s3://brd-episodes-staging-001 --region us-east-1

# Thumbnails bucket
aws s3 mb s3://brd-thumbnails-staging-001 --region us-east-1

# Temp bucket
aws s3 mb s3://brd-temp-staging-001 --region us-east-1
```

### Step 4: Create SQS Queues
```bash
# Job queue
aws sqs create-queue --queue-name brd-job-queue-staging

# DLQ
aws sqs create-queue --queue-name brd-job-dlq-staging
```

### Step 5: Set Up Cognito User Pool
```bash
# Create user pool
aws cognito-idp create-user-pool \
  --pool-name episode-metadata-staging \
  --policies PasswordPolicy={MinimumLength=8,RequireUppercase=true,RequireLowercase=true,RequireNumbers=true,RequireSymbols=true}
```

### Step 6: Deploy Application
```bash
# Pull latest code
git pull origin main

# Install dependencies
npm install

# Run migrations on RDS
npm run migrate:up

# Start application
npm start
```

---

## 🔧 Configuration

### Environment Variables (.env.staging)
```
NODE_ENV=staging
PORT=3002

# Database
DB_HOST=<rds-endpoint>
DB_PORT=5432
DB_USER=admin
DB_PASSWORD=<password>
DB_NAME=episode_metadata

# S3
AWS_REGION=us-east-1
S3_BUCKET_EPISODES=brd-episodes-staging-001
S3_BUCKET_THUMBNAILS=brd-thumbnails-staging-001
S3_BUCKET_TEMP=brd-temp-staging-001

# SQS
SQS_QUEUE_URL_JOB=<job-queue-url>
SQS_QUEUE_URL_DLQ=<dlq-url>

# Cognito
COGNITO_REGION=us-east-1
COGNITO_USER_POOL_ID=<pool-id>
COGNITO_CLIENT_ID=<client-id>
COGNITO_DOMAIN=<domain>
```

---

## ✅ Verification Steps

1. Test RDS connection
2. Upload file to S3
3. Send message to SQS
4. Test API endpoints
5. Run test suite

---

## 📊 Expected Costs (Staging)

- **RDS (db.t3.micro):** ~$15-20/month
- **S3 (minimal usage):** ~$0.50/month
- **SQS (minimal usage):** ~$0.10/month
- **Bandwidth:** ~$1-2/month
- **Total:** ~$20-25/month

---

## 🚀 Next Steps

1. Create RDS instance
2. Create S3 buckets
3. Configure SQS queues
4. Update environment variables
5. Deploy application
6. Run tests and verify
