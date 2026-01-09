/**
 * Queue Service - AWS SQS integration
 * Handles message sending, receiving, and DLQ management
 */

const AWS = require('aws-sdk');
const logger = require('../utils/logger');
const { Job, JOB_STATUS } = require('../models/job');

const sqs = new AWS.SQS({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.SQS_ENDPOINT_URL || undefined
});

class QueueService {
  static queueUrl = process.env.SQS_QUEUE_URL || 'http://localhost:4566/000000000000/episode-jobs-queue';
  static dlqUrl = process.env.SQS_DLQ_URL || 'http://localhost:4566/000000000000/episode-jobs-dlq';
  static visibilityTimeout = 300;
  static maxRetries = 3;

  /**
   * Send job to SQS queue
   */
  static async sendJob(jobId) {
    try {
      const job = await Job.getById(jobId);
      if (!job) throw new Error(`Job not found: ${jobId}`);

      const messageBody = {
        jobId: job.id,
        userId: job.userId,
        jobType: job.jobType,
        payload: job.payload,
        timestamp: new Date().toISOString()
      };

      const params = {
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(messageBody),
        MessageAttributes: {
          jobType: {
            StringValue: job.jobType,
            DataType: 'String'
          },
          jobId: {
            StringValue: job.id,
            DataType: 'String'
          }
        }
      };

      const result = await sqs.sendMessage(params).promise();
      logger.info('Job sent to queue', { jobId, messageId: result.MessageId });
      return result;
    } catch (error) {
      logger.error('Error sending job to queue', { error, jobId });
      throw error;
    }
  }

  /**
   * Receive messages from queue
   */
  static async receiveMessages(maxMessages = 10) {
    try {
      const params = {
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: maxMessages,
        VisibilityTimeout: this.visibilityTimeout,
        MessageAttributeNames: ['All'],
        WaitTimeSeconds: 20
      };

      const result = await sqs.receiveMessage(params).promise();
      if (!result.Messages) return [];

      logger.info('Messages received from queue', { count: result.Messages.length });
      return result.Messages;
    } catch (error) {
      logger.error('Error receiving messages from queue', { error });
      return [];
    }
  }

  /**
   * Delete message from queue
   */
  static async deleteMessage(receiptHandle) {
    try {
      const params = {
        QueueUrl: this.queueUrl,
        ReceiptHandle: receiptHandle
      };

      await sqs.deleteMessage(params).promise();
      logger.debug('Message deleted from queue');
      return true;
    } catch (error) {
      logger.error('Error deleting message', { error });
      throw error;
    }
  }

  /**
   * Change message visibility timeout
   */
  static async extendVisibility(receiptHandle, visibilityTimeout = 300) {
    try {
      const params = {
        QueueUrl: this.queueUrl,
        ReceiptHandle: receiptHandle,
        VisibilityTimeout: visibilityTimeout
      };

      await sqs.changeMessageVisibility(params).promise();
      logger.debug('Message visibility extended', { visibilityTimeout });
      return true;
    } catch (error) {
      logger.error('Error extending visibility', { error });
      throw error;
    }
  }

  /**
   * Move message to DLQ
   */
  static async sendToDLQ(jobId, reason) {
    try {
      const job = await Job.getById(jobId);
      if (!job) throw new Error(`Job not found: ${jobId}`);

      const messageBody = {
        jobId: job.id,
        originalJobType: job.jobType,
        reason: reason,
        timestamp: new Date().toISOString(),
        job: job
      };

      const params = {
        QueueUrl: this.dlqUrl,
        MessageBody: JSON.stringify(messageBody)
      };

      const result = await sqs.sendMessage(params).promise();
      logger.info('Job sent to DLQ', { jobId, reason, messageId: result.MessageId });
      return result;
    } catch (error) {
      logger.error('Error sending to DLQ', { error, jobId });
      throw error;
    }
  }

  /**
   * Get queue attributes and stats
   */
  static async getQueueStats() {
    try {
      const params = {
        QueueUrl: this.queueUrl,
        AttributeNames: [
          'ApproximateNumberOfMessages',
          'ApproximateNumberOfMessagesNotVisible',
          'ApproximateNumberOfMessagesDelayed',
          'CreatedTimestamp',
          'LastModifiedTimestamp'
        ]
      };

      const result = await sqs.getQueueAttributes(params).promise();
      const attrs = result.Attributes;

      return {
        queueUrl: this.queueUrl,
        visibleMessages: parseInt(attrs.ApproximateNumberOfMessages, 10),
        processingMessages: parseInt(attrs.ApproximateNumberOfMessagesNotVisible, 10),
        delayedMessages: parseInt(attrs.ApproximateNumberOfMessagesDelayed, 10),
        createdAt: new Date(parseInt(attrs.CreatedTimestamp, 10) * 1000),
        lastModified: new Date(parseInt(attrs.LastModifiedTimestamp, 10) * 1000)
      };
    } catch (error) {
      logger.error('Error getting queue stats', { error });
      throw error;
    }
  }

  /**
   * Purge queue (delete all messages) - use with caution
   */
  static async purgeQueue() {
    try {
      const params = {
        QueueUrl: this.queueUrl
      };

      await sqs.purgeQueue(params).promise();
      logger.warn('Queue purged');
      return true;
    } catch (error) {
      logger.error('Error purging queue', { error });
      throw error;
    }
  }

  /**
   * Process job (execute handler based on job type)
   */
  static async processJob(jobData) {
    const { jobId, jobType, payload, userId } = jobData;

    try {
      // Update job status to processing
      await Job.updateStatus(jobId, JOB_STATUS.PROCESSING, {
        startedAt: new Date()
      });

      logger.info('Processing job', { jobId, jobType });

      // Dispatch to appropriate handler based on job type
      let results = null;
      switch (jobType) {
        case 'thumbnail-generation':
          results = await this.handleThumbnailGeneration(jobId, payload, userId);
          break;
        case 'video-processing':
          results = await this.handleVideoProcessing(jobId, payload, userId);
          break;
        case 'bulk-upload':
          results = await this.handleBulkUpload(jobId, payload, userId);
          break;
        case 'bulk-export':
          results = await this.handleBulkExport(jobId, payload, userId);
          break;
        case 'data-import':
          results = await this.handleDataImport(jobId, payload, userId);
          break;
        default:
          throw new Error(`Unknown job type: ${jobType}`);
      }

      // Update job status to completed
      await Job.updateStatus(jobId, JOB_STATUS.COMPLETED, {
        results: results,
        completedAt: new Date()
      });

      logger.info('Job completed successfully', { jobId });
      return results;
    } catch (error) {
      logger.error('Error processing job', { error, jobId, jobType });
      throw error;
    }
  }

  /**
   * Handle thumbnail generation job
   */
  static async handleThumbnailGeneration(jobId, payload, userId) {
    const { episodeId, videoUrl, frameTimestamps } = payload;
    logger.info('Handling thumbnail generation', { jobId, episodeId });
    
    // This would integrate with ThumbnailGeneratorService or Lambda
    return {
      jobId,
      status: 'completed',
      thumbnailsGenerated: frameTimestamps ? frameTimestamps.length : 1,
      s3Urls: []
    };
  }

  /**
   * Handle video processing job
   */
  static async handleVideoProcessing(jobId, payload, userId) {
    const { episodeId, videoUrl, format } = payload;
    logger.info('Handling video processing', { jobId, episodeId, format });
    
    // This would integrate with video processing service
    return {
      jobId,
      status: 'completed',
      format: format,
      outputUrl: null
    };
  }

  /**
   * Handle bulk upload job
   */
  static async handleBulkUpload(jobId, payload, userId) {
    const { files, episodeId } = payload;
    logger.info('Handling bulk upload', { jobId, fileCount: files.length });
    
    return {
      jobId,
      status: 'completed',
      uploaded: files.length,
      failed: 0
    };
  }

  /**
   * Handle bulk export job
   */
  static async handleBulkExport(jobId, payload, userId) {
    const { episodeIds, format } = payload;
    logger.info('Handling bulk export', { jobId, episodeCount: episodeIds.length, format });
    
    return {
      jobId,
      status: 'completed',
      exportUrl: null,
      format: format
    };
  }

  /**
   * Handle data import job
   */
  static async handleDataImport(jobId, payload, userId) {
    const { fileUrl, dataType } = payload;
    logger.info('Handling data import', { jobId, dataType });
    
    return {
      jobId,
      status: 'completed',
      dataType: dataType,
      recordsImported: 0
    };
  }
}

module.exports = QueueService;
