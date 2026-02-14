# Phase 0E: Cognito User Pools Setup
# Minimal version without encoding issues

$ErrorActionPreference = "Stop"
$region = "us-east-1"

Write-Host "`n=== Phase 0E: Cognito User Pools Setup ===" -ForegroundColor Cyan

# Store IDs for later
$ids = @{}

# ============================================================================
# Create Dev User Pool
# ============================================================================
Write-Host "`nCreating Dev User Pool..." -ForegroundColor Yellow

$devPool = aws cognito-idp create-user-pool `
    --pool-name "episode-metadata-users-dev" `
    --username-attributes email `
    --region $region | ConvertFrom-Json

$devPoolId = $devPool.UserPool.Id
Write-Host "Dev Pool created: $devPoolId" -ForegroundColor Green
$ids['dev_pool_id'] = $devPoolId

# Create Dev Client
$devClient = aws cognito-idp create-user-pool-client `
    --user-pool-id $devPoolId `
    --client-name "episode-metadata-api-client-dev" `
    --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH `
    --region $region | ConvertFrom-Json

$devClientId = $devClient.UserPoolClient.ClientId
$devClientSecret = $devClient.UserPoolClient.ClientSecret
Write-Host "Dev Client created: $devClientId" -ForegroundColor Green
$ids['dev_client_id'] = $devClientId
$ids['dev_client_secret'] = $devClientSecret

# Create groups in Dev Pool
@("admin", "editor", "viewer") | ForEach-Object {
    aws cognito-idp create-group `
        --group-name $_ `
        --user-pool-id $devPoolId `
        --description "$_ group for dev" `
        --region $region 2>&1 | Out-Null
}
Write-Host "Groups created: admin, editor, viewer" -ForegroundColor Green

# ============================================================================
# Create Staging User Pool
# ============================================================================
Write-Host "`nCreating Staging User Pool..." -ForegroundColor Yellow

$stagingPool = aws cognito-idp create-user-pool `
    --pool-name "episode-metadata-users-staging" `
    --username-attributes email `
    --region $region | ConvertFrom-Json

$stagingPoolId = $stagingPool.UserPool.Id
Write-Host "Staging Pool created: $stagingPoolId" -ForegroundColor Green
$ids['staging_pool_id'] = $stagingPoolId

# Create Staging Client
$stagingClient = aws cognito-idp create-user-pool-client `
    --user-pool-id $stagingPoolId `
    --client-name "episode-metadata-api-client-staging" `
    --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH `
    --region $region | ConvertFrom-Json

$stagingClientId = $stagingClient.UserPoolClient.ClientId
$stagingClientSecret = $stagingClient.UserPoolClient.ClientSecret
Write-Host "Staging Client created: $stagingClientId" -ForegroundColor Green
$ids['staging_client_id'] = $stagingClientId
$ids['staging_client_secret'] = $stagingClientSecret

# Create groups in Staging Pool
@("admin", "editor", "viewer") | ForEach-Object {
    aws cognito-idp create-group `
        --group-name $_ `
        --user-pool-id $stagingPoolId `
        --description "$_ group for staging" `
        --region $region 2>&1 | Out-Null
}
Write-Host "Groups created: admin, editor, viewer" -ForegroundColor Green

# ============================================================================
# Create Production User Pool
# ============================================================================
Write-Host "`nCreating Production User Pool..." -ForegroundColor Yellow

$prodPool = aws cognito-idp create-user-pool `
    --pool-name "episode-metadata-users-prod" `
    --username-attributes email `
    --region $region | ConvertFrom-Json

$prodPoolId = $prodPool.UserPool.Id
Write-Host "Production Pool created: $prodPoolId" -ForegroundColor Green
$ids['prod_pool_id'] = $prodPoolId

# Create Production Client
$prodClient = aws cognito-idp create-user-pool-client `
    --user-pool-id $prodPoolId `
    --client-name "episode-metadata-api-client-prod" `
    --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH `
    --region $region | ConvertFrom-Json

$prodClientId = $prodClient.UserPoolClient.ClientId
$prodClientSecret = $prodClient.UserPoolClient.ClientSecret
Write-Host "Production Client created: $prodClientId" -ForegroundColor Green
$ids['prod_client_id'] = $prodClientId
$ids['prod_client_secret'] = $prodClientSecret

# Create groups in Production Pool
@("admin", "editor", "viewer") | ForEach-Object {
    aws cognito-idp create-group `
        --group-name $_ `
        --user-pool-id $prodPoolId `
        --description "$_ group for production" `
        --region $region 2>&1 | Out-Null
}
Write-Host "Groups created: admin, editor, viewer" -ForegroundColor Green

# ============================================================================
# Create Test Users
# ============================================================================
Write-Host "`nCreating test users..." -ForegroundColor Yellow

$testUsers = @(
    @{email = "admin@episodeidentityform.com"; group = "admin"; name = "Admin User"}
    @{email = "editor@episodeidentityform.com"; group = "editor"; name = "Editor User"}
    @{email = "viewer@episodeidentityform.com"; group = "viewer"; name = "Viewer User"}
)

foreach ($pool in @($devPoolId, $stagingPoolId, $prodPoolId)) {
    foreach ($user in $testUsers) {
        aws cognito-idp admin-create-user `
            --user-pool-id $pool `
            --username $user.email `
            --user-attributes Name=email,Value=$user.email Name=name,Value=$user.name `
            --temporary-password "TempPass123!" `
            --region $region 2>&1 | Out-Null
        
        aws cognito-idp admin-add-user-to-group `
            --user-pool-id $pool `
            --username $user.email `
            --group-name $user.group `
            --region $region 2>&1 | Out-Null
    }
}
Write-Host "Test users created in all pools" -ForegroundColor Green

# ============================================================================
# Save IDs to file
# ============================================================================
Write-Host "`nSaving IDs to infrastructure-ids.txt..." -ForegroundColor Yellow

$content = @"
=== Cognito User Pool IDs ===
DEV_POOL_ID=$devPoolId
DEV_CLIENT_ID=$devClientId
DEV_CLIENT_SECRET=$devClientSecret

STAGING_POOL_ID=$stagingPoolId
STAGING_CLIENT_ID=$stagingClientId
STAGING_CLIENT_SECRET=$stagingClientSecret

PROD_POOL_ID=$prodPoolId
PROD_CLIENT_ID=$prodClientId
PROD_CLIENT_SECRET=$prodClientSecret

=== Test Users ===
admin@episodeidentityform.com (password: TempPass123! - change on first login)
editor@episodeidentityform.com (password: TempPass123! - change on first login)
viewer@episodeidentityform.com (password: TempPass123! - change on first login)

"@

Add-Content -Path "infrastructure-ids.txt" -Value $content
Write-Host "IDs saved to infrastructure-ids.txt" -ForegroundColor Green

Write-Host "`n=== Phase 0E Complete ===" -ForegroundColor Cyan
Write-Host "All Cognito User Pools created successfully!" -ForegroundColor Green
