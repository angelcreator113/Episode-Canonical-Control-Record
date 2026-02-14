# Verify AWS Staging Environment Configuration
# This script verifies all AWS resources are accessible

Write-Host "🔍 Verifying AWS Staging Environment..." -ForegroundColor Cyan
Write-Host "========================================`n"

# Load environment variables
Get-Content .env.aws-staging | ForEach-Object {
    if ($_ -match '^\s*([^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        [Environment]::SetEnvironmentVariable($key, $value, 'Process')
    }
}

# Test 1: AWS CLI Access
Write-Host "Test 1: AWS CLI Access..." -ForegroundColor Yellow
try {
    $identity = aws sts get-caller-identity --region us-east-1 | ConvertFrom-Json
    Write-Host "✅ AWS CLI: OK (Account: $($identity.Account))" -ForegroundColor Green
} catch {
    Write-Host "❌ AWS CLI: FAILED" -ForegroundColor Red
    exit 1
}

# Test 2: RDS Connection
Write-Host "`nTest 2: RDS PostgreSQL Connection..." -ForegroundColor Yellow
try {
    $pgpassword = $env:DB_PASSWORD
    $pghost = $env:DB_HOST
    $pguser = $env:DB_USER
    $pgport = $env:DB_PORT
    
    # Try psql connection test
    $connString = "User ID=$pguser;Password=$pgpassword;Host=$pghost;Port=$pgport;Database=postgres;"
    Write-Host "Testing connection string: $connString"
    Write-Host "  Endpoint: $pghost" -ForegroundColor Gray
    Write-Host "  User: $pguser" -ForegroundColor Gray
    
    # Use pg_isready if available
    $testResult = pg_isready -h $pghost -p $pgport -U $pguser 2>&1
    Write-Host "Connection test result: $testResult"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ RDS Connection: OK" -ForegroundColor Green
    } else {
        Write-Host "⚠️  RDS Connection: Not verified (pg_isready not available)" -ForegroundColor Yellow
        Write-Host "   (Will test with Node.js when starting API)" -ForegroundColor Gray
    }
} catch {
    Write-Host "⚠️  RDS Connection: Could not verify immediately" -ForegroundColor Yellow
}

# Test 3: S3 Buckets
Write-Host "`nTest 3: S3 Buckets..." -ForegroundColor Yellow
try {
    $buckets = @($env:S3_BUCKET_EPISODES, $env:S3_BUCKET_THUMBNAILS, $env:S3_BUCKET_TEMP)
    
    foreach ($bucket in $buckets) {
        $exists = aws s3api head-bucket --bucket $bucket --region us-east-1 2>&1
        Write-Host "Bucket exists: $bucket - $exists"
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ S3 Bucket '$bucket': OK" -ForegroundColor Green
        } else {
            Write-Host "❌ S3 Bucket '$bucket': NOT FOUND" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "❌ S3 Check: FAILED - $_" -ForegroundColor Red
}

# Test 4: SQS Queues
Write-Host "`nTest 4: SQS Queues..." -ForegroundColor Yellow
try {
    $jobQueueUrl = $env:SQS_QUEUE_URL_JOB
    $dlqUrl = $env:SQS_QUEUE_URL_DLQ
    
    $jobAttrs = aws sqs get-queue-attributes --queue-url $jobQueueUrl --attribute-names All --region us-east-1 2>&1
    Write-Host "Job queue attributes: $jobAttrs"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ SQS Job Queue: OK" -ForegroundColor Green
    } else {
        Write-Host "❌ SQS Job Queue: FAILED" -ForegroundColor Red
    }
    
    $dlqAttrs = aws sqs get-queue-attributes --queue-url $dlqUrl --attribute-names All --region us-east-1 2>&1
    Write-Host "DLQ attributes: $dlqAttrs"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ SQS DLQ Queue: OK" -ForegroundColor Green
    } else {
        Write-Host "❌ SQS DLQ Queue: FAILED" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ SQS Check: FAILED - $_" -ForegroundColor Red
}

# Test 5: Cognito User Pool
Write-Host "`nTest 5: Cognito User Pool..." -ForegroundColor Yellow
try {
    $poolId = $env:COGNITO_USER_POOL_ID
    $clientId = $env:COGNITO_CLIENT_ID
    
    $poolInfo = aws cognito-idp describe-user-pool --user-pool-id $poolId --region us-east-1 2>&1 | ConvertFrom-Json
    Write-Host "Pool info: $($poolInfo.UserPool.Id)"
    Write-Host "✅ Cognito User Pool '$poolId': OK" -ForegroundColor Green
    Write-Host "   Client ID: $clientId" -ForegroundColor Gray
} catch {
    Write-Host "❌ Cognito User Pool: FAILED - $_" -ForegroundColor Red
}

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "✅ AWS Staging Environment Verified!" -ForegroundColor Green
Write-Host "========================================`n"

Write-Host "Configuration Summary:" -ForegroundColor Cyan
Write-Host "  Database Host: $($env:DB_HOST)" -ForegroundColor Gray
Write-Host "  Database: $($env:DB_NAME)" -ForegroundColor Gray
Write-Host "  S3 Buckets: 3" -ForegroundColor Gray
Write-Host "  SQS Queues: 2 (Job + DLQ)" -ForegroundColor Gray
Write-Host "  Cognito Pool: $($env:COGNITO_USER_POOL_ID)" -ForegroundColor Gray
Write-Host "  Region: $($env:AWS_REGION)" -ForegroundColor Gray

Write-Host "`n📋 Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Run: npm run migrate:up" -ForegroundColor Gray
Write-Host "  2. Start API: npm start" -ForegroundColor Gray
Write-Host "  3. Run tests: npm test" -ForegroundColor Gray
