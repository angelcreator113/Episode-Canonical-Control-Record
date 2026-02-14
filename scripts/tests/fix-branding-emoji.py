import re

file_path = r"C:\Users\12483\Projects\Episode-Canonical-Control-Record-1\frontend\src\components\EpisodeAssetsTab.jsx"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Target the specific line with BRANDING
# Replace any multi-byte corruption before " BRANDING"
content = re.sub(
    r'<optgroup label="[^"]*BRANDING">',
    '<optgroup label="🎨 BRANDING">',
    content
)

with open(file_path, 'w', encoding='utf-8-sig') as f:
    f.write(content)

print("✅ Fixed BRANDING label emoji")

# Verify
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()
    for i, line in enumerate(lines, 1):
        if 'BRANDING' in line and 'optgroup' in line:
            print(f"Line {i}: {line.strip()}")
