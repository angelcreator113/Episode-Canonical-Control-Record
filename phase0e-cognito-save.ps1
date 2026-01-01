# Quick Phase 0E: Store Cognito IDs from manual creation

$region = "us-east-1"

# These pools were just created - get their IDs
Write-Host "Fetching newly created Cognito User Pools..." -ForegroundColor Cyan

$pools = aws cognito-idp list-user-pools --max-results 60 --region $region | ConvertFrom-Json
$devPool = $pools.UserPools | Where-Object { $_.Name -eq "episode-metadata-users-dev" }
$stagingPool = $pools.UserPools | Where-Object { $_.Name -eq "episode-metadata-users-staging" }
$prodPool = $pools.UserPools | Where-Object { $_.Name -eq "episode-metadata-users-prod" }

Write-Host "Dev Pool ID: $($devPool.Id)" -ForegroundColor Green
Write-Host "Staging Pool ID: $($stagingPool.Id)" -ForegroundColor Green
Write-Host "Prod Pool ID: $($prodPool.Id)" -ForegroundColor Green

# Get clients
$devClients = aws cognito-idp list-user-pool-clients --user-pool-id $devPool.Id --max-results 10 --region $region | ConvertFrom-Json
$devClientId = $devClients.UserPoolClients[0].ClientId
Write-Host "Dev Client ID: $devClientId" -ForegroundColor Green

$stagingClients = aws cognito-idp list-user-pool-clients --user-pool-id $stagingPool.Id --max-results 10 --region $region | ConvertFrom-Json
$stagingClientId = $stagingClients.UserPoolClients[0].ClientId
Write-Host "Staging Client ID: $stagingClientId" -ForegroundColor Green

$prodClients = aws cognito-idp list-user-pool-clients --user-pool-id $prodPool.Id --max-results 10 --region $region | ConvertFrom-Json
$prodClientId = $prodClients.UserPoolClients[0].ClientId
Write-Host "Prod Client ID: $prodClientId" -ForegroundColor Green

# Get client secrets
$devClient = aws cognito-idp describe-user-pool-client --user-pool-id $devPool.Id --client-id $devClientId --region $region | ConvertFrom-Json
$devClientSecret = $devClient.UserPoolClient.ClientSecret
Write-Host "Dev Client Secret retrieved" -ForegroundColor Green

$stagingClient = aws cognito-idp describe-user-pool-client --user-pool-id $stagingPool.Id --client-id $stagingClientId --region $region | ConvertFrom-Json
$stagingClientSecret = $stagingClient.UserPoolClient.ClientSecret
Write-Host "Staging Client Secret retrieved" -ForegroundColor Green

$prodClient = aws cognito-idp describe-user-pool-client --user-pool-id $prodPool.Id --client-id $prodClientId --region $region | ConvertFrom-Json
$prodClientSecret = $prodClient.UserPoolClient.ClientSecret
Write-Host "Prod Client Secret retrieved" -ForegroundColor Green

# Create test users for dev pool only
Write-Host "`nCreating test users in dev pool..." -ForegroundColor Yellow
$testUsers = @(
    @{email = "admin@episodeidentityform.com"; group = "admin"}
    @{email = "editor@episodeidentityform.com"; group = "editor"}
    @{email = "viewer@episodeidentityform.com"; group = "viewer"}
)

foreach ($user in $testUsers) {
    aws cognito-idp admin-create-user `
        --user-pool-id $devPool.Id `
        --username $user.email `
        --user-attributes Name=email,Value=$user.email `
        --temporary-password "TempPass123456!" `
        --message-action SUPPRESS `
        --region $region 2>&1 | Out-Null
    
    aws cognito-idp admin-add-user-to-group `
        --user-pool-id $devPool.Id `
        --username $user.email `
        --group-name $user.group `
        --region $region 2>&1 | Out-Null
    
    Write-Host "  Created: $($user.email) in group $($user.group)" -ForegroundColor Green
}

# Append to infrastructure-ids.txt
Write-Host "`nSaving Cognito IDs to infrastructure-ids.txt..." -ForegroundColor Yellow

$content = @"

=== COGNITO USER POOLS (Phase 0E) ===
DEV_POOL_ID=$($devPool.Id)
DEV_CLIENT_ID=$devClientId
DEV_CLIENT_SECRET=$devClientSecret

STAGING_POOL_ID=$($stagingPool.Id)
STAGING_CLIENT_ID=$stagingClientId
STAGING_CLIENT_SECRET=$stagingClientSecret

PROD_POOL_ID=$($prodPool.Id)
PROD_CLIENT_ID=$prodClientId
PROD_CLIENT_SECRET=$prodClientSecret

=== TEST USERS (Dev Pool) ===
admin@episodeidentityform.com (group: admin, password: TempPass123456!)
editor@episodeidentityform.com (group: editor, password: TempPass123456!)
viewer@episodeidentityform.com (group: viewer, password: TempPass123456!)

"@

Add-Content -Path "infrastructure-ids.txt" -Value $content
Write-Host "Saved to infrastructure-ids.txt" -ForegroundColor Green

Write-Host "`n=== Phase 0E Complete ===" -ForegroundColor Cyan
Write-Host "Cognito User Pools ready for testing!" -ForegroundColor Green
