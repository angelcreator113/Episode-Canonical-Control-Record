# Comprehensive Phase 2 API Testing Script
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "EPISODE METADATA API - PHASE 2 TEST SUITE" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "`nAPI Base: http://localhost:3001`n" -ForegroundColor Gray

$baseUrl = "http://localhost:3001"
$testResults = @()

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method = "GET",
        [string]$Endpoint,
        [hashtable]$Body = $null,
        [hashtable]$Headers = @{}
    )
    
    Write-Host "Testing: $Name" -ForegroundColor Yellow
    Write-Host "  $Method $Endpoint" -ForegroundColor Gray
    
    try {
        $params = @{
            Uri = "$baseUrl$Endpoint"
            Method = $Method
            UseBasicParsing = $true
            TimeoutSec = 5
            Headers = @{ 'Content-Type' = 'application/json' } + $Headers
        }
        
        if ($Body) {
            $params.Body = $Body | ConvertTo-Json
        }
        
        $response = Invoke-WebRequest @params
        Write-Host "  ✅ Status: $($response.StatusCode)" -ForegroundColor Green
        
        if ($response.Content) {
            $data = $response.Content | ConvertFrom-Json
            Write-Host "  Response: $($data | ConvertTo-Json -Depth 2 | Select-Object -First 5)" -ForegroundColor Green
        }
        
        $testResults += @{ Name = $Name; Status = "PASS"; Code = $response.StatusCode }
        Write-Host ""
        return $true
    } catch {
        $errorMsg = $_.Exception.Message
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
            Write-Host "  ❌ Status: $statusCode - $errorMsg" -ForegroundColor Red
            $testResults += @{ Name = $Name; Status = "FAIL"; Code = $statusCode }
        } else {
            Write-Host "  ❌ Error: $errorMsg" -ForegroundColor Red
            $testResults += @{ Name = $Name; Status = "FAIL"; Code = "N/A" }
        }
        Write-Host ""
        return $false
    }
}

# ============================================================================
# 1. HEALTH CHECK ENDPOINTS
# ============================================================================
Write-Host "`n[1] HEALTH CHECK ENDPOINTS" -ForegroundColor Magenta
Write-Host "-" * 70 -ForegroundColor Magenta

Test-Endpoint -Name "Ping" -Endpoint "/ping"
Test-Endpoint -Name "Health Check" -Endpoint "/health"

# ============================================================================
# 2. EPISODE ENDPOINTS
# ============================================================================
Write-Host "`n[2] EPISODE ENDPOINTS" -ForegroundColor Magenta
Write-Host "-" * 70 -ForegroundColor Magenta

Test-Endpoint -Name "List Episodes" -Endpoint "/api/v1/episodes"
Test-Endpoint -Name "Get Episodes (Paginated)" -Endpoint "/api/v1/episodes?page=1&limit=10"
Test-Endpoint -Name "Get Episodes (With Status Filter)" -Endpoint "/api/v1/episodes?status=draft"

# ============================================================================
# 3. THUMBNAIL ENDPOINTS
# ============================================================================
Write-Host "`n[3] THUMBNAIL ENDPOINTS" -ForegroundColor Magenta
Write-Host "-" * 70 -ForegroundColor Magenta

Test-Endpoint -Name "List Thumbnails" -Endpoint "/api/v1/thumbnails"

# ============================================================================
# 4. METADATA ENDPOINTS
# ============================================================================
Write-Host "`n[4] METADATA ENDPOINTS" -ForegroundColor Magenta
Write-Host "-" * 70 -ForegroundColor Magenta

Test-Endpoint -Name "List Metadata" -Endpoint "/api/v1/metadata"

# ============================================================================
# 5. FILE ENDPOINTS (Phase 2)
# ============================================================================
Write-Host "`n[5] FILE ENDPOINTS (Phase 2)" -ForegroundColor Magenta
Write-Host "-" * 70 -ForegroundColor Magenta

Test-Endpoint -Name "List Files" -Endpoint "/api/v1/files"

# ============================================================================
# 6. SEARCH ENDPOINTS (Phase 2)
# ============================================================================
Write-Host "`n[6] SEARCH ENDPOINTS (Phase 2)" -ForegroundColor Magenta
Write-Host "-" * 70 -ForegroundColor Magenta

Test-Endpoint -Name "Search Episodes" -Endpoint "/api/v1/search?q=test"

# ============================================================================
# 7. JOB QUEUE ENDPOINTS (Phase 2)
# ============================================================================
Write-Host "`n[7] JOB QUEUE ENDPOINTS (Phase 2)" -ForegroundColor Magenta
Write-Host "-" * 70 -ForegroundColor Magenta

Test-Endpoint -Name "List Jobs" -Endpoint "/api/v1/jobs"
Test-Endpoint -Name "Get Job Queue Status" -Endpoint "/api/v1/jobs/queue/status"

# ============================================================================
# TEST SUMMARY
# ============================================================================
Write-Host "`n" -ForegroundColor Gray
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "TEST SUMMARY" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan

$passCount = ($testResults | Where-Object { $_.Status -eq "PASS" }).Count
$failCount = ($testResults | Where-Object { $_.Status -eq "FAIL" }).Count
$totalCount = $testResults.Count

Write-Host "`nTotal Tests: $totalCount" -ForegroundColor Gray
Write-Host "Passed: $passCount" -ForegroundColor Green
Write-Host "Failed: $failCount" -ForegroundColor Red

Write-Host "`nDetailed Results:" -ForegroundColor Gray
Write-Host "-" * 70 -ForegroundColor Gray

$testResults | ForEach-Object {
    $statusColor = if ($_.Status -eq "PASS") { "Green" } else { "Red" }
    Write-Host "$($_.Name.PadRight(30)) [$($_.Status.PadRight(4))] Status: $($_.Code)" -ForegroundColor $statusColor
}

Write-Host "`n" + ("=" * 70) -ForegroundColor Cyan

if ($failCount -eq 0) {
    Write-Host "✅ ALL TESTS PASSED!" -ForegroundColor Green
} else {
    Write-Host "⚠️  SOME TESTS FAILED" -ForegroundColor Yellow
}

Write-Host "=" * 70 -ForegroundColor Cyan
