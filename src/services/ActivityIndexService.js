/**
 * ActivityIndexService
 * Handles indexing and searching of activity logs using OpenSearch with PostgreSQL fallback
 * Part of Phase 4A - Advanced Search Integration
 */

const { Client } = require('@opensearch-project/opensearch');
const { getPool } = require('../config/database');
const logger = require('./Logger');

class ActivityIndexService {
  constructor() {
    // Initialize OpenSearch client if configured
    if (process.env.OPENSEARCH_ENDPOINT) {
      this.client = new Client({
        node: process.env.OPENSEARCH_ENDPOINT,
        auth: {
          username: process.env.OPENSEARCH_USERNAME,
          password: process.env.OPENSEARCH_PASSWORD,
        },
        ssl: {
          rejectUnauthorized: process.env.NODE_ENV === 'production',
        },
      });
      this.isConfigured = true;
    } else {
      this.client = null;
      this.isConfigured = false;
      logger.warn('OpenSearch not configured - using PostgreSQL fallback for search');
    }

    this.indexName = 'activity-logs';
    this.db = getPool();
  }

  /**
   * Initialize index with proper mappings
   */
  async initializeIndex() {
    if (!this.isConfigured) {
      logger.info('Skipping OpenSearch initialization - not configured');
      return;
    }

    try {
      const indexExists = await this.client.indices.exists({ index: this.indexName });

      if (!indexExists.body) {
        await this.client.indices.create({
          index: this.indexName,
          body: {
            settings: {
              number_of_shards: 1,
              number_of_replicas: 0,
              analysis: {
                analyzer: {
                  default: {
                    type: 'standard',
                  },
                },
              },
            },
            mappings: {
              properties: {
                user_id: { type: 'keyword' },
                action_type: { type: 'keyword' },
                episode_id: { type: 'keyword' },
                resource_type: { type: 'keyword' },
                description: { type: 'text', analyzer: 'standard' },
                metadata: { type: 'object', enabled: true },
                created_at: { type: 'date' },
                timestamp: { type: 'date' },
              },
            },
          },
        });

        logger.info('Activity index created successfully');
      }
    } catch (error) {
      logger.error('Failed to initialize activity index', { error: error.message });
    }
  }

  /**
   * Index a single activity
   */
  async indexActivity(activity) {
    if (!this.isConfigured || !this.client) {
      logger.debug('OpenSearch not configured, skipping index');
      return null;
    }

    try {
      const response = await this.client.index({
        index: this.indexName,
        id: activity.id,
        body: {
          user_id: activity.user_id,
          action_type: activity.action_type,
          episode_id: activity.episode_id,
          resource_type: activity.resource_type,
          description: activity.description,
          metadata: activity.metadata || {},
          created_at: activity.created_at,
          timestamp: new Date().toISOString(),
        },
        refresh: true,
      });

      logger.debug('Activity indexed', { id: activity.id });
      return response;
    } catch (error) {
      logger.warn('Failed to index activity, will use database fallback', {
        id: activity.id,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Bulk index multiple activities (non-blocking)
   */
  async bulkIndexActivities(activities) {
    if (!this.isConfigured || !this.client || activities.length === 0) {
      logger.debug('OpenSearch not configured or no activities to index');
      return null;
    }

    try {
      // Build bulk request body
      const body = activities.flatMap(activity => [
        { index: { _index: this.indexName, _id: activity.id } },
        {
          user_id: activity.user_id,
          action_type: activity.action_type,
          episode_id: activity.episode_id,
          resource_type: activity.resource_type,
          description: activity.description,
          metadata: activity.metadata || {},
          created_at: activity.created_at,
          timestamp: new Date().toISOString(),
        },
      ]);

      const result = await this.client.bulk({ body });

      logger.info('Bulk indexing complete', {
        count: activities.length,
        errors: result.body.errors,
      });

      return result;
    } catch (error) {
      logger.warn('Bulk index failed, will use database fallback', {
        count: activities.length,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Reindex all activities from database
   */
  async reindexAll() {
    try {
      // Delete existing index
      if (this.isConfigured && this.client) {
        try {
          await this.client.indices.delete({ index: this.indexName });
          logger.info('Deleted existing activity index');
        } catch (err) {
          // Index might not exist, that's fine
        }

        // Create fresh index
        await this.initializeIndex();
      }

      // Get all activities from database
      const result = await this.db.query(`
        SELECT 
          id, user_id, action_type, resource_type, resource_id,
          old_values, new_values, timestamp
        FROM activity_logs 
        ORDER BY timestamp DESC
      `);

      const activities = result.rows.map(row => ({
        id: row.id,
        user_id: row.user_id,
        action_type: row.action_type,
        resource_type: row.resource_type,
        episode_id: row.resource_type === 'episode' ? row.resource_id : null,
        description: `${row.action_type} ${row.resource_type}`,
        metadata: row.new_values || {},
        created_at: row.timestamp,
      }));

      if (activities.length > 0) {
        // Bulk index in OpenSearch if available
        if (this.isConfigured && this.client) {
          await this.bulkIndexActivities(activities);
        }
      }

      logger.info('Reindex complete', { count: activities.length });
      return { indexed: activities.length, success: true };
    } catch (error) {
      logger.error('Reindex failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Search activities with advanced filters
   */
  async search(query = '', filters = {}) {
    // Try OpenSearch first if configured
    if (this.isConfigured && this.client) {
      try {
        return await this._searchOpenSearch(query, filters);
      } catch (error) {
        logger.warn('OpenSearch search failed, falling back to database', {
          error: error.message,
        });
      }
    }

    // Fall back to database
    return this.dbFallback(query, filters);
  }

  /**
   * Internal OpenSearch search implementation
   */
  async _searchOpenSearch(query = '', filters = {}) {
    const must = [];
    const should = [];

    // Free-text search on description and metadata
    if (query && query.trim().length > 0) {
      should.push({
        multi_match: {
          query: query.trim(),
          fields: ['description^2', 'metadata'],
          fuzziness: 'AUTO',
          operator: 'or',
        },
      });
    }

    // User filter
    if (filters.user_id) {
      must.push({ term: { user_id: filters.user_id } });
    }

    // Action type filter
    if (filters.action_type) {
      must.push({ term: { action_type: filters.action_type } });
    }

    // Episode filter
    if (filters.episode_id) {
      must.push({ term: { episode_id: filters.episode_id } });
    }

    // Resource type filter
    if (filters.resource_type) {
      must.push({ term: { resource_type: filters.resource_type } });
    }

    // Date range filter
    if (filters.from_date || filters.to_date) {
      const range = {};
      if (filters.from_date) range.gte = filters.from_date;
      if (filters.to_date) range.lte = filters.to_date;
      must.push({ range: { created_at: range } });
    }

    const limit = Math.min(parseInt(filters.limit) || 20, 100);
    const offset = parseInt(filters.offset) || 0;

    try {
      const result = await this.client.search({
        index: this.indexName,
        body: {
          query: {
            bool: {
              must: must.length > 0 ? must : [{ match_all: {} }],
              should: should.length > 0 ? should : [],
              minimum_should_match: should.length > 0 ? 1 : 0,
            },
          },
          size: limit,
          from: offset,
          sort: [{ created_at: { order: 'desc' } }],
          aggs: {
            action_types: { terms: { field: 'action_type', size: 20 } },
            users: { terms: { field: 'user_id', size: 20 } },
            episodes: { terms: { field: 'episode_id', size: 20 } },
          },
        },
      });

      return this.formatResults(result, limit, offset);
    } catch (error) {
      logger.warn('OpenSearch query failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Database fallback when OpenSearch unavailable
   */
  async dbFallback(query = '', filters = {}) {
    try {
      let sql = 'SELECT id, user_id, action_type, resource_type, resource_id, old_values, new_values, timestamp FROM activity_logs WHERE 1=1';
      const params = [];
      let paramIndex = 1;

      // Text search on action_type, resource_type, resource_id, and JSON data
      if (query && query.trim().length > 0) {
        sql += ` AND (action_type ILIKE $${paramIndex} OR resource_type ILIKE $${paramIndex} OR resource_id ILIKE $${paramIndex} OR CAST(new_values AS TEXT) ILIKE $${paramIndex})`;
        params.push(`%${query}%`);
        paramIndex++;
      }

      // User filter
      if (filters.user_id) {
        sql += ` AND user_id = $${paramIndex}`;
        params.push(filters.user_id);
        paramIndex++;
      }

      // Action type filter
      if (filters.action_type) {
        sql += ` AND action_type = $${paramIndex}`;
        params.push(filters.action_type);
        paramIndex++;
      }

      // Episode filter (for resource_id when resource_type is episode)
      if (filters.episode_id) {
        sql += ` AND (resource_id = $${paramIndex} OR (resource_type = 'episode' AND resource_id = $${paramIndex}))`;
        params.push(filters.episode_id);
        paramIndex++;
      }

      // Resource type filter
      if (filters.resource_type) {
        sql += ` AND resource_type = $${paramIndex}`;
        params.push(filters.resource_type);
        paramIndex++;
      }

      // Date range filters
      if (filters.from_date) {
        sql += ` AND timestamp >= $${paramIndex}`;
        params.push(filters.from_date);
        paramIndex++;
      }

      if (filters.to_date) {
        sql += ` AND timestamp <= $${paramIndex}`;
        params.push(filters.to_date);
        paramIndex++;
      }

      // Sorting and pagination
      sql += ` ORDER BY timestamp DESC`;
      const limit = Math.min(parseInt(filters.limit) || 20, 100);
      const offset = parseInt(filters.offset) || 0;

      sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit);
      params.push(offset);

      // Get results
      const result = await this.db.query(sql, params);

      // Get total count
      let countSql = 'SELECT COUNT(*) as count FROM activity_logs WHERE 1=1';
      const countParams = [];
      let countIndex = 1;

      if (query && query.trim().length > 0) {
        countSql += ` AND (action_type ILIKE $${countIndex} OR resource_type ILIKE $${countIndex} OR resource_id ILIKE $${countIndex} OR CAST(new_values AS TEXT) ILIKE $${countIndex})`;
        countParams.push(`%${query}%`);
        countIndex++;
      }
      if (filters.user_id) {
        countSql += ` AND user_id = $${countIndex}`;
        countParams.push(filters.user_id);
        countIndex++;
      }
      if (filters.action_type) {
        countSql += ` AND action_type = $${countIndex}`;
        countParams.push(filters.action_type);
        countIndex++;
      }
      if (filters.episode_id) {
        countSql += ` AND (resource_id = $${countIndex} OR (resource_type = 'episode' AND resource_id = $${countIndex}))`;
        countParams.push(filters.episode_id);
        countIndex++;
      }
      if (filters.resource_type) {
        countSql += ` AND resource_type = $${countIndex}`;
        countParams.push(filters.resource_type);
        countIndex++;
      }
      if (filters.from_date) {
        countSql += ` AND timestamp >= $${countIndex}`;
        countParams.push(filters.from_date);
        countIndex++;
      }
      if (filters.to_date) {
        countSql += ` AND timestamp <= $${countIndex}`;
        countParams.push(filters.to_date);
        countIndex++;
      }

      const countResult = await this.db.query(countSql, countParams);
      const total = parseInt(countResult.rows[0].count);

      // Transform results
      const activities = result.rows.map(row => ({
        id: row.id,
        user_id: row.user_id,
        action_type: row.action_type,
        resource_type: row.resource_type,
        resource_id: row.resource_id,
        old_values: row.old_values,
        new_values: row.new_values,
        created_at: row.timestamp,
      }));

      logger.debug('Database fallback search completed', {
        query: query.substring(0, 50),
        resultCount: result.rowCount,
        total,
        fallback: true,
      });

      return {
        success: true,
        data: activities,
        total,
        page: Math.floor(offset / limit) + 1,
        page_size: limit,
        fallback: true,
      };
    } catch (error) {
      logger.error('Database fallback error', { error: error.message });
      throw error;
    }
  }

  /**
   * Format OpenSearch results
   */
  formatResults(result, limit, offset) {
    const activities = result.body.hits.hits.map(hit => ({
      ...hit._source,
      id: hit._id,
    }));

    const total = result.body.hits.total.value || 0;
    const page = Math.floor(offset / limit) + 1;

    return {
      success: true,
      data: activities,
      total,
      page,
      page_size: limit,
      facets: {
        action_types: result.body.aggregations?.action_types?.buckets || [],
        users: result.body.aggregations?.users?.buckets || [],
        episodes: result.body.aggregations?.episodes?.buckets || [],
      },
    };
  }

  /**
   * Get search suggestions based on partial query
   */
  async getSuggestions(query = '', limit = 10) {
    if (!query || query.trim().length < 2) {
      return { success: true, data: [] };
    }

    try {
      // Try OpenSearch first
      if (this.isConfigured && this.client) {
        try {
          const result = await this.client.search({
            index: this.indexName,
            body: {
              query: {
                multi_match: {
                  query: query.trim(),
                  fields: ['action_type', 'resource_type'],
                  fuzziness: 'AUTO',
                },
              },
              _source: ['action_type', 'resource_type'],
              size: limit,
            },
          });

          const suggestions = result.body.hits.hits.map(hit => ({
            action_type: hit._source.action_type,
            resource_type: hit._source.resource_type,
          }));
          return { success: true, data: [...new Set(suggestions.map(s => `${s.action_type} ${s.resource_type}`))] };
        } catch (error) {
          logger.debug('OpenSearch suggestions failed', { error: error.message });
        }
      }

      // Fall back to database
      const result = await this.db.query(
        `
        SELECT DISTINCT action_type, resource_type
        FROM activity_logs 
        WHERE action_type ILIKE $1 OR resource_type ILIKE $1
        ORDER BY action_type
        LIMIT $2
        `,
        [`%${query}%`, limit]
      );

      return {
        success: true,
        data: result.rows.map(r => `${r.action_type} ${r.resource_type}`),
      };
    } catch (error) {
      logger.error('Failed to get suggestions', { error: error.message });
      return { success: false, data: [], error: error.message };
    }
  }

  /**
   * Get activity statistics
   */
  async getStats() {
    try {
      // Try OpenSearch first
      if (this.isConfigured && this.client) {
        try {
          const result = await this.client.search({
            index: this.indexName,
            body: {
              size: 0,
              aggs: {
                total_actions: { value_count: { field: 'action_type' } },
                unique_users: { cardinality: { field: 'user_id' } },
                unique_episodes: { cardinality: { field: 'episode_id' } },
                actions_by_type: { terms: { field: 'action_type', size: 20 } },
                actions_by_user: { terms: { field: 'user_id', size: 20 } },
              },
            },
          });

          return result.body.aggregations;
        } catch (error) {
          logger.debug('OpenSearch stats failed', { error: error.message });
        }
      }

      // Fall back to database statistics
      const result = await this.db.query(`
        SELECT 
          COUNT(DISTINCT action_type) as total_action_types,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT episode_id) as unique_episodes
        FROM activity_logs
      `);

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get statistics', { error: error.message });
      return null;
    }
  }
}

// Export as singleton
module.exports = new ActivityIndexService();
