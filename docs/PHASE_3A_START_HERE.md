# 🚀 Phase 3A: Real-time Notifications System
## WebSocket Integration & Live Updates

**Status:** 📋 Planning  
**Estimated Lines of Code:** 1,500+  
**Estimated Test Count:** 50+  
**Target Coverage:** 72%+  
**Timeline:** Phase 2 Complete → Phase 3A → Phase 3B  

---

## 📊 Executive Summary

Phase 3A introduces **real-time push notifications** to the Episode system using WebSocket connections. Users will receive **instant updates** about:
- ✅ Job progress (async uploads, processing, exports)
- ✅ Episode changes made by other users
- ✅ Admin alerts and system notifications
- ✅ Activity feeds (who did what, when)
- ✅ Live collaboration presence

### Key Metrics
- **WebSocket Server:** Socket.IO (fallback to polling)
- **Connection Pool:** 500+ concurrent users (configurable)
- **Message Latency:** <500ms
- **Reconnection Strategy:** Exponential backoff (similar to Phase 2D)
- **Database:** PostgreSQL for persistence
- **Memory:** Redis support (optional, for scaling)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT LAYER (Frontend)                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  React Components with Socket.IO Client             │   │
│  │  - ProgressBars (upload/export)                     │   │
│  │  - NotificationCenter (popups/badges)               │   │
│  │  - ActivityFeed (live timeline)                     │   │
│  │  - CollaborationIndicators (who's online)           │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬─────────────────────────────────────────┘
                     │ WebSocket
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                   GATEWAY LAYER (Backend)                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Socket.IO Server (port 3002)                       │   │
│  │  - Connection Management                            │   │
│  │  - Room Management (by user/episode/group)          │   │
│  │  - Namespace routing (/jobs, /episodes, /admin)     │   │
│  │  - Reconnection handling                            │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬─────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┬──────────────┐
        ↓                         ↓              ↓
┌──────────────────┐    ┌─────────────────┐  ┌───────────┐
│ NotificationSvc  │    │ ActivityService │  │ Presence  │
│ - Send events    │    │ - Log changes   │  │ Service   │
│ - Rate limiting  │    │ - Track edits   │  │ - Online  │
│ - Persistence    │    │ - Audit trail   │  │ - Status  │
└────────┬─────────┘    └────────┬────────┘  └─────┬─────┘
         │                       │                 │
         └───────────────────────┼─────────────────┘
                                 ↓
                    ┌─────────────────────────┐
                    │  PostgreSQL Database    │
                    │  ┌────────────────────┐ │
                    │  │ notifications      │ │
                    │  │ activity_logs      │ │
                    │  │ user_presence      │ │
                    │  │ notification_prefs │ │
                    │  └────────────────────┘ │
                    └─────────────────────────┘
```

---

## 🎯 Core Components

### 1. **Socket.IO Server** (`src/services/SocketService.js`)
- Initialize Socket.IO with Express
- Namespace management (`/jobs`, `/episodes`, `/admin`, `/feed`)
- Authentication middleware (verify JWT token)
- Connection/disconnection handlers
- Room management (user-specific, episode-specific, broadcast)
- Reconnection logic with exponential backoff

**Key Methods:**
```javascript
class SocketService {
  initialize(httpServer)           // Setup Socket.IO
  authenticate(socket, token)      // Verify JWT
  joinRoom(socket, roomId)         // Subscribe to room
  leaveRoom(socket, roomId)        // Unsubscribe
  broadcast(event, data)           // All connected clients
  toRoom(roomId, event, data)      // Specific room
  toUser(userId, event, data)      // Direct user notification
  getConnectedUsers()              // List active users
  getUserSockets(userId)           // Get all user connections
  closeConnection(socketId)        // Force disconnect
}
```

### 2. **Notification Service** (`src/services/NotificationService.js`)
- Queue notifications for delivery
- Persistence to database
- Rate limiting (prevent spam)
- Priority levels (critical, high, normal, low)
- Notification preferences (per user)
- Webhook support for external systems

**Key Methods:**
```javascript
class NotificationService {
  async createNotification(type, data, recipients)  // Create + send
  async getNotifications(userId, limit)             // Fetch user's
  async markAsRead(notificationId)                  // Mark read
  async deleteNotification(notificationId)          // Delete
  async updatePreferences(userId, prefs)            // Settings
  async getPreferences(userId)                      // Get settings
  async sendBatch(notifications)                    // Batch send
  async getRateLimitStatus(userId)                  // Check quota
}
```

### 3. **Activity Service** (`src/services/ActivityService.js`)
- Log all user actions (create, update, delete, approve, etc.)
- Generate activity feeds
- Track who did what, when, from where
- Support filtering by type/user/resource/date
- Enable real-time activity streaming

**Key Methods:**
```javascript
class ActivityService {
  async logActivity(type, userId, resourceType, resourceId, changes, metadata)
  async getActivityFeed(userId, filters, limit, offset)        // User's feed
  async getResourceActivity(resourceType, resourceId, limit)    // Resource history
  async getTeamActivity(teamId, filters, limit, offset)         // Team activity
  async getActivityStats(startDate, endDate)                    // Aggregations
  async searchActivityLogs(query, filters)                      // Full-text search
}
```

### 4. **Presence Service** (`src/services/PresenceService.js`)
- Track online/offline status
- Store last activity timestamp
- Support status messages (away, busy, do not disturb)
- Enable "who's viewing this episode" feature
- Cleanup stale presence data

**Key Methods:**
```javascript
class PresenceService {
  async setUserOnline(userId, socketId)             // Mark online
  async setUserOffline(userId, socketId)            // Mark offline
  async setUserStatus(userId, status, message)      // Set custom status
  async getUserStatus(userId)                       // Get status
  async getOnlineUsers(count)                       // List active users
  async getResourceViewers(resourceType, resourceId)// Who's viewing
  async updateLastActivity(userId)                  // Update timestamp
  async cleanupStalePresence(maxIdleTime)           // Remove old entries
}
```

### 5. **WebSocket Controller** (`src/controllers/socketController.js`)
- REST endpoints to manage Socket.IO programmatically
- Admin actions (broadcast messages, disconnect users, etc.)
- Statistics and monitoring endpoints
- Connection diagnostics

**Endpoints:**
```
POST   /api/v1/socket/broadcast         # Admin: send to all users
POST   /api/v1/socket/notify-user/:id   # Admin: notify specific user
POST   /api/v1/socket/notify-room/:id   # Admin: notify room
GET    /api/v1/socket/stats             # Get socket server stats
GET    /api/v1/socket/connections       # List active connections
POST   /api/v1/socket/disconnect/:id    # Force disconnect
GET    /api/v1/notifications            # Get user's notifications
POST   /api/v1/notifications/:id/read   # Mark as read
DELETE /api/v1/notifications/:id        # Delete notification
GET    /api/v1/activity-feed            # Get activity feed
GET    /api/v1/presence/online-users    # List online users
POST   /api/v1/presence/status          # Set user status
```

---

## 📊 Database Schema

### `notifications` Table
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  data JSONB DEFAULT '{}',
  read_at TIMESTAMP,
  priority VARCHAR(20) DEFAULT 'normal',
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_read ON notifications(user_id, read_at);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX idx_notifications_expires ON notifications(expires_at);
```

### `activity_logs` Table
```sql
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  action_type VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  resource_name VARCHAR(255),
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_activity_user_created ON activity_logs(user_id, created_at DESC);
CREATE INDEX idx_activity_resource ON activity_logs(resource_type, resource_id);
CREATE INDEX idx_activity_action ON activity_logs(action_type);
CREATE INDEX idx_activity_created ON activity_logs(created_at DESC);
```

### `user_presence` Table
```sql
CREATE TABLE user_presence (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'online',
  status_message VARCHAR(255),
  last_activity_at TIMESTAMP DEFAULT NOW(),
  current_resource_type VARCHAR(50),
  current_resource_id UUID,
  socket_ids TEXT[],
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_presence_status ON user_presence(status);
CREATE INDEX idx_presence_activity ON user_presence(last_activity_at DESC);
```

### `notification_preferences` Table
```sql
CREATE TABLE notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_on_job_complete BOOLEAN DEFAULT true,
  email_on_episode_update BOOLEAN DEFAULT true,
  email_on_mention BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  in_app_enabled BOOLEAN DEFAULT true,
  digest_frequency VARCHAR(20) DEFAULT 'daily',
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  muted_notifications TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🎮 Event Types & Payloads

### Job Queue Events (`/jobs` namespace)

**Event: `job:created`**
```json
{
  "jobId": "uuid",
  "jobType": "thumbnail-generation",
  "status": "pending",
  "progress": 0,
  "createdAt": "2025-01-07T..."
}
```

**Event: `job:progress`**
```json
{
  "jobId": "uuid",
  "status": "processing",
  "progress": 45,
  "message": "Processing 45 of 100 items",
  "eta": "2025-01-07T12:30:00Z"
}
```

**Event: `job:completed`**
```json
{
  "jobId": "uuid",
  "status": "completed",
  "progress": 100,
  "results": {
    "processed": 100,
    "failed": 0,
    "duration": 125000
  },
  "completedAt": "2025-01-07T..."
}
```

**Event: `job:failed`**
```json
{
  "jobId": "uuid",
  "status": "failed",
  "error": "Storage quota exceeded",
  "retryCount": 1,
  "nextRetryAt": "2025-01-07T12:35:00Z"
}
```

### Episode Events (`/episodes` namespace)

**Event: `episode:updated`**
```json
{
  "episodeId": "uuid",
  "title": "New Title",
  "changedBy": "user-id",
  "changedByName": "John Doe",
  "changes": {
    "title": ["Old Title", "New Title"],
    "status": ["draft", "published"]
  },
  "timestamp": "2025-01-07T..."
}
```

**Event: `episode:deleted`**
```json
{
  "episodeId": "uuid",
  "title": "Episode Title",
  "deletedBy": "user-id",
  "timestamp": "2025-01-07T..."
}
```

### Admin Events (`/admin` namespace)

**Event: `admin:alert`**
```json
{
  "severity": "high",
  "category": "system",
  "message": "Queue processing rate degraded",
  "details": { "avgLatency": 2500 },
  "timestamp": "2025-01-07T..."
}
```

### Activity Feed Events (`/feed` namespace)

**Event: `feed:activity`**
```json
{
  "activityId": "uuid",
  "userId": "user-uuid",
  "userName": "John Doe",
  "action": "updated",
  "resourceType": "episode",
  "resourceId": "episode-uuid",
  "resourceName": "Episode Title",
  "timestamp": "2025-01-07T..."
}
```

---

## 🧪 Testing Strategy (50+ Tests)

### Unit Tests (20 tests)
- `NotificationService` (8 tests)
  - createNotification, markAsRead, getNotifications
  - Rate limiting logic
  - Preference filtering
  
- `ActivityService` (6 tests)
  - logActivity, getActivityFeed
  - Filtering and searching
  
- `PresenceService` (6 tests)
  - setUserOnline/Offline, getStatus
  - Resource viewers, stale cleanup

### Integration Tests (30+ tests)
- Socket.IO server (12 tests)
  - Connection auth, room management
  - Event broadcasting, reconnection
  
- Notification delivery (10 tests)
  - Persistence + delivery, preferences
  - Batch operations, cleanup
  
- Activity logging (8 tests)
  - Full workflow, filtering, timestamps

---

## 📋 Implementation Phases

### Phase 3A.1: Foundation (Days 1-2)
- [x] Create SocketService with Socket.IO initialization
- [x] Implement authentication middleware for WebSocket
- [x] Setup namespace routing
- [x] Create database migrations (3 new tables)
- [ ] Write unit tests for SocketService

### Phase 3A.2: Core Services (Days 3-4)
- [ ] Create NotificationService (create, send, persist, preferences)
- [ ] Create ActivityService (log, feed, search)
- [ ] Create PresenceService (online tracking, status)
- [ ] Write unit tests (20+ tests)
- [ ] Write integration tests (15+ tests)

### Phase 3A.3: Controllers & Events (Days 5-6)
- [ ] Create socketController with REST endpoints
- [ ] Setup event emitters for Job/Episode/Admin events
- [ ] Implement client-side Socket.IO integration
- [ ] Create React components (NotificationCenter, ActivityFeed, etc.)
- [ ] Write integration tests (15+ tests)

### Phase 3A.4: Documentation & Deployment (Day 7)
- [ ] Create PHASE_3A_COMPLETE.md
- [ ] Database migrations verified
- [ ] Full test suite passing (50+)
- [ ] Performance benchmarks
- [ ] Deployment guide

---

## ⚙️ Configuration

### Environment Variables
```bash
# Socket.IO Configuration
SOCKET_PORT=3002
SOCKET_CORS_ORIGIN=http://localhost:5173
SOCKET_CORS_CREDENTIALS=true
MAX_SOCKET_CONNECTIONS=500
SOCKET_RECONNECTION_DELAY=1000
SOCKET_RECONNECTION_MAX_DELAY=5000

# Notification Configuration
NOTIFICATION_RETENTION_DAYS=30
NOTIFICATION_RATE_LIMIT=50        # per hour per user
NOTIFICATION_BATCH_SIZE=100
NOTIFICATION_BATCH_TIMEOUT=5000   # milliseconds

# Activity Configuration
ACTIVITY_RETENTION_DAYS=90
ACTIVITY_INDEX_CLEANUP_INTERVAL=86400000  # daily
ACTIVITY_BATCH_LOG=true

# Presence Configuration
PRESENCE_TIMEOUT=300000            # 5 minutes idle = offline
PRESENCE_CLEANUP_INTERVAL=600000   # cleanup every 10 minutes
```

---

## 🚀 Quick Start

### 1. Create Database Migrations
```bash
npm run migrate:create -- --name 009_create_notifications_tables
```

### 2. Create Service Files
```
src/services/SocketService.js
src/services/NotificationService.js
src/services/ActivityService.js
src/services/PresenceService.js
src/controllers/socketController.js
```

### 3. Update Main Server File
```javascript
// src/server.js
const { createServer } = require('http');
const SocketService = require('./services/SocketService');

const httpServer = createServer(app);
const socketService = new SocketService();
socketService.initialize(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### 4. Install Dependencies
```bash
npm install socket.io socket.io-client
```

### 5. Run Tests
```bash
npm test -- tests/unit/services/notification.test.js
npm test -- tests/integration/socket.test.js
```

---

## 📊 Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Connection Setup | <100ms | JWT auth + room join |
| Message Latency | <500ms | From server emit to client receive |
| Max Concurrent Users | 500 | Per server instance |
| Memory per Connection | <50KB | Socket + metadata |
| Reconnection Time | <2s | With exponential backoff |
| Notification Delivery | 99.9% | With persistence fallback |
| Activity Log Throughput | 10K logs/hour | Per server |

---

## 🔒 Security Considerations

1. **Authentication:** JWT token verification on every Socket.IO connection
2. **Authorization:** User isolation (users only see their own data + public feeds)
3. **Rate Limiting:** 50 notifications/hour per user to prevent spam
4. **Data Validation:** Sanitize all message payloads
5. **CORS:** Strict origin validation for WebSocket connections
6. **Encryption:** Use WSS (WebSocket Secure) in production
7. **Token Refresh:** Re-authenticate on token expiry

---

## 📚 Related Documentation

- **Phase 2 Complete:** [PHASE_2_DEPLOYMENT_COMPLETE.md](PHASE_2_DEPLOYMENT_COMPLETE.md)
- **Phase 2D (Job Queue):** [PHASE_2D_COMPLETE.md](PHASE_2D_COMPLETE.md)
- **Phase 3B (Advanced Scheduling):** Coming next

---

## ✅ Verification Checklist

After Phase 3A completion, verify:
- [ ] WebSocket connections working for 100+ concurrent users
- [ ] Notifications persisted and retrievable
- [ ] Activity logs accurate with correct timestamps
- [ ] User presence tracking online/offline status
- [ ] All 50+ tests passing with 72%+ coverage
- [ ] Database migrations executed without errors
- [ ] Performance benchmarks met (see targets above)
- [ ] Frontend components rendering notifications in real-time
- [ ] Job progress updates flowing through WebSocket
- [ ] Admin alerts generating and delivering

---

**Next:** [Begin Phase 3A Implementation](#-implementation-phases)
