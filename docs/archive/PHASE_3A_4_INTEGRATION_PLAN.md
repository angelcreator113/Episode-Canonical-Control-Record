# Phase 3A.4 - Phase 2D Integration Plan

**Status:** PLANNING PHASE  
**Date:** 2024  
**Integration Focus:** Connecting Phase 3A Real-time Services with Phase 2D Episode Management  

---

## Executive Summary

Phase 3A.4 integrates the completed Phase 3A real-time services (Notifications, Activities, Presence, WebSockets) with the existing Phase 2D episode management system. This creates an end-to-end real-time experience where:

- Episode operations trigger real-time notifications
- User actions are automatically logged to activity feeds
- Editors see who else is viewing episodes (presence tracking)
- Job processing emits WebSocket events to connected clients

---

## Integration Architecture

### Current System (Phase 2D)

```
Frontend (Vue.js)
    ↓
Express API (Controllers)
├── episodesController - CRUD operations
├── compositionsController - Composition management
├── jobController - Job queue management
└── fileController - File operations
    ↓
Services (Business Logic)
├── JobQueueService - SQS queue management
├── OpenSearchService - Full-text search
└── FileUploadService - S3 uploads
    ↓
PostgreSQL Database
```

### New System (Phase 3A Integration)

```
Frontend (Vue.js)
    ↓
Express API (Controllers)
├── episodesController ← ✨ ActivityService logging added
├── compositionsController ← ✨ ActivityService logging added
├── jobController ← ✨ SocketService event emission added
└── fileController ← ✨ ActivityService logging added
    ↓
Services (Business Logic)
├── JobQueueService → ✨ Emits events to SocketService
├── OpenSearchService
├── FileUploadService
├── ✨ ActivityService - Activity logging
├── ✨ NotificationService - User notifications
├── ✨ PresenceService - Presence tracking
└── ✨ SocketService - WebSocket management
    ↓
PostgreSQL Database (Phase 2D + Phase 3A tables)
```

---

## Integration Points

### 1. episodesController Integration

**File:** `src/controllers/episodeController.js`

#### Operations to Log

| Operation | Method | Activity Action | Trigger | Data |
|-----------|--------|-----------------|---------|------|
| Create Episode | POST /episodes | `created_episode` | After DB insert | episode_id, title, status |
| Read Episode | GET /episodes/:id | `viewed_episode` | Before response | episode_id, viewer count |
| Update Episode | PUT /episodes/:id | `updated_episode` | After DB update | episode_id, changed_fields |
| Delete Episode | DELETE /episodes/:id | `deleted_episode` | After DB delete | episode_id, title |
| Publish Episode | PUT (status→published) | `published_episode` | After status change | episode_id |
| Archive Episode | PUT (status→archived) | `archived_episode` | After status change | episode_id |

#### Notifications to Send

| Event | Recipients | Message | Type |
|-------|-----------|---------|------|
| Episode Created | Admin, Editors | "New episode: {title}" | `episode_created` |
| Episode Published | All Users | "{title} published" | `episode_published` |
| Episode Updated | Episode Subscribers | "{title} updated by {user}" | `episode_updated` |
| Episode Deleted | Admin | "{title} deleted permanently" | `episode_deleted` |

#### Code Changes Required

**Before:**
```javascript
const episode = await Episode.create({
  title: finalTitle,
  episode_number: parseInt(finalEpisodeNumber),
  // ...
});

res.status(201).json({ data: episode, message: 'Episode created successfully' });
```

**After:**
```javascript
const episode = await Episode.create({
  title: finalTitle,
  episode_number: parseInt(finalEpisodeNumber),
  // ...
});

// ✨ NEW: Log activity
try {
  await ActivityService.logActivity({
    userId: req.user?.id,
    action: 'created_episode',
    resourceType: 'episode',
    resourceId: episode.id,
    metadata: { title: episode.title, status: episode.status }
  });

  // ✨ NEW: Send notification
  await NotificationService.create({
    userId: 'admin-group', // Special group
    message: `Episode "${episode.title}" created`,
    type: 'episode_created',
    data: { episodeId: episode.id }
  });

  // ✨ NEW: Emit WebSocket event
  SocketService.broadcastMessage({
    event: 'episode_created',
    data: { episode: episode.toJSON() },
    timestamp: new Date()
  });
} catch (err) {
  logger.warn('Failed to log activity/notification', { error: err.message });
  // Don't fail request if logging fails
}

res.status(201).json({ data: episode, message: 'Episode created successfully' });
```

---

### 2. JobProcessor Integration

**File:** `src/services/JobProcessor.js`

#### Job State Transitions

```
PENDING → PROCESSING → COMPLETED (success)
                     → FAILED (error + retry)
                     → FAILED (max retries exceeded)
```

#### Events to Emit

| Event | When | Payload | Recipient |
|-------|------|---------|-----------|
| `job_started` | Job begins processing | jobId, jobType, timestamp | Episode viewers |
| `job_progress` | Progress update (optional) | jobId, progress%, timestamp | Episode viewers |
| `job_completed` | Job finishes successfully | jobId, result, timestamp | Episode viewers |
| `job_failed` | Job fails | jobId, error, timestamp | Episode viewers, admins |
| `job_retry` | Job retried | jobId, attempt, timestamp | Admins |

#### Code Changes Required

**In JobProcessor.handleMessage():**

```javascript
static async handleMessage(message) {
  try {
    const jobData = JSON.parse(message.Body);
    const jobId = jobData.jobId;
    const jobType = jobData.jobType;
    
    // Get handler
    const handler = this.handlers.get(jobType);
    if (!handler) {
      throw new Error(`No handler for job type: ${jobType}`);
    }

    // ✨ NEW: Emit job_started event
    SocketService.broadcastMessage({
      event: 'job_started',
      data: { jobId, jobType, timestamp: new Date() }
    });

    // Execute job
    const result = await handler(jobData);

    // ✨ NEW: Emit job_completed event
    SocketService.broadcastMessage({
      event: 'job_completed',
      data: { jobId, jobType, result, timestamp: new Date() }
    });

    // ✨ NEW: Log activity
    await ActivityService.logActivity({
      userId: 'system',
      action: `completed_${jobType}`,
      resourceType: 'job',
      resourceId: jobId,
      metadata: { result }
    });

    // Acknowledge message
    await QueueService.acknowledgeMessage(message.ReceiptHandle);

  } catch (error) {
    logger.error('Job processing failed', { error, jobId });

    // ✨ NEW: Emit job_failed event
    SocketService.broadcastMessage({
      event: 'job_failed',
      data: { jobId, error: error.message, timestamp: new Date() }
    });

    // ✨ NEW: Log activity
    await ActivityService.logActivity({
      userId: 'system',
      action: `failed_${jobType}`,
      resourceType: 'job',
      resourceId: jobId,
      metadata: { error: error.message }
    });

    // Retry logic
    if (retryCount < maxRetries) {
      // ✨ NEW: Emit job_retry event
      SocketService.broadcastMessage({
        event: 'job_retry',
        data: { jobId, attempt: retryCount + 1, timestamp: new Date() }
      });

      await QueueService.changeMessageVisibility(message.ReceiptHandle, 60);
    } else {
      // Move to DLQ
      await QueueService.sendToDLQ(message);
    }
  }
}
```

---

### 3. PresenceService Integration

**File:** `src/controllers/episodeController.js` (GET endpoint)

#### Track Episode Viewers

When a user views an episode, track it in presence:

```javascript
// In getEpisode() method
async getEpisode(req, res, next) {
  const { id } = req.params;
  
  const episode = await Episode.findByPk(id);
  
  if (!episode) {
    throw new NotFoundError('Episode', id);
  }

  // ✨ NEW: Track user viewing episode
  try {
    await PresenceService.trackViewer({
      userId: req.user?.id,
      resourceType: 'episode',
      resourceId: id,
      timestamp: new Date()
    });
  } catch (err) {
    logger.warn('Failed to track viewer', { error: err.message });
  }

  res.json({ data: episode });
}
```

#### Show Viewers in Response

```javascript
// Add to getEpisode response
res.json({
  data: episode,
  viewers: await PresenceService.getViewers('episode', id)
});
```

---

## Implementation Sequence

### Phase 3A.4.1 - episodesController Integration (2 hours)

**Files to Modify:**
- `src/controllers/episodeController.js`

**Changes:**
1. Import Phase 3A services:
   ```javascript
   const ActivityService = require('../services/ActivityService');
   const NotificationService = require('../services/NotificationService');
   const PresenceService = require('../services/PresenceService');
   const SocketService = require('../services/SocketService');
   ```

2. Add activity logging to all CRUD methods:
   - `listEpisodes()` → No logging (read-only, high volume)
   - `getEpisode()` → Track viewer presence
   - `createEpisode()` → Log `created_episode`
   - `updateEpisode()` → Log `updated_episode`
   - `deleteEpisode()` → Log `deleted_episode`

3. Add notifications for key events:
   - New episode created
   - Episode published
   - Episode updated (optional, for subscribers)

4. Add presence tracking:
   - On GET episode, track viewer
   - Return viewer list in response

**Test Coverage:**
- Activity logged for each CRUD operation
- Notifications sent to appropriate users
- Viewer tracking working
- WebSocket events broadcast

---

### Phase 3A.4.2 - JobProcessor Integration (2 hours)

**Files to Modify:**
- `src/services/JobProcessor.js`

**Changes:**
1. Import SocketService:
   ```javascript
   const SocketService = require('./SocketService');
   ```

2. Emit WebSocket events on job state changes:
   - Job started
   - Job progress (if available)
   - Job completed
   - Job failed
   - Job retried

3. Log activities for all job operations:
   - Job started
   - Job completed
   - Job failed
   - Job retried

**Test Coverage:**
- WebSocket events emitted correctly
- Activities logged for job operations
- Retry logic working
- Error handling working

---

### Phase 3A.4.3 - Additional Controller Integration (2 hours)

**Files to Modify:**
- `src/controllers/compositionsController.js` (if exists)
- `src/controllers/jobController.js` (if exists)
- `src/controllers/fileController.js` (if exists)

**Changes:**
1. Add activity logging to CRUD operations
2. Add notifications for key events
3. Add presence tracking for resource views
4. Add WebSocket events for state changes

---

### Phase 3A.4.4 - Integration Tests (3 hours)

**Files to Create:**
- `tests/integration/phase2d-phase3a-integration.test.js`

**Test Scenarios:**
1. Create episode → Activity logged → Notification sent → WebSocket broadcast
2. Update episode → Activity logged → Notification sent (if published) → WebSocket broadcast
3. Delete episode → Activity logged → Notification sent → WebSocket broadcast
4. Job completes → Activity logged → WebSocket broadcast → Task cleaned up
5. Job fails → Activity logged → WebSocket broadcast → Retry or DLQ
6. Multiple viewers on episode → Presence tracked → Viewer list returned

---

### Phase 3A.4.5 - Documentation & Deployment (2 hours)

**Files to Create:**
- `PHASE_3A_4_COMPLETION_REPORT.md` - Integration summary
- `DEPLOYMENT_CHECKLIST.md` - Pre-production checklist
- `TROUBLESHOOTING_GUIDE.md` - Common issues and fixes

**Deployment Steps:**
1. Run database migrations (if any)
2. Deploy modified controllers
3. Deploy modified services
4. Verify real-time event flow
5. Monitor for errors
6. Test with multiple concurrent users

---

## Event Flow Diagrams

### Episode Creation Flow

```
User Creates Episode
    ↓
POST /api/v1/episodes
    ↓
episodesController.createEpisode()
    ↓
Episode.create() ← Save to DB
    ↓
ActivityService.logActivity()  ← Log 'created_episode'
    ↓
NotificationService.create()  ← Send notification to admins
    ↓
SocketService.broadcastMessage() ← Broadcast to all clients
    ↓
Return 201 Created
    ↓
Frontend Updates in Real-Time
├── Activity feed shows new episode
├── Notification center shows alert
└── Episode list refreshes
```

### Job Processing Flow

```
Job Enqueued (SQS)
    ↓
JobProcessor.poll() ← Receive from queue
    ↓
JobProcessor.handleMessage()
    ↓
SocketService.broadcastMessage('job_started')  ← Emit event
    ↓
Handler Executes Job
    ↓
    ├─→ Success:
    │   ↓
    │   SocketService.broadcastMessage('job_completed')
    │   ActivityService.logActivity('completed_*')
    │   QueueService.acknowledgeMessage()
    │
    └─→ Failure:
        ↓
        SocketService.broadcastMessage('job_failed')
        ActivityService.logActivity('failed_*')
        ↓
        Retry? (if retryCount < maxRetries)
        ├─→ Yes:
        │   SocketService.broadcastMessage('job_retry')
        │   QueueService.changeMessageVisibility()
        │
        └─→ No:
            QueueService.sendToDLQ()

Frontend Updates in Real-Time
├── Job progress updates
├── Activity feed shows job events
└── Status indicators change
```

### Presence Tracking Flow

```
User Opens Episode
    ↓
GET /api/v1/episodes/:id
    ↓
episodesController.getEpisode()
    ↓
PresenceService.trackViewer()  ← Record viewer
    ↓
Response includes:
{
  data: episode,
  viewers: [
    { userId: 'user-1', joinedAt: '2024-01-07T...' },
    { userId: 'user-2', joinedAt: '2024-01-07T...' }
  ]
}
    ↓
SocketService broadcasts 'viewer_joined'
    ↓
All Connected Clients Update
└── Show live viewer badges
```

---

## Code Examples

### Activity Logging Pattern

```javascript
// Simple pattern for all logging
const ActivityService = require('../services/ActivityService');

// After successful operation
await ActivityService.logActivity({
  userId: req.user?.id,           // Who did it
  action: 'created_episode',      // What action
  resourceType: 'episode',        // What resource type
  resourceId: episode.id,         // Which resource
  metadata: {                     // Additional data
    title: episode.title,
    status: episode.status,
    description: episode.description
  }
});
```

### Notification Pattern

```javascript
// Simple pattern for notifications
const NotificationService = require('../services/NotificationService');

// Send to specific user
await NotificationService.create({
  userId: req.user?.id,
  message: 'Episode updated',
  type: 'episode_updated',
  data: { episodeId: episode.id }
});

// Send to group (e.g., all admins)
// Use special userIds like 'admin-group' or broadcast via Socket
SocketService.broadcastMessage({
  event: 'episode_created',
  data: { episode }
});
```

### WebSocket Event Pattern

```javascript
// Simple pattern for WebSocket events
const SocketService = require('../services/SocketService');

SocketService.broadcastMessage({
  event: 'episode_updated',           // Event name
  data: { 
    episode,                          // Event data
    changedFields: ['status', 'title']
  },
  timestamp: new Date()
});
```

---

## Error Handling Strategy

### Graceful Degradation

All Phase 3A operations are non-blocking:

```javascript
try {
  // Primary operation
  const episode = await Episode.create(data);

  // Phase 3A enhancements (non-blocking)
  try {
    await ActivityService.logActivity(...);
  } catch (err) {
    logger.warn('Failed to log activity', { error: err.message });
    // Don't fail the request
  }

  try {
    await NotificationService.create(...);
  } catch (err) {
    logger.warn('Failed to send notification', { error: err.message });
    // Don't fail the request
  }

  // Return success response
  res.status(201).json({ data: episode });

} catch (error) {
  // Primary operation failed - return error
  res.status(500).json({ error: error.message });
}
```

### Monitoring & Logging

```javascript
// Log all Phase 3A operations
logger.info('Activity logged', { 
  userId: req.user?.id,
  action: 'created_episode',
  resourceId: episode.id
});

logger.info('Notification sent', {
  type: 'episode_created',
  recipients: 'admin-group'
});

logger.info('WebSocket broadcast', {
  event: 'episode_created',
  clientCount: 15
});
```

---

## Performance Considerations

### Database Queries

- Activity logging uses bulk inserts
- No N+1 queries in viewer tracking
- Indexes on resourceType, userId, timestamp

### WebSocket Broadcasting

- Events broadcast asynchronously (fire-and-forget)
- Max 1000 concurrent connections
- Message queuing for backpressure

### Notification Delivery

- Batching notifications (max 100 per second)
- TTL on old notifications (cleanup every hour)
- Rate limiting per user

---

## Rollback Plan

If Phase 3A.4 integration causes issues:

### Option 1: Disable Non-Blocking Operations

```javascript
// Set environment variable
DISABLE_ACTIVITY_LOGGING=true

// In controller
if (process.env.DISABLE_ACTIVITY_LOGGING !== 'true') {
  await ActivityService.logActivity(...);
}
```

### Option 2: Feature Flags

```javascript
const featureFlags = {
  ACTIVITY_LOGGING: true,
  NOTIFICATIONS: true,
  PRESENCE_TRACKING: true,
  WEBSOCKET_BROADCAST: true
};

if (featureFlags.ACTIVITY_LOGGING) {
  await ActivityService.logActivity(...);
}
```

### Option 3: Revert Changes

```bash
git revert <commit-hash>
npm start  # Restart without Phase 3A integrations
```

---

## Verification Checklist

After implementation:

- [ ] All CRUD operations log to ActivityLog table
- [ ] Notifications created for key events
- [ ] WebSocket events broadcast to clients
- [ ] Presence tracked for resource views
- [ ] Job processor emits events
- [ ] Integration tests pass
- [ ] No performance degradation
- [ ] Error handling working
- [ ] Logging comprehensive
- [ ] Documentation complete

---

## Next Steps After Phase 3A.4

### Phase 3A.5 - SocketService Initialization
- Configure WebSocket server in `src/server.js`
- Setup authentication for socket connections
- Initialize cleanup tasks

### Phase 3A.6 - Performance Testing
- Load test with 100+ concurrent connections
- Benchmark database queries
- Optimize slow operations

### Phase 3A.7 - Frontend Socket.IO Integration
- Connect Vue.js to WebSocket events
- Real-time UI updates
- Presence indicators

---

## Files Summary

| File | Changes | Lines |
|------|---------|-------|
| episodeController.js | Activity logging, notifications, presence | +80 |
| JobProcessor.js | WebSocket events, activity logging | +60 |
| compositionsController.js | Activity logging (if exists) | +50 |
| Integration tests | Full workflow tests | +400 |
| Documentation | Phase 3A.4 report | +200 |
| **TOTAL** | Phase 2D + Phase 3A integration | **+790** |

---

**Phase 3A.4 Ready to Implement.**
