#!/usr/bin/env pwsh
# Diagnose live site asset serving issues

Write-Host "`n🔍 Diagnosing https://dev.primepisodes.com..." -ForegroundColor Cyan

# 1. Check what JS files are referenced in index.html
Write-Host "`n1️⃣ Checking index.html references..." -ForegroundColor Yellow
try {
    $indexResponse = Invoke-WebRequest -Uri "https://dev.primepisodes.com/" -UseBasicParsing -TimeoutSec 10
    Write-Host "✅ Index.html status: $($indexResponse.StatusCode)" -ForegroundColor Green
    
    $jsFiles = [regex]::Matches($indexResponse.Content, 'src="(/assets/[^"]*\.js)"') | ForEach-Object { $_.Groups[1].Value }
    
    if ($jsFiles) {
        Write-Host "📄 JS files referenced in index.html:" -ForegroundColor Cyan
        foreach ($file in $jsFiles) {
            Write-Host "  - $file" -ForegroundColor White
        }
    } else {
        Write-Host "⚠️  No JS file references found in index.html!" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Failed to fetch index.html: $_" -ForegroundColor Red
}

# 2. Test one of the JS files
Write-Host "`n2️⃣ Testing JS file request..." -ForegroundColor Yellow
if ($jsFiles -and $jsFiles.Count -gt 0) {
    $testFile = $jsFiles[0]
    $testUrl = "https://dev.primepisodes.com$testFile"
    
    Write-Host "Testing: $testUrl" -ForegroundColor Cyan
    
    try {
        $jsResponse = Invoke-WebRequest -Uri $testUrl -UseBasicParsing -TimeoutSec 10
        
        Write-Host "Status Code: $($jsResponse.StatusCode)" -ForegroundColor $(if ($jsResponse.StatusCode -eq 200) { "Green" } else { "Red" })
        Write-Host "Content-Type: $($jsResponse.Headers.'Content-Type')" -ForegroundColor $(if ($jsResponse.Headers.'Content-Type' -like '*javascript*') { "Green" } else { "Red" })
        Write-Host "Content-Length: $($jsResponse.Content.Length) bytes" -ForegroundColor White
        
        # Check if response is HTML instead of JS
        $firstChars = $jsResponse.Content.Substring(0, [Math]::Min(100, $jsResponse.Content.Length))
        
        if ($firstChars -match '<!DOCTYPE html|<html') {
            Write-Host "`n❌ PROBLEM DETECTED: JS file is returning HTML!" -ForegroundColor Red
            Write-Host "First 200 chars of response:" -ForegroundColor Yellow
            Write-Host $jsResponse.Content.Substring(0, [Math]::Min(200, $jsResponse.Content.Length)) -ForegroundColor White
        } elseif ($firstChars -match 'import|export|function|const|var|let') {
            Write-Host "`n✅ Response looks like valid JavaScript!" -ForegroundColor Green
            Write-Host "First 100 chars:" -ForegroundColor White
            Write-Host $firstChars -ForegroundColor Gray
        } else {
            Write-Host "`n⚠️  Response doesn't look like typical JavaScript" -ForegroundColor Yellow
            Write-Host "First 100 chars:" -ForegroundColor White
            Write-Host $firstChars -ForegroundColor Gray
        }
        
    } catch {
        Write-Host "❌ Failed to fetch JS file: $_" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️  No JS files to test" -ForegroundColor Yellow
}

# 3. Check /assets/ route specifically
Write-Host "`n3️⃣ Testing /assets/ path handling..." -ForegroundColor Yellow
try {
    $assetsResponse = Invoke-WebRequest -Uri "https://dev.primepisodes.com/assets/" -UseBasicParsing -TimeoutSec 10 -ErrorAction SilentlyContinue
    Write-Host "Status: $($assetsResponse.StatusCode)" -ForegroundColor Yellow
    Write-Host "Content-Type: $($assetsResponse.Headers.'Content-Type')" -ForegroundColor Yellow
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "Status: $statusCode" -ForegroundColor $(if ($statusCode -eq 404) { "Green" } else { "Yellow" })
    Write-Host "Note: 404 for /assets/ directory is expected and correct" -ForegroundColor Gray
}

# 4. Summary
Write-Host "`n📋 Summary:" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "If JS files are returning HTML, possible causes:" -ForegroundColor White
Write-Host "  1. Browser cache - Try Ctrl+Shift+R" -ForegroundColor Gray
Write-Host "  2. CDN/Proxy cache - May need time to clear" -ForegroundColor Gray
Write-Host "  3. Server code not updated - Check deployment logs" -ForegroundColor Gray
Write-Host "  4. PM2 not restarted properly" -ForegroundColor Gray
Write-Host "`nNext steps:" -ForegroundColor White
Write-Host "  • Hard refresh browser (Ctrl+Shift+R)" -ForegroundColor Gray
Write-Host "  • Check GitHub Actions deployment logs" -ForegroundColor Gray
Write-Host "  • Verify server has latest code" -ForegroundColor Gray

Write-Host "`n✅ Diagnostic complete!`n" -ForegroundColor Green
