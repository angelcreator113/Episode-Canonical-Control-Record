/**
 * Cursor Path Generator Service
 * Auto-generates cursor movements from icon cues
 * 
 * Features:
 * - Natural cursor movement paths
 * - Hover timing before clicks
 * - Easing curves for realistic motion
 * - Anchor-based targeting
 */

const { pool } = require('../db');

class CursorPathGeneratorService {
  
  /**
   * Generate cursor paths from icon cues
   * @param {string} episodeId - Episode UUID
   * @param {object} options - Generation options
   * @returns {object} { cursorPaths, method, duration_ms }
   */
  async generateFromIconCues(episodeId, options = {}) {
    const startTime = Date.now();
    const { regenerate = false, userId } = options;
    
    try {
      console.log(`[CursorPathGenerator] Starting generation for episode ${episodeId}`);
      
      // Step 1: Check if cursor paths already exist
      if (!regenerate) {
        const existingPaths = await this.getExistingPaths(episodeId);
        if (existingPaths.length > 0) {
          console.log(`[CursorPathGenerator] Found ${existingPaths.length} existing paths`);
          return {
            cursorPaths: existingPaths,
            method: 'existing',
            duration_ms: Date.now() - startTime,
          };
        }
      }
      
      // Step 2: Get approved icon cues
      const iconCues = await this.getApprovedIconCues(episodeId);
      
      if (iconCues.length === 0) {
        console.log('[CursorPathGenerator] No approved icon cues found');
        return {
          cursorPaths: [],
          method: 'no_cues',
          duration_ms: Date.now() - startTime,
        };
      }
      
      // Step 3: Generate cursor paths for each icon interaction
      const cursorPaths = [];
      
      for (let i = 0; i < iconCues.length; i++) {
        const cue = iconCues[i];
        const prevCue = i > 0 ? iconCues[i - 1] : null;
        
        // Generate movement to this icon
        const paths = await this.generatePathsForCue(cue, prevCue, episodeId);
        cursorPaths.push(...paths);
      }
      
      // Step 4: Save cursor paths to database
      const savedPaths = await this.savePaths(episodeId, cursorPaths, userId);
      
      const duration = Date.now() - startTime;
      console.log(`[CursorPathGenerator] Generated ${savedPaths.length} cursor paths in ${duration}ms`);
      
      return {
        cursorPaths: savedPaths,
        method: 'auto_generated',
        duration_ms: duration,
      };
      
    } catch (error) {
      console.error('[CursorPathGenerator] Error generating cursor paths:', error);
      throw error;
    }
  }
  
  /**
   * Get existing cursor paths
   */
  async getExistingPaths(episodeId) {
    const result = await pool.query(
      'SELECT * FROM cursor_actions WHERE episode_id = $1 ORDER BY timestamp ASC',
      [episodeId]
    );
    return result.rows;
  }
  
  /**
   * Get approved icon cues
   */
  async getApprovedIconCues(episodeId) {
    const result = await pool.query(
      `SELECT * FROM icon_cues 
       WHERE episode_id = $1 AND status = 'approved'
       ORDER BY timestamp ASC`,
      [episodeId]
    );
    return result.rows;
  }
  
  /**
   * Generate cursor paths for a single icon cue
   */
  async generatePathsForCue(cue, prevCue, episodeId) {
    const paths = [];
    
    // Get icon position from slot mapping
    const slotMapping = await this.getSlotMapping(cue.slot_id);
    const iconPosition = slotMapping?.default_position || { x: 850, y: 400 };
    
    // Determine starting position
    let fromPosition = null;
    
    if (prevCue) {
      // Move from previous icon
      const prevSlotMapping = await this.getSlotMapping(prevCue.slot_id);
      fromPosition = prevSlotMapping?.default_position || { x: 850, y: 400 };
    }
    // else: cursor starts off-screen (fromPosition = null)
    
    // Calculate timing
    const baseTime = cue.timestamp - 1.0; // Start moving 1s before icon appears
    const moveDuration = 500; // 500ms movement
    const hoverDuration = 200; // 200ms hover
    const clickTime = cue.timestamp + 0.5; // Click 0.5s after icon appears
    
    // Path 1: Move to icon
    paths.push({
      timestamp: baseTime,
      duration_ms: moveDuration,
      action_type: 'move',
      from_position: fromPosition,
      to_position: iconPosition,
      easing: 'ease-out',
      path_type: 'direct',
      target_type: 'icon_cue',
      target_id: cue.id,
      show_trail: false,
      generated_by: 'auto',
      generation_confidence: 0.90,
      notes: `Move to ${cue.slot_id} icon`,
    });
    
    // Path 2: Hover over icon
    if (cue.action === 'click' || cue.action === 'open') {
      paths.push({
        timestamp: baseTime + (moveDuration / 1000),
        duration_ms: hoverDuration,
        action_type: 'hover',
        from_position: iconPosition,
        to_position: iconPosition,
        easing: 'linear',
        path_type: 'direct',
        target_type: 'icon_cue',
        target_id: cue.id,
        hover_duration_ms: hoverDuration,
        generated_by: 'auto',
        generation_confidence: 0.90,
        notes: 'Hover before click',
      });
      
      // Path 3: Click icon
      paths.push({
        timestamp: clickTime,
        duration_ms: 100,
        action_type: 'click',
        from_position: iconPosition,
        to_position: iconPosition,
        easing: 'linear',
        path_type: 'direct',
        target_type: 'icon_cue',
        target_id: cue.id,
        click_effect: 'press',
        generated_by: 'auto',
        generation_confidence: 0.95,
        notes: 'Click icon to open',
      });
    }
    
    return paths;
  }
  
  /**
   * Get slot mapping
   */
  async getSlotMapping(slotId) {
    const result = await pool.query(
      'SELECT * FROM icon_slot_mappings WHERE slot_id = $1 LIMIT 1',
      [slotId]
    );
    return result.rows[0] || null;
  }
  
  /**
   * Save cursor paths to database
   */
  async savePaths(episodeId, cursorPaths, userId) {
    const savedPaths = [];
    
    for (const path of cursorPaths) {
      const result = await pool.query(
        `INSERT INTO cursor_actions (
          episode_id, target_type, target_id, timestamp, duration_ms, action_type,
          from_position, to_position, easing, path_type, show_trail, click_effect,
          hover_duration_ms, status, generated_by, generation_confidence, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *`,
        [
          episodeId,
          path.target_type,
          path.target_id,
          path.timestamp,
          path.duration_ms,
          path.action_type,
          path.from_position ? JSON.stringify(path.from_position) : null,
          JSON.stringify(path.to_position),
          path.easing,
          path.path_type,
          path.show_trail || false,
          path.click_effect || null,
          path.hover_duration_ms || null,
          'suggested', // All generated paths start as suggested
          path.generated_by || 'auto',
          path.generation_confidence || 0.85,
          path.notes || null,
        ]
      );
      
      savedPaths.push(result.rows[0]);
    }
    
    return savedPaths;
  }
}

module.exports = new CursorPathGeneratorService();
