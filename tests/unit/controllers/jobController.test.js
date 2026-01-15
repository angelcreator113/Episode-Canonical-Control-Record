/**
 * JobController Unit Tests
 * Tests job management endpoints
 */

process.env.NODE_ENV = 'test';

// Mock services and models
jest.mock('../../../src/services/JobQueueService', () => ({
  enqueueJob: jest.fn(),
}));

jest.mock('../../../src/models', () => ({
  ProcessingQueue: {
    create: jest.fn(),
    findByPk: jest.fn(),
    findAndCountAll: jest.fn(),
  },
}));

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const jobController = require('../../../src/controllers/jobController');
const JobQueueService = require('../../../src/services/JobQueueService');
const { ProcessingQueue } = require('../../../src/models');

describe('JobController', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      params: {},
      body: {},
      query: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('createJob', () => {
    it('should create a new job successfully', async () => {
      req.body = {
        type: 'thumbnail_generation',
        episodeId: 'ep-1',
        fileId: 'file-1',
        metadata: { quality: 'hd' },
      };

      JobQueueService.enqueueJob.mockResolvedValue({
        jobId: 'job-1',
        messageId: 'msg-1',
      });

      ProcessingQueue.create.mockResolvedValue({
        id: 'job-1',
        job_type: 'thumbnail_generation',
        episode_id: 'ep-1',
        file_id: 'file-1',
        status: 'pending',
        progress: 0,
        data: { metadata: { quality: 'hd' } },
        sqs_message_id: 'msg-1',
        created_at: new Date(),
      });

      await jobController.createJob(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job-1',
          type: 'thumbnail_generation',
          status: 'pending',
          progress: 0,
        })
      );
      expect(JobQueueService.enqueueJob).toHaveBeenCalled();
      expect(ProcessingQueue.create).toHaveBeenCalled();
    });

    it('should return 400 if type is missing', async () => {
      req.body = {
        episodeId: 'ep-1',
      };

      await jobController.createJob(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('required') })
      );
    });

    it('should return 400 if episodeId is missing', async () => {
      req.body = {
        type: 'thumbnail_generation',
      };

      await jobController.createJob(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('required') })
      );
    });

    it('should handle job creation errors', async () => {
      req.body = {
        type: 'thumbnail_generation',
        episodeId: 'ep-1',
      };

      JobQueueService.enqueueJob.mockRejectedValue(new Error('SQS error'));

      await jobController.createJob(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Job creation failed' })
      );
    });

    it('should handle database creation errors', async () => {
      req.body = {
        type: 'thumbnail_generation',
        episodeId: 'ep-1',
      };

      JobQueueService.enqueueJob.mockResolvedValue({
        jobId: 'job-1',
        messageId: 'msg-1',
      });

      ProcessingQueue.create.mockRejectedValue(new Error('Database error'));

      await jobController.createJob(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Job creation failed' })
      );
    });
  });

  describe('getJobStatus', () => {
    it('should return job status successfully', async () => {
      req.params = { jobId: 'job-1' };

      ProcessingQueue.findByPk.mockResolvedValue({
        id: 'job-1',
        job_type: 'thumbnail_generation',
        status: 'processing',
        progress: 50,
        retry_count: 0,
        error: null,
        created_at: new Date(),
        updated_at: new Date(),
        completed_at: null,
      });

      await jobController.getJobStatus(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job-1',
          type: 'thumbnail_generation',
          status: 'processing',
          progress: 50,
        })
      );
    });

    it('should return 404 if job not found', async () => {
      req.params = { jobId: 'nonexistent' };

      ProcessingQueue.findByPk.mockResolvedValue(null);

      await jobController.getJobStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Job not found' }));
    });

    it('should handle status retrieval errors', async () => {
      req.params = { jobId: 'job-1' };

      ProcessingQueue.findByPk.mockRejectedValue(new Error('Database error'));

      await jobController.getJobStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Failed to get job status' })
      );
    });

    it('should include all job details', async () => {
      req.params = { jobId: 'job-1' };

      const jobDetails = {
        id: 'job-1',
        job_type: 'thumbnail_generation',
        status: 'failed',
        progress: 75,
        retry_count: 2,
        error: 'Timeout',
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-02'),
        completed_at: new Date('2024-01-02'),
      };

      ProcessingQueue.findByPk.mockResolvedValue(jobDetails);

      await jobController.getJobStatus(req, res);

      const response = res.json.mock.calls[0][0];
      expect(response.retryCount).toBe(2);
      expect(response.error).toBe('Timeout');
      expect(response.completedAt).toBeDefined();
    });
  });

  describe('listJobs', () => {
    it('should list all jobs', async () => {
      req.query = {};

      ProcessingQueue.findAndCountAll.mockResolvedValue({
        count: 2,
        rows: [
          {
            id: 'job-1',
            job_type: 'thumbnail_generation',
            status: 'completed',
            progress: 100,
            retry_count: 0,
            created_at: new Date(),
            updated_at: new Date(),
          },
          {
            id: 'job-2',
            job_type: 'indexing',
            status: 'pending',
            progress: 0,
            retry_count: 0,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      await jobController.listJobs(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          total: 2,
          jobs: expect.arrayContaining([
            expect.objectContaining({ jobId: 'job-1' }),
            expect.objectContaining({ jobId: 'job-2' }),
          ]),
        })
      );
    });

    it('should filter by episodeId', async () => {
      req.query = { episodeId: 'ep-1' };

      ProcessingQueue.findAndCountAll.mockResolvedValue({
        count: 1,
        rows: [
          {
            id: 'job-1',
            job_type: 'thumbnail_generation',
            status: 'completed',
            progress: 100,
            retry_count: 0,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      await jobController.listJobs(req, res);

      const callArgs = ProcessingQueue.findAndCountAll.mock.calls[0][0];
      expect(callArgs.where.episode_id).toBe('ep-1');
    });

    it('should filter by status', async () => {
      req.query = { status: 'failed' };

      ProcessingQueue.findAndCountAll.mockResolvedValue({
        count: 1,
        rows: [
          {
            id: 'job-1',
            job_type: 'thumbnail_generation',
            status: 'failed',
            progress: 50,
            retry_count: 1,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      await jobController.listJobs(req, res);

      const callArgs = ProcessingQueue.findAndCountAll.mock.calls[0][0];
      expect(callArgs.where.status).toBe('failed');
    });

    it('should filter by type', async () => {
      req.query = { type: 'indexing' };

      ProcessingQueue.findAndCountAll.mockResolvedValue({
        count: 1,
        rows: [],
      });

      await jobController.listJobs(req, res);

      const callArgs = ProcessingQueue.findAndCountAll.mock.calls[0][0];
      expect(callArgs.where.job_type).toBe('indexing');
    });

    it('should respect pagination limit', async () => {
      req.query = { limit: '200' }; // Should be capped at 100

      ProcessingQueue.findAndCountAll.mockResolvedValue({
        count: 200,
        rows: [],
      });

      await jobController.listJobs(req, res);

      const callArgs = ProcessingQueue.findAndCountAll.mock.calls[0][0];
      expect(callArgs.limit).toBe(100); // Capped
    });

    it('should respect pagination offset', async () => {
      req.query = { offset: '50' };

      ProcessingQueue.findAndCountAll.mockResolvedValue({
        count: 100,
        rows: [],
      });

      await jobController.listJobs(req, res);

      const callArgs = ProcessingQueue.findAndCountAll.mock.calls[0][0];
      expect(callArgs.offset).toBe(50);
    });

    it('should handle list errors', async () => {
      req.query = {};

      ProcessingQueue.findAndCountAll.mockRejectedValue(new Error('Database error'));

      await jobController.listJobs(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Failed to list jobs' })
      );
    });

    it('should use default pagination values', async () => {
      req.query = {};

      ProcessingQueue.findAndCountAll.mockResolvedValue({
        count: 50,
        rows: [],
      });

      await jobController.listJobs(req, res);

      const response = res.json.mock.calls[0][0];
      expect(response.limit).toBe(20); // Default limit
      expect(response.offset).toBe(0); // Default offset
    });
  });

  describe('retryJob', () => {
    it('should retry a failed job successfully', async () => {
      req.params = { jobId: 'job-1' };

      ProcessingQueue.findByPk.mockResolvedValue({
        id: 'job-1',
        job_type: 'thumbnail_generation',
        episode_id: 'ep-1',
        file_id: 'file-1',
        status: 'failed',
        progress: 50,
        retry_count: 0,
        error: 'Timeout',
        data: { metadata: {} },
        update: jest.fn().mockResolvedValue({
          id: 'job-1',
          status: 'pending',
          retry_count: 1,
        }),
      });

      JobQueueService.enqueueJob.mockResolvedValue({
        jobId: 'job-1',
        messageId: 'msg-2',
      });

      await jobController.retryJob(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job-1',
          retryCount: 1,
          message: expect.stringContaining('re-enqueued'),
        })
      );
    });

    it('should return 404 if job not found', async () => {
      req.params = { jobId: 'nonexistent' };

      ProcessingQueue.findByPk.mockResolvedValue(null);

      await jobController.retryJob(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Job not found' }));
    });

    it('should return 400 if job is not failed', async () => {
      req.params = { jobId: 'job-1' };

      ProcessingQueue.findByPk.mockResolvedValue({
        id: 'job-1',
        status: 'completed',
        update: jest.fn(),
      });

      await jobController.retryJob(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('failed') })
      );
    });

    it('should increment retry count', async () => {
      req.params = { jobId: 'job-1' };

      const mockJob = {
        id: 'job-1',
        job_type: 'thumbnail_generation',
        episode_id: 'ep-1',
        file_id: 'file-1',
        status: 'failed',
        retry_count: 2,
        data: { metadata: {} },
        update: jest.fn().mockResolvedValue({}),
      };

      ProcessingQueue.findByPk.mockResolvedValue(mockJob);
      JobQueueService.enqueueJob.mockResolvedValue({
        jobId: 'job-1',
        messageId: 'msg-3',
      });

      await jobController.retryJob(req, res);

      expect(mockJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          retry_count: 3, // Should be incremented
        })
      );
    });

    it('should handle retry errors', async () => {
      req.params = { jobId: 'job-1' };

      ProcessingQueue.findByPk.mockRejectedValue(new Error('Database error'));

      await jobController.retryJob(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Job retry failed' }));
    });

    it('should clear error message on retry', async () => {
      req.params = { jobId: 'job-1' };

      const mockJob = {
        id: 'job-1',
        job_type: 'thumbnail_generation',
        episode_id: 'ep-1',
        file_id: 'file-1',
        status: 'failed',
        retry_count: 0,
        error: 'Previous error',
        data: { metadata: {} },
        update: jest.fn().mockResolvedValue({}),
      };

      ProcessingQueue.findByPk.mockResolvedValue(mockJob);
      JobQueueService.enqueueJob.mockResolvedValue({
        jobId: 'job-1',
        messageId: 'msg-2',
      });

      await jobController.retryJob(req, res);

      expect(mockJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          error: null, // Should clear error
        })
      );
    });
  });

  describe('cancelJob', () => {
    it('should cancel a pending job successfully', async () => {
      req.params = { jobId: 'job-1' };

      const mockJob = {
        id: 'job-1',
        status: 'pending',
        update: jest.fn(),
      };

      // After update, status becomes cancelled
      mockJob.update.mockImplementation(async (updates) => {
        Object.assign(mockJob, updates);
        return mockJob;
      });

      ProcessingQueue.findByPk.mockResolvedValue(mockJob);

      await jobController.cancelJob(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job-1',
          status: 'cancelled',
          message: expect.stringContaining('successfully'),
        })
      );
    });

    it('should cancel a processing job successfully', async () => {
      req.params = { jobId: 'job-2' };

      const mockJob = {
        id: 'job-2',
        status: 'processing',
        update: jest.fn(),
      };

      // After update, status becomes cancelled
      mockJob.update.mockImplementation(async (updates) => {
        Object.assign(mockJob, updates);
        return mockJob;
      });

      ProcessingQueue.findByPk.mockResolvedValue(mockJob);

      await jobController.cancelJob(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job-2',
          status: 'cancelled',
        })
      );
    });

    it('should return 404 if job not found', async () => {
      req.params = { jobId: 'nonexistent' };

      ProcessingQueue.findByPk.mockResolvedValue(null);

      await jobController.cancelJob(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Job not found' }));
    });

    it('should return 400 if job is completed', async () => {
      req.params = { jobId: 'job-1' };

      ProcessingQueue.findByPk.mockResolvedValue({
        id: 'job-1',
        status: 'completed',
        update: jest.fn(),
      });

      await jobController.cancelJob(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('cancelled') })
      );
    });

    it('should return 400 if job is failed', async () => {
      req.params = { jobId: 'job-1' };

      ProcessingQueue.findByPk.mockResolvedValue({
        id: 'job-1',
        status: 'failed',
        update: jest.fn(),
      });

      await jobController.cancelJob(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('cancelled') })
      );
    });

    it('should return 400 if job is already cancelled', async () => {
      req.params = { jobId: 'job-1' };

      ProcessingQueue.findByPk.mockResolvedValue({
        id: 'job-1',
        status: 'cancelled',
        update: jest.fn(),
      });

      await jobController.cancelJob(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('cancelled') })
      );
    });

    it('should handle cancellation errors', async () => {
      req.params = { jobId: 'job-1' };

      ProcessingQueue.findByPk.mockRejectedValue(new Error('Database error'));

      await jobController.cancelJob(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Job cancellation failed' })
      );
    });
  });
});
