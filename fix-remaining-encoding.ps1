# Fix remaining encoding issues
$ErrorActionPreference = 'Stop'

$filePath = "frontend\src\components\EpisodeAssetsTab.jsx"
Write-Host "Reading file..." -ForegroundColor Cyan

# Read file as UTF-8
$content = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)

Write-Host "Applying fixes..." -ForegroundColor Cyan

# Fix 1: Dimensions display - look for the pattern
$content = $content -replace '(\{asset\.width\})[^\{]*(\{asset\.height\})', '$1×$2'

# Fix 2: Bullet point between dimensions and file size - more specific pattern
$content = $content -replace '<span>\{asset\.height\}</span>\s*<span>[^<]*</span>\s*<span>\{formatFileSize', '<span>{asset.height}</span>
                    <span>•</span>
                    <span>{formatFileSize'

# Fix 3 & 4: Console warnings
$pattern1 = [regex]::Escape("console.warn('") + "[^']{3,20}" + [regex]::Escape(" Video load failed:")
$content = $content -replace $pattern1, "console.warn('⚠️ Video load failed:"

$pattern2 = [regex]::Escape("console.warn('") + "[^']{3,20}" + [regex]::Escape(" Image load failed:")  
$content = $content -replace $pattern2, "console.warn('⚠️ Image load failed:"

Write-Host "Writing file..." -ForegroundColor Cyan

# Write back as UTF-8 without BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($filePath, $content, $utf8NoBom)

Write-Host "✅ Done!" -ForegroundColor Green
