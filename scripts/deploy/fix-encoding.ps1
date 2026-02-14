# Fix UTF-8 encoding issues in EpisodeAssetsTab.jsx

$filePath = "frontend\src\components\EpisodeAssetsTab.jsx"

# Read file content
$content = Get-Content $filePath -Raw -Encoding UTF8

# Fix all corrupted emoji and special characters
$replacements = @{
    # Close button X
    'className="btn-close">Ã¯Â¿Â½</button>' = 'className="btn-close">✕</button>'
    
    # Upload icon in mobile sheet
    '<span className="option-icon">??</span>' = '<span className="option-icon">📤</span>'
    
    # Link icon in mobile sheet
    '<span className="option-icon">Ã°Å¸â€â€"</span>' = '<span className="option-icon">🔗</span>'
    
    # LALA folder icon
    '<option value="LALA">Ã°Å¸â€™Å"' = '<option value="LALA">👩'
    
    # SHOW folder icon
    '<option value="SHOW">Ã°Å¸â€œÂº' = '<option value="SHOW">📺'
    
    # EPISODE folder icon - multiple instances
    'EPISODE">Ã¯Â¿Â½ EPISODE' = 'EPISODE">📁 EPISODE'
    'EPISODE folder (UI)' = 'EPISODE folder (UI)'
    
    # Delete confirmation dialog
    'Ã¯Â¿Â½Ã¯Â¿Â½Ã¯Â¸Â PERMANENTLY DELETE' = '⚠️ PERMANENTLY DELETE'
    
    # Thumbnail icon
    "thumbnail: { icon: '???Ã¯Â¿Â½'" = "thumbnail: { icon: '🎞️📷'"
    
    # Scene background icon
    "scene_background: { icon: 'Ã¯Â¿Â½'" = "scene_background: { icon: '🖼️'"
    
    # Video/Image icons
    "asset.media_type === 'video' ? '??' : '???Ã¯Â¿Â½'" = "asset.media_type === 'video' ? '🎬' : '🖼️📷'"
    
    # Warning icons in console logs
    "console.warn('Ã¯Â¿Â½Ã¯Â¿Â½Ã¯Â¸Â" = "console.warn('⚠️"
    
    # Upload/Uploading text  
    '{ uploading ? '' : '' }' = '{ uploading ? '⏫ Uploading...' : '📤 Upload' }'
    ' Uploading...' = '⏫ Uploading...'
    ' Upload' = '📤 Upload'
    
    # Backgrounds & Chrome optgroup
    '<optgroup label="???Ã¯Â¿Â½ BACKGROUNDS' = '<optgroup label="🖼️ BACKGROUNDS'
    
    # UI Button folder
    'Ã°Å¸â€Ëœ EPISODE folder \(UI\)' = '📁 EPISODE folder (UI)'
}

foreach ($old in $replacements.Keys) {
    $new = $replacements[$old]
    $content = $content -replace [regex]::Escape($old), $new
}

# Save file with UTF-8 encoding
$content | Set-Content $filePath -Encoding UTF8 -NoNewline

Write-Host "✅ Fixed encoding issues in $filePath" -ForegroundColor Green
