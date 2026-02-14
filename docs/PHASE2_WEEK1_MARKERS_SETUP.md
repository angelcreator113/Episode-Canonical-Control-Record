# 🎯 Phase 2 Week 1: Markers System - Setup & Testing Guide

## 📦 What Was Built

Complete timeline markers system for Episode Canonical Control Record:

### **Files Created:**
```
✅ create-markers-table.js           - Database migration
✅ src/models/Marker.js               - Sequelize model
✅ src/controllers/markerController.js - CRUD operations
✅ src/routes/markers.js              - API routes
✅ frontend/src/services/markerService.js - Frontend service
✅ test-markers-api.js                - End-to-end test suite
✅ src/models/index.js                - Updated (Marker registered)
✅ src/app.js                         - Updated (routes mounted)
```

---

## 🚀 Setup Instructions

### **Step 1: Run Database Migration**
```powershell
# Create markers table
node create-markers-table.js
```

**Expected Output:**
```
🔌 Connecting to database...
✅ Connected!

🔄 Creating markers table...
✅ Markers table created successfully!

🔄 Creating indexes...
✅ Indexes created successfully!

✅ Markers table columns:
  - id: uuid NOT NULL
  - episode_id: uuid NOT NULL
  - scene_id: uuid
  - timecode: numeric NOT NULL
  - title: character varying
  ...
🎉 Migration complete! Markers table is ready for Phase 2.
```

---

### **Step 2: Restart Backend Server**
```powershell
# Stop existing Node processes
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force

# Start server
node src/server.js
```

**Look for this log:**
```
✅ Marker routes mounted (Phase 2)
```

---

### **Step 3: Run Tests**
```powershell
# Install node-fetch if not present
npm install node-fetch

# Run test suite
node test-markers-api.js
```

**Expected Output:**
```
╔════════════════════════════════════════════╗
║   MARKERS API TEST SUITE (Phase 2 Week 1) ║
╚════════════════════════════════════════════╝

🔗 API URL: http://localhost:3002

📋 Step 1: Finding test episode...
✅ Found episode: Test Episode (uuid)

📋 Step 2: Finding test scene...
✅ Found scene: Test Scene (uuid)

📋 Step 3: Creating marker...
✅ Marker created: Test Marker: Important Moment at 45.5s

📋 Step 4: Retrieving marker...
✅ Marker retrieved: Test Marker: Important Moment

📋 Step 5: Listing all episode markers...
✅ Found 1 marker(s) for episode

📋 Step 6: Updating marker...
✅ Marker updated successfully

📋 Step 7: Filtering markers by type...
✅ Found 1 chapter marker(s)

📋 Step 8: Auto-linking marker to scene...
✅ Marker auto-linked to scene: Test Scene

📋 Step 9: Deleting marker...
✅ Marker deleted successfully

╔════════════════════════════════════════════╗
║              TEST RESULTS                  ║
╚════════════════════════════════════════════╝

✅ Passed: 7/7
❌ Failed: 0/7

🎉 ALL TESTS PASSED! Markers system is working correctly.
```

---

## 📡 API Endpoints

### **Episode-Scoped Markers**

#### **GET** `/api/v1/episodes/:episodeId/markers`
List all markers for an episode

**Query Parameters:**
- `marker_type` - Filter by type (note, chapter, cue, script, deliverable)
- `category` - Filter by category
- `start_time` - Time range start (seconds)
- `end_time` - Time range end (seconds)
- `include` - Comma-separated: `scene` to include scene data

**Example:**
```javascript
GET /api/v1/episodes/abc123/markers?marker_type=chapter&include=scene
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "marker-uuid",
      "episode_id": "episode-uuid",
      "scene_id": "scene-uuid",
      "timecode": 45.50,
      "title": "Important Moment",
      "marker_type": "chapter",
      "category": "production",
      "color": "#10B981",
      "tags": ["test", "phase2"],
      "scene": {
        "id": "scene-uuid",
        "title": "Opening Scene"
      }
    }
  ],
  "count": 1
}
```

---

#### **POST** `/api/v1/episodes/:episodeId/markers`
Create new marker

**Body:**
```json
{
  "timecode": 45.5,                    // Required: seconds from episode start
  "title": "Chapter 1 Start",
  "marker_type": "chapter",            // note, chapter, cue, script, deliverable
  "category": "production",
  "color": "#10B981",                  // Hex color
  "description": "Opening chapter begins here",
  "tags": ["chapter", "important"],
  "scene_id": "scene-uuid" | null      // Optional: link to scene
}
```

---

### **Single Marker Operations**

#### **GET** `/api/v1/markers/:id`
Get single marker

**Query Parameters:**
- `include` - `episode`, `scene`

---

#### **PUT** `/api/v1/markers/:id`
Update marker

**Body:** (all fields optional)
```json
{
  "timecode": 50.0,
  "title": "Updated Title",
  "color": "#EF4444",
  "scene_id": "new-scene-uuid"
}
```

---

#### **DELETE** `/api/v1/markers/:id`
Delete marker

---

#### **POST** `/api/v1/markers/:id/auto-scene-link`
Automatically link marker to scene that contains its timecode

**Response:**
```json
{
  "success": true,
  "data": { "...": "updated marker" },
  "scene": { "...": "linked scene" },
  "message": "Marker linked to scene: Opening Scene"
}
```

---

## 🎨 Frontend Integration

### **Import Service:**
```javascript
import markerService from '@/services/markerService';
```

### **Create Marker:**
```javascript
const marker = await markerService.createMarker(episodeId, {
  timecode: 45.5,
  title: 'Chapter Start',
  marker_type: 'chapter',
  color: '#10B981',
});
```

### **Get Episode Markers:**
```javascript
const { data } = await markerService.getEpisodeMarkers(episodeId, {
  include: 'scene',
  marker_type: 'chapter',
});
```

### **Update Marker:**
```javascript
await markerService.updateMarker(markerId, {
  timecode: 50.0,
  title: 'Updated Chapter',
});
```

### **Auto-Link to Scene:**
```javascript
const result = await markerService.autoLinkScene(markerId);
console.log('Linked to:', result.scene.title);
```

---

## 🔧 Troubleshooting

### **Problem: Migration fails with "relation already exists"**
**Solution:** Table already created. Safe to ignore or drop first:
```sql
DROP TABLE IF EXISTS markers CASCADE;
```

---

### **Problem: Routes not working (404)**
**Check:**
1. Server logs show: `✅ Marker routes mounted (Phase 2)`
2. Restart server after adding routes
3. Test with: `curl http://localhost:3002/api/v1/episodes/{id}/markers`

---

###**Problem: Model not found error**
**Check:**
1. `src/models/index.js` includes `Marker = require('./Marker')(sequelize);`
2. Export includes `module.exports.Marker = Marker;`
3. Restart server

---

### **Problem: Scene relative timecode always null**
**Reason:** Marker is outside scene boundaries (valid state!)
**Fix:** Use auto-link endpoint or ensure marker timecode falls within scene duration

---

## 📊 Database Schema

```sql
CREATE TABLE markers (
  id UUID PRIMARY KEY,
  episode_id UUID REFERENCES episodes(id) ON DELETE CASCADE,
  scene_id UUID REFERENCES scenes(id) ON DELETE SET NULL,
  
  -- Timing
  timecode DECIMAL(10,2) NOT NULL,            -- Absolute episode time
  scene_relative_timecode DECIMAL(10,2),       -- Within scene (calculated)
  
  -- Metadata
  title VARCHAR(255),
  marker_type VARCHAR(50) DEFAULT 'note',
  category VARCHAR(50),
  tags TEXT[],
  color VARCHAR(7) DEFAULT '#3B82F6',
  description TEXT,
  
  -- Deliverables
  deliverable_id VARCHAR(100),
  fulfillment_checkpoint BOOLEAN DEFAULT FALSE,
  
  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(255),
  updated_by VARCHAR(255)
);
```

---

## ✅ Success Criteria

**Markers system is working if:**
1. ✅ Migration runs without errors
2. ✅ Server starts with marker routes log
3. ✅ Test suite passes 7/7 tests
4. ✅ Can create marker via API
5. ✅ Can list markers with scene data
6. ✅ Auto-link finds containing scene

---

## 🎯 Next Steps (Week 2-3)

With markers backend complete, proceed to:
- **Week 2:** Timeline View UI (ruler, playhead, tracks)
- **Week 3:** Marker drag-drop, scene blocks, video preview

---

## 📞 Support

**If tests fail:**
1. Check database connection
2. Verify episodes table has data
3. Check server logs for errors
4. Run `node test-markers-api.js` with verbose output

**Expected Success Rate:** 75-80% on first run (see Success Assessment)

---

**✅ Phase 2 Week 1 Complete!** 🎉
