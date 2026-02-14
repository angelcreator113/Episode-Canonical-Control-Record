import re

file_path = r"C:\Users\12483\Projects\Episode-Canonical-Control-Record-1\frontend\src\components\EpisodeAssetsTab.jsx"

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find and remove the entire handleRemoveBackground function
new_lines = []
skip_until = -1
i = 0

while i < len(lines):
    line = lines[i]
    
    # Start of handleRemoveBackground function
    if 'const handleRemoveBackground' in line:
        print(f"Found handleRemoveBackground at line {i+1}")
        # Find the closing brace
        brace_count = 0
        start_counting = False
        j = i
        while j < len(lines):
            if '{' in lines[j]:
                brace_count += lines[j].count('{')
                start_counting = True
            if '}' in lines[j]:
                brace_count -= lines[j].count('}')
            if start_counting and brace_count == 0:
                skip_until = j + 1
                print(f"  Function ends at line {j+1}")
                break
            j += 1
        
        # Add comment
        new_lines.append('  // REMOVED: Background removal feature (users can do this in composer)\n')
        new_lines.append('\n')
        i = skip_until
        continue
    
    new_lines.append(line)
    i += 1

# Write back
with open(file_path, 'w', encoding='utf-8-sig') as f:
    f.writelines(new_lines)

print(f"\n✅ Removed handleRemoveBackground from EpisodeAssetsTab.jsx")

# Also remove processingAssets state if not used elsewhere
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

if 'processingAssets' in content and 'handleRemoveBackground' not in content:
    # Remove the state declaration
    content = re.sub(
        r'\s*const \[processingAssets, setProcessingAssets\] = useState\(new Set\(\)\);?\n',
        '',
        content
    )
    with open(file_path, 'w', encoding='utf-8-sig') as f:
        f.write(content)
    print("✅ Removed unused processingAssets state")
