import re

files_to_clean = [
    r"C:\Users\12483\Projects\Episode-Canonical-Control-Record-1\frontend\src\components\EpisodeAssetsTab.jsx",
    r"C:\Users\12483\Projects\Episode-Canonical-Control-Record-1\frontend\src\pages\AssetManager.jsx",
]

for file_path in files_to_clean:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove handleRemoveBackground function (entire function block)
    content = re.sub(
        r'\s*const handleRemoveBackground = async \(assetId\) => \{[^}]*?\n\s*\};\n',
        '\n  // REMOVED: Background removal feature (users can do this in composer)\n\n',
        content,
        flags=re.DOTALL
    )
    
    # Remove handleBulkProcessBackground function
    content = re.sub(
        r'\s*const handleBulkProcessBackground = async \(\) => \{[^}]*?setBulkProcessing\(false\);\s*\}\s*\};\n',
        '\n  // REMOVED: Bulk background removal feature\n\n',
        content,
        flags=re.DOTALL
    )
    
    # Remove the "Remove BG" button
    content = re.sub(
        r'\s*<button onClick=\{handleBulkProcessBackground\}[^>]*>\s*.*?Remove BG\s*</button>\s*\n',
        '',
        content,
        flags=re.DOTALL
    )
    
    with open(file_path, 'w', encoding='utf-8-sig') as f:
        f.write(content)
    
    print(f"✅ Cleaned {file_path}")

print("\n✅ Background removal features removed from asset management UIs")
