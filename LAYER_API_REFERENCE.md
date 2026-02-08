# Layer Management API Reference

## Base URL
```
http://localhost:3002/api/v1/layers
```

## Authentication
All endpoints use `optionalAuth` middleware - authentication not required but user context available when authenticated.

---

## Layer Endpoints

### 1. List Layers
```http
GET /api/v1/layers?episode_id={uuid}&include_assets=true&layer_type=overlay
```

**Query Parameters:**
- `episode_id` (optional): Filter by episode UUID
- `include_assets` (optional): Include associated assets (true/false)
- `layer_type` (optional): Filter by type (background, main, overlay, text, audio)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "episode_id": "uuid",
      "layer_number": 3,
      "layer_type": "overlay",
      "name": "Overlay Graphics",
      "is_visible": true,
      "is_locked": false,
      "opacity": 1.00,
      "blend_mode": "normal",
      "z_index": 3,
      "metadata": {},
      "created_at": "2026-02-08T00:00:00.000Z",
      "updated_at": "2026-02-08T00:00:00.000Z",
      "assets": [/* if include_assets=true */]
    }
  ]
}
```

---

### 2. Get Single Layer
```http
GET /api/v1/layers/:id
```

**Response:** Same structure as list, single object

---

### 3. Create Layer
```http
POST /api/v1/layers
Content-Type: application/json
```

**Request Body:**
```json
{
  "episode_id": "uuid",
  "layer_number": 3,
  "layer_type": "overlay",
  "name": "My Overlay Layer",
  "is_visible": true,
  "is_locked": false,
  "opacity": 1.00,
  "blend_mode": "normal",
  "z_index": 3,
  "metadata": {}
}
```

**Required Fields:**
- `episode_id`, `layer_number`, `layer_type`, `name`

**Validation:**
- `layer_number`: 1-5
- `layer_type`: background | main | overlay | text | audio
- `opacity`: 0.00-1.00
- `blend_mode`: normal | multiply | screen | overlay | darken | lighten | color-dodge | color-burn | hard-light | soft-light

**Response:**
```json
{
  "success": true,
  "data": { /* created layer */ }
}
```

---

### 4. Bulk Create Layers
```http
POST /api/v1/layers/bulk-create
Content-Type: application/json
```

**Request Body:**
```json
{
  "episode_id": "uuid",
  "layers": [
    {
      "layer_number": 1,
      "layer_type": "background",
      "name": "Background Layer",
      "opacity": 1.00,
      "blend_mode": "normal",
      "is_visible": true,
      "is_locked": false
    },
    {
      "layer_number": 2,
      "layer_type": "main",
      "name": "Main Content",
      "opacity": 1.00,
      "blend_mode": "normal",
      "is_visible": true,
      "is_locked": false
    }
    /* ... up to 5 layers */
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": [/* array of created layers */],
  "count": 5
}
```

---

### 5. Update Layer
```http
PUT /api/v1/layers/:id
Content-Type: application/json
```

**Request Body:** (all fields optional)
```json
{
  "name": "Updated Layer Name",
  "is_visible": false,
  "is_locked": true,
  "opacity": 0.85,
  "blend_mode": "multiply",
  "z_index": 10,
  "metadata": { "effect": "blur", "radius": 5 }
}
```

**Response:**
```json
{
  "success": true,
  "data": { /* updated layer */ }
}
```

---

### 6. Delete Layer
```http
DELETE /api/v1/layers/:id
```

**Response:**
```json
{
  "success": true,
  "message": "Layer deleted successfully"
}
```

**Note:** Soft delete - sets `deleted_at` timestamp, cascades to layer_assets

---

## Asset Placement Endpoints

### 7. Add Asset to Layer
```http
POST /api/v1/layers/:id/assets
Content-Type: application/json
```

**Request Body:**
```json
{
  "asset_id": "uuid",
  "position_x": 100,
  "position_y": 150,
  "width": 1920,
  "height": 1080,
  "rotation": 0.0,
  "scale_x": 1.0,
  "scale_y": 1.0,
  "opacity": 1.0,
  "start_time": 0.0,
  "duration": 10.5,
  "order_index": 1,
  "metadata": {}
}
```

**Required Fields:**
- `asset_id`

**Optional Fields:** (defaults shown)
- `position_x`, `position_y`: 0
- `width`, `height`: null (use asset dimensions)
- `rotation`: 0.0 (degrees, 0-360)
- `scale_x`, `scale_y`: 1.0 (0.01-10.00)
- `opacity`: 1.0 (0.00-1.00)
- `start_time`, `duration`: null (seconds)
- `order_index`: 0 (rendering order)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "layer_id": "uuid",
    "asset_id": "uuid",
    "position_x": 100,
    "position_y": 150,
    "width": 1920,
    "height": 1080,
    "rotation": 0.0,
    "scale_x": 1.0,
    "scale_y": 1.0,
    "opacity": 1.0,
    "start_time": 0.0,
    "duration": 10.5,
    "order_index": 1,
    "metadata": {},
    "created_at": "2026-02-08T00:00:00.000Z",
    "updated_at": "2026-02-08T00:00:00.000Z",
    "asset": {
      /* full asset object */
    }
  }
}
```

---

### 8. Update Asset Placement
```http
PUT /api/v1/layers/assets/:assetId
Content-Type: application/json
```

**Request Body:** (all fields optional)
```json
{
  "position_x": 200,
  "position_y": 300,
  "rotation": 45.0,
  "scale_x": 0.5,
  "scale_y": 0.5,
  "opacity": 0.8,
  "start_time": 2.0,
  "duration": 15.0
}
```

**Response:**
```json
{
  "success": true,
  "data": { /* updated layer asset */ }
}
```

---

### 9. Remove Asset from Layer
```http
DELETE /api/v1/layers/assets/:assetId
```

**Response:**
```json
{
  "success": true,
  "message": "Asset removed from layer"
}
```

**Note:** Soft delete - sets `deleted_at` timestamp

---

## Enum Values

### `layer_type`
- `background` - Background images/videos (Layer 1)
- `main` - Primary content (Layer 2)
- `overlay` - Overlays and graphics (Layer 3)
- `text` - Text and captions (Layer 4)
- `audio` - Audio and music (Layer 5)

### `blend_mode`
- `normal` - Default blending
- `multiply` - Multiply colors
- `screen` - Screen blending
- `overlay` - Overlay effect
- `darken` - Darken only
- `lighten` - Lighten only
- `color-dodge` - Dodge colors
- `color-burn` - Burn colors
- `hard-light` - Hard light effect
- `soft-light` - Soft light effect

---

## Error Responses

All errors follow this format:
```json
{
  "success": false,
  "error": "Error message description"
}
```

**Common Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error

**Example Validation Error:**
```json
{
  "success": false,
  "error": "Layer number must be between 1 and 5"
}
```

---

## Usage Examples

### Initialize All Layers for New Episode
```javascript
const response = await axios.post('/api/v1/layers/bulk-create', {
  episode_id: episodeId,
  layers: [
    {
      layer_number: 1,
      layer_type: 'background',
      name: 'Background Layer',
      opacity: 1.00,
      blend_mode: 'normal',
      is_visible: true,
      is_locked: false
    },
    {
      layer_number: 2,
      layer_type: 'main',
      name: 'Main Content',
      opacity: 1.00,
      blend_mode: 'normal',
      is_visible: true,
      is_locked: false
    },
    {
      layer_number: 3,
      layer_type: 'overlay',
      name: 'Overlay Graphics',
      opacity: 1.00,
      blend_mode: 'normal',
      is_visible: true,
      is_locked: false
    },
    {
      layer_number: 4,
      layer_type: 'text',
      name: 'Text & Captions',
      opacity: 1.00,
      blend_mode: 'normal',
      is_visible: true,
      is_locked: false
    },
    {
      layer_number: 5,
      layer_type: 'audio',
      name: 'Audio & Music',
      opacity: 1.00,
      blend_mode: 'normal',
      is_visible: true,
      is_locked: false
    }
  ]
});
```

### Get All Layers with Assets for Episode
```javascript
const response = await axios.get('/api/v1/layers', {
  params: {
    episode_id: episodeId,
    include_assets: true
  }
});

const layers = response.data.data;
// layers[0].assets contains all assets in that layer
```

### Add Asset to Layer with Transform
```javascript
const response = await axios.post(`/api/v1/layers/${layerId}/assets`, {
  asset_id: assetId,
  position_x: 100,
  position_y: 100,
  width: 1920,
  height: 1080,
  scale_x: 0.5,
  scale_y: 0.5,
  rotation: 15.0,
  opacity: 0.9,
  start_time: 2.0,
  duration: 10.0,
  order_index: 1
});
```

### Update Layer Visibility and Opacity
```javascript
await axios.put(`/api/v1/layers/${layerId}`, {
  is_visible: false,
  opacity: 0.5,
  blend_mode: 'multiply'
});
```

### Animate Asset Position (for frontend timeline)
```javascript
// Update asset position based on timeline playhead
const updateAssetPosition = async (assetId, x, y, rotation) => {
  await axios.put(`/api/v1/layers/assets/${assetId}`, {
    position_x: x,
    position_y: y,
    rotation: rotation
  });
};
```

---

## Testing

Test suite available at: `scripts/test-layer-api.js`

Run with:
```bash
node scripts/test-layer-api.js
```

Tests all 9 endpoints with realistic workflows.
