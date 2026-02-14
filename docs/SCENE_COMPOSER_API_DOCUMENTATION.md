# 🎬 Scene Composer API Documentation

**Version:** 1.0  
**Date:** February 9, 2026  
**Base URL:** `/api/v1`

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Scene Endpoints](#scene-endpoints)
3. [Scene Asset Endpoints](#scene-asset-endpoints)
4. [Helper Endpoints](#helper-endpoints)
5. [Data Models](#data-models)
6. [Error Handling](#error-handling)
7. [Testing Examples](#testing-examples)

---

## Overview

The Scene Composer API provides endpoints for creating, managing, and composing scenes within episodes. Scenes are spatial containers that bind video clips, backgrounds, and UI elements together with positioning and timing metadata.

### Key Concepts

- **Scene**: A container with layout rules and timing
- **Scene Asset**: A binding between a scene and an asset (video, image, icon) with a specific role
- **Role**: Semantic identifier (e.g., `BG.MAIN`, `CLIP.SLOT.1`, `UI.ICON.CLOSET`)
- **Metadata**: JSONB field containing position, trim points, timing, etc.

---

## Scene Endpoints

### 1. List Scenes for Episode

Get all scenes for an episode.

```http
GET /api/v1/episodes/:episode_id/scenes
```

**Query Parameters:**
- `include_assets` (boolean) - Include scene assets in response

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "scene-uuid-1",
      "episode_id": "episode-uuid",
      "scene_number": 1,
      "title": "Opening - LaLa Wakes Up",
      "description": null,
      "status": "complete",
      "duration_seconds": "30.50",
      "duration_auto": true,
      "layout": null,
      "production_status": "draft",
      "created_at": "2026-02-09T10:00:00Z",
      "updated_at": "2026-02-09T10:30:00Z"
    }
  ]
}
```

### 2. Create Scene

Create a new scene for an episode.

```http
POST /api/v1/episodes/:episode_id/scenes
```

**Request Body:**
```json
{
  "title": "LaLa Reacts to Invite",
  "description": "LaLa sees the brunch invitation and reacts",
  "scene_number": 3,
  "status": "planned",
  "duration_seconds": null,
  "duration_auto": true,
  "layout": {
    "canvas": {
      "width": 1920,
      "height": 1080
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "scene-uuid-new",
    "episode_id": "episode-uuid",
    "title": "LaLa Reacts to Invite",
    "scene_number": 3,
    "status": "planned",
    "duration_seconds": null,
    "duration_auto": true,
    "created_at": "2026-02-09T11:00:00Z"
  }
}
```

### 3. Get Single Scene

Get details of a specific scene.

```http
GET /api/v1/scenes/:scene_id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "scene-uuid-3",
    "episode_id": "episode-uuid",
    "title": "LaLa Reacts to Invite",
    "scene_number": 3,
    "status": "in_progress",
    "duration_seconds": "45.20",
    "duration_auto": false,
    "layout": {...}
  }
}
```

### 4. Update Scene

Update scene properties.

```http
PUT /api/v1/scenes/:scene_id
```

**Request Body (partial update):**
```json
{
  "title": "LaLa Reacts to Brunch Invite",
  "status": "complete",
  "duration_seconds": 47.8,
  "duration_auto": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "scene-uuid-3",
    "title": "LaLa Reacts to Brunch Invite",
    "status": "complete",
    "duration_seconds": "47.80",
    "updated_at": "2026-02-09T12:00:00Z"
  }
}
```

### 5. Delete Scene

Delete a scene (cascades to scene_assets).

```http
DELETE /api/v1/scenes/:scene_id
```

**Response:**
```json
{
  "success": true,
  "message": "Scene deleted successfully"
}
```

### 6. Reorder Scenes

Change the order of scenes within an episode.

```http
PUT /api/v1/episodes/:episode_id/scenes/reorder
```

**Request Body:**
```json
{
  "scene_ids": [
    "scene-uuid-1",
    "scene-uuid-3",
    "scene-uuid-2",
    "scene-uuid-4"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Scenes reordered successfully"
}
```

---

## Scene Asset Endpoints

### 7. Add Asset to Scene

Bind an asset to a scene with a specific role.

```http
POST /api/v1/scenes/:scene_id/assets
```

**Request Body:**
```json
{
  "asset_id": "asset-uuid-clip-003",
  "role": "CLIP.SLOT.1",
  "metadata": {
    "trim_start": 0,
    "trim_end": 45.5,
    "character_slot": "lala",
    "position": {"x": 960, "y": 540},
    "scale": 1.0,
    "depth": 5
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "scene-asset-uuid-new",
    "scene_id": "scene-uuid-3",
    "asset_id": "asset-uuid-clip-003",
    "role": "CLIP.SLOT.1",
    "metadata": {...},
    "created_at": "2026-02-09T13:00:00Z",
    "asset": {
      "id": "asset-uuid-clip-003",
      "file_name": "lala_react_001.mp4",
      "asset_type": "video",
      "duration_seconds": "47.30"
    }
  },
  "message": "Asset added to scene"
}
```

**Notes:**
- If `role` already exists in scene, updates the existing binding
- Returns 201 for new, 200 for update

### 8. List Scene Assets

Get all assets bound to a scene.

```http
GET /api/v1/scenes/:scene_id/assets
```

**Query Parameters:**
- `role_filter` (string) - SQL LIKE pattern (e.g., `CLIP.%`, `UI.ICON.%`)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "scene-asset-uuid-1",
      "scene_id": "scene-uuid-3",
      "asset_id": "asset-uuid-bg",
      "role": "BG.MAIN",
      "metadata": {
        "position": {"x": 0, "y": 0},
        "depth": 1
      },
      "asset": {
        "id": "asset-uuid-bg",
        "file_url": "https://s3.../apartment_bg.jpg",
        "file_name": "apartment_bg.jpg",
        "asset_type": "image",
        "width": 1920,
        "height": 1080
      }
    },
    {
      "id": "scene-asset-uuid-2",
      "scene_id": "scene-uuid-3",
      "asset_id": "asset-uuid-clip",
      "role": "CLIP.SLOT.1",
      "metadata": {
        "trim_start": 0,
        "trim_end": 45.5,
        "position": {"x": 960, "y": 540},
        "depth": 5
      },
      "asset": {
        "id": "asset-uuid-clip",
        "file_url": "https://s3.../lala_react.mp4",
        "asset_type": "video",
        "duration_seconds": "47.30"
      }
    }
  ],
  "count": 2
}
```

**Example: Get only video clips**
```http
GET /api/v1/scenes/:scene_id/assets?role_filter=CLIP.%
```

### 9. Update Scene Asset

Update metadata for a scene asset binding.

```http
PUT /api/v1/scenes/:scene_id/assets/:scene_asset_id
```

**Request Body:**
```json
{
  "metadata": {
    "position": {"x": 900, "y": 500},
    "scale": 1.2,
    "trim_end": 43.0
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "scene-asset-uuid-1",
    "metadata": {
      "position": {"x": 900, "y": 500},
      "scale": 1.2,
      "trim_start": 0,
      "trim_end": 43.0,
      "depth": 5
    },
    "updated_at": "2026-02-09T14:00:00Z"
  },
  "message": "Scene asset updated"
}
```

**Note:** Metadata is **merged**, not replaced.

### 10. Remove Asset from Scene

Delete a scene asset binding.

```http
DELETE /api/v1/scenes/:scene_id/assets/:scene_asset_id
```

**Response:**
```json
{
  "success": true,
  "message": "Asset removed from scene",
  "deleted_id": "scene-asset-uuid-1"
}
```

---

## Helper Endpoints

### 11. Auto-Calculate Scene Duration

Calculate scene duration from video clips and optionally update.

```http
POST /api/v1/scenes/:scene_id/calculate-duration
```

**Response (duration calculated and updated):**
```json
{
  "success": true,
  "duration_seconds": "45.50",
  "updated": true,
  "message": "Duration calculated and updated"
}
```

**Response (no clips found):**
```json
{
  "success": true,
  "duration_seconds": null,
  "updated": false,
  "message": "No video clips found in scene"
}
```

**Response (manual mode):**
```json
{
  "success": true,
  "duration_seconds": "45.50",
  "updated": false,
  "message": "Duration calculated (not updated - manual mode)"
}
```

**Behavior:**
- Uses `calculate_scene_duration()` database function
- Finds longest video clip (after trim points)
- Updates `duration_seconds` only if `duration_auto = true`

### 12. Check Scene Completeness

Validate if scene has all required elements.

```http
GET /api/v1/scenes/:scene_id/completeness
```

**Response (incomplete):**
```json
{
  "success": true,
  "complete": false,
  "missing": {
    "background": false,
    "clips": true,
    "duration": true
  },
  "warnings": [
    "Scene has no video clips assigned",
    "Duration not set"
  ],
  "details": {
    "background_count": 1,
    "clip_count": 0,
    "duration_seconds": null
  }
}
```

**Response (complete):**
```json
{
  "success": true,
  "complete": true,
  "missing": {
    "background": false,
    "clips": false,
    "duration": false
  },
  "warnings": [],
  "details": {
    "background_count": 1,
    "clip_count": 2,
    "duration_seconds": "45.50"
  }
}
```

**Validation Rules:**
- ✅ Must have at least 1 background (`BG.*`)
- ✅ Must have at least 1 clip (`CLIP.*`)
- ✅ Must have `duration_seconds > 0`

---

## Data Models

### Scene Model

```typescript
{
  id: UUID,
  episode_id: UUID,
  scene_number: INTEGER,
  title: STRING(255),
  description: TEXT,
  
  // Scene Composer fields
  status: ENUM('planned', 'in_progress', 'complete'),
  duration_seconds: DECIMAL(10,2),
  duration_auto: BOOLEAN,
  layout: JSONB,
  
  // Legacy fields
  production_status: ENUM('draft', 'storyboarded', 'recorded', 'edited', 'complete'),
  scene_type: ENUM('intro', 'main', 'outro', 'transition'),
  location: STRING(255),
  mood: STRING(100),
  
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP,
  deleted_at: TIMESTAMP
}
```

### Scene Asset Model

```typescript
{
  id: UUID,
  scene_id: UUID,
  asset_id: UUID,
  
  role: STRING(100),     // e.g., "BG.MAIN", "CLIP.SLOT.1"
  metadata: JSONB,       // Position, trim, timing, etc.
  
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP
}
```

### Metadata Structure

**For Video Clips:**
```json
{
  "trim_start": 0,
  "trim_end": 45.5,
  "character_slot": "lala",
  "position": {"x": 960, "y": 540},
  "scale": 1.0,
  "depth": 5
}
```

**For Backgrounds:**
```json
{
  "position": {"x": 0, "y": 0},
  "scale": 1.0,
  "depth": 1
}
```

**For UI Icons:**
```json
{
  "position": {"x": 890, "y": 120},
  "depth": 10,
  "appear_time": 5.0,
  "disappear_time": 40.0,
  "animation": "fade_in"
}
```

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": "Short error message",
  "message": "Detailed error description"
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `404` - Not Found (scene/asset doesn't exist)
- `409` - Conflict (duplicate role in scene)
- `500` - Internal Server Error

### Common Errors

**Scene Not Found:**
```json
{
  "success": false,
  "error": "Scene not found"
}
```

**Asset Not Found:**
```json
{
  "success": false,
  "error": "Asset not found"
}
```

**Invalid Duration:**
```json
{
  "success": false,
  "error": "Validation error",
  "message": "duration_seconds must be non-negative"
}
```

---

## Testing Examples

### Test Workflow: Build a Complete Scene

#### 1. Create Scene
```bash
curl -X POST http://localhost:3000/api/v1/episodes/{EPISODE_ID}/scenes \
  -H "Content-Type: application/json" \
  -d '{
    "title": "LaLa Reacts to Invite",
    "status": "planned",
    "duration_auto": true
  }'
```

#### 2. Add Background
```bash
curl -X POST http://localhost:3000/api/v1/scenes/{SCENE_ID}/assets \
  -H "Content-Type: application/json" \
  -d '{
    "asset_id": "{BG_ASSET_ID}",
    "role": "BG.MAIN",
    "metadata": {
      "position": {"x": 0, "y": 0},
      "depth": 1
    }
  }'
```

#### 3. Add Video Clip
```bash
curl -X POST http://localhost:3000/api/v1/scenes/{SCENE_ID}/assets \
  -H "Content-Type: application/json" \
  -d '{
    "asset_id": "{CLIP_ASSET_ID}",
    "role": "CLIP.SLOT.1",
    "metadata": {
      "trim_start": 0,
      "trim_end": 45.5,
      "position": {"x": 960, "y": 540},
      "depth": 5
    }
  }'
```

#### 4. Add UI Icon
```bash
curl -X POST http://localhost:3000/api/v1/scenes/{SCENE_ID}/assets \
  -H "Content-Type: application/json" \
  -d '{
    "asset_id": "{ICON_ASSET_ID}",
    "role": "UI.ICON.CLOSET",
    "metadata": {
      "position": {"x": 1800, "y": 100},
      "depth": 10,
      "appear_time": 5.0
    }
  }'
```

#### 5. Auto-Calculate Duration
```bash
curl -X POST http://localhost:3000/api/v1/scenes/{SCENE_ID}/calculate-duration
```

#### 6. Check Completeness
```bash
curl http://localhost:3000/api/v1/scenes/{SCENE_ID}/completeness
```

#### 7. List All Scene Assets
```bash
curl http://localhost:3000/api/v1/scenes/{SCENE_ID}/assets
```

#### 8. Update Scene Status
```bash
curl -X PUT http://localhost:3000/api/v1/scenes/{SCENE_ID} \
  -H "Content-Type: application/json" \
  -d '{
    "status": "complete"
  }'
```

### Test: Get Only Video Clips
```bash
curl "http://localhost:3000/api/v1/scenes/{SCENE_ID}/assets?role_filter=CLIP.%"
```

### Test: Update Asset Position
```bash
curl -X PUT http://localhost:3000/api/v1/scenes/{SCENE_ID}/assets/{SCENE_ASSET_ID} \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "position": {"x": 950, "y": 530}
    }
  }'
```

---

## Next Steps

- [ ] Run migration: `npx sequelize-cli db:migrate`
- [ ] Test all endpoints with Postman/curl
- [ ] Build Scene Composer frontend components
- [ ] Implement real-time preview
- [ ] Add websocket updates for collaborative editing

---

**Documentation Version:** 1.0  
**Last Updated:** February 9, 2026  
**Author:** Scene Composer Development Team
