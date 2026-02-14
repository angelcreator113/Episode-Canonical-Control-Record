# PHASE 2 AWS Deployment Script for Windows PowerShell
# Sets up RDS, S3, SQS, and Cognito for Episode Metadata API Staging

# Configuration
$AWSRegion = "us-east-1"
$Environment = "staging"
$ProjectName = "episode-metadata"
$AccountID = "637423256673"

# Color functions
function Print-Status {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Print-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Print-Info {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Yellow
}

# Step 1: Verify AWS CLI
Write-Host "🚀 Starting PHASE 2 AWS Deployment Setup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Step 1: Verifying AWS CLI and credentials..." -ForegroundColor Cyan
try {
    $CallerIdentity = aws sts get-caller-identity --region $AWSRegion | ConvertFrom-Json
    $Account = $CallerIdentity.Account
    $User = $CallerIdentity.Arn.Split("/")[-1]
    
    Print-Status "AWS CLI verified"
    Print-Info "Account: $Account"
    Print-Info "User: $User"
    Write-Host ""
} catch {
    Print-Error "Failed to verify AWS CLI: $_"
    exit 1
}

# Step 2: Get Default VPC
Write-Host "Step 2: Retrieving VPC information..." -ForegroundColor Cyan
$VpcInfo = aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --region $AWSRegion | ConvertFrom-Json
if ($VpcInfo.Vpcs.Count -eq 0) {
    Print-Error "No default VPC found. Please create one first."
    exit 1
}
$VpcId = $VpcInfo.Vpcs[0].VpcId
Print-Status "VPC found: $VpcId"
Write-Host ""

# Step 3: Create/Get RDS Security Group
Write-Host "Step 3: Creating RDS Security Group..." -ForegroundColor Cyan
$SgName = "$ProjectName-rds-$Environment"

$SgInfo = aws ec2 describe-security-groups --filters "Name=group-name,Values=$SgName" --region $AWSRegion | ConvertFrom-Json
if ($SgInfo.SecurityGroups.Count -eq 0) {
    $SgId = (aws ec2 create-security-group --group-name $SgName --description "RDS security group for Episode Metadata API $Environment" --vpc-id $VpcId --region $AWSRegion | ConvertFrom-Json).GroupId
    Print-Status "Security group created: $SgId"
    
    # Allow PostgreSQL
    aws ec2 authorize-security-group-ingress --group-id $SgId --protocol tcp --port 5432 --cidr 0.0.0.0/0 --region $AWSRegion
    Print-Status "Ingress rule added for PostgreSQL"
} else {
    $SgId = $SgInfo.SecurityGroups[0].GroupId
    Print-Info "Security group already exists: $SgId"
}
Write-Host ""

# Step 4: Create RDS Subnet Group
Write-Host "Step 4: Creating RDS Subnet Group..." -ForegroundColor Cyan
$SubnetGroupName = "$ProjectName-db-subnet-$Environment"

$SubnetsInfo = aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VpcId" --region $AWSRegion | ConvertFrom-Json
$SubnetIds = $SubnetsInfo.Subnets | Select-Object -ExpandProperty SubnetId | Select-Object -First 2

if ($SubnetIds.Count -lt 2) {
    Print-Error "Need at least 2 subnets for RDS. Found: $($SubnetIds.Count)"
    exit 1
}

try {
    aws rds describe-db-subnet-groups --db-subnet-group-name $SubnetGroupName --region $AWSRegion | Out-Null
    Print-Info "Subnet group already exists: $SubnetGroupName"
} catch {
    aws rds create-db-subnet-group --db-subnet-group-name $SubnetGroupName --db-subnet-group-description "Subnet group for Episode Metadata RDS" --subnet-ids $SubnetIds[0] $SubnetIds[1] --region $AWSRegion --tags "Key=Project,Value=$ProjectName" "Key=Environment,Value=$Environment"
    Print-Status "Subnet group created: $SubnetGroupName"
}
Write-Host ""

# Step 5: Create RDS Instance
Write-Host "Step 5: Creating RDS PostgreSQL Instance..." -ForegroundColor Cyan
$RdsInstanceName = "$ProjectName-postgres-$Environment"
$RdsPassword = -join ((33..126) | Get-Random -Count 25 | ForEach-Object { [char]$_ })

try {
    aws rds describe-db-instances --db-instance-identifier $RdsInstanceName --region $AWSRegion | Out-Null
    Print-Info "RDS instance already exists: $RdsInstanceName"
} catch {
    Print-Info "Creating RDS instance (this may take 5-10 minutes)..."
    aws rds create-db-instance `
        --db-instance-identifier $RdsInstanceName `
        --db-instance-class db.t3.micro `
        --engine postgres `
        --engine-version 15.3 `
        --master-username admin `
        --master-user-password $RdsPassword `
        --allocated-storage 20 `
        --storage-type gp2 `
        --publicly-accessible `
        --db-subnet-group-name $SubnetGroupName `
        --vpc-security-group-ids $SgId `
        --backup-retention-period 7 `
        --region $AWSRegion `
        --tags "Key=Project,Value=$ProjectName" "Key=Environment,Value=$Environment"
    
    Print-Status "RDS instance creation started"
    Print-Info "Waiting for RDS instance to be available (this may take 5-10 minutes)..."
    
    $MaxRetries = 60
    $Retry = 0
    while ($Retry -lt $MaxRetries) {
        try {
            $RdsStatus = aws rds describe-db-instances --db-instance-identifier $RdsInstanceName --region $AWSRegion | ConvertFrom-Json
            if ($RdsStatus.DBInstances[0].DBInstanceStatus -eq "available") {
                Print-Status "RDS instance is now available"
                break
            }
        } catch { }
        
        $Retry++
        Start-Sleep -Seconds 10
        Write-Host "." -NoNewline
    }
}
Write-Host ""

# Step 6: Get RDS Endpoint
Write-Host "Step 6: Retrieving RDS endpoint..." -ForegroundColor Cyan
$RdsInfo = aws rds describe-db-instances --db-instance-identifier $RdsInstanceName --region $AWSRegion | ConvertFrom-Json
$RdsEndpoint = $RdsInfo.DBInstances[0].Endpoint.Address
Print-Status "RDS endpoint: $RdsEndpoint"
Write-Host ""

# Step 7: Create S3 Buckets
Write-Host "Step 7: Creating S3 Buckets..." -ForegroundColor Cyan
$Timestamp = Get-Date -UFormat %s
$S3Buckets = @(
    "brd-episodes-$Environment-$Timestamp",
    "brd-thumbnails-$Environment-$Timestamp",
    "brd-temp-$Environment-$Timestamp"
)

foreach ($Bucket in $S3Buckets) {
    try {
        aws s3 ls "s3://$Bucket" --region $AWSRegion 2>&1 | Out-Null
        Print-Info "Bucket already exists: $Bucket"
    } catch {
        aws s3 mb "s3://$Bucket" --region $AWSRegion
        Print-Status "S3 bucket created: $Bucket"
        
        # Enable versioning
        aws s3api put-bucket-versioning --bucket $Bucket --versioning-configuration Status=Enabled --region $AWSRegion
        Print-Status "Versioning enabled for: $Bucket"
    }
}
Write-Host ""

# Step 8: Create SQS Queues
Write-Host "Step 8: Creating SQS Queues..." -ForegroundColor Cyan
$QueueJob = "$ProjectName-job-queue-$Environment"
$QueueDlq = "$ProjectName-job-dlq-$Environment"

# Create DLQ
$DlqResult = aws sqs create-queue --queue-name $QueueDlq --region $AWSRegion --attributes "VisibilityTimeout=300" --tags "Project=$ProjectName" "Environment=$Environment" 2>&1 | ConvertFrom-Json -ErrorAction SilentlyContinue
if ($DlqResult.QueueUrl) {
    Print-Status "SQS Dead Letter Queue created: $QueueDlq"
    $DlqUrl = $DlqResult.QueueUrl
} else {
    $DlqUrl = (aws sqs get-queue-url --queue-name $QueueDlq --region $AWSRegion | ConvertFrom-Json).QueueUrl
    Print-Info "SQS Dead Letter Queue already exists: $QueueDlq"
}

# Get DLQ ARN
$DlqAttributes = aws sqs get-queue-attributes --queue-url $DlqUrl --attribute-names QueueArn --region $AWSRegion | ConvertFrom-Json
$DlqArn = $DlqAttributes.Attributes.QueueArn

# Create main queue
$RedrivePolicy = "{`"deadLetterTargetArn`":`"$DlqArn`",`"maxReceiveCount`":`"3`"}"
$QueueResult = aws sqs create-queue --queue-name $QueueJob --region $AWSRegion --attributes "VisibilityTimeout=300,RedrivePolicy=$RedrivePolicy" --tags "Project=$ProjectName" "Environment=$Environment" 2>&1 | ConvertFrom-Json -ErrorAction SilentlyContinue

if ($QueueResult.QueueUrl) {
    Print-Status "SQS Job Queue created: $QueueJob"
    $QueueUrl = $QueueResult.QueueUrl
} else {
    $QueueUrl = (aws sqs get-queue-url --queue-name $QueueJob --region $AWSRegion | ConvertFrom-Json).QueueUrl
    Print-Info "SQS Job Queue already exists: $QueueJob"
}
Write-Host ""

# Step 9: Create Cognito User Pool
Write-Host "Step 9: Creating Cognito User Pool..." -ForegroundColor Cyan
$CognitoPoolName = "$ProjectName-$Environment"

$CognitoResult = aws cognito-idp create-user-pool --pool-name $CognitoPoolName --region $AWSRegion --policies '{"PasswordPolicy":{"MinimumLength":8,"RequireUppercase":true,"RequireLowercase":true,"RequireNumbers":true,"RequireSymbols":true}}' --tags "Project=$ProjectName" "Environment=$Environment" 2>&1 | ConvertFrom-Json -ErrorAction SilentlyContinue

if ($CognitoResult.UserPool.Id) {
    Print-Status "Cognito User Pool created: $CognitoPoolName"
    $CognitoPoolId = $CognitoResult.UserPool.Id
} else {
    $CognitoPoolList = aws cognito-idp list-user-pools --max-results 10 --region $AWSRegion | ConvertFrom-Json
    $CognitoPoolId = ($CognitoPoolList.UserPools | Where-Object { $_.Name -eq $CognitoPoolName }).Id
    Print-Info "Cognito User Pool already exists: $CognitoPoolName"
}

# Create app client
$CognitoClient = aws cognito-idp create-user-pool-client --user-pool-id $CognitoPoolId --client-name "$ProjectName-client" --region $AWSRegion --explicit-auth-flows "ALLOW_USER_PASSWORD_AUTH" "ALLOW_REFRESH_TOKEN_AUTH" 2>&1 | ConvertFrom-Json -ErrorAction SilentlyContinue

if ($CognitoClient.UserPoolClient.ClientId) {
    Print-Status "Cognito App Client created"
    $CognitoClientId = $CognitoClient.UserPoolClient.ClientId
} else {
    $ClientList = aws cognito-idp list-user-pool-clients --user-pool-id $CognitoPoolId --region $AWSRegion | ConvertFrom-Json
    $CognitoClientId = $ClientList.UserPoolClients[0].ClientId
    Print-Info "Cognito App Client already exists"
}
Write-Host ""

# Step 10: Save Configuration
Write-Host "Step 10: Saving configuration..." -ForegroundColor Cyan
$EnvContent = @"
# PHASE 2 AWS Staging Environment Configuration
# Generated: $(Get-Date)

NODE_ENV=staging
PORT=3002
HOST=0.0.0.0

# Database
DB_HOST=$RdsEndpoint
DB_PORT=5432
DB_USER=admin
DB_PASSWORD=$RdsPassword
DB_NAME=episode_metadata
DB_POOL_MAX=10
DB_POOL_MIN=2

# AWS Region
AWS_REGION=$AWSRegion

# S3 Configuration
S3_BUCKET_EPISODES=$($S3Buckets[0])
S3_BUCKET_THUMBNAILS=$($S3Buckets[1])
S3_BUCKET_TEMP=$($S3Buckets[2])

# SQS Configuration
SQS_QUEUE_URL_JOB=$QueueUrl
SQS_QUEUE_URL_DLQ=$DlqUrl

# Cognito Configuration
COGNITO_REGION=$AWSRegion
COGNITO_USER_POOL_ID=$CognitoPoolId
COGNITO_CLIENT_ID=$CognitoClientId

# Enable SQL logging in staging
SQL_LOGGING=true
"@

$EnvContent | Out-File -FilePath ".env.aws-staging" -Encoding UTF8
Print-Status "Configuration saved to .env.aws-staging"
Write-Host ""

# Summary
Write-Host "==========================================" -ForegroundColor Green
Write-Host "✅ PHASE 2 AWS Deployment Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Resources Created:" -ForegroundColor Cyan
Write-Host "  • RDS Instance: $RdsInstanceName"
Write-Host "  • RDS Endpoint: $RdsEndpoint"
Write-Host "  • S3 Buckets: $($S3Buckets.Count)"
foreach ($Bucket in $S3Buckets) {
    Write-Host "    - $Bucket"
}
Write-Host "  • SQS Queues: 2"
Write-Host "    - $QueueJob"
Write-Host "    - $QueueDlq"
Write-Host "  • Cognito Pool: $CognitoPoolId"
Write-Host ""
Write-Host "⚙️  Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Load configuration: Get-Content .env.aws-staging | ForEach-Object { [Environment]::SetEnvironmentVariable($_.Split('=')[0], $_.Split('=')[1]) }"
Write-Host "  2. Test RDS connection: npm run db:test"
Write-Host "  3. Run migrations: npm run migrate:up"
Write-Host "  4. Start API: npm start"
Write-Host ""
Write-Host "💾 Save these credentials securely:" -ForegroundColor Yellow
Write-Host "  • RDS Password: $RdsPassword"
Write-Host "  • Region: $AWSRegion"
Write-Host "  • All credentials are in .env.aws-staging"
Write-Host ""
