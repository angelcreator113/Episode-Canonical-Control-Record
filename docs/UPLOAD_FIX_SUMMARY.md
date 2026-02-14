# 🔧 Asset Upload Fix - Auto-Derive Asset Type from Role

## 🐛 Problem
Files were **always uploading as `PROMO_LALA`** regardless of what role you selected in the dropdown.

**Root Cause:**
- Upload modal had dropdown for `assetRole` ✅
- But `assetType` was hardcoded to `'PROMO_LALA'` ❌
- The `assetType` never changed when you selected a different role

## ✅ Solution
Added automatic `assetType` derivation from selected `assetRole`:

### New Mapping Function
```javascript
getAssetTypeFromRole(role) {
  if (role.startsWith('CHAR.HOST.LALA')) return 'PROMO_LALA';
  if (role.startsWith('CHAR.HOST.JUSTAWOMANINHERPRIME')) return 'PROMO_JUSTAWOMANINHERPRIME';
  if (role.startsWith('CHAR.GUEST')) return 'PROMO_GUEST';
  if (role.startsWith('UI.ICON')) return 'BRAND_LOGO';
  if (role.startsWith('BRAND.')) return 'BRAND_LOGO';
  if (role.startsWith('BG.')) return 'BACKGROUND_IMAGE';
  if (role.startsWith('UI.MOUSE')) return 'BACKGROUND_IMAGE';
  if (role.startsWith('UI.BUTTON')) return 'BACKGROUND_IMAGE';
  // ... etc
}
```

### Visual Feedback
Upload modal now shows a **blue info box** displaying:
- What `assetType` will be used
- Which folder the asset will appear in

Example:
```
📦 Will be saved as: PROMO_GUEST → 👤 GUEST folder
```

## 🎯 How It Works Now

### Before Fix
```
User selects: "Guest 1" (CHAR.GUEST.1)
Upload sends:  assetType = 'PROMO_LALA'  ❌ WRONG!
Result:        Asset goes to LALA folder
```

### After Fix
```
User selects: "Guest 1" (CHAR.GUEST.1)
System derives: assetType = 'PROMO_GUEST'  ✅ CORRECT!
Upload sends:   assetType = 'PROMO_GUEST'
Result:         Asset goes to GUEST folder
```

## 📋 Complete Role → Type → Folder Mapping

| Selected Role | Derived assetType | Resulting asset_group | Shows in Folder |
|---------------|-------------------|----------------------|-----------------|
| CHAR.HOST.LALA | PROMO_LALA | LALA | 👩 Lala |
| CHAR.HOST.JUSTAWOMANINHERPRIME | PROMO_JUSTAWOMANINHERPRIME | SHOW | 💜 Show |
| CHAR.GUEST.1 | PROMO_GUEST | GUEST | 👤 Guest |
| CHAR.GUEST.2 | PROMO_GUEST | GUEST | 👤 Guest |
| UI.ICON.* | BRAND_LOGO | SHOW | 💜 Show |
| BRAND.* | BRAND_LOGO | SHOW | 💜 Show |
| BG.MAIN | BACKGROUND_IMAGE | EPISODE | 🖼️ Episode |
| UI.MOUSE.* | BACKGROUND_IMAGE | EPISODE | 🖼️ Episode |
| UI.BUTTON.* | BACKGROUND_IMAGE | EPISODE | 🖼️ Episode |

## 🎨 UI Improvements

### 1. Visual Indicator
Blue info box shows derived type and folder:
```
┌──────────────────────────────────────────────┐
│ 📦 Will be saved as: PROMO_GUEST             │
│    → 👤 GUEST folder                          │
└──────────────────────────────────────────────┘
```

### 2. Console Logging
Upload now logs the derivation:
```javascript
console.log('📤 Uploading with:', { 
  role: 'CHAR.GUEST.1', 
  derivedType: 'PROMO_GUEST',
  fileName: 'guest-photo.jpg'
});
```

### 3. Real-Time Updates
Info box updates instantly when you change the role dropdown.

## 🧪 Testing Steps

1. **Open Episode Assets Tab**
   - Navigate to any episode
   - Click "Upload Assets" button

2. **Select Different Roles**
   - Try "Lala (Host)" → Should show `PROMO_LALA → 👩 LALA folder`
   - Try "Guest 1" → Should show `PROMO_GUEST → 👤 GUEST folder`
   - Try "Background Image" → Should show `BACKGROUND_IMAGE → 🖼️ EPISODE folder`
   - Try "Icon: Closet" → Should show `BRAND_LOGO → 💜 SHOW folder`

3. **Upload Files**
   - Select a test image
   - Upload with different roles
   - Verify they appear in correct folders in Thumbnail Composer

4. **Check Thumbnail Composer**
   - Go to Thumbnail Composer Step 4
   - Open "Guest 1" slot → Should see your guest uploads in GUEST folder
   - Open "Lala (Host)" slot → Should see your Lala uploads in LALA folder

## 🔍 Verification

### Backend Logs
```
✅ Asset created with:
   - asset_type: PROMO_GUEST
   - asset_role: CHAR.GUEST.1
   - asset_group: GUEST (auto-derived from asset_type)
```

### Database Check
```sql
SELECT id, name, asset_type, asset_role, asset_group 
FROM assets 
ORDER BY created_at DESC 
LIMIT 10;
```

Should show varied `asset_type` and `asset_group` values, not all PROMO_LALA!

## 📝 Files Modified

- **frontend/src/components/EpisodeAssetsTab.jsx**
  - Added `getAssetTypeFromRole()` helper function
  - Updated `handleUpload()` to use derived type
  - Added visual indicator UI in upload modal
  - Added console logging for debugging

## 🎉 Result

✅ Files now upload with **correct asset type** based on selected role
✅ Assets appear in **correct folders** in Thumbnail Composer
✅ Users get **visual feedback** about where assets will go
✅ No more "everything is PROMO_LALA" problem!

---

**Status:** Fixed ✅
**Tested:** Pending user verification
