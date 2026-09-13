# 🚀 Phase 3A Implementation Guide
## Real-time Notifications System - Step by Step

**Current Status:** 📋 Foundation Complete  
**Files Created:** 5 service files + 1 migration file  
**Estimated Completion:** 5-7 days  
**Next Steps:** Create controllers, tests, and integrate with existing systems

---

## ✅ Completed (Foundation)

### 1. **Planning & Architecture** ✓
- [x] PHASE_3A_START_HERE.md - Complete design document
- [x] Architecture diagrams and component overview
- [x] Event types and payload specifications
- [x] Performance targets defined

### 2. **Database Schema** ✓
- [x] Migration 009 created with 4 new tables
  - `notifications` - User notifications (270 lines)
  - `activity_logs` - Activity audit trail (180 lines)
  - `user_presence` - Online status tracking (140 lines)
  - `notification_preferences` - User settings (90 lines)
- [x] Strategic indexes on all tables
- [x] Automatic triggers for updated_at timestamps

### 3. **Core Services Created** ✓

#### SocketService (1,050 lines)
- WebSocket server initialization with Socket.IO
- JWT authentication for connections
- Namespace management (/jobs, /episodes, /admin, /feed)
- Connection tracking and management
- Room management for targeted broadcasts
- Statistics and monitoring
- **Location:** `src/services/SocketService.js`

#### NotificationService (520 lines)
- Create and send notifications
- Persistence to database
- Read/unread tracking
- User preference management
- Rate limiting (configurable per-hour limit)
- Cleanup of expired and old notifications
- **Location:** `src/services/NotificationService.js`

#### ActivityService (380 lines)
- Log all user actions (create, update, delete, approve, etc.)
- Activity feeds with filtering
- Resource-specific activity history
- Team/group activity aggregation
- Full-text search on activity logs
- Dashboard statistics
- **Location:** `src/services/ActivityService.js`

#### PresenceService (360 lines)
- Online/offline status management
- Custom status messages (away, busy, do not disturb)
- Resource viewing tracking (who's viewing what)
- Last activity timestamps
- Stale presence cleanup
- Presence statistics
- **Location:** `src/services/PresenceService.js`

**Total Service Code:** 2,310 lines, fully documented with JSDoc

---

## 📋 Next Phase: Controllers & REST API

### Phase 3A.1: Create REST Controllers

#### 1. Create `src/controllers/notificationController.js` (200+ lines)

```javascript
// Key endpoints to implement:
POST   /api/v1/notifications                    # Create notification (admin)
GET    /api/v1/notifications                    # Get user's notifications
POST   /api/v1/notifications/:id/read           # Mark as read
POST   /api/v1/notifications/read-all           # Mark all as read
DELETE /api/v1/notifications/:id                # Delete notification
GET    /api/v1/notifications/unread-count       # Get unread count
GET    /api/v1/notifications/preferences        # Get preferences
POST   /api/v1/notifications/preferences        # Update preferences
```

**Key Implementation Details:**
- Require authentication on all endpoints
- Validate notification type
- Check rate limits before creating
- Return paginated results (default 20, max 100)
- Support filtering by type and read status
- Use transaction for read-all operations

#### 2. Create `src/controllers/activityController.js` (180+ lines)

```javascript
// Key endpoints to implement:
GET    /api/v1/activity/feed                    # Get user's activity feed
GET    /api/v1/activity/resource/:type/:id      # Get resource activity
GET    /api/v1/activity/team                    # Get team activity (admin)
GET    /api/v1/activity/stats                   # Get activity statistics
GET    /api/v1/activity/search                  # Search activity logs
GET    /api/v1/activity/dashboard-stats         # Dashboard stats (admin)
```

**Key Implementation Details:**
- Enforce user isolation (users see only their own + public)
- Support date range filtering
- Return results sorted by created_at DESC
- Include user info (id, username) with activities
- Support full-text search on resource names

#### 3. Create `src/controllers/presenceController.js` (150+ lines)

```javascript
// Key endpoints to implement:
GET    /api/v1/presence/online-users            # List online users
GET    /api/v1/presence/status                  # Get current user status
POST   /api/v1/presence/status                  # Update user status
GET    /api/v1/presence/resource-viewers/:type/:id  # Who's viewing
GET    /api/v1/presence/stats                   # Presence statistics (admin)
```

**Key Implementation Details:**
- Return limited user info (id, name, status, status_message, lastActivity)
- Support cursor-based pagination for large lists
- Include last activity timestamp
- Support filtering by resource type/id
- Return socket count for admin view

#### 4. Create `src/controllers/socketController.js` (180+ lines)

```javascript
// Admin-only endpoints:
POST   /api/v1/socket/broadcast                 # Send to all users
POST   /api/v1/socket/notify-user/:id           # Notify specific user
POST   /api/v1/socket/notify-room/:id           # Notify room
POST   /api/v1/socket/disconnect/:id            # Force disconnect socket
GET    /api/v1/socket/stats                     # Get socket server stats
GET    /api/v1/socket/connections               # List active connections
```

**Key Implementation Details:**
- Admin-only with role verification
- Validate socket IDs
- Log all admin actions
- Return connection details and namespaces
- Support filtering by namespace

---

## 🧪 Testing Strategy

### Phase 3A.2: Unit Tests (20+ tests)

#### `tests/unit/services/notification.test.js`
```
✓ NotificationService.createNotification()
  - Creates single notification
  - Creates batch notifications
  - Respects rate limits
  - Sets expiration time

✓ NotificationService.markAsRead()
  - Marks notification as read
  - Returns updated notification
  - Handles non-existent notification

✓ NotificationService.getPreferences()
  - Gets existing preferences
  - Creates defaults for new user

✓ NotificationService.checkRateLimit()
  - Allows notifications within limit
  - Blocks notifications over limit
  - Resets hourly
```

#### `tests/unit/services/activity.test.js`
```
✓ ActivityService.logActivity()
  - Logs with all parameters
  - Handles optional fields

✓ ActivityService.getActivityFeed()
  - Filters by action type
  - Filters by resource type
  - Filters by date range
  - Returns paginated results

✓ ActivityService.searchActivityLogs()
  - Searches by resource name
  - Searches by action type
  - Case-insensitive matching
```

#### `tests/unit/services/presence.test.js`
```
✓ PresenceService.setUserOnline()
  - Creates presence for new user
  - Updates presence for existing user
  - Tracks multiple socket IDs

✓ PresenceService.setUserStatus()
  - Sets custom status
  - Accepts valid statuses only
  - Returns updated status

✓ PresenceService.getResourceViewers()
  - Returns users viewing resource
  - Only returns online users
```

### Phase 3A.3: Integration Tests (30+ tests)

#### `tests/integration/notifications.test.js`
```
✓ Full notification workflow
  - Create notification
  - Send via WebSocket
  - Persist to database
  - Retrieve and mark as read
  - Delete notification

✓ Notification preferences
  - Create default preferences
  - Update preferences
  - Validate quiet hours
  - Test muted notifications

✓ Batch operations
  - Create multiple notifications
  - Mark all as read
  - Delete multiple
  - Rate limit enforcement
```

#### `tests/integration/activity.test.js`
```
✓ Activity logging workflow
  - Log episode creation
  - Log episode update with changes
  - Log episode deletion
  - Generate activity feed
  - Filter and paginate results

✓ Resource activity
  - Get all changes to resource
  - Show timeline of changes
  - Track who made changes

✓ Team activity
  - Get all team activities
  - Aggregate statistics
  - Filter by date range
```

#### `tests/integration/presence.test.js`
```
✓ Connection lifecycle
  - User comes online
  - User sets custom status
  - User views resource
  - User goes offline
  - Stale presence cleanup

✓ Resource viewers
  - Get users viewing episode
  - Get users viewing composition
  - Track multiple viewers
  - Handle disconnections
```

#### `tests/integration/socket.test.js`
```
✓ Connection management
  - Authenticate with JWT
  - Join namespaces
  - Join rooms
  - Disconnect gracefully
  - Reconnect with existing connections

✓ Broadcasting
  - Broadcast to all connected users
  - Send to specific room
  - Send to specific user
  - Handle namespace isolation

✓ Event handling
  - Receive job:progress events
  - Receive episode:updated events
  - Handle admin:alert events
```

---

## 🔌 Integration Points

### Phase 3A.4: Integrate with Existing Systems

#### 1. **Job Queue Integration** (JobProcessor)
```javascript
// When job status updates, emit WebSocket event
JobProcessor.handleJobSuccess() → 
  SocketService.toRoom('/jobs', 'job:completed', {...})
  NotificationService.createNotification('job:completed', ...) →
    Broadcast via WebSocket to user
```

#### 2. **Episode Controller Integration** (episodesController.js)
```javascript
// When episode is updated, log activity and notify subscribers
episodesController.updateEpisode() →
  ActivityService.logActivity('updated', userId, 'episode', episodeId, changes) →
    Broadcast via WebSocket to episode subscribers
  NotificationService.createNotification('episode:updated', ...) →
    Send to subscribed users
```

#### 3. **Server Startup** (src/server.js)
```javascript
// Initialize Socket.IO in main server file
const http = require('http');
const express = require('express');
const SocketService = require('./services/SocketService');

const app = express();
const httpServer = http.createServer(app);

// Initialize Socket.IO
SocketService.initialize(httpServer);

// Setup cleanup tasks
setInterval(() => {
  PresenceService.cleanupStalePresence();
  NotificationService.cleanupExpiredNotifications();
  NotificationService.cleanupOldNotifications();
  ActivityService.cleanupOldActivityLogs();
}, 300000); // Every 5 minutes

httpServer.listen(PORT);
```

---

## 📦 Dependencies

### Install Required Packages
```bash
npm install socket.io socket.io-client
```

Package versions:
- `socket.io`: ^4.7.0 - WebSocket server
- `socket.io-client`: ^4.7.0 - Client library for testing

Already installed from Phase 2:
- `jsonwebtoken` - JWT authentication
- `pg` - PostgreSQL connection
- `express` - HTTP server
- `dotenv` - Environment variables

---

## 🗂️ File Organization

After Phase 3A completion, structure will be:

```
src/
├── services/
│   ├── SocketService.js         ✓ Created
│   ├── NotificationService.js   ✓ Created
│   ├── ActivityService.js       ✓ Created
│   ├── PresenceService.js       ✓ Created
│   ├── QueueService.js          (Phase 2D)
│   ├── JobProcessor.js          (Phase 2D)
│   ├── ErrorRecovery.js         (Phase 2D)
│   ├── OpenSearchService.js     (Phase 2C)
│   ├── S3Service.js             (Phase 2B)
│   └── Logger.js
├── controllers/
│   ├── notificationController.js    → To create
│   ├── activityController.js        → To create
│   ├── presenceController.js        → To create
│   ├── socketController.js          → To create
│   ├── jobController.js             (Phase 2D)
│   ├── searchController.js          (Phase 2C)
│   ├── filesController.js           (Phase 2B)
│   ├── episodesController.js        (Phase 1)
│   └── authController.js            (Phase 1)
└── ...

migrations/
├── 009_create_notifications_tables.js  ✓ Created
├── 008_create_jobs_table.js           (Phase 2D)
├── 007_create_search_tables.js        (Phase 2C)
├── 006_create_files_table.js          (Phase 2B)
└── ...

tests/
├── unit/
│   └── services/
│       ├── notification.test.js      → To create
│       ├── activity.test.js          → To create
│       └── presence.test.js          → To create
└── integration/
    ├── notifications.test.js         → To create
    ├── activity.test.js              → To create
    ├── presence.test.js              → To create
    └── socket.test.js                → To create
```

---

## 🚀 Execution Roadmap

### Day 1-2: Foundation ✓
- [x] Database migration created
- [x] SocketService implemented
- [x] NotificationService implemented
- [x] ActivityService implemented
- [x] PresenceService implemented

### Day 3-4: Controllers (Next)
- [ ] notificationController.js
- [ ] activityController.js
- [ ] presenceController.js
- [ ] socketController.js
- [ ] Route registration in server.js

### Day 5: Unit Tests
- [ ] Unit tests for all 4 services (20+ tests)
- [ ] Coverage target: 75%+

### Day 6: Integration Tests
- [ ] Integration tests (30+ tests)
- [ ] Database migration verification
- [ ] Full workflow testing

### Day 7: Integration & Documentation
- [ ] Integrate with JobProcessor
- [ ] Integrate with episodesController
- [ ] Frontend Socket.IO client setup
- [ ] PHASE_3A_COMPLETE.md documentation
- [ ] Deployment guide

---

## ⚙️ Configuration Checklist

Add to `.env` file:

```bash
# Phase 3A: Real-time Notifications
SOCKET_PORT=3002
SOCKET_CORS_ORIGIN=http://localhost:5173
SOCKET_CORS_CREDENTIALS=true
MAX_SOCKET_CONNECTIONS=500
SOCKET_RECONNECTION_DELAY=1000
SOCKET_RECONNECTION_MAX_DELAY=5000

NOTIFICATION_RETENTION_DAYS=30
NOTIFICATION_RATE_LIMIT=50
NOTIFICATION_BATCH_SIZE=100
NOTIFICATION_BATCH_TIMEOUT=5000

ACTIVITY_RETENTION_DAYS=90
ACTIVITY_INDEX_CLEANUP_INTERVAL=86400000

PRESENCE_TIMEOUT=300000
PRESENCE_CLEANUP_INTERVAL=600000
```

---

## 📚 Documentation References

- **Main Design:** [PHASE_3A_START_HERE.md](PHASE_3A_START_HERE.md)
- **Phase 2 Complete:** [PHASE_2_DEPLOYMENT_COMPLETE.md](PHASE_2_DEPLOYMENT_COMPLETE.md)
- **Phase 2D (Job Queue):** [PHASE_2D_COMPLETE.md](PHASE_2D_COMPLETE.md)
- **Database Schema:** Migration 009 (`migrations/009_create_notifications_tables.js`)

---

## ✅ Verification Checklist

Before starting next phase:

- [ ] All 4 services created (2,310+ lines)
- [ ] Migration 009 created and verified
- [ ] Environment variables configured
- [ ] Database schema created (run migration)
- [ ] No TypeScript/lint errors
- [ ] Services export properly
- [ ] JSDoc comments complete

---

## 🎯 Success Criteria

Phase 3A is complete when:

1. ✓ All 4 core services working (SocketService, NotificationService, ActivityService, PresenceService)
2. ✓ 50+ tests passing with 72%+ coverage
3. ✓ Database migrations executed successfully
4. ✓ WebSocket connections handling 100+ concurrent users
5. ✓ Notifications persisting and retrievable
6. ✓ Activity logs accurate with timestamps
7. ✓ Real-time presence tracking working
8. ✓ Frontend components receiving live updates
9. ✓ All performance targets met (see PHASE_3A_START_HERE.md)

---

**Ready to begin Phase 3A.1 (Controllers)? Let's continue! 🚀**
