/**
 * S3Service
 * Handles all S3 file operations (upload, download, delete, metadata)
 */
const AWS = require('aws-sdk');
const logger = require('../utils/logger');

class S3Service {
  constructor() {
    this.s3 = new AWS.S3({
      region: process.env.AWS_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });
  }

  /**
   * Upload file to S3
   * @param {string} bucket - S3 bucket name
   * @param {string} key - S3 object key
   * @param {Buffer|Stream} body - File content
   * @param {object} options - Additional S3 options
   * @returns {Promise<object>} S3 upload response
   */
  async uploadFile(bucket, key, body, options = {}) {
    try {
      const params = {
        Bucket: bucket,
        Key: key,
        Body: body,
        ...options,
      };

      const result = await this.s3.upload(params).promise();
      logger.info('File uploaded to S3', {
        bucket,
        key,
        etag: result.ETag,
        location: result.Location,
      });

      return {
        etag: result.ETag,
        versionId: result.VersionId,
        location: result.Location,
        key: result.Key,
      };
    } catch (error) {
      logger.error('S3 upload failed', { bucket, key, error: error.message });
      throw error;
    }
  }

  /**
   * Generate pre-signed URL for file download
   * @param {string} bucket - S3 bucket name
   * @param {string} key - S3 object key
   * @param {number} expiresIn - URL expiration time in seconds (default 3600)
   * @returns {Promise<string>} Pre-signed URL
   */
  async getPreSignedUrl(bucket, key, expiresIn = 3600, extraParams = {}) {
    try {
      const params = {
        Bucket: bucket,
        Key: key,
        Expires: expiresIn,
        ...extraParams,
      };

      // AWS SDK v2: getSignedUrl is synchronous, wrap in Promise
      const url = this.s3.getSignedUrl('getObject', params);
      logger.debug('Pre-signed URL generated', { bucket, key, expiresIn });
      return url;
    } catch (error) {
      logger.error('Failed to generate pre-signed URL', {
        bucket,
        key,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete file from S3
   * @param {string} bucket - S3 bucket name
   * @param {string} key - S3 object key
   * @returns {Promise<void>}
   */
  async deleteFile(bucket, key) {
    try {
      await this.s3.deleteObject({ Bucket: bucket, Key: key }).promise();
      logger.info('File deleted from S3', { bucket, key });
    } catch (error) {
      logger.error('S3 delete failed', { bucket, key, error: error.message });
      throw error;
    }
  }

  /**
   * Download file from S3 to local temp directory
   * @param {string} s3Key - S3 object key
   * @param {string} bucketName - S3 bucket name (optional)
   * @returns {Promise<string>} Local file path
   */
  async downloadFromS3(s3Key, bucketName = null) {
    const fs = require('fs');
    const path = require('path');
    const { pipeline } = require('stream/promises');

    try {
      const bucket = bucketName || process.env.S3_TRAINING_BUCKET || 'episode-metadata-training';
      
      console.log(`📥 Downloading from S3: ${bucket}/${s3Key}`);

      const params = {
        Bucket: bucket,
        Key: s3Key
      };

      const response = await this.s3.getObject(params).promise();
      
      // Create temp directory if it doesn't exist
      const tempDir = '/tmp';
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Extract filename from S3 key
      const filename = path.basename(s3Key);
      const localPath = path.join(tempDir, filename);

      // Write to local file
      fs.writeFileSync(localPath, response.Body);

      const stats = fs.statSync(localPath);
      console.log(`✅ Downloaded: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      
      logger.info('File downloaded from S3', {
        bucket,
        key: s3Key,
        localPath,
        size: stats.size
      });

      return localPath;

    } catch (error) {
      logger.error('S3 download failed', { s3Key, error: error.message });
      throw new Error(`Failed to download from S3: ${error.message}`);
    }
  }

  /**
   * Get file metadata from S3
   * @param {string} bucket - S3 bucket name
   * @param {string} key - S3 object key
   * @returns {Promise<object>} File metadata
   */
  async getFileMetadata(bucket, key) {
    try {
      const response = await this.s3.headObject({ Bucket: bucket, Key: key }).promise();

      return {
        size: response.ContentLength,
        contentType: response.ContentType,
        lastModified: response.LastModified,
        etag: response.ETag,
        metadata: response.Metadata,
      };
    } catch (error) {
      logger.error('Failed to get file metadata', {
        bucket,
        key,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * List files in S3 bucket with prefix
   * @param {string} bucket - S3 bucket name
   * @param {string} prefix - S3 object key prefix
   * @param {number} maxKeys - Maximum number of keys to return (default 1000)
   * @returns {Promise<array>} Array of file objects
   */
  async listFiles(bucket, prefix = '', maxKeys = 1000) {
    try {
      const response = await this.s3
        .listObjectsV2({
          Bucket: bucket,
          Prefix: prefix,
          MaxKeys: maxKeys,
        })
        .promise();

      const files = (response.Contents || []).map((item) => ({
        key: item.Key,
        size: item.Size,
        lastModified: item.LastModified,
        etag: item.ETag,
      }));

      logger.debug('S3 files listed', { bucket, prefix, count: files.length });
      return files;
    } catch (error) {
      logger.error('Failed to list S3 files', {
        bucket,
        prefix,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Copy file within S3
   * @param {string} sourceBucket - Source bucket name
   * @param {string} sourceKey - Source object key
   * @param {string} destBucket - Destination bucket name
   * @param {string} destKey - Destination object key
   * @returns {Promise<object>} Copy result
   */
  async copyFile(sourceBucket, sourceKey, destBucket, destKey) {
    try {
      const result = await this.s3
        .copyObject({
          CopySource: `${sourceBucket}/${sourceKey}`,
          Bucket: destBucket,
          Key: destKey,
        })
        .promise();

      logger.info('File copied in S3', {
        source: `${sourceBucket}/${sourceKey}`,
        destination: `${destBucket}/${destKey}`,
      });

      return result;
    } catch (error) {
      logger.error('S3 copy failed', {
        source: `${sourceBucket}/${sourceKey}`,
        destination: `${destBucket}/${destKey}`,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get file stream from S3
   * @param {string} bucket - S3 bucket name
   * @param {string} key - S3 object key
   * @returns {Promise<Stream>} Readable stream
   */
  getFileStream(bucket, key) {
    try {
      const stream = this.s3.getObject({ Bucket: bucket, Key: key }).createReadStream();
      logger.debug('S3 stream created', { bucket, key });
      return stream;
    } catch (error) {
      logger.error('Failed to create S3 stream', { bucket, key, error: error.message });
      throw error;
    }
  }

  /**
   * Get file as buffer from S3
   * @param {string} bucket - S3 bucket name
   * @param {string} key - S3 object key
   * @returns {Promise<Buffer>} File buffer
   */
  async getFileAsBuffer(bucket, key) {
    try {
      const response = await this.s3.getObject({ Bucket: bucket, Key: key }).promise();
      logger.debug('S3 file retrieved as buffer', { bucket, key, size: response.Body.length });
      return response.Body;
    } catch (error) {
      logger.error('Failed to get S3 file as buffer', { bucket, key, error: error.message });
      throw error;
    }
  }
}

module.exports = new S3Service();
