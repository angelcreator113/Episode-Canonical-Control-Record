/**
 * Job Model - Database abstraction for job records
 * Handles CRUD operations, status tracking, and retry logic
 */

const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const JOB_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

const JOB_TYPE = {
  THUMBNAIL_GENERATION: 'thumbnail-generation',
  VIDEO_PROCESSING: 'video-processing',
  BULK_UPLOAD: 'bulk-upload',
  BULK_EXPORT: 'bulk-export',
  DATA_IMPORT: 'data-import',
  BATCH_DELETE: 'batch-delete',
  COMPOSITION_RENDER: 'composition-render'
};

class Job {
  static tableName = 'jobs';

  /**
   * Create a new job record
   */
  static async create(jobData) {
    const {
      userId,
      jobType,
      payload,
      maxRetries = 3
    } = jobData;

    const id = uuidv4();
    const createdAt = new Date();

    const query = `
      INSERT INTO ${this.tableName}
      (id, user_id, job_type, status, payload, max_retries, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      id,
      userId,
      jobType,
      JOB_STATUS.PENDING,
      JSON.stringify(payload),
      maxRetries,
      createdAt
    ];

    try {
      const result = await db.query(query, values);
      logger.info('Job created', { id, jobType, userId });
      return this.formatJob(result.rows[0]);
    } catch (error) {
      logger.error('Error creating job', { error, jobType });
      throw error;
    }
  }

  /**
   * Get job by ID
   */
  static async getById(id) {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE id = $1
    `;

    try {
      const result = await db.query(query, [id]);
      if (result.rows.length === 0) return null;
      return this.formatJob(result.rows[0]);
    } catch (error) {
      logger.error('Error fetching job', { error, id });
      throw error;
    }
  }

  /**
   * Get jobs by user ID with pagination
   */
  static async getByUserId(userId, limit = 20, offset = 0) {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    try {
      const result = await db.query(query, [userId, limit, offset]);
      return result.rows.map(row => this.formatJob(row));
    } catch (error) {
      logger.error('Error fetching user jobs', { error, userId });
      throw error;
    }
  }

  /**
   * Get jobs by status
   */
  static async getByStatus(status, limit = 20, offset = 0) {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE status = $1
      ORDER BY created_at ASC
      LIMIT $2 OFFSET $3
    `;

    try {
      const result = await db.query(query, [status, limit, offset]);
      return result.rows.map(row => this.formatJob(row));
    } catch (error) {
      logger.error('Error fetching jobs by status', { error, status });
      throw error;
    }
  }

  /**
   * Get pending jobs for processing
   */
  static async getPending(limit = 10) {
    return this.getByStatus(JOB_STATUS.PENDING, limit, 0);
  }

  /**
   * Get jobs ready for retry
   */
  static async getRetryable(limit = 10) {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE status = $1 
      AND retry_count < max_retries
      AND next_retry_at IS NOT NULL
      AND next_retry_at <= NOW()
      ORDER BY next_retry_at ASC
      LIMIT $2
    `;

    try {
      const result = await db.query(query, [JOB_STATUS.FAILED, limit]);
      return result.rows.map(row => this.formatJob(row));
    } catch (error) {
      logger.error('Error fetching retryable jobs', { error });
      throw error;
    }
  }

  /**
   * Update job status
   */
  static async updateStatus(id, status, updates = {}) {
    const {
      results = null,
      errorMessage = null,
      startedAt = null,
      completedAt = null
    } = updates;

    const query = `
      UPDATE ${this.tableName}
      SET status = $1,
          results = $2,
          error_message = $3,
          started_at = COALESCE($4, started_at),
          completed_at = $5,
          updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `;

    const values = [
      status,
      results ? JSON.stringify(results) : null,
      errorMessage,
      startedAt,
      completedAt,
      id
    ];

    try {
      const result = await db.query(query, values);
      if (result.rows.length === 0) return null;
      logger.info('Job status updated', { id, status });
      return this.formatJob(result.rows[0]);
    } catch (error) {
      logger.error('Error updating job status', { error, id });
      throw error;
    }
  }

  /**
   * Increment retry count and schedule next retry
   */
  static async retry(id, baseDelay = 5000) {
    const query = `
      UPDATE ${this.tableName}
      SET retry_count = retry_count + 1,
          next_retry_at = NOW() + INTERVAL '1 second' * ($1::numeric / 1000),
          updated_at = NOW()
      WHERE id = $2 AND retry_count < max_retries
      RETURNING *
    `;

    try {
      const result = await db.query(query, [baseDelay, id]);
      if (result.rows.length === 0) return null;
      logger.info('Job retry scheduled', { id, retryCount: result.rows[0].retry_count });
      return this.formatJob(result.rows[0]);
    } catch (error) {
      logger.error('Error retrying job', { error, id });
      throw error;
    }
  }

  /**
   * Cancel job
   */
  static async cancel(id) {
    const query = `
      UPDATE ${this.tableName}
      SET status = $1, updated_at = NOW()
      WHERE id = $2 AND status IN ($3, $4)
      RETURNING *
    `;

    try {
      const result = await db.query(query, [
        JOB_STATUS.CANCELLED,
        id,
        JOB_STATUS.PENDING,
        JOB_STATUS.PROCESSING
      ]);
      if (result.rows.length === 0) return null;
      logger.info('Job cancelled', { id });
      return this.formatJob(result.rows[0]);
    } catch (error) {
      logger.error('Error cancelling job', { error, id });
      throw error;
    }
  }

  /**
   * Count jobs by status
   */
  static async countByStatus(status) {
    const query = `
      SELECT COUNT(*) as count FROM ${this.tableName}
      WHERE status = $1
    `;

    try {
      const result = await db.query(query, [status]);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error('Error counting jobs', { error, status });
      throw error;
    }
  }

  /**
   * Get job statistics
   */
  static async getStats() {
    const query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = $1 THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = $2 THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = $3 THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = $4 THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = $5 THEN 1 ELSE 0 END) as cancelled,
        AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_duration_seconds
      FROM ${this.tableName}
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `;

    try {
      const result = await db.query(query, [
        JOB_STATUS.PENDING,
        JOB_STATUS.PROCESSING,
        JOB_STATUS.COMPLETED,
        JOB_STATUS.FAILED,
        JOB_STATUS.CANCELLED
      ]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error getting job stats', { error });
      throw error;
    }
  }

  /**
   * Format job from database
   */
  static formatJob(row) {
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      jobType: row.job_type,
      status: row.status,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
      results: row.results ? (typeof row.results === 'string' ? JSON.parse(row.results) : row.results) : null,
      errorMessage: row.error_message,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      createdAt: row.created_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      nextRetryAt: row.next_retry_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Clean up old completed jobs
   */
  static async cleanup(daysOld = 30) {
    const query = `
      DELETE FROM ${this.tableName}
      WHERE status IN ($1, $2)
      AND completed_at < NOW() - INTERVAL '${daysOld} days'
    `;

    try {
      const result = await db.query(query, [JOB_STATUS.COMPLETED, JOB_STATUS.CANCELLED]);
      logger.info('Job cleanup completed', { deleted: result.rowCount });
      return result.rowCount;
    } catch (error) {
      logger.error('Error cleaning up jobs', { error });
      throw error;
    }
  }
}

module.exports = {
  Job,
  JOB_STATUS,
  JOB_TYPE
};
