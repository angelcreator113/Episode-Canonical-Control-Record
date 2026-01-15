/**
 * FileController Unit Tests
 * Tests file upload, download, delete, and management operations
 */

// Set environment variables BEFORE requiring anything
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_S3_BUCKET_EPISODES = 'brd-episodes-dev';
process.env.AWS_S3_BUCKET_THUMBNAILS = 'brd-thumbnails-dev';
process.env.FILE_LIMITS_VIDEO_SOFT = '5368709120';
process.env.FILE_LIMITS_VIDEO_HARD = '10737418240';
process.env.NODE_ENV = 'test';

// Mock models
jest.mock('../../../src/models', () => ({
  FileStorage: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    findAll: jest.fn(),
  },
  Episode: {
    findByPk: jest.fn(),
  },
}));

// Mock services
jest.mock('../../../src/services/S3Service', () => ({
  uploadFile: jest.fn(),
  getPreSignedUrl: jest.fn(),
  deleteFile: jest.fn(),
  getFileMetadata: jest.fn(),
}));

jest.mock('../../../src/services/FileValidationService', () => ({
  validateFile: jest.fn(),
  generateS3Key: jest.fn(),
  getS3Bucket: jest.fn(),
}));

jest.mock('../../../src/services/JobQueueService', () => ({
  enqueueJob: jest.fn(),
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const fileController = require('../../../src/controllers/fileController');
const { FileStorage, Episode } = require('../../../src/models');
const S3Service = require('../../../src/services/S3Service');
const FileValidationService = require('../../../src/services/FileValidationService');
const JobQueueService = require('../../../src/services/JobQueueService');

describe('FileController', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      params: {},
      body: {},
      file: null,
      query: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  describe('uploadFile', () => {
    beforeEach(() => {
      FileValidationService.validateFile.mockReturnValue({ valid: true });
      FileValidationService.generateS3Key.mockReturnValue('episodes/ep-123/video/file.mp4');
      FileValidationService.getS3Bucket.mockReturnValue('brd-episodes-dev');
    });

    it('should upload file successfully', async () => {
      req.params = { episodeId: 'ep-123' };
      req.body = { fileType: 'video' };
      req.file = {
        originalname: 'episode.mp4',
        size: 1024 * 1024,
        mimetype: 'video/mp4',
        buffer: Buffer.from('mock-data'),
      };

      Episode.findByPk.mockResolvedValue({ id: 'ep-123' });
      FileStorage.create.mockResolvedValue({
        id: 'file-123',
        episode_id: 'ep-123',
        file_name: 'episode.mp4',
        file_type: 'video',
        file_size: 1024 * 1024,
        update: jest.fn().mockResolvedValue({}),
      });
      S3Service.uploadFile.mockResolvedValue({
        etag: 'etag-123',
        versionId: 'v-123',
      });
      JobQueueService.enqueueJob.mockResolvedValue({
        jobId: 'job-123',
        status: 'pending',
      });

      await fileController.uploadFile(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalled();
      expect(FileStorage.create).toHaveBeenCalled();
      expect(S3Service.uploadFile).toHaveBeenCalled();
    });

    it('should return 400 if no file provided', async () => {
      req.params = { episodeId: 'ep-123' };
      req.file = null;

      await fileController.uploadFile(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'No file provided' }));
    });

    it('should return 404 if episode not found', async () => {
      req.params = { episodeId: 'ep-999' };
      req.file = {
        originalname: 'test.mp4',
        size: 1024,
        mimetype: 'video/mp4',
        buffer: Buffer.from('data'),
      };

      Episode.findByPk.mockResolvedValue(null);

      await fileController.uploadFile(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Episode not found' })
      );
    });

    it('should return 400 if file validation fails', async () => {
      req.params = { episodeId: 'ep-123' };
      req.body = { fileType: 'video' };
      req.file = {
        originalname: 'huge.mp4',
        size: 999 * 1024 * 1024 * 1024, // Way too large
        mimetype: 'video/mp4',
        buffer: Buffer.from('data'),
      };

      Episode.findByPk.mockResolvedValue({ id: 'ep-123' });
      FileValidationService.validateFile.mockReturnValue({
        valid: false,
        errors: ['File exceeds maximum size'],
      });

      await fileController.uploadFile(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ errors: expect.any(Array) }));
    });

    it('should handle upload errors gracefully', async () => {
      req.params = { episodeId: 'ep-123' };
      req.body = { fileType: 'video' };
      req.file = {
        originalname: 'test.mp4',
        size: 1024,
        mimetype: 'video/mp4',
        buffer: Buffer.from('data'),
      };

      Episode.findByPk.mockRejectedValue(new Error('Database error'));

      await fileController.uploadFile(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'File upload failed' })
      );
    });

    it('should enqueue indexing job', async () => {
      req.params = { episodeId: 'ep-123' };
      req.body = { fileType: 'video' };
      req.file = {
        originalname: 'episode.mp4',
        size: 1024,
        mimetype: 'video/mp4',
        buffer: Buffer.from('data'),
      };

      Episode.findByPk.mockResolvedValue({ id: 'ep-123' });
      FileStorage.create.mockResolvedValue({
        id: 'file-456',
        episode_id: 'ep-123',
        file_name: 'episode.mp4',
        file_type: 'video',
        file_size: 1024,
        update: jest.fn().mockResolvedValue({}),
      });
      S3Service.uploadFile.mockResolvedValue({ etag: 'e123', versionId: 'v123' });
      JobQueueService.enqueueJob.mockResolvedValue({ jobId: 'job-789', status: 'pending' });

      await fileController.uploadFile(req, res);

      expect(JobQueueService.enqueueJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'index_file',
          episodeId: 'ep-123',
          fileId: 'file-456',
        })
      );
    });

    it('should include correct S3 metadata', async () => {
      req.params = { episodeId: 'ep-123' };
      req.body = { fileType: 'video' };
      req.file = {
        originalname: 'test.mp4',
        size: 1024,
        mimetype: 'video/mp4',
        buffer: Buffer.from('data'),
      };

      Episode.findByPk.mockResolvedValue({ id: 'ep-123' });
      FileStorage.create.mockResolvedValue({
        id: 'file-123',
        episode_id: 'ep-123',
        file_name: 'test.mp4',
        file_type: 'video',
        file_size: 1024,
        update: jest.fn().mockResolvedValue({}),
      });
      S3Service.uploadFile.mockResolvedValue({ etag: 'etag', versionId: 'v1' });
      JobQueueService.enqueueJob.mockResolvedValue({ jobId: 'job-123' });

      await fileController.uploadFile(req, res);

      const uploadCall = S3Service.uploadFile.mock.calls[0];
      expect(uploadCall[0]).toBe('brd-episodes-dev');
      expect(uploadCall[2]).toEqual(req.file.buffer);
      expect(uploadCall[3]).toEqual(
        expect.objectContaining({
          ContentType: 'video/mp4',
          Metadata: expect.objectContaining({
            episodeId: 'ep-123',
          }),
        })
      );
    });
  });

  describe('getPreSignedUrl', () => {
    it('should return pre-signed URL for existing file', async () => {
      req.params = { episodeId: 'ep-123', fileId: 'file-456' };

      const mockFile = {
        id: 'file-456',
        episode_id: 'ep-123',
        file_name: 'test.mp4',
        s3_bucket: 'brd-episodes-dev',
        s3_key: 'episodes/ep-123/video/test.mp4',
        access_count: 5,
        update: jest.fn().mockResolvedValue({}),
      };

      FileStorage.findOne.mockResolvedValue(mockFile);
      S3Service.getPreSignedUrl.mockResolvedValue('https://s3.url/presigned?token=123');

      await fileController.getPreSignedUrl(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('https://'),
          expiresIn: 3600,
        })
      );
    });

    it('should return 404 if file not found', async () => {
      req.params = { episodeId: 'ep-123', fileId: 'file-999' };

      FileStorage.findOne.mockResolvedValue(null);

      await fileController.getPreSignedUrl(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'File not found' }));
    });

    it('should increment access count', async () => {
      req.params = { episodeId: 'ep-123', fileId: 'file-456' };

      const mockFile = {
        id: 'file-456',
        episode_id: 'ep-123',
        file_name: 'test.mp4',
        s3_bucket: 'brd-episodes-dev',
        s3_key: 'episodes/ep-123/video/test.mp4',
        access_count: 5,
        update: jest.fn().mockResolvedValue({}),
      };

      FileStorage.findOne.mockResolvedValue(mockFile);
      S3Service.getPreSignedUrl.mockResolvedValue('https://s3.url/presigned?token=123');

      await fileController.getPreSignedUrl(req, res);

      expect(mockFile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          access_count: 6,
          last_accessed_at: expect.any(Date),
        })
      );
    });

    it('should handle URL generation errors', async () => {
      req.params = { episodeId: 'ep-123', fileId: 'file-456' };

      const mockFile = {
        id: 'file-456',
        episode_id: 'ep-123',
        s3_bucket: 'brd-episodes-dev',
        s3_key: 'episodes/ep-123/video/test.mp4',
      };

      FileStorage.findOne.mockResolvedValue(mockFile);
      S3Service.getPreSignedUrl.mockRejectedValue(new Error('S3 error'));

      await fileController.getPreSignedUrl(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Failed to generate download URL' })
      );
    });
  });

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      req.params = { episodeId: 'ep-123', fileId: 'file-456' };

      const mockFile = {
        id: 'file-456',
        episode_id: 'ep-123',
        file_name: 'test.mp4',
        s3_bucket: 'brd-episodes-dev',
        s3_key: 'episodes/ep-123/video/test.mp4',
        destroy: jest.fn().mockResolvedValue({}),
      };

      FileStorage.findOne.mockResolvedValue(mockFile);
      S3Service.deleteFile.mockResolvedValue({});

      await fileController.deleteFile(req, res);

      expect(S3Service.deleteFile).toHaveBeenCalledWith(
        'brd-episodes-dev',
        'episodes/ep-123/video/test.mp4'
      );
      expect(mockFile.destroy).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'File deleted successfully' })
      );
    });

    it('should return 404 if file not found', async () => {
      req.params = { episodeId: 'ep-123', fileId: 'file-999' };

      FileStorage.findOne.mockResolvedValue(null);

      await fileController.deleteFile(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'File not found' }));
    });

    it('should handle deletion errors', async () => {
      req.params = { episodeId: 'ep-123', fileId: 'file-456' };

      const mockFile = {
        id: 'file-456',
        episode_id: 'ep-123',
        s3_bucket: 'brd-episodes-dev',
        s3_key: 'episodes/ep-123/video/test.mp4',
        destroy: jest.fn().mockResolvedValue({}),
      };

      FileStorage.findOne.mockResolvedValue(mockFile);
      S3Service.deleteFile.mockRejectedValue(new Error('S3 delete error'));

      await fileController.deleteFile(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'File deletion failed' })
      );
    });
  });

  describe('listEpisodeFiles', () => {
    it('should list all files for episode', async () => {
      req.params = { episodeId: 'ep-123' };
      req.query = {};

      const mockFiles = [
        {
          id: 'file-1',
          file_name: 'video.mp4',
          file_type: 'video',
          file_size: 1024,
          upload_status: 'completed',
          indexing_status: 'completed',
          created_at: new Date(),
        },
        {
          id: 'file-2',
          file_name: 'subtitle.srt',
          file_type: 'subtitle',
          file_size: 512,
          upload_status: 'completed',
          indexing_status: 'completed',
          created_at: new Date(),
        },
      ];

      FileStorage.findAll.mockResolvedValue(mockFiles);

      await fileController.listEpisodeFiles(req, res);

      expect(FileStorage.findAll).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ files: expect.any(Array) }));
    });

    it('should filter by file type', async () => {
      req.params = { episodeId: 'ep-123' };
      req.query = { fileType: 'video' };

      FileStorage.findAll.mockResolvedValue([]);

      await fileController.listEpisodeFiles(req, res);

      const findAllCall = FileStorage.findAll.mock.calls[0][0];
      expect(findAllCall.where).toEqual(expect.objectContaining({ file_type: 'video' }));
    });

    it('should handle listing errors', async () => {
      req.params = { episodeId: 'ep-123' };

      FileStorage.findAll.mockRejectedValue(new Error('Database error'));

      await fileController.listEpisodeFiles(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Failed to list files' })
      );
    });
  });
});
