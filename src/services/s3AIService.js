'use strict';

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

/**
 * S3 AI Service
 * Handles uploads/downloads for AI video editing features
 */
class S3AIService {
  constructor() {
    this.s3Client = new S3Client({ 
      region: process.env.AWS_REGION || 'us-east-1' 
    });
    
    this.buckets = {
      rawFootage: process.env.S3_RAW_FOOTAGE_BUCKET,
      processedVideos: process.env.S3_PROCESSED_VIDEOS_BUCKET,
      trainingData: process.env.S3_TRAINING_DATA_BUCKET,
    };
  }

  /**
   * Upload raw footage clip
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} filename - Original filename
   * @param {string} episodeId - Episode UUID
   * @param {string} sceneId - Scene identifier
   * @returns {Promise<{s3Key: string, bucket: string}>}
   */
  async uploadRawFootage(fileBuffer, filename, episodeId, sceneId) {
    const s3Key = `episodes/${episodeId}/scenes/${sceneId}/raw/${filename}`;
    
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.buckets.rawFootage,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: this._getContentType(filename),
    }));
    
    return { s3Key, bucket: this.buckets.rawFootage };
  }

  /**
   * Upload processed video
   * @param {Buffer} videoBuffer - Rendered video buffer
   * @param {string} episodeId - Episode UUID
   * @param {string} jobId - Processing job UUID
   * @returns {Promise<{s3Key: string, bucket: string, presignedUrl: string}>}
   */
  async uploadProcessedVideo(videoBuffer, episodeId, jobId) {
    const s3Key = `episodes/${episodeId}/final/${jobId}.mp4`;
    
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.buckets.processedVideos,
      Key: s3Key,
      Body: videoBuffer,
      ContentType: 'video/mp4',
    }));
    
    // Generate presigned URL (valid for 7 days)
    const presignedUrl = await this.getPresignedUrl(
      this.buckets.processedVideos, 
      s3Key, 
      604800 // 7 days
    );
    
    return { s3Key, bucket: this.buckets.processedVideos, presignedUrl };
  }

  /**
   * Upload YouTube training video
   * @param {Buffer} videoBuffer - Downloaded video buffer
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<{s3Key: string, bucket: string}>}
   */
  async uploadTrainingVideo(videoBuffer, videoId) {
    const s3Key = `youtube/${videoId}.mp4`;
    
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.buckets.trainingData,
      Key: s3Key,
      Body: videoBuffer,
      ContentType: 'video/mp4',
    }));
    
    return { s3Key, bucket: this.buckets.trainingData };
  }

  /**
   * Get presigned URL for temporary access
   * @param {string} bucket - Bucket name
   * @param {string} key - S3 key
   * @param {number} expiresIn - Expiry in seconds (default 1 hour)
   * @returns {Promise<string>}
   */
  async getPresignedUrl(bucket, key, expiresIn = 3600) {
    return await getSignedUrl(
      this.s3Client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn }
    );
  }

  /**
   * Download file from S3
   * @param {string} bucket - Bucket name
   * @param {string} key - S3 key
   * @returns {Promise<Buffer>}
   */
  async downloadFile(bucket, key) {
    const response = await this.s3Client.send(new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }));
    
    return Buffer.from(await response.Body.transformToByteArray());
  }

  /**
   * Delete file from S3
   * @param {string} bucket - Bucket name
   * @param {string} key - S3 key
   */
  async deleteFile(bucket, key) {
    await this.s3Client.send(new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }));
  }

  /**
   * Get content type from filename
   * @private
   */
  _getContentType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const types = {
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      avi: 'video/x-msvideo',
      webm: 'video/webm',
    };
    return types[ext] || 'application/octet-stream';
  }
}

module.exports = new S3AIService();
