# ============================================================================
# Lambda Thumbnail Processor Deployment Script
# ============================================================================
# This script creates and deploys the Lambda function for thumbnail processing
# Connected to: episode-metadata-thumbnail-queue-dev

param(
    [string]$Environment = "dev",
    [string]$Region = "us-east-1",
    [string]$AccountId = "637423256673"
)

$ErrorActionPreference = "Stop"

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Lambda Thumbnail Processor Deployment                  ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Configuration
$functionName = "episode-metadata-thumbnail-generator-$Environment"
$roleName = "episode-metadata-lambda-execution-role-$Environment"
$bucketName = "episode-metadata-storage-$Environment"
$queueName = "episode-metadata-thumbnail-queue-$Environment"

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Function: $functionName" -ForegroundColor White
Write-Host "  Role: $roleName" -ForegroundColor White
Write-Host "  Bucket: $bucketName" -ForegroundColor White
Write-Host "  Queue: $queueName" -ForegroundColor White
Write-Host "  Region: $Region" -ForegroundColor White
Write-Host ""

# ============================================================================
# PHASE 1: Check/Create IAM Role
# ============================================================================
Write-Host "📋 Phase 1: IAM Role Setup" -ForegroundColor Cyan
Write-Host ""

Write-Host "Checking if role exists..." -ForegroundColor Yellow
$roleExists = $false
try {
    $existingRole = aws iam get-role --role-name $roleName --region $Region 2>&1
    if ($LASTEXITCODE -eq 0) {
        $roleData = $existingRole | ConvertFrom-Json
        $roleArn = $roleData.Role.Arn
        Write-Host "✅ Role already exists: $roleName" -ForegroundColor Green
        Write-Host "   ARN: $roleArn" -ForegroundColor Gray
        $roleExists = $true
    }
} catch {
    Write-Host "⚠️  Role does not exist, creating..." -ForegroundColor Yellow
}

if (-not $roleExists) {
    # Create trust policy
    Write-Host "Creating IAM role..." -ForegroundColor Yellow
    
    $trustPolicy = @{
        Version = "2012-10-17"
        Statement = @(
            @{
                Effect = "Allow"
                Principal = @{
                    Service = "lambda.amazonaws.com"
                }
                Action = "sts:AssumeRole"
            }
        )
    } | ConvertTo-Json -Depth 10 -Compress
    
    aws iam create-role `
        --role-name $roleName `
        --assume-role-policy-document $trustPolicy `
        --description "Execution role for episode metadata thumbnail generator Lambda" `
        --region $Region | Out-Null
    
    $roleArn = "arn:aws:iam::${AccountId}:role/${roleName}"
    Write-Host "✅ Role created: $roleName" -ForegroundColor Green
    
    # Attach basic Lambda execution policy
    Write-Host "Attaching Lambda basic execution policy..." -ForegroundColor Yellow
    aws iam attach-role-policy `
        --role-name $roleName `
        --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole" `
        --region $Region
    
    Write-Host "✅ Basic execution policy attached" -ForegroundColor Green
    
    # Create and attach custom policy for S3 and SQS
    Write-Host "Creating custom policy..." -ForegroundColor Yellow
    
    $customPolicy = @{
        Version = "2012-10-17"
        Statement = @(
            @{
                Effect = "Allow"
                Action = @(
                    "s3:GetObject",
                    "s3:PutObject",
                    "s3:DeleteObject"
                )
                Resource = "arn:aws:s3:::${bucketName}/*"
            },
            @{
                Effect = "Allow"
                Action = @(
                    "s3:ListBucket"
                )
                Resource = "arn:aws:s3:::${bucketName}"
            },
            @{
                Effect = "Allow"
                Action = @(
                    "sqs:ReceiveMessage",
                    "sqs:DeleteMessage",
                    "sqs:GetQueueAttributes"
                )
                Resource = "arn:aws:sqs:${Region}:${AccountId}:${queueName}"
            },
            @{
                Effect = "Allow"
                Action = @(
                    "logs:CreateLogGroup",
                    "logs:CreateLogStream",
                    "logs:PutLogEvents"
                )
                Resource = "arn:aws:logs:${Region}:${AccountId}:*"
            }
        )
    } | ConvertTo-Json -Depth 10 -Compress
    
    $policyName = "episode-metadata-thumbnail-policy-$Environment"
    
    $createPolicyResult = aws iam create-policy `
        --policy-name $policyName `
        --policy-document $customPolicy `
        --description "Custom policy for episode thumbnail generator Lambda" `
        --region $Region | ConvertFrom-Json
    
    $policyArn = $createPolicyResult.Policy.Arn
    Write-Host "✅ Custom policy created: $policyName" -ForegroundColor Green
    
    # Attach custom policy to role
    Write-Host "Attaching custom policy to role..." -ForegroundColor Yellow
    aws iam attach-role-policy `
        --role-name $roleName `
        --policy-arn $policyArn `
        --region $Region
    
    Write-Host "✅ Custom policy attached" -ForegroundColor Green
    
    # Wait for role to propagate
    Write-Host "⏳ Waiting for IAM role to propagate (10 seconds)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
}

Write-Host ""

# ============================================================================
# PHASE 2: Package Lambda Function
# ============================================================================
Write-Host "📦 Phase 2: Package Lambda Function" -ForegroundColor Cyan
Write-Host ""

# Check if lambda_function.py exists
if (-not (Test-Path "lambda_function.py")) {
    Write-Host "❌ lambda_function.py not found!" -ForegroundColor Red
    Write-Host "   Using existing lambda_function.py..." -ForegroundColor Yellow
}

# Create deployment package
Write-Host "Creating deployment package..." -ForegroundColor Yellow

# Clean up old package
if (Test-Path "lambda-deployment.zip") {
    Remove-Item "lambda-deployment.zip" -Force
}

# Note: Pillow dependencies should be added via Lambda layer or container
Write-Host "   Note: Using basic Lambda without external dependencies" -ForegroundColor Gray

# Create temporary directory for packaging
$tempDir = "lambda-temp-package"
if (Test-Path $tempDir) {
    Remove-Item $tempDir -Recurse -Force
}
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

# Copy lambda function
Copy-Item "lambda_function.py" -Destination $tempDir

Write-Host "✅ Lambda package created" -ForegroundColor Green
Write-Host "   Note: Pillow dependencies need to be added separately" -ForegroundColor Yellow
Write-Host ""

# Compress to zip
Compress-Archive -Path "$tempDir\*" -DestinationPath "lambda-deployment.zip" -Force

# Clean up temp directory
Remove-Item $tempDir -Recurse -Force

Write-Host "✅ Deployment package ready: lambda-deployment.zip" -ForegroundColor Green
Write-Host ""

# ============================================================================
# PHASE 3: Create/Update Lambda Function
# ============================================================================
Write-Host "🚀 Phase 3: Deploy Lambda Function" -ForegroundColor Cyan
Write-Host ""

# Check if function exists
Write-Host "Checking if function exists..." -ForegroundColor Yellow
$functionExists = $false
try {
    $existingFunction = aws lambda get-function --function-name $functionName --region $Region 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Function exists, updating code..." -ForegroundColor Green
        $functionExists = $true
    }
} catch {
    Write-Host "⚠️  Function does not exist, creating..." -ForegroundColor Yellow
}

if ($functionExists) {
    # Update existing function
    aws lambda update-function-code `
        --function-name $functionName `
        --zip-file fileb://lambda-deployment.zip `
        --region $Region | Out-Null
    
    Write-Host "✅ Function code updated" -ForegroundColor Green
} else {
    # Create new function
    $queueUrl = "https://sqs.$Region.amazonaws.com/$AccountId/$queueName"
    
    aws lambda create-function `
        --function-name $functionName `
        --runtime python3.11 `
        --role $roleArn `
        --handler lambda_function.lambda_handler `
        --zip-file fileb://lambda-deployment.zip `
        --timeout 300 `
        --memory-size 512 `
        --environment ('Variables={S3_BUCKET=' + $bucketName + ',SQS_QUEUE_URL=' + $queueUrl + ',REGION=' + $Region + '}') `
        --region $Region | Out-Null
    
    Write-Host "✅ Lambda function created: $functionName" -ForegroundColor Green
}

Write-Host ""

# ============================================================================
# PHASE 4: Connect SQS Trigger
# ============================================================================
Write-Host "🔗 Phase 4: Connect SQS Trigger" -ForegroundColor Cyan
Write-Host ""

$queueArn = "arn:aws:sqs:${Region}:${AccountId}:${queueName}"

Write-Host "Checking for existing event source mapping..." -ForegroundColor Yellow
$mappings = aws lambda list-event-source-mappings `
    --function-name $functionName `
    --region $Region | ConvertFrom-Json

$existingMapping = $mappings.EventSourceMappings | Where-Object { $_.EventSourceArn -eq $queueArn }

if ($existingMapping) {
    Write-Host "✅ SQS trigger already configured" -ForegroundColor Green
    Write-Host "   UUID: $($existingMapping.UUID)" -ForegroundColor Gray
} else {
    Write-Host "Creating SQS event source mapping..." -ForegroundColor Yellow
    
    $mapping = aws lambda create-event-source-mapping `
        --function-name $functionName `
        --event-source-arn $queueArn `
        --batch-size 10 `
        --region $Region | ConvertFrom-Json
    
    Write-Host "✅ SQS trigger connected" -ForegroundColor Green
    Write-Host "   UUID: $($mapping.UUID)" -ForegroundColor Gray
    Write-Host "   Batch Size: $($mapping.BatchSize)" -ForegroundColor Gray
}

Write-Host ""

# ============================================================================
# PHASE 5: Verification
# ============================================================================
Write-Host "✅ Phase 5: Verification" -ForegroundColor Cyan
Write-Host ""

# Get function details
$functionDetails = aws lambda get-function --function-name $functionName --region $Region | ConvertFrom-Json

Write-Host "Lambda Function Details:" -ForegroundColor Yellow
Write-Host "  Name: $($functionDetails.Configuration.FunctionName)" -ForegroundColor White
Write-Host "  ARN: $($functionDetails.Configuration.FunctionArn)" -ForegroundColor White
Write-Host "  Runtime: $($functionDetails.Configuration.Runtime)" -ForegroundColor White
Write-Host "  Handler: $($functionDetails.Configuration.Handler)" -ForegroundColor White
Write-Host "  Memory: $($functionDetails.Configuration.MemorySize) MB" -ForegroundColor White
Write-Host "  Timeout: $($functionDetails.Configuration.Timeout) seconds" -ForegroundColor White
Write-Host "  Last Modified: $($functionDetails.Configuration.LastModified)" -ForegroundColor White
Write-Host ""

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║            DEPLOYMENT SUCCESSFUL!                         ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Test by sending a message to the SQS queue" -ForegroundColor White
Write-Host "  2. Monitor CloudWatch Logs for function execution" -ForegroundColor White
Write-Host "  3. Check S3 for generated thumbnails" -ForegroundColor White
Write-Host ""
Write-Host "Test Command:" -ForegroundColor Yellow
Write-Host "  Send message to SQS queue with bucket and key parameters" -ForegroundColor Gray
Write-Host ""
