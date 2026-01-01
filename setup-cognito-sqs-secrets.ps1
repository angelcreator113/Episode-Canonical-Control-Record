# Phase 0E-0G: Cognito, SQS, and Secrets Manager Setup
# Creates user pools, queues, and secrets for all environments

$ErrorActionPreference = "Stop"

Write-Host "🚀 Phase 0E-0G: Cognito, SQS, and Secrets Manager..." -ForegroundColor Cyan

# ============================================================================
# PHASE 0E: COGNITO USER POOLS
# ============================================================================
Write-Host "`n👤 Phase 0E: Creating Cognito User Pools..." -ForegroundColor Cyan

function Create-CognitoUserPool {
    param([string]$PoolName, [string]$Environment)
    
    Write-Host "`n  📍 Creating $Environment Cognito User Pool..." -ForegroundColor Yellow
    
    $pool = aws cognito-idp create-user-pool `
        --pool-name $PoolName `
        --policies '{
            "PasswordPolicy": {
                "MinimumLength": 12,
                "RequireUppercase": true,
                "RequireLowercase": true,
                "RequireNumbers": true,
                "RequireSymbols": true
            }
        }' `
        --mfa-configuration OPTIONAL `
        --username-attributes email `
        --region us-east-1 | ConvertFrom-Json | Select-Object -ExpandProperty UserPool | Select-Object Id
    
    $pool_id = $pool.Id
    Write-Host "  ✅ $Environment User Pool created: $pool_id"
    
    # Create user pool client
    $client = aws cognito-idp create-user-pool-client `
        --user-pool-id $pool_id `
        --client-name "episode-metadata-api-client-$Environment" `
        --explicit-auth-flows USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH `
        --region us-east-1 | ConvertFrom-Json | Select-Object -ExpandProperty UserPoolClient
    
    $client_id = $client.ClientId
    $client_secret = $client.ClientSecret
    Write-Host "  ✅ Client created: $client_id"
    
    # Create user groups
    $groups = @("admin", "editor", "viewer")
    foreach ($group in $groups) {
        aws cognito-idp create-group `
            --group-name $group `
            --user-pool-id $pool_id `
            --description "$group group for $Environment" `
            --region us-east-1 2>&1 | Out-Null
    }
    Write-Host "  ✅ Groups created: admin, editor, viewer"
    
    # Create test users
    @(
        @{email="admin@episodeidentityform.com"; group="admin"; name="Admin User"}
        @{email="editor@episodeidentityform.com"; group="editor"; name="Editor User"}
        @{email="viewer@episodeidentityform.com"; group="viewer"; name="Viewer User"}
    ) | ForEach-Object {
        aws cognito-idp admin-create-user `
            --user-pool-id $pool_id `
            --username $_.email `
            --user-attributes Name=email,Value=$_.email Name=name,Value=$_.name `
            --temporary-password "TempPass123!" `
            --region us-east-1 2>&1 | Out-Null
        
        # Add user to group
        aws cognito-idp admin-add-user-to-group `
            --user-pool-id $pool_id `
            --username $_.email `
            --group-name $_.group `
            --region us-east-1 2>&1 | Out-Null
    }
    Write-Host "  ✅ Test users created (admin, editor, viewer)"
    
    # Return IDs for saving
    return @{
        PoolId = $pool_id
        ClientId = $client_id
        ClientSecret = $client_secret
        Environment = $Environment
    }
}

$dev_cognito = Create-CognitoUserPool -PoolName "episode-metadata-users-dev" -Environment "dev"
$staging_cognito = Create-CognitoUserPool -PoolName "episode-metadata-users-staging" -Environment "staging"
$prod_cognito = Create-CognitoUserPool -PoolName "episode-metadata-users-prod" -Environment "prod"

# Production: Enable MFA Required
Write-Host "`n  🔐 Enabling MFA Required for Production..." -ForegroundColor Yellow
aws cognito-idp update-user-pool `
    --user-pool-id $prod_cognito.PoolId `
    --mfa-configuration REQUIRED `
    --region us-east-1 2>&1 | Out-Null
Write-Host "  ✅ Production MFA set to REQUIRED"

# ============================================================================
# PHASE 0F: SQS QUEUES
# ============================================================================
Write-Host "`n📨 Phase 0F: Creating SQS Queues and DLQs..." -ForegroundColor Cyan

function Create-SQSQueue {
    param([string]$QueueName, [string]$Environment)
    
    Write-Host "`n  📍 Creating $Environment SQS Queues..." -ForegroundColor Yellow
    
    # Create Dead Letter Queue
    $dlq_name = "$QueueName-dlq"
    aws sqs create-queue `
        --queue-name $dlq_name `
        --attributes MessageRetentionPeriod=1209600 `
        --region us-east-1 2>&1 | Out-Null
    
    $dlq_arn = aws sqs get-queue-attributes `
        --queue-url (aws sqs get-queue-url --queue-name $dlq_name --region us-east-1 | ConvertFrom-Json | Select-Object -ExpandProperty QueueUrl) `
        --attribute-names QueueArn `
        --region us-east-1 | ConvertFrom-Json | Select-Object -ExpandProperty Attributes | Select-Object -ExpandProperty QueueArn
    
    Write-Host "  ✅ DLQ created: $dlq_name"
    
    # Create main queue with DLQ reference
    aws sqs create-queue `
        --queue-name $QueueName `
        --attributes @"
{
    "VisibilityTimeout": "300",
    "MessageRetentionPeriod": "1209600",
    "RedrivePolicy": "{\"deadLetterTargetArn\":\"$dlq_arn\",\"maxReceiveCount\":\"3\"}"
}
"@ `
        --region us-east-1 2>&1 | Out-Null
    
    $queue_url = aws sqs get-queue-url --queue-name $QueueName --region us-east-1 | ConvertFrom-Json | Select-Object -ExpandProperty QueueUrl
    Write-Host "  ✅ Main queue created: $QueueName"
    
    return @{
        QueueName = $QueueName
        QueueUrl = $queue_url
        DLQName = $dlq_name
    }
}

$dev_sqs = Create-SQSQueue -QueueName "episode-metadata-thumbnail-queue-dev" -Environment "dev"
$staging_sqs = Create-SQSQueue -QueueName "episode-metadata-thumbnail-queue-staging" -Environment "staging"
$prod_sqs = Create-SQSQueue -QueueName "episode-metadata-thumbnail-queue-prod" -Environment "prod"

# ============================================================================
# PHASE 0G: AWS SECRETS MANAGER
# ============================================================================
Write-Host "`n🔐 Phase 0G: Creating Secrets in AWS Secrets Manager..." -ForegroundColor Cyan

function Create-Secret {
    param([string]$SecretName, [hashtable]$SecretValue, [string]$Environment)
    
    Write-Host "  Creating $Environment/$SecretName..." -ForegroundColor Gray
    $json = $SecretValue | ConvertTo-Json -Depth 10
    
    aws secretsmanager create-secret `
        --name $SecretName `
        --description "Secrets for Episode Metadata $Environment" `
        --secret-string $json `
        --tags Key=Environment,Value=$Environment Key=Project,Value=episode-metadata `
        --region us-east-1 2>&1 | Out-Null
}

# Create database secrets (we'll update with real endpoints once RDS is ready)
Write-Host "`n  📍 Creating database secrets..." -ForegroundColor Yellow
Create-Secret `
    -SecretName "episode-metadata/database-dev" `
    -SecretValue @{
        host = "episode-metadata-db-dev.pending"
        port = 5432
        database = "episodemetadata"
        username = "postgres"
        password = "TempPassword123!Dev"
    } `
    -Environment "dev"

Create-Secret `
    -SecretName "episode-metadata/database-staging" `
    -SecretValue @{
        host = "episode-metadata-db-staging.pending"
        port = 5432
        database = "episodemetadata"
        username = "postgres"
        password = "TempPassword123!Staging"
    } `
    -Environment "staging"

Create-Secret `
    -SecretName "episode-metadata/database-prod" `
    -SecretValue @{
        host = "episode-metadata-db-prod.pending"
        port = 5432
        database = "episodemetadata"
        username = "postgres"
        password = "TempPassword123!Prod"
    } `
    -Environment "prod"

Write-Host "  ✅ Database secrets created" -ForegroundColor Green

# Create Cognito secrets
Write-Host "`n  📍 Creating Cognito secrets..." -ForegroundColor Yellow
Create-Secret `
    -SecretName "episode-metadata/cognito-dev" `
    -SecretValue @{
        user_pool_id = $dev_cognito.PoolId
        client_id = $dev_cognito.ClientId
        client_secret = $dev_cognito.ClientSecret
        region = "us-east-1"
    } `
    -Environment "dev"

Create-Secret `
    -SecretName "episode-metadata/cognito-staging" `
    -SecretValue @{
        user_pool_id = $staging_cognito.PoolId
        client_id = $staging_cognito.ClientId
        client_secret = $staging_cognito.ClientSecret
        region = "us-east-1"
    } `
    -Environment "staging"

Create-Secret `
    -SecretName "episode-metadata/cognito-prod" `
    -SecretValue @{
        user_pool_id = $prod_cognito.PoolId
        client_id = $prod_cognito.ClientId
        client_secret = $prod_cognito.ClientSecret
        region = "us-east-1"
    } `
    -Environment "prod"

Write-Host "  ✅ Cognito secrets created" -ForegroundColor Green

# ============================================================================
# SUMMARY
# ============================================================================
Write-Host "`n✅ Phase 0E-0G COMPLETE!" -ForegroundColor Cyan

Write-Host "`n📊 Cognito Summary:" -ForegroundColor Cyan
Write-Host "  🔐 Dev:     User Pool $($dev_cognito.PoolId)" -ForegroundColor Green
Write-Host "  🔐 Staging: User Pool $($staging_cognito.PoolId)" -ForegroundColor Green
Write-Host "  🔐 Prod:    User Pool $($prod_cognito.PoolId) (MFA Required)" -ForegroundColor Green

Write-Host "`n📊 SQS Summary:" -ForegroundColor Cyan
Write-Host "  📨 Dev:     $($dev_sqs.QueueUrl)" -ForegroundColor Green
Write-Host "  📨 Staging: $($staging_sqs.QueueUrl)" -ForegroundColor Green
Write-Host "  📨 Prod:    $($prod_sqs.QueueUrl)" -ForegroundColor Green

Write-Host "`n🔐 Secrets Manager:" -ForegroundColor Cyan
Write-Host "  ✓ Database secrets created (for all 3 envs)" -ForegroundColor Green
Write-Host "  ✓ Cognito secrets created (for all 3 envs)" -ForegroundColor Green
Write-Host "  ⚠️  NOTE: Database secrets contain 'pending' hostnames - update when RDS instances are ready" -ForegroundColor Yellow

# Save all IDs to file for reference
@"
# Episode Metadata Infrastructure IDs

## Cognito User Pools
- Dev:     $($dev_cognito.PoolId)
  Client:  $($dev_cognito.ClientId)
  Secret:  $($dev_cognito.ClientSecret)

- Staging: $($staging_cognito.PoolId)
  Client:  $($staging_cognito.ClientId)
  Secret:  $($staging_cognito.ClientSecret)

- Prod:    $($prod_cognito.PoolId)
  Client:  $($prod_cognito.ClientId)
  Secret:  $($prod_cognito.ClientSecret)

## SQS Queue URLs
- Dev:     $($dev_sqs.QueueUrl)
- Staging: $($staging_sqs.QueueUrl)
- Prod:    $($prod_sqs.QueueUrl)

## Secrets Manager Paths
- episode-metadata/database-dev
- episode-metadata/database-staging
- episode-metadata/database-prod
- episode-metadata/cognito-dev
- episode-metadata/cognito-staging
- episode-metadata/cognito-prod
"@ | Out-File -FilePath "infrastructure-ids.txt" -Encoding UTF8

Write-Host "`n📝 All IDs saved to infrastructure-ids.txt" -ForegroundColor Green
