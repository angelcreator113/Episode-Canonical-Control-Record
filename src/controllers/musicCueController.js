/**
 * Music Cue Controller
 * Handles music timeline operations
 */

const { pool } = require('../db');
const musicCueGeneratorService = require('../services/musicCueGeneratorService');

/**
 * Generate music cues from scene structure
 */
exports.generateMusicCues = async (req, res) => {
  const { episodeId } = req.params;
  
  try {
    console.log(`[MusicCueController] Generating music cues for episode ${episodeId}`);
    
    // Generate music cues from scene structure
    const result = await musicCueGeneratorService.generateFromScenes(episodeId, {
      userId: req.user?.sub,
    });
    
    res.json({
      success: true,
      data: result.musicCues,
      meta: {
        count: result.musicCues.length,
        generation_time_ms: result.duration_ms,
      },
    });
    
  } catch (error) {
    console.error('[MusicCueController] Error generating music cues:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to generate music cues',
        details: error.message,
      },
    });
  }
};

/**
 * List all music cues for episode
 */
exports.listMusicCues = async (req, res) => {
  const { episodeId } = req.params;
  const { status, track_type, sort = 'start_time' } = req.query;
  
  try {
    let query = 'SELECT * FROM music_cues WHERE episode_id = $1';
    const params = [episodeId];
    let paramIndex = 2;
    
    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (track_type) {
      query += ` AND track_type = $${paramIndex}`;
      params.push(track_type);
      paramIndex++;
    }
    
    const validSorts = ['start_time', 'scene_name', 'created_at'];
    const sortField = validSorts.includes(sort) ? sort : 'start_time';
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
    console.error('[MusicCueController] Error listing music cues:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to list music cues',
        details: error.message,
      },
    });
  }
};

/**
 * Get single music cue
 */
exports.getMusicCue = async (req, res) => {
  const { episodeId, cueId } = req.params;
  
  try {
    const result = await pool.query(
      'SELECT * FROM music_cues WHERE id = $1 AND episode_id = $2',
      [cueId, episodeId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Music cue not found' },
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
    });
    
  } catch (error) {
    console.error('[MusicCueController] Error getting music cue:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get music cue',
        details: error.message,
      },
    });
  }
};

/**
 * Create music cue manually
 */
exports.createMusicCue = async (req, res) => {
  const { episodeId } = req.params;
  const {
    scene_name,
    scene_beat,
    start_time,
    end_time,
    track_type,
    intensity,
    track_name,
    mood,
    notes,
    metadata,
  } = req.body;
  
  try {
    if (!scene_name || !start_time || !track_type || !intensity) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Missing required fields: scene_name, start_time, track_type, intensity',
        },
      });
    }
    
    const result = await pool.query(
      `INSERT INTO music_cues (
        episode_id, scene_name, scene_beat, start_time, end_time,
        track_type, intensity, track_name, mood, notes, metadata, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        episodeId, scene_name, scene_beat, start_time, end_time,
        track_type, intensity, track_name, mood, notes,
        metadata ? JSON.stringify(metadata) : null,
        'approved', // Manually created cues are auto-approved
      ]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
    
  } catch (error) {
    console.error('[MusicCueController] Error creating music cue:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to create music cue',
        details: error.message,
      },
    });
  }
};

/**
 * Update music cue
 */
exports.updateMusicCue = async (req, res) => {
  const { episodeId, cueId } = req.params;
  const updates = req.body;
  
  try {
    const allowedFields = [
      'scene_name', 'scene_beat', 'start_time', 'end_time',
      'track_type', 'intensity', 'track_name', 'mood', 'notes', 'metadata',
    ];
    
    const setClause = [];
    const params = [];
    let paramIndex = 1;
    
    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        setClause.push(`${key} = $${paramIndex}`);
        
        if (key === 'metadata') {
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
    
    params.push(cueId, episodeId);
    
    const query = `
      UPDATE music_cues
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex} AND episode_id = $${paramIndex + 1}
      RETURNING *
    `;
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Music cue not found' },
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
    });
    
  } catch (error) {
    console.error('[MusicCueController] Error updating music cue:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update music cue',
        details: error.message,
      },
    });
  }
};

/**
 * Delete music cue
 */
exports.deleteMusicCue = async (req, res) => {
  const { episodeId, cueId } = req.params;
  
  try {
    const result = await pool.query(
      'DELETE FROM music_cues WHERE id = $1 AND episode_id = $2 RETURNING id',
      [cueId, episodeId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Music cue not found' },
      });
    }
    
    res.json({
      success: true,
      data: { id: result.rows[0].id, deleted: true },
    });
    
  } catch (error) {
    console.error('[MusicCueController] Error deleting music cue:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete music cue',
        details: error.message,
      },
    });
  }
};

/**
 * Approve music cue
 */
exports.approveMusicCue = async (req, res) => {
  const { episodeId, cueId } = req.params;
  
  try {
    const result = await pool.query(
      `UPDATE music_cues
       SET status = 'approved'
       WHERE id = $1 AND episode_id = $2
       RETURNING *`,
      [cueId, episodeId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Music cue not found' },
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
    });
    
  } catch (error) {
    console.error('[MusicCueController] Error approving music cue:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to approve music cue',
        details: error.message,
      },
    });
  }
};

/**
 * Approve all suggested music cues
 */
exports.approveAllMusicCues = async (req, res) => {
  const { episodeId } = req.params;
  
  try {
    const result = await pool.query(
      `UPDATE music_cues
       SET status = 'approved'
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
    console.error('[MusicCueController] Error approving all music cues:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to approve all music cues',
        details: error.message,
      },
    });
  }
};

/**
 * Export music cues as Markdown
 */
exports.exportMusicCues = async (req, res) => {
  const { episodeId } = req.params;
  
  try {
    const result = await pool.query(
      `SELECT * FROM music_cues
       WHERE episode_id = $1 AND status = 'approved'
       ORDER BY start_time ASC`,
      [episodeId]
    );
    
    const markdown = generateMusicCueMarkdown(result.rows);
    
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="music_cues_ep${episodeId}.md"`);
    res.send(markdown);
    
  } catch (error) {
    console.error('[MusicCueController] Error exporting music cues:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to export music cues',
        details: error.message,
      },
    });
  }
};

// Helper: Generate Markdown
function generateMusicCueMarkdown(cues) {
  let markdown = '# Music Cue Sheet\n\n';
  
  cues.forEach((cue, index) => {
    markdown += `## ${index + 1}. ${cue.scene_name}\n\n`;
    markdown += `- **Time:** ${formatTimestamp(cue.start_time)}`;
    if (cue.end_time) {
      markdown += ` - ${formatTimestamp(cue.end_time)}`;
    }
    markdown += `\n`;
    markdown += `- **Track Type:** ${cue.track_type}\n`;
    markdown += `- **Intensity:** ${cue.intensity}\n`;
    if (cue.track_name) {
      markdown += `- **Track:** ${cue.track_name}\n`;
    }
    if (cue.mood) {
      markdown += `- **Mood:** ${cue.mood}\n`;
    }
    if (cue.notes) {
      markdown += `- **Notes:** ${cue.notes}\n`;
    }
    markdown += `\n`;
  });
  
  return markdown;
}

function formatTimestamp(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(4, '0')}`;
}
