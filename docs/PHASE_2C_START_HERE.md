# Phase 2C - OpenSearch Full-Text Search Implementation

## Overview

Phase 2C implements full-text search capabilities using AWS OpenSearch, enabling users to search across episodes, compositions, and metadata with advanced filtering, faceting, and ranking.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend Search UI                            │
│              (Search input, filters, results)                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Layer                                     │
│  POST /api/v1/search - Execute search                           │
│  GET  /api/v1/search/suggestions - Auto-complete               │
│  POST /api/v1/search/advanced - Advanced search with filters   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              SearchService (OpenSearch Client)                   │
│  - Index management (create, update, delete)                    │
│  - Query building (match, bool, agg, range)                     │
│  - Result mapping (format results, apply RBAC)                  │
│  - Fallback to PostgreSQL if OpenSearch unavailable             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                  ┌──────┴──────┐
                  ▼             ▼
         ┌──────────────┐  ┌──────────────┐
         │ OpenSearch   │  │ PostgreSQL   │
         │ (Primary)    │  │ (Fallback)   │
         └──────────────┘  └──────────────┘
```

## Components

### 1. OpenSearchService (`src/services/OpenSearchService.js`)

**Responsibilities:**
- Connection management to OpenSearch domain
- Index lifecycle management
- Query execution and result formatting
- Fallback to PostgreSQL
- Bulk operations for sync

**Key Methods:**
- `createIndex(indexName, mapping)` - Create search index with schema
- `updateDocument(indexName, docId, doc)` - Index single document
- `bulkIndex(indexName, documents)` - Bulk index for performance
- `search(indexName, query, options)` - Execute search with filters
- `suggest(indexName, text)` - Auto-complete suggestions
- `deleteIndex(indexName)` - Remove index
- `deleteDocument(indexName, docId)` - Remove document

### 2. SearchController (`src/controllers/searchController.js`)

**Endpoints:**
- `POST /api/v1/search` - Full-text search
- `GET /api/v1/search/suggestions` - Type-ahead auto-complete
- `POST /api/v1/search/advanced` - Advanced search with facets
- `GET /api/v1/search/recent` - Recent searches
- `POST /api/v1/search/saved` - Save search

**Features:**
- Query parsing and validation
- RBAC filtering (show only accessible episodes)
- Pagination and sorting
- Facet aggregation (status, categories, dates)
- Query logging for analytics

### 3. Index Management

**Episode Index** (`episodes` index):
```json
{
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "title": { "type": "text", "analyzer": "standard" },
      "description": { "type": "text" },
      "categories": { "type": "keyword" },
      "status": { "type": "keyword" },
      "createdAt": { "type": "date" },
      "tags": { "type": "text", "analyzer": "standard" }
    }
  }
}
```

**Composition Index** (`compositions` index):
- Similar structure for thumbnail compositions
- Additional fields: videoStatus, templateId

### 4. Query Examples

**Basic Search:**
```json
{
  "query": {
    "multi_match": {
      "query": "test",
      "fields": ["title^2", "description", "tags"]
    }
  }
}
```

**Advanced Search with Filters:**
```json
{
  "query": {
    "bool": {
      "must": [
        { "match": { "title": "test" } }
      ],
      "filter": [
        { "term": { "status": "published" } },
        { "range": { "createdAt": { "gte": "2025-01-01" } } }
      ]
    }
  },
  "aggs": {
    "by_status": { "terms": { "field": "status" } },
    "by_date": { "date_histogram": { "field": "createdAt", "interval": "month" } }
  }
}
```

## Implementation Phases

### Phase 2C-1: OpenSearchService (8 hours)
- ✅ Connection pooling
- ✅ Index management
- ✅ Query building
- ✅ Error handling
- ✅ PostgreSQL fallback
- Tests: 25+ unit tests

### Phase 2C-2: Search API (6 hours)
- ✅ SearchController endpoints
- ✅ Query validation
- ✅ RBAC filtering
- ✅ Pagination
- ✅ Faceting
- Tests: 35+ integration tests

### Phase 2C-3: Index Sync (4 hours)
- ✅ Initial bulk index load
- ✅ Change events (create/update/delete)
- ✅ Scheduled sync jobs
- ✅ Index health monitoring
- Tests: 20+ tests

### Phase 2C-4: Advanced Features (6 hours)
- ✅ Auto-complete suggestions
- ✅ Spell checking
- ✅ Query analytics
- ✅ Saved searches
- ✅ Search history
- Tests: 15+ tests

## Implementation Checklist

### OpenSearchService
- [ ] Connection to OpenSearch domain (brd-opensearch-dev)
- [ ] Index templates for episode and composition
- [ ] Query DSL building (match, bool, range, aggs)
- [ ] Result formatting and pagination
- [ ] Error handling with fallback to PostgreSQL
- [ ] Bulk operations for performance
- [ ] Connection pooling and retry logic

### SearchController
- [ ] POST /api/v1/search endpoint
- [ ] GET /api/v1/search/suggestions endpoint
- [ ] POST /api/v1/search/advanced endpoint
- [ ] RBAC enforcement (filter by user access)
- [ ] Query validation and sanitization
- [ ] Pagination parameters
- [ ] Error responses

### Database Integration
- [ ] Indexing on search table (query, user_id, timestamp)
- [ ] Saved searches table
- [ ] Search analytics table
- [ ] Migration scripts

### Tests
- [ ] 25+ OpenSearchService unit tests
- [ ] 35+ SearchController integration tests
- [ ] 20+ Index sync tests
- [ ] 15+ Advanced feature tests
- [ ] Total: 95+ tests
- [ ] Coverage target: 72.5%

## Features Implemented

| Feature | Status | Tests | Notes |
|---------|--------|-------|-------|
| Full-text search | ✅ Planned | 15 | Match across title, description |
| Advanced filters | ✅ Planned | 12 | Status, date range, categories |
| Faceted search | ✅ Planned | 8 | Aggregate by status, category, date |
| Auto-complete | ✅ Planned | 8 | Prefix-based suggestions |
| Query history | ✅ Planned | 12 | Track search queries per user |
| Saved searches | ✅ Planned | 10 | Save/restore search criteria |
| Ranking | ✅ Planned | 10 | Boost recent, popular, exact matches |
| RBAC | ✅ Planned | 12 | Filter by user access level |
| PostgreSQL fallback | ✅ Planned | 8 | Text search if OpenSearch down |

## File Structure

```
src/
├── services/
│   └── OpenSearchService.js           # OpenSearch operations
├── controllers/
│   └── searchController.js            # Search endpoints
├── routes/
│   └── search.js                      # Search routes
├── middleware/
│   └── searchValidation.js            # Query validation
└── models/
    ├── Search.js                      # Search history model
    └── SavedSearch.js                 # Saved searches model

tests/
├── unit/
│   └── services/
│       └── openSearchService.test.js  # 25+ tests
├── integration/
│   └── search.test.js                 # 35+ tests
└── e2e/
    └── search.e2e.test.js             # 10+ tests

migrations/
└── 007_create_search_tables.js        # Search history and saved searches
```

## API Specifications

### POST /api/v1/search
Search for episodes and compositions

**Request:**
```json
{
  "q": "test query",
  "filters": {
    "status": "published",
    "category": "documentary",
    "dateRange": {
      "start": "2025-01-01",
      "end": "2025-12-31"
    }
  },
  "page": 1,
  "limit": 20,
  "sort": "relevance"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 42,
    "hits": [
      {
        "id": "uuid",
        "title": "Test Episode",
        "description": "...",
        "status": "published",
        "score": 0.95
      }
    ],
    "facets": {
      "status": [
        { "value": "published", "count": 30 },
        { "value": "draft", "count": 12 }
      ],
      "categories": [...]
    }
  }
}
```

### GET /api/v1/search/suggestions
Auto-complete suggestions

**Request:** `GET /api/v1/search/suggestions?q=tes`

**Response:**
```json
{
  "suggestions": [
    "test episode",
    "test documentary",
    "testing series"
  ]
}
```

### POST /api/v1/search/advanced
Advanced search with complex filters

**Request:**
```json
{
  "mustMatch": ["title:test"],
  "shouldMatch": ["description:test"],
  "mustNotMatch": ["status:deleted"],
  "filters": {
    "status": ["published", "approved"],
    "categories": ["documentary"],
    "createdAfter": "2025-01-01"
  }
}
```

## Deployment Checklist

Before moving to Phase 2D:

- [ ] OpenSearchService fully implemented
- [ ] All 95+ tests passing
- [ ] Coverage at 72.5%+
- [ ] Search indexes created
- [ ] Initial bulk index load completed
- [ ] Fallback to PostgreSQL tested
- [ ] API documentation updated
- [ ] Performance benchmarks recorded (response time < 500ms for typical query)

## Known Limitations

1. **Index refresh**: 1-5 second lag between document update and search visibility
2. **Query complexity**: Very complex boolean queries may timeout
3. **Pagination limit**: Maximum 10,000 documents per request (ES limitation)
4. **Cost**: Each search query incurs OpenSearch costs

## Performance Targets

- Search response time: < 500ms (95th percentile)
- Suggestion response time: < 200ms
- Bulk index load: < 30 seconds for 1000 documents
- Index size: < 500MB for typical data set

## Monitoring

Track the following metrics:
- Search query count (queries/hour)
- Average query latency (ms)
- OpenSearch cluster health
- Fallback to PostgreSQL rate
- Index sync lag

---

**Next Phase:** Phase 2D - Job Queue Service (SQS processing)
