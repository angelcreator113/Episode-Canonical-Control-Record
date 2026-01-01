/**
 * SearchController
 * Handles search and filtering endpoints
 */
const OpenSearchService = require('../services/OpenSearchService');
const logger = require('../utils/logger');

class SearchController {
  /**
   * Search episodes
   * @param {object} req - Request object
   * @param {object} res - Response object
   */
  async search(req, res) {
    try {
      const { q, from = 0, size = 20, sort = 'relevance' } = req.query;
      const filters = {};

      // Extract filter parameters
      if (req.query.season) filters.season = parseInt(req.query.season);
      if (req.query.tags) filters.tags = req.query.tags;
      if (req.query.fileType) filters['files.file_type'] = req.query.fileType;

      // Parse sort parameter
      let sortArray = [{ updated_at: 'desc' }];
      if (sort === 'relevance' && q) {
        sortArray = [{ _score: 'desc' }, { updated_at: 'desc' }];
      } else if (sort === 'newest') {
        sortArray = [{ created_at: 'desc' }];
      } else if (sort === 'oldest') {
        sortArray = [{ created_at: 'asc' }];
      }

      const results = await OpenSearchService.search(q || '*', {
        from: parseInt(from),
        size: Math.min(parseInt(size), 100), // Max 100 per request
        filters,
        sort: sortArray,
      });

      // Log search
      logger.info('Search executed', {
        query: q,
        hits: results.total,
        filters: Object.keys(filters).length > 0 ? filters : 'none',
      });

      res.json({
        query: q,
        total: results.total,
        from: parseInt(from),
        size: Math.min(parseInt(size), 100),
        hits: results.hits,
        aggregations: results.aggregations,
      });
    } catch (error) {
      logger.error('Search failed', { error: error.message });
      res.status(500).json({ error: 'Search failed' });
    }
  }

  /**
   * Get available filters
   * @param {object} req - Request object
   * @param {object} res - Response object
   */
  async getFilters(req, res) {
    try {
      const aggregations = await OpenSearchService.getAggregations();

      res.json({
        tags: aggregations.tags?.buckets?.map((b) => ({
          value: b.key,
          count: b.doc_count,
        })) || [],
        seasons: aggregations.seasons?.buckets?.map((b) => ({
          value: b.key,
          count: b.doc_count,
        })) || [],
        fileTypes: aggregations.file_types?.buckets?.map((b) => ({
          value: b.key,
          count: b.doc_count,
        })) || [],
        dateRange: aggregations.date_range?.buckets || [],
      });
    } catch (error) {
      logger.error('Failed to get filters', { error: error.message });
      res.status(500).json({ error: 'Failed to get filters' });
    }
  }

  /**
   * Get aggregations for advanced filtering
   * @param {object} req - Request object
   * @param {object} res - Response object
   */
  async getAggregations(req, res) {
    try {
      const aggregations = await OpenSearchService.getAggregations();

      res.json(aggregations);
    } catch (error) {
      logger.error('Failed to get aggregations', { error: error.message });
      res.status(500).json({ error: 'Failed to get aggregations' });
    }
  }

  /**
   * Suggest search terms based on partial query
   * @param {object} req - Request object
   * @param {object} res - Response object
   */
  async suggest(req, res) {
    try {
      const { q } = req.query;

      if (!q || q.length < 2) {
        return res.json({ suggestions: [] });
      }

      // Use OpenSearch completion suggester or prefix query
      const results = await OpenSearchService.search(q, {
        size: 5,
      });

      const suggestions = results.hits
        .map((hit) => hit.title)
        .filter((title) => title?.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 5);

      res.json({ suggestions });
    } catch (error) {
      logger.error('Search suggestions failed', { error: error.message });
      res.status(500).json({ error: 'Failed to get suggestions' });
    }
  }
}

module.exports = new SearchController();
