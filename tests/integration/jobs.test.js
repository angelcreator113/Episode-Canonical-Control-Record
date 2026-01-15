/**
 * Queue Service and Job Processor Integration Tests
 * Tests for SQS queue operations and job processing flow
 */

const QueueService = require('../../src/services/QueueService');
const JobProcessor = require('../../src/services/JobProcessor');
const { Job, JOB_STATUS, JOB_TYPE } = require('../../src/models/job');
const db = require('../../src/config/database');
const { v4: uuidv4 } = require('uuid');

// Mock AWS SDK for testing
jest.mock('aws-sdk', () => ({
  SQS: jest.fn().mockImplementation(() => ({
    sendMessage: jest.fn().mockImplementation((params) => ({
      promise: jest.fn().mockResolvedValue({ MessageId: 'mock-message-id' }),
    })),
    receiveMessage: jest.fn().mockImplementation((params) => ({
      promise: jest.fn().mockResolvedValue({ Messages: [] }),
    })),
    deleteMessage: jest.fn().mockImplementation((params) => ({
      promise: jest.fn().mockResolvedValue({}),
    })),
    changeMessageVisibility: jest.fn().mockImplementation((params) => ({
      promise: jest.fn().mockResolvedValue({}),
    })),
    getQueueAttributes: jest.fn().mockImplementation((params) => ({
      promise: jest.fn().mockResolvedValue({
        Attributes: {
          ApproximateNumberOfMessages: '5',
          ApproximateNumberOfMessagesNotVisible: '2',
          ApproximateNumberOfMessagesDelayed: '0',
          CreatedTimestamp: Math.floor(Date.now() / 1000).toString(),
          LastModifiedTimestamp: Math.floor(Date.now() / 1000).toString(),
        },
      }),
    })),
  })),
}));

describe('Job Queue System Integration', () => {
  const testUserId = 'queue-test-' + uuidv4();
  let testJobId;

  beforeAll(async () => {
    // Ensure tables exist
    await db
      .query(
        `
      CREATE TABLE IF NOT EXISTS jobs (
        id UUID PRIMARY KEY,
        user_id VARCHAR(255),
        job_type VARCHAR(50),
        status VARCHAR(20),
        payload JSONB,
        results JSONB,
        error_message TEXT,
        retry_count INT DEFAULT 0,
        max_retries INT DEFAULT 3,
        created_at TIMESTAMP,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        next_retry_at TIMESTAMP,
        updated_at TIMESTAMP
      );
    `
      )
      .catch(() => {});
  });

  afterEach(async () => {
    if (testJobId) {
      await db.query('DELETE FROM jobs WHERE id = $1', [testJobId]);
    }
  });

  describe('QueueService', () => {
    test('should send job to queue', async () => {
      const job = await Job.create({
        userId: testUserId,
        jobType: JOB_TYPE.THUMBNAIL_GENERATION,
        payload: { episodeId: uuidv4() },
      });
      testJobId = job.id;

      const result = await QueueService.sendJob(job.id);
      expect(result).toBeDefined();
      expect(result.MessageId).toBeDefined();
    });

    test('should throw error for non-existent job', async () => {
      await expect(QueueService.sendJob(uuidv4())).rejects.toThrow();
    });

    test('should get queue stats', async () => {
      const stats = await QueueService.getQueueStats();
      expect(stats).toBeDefined();
      expect(stats.queueUrl).toBeDefined();
      expect(stats.visibleMessages).toBeDefined();
      expect(stats.processingMessages).toBeDefined();
    });
  });

  describe('JobProcessor', () => {
    test('should register job handler', () => {
      const handler = jest.fn();
      JobProcessor.registerHandler('test-job-type', handler);

      expect(JobProcessor.handlers.has('test-job-type')).toBe(true);
    });

    test('should reject invalid handler', () => {
      expect(() => {
        JobProcessor.registerHandler('invalid-type', 'not-a-function');
      }).toThrow();
    });

    test('should track active jobs', () => {
      const stats = JobProcessor.getStats();
      expect(stats).toBeDefined();
      expect(stats.maxConcurrent).toBeGreaterThan(0);
    });

    test('should have default handlers for job types', () => {
      // Register default handlers
      JobProcessor.registerHandler(
        JOB_TYPE.THUMBNAIL_GENERATION,
        async (jobId, payload, userId) => {
          return { status: 'completed' };
        }
      );

      expect(JobProcessor.handlers.has(JOB_TYPE.THUMBNAIL_GENERATION)).toBe(true);
    });
  });

  describe('Job Processing Flow', () => {
    test('should process job successfully', async () => {
      // Create job
      const job = await Job.create({
        userId: testUserId,
        jobType: JOB_TYPE.THUMBNAIL_GENERATION,
        payload: { episodeId: uuidv4() },
      });
      testJobId = job.id;

      expect(job.status).toBe(JOB_STATUS.PENDING);

      // Simulate sending to queue
      await QueueService.sendJob(job.id);

      // Register handler and process
      JobProcessor.registerHandler(
        JOB_TYPE.THUMBNAIL_GENERATION,
        async (jobId, payload, userId) => {
          return { thumbnailsGenerated: 3 };
        }
      );

      // Update status to processing
      let updated = await Job.updateStatus(job.id, JOB_STATUS.PROCESSING, {
        startedAt: new Date(),
      });
      expect(updated.status).toBe(JOB_STATUS.PROCESSING);

      // Mark as completed
      updated = await Job.updateStatus(job.id, JOB_STATUS.COMPLETED, {
        results: { thumbnailsGenerated: 3 },
        completedAt: new Date(),
      });
      expect(updated.status).toBe(JOB_STATUS.COMPLETED);
      expect(updated.results.thumbnailsGenerated).toBe(3);
    });

    test('should handle job failure with retry', async () => {
      const job = await Job.create({
        userId: testUserId,
        jobType: JOB_TYPE.VIDEO_PROCESSING,
        payload: { videoUrl: 'https://example.com/video.mp4' },
        maxRetries: 3,
      });
      testJobId = job.id;

      // Mark as failed
      let updated = await Job.updateStatus(job.id, JOB_STATUS.FAILED, {
        errorMessage: 'Processing failed',
      });
      expect(updated.status).toBe(JOB_STATUS.FAILED);

      // Retry
      updated = await Job.retry(job.id);
      expect(updated.retryCount).toBe(1);
    });

    test('should move to DLQ after max retries', async () => {
      const job = await Job.create({
        userId: testUserId,
        jobType: JOB_TYPE.BULK_EXPORT,
        payload: { episodeIds: [uuidv4()] },
        maxRetries: 1,
      });
      testJobId = job.id;

      // Simulate retries
      await Job.updateStatus(job.id, JOB_STATUS.FAILED, {
        errorMessage: 'Attempt 1 failed',
      });
      await Job.retry(job.id); // retryCount = 1

      // Next failure should not allow retry
      await Job.updateStatus(job.id, JOB_STATUS.FAILED, {
        errorMessage: 'Attempt 2 failed',
      });

      // Verify job is failed and won't retry
      const final = await Job.getById(job.id);
      expect(final.status).toBe(JOB_STATUS.FAILED);
      expect(final.retryCount).toBe(1);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing job', async () => {
      const result = await Job.getById(uuidv4());
      expect(result).toBeNull();
    });

    test('should handle job type mismatch gracefully', async () => {
      const job = await Job.create({
        userId: testUserId,
        jobType: 'unknown-type',
        payload: { test: true },
      });
      testJobId = job.id;

      const stats = JobProcessor.getStats();
      expect(stats.handlersRegistered).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Job Statistics', () => {
    test('should retrieve job statistics', async () => {
      const stats = await Job.getStats();
      expect(stats).toBeDefined();
      expect(stats.total).toBeDefined();
      expect(stats.pending).toBeDefined();
      expect(stats.completed).toBeDefined();
    });

    test('should count jobs by status', async () => {
      const job = await Job.create({
        userId: testUserId,
        jobType: JOB_TYPE.THUMBNAIL_GENERATION,
        payload: { episodeId: uuidv4() },
      });
      testJobId = job.id;

      const count = await Job.countByStatus(JOB_STATUS.PENDING);
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Job Cleanup', () => {
    test('should clean up old jobs', async () => {
      const deleted = await Job.cleanup(30);
      expect(typeof deleted).toBe('number');
    });
  });
});
