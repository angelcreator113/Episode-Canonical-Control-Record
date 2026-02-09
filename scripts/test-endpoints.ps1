#!/usr/bin/env pwsh
# Test API Endpoints

Write-Host "🧪 Testing API Endpoints..." -ForegroundColor Cyan
Write-Host ""

$BASE_URL = "http://localhost:3002/api/v1"
$ROOT_URL = "http://localhost:3002"

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url
    )
    
    Write-Host "Testing $Name..." -ForegroundColor Yellow
    try {
        $response = Invoke-RestMethod -Uri $Url -Method Get -ErrorAction Stop
        Write-Host "✅ $Name - OK" -ForegroundColor Green
        return $response
    } catch {
        Write-Host "❌ $Name - FAILED: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# Test health check (at root level)
Write-Host "`n=== HEALTH CHECK ===" -ForegroundColor Magenta
Test-Endpoint "Health Check" "$ROOT_URL/health"
Write-Host ""

# Test shows endpoint
Write-Host "=== SHOWS ===" -ForegroundColor Magenta
$shows = Test-Endpoint "Shows List" "$BASE_URL/shows"
if ($shows -and $shows.data -and $shows.data.Count -gt 0) {
    Write-Host "  Found $($shows.data.Count) shows" -ForegroundColor Gray
    $SHOW_ID = $shows.data[0].id
    
    # Test show config
    Test-Endpoint "Show Config" "$BASE_URL/shows/$SHOW_ID/config"
    
    # Test show template
    Test-Endpoint "Show Template" "$BASE_URL/shows/$SHOW_ID/template"
} else {
    Write-Host "⚠️  No shows found to test detailed endpoints" -ForegroundColor Yellow
}
Write-Host ""

# Test episodes endpoint
Write-Host "=== EPISODES ===" -ForegroundColor Magenta
$episodes = Test-Endpoint "Episodes List" "$BASE_URL/episodes"
if ($episodes -and $episodes.data) {
    Write-Host "  Found $($episodes.data.Count) episodes" -ForegroundColor Gray
}
Write-Host ""

# Test assets endpoint
Write-Host "=== ASSETS ===" -ForegroundColor Magenta
$assets = Test-Endpoint "Assets List" "$BASE_URL/assets"
if ($assets -and $assets.data) {
    Write-Host "  Found $($assets.data.Count) assets" -ForegroundColor Gray
}
Write-Host ""

# Test raw footage endpoint
Write-Host "=== RAW FOOTAGE ===" -ForegroundColor Magenta
$footage = Test-Endpoint "Raw Footage (via footage endpoint)" "$ROOT_URL/api/footage"
Write-Host "  Note: Use POST /api/footage/upload to upload new footage" -ForegroundColor Gray
Write-Host ""

# Test scenes endpoint
Write-Host "=== SCENES ===" -ForegroundColor Magenta
Test-Endpoint "Scenes List" "$BASE_URL/scenes"
Write-Host ""

# Test wardrobe endpoints
Write-Host "=== WARDROBE ===" -ForegroundColor Magenta
Test-Endpoint "Wardrobe List" "$BASE_URL/wardrobe"
Test-Endpoint "Wardrobe Library" "$BASE_URL/wardrobe-library"
Write-Host ""

# Test AI features
Write-Host "=== AI FEATURES ===" -ForegroundColor Magenta
Write-Host "  (Note: AI features require POST requests with specific footage IDs)" -ForegroundColor Gray
Write-Host "  Skipping automated tests - manual testing recommended" -ForegroundColor Gray
Write-Host ""

Write-Host "`n" + "=" * 50 -ForegroundColor Cyan
Write-Host "✅ All endpoint tests complete!" -ForegroundColor Green
Write-Host "=" * 50 -ForegroundColor Cyan
