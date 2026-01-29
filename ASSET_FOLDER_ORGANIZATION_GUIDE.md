# Asset Folder Organization System - Implementation Guide

## 🎯 Problem Solved

**BEFORE:** Assets were locked to specific roles using exact `asset_role` matching:
- Upload 14 Lala images → ALL tagged as `CHAR.HOST.LALA`
- Result: All 14 only appear in the "Lala (Host)" slot
- Can't reuse the same Lala image in Guest slots or other character positions

**AFTER:** Assets organized by `asset_group` folders that can be shared across slots:
- Upload 14 Lala images → All go into the "LALA" folder
- "Lala (Host)" slot shows LALA folder → All 14 images available
- "Guest 1" slot shows GUEST folder → Your guest images
- "Background" slot shows EPISODE/SHOW folders → Your backgrounds

## 📂 Folder Structure

Assets are now organized into **5 main folders** based on `asset_group`:

| Folder | asset_group | Icon | Color | Appears In Slots |
|--------|-------------|------|-------|------------------|
| **Lala** | `LALA` | 👩 | Purple | CHAR.HOST.*, BRAND.*, UI.ICON.* |
| **Guests** | `GUEST` | 👤 | Blue | CHAR.GUEST.*, GUEST.* |
| **Show Branding** | `SHOW` | 💜 | Pink | BRAND.*, TEXT.*, BG.*, UI.ICON.* |
| **Backgrounds** | `EPISODE` | 🖼️ | Green | BG.*, TEXT.* |
| **Wardrobe** | `WARDROBE` | 👗 | Orange | WARDROBE.* |

## 🎨 How It Works in Thumbnail Composer

### Multi-Folder Tabs
When a slot can use assets from multiple folders, you'll see **tabs** at the top:

```
┌─────────┬─────────┬─────────────┐
│ 👩 Lala │ 💜 Show │ 🖼️ Backgrounds │
│   (14)  │   (3)   │     (8)      │
└─────────┴─────────┴─────────────┘
```

### Single Folder
When only one folder is relevant, it shows directly:

```
📁 Lala (14 assets)
┌────┬────┬────┬────┐
│ 🖼️ │ 🖼️ │ 🖼️ │ 🖼️ │
└────┴────┴────┴────┘
```

## 🔄 Role → Folder Mapping

The system intelligently maps composition slots to relevant folders:

```javascript
Role Pattern                → Folders Shown
─────────────────────────────────────────────
CHAR.HOST.*                 → LALA
CHAR.GUEST.*, GUEST.*       → GUEST
BG.*                        → EPISODE, SHOW
BRAND.*                     → SHOW, LALA
TEXT.*                      → EPISODE, SHOW
UI.ICON.*                   → SHOW, LALA
WARDROBE.*                  → WARDROBE
```

## 📝 Examples

### Example 1: Lala (Host) Slot
```
Slot: "Lala (Host)" (role: CHAR.HOST.LALA)
Folders: LALA
Shows: All assets with asset_group = 'LALA'
```

**What you see:**
- All 14 of your Lala promotional images
- All Lala headshots
- All Lala full-body images
- Any other LALA-tagged assets

### Example 2: Background Slot
```
Slot: "Background" (role: BG.MAIN)
Folders: EPISODE, SHOW
Shows: All assets with asset_group = 'EPISODE' OR 'SHOW'
```

**What you see (with tabs):**
```
[🖼️ Backgrounds (8)]  [💜 Show Branding (3)]
```
- Tab 1: Episode-specific background frames
- Tab 2: Show branding backgrounds

### Example 3: Guest 1 Slot
```
Slot: "Guest 1" (role: CHAR.GUEST.1)
Folders: GUEST
Shows: All assets with asset_group = 'GUEST'
```

**What you see:**
- All guest promotional images
- All guest headshots
- All guest images regardless of which guest number they were originally tagged for

## 🎯 Key Benefits

### 1. **Asset Reusability**
Upload once, use everywhere within the same category:
- Upload a Lala image → Use it in any character slot that accepts LALA assets
- Upload a guest image → Use it for Guest 1, Guest 2, or any guest slot

### 2. **Flexible Organization**
Assets organize themselves intelligently:
- Character slots see character assets
- Background slots see backgrounds
- Brand slots see branding + show assets

### 3. **No Role Lock-In**
You're no longer forced to tag an asset for one specific role:
- BEFORE: "This is CHAR.HOST.LALA only"
- AFTER: "This is a LALA asset" (usable in any LALA-compatible slot)

### 4. **Backward Compatible**
The system still respects `asset_role` tags:
- Assets show their role tag (e.g., "CHAR.HOST.PRIMARY")
- But they're grouped by folder for easy browsing
- Existing compositions continue to work

## 🔧 Technical Implementation

### Frontend (AssetRolePicker.jsx)

**New Features:**
1. **Folder Tabs** - Shows multiple folders when relevant
2. **Smart Filtering** - Filters by `asset_group` instead of exact `asset_role`
3. **Count Badges** - Shows asset count per folder
4. **Visual Hierarchy** - Active tab highlighted with folder color

**Key Function:**
```javascript
getRoleFolderMapping(role) {
  if (role.startsWith('CHAR.HOST')) return ['LALA'];
  if (role.startsWith('CHAR.GUEST')) return ['GUEST'];
  if (role.startsWith('BG.')) return ['EPISODE', 'SHOW'];
  // ... etc
}
```

### Backend (assets.js)

**New Endpoint:**
```
GET /api/v1/assets/by-folder?folders=LALA,GUEST&showId=xxx
```

**Query Parameters:**
- `folders` - Comma-separated list (e.g., "LALA,GUEST")
- `showId` - Filter by show scope
- `episodeId` - Filter by episode scope
- `approvalStatus` - Default: "APPROVED"

**Returns:**
```json
{
  "status": "SUCCESS",
  "data": [
    {
      "id": "uuid",
      "name": "Lala Promo 1",
      "asset_group": "LALA",
      "asset_role": "CHAR.HOST.LALA",
      "asset_scope": "GLOBAL",
      "s3_url_processed": "https://...",
      ...
    }
  ],
  "count": 14
}
```

## 📸 Upload Guidelines

### When Uploading Assets

**1. Choose the Right asset_group:**
- Lala images → `asset_group = 'LALA'`
- Guest images → `asset_group = 'GUEST'`
- Show branding → `asset_group = 'SHOW'`
- Episode backgrounds → `asset_group = 'EPISODE'`

**2. asset_role is Optional:**
- You CAN still tag with specific roles for organization
- But the asset will be browsable by folder regardless
- Example: Tag as `CHAR.HOST.PRIMARY` for your records, but it appears in LALA folder

**3. Use Descriptive Names:**
- Good: "Lala Red Dress Promo"
- Good: "Guest Sarah Headshot"
- Good: "Episode 5 Background Sunset"

## 🎨 UI/UX Features

### Visual Feedback
- **Selected Asset** - Blue border + checkmark ✓
- **Active Folder** - Colored tab + elevated style
- **Asset Count** - Badge showing # of assets per folder
- **Empty State** - Friendly message with upload hint

### Accessibility
- Keyboard navigation supported
- Clear visual hierarchy
- Color + icon + text labels (not color-only)
- Loading and error states

### Mobile Responsive
- Tabs wrap on small screens
- Touch-friendly tap targets
- Grid adjusts to screen size

## 🚀 Migration Path

### For Existing Assets

Your existing assets will:
1. ✅ **Continue to work** - All existing compositions load correctly
2. ✅ **Auto-group** - Assets with `asset_group` set will appear in folders
3. ✅ **Show role tags** - Original role tags still visible for reference

### For New Uploads

Going forward:
1. Upload to **Asset Manager** as normal
2. Select the appropriate **asset_group** (LALA, GUEST, etc.)
3. Optionally add specific `asset_role` for detailed organization
4. Assets automatically appear in relevant Thumbnail Composer slots

## 📊 Folder Assignment Logic

```
asset_type                  → auto asset_group
───────────────────────────────────────────────
PROMO_LALA                  → LALA
LALA_VIDEO                  → LALA
LALA_HEADSHOT               → LALA
LALA_FULLBODY               → LALA

PROMO_GUEST                 → GUEST
GUEST_HEADSHOT              → GUEST

PROMO_JUSTAWOMANINHERPRIME  → SHOW
BRAND_LOGO                  → SHOW
BRAND_BANNER                → SHOW

BACKGROUND_IMAGE            → EPISODE
BACKGROUND_VIDEO            → EPISODE
EPISODE_FRAME               → EPISODE

(Clothing items)            → WARDROBE
```

## 🔮 Future Enhancements

Potential improvements:
1. **Drag & Drop** between folders to reassign `asset_group`
2. **Bulk Actions** - Select multiple assets, change folder
3. **Search & Filter** - Search within folders
4. **Favorites** - Star frequently used assets
5. **Recent** - Show recently uploaded/used assets
6. **Smart Suggestions** - "Assets often used together"

## ❓ FAQ

**Q: What happens to my old compositions?**
A: They continue to work exactly as before. The folder system is additive.

**Q: Can I still use specific asset_role tags?**
A: Yes! The system respects them. They just group by folder for browsing.

**Q: What if I upload with the wrong asset_group?**
A: You can update it in Asset Manager (future feature: drag between folders).

**Q: Can a single asset appear in multiple folders?**
A: No, each asset belongs to one `asset_group`. But you can upload duplicates.

**Q: Why do some slots show multiple folder tabs?**
A: Some slots can accept assets from multiple categories (e.g., Brand logos can be SHOW or LALA).

---

## 🎉 Summary

The **Asset Folder Organization System** solves the problem of rigid role-based filtering by introducing flexible folder-based browsing. Your 14 Lala uploads now live in one shared "LALA" folder that's accessible from any LALA-compatible slot in the Thumbnail Composer.

**Before:** Exact role match → Limited reusability
**After:** Folder-based browsing → Maximum flexibility

Upload once, use everywhere! 🚀
