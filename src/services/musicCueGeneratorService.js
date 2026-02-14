/**
 * Music Cue Generator Service
 * Generates scene-based music cues with intensity mapping
 * 
 * Maps Lala Formula beats to music intensity levels:
 * - Stream Open: very_low (40% volume)
 * - Inciting Moment: very_low to light
 * - Styling Phase: light to medium (60% volume)
 * - Screenplay Beat: VOCAL track (30-60s, 80% volume)
 * - Resolution: cinematic (fuller sound)
 */

const { pool } = require('../db');

class MusicCueGeneratorService {
  
  /**
   * Generate music cues from scene structure
   * @param {string} episodeId - Episode UUID
   * @param {object} options - Generation options
   * @returns {object} { musicCues, duration_ms }
   */
  async generateFromScenes(episodeId, options = {}) {
    const startTime = Date.now();
    const { userId } = options;
    
    try {
      console.log(`[MusicCueGenerator] Starting generation for episode ${episodeId}`);
      
      // Step 1: Get episode data
      const episodeData = await this.getEpisodeData(episodeId);
      
      // Step 2: Get scenes
      const scenes = await this.getScenes(episodeId);
      
      if (scenes.length === 0) {
        console.log('[MusicCueGenerator] No scenes found, using episode-level generation');
        return await this.generateFromEpisode(episodeId, episodeData, userId);
      }
      
      // Step 3: Generate music cues for each scene
      const musicCues = [];
      
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const nextScene = i < scenes.length - 1 ? scenes[i + 1] : null;
        
        const cue = this.generateCueForScene(scene, nextScene, episodeData);
        if (cue) musicCues.push(cue);
      }
      
      // Step 4: Add screenplay beat vocal track if present
      const screenplayBeat = await this.findScreenplayBeat(episodeData);
      if (screenplayBeat) {
        musicCues.push(screenplayBeat);
      }
      
      // Step 5: Save music cues to database
      const savedCues = await this.saveCues(episodeId, musicCues, userId);
      
      const duration = Date.now() - startTime;
      console.log(`[MusicCueGenerator] Generated ${savedCues.length} music cues in ${duration}ms`);
      
      return {
        musicCues: savedCues,
        duration_ms: duration,
      };
      
    } catch (error) {
      console.error('[MusicCueGenerator] Error generating music cues:', error);
      throw error;
    }
  }
  
  /**
   * Get episode data
   */
  async getEpisodeData(episodeId) {
    const episodeResult = await pool.query(
      'SELECT * FROM episodes WHERE id = $1',
      [episodeId]
    );
    
    if (episodeResult.rows.length === 0) {
      throw new Error('Episode not found');
    }
    
    // Get Lala Formula data if exists
    const formulaResult = await pool.query(
      'SELECT * FROM lala_formula_episodes WHERE episode_id = $1',
      [episodeId]
    );
    
    return {
      episode: episodeResult.rows[0],
      formula: formulaResult.rows[0] || null,
    };
  }
  
  /**
   * Get scenes for episode
   */
  async getScenes(episodeId) {
    const result = await pool.query(
      `SELECT * FROM scenes 
       WHERE episode_id = $1 
       ORDER BY scene_number ASC, start_time_seconds ASC`,
      [episodeId]
    );
    return result.rows;
  }
  
  /**
   * Generate music cue for a single scene
   */
  generateCueForScene(scene, nextScene, episodeData) {
    const sceneName = scene.name || `Scene ${scene.scene_number}`;
    const sceneType = (scene.type || '').toLowerCase();
    const sceneBeat = this.inferBeatFromScene(scene, episodeData);
    
    const startTime = scene.start_time_seconds || 0;
    const endTime = nextScene ? nextScene.start_time_seconds : null;
    
    // Map scene to intensity
    const { track_type, intensity, mood, notes } = this.mapSceneToMusic(
      sceneName,
      sceneType,
      sceneBeat,
      scene
    );
    
    return {
      scene_name: sceneName,
      scene_beat: sceneBeat,
      start_time: startTime,
      end_time: endTime,
      track_type,
      intensity,
      track_name: this.suggestTrackName(sceneBeat, intensity),
      mood,
      notes,
      status: 'suggested',
    };
  }
  
  /**
   * Infer Lala Formula beat from scene
   */
  inferBeatFromScene(scene, episodeData) {
    const sceneName = (scene.name || '').toLowerCase();
    const sceneMetadata = scene.metadata || {};
    
    // Check if scene metadata has explicit beat
    if (sceneMetadata.lala_beat) {
      return sceneMetadata.lala_beat;
    }
    
    // Infer from scene name
    if (sceneName.includes('stream open') || sceneName.includes('opening')) {
      return 'stream_open';
    }
    if (sceneName.includes('inciting') || sceneName.includes('invitation')) {
      return 'inciting_moment';
    }
    if (sceneName.includes('styling') || sceneName.includes('wardrobe')) {
      return 'styling_phase';
    }
    if (sceneName.includes('screenplay') || sceneName.includes('montage')) {
      return 'screenplay_beat';
    }
    if (sceneName.includes('acceptance') || sceneName.includes('decision')) {
      return 'acceptance';
    }
    if (sceneName.includes('transition') || sceneName.includes('preparation')) {
      return 'transition_prep';
    }
    if (sceneName.includes('event') || sceneName.includes('arrival')) {
      return 'event_scene';
    }
    if (sceneName.includes('resolution') || sceneName.includes('reflection')) {
      return 'resolution';
    }
    
    // Default
    return 'general';
  }
  
  /**
   * Map scene to music properties
   */
  mapSceneToMusic(sceneName, sceneType, sceneBeat, scene) {
    const beatMappings = {
      stream_open: {
        track_type: 'instrumental',
        intensity: 'very_low',
        mood: 'casual, inviting',
        notes: 'Instrumental @ 40% volume - Lala introducing herself',
      },
      inciting_moment: {
        track_type: 'instrumental',
        intensity: 'very_low',
        mood: 'subtle shift, anticipation',
        notes: 'Continues @ 40% - Invitation/interruption happens',
      },
      styling_phase: {
        track_type: 'instrumental',
        intensity: 'light',
        mood: 'light, rhythmic, fun',
        notes: 'Crossfade to 60% volume - Wardrobe browsing and selection',
      },
      acceptance: {
        track_type: 'instrumental',
        intensity: 'medium',
        mood: 'building momentum',
        notes: 'Continue @ 60% - Lala commits to decision',
      },
      transition_prep: {
        track_type: 'instrumental',
        intensity: 'medium',
        mood: 'upbeat, preparation energy',
        notes: 'Maintain @ 60% - Getting ready sequence',
      },
      screenplay_beat: {
        track_type: 'vocal',
        intensity: 'cinematic',
        mood: 'epic, showcase moment',
        notes: 'VOCAL TRACK 30-60s @ 80% volume, Instrumental fades to 20%',
      },
      event_scene: {
        track_type: 'instrumental',
        intensity: 'fuller',
        mood: 'confident, vibrant',
        notes: 'Crossfade back to instrumental @ 70% - Event happening',
      },
      resolution: {
        track_type: 'instrumental',
        intensity: 'light',
        mood: 'reflective, satisfied',
        notes: 'Fade to 40-50% - Lala reflects on experience',
      },
      general: {
        track_type: 'instrumental',
        intensity: 'light',
        mood: 'neutral, scene-appropriate',
        notes: 'Default intensity @ 50%',
      },
    };
    
    return beatMappings[sceneBeat] || beatMappings.general;
  }
  
  /**
   * Suggest track name based on beat and intensity
   */
  suggestTrackName(sceneBeat, intensity) {
    const trackNames = {
      stream_open: 'Lala Theme v1 (Intro)',
      inciting_moment: 'Lala Theme v1 (Continues)',
      styling_phase: 'Styling Groove',
      acceptance: 'Decision Beat',
      transition_prep: 'Prep Energy',
      screenplay_beat: 'Lala Anthem (Chorus/Verse)',
      event_scene: 'Event Ambience',
      resolution: 'Reflection Theme',
    };
    
    return trackNames[sceneBeat] || 'Background Music';
  }
  
  /**
   * Find screenplay beat for vocal track
   */
  async findScreenplayBeat(episodeData) {
    const { formula } = episodeData;
    
    if (!formula || !formula.screenplay_beat_start_time) {
      return null;
    }
    
    const startTime = formula.screenplay_beat_start_time;
    const duration = formula.screenplay_beat_duration || 45; // Default 45s
    const endTime = startTime + duration;
    
    return {
      scene_name: 'Screenplay Beat (Montage)',
      scene_beat: 'screenplay_beat',
      start_time: startTime,
      end_time: endTime,
      track_type: 'vocal',
      intensity: 'cinematic',
      track_name: 'Lala Anthem (Chorus)',
      mood: 'Epic showcase moment - Lala shining',
      notes: `VOCAL TRACK ${duration}s @ 80% volume. Instrumental fades to 20% background.`,
      metadata: {
        vocal_section: 'chorus',
        instrumental_volume_during_vocal: 20,
        vocal_volume: 80,
        crossfade_in_duration_ms: 3000,
        crossfade_out_duration_ms: 3000,
      },
      status: 'suggested',
    };
  }
  
  /**
   * Generate from episode (when no scenes available)
   */
  async generateFromEpisode(episodeId, episodeData, userId) {
    const { episode, formula } = episodeData;
    const duration = episode.duration_seconds || 600; // Default 10 min
    
    const musicCues = [];
    
    // Basic 3-part structure
    musicCues.push({
      scene_name: 'Opening',
      scene_beat: 'stream_open',
      start_time: 0,
      end_time: 90,
      track_type: 'instrumental',
      intensity: 'very_low',
      track_name: 'Lala Theme v1',
      mood: 'Casual introduction',
      notes: 'Instrumental @ 40% volume',
      status: 'suggested',
    });
    
    musicCues.push({
      scene_name: 'Main Content',
      scene_beat: 'styling_phase',
      start_time: 90,
      end_time: duration - 60,
      track_type: 'instrumental',
      intensity: 'light',
      track_name: 'Styling Groove',
      mood: 'Upbeat, engaging',
      notes: 'Instrumental @ 60% volume',
      status: 'suggested',
    });
    
    musicCues.push({
      scene_name: 'Closing',
      scene_beat: 'resolution',
      start_time: duration - 60,
      end_time: duration,
      track_type: 'instrumental',
      intensity: 'light',
      track_name: 'Reflection Theme',
      mood: 'Reflective, satisfied',
      notes: 'Fade to 40% volume',
      status: 'suggested',
    });
    
    // Add screenplay beat if present
    const screenplayBeat = await this.findScreenplayBeat(episodeData);
    if (screenplayBeat) {
      musicCues.push(screenplayBeat);
    }
    
    const savedCues = await this.saveCues(episodeId, musicCues, userId);
    
    return {
      musicCues: savedCues,
      duration_ms: 0,
    };
  }
  
  /**
   * Save music cues to database
   */
  async saveCues(episodeId, musicCues, userId) {
    const savedCues = [];
    
    for (const cue of musicCues) {
      const result = await pool.query(
        `INSERT INTO music_cues (
          episode_id, scene_name, scene_beat, start_time, end_time,
          track_type, intensity, track_name, mood, notes, metadata, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          episodeId,
          cue.scene_name,
          cue.scene_beat || null,
          cue.start_time,
          cue.end_time || null,
          cue.track_type,
          cue.intensity,
          cue.track_name || null,
          cue.mood || null,
          cue.notes || null,
          cue.metadata ? JSON.stringify(cue.metadata) : null,
          cue.status || 'suggested',
        ]
      );
      
      savedCues.push(result.rows[0]);
    }
    
    return savedCues;
  }
}

module.exports = new MusicCueGeneratorService();
