# Icon Cue Timeline System - Quick Start Guide

## 🎯 What is it?
AI-powered icon animation timeline system for Lala Production episodes with:
- **Icon Cue Generation** (Claude AI)
- **Cursor Path Auto-Generation**
- **Music Cue Scene Mapping** (Lala Formula)
- **Production Package Bundling** (ZIP + S3)

## ✅ Installation Status

| Component | Status | Details |
|-----------|--------|---------|
| Database | ✅ Installed | 5 tables, 17 icon mappings |
| Backend API | ✅ Running | 49 endpoints across 5 route files |
| Services | ✅ Complete | 4 AI/auto-generation services |
| Frontend | ✅ Integrated | 3 pages + 2 service files |
| S3 Bucket | ✅ Created | `episode-metadata-production-packages` |
| Dependencies | ✅ Installed | archiver, lucide-react, aws-sdk |

## 🚀 Quick Test Commands

### 1. Check Server Status
```bash
curl http://localhost:3002/api/v1/icon-slots/mappings
```
**Expected:** 200 OK with 17 icon slot mappings

### 2. Get Icon Slots
```bash
curl http://localhost:3002/api/v1/icon-slots/mappings | jq '.data | length'
```
**Expected:** 17

### 3. Generate Icon Cues (AI)
```bash
curl -X POST http://localhost:3002/api/v1/episodes/{EPISODE_ID}/icon-cues/generate \
  -H "Content-Type: application/json"
```
**Expected:** JSON with generated icon cues and confidence scores

### 4. Auto-Generate Cursor Paths
```bash
curl -X POST http://localhost:3002/api/v1/episodes/{EPISODE_ID}/cursor-paths/generate \
  -H "Content-Type: application/json"
```
**Expected:** JSON with three-phase cursor movements

### 5. Generate Music Cues
```bash
curl -X POST http://localhost:3002/api/v1/episodes/{EPISODE_ID}/music-cues/generate \
  -H "Content-Type: application/json"
```
**Expected:** JSON with Lala Formula beat mappings

### 6. Export Production Package
```bash
curl -X POST http://localhost:3002/api/v1/episodes/{EPISODE_ID}/production-package/generate \
  -H "Content-Type: application/json"
```
**Expected:** JSON with S3 download URL (7-day expiration)

## 📁 File Locations

### Backend
```
src/
├── routes/
│   ├── iconCues.js (179 lines, 15 endpoints)
│   ├── cursorPaths.js (137 lines, 12 endpoints)
│   ├── musicCues.js (109 lines, 10 endpoints)
│   ├── productionPackage.js (81 lines, 6 endpoints)
│   └── iconSlots.js (76 lines, 6 endpoints)
├── controllers/
│   ├── iconCueController.js (719 lines)
│   ├── cursorPathController.js (545 lines)
│   ├── musicCueController.js (434 lines)
│   ├── productionPackageController.js (212 lines)
│   └── iconSlotController.js (270 lines)
└── services/
    ├── iconCueGeneratorService.js (746 lines) - AI with Claude
    ├── cursorPathGeneratorService.js (244 lines) - Auto-gen
    ├── musicCueGeneratorService.js (463 lines) - Lala Formula
    └── productionPackageService.js (587 lines) - ZIP + S3
```

### Frontend
```
frontend/src/
├── pages/
│   ├── IconCueTimeline.jsx - 3-tab interface
│   └── EpisodeDetail.jsx - Updated with "Icon Cue Timeline" button
├── components/Episodes/
│   ├── ProductionPackageExporter.jsx - ZIP download UI
│   └── EpisodeAssetsTab.jsx - Updated with 5 new icon roles
├── services/
│   └── iconCueService.js - API service layer
└── hooks/
    └── useIconCues.js - React state management
```

### Database
```
migrations/
└── 1770634408033_icon-cue-timeline-system.js (888 lines)
    - icon_slot_mappings (17 rows)
    - icon_cues
    - cursor_actions
    - music_cues
    - production_packages
```

## 🎨 Icon Slot Distribution

| Slot ID | Category | Count | Icons |
|---------|----------|-------|-------|
| slot_1 | persistent | 2 | VOICE.IDLE, VOICE.ACTIVE |
| slot_2 | action | 10 | CLOSET, TODO_LIST, JEWELRY_BOX, PURSE, PERFUME, LOCATION, SPEECH, POSE, RESERVED, HOLDER.MAIN |
| slot_3 | notification | 3 | MAIL, BESTIE_NEWS, COINS |
| slot_5 | persistent | 2 | GALLERY, CAREER_HISTORY |

**Total:** 17 icon roles mapped to 4 slots

## 📝 Frontend Navigation

### To Access Icon Cue Timeline:
1. Navigate to any Episode Detail page
2. Look for purple **"Icon Cue Timeline"** button with ✨ Sparkles icon
3. Click to open 3-tab interface:
   - **Icon Cues** - AI generation + approval workflow
   - **Cursor Paths** - Auto-generated interactions
   - **Music Cues** - Scene-based music mapping

### To Export Production Package:
1. On Episode Detail page, click **"Package"** tab
2. Click **"Generate Production Package"** button
3. Wait for ZIP creation and S3 upload
4. Click **"Download ZIP"** to download via pre-signed URL

## 🔑 Key Environment Variables

```bash
# AI Integration
ANTHROPIC_API_KEY=sk-ant-***

# S3 Storage
S3_PRODUCTION_PACKAGES_BUCKET=episode-metadata-production-packages
AWS_ACCESS_KEY_ID=***
AWS_SECRET_ACCESS_KEY=***
AWS_REGION=us-east-1

# Database
DATABASE_URL=postgresql://postgres:***@127.0.0.1:5432/episode_metadata
```

## 🧪 Validation Scripts

### Check Database Tables
```bash
node scripts/validate-icon-cue-system.js
```
**Expected Output:**
```
✅ Tables created: cursor_actions, icon_cues, icon_slot_mappings, music_cues, production_packages
✅ Icon slot mappings: 17 rows
✅ Icon Cue Timeline System validated successfully!
```

### Test API Endpoints
```bash
node scripts/test-icon-cue-api.js
```
**Expected Output:**
```
✅ Success! Found 17 icon slots
✅ Success! Found episode: 1
✅ Success! Found 0 icon cues (empty episode)
✅ Icon Cue Timeline System API tests completed!
```

## 🎯 Next Steps

### For Your First Icon Cue Generation:
1. **Upload Icon Assets:**
   - Go to Episode Assets tab
   - Upload icons for roles: UI.ICON.CLOSET, UI.ICON.MAIL, etc.
   - Assign to correct slots (slot_1-5)

2. **Generate AI Cues:**
   - POST to `/episodes/:id/icon-cues/generate`
   - Claude will analyze script and suggest icon timings
   - Review confidence scores and approve/reject

3. **Auto-Generate Cursor Paths:**
   - POST to `/episodes/:id/cursor-paths/generate`
   - System creates move→hover→click sequences
   - Links to icon cue positions

4. **Create Music Cues:**
   - POST to `/episodes/:id/music-cues/generate`
   - Maps Lala Formula beats to intensity levels
   - Stream Open (40%) → Cinematic (80%)

5. **Export Package:**
   - POST to `/episodes/:id/production-package/generate`
   - Downloads ZIP with scripts, cues, metadata
   - Uploads to S3 with 7-day URL

## 📞 Support

- **Documentation:** [ICON_CUE_TIMELINE_INSTALLATION_COMPLETE.md](ICON_CUE_TIMELINE_INSTALLATION_COMPLETE.md)
- **Validation Script:** `scripts/validate-icon-cue-system.js`
- **API Test Script:** `scripts/test-icon-cue-api.js`
- **Database Schema:** `migrations/1770634408033_icon-cue-timeline-system.js`

## 🎉 Status: READY FOR USE ✅

**Installation Date:** 2026-02-09  
**Backend Status:** Running on http://localhost:3002  
**Database Status:** 5 tables created, 17 slots seeded  
**S3 Bucket:** Configured with versioning enabled  
**Frontend Status:** Components integrated, lucide-react installed  
**API Endpoints:** 49 endpoints functional and tested
