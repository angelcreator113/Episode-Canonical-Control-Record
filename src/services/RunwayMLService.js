/**
 * Runway ML Service
 * Handles AI-powered background removal and image enhancement
 */
/* eslint-disable no-unused-vars */

const axios = require('axios');
const FormData = require('form-data');

class RunwayMLService {
  constructor() {
    this.apiKey = process.env.RUNWAY_ML_API_KEY;
    this.baseUrl = 'https://api.runwayml.com/v1';
    this.timeout = 30000; // 30 second timeout
    this.maxRetries = 3;
  }

  /**
   * Check if Runway ML is configured
   */
  isConfigured() {
    return !!this.apiKey;
  }

  /**
   * Remove background from image using Runway ML
   * @param {Buffer} imageBuffer - Image buffer
   * @param {Object} options - Optional configuration
   * @returns {Promise<Buffer>} - Processed image with transparent background (PNG)
   */
  async removeBackground(imageBuffer, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('Runway ML API key not configured. Set RUNWAY_ML_API_KEY in .env');
    }

    try {
      console.log('🎨 Starting Runway ML background removal...');

      const formData = new FormData();
      formData.append('image', imageBuffer, 'image.jpg');

      const response = await axios.post(
        `${this.baseUrl}/remove-background`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            ...formData.getHeaders(),
          },
          responseType: 'arraybuffer',
          timeout: this.timeout,
        }
      );

      console.log('✅ Background removal complete');
      return Buffer.from(response.data);
    } catch (error) {
      console.error('❌ Runway ML background removal failed:', error.message);
      throw new Error(`Background removal failed: ${error.message}`);
    }
  }

  /**
   * Enhance image quality using Runway ML
   * @param {Buffer} imageBuffer - Image buffer
   * @returns {Promise<Buffer>} - Enhanced image
   */
  async enhanceImage(imageBuffer) {
    if (!this.isConfigured()) {
      throw new Error('Runway ML API key not configured. Set RUNWAY_ML_API_KEY in .env');
    }

    try {
      console.log('🎨 Starting image enhancement...');

      const formData = new FormData();
      formData.append('image', imageBuffer, 'image.jpg');

      const response = await axios.post(
        `${this.baseUrl}/enhance`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            ...formData.getHeaders(),
          },
          responseType: 'arraybuffer',
          timeout: this.timeout,
        }
      );

      console.log('✅ Image enhancement complete');
      return Buffer.from(response.data);
    } catch (error) {
      console.error('❌ Runway ML enhancement failed:', error.message);
      throw new Error(`Image enhancement failed: ${error.message}`);
    }
  }

  /**
   * Process promotional asset: remove background
   * @param {Buffer} imageBuffer - Raw image
   * @returns {Promise<Buffer>} - Processed PNG with transparent background
   */
  async processPromotionalAsset(imageBuffer) {
    // Step 1: Remove background
    const noBg = await this.removeBackground(imageBuffer);

    // Step 2: Enhance (optional - can skip if too slow)
    // const enhanced = await this.enhanceImage(noBg);

    return noBg; // Return processed image with transparent background
  }

  /**
   * Process with fallback (returns raw if Runway ML fails)
   * @param {Buffer} imageBuffer - Raw image
   * @returns {Promise<Buffer>} - Processed or raw image
   */
  async processWithFallback(imageBuffer) {
    if (!this.isConfigured()) {
      console.warn('⚠️  Runway ML not configured, using raw image');
      return imageBuffer;
    }

    try {
      return await this.processPromotionalAsset(imageBuffer);
    } catch (error) {
      console.warn('⚠️  Runway ML processing failed, using raw image:', error.message);
      return imageBuffer; // Fallback to raw image
    }
  }
}

module.exports = new RunwayMLService();
