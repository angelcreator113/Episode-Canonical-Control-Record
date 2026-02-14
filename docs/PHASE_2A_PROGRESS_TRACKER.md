# Phase 2A: AWS Setup Progress Tracker

**Start Date**: January 7, 2026
**Target Completion**: Within 3 hours
**Status**: READY TO EXECUTE

---

## Timeline & Checklist

### Part 1: S3 Buckets (30 minutes)
**Estimated Time**: 10:00 AM - 10:30 AM

- [ ] Create `brd-episodes-dev` bucket
- [ ] Create `brd-thumbnails-dev` bucket
- [ ] Create `brd-scripts-dev` bucket
- [ ] Enable versioning on all 3 buckets
- [ ] Configure lifecycle policies (30-day retention)
- [ ] Verify all buckets with `aws s3 ls | grep brd-`
- [ ] Save bucket names to notes

**Expected Output**:
```
brd-episodes-dev
brd-scripts-dev
brd-thumbnails-dev
```

**Time Elapsed**: 30 min
**Next**: Part 2

---

### Part 2: OpenSearch Domain (1-2 hours, mostly background)
**Estimated Time**: 10:30 AM - 12:00 PM

- [ ] Go to AWS Console → OpenSearch Service
- [ ] Click "Create domain"
- [ ] Fill configuration:
  - [ ] Domain name: `brd-opensearch-dev`
  - [ ] Type: `Development and testing`
  - [ ] Instance: `t3.small.elasticsearch`
  - [ ] Nodes: `1`
  - [ ] Storage: `100 GB`
  - [ ] Encryption: ✓ Enabled
  - [ ] Fine-grained access: ✓ Enabled
  - [ ] Admin user: admin / [strong-password]
- [ ] Click "Create" and **WAIT for ACTIVE** (10-30 min ⏳)
- [ ] Once active, test OpenSearch connection
- [ ] Create episodes index with mapping
- [ ] Verify index created with `curl`
- [ ] Save endpoint and credentials

**Expected Output**:
```json
{
  "cluster_name": "brd-opensearch-dev",
  "status": "green",
  "number_of_nodes": 1
}
```

**Time Elapsed**: 110 min (mostly waiting)
**Next**: Part 3 (can run in parallel while OpenSearch is provisioning)

---

### Part 3: SQS Queues (20 minutes)
**Estimated Time**: 11:00 AM - 11:20 AM (start while OpenSearch provisioning)

**Prerequisites**:
- [ ] Get AWS Account ID: `aws sts get-caller-identity`

**Tasks**:
- [ ] Create DLQ: `brd-job-dlq-dev`
- [ ] Get DLQ ARN
- [ ] Create main queue: `brd-job-queue-dev` with redrive to DLQ
- [ ] Create index queue: `brd-index-queue-dev`
- [ ] Create thumbnail queue: `brd-thumbnail-queue-dev`
- [ ] Verify all 4 queues with `aws sqs list-queues`
- [ ] Save all 4 queue URLs

**Expected Output**:
```
4 queues found:
- brd-index-queue-dev
- brd-job-dlq-dev
- brd-job-queue-dev
- brd-thumbnail-queue-dev
```

**Time Elapsed**: 130 min
**Next**: Part 4

---

### Part 4: IAM Roles & Policies (30 minutes)
**Estimated Time**: 11:30 AM - 12:00 PM

**Tasks**:
- [ ] Create policy document: `aws-iam-policy.json`
  - [ ] Include S3 permissions (episodes, thumbnails, scripts)
  - [ ] Include SQS permissions (all 4 queues)
  - [ ] Include OpenSearch permissions
  - [ ] Include MediaConvert permissions
  - [ ] Replace ACCOUNT_ID with actual ID
- [ ] Create IAM policy: `brd-phase2-app-policy`
- [ ] Attach policy to EC2 role: `episode-api-role`
- [ ] Verify attachment with `aws iam list-attached-role-policies`
- [ ] Save policy ARN

**Expected Output**:
```
Policy created successfully
Attached to: episode-api-role
```

**Time Elapsed**: 160 min
**Next**: Part 5

---

### Part 5: MediaConvert Setup (20 minutes)
**Estimated Time**: 12:00 PM - 12:20 PM

**Tasks**:
- [ ] Create on-demand queue: `brd-video-queue-dev`
- [ ] Create job template: `brd-thumbnail-template`
  - [ ] Output: H.264 video
  - [ ] Resolution: 320x180
  - [ ] Destination: `s3://brd-thumbnails-dev/`
- [ ] Verify template with `aws mediaconvert list-job-templates`
- [ ] Save queue ARN and template name

**Expected Output**:
```
Queue: brd-video-queue-dev
Template: brd-thumbnail-template
```

**Time Elapsed**: 180 min
**Next**: Part 6

---

### Part 6: Lambda Function Setup (40 minutes)
**Estimated Time**: 12:20 PM - 1:00 PM

**Step 1: Create Execution Role (10 min)**
- [ ] Create trust policy file: `lambda-trust-policy.json`
- [ ] Create role: `brd-lambda-execution-role`
- [ ] Attach `AWSLambdaBasicExecutionRole` policy
- [ ] Attach `brd-phase2-app-policy` policy
- [ ] Get and save role ARN

**Step 2: Create Function (15 min)**
- [ ] Create temporary directory: `lambda-package`
- [ ] Create `index.js` with handler function
- [ ] Package with `zip lambda-function.zip index.js`
- [ ] Create Lambda function with:
  - [ ] Name: `brd-thumbnail-processor-dev`
  - [ ] Runtime: `nodejs18.x`
  - [ ] Role: `brd-lambda-execution-role`
  - [ ] Timeout: `300` seconds
  - [ ] Memory: `512` MB
  - [ ] Environment variables set
- [ ] Get and save function ARN

**Step 3: Create S3 Trigger (15 min)**
- [ ] Add Lambda invocation permission to S3
- [ ] Create S3 event config: `s3-event-config.json`
  - [ ] Trigger: `s3:ObjectCreated:*`
  - [ ] Prefix filter: `uploads/`
  - [ ] Suffix filter: `.mp4`
  - [ ] Lambda ARN: [function ARN]
- [ ] Apply S3 notification configuration
- [ ] Verify with `aws s3api get-bucket-notification-configuration`

**Expected Output**:
```
Lambda function created
S3 trigger configured
Ready to process uploads/
```

**Time Elapsed**: 220 min (3.67 hours)
**Next**: Verification & .env.phase2 setup

---

## Final Verification (10 minutes)

Run these commands to verify all resources:

```bash
# 1. S3
aws s3 ls | grep brd-
# Should show 3 buckets

# 2. OpenSearch
aws opensearch describe-domain --domain-name brd-opensearch-dev
# Should show: "DomainStatus": "ACTIVE"

# 3. SQS
aws sqs list-queues --queue-name-prefix brd-
# Should show 4 queues

# 4. IAM
aws iam get-policy --policy-arn arn:aws:iam::ACCOUNT_ID:policy/brd-phase2-app-policy
# Should show policy details

# 5. Lambda
aws lambda get-function --function-name brd-thumbnail-processor-dev
# Should show function details
```

**Verification Checklist**:
- [ ] ✓ S3 buckets exist and versioning enabled
- [ ] ✓ OpenSearch domain is ACTIVE
- [ ] ✓ SQS queues created with DLQ configured
- [ ] ✓ IAM policy created and attached
- [ ] ✓ Lambda function deployed
- [ ] ✓ S3 Lambda trigger configured

---

## Values to Save

### S3 (Part 1)
```
BUCKET_EPISODES=brd-episodes-dev
BUCKET_THUMBNAILS=brd-thumbnails-dev
BUCKET_SCRIPTS=brd-scripts-dev
```

### OpenSearch (Part 2)
```
OPENSEARCH_ENDPOINT=https://brd-opensearch-dev.us-east-1.es.amazonaws.com
OPENSEARCH_USERNAME=admin
OPENSEARCH_PASSWORD=[your-strong-password-here]
```

### SQS (Part 3)
```
SQS_ACCOUNT_ID=[your-account-id]
SQS_MAIN_QUEUE=https://sqs.us-east-1.amazonaws.com/[ACCOUNT_ID]/brd-job-queue-dev
SQS_DLQ=https://sqs.us-east-1.amazonaws.com/[ACCOUNT_ID]/brd-job-dlq-dev
SQS_INDEX_QUEUE=https://sqs.us-east-1.amazonaws.com/[ACCOUNT_ID]/brd-index-queue-dev
SQS_THUMBNAIL_QUEUE=https://sqs.us-east-1.amazonaws.com/[ACCOUNT_ID]/brd-thumbnail-queue-dev
```

### IAM (Part 4)
```
IAM_POLICY_ARN=arn:aws:iam::[ACCOUNT_ID]:policy/brd-phase2-app-policy
```

### MediaConvert (Part 5)
```
MEDIACONVERT_QUEUE=brd-video-queue-dev
MEDIACONVERT_TEMPLATE=brd-thumbnail-template
```

### Lambda (Part 6)
```
LAMBDA_FUNCTION=brd-thumbnail-processor-dev
LAMBDA_ROLE_ARN=arn:aws:iam::[ACCOUNT_ID]:role/brd-lambda-execution-role
LAMBDA_FUNCTION_ARN=arn:aws:lambda:us-east-1:[ACCOUNT_ID]:function:brd-thumbnail-processor-dev
```

---

## Next Steps After Part 6

1. **Create .env.phase2**
   - Use template from PHASE_2A_EXECUTION_GUIDE.md
   - Fill in all values from above
   - Place in project root

2. **Install Phase 2 Dependencies**
   ```bash
   npm install aws-sdk @opensearch-project/opensearch multer sharp uuid
   ```

3. **Run Database Migrations**
   ```bash
   npm run migrate
   ```

4. **Start Phase 2B: S3 File Service**
   - Implement S3Service
   - Implement FileValidationService
   - Implement fileController
   - Write 90 unit tests
   - Target: 71.5% coverage

---

## Troubleshooting Quick Links

| Issue | Command |
|-------|---------|
| S3 bucket not found | `aws s3 ls --bucket-region us-east-1` |
| OpenSearch not responding | `aws opensearch describe-domain --domain-name brd-opensearch-dev` |
| SQS queue not accessible | `aws sqs list-queues --region us-east-1` |
| Lambda not triggered | `aws logs tail /aws/lambda/brd-thumbnail-processor-dev --follow` |
| IAM permission denied | `aws iam get-role --role-name episode-api-role` |

---

## Progress Notes

**Start Time**: [FILL IN]
**Part 1 Complete**: [FILL IN] ✓
**Part 2 Complete**: [FILL IN] ✓
**Part 3 Complete**: [FILL IN] ✓
**Part 4 Complete**: [FILL IN] ✓
**Part 5 Complete**: [FILL IN] ✓
**Part 6 Complete**: [FILL IN] ✓
**Final Verification**: [FILL IN] ✓
**Total Time**: [FILL IN]

**Issues Encountered**: 
[FILL IN]

**Notes**:
[FILL IN]

---

## Success Criteria

All of the following must be true:

- [ ] 3 S3 buckets created and versioning enabled
- [ ] OpenSearch domain active and index created
- [ ] 4 SQS queues created with DLQ configured
- [ ] IAM policy created and attached to EC2 role
- [ ] MediaConvert queue and template created
- [ ] Lambda function deployed with S3 trigger
- [ ] All environment variables saved
- [ ] .env.phase2 created with all values
- [ ] Phase 2 dependencies installed
- [ ] Database migrations run successfully

**Status**: Ready to begin Phase 2A! 🚀
