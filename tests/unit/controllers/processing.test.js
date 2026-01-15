/**
 * Processing Controller Unit Tests - REAL TEST IMPLEMENTATIONS
 */

jest.mock('../../../src/models');
jest.mock('../../../src/middleware/errorHandler');
jest.mock('../../../src/middleware/auditLog');

const processingController = require('../../../src/controllers/processingController');
const { models } = require('../../../src/models');
const { NotFoundError } = require('../../../src/middleware/errorHandler');
const { logger } = require('../../../src/middleware/auditLog');

describe('Processing Controller', () => {
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

  describe('listJobs()', () => {
    test('should return processing jobs list', async () => {
      const mockJobs = [
        { id: 1, episodeId: 1, jobType: 'thumbnail_generation', status: 'pending' },
        { id: 2, episodeId: 1, jobType: 'metadata_extraction', status: 'processing' },
      ];

      models.ProcessingQueue.findAndCountAll = jest.fn().mockResolvedValue({
        count: 2,
        rows: mockJobs,
      });

      mockReq.query = { page: 1 };

      await processingController.listJobs(mockReq, mockRes);

      expect(models.ProcessingQueue.findAndCountAll).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: mockJobs,
          pagination: expect.any(Object),
        })
      );
    });

    test('should filter by job status', async () => {
      models.ProcessingQueue.findAndCountAll = jest.fn().mockResolvedValue({
        count: 1,
        rows: [{ id: 1, status: 'pending' }],
      });

      mockReq.query = { status: 'pending' };

      await processingController.listJobs(mockReq, mockRes);

      expect(models.ProcessingQueue.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'pending' }),
        })
      );
    });

    test('should filter by episode ID', async () => {
      models.ProcessingQueue.findAndCountAll = jest.fn().mockResolvedValue({
        count: 1,
        rows: [{ id: 1, episodeId: 1 }],
      });

      mockReq.query = { episodeId: 1 };

      await processingController.listJobs(mockReq, mockRes);

      expect(models.ProcessingQueue.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ episodeId: 1 }),
        })
      );
    });
  });

  describe('getJob()', () => {
    test('should return single job', async () => {
      const mockJob = { id: 1, episodeId: 1, jobType: 'thumbnail_generation', status: 'pending' };

      models.ProcessingQueue.findByPk = jest.fn().mockResolvedValue(mockJob);

      mockReq.params = { id: 1 };

      await processingController.getJob(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({ data: mockJob });
    });
  });

  describe('createJob()', () => {
    test('should create new processing job', async () => {
      const mockJob = { id: 1, episodeId: 1, jobType: 'thumbnail_generation', status: 'pending' };
      const mockEpisode = { id: 1, episodeTitle: 'Test' };

      models.Episode.findByPk = jest.fn().mockResolvedValue(mockEpisode);
      models.ProcessingQueue.create = jest.fn().mockResolvedValue(mockJob);

      mockReq.body = { episodeId: 1, jobType: 'thumbnail_generation' };

      await processingController.createJob(mockReq, mockRes);

      expect(models.ProcessingQueue.create).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    test('should log successful job creation', async () => {
      const mockJob = { id: 1, episodeId: 1, jobType: 'thumbnail_generation', status: 'pending' };
      const mockEpisode = { id: 1, episodeTitle: 'Test' };

      models.Episode.findByPk = jest.fn().mockResolvedValue(mockEpisode);
      models.ProcessingQueue.create = jest.fn().mockResolvedValue(mockJob);

      mockReq.body = {
        episodeId: 1,
        jobType: 'thumbnail_generation',
        jobConfig: { quality: 'high' },
      };

      await processingController.createJob(mockReq, mockRes);

      expect(logger.logAction).toHaveBeenCalled();
    });

    test('should support all valid job types', async () => {
      const mockEpisode = { id: 1, episodeTitle: 'Test' };

      models.Episode.findByPk = jest.fn().mockResolvedValue(mockEpisode);
      models.ProcessingQueue.create = jest.fn().mockResolvedValue({ id: 1 });

      const validTypes = ['thumbnail_generation', 'metadata_extraction', 'transcription'];
      for (const type of validTypes) {
        jest.clearAllMocks();
        mockReq.body = { episodeId: 1, jobType: type };

        await processingController.createJob(mockReq, mockRes);

        expect(models.ProcessingQueue.create).toHaveBeenCalledWith(
          expect.objectContaining({ jobType: type })
        );
      }
    });
  });

  describe('updateJob()', () => {
    test('should update job status', async () => {
      const mockJob = {
        id: 1,
        status: 'pending',
        startedAt: null,
        completedAt: null,
        toJSON: jest.fn().mockReturnValue({ status: 'pending' }),
        update: jest.fn().mockResolvedValue(true),
      };

      models.ProcessingQueue.findByPk = jest.fn().mockResolvedValue(mockJob);

      mockReq.params = { id: 1 };
      mockReq.body = { status: 'processing' };

      await processingController.updateJob(mockReq, mockRes);

      expect(mockJob.update).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ data: mockJob }));
    });

    test('should set startedAt when transitioning to processing', async () => {
      const mockJob = {
        id: 1,
        status: 'pending',
        startedAt: null,
        completedAt: null,
        toJSON: jest.fn().mockReturnValue({ status: 'pending' }),
        update: jest.fn().mockResolvedValue(true),
      };

      models.ProcessingQueue.findByPk = jest.fn().mockResolvedValue(mockJob);

      mockReq.params = { id: 1 };
      mockReq.body = { status: 'processing' };

      await processingController.updateJob(mockReq, mockRes);

      expect(mockJob.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'processing', startedAt: expect.any(Date) })
      );
    });

    test('should set completedAt when transitioning to completed', async () => {
      const mockJob = {
        id: 1,
        status: 'processing',
        startedAt: new Date(),
        completedAt: null,
        toJSON: jest.fn().mockReturnValue({ status: 'processing' }),
        update: jest.fn().mockResolvedValue(true),
      };

      models.ProcessingQueue.findByPk = jest.fn().mockResolvedValue(mockJob);

      mockReq.params = { id: 1 };
      mockReq.body = { status: 'completed' };

      await processingController.updateJob(mockReq, mockRes);

      expect(mockJob.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed', completedAt: expect.any(Date) })
      );
    });
  });

  describe('retryJob()', () => {
    test('should retry failed job', async () => {
      const mockJob = {
        id: 1,
        status: 'failed',
        retryCount: 1,
        maxRetries: 3,
        toJSON: jest.fn().mockReturnValue({ status: 'failed', retryCount: 1 }),
        canRetry: jest.fn().mockReturnValue(true),
        retry: jest.fn().mockResolvedValue(true),
      };

      models.ProcessingQueue.findByPk = jest.fn().mockResolvedValue(mockJob);

      mockReq.params = { id: 1 };

      await processingController.retryJob(mockReq, mockRes);

      expect(mockJob.retry).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ data: mockJob }));
    });

    test('should log retry action', async () => {
      const mockJob = {
        id: 1,
        status: 'failed',
        retryCount: 1,
        maxRetries: 3,
        toJSON: jest.fn().mockReturnValue({ status: 'failed', retryCount: 1 }),
        canRetry: jest.fn().mockReturnValue(true),
        retry: jest.fn().mockResolvedValue(true),
      };

      models.ProcessingQueue.findByPk = jest.fn().mockResolvedValue(mockJob);

      mockReq.params = { id: 1 };

      await processingController.retryJob(mockReq, mockRes);

      expect(logger.logAction).toHaveBeenCalledWith(
        'user-123',
        'edit',
        'processing',
        1,
        expect.any(Object)
      );
    });

    test('should return 400 if max retries exceeded', async () => {
      const mockJob = {
        id: 1,
        status: 'failed',
        maxRetries: 3,
        retryCount: 3,
        toJSON: jest.fn().mockReturnValue({ status: 'failed', retryCount: 3 }),
        canRetry: jest.fn().mockReturnValue(false),
      };

      models.ProcessingQueue.findByPk = jest.fn().mockResolvedValue(mockJob);

      mockReq.params = { id: 1 };

      await processingController.retryJob(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Bad Request',
          code: 'JOB_MAX_RETRIES_EXCEEDED',
        })
      );
    });
  });

  describe('cancelJob()', () => {
    test('should cancel pending job', async () => {
      const mockJob = {
        id: 1,
        status: 'pending',
        toJSON: jest.fn().mockReturnValue({ id: 1, status: 'pending' }),
        destroy: jest.fn().mockResolvedValue(true),
      };

      models.ProcessingQueue.findByPk = jest.fn().mockResolvedValue(mockJob);

      mockReq.params = { id: 1 };

      await processingController.cancelJob(mockReq, mockRes);

      expect(mockJob.destroy).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Processing job cancelled' })
      );
    });

    test('should log cancellation', async () => {
      const mockJob = {
        id: 1,
        status: 'pending',
        toJSON: jest.fn().mockReturnValue({ id: 1, status: 'pending' }),
        destroy: jest.fn().mockResolvedValue(true),
      };

      models.ProcessingQueue.findByPk = jest.fn().mockResolvedValue(mockJob);

      mockReq.params = { id: 1 };

      await processingController.cancelJob(mockReq, mockRes);

      expect(logger.logAction).toHaveBeenCalledWith(
        'user-123',
        'delete',
        'processing',
        1,
        expect.any(Object)
      );
    });

    test('should return 400 if job already processing', async () => {
      const mockJob = {
        id: 1,
        status: 'processing',
        toJSON: jest.fn().mockReturnValue({ id: 1, status: 'processing' }),
      };

      models.ProcessingQueue.findByPk = jest.fn().mockResolvedValue(mockJob);

      mockReq.params = { id: 1 };

      await processingController.cancelJob(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Bad Request',
          code: 'JOB_CANNOT_CANCEL',
        })
      );
    });

    test('should reject cancellation of completed jobs', async () => {
      const mockJob = {
        id: 1,
        status: 'completed',
        toJSON: jest.fn().mockReturnValue({ id: 1, status: 'completed' }),
      };

      models.ProcessingQueue.findByPk = jest.fn().mockResolvedValue(mockJob);

      mockReq.params = { id: 1 };

      await processingController.cancelJob(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getEpisodeJobs()', () => {
    test('should return all jobs for episode', async () => {
      const mockEpisode = { id: 1, episodeTitle: 'Test' };
      const mockJobs = [
        { id: 1, status: 'completed', jobType: 'thumbnail_generation' },
        { id: 2, status: 'pending', jobType: 'metadata_extraction' },
      ];

      models.Episode.findByPk = jest.fn().mockResolvedValue(mockEpisode);
      models.ProcessingQueue.getEpisodeJobs = jest.fn().mockResolvedValue(mockJobs);

      mockReq.params = { episodeId: 1 };

      await processingController.getEpisodeJobs(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ data: mockJobs }));
    });

    test('should calculate summary statistics', async () => {
      const mockEpisode = { id: 1, episodeTitle: 'Test' };
      const mockJobs = [
        { id: 1, status: 'completed', jobType: 'thumbnail_generation' },
        { id: 2, status: 'pending', jobType: 'metadata_extraction' },
        { id: 3, status: 'failed', jobType: 'transcription' },
      ];

      models.Episode.findByPk = jest.fn().mockResolvedValue(mockEpisode);
      models.ProcessingQueue.getEpisodeJobs = jest.fn().mockResolvedValue(mockJobs);

      mockReq.params = { episodeId: 1 };

      await processingController.getEpisodeJobs(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: expect.objectContaining({
            byStatus: {
              pending: 1,
              processing: 0,
              completed: 1,
              failed: 1,
            },
          }),
        })
      );
    });
  });

  describe('getPendingJobs()', () => {
    test('should return pending jobs', async () => {
      const mockJobs = [{ id: 1, status: 'pending', jobType: 'thumbnail_generation' }];

      models.ProcessingQueue.findPending = jest.fn().mockResolvedValue(mockJobs);

      await processingController.getPendingJobs(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ data: mockJobs }));
    });
  });

  describe('getFailedJobs()', () => {
    test('should return failed jobs', async () => {
      const mockJobs = [{ id: 1, status: 'failed', jobType: 'thumbnail_generation' }];

      models.ProcessingQueue.findFailed = jest.fn().mockResolvedValue(mockJobs);

      await processingController.getFailedJobs(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ data: mockJobs }));
    });
  });

  describe('getRetryableJobs()', () => {
    test('should return retryable jobs', async () => {
      const mockJobs = [
        { id: 1, status: 'failed', retryCount: 1, maxRetries: 3, jobType: 'thumbnail_generation' },
      ];

      models.ProcessingQueue.findRetryable = jest.fn().mockResolvedValue(mockJobs);

      await processingController.getRetryableJobs(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ data: mockJobs }));
    });
  });

  describe('getStats()', () => {
    test('should return processing statistics', async () => {
      const mockStats = {
        total: 100,
        byStatus: { pending: 10, processing: 20, completed: 60, failed: 10 },
      };

      models.ProcessingQueue.getStats = jest.fn().mockResolvedValue(mockStats);

      await processingController.getStats(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ data: mockStats }));
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors', async () => {
      models.ProcessingQueue.findAndCountAll = jest.fn().mockRejectedValue(new Error('DB error'));

      await expect(processingController.listJobs(mockReq, mockRes)).rejects.toThrow('DB error');
    });
  });
});
