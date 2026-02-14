import codecs
import re

file_path = r"C:\Users\12483\Projects\Episode-Canonical-Control-Record-1\frontend\src\components\EpisodeAssetsTab.jsx"

# Read file
with codecs.open(file_path, 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# Fix corrupted emojis - map wrong bytes to correct emojis
replacements = {
    '\u00f0\u0178\u0094\u0084': '\U0001F4C4',  # 📄
    '\u00f0\u0178\u2018\u0083\u00ef\u00b8': '\U0001F441\uFE0F',  # 👁️
    '\u00f0\u0178\u00b7\u00ef\u00b8': '\U0001F3A8',  # 🎨
    '\u00f0\u0178\u2018\u0153': '\U0001F49C',  # 💜
    '\u00f0\u0178\u0094\u0097': '\U0001F517',  # 🔗
    '\u00f0\u0178\u0093\u00ba': '\U0001F4FA',  # 📺
    '\u00f0\u0178\u2013\u00bc\u00ef\u00b8': '\U0001F5BC\uFE0F',  # 🖼️
    '\u00f0\u0178\u0152\u201e': '\U0001F304',  # 🌄
    '\u00f0\u0178\u2018\u00be': '\U0001F4BE',  # 💾
    '\u00af': '\U0001F3AF',  # 🎯
    '\u00ad': '\U0001F465',  # 👥
}

original = content
for wrong, correct in replacements.items():
    content = content.replace(wrong, correct)
    
changes = sum(1 for a, b in zip(original, content) if a != b) // 2

# Write back as UTF-8 with BOM
with codecs.open(file_path, 'w', encoding='utf-8-sig') as f:
    f.write(content)

print(f"✅ Fixed {len(replacements)} emoji patterns in EpisodeAssetsTab.jsx")
print(f"   Changed {changes} characters")
print("   File saved as UTF-8 with BOM")
