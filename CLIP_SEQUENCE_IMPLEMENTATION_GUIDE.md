# Episode Clip Sequence Manager - Complete Implementation Guide

**Project**: Episode Canonical Control Record  
**Feature**: CapCut-Style Clip Sequence Manager  
**Timeline**: 3-4 days  
**Complexity**: Medium  
**Risk Level**: Low (additive changes, easy rollback)

---

## 📺 Quick Start

This guide will walk you through implementing a professional clip sequence manager for episodes, similar to CapCut's interface. The feature allows users to:
- Add video clips from Scene Library to episodes
- Drag-and-drop reorder clips
- Edit trim points for each clip
- Add notes/placeholders in the sequence
- Preview clips with episode-specific trims
- View real-time duration statistics

**Before you start**: Read this entire document once, then follow step-by-step.

---

## 🎯 Executive Summary

### What We're Building

The **Scenes tab** in `EpisodeDetail.jsx` currently shows a basic list of clips with manual up/down reordering. We're replacing it with a modern, production-grade clip sequence manager that:

1. **Looks professional**: Clean CapCut-inspired UI with drag handles, thumbnails, and status indicators
2. **Works smoothly**: Drag-and-drop reordering with instant feedback
3. **Handles edge cases**: Missing clips, processing clips, notes, empty states
4. **Performs well**: Optimized for 50+ clips, polling status updates
5. **Mobile-friendly**: Responsive design for desktop, tablet, and mobile

### Why This Matters

Current problems:
- Up/down buttons are tedious for reordering many clips
- No way to see what's "ready" vs "processing"
- No preview panel to verify clips
- Can't add notes/placeholders in sequence
- Stats are missing (total duration, ready duration)

This implementation solves all these issues and sets up for future features (advanced timeline editor).

### Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Data Model | Extend `EpisodeScene` | Less migration complexity, reuse existing infrastructure |
| clipStatus | Backend virtual field | Clean API, consistent logic |
| Drag-and-Drop | `react-beautiful-dnd` | Industry standard, good mobile support |
| Notes Support | `type: 'clip' \| 'note'` | Flexible, allows placeholders |
| Reorder API | Batch endpoint | Better performance, atomic updates |
| Preview Panel | Collapsible sticky | Clean UX, desktop-first |
| Status Polling | 5s interval | Balance between freshness and server load |

---

## 📋 Requirements & Decisions Log

### Confirmed Requirements

**Duration Logic**:
- **Ready Duration**: Sum of `(trimEnd - trimStart)` where `processingStatus === 'ready'`
- **Planned Duration**: Sum of ready + processing + missing (with manual duration)

**Data Model**:
- Extend existing `EpisodeScene` model (NOT creating new table)
- Add fields: `type`, `manual_duration_seconds`, `title_override`, `note_text`, `added_by`, `last_edited_at`
- Make `scene_library_id` nullable (for notes)

**Note Defaults**:
- Title: "Scene Note"
- Duration: 0 seconds
- Visual distinction: 📝 icon + amber color

**Missing Clip Behavior**:
- Show warning indicator
- Allow title override
- Allow manual duration input
- Don't block workflow

**Replace Clip**:
- Opens library picker
- Updates `scene_library_id` in place
- Resets trim points

**Timeline Editor**:
- Route: `/episodes/:id/timeline`
- Initially: Placeholder page with "Coming Soon"
- Future: Advanced Premiere-style editor

**Upload Flow in Picker**:
- Upload → Auto-add to sequence → Close picker → Show toast

**Preview Panel**:
- Click clip to select
- Shows in sticky panel on right
- Click play to start (not autoplay)
- Audio enabled
- Collapsible via button

**Platform Support**:
- Desktop (primary)
- Tablet (full support)
- Mobile (responsive, touch-friendly)

**Bulk Actions**:
- Multi-select with checkboxes
- Bulk delete only (for MVP)

**Tracking**:
- `last_edited_at` timestamp per item
- `added_by` user identifier
- Usage count shown on homepage and episode overview

---

## 🏗️ Technical Architecture

### Backend Changes

#### 1. Database Schema (Migration)

**File**: `src/migrations/[timestamp]-extend-episode-scene-for-sequence.js`

**Changes**:
- Add `type` ENUM('clip', 'note')
- Add `manual_duration_seconds` DECIMAL(10,3)
- Add `title_override` VARCHAR(255)
- Add `note_text` TEXT
- Add `added_by` VARCHAR(255)
- Add `last_edited_at` TIMESTAMP
- Make `scene_library_id` nullable

#### 2. Model Updates

**File**: `src/models/EpisodeScene.js`

**New Fields**:
- All migration fields above
- **Virtual Fields**:
  - `clipStatus`: Returns 'note', 'missing', or libraryScene.processingStatus
  - `displayTitle`: Returns title_override || 'Scene Note' || libraryScene.title
  - `effectiveDuration`: Returns manual_duration_seconds or (trimEnd - trimStart)

#### 3. New Endpoints

**File**: `src/routes/episodes.js` + `src/controllers/episodeController.js`

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| PUT | `/api/v1/episodes/:id/sequence-items/reorder` | Batch reorder all items | Yes |
| POST | `/api/v1/episodes/:id/sequence-items/note` | Create note item | Yes |
| GET | `/api/v1/episodes/:id/library-scenes` | List with stats (modified) | Yes |

#### 4. Stats Calculation

**In**: `episodeController.listEpisodeScenes`

**Returns**:
```javascript
{
  success: true,
  data: [...items],
  stats: {
    totalClips: 5,
    totalDuration: 300,      // All items
    readyDuration: 180,      // Only ready clips
    plannedDuration: 300,    // Same as total for MVP
    processingCount: 2
  }
}
```

### Frontend Changes

#### 1. New Components

**Directory**: `frontend/src/components/Episodes/`

| File | Purpose | Lines | Complexity |
|------|---------|-------|------------|
| `ClipSequenceManager.jsx` | Main container, drag-drop logic | ~250 | Medium |
| `ClipSequenceItem.jsx` | Individual clip card | ~180 | Low |
| `ClipPreviewPanel.jsx` | Preview sidebar | ~120 | Low |
| `*.css` | Styling for above | ~400 | Low |

#### 2. New Pages

**File**: `frontend/src/pages/TimelineEditor.jsx`

**Purpose**: Placeholder for future advanced editor

#### 3. Integration Points

**File**: `frontend/src/pages/EpisodeDetail.jsx`

**Change**: Replace Scenes tab content with `<ClipSequenceManager />`

**File**: `frontend/src/App.jsx`

**Change**: Add route `/episodes/:episodeId/timeline`

#### 4. Dependencies

**New**: `react-beautiful-dnd@^13.1.1`

---

## 📝 Step-by-Step Implementation

### Phase 1: Backend Foundation (Day 1 - 4 hours)

#### Step 1.1: Create Migration (30 min)

**Create file**: `src/migrations/[timestamp]-extend-episode-scene-for-sequence.js`

**Copy this code**:

```javascript
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add type enum
    await queryInterface.addColumn('episode_scenes', 'type', {
      type: Sequelize.ENUM('clip', 'note'),
      allowNull: false,
      defaultValue: 'clip'
    });

    // Add manual duration for notes/missing clips
    await queryInterface.addColumn('episode_scenes', 'manual_duration_seconds', {
      type: Sequelize.DECIMAL(10, 3),
      allowNull: true,
      comment: 'Manual duration for notes or missing clips'
    });

    // Add title override
    await queryInterface.addColumn('episode_scenes', 'title_override', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Override title for missing clips or notes'
    });

    // Add note text
    await queryInterface.addColumn('episode_scenes', 'note_text', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Note content for type=note items'
    });

    // Add tracking fields
    await queryInterface.addColumn('episode_scenes', 'added_by', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'User who added this item'
    });

    await queryInterface.addColumn('episode_scenes', 'last_edited_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Last edit timestamp'
    });

    // Make scene_library_id nullable (for notes)
    await queryInterface.changeColumn('episode_scenes', 'scene_library_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'scene_library',
        key: 'id'
      }
    });

    console.log('✓ Migration: Extended episode_scenes for sequence management');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('episode_scenes', 'type');
    await queryInterface.removeColumn('episode_scenes', 'manual_duration_seconds');
    await queryInterface.removeColumn('episode_scenes', 'title_override');
    await queryInterface.removeColumn('episode_scenes', 'note_text');
    await queryInterface.removeColumn('episode_scenes', 'added_by');
    await queryInterface.removeColumn('episode_scenes', 'last_edited_at');
    
    // Revert scene_library_id to NOT NULL
    await queryInterface.changeColumn('episode_scenes', 'scene_library_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'scene_library',
        key: 'id'
      }
    });
  }
};
```

**Run migration**:
```bash
cd C:\Users\12483\Projects\Episode-Canonical-Control-Record-1
npm run migrate
```

**Expected output**:
```
✓ Migration: Extended episode_scenes for sequence management
Migration completed
```

**Test**:
```sql
-- In your database client
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'episode_scenes';

-- Should see: type, manual_duration_seconds, title_override, note_text, added_by, last_edited_at
```

**Rollback if needed**:
```bash
npm run migrate:undo
```

---

#### Step 1.2: Update EpisodeScene Model (45 min)

**File**: `src/models/EpisodeScene.js`

**Find this section** (around line 100):
```javascript
      episodeNotes: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('episode_notes');
        },
        set(value) {
          this.setDataValue('episode_notes', value);
        },
      },
```

**Add AFTER it**:

```javascript
      // New fields for sequence management
      type: {
        type: DataTypes.ENUM('clip', 'note'),
        allowNull: false,
        defaultValue: 'clip',
        field: 'type',
        comment: 'Type of sequence item'
      },
      
      manual_duration_seconds: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: true,
        field: 'manual_duration_seconds',
        comment: 'Manual duration for notes or missing clips'
      },
      manualDurationSeconds: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('manual_duration_seconds');
        },
        set(value) {
          this.setDataValue('manual_duration_seconds', value);
        },
      },
      
      title_override: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'title_override',
        comment: 'Override title for missing clips or notes'
      },
      titleOverride: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('title_override');
        },
        set(value) {
          this.setDataValue('title_override', value);
        },
      },
      
      note_text: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'note_text',
        comment: 'Note content for type=note items'
      },
      noteText: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('note_text');
        },
        set(value) {
          this.setDataValue('note_text', value);
        },
      },
      
      added_by: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'added_by',
        comment: 'User who added this item'
      },
      addedBy: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('added_by');
        },
        set(value) {
          this.setDataValue('added_by', value);
        },
      },
      
      last_edited_at: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_edited_at',
        comment: 'Last edit timestamp'
      },
      lastEditedAt: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('last_edited_at');
        },
        set(value) {
          this.setDataValue('last_edited_at', value);
        },
      },
      
      // Computed virtual fields
      clipStatus: {
        type: DataTypes.VIRTUAL,
        get() {
          if (this.type === 'note') return 'note';
          if (!this.libraryScene) return 'missing';
          return this.libraryScene.processing_status || this.libraryScene.processingStatus || 'ready';
        }
      },
      
      displayTitle: {
        type: DataTypes.VIRTUAL,
        get() {
          if (this.title_override) return this.title_override;
          if (this.type === 'note') return 'Scene Note';
          return this.libraryScene?.title || 'Untitled Clip';
        }
      },
      
      effectiveDuration: {
        type: DataTypes.VIRTUAL,
        get() {
          // For notes or missing clips, use manual duration
          if (this.type === 'note' || !this.libraryScene) {
            return parseFloat(this.manual_duration_seconds) || 0;
          }
          // For clips, calculate from trim points
          const start = parseFloat(this.trim_start) || 0;
          const end = parseFloat(this.trim_end) || 0;
          return Math.max(0, end - start);
        }
      },
```

**Also update** the `toJSON` method at the bottom:

**Find**:
```javascript
  EpisodeScene.prototype.toJSON = function () {
    return {
      id: this.id,
      episodeId: this.episode_id,
      // ... existing fields
    };
  };
```

**Add these fields** to the return object:
```javascript
      type: this.type,
      manualDurationSeconds: this.manual_duration_seconds,
      titleOverride: this.title_override,
      noteText: this.note_text,
      addedBy: this.added_by,
      lastEditedAt: this.last_edited_at,
      clipStatus: this.clipStatus,
      displayTitle: this.displayTitle,
      effectiveDuration: this.effectiveDuration,
```

---

#### Step 1.3: Add Batch Reorder Endpoint (30 min)

**File**: `src/routes/episodes.js`

**Find the section** with episode scene routes (around line 202):
```javascript
/**
 * Episode Scene Library Management
 */
```

**Add AFTER the existing library-scenes routes**:

```javascript
// PUT /api/v1/episodes/:id/sequence-items/reorder - Batch reorder
router.put(
  '/:id/sequence-items/reorder',
  authMiddleware,
  asyncHandler(episodeController.reorderSequenceItems)
);
```

**File**: `src/controllers/episodeController.js`

**Add this function** (can go at the end, before module.exports):

```javascript
/**
 * Batch reorder sequence items
 * PUT /api/v1/episodes/:id/sequence-items/reorder
 */
exports.reorderSequenceItems = async (req, res) => {
  const { id: episodeId } = req.params;
  const { itemIds } = req.body;

  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'itemIds array is required'
    });
  }

  const transaction = await sequelize.transaction();

  try {
    // Update scene_order for each item atomically
    const updatePromises = itemIds.map((itemId, index) =>
      EpisodeScene.update(
        { 
          scene_order: index + 1,
          last_edited_at: new Date()
        },
        { 
          where: { 
            id: itemId, 
            episode_id: episodeId 
          },
          transaction 
        }
      )
    );

    await Promise.all(updatePromises);
    await transaction.commit();

    // Fetch updated items with stats
    const items = await EpisodeScene.findAll({
      where: { episode_id: episodeId },
      include: [{
        model: SceneLibrary,
        as: 'libraryScene',
        required: false
      }],
      order: [['scene_order', 'ASC']]
    });

    // Calculate stats
    let totalClips = 0;
    let totalDuration = 0;
    let readyDuration = 0;
    let processingCount = 0;

    items.forEach(item => {
      if (item.type === 'clip') totalClips++;
      
      const duration = item.effectiveDuration || 0;
      totalDuration += duration;

      const status = item.clipStatus;
      if (status === 'ready') {
        readyDuration += duration;
      } else if (status === 'processing' || status === 'uploading') {
        processingCount++;
      }
    });

    res.json({
      success: true,
      data: items,
      stats: {
        totalClips,
        totalDuration,
        readyDuration,
        plannedDuration: totalDuration,
        processingCount
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Reorder error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reorder items',
      error: error.message
    });
  }
};
```

---

#### Step 1.4: Add Create Note Endpoint (20 min)

**File**: `src/routes/episodes.js`

**Add AFTER the reorder route**:

```javascript
// POST /api/v1/episodes/:id/sequence-items/note - Create note
router.post(
  '/:id/sequence-items/note',
  authMiddleware,
  asyncHandler(episodeController.addNoteToEpisode)
);
```

**File**: `src/controllers/episodeController.js`

**Add this function**:

```javascript
/**
 * Add note to episode sequence
 * POST /api/v1/episodes/:id/sequence-items/note
 */
exports.addNoteToEpisode = async (req, res) => {
  const { id: episodeId } = req.params;
  const { title, noteText, manualDurationSeconds } = req.body;
  const userId = req.user?.username || req.user?.email || 'system';

  try {
    // Get max scene_order
    const maxOrder = await EpisodeScene.max('scene_order', {
      where: { episode_id: episodeId }
    }) || 0;

    // Create note item
    const noteItem = await EpisodeScene.create({
      episode_id: episodeId,
      type: 'note',
      scene_order: maxOrder + 1,
      title_override: title || 'Scene Note',
      note_text: noteText || '',
      manual_duration_seconds: manualDurationSeconds || 0,
      added_by: userId,
      scene_library_id: null // Notes don't reference library
    });

    res.status(201).json({
      success: true,
      data: noteItem
    });
  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create note',
      error: error.message
    });
  }
};
```

---

#### Step 1.5: Update List Endpoint with Stats (30 min)

**File**: `src/controllers/episodeController.js`

**Find**: `exports.listEpisodeScenes`

**Replace the entire function with**:

```javascript
/**
 * List episode scenes with stats
 * GET /api/v1/episodes/:id/library-scenes
 */
exports.listEpisodeScenes = async (req, res) => {
  const { id: episodeId } = req.params;

  try {
    const items = await EpisodeScene.findAll({
      where: { episode_id: episodeId },
      include: [{
        model: SceneLibrary,
        as: 'libraryScene',
        required: false // Allow notes with no library scene
      }],
      order: [['scene_order', 'ASC']]
    });

    // Calculate stats
    let totalClips = 0;
    let totalDuration = 0;
    let readyDuration = 0;
    let processingCount = 0;

    items.forEach(item => {
      if (item.type === 'clip') totalClips++;
      
      const duration = item.effectiveDuration || 0;
      totalDuration += duration;

      const status = item.clipStatus;
      if (status === 'ready') {
        readyDuration += duration;
      } else if (status === 'processing' || status === 'uploading') {
        processingCount++;
      }
    });

    res.json({
      success: true,
      data: items,
      stats: {
        totalClips,
        totalDuration: Math.round(totalDuration * 10) / 10, // Round to 1 decimal
        readyDuration: Math.round(readyDuration * 10) / 10,
        plannedDuration: Math.round(totalDuration * 10) / 10,
        processingCount
      }
    });
  } catch (error) {
    console.error('List episode scenes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch episode scenes',
      error: error.message
    });
  }
};
```

---

#### Step 1.6: Test Backend (30 min)

**Start server**:
```bash
node src/server.js
```

**Test with curl** (replace episode ID with yours):
```bash
# Test list with stats
curl.exe -s "http://localhost:3002/api/v1/episodes/51299ab6-1f9a-41af-951e-cd76cd9272a6/library-scenes"

# Expected response:
{
  "success": true,
  "data": [...],
  "stats": {
    "totalClips": 2,
    "totalDuration": 45.5,
    "readyDuration": 45.5,
    "plannedDuration": 45.5,
    "processingCount": 0
  }
}

# Test create note
curl.exe -X POST "http://localhost:3002/api/v1/episodes/51299ab6-1f9a-41af-951e-cd76cd9272a6/sequence-items/note" `
  -H "Content-Type: application/json" `
  -d "{\"title\":\"Test Note\",\"noteText\":\"This is a test\",\"manualDurationSeconds\":5}"

# Test reorder
curl.exe -X PUT "http://localhost:3002/api/v1/episodes/51299ab6-1f9a-41af-951e-cd76cd9272a6/sequence-items/reorder" `
  -H "Content-Type: application/json" `
  -d "{\"itemIds\":[\"id1\",\"id2\",\"id3\"]}"
```

**✅ Backend Complete Checklist**:
- [ ] Migration runs successfully
- [ ] New columns exist in database
- [ ] Virtual fields work (clipStatus, displayTitle, effectiveDuration)
- [ ] List endpoint returns stats
- [ ] Create note endpoint works
- [ ] Reorder endpoint works
- [ ] No errors in server console

---

### Phase 2: Frontend Components (Day 2 - 6 hours)

#### Step 2.1: Install Dependencies (5 min)

```bash
cd frontend
npm install react-beautiful-dnd@13.1.1
```

---

#### Step 2.2: Create ClipSequenceManager Component (90 min)

**Create file**: `frontend/src/components/Episodes/ClipSequenceManager.jsx`

**Paste this complete code**:

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import ClipSequenceItem from './ClipSequenceItem';
import ClipPreviewPanel from './ClipPreviewPanel';
import SceneLibraryPicker from '../SceneLibraryPicker';
import './ClipSequenceManager.css';

const ClipSequenceManager = ({ episodeId, episode }) => {
  const navigate = useNavigate();
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedClipId, setSelectedClipId] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [stats, setStats] = useState({ totalClips: 0, totalDuration: 0, readyDuration: 0, processingCount: 0 });

  // Load clips
  const loadClips = useCallback(async () => {
    if (!episodeId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/v1/episodes/${episodeId}/library-scenes`);
      
      if (!response.ok) {
        throw new Error('Failed to load clips');
      }
      
      const data = await response.json();
      const clipData = data.data || [];
      setClips(clipData);
      setStats(data.stats || { totalClips: 0, totalDuration: 0, readyDuration: 0, processingCount: 0 });
    } catch (err) {
      console.error('Failed to load clips:', err);
      setError(err.message || 'Failed to load clips');
    } finally {
      setLoading(false);
    }
  }, [episodeId]);

  useEffect(() => {
    loadClips();
    
    // Poll for status updates every 5 seconds
    const interval = setInterval(loadClips, 5000);
    return () => clearInterval(interval);
  }, [loadClips]);

  // Handle drag end
  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    
    const { source, destination } = result;
    if (source.index === destination.index) return;
    
    // Reorder locally (optimistic update)
    const newClips = Array.from(clips);
    const [moved] = newClips.splice(source.index, 1);
    newClips.splice(destination.index, 0, moved);
    setClips(newClips);
    
    // Persist to backend
    try {
      const itemIds = newClips.map(clip => clip.id);
      
      const response = await fetch(`/api/v1/episodes/${episodeId}/sequence-items/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds })
      });
      
      if (!response.ok) throw new Error('Failed to reorder');
      
      const data = await response.json();
      setClips(data.data || newClips);
      setStats(data.stats || stats);
    } catch (err) {
      console.error('Failed to reorder clips:', err);
      setError('Failed to save new order');
      // Reload to revert
      loadClips();
    }
  };

  // Add clip from library
  const handleAddClip = async (libraryScene) => {
    try {
      const response = await fetch(`/api/v1/episodes/${episodeId}/library-scenes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneLibraryId: libraryScene.id,
          trimStart: 0,
          trimEnd: libraryScene.durationSeconds || libraryScene.duration_seconds || 0,
          sceneOrder: clips.length + 1
        })
      });
      
      if (!response.ok) throw new Error('Failed to add clip');
      
      await loadClips();
      setShowPicker(false);
    } catch (err) {
      console.error('Failed to add clip:', err);
      alert('Failed to add clip. Please try again.');
    }
  };

  // Remove clip
  const handleRemoveClip = async (clipId) => {
    if (!confirm('Remove this clip from the episode sequence?')) return;
    
    try {
      const response = await fetch(`/api/v1/episodes/${episodeId}/library-scenes/${clipId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Failed to remove clip');
      
      await loadClips();
      
      if (selectedClipId === clipId) {
        setSelectedClipId(null);
      }
    } catch (err) {
      console.error('Failed to remove clip:', err);
      alert('Failed to remove clip. Please try again.');
    }
  };

  // Update trim
  const handleUpdateTrim = async (clipId, trimStart, trimEnd) => {
    try {
      const response = await fetch(`/api/v1/episodes/${episodeId}/library-scenes/${clipId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trimStart, trimEnd })
      });
      
      if (!response.ok) throw new Error('Failed to update trim');
      
      await loadClips();
    } catch (err) {
      console.error('Failed to update trim:', err);
      throw err;
    }
  };

  // Add note
  const handleAddNote = async () => {
    try {
      const response = await fetch(`/api/v1/episodes/${episodeId}/sequence-items/note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Scene Note',
          noteText: '',
          manualDurationSeconds: 0
        })
      });
      
      if (!response.ok) throw new Error('Failed to create note');
      
      await loadClips();
    } catch (err) {
      console.error('Failed to create note:', err);
      alert('Failed to create note. Please try again.');
    }
  };

  // Format duration helper
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const selectedClip = selectedClipId ? clips.find(c => c.id === selectedClipId) : null;

  return (
    <div className="clip-sequence-manager">
      {/* Header with stats */}
      <div className="csm-header">
        <div className="csm-stats">
          <div className="stat-item">
            <span className="stat-label">Clips</span>
            <span className="stat-value">{stats.totalClips}</span>
          </div>
          <div className="stat-divider">·</div>
          <div className="stat-item">
            <span className="stat-label">Total Duration</span>
            <span className="stat-value">{formatDuration(stats.totalDuration)}</span>
          </div>
          <div className="stat-divider">·</div>
          <div className="stat-item">
            <span className="stat-label">Ready</span>
            <span className="stat-value status-ready">{formatDuration(stats.readyDuration)}</span>
          </div>
          {stats.processingCount > 0 && (
            <>
              <div className="stat-divider">·</div>
              <div className="stat-item">
                <span className="stat-label">Processing</span>
                <span className="stat-value status-processing">{stats.processingCount}</span>
              </div>
            </>
          )}
        </div>
        
        <div className="csm-actions">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="btn-toggle-preview"
            title={showPreview ? 'Hide preview' : 'Show preview'}
          >
            {showPreview ? '🎬 Hide Preview' : '🎬 Show Preview'}
          </button>
          <button
            onClick={() => navigate(`/episodes/${episodeId}/timeline`)}
            className="btn-timeline"
          >
            ✨ Open Timeline Editor
          </button>
          <button
            onClick={handleAddNote}
            className="btn-add-note"
            title="Add note/placeholder"
          >
            📝 Add Note
          </button>
          <button
            onClick={() => setShowPicker(true)}
            className="btn-add-clip"
          >
            ➕ Add Clip
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className={`csm-content ${showPreview ? 'with-preview' : ''}`}>
        {/* Clip sequence list */}
        <div className="csm-sequence">
          {loading && clips.length === 0 && (
            <div className="csm-loading">
              <div className="spinner"></div>
              <p>Loading clips...</p>
            </div>
          )}
          
          {error && (
            <div className="csm-error">
              <span className="error-icon">⚠️</span>
              <p>{error}</p>
              <button onClick={loadClips} className="btn-retry">Retry</button>
            </div>
          )}
          
          {!loading && !error && clips.length === 0 && (
            <div className="csm-empty">
              <div className="empty-icon">🎬</div>
              <h3>No Clips Yet</h3>
              <p>Start building your episode by adding video clips from your Scene Library</p>
              <button
                onClick={() => setShowPicker(true)}
                className="btn-add-clip-large"
              >
                ➕ Add First Clip
              </button>
            </div>
          )}
          
          {clips.length > 0 && (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="clip-sequence">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`clip-list ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                  >
                    {clips.map((clip, index) => (
                      <Draggable key={clip.id} draggableId={clip.id} index={index}>
                        {(provided, snapshot) => (
                          <ClipSequenceItem
                            clip={clip}
                            index={index}
                            isSelected={selectedClipId === clip.id}
                            isDragging={snapshot.isDragging}
                            onSelect={() => setSelectedClipId(clip.id)}
                            onRemove={() => handleRemoveClip(clip.id)}
                            onUpdateTrim={handleUpdateTrim}
                            dragHandleProps={provided.dragHandleProps}
                            innerRef={provided.innerRef}
                            draggableProps={provided.draggableProps}
                          />
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </div>
        
        {/* Preview panel */}
        {showPreview && selectedClip && (
          <ClipPreviewPanel
            clip={selectedClip}
            onClose={() => setSelectedClipId(null)}
            onUpdateTrim={handleUpdateTrim}
          />
        )}
      </div>
      
      {/* Scene library picker modal */}
      {showPicker && (
        <SceneLibraryPicker
          isOpen={showPicker}
          onClose={() => setShowPicker(false)}
          onSelect={handleAddClip}
          showId={episode?.showId || episode?.show_id}
        />
      )}
    </div>
  );
};

export default ClipSequenceManager;
```

---

#### Step 2.3: Create ClipSequenceItem Component (60 min)

**Create file**: `frontend/src/components/Episodes/ClipSequenceItem.jsx`

**Paste this complete code**:

```jsx
import React, { useState } from 'react';
import './ClipSequenceItem.css';

const ClipSequenceItem = ({
  clip,
  index,
  isSelected,
  isDragging,
  onSelect,
  onRemove,
  onUpdateTrim,
  dragHandleProps,
  innerRef,
  draggableProps
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [trimStart, setTrimStart] = useState(clip.trimStart || clip.trim_start || 0);
  const [trimEnd, setTrimEnd] = useState(clip.trimEnd || clip.trim_end || 0);
  const [saving, setSaving] = useState(false);

  const libraryScene = clip.libraryScene || clip.library_scene;
  const isNote = clip.type === 'note';
  const clipStatus = clip.clipStatus || 'ready';
  const processingStatus = libraryScene?.processingStatus || libraryScene?.processing_status;
  const thumbnailUrl = libraryScene?.thumbnailUrl || libraryScene?.thumbnail_url;
  const title = clip.displayTitle || clip.title_override || libraryScene?.title || 'Untitled Clip';
  const duration = trimEnd - trimStart;
  const isMissing = clipStatus === 'missing';

  const handleSaveTrim = async () => {
    setSaving(true);
    try {
      await onUpdateTrim(clip.id, trimStart, trimEnd);
      setIsEditing(false);
    } catch (err) {
      alert('Failed to save trim changes');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setTrimStart(clip.trimStart || clip.trim_start || 0);
    setTrimEnd(clip.trimEnd || clip.trim_end || 0);
    setIsEditing(false);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={innerRef}
      {...draggableProps}
      className={`clip-sequence-item ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${isMissing ? 'missing' : ''} ${isNote ? 'note' : ''}`}
      onClick={onSelect}
    >
      {/* Drag handle */}
      <div className="clip-drag-handle" {...dragHandleProps}>
        <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
          <circle cx="3" cy="3" r="1.5"/>
          <circle cx="9" cy="3" r="1.5"/>
          <circle cx="3" cy="8" r="1.5"/>
          <circle cx="9" cy="8" r="1.5"/>
          <circle cx="3" cy="13" r="1.5"/>
          <circle cx="9" cy="13" r="1.5"/>
        </svg>
      </div>

      {/* Order number */}
      <div className="clip-order">#{index + 1}</div>

      {/* Thumbnail */}
      <div className="clip-thumbnail">
        {thumbnailUrl && !isMissing && !isNote ? (
          <img src={thumbnailUrl} alt={title} />
        ) : (
          <div className="thumbnail-placeholder">
            {isNote ? '📝' : isMissing ? '❌' : '🎥'}
          </div>
        )}
        {processingStatus && processingStatus !== 'ready' && (
          <div className={`processing-badge ${processingStatus}`}>
            {processingStatus === 'processing' && '⏳'}
            {processingStatus === 'uploading' && '⬆️'}
            {processingStatus === 'failed' && '⚠️'}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="clip-info">
        <div className="clip-title">{isMissing ? '⚠️ Missing Clip' : title}</div>
        <div className="clip-meta">
          <span className="clip-duration">{formatTime(duration)}</span>
          {!isMissing && !isNote && libraryScene?.resolutionWidth && (
            <>
              <span className="meta-dot">·</span>
              <span className="clip-resolution">
                {libraryScene.resolutionWidth}×{libraryScene.resolutionHeight || libraryScene.resolution_height}
              </span>
            </>
          )}
          {isEditing && (
            <>
              <span className="meta-dot">·</span>
              <span className="editing-badge">✏️ Editing trim</span>
            </>
          )}
        </div>
      </div>

      {/* Trim controls */}
      {!isMissing && !isNote && (
        <div className="clip-trim" onClick={(e) => e.stopPropagation()}>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="btn-edit-trim"
              title="Edit trim"
            >
              ✂️ Trim
            </button>
          ) : (
            <div className="trim-inputs">
              <input
                type="number"
                value={trimStart}
                onChange={(e) => setTrimStart(parseFloat(e.target.value) || 0)}
                min="0"
                step="0.1"
                placeholder="Start"
              />
              <span className="trim-separator">→</span>
              <input
                type="number"
                value={trimEnd}
                onChange={(e) => setTrimEnd(parseFloat(e.target.value) || 0)}
                min="0"
                step="0.1"
                placeholder="End"
              />
              <button
                onClick={handleSaveTrim}
                disabled={saving}
                className="btn-save-trim"
                title="Save"
              >
                ✓
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={saving}
                className="btn-cancel-trim"
                title="Cancel"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="clip-actions" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onRemove}
          className="btn-remove-clip"
          title="Remove from sequence"
        >
          🗑️
        </button>
      </div>

      {/* Status indicator */}
      <div className="clip-status">
        {clipStatus === 'ready' && <span className="status-dot ready" title="Ready"></span>}
        {clipStatus === 'processing' && <span className="status-dot processing" title="Processing"></span>}
        {clipStatus === 'failed' && <span className="status-dot failed" title="Failed"></span>}
        {isMissing && <span className="status-dot missing" title="Missing"></span>}
        {isNote && <span className="status-dot note" title="Note"></span>}
      </div>
    </div>
  );
};

export default ClipSequenceItem;
```

---

#### Step 2.4: Create ClipPreviewPanel Component (45 min)

**Create file**: `frontend/src/components/Episodes/ClipPreviewPanel.jsx`

**Paste this complete code**:

```jsx
import React, { useState } from 'react';
import VideoPlayer from '../VideoPlayer';
import './ClipPreviewPanel.css';

const ClipPreviewPanel = ({ clip, onClose, onUpdateTrim }) => {
  const libraryScene = clip.libraryScene || clip.library_scene;
  const isNote = clip.type === 'note';
  const videoUrl = libraryScene?.videoAssetUrl || libraryScene?.video_asset_url;
  const thumbnailUrl = libraryScene?.thumbnailUrl || libraryScene?.thumbnail_url;
  const title = clip.displayTitle || libraryScene?.title || 'Untitled Clip';
  const description = libraryScene?.description;
  
  const [trimStart, setTrimStart] = useState(clip.trimStart || clip.trim_start || 0);
  const [trimEnd, setTrimEnd] = useState(clip.trimEnd || clip.trim_end || 0);
  const [isEditingTrim, setIsEditingTrim] = useState(false);
  const [saving, setSaving] = useState(false);

  const duration = trimEnd - trimStart;

  const handleSaveTrim = async () => {
    setSaving(true);
    try {
      await onUpdateTrim(clip.id, trimStart, trimEnd);
      setIsEditingTrim(false);
    } catch (err) {
      alert('Failed to save trim changes');
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
  };

  if (isNote) {
    return (
      <div className="clip-preview-panel">
        <div className="cpp-header">
          <h3>📝 Note</h3>
          <button onClick={onClose} className="btn-close" title="Close preview">
            ✕
          </button>
        </div>
        <div className="cpp-content">
          <div className="cpp-note">
            <h4>{title}</h4>
            {clip.noteText && <p className="note-text">{clip.noteText}</p>}
            <div className="note-duration">
              Duration: {formatTime(clip.manualDurationSeconds || clip.manual_duration_seconds || 0)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="clip-preview-panel">
      <div className="cpp-header">
        <h3>🎬 Preview</h3>
        <button onClick={onClose} className="btn-close" title="Close preview">
          ✕
        </button>
      </div>

      <div className="cpp-content">
        {/* Video player */}
        {videoUrl && (
          <div className="cpp-player">
            <VideoPlayer
              videoUrl={videoUrl}
              thumbnailUrl={thumbnailUrl}
              trimStart={trimStart}
              trimEnd={trimEnd}
              showTrimControls={false}
              autoPlay={false}
            />
          </div>
        )}

        {/* Clip details */}
        <div className="cpp-details">
          <h4>{title}</h4>
          {description && <p className="clip-description">{description}</p>}
          
          <div className="detail-grid">
            <div className="detail-item">
              <span className="label">Duration</span>
              <span className="value">{formatTime(duration)}</span>
            </div>
            <div className="detail-item">
              <span className="label">Resolution</span>
              <span className="value">
                {libraryScene?.resolutionWidth || libraryScene?.resolution_width}×{libraryScene?.resolutionHeight || libraryScene?.resolution_height}
              </span>
            </div>
            <div className="detail-item">
              <span className="label">Status</span>
              <span className="value">
                <span className={`badge status-${libraryScene?.processingStatus || libraryScene?.processing_status}`}>
                  {libraryScene?.processingStatus || libraryScene?.processing_status}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Trim controls */}
        <div className="cpp-trim">
          <div className="trim-header">
            <h4>✂️ Trim Settings</h4>
            {!isEditingTrim && (
              <button
                onClick={() => setIsEditingTrim(true)}
                className="btn-edit"
              >
                Edit
              </button>
            )}
          </div>
          
          {!isEditingTrim ? (
            <div className="trim-display">
              <div className="trim-range">
                <span className="trim-label">Start:</span>
                <span className="trim-value">{formatTime(trimStart)}</span>
              </div>
              <div className="trim-range">
                <span className="trim-label">End:</span>
                <span className="trim-value">{formatTime(trimEnd)}</span>
              </div>
            </div>
          ) : (
            <div className="trim-edit">
              <div className="trim-input-group">
                <label>Start Time (seconds)</label>
                <input
                  type="number"
                  value={trimStart}
                  onChange={(e) => setTrimStart(parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.1"
                />
              </div>
              <div className="trim-input-group">
                <label>End Time (seconds)</label>
                <input
                  type="number"
                  value={trimEnd}
                  onChange={(e) => setTrimEnd(parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.1"
                />
              </div>
              <div className="trim-actions">
                <button
                  onClick={handleSaveTrim}
                  disabled={saving}
                  className="btn-save"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => {
                    setTrimStart(clip.trimStart || clip.trim_start || 0);
                    setTrimEnd(clip.trimEnd || clip.trim_end || 0);
                    setIsEditingTrim(false);
                  }}
                  disabled={saving}
                  className="btn-cancel"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClipPreviewPanel;
```

---

#### Step 2.5: Create CSS Files (60 min)

**Create file**: `frontend/src/components/Episodes/ClipSequenceManager.css`

```css
.clip-sequence-manager {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  background: #f9fafb;
  min-height: 70vh;
}

/* Header */
.csm-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  background: white;
  padding: 1rem 1.5rem;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.csm-stats {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stat-label {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1f2937;
}

.stat-value.status-ready {
  color: #10b981;
}

.stat-value.status-processing {
  color: #3b82f6;
}

.stat-divider {
  color: #d1d5db;
  font-size: 1.5rem;
}

.csm-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.btn-toggle-preview,
.btn-timeline,
.btn-add-note,
.btn-add-clip {
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}

.btn-toggle-preview {
  background: #f3f4f6;
  color: #374151;
}

.btn-toggle-preview:hover {
  background: #e5e7eb;
}

.btn-timeline {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-timeline:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-add-note {
  background: #fbbf24;
  color: #78350f;
}

.btn-add-note:hover {
  background: #f59e0b;
}

.btn-add-clip {
  background: #3b82f6;
  color: white;
}

.btn-add-clip:hover {
  background: #2563eb;
}

.btn-add-clip-large {
  padding: 0.875rem 2rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-add-clip-large:hover {
  background: #2563eb;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

/* Content */
.csm-content {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

.csm-content.with-preview {
  grid-template-columns: 1fr 400px;
}

.csm-sequence {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Loading/Error/Empty States */
.csm-loading,
.csm-error,
.csm-empty {
  background: white;
  padding: 4rem 2rem;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.csm-error {
  color: #ef4444;
}

.error-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.btn-retry {
  margin-top: 1rem;
  padding: 0.625rem 1.25rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-retry:hover {
  background: #2563eb;
}

.csm-empty {
  padding: 6rem 2rem;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.csm-empty h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
  color: #1f2937;
}

.csm-empty p {
  margin: 0 0 2rem 0;
  color: #6b7280;
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
}

/* Clip List */
.clip-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: white;
  padding: 1rem;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.clip-list.dragging-over {
  background: #f0f9ff;
  border: 2px dashed #3b82f6;
}

/* Responsive */
@media (max-width: 1024px) {
  .csm-content.with-preview {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .clip-sequence-manager {
    padding: 1rem;
  }

  .csm-header {
    flex-direction: column;
    align-items: stretch;
  }

  .csm-stats {
    justify-content: space-between;
  }

  .csm-actions {
    flex-direction: column;
  }
  
  .btn-toggle-preview,
  .btn-timeline,
  .btn-add-note,
  .btn-add-clip {
    justify-content: center;
  }
}
```

**Create file**: `frontend/src/components/Episodes/ClipSequenceItem.css`

```css
.clip-sequence-item {
  display: grid;
  grid-template-columns: auto auto auto 1fr auto auto auto;
  gap: 1rem;
  align-items: center;
  padding: 0.875rem 1rem;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.clip-sequence-item:hover {
  border-color: #3b82f6;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);
}

.clip-sequence-item.selected {
  border-color: #3b82f6;
  background: #f0f9ff;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
}

.clip-sequence-item.dragging {
  opacity: 0.5;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.clip-sequence-item.missing {
  border-color: #fbbf24;
  background: #fffbeb;
}

.clip-sequence-item.note {
  border-color: #fbbf24;
  background: #fefce8;
  border-style: dashed;
}

/* Drag Handle */
.clip-drag-handle {
  cursor: grab;
  color: #9ca3af;
  display: flex;
  align-items: center;
  padding: 0.25rem;
  transition: color 0.2s;
}

.clip-drag-handle:hover {
  color: #4b5563;
}

.clip-drag-handle:active {
  cursor: grabbing;
}

/* Order */
.clip-order {
  font-size: 0.875rem;
  font-weight: 700;
  color: #6b7280;
  min-width: 2rem;
  text-align: center;
}

/* Thumbnail */
.clip-thumbnail {
  position: relative;
  width: 80px;
  height: 45px;
  border-radius: 6px;
  overflow: hidden;
  background: #f3f4f6;
}

.clip-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumbnail-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.processing-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.75);
  color: white;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  font-size: 0.75rem;
}

/* Info */
.clip-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.clip-title {
  font-weight: 600;
  font-size: 0.875rem;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.clip-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: #6b7280;
}

.meta-dot {
  color: #d1d5db;
}

.editing-badge {
  color: #3b82f6;
  font-weight: 600;
}

/* Trim Controls */
.clip-trim {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-edit-trim {
  padding: 0.375rem 0.75rem;
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-edit-trim:hover {
  background: #e5e7eb;
}

.trim-inputs {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.trim-inputs input {
  width: 60px;
  padding: 0.25rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.75rem;
  text-align: center;
}

.trim-inputs input:focus {
  outline: none;
  border-color: #3b82f6;
}

.trim-separator {
  color: #9ca3af;
  font-size: 0.75rem;
}

.btn-save-trim,
.btn-cancel-trim {
  padding: 0.25rem 0.5rem;
  border: none;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-save-trim {
  background: #10b981;
  color: white;
}

.btn-save-trim:hover:not(:disabled) {
  background: #059669;
}

.btn-cancel-trim {
  background: #f3f4f6;
  color: #374151;
}

.btn-cancel-trim:hover:not(:disabled) {
  background: #e5e7eb;
}

.btn-save-trim:disabled,
.btn-cancel-trim:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Actions */
.clip-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-remove-clip {
  padding: 0.375rem 0.75rem;
  background: #fef2f2;
  color: #ef4444;
  border: 1px solid #fecaca;
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-remove-clip:hover {
  background: #fee2e2;
  border-color: #fca5a5;
}

/* Status */
.clip-status {
  display: flex;
  align-items: center;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.status-dot.ready {
  background: #10b981;
}

.status-dot.processing {
  background: #3b82f6;
  animation: pulse 2s infinite;
}

.status-dot.failed {
  background: #ef4444;
}

.status-dot.missing {
  background: #fbbf24;
}

.status-dot.note {
  background: #fbbf24;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Responsive */
@media (max-width: 768px) {
  .clip-sequence-item {
    grid-template-columns: auto auto auto 1fr;
    grid-template-rows: auto auto;
  }

  .clip-trim,
  .clip-actions,
  .clip-status {
    grid-column: 1 / -1;
    justify-self: start;
  }
}
```

**Create file**: `frontend/src/components/Episodes/ClipPreviewPanel.css`

```css
.clip-preview-panel {
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  height: fit-content;
  position: sticky;
  top: 1rem;
  max-height: calc(100vh - 2rem);
}

.cpp-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.cpp-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
}

.btn-close {
  background: none;
  border: none;
  color: #6b7280;
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  transition: color 0.2s;
}

.btn-close:hover {
  color: #1f2937;
}

.cpp-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.cpp-player {
  width: 100%;
  aspect-ratio: 16/9;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
}

.cpp-note {
  padding: 1rem;
  background: #fefce8;
  border: 1px dashed #fbbf24;
  border-radius: 8px;
}

.cpp-note h4 {
  margin: 0 0 0.5rem 0;
  color: #78350f;
}

.note-text {
  margin: 0 0 1rem 0;
  color: #6b7280;
  line-height: 1.5;
}

.note-duration {
  font-size: 0.875rem;
  font-weight: 600;
  color: #92400e;
}

.cpp-details h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
}

.clip-description {
  margin: 0 0 1rem 0;
  font-size: 0.875rem;
  color: #6b7280;
  line-height: 1.5;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.detail-item .label {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-item .value {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1f2937;
}

.badge {
  display: inline-flex;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
}

.badge.status-ready {
  background: #d1fae5;
  color: #065f46;
}

.badge.status-processing {
  background: #dbeafe;
  color: #1e40af;
}

.badge.status-uploading {
  background: #fef3c7;
  color: #92400e;
}

.badge.status-failed {
  background: #fee2e2;
  color: #991b1b;
}

.cpp-trim {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}

.trim-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.trim-header h4 {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: #1f2937;
}

.btn-edit {
  padding: 0.375rem 0.875rem;
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-edit:hover {
  background: #e5e7eb;
}

.trim-display {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.trim-range {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background: #f9fafb;
  border-radius: 6px;
}

.trim-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #6b7280;
}

.trim-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1f2937;
  font-family: 'Courier New', monospace;
}

.trim-edit {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.trim-input-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.trim-input-group label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #374151;
}

.trim-input-group input {
  padding: 0.625rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.trim-input-group input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.trim-actions {
  display: flex;
  gap: 0.75rem;
}

.btn-save,
.btn-cancel {
  flex: 1;
  padding: 0.625rem;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-save {
  background: #3b82f6;
  color: white;
}

.btn-save:hover:not(:disabled) {
  background: #2563eb;
}

.btn-cancel {
  background: #f3f4f6;
  color: #374151;
}

.btn-cancel:hover:not(:disabled) {
  background: #e5e7eb;
}

.btn-save:disabled,
.btn-cancel:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Responsive */
@media (max-width: 1024px) {
  .clip-preview-panel {
    position: relative;
    top: 0;
    max-height: none;
  }
}
```

---

### Phase 3: Integration & Placeholder Pages (Day 3 - 2 hours)

#### Step 3.1: Create Timeline Editor Placeholder (20 min)

**Create file**: `frontend/src/pages/TimelineEditor.jsx`

```jsx
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './TimelineEditor.css';

const TimelineEditor = () => {
  const { episodeId } = useParams();
  const navigate = useNavigate();

  return (
    <div className="timeline-editor-page">
      <div className="timeline-header">
        <button onClick={() => navigate(`/episodes/${episodeId}`)} className="btn-back">
          ← Back to Episode
        </button>
        <h1>Timeline Editor</h1>
        <div className="timeline-actions">
          <button className="btn-secondary">Save Draft</button>
          <button className="btn-primary">Export Video</button>
        </div>
      </div>

      <div className="timeline-placeholder">
        <div className="placeholder-icon">🎬</div>
        <h2>Advanced Timeline Editor</h2>
        <p>Coming Soon: CapCut-style timeline with advanced editing features</p>
        <ul className="feature-list">
          <li>✨ Multi-track editing</li>
          <li>🎵 Audio waveforms</li>
          <li>✂️ Precision trimming</li>
          <li>🎨 Transitions & effects</li>
          <li>📝 Text overlays</li>
          <li>🎥 Real-time preview</li>
        </ul>
        <button 
          onClick={() => navigate(`/episodes/${episodeId}`)}
          className="btn-back-large"
        >
          Return to Episode
        </button>
      </div>
    </div>
  );
};

export default TimelineEditor;
```

**Create file**: `frontend/src/pages/TimelineEditor.css`

```css
.timeline-editor-page {
  min-height: 100vh;
  background: #1f2937;
  color: white;
  padding: 1rem;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #374151;
  border-radius: 8px;
  margin-bottom: 2rem;
}

.timeline-header h1 {
  margin: 0;
  font-size: 1.5rem;
}

.timeline-actions {
  display: flex;
  gap: 0.75rem;
}

.btn-back,
.btn-secondary,
.btn-primary {
  padding: 0.625rem 1.25rem;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-back {
  background: #4b5563;
  color: white;
}

.btn-back:hover {
  background: #6b7280;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-secondary:hover {
  background: #9ca3af;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.timeline-placeholder {
  background: #374151;
  border-radius: 12px;
  padding: 4rem 2rem;
  text-align: center;
  max-width: 600px;
  margin: 0 auto;
}

.placeholder-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.timeline-placeholder h2 {
  margin: 0 0 1rem 0;
  font-size: 2rem;
}

.timeline-placeholder p {
  margin: 0 0 2rem 0;
  color: #9ca3af;
  font-size: 1.125rem;
}

.feature-list {
  list-style: none;
  padding: 0;
  margin: 0 0 2rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  text-align: left;
  max-width: 300px;
  margin-left: auto;
  margin-right: auto;
}

.feature-list li {
  font-size: 1rem;
  color: #d1d5db;
}

.btn-back-large {
  padding: 0.875rem 2rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-back-large:hover {
  background: #2563eb;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

@media (max-width: 768px) {
  .timeline-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }

  .timeline-actions {
    justify-content: center;
  }
}
```

---

#### Step 3.2: Integrate into EpisodeDetail.jsx (30 min)

**File**: `frontend/src/pages/EpisodeDetail.jsx`

**Add import** at the top (around line 7):

```jsx
import ClipSequenceManager from '../components/Episodes/ClipSequenceManager';
```

**Find** the Scenes tab section (around line 510):

```jsx
{/* Scenes Tab */}
{activeTab === 'scenes' && (
  <div className="ed-stack">
    <div className="ed-card">
```

**Replace the entire scenes tab content** with:

```jsx
{/* Scenes Tab */}
{activeTab === 'scenes' && (
  <ClipSequenceManager episodeId={episodeId} episode={episode} />
)}
```

**That's it!** The old implementation is completely replaced.

---

#### Step 3.3: Add Timeline Editor Route (10 min)

**File**: `frontend/src/App.jsx`

**Add import** at the top:

```jsx
import TimelineEditor from './pages/TimelineEditor';
```

**Find** the routes section (around line 160), **add this route**:

```jsx
<Route path="/episodes/:episodeId/timeline" element={<TimelineEditor />} />
```

Place it near the other episode routes for organization.

---

### Phase 4: Testing & Verification (Day 4 - 2 hours)

#### Step 4.1: Backend Testing Checklist

**Start your server**:
```bash
cd C:\Users\12483\Projects\Episode-Canonical-Control-Record-1
node src/server.js
```

**Run these tests**:

```bash
# 1. Test list endpoint with stats
$episodeId = "51299ab6-1f9a-41af-951e-cd76cd9272a6"
curl.exe -s "http://localhost:3002/api/v1/episodes/$episodeId/library-scenes" | ConvertFrom-Json

# Expected: Should return { success, data, stats }

# 2. Test create note
$body = @{
  title = "Test Note"
  noteText = "This is a test note"
  manualDurationSeconds = 10
} | ConvertTo-Json

curl.exe -X POST "http://localhost:3002/api/v1/episodes/$episodeId/sequence-items/note" `
  -H "Content-Type: application/json" `
  -d $body

# Expected: 201 Created with note data

# 3. Test reorder (get clip IDs first)
$response = curl.exe -s "http://localhost:3002/api/v1/episodes/$episodeId/library-scenes" | ConvertFrom-Json
$clipIds = $response.data | ForEach-Object { $_.id }

$reorderBody = @{ itemIds = $clipIds } | ConvertTo-Json

curl.exe -X PUT "http://localhost:3002/api/v1/episodes/$episodeId/sequence-items/reorder" `
  -H "Content-Type: application/json" `
  -d $reorderBody

# Expected: 200 OK with reordered data + stats
```

**✅ Backend Tests Pass If**:
- [ ] List returns stats object
- [ ] Create note returns 201
- [ ] Note has type='note'
- [ ] Reorder updates scene_order
- [ ] Virtual fields (clipStatus, displayTitle, effectiveDuration) work

---

#### Step 4.2: Frontend Testing Checklist

**Start frontend**:
```bash
cd frontend
npm run dev
```

**Manual Tests**:

1. **Page Load**:
   - [ ] Navigate to episode detail
   - [ ] Click "Scenes" tab
   - [ ] ClipSequenceManager loads
   - [ ] Stats show correctly

2. **Add Clip**:
   - [ ] Click "Add Clip"
   - [ ] SceneLibraryPicker opens
   - [ ] Select a clip
   - [ ] Clip appears in sequence
   - [ ] Stats update

3. **Drag-Drop Reorder**:
   - [ ] Drag a clip
   - [ ] Drop in new position
   - [ ] Order numbers update
   - [ ] Backend persists order
   - [ ] Stats update instantly

4. **Edit Trim**:
   - [ ] Click "✂️ Trim" button
   - [ ] Input fields appear
   - [ ] Change values
   - [ ] Click ✓ save
   - [ ] Duration updates

5. **Preview Panel**:
   - [ ] Click a clip
   - [ ] Preview panel appears
   - [ ] Video loads
   - [ ] Can edit trim in panel
   - [ ] Click ✕ closes panel

6. **Add Note**:
   - [ ] Click "📝 Add Note"
   - [ ] Note appears in sequence
   - [ ] Has 📝 icon
   - [ ] Has amber/yellow styling

7. **Remove Clip**:
   - [ ] Click 🗑️ button
   - [ ] Confirm dialog appears
   - [ ] Clip removed
   - [ ] Stats update

8. **Timeline Editor**:
   - [ ] Click "✨ Open Timeline Editor"
   - [ ] Navigates to /episodes/:id/timeline
   - [ ] Placeholder page shows
   - [ ] Back button works

9. **Status Polling**:
   - [ ] Leave page open 10 seconds
   - [ ] Stats refresh automatically
   - [ ] Processing clips update

10. **Mobile/Responsive**:
    - [ ] Resize browser to mobile width
    - [ ] Buttons stack vertically
    - [ ] Preview panel hides
    - [ ] Clips are readable
    - [ ] Touch works (if testing on device)

---

#### Step 4.3: Edge Case Testing

**Test these scenarios**:

1. **Empty Episode**:
   - [ ] No clips shows empty state
   - [ ] "Add First Clip" button works

2. **Missing Clip**:
   - [ ] Delete a library scene that's used
   - [ ] Episode sequence shows ⚠️ Missing Clip
   - [ ] Can input manual duration
   - [ ] Can override title

3. **Processing Clip**:
   - [ ] Upload new clip (triggers processing)
   - [ ] Status shows ⏳ Processing
   - [ ] Not counted in "Ready Duration"
   - [ ] Counted in "Processing: N"

4. **Large Sequence**:
   - [ ] Add 20+ clips
   - [ ] Scroll works smoothly
   - [ ] Drag-drop still fast
   - [ ] No performance issues

5. **Network Error**:
   - [ ] Stop backend server
   - [ ] Try to add clip
   - [ ] Error message shows
   - [ ] Retry button appears

---

## 🚨 Troubleshooting Guide

### Problem: Migration Fails

**Error**: `column "type" already exists`

**Solution**:
```bash
# Check if migration already ran
npm run migrate:status

# If stuck, undo last migration
npm run migrate:undo

# Then re-run
npm run migrate
```

---

### Problem: "react-beautiful-dnd" Not Working

**Error**: Drag-drop doesn't respond

**Solution**:
1. Check browser console for errors
2. Verify installation: `npm list react-beautiful-dnd`
3. Try downgrade: `npm install react-beautiful-dnd@13.1.1 --force`
4. **Fallback**: Replace with up/down buttons (see code below)

**Fallback Code**:
```jsx
// Replace DragDropContext with this simple version:
<div className="clip-list-simple">
  {clips.map((clip, index) => (
    <div key={clip.id} className="clip-sequence-item">
      {/* ...existing content... */}
      <div className="reorder-buttons">
        <button onClick={() => moveUp(index)} disabled={index === 0}>↑</button>
        <button onClick={() => moveDown(index)} disabled={index === clips.length - 1}>↓</button>
      </div>
    </div>
  ))}
</div>

// Add these functions:
const moveUp = async (index) => {
  if (index === 0) return;
  const newClips = [...clips];
  [newClips[index], newClips[index - 1]] = [newClips[index - 1], newClips[index]];
  await handleDragEnd({ source: { index }, destination: { index: index - 1 } });
};

const moveDown = async (index) => {
  if (index === clips.length - 1) return;
  const newClips = [...clips];
  [newClips[index], newClips[index + 1]] = [newClips[index + 1], newClips[index]];
  await handleDragEnd({ source: { index }, destination: { index: index + 1 } });
};
```

---

### Problem: Stats Not Updating

**Error**: Duration always shows 0:00

**Solution**:
1. Check backend console for errors
2. Verify virtual field logic in EpisodeScene.js
3. Test with curl:
```bash
curl.exe -s "http://localhost:3002/api/v1/episodes/$episodeId/library-scenes" | ConvertFrom-Json | Select-Object -ExpandProperty stats
```
4. If null, check `effectiveDuration` getter

---

### Problem: Preview Panel Breaks Layout

**Error**: Panel pushes content off-screen

**Solution**:
1. Check if `position: sticky` is causing issues
2. Try this CSS fix:
```css
.csm-content.with-preview {
  grid-template-columns: 1fr 400px;
  align-items: start; /* ADD THIS */
}

.clip-preview-panel {
  position: sticky;
  top: 1rem;
  max-height: calc(100vh - 2rem);
  overflow: hidden; /* ADD THIS */
}
```

---

### Problem: SceneLibraryPicker Not Found

**Error**: `Cannot find module '../SceneLibraryPicker'`

**Solution**:
1. Check if component exists: `frontend/src/components/SceneLibraryPicker.jsx`
2. Verify import path
3. If missing, create simplified version:
```jsx
const SceneLibraryPicker = ({ isOpen, onClose, onSelect }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>Scene Library Picker</h2>
        <p>Simplified picker - integrate with your existing library</p>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
};
```

---

### Problem: VideoPlayer Not Found

**Error**: `Cannot find module '../VideoPlayer'`

**Solution**: Use native video element:
```jsx
{/* Replace VideoPlayer with: */}
<video
  src={videoUrl}
  poster={thumbnailUrl}
  controls
  style={{ width: '100%', aspectRatio: '16/9' }}
/>
```

---

### Problem: Performance Lag with 50+ Clips

**Symptoms**: Slow rendering, choppy drag-drop

**Solution**:
1. Add React.memo:
```jsx
export default React.memo(ClipSequenceItem);
```

2. Disable polling temporarily:
```jsx
// In ClipSequenceManager, comment out:
// const interval = setInterval(loadClips, 5000);
```

3. Add virtual scrolling (advanced):
```bash
npm install react-window
```

---

### Problem: Auth Errors on Endpoints

**Error**: 401 Unauthorized

**Solution**:
1. Check if `authMiddleware` is applied to routes
2. Verify JWT token in browser localStorage
3. Test with Postman using valid token
4. Temporarily disable auth for testing (dev only)

---

## ✅ Acceptance Criteria

**Feature is DONE when**:

### Functional Requirements
- [ ] Can add clips from Scene Library
- [ ] Can drag-drop to reorder clips
- [ ] Order persists after refresh
- [ ] Can edit trim values inline
- [ ] Can add notes to sequence
- [ ] Can remove clips
- [ ] Preview panel shows selected clip
- [ ] Preview panel can be toggled
- [ ] Timeline editor link works
- [ ] Stats show correct totals

### Technical Requirements
- [ ] No console errors
- [ ] No memory leaks (check DevTools)
- [ ] Polling cleans up on unmount
- [ ] Works in Chrome, Firefox, Edge
- [ ] Mobile responsive (768px+)
- [ ] Drag works on desktop + tablet
- [ ] Backend transaction safety
- [ ] Migration reversible

### UX Requirements
- [ ] Loading states show
- [ ] Error states show
- [ ] Empty state shows
- [ ] Missing clip handling
- [ ] Processing status visible
- [ ] Animations smooth (60fps)
- [ ] Touch targets >44px
- [ ] Keyboard accessible

### Performance Requirements
- [ ] Initial load < 2 seconds
- [ ] Drag-drop < 100ms response
- [ ] 50+ clips no lag
- [ ] API calls < 500ms
- [ ] No excessive re-renders

---

## 🚀 Deployment Checklist

### Pre-Deployment

1. **Code Review**:
   - [ ] All files committed to git
   - [ ] No console.log statements
   - [ ] No hardcoded values
   - [ ] Error handling in place

2. **Testing**:
   - [ ] All manual tests pass
   - [ ] Edge cases tested
   - [ ] No known bugs

3. **Documentation**:
   - [ ] README updated
   - [ ] API docs updated
   - [ ] Changelog entry added

### Deployment Steps

1. **Backend** (deploy first):
```bash
# SSH to server
ssh user@server

# Pull latest code
cd /var/www/episode-control
git pull origin main

# Run migration
npm run migrate

# Restart server
pm2 restart episode-control
pm2 logs episode-control
```

2. **Frontend**:
```bash
# Local build
cd frontend
npm run build

# Deploy build to server (adjust for your setup)
scp -r dist/* user@server:/var/www/episode-control/public/
```

3. **Verification**:
```bash
# Test production endpoints
curl https://yourapp.com/api/v1/episodes/[id]/library-scenes

# Check logs
pm2 logs --lines 50
```

### Post-Deployment

- [ ] Test in production browser
- [ ] Monitor error logs for 1 hour
- [ ] Check database for issues
- [ ] Notify team in Slack
- [ ] Update project board

### Rollback Plan

If something breaks:
```bash
# Undo migration
npm run migrate:undo

# Revert git commit
git revert HEAD
git push origin main

# Redeploy
pm2 restart episode-control
```

---

## 📞 Support & Resources

### Getting Help

- **Questions**: Post in Slack #episode-control-dev
- **Bugs**: Create issue on GitHub
- **Code Review**: Tag @original-developer

### Useful Commands

```bash
# Backend
npm run dev          # Start dev server
npm run migrate      # Run migrations
npm run migrate:undo # Undo last migration
npm test             # Run tests

# Frontend
npm run dev          # Start Vite dev server
npm run build        # Build for production
npm run preview      # Preview production build

# Database
psql -d episode_control -c "SELECT * FROM episode_scenes LIMIT 5;"
```

### Related Documentation

- [react-beautiful-dnd docs](https://github.com/atlassian/react-beautiful-dnd)
- [Sequelize migrations](https://sequelize.org/docs/v6/other-topics/migrations/)
- [React hooks](https://react.dev/reference/react)

---

## 🎉 Success Metrics

**After 1 week**, check:
- [ ] Feature adoption rate (% of users using it)
- [ ] Average clips per episode
- [ ] Error rate < 1%
- [ ] Support tickets about feature

**After 1 month**, check:
- [ ] User feedback (surveys)
- [ ] Performance metrics
- [ ] Feature requests for improvements

---

## 📋 Summary

You've implemented a production-grade clip sequence manager with:
- ✅ Drag-drop reordering
- ✅ Real-time stats
- ✅ Preview panel
- ✅ Note support
- ✅ Mobile responsive
- ✅ Error handling
- ✅ Performance optimized

**Estimated total time**: 14 hours
**Lines of code added**: ~2,500
**New endpoints**: 3
**New components**: 3

**Great job!** 🚀

---

*End of Implementation Guide*