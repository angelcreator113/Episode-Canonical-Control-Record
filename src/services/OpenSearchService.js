/**
 * OpenSearchService
 * Handles OpenSearch indexing and searching
 */
const { Client } = require('@opensearch-project/opensearch');
const logger = require('../utils/logger');

class OpenSearchService {
  constructor() {
    // Only initialize if endpoint is configured
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
      logger.warn('OpenSearch not configured - search features disabled');
    }

    this.indexName = process.env.OPENSEARCH_INDEX || 'episodes';
  }

  /**
   * Initialize index with mapping
   * @returns {Promise<void>}
   */
  async initializeIndex() {
    if (!this.isConfigured) {
      logger.warn('Skipping OpenSearch index initialization - not configured');
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
                id: { type: 'keyword' },
                title: { type: 'text', analyzer: 'standard' },
                description: { type: 'text', analyzer: 'standard' },
                content: { type: 'text', analyzer: 'standard' },
                tags: { type: 'keyword' },
                season: { type: 'integer' },
                episode_number: { type: 'integer' },
                air_date: { type: 'date' },
                files: {
                  type: 'nested',
                  properties: {
                    id: { type: 'keyword' },
                    file_name: { type: 'text' },
                    file_type: { type: 'keyword' },
                    created_at: { type: 'date' },
                  },
                },
                created_at: { type: 'date' },
                updated_at: { type: 'date' },
              },
            },
          },
        });

        logger.info('OpenSearch index initialized', { index: this.indexName });
      }
    } catch (error) {
      logger.error('Failed to initialize OpenSearch index', {
        index: this.indexName,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Index a single episode
   * @param {string} episodeId - Episode ID
   * @param {object} episodeData - Episode data
   * @returns {Promise<object>} Index result
   */
  async indexEpisode(episodeId, episodeData) {
    if (!this.isConfigured) {
      logger.warn('OpenSearch not configured - skipping indexing for episode', { episodeId });
      return { _id: episodeId };
    }

    try {
      const result = await this.client.index({
        index: this.indexName,
        id: episodeId,
        body: {
          ...episodeData,
          indexed_at: new Date().toISOString(),
        },
      });

      logger.debug('Episode indexed', { episodeId, index: this.indexName });
      return result.body;
    } catch (error) {
      logger.error('Failed to index episode', { episodeId, error: error.message });
      throw error;
    }
  }

  /**
   * Update episode in index
   * @param {string} episodeId - Episode ID
   * @param {object} updateData - Partial update data
   * @returns {Promise<object>} Update result
   */
  async updateEpisode(episodeId, updateData) {
    if (!this.isConfigured) {
      logger.warn('OpenSearch not configured - skipping update for episode', { episodeId });
      return { _id: episodeId };
    }

    try {
      const result = await this.client.update({
        index: this.indexName,
        id: episodeId,
        body: {
          doc: {
            ...updateData,
            updated_at: new Date().toISOString(),
          },
        },
      });

      logger.debug('Episode updated', { episodeId, index: this.indexName });
      return result.body;
    } catch (error) {
      logger.error('Failed to update episode', { episodeId, error: error.message });
      throw error;
    }
  }

  /**
   * Delete episode from index
   * @param {string} episodeId - Episode ID
   * @returns {Promise<void>}
   */
  async deleteEpisode(episodeId) {
    if (!this.isConfigured) {
      logger.warn('OpenSearch not configured - skipping delete for episode', { episodeId });
      return;
    }

    try {
      await this.client.delete({
        index: this.indexName,
        id: episodeId,
      });

      logger.debug('Episode deleted from index', { episodeId, index: this.indexName });
    } catch (error) {
      if (error.meta?.statusCode === 404) {
        logger.warn('Episode not found in index', { episodeId });
        return;
      }
      logger.error('Failed to delete episode', { episodeId, error: error.message });
      throw error;
    }
  }

  /**
   * PostgreSQL fallback search
   * @param {string} query - Search query
   * @param {object} options - Search options
   * @returns {Promise<object>} Search results
   */
  async searchPostgreSQL(query, options = {}) {
    try {
      const { Pool } = require('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
      });

      const { from = 0, size = 20 } = options;
      const offset = Math.max(0, from);
      const limit = Math.min(size, 100);

      let whereClause = '1=1';
      let selectClause = 'SELECT * FROM episodes';
      const params = [];
      let paramCounter = 1;

      if (query && query !== '*') {
        // Use full-text search with GIN index (idx_episodes_fulltext)
        // Much faster than ILIKE pattern matching
        selectClause = `SELECT *, 
          ts_rank(
            to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(categories, '')),
            plainto_tsquery('english', $${paramCounter})
          ) AS search_rank
          FROM episodes`;
        whereClause = `to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(categories, '')) @@ plainto_tsquery('english', $${paramCounter})`;
        params.push(query);
        paramCounter++;
      }

      // Get total count
      const countResult = await pool.query(
        `SELECT COUNT(*) as total FROM episodes WHERE ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].total, 10);

      // Get paginated results - order by relevance if searching, otherwise by updated_at
      const orderBy = query && query !== '*' ? 'ORDER BY search_rank DESC, updated_at DESC' : 'ORDER BY updated_at DESC';
      const searchQuery =
        `${selectClause} WHERE ${whereClause} ${orderBy} LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;

      const result = await pool.query(searchQuery, [...params, limit, offset]);

      // Close the pool
      await pool.end();

      logger.info('PostgreSQL search executed', {
        query,
        hits: result.rows.length,
        total,
      });

      return {
        total,
        hits: result.rows.map((row) => ({
          id: row.id,
          ...row,
        })),
        aggregations: {},
      };
    } catch (error) {
      logger.error('PostgreSQL search failed', { error: error.message, stack: error.stack });
      // Return empty results on error instead of throwing
      return { total: 0, hits: [], aggregations: {} };
    }
  }

  /**
   * Search episodes
   * @param {object} query - Search query object
   * @param {object} options - Search options {from, size, filters, sort}
   * @returns {Promise<object>} Search results
   */
  async search(query, options = {}) {
    if (!this.isConfigured) {
      logger.warn('OpenSearch not configured - using PostgreSQL fallback');
      return this.searchPostgreSQL(query, options);
    }
    try {
      const { from = 0, size = 20, filters = {}, sort = [{ updated_at: 'desc' }] } = options;

      const must = [];
      if (query) {
        must.push({
          multi_match: {
            query,
            fields: ['title^2', 'description', 'content', 'tags'],
          },
        });
      }

      const filter = [];
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          filter.push({ term: { [key]: value } });
        }
      });

      const body = {
        query: {
          bool: {
            must: must.length > 0 ? must : [{ match_all: {} }],
            filter: filter.length > 0 ? filter : undefined,
          },
        },
        from,
        size,
        sort,
        aggs: {
          tags: { terms: { field: 'tags', size: 50 } },
          file_types: { terms: { field: 'files.file_type', size: 10 } },
        },
      };

      const result = await this.client.search({
        index: this.indexName,
        body,
      });

      logger.debug('Search executed', {
        query,
        hits: result.body.hits.total.value,
        index: this.indexName,
      });

      return {
        total: result.body.hits.total.value,
        hits: result.body.hits.hits.map((hit) => ({
          id: hit._id,
          ...hit._source,
          score: hit._score,
        })),
        aggregations: result.body.aggregations,
      };
    } catch (error) {
      logger.error('Search failed', { query, error: error.message });
      throw error;
    }
  }

  /**
   * Bulk index episodes
   * @param {array} episodes - Array of episode objects
   * @returns {Promise<object>} Bulk result
   */
  async bulkIndex(episodes) {
    try {
      const operations = episodes.flatMap((episode) => [
        { index: { _index: this.indexName, _id: episode.id } },
        episode,
      ]);

      const result = await this.client.bulk({ body: operations });

      logger.info('Bulk indexing completed', {
        total: episodes.length,
        errors: result.body.errors,
        index: this.indexName,
      });

      return result.body;
    } catch (error) {
      logger.error('Bulk indexing failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Get aggregations for filters
   * @returns {Promise<object>} Aggregations
   */
  async getAggregations() {
    try {
      const result = await this.client.search({
        index: this.indexName,
        body: {
          size: 0,
          aggs: {
            tags: { terms: { field: 'tags', size: 100 } },
            seasons: { terms: { field: 'season', size: 50 } },
            file_types: { terms: { field: 'files.file_type', size: 10 } },
            date_range: {
              date_histogram: {
                field: 'air_date',
                calendar_interval: 'month',
              },
            },
          },
        },
      });

      logger.debug('Aggregations retrieved', { index: this.indexName });
      return result.body.aggregations;
    } catch (error) {
      logger.error('Failed to get aggregations', { error: error.message });
      throw error;
    }
  }

  /**
   * Health check
   * @returns {Promise<object>} Cluster health
   */
  async healthCheck() {
    if (!this.isConfigured) {
      return { status: 'unavailable', message: 'OpenSearch not configured' };
    }

    try {
      const health = await this.client.cluster.health();
      return health.body;
    } catch (error) {
      logger.error('OpenSearch health check failed', { error: error.message });
      throw error;
    }
  }
}

module.exports = new OpenSearchService();
