import codecs

file_path = r'c:\Users\12483\Projects\Episode-Canonical-Control-Record-1\frontend\src\components\EpisodeAssetsTab.jsx'

# Read as UTF-8
with codecs.open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Define replacements
replacements = [
    ('Ã°Å¸â€™Å" Will be saved as:', '💾 Will be saved as:'),
    (' Ã¢â‚¬Â¢ ', ' • '),
    ('Ã°Å¸â€™Å" LALA folder', '👩 LALA folder'),
    ('Ã°Å¸â€™Å" SHOW folder', '📺 SHOW folder'),
    ('Ã°Å¸â€™Å" GUEST folder', '👤 GUEST folder'),
    ('Ã°Å¸â€™Å" Show Title Ã¢â€ â€™ SHOW folder', '📺 Show Title → SHOW folder'),
    ('Ã°Å¸Å'â€ž EPISODE folder', '📁 EPISODE folder'),
    ('Ã°Å🖱️ EPISODE folder', '🖱️ EPISODE folder'),
    ('📁 EPISODE folder', '📁 EPISODE folder'),
]

# Apply replacements
for old, new in replacements:
    content = content.replace(old, new)

# Write back as UTF-8 with BOM to ensure Windows compatibility
with codecs.open(file_path, 'w', encoding='utf-8-sig') as f:
    f.write(content)

print('✅ Fixed all folder icon encodings!')
