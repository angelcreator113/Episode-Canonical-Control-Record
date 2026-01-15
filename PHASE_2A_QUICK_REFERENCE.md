# Phase 2A: Quick Command Reference

## Part 1: S3 Buckets (30 min)

```bash
# Create buckets
aws s3api create-bucket --bucket brd-episodes-dev --region us-east-1 --acl private
aws s3api create-bucket --bucket brd-thumbnails-dev --region us-east-1 --acl private
aws s3api create-bucket --bucket brd-scripts-dev --region us-east-1 --acl private

# Enable versioning
aws s3api put-bucket-versioning --bucket brd-episodes-dev --versioning-configuration Status=Enabled
aws s3api put-bucket-versioning --bucket brd-thumbnails-dev --versioning-configuration Status=Enabled
aws s3api put-bucket-versioning --bucket brd-scripts-dev --versioning-configuration Status=Enabled

# Verify
aws s3 ls | grep brd-
```

## Part 2: OpenSearch (1-2 hours, mostly waiting)

**ACTION**: Use AWS Console → OpenSearch Service → Create domain
- Domain: `brd-opensearch-dev`
- Type: `t3.small.elasticsearch`
- Storage: `100 GB`
- Fine-grained access: ✓ Enabled
- **WAIT for ACTIVE status** (10-30 min)

```bash
# Once active, test connection
OPENSEARCH_ENDPOINT="https://brd-opensearch-dev.us-east-1.es.amazonaws.com"
OPENSEARCH_USER="admin"
OPENSEARCH_PASSWORD="your-password"

curl -u $OPENSEARCH_USER:$OPENSEARCH_PASSWORD "$OPENSEARCH_ENDPOINT/_cluster/health"

# Create episodes index
curl -u $OPENSEARCH_USER:$OPENSEARCH_PASSWORD -X PUT "$OPENSEARCH_ENDPOINT/episodes" \
  -H "Content-Type: application/json" \
  -d '{"settings":{"number_of_shards":1,"number_of_replicas":0},"mappings":{"properties":{"id":{"type":"keyword"},"showName":{"type":"text"},"episodeTitle":{"type":"text"},"description":{"type":"text"},"status":{"type":"keyword"},"tags":{"type":"keyword"},"categories":{"type":"keyword"},"createdAt":{"type":"date"},"updatedAt":{"type":"date"}}}}'
```

## Part 3: SQS Queues (20 min)

```bash
# Get account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Create DLQ
aws sqs create-queue --queue-name brd-job-dlq-dev --attributes MessageRetentionPeriod=1209600,VisibilityTimeout=300

# Get DLQ ARN
DLQ_ARN=$(aws sqs get-queue-attributes --queue-url "https://sqs.us-east-1.amazonaws.com/$AWS_ACCOUNT_ID/brd-job-dlq-dev" --attribute-names QueueArn --query 'Attributes.QueueArn' --output text)

# Create main queue with redrive
aws sqs create-queue --queue-name brd-job-queue-dev --attributes MessageRetentionPeriod=1209600,VisibilityTimeout=300,"RedrivePolicy={\"deadLetterTargetArn\":\"$DLQ_ARN\",\"maxReceiveCount\":3}"

# Create specialty queues
aws sqs create-queue --queue-name brd-index-queue-dev --attributes VisibilityTimeout=300
aws sqs create-queue --queue-name brd-thumbnail-queue-dev --attributes VisibilityTimeout=600

# Verify
aws sqs list-queues --queue-name-prefix brd-
```

## Part 4: IAM Policies (30 min)

```bash
# Create and save policy file first (see PHASE_2A_EXECUTION_GUIDE.md)
# Then:

aws iam create-policy \
  --policy-name brd-phase2-app-policy \
  --policy-document file://aws-iam-policy.json

# Attach to your EC2 instance role
aws iam attach-role-policy \
  --role-name episode-api-role \
  --policy-arn arn:aws:iam::$AWS_ACCOUNT_ID:policy/brd-phase2-app-policy
```

## Part 5: MediaConvert (20 min)

```bash
# Create queue
aws mediaconvert create-queue \
  --name brd-video-queue-dev \
  --description "Episode video processing queue"

# Create job template
aws mediaconvert create-job-template \
  --name brd-thumbnail-template \
  --description "Extract single frame for episode thumbnail" \
  --settings '{"OutputGroups":[{"Name":"File Group","OutputGroupSettings":{"Type":"FILE_GROUP_SETTINGS","FileGroupSettings":{"Destination":"s3://brd-thumbnails-dev/"}},"Outputs":[{"VideoDescription":{"Width":320,"Height":180,"CodecSettings":{"Codec":"H_264","H264Settings":{"FrameRate":1,"MaxBitrate":500000}}},"NameModifier":"-thumb-1"}]}],"TimecodeConfig":{"Source":"ZEROBASED"}}'
```

## Part 6: Lambda Function (40 min)

```bash
# Create lambda role
cat > lambda-trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

aws iam create-role \
  --role-name brd-lambda-execution-role \
  --assume-role-policy-document file://lambda-trust-policy.json

# Attach policies
aws iam attach-role-policy \
  --role-name brd-lambda-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

aws iam attach-role-policy \
  --role-name brd-lambda-execution-role \
  --policy-arn arn:aws:iam::$AWS_ACCOUNT_ID:policy/brd-phase2-app-policy

# Get role ARN
LAMBDA_ROLE_ARN=$(aws iam get-role --role-name brd-lambda-execution-role --query 'Role.Arn' --output text)

# Create lambda function (create function zip first - see guide)
aws lambda create-function \
  --function-name brd-thumbnail-processor-dev \
  --runtime nodejs18.x \
  --role $LAMBDA_ROLE_ARN \
  --handler index.handler \
  --zip-file fileb://lambda-package/lambda-function.zip \
  --timeout 300 \
  --memory-size 512 \
  --environment "Variables={S3_BUCKET=brd-thumbnails-dev,SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/$AWS_ACCOUNT_ID/brd-thumbnail-queue-dev,OPENSEARCH_ENDPOINT=https://brd-opensearch-dev.us-east-1.es.amazonaws.com}"

# Get Lambda ARN
LAMBDA_ARN=$(aws lambda get-function --function-name brd-thumbnail-processor-dev --query 'Configuration.FunctionArn' --output text)

# Add S3 permission
aws lambda add-permission \
  --function-name brd-thumbnail-processor-dev \
  --statement-id AllowS3Invocation \
  --action lambda:InvokeFunction \
  --principal s3.amazonaws.com \
  --source-arn arn:aws:s3:::brd-episodes-dev

# Create S3 event config and apply
cat > s3-event-config.json << 'EOF'
{"LambdaFunctionConfigurations":[{"Events":["s3:ObjectCreated:*"],"Filter":{"Key":{"FilterRules":[{"Name":"prefix","Value":"uploads/"},{"Name":"suffix","Value":".mp4"}]}},"LambdaFunctionArn":"LAMBDA_ARN_HERE"}]}
EOF

# Replace LAMBDA_ARN_HERE with actual ARN
aws s3api put-bucket-notification-configuration \
  --bucket brd-episodes-dev \
  --notification-configuration file://s3-event-config.json
```

## Final Verification

```bash
# Verify all resources
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "=== S3 BUCKETS ==="
aws s3 ls | grep brd-

echo "=== OPENSEARCH ==="
aws opensearch describe-domain --domain-name brd-opensearch-dev --query 'DomainStatus.DomainStatus' --output text

echo "=== SQS QUEUES ==="
aws sqs list-queues --queue-name-prefix brd- --output text

echo "=== LAMBDA FUNCTION ==="
aws lambda get-function --function-name brd-thumbnail-processor-dev --query 'Configuration.FunctionName' --output text

echo "=== IAM POLICY ==="
aws iam get-policy --policy-arn arn:aws:iam::$AWS_ACCOUNT_ID:policy/brd-phase2-app-policy --query 'Policy.PolicyName' --output text

echo ""
echo "✓ Phase 2A Complete!"
```

## Save These Values

After each part, save to notes:

```
Part 1 (S3):
- Bucket 1: brd-episodes-dev
- Bucket 2: brd-thumbnails-dev
- Bucket 3: brd-scripts-dev

Part 2 (OpenSearch):
- Endpoint: https://brd-opensearch-dev.us-east-1.es.amazonaws.com
- Username: admin
- Password: [your-password]

Part 3 (SQS):
- Main Queue: https://sqs.us-east-1.amazonaws.com/[ACCOUNT_ID]/brd-job-queue-dev
- DLQ: https://sqs.us-east-1.amazonaws.com/[ACCOUNT_ID]/brd-job-dlq-dev
- Index Queue: https://sqs.us-east-1.amazonaws.com/[ACCOUNT_ID]/brd-index-queue-dev
- Thumbnail Queue: https://sqs.us-east-1.amazonaws.com/[ACCOUNT_ID]/brd-thumbnail-queue-dev

Part 4 (IAM):
- Policy ARN: arn:aws:iam::[ACCOUNT_ID]:policy/brd-phase2-app-policy

Part 5 (MediaConvert):
- Queue: brd-video-queue-dev
- Template: brd-thumbnail-template

Part 6 (Lambda):
- Function: brd-thumbnail-processor-dev
- Role ARN: arn:aws:iam::[ACCOUNT_ID]:role/brd-lambda-execution-role
```

## Total Time

Part 1: 30 min
Part 2: 80 min (mostly waiting)
Part 3: 20 min
Part 4: 30 min
Part 5: 20 min
Part 6: 40 min

**Total: ~3 hours**

---

**Next**: Once all 6 parts complete, create `.env.phase2` and run Phase 2B
