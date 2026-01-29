/**
 * Image Processing Routes
 * Handles background removal and image enhancement for assets
 *
 * Endpoints:
 * - POST /api/v1/assets/:id/remove-background
 * - POST /api/v1/assets/:id/enhance
 * - GET  /api/v1/assets/:id/processing-status
 * - POST /api/v1/assets/:id/reset-processing
 */

const express = require('express');
const router = express.Router();
const FormData = require('form-data');
const fetch = require('node-fetch');
const { models } = require('../models');
const { uploadToS3 } = require('../services/s3Service');

/**
 * POST /api/v1/assets/:id/remove-background
 * Remove background from an asset image using Remove.bg API
 *
 * @returns {Object} { status, message, data: { asset_id, url, original_url, cached? } }
 */
router.post('/:id/remove-background', async (req, res) => {
  try {
    const { id } = req.params;

    // TODO: Add authentication check
    // if (!req.user) return res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });

    const asset = await models.Asset.findByPk(id);

    if (!asset) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Asset not found',
      });
    }

    // Check if already processed (return cached version)
    if (asset.s3_url_no_bg) {
      console.log('✅ Background already removed, returning cached version');
      return res.json({
        status: 'SUCCESS',
        message: 'Background already removed',
        data: {
          asset_id: asset.id,
          url: asset.s3_url_no_bg,
          original_url: asset.s3_url_raw || asset.s3_url,
          cached: true,
        },
      });
    }

    // TODO: Add rate limiting check
    // const usage = await checkMonthlyUsage('bg_removal');
    // if (usage >= process.env.MONTHLY_REMOVEBG_LIMIT) {
    //   return res.status(429).json({ status: 'ERROR', message: 'Monthly quota exceeded' });
    // }

    console.log('🎨 Starting background removal for asset:', id);

    // Update status to processing
    await asset.update({
      processing_status: 'processing_bg_removal',
    });

    // Validate API key exists
    if (!process.env.REMOVE_BG_API_KEY) {
      throw new Error('REMOVE_BG_API_KEY not configured');
    }

    // Call Remove.bg API
    const formData = new FormData();
    const sourceUrl = asset.s3_url_raw || asset.s3_url;
    formData.append('image_url', sourceUrl);
    formData.append('size', 'auto');

    console.log('📤 Calling Remove.bg API with URL:', sourceUrl.substring(0, 60));

    const removeBgResponse = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: {
        'X-Api-Key': process.env.REMOVE_BG_API_KEY,
      },
      body: formData,
    });

    if (!removeBgResponse.ok) {
      const error = await removeBgResponse.text();
      console.error('❌ Remove.bg API error:', error);
      throw new Error(`Remove.bg API error: ${error}`);
    }

    // Get processed image buffer
    const imageBuffer = await removeBgResponse.buffer();
    console.log('✅ Received processed image, size:', imageBuffer.length, 'bytes');

    // Upload to S3
    const s3Key = `processed/${asset.id}/no-bg-${Date.now()}.png`;
    console.log('📤 Uploading to S3:', s3Key);
    const s3Url = await uploadToS3(imageBuffer, s3Key, 'image/png');
    console.log('✅ Uploaded to S3:', s3Url);

    // Update asset with processed URL
    await asset.update({
      s3_url_no_bg: s3Url,
      processing_status: 'bg_removed',
      processing_metadata: {
        ...asset.processing_metadata,
        background_removal: {
          provider: 'remove.bg',
          timestamp: new Date().toISOString(),
          status: 'completed',
          original_url: sourceUrl,
        },
      },
    });

    console.log('✅ Background removal complete for asset:', id);

    res.json({
      status: 'SUCCESS',
      message: 'Background removed successfully',
      data: {
        asset_id: asset.id,
        url: s3Url,
        original_url: sourceUrl,
      },
    });
  } catch (error) {
    console.error('❌ Background removal error:', error);

    // Update status to failed
    if (req.params.id) {
      try {
        await models.Asset.update(
          {
            processing_status: 'failed',
            processing_metadata: {
              error: error.message,
              timestamp: new Date().toISOString(),
            },
          },
          { where: { id: req.params.id } }
        );
      } catch (updateErr) {
        console.error('Failed to update error status:', updateErr);
      }
    }

    res.status(500).json({
      status: 'ERROR',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/assets/:id/enhance
 * Enhance image with skin smoothing, color correction, etc. using Cloudinary
 *
 * @body {Object} settings - Enhancement settings (skin_smooth, saturation, vibrance, contrast, sharpen)
 * @returns {Object} { status, message, data: { asset_id, url, original_url, settings, cached? } }
 */
router.post('/:id/enhance', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      skin_smooth = 50,
      saturation = 20,
      vibrance = 20,
      contrast = 10,
      sharpen = 20,
    } = req.body;

    // TODO: Add authentication check
    // if (!req.user) return res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });

    const asset = await models.Asset.findByPk(id);

    if (!asset) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Asset not found',
      });
    }

    // Check if already enhanced with same settings (return cached version)
    const existingSettings = asset.processing_metadata?.enhancement?.settings;
    if (
      asset.s3_url_enhanced &&
      existingSettings &&
      existingSettings.skin_smooth === skin_smooth &&
      existingSettings.saturation === saturation &&
      existingSettings.vibrance === vibrance &&
      existingSettings.contrast === contrast &&
      existingSettings.sharpen === sharpen
    ) {
      console.log('✅ Image already enhanced with same settings, returning cached version');
      return res.json({
        status: 'SUCCESS',
        message: 'Image already enhanced',
        data: {
          asset_id: asset.id,
          url: asset.s3_url_enhanced,
          cached: true,
          settings: existingSettings,
        },
      });
    }

    console.log('✨ Starting image enhancement for asset:', id);

    // Update status
    await asset.update({
      processing_status: 'processing_enhancement',
    });

    // Validate Cloudinary credentials
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      throw new Error('Cloudinary credentials not configured');
    }

    // Use background-removed version if available, otherwise original
    const sourceUrl = asset.s3_url_no_bg || asset.s3_url_raw || asset.s3_url;
    console.log('📤 Enhancing from source:', sourceUrl.substring(0, 60));

    // Build Cloudinary transformation string
    const transformations = [
      `e_improve`,
      `e_skin_smooth:${skin_smooth}`,
      `e_saturation:${saturation}`,
      `e_vibrance:${vibrance}`,
      `e_contrast:${contrast}`,
      `e_sharpen:${sharpen}`,
      `q_auto:best`,
    ].join(',');

    console.log('🎨 Applying transformations:', transformations);

    // Upload to Cloudinary with transformations
    const cloudinary = require('cloudinary').v2;
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const uploadResult = await cloudinary.uploader.upload(sourceUrl, {
      folder: `enhanced/${asset.id}`,
      transformation: transformations,
      format: 'jpg',
      quality: 'auto:best',
    });

    const enhancedUrl = uploadResult.secure_url;
    console.log('✅ Enhanced image uploaded to Cloudinary:', enhancedUrl.substring(0, 60));

    // Update asset
    await asset.update({
      s3_url_enhanced: enhancedUrl,
      processing_status: 'enhanced',
      processing_metadata: {
        ...asset.processing_metadata,
        enhancement: {
          provider: 'cloudinary',
          settings: {
            skin_smooth,
            saturation,
            vibrance,
            contrast,
            sharpen,
          },
          timestamp: new Date().toISOString(),
          status: 'completed',
          cloudinary_public_id: uploadResult.public_id,
          source_url: sourceUrl,
        },
      },
    });

    console.log('✅ Enhancement complete for asset:', id);

    res.json({
      status: 'SUCCESS',
      message: 'Image enhanced successfully',
      data: {
        asset_id: asset.id,
        url: enhancedUrl,
        original_url: sourceUrl,
        settings: {
          skin_smooth,
          saturation,
          vibrance,
          contrast,
          sharpen,
        },
      },
    });
  } catch (error) {
    console.error('❌ Enhancement error:', error);

    if (req.params.id) {
      try {
        await models.Asset.update(
          {
            processing_status: 'failed',
            processing_metadata: {
              error: error.message,
              timestamp: new Date().toISOString(),
            },
          },
          { where: { id: req.params.id } }
        );
      } catch (updateErr) {
        console.error('Failed to update error status:', updateErr);
      }
    }

    res.status(500).json({
      status: 'ERROR',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/assets/:id/processing-status
 * Get current processing status of an asset
 *
 * @returns {Object} { status, data: { asset_id, processing_status, has_bg_removed, has_enhanced, metadata } }
 */
router.get('/:id/processing-status', async (req, res) => {
  try {
    const { id } = req.params;

    const asset = await models.Asset.findByPk(id, {
      attributes: [
        'id',
        'processing_status',
        'processing_metadata',
        's3_url_no_bg',
        's3_url_enhanced',
      ],
    });

    if (!asset) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Asset not found',
      });
    }

    res.json({
      status: 'SUCCESS',
      data: {
        asset_id: asset.id,
        processing_status: asset.processing_status,
        has_bg_removed: !!asset.s3_url_no_bg,
        has_enhanced: !!asset.s3_url_enhanced,
        metadata: asset.processing_metadata,
      },
    });
  } catch (error) {
    console.error('❌ Status check error:', error);
    res.status(500).json({
      status: 'ERROR',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/assets/:id/reset-processing
 * Reset processed versions (for re-processing)
 *
 * @body {string} reset_type - 'all', 'bg_removal', or 'enhancement'
 * @returns {Object} { status, message, data: { asset_id } }
 */
router.post('/:id/reset-processing', async (req, res) => {
  try {
    const { id } = req.params;
    const { reset_type = 'all' } = req.body;

    // TODO: Add authentication check
    // if (!req.user) return res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });

    const asset = await models.Asset.findByPk(id);

    if (!asset) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Asset not found',
      });
    }

    console.log('🔄 Resetting processing for asset:', id, 'type:', reset_type);

    const updates = {};

    if (reset_type === 'all' || reset_type === 'bg_removal') {
      updates.s3_url_no_bg = null;
    }

    if (reset_type === 'all' || reset_type === 'enhancement') {
      updates.s3_url_enhanced = null;
    }

    updates.processing_status = 'none';

    if (reset_type === 'all') {
      updates.processing_metadata = {};
    } else {
      // Preserve other metadata
      const metadata = { ...asset.processing_metadata };
      if (reset_type === 'bg_removal') {
        delete metadata.background_removal;
      } else if (reset_type === 'enhancement') {
        delete metadata.enhancement;
      }
      updates.processing_metadata = metadata;
    }

    await asset.update(updates);

    console.log('✅ Processing reset complete');

    res.json({
      status: 'SUCCESS',
      message: 'Processing reset successfully',
      data: { asset_id: asset.id },
    });
  } catch (error) {
    console.error('❌ Reset error:', error);
    res.status(500).json({
      status: 'ERROR',
      message: error.message,
    });
  }
});

module.exports = router;
