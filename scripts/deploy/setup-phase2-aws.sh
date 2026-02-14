#!/bin/bash

# PHASE 2 AWS Deployment Script
# Sets up RDS, S3, SQS, and Cognito for Episode Metadata API Staging

set -e

echo "🚀 Starting PHASE 2 AWS Deployment Setup"
echo "========================================="
echo ""

# Configuration
AWS_REGION="us-east-1"
ENVIRONMENT="staging"
PROJECT_NAME="episode-metadata"
ACCOUNT_ID="637423256673"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Step 1: Verify AWS CLI and credentials
echo "Step 1: Verifying AWS CLI and credentials..."
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI not found. Please install it first."
    exit 1
fi

CALLER_IDENTITY=$(aws sts get-caller-identity --region $AWS_REGION)
ACCOUNT=$(echo $CALLER_IDENTITY | grep -o '"Account": "[^"]*' | cut -d'"' -f4)
USER=$(echo $CALLER_IDENTITY | grep -o '"Arn": "[^"]*' | cut -d'/' -f6)

print_status "AWS CLI verified"
print_info "Account: $ACCOUNT"
print_info "User: $USER"
echo ""

# Step 2: Get default VPC
echo "Step 2: Retrieving VPC information..."
VPC_ID=$(aws ec2 describe-vpcs \
    --filters "Name=isDefault,Values=true" \
    --region $AWS_REGION \
    --query 'Vpcs[0].VpcId' \
    --output text)

if [ "$VPC_ID" == "None" ] || [ -z "$VPC_ID" ]; then
    print_error "No default VPC found. Please create one first."
    exit 1
fi

print_status "VPC found: $VPC_ID"
echo ""

# Step 3: Create RDS Security Group
echo "Step 3: Creating RDS Security Group..."
SG_NAME="${PROJECT_NAME}-rds-${ENVIRONMENT}"
SG_ID=$(aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=$SG_NAME" \
    --region $AWS_REGION \
    --query 'SecurityGroups[0].GroupId' \
    --output text 2>/dev/null || echo "")

if [ "$SG_ID" == "None" ] || [ -z "$SG_ID" ]; then
    SG_ID=$(aws ec2 create-security-group \
        --group-name $SG_NAME \
        --description "RDS security group for Episode Metadata API $ENVIRONMENT" \
        --vpc-id $VPC_ID \
        --region $AWS_REGION \
        --query 'GroupId' \
        --output text)
    print_status "Security group created: $SG_ID"
    
    # Allow PostgreSQL from anywhere (for staging only - restrict in production)
    aws ec2 authorize-security-group-ingress \
        --group-id $SG_ID \
        --protocol tcp \
        --port 5432 \
        --cidr 0.0.0.0/0 \
        --region $AWS_REGION
    print_status "Ingress rule added for PostgreSQL"
else
    print_info "Security group already exists: $SG_ID"
fi
echo ""

# Step 4: Create RDS Subnet Group
echo "Step 4: Creating RDS Subnet Group..."
SUBNET_GROUP_NAME="${PROJECT_NAME}-db-subnet-${ENVIRONMENT}"
SUBNETS=$(aws ec2 describe-subnets \
    --filters "Name=vpc-id,Values=$VPC_ID" \
    --region $AWS_REGION \
    --query 'Subnets[*].SubnetId' \
    --output text)

SUBNET_ARRAY=($SUBNETS)
if [ ${#SUBNET_ARRAY[@]} -lt 2 ]; then
    print_error "Need at least 2 subnets for RDS. Found: ${#SUBNET_ARRAY[@]}"
    exit 1
fi

# Check if subnet group exists
EXISTING_GROUP=$(aws rds describe-db-subnet-groups \
    --db-subnet-group-name $SUBNET_GROUP_NAME \
    --region $AWS_REGION \
    --query 'DBSubnetGroups[0].DBSubnetGroupName' \
    --output text 2>/dev/null || echo "")

if [ "$EXISTING_GROUP" == "None" ] || [ -z "$EXISTING_GROUP" ]; then
    aws rds create-db-subnet-group \
        --db-subnet-group-name $SUBNET_GROUP_NAME \
        --db-subnet-group-description "Subnet group for Episode Metadata RDS" \
        --subnet-ids ${SUBNET_ARRAY[0]} ${SUBNET_ARRAY[1]} \
        --region $AWS_REGION \
        --tags "Key=Project,Value=$PROJECT_NAME" "Key=Environment,Value=$ENVIRONMENT"
    print_status "Subnet group created: $SUBNET_GROUP_NAME"
else
    print_info "Subnet group already exists: $SUBNET_GROUP_NAME"
fi
echo ""

# Step 5: Create RDS Instance
echo "Step 5: Creating RDS PostgreSQL Instance..."
RDS_INSTANCE_NAME="${PROJECT_NAME}-postgres-${ENVIRONMENT}"
RDS_PASSWORD=$(openssl rand -base64 32 | tr -d "/@" | cut -c1-25)

# Check if instance exists
EXISTING_RDS=$(aws rds describe-db-instances \
    --db-instance-identifier $RDS_INSTANCE_NAME \
    --region $AWS_REGION \
    --query 'DBInstances[0].DBInstanceIdentifier' \
    --output text 2>/dev/null || echo "")

if [ "$EXISTING_RDS" == "None" ] || [ -z "$EXISTING_RDS" ]; then
    print_info "Creating RDS instance (this may take 5-10 minutes)..."
    aws rds create-db-instance \
        --db-instance-identifier $RDS_INSTANCE_NAME \
        --db-instance-class db.t3.micro \
        --engine postgres \
        --engine-version 15.3 \
        --master-username admin \
        --master-user-password "$RDS_PASSWORD" \
        --allocated-storage 20 \
        --storage-type gp2 \
        --publicly-accessible true \
        --multi-az false \
        --db-subnet-group-name $SUBNET_GROUP_NAME \
        --vpc-security-group-ids $SG_ID \
        --backup-retention-period 7 \
        --preferred-backup-window "03:00-04:00" \
        --preferred-maintenance-window "sun:04:00-sun:05:00" \
        --region $AWS_REGION \
        --tags "Key=Project,Value=$PROJECT_NAME" "Key=Environment,Value=$ENVIRONMENT"
    
    print_status "RDS instance creation started: $RDS_INSTANCE_NAME"
    print_info "⏳ Waiting for RDS instance to be available (this may take 5-10 minutes)..."
    
    aws rds wait db-instance-available \
        --db-instance-identifier $RDS_INSTANCE_NAME \
        --region $AWS_REGION
    
    print_status "RDS instance is now available"
else
    print_info "RDS instance already exists: $RDS_INSTANCE_NAME"
    # Get the password from Systems Manager Parameter Store if it was saved
    RDS_PASSWORD="<check Parameter Store for /episode-metadata/$ENVIRONMENT/rds-password>"
fi
echo ""

# Step 6: Get RDS endpoint
echo "Step 6: Retrieving RDS endpoint..."
RDS_ENDPOINT=$(aws rds describe-db-instances \
    --db-instance-identifier $RDS_INSTANCE_NAME \
    --region $AWS_REGION \
    --query 'DBInstances[0].Endpoint.Address' \
    --output text)

print_status "RDS endpoint: $RDS_ENDPOINT"
echo ""

# Step 7: Create S3 Buckets
echo "Step 7: Creating S3 Buckets..."
TIMESTAMP=$(date +%s)
S3_BUCKETS=(
    "brd-episodes-${ENVIRONMENT}-${TIMESTAMP}"
    "brd-thumbnails-${ENVIRONMENT}-${TIMESTAMP}"
    "brd-temp-${ENVIRONMENT}-${TIMESTAMP}"
)

for BUCKET in "${S3_BUCKETS[@]}"; do
    if ! aws s3 ls "s3://$BUCKET" 2>&1 | grep -q "NoSuchBucket"; then
        print_info "Bucket already exists: $BUCKET"
    else
        aws s3 mb "s3://$BUCKET" --region $AWS_REGION
        print_status "S3 bucket created: $BUCKET"
        
        # Enable versioning
        aws s3api put-bucket-versioning \
            --bucket "$BUCKET" \
            --versioning-configuration Status=Enabled \
            --region $AWS_REGION
        print_status "Versioning enabled for: $BUCKET"
    fi
done
echo ""

# Step 8: Create SQS Queues
echo "Step 8: Creating SQS Queues..."
QUEUE_JOB="${PROJECT_NAME}-job-queue-${ENVIRONMENT}"
QUEUE_DLQ="${PROJECT_NAME}-job-dlq-${ENVIRONMENT}"

# Create DLQ first
DLQ_RESULT=$(aws sqs create-queue \
    --queue-name $QUEUE_DLQ \
    --region $AWS_REGION \
    --attributes "VisibilityTimeout=300" \
    --tags "Project=$PROJECT_NAME" "Environment=$ENVIRONMENT" \
    --query 'QueueUrl' \
    --output text 2>/dev/null || echo "EXISTS")

if [ "$DLQ_RESULT" != "EXISTS" ]; then
    print_status "SQS Dead Letter Queue created: $QUEUE_DLQ"
    DLQ_URL=$DLQ_RESULT
else
    DLQ_URL=$(aws sqs get-queue-url --queue-name $QUEUE_DLQ --region $AWS_REGION --query 'QueueUrl' --output text)
    print_info "SQS Dead Letter Queue already exists: $QUEUE_DLQ"
fi

# Get DLQ ARN
DLQ_ATTRIBUTES=$(aws sqs get-queue-attributes \
    --queue-url "$DLQ_URL" \
    --attribute-names "QueueArn" \
    --region $AWS_REGION \
    --query 'Attributes.QueueArn' \
    --output text)

# Create main queue with DLQ
QUEUE_RESULT=$(aws sqs create-queue \
    --queue-name $QUEUE_JOB \
    --region $AWS_REGION \
    --attributes "VisibilityTimeout=300,RedrivePolicy={\"deadLetterTargetArn\":\"$DLQ_ATTRIBUTES\",\"maxReceiveCount\":\"3\"}" \
    --tags "Project=$PROJECT_NAME" "Environment=$ENVIRONMENT" \
    --query 'QueueUrl' \
    --output text 2>/dev/null || echo "EXISTS")

if [ "$QUEUE_RESULT" != "EXISTS" ]; then
    print_status "SQS Job Queue created: $QUEUE_JOB"
    QUEUE_URL=$QUEUE_RESULT
else
    QUEUE_URL=$(aws sqs get-queue-url --queue-name $QUEUE_JOB --region $AWS_REGION --query 'QueueUrl' --output text)
    print_info "SQS Job Queue already exists: $QUEUE_JOB"
fi
echo ""

# Step 9: Create Cognito User Pool
echo "Step 9: Creating Cognito User Pool..."
COGNITO_POOL_NAME="${PROJECT_NAME}-${ENVIRONMENT}"

COGNITO_RESULT=$(aws cognito-idp create-user-pool \
    --pool-name $COGNITO_POOL_NAME \
    --region $AWS_REGION \
    --policies '{"PasswordPolicy":{"MinimumLength":8,"RequireUppercase":true,"RequireLowercase":true,"RequireNumbers":true,"RequireSymbols":true}}' \
    --mfa-configuration OFF \
    --tags "Project=$PROJECT_NAME" "Environment=$ENVIRONMENT" \
    --query 'UserPool.Id' \
    --output text 2>/dev/null || echo "EXISTS")

if [ "$COGNITO_RESULT" != "EXISTS" ]; then
    print_status "Cognito User Pool created: $COGNITO_POOL_NAME"
    COGNITO_POOL_ID=$COGNITO_RESULT
else
    COGNITO_POOL_ID=$(aws cognito-idp list-user-pools --max-results 10 --region $AWS_REGION --query "UserPools[?Name=='$COGNITO_POOL_NAME'].Id" --output text)
    print_info "Cognito User Pool already exists: $COGNITO_POOL_NAME"
fi

# Create app client
COGNITO_CLIENT=$(aws cognito-idp create-user-pool-client \
    --user-pool-id $COGNITO_POOL_ID \
    --client-name "${PROJECT_NAME}-client" \
    --region $AWS_REGION \
    --explicit-auth-flows "ALLOW_USER_PASSWORD_AUTH" "ALLOW_REFRESH_TOKEN_AUTH" "ALLOW_USER_SRP_AUTH" \
    --query 'UserPoolClient.ClientId' \
    --output text 2>/dev/null || echo "EXISTS")

if [ "$COGNITO_CLIENT" != "EXISTS" ]; then
    print_status "Cognito App Client created"
    COGNITO_CLIENT_ID=$COGNITO_CLIENT
else
    COGNITO_CLIENT_ID=$(aws cognito-idp list-user-pool-clients --user-pool-id $COGNITO_POOL_ID --region $AWS_REGION --query 'UserPoolClients[0].ClientId' --output text)
    print_info "Cognito App Client already exists"
fi
echo ""

# Step 10: Save configuration
echo "Step 10: Saving configuration..."
cat > .env.aws-staging << EOF
# PHASE 2 AWS Staging Environment Configuration
# Generated: $(date)

NODE_ENV=staging
PORT=3002
HOST=0.0.0.0

# Database
DB_HOST=$RDS_ENDPOINT
DB_PORT=5432
DB_USER=admin
DB_PASSWORD=$RDS_PASSWORD
DB_NAME=episode_metadata
DB_POOL_MAX=10
DB_POOL_MIN=2

# AWS Region
AWS_REGION=$AWS_REGION

# S3 Configuration
S3_BUCKET_EPISODES=${S3_BUCKETS[0]}
S3_BUCKET_THUMBNAILS=${S3_BUCKETS[1]}
S3_BUCKET_TEMP=${S3_BUCKETS[2]}

# SQS Configuration
SQS_QUEUE_URL_JOB=$QUEUE_URL
SQS_QUEUE_URL_DLQ=$DLQ_URL

# Cognito Configuration
COGNITO_REGION=$AWS_REGION
COGNITO_USER_POOL_ID=$COGNITO_POOL_ID
COGNITO_CLIENT_ID=$COGNITO_CLIENT_ID

# Enable SQL logging in staging
SQL_LOGGING=true
EOF

print_status "Configuration saved to .env.aws-staging"
echo ""

# Summary
echo "========================================="
echo "✅ PHASE 2 AWS Deployment Complete!"
echo "========================================="
echo ""
echo "📊 Resources Created:"
echo "  • RDS Instance: $RDS_INSTANCE_NAME"
echo "  • RDS Endpoint: $RDS_ENDPOINT"
echo "  • S3 Buckets: ${#S3_BUCKETS[@]}"
for BUCKET in "${S3_BUCKETS[@]}"; do
    echo "    - $BUCKET"
done
echo "  • SQS Queues: 2"
echo "    - $QUEUE_JOB"
echo "    - $QUEUE_DLQ"
echo "  • Cognito Pool: $COGNITO_POOL_ID"
echo ""
echo "⚙️  Next Steps:"
echo "  1. Export configuration: export $(cat .env.aws-staging | xargs)"
echo "  2. Run migrations: npm run migrate:up"
echo "  3. Start API: npm start"
echo "  4. Run tests: npm test"
echo ""
echo "💾 Save these credentials securely:"
echo "  • RDS Password: $RDS_PASSWORD"
echo "  • Region: $AWS_REGION"
echo ""
