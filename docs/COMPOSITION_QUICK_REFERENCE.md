# 🎨 Composition System - Quick Reference Card

## Common Operations

### Create New Composition
```
Navigate: "Create Composition" 
→ 6-step wizard 
→ Auto-redirects to /compositions/{id}
```

### Set as Primary (Updates Episode Cover)
```
Detail Page → "⭐ Set as Primary" button 
→ Confirm dialog 
→ Episode thumbnail_url updated ✅
```

### Adjust Layout
```
Detail → "Adjust Layout" tab 
→ Drag assets on canvas 
→ "💾 Save Draft" (keeps v1) 
→ "✅ Apply & Regenerate" (→ v2)
```

### Browse All Compositions
```
Navigation → "🎨 Composition Library" 
→ Filter by Show/Status 
→ Search by name 
→ Click card → Detail
```

### Regenerate Specific Format
```
Detail → "Outputs" tab 
→ Select format from dropdown 
→ "🔄 Regenerate" 
→ Status: PROCESSING → READY
```

### Delete Output
```
Detail → "Outputs" tab 
→ Current format view 
→ "🗑️ Delete" 
→ Confirm
```

---

## API Endpoints Quick Reference

### Composition CRUD
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/compositions` | List all compositions (with filters) |
| POST | `/api/v1/compositions` | Create new composition |
| GET | `/api/v1/compositions/:id` | Get composition by ID |
| PUT | `/api/v1/compositions/:id` | Update composition |
| DELETE | `/api/v1/compositions/:id` | Delete composition |

### Output Management
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/compositions/:id/outputs` | List outputs for composition |
| POST | `/api/v1/compositions/:id/outputs/generate` | Generate/regenerate formats |
| DELETE | `/api/v1/outputs/:id` | Delete single output |

### Layout Management
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/compositions/:id/save-draft` | Save layout draft |
| POST | `/api/v1/compositions/:id/apply-draft` | Apply draft, increment version |

### Workflow
| Method | Endpoint | Purpose |
|--------|----------|---------|
| PUT | `/api/v1/compositions/:id/primary` | Set as primary + update episode thumbnail |
| PUT | `/api/v1/compositions/:id/approve` | Approve composition |

---

## Database Tables

### thumbnail_compositions
**Key Columns**:
- `id` (UUID) - Primary key
- `episode_id` (UUID FK) - Links to episode
- `template_id` (UUID FK) - Links to template
- `is_primary` (BOOLEAN) - **Only one TRUE per episode**
- `current_version` (INTEGER) - Starts at 1
- `layout_overrides` (JSONB) - Applied layout adjustments
- `draft_overrides` (JSONB) - Unsaved layout changes
- `has_unsaved_changes` (BOOLEAN) - Draft indicator
- `selected_formats` (JSONB) - Array of format strings

### composition_outputs
**Key Columns**:
- `id` (UUID) - Primary key
- `composition_id` (UUID FK) - Links to composition
- `format` (VARCHAR) - "youtube", "instagram", etc.
- `status` (ENUM) - PROCESSING, READY, FAILED
- `image_url` (VARCHAR 1024) - S3 URL to PNG/JPG
- `width` (INTEGER) - Pixel width
- `height` (INTEGER) - Pixel height
- `file_size` (INTEGER) - Bytes
- `error_message` (TEXT) - If FAILED

### episodes
**Key Columns**:
- `id` (UUID) - Primary key
- `title` (VARCHAR 255) - Episode title
- `thumbnail_url` (VARCHAR 1024) - **Episode cover (from primary composition)**
- `show_id` (UUID FK) - Links to show

---

## Frontend Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/library` | CompositionLibrary | Browse all compositions |
| `/compositions/:id` | CompositionDetail | View/edit single composition |
| `/create-composition` | ThumbnailComposer | 6-step wizard |
| `/episodes` | Episodes | Episode list |
| `/episodes/:id` | EpisodeDetail | Episode detail (shows thumbnail) |

---

## Common Workflows

### Create & Publish Flow
```
1. Create Composition (wizard) → Detail Page
2. Outputs Tab → Generate outputs → Wait for READY
3. Set as Primary → Episode cover updated
4. (Optional) Adjust Layout → Save Draft → Apply
5. (Optional) Approve → Status: APPROVED
```

### Iteration Flow
```
1. Open existing composition (from Library)
2. Adjust Layout tab → Drag assets
3. Save Draft → Persists changes (no version change)
4. Preview → Check if satisfied
5. Apply & Regenerate → v1 → v2 (new outputs queued)
6. Outputs Tab → Wait for READY → Download
```

### Management Flow
```
1. Library → Filter by Show "Just A Woman In Her Prime"
2. Search "Episode 3"
3. See all compositions for Episode 3
4. Identify primary (⭐ badge)
5. Click non-primary → Set as Primary → Switch
6. Verify episode cover updated
```

---

## Status Indicators

### Badges
| Badge | Meaning | Color |
|-------|---------|-------|
| ⭐ Primary | Episode's canonical composition | Gold gradient |
| v{N} | Version number | Gray |
| DRAFT | Not yet approved | Orange |
| READY | All outputs generated | Green |
| PROCESSING | Outputs being generated | Blue |
| FAILED | Generation failed | Red |
| Unsaved Changes | Has draft overrides | Orange pulse |
| Upgrade Available | Template has newer version | Green pulse |

### Output Status Colors
- **PROCESSING**: 🔵 Blue - In progress
- **READY**: 🟢 Green - Success
- **FAILED**: 🔴 Red - Error occurred

---

## Troubleshooting

### Issue: "Set as Primary" button disabled
**Solution**: Generate at least one output format first

### Issue: Episode thumbnail not updating
**Check**:
1. Composition has READY outputs? (Outputs tab)
2. Backend console shows: "✅ Updated episode {id} thumbnail_url"?
3. Database: `SELECT thumbnail_url FROM episodes WHERE id = '...'`

### Issue: Can't set two primaries
**This is correct behavior!** Only one composition per episode can be primary (database constraint).

### Issue: Layout changes not saving
**Check**:
1. Click "💾 Save Draft" (not "Discard")
2. Look for alert: "Draft saved!"
3. "Unsaved Changes" badge should appear
4. Verify: `has_unsaved_changes = TRUE` in database

### Issue: Version not incrementing
**Solution**: Use "✅ Apply & Regenerate" not "💾 Save Draft"
- Save Draft → Persists changes, NO version change
- Apply → Version increments, regenerates outputs

---

## Development Commands

### Start Backend
```powershell
cd C:\Users\12483\Projects\Episode-Canonical-Control-Record-1
node app.js
# Runs on port 3002
```

### Start Frontend
```powershell
cd C:\Users\12483\Projects\Episode-Canonical-Control-Record-1\frontend
npm run dev
# Runs on port 5173
```

### Run Migration
```powershell
node add-composition-outputs-table.js
node add-episode-thumbnail.js
node add-is-primary-composition.js
```

### Check Database
```sql
-- Check compositions
SELECT id, episode_id, is_primary, current_version 
FROM thumbnail_compositions;

-- Check outputs
SELECT composition_id, format, status, image_url 
FROM composition_outputs;

-- Check episodes
SELECT id, title, thumbnail_url 
FROM episodes;
```

---

## File Locations

### Backend
- Models: `src/models/*.js`
- Services: `src/services/CompositionService.js`
- Routes: `src/routes/compositions.js`
- Migrations: `add-*.js` (root directory)

### Frontend
- Pages: `frontend/src/pages/*.jsx`
- Components: `frontend/src/components/*.jsx`
- Styles: `frontend/src/pages/*.css`, `frontend/src/components/*.css`
- Routes: `frontend/src/App.jsx`

### Documentation
- Implementation: `PRIMARY_COMPOSITION_IMPLEMENTATION.md`
- Testing: `TESTING_GUIDE_PRIMARY_COMPOSITIONS.md`
- Overview: `COMPOSITION_SYSTEM_COMPLETE.md`
- Quick Ref: `COMPOSITION_QUICK_REFERENCE.md` (this file)

---

## Quick Test Commands

### Create Test Composition via API
```bash
curl -X POST http://localhost:3002/api/v1/compositions \
  -H "Content-Type: application/json" \
  -d '{
    "episode_id": "uuid",
    "template_id": "uuid",
    "assets": {
      "lala": "asset-uuid-1",
      "background_frame": "asset-uuid-2"
    },
    "selected_formats": ["youtube", "instagram"]
  }'
```

### Set as Primary via API
```bash
curl -X PUT http://localhost:3002/api/v1/compositions/{id}/primary \
  -H "Authorization: Bearer {token}"
```

### Get Episode Thumbnail
```bash
curl http://localhost:3002/api/v1/episodes/{id}
# Look for "thumbnail_url" in response
```

---

## Pro Tips

### 💡 Tip 1: Use Draft Mode for Experimentation
- Save Draft → Preview → Discard if not satisfied
- Only Apply when ready to commit
- Drafts don't consume version numbers

### 💡 Tip 2: Generate All Formats First
Before setting as primary, generate all desired formats so users have full set of thumbnails.

### 💡 Tip 3: Name Your Compositions
Give compositions descriptive names like "Episode 3 - Final Cut" to distinguish versions in Library.

### 💡 Tip 4: Check Safe Zones
Use the 5% margin guides to ensure text doesn't get cut off on YouTube.

### 💡 Tip 5: Version History is Your Friend
History tab shows exactly what changed in each version - useful for rollbacks.

---

## Summary

**System**: ✅ Fully Operational  
**Endpoints**: 11 total (5 new)  
**Components**: 7 new React components  
**Migrations**: 3 new (6 total)  

**Ready to create, manage, and publish professional thumbnails!** 🚀
