## Phase 4A - Advanced Search Integration

**Scope**: Full-text search on activity logs, advanced episode search, and search optimization  
**Duration**: 1 week (5 working days)  
**Priority**: High (enables audit trail discovery)  
**Status**: Ready to Begin

---

## 🎯 Phase 4A Objectives

### Primary Goals
1. Index and search activity logs with advanced filtering
2. Enhance episode search with full-text capabilities
3. Implement search performance optimization
4. Provide audit trail search API

### Secondary Goals
- Add search suggestions/autocomplete
- Implement search faceting
- Create search analytics (what users search for)
- Add saved searches feature (stretch goal)

---

## 📋 Detailed Requirements

### 4A.1: Activity Log Indexing Service

**Purpose**: Enable searching through activity logs with complex filters

**Components**:
```javascript
// File: src/services/ActivityIndexService.js (220 lines)
class ActivityIndexService {
  // Index operations
  async indexActivity(activity)        // Index single activity
  async bulkIndexActivities(activities) // Batch indexing
  async reindexAll()                  // Full reindex

  // Search operations
  async search(query, filters)         // Search with filters
  async searchByUser(userId, options)  // Activities by user
  async searchByAction(actionType, options) // Activities by action
  async searchByEpisode(episodeId, options) // Activities by episode
  async searchByDateRange(startDate, endDate) // Date range search

  // Aggregation
  async getActivityStats(options)      // Activity statistics
  async getUserStats(userId)           // User activity stats
  async getActionStats(actionType)     // Action statistics
}
```

**Requirements**:
- ✅ Use OpenSearch (Phase 2C)
- ✅ Index on new activity creation
- ✅ Support bulk reindexing
- ✅ Handle stale index recovery
- ✅ Fallback to database if OpenSearch unavailable

**Search Filters Supported**:
1. By User ID (exact match)
2. By Action Type (created, updated, deleted, etc.)
3. By Episode ID (exact match)
4. By Date Range (from/to timestamps)
5. By Resource Type (Episode, Job, File)
6. By User Role (admin, editor, viewer)
7. By Status (success, error)
8. By Free-text (message/description)

**Performance Targets**:
- Search response: < 100ms (p95)
- Bulk indexing: < 50ms per 100 activities
- Reindex all: < 30 seconds for 100K+ records

**Database Schema Changes**:
```sql
-- Activity Log Indexes (optimization)
CREATE INDEX idx_activity_user_date ON activity_logs(user_id, created_at DESC);
CREATE INDEX idx_activity_action_type ON activity_logs(action_type, created_at DESC);
CREATE INDEX idx_activity_episode_id ON activity_logs(episode_id, created_at DESC);
CREATE INDEX idx_activity_resource_type ON activity_logs(resource_type, created_at DESC);
```

**Integration Points**:
- Hook into ActivityService (Phase 3A.4)
- Called when activity_logs table receives new records
- Non-blocking (fire-and-forget indexing)
- Fallback to database queries if indexing fails

---

### 4A.2: Advanced Search API

**Purpose**: Provide REST endpoints for activity and episode search

**Endpoints**:
```
GET /api/v1/search/activities
  Query Params:
    - q: free-text query
    - user_id: filter by user
    - action_type: created|updated|deleted|error
    - episode_id: filter by episode
    - resource_type: Episode|Job|File
    - from_date: ISO timestamp
    - to_date: ISO timestamp
    - limit: 10-100 (default 20)
    - offset: pagination offset
    - sort: created_at|relevance (default created_at)
  Returns: {
    data: Activity[],
    total: number,
    page: number,
    page_size: number,
    facets: { actionTypes: [], users: [], episodes: [] }
  }

GET /api/v1/search/episodes
  Query Params:
    - q: search in title, description, tags
    - status: draft|review|approved|published
    - created_by: user_id
    - tags: comma-separated
    - from_date, to_date
    - limit, offset
    - sort: created_at|updated_at|relevance
  Returns: {
    data: Episode[],
    total: number,
    suggestions: string[] // autocomplete suggestions
  }

GET /api/v1/search/audit-trail/:episodeId
  Query Params:
    - from_date, to_date
    - action_type: filter
    - limit, offset
  Returns: {
    data: Activity[],
    total: number,
    summary: {
      created_at: string,
      updated_at: string,
      modified_by: string,
      change_count: number
    }
  }

GET /api/v1/search/suggestions
  Query Params:
    - q: search query (min 2 chars)
    - type: activity|episode|user|action (default all)
  Returns: {
    activities: string[],
    episodes: string[],
    users: { id, name }[],
    actions: string[]
  }

POST /api/v1/search/saved-searches (stretch)
  Body: {
    name: string,
    query: string,
    filters: object,
    is_public: boolean
  }
  Returns: SavedSearch

GET /api/v1/search/saved-searches
  Returns: SavedSearch[]
```

**Implementation File**: `src/controllers/searchController.js` (180 lines)

**Response Format Example**:
```javascript
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "action_type": "created",
      "episode_id": "uuid",
      "resource_type": "Episode",
      "description": "Episode 'Series S01E01' created",
      "metadata": {
        "episode_title": "Pilot Episode",
        "episode_status": "draft"
      },
      "created_at": "2024-01-15T10:30:00Z",
      "user": {
        "id": "uuid",
        "name": "John Doe",
        "email": "john@example.com"
      }
    }
  ],
  "pagination": {
    "total": 1250,
    "page": 1,
    "page_size": 20,
    "pages": 63
  },
  "facets": {
    "action_types": [
      { "value": "created", "count": 450 },
      { "value": "updated", "count": 580 },
      { "value": "deleted", "count": 220 }
    ],
    "users": [
      { "id": "uuid", "name": "John Doe", "count": 320 }
    ],
    "episodes": [
      { "id": "uuid", "title": "S01E01", "count": 45 }
    ]
  }
}
```

**Error Handling**:
- Invalid date range: 400 Bad Request
- Unsupported filter: 400 Bad Request
- Search timeout: 504 Gateway Timeout (fallback to DB)
- OpenSearch unavailable: Use PostgreSQL fallback

---

### 4A.3: Episode Full-Text Search

**Purpose**: Enable searching episodes by content, not just metadata

**Enhancement to episodeSearch()** (add to Phase 2C OpenSearchService):
```javascript
async searchEpisodes(query, options = {}) {
  // Multi-field search
  // Fields: title, description, tags, keywords, transcript (optional)
  // Fuzzy matching for typos
  // Synonyms support (e.g., "movie" = "film")
  // Highlight matching terms in results
  
  const results = await this.client.search({
    index: 'episodes',
    body: {
      query: {
        multi_match: {
          query: query,
          fields: ['title^3', 'description^2', 'tags', 'keywords'],
          fuzziness: 'AUTO',
          operator: 'or'
        }
      },
      highlight: {
        fields: {
          title: {},
          description: {},
          tags: {}
        }
      },
      size: options.limit || 20,
      from: options.offset || 0
    }
  });
  
  return this.formatSearchResults(results);
}
```

**Features**:
- ✅ Full-text search across multiple fields
- ✅ Fuzzy matching (typo tolerance)
- ✅ Synonym support
- ✅ Term highlighting in results
- ✅ Boost important fields (title > description)
- ✅ Faceted results

**Search Boosting**:
```
Title: 3x weight
Description: 2x weight
Tags: 1.5x weight
Keywords: 1x weight
```

---

### 4A.4: Search Analytics

**Purpose**: Understand user search behavior

**Tracking**:
```javascript
// Log search queries (non-sensitive)
class SearchAnalytics {
  async trackSearch(query, filters, resultCount, userId) {
    // Store in search_analytics table
    // Don't store if query contains sensitive words
  }
  
  async getMostSearched(timeRange = '7d') {
    // Get top search queries
  }
  
  async getSearchTrends() {
    // Search volume over time
  }
  
  async getNoResultsSearches() {
    // Queries returning 0 results (improvement opportunity)
  }
}
```

**Database Table**:
```sql
CREATE TABLE search_analytics (
  id UUID PRIMARY KEY,
  query VARCHAR(500),
  filters JSONB,
  result_count INTEGER,
  user_id UUID,
  search_type VARCHAR(50), -- 'activity' | 'episode'
  response_time_ms INTEGER,
  timestamp TIMESTAMP,
  INDEX idx_search_user_date (user_id, timestamp)
);
```

---

## 🧪 Testing Requirements

### Unit Tests (30+ tests)
```javascript
// ActivityIndexService tests
- ✅ Index single activity successfully
- ✅ Bulk index multiple activities
- ✅ Handle indexing errors gracefully
- ✅ Reindex all records
- ✅ Search with single filter
- ✅ Search with multiple filters
- ✅ Search with date range
- ✅ Handle empty results
- ✅ Fallback to database on error
- ✅ Performance: search < 100ms
- ✅ Aggregation queries

// Search Controller tests
- ✅ GET /search/activities - success
- ✅ GET /search/activities - invalid filter
- ✅ GET /search/activities - pagination
- ✅ GET /search/episodes - full-text search
- ✅ GET /search/audit-trail/:id
- ✅ GET /search/suggestions
- ✅ Authentication required
- ✅ Rate limiting (if applicable)
```

### Integration Tests (20+ tests)
```javascript
// End-to-end search flow
- ✅ Create activity -> index -> search -> verify
- ✅ Bulk activities -> batch index -> search
- ✅ Search with complex filters
- ✅ Date range filtering
- ✅ Autocomplete suggestions
- ✅ No results handling
- ✅ Performance under load
- ✅ Fallback to database
- ✅ Real-time index updates
- ✅ Search analytics tracking
```

### Performance Tests
- [ ] 10K+ activities indexed < 30 seconds
- [ ] Search 10K activities < 100ms (p95)
- [ ] Concurrent searches (100 simultaneous)
- [ ] Load testing with realistic queries

---

## 📁 Files to Create/Modify

### New Files
1. `src/services/ActivityIndexService.js` (220 lines)
   - Activity log indexing
   - Search operations
   - Aggregations

2. `src/controllers/searchController.js` (180 lines)
   - Search endpoints
   - Query validation
   - Response formatting

3. `tests/unit/services/activityIndex.test.js` (250 lines)
   - Unit tests

4. `tests/integration/search.test.js` (enhanced from Phase 2C)
   - Activity search tests
   - End-to-end search flows

5. `src/models/SearchAnalytics.js` (100 lines)
   - Analytics tracking

### Modified Files
1. `src/services/OpenSearchService.js` (Phase 2C)
   - Add episode search enhancement
   - Add batch operations
   - Add aggregation support

2. `src/services/ActivityService.js` (Phase 3A.4)
   - Call ActivityIndexService on log creation
   - Non-blocking with .catch()

3. `src/app.js`
   - Register search routes

4. `src/routes/search.js` (create new)
   - Route definitions

### Database Migrations
- Create indexes on activity_logs
- Create search_analytics table (optional)

---

## 🔄 Integration with Phase 3A.4

### ActivityService Hook
```javascript
// In ActivityService.logActivity()
try {
  // ... existing code ...
  
  // Non-blocking index for search
  IndexService.indexActivity(activity).catch(err => {
    logger.warn('Failed to index activity', { 
      activityId: activity.id, 
      error: err.message 
    });
    // Fallback: can be reindexed later
  });
} catch (error) {
  logger.error('Activity logging failed', error);
}
```

### Real-Time Updates
```javascript
// Broadcast search index update event via SocketService
SocketService.broadcast('search_index_updated', {
  type: 'activity',
  count: 1,
  timestamp: new Date()
});
```

---

## 📊 API Response Performance Targets

| Endpoint | Query | P50 | P95 | P99 |
|----------|-------|-----|-----|-----|
| `/search/activities` | 1 filter | 45ms | 85ms | 150ms |
| `/search/activities` | 5 filters | 65ms | 120ms | 250ms |
| `/search/episodes` | keyword | 50ms | 95ms | 180ms |
| `/search/suggestions` | 2-char query | 30ms | 60ms | 120ms |
| `/search/audit-trail` | 3-month range | 80ms | 150ms | 300ms |

---

## 🚀 Rollout Strategy

### Phase 1: Core Implementation (Days 1-2)
- [ ] Create ActivityIndexService
- [ ] Create SearchController
- [ ] Implement database indexes
- [ ] Unit tests

### Phase 2: Integration (Days 3-4)
- [ ] Integrate with ActivityService
- [ ] Add to real-time events
- [ ] Integration tests
- [ ] Performance optimization

### Phase 3: Enhancement (Day 5)
- [ ] Add search analytics
- [ ] Autocomplete/suggestions
- [ ] Documentation
- [ ] Rollout to production

---

## 📝 Documentation

### API Documentation
- OpenAPI/Swagger specs for search endpoints
- Example queries and responses
- Filter syntax guide

### User Guide
- How to search activities
- Advanced filtering syntax
- Saved searches (if implemented)

### Developer Guide
- ActivityIndexService API
- Extension points
- Performance tuning

---

## ✅ Success Criteria

- [ ] All search endpoints working (100%)
- [ ] Search response < 100ms (p95)
- [ ] Advanced filtering with 7+ filter types
- [ ] Unit test coverage > 85%
- [ ] Integration tests pass (20+ tests)
- [ ] Zero blocking operations
- [ ] Fallback to database working
- [ ] Documentation complete

---

## 🎓 Learning Materials

### OpenSearch Documentation
- Query DSL reference
- Aggregations API
- Performance tuning

### Full-Text Search Concepts
- Tokenization and analysis
- Relevance scoring
- Fuzzy matching

---

**Status**: Ready for implementation  
**Next Step**: Begin Phase 4A development  
**Estimated Completion**: 5 working days
