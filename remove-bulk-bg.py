import re

file_path = r"C:\Users\12483\Projects\Episode-Canonical-Control-Record-1\frontend\src\pages\AssetManager.jsx"

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find and remove handleBulkProcessBackground function
new_lines = []
skip_until = -1
i = 0

while i < len(lines):
    line = lines[i]
    
    # Start of handleBulkProcessBackground function
    if 'const handleBulkProcessBackground' in line:
        print(f"Found handleBulkProcessBackground at line {i+1}")
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
        new_lines.append('  // REMOVED: Bulk background removal feature\n')
        new_lines.append('\n')
        i = skip_until
        continue
    
    # Remove the button that calls it
    if 'handleBulkProcessBackground' in line and '<button' in line:
        print(f"Found button at line {i+1}")
        # Find closing </button>
        j = i
        while j < len(lines) and '</button>' not in lines[j]:
            j += 1
        if j < len(lines):
            skip_until = j + 2  # Skip button and empty line
            print(f"  Button ends at line {j+1}")
            i = skip_until
            continue
    
    new_lines.append(line)
    i += 1

# Write back
with open(file_path, 'w', encoding='utf-8-sig') as f:
    f.writelines(new_lines)

print(f"\n✅ Removed handleBulkProcessBackground from AssetManager.jsx")
