/**
 * Job Model Unit Tests
 * Tests for CRUD operations, status tracking, and retry logic
 */

const { Job, JOB_STATUS, JOB_TYPE } = require('../../src/models/job');
const db = require('../../src/config/database');
const { v4: uuidv4 } = require('uuid');

describe('Job Model', () => {
  const testUserId = 'test-user-' + uuidv4();
  let createdJobId;

  beforeAll(async () => {
    // Ensure jobs table exists
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
    // Clean up test data
    if (createdJobId) {
      await db.query('DELETE FROM jobs WHERE id = $1', [createdJobId]);
    }
  });

  describe('create', () => {
    test('should create a new job', async () => {
      const jobData = {
        userId: testUserId,
        jobType: JOB_TYPE.THUMBNAIL_GENERATION,
        payload: { episodeId: uuidv4(), frameTimestamps: [0, 5, 10] },
      };

      const job = await Job.create(jobData);
      createdJobId = job.id;

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.userId).toBe(testUserId);
      expect(job.jobType).toBe(JOB_TYPE.THUMBNAIL_GENERATION);
      expect(job.status).toBe(JOB_STATUS.PENDING);
      expect(job.payload).toEqual(jobData.payload);
    });

    test('should set default max retries', async () => {
      const job = await Job.create({
        userId: testUserId,
        jobType: JOB_TYPE.VIDEO_PROCESSING,
        payload: { videoUrl: 'https://example.com/video.mp4' },
      });
      createdJobId = job.id;

      expect(job.maxRetries).toBe(3);
    });

    test('should allow custom max retries', async () => {
      const job = await Job.create({
        userId: testUserId,
        jobType: JOB_TYPE.BULK_EXPORT,
        payload: { episodeIds: [uuidv4()] },
        maxRetries: 5,
      });
      createdJobId = job.id;

      expect(job.maxRetries).toBe(5);
    });
  });

  describe('getById', () => {
    test('should retrieve job by ID', async () => {
      const created = await Job.create({
        userId: testUserId,
        jobType: JOB_TYPE.THUMBNAIL_GENERATION,
        payload: { episodeId: uuidv4() },
      });
      createdJobId = created.id;

      const retrieved = await Job.getById(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(created.id);
      expect(retrieved.status).toBe(JOB_STATUS.PENDING);
    });

    test('should return null for non-existent job', async () => {
      const result = await Job.getById(uuidv4());
      expect(result).toBeNull();
    });
  });

  describe('getByUserId', () => {
    test('should list user jobs with pagination', async () => {
      // Create multiple jobs
      const jobs = [];
      for (let i = 0; i < 3; i++) {
        const job = await Job.create({
          userId: testUserId,
          jobType: JOB_TYPE.THUMBNAIL_GENERATION,
          payload: { episodeId: uuidv4() },
        });
        jobs.push(job.id);
      }
      createdJobId = jobs[0];

      const results = await Job.getByUserId(testUserId, 10, 0);
      expect(results.length).toBeGreaterThanOrEqual(3);
      expect(results[0].userId).toBe(testUserId);

      // Cleanup all
      for (const jobId of jobs) {
        await db.query('DELETE FROM jobs WHERE id = $1', [jobId]);
      }
    });

    test('should respect pagination limit', async () => {
      const results = await Job.getByUserId(testUserId, 1, 0);
      expect(results.length).toBeLessThanOrEqual(1);
    });
  });

  describe('updateStatus', () => {
    test('should update job status', async () => {
      const created = await Job.create({
        userId: testUserId,
        jobType: JOB_TYPE.THUMBNAIL_GENERATION,
        payload: { episodeId: uuidv4() },
      });
      createdJobId = created.id;

      const updated = await Job.updateStatus(created.id, JOB_STATUS.PROCESSING, {
        startedAt: new Date(),
      });

      expect(updated.status).toBe(JOB_STATUS.PROCESSING);
      expect(updated.startedAt).toBeDefined();
    });

    test('should store results when completing job', async () => {
      const created = await Job.create({
        userId: testUserId,
        jobType: JOB_TYPE.THUMBNAIL_GENERATION,
        payload: { episodeId: uuidv4() },
      });
      createdJobId = created.id;

      const results = { thumbnailsGenerated: 5, s3Urls: [] };
      const updated = await Job.updateStatus(created.id, JOB_STATUS.COMPLETED, {
        results: results,
        completedAt: new Date(),
      });

      expect(updated.status).toBe(JOB_STATUS.COMPLETED);
      expect(updated.results).toEqual(results);
    });

    test('should store error message on failure', async () => {
      const created = await Job.create({
        userId: testUserId,
        jobType: JOB_TYPE.VIDEO_PROCESSING,
        payload: { videoUrl: 'https://example.com/video.mp4' },
      });
      createdJobId = created.id;

      const errorMsg = 'Video processing failed: Invalid format';
      const updated = await Job.updateStatus(created.id, JOB_STATUS.FAILED, {
        errorMessage: errorMsg,
      });

      expect(updated.status).toBe(JOB_STATUS.FAILED);
      expect(updated.errorMessage).toBe(errorMsg);
    });
  });

  describe('retry', () => {
    test('should increment retry count', async () => {
      const created = await Job.create({
        userId: testUserId,
        jobType: JOB_TYPE.THUMBNAIL_GENERATION,
        payload: { episodeId: uuidv4() },
      });
      createdJobId = created.id;

      const retried = await Job.retry(created.id);
      expect(retried.retryCount).toBe(1);
    });

    test('should not retry when max retries exceeded', async () => {
      const created = await Job.create({
        userId: testUserId,
        jobType: JOB_TYPE.THUMBNAIL_GENERATION,
        payload: { episodeId: uuidv4() },
        maxRetries: 2,
      });
      createdJobId = created.id;

      // Set retry count to max
      await db.query('UPDATE jobs SET retry_count = 2 WHERE id = $1', [created.id]);

      const result = await Job.retry(created.id);
      expect(result).toBeNull();
    });

    test('should schedule next retry time', async () => {
      const created = await Job.create({
        userId: testUserId,
        jobType: JOB_TYPE.THUMBNAIL_GENERATION,
        payload: { episodeId: uuidv4() },
      });
      createdJobId = created.id;

      const retried = await Job.retry(created.id, 5000);
      expect(retried.nextRetryAt).toBeDefined();
    });
  });

  describe('cancel', () => {
    test('should cancel pending job', async () => {
      const created = await Job.create({
        userId: testUserId,
        jobType: JOB_TYPE.THUMBNAIL_GENERATION,
        payload: { episodeId: uuidv4() },
      });
      createdJobId = created.id;

      const cancelled = await Job.cancel(created.id);
      expect(cancelled.status).toBe(JOB_STATUS.CANCELLED);
    });

    test('should not cancel completed job', async () => {
      const created = await Job.create({
        userId: testUserId,
        jobType: JOB_TYPE.THUMBNAIL_GENERATION,
        payload: { episodeId: uuidv4() },
      });
      createdJobId = created.id;

      // Mark as completed
      await Job.updateStatus(created.id, JOB_STATUS.COMPLETED, {
        completedAt: new Date(),
      });

      const result = await Job.cancel(created.id);
      expect(result).toBeNull();
    });
  });

  describe('countByStatus', () => {
    test('should count jobs by status', async () => {
      const job = await Job.create({
        userId: testUserId,
        jobType: JOB_TYPE.THUMBNAIL_GENERATION,
        payload: { episodeId: uuidv4() },
      });
      createdJobId = job.id;

      const count = await Job.countByStatus(JOB_STATUS.PENDING);
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getStats', () => {
    test('should return job statistics', async () => {
      const stats = await Job.getStats();

      expect(stats).toBeDefined();
      expect(stats.total).toBeDefined();
      expect(stats.pending).toBeDefined();
      expect(stats.completed).toBeDefined();
      expect(stats.failed).toBeDefined();
    });
  });

  describe('formatJob', () => {
    test('should format database row to job object', () => {
      const row = {
        id: uuidv4(),
        user_id: testUserId,
        job_type: JOB_TYPE.THUMBNAIL_GENERATION,
        status: JOB_STATUS.PENDING,
        payload: JSON.stringify({ episodeId: uuidv4() }),
        results: null,
        error_message: null,
        retry_count: 0,
        max_retries: 3,
        created_at: new Date(),
        started_at: null,
        completed_at: null,
        next_retry_at: null,
        updated_at: new Date(),
      };

      const formatted = Job.formatJob(row);
      expect(formatted.id).toBe(row.id);
      expect(formatted.userId).toBe(row.user_id);
      expect(formatted.jobType).toBe(row.job_type);
      expect(typeof formatted.payload).toBe('object');
    });

    test('should parse JSON payloads', () => {
      const payload = { episodeId: uuidv4(), frameTimestamps: [0, 5, 10] };
      const row = {
        id: uuidv4(),
        payload: JSON.stringify(payload),
        results: null,
      };

      const formatted = Job.formatJob(row);
      expect(formatted.payload).toEqual(payload);
    });
  });

  describe('cleanup', () => {
    test('should clean up old jobs', async () => {
      // This would be better with a date mock, but for now just ensure it runs
      const result = await Job.cleanup(30);
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });
});
