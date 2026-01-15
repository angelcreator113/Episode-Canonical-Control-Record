# Comprehensive API Endpoint Testing Script
# Tests all Phase 2 API endpoints

$baseUrl = "http://localhost:3001"
$testResults = @()

function Test-Endpoint {
    param(
        [string]$name,
        [string]$method,
        [string]$url,
        [hashtable]$headers = @{},
        [string]$body = $null,
        [int[]]$expectedStatus = @(200)
    )
    
    try {
        $params = @{
            Uri = $url
            Method = $method
            Headers = $headers
            ErrorAction = 'Stop'
        }
        
        if ($body) {
            $params['Body'] = $body
            $params['ContentType'] = 'application/json'
        }
        
        $response = Invoke-WebRequest @params
        $status = $response.StatusCode
        
        $passed = $expectedStatus -contains $status
        
        $result = @{
            Name = $name
            URL = $url
            Method = $method
            Status = $status
            Passed = $passed
            Message = "Status: $status"
        }
        
        return $result
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.Value__
        $passed = $expectedStatus -contains $statusCode
        
        $result = @{
            Name = $name
            URL = $url
            Method = $method
            Status = $statusCode
            Passed = $passed
            Message = "Status: $statusCode - $($_.Exception.Message)"
        }
        
        return $result
    }
}

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     COMPREHENSIVE API ENDPOINT TEST SUITE (Phase 2)        ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ==================== HEALTH CHECK ====================
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "1️⃣  HEALTH CHECK ENDPOINTS" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green

$testResults += Test-Endpoint "Ping" "GET" "$baseUrl/ping"
$testResults += Test-Endpoint "Health" "GET" "$baseUrl/health"

# ==================== EPISODES ====================
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "2️⃣  EPISODE ENDPOINTS" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green

$testResults += Test-Endpoint "List Episodes" "GET" "$baseUrl/api/v1/episodes"
$testResults += Test-Endpoint "List Episodes (Paginated)" "GET" "$baseUrl/api/v1/episodes?page=1&limit=10"
$testResults += Test-Endpoint "Episodes by Status: Complete" "GET" "$baseUrl/api/v1/episodes?status=complete"
$testResults += Test-Endpoint "Episodes by Status: Processing" "GET" "$baseUrl/api/v1/episodes?status=processing"
$testResults += Test-Endpoint "Episodes by Status: Pending" "GET" "$baseUrl/api/v1/episodes?status=pending"
$testResults += Test-Endpoint "Get Single Episode" "GET" "$baseUrl/api/v1/episodes/1"

# ==================== THUMBNAILS ====================
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "3️⃣  THUMBNAIL ENDPOINTS" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green

$testResults += Test-Endpoint "List Thumbnails" "GET" "$baseUrl/api/v1/thumbnails"
$testResults += Test-Endpoint "List Thumbnails (Paginated)" "GET" "$baseUrl/api/v1/thumbnails?page=1&limit=20"
$testResults += Test-Endpoint "Get Single Thumbnail" "GET" "$baseUrl/api/v1/thumbnails/1"

# ==================== METADATA ====================
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "4️⃣  METADATA ENDPOINTS" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green

$testResults += Test-Endpoint "List Metadata" "GET" "$baseUrl/api/v1/metadata"
$testResults += Test-Endpoint "Get Metadata for Episode 1" "GET" "$baseUrl/api/v1/metadata/episodes/1"

# ==================== FILES (REQUIRES AUTH) ====================
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "5️⃣  FILE ENDPOINTS" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green

$testResults += Test-Endpoint "List Files (No Auth)" "GET" "$baseUrl/api/v1/files" @{} $null @(401, 404)

# ==================== SEARCH (REQUIRES AUTH) ====================
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "6️⃣  SEARCH ENDPOINTS" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green

$testResults += Test-Endpoint "Search (No Auth)" "GET" "$baseUrl/api/v1/search?q=test" @{} $null @(401)

# ==================== JOBS (REQUIRES AUTH) ====================
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "7️⃣  JOB QUEUE ENDPOINTS" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green

$testResults += Test-Endpoint "List Jobs (No Auth)" "GET" "$baseUrl/api/v1/jobs" @{} $null @(401, 404)
$testResults += Test-Endpoint "Job Queue Status" "GET" "$baseUrl/api/v1/jobs/queue/status" @{} $null @(401, 404)

# ==================== RESULTS ====================
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                     TEST RESULTS                           ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$passed = ($testResults | Where-Object { $_.Passed }).Count
$failed = ($testResults | Where-Object { -not $_.Passed }).Count
$total = $testResults.Count

# Display results
foreach ($result in $testResults) {
    $statusColor = if ($result.Passed) { "Green" } else { "Red" }
    $statusIcon = if ($result.Passed) { "✅" } else { "❌" }
    
    Write-Host "$statusIcon $($result.Name)" -ForegroundColor $statusColor
    Write-Host "   URL: $($result.URL)" -ForegroundColor Gray
    Write-Host "   $($result.Message)" -ForegroundColor Gray
    Write-Host ""
}

# Summary
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "📊 SUMMARY" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ Passed: $passed" -ForegroundColor Green
Write-Host "❌ Failed: $failed" -ForegroundColor Red
Write-Host "📝 Total:  $total" -ForegroundColor Yellow
Write-Host "📈 Success Rate: $(($passed / $total * 100).ToString('F2'))%" -ForegroundColor Cyan
Write-Host ""

Write-Host "NOTES:" -ForegroundColor Yellow
Write-Host "  • Endpoints marked 401 require Cognito authentication"
Write-Host "  • Endpoints marked 404 may not be implemented yet"
Write-Host "  • Status 200 indicates successful response"
Write-Host "  • Check server logs for detailed errors"
Write-Host ""
