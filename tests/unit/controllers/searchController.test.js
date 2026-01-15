/**
 * SearchController Unit Tests
 * Tests search, filter, and aggregation endpoints
 */

process.env.NODE_ENV = 'test';

// Mock services
jest.mock('../../../src/services/OpenSearchService', () => ({
  search: jest.fn(),
  getAggregations: jest.fn(),
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const searchController = require('../../../src/controllers/searchController');
const OpenSearchService = require('../../../src/services/OpenSearchService');

describe('SearchController', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      query: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('search', () => {
    it('should perform text search successfully', async () => {
      req.query = { q: 'drama episode' };

      OpenSearchService.search.mockResolvedValue({
        total: 10,
        hits: [
          {
            id: 'ep-1',
            title: 'Drama Episode 1',
            score: 5.2,
          },
        ],
        aggregations: {
          tags: { buckets: [] },
        },
      });

      await searchController.search(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'drama episode',
          total: 10,
          hits: expect.any(Array),
        })
      );
      expect(OpenSearchService.search).toHaveBeenCalled();
    });

    it('should use pagination parameters', async () => {
      req.query = { q: 'test', from: '20', size: '50' };

      OpenSearchService.search.mockResolvedValue({
        total: 100,
        hits: [],
        aggregations: {},
      });

      await searchController.search(req, res);

      const callArgs = OpenSearchService.search.mock.calls[0][1];
      expect(callArgs.from).toBe(20);
      expect(callArgs.size).toBe(50);
    });

    it('should cap page size at 100', async () => {
      req.query = { q: 'test', size: '500' };

      OpenSearchService.search.mockResolvedValue({
        total: 100,
        hits: [],
        aggregations: {},
      });

      await searchController.search(req, res);

      const callArgs = OpenSearchService.search.mock.calls[0][1];
      expect(callArgs.size).toBe(100);
    });

    it('should handle season filter', async () => {
      req.query = { q: 'test', season: '2' };

      OpenSearchService.search.mockResolvedValue({
        total: 5,
        hits: [],
        aggregations: {},
      });

      await searchController.search(req, res);

      const callArgs = OpenSearchService.search.mock.calls[0][1];
      expect(callArgs.filters.season).toBe(2);
    });

    it('should handle tags filter', async () => {
      req.query = { q: 'test', tags: 'drama,thriller' };

      OpenSearchService.search.mockResolvedValue({
        total: 3,
        hits: [],
        aggregations: {},
      });

      await searchController.search(req, res);

      const callArgs = OpenSearchService.search.mock.calls[0][1];
      expect(callArgs.filters.tags).toBe('drama,thriller');
    });

    it('should handle file type filter', async () => {
      req.query = { q: 'test', fileType: 'video' };

      OpenSearchService.search.mockResolvedValue({
        total: 8,
        hits: [],
        aggregations: {},
      });

      await searchController.search(req, res);

      const callArgs = OpenSearchService.search.mock.calls[0][1];
      expect(callArgs.filters['files.file_type']).toBe('video');
    });

    it('should sort by relevance when searching with query', async () => {
      req.query = { q: 'drama', sort: 'relevance' };

      OpenSearchService.search.mockResolvedValue({
        total: 10,
        hits: [],
        aggregations: {},
      });

      await searchController.search(req, res);

      const callArgs = OpenSearchService.search.mock.calls[0][1];
      expect(callArgs.sort[0]).toEqual({ _score: 'desc' });
    });

    it('should sort by newest', async () => {
      req.query = { q: 'test', sort: 'newest' };

      OpenSearchService.search.mockResolvedValue({
        total: 10,
        hits: [],
        aggregations: {},
      });

      await searchController.search(req, res);

      const callArgs = OpenSearchService.search.mock.calls[0][1];
      expect(callArgs.sort[0]).toEqual({ created_at: 'desc' });
    });

    it('should sort by oldest', async () => {
      req.query = { q: 'test', sort: 'oldest' };

      OpenSearchService.search.mockResolvedValue({
        total: 10,
        hits: [],
        aggregations: {},
      });

      await searchController.search(req, res);

      const callArgs = OpenSearchService.search.mock.calls[0][1];
      expect(callArgs.sort[0]).toEqual({ created_at: 'asc' });
    });

    it('should handle search with no query', async () => {
      req.query = { from: '0', size: '20' };

      OpenSearchService.search.mockResolvedValue({
        total: 100,
        hits: [],
        aggregations: {},
      });

      await searchController.search(req, res);

      // Should search with '*' when no query provided
      expect(OpenSearchService.search).toHaveBeenCalledWith(
        '*',
        expect.any(Object)
      );
    });

    it('should handle search errors', async () => {
      req.query = { q: 'test' };

      OpenSearchService.search.mockRejectedValue(new Error('Search timeout'));

      await searchController.search(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Search failed' }));
    });

    it('should return aggregations in response', async () => {
      req.query = { q: 'test' };

      const mockAggregations = {
        tags: {
          buckets: [
            { key: 'drama', doc_count: 25 },
            { key: 'comedy', doc_count: 15 },
          ],
        },
      };

      OpenSearchService.search.mockResolvedValue({
        total: 10,
        hits: [],
        aggregations: mockAggregations,
      });

      await searchController.search(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          aggregations: mockAggregations,
        })
      );
    });
  });

  describe('getFilters', () => {
    it('should retrieve available filters', async () => {
      OpenSearchService.getAggregations.mockResolvedValue({
        tags: {
          buckets: [
            { key: 'drama', doc_count: 30 },
            { key: 'comedy', doc_count: 20 },
          ],
        },
        seasons: {
          buckets: [
            { key: '1', doc_count: 10 },
            { key: '2', doc_count: 15 },
          ],
        },
        file_types: {
          buckets: [
            { key: 'video', doc_count: 50 },
            { key: 'subtitle', doc_count: 45 },
          ],
        },
      });

      await searchController.getFilters(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: expect.any(Array),
          seasons: expect.any(Array),
          fileTypes: expect.any(Array),
        })
      );
    });

    it('should map aggregation buckets to filter format', async () => {
      OpenSearchService.getAggregations.mockResolvedValue({
        tags: {
          buckets: [
            { key: 'drama', doc_count: 30 },
          ],
        },
        seasons: {
          buckets: [
            { key: '1', doc_count: 10 },
          ],
        },
        file_types: {
          buckets: [
            { key: 'video', doc_count: 50 },
          ],
        },
      });

      await searchController.getFilters(req, res);

      const response = res.json.mock.calls[0][0];
      expect(response.tags[0]).toEqual({ value: 'drama', count: 30 });
      expect(response.seasons[0]).toEqual({ value: '1', count: 10 });
      expect(response.fileTypes[0]).toEqual({ value: 'video', count: 50 });
    });

    it('should handle missing aggregations gracefully', async () => {
      OpenSearchService.getAggregations.mockResolvedValue({});

      await searchController.getFilters(req, res);

      const response = res.json.mock.calls[0][0];
      expect(response.tags).toEqual([]);
      expect(response.seasons).toEqual([]);
      expect(response.fileTypes).toEqual([]);
    });

    it('should handle aggregation retrieval errors', async () => {
      OpenSearchService.getAggregations.mockRejectedValue(new Error('OpenSearch error'));

      await searchController.getFilters(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Failed to get filters' }));
    });

    it('should handle partial aggregations', async () => {
      OpenSearchService.getAggregations.mockResolvedValue({
        tags: {
          buckets: [
            { key: 'drama', doc_count: 30 },
          ],
        },
        // seasons and file_types missing
      });

      await searchController.getFilters(req, res);

      const response = res.json.mock.calls[0][0];
      expect(response.tags.length).toBeGreaterThan(0);
      expect(response.seasons).toEqual([]);
      expect(response.fileTypes).toEqual([]);
    });
  });

  describe('suggest', () => {
    it('should return search suggestions', async () => {
      req.query = { q: 'dra' };

      OpenSearchService.search.mockResolvedValue({
        total: 3,
        hits: [
          { id: 'ep-1', title: 'Drama Series' },
          { id: 'ep-2', title: 'Dramatic Episode' },
          { id: 'ep-3', title: 'Drama Finale' },
        ],
        aggregations: {},
      });

      await searchController.suggest(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          suggestions: expect.any(Array),
        })
      );
    });

    it('should return empty array for short queries', async () => {
      req.query = { q: 'a' };

      await searchController.suggest(req, res);

      expect(res.json).toHaveBeenCalledWith({ suggestions: [] });
    });

    it('should limit suggestions to 5 results', async () => {
      req.query = { q: 'ep' };

      const manyHits = Array.from({ length: 20 }, (_, i) => ({
        id: `ep-${i}`,
        title: `Episode ${i}`,
      }));

      OpenSearchService.search.mockResolvedValue({
        total: 20,
        hits: manyHits,
        aggregations: {},
      });

      await searchController.suggest(req, res);

      const response = res.json.mock.calls[0][0];
      expect(response.suggestions.length).toBeLessThanOrEqual(5);
    });

    it('should handle suggestion retrieval errors', async () => {
      req.query = { q: 'test' };

      OpenSearchService.search.mockRejectedValue(new Error('Search error'));

      await searchController.suggest(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('should filter suggestions by query match', async () => {
      req.query = { q: 'drama' };

      OpenSearchService.search.mockResolvedValue({
        total: 5,
        hits: [
          { id: 'ep-1', title: 'Drama Series' },
          { id: 'ep-2', title: 'Action Episode' },
          { id: 'ep-3', title: 'Drama Finale' },
        ],
        aggregations: {},
      });

      await searchController.suggest(req, res);

      const response = res.json.mock.calls[0][0];
      expect(response.suggestions).toContain('Drama Series');
      expect(response.suggestions).toContain('Drama Finale');
      expect(response.suggestions).not.toContain('Action Episode');
    });
  });
});
