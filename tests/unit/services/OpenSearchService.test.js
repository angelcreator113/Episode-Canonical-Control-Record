/**
 * OpenSearchService Unit Tests
 * Tests OpenSearch indexing, updating, searching, and aggregation operations
 */

// Set environment variables BEFORE mocking
process.env.OPENSEARCH_ENDPOINT = 'http://localhost:9200';
process.env.OPENSEARCH_USERNAME = 'admin';
process.env.OPENSEARCH_PASSWORD = 'admin';
process.env.OPENSEARCH_INDEX = 'episodes';
process.env.NODE_ENV = 'test';

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Define mock client BEFORE mocking the module
const mockClient = {
  indices: {
    create: jest.fn(),
    exists: jest.fn(),
    delete: jest.fn(),
    putMapping: jest.fn(),
  },
  index: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  search: jest.fn(),
  bulk: jest.fn(),
  count: jest.fn(),
};

// Mock the OpenSearch Client
jest.mock('@opensearch-project/opensearch', () => ({
  Client: jest.fn(() => mockClient),
}));

// NOW require the service after all mocks are set up
const openSearchInstance = require('../../../src/services/OpenSearchService');

describe('OpenSearchService', () => {
  beforeEach(() => {
    // Reset all mocks for each test
    jest.clearAllMocks();

    // Setup default mock responses
    mockClient.indices.create.mockResolvedValue({ body: { acknowledged: true } });
    mockClient.indices.exists.mockResolvedValue({ body: false });
    mockClient.indices.delete.mockResolvedValue({ body: { acknowledged: true } });
    mockClient.indices.putMapping.mockResolvedValue({ body: { acknowledged: true } });

    mockClient.index.mockResolvedValue({
      body: {
        _index: 'episodes',
        _id: 'ep-123',
        _version: 1,
        result: 'created',
      },
    });

    mockClient.update.mockResolvedValue({
      body: {
        _index: 'episodes',
        _id: 'ep-123',
        _version: 2,
        result: 'updated',
      },
    });

    mockClient.delete.mockResolvedValue({
      body: {
        _index: 'episodes',
        _id: 'ep-123',
        result: 'deleted',
      },
    });

    mockClient.search.mockResolvedValue({
      body: {
        hits: {
          total: { value: 5 },
          hits: [
            {
              _id: 'ep-1',
              _score: 10.5,
              _source: {
                id: 'ep-1',
                title: 'Episode 1',
                description: 'Test episode',
              },
            },
          ],
        },
        aggregations: {
          genres: {
            buckets: [
              { key: 'drama', doc_count: 25 },
              { key: 'comedy', doc_count: 15 },
            ],
          },
        },
      },
    });

    mockClient.bulk.mockResolvedValue({
      body: {
        errors: false,
        items: [
          { index: { _id: 'ep-1', result: 'created' } },
          { index: { _id: 'ep-2', result: 'created' } },
        ],
      },
    });

    mockClient.count.mockResolvedValue({
      body: { count: 10 },
    });
  });

  describe('indexEpisode', () => {
    it('should index an episode with all metadata', async () => {
      const episodeData = {
        title: 'Test Episode',
        description: 'A detailed episode description',
        genre: 'drama',
        releaseDate: '2024-01-15',
        duration: 3600,
      };

      const result = await openSearchInstance.indexEpisode('ep-123', episodeData);

      expect(result._id).toBe('ep-123');
      expect(result.result).toBe('created');
      expect(mockClient.index).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'episodes',
          id: 'ep-123',
          body: expect.objectContaining({
            title: 'Test Episode',
            indexed_at: expect.any(String),
          }),
        })
      );
    });

    it('should handle indexing with partial data', async () => {
      const episodeData = { title: 'Partial Episode' };

      const result = await openSearchInstance.indexEpisode('ep-456', episodeData);

      expect(result._id).toBe('ep-123');
      expect(mockClient.index).toHaveBeenCalled();
    });

    it('should handle index operation errors', async () => {
      mockClient.index.mockRejectedValueOnce(new Error('Index failed'));

      await expect(
        openSearchInstance.indexEpisode('ep-error', { title: 'Error Episode' })
      ).rejects.toThrow('Index failed');
    });

    it('should add timestamp for indexed_at field', async () => {
      const episodeData = { title: 'Timestamped Episode' };

      await openSearchInstance.indexEpisode('ep-ts', episodeData);

      const callArgs = mockClient.index.mock.calls[0][0];
      expect(callArgs.body.indexed_at).toBeTruthy();
      expect(typeof callArgs.body.indexed_at).toBe('string');
    });

    it('should handle special characters in text fields', async () => {
      const episodeData = {
        title: 'Episode with "quotes" & special chars',
        description: 'Contains \n newlines \t and tabs',
      };

      const result = await openSearchInstance.indexEpisode('ep-special', episodeData);

      expect(result._id).toBe('ep-123');
      expect(mockClient.index).toHaveBeenCalled();
    });

    it('should return complete response metadata', async () => {
      const result = await openSearchInstance.indexEpisode('ep-meta', { title: 'Meta Test' });

      expect(result).toHaveProperty('_index', 'episodes');
      expect(result).toHaveProperty('_id');
      expect(result).toHaveProperty('_version');
      expect(result).toHaveProperty('result');
    });

    it('should preserve all episode data fields', async () => {
      const episodeData = {
        title: 'Full Episode',
        description: 'Full description',
        genre: 'comedy',
        releaseDate: '2024-01-20',
        duration: 7200,
        director: 'John Doe',
        cast: ['Actor 1', 'Actor 2'],
      };

      await openSearchInstance.indexEpisode('ep-full', episodeData);

      const callArgs = mockClient.index.mock.calls[0][0];
      expect(callArgs.body.title).toBe('Full Episode');
      expect(callArgs.body.director).toBe('John Doe');
      expect(callArgs.body.cast).toEqual(['Actor 1', 'Actor 2']);
    });
  });

  describe('updateEpisode', () => {
    it('should update episode with new data', async () => {
      const updates = { title: 'Updated Title' };

      const result = await openSearchInstance.updateEpisode('ep-123', updates);

      expect(result._id).toBe('ep-123');
      expect(result.result).toBe('updated');
      expect(mockClient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'episodes',
          id: 'ep-123',
          body: expect.objectContaining({
            doc: expect.objectContaining({ title: 'Updated Title' }),
          }),
        })
      );
    });

    it('should handle partial field updates', async () => {
      const updates = { genre: 'drama' };

      const result = await openSearchInstance.updateEpisode('ep-234', updates);

      expect(result.result).toBe('updated');
      expect(mockClient.update).toHaveBeenCalled();
    });

    it('should handle update errors', async () => {
      mockClient.update.mockRejectedValueOnce(new Error('Update failed'));

      await expect(
        openSearchInstance.updateEpisode('ep-error', { title: 'Failed Update' })
      ).rejects.toThrow('Update failed');
    });

    it('should increment version on update', async () => {
      const result = await openSearchInstance.updateEpisode('ep-123', { title: 'New' });

      expect(result._version).toBe(2);
    });

    it('should preserve other fields during update', async () => {
      const updates = { title: 'Updated' };

      await openSearchInstance.updateEpisode('ep-preserve', updates);

      const callArgs = mockClient.update.mock.calls[0][0];
      // Note: service adds updated_at field
      expect(callArgs.body.doc).toEqual(
        expect.objectContaining({ title: 'Updated' })
      );
      expect(callArgs.body.doc.updated_at).toBeDefined();
    });

    it('should support nested object updates', async () => {
      const updates = {
        metadata: {
          views: 1000,
          rating: 4.5,
        },
      };

      await openSearchInstance.updateEpisode('ep-nested', updates);

      expect(mockClient.update).toHaveBeenCalled();
    });
  });

  describe('deleteEpisode', () => {
    it('should delete episode by ID', async () => {
      const result = await openSearchInstance.deleteEpisode('ep-123');

      // deleteEpisode returns undefined on success
      expect(result).toBeUndefined();
      expect(mockClient.delete).toHaveBeenCalledWith({
        index: 'episodes',
        id: 'ep-123',
      });
    });

    it('should handle delete errors', async () => {
      mockClient.delete.mockRejectedValueOnce(new Error('Delete failed'));

      await expect(openSearchInstance.deleteEpisode('ep-error')).rejects.toThrow('Delete failed');
    });

    it('should return proper response structure', async () => {
      // For this test, we expect the method to return undefined on success
      const result = await openSearchInstance.deleteEpisode('ep-123');

      expect(result).toBeUndefined();
      expect(mockClient.delete).toHaveBeenCalled();
    });

    it('should handle non-existent episode deletion', async () => {
      // Service returns undefined for 404 errors
      const error = new Error('Not found');
      error.meta = { statusCode: 404 };
      mockClient.delete.mockRejectedValueOnce(error);

      const result = await openSearchInstance.deleteEpisode('ep-notfound');

      // 404 returns undefined (no throw)
      expect(result).toBeUndefined();
    });

    it('should accept any valid ID format', async () => {
      const idFormats = ['ep-123', 'episode-456', 'abc123xyz'];

      for (const id of idFormats) {
        await openSearchInstance.deleteEpisode(id);
        expect(mockClient.delete).toHaveBeenCalledWith(
          expect.objectContaining({ id })
        );
      }
    });
  });

  describe('search', () => {
    it('should perform text search', async () => {
      const query = 'drama episode';

      const results = await openSearchInstance.search(query);

      // Service returns transformed object: { total, hits, aggregations }
      expect(results.hits).toBeDefined();
      expect(results.total).toBe(5);
      expect(results.hits.length).toBeGreaterThan(0);
      expect(mockClient.search).toHaveBeenCalled();
    });

    it('should support search with filters', async () => {
      const query = 'episode';
      const filters = { genre: 'drama' };

      const results = await openSearchInstance.search(query, { filters });

      expect(results.hits).toBeDefined();
      expect(mockClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'episodes',
          body: expect.any(Object),
        })
      );
    });

    it('should handle pagination', async () => {
      const results = await openSearchInstance.search('episode', { from: 0, size: 10 });

      expect(results.hits).toBeDefined();
      expect(mockClient.search).toHaveBeenCalled();
    });

    it('should return empty results for no matches', async () => {
      mockClient.search.mockResolvedValueOnce({
        body: {
          hits: {
            total: { value: 0 },
            hits: [],
          },
          aggregations: {},
        },
      });

      const results = await openSearchInstance.search('nonexistent');

      expect(results.total).toBe(0);
      expect(results.hits).toHaveLength(0);
    });

    it('should include relevance scores', async () => {
      const results = await openSearchInstance.search('episode');

      expect(results.hits[0].score).toBe(10.5);
    });

    it('should handle search errors', async () => {
      mockClient.search.mockRejectedValueOnce(new Error('Search failed'));

      await expect(openSearchInstance.search('episode')).rejects.toThrow('Search failed');
    });

    it('should support custom sorting', async () => {
      const results = await openSearchInstance.search('episode', { sort: 'releaseDate' });

      expect(results.hits).toBeDefined();
      expect(mockClient.search).toHaveBeenCalled();
    });

    it('should include aggregations in results', async () => {
      const results = await openSearchInstance.search('episode', {});

      expect(results.aggregations).toBeDefined();
    });
  });

  describe('bulkIndex', () => {
    it('should index multiple episodes in bulk', async () => {
      const episodes = [
        { id: 'ep-1', title: 'Episode 1' },
        { id: 'ep-2', title: 'Episode 2' },
      ];

      const result = await openSearchInstance.bulkIndex(episodes);

      expect(result.errors).toBe(false);
      expect(result.items).toHaveLength(2);
      expect(mockClient.bulk).toHaveBeenCalled();
    });

    it('should handle partial failures', async () => {
      mockClient.bulk.mockResolvedValueOnce({
        body: {
          errors: true,
          items: [
            { index: { _id: 'ep-1', result: 'created' } },
            { index: { _id: 'ep-2', error: { type: 'mapper_parsing_exception' } } },
          ],
        },
      });

      const episodes = [
        { id: 'ep-1', title: 'Episode 1' },
        { id: 'ep-2', title: 'Invalid' },
      ];

      const result = await openSearchInstance.bulkIndex(episodes);

      expect(result.errors).toBe(true);
    });

    it('should handle empty bulk operations', async () => {
      const episodes = [];

      await openSearchInstance.bulkIndex(episodes);

      expect(mockClient.bulk).toHaveBeenCalled();
    });

    it('should handle bulk operation errors', async () => {
      mockClient.bulk.mockRejectedValueOnce(new Error('Bulk operation failed'));

      const episodes = [{ id: 'ep-1', title: 'Episode 1' }];

      await expect(openSearchInstance.bulkIndex(episodes)).rejects.toThrow(
        'Bulk operation failed'
      );
    });

    it('should handle large batches efficiently', async () => {
      const episodes = Array.from({ length: 100 }, (_, i) => ({
        id: `ep-${i}`,
        title: `Episode ${i}`,
      }));

      const result = await openSearchInstance.bulkIndex(episodes);

      expect(result.items).toBeDefined();
      expect(mockClient.bulk).toHaveBeenCalled();
    });

    it('should return complete operation metadata', async () => {
      const episodes = [{ id: 'ep-1', title: 'Episode 1' }];

      const result = await openSearchInstance.bulkIndex(episodes);

      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('items');
    });
  });

  describe('getAggregations', () => {
    it('should retrieve genre aggregations', async () => {
      mockClient.search.mockResolvedValueOnce({
        body: {
          aggregations: {
            tags: { buckets: [{ key: 'drama', doc_count: 25 }] },
          },
        },
      });

      const result = await openSearchInstance.getAggregations();

      expect(result).toBeDefined();
      expect(result.tags).toBeDefined();
      expect(mockClient.search).toHaveBeenCalled();
    });

    it('should handle date range aggregations', async () => {
      mockClient.search.mockResolvedValueOnce({
        body: {
          aggregations: {
            date_histogram: {
              buckets: [
                { key_as_string: '2024-01-01', doc_count: 10 },
                { key_as_string: '2024-01-02', doc_count: 15 },
              ],
            },
          },
        },
      });

      const result = await openSearchInstance.getAggregations();

      expect(result).toBeDefined();
      expect(result.date_histogram).toBeDefined();
    });

    it('should return empty buckets for no data', async () => {
      mockClient.search.mockResolvedValueOnce({
        body: {
          aggregations: {
            tags: { buckets: [] },
          },
        },
      });

      const result = await openSearchInstance.getAggregations();

      expect(result.tags.buckets).toHaveLength(0);
    });

    it('should handle aggregation errors', async () => {
      mockClient.search.mockRejectedValueOnce(new Error('Aggregation failed'));

      await expect(openSearchInstance.getAggregations()).rejects.toThrow(
        'Aggregation failed'
      );
    });

    it('should support multiple aggregations', async () => {
      mockClient.search.mockResolvedValueOnce({
        body: {
          aggregations: {
            tags: {
              buckets: [{ key: 'drama', doc_count: 25 }],
            },
            seasons: {
              buckets: [{ key: '2024', doc_count: 50 }],
            },
          },
        },
      });

      const result = await openSearchInstance.getAggregations();

      expect(result).toBeDefined();
      expect(result.tags).toBeDefined();
      expect(result.seasons).toBeDefined();
      expect(mockClient.search).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors', async () => {
      mockClient.index.mockRejectedValueOnce(
        new Error('ECONNREFUSED: Connection refused')
      );

      await expect(
        openSearchInstance.indexEpisode('ep-conn', { title: 'Connection Error' })
      ).rejects.toThrow('ECONNREFUSED');
    });

    it('should handle timeout errors', async () => {
      mockClient.search.mockRejectedValueOnce(new Error('Timeout waiting for response'));

      await expect(openSearchInstance.search('timeout-test')).rejects.toThrow('Timeout');
    });

    it('should handle validation errors', async () => {
      mockClient.index.mockRejectedValueOnce(
        new Error('Validation error: invalid field mapping')
      );

      await expect(
        openSearchInstance.indexEpisode('ep-invalid', { title: 'Validation Error' })
      ).rejects.toThrow('Validation error');
    });
  });
});
