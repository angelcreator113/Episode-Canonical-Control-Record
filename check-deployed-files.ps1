#!/usr/bin/env pwsh
# Quick check - what files does index.html reference vs what actually exists

Write-Host "`n🔍 Checking what dev.primepisodes.com is serving...`n" -ForegroundColor Cyan

try {
    # Get index.html
    $response = Invoke-WebRequest -Uri "https://dev.primepisodes.com/" -UseBasicParsing -TimeoutSec 10
    
    # Extract JS file references
    $jsPattern = 'src="(/assets/[^"]+\.js)"'
    $cssPattern = 'href="(/assets/[^"]+\.css)"'
    
    $jsFiles = [regex]::Matches($response.Content, $jsPattern) | ForEach-Object { $_.Groups[1].Value }
    $cssFiles = [regex]::Matches($response.Content, $cssPattern) | ForEach-Object { $_.Groups[1].Value }
    
    Write-Host "📄 JS files referenced:" -ForegroundColor Yellow
    $jsFiles | ForEach-Object { Write-Host "  $_" }
    
    Write-Host "`n📄 CSS files referenced:" -ForegroundColor Yellow
    $cssFiles | ForEach-Object { Write-Host "  $_" }
    
    # Test each file
    Write-Host "`n🧪 Testing if files exist...`n" -ForegroundColor Yellow
    
    $allFiles = $jsFiles + $cssFiles
    $missing = @()
    
    foreach ($file in $allFiles) {
        $url = "https://dev.primepisodes.com$file"
        try {
            $testResponse = Invoke-WebRequest -Uri $url -Method Head -UseBasicParsing -TimeoutSec 5
            $status = $testResponse.StatusCode
            $color = if ($status -eq 200) { "Green" } else { "Yellow" }
            Write-Host "  ✓ $file - $status" -ForegroundColor $color
        } catch {
            $statusCode = $_.Exception.Response.StatusCode.value__
            Write-Host "  ✗ $file - $statusCode (NOT FOUND)" -ForegroundColor Red
            $missing += $file
        }
    }
    
    if ($missing.Count -gt 0) {
        Write-Host "`n❌ PROBLEM: $($missing.Count) file(s) are referenced but don't exist!" -ForegroundColor Red
        Write-Host "`nThis means the server's index.html is outdated or the build is incomplete.`n" -ForegroundColor Yellow
    } else {
        Write-Host "`n✅ All referenced files exist!" -ForegroundColor Green
    }
    
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
}
