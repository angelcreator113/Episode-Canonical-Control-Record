/**
 * Production Package Controller
 * Generates complete production packages
 */

const { pool } = require('../db');
const productionPackageService = require('../services/productionPackageService');

/**
 * Generate complete production package
 */
exports.generateProductionPackage = async (req, res) => {
  const { episodeId } = req.params;
  
  try {
    console.log(`[ProductionPackageController] Generating production package for episode ${episodeId}`);
    
    const startTime = Date.now();
    
    // Generate complete package
    const result = await productionPackageService.generatePackage(episodeId, {
      userId: req.user?.sub,
    });
    
    const duration = Date.now() - startTime;
    
    res.json({
      success: true,
      data: result.package,
      meta: {
        package_version: result.package.package_version,
        zip_url: result.package.zip_file_s3_url,
        file_count: result.fileCount,
        generation_time_ms: duration,
      },
    });
    
  } catch (error) {
    console.error('[ProductionPackageController] Error generating package:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to generate production package',
        details: error.message,
      },
    });
  }
};

/**
 * Get latest production package
 */
exports.getLatestPackage = async (req, res) => {
  const { episodeId } = req.params;
  
  try {
    const result = await pool.query(
      `SELECT * FROM production_packages
       WHERE episode_id = $1 AND is_latest = true
       ORDER BY created_at DESC
       LIMIT 1`,
      [episodeId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'No production package found for this episode' },
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
    });
    
  } catch (error) {
    console.error('[ProductionPackageController] Error getting latest package:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get latest package',
        details: error.message,
      },
    });
  }
};

/**
 * List all production package versions
 */
exports.listPackageVersions = async (req, res) => {
  const { episodeId } = req.params;
  
  try {
    const result = await pool.query(
      `SELECT id, package_version, is_latest, zip_file_s3_url, zip_file_size_bytes, created_at
       FROM production_packages
       WHERE episode_id = $1
       ORDER BY created_at DESC`,
      [episodeId]
    );
    
    res.json({
      success: true,
      data: result.rows,
      meta: {
        count: result.rows.length,
        episode_id: episodeId,
      },
    });
    
  } catch (error) {
    console.error('[ProductionPackageController] Error listing package versions:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to list package versions',
        details: error.message,
      },
    });
  }
};

/**
 * Get specific production package
 */
exports.getPackage = async (req, res) => {
  const { episodeId, packageId } = req.params;
  
  try {
    const result = await pool.query(
      'SELECT * FROM production_packages WHERE id = $1 AND episode_id = $2',
      [packageId, episodeId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Production package not found' },
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
    });
    
  } catch (error) {
    console.error('[ProductionPackageController] Error getting package:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get production package',
        details: error.message,
      },
    });
  }
};

/**
 * Download production package ZIP
 */
exports.downloadPackage = async (req, res) => {
  const { episodeId, packageId } = req.params;
  
  try {
    const result = await pool.query(
      'SELECT zip_file_s3_url, package_version FROM production_packages WHERE id = $1 AND episode_id = $2',
      [packageId, episodeId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Production package not found' },
      });
    }
    
    const { zip_file_s3_url, package_version } = result.rows[0];
    
    if (!zip_file_s3_url) {
      return res.status(404).json({
        success: false,
        error: { message: 'ZIP file not available' },
      });
    }
    
    // Redirect to S3 pre-signed URL
    res.redirect(zip_file_s3_url);
    
  } catch (error) {
    console.error('[ProductionPackageController] Error downloading package:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to download production package',
        details: error.message,
      },
    });
  }
};

/**
 * Delete production package
 */
exports.deletePackage = async (req, res) => {
  const { episodeId, packageId } = req.params;
  
  try {
    const result = await pool.query(
      'DELETE FROM production_packages WHERE id = $1 AND episode_id = $2 RETURNING id',
      [packageId, episodeId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Production package not found' },
      });
    }
    
    // TODO: Delete S3 ZIP file
    
    res.json({
      success: true,
      data: { id: result.rows[0].id, deleted: true },
    });
    
  } catch (error) {
    console.error('[ProductionPackageController] Error deleting package:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete production package',
        details: error.message,
      },
    });
  }
};
