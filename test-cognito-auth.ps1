# Cognito Authentication Test Script
# Tests API endpoints with valid AWS Cognito JWT tokens

Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "COGNITO AUTHENTICATION TEST" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan

$baseUrl = "http://localhost:3001"

# Instructions for getting a Cognito token
Write-Host "`n📋 HOW TO GET A COGNITO TOKEN:`n" -ForegroundColor Yellow
Write-Host "1. Go to AWS Cognito Console" -ForegroundColor Gray
Write-Host "2. Select your User Pool: $env:COGNITO_USER_POOL_ID" -ForegroundColor Gray
Write-Host "3. Go to 'App integration' > 'App clients and analytics'" -ForegroundColor Gray
Write-Host "4. Click on your app client" -ForegroundColor Gray
Write-Host "5. Go to 'Hosted UI' and login with test credentials" -ForegroundColor Gray
Write-Host "6. You'll get an authorization code in the redirect URL" -ForegroundColor Gray
Write-Host "7. Exchange the code for tokens using the token endpoint" -ForegroundColor Gray

Write-Host "`n🔐 MANUAL TOKEN EXCHANGE EXAMPLE:`n" -ForegroundColor Cyan
Write-Host "``powershell`n" -ForegroundColor Gray
Write-Host "curl -X POST https://<cognito-domain>.auth.<region>.amazoncognito.com/oauth2/token ``
  -H 'Content-Type: application/x-www-form-urlencoded' ``
  -d 'grant_type=authorization_code&client_id=<client_id>&code=<auth_code>&redirect_uri=http://localhost:3001&client_secret=<client_secret>'`n" -ForegroundColor Gray
Write-Host "``n" -ForegroundColor Gray

Write-Host "`n📌 FOR TESTING, CREATE A TEST USER:`n" -ForegroundColor Yellow
Write-Host "1. AWS Cognito > User Pools > Users and groups" -ForegroundColor Gray
Write-Host "2. Create user with email/username and temporary password" -ForegroundColor Gray
Write-Host "3. Use that user to login in Hosted UI" -ForegroundColor Gray
Write-Host "4. You'll be forced to set a permanent password on first login" -ForegroundColor Gray

Write-Host "`n🧪 TESTING PROTECTED ENDPOINTS:`n" -ForegroundColor Cyan
Write-Host "Once you have a valid token, paste it below to test protected endpoints`n" -ForegroundColor Gray

# Prompt for token
$token = Read-Host "Enter your Cognito JWT token (or press Enter to skip)"

if ($token) {
    Write-Host "`n✅ Token provided. Testing protected endpoints...`n" -ForegroundColor Green
    
    $headers = @{
        'Authorization' = "Bearer $token"
        'Content-Type' = 'application/json'
    }
    
    # Test 1: Search endpoint (requires auth)
    Write-Host "Test 1: Search Episodes (Protected)" -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl/api/v1/search?q=styling" `
            -UseBasicParsing -Headers $headers
        Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
        $response.Content | ConvertFrom-Json | ConvertTo-Json | Select-Object -First 10
    } catch {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host "`n"
    
    # Test 2: Jobs endpoint (requires auth)
    Write-Host "Test 2: List Jobs (Protected)" -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl/api/v1/jobs" `
            -UseBasicParsing -Headers $headers
        Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
        $response.Content | ConvertFrom-Json | ConvertTo-Json | Select-Object -First 10
    } catch {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host "`n"
    
    # Test 3: File upload endpoint (requires auth)
    Write-Host "Test 3: List Files (Protected)" -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl/api/v1/files" `
            -UseBasicParsing -Headers $headers
        Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
        $response.Content | ConvertFrom-Json | ConvertTo-Json | Select-Object -First 10
    } catch {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    
} else {
    Write-Host "`n⏭️  Skipping protected endpoint tests (no token provided)`n" -ForegroundColor Yellow
    
    Write-Host "`n🔓 TESTING PUBLIC ENDPOINTS (No Auth Required):`n" -ForegroundColor Cyan
    
    # Test public endpoints
    $publicTests = @(
        @{ Name = "Ping"; Endpoint = "/ping" },
        @{ Name = "Health"; Endpoint = "/health" },
        @{ Name = "List Episodes"; Endpoint = "/api/v1/episodes" },
        @{ Name = "List Thumbnails"; Endpoint = "/api/v1/thumbnails" }
    )
    
    foreach ($test in $publicTests) {
        Write-Host "Testing: $($test.Name)" -ForegroundColor Yellow
        try {
            $response = Invoke-WebRequest -Uri "$baseUrl$($test.Endpoint)" -UseBasicParsing
            Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
        } catch {
            Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

Write-Host "`n" + ("=" * 70) -ForegroundColor Cyan
Write-Host "`n💡 TOKEN DEBUGGING TIPS:`n" -ForegroundColor Yellow
Write-Host "1. Copy your token to https://jwt.io to decode it" -ForegroundColor Gray
Write-Host "2. Check the 'exp' claim to ensure it's not expired" -ForegroundColor Gray
Write-Host "3. Verify 'aud' claim matches your Cognito client ID" -ForegroundColor Gray
Write-Host "4. Look for custom claims your app might use" -ForegroundColor Gray

Write-Host "`n📚 COGNITO CONFIGURATION (from .env):`n" -ForegroundColor Cyan
Write-Host "User Pool ID: $env:COGNITO_USER_POOL_ID" -ForegroundColor Gray
Write-Host "Client ID: $env:COGNITO_CLIENT_ID" -ForegroundColor Gray
Write-Host "Region: $env:COGNITO_REGION" -ForegroundColor Gray

Write-Host "`n" + ("=" * 70) -ForegroundColor Cyan
