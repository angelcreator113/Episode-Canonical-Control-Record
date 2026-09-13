# Edit Maps AI Analysis System - Deployment Guide

## Overview
Complete deployment instructions for the AI-powered video analysis system with Lambda, database, and frontend integration.

## 📋 Pre-Deployment Checklist

- [ ] AWS account with Lambda, SQS, and S3 access
- [ ] PostgreSQL database running
- [ ] Node.js 20.x+ on Lambda runtime
- [ ] AWS CLI configured locally
- [ ] Environment variables prepared
- [ ] Database credentials ready

---

## 🗄️ PART 1: DATABASE SETUP

### 1.1 Run Migrations

```bash
cd c:\Users\12483\Projects\Episode-Canonical-Control-Record-1

# Run the edit maps migration
npm run migrate:up

# Or manually with Sequelize CLI
npx sequelize-cli db:migrate --env production

# Verify migrations applied
SELECT table_name FROM information_schema.tables 
WHERE table_schema='public' AND table_name IN ('edit_maps', 'character_profiles', 'upload_logs', 'raw_footage');
```

**Expected Output:**
- `edit_maps` table created (25 columns + timestamps)
- `character_profiles` table created (8 columns + timestamps)
- `upload_logs` table created (8 columns + timestamps)
- `raw_footage` table updated with new columns

### 1.2 Verify Database Schema

```sql
-- Check edit_maps table
\d edit_maps

-- Check character_profiles table
\d character_profiles

-- Check upload_logs table
\d upload_logs

-- Check raw_footage new columns
SELECT column_name FROM information_schema.columns 
WHERE table_name='raw_footage' AND column_name IN ('upload_purpose', 'character_visible', 'intended_scene_id', 'recording_context');
```

---

## 🚀 PART 2: AWS LAMBDA DEPLOYMENT

### 2.1 Prepare Lambda Package

```bash
# Navigate to Lambda directory
cd lambda/video-analyzer

# Install dependencies
npm install

# Create deployment package
zip -r function.zip . -x "node_modules/aws-sdk/*"

# Verify package contents
unzip -l function.zip | head -20
```

**Files in ZIP:**
- `index.js` (500 lines - analysis logic)
- `package.json` (dependencies)
- `node_modules/` (except aws-sdk)

### 2.2 Create IAM Role for Lambda

```bash
# Create the role
aws iam create-role \
  --role-name VideoAnalyzerLambdaRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach basic Lambda execution policy
aws iam attach-role-policy \
  --role-name VideoAnalyzerLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Create and attach S3 access policy
cat > s3-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:GetObject", "s3:PutObject"],
    "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
  }]
}
EOF

aws iam put-role-policy \
  --role-name VideoAnalyzerLambdaRole \
  --policy-name S3Access \
  --policy-document file://s3-policy.json

# Create and attach Transcribe policy
cat > transcribe-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "transcribe:StartTranscriptionJob",
      "transcribe:GetTranscriptionJob",
      "transcribe:ListTranscriptionJobs"
    ],
    "Resource": "*"
  }]
}
EOF

aws iam put-role-policy \
  --role-name VideoAnalyzerLambdaRole \
  --policy-name TranscribeAccess \
  --policy-document file://transcribe-policy.json

# Note the Role ARN - you'll need it below
aws iam get-role --role-name VideoAnalyzerLambdaRole --query 'Role.Arn'
# Output: arn:aws:iam::ACCOUNT_ID:role/VideoAnalyzerLambdaRole
```

### 2.3 Deploy Lambda Function

```bash
# Set your AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/VideoAnalyzerLambdaRole"

# Deploy the function
aws lambda create-function \
  --function-name video-analyzer \
  --runtime nodejs20.x \
  --handler index.handler \
  --role $ROLE_ARN \
  --timeout 900 \
  --memory-size 3008 \
  --zip-file fileb://function.zip \
  --region us-east-1

# Verify deployment
aws lambda get-function --function-name video-analyzer --region us-east-1
```

### 2.4 Configure Lambda Environment Variables

```bash
# Set environment variables for Lambda
aws lambda update-function-configuration \
  --function-name video-analyzer \
  --environment Variables='
    {
      "S3_BUCKET":"your-video-bucket",
      "API_URL":"https://your-api.example.com",
      "DB_HOST":"your-db-host.rds.amazonaws.com",
      "DB_USER":"postgres",
      "DB_PASSWORD":"your-password",
      "DB_NAME":"episode_db",
      "NODE_ENV":"production"
    }
  ' \
  --region us-east-1

# Verify configuration
aws lambda get-function-configuration --function-name video-analyzer --region us-east-1
```

---

## 🔔 PART 3: AWS SQS SETUP

### 3.1 Create SQS Queue

```bash
# Create standard queue for video analysis jobs
aws sqs create-queue \
  --queue-name video-analysis-queue \
  --region us-east-1

# Capture the queue URL (you'll need this)
QUEUE_URL=$(aws sqs get-queue-url \
  --queue-name video-analysis-queue \
  --region us-east-1 \
  --query 'QueueUrl' \
  --output text)

echo "Queue URL: $QUEUE_URL"
# Example: https://sqs.us-east-1.amazonaws.com/123456789/video-analysis-queue
```

### 3.2 Configure Lambda SQS Trigger

```bash
# Grant SQS permission to invoke Lambda
aws lambda add-permission \
  --function-name video-analyzer \
  --statement-id AllowSQSInvoke \
  --action lambda:InvokeFunction \
  --principal sqs.amazonaws.com \
  --source-arn arn:aws:sqs:us-east-1:${ACCOUNT_ID}:video-analysis-queue \
  --region us-east-1

# Create event source mapping
aws lambda create-event-source-mapping \
  --event-source-arn arn:aws:sqs:us-east-1:${ACCOUNT_ID}:video-analysis-queue \
  --function-name video-analyzer \
  --batch-size 10 \
  --maximum-batching-window-in-seconds 5 \
  --region us-east-1

# Verify trigger
aws lambda list-event-source-mappings \
  --function-name video-analyzer \
  --region us-east-1
```

---

## 🌐 PART 4: BACKEND CONFIGURATION

### 4.1 Set Environment Variables

```bash
# In your .env file or production environment:
ANALYSIS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789/video-analysis-queue
S3_BUCKET=your-video-bucket
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret

# Lambda configuration
LAMBDA_FUNCTION_NAME=video-analyzer
LAMBDA_REGION=us-east-1
```

### 4.2 Update Backend Configuration

**File:** `src/config/aws.js` (create if needed)

```javascript
module.exports = {
  sqs: {
    queueUrl: process.env.ANALYSIS_QUEUE_URL,
    region: process.env.AWS_REGION || 'us-east-1'
  },
  s3: {
    bucket: process.env.S3_BUCKET,
    region: process.env.AWS_REGION || 'us-east-1'
  },
  lambda: {
    functionName: process.env.LAMBDA_FUNCTION_NAME || 'video-analyzer',
    region: process.env.AWS_REGION || 'us-east-1',
    timeout: 900 // seconds
  },
  transcribe: {
    region: process.env.AWS_REGION || 'us-east-1'
  }
};
```

### 4.3 Verify Routes are Registered

```bash
# Check app.js has routes loaded
grep -n "editMapsRoutes" src/app.js

# Expected output:
# 539: let editMapsRoutes;
# 542: editMapsRoutes = require('./routes/editMaps');
# 547: app.use('/api/v1/raw-footage', editMapsRoutes);
# 548: app.use('/api/v1/edit-maps', editMapsRoutes);
# 549: app.use('/api/v1/shows', editMapsRoutes);
```

### 4.4 Test API Locally

```bash
# Start backend server
npm start

# In another terminal, test the API
# 1. Trigger analysis (will queue if SQS configured)
curl -X POST http://localhost:3002/api/v1/raw-footage/test-id/analyze \
  -H "Content-Type: application/json"

# 2. Get edit map status
curl http://localhost:3002/api/v1/raw-footage/test-id/edit-map

# 3. Get character profiles
curl http://localhost:3002/api/v1/shows/show-id/characters
```

---

## 🎨 PART 5: FRONTEND INTEGRATION

### 5.1 Verify Components

```bash
# Check that AnalysisDashboard exists
ls -la frontend/src/components/AnalysisDashboard.jsx

# Expected: File should be ~350 lines with 4 view components
wc -l frontend/src/components/AnalysisDashboard.jsx
```

### 5.2 Import in Raw Footage Component

**File:** `frontend/src/components/RawFootageUpload.jsx`

```javascript
// Add at top
import AnalysisDashboard from './AnalysisDashboard';

// Add state management
const [selectedFootage, setSelectedFootage] = useState(null);
const [editMap, setEditMap] = useState(null);
const [analyzing, setAnalyzing] = useState(false);

// Add analysis handler
const handleAnalyze = async (footageId) => {
  try {
    setAnalyzing(true);
    const response = await axios.post(`/api/v1/raw-footage/${footageId}/analyze`);
    alert('✅ AI analysis started! Check back in 2-5 minutes.');
    
    // Start polling
    pollForAnalysis(footageId);
  } catch (error) {
    console.error('Analysis failed:', error);
    alert('Failed to start analysis');
  } finally {
    setAnalyzing(false);
  }
};

// Add polling function
const pollForAnalysis = async (footageId) => {
  const interval = setInterval(async () => {
    try {
      const response = await axios.get(`/api/v1/raw-footage/${footageId}/edit-map`);
      const map = response.data.data;
      
      if (map.processing_status === 'completed') {
        clearInterval(interval);
        setEditMap(map);
        alert('✅ Analysis complete!');
      } else if (map.processing_status === 'failed') {
        clearInterval(interval);
        alert('❌ Analysis failed');
      }
    } catch (error) {
      // Not found yet, keep polling
    }
  }, 10000); // Poll every 10 seconds
};

// Render dashboard below footage list
{selectedFootage && (
  <AnalysisDashboard
    rawFootageId={selectedFootage.id}
    editMap={editMap}
    onRefresh={() => handleAnalyze(selectedFootage.id)}
  />
)}
```

### 5.3 Build Frontend

```bash
cd frontend
npm run build

# Verify build output
ls -la dist/ | head -10
# Should contain index.html, assets/, etc.
```

---

## ✅ PART 6: TESTING

### 6.1 Unit Tests

```bash
# Test Lambda function locally
npm install -g sam-cli

# Run SAM local (requires Docker)
sam local invoke VideoAnalyzer --event test-event.json

# Or test with Node directly
node -e "
  const handler = require('./lambda/video-analyzer/index').handler;
  handler({
    Records: [{
      body: JSON.stringify({
        edit_map_id: 'test-id',
        raw_footage_id: 'footage-id',
        s3_key: 'test-video.mp4',
        episode_id: 'ep-1'
      })
    }]
  }).then(console.log);
"
```

### 6.2 Integration Tests

```bash
# 1. Create test raw footage
curl -X POST http://localhost:3002/api/v1/raw-footage \
  -H "Content-Type: application/json" \
  -d '{
    "episode_id": "episode-1",
    "s3_key": "test-video.mp4",
    "file_size": 1024000
  }'

# 2. Trigger analysis
FOOTAGE_ID=$(curl -s http://localhost:3002/api/v1/raw-footage | jq -r '.[0].id')
curl -X POST http://localhost:3002/api/v1/raw-footage/${FOOTAGE_ID}/analyze

# 3. Poll for results
curl http://localhost:3002/api/v1/raw-footage/${FOOTAGE_ID}/edit-map

# 4. Check Lambda logs
aws logs tail /aws/lambda/video-analyzer --follow
```

### 6.3 End-to-End Test

```bash
# 1. Upload video via UI
# 2. Click "Analyze" button
# 3. Monitor Lambda execution:
aws lambda invoke \
  --function-name video-analyzer \
  --log-type Tail \
  --payload '{"test": true}' \
  response.json

cat response.json
```

---

## 📊 PART 7: MONITORING

### 7.1 CloudWatch Logs

```bash
# View Lambda logs in real-time
aws logs tail /aws/lambda/video-analyzer --follow

# Search for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/video-analyzer \
  --filter-pattern "ERROR"

# Get log statistics
aws logs describe-log-groups | grep video-analyzer
```

### 7.2 SQS Monitoring

```bash
# Check queue depth
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/${ACCOUNT_ID}/video-analysis-queue \
  --attribute-names ApproximateNumberOfMessages

# View dead letter queue
aws sqs list-queues --queue-name-prefix "video-analysis"
```

### 7.3 Database Monitoring

```bash
# Monitor analysis jobs
SELECT 
  id, 
  processing_status, 
  processing_started_at, 
  processing_completed_at,
  error_message
FROM edit_maps
ORDER BY created_at DESC
LIMIT 10;

# Check failure rate
SELECT 
  processing_status,
  COUNT(*) as count
FROM edit_maps
GROUP BY processing_status;
```

---

## 🔧 TROUBLESHOOTING

### Lambda Not Triggering

```bash
# Check event source mapping
aws lambda list-event-source-mappings --function-name video-analyzer

# Check SQS queue
aws sqs receive-message --queue-url $QUEUE_URL

# Check Lambda permissions
aws lambda get-policy --function-name video-analyzer
```

### Analysis Failing

```bash
# Check Lambda logs for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/video-analyzer \
  --filter-pattern "ERROR"

# Check database connectivity
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1"

# Verify S3 bucket access
aws s3 ls $S3_BUCKET
```

### High Latency

```bash
# Increase Lambda memory/timeout
aws lambda update-function-configuration \
  --function-name video-analyzer \
  --memory-size 3008 \
  --timeout 900

# Check SQS batch settings
aws lambda get-event-source-mapping \
  --uuid [UUID from list command]
```

---

## 📝 PART 8: PRODUCTION CHECKLIST

- [ ] All migrations applied successfully
- [ ] Lambda function deployed and tested
- [ ] SQS queue created and Lambda trigger configured
- [ ] Environment variables set in Lambda
- [ ] IAM roles and policies configured correctly
- [ ] Backend API routes tested and working
- [ ] Frontend AnalysisDashboard component imported
- [ ] Frontend build successful
- [ ] CloudWatch logs configured
- [ ] Error handling and logging implemented
- [ ] Database backups enabled
- [ ] Monitoring dashboards created
- [ ] Runbooks/documentation prepared
- [ ] Team trained on system

---

## 🚀 DEPLOYMENT COMMANDS (Quick Reference)

```bash
# Complete deployment in one script
#!/bin/bash

# 1. Database
npm run migrate:up

# 2. Backend
npm install
npm start &

# 3. Frontend
cd frontend && npm run build

# 4. Lambda (from lambda/video-analyzer)
zip -r function.zip .
aws lambda update-function-code \
  --function-name video-analyzer \
  --zip-file fileb://function.zip

# 5. Verify
curl http://localhost:3002/api/v1/raw-footage

echo "✅ Deployment complete!"
```

---

## 📞 Support

For issues:
1. Check CloudWatch logs: `aws logs tail /aws/lambda/video-analyzer`
2. Verify database: `psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT COUNT(*) FROM edit_maps"`
3. Test API: `curl http://localhost:3002/api/v1/raw-footage`
4. Check SQS: `aws sqs get-queue-attributes --queue-url $QUEUE_URL --attribute-names ApproximateNumberOfMessages`

---

**Last Updated:** 2026-02-08  
**System Version:** 1.0  
**Status:** Production Ready
