# 🎬 Scene Composer - Quick Reference Card

**Version:** Phase 1  
**Date:** February 9, 2026

---

## 🚀 Quick Start

```bash
# Deploy
npx sequelize-cli db:migrate
node src/server.js

# Test
curl http://localhost:3000/api/v1/episodes/{EPISODE_ID}/scenes
```

---

## 📍 API Endpoints (Cheat Sheet)

### Scenes

```bash
# List scenes
GET /api/v1/episodes/:episode_id/scenes

# Create scene
POST /api/v1/episodes/:episode_id/scenes
Body: {title, status, duration_auto}

# Get scene
GET /api/v1/scenes/:scene_id

# Update scene
PUT /api/v1/scenes/:scene_id
Body: {title, status, duration_seconds}

# Delete scene
DELETE /api/v1/scenes/:scene_id

# Reorder scenes
PUT /api/v1/episodes/:episode_id/scenes/reorder
Body: {scene_ids: []}
```

### Scene Assets

```bash
# Add asset
POST /api/v1/scenes/:scene_id/assets
Body: {asset_id, role, metadata}

# List assets
GET /api/v1/scenes/:scene_id/assets?role_filter=CLIP.%

# Update asset
PUT /api/v1/scenes/:scene_id/assets/:scene_asset_id
Body: {metadata: {...}}

# Remove asset
DELETE /api/v1/scenes/:scene_id/assets/:scene_asset_id
```

### Helpers

```bash
# Calculate duration
POST /api/v1/scenes/:scene_id/calculate-duration

# Check completeness
GET /api/v1/scenes/:scene_id/completeness
```

---

## 📊 Role Patterns

| Role Pattern | Usage | Example |
|--------------|-------|---------|
| `BG.MAIN` | Main background | Apartment scene |
| `BG.OVERLAY` | Background overlay | Window view |
| `CLIP.SLOT.1` | Video clip slot 1 | LaLa main footage |
| `CLIP.SLOT.2` | Video clip slot 2 | Guest footage |
| `CHAR.HOST.PRIMARY` | Host character | LaLa |
| `CHAR.GUEST.1` | Guest character | Friend |
| `UI.ICON.CLOSET` | Closet icon | Wardrobe UI |
| `UI.ICON.CALENDAR` | Calendar icon | Date UI |
| `UI.CURSOR` | Cursor element | Mouse pointer |

---

## 🗂️ Metadata Structures

### Video Clip
```json
{
  "trim_start": 0,
  "trim_end": 45.5,
  "position": {"x": 960, "y": 540},
  "scale": 1.0,
  "depth": 5
}
```

### Background
```json
{
  "position": {"x": 0, "y": 0},
  "depth": 1
}
```

### UI Icon
```json
{
  "position": {"x": 1800, "y": 100},
  "depth": 10,
  "appear_time": 5.0,
  "disappear_time": 40.0
}
```

---

## 🔍 Common Queries

### Get all video clips in scene
```bash
GET /api/v1/scenes/:scene_id/assets?role_filter=CLIP.%
```

### Get all UI elements
```bash
GET /api/v1/scenes/:scene_id/assets?role_filter=UI.%
```

### Check if scene is complete
```bash
GET /api/v1/scenes/:scene_id/completeness
```

---

## 💡 Quick Tips

1. **Auto Duration**: Set `duration_auto: true` to auto-calculate from longest clip
2. **Manual Duration**: Set `duration_auto: false` to set duration manually
3. **Metadata Merge**: PUT to `/assets/:id` merges metadata, doesn't replace
4. **Role Uniqueness**: One asset per role per scene (updates if exists)
5. **Cascading Delete**: Deleting scene deletes all scene_assets

---

## 🐛 Troubleshooting

```bash
# Check scene exists
curl http://localhost:3000/api/v1/scenes/:scene_id

# Check scene assets
curl http://localhost:3000/api/v1/scenes/:scene_id/assets

# Recalculate duration
curl -X POST http://localhost:3000/api/v1/scenes/:scene_id/calculate-duration

# Check completeness
curl http://localhost:3000/api/v1/scenes/:scene_id/completeness
```

---

## 📦 Response Formats

### Success
```json
{
  "success": true,
  "data": {...},
  "message": "Optional message"
}
```

### Error
```json
{
  "success": false,
  "error": "Short error",
  "message": "Detailed message"
}
```

---

## 🎯 Scene Status Values

- `planned` - Scene created, not yet started
- `in_progress` - Currently working on scene
- `complete` - Scene ready for production

---

## 📖 Full Documentation

- API Reference: [`SCENE_COMPOSER_API_DOCUMENTATION.md`](SCENE_COMPOSER_API_DOCUMENTATION.md)
- Deployment Guide: [`SCENE_COMPOSER_DEPLOYMENT_GUIDE.md`](SCENE_COMPOSER_DEPLOYMENT_GUIDE.md)
- Phase Summary: [`PHASE_1_COMPLETE_SUMMARY.md`](PHASE_1_COMPLETE_SUMMARY.md)

---

**Print this card and keep it handy! 🎬**
