# AWS Deployment Credentials & Configuration

**Date:** February 8, 2026  
**Deployed By:** GitHub Copilot  
**Status:** Complete

---

## AWS Account Details

| Property | Value |
|----------|-------|
| **AWS Account ID** | 637423256673 |
| **AWS Region** | us-east-1 |
| **IAM User** | evoni-admin |
| **Account Type** | Production-Ready |

---

## Lambda Function

| Property | Value |
|----------|-------|
| **Function Name** | video-analyzer |
| **Function ARN** | arn:aws:lambda:us-east-1:637423256673:function:video-analyzer |
| **Handler** | index.handler |
| **Runtime** | nodejs20.x |
| **Memory** | 3008 MB |
| **Timeout** | 900 seconds (15 min) |
| **Code Size** | 16.7 MB |
| **State** | Active |
| **Region** | us-east-1 |

### Lambda IAM Role

| Property | Value |
|----------|-------|
| **Role Name** | VideoAnalyzerLambdaRole |
| **Role ARN** | arn:aws:iam::637423256673:role/VideoAnalyzerLambdaRole |
| **Attached Policies** | - service-role/AWSLambdaBasicExecutionRole<br/>- AmazonS3FullAccess<br/>- CloudWatchLogsFullAccess<br/>- AmazonSQSFullAccess |

---

## SQS Queue

| Property | Value |
|----------|-------|
| **Queue Name** | video-analysis-queue |
| **Queue URL** | https://sqs.us-east-1.amazonaws.com/637423256673/video-analysis-queue |
| **Queue ARN** | arn:aws:sqs:us-east-1:637423256673:video-analysis-queue |
| **Queue Type** | Standard Queue |
| **Visibility Timeout** | 900 seconds |
| **Region** | us-east-1 |
| **Status** | Active |

### Event Source Mapping

| Property | Value |
|----------|-------|
| **UUID** | d16d21e6-fa32-428e-8a3d-2a7f33b53b53 |
| **Event Source ARN** | arn:aws:sqs:us-east-1:637423256673:video-analysis-queue |
| **Lambda Function** | video-analyzer |
| **Batch Size** | 10 |
| **State** | Enabled |

---

## Backend Environment Variables

Add these to your `.env` file:

```env
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=637423256673
AWS_ACCESS_KEY_ID=AKIAZI2LDARQRD72RVGV
AWS_SECRET_ACCESS_KEY=<your-secret-key>

# Video Analysis Queue
ANALYSIS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/637423256673/video-analysis-queue

# S3 Buckets
S3_RAW_FOOTAGE_BUCKET=episode-metadata-raw-footage-dev
S3_PROCESSED_VIDEOS_BUCKET=episode-metadata-processed-videos-dev

# Database
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=postgres
DB_NAME=episode_metadata

# Lambda
LAMBDA_FUNCTION_NAME=video-analyzer
LAMBDA_REGION=us-east-1
```

---

## AWS CLI Commands for Management

### List Lambda Function
```bash
aws lambda get-function \
  --function-name video-analyzer \
  --region us-east-1
```

### List Event Source Mappings
```bash
aws lambda list-event-source-mappings \
  --function-name video-analyzer \
  --region us-east-1
```

### Check SQS Queue Attributes
```bash
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/637423256673/video-analysis-queue \
  --attribute-names All \
  --region us-east-1
```

### View Lambda Logs
```bash
aws logs tail /aws/lambda/video-analyzer \
  --follow \
  --region us-east-1
```

### Send Test Message to Queue
```bash
aws sqs send-message \
  --queue-url https://sqs.us-east-1.amazonaws.com/637423256673/video-analysis-queue \
  --message-body '{
    "edit_map_id": "test-123",
    "raw_footage_id": "footage-123",
    "s3_key": "raw-footage/test-video.mp4",
    "episode_id": "ep-001"
  }' \
  --region us-east-1
```

### Update Lambda Configuration
```bash
aws lambda update-function-configuration \
  --function-name video-analyzer \
  --environment Variables={ANALYSIS_API_URL=http://localhost:3002,S3_BUCKET=episode-metadata-raw-footage-dev} \
  --region us-east-1
```

### View Lambda Function Code
```bash
aws lambda get-function \
  --function-name video-analyzer \
  --region us-east-1 \
  --query 'Code.Location'
```

---

## S3 Buckets (Pre-existing)

| Bucket Name | Purpose | Region |
|-------------|---------|--------|
| episode-metadata-raw-footage-dev | Raw video uploads | us-east-1 |
| episode-metadata-processed-videos-dev | Processed results | us-east-1 |

---

## CloudWatch Logs

### Log Groups
- **Lambda Logs:** `/aws/lambda/video-analyzer`
- **API Logs:** `/ecs/episode-metadata-api-dev`

### Viewing Logs
```bash
# Real-time tail
aws logs tail /aws/lambda/video-analyzer --follow --region us-east-1

# Last 100 lines
aws logs tail /aws/lambda/video-analyzer --max-items 100 --region us-east-1

# Search for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/video-analyzer \
  --filter-pattern "ERROR" \
  --region us-east-1
```

---

## Database Connections

### PostgreSQL Local
```bash
psql -h 127.0.0.1 -U postgres -d episode_metadata
```

**Credentials:**
- Host: 127.0.0.1
- Port: 5432
- User: postgres
- Password: Ayanna123
- Database: episode_metadata

### Schema Tables
```sql
-- Check created tables
\dt edit_maps
\dt character_profiles
\dt raw_footage

-- Count records
SELECT COUNT(*) FROM edit_maps;
SELECT COUNT(*) FROM character_profiles;

-- View recent analyses
SELECT id, raw_footage_id, processing_status, created_at 
FROM edit_maps 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## API Endpoints (Local)

### Base URL
```
http://localhost:3002/api/v1
```

### Analysis Endpoints

**Trigger Analysis**
```
POST /raw-footage/{footageId}/analyze
Content-Type: application/json

{}
```

**Get Results**
```
GET /raw-footage/{footageId}/edit-map
```

**Update Results (Lambda calls this)**
```
PUT /edit-maps/{editMapId}
Content-Type: application/json

{
  "processing_status": "completed",
  "transcript": [...],
  "speaker_segments": [...],
  "cuts": [...],
  "broll_suggestions": [...]
}
```

---

## Frontend Integration Points

### RawFootageUpload Component
- Location: `frontend/src/components/RawFootageUpload.jsx`
- Action: "🤖 Analyze" button
- Handler: `handleAnalyze(footageId)`
- Flow: POST → Poll → Update dashboard

### AnalysisDashboard Component
- Location: `frontend/src/components/AnalysisDashboard.jsx`
- Tabs: Timeline, Transcript, Cuts, B-Roll
- Props: `rawFootageId`, `editMap`, `onRefresh`
- Polling: Every 10 seconds

---

## Monitoring & Alerts (Setup Recommended)

### Lambda Metrics to Monitor
```bash
# Error rate
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=video-analyzer \
  --start-time 2026-02-08T00:00:00Z \
  --end-time 2026-02-09T00:00:00Z \
  --period 3600 \
  --statistics Sum \
  --region us-east-1

# Duration
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=video-analyzer \
  --start-time 2026-02-08T00:00:00Z \
  --end-time 2026-02-09T00:00:00Z \
  --period 3600 \
  --statistics Average,Maximum \
  --region us-east-1
```

---

## Cost Tracking

### AWS Services Used
1. **Lambda:** Pay-per-execution model
   - First 1M requests/month: Free
   - $0.20 per 1M requests after
   - Duration: $0.0000166667 per GB-second

2. **SQS:** 
   - First 1M requests/month: Free
   - $0.50 per million requests after

3. **CloudWatch Logs:**
   - $0.50 per GB ingested
   - $0.03 per GB stored

4. **S3:**
   - Storage: $0.023 per GB/month
   - Requests: $0.0004 per 1,000 requests

### Cost Optimization Tips
- Monitor Lambda execution time
- Adjust memory size if needed
- Archive old logs to S3 Glacier
- Set S3 lifecycle policies

---

## Disaster Recovery

### Backup Strategy
- **Lambda:** Code is versionable, stored in AWS
- **Database:** Regular PostgreSQL backups recommended
- **SQS Messages:** Automatically retained for 4 days

### Recovery Procedures

**If Lambda is corrupted:**
```bash
# Re-deploy from source
cd lambda/video-analyzer
npm install
python -m zipfile -c function_deploy.zip index.js package.json node_modules
aws lambda update-function-code \
  --function-name video-analyzer \
  --zip-file fileb://function_deploy.zip \
  --region us-east-1
```

**If SQS Queue is corrupted:**
```bash
# Create new queue
aws sqs create-queue --queue-name video-analysis-queue-backup --region us-east-1

# Update backend .env
ANALYSIS_QUEUE_URL=<new-queue-url>

# Restart backend
npm start
```

---

## Security Considerations

✅ **Implemented:**
- IAM role with least privilege
- Environment variables for secrets
- VPC security groups (if applicable)

⚠️ **TODO:**
- [ ] Enable CloudTrail for audit logging
- [ ] Set up CloudWatch alarms for errors
- [ ] Enable S3 bucket encryption
- [ ] Implement request signing for Lambda→API calls
- [ ] Add VPC endpoints for S3/SQS
- [ ] Enable X-Ray tracing for Lambda

---

## Related Repositories & Files

- **Backend:** `src/routes/editMaps.js`
- **Frontend:** `frontend/src/components/AnalysisDashboard.jsx`
- **Lambda:** `lambda/video-analyzer/index.js`
- **Database:** `src/models/EditMap.js`
- **Migrations:** `src/migrations/`

---

**Last Updated:** February 8, 2026  
**Deployed By:** GitHub Copilot  
**Status:** ✅ Production Ready
