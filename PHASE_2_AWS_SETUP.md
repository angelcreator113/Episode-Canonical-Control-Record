# Phase 2 AWS Resource Provisioning Guide

**Target**: Set up all AWS resources for S3, OpenSearch, SQS, Lambda, and MediaConvert integration.

---

## Part 1: S3 Buckets Setup (30 minutes)

### Step 1: Create Development Buckets

Run in AWS CLI:

```bash
# Episode clips bucket
aws s3api create-bucket \
  --bucket brd-episodes-dev \
  --region us-east-1 \
  --acl private

# Thumbnail bucket
aws s3api create-bucket \
  --bucket brd-thumbnails-dev \
  --region us-east-1 \
  --acl private

# Scripts/metadata bucket
aws s3api create-bucket \
  --bucket brd-scripts-dev \
  --region us-east-1 \
  --acl private
```

### Step 2: Configure Bucket Lifecycle Policies

```bash
# Set up versioning
aws s3api put-bucket-versioning \
  --bucket brd-episodes-dev \
  --versioning-configuration Status=Enabled

# Set up lifecycle (archive old versions)
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

### Step 3: Enable S3 Event Notifications for Lambda

```bash
# Create SNS topic for S3 notifications
aws sns create-topic --name brd-s3-events-dev

# Get topic ARN
aws sns list-topics
```

**Save SNS Topic ARN** for Lambda setup.

---

## Part 2: OpenSearch Domain Setup (1-2 hours, runs in background)

### Step 1: Create OpenSearch Domain

**AWS Console**: Services → OpenSearch Service → Create domain

**Configuration**:
```
Domain name: brd-opensearch-dev
Version: 2.7 (latest stable)
Deployment type: Development and testing
Instance type: t3.small.elasticsearch
Number of nodes: 1
Dedicated master node: Disabled
Storage: 100 GB EBS volume

Network: VPC (same as RDS)
Security groups: Allow inbound from application security group
Encryption: Enable at rest
Fine-grained access: Enabled (default admin user)

Username: admin
Password: Generate strong password
```

**Save Domain Endpoint**: `https://brd-opensearch-dev.us-east-1.es.amazonaws.com`

### Step 2: Create OpenSearch Index

Wait for domain to be active (10-30 minutes), then run:

```bash
# Set up environment variable
export OPENSEARCH_ENDPOINT="https://brd-opensearch-dev.us-east-1.es.amazonaws.com"
export OPENSEARCH_USER="admin"
export OPENSEARCH_PASSWORD="your-password"

# Create index mapping
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

**Verify index created**:
```bash
curl -u $OPENSEARCH_USER:$OPENSEARCH_PASSWORD \
  "$OPENSEARCH_ENDPOINT/_cat/indices"
```

---

## Part 3: SQS Queue Setup (20 minutes)

### Step 1: Create Dead Letter Queue (DLQ)

```bash
# Create DLQ
aws sqs create-queue \
  --queue-name brd-job-dlq-dev \
  --attributes \
    MessageRetentionPeriod=1209600 \
    VisibilityTimeout=300

# Get DLQ URL and ARN
aws sqs get-queue-attributes \
  --queue-url "https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/brd-job-dlq-dev" \
  --attribute-names QueueArn

# Save DLQ ARN
```

### Step 2: Create Main Job Queue

```bash
# Create main queue
aws sqs create-queue \
  --queue-name brd-job-queue-dev \
  --attributes \
    MessageRetentionPeriod=1209600 \
    VisibilityTimeout=300 \
    "RedrivePolicy={\"deadLetterTargetArn\":\"arn:aws:sqs:us-east-1:ACCOUNT_ID:brd-job-dlq-dev\",\"maxReceiveCount\":3}"

# Get Queue URL
aws sqs get-queue-url --queue-name brd-job-queue-dev
```

**Save Queue URL**: `https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/brd-job-queue-dev`

### Step 3: Create Additional Queues (for different job types)

```bash
# Index queue (for OpenSearch indexing)
aws sqs create-queue \
  --queue-name brd-index-queue-dev \
  --attributes VisibilityTimeout=300

# Thumbnail queue (for Lambda processing)
aws sqs create-queue \
  --queue-name brd-thumbnail-queue-dev \
  --attributes VisibilityTimeout=600

# Get their URLs
aws sqs get-queue-url --queue-name brd-index-queue-dev
aws sqs get-queue-url --queue-name brd-thumbnail-queue-dev
```

---

## Part 4: IAM Roles & Policies Setup (30 minutes)

### Step 1: Create IAM Policy for Application

```bash
# Save policy to file: s3-opensearch-sqs-policy.json
aws iam create-policy \
  --policy-name brd-phase2-app-policy \
  --policy-document file://policy-document.json
```

**Create file** `s3-opensearch-sqs-policy.json`:

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
        "elastictranscoder:CreateJob",
        "elastictranscoder:ReadJob",
        "elastictranscoder:ListJobs"
      ],
      "Resource": "*"
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

### Step 2: Attach Policy to EC2 Instance Role

```bash
# Get current IAM role (likely from earlier setup)
aws ec2 describe-instances --filters "Name=tag:Name,Values=episode-api-dev" \
  --query 'Reservations[0].Instances[0].IamInstanceProfile.Arn'

# Attach policy to role
aws iam attach-role-policy \
  --role-name episode-api-role \
  --policy-arn arn:aws:iam::ACCOUNT_ID:policy/brd-phase2-app-policy
```

---

## Part 5: MediaConvert Setup (for Lambda) (20 minutes)

### Step 1: Create MediaConvert Queue

```bash
# Create on-demand queue (no hourly costs)
aws mediaconvert create-queue \
  --name brd-video-queue-dev \
  --description "Episode video processing queue"

# Get queue ARN
aws mediaconvert list-queues
```

### Step 2: Create MediaConvert Job Template

```bash
# Create template for thumbnail extraction
aws mediaconvert create-job-template \
  --name brd-thumbnail-template \
  --description "Extract video frame for thumbnail" \
  --settings file://mediaconvert-template.json
```

**Create file** `mediaconvert-template.json`:

```json
{
  "OutputGroups": [
    {
      "Name": "File Group",
      "OutputGroupSettings": {
        "Type": "FILE_GROUP_SETTINGS",
        "FileGroupSettings": {
          "Destination": "s3://brd-thumbnails-dev/",
          "DestinationSettings": {
            "S3Settings": {}
          }
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
}
```

---

## Part 6: Lambda Function Setup (40 minutes)

### Step 1: Create Lambda Execution Role

```bash
# Create role
aws iam create-role \
  --role-name brd-lambda-execution-role \
  --assume-role-policy-document file://lambda-trust-policy.json

# Create lambda-trust-policy.json
cat > lambda-trust-policy.json << 'EOF'
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
EOF

# Attach policies
aws iam attach-role-policy \
  --role-name brd-lambda-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

aws iam attach-role-policy \
  --role-name brd-lambda-execution-role \
  --policy-arn arn:aws:iam::ACCOUNT_ID:policy/brd-phase2-app-policy
```

### Step 2: Create Lambda Function for Thumbnail Processing

```bash
# Package Lambda function
cd src/lambda/thumbnail-processor
npm install
zip -r ../../lambda-function.zip .

# Create function
aws lambda create-function \
  --function-name brd-thumbnail-processor-dev \
  --runtime nodejs18.x \
  --role arn:aws:iam::ACCOUNT_ID:role/brd-lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://lambda-function.zip \
  --timeout 300 \
  --memory-size 512 \
  --environment Variables='{
    S3_BUCKET=brd-thumbnails-dev,
    MEDIACONVERT_ROLE_ARN=arn:aws:iam::ACCOUNT_ID:role/brd-mediaconvert-role,
    SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/brd-thumbnail-queue-dev
  }'
```

### Step 3: Create S3 Trigger for Lambda

```bash
# Add Lambda permission to be invoked by S3
aws lambda add-permission \
  --function-name brd-thumbnail-processor-dev \
  --statement-id AllowS3Invocation \
  --action lambda:InvokeFunction \
  --principal s3.amazonaws.com \
  --source-arn arn:aws:s3:::brd-episodes-dev

# Add S3 event notification
aws s3api put-bucket-notification-configuration \
  --bucket brd-episodes-dev \
  --notification-configuration file://s3-event-config.json
```

**Create** `s3-event-config.json`:

```json
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
      "LambdaFunctionArn": "arn:aws:lambda:us-east-1:ACCOUNT_ID:function:brd-thumbnail-processor-dev"
    }
  ]
}
```

---

## Part 7: Environment Variables Configuration

Create `.env.phase2`:

```bash
# S3 Configuration
AWS_REGION=us-east-1
S3_EPISODES_BUCKET=brd-episodes-dev
S3_THUMBNAILS_BUCKET=brd-thumbnails-dev
S3_SCRIPTS_BUCKET=brd-scripts-dev
S3_UPLOAD_TIMEOUT=3600
S3_SIGNED_URL_EXPIRY=3600

# File Size Limits
UPLOAD_LIMIT_VIDEO_SOFT=5368709120
UPLOAD_LIMIT_VIDEO_HARD=10737418240
UPLOAD_LIMIT_IMAGE_SOFT=10485760
UPLOAD_LIMIT_IMAGE_HARD=26214400
UPLOAD_LIMIT_SCRIPT_SOFT=1048576
UPLOAD_LIMIT_SCRIPT_HARD=5242880

# OpenSearch Configuration
OPENSEARCH_ENDPOINT=https://brd-opensearch-dev.us-east-1.es.amazonaws.com
OPENSEARCH_USERNAME=admin
OPENSEARCH_PASSWORD=your-secure-password
OPENSEARCH_INDEX_PREFIX=brd-
OPENSEARCH_BATCH_SIZE=100
OPENSEARCH_BULK_INTERVAL=5000

# SQS Configuration
SQS_JOB_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/brd-job-queue-dev
SQS_INDEX_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/brd-index-queue-dev
SQS_THUMBNAIL_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/brd-thumbnail-queue-dev
SQS_DLQ_URL=https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/brd-job-dlq-dev
SQS_VISIBILITY_TIMEOUT=300
SQS_MAX_RETRIES=3
SQS_POLL_INTERVAL=1000
SQS_BATCH_SIZE=10
SQS_WORKER_CONCURRENCY=5

# MediaConvert Configuration
MEDIACONVERT_ROLE_ARN=arn:aws:iam::ACCOUNT_ID:role/brd-mediaconvert-role
MEDIACONVERT_QUEUE_ARN=arn:aws:mediaconvert:us-east-1:ACCOUNT_ID:queues/brd-video-queue-dev
MEDIACONVERT_TEMPLATE_NAME=brd-thumbnail-template

# Lambda Configuration
LAMBDA_FUNCTION_NAME=brd-thumbnail-processor-dev
LAMBDA_TIMEOUT=300
LAMBDA_MEMORY=512

# Feature Flags
ENABLE_S3_UPLOADS=true
ENABLE_OPENSEARCH=true
ENABLE_SQS_JOBS=true
ENABLE_LAMBDA_PROCESSING=true
ENABLE_SHARP_COMPOSITING=true
```

---

## Part 8: Verification Checklist

Run these commands to verify everything is set up:

```bash
# 1. Verify S3 buckets
aws s3 ls | grep brd-

# 2. Verify OpenSearch domain
aws opensearch describe-domain --domain-name brd-opensearch-dev

# 3. Verify SQS queues
aws sqs list-queues --queue-name-prefix brd-

# 4. Verify Lambda function
aws lambda get-function --function-name brd-thumbnail-processor-dev

# 5. Test S3 connection
aws s3api head-bucket --bucket brd-episodes-dev

# 6. Test OpenSearch connection
curl -u admin:password https://brd-opensearch-dev.us-east-1.es.amazonaws.com/_cluster/health

# 7. Test SQS
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/brd-job-queue-dev \
  --attribute-names All
```

---

## Cost Estimate (Monthly)

| Service | Usage | Cost |
|---------|-------|------|
| S3 | 500 GB stored | ~$12 |
| OpenSearch | 1 node t3.small + 100 GB | ~$80 |
| SQS | 1M requests/month | ~$0.40 |
| Lambda | 1000 executions/month | ~$0.20 |
| MediaConvert | 100 minutes processing | ~$12 |
| **Total** | | **~$105/month** |

---

## Troubleshooting

### S3 Upload Fails
```bash
# Check bucket exists
aws s3 ls brd-episodes-dev

# Check CORS (if from browser)
aws s3api get-bucket-cors --bucket brd-episodes-dev
```

### OpenSearch Connection Error
```bash
# Check domain status
aws opensearch describe-domain --domain-name brd-opensearch-dev

# Check security groups
aws ec2 describe-security-groups
```

### SQS Messages Not Processing
```bash
# Check queue depth
aws sqs get-queue-attributes \
  --queue-url <QUEUE_URL> \
  --attribute-names ApproximateNumberOfMessages

# Check DLQ
aws sqs receive-message --queue-url <DLQ_URL>
```

---

## Next Steps

1. **Complete all AWS setup above** (2-3 hours total)
2. **Save all resource ARNs/URLs** to a secure document
3. **Update .env.phase2** with actual values
4. **Run verification checklist** to confirm
5. **Ready for Phase 2 development!**

**Timeline**: Complete by Day 1 of Phase 2 development.
