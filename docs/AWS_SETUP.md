# AWS Setup Guide

## Complete Step-by-Step AWS Infrastructure Setup

### Prerequisites
- AWS Account (637423256673)
- AWS CLI installed and configured
- Appropriate IAM permissions

---

## Phase 0 - Infrastructure Checklist

### 1. Billing & Cost Management

```bash
# Enable billing alerts
aws ce put-anomaly-detector \
  --anomaly-detector '{
    "AnomalySubscription": {
      "SubscriptionName": "episode-metadata-billing",
      "Threshold": 100,
      "Frequency": "DAILY",
      "MonitorSpecification": {
        "OrDimensions": [{"Key": "SERVICE", "Values": ["Amazon Elastic Compute Cloud"]}]
      },
      "SNSPublicationProperties": {
        "TopicArn": "arn:aws:sns:us-east-1:637423256673:billing-alerts"
      }
    }
  }'
```

### 2. VPC Setup

#### Development VPC
```bash
# Create VPC
VPC_ID_DEV=$(aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=episode-metadata-vpc-dev},{Key=Project,Value=episode-metadata}]' \
  --query 'Vpc.VpcId' --output text)

echo "Development VPC: $VPC_ID_DEV"

# Create Internet Gateway
IGW_ID_DEV=$(aws ec2 create-internet-gateway \
  --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=episode-metadata-igw-dev}]' \
  --query 'InternetGateway.InternetGatewayId' --output text)

# Attach IGW to VPC
aws ec2 attach-internet-gateway \
  --internet-gateway-id $IGW_ID_DEV \
  --vpc-id $VPC_ID_DEV

# Create public subnets
PUBLIC_SUBNET_1=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID_DEV \
  --cidr-block 10.0.1.0/24 \
  --availability-zone us-east-1a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=episode-metadata-public-1a-dev}]' \
  --query 'Subnet.SubnetId' --output text)

PUBLIC_SUBNET_2=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID_DEV \
  --cidr-block 10.0.2.0/24 \
  --availability-zone us-east-1b \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=episode-metadata-public-1b-dev}]' \
  --query 'Subnet.SubnetId' --output text)

# Create private subnets
PRIVATE_SUBNET_1=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID_DEV \
  --cidr-block 10.0.10.0/24 \
  --availability-zone us-east-1a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=episode-metadata-private-1a-dev}]' \
  --query 'Subnet.SubnetId' --output text)

PRIVATE_SUBNET_2=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID_DEV \
  --cidr-block 10.0.20.0/24 \
  --availability-zone us-east-1b \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=episode-metadata-private-1b-dev}]' \
  --query 'Subnet.SubnetId' --output text)

# Create Elastic IP and NAT Gateway
ALLOCATION_ID=$(aws ec2 allocate-address \
  --domain vpc \
  --tag-specifications 'ResourceType=elastic-ip,Tags=[{Key=Name,Value=episode-metadata-nat-eip-dev}]' \
  --query 'AllocationId' --output text)

NAT_GW_ID=$(aws ec2 create-nat-gateway \
  --subnet-id $PUBLIC_SUBNET_1 \
  --allocation-id $ALLOCATION_ID \
  --tag-specifications 'ResourceType=nat-gateway,Tags=[{Key=Name,Value=episode-metadata-nat-dev}]' \
  --query 'NatGateway.NatGatewayId' --output text)

# Wait for NAT Gateway to be available
aws ec2 wait nat-gateway-available --nat-gateway-ids $NAT_GW_ID

# Create route tables
PUBLIC_RT=$(aws ec2 create-route-table \
  --vpc-id $VPC_ID_DEV \
  --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=episode-metadata-public-rt-dev}]' \
  --query 'RouteTable.RouteTableId' --output text)

PRIVATE_RT=$(aws ec2 create-route-table \
  --vpc-id $VPC_ID_DEV \
  --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=episode-metadata-private-rt-dev}]' \
  --query 'RouteTable.RouteTableId' --output text)

# Add routes
aws ec2 create-route \
  --route-table-id $PUBLIC_RT \
  --destination-cidr-block 0.0.0.0/0 \
  --gateway-id $IGW_ID_DEV

aws ec2 create-route \
  --route-table-id $PRIVATE_RT \
  --destination-cidr-block 0.0.0.0/0 \
  --nat-gateway-id $NAT_GW_ID

# Associate subnets
aws ec2 associate-route-table --subnet-id $PUBLIC_SUBNET_1 --route-table-id $PUBLIC_RT
aws ec2 associate-route-table --subnet-id $PUBLIC_SUBNET_2 --route-table-id $PUBLIC_RT
aws ec2 associate-route-table --subnet-id $PRIVATE_SUBNET_1 --route-table-id $PRIVATE_RT
aws ec2 associate-route-table --subnet-id $PRIVATE_SUBNET_2 --route-table-id $PRIVATE_RT
```

### 3. S3 Buckets

```bash
# Development Buckets
aws s3api create-bucket \
  --bucket episode-metadata-storage-dev \
  --region us-east-1 \
  --create-bucket-configuration LocationConstraint=us-east-1

aws s3api put-bucket-versioning \
  --bucket episode-metadata-storage-dev \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket episode-metadata-storage-dev \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# Thumbnail bucket
aws s3api create-bucket \
  --bucket episode-metadata-thumbnails-dev \
  --region us-east-1

# Repeat for staging and production with appropriate bucket names
```

### 4. RDS PostgreSQL

```bash
# Create DB subnet group
aws rds create-db-subnet-group \
  --db-subnet-group-name episode-metadata-db-subnet-group-dev \
  --db-subnet-group-description "Subnet group for Episode Metadata DB" \
  --subnet-ids $PRIVATE_SUBNET_1 $PRIVATE_SUBNET_2 \
  --tags Key=Name,Value=episode-metadata-db-subnet-group-dev

# Create security group
SG_ID=$(aws ec2 create-security-group \
  --group-name episode-metadata-db-sg-dev \
  --description "SG for Episode Metadata Database" \
  --vpc-id $VPC_ID_DEV \
  --query 'GroupId' --output text)

# Allow PostgreSQL access
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 5432 \
  --cidr 10.0.10.0/24

aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 5432 \
  --cidr 10.0.20.0/24

# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier episode-metadata-db-dev \
  --db-instance-class db.t3.small \
  --engine postgres \
  --engine-version 15.3 \
  --master-username postgres \
  --master-user-password YOUR_SECURE_PASSWORD \
  --db-subnet-group-name episode-metadata-db-subnet-group-dev \
  --vpc-security-group-ids $SG_ID \
  --allocated-storage 20 \
  --storage-type gp3 \
  --backup-retention-period 1 \
  --backup-window 03:00-04:00 \
  --maintenance-window sun:04:00-sun:05:00 \
  --storage-encrypted \
  --no-publicly-accessible \
  --tags Key=Name,Value=episode-metadata-db-dev Key=Environment,Value=development
```

### 5. Cognito User Pools

```bash
# Create user pool
USER_POOL_ID=$(aws cognito-idp create-user-pool \
  --pool-name episode-metadata-users-dev \
  --policies '{
    "PasswordPolicy": {
      "MinimumLength": 12,
      "RequireUppercase": true,
      "RequireLowercase": true,
      "RequireNumbers": true,
      "RequireSymbols": true
    }
  }' \
  --username-attributes email \
  --schema '[
    {
      "Name": "email",
      "AttributeDataType": "String",
      "Mutable": true,
      "Required": true
    }
  ]' \
  --query 'UserPool.Id' --output text)

echo "User Pool ID: $USER_POOL_ID"

# Create app client
CLIENT_ID=$(aws cognito-idp create-user-pool-client \
  --user-pool-id $USER_POOL_ID \
  --client-name episode-metadata-api-client-dev \
  --auth-flows USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
  --query 'UserPoolClient.ClientId' --output text)

echo "Client ID: $CLIENT_ID"

# Create user groups
aws cognito-idp create-group \
  --user-pool-id $USER_POOL_ID \
  --group-name admin \
  --description "Administrators with full access"

aws cognito-idp create-group \
  --user-pool-id $USER_POOL_ID \
  --group-name editor \
  --description "Editors can create and modify content"

aws cognito-idp create-group \
  --user-pool-id $USER_POOL_ID \
  --group-name viewer \
  --description "Viewers have read-only access"

# Create test users
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username admin@episodeidentityform.com \
  --user-attributes Name=email,Value=admin@episodeidentityform.com Name=email_verified,Value=true \
  --message-action SUPPRESS \
  --temporary-password TempPass123!@#

aws cognito-idp admin-add-user-to-group \
  --user-pool-id $USER_POOL_ID \
  --username admin@episodeidentityform.com \
  --group-name admin
```

### 6. SQS Queues

```bash
# Create main queue
QUEUE_URL=$(aws sqs create-queue \
  --queue-name episode-metadata-thumbnail-queue-dev \
  --attributes 'VisibilityTimeout=300,MessageRetentionPeriod=1209600,Tags={"Environment":"development"}' \
  --query 'QueueUrl' --output text)

echo "Queue URL: $QUEUE_URL"

# Create DLQ
DLQ_URL=$(aws sqs create-queue \
  --queue-name episode-metadata-thumbnail-dlq-dev \
  --attributes 'MessageRetentionPeriod=1209600' \
  --query 'QueueUrl' --output text)

# Get queue ARN
QUEUE_ARN=$(aws sqs get-queue-attributes \
  --queue-url $QUEUE_URL \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' --output text)

# Link DLQ to main queue
aws sqs set-queue-attributes \
  --queue-url $QUEUE_URL \
  --attributes 'RedrivePolicy={\"deadLetterTargetArn\":\"'$DLQ_URL'\",\"maxReceiveCount\":\"3\"}'
```

---

## Storing Configuration in AWS Secrets Manager

```bash
# Database credentials
aws secretsmanager create-secret \
  --name episode-metadata/database-dev \
  --secret-string '{
    "host": "episode-metadata-db-dev.xxxxx.us-east-1.rds.amazonaws.com",
    "port": 5432,
    "database": "postgres",
    "username": "postgres",
    "password": "YOUR_SECURE_PASSWORD"
  }'

# Cognito credentials
aws secretsmanager create-secret \
  --name episode-metadata/cognito-dev \
  --secret-string '{
    "user_pool_id": "'$USER_POOL_ID'",
    "client_id": "'$CLIENT_ID'",
    "client_secret": "YOUR_CLIENT_SECRET"
  }'
```

---

## Verification Commands

```bash
# Verify VPC setup
aws ec2 describe-vpcs --filters "Name=tag:Project,Values=episode-metadata"

# Verify RDS
aws rds describe-db-instances --db-instance-identifier episode-metadata-db-dev

# Verify Cognito
aws cognito-idp describe-user-pool --user-pool-id $USER_POOL_ID

# Verify S3 buckets
aws s3 ls | grep episode-metadata

# Verify SQS queues
aws sqs list-queues --query 'QueueUrls[?contains(@, `episode-metadata`)]'
```

---

## Costs Estimation

| Service | Dev | Staging | Production | Monthly |
|---------|-----|---------|------------|---------|
| RDS | $30 | $30 | $50 | $110 |
| S3 | $5 | $5 | $20 | $30 |
| NAT Gateway | $0 | $45 | $90 | $135 |
| VPC | $0 | $0 | $0 | $0 |
| Cognito | $0 | $0 | $0 | $0 |
| **Total** | **$35** | **$80** | **$160** | **~$275** |

