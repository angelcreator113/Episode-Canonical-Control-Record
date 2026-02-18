'use strict';

const express = require('express');
const router = express.Router();
const db = require('../models');
const { ScriptMetadata } = db;
const claudeService = require('../services/claudeService');
const { Pool } = require('pg');

// Create pool for raw SQL queries (scripts use raw SQL, not Sequelize)
const sslConfig = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: sslConfig })
  : new Pool({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'episode_metadata',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: sslConfig,
    });

/**
 * POST /api/scripts/:scriptId/analyze
 * Run AI analysis on a script
 */
router.post('/:scriptId/analyze', async (req, res) => {
  try {
    const { scriptId } = req.params;
    const { targetDuration, pacing } = req.body;

    // Get script
    const scriptResult = await pool.query(
      'SELECT * FROM episode_scripts WHERE id = $1',
      [scriptId]
    );
    
    if (scriptResult.rows.length === 0) {
      return res.status(404).json({ error: 'Script not found' });
    }

    const script = scriptResult.rows[0];

    // Check if AI analysis is enabled
    if (!script.ai_analysis_enabled) {
      return res.status(400).json({ 
        error: 'AI analysis is not enabled for this script' 
      });
    }

    // Check if Claude API is configured
    if (!claudeService.isConfigured()) {
      return res.status(503).json({ 
        error: 'Claude API is not configured. Please add ANTHROPIC_API_KEY to environment.' 
      });
    }

    // Run analysis with target duration and pacing
    const analysis = await claudeService.analyzeScript(script.content, {
      targetDuration: targetDuration || 180,
      pacing: pacing || 'medium'
    });

    // Delete existing metadata for this script
    await ScriptMetadata.destroy({
      where: { script_id: scriptId },
    });

    // Save scene metadata
    const metadataRecords = await Promise.all(
      analysis.scenes.map((scene) =>
        ScriptMetadata.create({
          script_id: scriptId,
          scene_id: scene.scene_id,
          scene_type: scene.scene_type,
          duration_target_seconds: scene.duration_target_seconds,
          energy_level: scene.energy_level,
          estimated_clips_needed: scene.estimated_clips_needed,
          visual_requirements: {
            requirements: scene.visual_requirements,
            suggestions: analysis.suggestions,
            warnings: analysis.warnings,
          },
        })
      )
    );

    // Update script with analysis timestamp
    await pool.query(
      'UPDATE episode_scripts SET last_analyzed_at = NOW() WHERE id = $1',
      [scriptId]
    );

    res.json({
      success: true,
      analysis: {
        scenes: metadataRecords,
        total_duration: analysis.totalDuration,
        overall_pacing: analysis.overallPacing,
        confidence_score: analysis.confidenceScore,
        suggestions: analysis.suggestions,
        warnings: analysis.warnings,
      },
    });

  } catch (error) {
    console.error('Script analysis error:', error);
    res.status(500).json({ 
      error: 'Analysis failed', 
      message: error.message 
    });
  }
});

/**
 * GET /api/scripts/:scriptId/metadata
 * Get analysis results for a script
 */
router.get('/:scriptId/metadata', async (req, res) => {
  try {
    const { scriptId } = req.params;

    const metadata = await ScriptMetadata.findAll({
      where: { script_id: scriptId },
      order: [['created_at', 'ASC']],
    });

    res.json({
      success: true,
      metadata,
      count: metadata.length,
    });

  } catch (error) {
    console.error('Get metadata error:', error);
    res.status(500).json({ error: 'Failed to get metadata' });
  }
});

/**
 * PUT /api/scripts/:scriptId/ai-analysis
 * Enable/disable AI analysis for a script
 */
router.put('/:scriptId/ai-analysis', async (req, res) => {
  try {
    console.log('🔵 Toggle AI analysis request:', { scriptId: req.params.scriptId, body: req.body });
    const { scriptId } = req.params;
    const { enabled } = req.body;

    const scriptResult = await pool.query(
      'SELECT * FROM episode_scripts WHERE id = $1',
      [scriptId]
    );
    
    if (scriptResult.rows.length === 0) {
      console.log('❌ Script not found:', scriptId);
      return res.status(404).json({ error: 'Script not found' });
    }

    console.log('📝 Updating script:', { scriptId, enabled, currentValue: scriptResult.rows[0].ai_analysis_enabled });
    
    await pool.query(
      'UPDATE episode_scripts SET ai_analysis_enabled = $1 WHERE id = $2',
      [enabled, scriptId]
    );

    console.log('✅ Script updated successfully');
    res.json({
      success: true,
      ai_analysis_enabled: enabled,
    });

  } catch (error) {
    console.error('Update AI analysis setting error:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

module.exports = router;
