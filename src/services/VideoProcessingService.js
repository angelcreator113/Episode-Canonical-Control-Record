/**
 * VideoProcessingService
 * Handles video processing operations using ffmpeg:
 * - Extract video duration
 * - Extract video metadata
 * - Generate video thumbnails
 */
const { promisify } = require('util');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

const execAsync = promisify(exec);

class VideoProcessingService {
  constructor() {
    // Use project-local ffmpeg if available, fallback to system ffmpeg
    this.ffmpegPath = path.join(__dirname, '..', '..', 'bin', 'ffmpeg.exe');
    this.ffprobePath = path.join(__dirname, '..', '..', 'bin', 'ffprobe.exe');
  }

  /**
   * Get ffmpeg command
   * @returns {string} Full path to ffmpeg or 'ffmpeg' for system install
   */
  getFfmpegCommand() {
    return this.ffmpegPath;
  }

  /**
   * Extract video metadata using ffprobe
   * @param {string|Buffer} input - File path or buffer
   * @returns {Promise<object>} Video metadata
   */
  async extractMetadata(input) {
    try {
      let inputPath = input;
      let tempFile = null;

      // If input is a buffer, write to temp file
      if (Buffer.isBuffer(input)) {
        tempFile = path.join(require('os').tmpdir(), `temp_video_${Date.now()}.mp4`);
        await fs.writeFile(tempFile, input);
        inputPath = tempFile;
      }

      // Use ffprobe to extract metadata (fallback to ffmpeg if ffprobe not available)
      const ffprobeCmd = `"${this.ffmpegPath}" -i "${inputPath}" -f null - 2>&1`;
      
      try {
        const { stdout, stderr } = await execAsync(ffprobeCmd);
        // ffmpeg outputs to stderr, but we redirect with 2>&1
        const output = stdout || stderr;
        
        // Parse duration from output
        const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
        const videoMatch = output.match(/Stream.*Video:.*?(\d{3,5})x(\d{3,5})/);
        const bitRateMatch = output.match(/bitrate: (\d+) kb\/s/);
        
        let duration = 0;
        if (durationMatch) {
          const hours = parseInt(durationMatch[1]);
          const minutes = parseInt(durationMatch[2]);
          const seconds = parseFloat(durationMatch[3]);
          duration = hours * 3600 + minutes * 60 + seconds;
        }

        let width = null;
        let height = null;
        if (videoMatch) {
          width = parseInt(videoMatch[1]);
          height = parseInt(videoMatch[2]);
        }

        let bitRate = null;
        if (bitRateMatch) {
          bitRate = parseInt(bitRateMatch[1]) * 1000; // Convert to bits/sec
        }

        // Get file size
        const stats = await fs.stat(inputPath);
        
        // Clean up temp file
        if (tempFile) {
          await fs.unlink(tempFile).catch(() => {});
        }

        return {
          duration,
          size: stats.size,
          bitRate,
          format: 'video',
          video: width && height ? {
            codec: 'unknown',
            width,
            height,
            frameRate: 30, // Default assumption
            bitRate,
          } : null,
          audio: null,
        };
      } catch (error) {
        logger.error('ffmpeg metadata extraction failed', { error: error.message });
        // Clean up temp file
        if (tempFile) {
          await fs.unlink(tempFile).catch(() => {});
        }
        throw error;
      }
    } catch (error) {
      logger.error('Failed to extract video metadata', { error: error.message });
      throw new Error(`Video metadata extraction failed: ${error.message}`);
    }
  }

  /**
   * Generate thumbnail from video
   * @param {string|Buffer} input - File path or buffer
   * @param {object} options - Thumbnail options
   * @param {number} options.timestamp - Timestamp in seconds (default: 1)
   * @param {number} options.width - Thumbnail width (default: 320)
   * @param {number} options.height - Thumbnail height (optional, maintains aspect ratio)
   * @returns {Promise<Buffer>} Thumbnail image buffer (JPEG)
   */
  async generateThumbnail(input, options = {}) {
    try {
      const { timestamp = 1, width = 320, height = null } = options;

      let inputPath = input;
      let tempFile = null;
      const outputPath = path.join(require('os').tmpdir(), `thumb_${Date.now()}.jpg`);

      // If input is a buffer, write to temp file
      if (Buffer.isBuffer(input)) {
        tempFile = path.join(require('os').tmpdir(), `temp_video_${Date.now()}.mp4`);
        await fs.writeFile(tempFile, input);
        inputPath = tempFile;
      }

      // Build ffmpeg command for thumbnail generation
      const scaleFilter = height ? `scale=${width}:${height}` : `scale=${width}:-1`;
      const ffmpegCmd = `"${this.ffmpegPath}" -ss ${timestamp} -i "${inputPath}" -vframes 1 -vf "${scaleFilter}" "${outputPath}" -y`;

      await execAsync(ffmpegCmd);

      // Read thumbnail file
      const thumbnailBuffer = await fs.readFile(outputPath);

      // Clean up temp files
      await fs.unlink(outputPath).catch(() => {});
      if (tempFile) {
        await fs.unlink(tempFile).catch(() => {});
      }

      logger.info('Thumbnail generated successfully', {
        timestamp,
        width,
        height,
        size: thumbnailBuffer.length,
      });

      return thumbnailBuffer;
    } catch (error) {
      logger.error('Failed to generate thumbnail', { error: error.message });
      throw new Error(`Thumbnail generation failed: ${error.message}`);
    }
  }

  /**
   * Get video duration (quick method)
   * @param {string|Buffer} input - File path or buffer
   * @returns {Promise<number>} Duration in seconds
   */
  async getDuration(input) {
    try {
      const metadata = await this.extractMetadata(input);
      return metadata.duration;
    } catch (error) {
      logger.error('Failed to get video duration', { error: error.message });
      throw new Error(`Duration extraction failed: ${error.message}`);
    }
  }

  /**
   * Validate video file
   * @param {string|Buffer} input - File path or buffer
   * @returns {Promise<boolean>} True if valid video
   */
  async isValidVideo(input) {
    try {
      await this.extractMetadata(input);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate multiple thumbnails at different timestamps
   * @param {string|Buffer} input - File path or buffer
   * @param {number} count - Number of thumbnails to generate
   * @param {object} options - Thumbnail options
   * @returns {Promise<Array<Buffer>>} Array of thumbnail buffers
   */
  async generateMultipleThumbnails(input, count = 3, options = {}) {
    try {
      // Get video duration first
      const metadata = await this.extractMetadata(input);
      const duration = metadata.duration;

      // Calculate evenly spaced timestamps
      const timestamps = [];
      for (let i = 0; i < count; i++) {
        const timestamp = (duration / (count + 1)) * (i + 1);
        timestamps.push(timestamp);
      }

      // Generate thumbnails in parallel
      const thumbnails = await Promise.all(
        timestamps.map(timestamp =>
          this.generateThumbnail(input, { ...options, timestamp })
        )
      );

      logger.info('Multiple thumbnails generated', {
        count: thumbnails.length,
        duration,
      });

      return thumbnails;
    } catch (error) {
      logger.error('Failed to generate multiple thumbnails', {
        error: error.message,
      });
      throw new Error(`Multiple thumbnail generation failed: ${error.message}`);
    }
  }
}

module.exports = new VideoProcessingService();
