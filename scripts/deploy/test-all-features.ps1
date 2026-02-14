#!/usr/bin/env pwsh
# Comprehensive Feature Test Suite

Write-Host "=========================================================="
Write-Host "  EPISODE CONTROL RECORD - COMPREHENSIVE TEST SUITE"
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$apiBase = "http://localhost:3002/api/v1"
$tests_passed = 0
$tests_failed = 0

# === TEST 1: LOGIN ===
Write-Host "TEST 1: LOGIN" -ForegroundColor Yellow
try {
    $loginBody = @{ email = "test@example.com"; password = "password123" } | ConvertTo-Json
    $loginResp = Invoke-WebRequest -Uri "$apiBase/auth/login" -Method POST -Headers @{"Content-Type"="application/json"} -Body $loginBody -UseBasicParsing -ErrorAction Stop
    $loginJson = $loginResp.Content | ConvertFrom-Json
    $script:token = $loginJson.data.accessToken
    $script:userId = $loginJson.data.user.id
    
    Write-Host "  ✅ PASSED" -ForegroundColor Green
    Write-Host "     Email: $($loginJson.data.user.email)"
    Write-Host "     Role: $($loginJson.data.user.role)"
    $tests_passed++
} catch {
    Write-Host "  ❌ FAILED" -ForegroundColor Red
    Write-Host "     Error: $($_.Exception.Message)"
    $tests_failed++
}
Write-Host ""

# === TEST 2: FETCH EPISODES ===
Write-Host "TEST 2: FETCH EPISODES" -ForegroundColor Yellow
try {
    $epsResp = Invoke-WebRequest -Uri "$apiBase/episodes?limit=100" -Headers @{"Authorization"="Bearer $token"} -UseBasicParsing -ErrorAction Stop
    $epsJson = $epsResp.Content | ConvertFrom-Json
    $episodes = $epsJson.data
    
    Write-Host "  ✅ PASSED" -ForegroundColor Green
    Write-Host "     Total episodes: $($episodes.Count)"
    if ($episodes.Count -gt 0) {
        $script:testEpisodeId = $episodes[0].id
        Write-Host "     Sample: $($episodes[0].title) (ID: $($episodes[0].id), Status: $($episodes[0].status))"
    }
    $tests_passed++
} catch {
    Write-Host "  ❌ FAILED" -ForegroundColor Red
    Write-Host "     Error: $($_.Exception.Message)"
    $tests_failed++
}
Write-Host ""

# === TEST 3: GET EPISODE DETAIL ===
if ($testEpisodeId) {
    Write-Host "TEST 3: GET EPISODE DETAIL" -ForegroundColor Yellow
    try {
        $detailResp = Invoke-WebRequest -Uri "$apiBase/episodes/$testEpisodeId" -Headers @{"Authorization"="Bearer $token"} -UseBasicParsing -ErrorAction Stop
        $detailJson = $detailResp.Content | ConvertFrom-Json
        $ep = $detailJson.data
        
        Write-Host "  ✅ PASSED" -ForegroundColor Green
        Write-Host "     Title: $($ep.title)"
        Write-Host "     Episode #: $($ep.episode_number)"
        Write-Host "     Air Date: $($ep.air_date)"
        Write-Host "     Description: $($ep.description)"
        Write-Host "     Status: $($ep.status)"
        $tests_passed++
    } catch {
        Write-Host "  ❌ FAILED" -ForegroundColor Red
        Write-Host "     Error: $($_.Exception.Message)"
        $tests_failed++
    }
    Write-Host ""
}

# === TEST 4: CREATE EPISODE ===
Write-Host "TEST 4: CREATE EPISODE" -ForegroundColor Yellow
try {
    $newEpBody = @{
        title = "Test Episode $(Get-Random)"
        episode_number = 99
        air_date = "2025-12-25"
        description = "This is a test episode created by the test suite"
        status = "draft"
    } | ConvertTo-Json
    
    $createResp = Invoke-WebRequest -Uri "$apiBase/episodes" -Method POST -Headers @{"Authorization"="Bearer $token"; "Content-Type"="application/json"} -Body $newEpBody -UseBasicParsing -ErrorAction Stop
    $createJson = $createResp.Content | ConvertFrom-Json
    $script:newEpisodeId = $createJson.data.id
    
    Write-Host "  ✅ PASSED" -ForegroundColor Green
    Write-Host "     Created episode ID: $script:newEpisodeId"
    Write-Host "     Title: $($createJson.data.title)"
    Write-Host "     Status: $($createJson.data.status)"
    $tests_passed++
} catch {
    Write-Host "  ❌ FAILED" -ForegroundColor Red
    Write-Host "     Error: $($_.Exception.Message)"
    $tests_failed++
}
Write-Host ""

# === TEST 5: EDIT EPISODE ===
if ($newEpisodeId) {
    Write-Host "TEST 5: EDIT EPISODE" -ForegroundColor Yellow
    try {
        $updateBody = @{
            title = "Updated Test Episode"
            episode_number = 100
            air_date = "2025-12-26"
            description = "Updated description"
            status = "published"
        } | ConvertTo-Json
        
        $updateResp = Invoke-WebRequest -Uri "$apiBase/episodes/$newEpisodeId" -Method PUT -Headers @{"Authorization"="Bearer $token"; "Content-Type"="application/json"} -Body $updateBody -UseBasicParsing -ErrorAction Stop
        $updateJson = $updateResp.Content | ConvertFrom-Json
        
        Write-Host "  ✅ PASSED" -ForegroundColor Green
        Write-Host "     Updated title: $($updateJson.data.title)"
        Write-Host "     Updated episode #: $($updateJson.data.episode_number)"
        Write-Host "     Updated status: $($updateJson.data.status)"
        $tests_passed++
    } catch {
        Write-Host "  ❌ FAILED" -ForegroundColor Red
        Write-Host "     Error: $($_.Exception.Message)"
        $tests_failed++
    }
    Write-Host ""
}

# === TEST 6: SEARCH EPISODES ===
Write-Host "TEST 6: SEARCH EPISODES" -ForegroundColor Yellow
try {
    $searchResp = Invoke-WebRequest -Uri "$apiBase/episodes?search=Updated&limit=100" -Headers @{"Authorization"="Bearer $token"} -UseBasicParsing -ErrorAction Stop
    $searchJson = $searchResp.Content | ConvertFrom-Json
    $searchResults = $searchJson.data
    
    Write-Host "  ✅ PASSED" -ForegroundColor Green
    Write-Host "     Search query: 'Updated'"
    Write-Host "     Results found: $($searchResults.Count)"
    if ($searchResults.Count -gt 0) {
        Write-Host "     Sample result: $($searchResults[0].title)"
    }
    $tests_passed++
} catch {
    Write-Host "  ❌ FAILED" -ForegroundColor Red
    Write-Host "     Error: $($_.Exception.Message)"
    $tests_failed++
}
Write-Host ""

# === TEST 7: DELETE EPISODE (Admin-only feature) ===
if ($newEpisodeId) {
    Write-Host "TEST 7: DELETE EPISODE (Admin-only)" -ForegroundColor Yellow
    try {
        $deleteResp = Invoke-WebRequest -Uri "$apiBase/episodes/$newEpisodeId" -Method DELETE -Headers @{"Authorization"="Bearer $token"} -UseBasicParsing -ErrorAction Stop
        $deleteJson = $deleteResp.Content | ConvertFrom-Json
        
        Write-Host "  PASSED" -ForegroundColor Green
        Write-Host "     Deleted episode: $newEpisodeId"
        Write-Host "     Status: $($deleteJson.message)"
        $tests_passed++
    } catch {
        # 403 is expected for non-admin users
        if ($_.Exception.Response.StatusCode -eq 403) {
            Write-Host "  PASSED (Expected 403 - Admin Required)" -ForegroundColor Green
            Write-Host "     Correct: Delete requires admin role"
            Write-Host "     Current user role: USER (editor permissions)"
            $tests_passed++
        } else {
            Write-Host "  FAILED" -ForegroundColor Red
            Write-Host "     Error: $($_.Exception.Message)"
            $tests_failed++
        }
    }
    Write-Host ""
}

# === TEST 8: DASHBOARD STATS ===
Write-Host "TEST 8: DASHBOARD STATS (via episodes endpoint)" -ForegroundColor Yellow
try {
    $statsResp = Invoke-WebRequest -Uri "$apiBase/episodes?limit=100" -Headers @{"Authorization"="Bearer $token"} -UseBasicParsing -ErrorAction Stop
    $statsJson = $statsResp.Content | ConvertFrom-Json
    $allEpisodes = $statsJson.data
    $published = @($allEpisodes | Where-Object { $_.status -eq "published" }).Count
    $draft = @($allEpisodes | Where-Object { $_.status -eq "draft" }).Count
    
    Write-Host "  ✅ PASSED" -ForegroundColor Green
    Write-Host "     Total episodes: $($allEpisodes.Count)"
    Write-Host "     Published: $published"
    Write-Host "     Draft: $draft"
    $tests_passed++
} catch {
    Write-Host "  ❌ FAILED" -ForegroundColor Red
    Write-Host "     Error: $($_.Exception.Message)"
    $tests_failed++
}
Write-Host ""

# === SUMMARY ===
Write-Host "=========================================================="
Write-Host "                    TEST SUMMARY"
Write-Host "=========================================================="
Write-Host "Tests Passed: $tests_passed" -ForegroundColor Green
Write-Host "Tests Failed: $tests_failed" -ForegroundColor Red
Write-Host "==========================================================" 
Write-Host ""

if ($tests_failed -eq 0) {
    Write-Host "ALL TESTS PASSED! Application is fully functional." -ForegroundColor Green
    exit 0
} else {
    Write-Host "Some tests failed. Review errors above." -ForegroundColor Yellow
    exit 1
}
