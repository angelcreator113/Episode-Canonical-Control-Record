# Wardrobe Frontend - Quick Start Guide

## 🚀 Access the System

**Dev URL**: https://dev.primepisodes.com

1. Login with your credentials
2. Click the **"Wardrobe"** menu item in navigation
3. Select a section:
   - **Gallery** - Episode wardrobe view
   - **Library** - Browse all wardrobe items
   - **Outfit Sets** - Manage outfit combinations
   - **Analytics** - Usage stats and trends

---

## 📚 Main Workflows

### 1. Upload a Wardrobe Item (2 minutes)

**Path**: Wardrobe → Library → `+ Upload Item`

```
1. Drag image or click to select
   → JPG/PNG up to 10MB

2. Fill in details:
   ✓ Name (required)
   ✓ Type: Item or Set
   ✓ Item Type: dress, top, shoes, etc.
   ✓ Color, Season, Occasion
   ✓ Tags (multi-select)
   ✓ Price, Vendor, Website
   ✓ Show (optional)

3. Click "Upload"
   → Item appears in library
```

---

### 2. Assign Item to Episode (1 minute)

**Path**: Library → Click item → `Assign to Episode`

```
1. Select episode from dropdown
2. Optional: Select specific scene
3. Optional: Override character/occasion/season
4. Click "Assign"
   → Item linked to episode
```

---

### 3. Approve/Reject Wardrobe (30 seconds)

**Path**: Episodes → Select episode → Wardrobe tab

```
1. See all assigned items
2. For each item:
   ✓ Click "Approve" → Marks approved
   ✗ Click "Reject" → Add reason
3. Status tracked in history
```

---

### 4. Create Outfit Set (3 minutes)

**Path**: Wardrobe → Outfit Sets → `Create New`

```
1. Name the outfit set
2. Drag items from pool into composer
3. Set layer order:
   - Base (underwear, foundation)
   - Mid (main clothing)
   - Outer (jackets, coats)
   - Accessory (jewelry, bags)
4. Mark items as optional if needed
5. Click "Save"
   → Outfit set created
```

---

### 5. Bulk Delete Items (1 minute)

**Path**: Library → `☐ Bulk Select`

```
1. Enable bulk mode
2. Check items to delete
3. Click "Delete Selected"
4. Confirm → Items removed
```

---

## 🎨 UI Features

### Library Browser

**Stats Dashboard** (Top)
- Total items
- Individual items
- Outfit sets
- New this week

**Filters** (Left sidebar)
- Type (item/set)
- Item Type (dress, shoes, etc.)
- Color
- Season
- Occasion
- Show
- Usage Status (used/unused)

**Search** (Top bar)
- Search by name/description
- Real-time filtering

**Sort** (Top bar)
- Newest first
- By name
- Most used
- Last used

**Views**
- Grid (cards)
- List (detailed)

---

## 📱 Responsive Design

### Desktop
- Full sidebar filters
- Multi-column grid
- Large image previews

### Tablet
- Collapsible filters
- 2-column grid
- Touch-optimized

### Mobile
- Single column
- Bottom sheet filters
- Swipe actions

---

## 🎯 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Esc` | Close modals |
| `Ctrl+F` | Focus search |
| `←` `→` | Navigate pagination |
| `Space` | Select item (bulk mode) |

---

## 💡 Tips & Tricks

### Efficient Tagging
- Use tags for quick filtering
- Examples: "summer-2026", "formal-event", "lala-favorite"
- Tags are searchable

### Color Coding
- Use color filter for quick outfit matching
- Combine with season filter for themed collections

### Show Organization
- Assign items to shows for organization
- Filter by show to see show-specific wardrobe

### Usage Tracking
- View count increases on every view
- Selection count tracks episode assignments
- Last used date updates on approval

---

## 🔧 Troubleshooting

### Image not uploading?
- Check file size (max 10MB)
- Only JPG/PNG supported
- Check network connection

### Can't see item?
- Check filters (clear all)
- Try search by exact name
- Check if soft-deleted

### Assignment not working?
- Ensure episode exists
- Check required fields filled
- Verify permissions

### Stats not updating?
- Refresh page
- Check backend logs
- Stats update on API call

---

## 📊 Analytics Section

**Most Used Items**
- Top 10 items by usage count
- Filter by show/date range

**Seasonal Trends**
- Items used per season
- Predict future needs

**Color Analysis**
- Distribution chart
- Popular color combinations

**Show Breakdown**
- Items per show
- Show-specific favorites

---

## 🔗 API Endpoints Used

### Frontend → Backend Communication

```
GET    /api/v1/wardrobe-library
POST   /api/v1/wardrobe-library
GET    /api/v1/wardrobe-library/:id
PATCH  /api/v1/wardrobe-library/:id
DELETE /api/v1/wardrobe-library/:id
POST   /api/v1/wardrobe-library/:id/assign
GET    /api/v1/wardrobe-library/stats
POST   /api/v1/wardrobe-library/bulk-delete
POST   /api/v1/wardrobe-approval/:episodeId/:wardrobeId/approve
POST   /api/v1/wardrobe-approval/:episodeId/:wardrobeId/reject
```

All authenticated with session cookies.

---

## 📝 Next Steps

1. **Upload** your first wardrobe item
2. **Assign** it to an episode
3. **Approve** the wardrobe for the episode
4. **Create** your first outfit set
5. **Explore** analytics and usage patterns

---

## 🆘 Need Help?

- **Documentation**: [WARDROBE_FRONTEND_COMPLETE.md](./WARDROBE_FRONTEND_COMPLETE.md)
- **API Reference**: [WARDROBE_LIBRARY_API_REFERENCE.md](./WARDROBE_LIBRARY_API_REFERENCE.md)
- **Backend Details**: [WARDROBE_LIBRARY_IMPLEMENTATION_SUMMARY.md](./WARDROBE_LIBRARY_IMPLEMENTATION_SUMMARY.md)

---

**🎉 Enjoy your new wardrobe management system!**
