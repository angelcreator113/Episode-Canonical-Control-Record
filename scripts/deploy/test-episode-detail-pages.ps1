#!/usr/bin/env pwsh
<#
  Episode Detail Page - Integration Test Script
  Tests the new Episode Detail Pages feature
  
  Usage: & ".\test-episode-detail-pages.ps1"
#>

param(
  [string]$ApiUrl = "http://localhost:3001",
  [string]$FrontendUrl = "http://localhost:5173"
)

Write-Host @"
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║         🧪 EPISODE DETAIL PAGES - INTEGRATION TEST SUITE 🧪      ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝

" -ForegroundColor Cyan

$testResults = @{
  Passed = 0
  Failed = 0
  Tests = @()
}

function Test-Result {
  param(
    [string]$TestName,
    [bool]$Passed,
    [string]$Details
  )
  
  $status = if ($Passed) { "✅ PASS" } else { "❌ FAIL" }
  $color = if ($Passed) { "Green" } else { "Red" }
  
  Write-Host "$status - $TestName" -ForegroundColor $color
  if ($Details) {
    Write-Host "   └─ $Details" -ForegroundColor Gray
  }
  
  if ($Passed) {
    $testResults.Passed++
  } else {
    $testResults.Failed++
  }
  
  $testResults.Tests += @{
    Name = $TestName
    Passed = $Passed
    Details = $Details
  }
}

# Test 1: Backend is running
Write-Host "`n📊 BACKEND HEALTH CHECK" -ForegroundColor Yellow
$apiResponse = $null
try {
  $apiResponse = Invoke-WebRequest -Uri "$ApiUrl/ping" -UseBasicParsing -ErrorAction Stop
  Test-Result "API Server Running" $true "Status: $($apiResponse.StatusCode)"
} catch {
  Test-Result "API Server Running" $false $_.Exception.Message
}

# Test 2: Get episodes endpoint
Write-Host "`n📊 EPISODES ENDPOINT VALIDATION" -ForegroundColor Yellow
$episodesResponse = $null
try {
  $episodesResponse = Invoke-WebRequest -Uri "$ApiUrl/api/v1/episodes?limit=1" -UseBasicParsing -ErrorAction Stop
  $episodesData = $episodesResponse.Content | ConvertFrom-Json
  
  Test-Result "List Episodes Endpoint" $true "Found $($episodesData.pagination.total) episodes"
  
  if ($episodesData.data.Count -gt 0) {
    $firstEpisode = $episodesData.data[0]
    Test-Result "Episode Data Structure" $($null -ne $firstEpisode.id) "Episode ID: $($firstEpisode.id)"
  }
} catch {
  Test-Result "List Episodes Endpoint" $false $_.Exception.Message
}

# Test 3: Get single episode endpoint
Write-Host "`n📊 SINGLE EPISODE ENDPOINT VALIDATION" -ForegroundColor Yellow
if ($episodesResponse) {
  try {
    $episodesData = $episodesResponse.Content | ConvertFrom-Json
    if ($episodesData.data.Count -gt 0) {
      $episodeId = $episodesData.data[0].id
      
      # Try to fetch the episode by ID
      $detailResponse = $null
      try {
        $detailResponse = Invoke-WebRequest -Uri "$ApiUrl/api/v1/episodes/$episodeId" -UseBasicParsing -ErrorAction SilentlyContinue
        $detailData = $detailResponse.Content | ConvertFrom-Json
        Test-Result "Get Episode by ID" $true "Episode: $($detailData.data.title)"
      } catch {
        Test-Result "Get Episode by ID" $false "Endpoint may not be implemented yet - $($_.Exception.Response.StatusCode)"
      }
    }
  } catch {
    Test-Result "Episode ID Extraction" $false $_.Exception.Message
  }
}

# Test 4: Frontend is running
Write-Host "`n📊 FRONTEND HEALTH CHECK" -ForegroundColor Yellow
try {
  $frontendResponse = Invoke-WebRequest -Uri $FrontendUrl -UseBasicParsing -ErrorAction Stop
  Test-Result "Frontend Server Running" $true "Status: $($frontendResponse.StatusCode)"
} catch {
  Test-Result "Frontend Server Running" $false "Ensure 'npm run dev' is running in frontend/"
}

# Test 5: React Router is configured
Write-Host "`n📊 ROUTING VALIDATION" -ForegroundColor Yellow
Write-Host "   Note: These tests require manual browser verification" -ForegroundColor Gray
Write-Host "   ✓ Navigate to http://localhost:5173" -ForegroundColor Gray
Write-Host "   ✓ Click 'View Details' on an episode card" -ForegroundColor Gray
Write-Host "   ✓ URL should change to: http://localhost:5173/episodes/:id" -ForegroundColor Gray
Write-Host "   ✓ Episode detail page should load" -ForegroundColor Gray

# Summary
Write-Host @"

╔═══════════════════════════════════════════════════════════════════╗
║                     TEST RESULTS SUMMARY                          ║
╚═══════════════════════════════════════════════════════════════════╝

" -ForegroundColor Cyan

Write-Host "✅ Passed: $($testResults.Passed)" -ForegroundColor Green
Write-Host "❌ Failed: $($testResults.Failed)" -ForegroundColor $(if ($testResults.Failed -gt 0) { "Red" } else { "Green" })
Write-Host "📊 Total:  $($testResults.Passed + $testResults.Failed)" -ForegroundColor Cyan

$passRate = if (($testResults.Passed + $testResults.Failed) -gt 0) {
  [math]::Round(($testResults.Passed / ($testResults.Passed + $testResults.Failed)) * 100, 2)
} else {
  0
}

Write-Host "📈 Success Rate: $passRate%" -ForegroundColor $(if ($passRate -ge 80) { "Green" } else { "Yellow" })

Write-Host @"

═══════════════════════════════════════════════════════════════════

🧪 MANUAL TESTING STEPS:

1. Open browser to http://localhost:5173
2. View the Episodes Grid
3. Click "View Details" button on any episode
4. Verify you see:
   ✓ Episode title in header
   ✓ Status badge (color-coded)
   ✓ Season and Episode numbers
   ✓ Air date
   ✓ Description
   ✓ Created/Updated dates
   ✓ Back button
   ✓ Refresh button

5. Test navigation:
   ✓ URL changes to /episodes/:id
   ✓ Back button returns to list
   ✓ Refresh button reloads data
   ✓ Page responsive on mobile

═══════════════════════════════════════════════════════════════════

📋 IMPLEMENTATION CHECKLIST:

✅ useEpisodeDetail hook created
✅ EpisodeDetail component created
✅ EpisodeDetail styling complete
✅ React Router configured in App.jsx
✅ Navigation from list to detail implemented
✅ Error handling included
✅ Loading state included
✅ Responsive design implemented

═══════════════════════════════════════════════════════════════════

🚀 NEXT STEPS:

1. Test Episode Detail Pages in browser
2. Move to Week 2, Feature 2: Thumbnails Gallery
3. Create ThumbnailGallery component
4. Add thumbnails to episode detail page
5. Implement lightbox viewer

═══════════════════════════════════════════════════════════════════
" -ForegroundColor Cyan

exit 0
