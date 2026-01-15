const FileModel = require('../models/file');
const S3Service = require('../services/S3Service');
const AuditLogger = require('../services/AuditLogger');
const logger = require('../utils/logger');
const asyncHandler = require('../middleware/asyncHandler');

class FilesController {
  /**
   * Upload file
   * POST /api/v1/files/upload
   */
  static uploadFile = asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    const { episodeId } = req.body;
    const { originalName, mimeType, size, buffer, extension } = req.fileValidation;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
        code: 'UNAUTHORIZED',
      });
    }

    // If episodeId provided, verify user has access
    if (episodeId) {
      const Episode = require('../models/episode');
      const episode = await Episode.getById(episodeId);

      if (!episode) {
        return res.status(404).json({
          success: false,
          message: 'Episode not found',
          code: 'EPISODE_NOT_FOUND',
        });
      }

      // Check if user is admin or episode owner
      const isAdmin = req.user?.role === 'admin';
      const isOwner = episode.created_by === userId;

      if (!isAdmin && !isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
          code: 'ACCESS_DENIED',
        });
      }
    }

    // Upload to S3
    const uploadResult = await S3Service.uploadFile(
      process.env.S3_BUCKET_NAME || 'brd-episodes-dev',
      `users/${userId}/uploads/${Date.now()}-${Math.random().toString(36).substring(7)}${extension}`,
      buffer,
      {
        ContentType: mimeType,
        Metadata: {
          'original-filename': Buffer.from(originalName).toString('base64'),
          'uploaded-by': userId,
          'uploaded-at': new Date().toISOString(),
        },
      }
    );

    // Create file record
    const fileRecord = await FileModel.create({
      episodeId: episodeId || null,
      userId,
      fileName: originalName,
      fileType: extension.substring(1),
      fileSize: size,
      s3Key: uploadResult.key,
      s3Url: uploadResult.location,
      status: 'uploaded',
    });

    // Audit log
    await AuditLogger.log({
      action: 'FILE_UPLOAD',
      userId,
      resourceId: fileRecord.id,
      resourceType: 'File',
      details: {
        fileName: originalName,
        fileSize: size,
        episodeId,
      },
      status: 'success',
    });

    logger.info('File uploaded successfully', {
      fileId: fileRecord.id,
      fileName: originalName,
      userId,
    });

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      code: 'FILE_UPLOADED',
      data: fileRecord,
    });
  });

  /**
   * Download file
   * GET /api/v1/files/:id/download
   */
  static downloadFile = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id;

    const file = await FileModel.getById(id);
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
        code: 'FILE_NOT_FOUND',
      });
    }

    // Check access - user can download their own files or admin can download any
    const isAdmin = req.user?.role === 'admin';
    if (!isAdmin && file.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
        code: 'ACCESS_DENIED',
      });
    }

    // Generate signed URL
    const signedUrl = await S3Service.getSignedDownloadUrl(file.s3Key);

    // Audit log
    await AuditLogger.log({
      action: 'FILE_DOWNLOAD',
      userId,
      resourceId: file.id,
      resourceType: 'File',
      details: { fileName: file.fileName },
      status: 'success',
    });

    res.json({
      success: true,
      message: 'Download URL generated',
      code: 'DOWNLOAD_URL_GENERATED',
      data: {
        fileId: file.id,
        fileName: file.fileName,
        downloadUrl: signedUrl,
        expiresIn: 3600, // 1 hour
      },
    });
  });

  /**
   * Delete file
   * DELETE /api/v1/files/:id
   */
  static deleteFile = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id;

    const file = await FileModel.getById(id);
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
        code: 'FILE_NOT_FOUND',
      });
    }

    // Check access
    const isAdmin = req.user?.role === 'admin';
    if (!isAdmin && file.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
        code: 'ACCESS_DENIED',
      });
    }

    // Delete from S3
    await S3Service.deleteFile(file.s3Key);

    // Soft delete from database
    await FileModel.delete(id);

    // Audit log
    await AuditLogger.log({
      action: 'FILE_DELETE',
      userId,
      resourceId: file.id,
      resourceType: 'File',
      details: { fileName: file.fileName },
      status: 'success',
    });

    logger.info('File deleted successfully', {
      fileId: id,
      fileName: file.fileName,
    });

    res.json({
      success: true,
      message: 'File deleted successfully',
      code: 'FILE_DELETED',
    });
  });

  /**
   * List user files
   * GET /api/v1/files
   */
  static listFiles = asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    const { episodeId, limit = 20, offset = 0 } = req.query;

    const files = await FileModel.getByUserId(userId, {
      episodeId,
      limit: Math.min(parseInt(limit), 100),
      offset: Math.max(0, parseInt(offset)),
    });

    const count = await FileModel.countByUserId(userId);

    res.json({
      success: true,
      message: 'Files retrieved',
      code: 'FILES_RETRIEVED',
      data: files,
      pagination: {
        count,
        limit: Math.min(parseInt(limit), 100),
        offset: parseInt(offset),
      },
    });
  });

  /**
   * Get file metadata
   * GET /api/v1/files/:id
   */
  static getFile = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id;

    const file = await FileModel.getById(id);
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
        code: 'FILE_NOT_FOUND',
      });
    }

    // Check access
    const isAdmin = req.user?.role === 'admin';
    if (!isAdmin && file.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
        code: 'ACCESS_DENIED',
      });
    }

    res.json({
      success: true,
      message: 'File metadata retrieved',
      code: 'FILE_RETRIEVED',
      data: file,
    });
  });

  /**
   * Get episode files
   * GET /api/v1/episodes/:episodeId/files
   */
  static getEpisodeFiles = asyncHandler(async (req, res) => {
    const { episodeId } = req.params;

    const files = await FileModel.getByEpisodeId(episodeId);

    res.json({
      success: true,
      message: 'Episode files retrieved',
      code: 'EPISODE_FILES_RETRIEVED',
      data: files,
    });
  });
}

module.exports = FilesController;
