/**
 * PostProcessingService Unit Tests
 * Tests the three-stage post-processing pipeline with mocked dependencies
 */

// Mock sharp before require
const mockSharpInstance = {
  metadata: jest.fn(),
  resize: jest.fn().mockReturnThis(),
  sharpen: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  toBuffer: jest.fn(),
};

const mockSharp = jest.fn(() => mockSharpInstance);
mockSharp.kernel = { lanczos3: 'lanczos3' };

jest.mock('sharp', () => mockSharp);

// Mock axios
jest.mock('axios', () => ({
  get: jest.fn(),
}));

// Mock fluent-ffmpeg
const mockFfmpegInstance = {
  videoFilters: jest.fn().mockReturnThis(),
  outputOptions: jest.fn().mockReturnThis(),
  output: jest.fn().mockReturnThis(),
  on: jest.fn().mockReturnThis(),
  run: jest.fn(),
};

const mockFfmpeg = jest.fn(() => mockFfmpegInstance);
mockFfmpeg.setFfmpegPath = jest.fn();
mockFfmpeg.setFfprobePath = jest.fn();

jest.mock('fluent-ffmpeg', () => mockFfmpeg);

// Mock fs.promises
jest.mock('fs', () => ({
  promises: {
    mkdtemp: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn(),
    stat: jest.fn(),
    unlink: jest.fn().mockResolvedValue(),
    rmdir: jest.fn().mockResolvedValue(),
  },
}));

// Mock @aws-sdk/client-s3
const mockS3Send = jest.fn().mockResolvedValue({});
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: mockS3Send })),
  PutObjectCommand: jest.fn((params) => params),
}));

// Mock cloudinary
jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload: jest.fn(),
    },
  },
}));

const axios = require('axios');
const fs = require('fs').promises;
const cloudinary = require('cloudinary').v2;

const {
  sharpEnhanceStill,
  cloudinaryEnhanceStill,
  ffmpegEnhanceVideo,
  processAngleAssets,
} = require('../../../src/services/postProcessingService');

describe('PostProcessingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── sharpEnhanceStill ────────────────────────────────────────────────────

  describe('sharpEnhanceStill', () => {
    const imageUrl = 'https://example.com/image.jpg';
    const fakeInputBuffer = Buffer.from('fake-image-data');
    const fakeOutputBuffer = Buffer.alloc(2048, 0xff);

    beforeEach(() => {
      axios.get.mockResolvedValue({ data: fakeInputBuffer });

      // First call: metadata on input
      // Second call: sharp pipeline
      // Third call: metadata on output
      mockSharp.mockImplementation(() => ({ ...mockSharpInstance }));

      mockSharpInstance.metadata
        .mockResolvedValueOnce({ width: 800, height: 600, format: 'png' })  // input meta
        .mockResolvedValueOnce({ width: 1920, height: 1080, format: 'jpeg' }); // output meta

      mockSharpInstance.toBuffer.mockResolvedValue(fakeOutputBuffer);
    });

    it('should download the image via axios with arraybuffer responseType', async () => {
      await sharpEnhanceStill(imageUrl);

      expect(axios.get).toHaveBeenCalledWith(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 60000,
      });
    });

    it('should upscale when input is smaller than target dimensions', async () => {
      await sharpEnhanceStill(imageUrl);

      expect(mockSharpInstance.resize).toHaveBeenCalledWith(1920, 1080, {
        fit: 'inside',
        withoutEnlargement: false,
        kernel: 'lanczos3',
      });
    });

    it('should not upscale when input meets target dimensions', async () => {
      mockSharpInstance.metadata
        .mockReset()
        .mockResolvedValueOnce({ width: 2000, height: 1200, format: 'jpeg' })
        .mockResolvedValueOnce({ width: 2000, height: 1200, format: 'jpeg' });

      const result = await sharpEnhanceStill(imageUrl);

      expect(mockSharpInstance.resize).not.toHaveBeenCalled();
      expect(result.metadata.upscaled).toBe(false);
    });

    it('should apply sharpening with default parameters', async () => {
      await sharpEnhanceStill(imageUrl);

      expect(mockSharpInstance.sharpen).toHaveBeenCalledWith({
        sigma: 1.2,
        flat: 1.0,
        jagged: 0.8,
      });
    });

    it('should use custom options when provided', async () => {
      const options = {
        targetWidth: 3840,
        targetHeight: 2160,
        sharpenSigma: 2.0,
        sharpenFlat: 1.5,
        sharpenJagged: 1.0,
        jpegQuality: 90,
      };

      await sharpEnhanceStill(imageUrl, options);

      expect(mockSharpInstance.resize).toHaveBeenCalledWith(3840, 2160, expect.any(Object));
      expect(mockSharpInstance.sharpen).toHaveBeenCalledWith({
        sigma: 2.0,
        flat: 1.5,
        jagged: 1.0,
      });
      expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({
        quality: 90,
        progressive: true,
        mozjpeg: true,
      });
    });

    it('should output JPEG with progressive and mozjpeg options', async () => {
      await sharpEnhanceStill(imageUrl);

      expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({
        quality: 95,
        progressive: true,
        mozjpeg: true,
      });
    });

    it('should return buffer and metadata', async () => {
      const result = await sharpEnhanceStill(imageUrl);

      expect(result).toEqual({
        buffer: fakeOutputBuffer,
        metadata: {
          width: 1920,
          height: 1080,
          format: 'jpeg',
          size: fakeOutputBuffer.length,
          upscaled: true,
        },
      });
    });

    it('should propagate axios errors', async () => {
      const networkError = new Error('Network Error');
      axios.get.mockRejectedValue(networkError);

      await expect(sharpEnhanceStill(imageUrl)).rejects.toThrow('Network Error');
    });

    it('should propagate sharp processing errors', async () => {
      mockSharpInstance.toBuffer.mockRejectedValue(new Error('Sharp processing failed'));

      await expect(sharpEnhanceStill(imageUrl)).rejects.toThrow('Sharp processing failed');
    });
  });

  // ─── cloudinaryEnhanceStill ───────────────────────────────────────────────

  describe('cloudinaryEnhanceStill', () => {
    const imageUrl = 'https://example.com/image.jpg';

    it('should skip when CLOUDINARY_CLOUD_NAME is not set', async () => {
      delete process.env.CLOUDINARY_CLOUD_NAME;
      delete process.env.CLOUDINARY_API_KEY;
      delete process.env.CLOUDINARY_API_SECRET;

      const result = await cloudinaryEnhanceStill(imageUrl);

      expect(result).toEqual({
        enhancedUrl: imageUrl,
        publicId: null,
        skipped: true,
      });
      expect(cloudinary.uploader.upload).not.toHaveBeenCalled();
    });

    it('should skip when CLOUDINARY_API_KEY is not set', async () => {
      process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
      delete process.env.CLOUDINARY_API_KEY;
      delete process.env.CLOUDINARY_API_SECRET;

      const result = await cloudinaryEnhanceStill(imageUrl);

      expect(result.skipped).toBe(true);

      delete process.env.CLOUDINARY_CLOUD_NAME;
    });

    it('should skip when CLOUDINARY_API_SECRET is not set', async () => {
      process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
      process.env.CLOUDINARY_API_KEY = 'test-key';
      delete process.env.CLOUDINARY_API_SECRET;

      const result = await cloudinaryEnhanceStill(imageUrl);

      expect(result.skipped).toBe(true);

      delete process.env.CLOUDINARY_CLOUD_NAME;
      delete process.env.CLOUDINARY_API_KEY;
    });

    it('should call cloudinary uploader when credentials are set', async () => {
      process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
      process.env.CLOUDINARY_API_KEY = 'test-key';
      process.env.CLOUDINARY_API_SECRET = 'test-secret';

      cloudinary.uploader.upload.mockResolvedValue({
        secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/enhanced.jpg',
        public_id: 'scene-enhanced/test-id',
      });

      const result = await cloudinaryEnhanceStill(imageUrl);

      expect(cloudinary.config).toHaveBeenCalledWith({
        cloud_name: 'test-cloud',
        api_key: 'test-key',
        api_secret: 'test-secret',
      });
      expect(cloudinary.uploader.upload).toHaveBeenCalledWith(imageUrl, expect.objectContaining({
        folder: 'scene-enhanced',
        format: 'jpg',
        quality: 'auto:best',
      }));
      expect(result.skipped).toBe(false);
      expect(result.enhancedUrl).toBe('https://res.cloudinary.com/test-cloud/image/upload/enhanced.jpg');
      expect(result.publicId).toBe('scene-enhanced/test-id');

      delete process.env.CLOUDINARY_CLOUD_NAME;
      delete process.env.CLOUDINARY_API_KEY;
      delete process.env.CLOUDINARY_API_SECRET;
    });

    it('should propagate cloudinary upload errors', async () => {
      process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
      process.env.CLOUDINARY_API_KEY = 'test-key';
      process.env.CLOUDINARY_API_SECRET = 'test-secret';

      cloudinary.uploader.upload.mockRejectedValue(new Error('Upload failed'));

      await expect(cloudinaryEnhanceStill(imageUrl)).rejects.toThrow('Upload failed');

      delete process.env.CLOUDINARY_CLOUD_NAME;
      delete process.env.CLOUDINARY_API_KEY;
      delete process.env.CLOUDINARY_API_SECRET;
    });
  });

  // ─── ffmpegEnhanceVideo ───────────────────────────────────────────────────

  describe('ffmpegEnhanceVideo', () => {
    const videoUrl = 'https://example.com/video.mp4';
    const fakeVideoBuffer = Buffer.from('fake-video-data');
    const fakeOutputBuffer = Buffer.alloc(4096, 0xaa);

    beforeEach(() => {
      axios.get.mockResolvedValue({ data: fakeVideoBuffer });
      fs.mkdtemp.mockResolvedValue('/tmp/scene-postproc-abc123');
      fs.writeFile.mockResolvedValue();
      fs.readFile.mockResolvedValue(fakeOutputBuffer);
      fs.stat.mockResolvedValue({ size: 4096 });
      fs.unlink.mockResolvedValue();
      fs.rmdir.mockResolvedValue();

      // FFmpeg resolves on 'end' event
      mockFfmpegInstance.on.mockImplementation(function (event, cb) {
        if (event === 'end') {
          // Store end callback to be called by run
          this._endCb = cb;
        }
        return this;
      });

      mockFfmpegInstance.run.mockImplementation(function () {
        // Trigger end callback
        if (mockFfmpegInstance._endCb) {
          mockFfmpegInstance._endCb();
        }
      });
    });

    it('should download the video and write to temp file', async () => {
      await ffmpegEnhanceVideo(videoUrl);

      expect(axios.get).toHaveBeenCalledWith(videoUrl, {
        responseType: 'arraybuffer',
        timeout: 120000,
      });
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/tmp/scene-postproc-abc123/input.mp4',
        expect.any(Buffer)
      );
    });

    it('should apply color grade, sharpen, and vignette filters by default', async () => {
      await ffmpegEnhanceVideo(videoUrl);

      expect(mockFfmpegInstance.videoFilters).toHaveBeenCalled();
      const filterChain = mockFfmpegInstance.videoFilters.mock.calls[0][0];
      expect(filterChain).toContain('eq=brightness=');
      expect(filterChain).toContain('unsharp=');
      expect(filterChain).toContain('vignette=');
    });

    it('should skip filters when disabled', async () => {
      await ffmpegEnhanceVideo(videoUrl, {
        colorGrade: false,
        sharpen: false,
        vignette: false,
      });

      expect(mockFfmpegInstance.videoFilters).toHaveBeenCalledWith('');
    });

    it('should return buffer and metadata with filter flags', async () => {
      const result = await ffmpegEnhanceVideo(videoUrl);

      expect(result.buffer).toEqual(fakeOutputBuffer);
      expect(result.metadata).toEqual({
        size: 4096,
        filters: { colorGrade: true, sharpen: true, vignette: true },
      });
    });

    it('should clean up temp files in finally block', async () => {
      await ffmpegEnhanceVideo(videoUrl);

      expect(fs.unlink).toHaveBeenCalledTimes(2);
      expect(fs.rmdir).toHaveBeenCalledWith('/tmp/scene-postproc-abc123');
    });

    it('should clean up temp files even on error', async () => {
      mockFfmpegInstance.on.mockImplementation(function (event, cb) {
        if (event === 'error') {
          this._errorCb = cb;
        }
        return this;
      });
      mockFfmpegInstance.run.mockImplementation(function () {
        if (mockFfmpegInstance._errorCb) {
          mockFfmpegInstance._errorCb(new Error('FFmpeg crashed'));
        }
      });

      await expect(ffmpegEnhanceVideo(videoUrl)).rejects.toThrow('FFmpeg crashed');

      expect(fs.unlink).toHaveBeenCalled();
      expect(fs.rmdir).toHaveBeenCalled();
    });

    it('should propagate download errors', async () => {
      axios.get.mockRejectedValue(new Error('Download failed'));

      await expect(ffmpegEnhanceVideo(videoUrl)).rejects.toThrow('Download failed');
    });
  });

  // ─── processAngleAssets ───────────────────────────────────────────────────

  describe('processAngleAssets', () => {
    let mockSceneAngle;
    let mockSceneSet;
    let mockModels;

    beforeEach(() => {
      mockSceneAngle = {
        id: 'angle-123',
        angle_name: 'wide-shot',
        still_image_url: 'https://example.com/still.jpg',
        video_clip_url: 'https://example.com/video.mp4',
      };

      mockSceneSet = { id: 'set-456' };

      mockModels = {
        SceneAngle: {
          update: jest.fn().mockResolvedValue([1]),
        },
      };

      // Mock the sharp pipeline for processAngleAssets calls
      const fakeBuffer = Buffer.alloc(1024, 0xbb);
      axios.get.mockResolvedValue({ data: fakeBuffer });

      mockSharpInstance.metadata
        .mockResolvedValue({ width: 800, height: 600, format: 'png' });
      mockSharpInstance.toBuffer.mockResolvedValue(fakeBuffer);

      // Mock ffmpeg success
      mockFfmpegInstance.on.mockImplementation(function (event, cb) {
        if (event === 'end') this._endCb = cb;
        return this;
      });
      mockFfmpegInstance.run.mockImplementation(function () {
        if (mockFfmpegInstance._endCb) mockFfmpegInstance._endCb();
      });

      // Mock fs for ffmpeg
      fs.mkdtemp.mockResolvedValue('/tmp/scene-postproc-test');
      fs.writeFile.mockResolvedValue();
      fs.readFile.mockResolvedValue(fakeBuffer);
      fs.stat.mockResolvedValue({ size: 1024 });
      fs.unlink.mockResolvedValue();
      fs.rmdir.mockResolvedValue();

      // Mock S3 send
      mockS3Send.mockResolvedValue({});
    });

    it('should set post_processing_status to processing at start', async () => {
      await processAngleAssets(mockSceneAngle, mockSceneSet, mockModels, {
        skipSharp: true,
        skipCloudinary: true,
        skipFFmpeg: true,
      });

      expect(mockModels.SceneAngle.update).toHaveBeenCalledWith(
        { post_processing_status: 'processing' },
        { where: { id: 'angle-123' } }
      );
    });

    it('should set post_processing_status to complete on success', async () => {
      await processAngleAssets(mockSceneAngle, mockSceneSet, mockModels, {
        skipSharp: true,
        skipCloudinary: true,
        skipFFmpeg: true,
      });

      const updateCalls = mockModels.SceneAngle.update.mock.calls;
      const lastCall = updateCalls[updateCalls.length - 1];
      expect(lastCall[0].post_processing_status).toBe('complete');
    });

    it('should skip sharp stage when skipSharp is true', async () => {
      await processAngleAssets(mockSceneAngle, mockSceneSet, mockModels, {
        skipSharp: true,
        skipCloudinary: true,
        skipFFmpeg: true,
      });

      // axios.get should not be called for image download
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('should skip cloudinary stage when skipCloudinary is true', async () => {
      await processAngleAssets(mockSceneAngle, mockSceneSet, mockModels, {
        skipSharp: true,
        skipCloudinary: true,
        skipFFmpeg: true,
      });

      expect(cloudinary.uploader.upload).not.toHaveBeenCalled();
    });

    it('should skip ffmpeg stage when skipFFmpeg is true', async () => {
      await processAngleAssets(mockSceneAngle, mockSceneSet, mockModels, {
        skipSharp: true,
        skipCloudinary: true,
        skipFFmpeg: true,
      });

      expect(mockFfmpeg).not.toHaveBeenCalled();
    });

    it('should skip sharp when still_image_url is null', async () => {
      mockSceneAngle.still_image_url = null;

      await processAngleAssets(mockSceneAngle, mockSceneSet, mockModels, {
        skipCloudinary: true,
        skipFFmpeg: true,
      });

      // Sharp should not process since there is no still image
      expect(mockS3Send).not.toHaveBeenCalled();
    });

    it('should skip ffmpeg when video_clip_url is null', async () => {
      mockSceneAngle.video_clip_url = null;

      await processAngleAssets(mockSceneAngle, mockSceneSet, mockModels, {
        skipSharp: true,
        skipCloudinary: true,
      });

      expect(mockFfmpeg).not.toHaveBeenCalled();
    });

    it('should run sharp and store result in S3 when not skipped', async () => {
      await processAngleAssets(mockSceneAngle, mockSceneSet, mockModels, {
        skipCloudinary: true,
        skipFFmpeg: true,
      });

      // Should have downloaded the still image
      expect(axios.get).toHaveBeenCalledWith(
        'https://example.com/still.jpg',
        expect.objectContaining({ responseType: 'arraybuffer' })
      );

      // Should have stored the enhanced still in S3
      expect(mockS3Send).toHaveBeenCalled();
    });

    it('should update model with enhanced URLs on completion', async () => {
      await processAngleAssets(mockSceneAngle, mockSceneSet, mockModels, {
        skipSharp: true,
        skipCloudinary: true,
        skipFFmpeg: true,
      });

      const updateCalls = mockModels.SceneAngle.update.mock.calls;
      const finalUpdate = updateCalls[updateCalls.length - 1];

      expect(finalUpdate[0]).toEqual(expect.objectContaining({
        enhanced_still_url: expect.any(String),
        enhanced_video_url: expect.any(String),
        post_processing_status: 'complete',
      }));
      expect(finalUpdate[1]).toEqual({ where: { id: 'angle-123' } });
    });

    it('should return enhanced URLs', async () => {
      const result = await processAngleAssets(mockSceneAngle, mockSceneSet, mockModels, {
        skipSharp: true,
        skipCloudinary: true,
        skipFFmpeg: true,
      });

      expect(result).toHaveProperty('enhancedStillUrl');
      expect(result).toHaveProperty('enhancedVideoUrl');
    });

    it('should set post_processing_status to failed on error', async () => {
      mockModels.SceneAngle.update
        .mockResolvedValueOnce([1])  // processing status
        .mockRejectedValueOnce(new Error('DB error'));  // completion update fails

      // Need a stage to run so we get past the try
      await expect(
        processAngleAssets(mockSceneAngle, mockSceneSet, mockModels, {
          skipSharp: true,
          skipCloudinary: true,
          skipFFmpeg: true,
        })
      ).rejects.toThrow('DB error');

      const updateCalls = mockModels.SceneAngle.update.mock.calls;
      // The third call should set status to 'failed'
      expect(updateCalls[2][0]).toEqual({ post_processing_status: 'failed' });
    });

    it('should re-throw errors from pipeline stages', async () => {
      axios.get.mockRejectedValue(new Error('Network timeout'));

      await expect(
        processAngleAssets(mockSceneAngle, mockSceneSet, mockModels, {
          skipCloudinary: true,
          skipFFmpeg: true,
        })
      ).rejects.toThrow('Network timeout');
    });

    it('should pass sharpOptions through to sharpEnhanceStill', async () => {
      const sharpOptions = { targetWidth: 3840, targetHeight: 2160 };

      await processAngleAssets(mockSceneAngle, mockSceneSet, mockModels, {
        skipCloudinary: true,
        skipFFmpeg: true,
        sharpOptions,
      });

      // The sharp resize should use the custom dimensions
      expect(mockSharpInstance.resize).toHaveBeenCalledWith(
        3840, 2160,
        expect.any(Object)
      );
    });
  });
});
