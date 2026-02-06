/**
 * Video Composition Controller → Scene Template Controller
 * 
 * MENTAL MODEL SHIFT:
 * This controller manages Scene Templates, NOT video compositions.
 * 
 * A Scene Template defines:
 * - Spatial layout (canvas size, format)
 * - Element roles (background, hero, lower-third)
 * - Element transforms (x, y, scale, rotation, width, height)
 * - Z-index, locked, hidden states
 * 
 * A Scene Template does NOT define:
 * - Timeline/duration
 * - Clip trimming
 * - Playback metadata
 * - Video export settings
 * 
 * Think: "Layout blueprint" not "video editor"
 */

const { getPool } = require('../config/database');

const videoCompositionController = {
  /**
   * GET /api/v1/episodes/:episodeId/video-compositions
   * List all video compositions for an episode
   */
  async list(req, res) {
    const pool = getPool();
    
    try {
      // Try to create table if it doesn't exist (safe for development)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS video_compositions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'complete', 'error')),
          scenes JSONB DEFAULT '[]'::jsonb,
          assets JSONB DEFAULT '[]'::jsonb,
          settings JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
      
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_video_compositions_episode_id ON video_compositions(episode_id);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_video_compositions_status ON video_compositions(status);`);
      
      const { episodeId } = req.params;

      const result = await pool.query(
        `SELECT * FROM video_compositions WHERE episode_id = $1 ORDER BY created_at DESC`,
        [episodeId]
      );

      res.json({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      console.error('Error fetching video compositions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch video compositions',
        message: error.message,
      });
    }
  },

  /**
   * GET /api/v1/episodes/:episodeId/video-compositions/:id
   * Get a single video composition
   */
  async get(req, res) {
    const pool = getPool();
    
    try {
      const { episodeId, id } = req.params;

      const result = await pool.query(
        `SELECT * FROM video_compositions WHERE id = $1 AND episode_id = $2`,
        [id, episodeId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Video composition not found',
        });
      }

      res.json({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error('Error fetching video composition:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch video composition',
        message: error.message,
      });
    }
  },

  /**
   * POST /api/v1/episodes/:episodeId/video-compositions
   * Create a new scene template
   */
  async create(req, res) {
    const pool = getPool();
    
    try {
      const { episodeId } = req.params;
      const { name, format, canvasSize, elements = [], settings = {} } = req.body;

      // Validate required fields for Scene Template
      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Template name is required',
        });
      }

      if (!elements || !Array.isArray(elements)) {
        return res.status(400).json({
          success: false,
          error: 'elements array is required',
        });
      }

      // Enforce Scene Template structure
      const templateData = {
        episode_id: episodeId,
        name: name.trim(),
        scenes: JSON.stringify([]), // Empty for now, templates don't have timeline
        assets: JSON.stringify([]), // Empty for now, elements contain asset references
        settings: JSON.stringify({
          ...settings,
          schemaVersion: 1,
          format: format || '16:9',
          canvasSize: canvasSize || { width: 1920, height: 1080 },
          elements: elements, // THIS is the scene template data
          version: 1 // Template version for iteration
        }),
        status: 'draft'
      };

      const result = await pool.query(
        `INSERT INTO video_compositions (episode_id, name, scenes, assets, settings, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [templateData.episode_id, templateData.name, templateData.scenes, 
         templateData.assets, templateData.settings, templateData.status]
      );

      res.status(201).json({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error('Error creating video composition:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create video composition',
        message: error.message,
      });
    }
  },

  /**
   * PUT /api/v1/episodes/:episodeId/video-compositions/:id
   * Update a scene template (increments version)
   */
  async update(req, res) {
    const pool = getPool();
    
    try {
      const { episodeId, id } = req.params;
      const { name, elements, format, canvasSize, settings } = req.body;

      // Get current template to increment version
      const current = await pool.query(
        `SELECT settings FROM video_compositions WHERE id = $1 AND episode_id = $2`,
        [id, episodeId]
      );

      if (current.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Scene template not found',
        });
      }

      const currentSettings = current.rows[0].settings || {};
      const currentVersion = currentSettings.version || 1;

      // Build updated settings with incremented version
      const updatedSettings = {
        ...currentSettings,
        ...settings,
        schemaVersion: 1,
        version: currentVersion + 1, // Increment on every save
      };

      // Update elements if provided
      if (elements !== undefined) {
        updatedSettings.elements = elements;
      }
      if (format !== undefined) {
        updatedSettings.format = format;
      }
      if (canvasSize !== undefined) {
        updatedSettings.canvasSize = canvasSize;
      }

      const updateFields = [];
      const values = [];
      let paramIndex = 1;

      if (name !== undefined) {
        updateFields.push(`name = $${paramIndex++}`);
        values.push(name.trim());
      }

      // Always update settings (includes version bump)
      updateFields.push(`settings = $${paramIndex++}`);
      values.push(JSON.stringify(updatedSettings));

      updateFields.push(`updated_at = NOW()`);
      values.push(id, episodeId);

      const result = await pool.query(
        `UPDATE video_compositions 
         SET ${updateFields.join(', ')}
         WHERE id = $${paramIndex++} AND episode_id = $${paramIndex}
         RETURNING *`,
        values
      );

      res.json({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error('Error updating scene template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update scene template',
        message: error.message,
      });
    }
  },

  /**
   * POST /api/v1/episodes/:episodeId/video-compositions/:id/duplicate
   * Duplicate a scene template (for iteration)
   */
  async duplicate(req, res) {
    const pool = getPool();
    
    try {
      const { episodeId, id } = req.params;

      // Get original template
      const original = await pool.query(
        `SELECT * FROM video_compositions WHERE id = $1 AND episode_id = $2`,
        [id, episodeId]
      );

      if (original.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Scene template not found',
        });
      }

      const template = original.rows[0];
      const settings = template.settings || {};

      // Create duplicate with new name
      const duplicateName = `${template.name} (Copy)`;
      const duplicateSettings = {
        ...settings,
        version: 1 // Reset version for new template
      };

      const result = await pool.query(
        `INSERT INTO video_compositions (episode_id, name, scenes, assets, settings, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          episodeId,
          duplicateName,
          template.scenes,
          template.assets,
          JSON.stringify(duplicateSettings),
          'draft'
        ]
      );

      res.status(201).json({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error('Error duplicating scene template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to duplicate scene template',
        message: error.message,
      });
    }
  },

  /**
   * DELETE /api/v1/episodes/:episodeId/video-compositions/:id
   * Delete a video composition
   */
  async remove(req, res) {
    const pool = getPool();
    
    try {
      const { episodeId, id } = req.params;

      const result = await pool.query(
        `DELETE FROM video_compositions WHERE id = $1 AND episode_id = $2 RETURNING id`,
        [id, episodeId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Video composition not found',
        });
      }

      res.json({
        success: true,
        message: 'Video composition deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting video composition:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete video composition',
        message: error.message,
      });
    }
  },
};

module.exports = videoCompositionController;
