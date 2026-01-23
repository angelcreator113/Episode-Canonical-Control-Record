# Wardrobe Library API - Quick Reference

## Base URL
```
http://localhost:3002/api/v1/wardrobe-library
```

## Authentication
All endpoints require JWT token in Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

---

## 📤 Create Library Item

**POST** `/api/v1/wardrobe-library`

```json
{
  "name": "Red Evening Dress",
  "description": "Elegant red dress for formal occasions",
  "type": "item",
  "itemType": "dress",
  "color": "red",
  "tags": ["formal", "evening", "elegant"],
  "defaultCharacter": "lala",
  "defaultOccasion": "gala",
  "defaultSeason": "winter",
  "price": 299.99,
  "vendor": "Designer Boutique",
  "website": "https://example.com/dress",
  "imageUrl": "https://s3.amazonaws.com/bucket/image.jpg",
  "thumbnailUrl": "https://s3.amazonaws.com/bucket/thumb.jpg",
  "showId": 1
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Red Evening Dress",
    "type": "item",
    "itemType": "dress",
    "imageUrl": "...",
    "totalUsageCount": 0,
    "viewCount": 0,
    "selectionCount": 0,
    "createdAt": "2026-01-23T...",
    "updatedAt": "2026-01-23T..."
  },
  "message": "Library item created successfully"
}
```

---

## 📋 List Library Items

**GET** `/api/v1/wardrobe-library`

**Query Parameters:**
- `page` (number, default: 1) - Page number
- `limit` (number, default: 20) - Items per page
- `type` (string) - Filter by type: 'item' or 'set'
- `itemType` (string) - Filter by item type: 'dress', 'top', 'bottom', etc.
- `showId` (number) - Filter by show
- `character` (string) - Filter by default character
- `occasion` (string) - Filter by default occasion
- `season` (string) - Filter by default season
- `color` (string) - Filter by color (partial match)
- `search` (string) - Search in name and description
- `sort` (string) - Sort by field:direction (e.g., 'created_at:DESC')

**Example:**
```
GET /api/v1/wardrobe-library?type=item&color=red&sort=created_at:DESC&page=1&limit=10
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Red Evening Dress",
      "type": "item",
      "itemType": "dress",
      "color": "red",
      "imageUrl": "...",
      "thumbnailUrl": "...",
      "totalUsageCount": 5,
      "viewCount": 20,
      "selectionCount": 8,
      "show": {
        "id": 1,
        "name": "Prime Episodes",
        "icon": "...",
        "color": "#ff0000"
      }
    }
  ],
  "pagination": {
    "total": 50,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

---

## 🔍 Get Single Library Item

**GET** `/api/v1/wardrobe-library/:id`

**Example:**
```
GET /api/v1/wardrobe-library/1
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Red Evening Dress",
    "description": "Elegant red dress",
    "type": "item",
    "itemType": "dress",
    "imageUrl": "...",
    "color": "red",
    "tags": ["formal", "evening"],
    "totalUsageCount": 5,
    "lastUsedAt": "2026-01-20T...",
    "viewCount": 20,
    "selectionCount": 8,
    "show": {
      "id": 1,
      "name": "Prime Episodes"
    },
    "usageHistory": [
      {
        "id": 1,
        "usageType": "assigned",
        "episode": {
          "id": "uuid-123",
          "title": "Episode 101"
        },
        "createdAt": "2026-01-20T..."
      }
    ],
    "outfitItems": []
  }
}
```

---

## ✏️ Update Library Item

**PUT** `/api/v1/wardrobe-library/:id`

```json
{
  "description": "Updated description",
  "tags": ["formal", "evening", "updated"],
  "price": 349.99,
  "color": "dark red",
  "defaultOccasion": "gala"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Red Evening Dress",
    "description": "Updated description",
    "tags": ["formal", "evening", "updated"],
    "price": 349.99,
    "updatedAt": "2026-01-23T..."
  },
  "message": "Library item updated successfully"
}
```

---

## 🗑️ Delete Library Item

**DELETE** `/api/v1/wardrobe-library/:id`

**Success Response (if not in use):**
```json
{
  "success": true,
  "message": "Library item deleted successfully"
}
```

**Error Response (if in use):**
```json
{
  "success": false,
  "error": "Cannot delete library item: currently in use",
  "data": {
    "usageCount": 3,
    "episodes": [
      {
        "id": "uuid-123",
        "title": "Episode 101",
        "episode_number": 1
      }
    ]
  }
}
```

---

## 🔗 Assign to Episode

**POST** `/api/v1/wardrobe-library/:id/assign`

```json
{
  "episodeId": "uuid-123",
  "sceneId": "uuid-456",
  "character": "lala",
  "occasion": "gala",
  "season": "winter"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "wardrobeItem": {
      "id": "uuid-789",
      "name": "Red Evening Dress",
      "library_item_id": 1
    },
    "episodeWardrobe": {
      "id": "uuid-012",
      "episode_id": "uuid-123",
      "wardrobe_id": "uuid-789",
      "approval_status": "pending",
      "override_character": null,
      "override_occasion": null
    }
  },
  "message": "Library item assigned to episode successfully"
}
```

---

## 📊 Get Usage History

**GET** `/api/v1/wardrobe-library/:id/usage`

**Query Parameters:**
- `showId` (UUID) - Filter by show
- `limit` (number, default: 50) - Max records to return

**Example:**
```
GET /api/v1/wardrobe-library/1/usage?limit=20
```

**Response:**
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "id": 1,
        "usageType": "assigned",
        "character": "lala",
        "occasion": "gala",
        "episode": {
          "id": "uuid-123",
          "title": "Episode 101",
          "episode_number": 1
        },
        "show": {
          "id": 1,
          "name": "Prime Episodes"
        },
        "createdAt": "2026-01-20T..."
      }
    ],
    "analytics": {
      "totalUsage": 25,
      "byType": {
        "assigned": 5,
        "viewed": 15,
        "selected": 5
      },
      "byShow": {
        "Prime Episodes": 20,
        "Just A Woman": 5
      },
      "byEpisode": {
        "Episode 101": 3,
        "Episode 102": 2
      },
      "recentActivity": [...]
    }
  }
}
```

---

## 👁️ Track View

**POST** `/api/v1/wardrobe-library/:id/track-view`

**Request Body:** None required

**Response:**
```json
{
  "success": true,
  "message": "View tracked"
}
```

---

## 🎯 Track Selection

**POST** `/api/v1/wardrobe-library/:id/track-selection`

```json
{
  "episodeId": "uuid-123",
  "showId": 1
}
```

**Response:**
```json
{
  "success": true,
  "message": "Selection tracked"
}
```

---

## 🔍 Search Examples

### Search by name/description
```
GET /api/v1/wardrobe-library?search=red dress
```

### Filter by type and color
```
GET /api/v1/wardrobe-library?type=item&color=red
```

### Filter by character and occasion
```
GET /api/v1/wardrobe-library?character=lala&occasion=gala
```

### Combine filters and sort
```
GET /api/v1/wardrobe-library?type=item&itemType=dress&color=red&sort=totalUsageCount:DESC&limit=20
```

---

## 📝 Usage Type Values

When recording usage history, the following `usageType` values are used:
- `assigned` - Item assigned to an episode
- `viewed` - User viewed the item details
- `selected` - User selected the item (browsing)
- `approved` - Item approved for use in episode
- `rejected` - Item rejected for episode
- `removed` - Item removed from episode

---

## 🎨 Item Type Values

Common `itemType` values for wardrobe items:
- `dress`
- `top`
- `bottom`
- `shoes`
- `accessory`
- `jewelry`
- `perfume`
- `hat`
- `bag`
- `coat`
- `other`

---

## ⚠️ Error Responses

### 400 Bad Request - Validation Error
```json
{
  "success": false,
  "error": "Name and type are required"
}
```

### 401 Unauthorized - Missing or Invalid Token
```json
{
  "error": "Unauthorized",
  "message": "Missing authorization header",
  "code": "AUTH_MISSING_TOKEN"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Library item not found"
}
```

### 409 Conflict - Cannot Delete (In Use)
```json
{
  "success": false,
  "error": "Cannot delete library item: currently in use",
  "data": {
    "usageCount": 3,
    "episodes": [...]
  }
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error message"
}
```

---

## 🚀 Quick Start

### 1. Create a library item
```bash
curl -X POST http://localhost:3002/api/v1/wardrobe-library \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Blue Jeans",
    "type": "item",
    "itemType": "bottom",
    "color": "blue",
    "imageUrl": "https://example.com/jeans.jpg"
  }'
```

### 2. List all items
```bash
curl -X GET "http://localhost:3002/api/v1/wardrobe-library?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Assign to episode
```bash
curl -X POST http://localhost:3002/api/v1/wardrobe-library/1/assign \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "episodeId": "episode-uuid-here",
    "character": "lala"
  }'
```

---

## 📖 Related Documentation

- **Full Implementation Plan:** `WARDROBE_LIBRARY_IMPLEMENTATION_PLAN.md`
- **Implementation Summary:** `WARDROBE_LIBRARY_IMPLEMENTATION_SUMMARY.md`
- **Test Suite:** `test-wardrobe-library.js`
- **Migration Script:** `scripts/migrate-wardrobe-to-library.js`
