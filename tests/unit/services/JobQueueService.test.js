/**
 * JobQueueService Unit Tests
 * Tests SQS job queue operations including enqueue, process, acknowledge, and DLQ handling
 */

// Set environment variables BEFORE mocking
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_ACCESS_KEY_ID = 'test-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
process.env.SQS_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
process.env.SQS_DLQ_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-dlq';
process.env.SQS_VISIBILITY_TIMEOUT = '300';
process.env.NODE_ENV = 'test';

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'job-uuid-123'),
}));

// Define mock SQS client
const mockSQS = {
  sendMessage: jest.fn(() => ({
    promise: jest.fn(),
  })),
  receiveMessage: jest.fn(() => ({
    promise: jest.fn(),
  })),
  deleteMessage: jest.fn(() => ({
    promise: jest.fn(),
  })),
  getQueueAttributes: jest.fn(() => ({
    promise: jest.fn(),
  })),
  purgeQueue: jest.fn(() => ({
    promise: jest.fn(),
  })),
};

// Mock AWS SDK
jest.mock('aws-sdk', () => ({
  SQS: jest.fn(() => mockSQS),
}));

// NOW require the service after all mocks are set up
const jobQueueInstance = require('../../../src/services/JobQueueService');

describe('JobQueueService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset SQS mock implementations
    mockSQS.sendMessage.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        MessageId: 'msg-123',
        MD5OfMessageBody: 'hash123',
      }),
    });

    mockSQS.receiveMessage.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Messages: [],
      }),
    });

    mockSQS.deleteMessage.mockReturnValue({
      promise: jest.fn().mockResolvedValue({}),
    });

    mockSQS.getQueueAttributes.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Attributes: {
          ApproximateNumberOfMessages: '10',
          ApproximateNumberOfMessagesNotVisible: '5',
          ApproximateNumberOfMessagesDelayed: '2',
          VisibilityTimeout: '300',
          MessageRetentionPeriod: '345600',
        },
      }),
    });

    mockSQS.purgeQueue.mockReturnValue({
      promise: jest.fn().mockResolvedValue({}),
    });
  });

  describe('enqueueJob', () => {
    it('should enqueue a new job with all required fields', async () => {
      const jobData = {
        type: 'thumbnail',
        episodeId: 'ep-123',
        fileId: 'file-456',
        metadata: { quality: 'hd' },
      };

      const result = await jobQueueInstance.enqueueJob(jobData);

      expect(result.jobId).toBe('job-uuid-123');
      expect(result.messageId).toBe('msg-123');
      expect(result.status).toBe('pending');
      expect(result.createdAt).toBeDefined();
      expect(mockSQS.sendMessage).toHaveBeenCalled();
    });

    it('should include job metadata in SQS message', async () => {
      const jobData = {
        type: 'thumbnail',
        episodeId: 'ep-123',
        fileId: 'file-456',
      };

      await jobQueueInstance.enqueueJob(jobData);

      const callArgs = mockSQS.sendMessage.mock.calls[0][0];
      const messageBody = JSON.parse(callArgs.MessageBody);

      expect(messageBody.jobId).toBe('job-uuid-123');
      expect(messageBody.type).toBe('thumbnail');
      expect(messageBody.episodeId).toBe('ep-123');
      expect(messageBody.fileId).toBe('file-456');
      expect(messageBody.status).toBe('pending');
      expect(messageBody.retries).toBe(0);
      expect(messageBody.createdAt).toBeDefined();
    });

    it('should set message attributes for routing', async () => {
      const jobData = {
        type: 'extract-metadata',
        episodeId: 'ep-789',
      };

      await jobQueueInstance.enqueueJob(jobData);

      const callArgs = mockSQS.sendMessage.mock.calls[0][0];

      expect(callArgs.MessageAttributes.jobId.StringValue).toBe('job-uuid-123');
      expect(callArgs.MessageAttributes.jobType.StringValue).toBe('extract-metadata');
    });

    it('should use correct queue URL', async () => {
      const jobData = { type: 'process', episodeId: 'ep-000' };

      await jobQueueInstance.enqueueJob(jobData);

      const callArgs = mockSQS.sendMessage.mock.calls[0][0];

      expect(callArgs.QueueUrl).toBe(process.env.SQS_QUEUE_URL);
    });

    it('should handle enqueue errors', async () => {
      mockSQS.sendMessage.mockReturnValue({
        promise: jest.fn().mockRejectedValue(new Error('SQS error')),
      });

      const jobData = { type: 'process', episodeId: 'ep-001' };

      await expect(jobQueueInstance.enqueueJob(jobData)).rejects.toThrow('SQS error');
    });

    it('should set zero delay by default', async () => {
      const jobData = { type: 'thumbnail', episodeId: 'ep-123' };

      await jobQueueInstance.enqueueJob(jobData);

      const callArgs = mockSQS.sendMessage.mock.calls[0][0];

      expect(callArgs.DelaySeconds).toBe(0);
    });

    it('should handle different job types', async () => {
      const jobTypes = ['thumbnail', 'extract-metadata', 'transcode', 'process-audio'];

      for (const jobType of jobTypes) {
        mockSQS.sendMessage.mockReturnValue({
          promise: jest.fn().mockResolvedValue({ MessageId: 'msg-xyz' }),
        });

        const result = await jobQueueInstance.enqueueJob({
          type: jobType,
          episodeId: 'ep-test',
        });

        const callArgs =
          mockSQS.sendMessage.mock.calls[mockSQS.sendMessage.mock.calls.length - 1][0];
        const messageBody = JSON.parse(callArgs.MessageBody);

        expect(messageBody.type).toBe(jobType);
        expect(result.jobId).toBeDefined();
      }
    });

    it('should preserve custom metadata fields', async () => {
      const jobData = {
        type: 'thumbnail',
        episodeId: 'ep-123',
        fileId: 'file-456',
        metadata: {
          quality: 'hd',
          format: 'mp4',
          duration: 3600,
          customField: 'customValue',
        },
      };

      await jobQueueInstance.enqueueJob(jobData);

      const callArgs = mockSQS.sendMessage.mock.calls[0][0];
      const messageBody = JSON.parse(callArgs.MessageBody);

      expect(messageBody.metadata.quality).toBe('hd');
      expect(messageBody.metadata.customField).toBe('customValue');
    });
  });

  describe('processQueue', () => {
    it('should receive messages from queue', async () => {
      const mockHandler = jest.fn().mockResolvedValue(undefined);

      mockSQS.receiveMessage.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Messages: [
            {
              MessageId: 'msg-1',
              ReceiptHandle: 'receipt-1',
              Body: JSON.stringify({ jobId: 'job-1', type: 'thumbnail' }),
            },
          ],
        }),
      });

      const stopFn = await jobQueueInstance.processQueue(mockHandler, 5);

      expect(mockSQS.receiveMessage).toHaveBeenCalled();
      expect(mockHandler).toHaveBeenCalled();
      stopFn();
    });

    it('should respect max concurrency setting', async () => {
      const mockHandler = jest.fn().mockResolvedValue(undefined);

      await jobQueueInstance.processQueue(mockHandler, 3);

      const callArgs = mockSQS.receiveMessage.mock.calls[0][0];

      expect(callArgs.MaxNumberOfMessages).toBeLessThanOrEqual(3);
    });

    it('should use visibility timeout from environment', async () => {
      const mockHandler = jest.fn().mockResolvedValue(undefined);

      await jobQueueInstance.processQueue(mockHandler, 5);

      const callArgs = mockSQS.receiveMessage.mock.calls[0][0];

      expect(callArgs.VisibilityTimeout).toBe(300);
    });

    it('should handle multiple messages', async () => {
      const mockHandler = jest.fn().mockResolvedValue(undefined);

      mockSQS.receiveMessage.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Messages: [
            {
              MessageId: 'msg-1',
              ReceiptHandle: 'receipt-1',
              Body: JSON.stringify({ jobId: 'job-1' }),
            },
            {
              MessageId: 'msg-2',
              ReceiptHandle: 'receipt-2',
              Body: JSON.stringify({ jobId: 'job-2' }),
            },
            {
              MessageId: 'msg-3',
              ReceiptHandle: 'receipt-3',
              Body: JSON.stringify({ jobId: 'job-3' }),
            },
          ],
        }),
      });

      const stopFn = await jobQueueInstance.processQueue(mockHandler, 5);

      expect(mockHandler).toHaveBeenCalledTimes(3);
      stopFn();
    });

    it('should handle empty queue gracefully', async () => {
      const mockHandler = jest.fn().mockResolvedValue(undefined);

      mockSQS.receiveMessage.mockReturnValue({
        promise: jest.fn().mockResolvedValue({ Messages: undefined }),
      });

      const stopFn = await jobQueueInstance.processQueue(mockHandler, 5);

      expect(mockHandler).not.toHaveBeenCalled();
      stopFn();
    });

    it('should handle handler errors gracefully', async () => {
      const mockHandler = jest.fn().mockRejectedValue(new Error('Handler error'));

      mockSQS.receiveMessage.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Messages: [
            {
              MessageId: 'msg-1',
              ReceiptHandle: 'receipt-1',
              Body: JSON.stringify({ jobId: 'job-1' }),
            },
          ],
        }),
      });

      const stopFn = await jobQueueInstance.processQueue(mockHandler, 5);

      expect(mockHandler).toHaveBeenCalled();
      stopFn();
    });

    it('should handle receive message errors', async () => {
      const mockHandler = jest.fn().mockResolvedValue(undefined);

      mockSQS.receiveMessage.mockReturnValue({
        promise: jest.fn().mockRejectedValue(new Error('Receive error')),
      });

      const stopFn = await jobQueueInstance.processQueue(mockHandler, 5);

      expect(mockHandler).not.toHaveBeenCalled();
      stopFn();
    });

    it('should return stop function to clear interval', async () => {
      const mockHandler = jest.fn().mockResolvedValue(undefined);

      const stopFn = await jobQueueInstance.processQueue(mockHandler, 5);

      expect(typeof stopFn).toBe('function');
      expect(() => stopFn()).not.toThrow();
    });

    it('should use correct queue URL', async () => {
      const mockHandler = jest.fn().mockResolvedValue(undefined);

      await jobQueueInstance.processQueue(mockHandler, 5);

      const callArgs = mockSQS.receiveMessage.mock.calls[0][0];

      expect(callArgs.QueueUrl).toBe(process.env.SQS_QUEUE_URL);
    });

    it('should wait for messages using long polling', async () => {
      const mockHandler = jest.fn().mockResolvedValue(undefined);

      await jobQueueInstance.processQueue(mockHandler, 5);

      const callArgs = mockSQS.receiveMessage.mock.calls[0][0];

      expect(callArgs.WaitTimeSeconds).toBe(20);
    });

    it('should request all message attributes', async () => {
      const mockHandler = jest.fn().mockResolvedValue(undefined);

      await jobQueueInstance.processQueue(mockHandler, 5);

      const callArgs = mockSQS.receiveMessage.mock.calls[0][0];

      expect(callArgs.MessageAttributeNames).toEqual(['All']);
    });
  });

  describe('acknowledgeMessage', () => {
    it('should delete message from queue', async () => {
      mockSQS.deleteMessage.mockReturnValue({
        promise: jest.fn().mockResolvedValue({}),
      });

      await jobQueueInstance.acknowledgeMessage('receipt-handle-123');

      expect(mockSQS.deleteMessage).toHaveBeenCalledWith({
        QueueUrl: process.env.SQS_QUEUE_URL,
        ReceiptHandle: 'receipt-handle-123',
      });
    });

    it('should use correct queue URL', async () => {
      mockSQS.deleteMessage.mockReturnValue({
        promise: jest.fn().mockResolvedValue({}),
      });

      await jobQueueInstance.acknowledgeMessage('receipt-123');

      const callArgs = mockSQS.deleteMessage.mock.calls[0][0];

      expect(callArgs.QueueUrl).toBe(process.env.SQS_QUEUE_URL);
    });

    it('should handle delete errors', async () => {
      mockSQS.deleteMessage.mockReturnValue({
        promise: jest.fn().mockRejectedValue(new Error('Delete failed')),
      });

      await expect(jobQueueInstance.acknowledgeMessage('receipt-123')).rejects.toThrow(
        'Delete failed'
      );
    });

    it('should work with different receipt handles', async () => {
      mockSQS.deleteMessage.mockReturnValue({
        promise: jest.fn().mockResolvedValue({}),
      });

      const receipts = ['receipt-1', 'receipt-2', 'receipt-3'];

      for (const receipt of receipts) {
        await jobQueueInstance.acknowledgeMessage(receipt);
      }

      expect(mockSQS.deleteMessage).toHaveBeenCalledTimes(3);
    });
  });

  describe('sendToDLQ', () => {
    it('should send message to dead letter queue', async () => {
      mockSQS.sendMessage.mockReturnValue({
        promise: jest.fn().mockResolvedValue({ MessageId: 'dlq-msg-1' }),
      });

      const message = { jobId: 'job-123', type: 'thumbnail' };

      await jobQueueInstance.sendToDLQ(message, 'Max retries exceeded');

      expect(mockSQS.sendMessage).toHaveBeenCalled();
    });

    it('should include DLQ metadata', async () => {
      mockSQS.sendMessage.mockReturnValue({
        promise: jest.fn().mockResolvedValue({ MessageId: 'dlq-msg-1' }),
      });

      const message = { jobId: 'job-123', type: 'thumbnail' };

      await jobQueueInstance.sendToDLQ(message, 'Processing failed');

      const callArgs = mockSQS.sendMessage.mock.calls[0][0];
      const messageBody = JSON.parse(callArgs.MessageBody);

      expect(messageBody.dlqReason).toBe('Processing failed');
      expect(messageBody.dlqTimestamp).toBeDefined();
      expect(messageBody.jobId).toBe('job-123');
    });

    it('should use DLQ URL', async () => {
      mockSQS.sendMessage.mockReturnValue({
        promise: jest.fn().mockResolvedValue({ MessageId: 'dlq-msg-1' }),
      });

      const message = { jobId: 'job-123' };

      await jobQueueInstance.sendToDLQ(message, 'Reason');

      const callArgs = mockSQS.sendMessage.mock.calls[0][0];

      expect(callArgs.QueueUrl).toBe(process.env.SQS_DLQ_URL);
    });

    it('should handle different failure reasons', async () => {
      mockSQS.sendMessage.mockReturnValue({
        promise: jest.fn().mockResolvedValue({ MessageId: 'dlq-msg-1' }),
      });

      const reasons = [
        'Max retries exceeded',
        'Invalid message format',
        'Resource not found',
        'Processing timeout',
      ];

      for (const reason of reasons) {
        mockSQS.sendMessage.mockReturnValue({
          promise: jest.fn().mockResolvedValue({ MessageId: 'dlq-msg-1' }),
        });

        await jobQueueInstance.sendToDLQ({ jobId: 'job-test' }, reason);

        const callArgs =
          mockSQS.sendMessage.mock.calls[mockSQS.sendMessage.mock.calls.length - 1][0];
        const messageBody = JSON.parse(callArgs.MessageBody);

        expect(messageBody.dlqReason).toBe(reason);
      }
    });

    it('should handle DLQ send errors', async () => {
      mockSQS.sendMessage.mockReturnValue({
        promise: jest.fn().mockRejectedValue(new Error('DLQ send failed')),
      });

      const message = { jobId: 'job-123' };

      await expect(jobQueueInstance.sendToDLQ(message, 'Reason')).rejects.toThrow(
        'DLQ send failed'
      );
    });

    it('should preserve original message data', async () => {
      mockSQS.sendMessage.mockReturnValue({
        promise: jest.fn().mockResolvedValue({ MessageId: 'dlq-msg-1' }),
      });

      const message = {
        jobId: 'job-456',
        type: 'extract-metadata',
        episodeId: 'ep-789',
        metadata: { custom: 'data' },
      };

      await jobQueueInstance.sendToDLQ(message, 'Failed');

      const callArgs = mockSQS.sendMessage.mock.calls[0][0];
      const messageBody = JSON.parse(callArgs.MessageBody);

      expect(messageBody.jobId).toBe('job-456');
      expect(messageBody.type).toBe('extract-metadata');
      expect(messageBody.episodeId).toBe('ep-789');
      expect(messageBody.metadata.custom).toBe('data');
    });
  });

  describe('getQueueAttributes', () => {
    it('should retrieve queue attributes', async () => {
      const result = await jobQueueInstance.getQueueAttributes();

      expect(result.approximateNumberOfMessages).toBe(10);
      expect(result.approximateNumberOfMessagesNotVisible).toBe(5);
      expect(result.approximateNumberOfMessagesDelayed).toBe(2);
      expect(result.visibilityTimeout).toBe(300);
      expect(result.messageRetentionPeriod).toBe(345600);
    });

    it('should use correct queue URL', async () => {
      await jobQueueInstance.getQueueAttributes();

      const callArgs = mockSQS.getQueueAttributes.mock.calls[0][0];

      expect(callArgs.QueueUrl).toBe(process.env.SQS_QUEUE_URL);
    });

    it('should request all attributes', async () => {
      await jobQueueInstance.getQueueAttributes();

      const callArgs = mockSQS.getQueueAttributes.mock.calls[0][0];

      expect(callArgs.AttributeNames).toEqual(['All']);
    });

    it('should convert string numbers to integers', async () => {
      const result = await jobQueueInstance.getQueueAttributes();

      expect(typeof result.approximateNumberOfMessages).toBe('number');
      expect(typeof result.visibilityTimeout).toBe('number');
      expect(typeof result.messageRetentionPeriod).toBe('number');
    });

    it('should handle attribute retrieval errors', async () => {
      mockSQS.getQueueAttributes.mockReturnValue({
        promise: jest.fn().mockRejectedValue(new Error('Get attributes failed')),
      });

      await expect(jobQueueInstance.getQueueAttributes()).rejects.toThrow('Get attributes failed');
    });

    it('should handle empty queue', async () => {
      mockSQS.getQueueAttributes.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Attributes: {
            ApproximateNumberOfMessages: '0',
            ApproximateNumberOfMessagesNotVisible: '0',
            ApproximateNumberOfMessagesDelayed: '0',
            VisibilityTimeout: '300',
            MessageRetentionPeriod: '345600',
          },
        }),
      });

      const result = await jobQueueInstance.getQueueAttributes();

      expect(result.approximateNumberOfMessages).toBe(0);
      expect(result.approximateNumberOfMessagesNotVisible).toBe(0);
    });

    it('should return all expected attributes', async () => {
      const result = await jobQueueInstance.getQueueAttributes();

      expect(result).toHaveProperty('approximateNumberOfMessages');
      expect(result).toHaveProperty('approximateNumberOfMessagesNotVisible');
      expect(result).toHaveProperty('approximateNumberOfMessagesDelayed');
      expect(result).toHaveProperty('visibilityTimeout');
      expect(result).toHaveProperty('messageRetentionPeriod');
    });
  });

  describe('purgeQueue', () => {
    it('should purge all messages from queue', async () => {
      mockSQS.purgeQueue.mockReturnValue({
        promise: jest.fn().mockResolvedValue({}),
      });

      await jobQueueInstance.purgeQueue();

      expect(mockSQS.purgeQueue).toHaveBeenCalledWith({
        QueueUrl: process.env.SQS_QUEUE_URL,
      });
    });

    it('should use correct queue URL', async () => {
      mockSQS.purgeQueue.mockReturnValue({
        promise: jest.fn().mockResolvedValue({}),
      });

      await jobQueueInstance.purgeQueue();

      const callArgs = mockSQS.purgeQueue.mock.calls[0][0];

      expect(callArgs.QueueUrl).toBe(process.env.SQS_QUEUE_URL);
    });

    it('should handle purge errors', async () => {
      mockSQS.purgeQueue.mockReturnValue({
        promise: jest.fn().mockRejectedValue(new Error('Purge failed')),
      });

      await expect(jobQueueInstance.purgeQueue()).rejects.toThrow('Purge failed');
    });

    it('should return successfully when queue is already empty', async () => {
      mockSQS.purgeQueue.mockReturnValue({
        promise: jest.fn().mockResolvedValue({}),
      });

      await jobQueueInstance.purgeQueue();

      expect(mockSQS.purgeQueue).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should propagate AWS SDK errors', async () => {
      mockSQS.sendMessage.mockReturnValue({
        promise: jest.fn().mockRejectedValue(new Error('AWS SDK error')),
      });

      const jobData = { type: 'process', episodeId: 'ep-123' };

      await expect(jobQueueInstance.enqueueJob(jobData)).rejects.toThrow('AWS SDK error');
    });

    it('should handle connection errors', async () => {
      mockSQS.sendMessage.mockReturnValue({
        promise: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      });

      const jobData = { type: 'process', episodeId: 'ep-123' };

      await expect(jobQueueInstance.enqueueJob(jobData)).rejects.toThrow('ECONNREFUSED');
    });

    it('should handle timeout errors', async () => {
      mockSQS.sendMessage.mockReturnValue({
        promise: jest.fn().mockRejectedValue(new Error('Request timeout')),
      });

      const jobData = { type: 'process', episodeId: 'ep-123' };

      await expect(jobQueueInstance.enqueueJob(jobData)).rejects.toThrow('Request timeout');
    });

    it('should handle invalid message format errors', async () => {
      mockSQS.sendMessage.mockReturnValue({
        promise: jest.fn().mockRejectedValue(new Error('Invalid message format')),
      });

      const jobData = { type: 'process', episodeId: 'ep-123' };

      await expect(jobQueueInstance.enqueueJob(jobData)).rejects.toThrow('Invalid message format');
    });

    it('should log errors appropriately', async () => {
      const logger = require('../../../src/utils/logger');
      mockSQS.sendMessage.mockReturnValue({
        promise: jest.fn().mockRejectedValue(new Error('Send failed')),
      });

      const jobData = { type: 'process', episodeId: 'ep-123' };

      try {
        await jobQueueInstance.enqueueJob(jobData);
      } catch (e) {
        // Expected error
      }

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to enqueue job',
        expect.objectContaining({
          error: 'Send failed',
        })
      );
    });
  });
});
