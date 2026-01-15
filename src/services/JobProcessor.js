/**
 * Job Processor - Worker for processing SQS messages
 * Polls queue, executes handlers, manages retries and errors
 */

const logger = require('../utils/logger');
const QueueService = require('./QueueService');
const { Job, JOB_STATUS } = require('../models/job');
const ErrorRecovery = require('./ErrorRecovery');

// Phase 3A Services
const ActivityService = require('./ActivityService');
const SocketService = require('./SocketService');

class JobProcessor {
  static handlers = new Map();
  static isRunning = false;
  static pollInterval = parseInt(process.env.JOB_PROCESSOR_INTERVAL || '5000', 10);
  static maxConcurrent = parseInt(process.env.MAX_CONCURRENT_JOBS || '5', 10);
  static activeJobs = 0;

  /**
   * Register a handler for a job type
   */
  static registerHandler(jobType, handler) {
    if (typeof handler !== 'function') {
      throw new Error(`Handler must be a function, got ${typeof handler}`);
    }
    this.handlers.set(jobType, handler);
    logger.info('Job handler registered', { jobType });
  }

  /**
   * Start the job processor
   */
  static async start() {
    if (this.isRunning) {
      logger.warn('Job processor already running');
      return;
    }

    this.isRunning = true;
    logger.info('Job processor starting', { pollInterval: this.pollInterval });

    // Phase 3A Integration: Broadcast job processor started event
    SocketService.broadcastMessage({
      event: 'job_processor_started',
      data: {
        timestamp: new Date(),
        pollInterval: this.pollInterval,
        maxConcurrent: this.maxConcurrent,
      },
    }).catch((err) => logger.warn('Failed to broadcast job processor started', { err }));

    this.poll();
  }

  /**
   * Stop the job processor
   */
  static async stop() {
    this.isRunning = false;
    logger.info('Job processor stopping');
    
    // Wait for active jobs to complete
    let waitTime = 0;
    while (this.activeJobs > 0 && waitTime < 30000) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      waitTime += 1000;
    }

    if (this.activeJobs > 0) {
      logger.warn('Stopping processor with active jobs', { activeJobs: this.activeJobs });
    }
  }

  /**
   * Poll queue for messages
   */
  static async poll() {
    if (!this.isRunning) return;

    try {
      const messages = await QueueService.receiveMessages(this.maxConcurrent);

      if (messages.length === 0) {
        logger.debug('No messages in queue');
        setTimeout(() => this.poll(), this.pollInterval);
        return;
      }

      logger.info('Processing messages from queue', { count: messages.length });

      // Process messages concurrently up to maxConcurrent
      const promises = messages.map(message => this.handleMessage(message));
      await Promise.all(promises);

      // Continue polling
      setTimeout(() => this.poll(), this.pollInterval);
    } catch (error) {
      logger.error('Error in poll loop', { error });
      setTimeout(() => this.poll(), this.pollInterval);
    }
  }

  /**
   * Handle a single message from queue
   */
  static async handleMessage(message) {
    const receiptHandle = message.ReceiptHandle;
    let jobId = null;

    try {
      this.activeJobs++;

      // Parse message body
      const body = JSON.parse(message.Body);
      jobId = body.jobId;
      const jobType = body.jobType;

      logger.info('Processing message', { jobId, jobType });

      // Fetch full job data
      const job = await Job.getById(jobId);
      if (!job) {
        logger.error('Job not found', { jobId });
        await QueueService.deleteMessage(receiptHandle);
        return;
      }

      // Check if handler is registered
      const handler = this.handlers.get(jobType);
      if (!handler) {
        logger.warn('No handler registered for job type', { jobType });
        // Send to DLQ for manual review
        await ErrorRecovery.moveToDLQ(jobId, `No handler for job type: ${jobType}`);
        await QueueService.deleteMessage(receiptHandle);
        return;
      }

      // Execute job
      await this.processJob(job, handler, receiptHandle);
    } catch (error) {
      logger.error('Error handling message', { error, jobId });
      
      if (jobId) {
        await this.handleJobError(jobId, error, receiptHandle);
      } else {
        // If we can't parse job ID, delete message to prevent infinite loop
        await QueueService.deleteMessage(receiptHandle);
      }
    } finally {
      this.activeJobs--;
    }
  }

  /**
   * Process a single job
   */
  static async processJob(job, handler, receiptHandle) {
    const { id: jobId, jobType, payload, userId } = job;

    try {
      logger.info('Executing job handler', { jobId, jobType });

      // Set timeout for handler execution
      const timeoutMs = 900000; // 15 minutes
      const handlerPromise = handler(jobId, payload, userId);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Job handler timeout')), timeoutMs)
      );

      const results = await Promise.race([handlerPromise, timeoutPromise]);

      // Mark job as completed
      await this.handleJobSuccess(jobId, results, receiptHandle);
    } catch (error) {
      await this.handleJobError(jobId, error, receiptHandle);
    }
  }

  /**
   * Handle successful job completion
   */
  static async handleJobSuccess(jobId, results, receiptHandle) {
    try {
      await Job.updateStatus(jobId, JOB_STATUS.COMPLETED, {
        results: results,
        completedAt: new Date()
      });

      await QueueService.deleteMessage(receiptHandle);
      logger.info('Job completed successfully', { jobId });

      // Phase 3A Integration: Activity Logging (non-blocking)
      ActivityService.logActivity({
        userId: null, // Job processor is system-driven
        action: 'COMPLETE',
        resourceType: 'job',
        resourceId: jobId,
        metadata: {
          status: JOB_STATUS.COMPLETED,
          results: results,
        },
      }).catch((err) => logger.warn('Activity logging error', { err, jobId }));

      // Phase 3A Integration: Broadcast WebSocket Event (non-blocking)
      SocketService.broadcastMessage({
        event: 'job_completed',
        data: {
          jobId,
          results,
          timestamp: new Date(),
        },
      }).catch((err) => logger.warn('WebSocket broadcast error', { err, jobId }));
    } catch (error) {
      logger.error('Error handling job success', { error, jobId });
      throw error;
    }
  }

  /**
   * Handle job error with retry logic
   */
  static async handleJobError(jobId, error, receiptHandle) {
    try {
      const job = await Job.getById(jobId);
      if (!job) return;

      logger.error('Job failed', { jobId, error: error.message, retryCount: job.retryCount });

      // Check if we can retry
      if (job.retryCount < job.maxRetries) {
        // Schedule retry
        const baseDelay = parseInt(process.env.INITIAL_RETRY_DELAY || '5000', 10);
        const delay = ErrorRecovery.exponentialBackoff(job.retryCount, baseDelay);

        await Job.retry(jobId, delay);
        logger.info('Job retry scheduled', { jobId, delay });

        // Phase 3A Integration: Activity Logging (non-blocking)
        ActivityService.logActivity({
          userId: null,
          action: 'RETRY',
          resourceType: 'job',
          resourceId: jobId,
          metadata: {
            retryCount: job.retryCount,
            delay,
            error: error.message,
          },
        }).catch((err) => logger.warn('Activity logging error', { err, jobId }));

        // Phase 3A Integration: Broadcast WebSocket Event (non-blocking)
        SocketService.broadcastMessage({
          event: 'job_retry',
          data: {
            jobId,
            retryCount: job.retryCount,
            delay,
            error: error.message,
            timestamp: new Date(),
          },
        }).catch((err) => logger.warn('WebSocket broadcast error', { err, jobId }));

        // Release message back to queue for retry
        await QueueService.extendVisibility(receiptHandle, 0);
      } else {
        // Max retries exceeded, move to DLQ
        await Job.updateStatus(jobId, JOB_STATUS.FAILED, {
          errorMessage: error.message,
          completedAt: new Date()
        });

        await ErrorRecovery.moveToDLQ(jobId, `Max retries exceeded: ${error.message}`);
        logger.error('Job moved to DLQ', { jobId });

        // Phase 3A Integration: Activity Logging (non-blocking)
        ActivityService.logActivity({
          userId: null,
          action: 'FAILED',
          resourceType: 'job',
          resourceId: jobId,
          metadata: {
            status: JOB_STATUS.FAILED,
            error: error.message,
            retriesFailed: job.retryCount,
          },
        }).catch((err) => logger.warn('Activity logging error', { err, jobId }));

        // Phase 3A Integration: Broadcast WebSocket Event (non-blocking)
        SocketService.broadcastMessage({
          event: 'job_failed',
          data: {
            jobId,
            error: error.message,
            retriesExhausted: true,
            timestamp: new Date(),
          },
        }).catch((err) => logger.warn('WebSocket broadcast error', { err, jobId }));

        // Delete message from queue
        await QueueService.deleteMessage(receiptHandle);

        // Send alert
        await ErrorRecovery.sendAlert(jobId, error);
      }
    } catch (dlqError) {
      logger.error('Error handling job error', { error: dlqError, jobId });
      // As a last resort, delete message to prevent infinite loop
      try {
        await QueueService.deleteMessage(receiptHandle);
      } catch (deleteError) {
        logger.error('Error deleting message', { error: deleteError });
      }
    }
  }

  /**
   * Get processor statistics
   */
  static getStats() {
    return {
      isRunning: this.isRunning,
      activeJobs: this.activeJobs,
      maxConcurrent: this.maxConcurrent,
      pollInterval: this.pollInterval,
      handlersRegistered: this.handlers.size,
      handlers: Array.from(this.handlers.keys())
    };
  }
}

module.exports = JobProcessor;
