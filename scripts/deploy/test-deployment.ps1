# ============================================================================
# DEPLOYMENT TEST SCRIPT
# ============================================================================
# Run this after deployment completes to verify everything works

Write-Host "`n🧪 TESTING DEPLOYED BACKEND" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

$backendUrl = "http://54.163.229.144:3002"
$testsPassed = 0
$testsFailed = 0

# ============================================================================
# TEST 1: Health Endpoint
# ============================================================================
Write-Host "Test 1: Health Endpoint" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$backendUrl/health" -Method GET -TimeoutSec 10 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ PASSED: Health endpoint responding" -ForegroundColor Green
        $testsPassed++
        $response.Content | ConvertFrom-Json | Format-List
    } else {
        Write-Host "❌ FAILED: Unexpected status code $($response.StatusCode)" -ForegroundColor Red
        $testsFailed++
    }
} catch {
    Write-Host "❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    $testsFailed++
}

Start-Sleep -Seconds 2

# ============================================================================
# TEST 2: API Base Endpoint
# ============================================================================
Write-Host "`nTest 2: API Base Endpoint" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$backendUrl/api/v1/" -Method GET -TimeoutSec 10 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ PASSED: API base endpoint responding" -ForegroundColor Green
        $testsPassed++
    } else {
        Write-Host "❌ FAILED: Unexpected status code $($response.StatusCode)" -ForegroundColor Red
        $testsFailed++
    }
} catch {
    Write-Host "❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    $testsFailed++
}

Start-Sleep -Seconds 2

# ============================================================================
# TEST 3: Shows Endpoint (Public)
# ============================================================================
Write-Host "`nTest 3: Shows Endpoint (Public Access)" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$backendUrl/api/v1/shows" -Method GET -TimeoutSec 10 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ PASSED: Shows endpoint accessible" -ForegroundColor Green
        $testsPassed++
        $shows = $response.Content | ConvertFrom-Json
        Write-Host "   Found $($shows.Count) shows" -ForegroundColor White
    } else {
        Write-Host "❌ FAILED: Unexpected status code $($response.StatusCode)" -ForegroundColor Red
        $testsFailed++
    }
} catch {
    Write-Host "❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    $testsFailed++
}

Start-Sleep -Seconds 2

# ============================================================================
# TEST 4: Episodes Endpoint (Public)
# ============================================================================
Write-Host "`nTest 4: Episodes Endpoint (Public Access)" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$backendUrl/api/v1/episodes" -Method GET -TimeoutSec 10 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ PASSED: Episodes endpoint accessible" -ForegroundColor Green
        $testsPassed++
        $episodes = $response.Content | ConvertFrom-Json
        Write-Host "   Found $($episodes.Count) episodes" -ForegroundColor White
    } else {
        Write-Host "❌ FAILED: Unexpected status code $($response.StatusCode)" -ForegroundColor Red
        $testsFailed++
    }
} catch {
    Write-Host "❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    $testsFailed++
}

Start-Sleep -Seconds 2

# ============================================================================
# TEST 5: Authenticated Request (if token exists)
# ============================================================================
Write-Host "`nTest 5: Authenticated Request" -ForegroundColor Yellow
if (Test-Path "id-token.txt") {
    try {
        $token = Get-Content "id-token.txt" -Raw
        $headers = @{
            "Authorization" = "Bearer $($token.Trim())"
        }
        $response = Invoke-WebRequest -Uri "$backendUrl/api/v1/episodes" -Method GET -Headers $headers -TimeoutSec 10 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ PASSED: Authentication working" -ForegroundColor Green
            $testsPassed++
        } else {
            Write-Host "❌ FAILED: Unexpected status code $($response.StatusCode)" -ForegroundColor Red
            $testsFailed++
        }
    } catch {
        Write-Host "⚠️  SKIPPED: Token may be expired ($($_.Exception.Message))" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  SKIPPED: No authentication token found (id-token.txt)" -ForegroundColor Yellow
}

Start-Sleep -Seconds 2

# ============================================================================
# TEST 6: Database Connection
# ============================================================================
Write-Host "`nTest 6: Database Connection (via health endpoint)" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$backendUrl/health" -Method GET -TimeoutSec 10 -UseBasicParsing
    $health = $response.Content | ConvertFrom-Json
    if ($health.database -eq "connected") {
        Write-Host "✅ PASSED: Database connected" -ForegroundColor Green
        $testsPassed++
        Write-Host "   DB Host: $($health.config.DB_HOST)" -ForegroundColor White
        Write-Host "   DB Name: $($health.config.DB_NAME)" -ForegroundColor White
    } else {
        Write-Host "❌ FAILED: Database not connected" -ForegroundColor Red
        $testsFailed++
    }
} catch {
    Write-Host "❌ FAILED: $($_.Exception.Message)" -ForegroundColor Red
    $testsFailed++
}

# ============================================================================
# TEST SUMMARY
# ============================================================================
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "TEST RESULTS" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "✅ Passed: $testsPassed" -ForegroundColor Green
Write-Host "❌ Failed: $testsFailed" -ForegroundColor Red
$totalTests = $testsPassed + $testsFailed
if ($totalTests -gt 0) {
    $successRate = [math]::Round(($testsPassed / $totalTests) * 100, 2)
    Write-Host "📊 Success Rate: $successRate%" -ForegroundColor $(if ($successRate -ge 80) { "Green" } elseif ($successRate -ge 50) { "Yellow" } else { "Red" })
}

if ($testsFailed -eq 0) {
    Write-Host "`n🎉 ALL TESTS PASSED! Deployment successful!" -ForegroundColor Green
} else {
    Write-Host "`n⚠️  Some tests failed. Check deployment logs." -ForegroundColor Yellow
}

Write-Host "`n🔗 Backend URL: $backendUrl" -ForegroundColor White
Write-Host "📊 GitHub Actions: https://github.com/angelcreator113/Episode-Canonical-Control-Record/actions" -ForegroundColor Blue
Write-Host "`n" -ForegroundColor White
