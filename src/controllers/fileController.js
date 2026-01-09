/**
 * FileController
 * Handles file upload, download, and management endpoints
 */
const { FileStorage, Episode } = require('../models');
const S3Service = require('../services/S3Service');
const FileValidationService = require('../services/FileValidationService');
const JobQueueService = require('../services/JobQueueService');
const logger = require('../utils/logger');
const ActivityService = require('../services/ActivityService');
const NotificationService = require('../services/NotificationService');
const SocketService = require('../services/SocketService');

class FileController {
  /**
   * Upload file to episode
   * @param {object} req - Request object
   * @param {object} res - Response object
   */
  async uploadFile(req, res) {
    try {
      const { episodeId } = req.params;
      const { fileType } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      // Verify episode exists
      const episode = await Episode.findByPk(episodeId);
      if (!episode) {
        return res.status(404).json({ error: 'Episode not found' });
      }

      // Validate file
      const validation = FileValidationService.validateFile({
        name: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
        type: fileType,
      });

      if (!validation.valid) {
        return res.status(400).json({ errors: validation.errors });
      }

      // Generate S3 key and get bucket
      const s3Key = FileValidationService.generateS3Key(episodeId, fileType, req.file.originalname);
      const bucket = FileValidationService.getS3Bucket(fileType);

      // Create file storage record
      const fileStorage = await FileStorage.create({
        episode_id: episodeId,
        file_name: req.file.originalname,
        file_type: fileType,
        file_size: req.file.size,
        mime_type: req.file.mimetype,
        s3_key: s3Key,
        s3_bucket: bucket,
        upload_status: 'pending',
      });

      // Upload to S3
      const s3Result = await S3Service.uploadFile(
        bucket,
        s3Key,
        req.file.buffer,
        {
          ContentType: req.file.mimetype,
          Metadata: {
            episodeId,
            fileStorageId: fileStorage.id,
          },
        }
      );

      // Update file storage with S3 metadata
      await fileStorage.update({
        s3_etag: s3Result.etag,
        s3_version_id: s3Result.versionId,
        upload_status: 'completed',
      });

      // Enqueue indexing job
      const job = await JobQueueService.enqueueJob({
        type: 'index_file',
        episodeId,
        fileId: fileStorage.id,
        metadata: {
          fileName: req.file.originalname,
          fileType,
          s3Key,
          bucket,
        },
      });

      logger.info('File uploaded successfully', {
        episodeId,
        fileId: fileStorage.id,
        jobId: job.jobId,
      });

      // Phase 3A Integration: Activity Logging (non-blocking)
      ActivityService.logActivity({
        userId: req.user?.id,
        action: 'CREATE',
        resourceType: 'file',
        resourceId: fileStorage.id,
        metadata: { fileName: req.file.originalname, fileType, episodeId, fileSize: req.file.size }
      }).catch((err) => console.error('Activity logging error:', err));

      // Phase 3A Integration: WebSocket broadcast (non-blocking)
      SocketService.broadcastMessage({
        event: 'file_uploaded',
        data: {
          fileId: fileStorage.id,
          episodeId,
          fileName: fileStorage.file_name,
          fileType,
          fileSize: fileStorage.file_size,
          uploadedBy: req.user?.email || 'unknown',
          timestamp: new Date()
        }
      }).catch((err) => console.error('WebSocket broadcast error:', err));

      // Phase 3A Integration: Notification (non-blocking)
      NotificationService.create({
        userId: req.user?.id,
        type: 'info',
        message: `File "${req.file.originalname}" uploaded successfully`,
        data: { resourceType: 'file', resourceId: fileStorage.id, episodeId }
      }).catch((err) => console.error('Notification error:', err));

      res.status(201).json({
        id: fileStorage.id,
        episodeId,
        fileName: fileStorage.file_name,
        fileType,
        fileSize: fileStorage.file_size,
        uploadStatus: fileStorage.upload_status,
        indexingStatus: fileStorage.indexing_status,
        jobId: job.jobId,
        createdAt: fileStorage.created_at,
      });
    } catch (error) {
      logger.error('File upload failed', { error: error.message });
      res.status(500).json({ error: 'File upload failed' });
    }
  }

  /**
   * Get pre-signed download URL
   * @param {object} req - Request object
   * @param {object} res - Response object
   */
  async getPreSignedUrl(req, res) {
    try {
      const { episodeId, fileId } = req.params;

      const fileStorage = await FileStorage.findOne({
        where: { id: fileId, episode_id: episodeId },
      });

      if (!fileStorage) {
        return res.status(404).json({ error: 'File not found' });
      }

      const url = await S3Service.getPreSignedUrl(
        fileStorage.s3_bucket,
        fileStorage.s3_key,
        3600 // 1 hour expiration
      );

      // Update access count
      await fileStorage.update({
        access_count: fileStorage.access_count + 1,
        last_accessed_at: new Date(),
      });

      // Phase 3A Integration: Activity Logging (non-blocking)
      ActivityService.logActivity({
        userId: req.user?.id,
        action: 'DOWNLOAD',
        resourceType: 'file',
        resourceId: fileId,
        metadata: { fileName: fileStorage.file_name, fileType: fileStorage.file_type, episodeId }
      }).catch((err) => console.error('Activity logging error:', err));

      // Phase 3A Integration: WebSocket broadcast (non-blocking)
      SocketService.broadcastMessage({
        event: 'file_download',
        data: {
          fileId,
          episodeId,
          fileName: fileStorage.file_name,
          downloadedBy: req.user?.email || 'unknown',
          timestamp: new Date()
        }
      }).catch((err) => console.error('WebSocket broadcast error:', err));

      res.json({
        url,
        expiresIn: 3600,
        fileName: fileStorage.file_name,
      });
    } catch (error) {
      logger.error('Failed to generate pre-signed URL', { error: error.message });
      res.status(500).json({ error: 'Failed to generate download URL' });
    }
  }

  /**
   * Delete file
   * @param {object} req - Request object
   * @param {object} res - Response object
   */
  async deleteFile(req, res) {
    try {
      const { episodeId, fileId } = req.params;

      const fileStorage = await FileStorage.findOne({
        where: { id: fileId, episode_id: episodeId },
      });

      if (!fileStorage) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Delete from S3
      await S3Service.deleteFile(fileStorage.s3_bucket, fileStorage.s3_key);

      // Soft delete from database
      await fileStorage.destroy();

      logger.info('File deleted', { episodeId, fileId });

      // Phase 3A Integration: Activity Logging (non-blocking)
      ActivityService.logActivity({
        userId: req.user?.id,
        action: 'DELETE',
        resourceType: 'file',
        resourceId: fileId,
        metadata: { fileName: fileStorage.file_name, fileType: fileStorage.file_type, episodeId }
      }).catch((err) => console.error('Activity logging error:', err));

      // Phase 3A Integration: WebSocket broadcast (non-blocking)
      SocketService.broadcastMessage({
        event: 'file_deleted',
        data: {
          fileId,
          episodeId,
          fileName: fileStorage.file_name,
          deletedBy: req.user?.email || 'unknown',
          timestamp: new Date()
        }
      }).catch((err) => console.error('WebSocket broadcast error:', err));

      // Phase 3A Integration: Notification (non-blocking)
      NotificationService.create({
        userId: req.user?.id,
        type: 'info',
        message: `File "${fileStorage.file_name}" deleted`,
        data: { resourceType: 'file', resourceId: fileId, episodeId }
      }).catch((err) => console.error('Notification error:', err));

      res.json({ message: 'File deleted successfully' });
    } catch (error) {
      logger.error('File deletion failed', { error: error.message });
      res.status(500).json({ error: 'File deletion failed' });
    }
  }

  /**
   * List episode files
   * @param {object} req - Request object
   * @param {object} res - Response object
   */
  async listEpisodeFiles(req, res) {
    try {
      const { episodeId } = req.params;
      const { fileType, uploadStatus, indexingStatus } = req.query;

      const where = { episode_id: episodeId };
      if (fileType) where.file_type = fileType;
      if (uploadStatus) where.upload_status = uploadStatus;
      if (indexingStatus) where.indexing_status = indexingStatus;

      const files = await FileStorage.findAll({
        where,
        order: [['created_at', 'DESC']],
      });

      res.json({
        episodeId,
        total: files.length,
        files: files.map((f) => ({
          id: f.id,
          fileName: f.file_name,
          fileType: f.file_type,
          fileSize: f.file_size,
          uploadStatus: f.upload_status,
          indexingStatus: f.indexing_status,
          accessCount: f.access_count,
          createdAt: f.created_at,
          updatedAt: f.updated_at,
        })),
      });
    } catch (error) {
      logger.error('Failed to list episode files', { error: error.message });
      res.status(500).json({ error: 'Failed to list files' });
    }
  }

  /**
   * Get file metadata
   * @param {object} req - Request object
   * @param {object} res - Response object
   */
  async getFileMetadata(req, res) {
    try {
      const { episodeId, fileId } = req.params;

      const fileStorage = await FileStorage.findOne({
        where: { id: fileId, episode_id: episodeId },
      });

      if (!fileStorage) {
        return res.status(404).json({ error: 'File not found' });
      }

      const metadata = await S3Service.getFileMetadata(
        fileStorage.s3_bucket,
        fileStorage.s3_key
      );

      res.json({
        id: fileStorage.id,
        fileName: fileStorage.file_name,
        fileType: fileStorage.file_type,
        fileSize: fileStorage.file_size,
        mimeType: fileStorage.mime_type,
        uploadStatus: fileStorage.upload_status,
        indexingStatus: fileStorage.indexing_status,
        metadata: fileStorage.metadata,
        s3Metadata: metadata,
        createdAt: fileStorage.created_at,
      });
    } catch (error) {
      logger.error('Failed to get file metadata', { error: error.message });
      res.status(500).json({ error: 'Failed to get file metadata' });
    }
  }
}

module.exports = new FileController();
