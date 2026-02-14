/**
 * Cursor Path Controller
 * Handles cursor action timeline operations
 */

const { pool } = require('../db');
const cursorPathGeneratorService = require('../services/cursorPathGeneratorService');

/**
 * Generate cursor paths from icon cues
 */
exports.generateCursorPaths = async (req, res) => {
  const { episodeId } = req.params;
  const { regenerate = false } = req.body;
  
  try {
    console.log(`[CursorPathController] Generating cursor paths for episode ${episodeId}`);
    
    // Generate cursor paths using AI service
    const result = await cursorPathGeneratorService.generateFromIconCues(episodeId, {
      regenerate,
      userId: req.user?.sub,
    });
    
    res.json({
      success: true,
      data: result.cursorPaths,
      meta: {
        count: result.cursorPaths.length,
        approved: result.cursorPaths.filter(p => p.status === 'approved').length,
        suggested: result.cursorPaths.filter(p => p.status === 'suggested').length,
        generation_method: result.method,
        generation_time_ms: result.duration_ms,
      },
    });
    
  } catch (error) {
    console.error('[CursorPathController] Error generating cursor paths:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to generate cursor paths',
        details: error.message,
      },
    });
  }
};

/**
 * Regenerate cursor paths
 */
exports.regenerateCursorPaths = async (req, res) => {
  req.body.regenerate = true;
  return exports.generateCursorPaths(req, res);
};

/**
 * List all cursor paths for episode
 */
exports.listCursorPaths = async (req, res) => {
  const { episodeId } = req.params;
  const { status, action_type, sort = 'timestamp' } = req.query;
  
  try {
    let query = 'SELECT * FROM cursor_actions WHERE episode_id = $1';
    const params = [episodeId];
    let paramIndex = 2;
    
    // Filter by status
    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    // Filter by action type
    if (action_type) {
      query += ` AND action_type = $${paramIndex}`;
      params.push(action_type);
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
    console.error('[CursorPathController] Error listing cursor paths:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to list cursor paths',
        details: error.message,
      },
    });
  }
};

/**
 * Get single cursor path
 */
exports.getCursorPath = async (req, res) => {
  const { episodeId, pathId } = req.params;
  
  try {
    const result = await pool.query(
      'SELECT * FROM cursor_actions WHERE id = $1 AND episode_id = $2',
      [pathId, episodeId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Cursor path not found' },
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
    });
    
  } catch (error) {
    console.error('[CursorPathController] Error getting cursor path:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get cursor path',
        details: error.message,
      },
    });
  }
};

/**
 * Create cursor path manually
 */
exports.createCursorPath = async (req, res) => {
  const { episodeId } = req.params;
  const {
    target_type,
    target_id,
    target_anchor,
    timestamp,
    duration_ms,
    action_type,
    from_position,
    to_position,
    easing = 'ease-out',
    path_type = 'direct',
    path_control_points,
    show_trail = false,
    click_effect,
    hover_duration_ms,
    metadata,
    notes,
  } = req.body;
  
  try {
    // Validate required fields
    if (!target_type || !timestamp || !duration_ms || !action_type || !to_position) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Missing required fields: target_type, timestamp, duration_ms, action_type, to_position',
        },
      });
    }
    
    const result = await pool.query(
      `INSERT INTO cursor_actions (
        episode_id, target_type, target_id, target_anchor,
        timestamp, duration_ms, action_type,
        from_position, to_position, easing, path_type, path_control_points,
        show_trail, click_effect, hover_duration_ms,
        metadata, notes, status, generated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *`,
      [
        episodeId, target_type, target_id, target_anchor,
        timestamp, duration_ms, action_type,
        from_position ? JSON.stringify(from_position) : null,
        JSON.stringify(to_position),
        easing, path_type,
        path_control_points ? JSON.stringify(path_control_points) : null,
        show_trail, click_effect, hover_duration_ms,
        metadata ? JSON.stringify(metadata) : null,
        notes,
        'approved', // Manually created paths are auto-approved
        'manual',
      ]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
    
  } catch (error) {
    console.error('[CursorPathController] Error creating cursor path:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to create cursor path',
        details: error.message,
      },
    });
  }
};

/**
 * Update cursor path
 */
exports.updateCursorPath = async (req, res) => {
  const { episodeId, pathId } = req.params;
  const updates = req.body;
  
  try {
    const allowedFields = [
      'target_type', 'target_id', 'target_anchor',
      'timestamp', 'duration_ms', 'action_type',
      'from_position', 'to_position', 'easing', 'path_type',
      'path_control_points', 'show_trail', 'click_effect',
      'hover_duration_ms', 'metadata', 'notes',
    ];
    
    const setClause = [];
    const params = [];
    let paramIndex = 1;
    
    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        setClause.push(`${key} = $${paramIndex}`);
        
        // Handle JSON fields
        if (['from_position', 'to_position', 'path_control_points', 'metadata'].includes(key)) {
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
    
    setClause.push(`updated_at = NOW()`);
    params.push(pathId, episodeId);
    
    const query = `
      UPDATE cursor_actions
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex} AND episode_id = $${paramIndex + 1}
      RETURNING *
    `;
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Cursor path not found' },
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
    });
    
  } catch (error) {
    console.error('[CursorPathController] Error updating cursor path:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update cursor path',
        details: error.message,
      },
    });
  }
};

/**
 * Delete cursor path
 */
exports.deleteCursorPath = async (req, res) => {
  const { episodeId, pathId } = req.params;
  
  try {
    const result = await pool.query(
      'DELETE FROM cursor_actions WHERE id = $1 AND episode_id = $2 RETURNING id',
      [pathId, episodeId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Cursor path not found' },
      });
    }
    
    res.json({
      success: true,
      data: { id: result.rows[0].id, deleted: true },
    });
    
  } catch (error) {
    console.error('[CursorPathController] Error deleting cursor path:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete cursor path',
        details: error.message,
      },
    });
  }
};

/**
 * Approve cursor path
 */
exports.approveCursorPath = async (req, res) => {
  const { episodeId, pathId } = req.params;
  
  try {
    const result = await pool.query(
      `UPDATE cursor_actions
       SET status = 'approved', updated_at = NOW()
       WHERE id = $1 AND episode_id = $2
       RETURNING *`,
      [pathId, episodeId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Cursor path not found' },
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
    });
    
  } catch (error) {
    console.error('[CursorPathController] Error approving cursor path:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to approve cursor path',
        details: error.message,
      },
    });
  }
};

/**
 * Reject cursor path
 */
exports.rejectCursorPath = async (req, res) => {
  const { episodeId, pathId } = req.params;
  const { notes } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE cursor_actions
       SET status = 'rejected', notes = $1, updated_at = NOW()
       WHERE id = $2 AND episode_id = $3
       RETURNING *`,
      [notes || null, pathId, episodeId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Cursor path not found' },
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
    });
    
  } catch (error) {
    console.error('[CursorPathController] Error rejecting cursor path:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to reject cursor path',
        details: error.message,
      },
    });
  }
};

/**
 * Approve all suggested cursor paths
 */
exports.approveAllCursorPaths = async (req, res) => {
  const { episodeId } = req.params;
  
  try {
    const result = await pool.query(
      `UPDATE cursor_actions
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
    console.error('[CursorPathController] Error approving all cursor paths:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to approve all cursor paths',
        details: error.message,
      },
    });
  }
};

/**
 * Export cursor paths
 */
exports.exportCursorPaths = async (req, res) => {
  const { episodeId } = req.params;
  const { format = 'json' } = req.query;
  
  try {
    const result = await pool.query(
      `SELECT * FROM cursor_actions
       WHERE episode_id = $1 AND status = 'approved'
       ORDER BY timestamp ASC`,
      [episodeId]
    );
    
    if (format === 'markdown') {
      const markdown = generateCursorPathMarkdown(result.rows);
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="cursor_paths_ep${episodeId}.md"`);
      return res.send(markdown);
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
    console.error('[CursorPathController] Error exporting cursor paths:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to export cursor paths',
        details: error.message,
      },
    });
  }
};

// Helper: Generate Markdown
function generateCursorPathMarkdown(paths) {
  let markdown = '# Cursor Action Map\n\n';
  markdown += `| Time | Action | Target | Duration | Easing | Notes |\n`;
  markdown += `|------|--------|--------|----------|--------|-------|\n`;
  
  paths.forEach(path => {
    const time = formatTimestamp(path.timestamp);
    const target = path.target_anchor || path.target_id || 'Screen Position';
    markdown += `| ${time} | ${path.action_type} | ${target} | ${path.duration_ms}ms | ${path.easing} | ${path.notes || ''} |\n`;
  });
  
  return markdown;
}

function formatTimestamp(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(4, '0')}`;
}
