/**
 * JobQueueService
 * Manages SQS job queue for async processing
 */
const AWS = require('aws-sdk');
const logger = require('../utils/logger');

class JobQueueService {
  constructor() {
    this.sqs = new AWS.SQS({
      region: process.env.AWS_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });

    this.queueUrl = process.env.SQS_QUEUE_URL;
    this.dlqUrl = process.env.SQS_DLQ_URL;
  }

  /**
   * Enqueue a new job
   * @param {object} jobData - Job data {type, episodeId, fileId, metadata}
   * @returns {Promise<object>} Job with ID and status
   */
  async enqueueJob(jobData) {
    try {
      const jobId = require('uuid').v4();
      const timestamp = new Date().toISOString();

      const message = {
        jobId,
        ...jobData,
        createdAt: timestamp,
        status: 'pending',
        retries: 0,
      };

      const result = await this.sqs
        .sendMessage({
          QueueUrl: this.queueUrl,
          MessageBody: JSON.stringify(message),
          MessageAttributes: {
            jobId: { StringValue: jobId, DataType: 'String' },
            jobType: { StringValue: jobData.type, DataType: 'String' },
          },
          DelaySeconds: 0,
        })
        .promise();

      logger.info('Job enqueued', {
        jobId,
        type: jobData.type,
        messageId: result.MessageId,
      });

      return {
        jobId,
        messageId: result.MessageId,
        status: 'pending',
        createdAt: timestamp,
      };
    } catch (error) {
      logger.error('Failed to enqueue job', { error: error.message });
      throw error;
    }
  }

  /**
   * Process messages from queue
   * @param {function} handler - Handler function for each message
   * @param {number} maxConcurrency - Max concurrent messages (default 5)
   * @returns {Promise<void>}
   */
  async processQueue(handler, maxConcurrency = 5) {
    const activeMessages = new Map();

    const processMessages = async () => {
      try {
        const result = await this.sqs
          .receiveMessage({
            QueueUrl: this.queueUrl,
            MaxNumberOfMessages: Math.min(maxConcurrency, 10),
            WaitTimeSeconds: 20,
            VisibilityTimeout: parseInt(process.env.SQS_VISIBILITY_TIMEOUT || '300'),
            MessageAttributeNames: ['All'],
          })
          .promise();

        if (!result.Messages || result.Messages.length === 0) {
          return;
        }

        for (const message of result.Messages) {
          if (activeMessages.size >= maxConcurrency) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          activeMessages.set(message.ReceiptHandle, true);

          handler(message)
            .then(() => {
              activeMessages.delete(message.ReceiptHandle);
            })
            .catch((error) => {
              logger.error('Error processing message', {
                receiptHandle: message.ReceiptHandle,
                error: error.message,
              });
              activeMessages.delete(message.ReceiptHandle);
            });
        }
      } catch (error) {
        logger.error('Failed to receive messages from queue', { error: error.message });
      }
    };

    const intervalId = setInterval(processMessages, 1000);
    await processMessages(); // Initial run

    return () => clearInterval(intervalId);
  }

  /**
   * Acknowledge message (delete from queue)
   * @param {string} receiptHandle - Message receipt handle
   * @returns {Promise<void>}
   */
  async acknowledgeMessage(receiptHandle) {
    try {
      await this.sqs
        .deleteMessage({
          QueueUrl: this.queueUrl,
          ReceiptHandle: receiptHandle,
        })
        .promise();

      logger.debug('Message acknowledged and deleted');
    } catch (error) {
      logger.error('Failed to acknowledge message', { error: error.message });
      throw error;
    }
  }

  /**
   * Send job to DLQ (dead letter queue)
   * @param {object} message - Message to send to DLQ
   * @param {string} reason - Reason for DLQ
   * @returns {Promise<void>}
   */
  async sendToDLQ(message, reason) {
    try {
      await this.sqs
        .sendMessage({
          QueueUrl: this.dlqUrl,
          MessageBody: JSON.stringify({
            ...message,
            dlqReason: reason,
            dlqTimestamp: new Date().toISOString(),
          }),
        })
        .promise();

      logger.warn('Message sent to DLQ', { jobId: message.jobId, reason });
    } catch (error) {
      logger.error('Failed to send message to DLQ', { error: error.message });
      throw error;
    }
  }

  /**
   * Get queue attributes
   * @returns {Promise<object>} Queue attributes
   */
  async getQueueAttributes() {
    try {
      const result = await this.sqs
        .getQueueAttributes({
          QueueUrl: this.queueUrl,
          AttributeNames: ['All'],
        })
        .promise();

      return {
        approximateNumberOfMessages: parseInt(result.Attributes.ApproximateNumberOfMessages),
        approximateNumberOfMessagesNotVisible: parseInt(
          result.Attributes.ApproximateNumberOfMessagesNotVisible
        ),
        approximateNumberOfMessagesDelayed: parseInt(
          result.Attributes.ApproximateNumberOfMessagesDelayed
        ),
        visibilityTimeout: parseInt(result.Attributes.VisibilityTimeout),
        messageRetentionPeriod: parseInt(result.Attributes.MessageRetentionPeriod),
      };
    } catch (error) {
      logger.error('Failed to get queue attributes', { error: error.message });
      throw error;
    }
  }

  /**
   * Purge queue (delete all messages) - USE WITH CAUTION
   * @returns {Promise<void>}
   */
  async purgeQueue() {
    try {
      await this.sqs.purgeQueue({ QueueUrl: this.queueUrl }).promise();
      logger.warn('Queue purged - all messages deleted');
    } catch (error) {
      logger.error('Failed to purge queue', { error: error.message });
      throw error;
    }
  }
}

module.exports = new JobQueueService();
