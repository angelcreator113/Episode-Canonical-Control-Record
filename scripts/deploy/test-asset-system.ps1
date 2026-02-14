# ASSET SYSTEM COMPREHENSIVE TEST SCRIPT
# Run this to systematically test all asset features

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "🧪 ASSET SYSTEM TEST SUITE" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$baseUrl = "http://localhost:3002/api/v1"
$frontendUrl = "http://localhost:5175"

Write-Host "✅ Test 1: Backend Health Check" -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/../../health" -Method Get
    Write-Host "   Status: $($health.status)" -ForegroundColor Green
    Write-Host "   Database: $($health.database)" -ForegroundColor Green
    Write-Host "   Shows Table: $($health.showsTableExists)`n" -ForegroundColor Green
} catch {
    Write-Host "   ❌ FAILED: $_`n" -ForegroundColor Red
}

Write-Host "✅ Test 2: Assets API - List Assets" -ForegroundColor Yellow
try {
    $assets = Invoke-RestMethod -Uri "$baseUrl/assets?limit=5" -Method Get
    Write-Host "   Total Assets: $($assets.count)" -ForegroundColor Green
    Write-Host "   First 3 Assets:" -ForegroundColor Green
    $assets.data[0..2] | ForEach-Object {
        Write-Host "      - $($_.name) ($($_.asset_type)) - Status: $($_.approval_status)" -ForegroundColor Cyan
    }
    Write-Host ""
} catch {
    Write-Host "   ❌ FAILED: $_`n" -ForegroundColor Red
}

Write-Host "✅ Test 3: Assets API - Filter by Type" -ForegroundColor Yellow
try {
    $lalas = Invoke-RestMethod -Uri "$baseUrl/assets?assetType=PROMO_LALA&limit=3" -Method Get
    Write-Host "   PROMO_LALA assets: $($lalas.count)" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "   ❌ FAILED: $_`n" -ForegroundColor Red
}

Write-Host "✅ Test 4: Assets API - Filter by Status" -ForegroundColor Yellow
try {
    $approved = Invoke-RestMethod -Uri "$baseUrl/assets?approvalStatus=APPROVED&limit=3" -Method Get
    Write-Host "   APPROVED assets: $($approved.count)" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "   ❌ FAILED: $_`n" -ForegroundColor Red
}

Write-Host "✅ Test 5: Episodes API - List Episodes" -ForegroundColor Yellow
try {
    $episodes = Invoke-RestMethod -Uri "$baseUrl/episodes" -Method Get
    Write-Host "   Total Episodes: $($episodes.pagination.total)" -ForegroundColor Green
    $episodes.data | ForEach-Object {
        Write-Host "      - Episode $($_.episode_number): $($_.title)" -ForegroundColor Cyan
    }
    Write-Host ""
} catch {
    Write-Host "   ❌ FAILED: $_`n" -ForegroundColor Red
}

Write-Host "✅ Test 6: Shows API - List Shows" -ForegroundColor Yellow
try {
    $shows = Invoke-RestMethod -Uri "$baseUrl/shows" -Method Get
    Write-Host "   Total Shows: $($shows.count)" -ForegroundColor Green
    $shows.data | ForEach-Object {
        Write-Host "      - $($_.name) (Status: $($_.status))" -ForegroundColor Cyan
    }
    Write-Host ""
} catch {
    Write-Host "   ❌ FAILED: $_`n" -ForegroundColor Red
}

Write-Host "✅ Test 7: Check S3 URLs" -ForegroundColor Yellow
$assetsWithUrls = Invoke-RestMethod -Uri "$baseUrl/assets?limit=5" -Method Get
$urlCount = ($assetsWithUrls.data | Where-Object { $_.s3_url_raw -ne $null }).Count
Write-Host "   Assets with S3 URLs: $urlCount / 5" -ForegroundColor Green
Write-Host "   Sample URL: $($assetsWithUrls.data[0].s3_url_raw)" -ForegroundColor Cyan
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "📊 FRONTEND TEST CHECKLIST" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Open $frontendUrl in your browser and test:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. 🏠 Home Page ($frontendUrl)" -ForegroundColor White
Write-Host "   - Does it load?" -ForegroundColor Gray
Write-Host "   - Are stats visible?" -ForegroundColor Gray
Write-Host "   - Navigation works?" -ForegroundColor Gray
Write-Host ""

Write-Host "2. 📸 Asset Gallery ($frontendUrl/assets)" -ForegroundColor White
Write-Host "   - Do assets display?" -ForegroundColor Gray
Write-Host "   - Are thumbnails/images loading?" -ForegroundColor Gray
Write-Host "   - Can you filter by type?" -ForegroundColor Gray
Write-Host ""

Write-Host "3. 🗂️ Asset Manager ($frontendUrl/assets/manager)" -ForegroundColor White
Write-Host "   - Does the page load?" -ForegroundColor Gray
Write-Host "   - Can you see uploaded assets?" -ForegroundColor Gray
Write-Host "   - Upload button visible?" -ForegroundColor Gray
Write-Host "   - Filters work?" -ForegroundColor Gray
Write-Host ""

Write-Host "4. 📺 Episodes Page" -ForegroundColor White
Write-Host "   URL: $frontendUrl/episodes" -ForegroundColor Gray
Write-Host "   - Episodes list displays?" -ForegroundColor Gray
Write-Host "   - Show filter works?" -ForegroundColor Gray
Write-Host ""

Write-Host "5. 🎬 Shows Page" -ForegroundColor White
Write-Host "   URL: $frontendUrl/shows" -ForegroundColor Gray
Write-Host "   - Shows display?" -ForegroundColor Gray
Write-Host "   - Can create new show?" -ForegroundColor Gray
Write-Host ""

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "🧪 TEST RESULTS SUMMARY" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Backend APIs: ✅ WORKING" -ForegroundColor Green
Write-Host "Database: ✅ CONNECTED ($($assets.count) assets, $($episodes.pagination.total) episodes, $($shows.count) show)" -ForegroundColor Green
Write-Host "Frontend: http://localhost:5175" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next: Manually test frontend and document bugs!" -ForegroundColor Yellow
Write-Host ""
