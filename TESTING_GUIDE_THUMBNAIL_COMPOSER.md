# 🧪 Thumbnail Composer Testing Guide

## Quick Test URL
**Frontend**: http://localhost:5174/thumbnail-composer

---

## Test Scenario 1: Basic Flow
1. Navigate to http://localhost:5174/thumbnail-composer
2. **Expected**: See 3-step progress indicator (Episode → Assets & Formats → Generate)
3. **Step 1**: Select an episode from dropdown
4. Click "Next: Configure Assets →"
5. **Expected**: Move to Step 2 with all role slots visible

---

## Test Scenario 2: Asset Selection
1. In Step 2, scroll to "👥 Characters (Required)" section
2. **Expected**: See 4 character slots (Lala, JustAWoman, Guest 1, Guest 2)
3. **Expected**: Lala and JustAWoman have red "Required" badges
4. Click on a Lala slot
5. **If no assets exist**: See empty state with "📤 Upload Asset" button
6. **If assets exist**: See grid of assets with role badges below each thumbnail
7. Click an asset to select it
8. **Expected**: Asset gets blue border and background

---

## Test Scenario 3: Icon Holder Visibility
1. Scroll to "✨ Icons (Optional)" section
2. **Expected**: See 9 icon slots in compact grid
3. Scroll below icons
4. **Expected**: See "Icon Holder (Auto)" with yellow "Auto-Required if icons used" badge
5. **Expected**: Yellow dashed border and light yellow background

---

## Test Scenario 4: Text Field
1. Scroll to "📝 Text Fields (Optional)" section
2. **Expected**: See text input (not asset picker)
3. Type "My Awesome Show" in Show Title field
4. **Expected**: Text appears in input field

---

## Test Scenario 5: Validation
1. In Step 2, do NOT select Lala asset
2. Click "Review & Generate →"
3. **Expected**: Red validation error panel appears at top
4. **Expected**: Error message: "Lala (Host) is required"
5. Select Lala asset
6. **Expected**: Can now proceed to Step 3

---

## Test Scenario 6: Format Selection
1. In Step 2, scroll to "📐 Output Formats" section
2. **Expected**: See checkboxes for 8 formats
3. **Expected**: YOUTUBE is pre-checked
4. Check INSTAGRAM_FEED checkbox
5. Uncheck YOUTUBE checkbox
6. **Expected**: If no formats checked, validation error appears

---

## Test Scenario 7: Review & Generate
1. After selecting required assets and formats, click "Review & Generate →"
2. **Expected**: Move to Step 3
3. **Expected**: See "Selected Assets" list with human-readable labels (e.g., "Lala (Host)" not "CHAR.HOST.LALA")
4. **Expected**: See "Selected Formats" list
5. Click "🚀 Generate Thumbnails"
6. **Expected**: Button text changes to "⏳ Generating..."
7. **Expected**: Status message appears

---

## Test Scenario 8: Upload Button
1. In Step 2, find a role with no assets (e.g., Guest 2)
2. **Expected**: See empty state with folder icon and message
3. **Expected**: See "📤 Upload Asset" button
4. Click upload button
5. **Expected**: Modal appears with role information
6. Click "Go to Upload"
7. **Expected**: Redirects to episode assets tab (or shows upload interface)

---

## Test Scenario 9: Role Badges
1. In any asset picker with assets
2. Look at asset thumbnail cards
3. **Expected**: Below asset name, see gray badge with full role (e.g., "CHAR.HOST.LALA")
4. **Expected**: Role badge in uppercase with monospace-like font

---

## Test Scenario 10: Navigation
1. From Step 2, click "← Back"
2. **Expected**: Return to Step 1
3. **Expected**: Episode selection still filled in
4. From Step 3, click "← Back to Edit"
5. **Expected**: Return to Step 2
6. **Expected**: All selected assets still selected

---

## Common Issues to Check

### If AssetRolePicker shows category tabs:
❌ **Problem**: Old version still loaded
✅ **Solution**: Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)

### If seeing "Cannot find module" errors:
❌ **Problem**: Missing imports
✅ **Solution**: Check browser console for specific error

### If no assets loading:
❌ **Problem**: Backend not running or API endpoint issues
✅ **Solution**: Check backend is running on port 3002, check network tab

### If validation not working:
❌ **Problem**: Required roles not properly configured
✅ **Solution**: Check CANONICAL_ROLES has `required: true` for Lala and JustAWoman

---

## Success Criteria

✅ All 18 role slots visible without toggles  
✅ No category tabs in asset pickers  
✅ Only exact role matches shown in each picker  
✅ Upload button appears for empty roles  
✅ Role badges visible on all assets  
✅ Text field uses input element not picker  
✅ Icon holder positioned after icons with auto-badge  
✅ Human labels shown everywhere (not technical names)  
✅ Validation errors specific and helpful  
✅ 3 steps total (not 6)  

---

## Debugging Commands

### Check Frontend Status
```powershell
Get-Process | Where-Object { $_.ProcessName -eq "node" }
```

### Check Backend Status
```powershell
Test-NetConnection -ComputerName localhost -Port 3002
```

### View Browser Console
Press F12 → Console tab to see any JavaScript errors

### Check Network Requests
Press F12 → Network tab → Look for failed API calls

---

## Next Steps After Testing

If all tests pass:
1. Mark THUMBNAIL_COMPOSER_REFACTORING_COMPLETE.md as verified
2. Document any bugs found
3. Plan any additional enhancements
4. Update user documentation with new flow

If tests fail:
1. Note which scenario failed
2. Check browser console for errors
3. Check backend logs for API issues
4. Review code changes in failed component
