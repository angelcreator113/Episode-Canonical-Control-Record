# 👗 Advanced Wardrobe Management System - Complete Guide

## 🎯 Overview

The Episode Canonical Control Record now includes a comprehensive wardrobe management system designed for professional episode production. Track clothing, accessories, jewelry, and perfume for multiple characters with advanced features like budget tracking, outfit sets, repeat prevention, and outfit planning.

## ✨ Key Features Implemented

### 1. **Character-Based Organization** 👥
- Filter wardrobe items by character:
  - 💜 **Lala** - Main character
  - 👩 **Just a Woman** - Secondary character
  - 🎭 **Guest** - Guest appearances
- Quick character tabs with item counts
- Budget breakdown by character

### 2. **Outfit Notes** 📝
- Add styling notes and special instructions
- Track care requirements
- Document styling preferences
- Example: "Pair with black leather pants and gold heels. Make sure to steam before use."

### 3. **Repeat Prevention** 🔁
- Automatically tracks previous episodes where items were worn
- Visual warning badges on repeated items
- Shows "Worn Xx before" count
- Prevents wardrobe fatigue on screen

### 4. **Budget Tracking** 💰
- Track total spend per episode
- Budget breakdown by character
- Visual progress bars showing percentage allocation
- Individual item pricing
- Total wardrobe value at a glance

### 5. **Favorite Items** ⭐
- Mark frequently worn or signature pieces
- Dedicated favorites section
- Quick visual identification with star badge
- Golden highlight on favorite cards

### 6. **Outfit Sets** 👔
- Group items that go together as complete looks
- Assign outfit set ID and name
- Visual outfit set section showing all pieces
- Example: "Purple Power Look" (blazer + pants + heels)

### 7. **Season/Occasion Tags** 🌡️📅
- Organize by season (Spring, Summer, Fall, Winter, All-Season)
- Tag by occasion (Casual, Formal, Party, Red Carpet, etc.)
- Quick filtering and organization
- Visual badges on item cards

### 8. **Custom Tags** 🏷️
- Add unlimited custom tags
- Examples: "sparkly", "vintage", "designer", "casual-chic"
- Flexible organization system
- Easy search and filtering

### 9. **Wear History** 👔
- Track how many times an item has been worn
- Record last worn date
- Helpful for rotation planning
- Ensures even usage across wardrobe

## 🗄️ Database Schema

### Assets Table - Metadata JSONB Field

```json
{
  "clothingCategory": "top|bottom|dress|shoes|accessories|jewelry|perfume",
  "brand": "Brand Name",
  "website": "brand.com",
  "purchaseLink": "https://...",
  "price": "999.99",
  "color": "Color Name",
  "size": "S/M/L or numeric",
  "occasion": "casual|formal|party|red-carpet|everyday",
  "season": "spring|summer|fall|winter|all-season",
  "character": "lala|justawoman|guest",
  "episodeId": "uuid",
  "episodeNumber": "E01",
  "episodeTitle": "Episode Title",
  "scene": "Scene Description",
  "timesWorn": 5,
  "lastWorn": "2024-01-15",
  "outfitNotes": "Styling notes and instructions",
  "isFavorite": true,
  "outfitSetId": "set-001",
  "outfitSetName": "Purple Power Look",
  "previousEpisodes": ["ep-001", "ep-003"],
  "plannedForEpisodes": ["ep-010"],
  "tags": ["sparkly", "designer", "statement-piece"]
}
```

## 📸 UI Components

### Wardrobe Tab (EpisodeDetail.jsx)
Located alongside Scenes, Assets, and Metadata tabs in the episode detail view.

**Stats Header:**
- Total Items count
- Number of characters
- Total Budget with $ amount
- Favorites count with ⭐

**Budget Breakdown Section:**
- Visual progress bars per character
- Color-coded bars (Purple for Lala, Pink for Just a Woman, Blue for Guest)
- Percentage allocation
- Dollar amounts per character

**Character Filter Tabs:**
- All, Lala, Just a Woman, Guest
- Active tab with gradient background
- Item counts in badges

**Favorites Section:**
- Shows all favorite items across characters
- Golden background highlight
- Star badges on cards

**Outfit Sets Section:**
- Groups complete looks together
- Purple gradient background
- Shows all pieces in each set
- Item count per set

**Category Sections:**
- Organized by clothing type (Dresses, Tops, Bottoms, Shoes, etc.)
- Grid layout for easy browsing
- Individual item cards with rich metadata

### Item Cards Display

**Visual Badges:**
- ⭐ Favorite badge (top-right)
- 🔁 Repeat warning badge (top-left) - Shows times worn before
- 👔 Outfit set badge (bottom-right)

**Item Details:**
- Item name (prominent heading)
- 🏷️ Brand name
- 💰 Price (highlighted in green)
- 🎨 Color
- 📏 Size
- 🎬 Scene information
- 📝 Outfit notes (yellow callout box)
- 🌡️ Season tag (blue badge)
- 📅 Occasion tag (purple badge)
- 🏷️ Custom tags (gray badges)
- 👔 Wear info (times worn + last worn date)
- 🛍️ "Shop Item" link (if purchase link provided)

## 📝 Upload Form (AssetManager.jsx)

### Basic Wardrobe Fields:
- Clothing Category dropdown (Dress, Top, Bottom, Shoes, Accessories, Jewelry, Perfume)
- Brand name
- Website
- Purchase link
- Price
- Color
- Size
- Occasion dropdown
- Season dropdown

### Advanced Features Section:
- Character selection (Lala, Just a Woman, Guest)
- Outfit notes textarea
- Favorite checkbox
- Outfit Set ID and Name
- Tags input (comma-separated)

### Feature Preview Cards:
- 🔁 Repeat Prevention
- 📅 Outfit Planning
- 💰 Budget Tracking

## 🎨 Styling

### Color Scheme:
- **Favorites:** Golden yellow (#fbbf24)
- **Outfit Sets:** Purple (#a78bfa)
- **Budget:** Green (#10b981)
- **Repeat Warnings:** Red (#ef4444)
- **Character Tabs:** Gradient purple to pink
- **Season Tags:** Blue (#dbeafe)
- **Occasion Tags:** Indigo (#e0e7ff)

### Responsive Design:
- Grid layout adapts to screen size
- Cards stack on mobile
- Touch-friendly tap targets
- Smooth transitions and animations

## 🚀 Getting Started

### 1. View Wardrobe for an Episode:
1. Navigate to Episode Detail page
2. Click the "Wardrobe" tab
3. Use character filters to focus on specific character
4. Browse items by category

### 2. Add New Wardrobe Item:
1. Go to Asset Manager
2. Select "Upload New Asset"
3. Choose clothing category
4. Fill in wardrobe details (brand, price, color, size)
5. Expand "Advanced Features" section
6. Select character
7. Add outfit notes if needed
8. Mark as favorite if applicable
9. Set outfit set ID/name if part of a complete look
10. Add custom tags
11. Upload and save

### 3. Create an Outfit Set:
1. Upload first item with outfit set ID (e.g., "set-001")
2. Give it a name (e.g., "Purple Power Look")
3. Upload additional items with the same outfit set ID
4. All items will automatically group together in the Outfit Sets section

### 4. Track Budget:
- Budget automatically calculates from item prices
- View total budget in stats header
- See budget breakdown by character
- Visual bars show percentage allocation
- Color-coded for easy identification

## 📊 Sample Data

Sample wardrobe data has been added to demonstrate all features:

**Lala Items (5):**
1. Purple Sequin Blazer - $2,450 (Favorite, Set 001)
2. Black Leather Pants - $495 (Favorite, Set 001)
3. Gold Strappy Heels - $795 (Set 001)
4. Diamond Stud Earrings - $3,500 (Favorite, worn 10x)
5. Chanel No. 5 Perfume - $135 (Favorite, worn 20x)

**Just a Woman Items (2):**
1. White Linen Shirt - $78 (Favorite, Set 002)
2. Blue Denim Jeans - $98 (Favorite, Set 002)

**Guest Items (1):**
1. Red Cocktail Dress - $248

**Total Budget:** $7,799.00

## 🔧 Technical Details

### Files Modified:
1. **frontend/src/components/EpisodeWardrobe.jsx** - Main display component
2. **frontend/src/components/EpisodeWardrobe.css** - Styling
3. **frontend/src/pages/EpisodeDetail.jsx** - Tab integration
4. **frontend/src/pages/AssetManager.jsx** - Upload form
5. **src/routes/episodes.js** - API endpoint
6. **create-assets-table.sql** - Database schema
7. **add-sample-wardrobe.js** - Sample data script

### API Endpoint:
```
GET /api/v1/episodes/:id/wardrobe
```

Returns all clothing assets for a specific episode, filtered by:
- Asset type starts with "CLOTHING_"
- Metadata->episodeId matches requested episode
- Not deleted

### Database Query:
```sql
SELECT * FROM assets 
WHERE asset_type LIKE 'CLOTHING_%' 
  AND metadata->>'episodeId' = :episodeId 
  AND deleted_at IS NULL 
ORDER BY created_at DESC
```

## 🎯 Use Cases

### Production Assistant:
- Track all wardrobe items for each episode
- Ensure proper budget allocation
- Prevent repeating outfits too frequently
- Organize by character and scene

### Wardrobe Stylist:
- Plan complete outfit sets
- Track favorite signature pieces
- Add styling notes for continuity
- Search by season/occasion for appropriate looks

### Producer:
- Monitor budget spending per character
- Review total episode wardrobe costs
- Approve outfit selections
- Plan future episode wardrobes

### Editor:
- Reference what was worn in previous episodes
- Ensure visual continuity
- Check scene-specific wardrobe

## 🔮 Future Enhancements

Potential additions to the wardrobe system:

1. **Calendar View** - Visual timeline of planned outfits across episodes
2. **Export Lookbook** - Generate PDF wardrobe reports
3. **Analytics** - Most worn items, budget trends, character preferences
4. **Shopping List** - Track items to purchase for future episodes
5. **Size Charts** - Store size information for multiple brands
6. **Styling Photos** - Before/after styling reference photos
7. **Wardrobe Assistant** - AI suggestions for outfit combinations
8. **Inventory Management** - Track item location and status
9. **Collaboration** - Share wardrobe selections with team
10. **Version History** - Track changes to outfit selections

## ✅ Testing Checklist

- [x] Character filtering works (All, Lala, Just a Woman, Guest)
- [x] Budget calculations are accurate
- [x] Favorite items display correctly
- [x] Outfit sets group properly
- [x] Repeat warnings show on previously worn items
- [x] Tags display and format correctly
- [x] Season/occasion badges visible
- [x] Item cards show all metadata
- [x] Upload form captures all fields
- [x] Budget breakdown visualizes correctly

## 📚 Related Documentation

- [ASSETS_DEPLOYMENT_GUIDE.md](ASSETS_DEPLOYMENT_GUIDE.md) - Asset upload system
- [API_QUICK_REFERENCE.md](API_QUICK_REFERENCE.md) - API endpoints
- [DATABASE_SETUP_GUIDE.md](DATABASE_SETUP_GUIDE.md) - Database configuration

---

**Last Updated:** January 19, 2024  
**Version:** 1.0  
**Status:** ✅ Fully Implemented

