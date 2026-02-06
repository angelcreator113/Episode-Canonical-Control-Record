'use strict';

const { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand, GetQueueAttributesCommand } = require('@aws-sdk/client-sqs');

/**
 * SQS Service
 * Handles video processing job queue operations
 */
class SQSService {
  constructor() {
    this.sqsClient = new SQSClient({ 
      region: process.env.AWS_REGION || 'us-east-1' 
    });
    
    this.queueUrl = process.env.SQS_VIDEO_PROCESSING_QUEUE_URL;
    this.dlqUrl = process.env.SQS_VIDEO_PROCESSING_DLQ_URL;
  }

  /**
   * Send video processing job to queue
   * @param {Object} jobData - Job details
   * @param {string} jobData.jobId - VideoProcessingJob UUID
   * @param {string} jobData.episodeId - Episode UUID
   * @param {string} jobData.editPlanId - AIEditPlan UUID
   * @param {string} jobData.processingMethod - 'lambda' or 'ec2'
   * @param {Object} jobData.editStructure - Complete edit plan
   * @returns {Promise<{messageId: string}>}
   */
  async sendProcessingJob(jobData) {
    const messageBody = JSON.stringify({
      jobId: jobData.jobId,
      episodeId: jobData.episodeId,
      editPlanId: jobData.editPlanId,
      processingMethod: jobData.processingMethod,
      editStructure: jobData.editStructure,
      timestamp: new Date().toISOString(),
    });

    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: messageBody,
      MessageGroupId: jobData.episodeId, // Groups messages by episode
      MessageDeduplicationId: jobData.jobId, // Prevents duplicate jobs
    });

    const response = await this.sqsClient.send(command);
    
    return {
      messageId: response.MessageId,
      sequenceNumber: response.SequenceNumber,
    };
  }

  /**
   * Receive messages from queue (for Lambda/worker consumption)
   * @param {number} maxMessages - Max messages to receive (1-10)
   * @param {number} waitTimeSeconds - Long polling time
   * @returns {Promise<Array>}
   */
  async receiveMessages(maxMessages = 1, waitTimeSeconds = 20) {
    const command = new ReceiveMessageCommand({
      QueueUrl: this.queueUrl,
      MaxNumberOfMessages: maxMessages,
      WaitTimeSeconds: waitTimeSeconds,
      AttributeNames: ['All'],
      MessageAttributeNames: ['All'],
    });

    const response = await this.sqsClient.send(command);
    return response.Messages || [];
  }

  /**
   * Delete message after successful processing
   * @param {string} receiptHandle - Message receipt handle
   */
  async deleteMessage(receiptHandle) {
    const command = new DeleteMessageCommand({
      QueueUrl: this.queueUrl,
      ReceiptHandle: receiptHandle,
    });

    await this.sqsClient.send(command);
  }

  /**
   * Get queue statistics
   * @returns {Promise<Object>}
   */
  async getQueueStats() {
    const command = new GetQueueAttributesCommand({
      QueueUrl: this.queueUrl,
      AttributeNames: [
        'ApproximateNumberOfMessages',
        'ApproximateNumberOfMessagesNotVisible',
        'ApproximateNumberOfMessagesDelayed',
      ],
    });

    const response = await this.sqsClient.send(command);
    
    return {
      available: parseInt(response.Attributes.ApproximateNumberOfMessages || '0'),
      inFlight: parseInt(response.Attributes.ApproximateNumberOfMessagesNotVisible || '0'),
      delayed: parseInt(response.Attributes.ApproximateNumberOfMessagesDelayed || '0'),
    };
  }

  /**
   * Get dead letter queue statistics
   * @returns {Promise<Object>}
   */
  async getDLQStats() {
    const command = new GetQueueAttributesCommand({
      QueueUrl: this.dlqUrl,
      AttributeNames: ['ApproximateNumberOfMessages'],
    });

    const response = await this.sqsClient.send(command);
    
    return {
      failed: parseInt(response.Attributes.ApproximateNumberOfMessages || '0'),
    };
  }
}

module.exports = new SQSService();
