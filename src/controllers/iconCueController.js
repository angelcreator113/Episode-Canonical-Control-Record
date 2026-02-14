/**
 * Icon Cue Controller
 * Handles icon timeline cue operations
 */

const { pool } = require('../db');
const iconCueGeneratorService = require('../services/iconCueGeneratorService');

/**
 * Generate icon cues from episode script/scenes
 */
exports.generateIconCues = async (req, res) => {
  const { episodeId } = req.params;
  const { regenerate = false } = req.body;
  
  try {
    console.log(`[IconCueController] Generating icon cues for episode ${episodeId}`);
    
    // Generate icon cues using AI service
    const result = await iconCueGeneratorService.generateFromEpisode(episodeId, {
      regenerate,
      userId: req.user?.sub,
    });
    
    res.json({
      success: true,
      data: result.iconCues,
      meta: {
        count: result.iconCues.length,
        approved: result.iconCues.filter(c => c.status === 'approved').length,
        suggested: result.iconCues.filter(c => c.status === 'suggested').length,
        generation_method: result.method,
        generation_time_ms: result.duration_ms,
      },
    });
    
  } catch (error) {
    console.error('[IconCueController] Error generating icon cues:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to generate icon cues',
        details: error.message,
      },
    });
  }
};

/**
 * Regenerate icon cues (keeps approved, regenerates suggested)
 */
exports.regenerateIconCues = async (req, res) => {
  req.body.regenerate = true;
  return exports.generateIconCues(req, res);
};

/**
 * List all icon cues for episode
 */
exports.listIconCues = async (req, res) => {
  const { episodeId } = req.params;
  const { status, slot_id, sort = 'timestamp' } = req.query;
  
  try {
    let query = 'SELECT * FROM icon_cues WHERE episode_id = $1';
    const params = [episodeId];
    let paramIndex = 2;
    
    // Filter by status
    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    // Filter by slot
    if (slot_id) {
      query += ` AND slot_id = $${paramIndex}`;
      params.push(slot_id);
      paramIndex++;
    }
    
    // Sort
    const validSorts = ['timestamp', 'created_at', 'status'];
    const sortField = validSorts.includes(sort) ? sort : 'timestamp';
    query += ` ORDER BY ${sortField} ASC`;
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      data: result.rows,
      meta: {
        count: result.rows.length,
        episode_id: episodeId,
      },
    });
    
  } catch (error) {
    console.error('[IconCueController] Error listing icon cues:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to list icon cues',
        details: error.message,
      },
    });
  }
};

/**
 * Get single icon cue
 */
exports.getIconCue = async (req, res) => {
  const { episodeId, cueId } = req.params;
  
  try {
    const result = await pool.query(
      'SELECT * FROM icon_cues WHERE id = $1 AND episode_id = $2',
      [cueId, episodeId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Icon cue not found' },
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
    });
    
  } catch (error) {
    console.error('[IconCueController] Error getting icon cue:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get icon cue',
        details: error.message,
      },
    });
  }
};

/**
 * Create icon cue manually
 */
exports.createIconCue = async (req, res) => {
  const { episodeId } = req.params;
  const {
    asset_id,
    timestamp,
    duration_ms,
    slot_id,
    action,
    transition,
    easing = 'ease-out',
    icon_state,
    position_data,
    metadata,
    notes,
    is_anchor = false,
    anchor_name,
  } = req.body;
  
  try {
    // Validate required fields
    if (!timestamp || !slot_id || !action) {
      return res.status(400).json({
        success: false,
        error: { message: 'Missing required fields: timestamp, slot_id, action' },
      });
    }
    
    const result = await pool.query(
      `INSERT INTO icon_cues (
        episode_id, asset_id, timestamp, duration_ms, slot_id,
        action, transition, easing, icon_state, position_data,
        metadata, notes, is_anchor, anchor_name, status, generated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        episodeId, asset_id, timestamp, duration_ms, slot_id,
        action, transition, easing, icon_state, position_data ? JSON.stringify(position_data) : null,
        metadata ? JSON.stringify(metadata) : null, notes, is_anchor, anchor_name,
        'approved', // Manually created cues are auto-approved
        'manual',
      ]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
    
  } catch (error) {
    console.error('[IconCueController] Error creating icon cue:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to create icon cue',
        details: error.message,
      },
    });
  }
};

/**
 * Update icon cue
 */
exports.updateIconCue = async (req, res) => {
  const { episodeId, cueId } = req.params;
  const updates = req.body;
  
  try {
    // Build dynamic update query
    const allowedFields = [
      'asset_id', 'timestamp', 'duration_ms', 'slot_id', 'action',
      'transition', 'easing', 'icon_state', 'position_data', 'metadata',
      'notes', 'is_anchor', 'anchor_name',
    ];
    
    const setClause = [];
    const params = [];
    let paramIndex = 1;
    
    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        setClause.push(`${key} = $${paramIndex}`);
        
        // Handle JSON fields
        if (['position_data', 'metadata'].includes(key)) {
          params.push(JSON.stringify(updates[key]));
        } else {
          params.push(updates[key]);
        }
        paramIndex++;
      }
    });
    
    if (setClause.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'No valid fields to update' },
      });
    }
    
    // Add updated_at
    setClause.push(`updated_at = NOW()`);
    
    // Add episode_id and cue_id to params
    params.push(cueId, episodeId);
    
    const query = `
      UPDATE icon_cues
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex} AND episode_id = $${paramIndex + 1}
      RETURNING *
    `;
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Icon cue not found' },
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
    });
    
  } catch (error) {
    console.error('[IconCueController] Error updating icon cue:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update icon cue',
        details: error.message,
      },
    });
  }
};

/**
 * Delete icon cue
 */
exports.deleteIconCue = async (req, res) => {
  const { episodeId, cueId } = req.params;
  
  try {
    const result = await pool.query(
      'DELETE FROM icon_cues WHERE id = $1 AND episode_id = $2 RETURNING id',
      [cueId, episodeId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Icon cue not found' },
      });
    }
    
    res.json({
      success: true,
      data: { id: result.rows[0].id, deleted: true },
    });
    
  } catch (error) {
    console.error('[IconCueController] Error deleting icon cue:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete icon cue',
        details: error.message,
      },
    });
  }
};

/**
 * Approve icon cue
 */
exports.approveIconCue = async (req, res) => {
  const { episodeId, cueId } = req.params;
  
  try {
    const result = await pool.query(
      `UPDATE icon_cues
       SET status = 'approved', updated_at = NOW()
       WHERE id = $1 AND episode_id = $2
       RETURNING *`,
      [cueId, episodeId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Icon cue not found' },
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
    });
    
  } catch (error) {
    console.error('[IconCueController] Error approving icon cue:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to approve icon cue',
        details: error.message,
      },
    });
  }
};

/**
 * Reject icon cue
 */
exports.rejectIconCue = async (req, res) => {
  const { episodeId, cueId } = req.params;
  const { notes } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE icon_cues
       SET status = 'rejected', notes = $1, updated_at = NOW()
       WHERE id = $2 AND episode_id = $3
       RETURNING *`,
      [notes || null, cueId, episodeId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Icon cue not found' },
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
    });
    
  } catch (error) {
    console.error('[IconCueController] Error rejecting icon cue:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to reject icon cue',
        details: error.message,
      },
    });
  }
};

/**
 * Approve all suggested icon cues
 */
exports.approveAllIconCues = async (req, res) => {
  const { episodeId } = req.params;
  
  try {
    const result = await pool.query(
      `UPDATE icon_cues
       SET status = 'approved', updated_at = NOW()
       WHERE episode_id = $1 AND status = 'suggested'
       RETURNING *`,
      [episodeId]
    );
    
    res.json({
      success: true,
      data: result.rows,
      meta: { count: result.rows.length },
    });
    
  } catch (error) {
    console.error('[IconCueController] Error approving all icon cues:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to approve all icon cues',
        details: error.message,
      },
    });
  }
};

/**
 * Reject all suggested icon cues
 */
exports.rejectAllIconCues = async (req, res) => {
  const { episodeId } = req.params;
  
  try {
    const result = await pool.query(
      `UPDATE icon_cues
       SET status = 'rejected', updated_at = NOW()
       WHERE episode_id = $1 AND status = 'suggested'
       RETURNING *`,
      [episodeId]
    );
    
    res.json({
      success: true,
      data: result.rows,
      meta: { count: result.rows.length },
    });
    
  } catch (error) {
    console.error('[IconCueController] Error rejecting all icon cues:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to reject all icon cues',
        details: error.message,
      },
    });
  }
};

/**
 * List all anchor points
 */
exports.listAnchors = async (req, res) => {
  const { episodeId } = req.params;
  
  try {
    const result = await pool.query(
      `SELECT * FROM icon_cues
       WHERE episode_id = $1 AND is_anchor = true
       ORDER BY timestamp ASC`,
      [episodeId]
    );
    
    res.json({
      success: true,
      data: result.rows,
      meta: { count: result.rows.length },
    });
    
  } catch (error) {
    console.error('[IconCueController] Error listing anchors:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to list anchors',
        details: error.message,
      },
    });
  }
};

/**
 * Set cue as anchor
 */
exports.setAnchor = async (req, res) => {
  const { episodeId, cueId } = req.params;
  const { anchor_name } = req.body;
  
  if (!anchor_name) {
    return res.status(400).json({
      success: false,
      error: { message: 'anchor_name is required' },
    });
  }
  
  try {
    const result = await pool.query(
      `UPDATE icon_cues
       SET is_anchor = true, anchor_name = $1, updated_at = NOW()
       WHERE id = $2 AND episode_id = $3
       RETURNING *`,
      [anchor_name, cueId, episodeId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Icon cue not found' },
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
    });
    
  } catch (error) {
    console.error('[IconCueController] Error setting anchor:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to set anchor',
        details: error.message,
      },
    });
  }
};

/**
 * Remove anchor from cue
 */
exports.removeAnchor = async (req, res) => {
  const { episodeId, cueId } = req.params;
  
  try {
    const result = await pool.query(
      `UPDATE icon_cues
       SET is_anchor = false, anchor_name = NULL, updated_at = NOW()
       WHERE id = $1 AND episode_id = $2
       RETURNING *`,
      [cueId, episodeId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Icon cue not found' },
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
    });
    
  } catch (error) {
    console.error('[IconCueController] Error removing anchor:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to remove anchor',
        details: error.message,
      },
    });
  }
};

/**
 * Export icon cues
 */
exports.exportIconCues = async (req, res) => {
  const { episodeId } = req.params;
  const { format = 'json' } = req.query;
  
  try {
    const result = await pool.query(
      `SELECT * FROM icon_cues
       WHERE episode_id = $1 AND status = 'approved'
       ORDER BY timestamp ASC`,
      [episodeId]
    );
    
    if (format === 'markdown') {
      const markdown = generateIconCueMarkdown(result.rows);
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="icon_cues_ep${episodeId}.md"`);
      return res.send(markdown);
    }
    
    if (format === 'csv') {
      const csv = generateIconCueCSV(result.rows);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="icon_cues_ep${episodeId}.csv"`);
      return res.send(csv);
    }
    
    // Default: JSON
    res.json({
      success: true,
      data: result.rows,
      meta: {
        count: result.rows.length,
        format: 'json',
      },
    });
    
  } catch (error) {
    console.error('[IconCueController] Error exporting icon cues:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to export icon cues',
        details: error.message,
      },
    });
  }
};

// Helper: Generate Markdown
function generateIconCueMarkdown(cues) {
  let markdown = '# Icon Cue Sheet\n\n';
  markdown += `| Time | Slot | Action | Icon | Notes |\n`;
  markdown += `|------|------|--------|------|-------|\n`;
  
  cues.forEach(cue => {
    const time = formatTimestamp(cue.timestamp);
    markdown += `| ${time} | ${cue.slot_id} | ${cue.action} | ${cue.asset_id || 'N/A'} | ${cue.notes || ''} |\n`;
  });
  
  return markdown;
}

// Helper: Generate CSV
function generateIconCueCSV(cues) {
  let csv = 'Timestamp,Slot,Action,AssetID,Transition,Easing,Notes\n';
  
  cues.forEach(cue => {
    csv += `${cue.timestamp},${cue.slot_id},${cue.action},${cue.asset_id || ''},${cue.transition || ''},${cue.easing},${cue.notes || ''}\n`;
  });
  
  return csv;
}

// Helper: Format timestamp
function formatTimestamp(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(4, '0')}`;
}
