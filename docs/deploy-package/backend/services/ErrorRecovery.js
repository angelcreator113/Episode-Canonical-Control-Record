/**
 * Error Recovery Service - Automatic retry and fallback strategies
 * Handles exponential backoff, DLQ management, and alerts
 */

const logger = require('../utils/logger');
const QueueService = require('./QueueService');
const { Job, JOB_STATUS } = require('../models/job');

class ErrorRecovery {
  static baseDelay = parseInt(process.env.INITIAL_RETRY_DELAY || '5000', 10);
  static maxDelay = parseInt(process.env.MAX_RETRY_DELAY || '300000', 10); // 5 minutes
  static backoffMultiplier = 2;

  /**
   * Calculate exponential backoff delay
   * Formula: baseDelay * (multiplier ^ attempt), capped at maxDelay
   */
  static exponentialBackoff(attempt, baseDelay = this.baseDelay) {
    const delay = baseDelay * Math.pow(this.backoffMultiplier, attempt);
    const cappedDelay = Math.min(delay, this.maxDelay);
    logger.debug('Exponential backoff calculated', { attempt, delay, cappedDelay });
    return cappedDelay;
  }

  /**
   * Move job to Dead Letter Queue
   */
  static async moveToDLQ(jobId, reason) {
    try {
      const job = await Job.getById(jobId);
      if (!job) {
        logger.warn('Job not found when moving to DLQ', { jobId });
        return;
      }

      // Update job status
      await Job.updateStatus(jobId, JOB_STATUS.FAILED, {
        errorMessage: reason,
        completedAt: new Date(),
      });

      // Send to SQS DLQ
      await QueueService.sendToDLQ(jobId, reason);
      logger.warn('Job moved to DLQ', { jobId, reason });
    } catch (error) {
      logger.error('Error moving job to DLQ', { error, jobId });
    }
  }

  /**
   * Send alert for job failure
   */
  static async sendAlert(jobId, error) {
    try {
      const job = await Job.getById(jobId);
      if (!job) return;

      const alertData = {
        jobId,
        userId: job.userId,
        jobType: job.jobType,
        error: error.message,
        timestamp: new Date().toISOString(),
        retryCount: job.retryCount,
        maxRetries: job.maxRetries,
      };

      // Log alert (in production, would send to monitoring service)
      logger.error('JOB_FAILURE_ALERT', alertData);

      // TODO: Send email/Slack notification to admins
      // TODO: Send to monitoring service (DataDog, New Relic, etc.)
    } catch (alertError) {
      logger.error('Error sending alert', { error: alertError });
    }
  }

  /**
   * Get failure rate statistics
   */
  static async getFailureRate(hours = 24) {
    try {
      const db = require('../config/database');

      const query = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = $1 THEN 1 ELSE 0 END) as failed,
          ROUND(100.0 * SUM(CASE WHEN status = $1 THEN 1 ELSE 0 END) / COUNT(*), 2) as failure_rate
        FROM jobs
        WHERE created_at >= NOW() - INTERVAL '${hours} hours'
      `;

      const result = await db.query(query, [JOB_STATUS.FAILED]);
      return {
        period: `${hours} hours`,
        total: parseInt(result.rows[0].total, 10),
        failed: parseInt(result.rows[0].failed || 0, 10),
        failureRate: parseFloat(result.rows[0].failure_rate || 0),
      };
    } catch (error) {
      logger.error('Error getting failure rate', { error });
      throw error;
    }
  }

  /**
   * Get retry statistics
   */
  static async getRetryStats() {
    try {
      const db = require('../config/database');

      const query = `
        SELECT 
          COUNT(*) as total,
          AVG(retry_count) as avg_retries,
          MAX(retry_count) as max_retries,
          SUM(CASE WHEN retry_count > 0 THEN 1 ELSE 0 END) as jobs_retried
        FROM jobs
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      `;

      const result = await db.query(query);
      return {
        total: parseInt(result.rows[0].total, 10),
        avgRetries: parseFloat(result.rows[0].avg_retries || 0).toFixed(2),
        maxRetries: parseInt(result.rows[0].max_retries || 0, 10),
        jobsRetried: parseInt(result.rows[0].jobs_retried || 0, 10),
      };
    } catch (error) {
      logger.error('Error getting retry stats', { error });
      throw error;
    }
  }

  /**
   * Get jobs by error type
   */
  static async getErrorStats(limit = 10) {
    try {
      const db = require('../config/database');

      const query = `
        SELECT 
          SUBSTRING(error_message, 1, 100) as error,
          COUNT(*) as count,
          AVG(retry_count) as avg_retries
        FROM jobs
        WHERE status = $1
        AND created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY SUBSTRING(error_message, 1, 100)
        ORDER BY count DESC
        LIMIT $2
      `;

      const result = await db.query(query, [JOB_STATUS.FAILED, limit]);
      return result.rows.map((row) => ({
        error: row.error,
        count: parseInt(row.count, 10),
        avgRetries: parseFloat(row.avg_retries || 0).toFixed(2),
      }));
    } catch (error) {
      logger.error('Error getting error stats', { error });
      throw error;
    }
  }

  /**
   * Retry all failed jobs that are eligible
   */
  static async retryFailedJobs() {
    try {
      const db = require('../config/database');

      const query = `
        UPDATE jobs
        SET status = $1,
            retry_count = 0,
            next_retry_at = NOW(),
            updated_at = NOW()
        WHERE status = $2
        AND retry_count < max_retries
        AND next_retry_at <= NOW()
        RETURNING id
      `;

      const result = await db.query(query, [JOB_STATUS.PENDING, JOB_STATUS.FAILED]);
      logger.info('Failed jobs retried', { count: result.rowCount });
      return result.rowCount;
    } catch (error) {
      logger.error('Error retrying failed jobs', { error });
      throw error;
    }
  }

  /**
   * Mark unrecoverable jobs as permanently failed
   */
  static async markPermanentlyFailed(jobId, reason) {
    try {
      await Job.updateStatus(jobId, JOB_STATUS.FAILED, {
        errorMessage: `Permanently failed: ${reason}`,
        completedAt: new Date(),
      });

      logger.warn('Job marked as permanently failed', { jobId, reason });
      await this.sendAlert(jobId, new Error(reason));
    } catch (error) {
      logger.error('Error marking job as permanently failed', { error, jobId });
    }
  }

  /**
   * Get health status of job system
   */
  static async getHealthStatus() {
    try {
      const db = require('../config/database');

      const statsQuery = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = $1 THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = $2 THEN 1 ELSE 0 END) as processing,
          SUM(CASE WHEN status = $3 THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = $4 THEN 1 ELSE 0 END) as failed
        FROM jobs
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      `;

      const result = await db.query(statsQuery, [
        JOB_STATUS.PENDING,
        JOB_STATUS.PROCESSING,
        JOB_STATUS.COMPLETED,
        JOB_STATUS.FAILED,
      ]);

      const stats = result.rows[0];
      const total = parseInt(stats.total, 10);
      const pending = parseInt(stats.pending || 0, 10);
      const processing = parseInt(stats.processing || 0, 10);
      const completed = parseInt(stats.completed || 0, 10);
      const failed = parseInt(stats.failed || 0, 10);

      const failureRate = total > 0 ? ((failed / total) * 100).toFixed(2) : 0;
      const avgDuration = 0; // TODO: Calculate from database

      const health = {
        status: failureRate < 5 ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        stats: {
          total,
          pending,
          processing,
          completed,
          failed,
        },
        metrics: {
          failureRate: parseFloat(failureRate),
          completionRate: total > 0 ? ((completed / total) * 100).toFixed(2) : 0,
          avgDuration: avgDuration,
        },
      };

      return health;
    } catch (error) {
      logger.error('Error getting health status', { error });
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Clean up old failed jobs
   */
  static async cleanupOldJobs(daysOld = 30) {
    try {
      const cleaned = await Job.cleanup(daysOld);
      logger.info('Old jobs cleaned up', { count: cleaned, daysOld });
      return cleaned;
    } catch (error) {
      logger.error('Error cleaning up old jobs', { error });
      throw error;
    }
  }
}

module.exports = ErrorRecovery;
