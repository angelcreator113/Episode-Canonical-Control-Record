# Read the file as raw bytes
$filePath = "c:\Users\12483\Projects\Episode-Canonical-Control-Record-1\frontend\src\components\EpisodeAssetsTab.jsx"
$content = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)

# Define replacements as byte-accurate strings
$replacements = @{
    "Ã°Å¸â€™Å" Will be saved as:" = "💾 Will be saved as:"
    " Ã¢â‚¬Â¢ " = " • "
    "Ã°Å¸â€™Å" LALA folder" = "👩 LALA folder"
    "Ã°Å¸â€™Å" SHOW folder" = "📺 SHOW folder"
    "Ã°Å¸â€™Å" GUEST folder" = "👤 GUEST folder"
    "Ã°Å¸â€™Å" Show Title Ã¢â€ â€™ SHOW folder" = "📺 Show Title → SHOW folder"
    "Ã°Å¸Å'â€ž EPISODE folder" = "📁 EPISODE folder"
    "Ã°Å¸â€"Â±Ã¯Â¸Â EPISODE folder" = "🖱️ EPISODE folder"
    "Ã°Å¸â€Ëœ EPISODE folder" = "📁 EPISODE folder"
}

# Apply replacements
foreach ($key in $replacements.Keys) {
    $content = $content.Replace($key, $replacements[$key])
}

# Write back as UTF-8
[System.IO.File]::WriteAllText($filePath, $content, [System.Text.Encoding]::UTF8)

Write-Host "Fixed all folder icon encodings successfully!" -ForegroundColor Green
