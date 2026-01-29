# 📌 Asset Folder System - Quick Reference

## 🎯 The Problem We Solved

**BEFORE:** 14 Lala images tagged as `CHAR.HOST.LALA` → Only visible in "Lala (Host)" slot

**AFTER:** 14 Lala images in `LALA` folder → Visible in ALL LALA-compatible slots

---

## 📂 5 Asset Folders

| Folder | Icon | Contains | Shows In Slots |
|--------|------|----------|----------------|
| **LALA** | 👩 | Host images, Lala promos | CHAR.HOST.*, BRAND.*, UI.ICON.* |
| **GUEST** | 👤 | Guest images, reactions | CHAR.GUEST.*, GUEST.* |
| **SHOW** | 💜 | Show branding, logos | BRAND.*, TEXT.*, BG.*, UI.ICON.* |
| **EPISODE** | 🖼️ | Backgrounds, episode frames | BG.*, TEXT.* |
| **WARDROBE** | 👗 | Clothing items | WARDROBE.* |

---

## 🔄 Quick Mapping

```
Slot Name                 → Folder(s) Shown
────────────────────────────────────────────
Lala (Host)               → LALA
Background                → EPISODE, SHOW  (tabs)
Guest 1                   → GUEST
Guest 2                   → GUEST
Brand Logo                → SHOW, LALA     (tabs)
Icon Slots                → SHOW, LALA     (tabs)
```

---

## 💡 Usage Examples

### Example 1: Upload Lala Images
```
1. Upload 14 Lala images in Asset Manager
2. System auto-tags: asset_group = 'LALA'
3. All 14 appear in:
   ✓ Lala (Host) slot
   ✓ Brand Logo slot (if LALA tab selected)
   ✓ Icon slots (if LALA tab selected)
```

### Example 2: Background Slot
```
1. Open "Background" slot in Thumbnail Composer
2. See TWO tabs:
   [🖼️ Episodes (12)]  [💜 Show (5)]
3. Click Episodes → See episode backgrounds
4. Click Show → See show branding backgrounds
5. Pick from either tab!
```

---

## 🎨 UI Features

### Folder Tabs (Multiple Folders)
```
┌─────────┬─────────┬─────────────┐
│ 👩 Lala │ 💜 Show │ 🖼️ Episodes │
│   (14)  │   (5)   │     (12)    │
└─────────┴─────────┴─────────────┘
```

### Single Folder
```
📁 Lala (14 assets)
[Grid of images]
```

### Selected Asset
```
┌────┐
│ ✓  │ ← Blue border + checkmark
│ 🖼️ │
└────┘
```

---

## 🔧 For Developers

### Frontend: AssetRolePicker.jsx

**Key Function:**
```javascript
getRoleFolderMapping(role) {
  if (role.startsWith('CHAR.HOST')) return ['LALA'];
  if (role.startsWith('CHAR.GUEST')) return ['GUEST'];
  if (role.startsWith('BG.')) return ['EPISODE', 'SHOW'];
  // ...
}
```

**State:**
```javascript
const [allAssets, setAllAssets] = useState([]);
const [activeFolder, setActiveFolder] = useState(null);
const assetsByFolder = /* group by asset_group */;
```

### Backend: assets.js

**New Endpoint:**
```javascript
GET /api/v1/assets/by-folder?folders=LALA,GUEST&showId=xxx
```

**Response:**
```json
{
  "status": "SUCCESS",
  "data": [/* assets with asset_group in ['LALA','GUEST'] */],
  "count": 22
}
```

---

## 📝 Upload Checklist

When uploading new assets:

- [ ] Choose correct **asset_type** (PROMO_LALA, PROMO_GUEST, etc.)
- [ ] System auto-assigns **asset_group** based on type
- [ ] Optional: Add specific **asset_role** tag for organization
- [ ] Add descriptive **name** (e.g., "Lala Red Dress Promo")
- [ ] Set **asset_scope** (GLOBAL, SHOW, or EPISODE)

---

## 🚨 Common Issues

### "I don't see my assets!"
1. Check asset approval status (must be APPROVED)
2. Check asset_group matches expected folder
3. Check scope (GLOBAL always visible, SHOW/EPISODE need context)
4. Try refreshing: Window focus auto-refreshes

### "Assets in wrong folder?"
- Edit asset in Asset Manager
- Update asset_group field
- Or upload with correct asset_type

### "Want multiple folders to share assets?"
- Not supported (each asset = one folder)
- Solution: Upload copies to different folders
- Or use GLOBAL scope for wide availability

---

## 🎯 Benefits

✅ **Upload once, use everywhere** (within folder category)
✅ **No role lock-in** (LALA assets usable in any LALA slot)
✅ **Visual organization** (folder tabs + icons)
✅ **Backward compatible** (existing compositions work)
✅ **Intuitive UX** (folders match mental model)

---

## 📊 Database Schema

```sql
CREATE TABLE assets (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  
  -- Organization fields
  asset_group VARCHAR(50),  -- LALA, GUEST, SHOW, EPISODE, WARDROBE
  asset_role VARCHAR(255),  -- CHAR.HOST.LALA, BG.MAIN, etc.
  asset_scope VARCHAR(50),  -- GLOBAL, SHOW, EPISODE
  
  -- File locations
  s3_url_raw TEXT,
  s3_url_processed TEXT,
  
  -- Metadata
  approval_status VARCHAR(50),
  media_type VARCHAR(100),
  width INTEGER,
  height INTEGER,
  
  -- Foreign keys
  show_id UUID,
  episode_id UUID,
  
  -- Timestamps
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP
);
```

---

## 🔗 Related Files

- **Frontend:**
  - `frontend/src/components/AssetRolePicker.jsx` - Main picker component
  - `frontend/src/pages/ThumbnailComposer.jsx` - Uses picker
  - `frontend/src/components/AssetRolePicker.css` - Styling

- **Backend:**
  - `src/routes/assets.js` - API endpoints
  - `src/services/AssetService.js` - Business logic
  - `src/models/Asset.js` - Database model
  - `deploy-package/backend/services/AssetRoleService.js` - Role utilities

- **Documentation:**
  - `ASSET_FOLDER_ORGANIZATION_GUIDE.md` - Full guide
  - `ASSET_FOLDER_VISUAL_GUIDE.md` - Visual diagrams
  - `ASSET_ORGANIZATION_IMPLEMENTATION.md` - Original implementation

---

## 🚀 Next Steps

1. **Test the system:**
   - Upload test assets with different asset_groups
   - Open Thumbnail Composer
   - Verify folders appear correctly

2. **Monitor usage:**
   - Check if users find folders intuitive
   - Gather feedback on folder names/icons
   - Consider adding search/filter within folders

3. **Future enhancements:**
   - Drag & drop between folders
   - Bulk folder reassignment
   - Favorites/recent assets
   - Smart suggestions

---

## 💬 Support

**Questions?** Check the full guides:
- [ASSET_FOLDER_ORGANIZATION_GUIDE.md](./ASSET_FOLDER_ORGANIZATION_GUIDE.md)
- [ASSET_FOLDER_VISUAL_GUIDE.md](./ASSET_FOLDER_VISUAL_GUIDE.md)

**Found a bug?** Check:
1. Browser console for errors
2. Network tab for API responses
3. Database asset_group values

---

## 🎉 Success!

Your asset organization system now supports:
- ✅ Flexible folder-based browsing
- ✅ Asset reusability across slots
- ✅ Intuitive visual organization
- ✅ Multi-folder tabs for versatile slots
- ✅ Backward compatibility

**Upload once, use everywhere!** 🚀
