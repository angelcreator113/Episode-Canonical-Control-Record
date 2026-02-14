# Fix corrupted emojis in EpisodeAssetsTab.jsx

$filePath = "C:\Users\12483\Projects\Episode-Canonical-Control-Record-1\frontend\src\components\EpisodeAssetsTab.jsx"

# Read file as UTF-8
$content = Get-Content $filePath -Raw -Encoding UTF8

# Fix all corrupted emojis
$replacements = @{
    'ðŸ"„' = '📄'
    'ðŸ'ï¸' = '👁️'
    'ðŸ·ï¸' = '🎨'
    'ðŸ'œ' = '💜'
    'ðŸ"—' = '🔗'
    'ðŸ"º' = '📺'
    'ðŸ–🎥ï¸' = '🖼️'
    'ðŸŒ„' = '🌄'
    'ðŸ'¾' = '💾'
    'Â¯' = '🎯'
    'Â­' = '👥'
}

foreach ($old in $replacements.Keys) {
    $new = $replacements[$old]
    $content = $content.Replace($old, $new)
    Write-Host "Replaced '$old' with '$new'"
}

# Write back as UTF-8 with BOM
$utf8 = New-Object System.Text.UTF8Encoding $true
[System.IO.File]::WriteAllText($filePath, $content, $utf8)

Write-Host "`n✅ Fixed all corrupted emojis in EpisodeAssetsTab.jsx"
Write-Host "File saved as UTF-8 with BOM"
