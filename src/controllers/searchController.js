/**
 * SearchController
 * Handles all search operations including activities, episodes, suggestions, and audit trails
 * Part of Phase 4A - Advanced Search Integration
 */

const ActivityIndexService = require('../services/ActivityIndexService');
const _ActivityService = require('../services/ActivityService');
const logger = require('../services/Logger');
const { getPool } = require('../config/database');

const db = getPool();

/**
 * Middleware to authenticate token (if not using centralized middleware)
 */
const validateSearch = (req, res, next) => {
  const { q } = req.query;

  // Ensure query is not excessively long
  if (q && q.length > 1000) {
    return res.status(400).json({
      success: false,
      error: 'Query too long',
      message: 'Search query must be 1000 characters or less',
    });
  }

  next();
};

/**
 * GET /api/v1/search/activities
 * Search activity logs with advanced filtering
 * Query params:
 *   - q: search query (text)
 *   - user_id: filter by user
 *   - action_type: filter by action (create, update, delete, etc)
 *   - episode_id: filter by episode
 *   - resource_type: filter by resource type
 *   - from_date: start date (ISO format)
 *   - to_date: end date (ISO format)
 *   - limit: results per page (default 20, max 100)
 *   - offset: pagination offset (default 0)
 */
exports.searchActivities = [
  validateSearch,
  async (req, res) => {
    try {
      const {
        q = '',
        user_id,
        action_type,
        episode_id,
        resource_type,
        from_date,
        to_date,
        limit = '20',
        offset = '0',
      } = req.query;

      // Log the search for audit
      logger.debug('Activity search initiated', {
        query: q.substring(0, 50),
        filters: { user_id, action_type, episode_id, resource_type },
        userId: req.user?.id,
      });

      // Build filters object
      const filters = {
        user_id,
        action_type,
        episode_id,
        resource_type,
        from_date,
        to_date,
        limit: Math.min(parseInt(limit) || 20, 100),
        offset: Math.max(parseInt(offset) || 0, 0),
      };

      // Perform search
      const results = await ActivityIndexService.search(q, filters);

      // Log successful search
      logger.info('Activity search completed', {
        query: q.substring(0, 30),
        resultCount: results.data.length,
        total: results.total,
        fallback: results.fallback,
      });

      return res.json({
        success: true,
        data: results.data,
        pagination: {
          total: results.total,
          page: results.page,
          page_size: results.page_size,
          pages: Math.ceil(results.total / results.page_size),
          offset: filters.offset,
        },
        facets: results.facets || {},
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Activity search error', {
        error: error.message,
        userId: req.user?.id,
      });

      return res.status(500).json({
        success: false,
        error: 'Search failed',
        message: error.message,
      });
    }
  },
];

/**
 * GET /api/v1/search/episodes
 * Search episodes by title, description, or tags
 * Query params:
 *   - q: search query
 *   - status: filter by status (draft, published, archived)
 *   - tags: comma-separated tags
 *   - limit: results per page
 *   - offset: pagination offset
 */
exports.searchEpisodes = [
  validateSearch,
  async (req, res) => {
    const startTime = Date.now(); // Track search duration
    
    try {
      const { q = '', status, _tags, limit = '20', offset = '0' } = req.query;

      logger.debug('Episode search initiated', {
        query: q.substring(0, 50),
        status,
        userId: req.user?.id,
      });

      const parsedLimit = Math.min(parseInt(limit) || 20, 100);
      const parsedOffset = Math.max(parseInt(offset) || 0, 0);

      let sql =
        'SELECT id, title, description, status, episode_number, created_at FROM episodes WHERE 1=1';
      const params = [];
      let paramIndex = 1;
      let hasSearchQuery = false;

      // Full-text search using GIN index (idx_episodes_fulltext)
      // This is much faster than ILIKE for text searching
      if (q && q.trim().length > 0) {
        // Add relevance ranking to SELECT
        // Note: categories is JSONB, so we convert it to text for full-text search
        sql = sql.replace(
          'SELECT id, title, description, status, episode_number, created_at FROM episodes',
          `SELECT id, title, description, status, episode_number, created_at,
           ts_rank(
             to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(categories::text, '')),
             plainto_tsquery('english', $${paramIndex})
           ) AS search_rank
           FROM episodes`
        );
        sql += ` AND to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(categories::text, '')) @@ plainto_tsquery('english', $${paramIndex})`;
        params.push(q.trim());
        paramIndex++;
        hasSearchQuery = true;
      }

      // Status filter
      if (status) {
        const validStatuses = ['draft', 'published', 'archived'];
        if (validStatuses.includes(status)) {
          sql += ` AND status = $${paramIndex}`;
          params.push(status);
          paramIndex++;
        }
      }

      // Get total count
      // Handle both versions of SELECT clause (with and without search_rank)
      let countSql = sql;
      if (hasSearchQuery) {
        countSql = countSql.replace(
          /SELECT id.*?FROM episodes/s,
          'SELECT COUNT(*) as count FROM episodes'
        );
      } else {
        countSql = countSql.replace(
          'SELECT id, title, description, status, episode_number, created_at FROM episodes',
          'SELECT COUNT(*) as count FROM episodes'
        );
      }
      const countResult = await db.query(countSql, params);
      const total = parseInt(countResult.rows[0].count);

      // Add sorting and pagination
      // Order by relevance if search query exists, otherwise by created_at
      sql += hasSearchQuery
        ? ` ORDER BY search_rank DESC, created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
        : ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(parsedLimit);
      params.push(parsedOffset);

      const result = await db.query(sql, params);

      logger.info('Episode search completed', {
        query: q.substring(0, 30),
        resultCount: result.rowCount,
        total,
      });

      // Log search for analytics
      const searchDuration = Date.now() - startTime;
      await logSearch(req.user?.userId || req.user?.id, q, 'episodes', total, searchDuration, { status: status || null });

      return res.json({
        success: true,
        data: result.rows,
        pagination: {
          total,
          page: Math.floor(parsedOffset / parsedLimit) + 1,
          page_size: parsedLimit,
          pages: Math.ceil(total / parsedLimit),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Episode search error', {
        error: error.message,
        userId: req.user?.id,
      });

      return res.status(500).json({
        success: false,
        error: 'Episode search failed',
        message: error.message,
      });
    }
  },
];

/**
 * GET /api/v1/search/suggestions
 * Get search suggestions based on partial query
 * Query params:
 *   - q: partial search query (minimum 2 characters)
 *   - type: 'activities' or 'episodes' (default: both)
 *   - limit: number of suggestions (default 10, max 50)
 */
exports.searchSuggestions = [
  validateSearch,
  async (req, res) => {
    try {
      const { q = '', type, limit = '10' } = req.query;

      // Validate minimum query length
      if (!q || q.trim().length < 2) {
        return res.json({
          success: true,
          data: [],
          message: 'Query must be at least 2 characters',
        });
      }

      const parsedLimit = Math.min(parseInt(limit) || 10, 50);
      const suggestions = [];

      logger.debug('Suggestions requested', {
        query: q,
        type,
        userId: req.user?.id,
      });

      try {
        // Get activity suggestions
        if (!type || type === 'activities') {
          const activitySuggestions = await ActivityIndexService.getSuggestions(q, parsedLimit);
          if (activitySuggestions.success && activitySuggestions.data) {
            suggestions.push(
              ...activitySuggestions.data.map((s) => ({
                value: s,
                type: 'activity_description',
              }))
            );
          }
        }

        // Get episode suggestions
        if (!type || type === 'episodes') {
          const result = await db.query(
            `
            SELECT DISTINCT title 
            FROM episodes 
            WHERE title ILIKE $1 
            ORDER BY title
            LIMIT $2
            `,
            [`%${q}%`, parsedLimit]
          );

          suggestions.push(
            ...result.rows.map((r) => ({
              value: r.title,
              type: 'episode_title',
            }))
          );
        }

        logger.debug('Suggestions completed', {
          query: q,
          suggestionsCount: suggestions.length,
        });

        return res.json({
          success: true,
          data: suggestions.slice(0, parsedLimit),
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.warn('Failed to get suggestions', { error: error.message });
        return res.json({
          success: true,
          data: [],
          error: error.message,
        });
      }
    } catch (error) {
      logger.error('Suggestions error', {
        error: error.message,
        userId: req.user?.id,
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to get suggestions',
        message: error.message,
      });
    }
  },
];

/**
 * GET /api/v1/search/audit-trail/:id
 * Get detailed audit trail for a specific episode
 * Shows all activities related to the episode
 * URL params:
 *   - id: episode ID
 * Query params:
 *   - action_type: filter by action type
 *   - limit: results per page
 *   - offset: pagination offset
 */
exports.getAuditTrail = [
  async (req, res) => {
    try {
      const { id } = req.params;
      const { action_type, limit = '50', offset = '0' } = req.query;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Missing episode ID',
        });
      }

      logger.debug('Audit trail requested', {
        episodeId: id,
        userId: req.user?.id,
      });

      const parsedLimit = Math.min(parseInt(limit) || 50, 100);
      const parsedOffset = Math.max(parseInt(offset) || 0, 0);

      // Verify episode exists
      const episodeCheck = await db.query('SELECT id FROM episodes WHERE id = $1', [id]);

      if (episodeCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Episode not found',
        });
      }

      // Build search filters
      const filters = {
        episode_id: id,
        action_type,
        limit: parsedLimit,
        offset: parsedOffset,
      };

      // Search for related activities
      const results = await ActivityIndexService.search('', filters);

      // Enhance audit trail with episode and user details
      const enrichedData = await Promise.all(
        results.data.map(async (activity) => {
          try {
            // Get user information if available
            let userName = 'Unknown User';
            if (activity.user_id) {
              // Note: Adjust query based on your user table structure
              const userResult = await db
                .query('SELECT name, email FROM users WHERE id = $1 LIMIT 1', [activity.user_id])
                .catch(() => ({ rows: [] }));

              if (userResult && userResult.rows.length > 0) {
                userName = userResult.rows[0].name || userResult.rows[0].email;
              }
            }

            return {
              ...activity,
              userName,
              timestamp: activity.created_at || activity.timestamp,
            };
          } catch (err) {
            logger.debug('Failed to enrich audit entry', { error: err.message });
            return activity;
          }
        })
      );

      logger.info('Audit trail retrieved', {
        episodeId: id,
        activityCount: enrichedData.length,
        total: results.total,
      });

      return res.json({
        success: true,
        episode_id: id,
        data: enrichedData,
        pagination: {
          total: results.total,
          page: Math.floor(parsedOffset / parsedLimit) + 1,
          page_size: parsedLimit,
          pages: Math.ceil(results.total / parsedLimit),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Audit trail error', {
        error: error.message,
        userId: req.user?.id,
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve audit trail',
        message: error.message,
      });
    }
  },
];

/**
 * GET /api/v1/search/stats
 * Get search statistics (activity types, user counts, etc)
 */
exports.getSearchStats = async (req, res) => {
  try {
    logger.debug('Search stats requested', { userId: req.user?.id });

    const stats = await ActivityIndexService.getStats();

    logger.info('Search stats retrieved');

    return res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Search stats error', { error: error.message });

    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve statistics',
      message: error.message,
    });
  }
};

/**
 * POST /api/v1/search/reindex
 * Reindex all activities (admin only)
 */
exports.reindexActivities = async (req, res) => {
  try {
    // Check admin role (adjust based on your auth implementation)
    if (req.user?.role !== 'admin') {
      logger.warn('Unauthorized reindex attempt', { userId: req.user?.id });
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Only admins can reindex activities',
      });
    }

    logger.info('Reindex started', { userId: req.user?.id });

    const result = await ActivityIndexService.reindexAll();

    logger.info('Reindex completed', {
      indexed: result.indexed,
      userId: req.user?.id,
    });

    return res.json({
      success: true,
      message: 'Reindex completed',
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Reindex error', {
      error: error.message,
      userId: req.user?.id,
    });

    return res.status(500).json({
      success: false,
      error: 'Reindex failed',
      message: error.message,
    });
  }
};

/**
 * GET /api/v1/search/scripts
 * Search episode scripts with full-text search
 * Query params:
 *   - q: search query (searches content, notes, version_label, author)
 *   - episodeId: filter by episode UUID
 *   - scriptType: filter by script type (main, trailer, shorts, etc)
 *   - status: filter by status (draft, final, approved)
 *   - limit: results per page (default 20, max 100)
 *   - offset: pagination offset (default 0)
 */
exports.searchScripts = [
  validateSearch,
  async (req, res) => {
    const startTime = Date.now(); // Track search duration
    
    try {
      const {
        q,
        episodeId,
        scriptType,
        status,
        limit = 20,
        offset = 0,
      } = req.query;

      if (!q || q.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Query required',
          message: 'Search query (q) is required',
        });
      }

      logger.info('Script search initiated', {
        query: q.substring(0, 50),
        episodeId,
        scriptType,
        status,
        userId: req.user?.id,
      });

      const parsedLimit = Math.min(parseInt(limit) || 20, 100);
      const parsedOffset = Math.max(parseInt(offset) || 0, 0);

      // Build SQL query with full-text search
      let sql = `
        SELECT 
          id, 
          episode_id, 
          script_type, 
          version_number,
          version_label,
          author,
          status,
          duration,
          scene_count,
          created_at,
          updated_at,
          is_primary,
          is_latest,
          -- Calculate relevance rank
          ts_rank(
            to_tsvector('english', 
              COALESCE(content, '') || ' ' || 
              COALESCE(version_label, '') || ' ' ||
              COALESCE(author, '') || ' ' ||
              COALESCE(script_type, '')
            ),
            plainto_tsquery('english', $1)
          ) AS search_rank,
          -- Return truncated content preview (first 200 chars)
          SUBSTRING(content, 1, 200) AS content_preview
        FROM episode_scripts 
        WHERE deleted_at IS NULL
          AND to_tsvector('english', 
                COALESCE(content, '') || ' ' || 
                COALESCE(version_label, '') || ' ' ||
                COALESCE(author, '')
              ) @@ plainto_tsquery('english', $1)
      `;

      const params = [q.trim()];
      let paramIndex = 2;

      // Episode filter
      if (episodeId) {
        sql += ` AND episode_id = $${paramIndex}`;
        params.push(episodeId);
        paramIndex++;
      }

      // Script type filter
      if (scriptType) {
        const validTypes = ['main', 'trailer', 'shorts', 'teaser', 'behind-the-scenes', 'bonus-content'];
        if (validTypes.includes(scriptType)) {
          sql += ` AND script_type = $${paramIndex}`;
          params.push(scriptType);
          paramIndex++;
        }
      }

      // Status filter
      if (status) {
        const validStatuses = ['draft', 'final', 'approved'];
        if (validStatuses.includes(status)) {
          sql += ` AND status = $${paramIndex}`;
          params.push(status);
          paramIndex++;
        }
      }

      // Get total count
      const countSql = `
        SELECT COUNT(*) as count 
        FROM episode_scripts 
        WHERE deleted_at IS NULL
          AND to_tsvector('english', 
                COALESCE(content, '') || ' ' || 
                COALESCE(version_label, '') || ' ' ||
                COALESCE(author, '') || ' ' ||
                COALESCE(script_type, '')
              ) @@ plainto_tsquery('english', $1)
        ${episodeId ? `AND episode_id = $2` : ''}
        ${scriptType ? `AND script_type = $${episodeId ? 3 : 2}` : ''}
        ${status ? `AND status = $${[episodeId, scriptType].filter(Boolean).length + 2}` : ''}
      `;
      
      const countParams = [q.trim()];
      if (episodeId) countParams.push(episodeId);
      if (scriptType) countParams.push(scriptType);
      if (status) countParams.push(status);
      
      const countResult = await db.query(countSql, countParams);
      const total = parseInt(countResult.rows[0].count);

      // Add sorting (by relevance) and pagination
      sql += ` ORDER BY search_rank DESC, created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(parsedLimit);
      params.push(parsedOffset);

      const result = await db.query(sql, params);

      logger.info('Script search completed', {
        query: q.substring(0, 30),
        resultCount: result.rowCount,
        total,
      });

      // Log search for analytics
      const searchDuration = Date.now() - startTime;
      await logSearch(req.user?.userId || req.user?.id, q, 'scripts', total, searchDuration, {
        episodeId: episodeId || null,
        scriptType: scriptType || null,
        status: status || null,
      });

      return res.json({
        success: true,
        data: result.rows,
        pagination: {
          total,
          page: Math.floor(parsedOffset / parsedLimit) + 1,
          page_size: parsedLimit,
          pages: Math.ceil(total / parsedLimit),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Script search error', {
        error: error.message,
        userId: req.user?.id,
      });

      return res.status(500).json({
        success: false,
        error: 'Search failed',
        message: error.message,
      });
    }
  },
];

/**
 * Helper: Log search query (call this from search endpoints)
 * @param {string} userId - User ID performing search
 * @param {string} query - Search query text
 * @param {string} searchType - Type of search (episodes, scripts, activities)
 * @param {number} resultCount - Number of results returned
 * @param {number} durationMs - Search duration in milliseconds
 * @param {object} filters - Filter object to be stored as JSONB
 */
async function logSearch(userId, query, searchType, resultCount, durationMs, filters = {}) {
  // Skip if no userId (unauthenticated search)
  if (!userId) {
    return;
  }

  try {
    // Convert filters to JSON string if it's an object
    const filtersJson = typeof filters === 'string' 
      ? filters 
      : JSON.stringify(filters || {});
    
    await db.query(
      `INSERT INTO search_history 
       (user_id, query, search_type, result_count, search_duration_ms, filters)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        userId || 'anonymous',
        query || '',
        searchType,
        resultCount || 0,
        durationMs || 0,
        filtersJson
      ]
    );
    
    logger.debug('Search logged', { userId, query, searchType, resultCount });
  } catch (error) {
    logger.warn('Failed to log search (non-fatal)', { 
      error: error.message,
      userId,
      query: query?.substring(0, 30)
    });
    // Don't throw - logging failures shouldn't break search
  }
}

/**
 * GET /api/v1/search/history
 * Get user's recent searches
 * Query params:
 *   - limit: number of recent searches (default 10, max 50)
 */
exports.getSearchHistory = [
  async (req, res) => {
    try {
      const { limit = '10' } = req.query;
      const userId = req.user?.userId || req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
      }

      const limitNum = Math.min(parseInt(limit) || 10, 50);

      const result = await db.query(
        `SELECT 
          query,
          search_type,
          result_count,
          created_at,
          COUNT(*) OVER (PARTITION BY query) as search_count
        FROM search_history
        WHERE user_id = $1
        GROUP BY id, query, search_type, result_count, created_at
        ORDER BY created_at DESC
        LIMIT $2`,
        [userId, limitNum]
      );

      return res.json({
        success: true,
        data: result.rows,
        count: result.rows.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to get search history', {
        error: error.message,
        userId: req.user?.userId || req.user?.id,
      });
      
      return res.status(500).json({
        success: false,
        error: 'Failed to get search history',
        message: error.message,
      });
    }
  },
];

/**
 * DELETE /api/v1/search/history
 * Clear user's search history
 */
exports.clearSearchHistory = [
  async (req, res) => {
    try {
      const userId = req.user?.userId || req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
      }

      const result = await db.query(
        'DELETE FROM search_history WHERE user_id = $1',
        [userId]
      );

      const deletedCount = result.rowCount || 0;

      return res.json({
        success: true,
        message: 'Search history cleared',
        deletedCount,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to clear search history', {
        error: error.message,
        userId: req.user?.userId || req.user?.id,
      });
      
      return res.status(500).json({
        success: false,
        error: 'Failed to clear search history',
        message: error.message,
      });
    }
  },
];

// Export the helper function
exports.logSearch = logSearch;

module.exports = exports;
