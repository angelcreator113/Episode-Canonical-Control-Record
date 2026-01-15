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

      // Text search
      if (q && q.trim().length > 0) {
        sql += ` AND (title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
        params.push(`%${q}%`);
        paramIndex++;
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
      const countSql = sql.replace(
        'SELECT id, title, description, status, episode_number, created_at FROM episodes',
        'SELECT COUNT(*) as count FROM episodes'
      );
      const countResult = await db.query(countSql, params);
      const total = parseInt(countResult.rows[0].count);

      // Add sorting and pagination
      sql += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(parsedLimit);
      params.push(parsedOffset);

      const result = await db.query(sql, params);

      logger.info('Episode search completed', {
        query: q.substring(0, 30),
        resultCount: result.rowCount,
        total,
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

module.exports = exports;
