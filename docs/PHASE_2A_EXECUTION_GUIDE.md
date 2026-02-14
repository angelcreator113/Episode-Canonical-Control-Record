# Phase 2A: AWS Infrastructure Execution Guide

**Timeline**: Days 1-2 (2-4 hours total)
**Status**: READY TO EXECUTE
**Date Started**: January 7, 2026

---

## Overview: What We're Building

```
┌─────────────────────────────────────────────────────────────┐
│                    AWS Infrastructure                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  S3 (3 buckets)        OpenSearch (1 domain)                 │
│  ├─ episodes           ├─ 1 node (t3.small)                  │
│  ├─ thumbnails         ├─ 100GB storage                      │
│  └─ scripts            └─ Fine-grained access                │
│                                                               │
│  SQS (4 queues)        Lambda (1 function)                   │
│  ├─ main job queue     ├─ Thumbnail processor                │
│  ├─ index queue        └─ S3 event trigger                   │
│  ├─ thumbnail queue                                          │
│  └─ DLQ (dead letter)  IAM (roles + policies)               │
│                        └─ Application permissions            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Total Setup Time**: 2-4 hours
- Part 1 (S3): 30 min
- Part 2 (OpenSearch): 1-2 hours (mostly waiting for provisioning)
- Part 3 (SQS): 20 min
- Part 4 (IAM): 30 min
- Part 5 (MediaConvert): 20 min
- Part 6 (Lambda): 40 min
- Total: 180-260 minutes

---

## Prerequisites

✓ AWS CLI installed and configured
✓ AWS credentials with admin access
✓ AWS Account ID (find via: `aws sts get-caller-identity`)
✓ US-East-1 region (default)
✓ Terminal access

---

## Part 1: S3 Buckets Setup (30 minutes)

### Create 3 S3 Buckets

Run these commands in order:

```bash
# 1. Episode clips bucket
aws s3api create-bucket \
  --bucket brd-episodes-dev \
  --region us-east-1 \
  --acl private

# 2. Thumbnail bucket
aws s3api create-bucket \
  --bucket brd-thumbnails-dev \
  --region us-east-1 \
  --acl private

# 3. Scripts/metadata bucket
aws s3api create-bucket \
  --bucket brd-scripts-dev \
  --region us-east-1 \
  --acl private
```

**Verify buckets created**:
```bash
aws s3 ls | grep brd-
```

**Expected output**:
```
2026-01-07 14:30:00 brd-episodes-dev
2026-01-07 14:31:00 brd-scripts-dev
2026-01-07 14:31:00 brd-thumbnails-dev
```

### Enable Versioning

```bash
# Enable versioning on episodes bucket
aws s3api put-bucket-versioning \
  --bucket brd-episodes-dev \
  --versioning-configuration Status=Enabled

# Enable versioning on thumbnails bucket
aws s3api put-bucket-versioning \
  --bucket brd-thumbnails-dev \
  --versioning-configuration Status=Enabled

# Enable versioning on scripts bucket
aws s3api put-bucket-versioning \
  --bucket brd-scripts-dev \
  --versioning-configuration Status=Enabled
```

### Configure Lifecycle Policies

```bash
# Delete old versions after 30 days
aws s3api put-bucket-lifecycle-configuration \
  --bucket brd-episodes-dev \
  --lifecycle-configuration '{
    "Rules": [
      {
        "Id": "DeleteOldVersions",
        "Status": "Enabled",
        "NoncurrentVersionExpiration": {
          "NoncurrentDays": 30
        },
        "Filter": {"Prefix": ""}
      }
    ]
  }'
```

### Save Information

After Part 1, save:
```
✓ brd-episodes-dev
✓ brd-thumbnails-dev
✓ brd-scripts-dev
```

**✓ PART 1 COMPLETE** (30 min elapsed)

---

## Part 2: OpenSearch Domain Setup (1-2 hours, ~80 minutes waiting)

### Create OpenSearch Domain in AWS Console

**Steps**:
1. Go to AWS Console → OpenSearch Service
2. Click "Create domain"
3. Fill in configuration:

```
Domain name: brd-opensearch-dev
Deployment type: Development and testing
Data node configuration:
  - Instance type: t3.small.elasticsearch
  - Number of nodes: 1
  - Dedicated master node: Disabled
Storage per node: 100 GB
Encryption at rest: ✓ Enabled
Fine-grained access control: ✓ Enabled
  - Create master user (admin/strong-password)
Network: VPC (same as database)
Public access: Disabled
```

**Wait for domain to be ACTIVE** (10-30 minutes)

### Test OpenSearch Connection

Once domain is active:

```bash
# Set environment variables
OPENSEARCH_ENDPOINT="https://brd-opensearch-dev.us-east-1.es.amazonaws.com"
OPENSEARCH_USER="admin"
OPENSEARCH_PASSWORD="your-password-here"

# Test connection
curl -u $OPENSEARCH_USER:$OPENSEARCH_PASSWORD \
  "$OPENSEARCH_ENDPOINT/_cluster/health"
```

**Expected response**:
```json
{
  "cluster_name": "brd-opensearch-dev",
  "status": "green",
  "timed_out": false,
  "number_of_nodes": 1,
  "number_of_data_nodes": 1
}
```

### Create Index Mapping

```bash
# Create episodes index with proper mappings
curl -u $OPENSEARCH_USER:$OPENSEARCH_PASSWORD \
  -X PUT "$OPENSEARCH_ENDPOINT/episodes" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "number_of_shards": 1,
      "number_of_replicas": 0
    },
    "mappings": {
      "properties": {
        "id": {"type": "keyword"},
        "showName": {"type": "text", "analyzer": "standard"},
        "episodeTitle": {"type": "text", "analyzer": "standard"},
        "description": {"type": "text", "analyzer": "standard"},
        "status": {"type": "keyword"},
        "tags": {"type": "keyword"},
        "categories": {"type": "keyword"},
        "createdAt": {"type": "date"},
        "updatedAt": {"type": "date"}
      }
    }
  }'
```

**Verify index**:
```bash
curl -u $OPENSEARCH_USER:$OPENSEARCH_PASSWORD \
  "$OPENSEARCH_ENDPOINT/_cat/indices"
```

**Expected output**:
```
green open episodes 0 0 0 0 1.2kb 1.2kb
```

### Save Information

```
OpenSearch Endpoint: https://brd-opensearch-dev.us-east-1.es.amazonaws.com
Username: admin
Password: [your-strong-password]
Index: episodes
Status: GREEN
```

**✓ PART 2 COMPLETE** (80 min elapsed, mostly background provisioning)

---

## Part 3: SQS Queues Setup (20 minutes)

### Get Your AWS Account ID

```bash
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "Your Account ID: $AWS_ACCOUNT_ID"
```

### Create Dead Letter Queue (DLQ)

```bash
# Create DLQ
aws sqs create-queue \
  --queue-name brd-job-dlq-dev \
  --attributes \
    MessageRetentionPeriod=1209600 \
    VisibilityTimeout=300

# Get DLQ URL
aws sqs get-queue-url --queue-name brd-job-dlq-dev
```

**Save DLQ URL**: `https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/brd-job-dlq-dev`

### Create Main Job Queue with Redrive Policy

```bash
# Get DLQ ARN first
DLQ_ARN=$(aws sqs get-queue-attributes \
  --queue-url "https://sqs.us-east-1.amazonaws.com/$AWS_ACCOUNT_ID/brd-job-dlq-dev" \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' \
  --output text)

# Create main queue with DLQ redrive
aws sqs create-queue \
  --queue-name brd-job-queue-dev \
  --attributes \
    MessageRetentionPeriod=1209600,VisibilityTimeout=300,"RedrivePolicy={\"deadLetterTargetArn\":\"$DLQ_ARN\",\"maxReceiveCount\":3}"

# Get main queue URL
aws sqs get-queue-url --queue-name brd-job-queue-dev
```

**Save Main Queue URL**: `https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/brd-job-queue-dev`

### Create Additional Specialized Queues

```bash
# Index queue (for OpenSearch indexing operations)
aws sqs create-queue \
  --queue-name brd-index-queue-dev \
  --attributes VisibilityTimeout=300

# Thumbnail queue (for Lambda thumbnail processing, longer timeout)
aws sqs create-queue \
  --queue-name brd-thumbnail-queue-dev \
  --attributes VisibilityTimeout=600

# Get their URLs
INDEX_QUEUE=$(aws sqs get-queue-url --queue-name brd-index-queue-dev --query 'QueueUrl' --output text)
THUMB_QUEUE=$(aws sqs get-queue-url --queue-name brd-thumbnail-queue-dev --query 'QueueUrl' --output text)

echo "Index Queue: $INDEX_QUEUE"
echo "Thumbnail Queue: $THUMB_QUEUE"
```

### Verify All Queues

```bash
aws sqs list-queues --queue-name-prefix brd-
```

**Expected output**:
```json
{
  "QueueUrls": [
    "https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/brd-index-queue-dev",
    "https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/brd-job-dlq-dev",
    "https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/brd-job-queue-dev",
    "https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/brd-thumbnail-queue-dev"
  ]
}
```

### Save Information

```
Main Queue: https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/brd-job-queue-dev
DLQ: https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/brd-job-dlq-dev
Index Queue: https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/brd-index-queue-dev
Thumbnail Queue: https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/brd-thumbnail-queue-dev
DLQ Redrive: Configured (3 retries max)
Visibility Timeout: 300 seconds (main), 600 seconds (thumbnail)
```

**✓ PART 3 COMPLETE** (100 min elapsed)

---

## Part 4: IAM Roles & Policies Setup (30 minutes)

### Create IAM Policy for Application

**Step 1**: Create policy document file

Create file `aws-iam-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::brd-episodes-dev",
        "arn:aws:s3:::brd-episodes-dev/*",
        "arn:aws:s3:::brd-thumbnails-dev",
        "arn:aws:s3:::brd-thumbnails-dev/*",
        "arn:aws:s3:::brd-scripts-dev",
        "arn:aws:s3:::brd-scripts-dev/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "sqs:SendMessage",
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:ChangeMessageVisibility",
        "sqs:GetQueueAttributes"
      ],
      "Resource": [
        "arn:aws:sqs:us-east-1:ACCOUNT_ID:brd-job-queue-dev",
        "arn:aws:sqs:us-east-1:ACCOUNT_ID:brd-job-dlq-dev",
        "arn:aws:sqs:us-east-1:ACCOUNT_ID:brd-index-queue-dev",
        "arn:aws:sqs:us-east-1:ACCOUNT_ID:brd-thumbnail-queue-dev"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "es:ESHttpPut",
        "es:ESHttpPost",
        "es:ESHttpDelete",
        "es:ESHttpGet"
      ],
      "Resource": "arn:aws:es:us-east-1:ACCOUNT_ID:domain/brd-opensearch-dev/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "mediaconvert:CreateJob",
        "mediaconvert:GetJob",
        "mediaconvert:ListJobs"
      ],
      "Resource": "arn:aws:mediaconvert:us-east-1:ACCOUNT_ID:*"
    }
  ]
}
```

**Replace ACCOUNT_ID** with your actual AWS Account ID

**Step 2**: Create the policy

```bash
aws iam create-policy \
  --policy-name brd-phase2-app-policy \
  --policy-document file://aws-iam-policy.json
```

**Save Policy ARN**:
```
arn:aws:iam::ACCOUNT_ID:policy/brd-phase2-app-policy
```

### Attach Policy to EC2 Instance

```bash
# Get the IAM role of your EC2 instance (from Phase 0 setup)
# Usually: episode-api-role or similar
ROLE_NAME="episode-api-role"  # Update if different

# Attach policy
aws iam attach-role-policy \
  --role-name $ROLE_NAME \
  --policy-arn arn:aws:iam::$AWS_ACCOUNT_ID:policy/brd-phase2-app-policy

# Verify it's attached
aws iam list-attached-role-policies --role-name $ROLE_NAME
```

### Save Information

```
Application Policy ARN: arn:aws:iam::ACCOUNT_ID:policy/brd-phase2-app-policy
Permissions:
  ✓ S3: Get, Put, Delete, List
  ✓ SQS: Send, Receive, Delete, ChangeVisibility, GetAttributes
  ✓ OpenSearch: All HTTP operations
  ✓ MediaConvert: Create, Get, List
Status: Attached to episode-api-role
```

**✓ PART 4 COMPLETE** (130 min elapsed)

---

## Part 5: MediaConvert Setup (20 minutes)

### Create MediaConvert Queue

```bash
# Create on-demand queue (no hourly charges)
aws mediaconvert create-queue \
  --name brd-video-queue-dev \
  --description "Episode video processing queue"
```

**Save Queue ARN** from response

### Create Job Template for Thumbnail Extraction

```bash
# Create template
aws mediaconvert create-job-template \
  --name brd-thumbnail-template \
  --description "Extract single frame for episode thumbnail" \
  --settings '{
    "OutputGroups": [
      {
        "Name": "File Group",
        "OutputGroupSettings": {
          "Type": "FILE_GROUP_SETTINGS",
          "FileGroupSettings": {
            "Destination": "s3://brd-thumbnails-dev/"
          }
        },
        "Outputs": [
          {
            "VideoDescription": {
              "Width": 320,
              "Height": 180,
              "CodecSettings": {
                "Codec": "H_264",
                "H264Settings": {
                  "FrameRate": 1,
                  "MaxBitrate": 500000
                }
              }
            },
            "NameModifier": "-thumb-1"
          }
        ]
      }
    ],
    "TimecodeConfig": {
      "Source": "ZEROBASED"
    }
  }'
```

### Verify Template Created

```bash
aws mediaconvert list-job-templates --query 'JobTemplates[?name==`brd-thumbnail-template`]'
```

### Save Information

```
MediaConvert Queue: brd-video-queue-dev
Job Template: brd-thumbnail-template
Output Format: H.264 video (320x180)
Destination: s3://brd-thumbnails-dev/
```

**✓ PART 5 COMPLETE** (150 min elapsed)

---

## Part 6: Lambda Function Setup (40 minutes)

### Step 1: Create Lambda Execution Role

**Create trust policy file** `lambda-trust-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

**Create the role**:

```bash
aws iam create-role \
  --role-name brd-lambda-execution-role \
  --assume-role-policy-document file://lambda-trust-policy.json

# Save Role ARN
LAMBDA_ROLE_ARN=$(aws iam get-role \
  --role-name brd-lambda-execution-role \
  --query 'Role.Arn' \
  --output text)
echo "Lambda Role ARN: $LAMBDA_ROLE_ARN"
```

**Attach execution policy**:

```bash
# Basic Lambda execution (CloudWatch Logs)
aws iam attach-role-policy \
  --role-name brd-lambda-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Application policy (S3, SQS, OpenSearch)
aws iam attach-role-policy \
  --role-name brd-lambda-execution-role \
  --policy-arn arn:aws:iam::$AWS_ACCOUNT_ID:policy/brd-phase2-app-policy
```

### Step 2: Create Lambda Function

```bash
# Create basic Node.js Lambda function package
# Create temporary directory
mkdir -p lambda-package
cd lambda-package

# Create index.js
cat > index.js << 'EOF'
exports.handler = async (event) => {
  console.log('Thumbnail Processor Lambda triggered');
  console.log('Event:', JSON.stringify(event));
  
  // Process S3 event or SQS message
  if (event.Records) {
    for (const record of event.Records) {
      if (record.s3) {
        console.log(`Processing S3 object: ${record.s3.object.key}`);
      } else if (record.eventSource === 'aws:sqs') {
        console.log(`Processing SQS message: ${record.body}`);
      }
    }
  }
  
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Processed successfully' })
  };
};
EOF

# Create deployment package
zip lambda-function.zip index.js
cd ..

# Create Lambda function
aws lambda create-function \
  --function-name brd-thumbnail-processor-dev \
  --runtime nodejs18.x \
  --role $LAMBDA_ROLE_ARN \
  --handler index.handler \
  --zip-file fileb://lambda-package/lambda-function.zip \
  --timeout 300 \
  --memory-size 512 \
  --environment Variables='{
    S3_BUCKET=brd-thumbnails-dev,
    SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/'"$AWS_ACCOUNT_ID"'/brd-thumbnail-queue-dev,
    OPENSEARCH_ENDPOINT=https://brd-opensearch-dev.us-east-1.es.amazonaws.com
  }'

# Save Function ARN
LAMBDA_ARN=$(aws lambda get-function \
  --function-name brd-thumbnail-processor-dev \
  --query 'Configuration.FunctionArn' \
  --output text)
echo "Lambda Function ARN: $LAMBDA_ARN"
```

### Step 3: Create S3 Trigger for Lambda

```bash
# Add S3 invocation permission to Lambda
aws lambda add-permission \
  --function-name brd-thumbnail-processor-dev \
  --statement-id AllowS3Invocation \
  --action lambda:InvokeFunction \
  --principal s3.amazonaws.com \
  --source-arn arn:aws:s3:::brd-episodes-dev

# Create S3 event notification config
cat > s3-event-config.json << 'EOF'
{
  "LambdaFunctionConfigurations": [
    {
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [
            {
              "Name": "prefix",
              "Value": "uploads/"
            },
            {
              "Name": "suffix",
              "Value": ".mp4"
            }
          ]
        }
      },
      "LambdaFunctionArn": "'"$LAMBDA_ARN"'"
    }
  ]
}
EOF

# Apply S3 event notification
aws s3api put-bucket-notification-configuration \
  --bucket brd-episodes-dev \
  --notification-configuration file://s3-event-config.json
```

### Verify S3 Trigger Configuration

```bash
# Check that notification is configured
aws s3api get-bucket-notification-configuration --bucket brd-episodes-dev
```

**Expected output** (should show Lambda configuration):
```json
{
  "LambdaFunctionConfigurations": [
    {
      "Events": ["s3:ObjectCreated:*"],
      "LambdaFunctionArn": "arn:aws:lambda:us-east-1:ACCOUNT_ID:function:brd-thumbnail-processor-dev",
      "Filter": {
        "Key": {
          "FilterRules": [
            {"Name": "prefix", "Value": "uploads/"},
            {"Name": "suffix", "Value": ".mp4"}
          ]
        }
      }
    }
  ]
}
```

### Save Information

```
Lambda Function Name: brd-thumbnail-processor-dev
Lambda Role ARN: arn:aws:iam::ACCOUNT_ID:role/brd-lambda-execution-role
Lambda Function ARN: arn:aws:lambda:us-east-1:ACCOUNT_ID:function:brd-thumbnail-processor-dev
S3 Trigger: ENABLED on brd-episodes-dev (prefix: uploads/, suffix: .mp4)
Timeout: 300 seconds
Memory: 512 MB
Environment:
  - S3_BUCKET: brd-thumbnails-dev
  - SQS_QUEUE_URL: [main queue URL]
  - OPENSEARCH_ENDPOINT: [OpenSearch endpoint]
```

**✓ PART 6 COMPLETE** (190 min elapsed = ~3.2 hours total)

---

## Final Verification Checklist

Run these commands to verify everything:

```bash
# 1. ✓ S3 Buckets
echo "1. S3 Buckets:"
aws s3 ls | grep brd-
echo ""

# 2. ✓ OpenSearch Domain
echo "2. OpenSearch Domain:"
aws opensearch describe-domain --domain-name brd-opensearch-dev \
  --query 'DomainStatus.[DomainName,DomainStatus]' --output text
echo ""

# 3. ✓ SQS Queues
echo "3. SQS Queues:"
aws sqs list-queues --queue-name-prefix brd- --output text
echo ""

# 4. ✓ Lambda Function
echo "4. Lambda Function:"
aws lambda get-function --function-name brd-thumbnail-processor-dev \
  --query 'Configuration.[FunctionName,Runtime,MemorySize,Timeout]' --output text
echo ""

# 5. ✓ IAM Policy
echo "5. IAM Policy:"
aws iam get-policy --policy-arn arn:aws:iam::$AWS_ACCOUNT_ID:policy/brd-phase2-app-policy \
  --query 'Policy.[PolicyName,CreateDate]' --output text
echo ""

echo "✓ All AWS resources provisioned successfully!"
```

---

## Environment Configuration (.env.phase2)

Create `.env.phase2` in your project root:

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=<your-account-id>

# S3 Configuration
S3_EPISODES_BUCKET=brd-episodes-dev
S3_THUMBNAILS_BUCKET=brd-thumbnails-dev
S3_SCRIPTS_BUCKET=brd-scripts-dev
S3_UPLOAD_TIMEOUT=3600
S3_SIGNED_URL_EXPIRY=3600

# OpenSearch Configuration
OPENSEARCH_ENDPOINT=https://brd-opensearch-dev.us-east-1.es.amazonaws.com
OPENSEARCH_USERNAME=admin
OPENSEARCH_PASSWORD=<your-opensearch-password>
OPENSEARCH_INDEX_PREFIX=brd-
OPENSEARCH_BATCH_SIZE=100

# SQS Configuration
SQS_JOB_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/<account-id>/brd-job-queue-dev
SQS_INDEX_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/<account-id>/brd-index-queue-dev
SQS_THUMBNAIL_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/<account-id>/brd-thumbnail-queue-dev
SQS_DLQ_URL=https://sqs.us-east-1.amazonaws.com/<account-id>/brd-job-dlq-dev
SQS_VISIBILITY_TIMEOUT=300
SQS_MAX_RETRIES=3
SQS_POLL_INTERVAL=1000

# Lambda Configuration
LAMBDA_FUNCTION_NAME=brd-thumbnail-processor-dev
LAMBDA_TIMEOUT=300
LAMBDA_MEMORY=512

# MediaConvert Configuration
MEDIACONVERT_QUEUE_ARN=arn:aws:mediaconvert:us-east-1:<account-id>:queues/brd-video-queue-dev

# Feature Flags
ENABLE_S3_UPLOADS=true
ENABLE_OPENSEARCH=true
ENABLE_SQS_JOBS=true
ENABLE_LAMBDA_PROCESSING=true
```

---

## Next Steps (Phase 2B)

Once Part 6 is complete:

1. ✓ Save all AWS endpoint URLs and credentials
2. ✓ Create `.env.phase2` with values from above
3. ✓ Run database migrations: `npm run migrate`
4. ✓ Install Phase 2 dependencies: `npm install aws-sdk @opensearch-project/opensearch multer sharp uuid`
5. → Start Phase 2B: S3 File Service Implementation

---

## Troubleshooting

### S3 Upload Fails
```bash
# Check bucket exists and is accessible
aws s3api head-bucket --bucket brd-episodes-dev

# Check CORS if needed
aws s3api get-bucket-cors --bucket brd-episodes-dev
```

### OpenSearch Connection Error
```bash
# Check domain status
aws opensearch describe-domain --domain-name brd-opensearch-dev

# Check security groups
aws ec2 describe-security-groups --filters "Name=group-name,Values=*opensearch*"
```

### SQS Messages Not Processing
```bash
# Check queue depth
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/$AWS_ACCOUNT_ID/brd-job-queue-dev \
  --attribute-names ApproximateNumberOfMessages

# Check DLQ for failed messages
aws sqs receive-message \
  --queue-url https://sqs.us-east-1.amazonaws.com/$AWS_ACCOUNT_ID/brd-job-dlq-dev
```

### Lambda Not Triggered
```bash
# Check S3 notification configuration
aws s3api get-bucket-notification-configuration --bucket brd-episodes-dev

# Check CloudWatch Logs
aws logs tail /aws/lambda/brd-thumbnail-processor-dev --follow
```

---

## Summary

✓ **Part 1**: S3 Buckets (episodes, thumbnails, scripts)
✓ **Part 2**: OpenSearch Domain (t3.small, 100GB)
✓ **Part 3**: SQS Queues (main, DLQ, index, thumbnail)
✓ **Part 4**: IAM Policies (S3, SQS, OpenSearch permissions)
✓ **Part 5**: MediaConvert Queue & Template
✓ **Part 6**: Lambda Function (thumbnail processor + S3 trigger)

**Total Time**: ~190 minutes (3.2 hours)
**Status**: Ready for Phase 2B Development

Next: Install dependencies and run migrations for Phase 2B implementation.
