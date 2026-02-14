# Test API endpoints
Write-Host "Testing API endpoints..." -ForegroundColor Cyan

# Test /ping
Write-Host "`n1. Testing /ping endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/ping" -UseBasicParsing -TimeoutSec 5
    Write-Host "✅ /ping - Status: $($response.StatusCode)" -ForegroundColor Green
    $response.Content | ConvertFrom-Json | ConvertTo-Json | Write-Host
} catch {
    Write-Host "❌ /ping - Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test /health
Write-Host "`n2. Testing /health endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing -TimeoutSec 5
    Write-Host "✅ /health - Status: $($response.StatusCode)" -ForegroundColor Green
    $response.Content | ConvertFrom-Json | ConvertTo-Json | Write-Host
} catch {
    Write-Host "❌ /health - Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test /api/v1/episodes
Write-Host "`n3. Testing /api/v1/episodes endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/v1/episodes" -UseBasicParsing -TimeoutSec 5
    Write-Host "✅ /api/v1/episodes - Status: $($response.StatusCode)" -ForegroundColor Green
    $data = $response.Content | ConvertFrom-Json
    Write-Host "Response: $($data | ConvertTo-Json)" -ForegroundColor Green
} catch {
    Write-Host "❌ /api/v1/episodes - Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nTest complete!" -ForegroundColor Cyan
