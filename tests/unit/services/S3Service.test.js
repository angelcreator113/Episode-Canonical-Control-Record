/**
 * S3Service Unit Tests
 * Tests S3 file operations with mocked AWS SDK
 */
// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const AWS = require('aws-sdk');

// Mock AWS SDK
jest.mock('aws-sdk', () => {
  return {
    S3: jest.fn(),
  };
});

const S3Service = require('../../../src/services/S3Service');

describe('S3Service', () => {
  let mockS3;
  let s3Instance;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockS3 = {
      upload: jest.fn(() => ({
        promise: () => Promise.resolve({
          ETag: '"abc123"',
          VersionId: 'v1',
          Location: 'https://bucket.s3.amazonaws.com/key',
          Key: 'key',
        }),
      })),
      deleteObject: jest.fn(() => ({
        promise: () => Promise.resolve({}),
      })),
      headObject: jest.fn(() => ({
        promise: () => Promise.resolve({
          ContentLength: 1024,
          ContentType: 'text/plain',
          LastModified: new Date(),
          ETag: '"abc123"',
          Metadata: {},
        }),
      })),
      listObjectsV2: jest.fn(() => ({
        promise: () => Promise.resolve({ Contents: [] }),
      })),
      copyObject: jest.fn(() => ({
        promise: () => Promise.resolve({ CopyObjectResult: { ETag: '"abc"' } }),
      })),
      getObject: jest.fn(() => ({
        createReadStream: () => ({ on: jest.fn(), pipe: jest.fn() }),
      })),
      getSignedUrl: jest.fn((method, params) => 'https://bucket.s3.amazonaws.com/key?signed=params'),
    };

    AWS.S3.mockImplementation(() => mockS3);
    
    // Load the module after mocking AWS SDK
    s3Instance = require('../../../src/services/S3Service');
  });

  describe('uploadFile', () => {
    it('should upload file to S3 successfully', async () => {
      const mockPromise = Promise.resolve({
        ETag: '"abc123"',
        VersionId: 'v1',
        Location: 'https://bucket.s3.amazonaws.com/key',
        Key: 'episodes/uuid/video/file.mp4',
      });

      mockS3.upload = jest.fn(() => ({
        promise: () => mockPromise,
      }));

      const bucket = 'test-bucket';
      const key = 'episodes/uuid/video/file.mp4';
      const body = Buffer.from('test content');
      const options = { ContentType: 'video/mp4' };

      const result = await s3Instance.uploadFile(bucket, key, body, options);

      expect(result).toEqual({
        etag: '"abc123"',
        versionId: 'v1',
        location: 'https://bucket.s3.amazonaws.com/key',
        key: 'episodes/uuid/video/file.mp4',
      });
    });

    it('should handle upload errors', async () => {
      const error = new Error('Access Denied');
      mockS3.upload = jest.fn(() => ({
        promise: () => Promise.reject(error),
      }));
      
      await expect(
        s3Instance.uploadFile('bucket', 'key', Buffer.from('data'))
      ).rejects.toThrow('Access Denied');
    });

    it('should pass metadata in upload params', async () => {
      mockS3.upload = jest.fn(() => ({
        promise: () => Promise.resolve({
          ETag: '"abc"',
          VersionId: 'v1',
          Location: 'https://bucket.s3.amazonaws.com/key',
          Key: 'key',
        }),
      }));

      await s3Instance.uploadFile('bucket', 'key', Buffer.from('data'), {
        ContentType: 'video/mp4',
        Metadata: { episodeId: 'ep-1' },
      });

      expect(mockS3.upload).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'bucket',
          Key: 'key',
          ContentType: 'video/mp4',
          Metadata: { episodeId: 'ep-1' },
        })
      );
    });
  });

  describe('getPreSignedUrl', () => {
    it('should generate pre-signed URL for download', () => {
      const mockUrl = 'https://bucket.s3.amazonaws.com/key?signed=params';
      mockS3.getSignedUrl = jest.fn(() => mockUrl);

      const url = s3Instance.getPreSignedUrl('bucket', 'key', 3600);

      expect(url).toBe(mockUrl);
      expect(mockS3.getSignedUrl).toHaveBeenCalledWith(
        'getObject',
        expect.objectContaining({
          Bucket: 'bucket',
          Key: 'key',
          Expires: 3600,
        })
      );
    });

    it('should use default expiration time', () => {
      mockS3.getSignedUrl = jest.fn(() => 'https://signed.url');

      s3Instance.getPreSignedUrl('bucket', 'key');

      expect(mockS3.getSignedUrl).toHaveBeenCalledWith(
        'getObject',
        expect.objectContaining({
          Expires: 3600,
        })
      );
    });

    it('should handle URL generation errors', () => {
      mockS3.getSignedUrl = jest.fn(() => {
        throw new Error('Invalid bucket');
      });

      expect(() => {
        s3Instance.getPreSignedUrl('invalid', 'key');
      }).toThrow('Invalid bucket');
    });
  });

  describe('deleteFile', () => {
    it('should delete file from S3', async () => {
      mockS3.deleteObject = jest.fn(() => ({
        promise: () => Promise.resolve({}),
      }));

      await s3Instance.deleteFile('bucket', 'episodes/uuid/file.mp4');

      expect(mockS3.deleteObject).toHaveBeenCalledWith({
        Bucket: 'bucket',
        Key: 'episodes/uuid/file.mp4',
      });
    });

    it('should handle delete errors', async () => {
      const error = new Error('File not found');
      mockS3.deleteObject = jest.fn(() => ({
        promise: () => Promise.reject(error),
      }));

      
      await expect(
        s3Instance.deleteFile('bucket', 'key')
      ).rejects.toThrow('File not found');
    });
  });

  describe('getFileMetadata', () => {
    it('should retrieve file metadata from S3', async () => {
      mockS3.headObject = jest.fn(() => ({
        promise: () => Promise.resolve({
          ContentLength: 1024000,
          ContentType: 'video/mp4',
          LastModified: new Date('2024-01-01'),
          ETag: '"abc123"',
          Metadata: { episodeId: 'ep-1' },
        }),
      }));

      const metadata = await s3Instance.getFileMetadata('bucket', 'key');

      expect(metadata).toEqual({
        size: 1024000,
        contentType: 'video/mp4',
        lastModified: new Date('2024-01-01'),
        etag: '"abc123"',
        metadata: { episodeId: 'ep-1' },
      });
    });

    it('should handle metadata retrieval errors', async () => {
      const error = new Error('Access Denied');
      mockS3.headObject = jest.fn(() => ({
        promise: () => Promise.reject(error),
      }));

      
      await expect(
        s3Instance.getFileMetadata('bucket', 'key')
      ).rejects.toThrow('Access Denied');
    });
  });

  describe('listFiles', () => {
    it('should list files with prefix', async () => {
      mockS3.listObjectsV2 = jest.fn(() => ({
        promise: () => Promise.resolve({
          Contents: [
            {
              Key: 'episodes/uuid/video/file1.mp4',
              Size: 5368709120,
              LastModified: new Date('2024-01-01'),
              ETag: '"abc123"',
            },
            {
              Key: 'episodes/uuid/video/file2.mp4',
              Size: 1024000,
              LastModified: new Date('2024-01-02'),
              ETag: '"def456"',
            },
          ],
        }),
      }));

      const files = await s3Instance.listFiles('bucket', 'episodes/uuid/video');

      expect(files).toHaveLength(2);
      expect(files[0]).toEqual(
        expect.objectContaining({
          key: 'episodes/uuid/video/file1.mp4',
          size: 5368709120,
        })
      );
    });

    it('should handle empty list', async () => {
      mockS3.listObjectsV2 = jest.fn(() => ({
        promise: () => Promise.resolve({ Contents: [] }),
      }));

      const files = await s3Instance.listFiles('bucket', 'empty/prefix');

      expect(files).toEqual([]);
    });

    it('should use custom maxKeys', async () => {
      mockS3.listObjectsV2 = jest.fn(() => ({
        promise: () => Promise.resolve({ Contents: [] }),
      }));

      await s3Instance.listFiles('bucket', 'prefix', 50);

      expect(mockS3.listObjectsV2).toHaveBeenCalledWith(
        expect.objectContaining({
          MaxKeys: 50,
        })
      );
    });
  });

  describe('copyFile', () => {
    it('should copy file within S3', async () => {
      mockS3.copyObject = jest.fn(() => ({
        promise: () => Promise.resolve({
          CopyObjectResult: { ETag: '"copied"' },
        }),
      }));

      const S3Service = require('../../../src/services/S3Service');
      const result = await S3Service.copyFile('src-bucket', 'src-key', 'dest-bucket', 'dest-key');

      expect(result).toBeDefined();
      expect(mockS3.copyObject).toHaveBeenCalledWith({
        CopySource: 'src-bucket/src-key',
        Bucket: 'dest-bucket',
        Key: 'dest-key',
      });
    });

    it('should handle copy errors', async () => {
      const error = new Error('Source not found');
      mockS3.copyObject = jest.fn(() => ({
        promise: () => Promise.reject(error),
      }));

      const S3Service = require('../../../src/services/S3Service');
      
      await expect(
        S3Service.copyFile('src-bucket', 'invalid', 'dest-bucket', 'dest')
      ).rejects.toThrow('Source not found');
    });
  });

  describe('getFileStream', () => {
    it('should create readable stream from S3', () => {
      const mockStream = {
        on: jest.fn(),
        pipe: jest.fn(),
      };

      mockS3.getObject = jest.fn(() => ({
        createReadStream: () => mockStream,
      }));

      const S3Service = require('../../../src/services/S3Service');
      const stream = S3Service.getFileStream('bucket', 'key');

      expect(stream).toBe(mockStream);
      expect(mockS3.getObject).toHaveBeenCalledWith({
        Bucket: 'bucket',
        Key: 'key',
      });
    });

    it('should handle stream creation errors', () => {
      mockS3.getObject = jest.fn(() => {
        throw new Error('Stream error');
      });

      const S3Service = require('../../../src/services/S3Service');
      
      expect(() => {
        S3Service.getFileStream('bucket', 'key');
      }).toThrow('Stream error');
    });
  });
});
