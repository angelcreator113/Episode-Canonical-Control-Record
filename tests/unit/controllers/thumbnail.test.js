/**
 * Thumbnail Controller Unit Tests - REAL TEST IMPLEMENTATIONS
 */

jest.mock('../../../src/models');
jest.mock('../../../src/middleware/errorHandler');
jest.mock('../../../src/middleware/auditLog');

const thumbnailController = require('../../../src/controllers/thumbnailController');
const { models } = require('../../../src/models');
const { NotFoundError } = require('../../../src/middleware/errorHandler');
const { logger } = require('../../../src/middleware/auditLog');

describe('Thumbnail Controller', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      query: {},
      body: {},
      params: {},
      user: { id: 'user-123', 'cognito:groups': ['editor'] },
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('Mozilla/5.0'),
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('listThumbnails()', () => {
    test('should return thumbnails list with pagination', async () => {
      const mockThumbs = [
        { id: 1, episodeId: 1, thumbnailType: 'primary', url: 'http://...' },
        { id: 2, episodeId: 1, thumbnailType: 'secondary', url: 'http://...' },
      ];

      models.Thumbnail.findAndCountAll = jest.fn().mockResolvedValue({
        count: 2,
        rows: mockThumbs,
      });

      mockReq.query = { page: 1 };

      await thumbnailController.listThumbnails(mockReq, mockRes);

      expect(models.Thumbnail.findAndCountAll).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: mockThumbs,
          pagination: expect.any(Object),
        })
      );
    });

    test('should filter by episode ID', async () => {
      models.Thumbnail.findAndCountAll = jest.fn().mockResolvedValue({
        count: 1,
        rows: [{ id: 1, episodeId: 1 }],
      });

      mockReq.query = { episodeId: 1 };

      await thumbnailController.listThumbnails(mockReq, mockRes);

      expect(models.Thumbnail.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ episodeId: 1 }),
        })
      );
    });

    test('should filter by thumbnail type', async () => {
      models.Thumbnail.findAndCountAll = jest.fn().mockResolvedValue({
        count: 1,
        rows: [{ id: 1, thumbnailType: 'primary' }],
      });

      mockReq.query = { type: 'primary' };

      await thumbnailController.listThumbnails(mockReq, mockRes);

      expect(models.Thumbnail.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ thumbnailType: 'primary' }),
        })
      );
    });
  });

  describe('getThumbnail()', () => {
    test('should return single thumbnail', async () => {
      const mockThumb = { id: 1, episodeId: 1, thumbnailType: 'primary', url: 'http://...' };

      models.Thumbnail.findByPk = jest.fn().mockResolvedValue(mockThumb);

      mockReq.params = { id: 1 };

      await thumbnailController.getThumbnail(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({ data: mockThumb });
    });
  });

  describe('updateThumbnail()', () => {
    test('should update thumbnail', async () => {
      const mockThumb = {
        id: 1,
        url: 'old',
        toJSON: jest.fn().mockReturnValue({ id: 1, url: 'old' }),
        update: jest.fn().mockResolvedValue(true),
      };

      models.Thumbnail.findByPk = jest.fn().mockResolvedValue(mockThumb);

      mockReq.params = { id: 1 };
      mockReq.body = { url: 'new' };

      await thumbnailController.updateThumbnail(mockReq, mockRes);

      expect(mockThumb.update).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ data: mockThumb }));
    });

    test('should log thumbnail update', async () => {
      const mockThumb = {
        id: 1,
        url: 'old',
        toJSON: jest.fn().mockReturnValue({ id: 1, url: 'old' }),
        update: jest.fn().mockResolvedValue(true),
      };

      models.Thumbnail.findByPk = jest.fn().mockResolvedValue(mockThumb);

      mockReq.params = { id: 1 };
      mockReq.body = { url: 'new' };

      await thumbnailController.updateThumbnail(mockReq, mockRes);

      expect(logger.logAction).toHaveBeenCalled();
    });
  });

  describe('deleteThumbnail()', () => {
    test('should delete thumbnail', async () => {
      const mockThumb = {
        id: 1,
        episodeId: 1,
        toJSON: jest.fn().mockReturnValue({ id: 1, episodeId: 1 }),
        destroy: jest.fn().mockResolvedValue(true),
      };

      models.Thumbnail.findByPk = jest.fn().mockResolvedValue(mockThumb);

      mockReq.params = { id: 1 };

      await thumbnailController.deleteThumbnail(mockReq, mockRes);

      expect(mockThumb.destroy).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.any(String) })
      );
    });

    test('should log thumbnail deletion', async () => {
      const mockThumb = {
        id: 1,
        episodeId: 1,
        toJSON: jest.fn().mockReturnValue({ id: 1, episodeId: 1 }),
        destroy: jest.fn().mockResolvedValue(true),
      };

      models.Thumbnail.findByPk = jest.fn().mockResolvedValue(mockThumb);

      mockReq.params = { id: 1 };

      await thumbnailController.deleteThumbnail(mockReq, mockRes);

      expect(logger.logAction).toHaveBeenCalledWith(
        'user-123',
        'delete',
        'thumbnail',
        1,
        expect.any(Object)
      );
    });
  });

  describe('getThumbnailUrl()', () => {
    test('should return thumbnail URL with S3', async () => {
      const mockThumb = {
        id: 1,
        episodeId: 1,
        url: 'http://example.com/thumb.jpg',
        getS3Url: jest.fn().mockReturnValue('s3://url'),
      };

      models.Thumbnail.findByPk = jest.fn().mockResolvedValue(mockThumb);

      mockReq.query = { cdn: false };
      mockReq.params = { id: 1 };

      await thumbnailController.getThumbnailUrl(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.any(Object) })
      );
    });
  });

  describe('getEpisodeThumbnails()', () => {
    test('should return all thumbnails for episode', async () => {
      const mockThumbs = [
        { id: 1, episodeId: 1, thumbnailType: 'primary' },
        { id: 2, episodeId: 1, thumbnailType: 'secondary' },
      ];

      models.Episode.findByPk = jest.fn().mockResolvedValue({ id: 1 });
      models.Thumbnail.findAll = jest.fn().mockResolvedValue(mockThumbs);

      mockReq.params = { episodeId: 1 };

      await thumbnailController.getEpisodeThumbnails(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: mockThumbs,
          count: 2,
        })
      );
    });
  });

  describe('getPrimaryThumbnail()', () => {
    test('should return primary thumbnail for episode', async () => {
      const mockThumb = { id: 1, episodeId: 1, thumbnailType: 'primary' };

      models.Thumbnail.findOne = jest.fn().mockResolvedValue(mockThumb);

      mockReq.params = { episodeId: 1 };

      await thumbnailController.getPrimaryThumbnail(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ data: mockThumb }));
    });

    test('should handle missing primary thumbnail', async () => {
      models.Thumbnail.findOne = jest.fn().mockResolvedValue(null);

      mockReq.params = { episodeId: '1' };

      // Controller throws NotFoundError which is caught by asyncHandler
      await expect(thumbnailController.getPrimaryThumbnail(mockReq, mockRes)).rejects.toBeDefined();
    });
  });

  describe('prepareThumbnailDownload()', () => {
    test('should prepare thumbnail for download', async () => {
      const mockThumb = {
        id: 1,
        episodeId: 1,
        s3Key: 'key',
        s3Bucket: 'bucket',
        mimeType: 'image/jpeg',
        fileSizeBytes: 1024,
        generatedAt: new Date(),
        thumbnailType: 'poster',
        getS3Url: jest.fn().mockReturnValue('http://s3.amazonaws.com/...'),
        episode: {
          showName: 'Test Show',
          seasonNumber: 1,
          episodeNumber: 1,
          episodeTitle: 'Test',
        },
      };

      models.Thumbnail.findByPk = jest.fn().mockResolvedValue(mockThumb);

      mockReq.params = { id: 1 };

      await thumbnailController.prepareThumbnailDownload(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.any(Object) })
      );
    });
  });

  describe('rateThumbnailQuality()', () => {
    test('should rate thumbnail quality with valid rating', async () => {
      const mockThumb = {
        id: 1,
        qualityRating: null,
        setQualityRating: jest.fn().mockResolvedValue(true),
        toJSON: jest.fn().mockReturnValue({ id: 1, qualityRating: 'high' }),
      };

      models.Thumbnail.findByPk = jest.fn().mockResolvedValue(mockThumb);

      mockReq.params = { id: '1' };
      mockReq.body = { rating: 'high' };
      mockReq.user = { id: 'user1' };
      mockReq.ip = '127.0.0.1';
      mockReq.get = jest.fn().mockReturnValue('Mozilla/5.0');

      await thumbnailController.rateThumbnailQuality(mockReq, mockRes);

      expect(mockThumb.setQualityRating).toHaveBeenCalledWith('high');
      expect(logger.logAction).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalled();
    });

    test('should reject invalid rating values', async () => {
      mockReq.params = { id: '1' };
      mockReq.body = { rating: 'invalid' };

      await expect(
        thumbnailController.rateThumbnailQuality(mockReq, mockRes)
      ).rejects.toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors', async () => {
      models.Thumbnail.findAndCountAll = jest.fn().mockRejectedValue(new Error('DB error'));

      await thumbnailController.listThumbnails(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });
});
