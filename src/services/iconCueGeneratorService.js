/**
 * Icon Cue Generator Service
 * AI-powered generation of icon timeline cues from episode data
 * 
 * Generation Methods:
 * 1. Scene Metadata (Primary) - Reads structured scene data
 * 2. AI Analysis (Fallback) - Analyzes script text for context
 */

const { pool } = require('../db');
const axios = require('axios');

class IconCueGeneratorService {
  
  /**
   * Generate icon cues from episode
   * @param {string} episodeId - Episode UUID
   * @param {object} options - Generation options
   * @returns {object} { iconCues, method, duration_ms }
   */
  async generateFromEpisode(episodeId, options = {}) {
    const startTime = Date.now();
    const { regenerate = false, userId } = options;
    
    try {
      console.log(`[IconCueGenerator] Starting generation for episode ${episodeId}`);
      
      // Step 1: Check if icon cues already exist
      if (!regenerate) {
        const existingCues = await this.getExistingCues(episodeId);
        if (existingCues.length > 0) {
          console.log(`[IconCueGenerator] Found ${existingCues.length} existing cues`);
          return {
            iconCues: existingCues,
            method: 'existing',
            duration_ms: Date.now() - startTime,
          };
        }
      }
      
      // Step 2: Get episode data
      const episodeData = await this.getEpisodeData(episodeId);
      
      // Step 3: Try primary method (scene metadata)
      let iconCues = await this.generateFromSceneMetadata(episodeId, episodeData);
      let method = 'scene_metadata';
      
      // Step 4: Fallback to AI analysis if no scenes or metadata insufficient
      if (!iconCues || iconCues.length === 0) {
        console.log('[IconCueGenerator] Scene metadata insufficient, falling back to AI analysis');
        iconCues = await this.generateFromAIAnalysis(episodeId, episodeData);
        method = 'ai_analysis';
      }
      
      // Step 5: Save generated cues to database
      const savedCues = await this.saveCues(episodeId, iconCues, method, userId);
      
      const duration = Date.now() - startTime;
      console.log(`[IconCueGenerator] Generated ${savedCues.length} cues in ${duration}ms using ${method}`);
      
      return {
        iconCues: savedCues,
        method,
        duration_ms: duration,
      };
      
    } catch (error) {
      console.error('[IconCueGenerator] Error generating icon cues:', error);
      throw error;
    }
  }
  
  /**
   * Get existing icon cues (for non-regenerate mode)
   */
  async getExistingCues(episodeId) {
    const result = await pool.query(
      'SELECT * FROM icon_cues WHERE episode_id = $1 ORDER BY timestamp ASC',
      [episodeId]
    );
    return result.rows;
  }
  
  /**
   * Get episode data (scenes, script, formula)
   */
  async getEpisodeData(episodeId) {
    // Get episode basic info
    const episodeResult = await pool.query(
      'SELECT * FROM episodes WHERE id = $1',
      [episodeId]
    );
    
    if (episodeResult.rows.length === 0) {
      throw new Error('Episode not found');
    }
    
    const episode = episodeResult.rows[0];
    
    // Get scenes with metadata
    const scenesResult = await pool.query(
      `SELECT * FROM scenes 
       WHERE episode_id = $1 
       ORDER BY scene_number ASC`,
      [episodeId]
    );
    
    // Get Lala Formula data if exists
    const formulaResult = await pool.query(
      'SELECT * FROM lala_formula_episodes WHERE episode_id = $1',
      [episodeId]
    );
    
    // Get script if exists
    const scriptResult = await pool.query(
      'SELECT * FROM episode_scripts WHERE episode_id = $1 ORDER BY created_at DESC LIMIT 1',
      [episodeId]
    );
    
    return {
      episode,
      scenes: scenesResult.rows,
      formula: formulaResult.rows[0] || null,
      script: scriptResult.rows[0] || null,
    };
  }
  
  /**
   * Generate from scene metadata (PRIMARY METHOD)
   * Reads structured scene data with icon hints
   */
  async generateFromSceneMetadata(episodeId, episodeData) {
    const { scenes, formula } = episodeData;
    
    if (!scenes || scenes.length === 0) {
      console.log('[IconCueGenerator] No scenes found for metadata method');
      return null;
    }
    
    const iconCues = [];
    
    // Process each scene
    for (const scene of scenes) {
      const sceneMetadata = scene.metadata || {};
      const sceneStart = scene.start_time_seconds || 0;
      
      // Check for icon hints in scene metadata
      if (sceneMetadata.icons_needed) {
        // Scene explicitly lists icons needed
        for (const iconHint of sceneMetadata.icons_needed) {
          const cue = await this.createCueFromHint(iconHint, sceneStart, scene);
          if (cue) iconCues.push(cue);
        }
      }
      
      // Check for interactive elements
      if (sceneMetadata.interactive_elements) {
        for (const element of sceneMetadata.interactive_elements) {
          const cue = await this.createCueFromInteractive(element, sceneStart, scene);
          if (cue) iconCues.push(cue);
        }
      }
      
      // Infer icons from scene type/name
      const inferredCues = await this.inferIconsFromScene(scene);
      iconCues.push(...inferredCues);
    }
    
    // Add formula-based persistent icons (voice, gallery)
    const persistentCues = await this.addPersistentIcons(episodeData);
    iconCues.push(...persistentCues);
    
    return iconCues.length > 0 ? iconCues : null;
  }
  
  /**
   * Create cue from explicit icon hint
   */
  async createCueFromHint(iconHint, sceneStart, scene) {
    // iconHint could be: "voice", "mail", "closet", etc.
    const assetRole = this.iconTypeToAssetRole(iconHint);
    const slotMapping = await this.getSlotMapping(assetRole);
    
    if (!slotMapping) {
      console.warn(`[IconCueGenerator] No slot mapping found for ${iconHint}`);
      return null;
    }
    
    return {
      timestamp: sceneStart + 2.0, // Appear 2s into scene
      slot_id: slotMapping.slot_id,
      action: 'appear',
      transition: 'fade_in',
      duration_ms: 300,
      easing: 'ease-out',
      asset_role: assetRole,
      generated_by: 'scene_metadata',
      generation_confidence: 0.95,
      notes: `Auto-generated from scene: ${scene.name}`,
    };
  }
  
  /**
   * Create cue from interactive element
   */
  async createCueFromInteractive(element, sceneStart, scene) {
    // element: "to_do_list", "closet_open", etc.
    const iconType = element.replace('_open', '').replace('_click', '');
    const assetRole = this.iconTypeToAssetRole(iconType);
    const slotMapping = await this.getSlotMapping(assetRole);
    
    if (!slotMapping) return null;
    
    return {
      timestamp: sceneStart + 5.0, // Interactive elements appear mid-scene
      slot_id: slotMapping.slot_id,
      action: element.includes('open') ? 'open' : 'appear',
      transition: 'slide_in',
      duration_ms: 400,
      easing: 'ease-out',
      asset_role: assetRole,
      generated_by: 'scene_metadata',
      generation_confidence: 0.90,
      notes: `Interactive element: ${element}`,
    };
  }
  
  /**
   * Infer icons from scene type/name
   */
  async inferIconsFromScene(scene) {
    const cues = [];
    const sceneName = (scene.name || '').toLowerCase();
    const sceneType = (scene.type || '').toLowerCase();
    const sceneStart = scene.start_time_seconds || 0;
    
    // Styling Phase → Closet icon
    if (sceneName.includes('styling') || sceneName.includes('wardrobe')) {
      cues.push({
        timestamp: sceneStart + 1.0,
        slot_id: 'slot_2',
        action: 'appear',
        transition: 'fade_in',
        duration_ms: 300,
        asset_role: 'UI.ICON.CLOSET',
        generated_by: 'scene_inference',
        generation_confidence: 0.85,
        notes: 'Inferred from scene name: styling/wardrobe',
      });
    }
    
    // Mail/Message scene → Mail notification
    if (sceneName.includes('mail') || sceneName.includes('message') || sceneName.includes('notification')) {
      cues.push({
        timestamp: sceneStart + 0.5,
        slot_id: 'slot_3',
        action: 'appear',
        transition: 'pop_in',
        duration_ms: 200,
        asset_role: 'UI.ICON.MAIL',
        generated_by: 'scene_inference',
        generation_confidence: 0.90,
        notes: 'Inferred from scene name: mail/notification',
      });
    }
    
    // To-Do List scene
    if (sceneName.includes('to-do') || sceneName.includes('todo') || sceneName.includes('task')) {
      cues.push({
        timestamp: sceneStart + 1.5,
        slot_id: 'slot_2',
        action: 'appear',
        transition: 'slide_in',
        duration_ms: 400,
        asset_role: 'UI.ICON.TODO_LIST',
        generated_by: 'scene_inference',
        generation_confidence: 0.88,
        notes: 'Inferred from scene name: to-do/task',
      });
    }
    
    return cues;
  }
  
  /**
   * Add persistent icons (voice, gallery)
   */
  async addPersistentIcons(episodeData) {
    const cues = [];
    
    // Voice icon (always at 00:08)
    cues.push({
      timestamp: 8.0,
      slot_id: 'slot_1',
      action: 'appear',
      transition: 'fade_in',
      duration_ms: 500,
      asset_role: 'UI.ICON.VOICE.IDLE',
      icon_state: 'idle',
      is_anchor: true,
      anchor_name: 'voice_icon_persistent',
      generated_by: 'persistent_icons',
      generation_confidence: 1.0,
      notes: 'Persistent voice control icon',
    });
    
    // Gallery icon (always visible at bottom-left)
    cues.push({
      timestamp: 10.0,
      slot_id: 'slot_5',
      action: 'appear',
      transition: 'fade_in',
      duration_ms: 500,
      asset_role: 'UI.ICON.GALLERY',
      is_anchor: true,
      anchor_name: 'gallery_icon_persistent',
      generated_by: 'persistent_icons',
      generation_confidence: 1.0,
      notes: 'Persistent gallery/career history icon',
    });
    
    return cues;
  }
  
  /**
   * Generate from AI analysis (FALLBACK METHOD)
   * Uses Claude to analyze script and suggest icon placements
   */
  async generateFromAIAnalysis(episodeId, episodeData) {
    const { episode, script, formula } = episodeData;
    
    if (!script || !script.content) {
      console.log('[IconCueGenerator] No script content for AI analysis');
      return [];
    }
    
    console.log('[IconCueGenerator] Using AI analysis fallback method');
    
    try {
      // Build prompt for Claude
      const prompt = this.buildAIPrompt(episodeData);
      
      // Call Claude API (or use existing AI service)
      const aiResponse = await this.callClaudeAPI(prompt);
      
      // Parse AI response into icon cues
      const iconCues = this.parseAIResponse(aiResponse);
      
      return iconCues;
      
    } catch (error) {
      console.error('[IconCueGenerator] AI analysis failed:', error);
      
      // Ultimate fallback: return basic persistent icons only
      return await this.addPersistentIcons(episodeData);
    }
  }
  
  /**
   * Build AI prompt for icon cue generation
   */
  buildAIPrompt(episodeData) {
    const { episode, script, formula } = episodeData;
    
    return `You are generating icon cue suggestions for a video game-style interactive episode.

Episode: ${episode.title}
Script: ${script.content.substring(0, 2000)}...

Available Icons:
- Slot 1: Voice (persistent control icon)
- Slot 2: Closet, To-Do List, Jewelry Box, Purse, Perfume, Location
- Slot 3: Mail, Bestie News, Coins (notifications)
- Slot 5: Gallery (persistent career history)

Based on the script, suggest icon appearances with timing.

Return JSON array format:
[
  {
    "timestamp": 12.5,
    "slot_id": "slot_2",
    "action": "appear",
    "icon_type": "closet",
    "notes": "Lala mentions wardrobe"
  }
]

Focus on story-relevant moments. Be conservative - only suggest icons when clearly appropriate.`;
  }
  
  /**
   * Call Claude API for AI generation
   */
  async callClaudeAPI(prompt) {
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }
    
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
      }
    );
    
    return response.data.content[0].text;
  }
  
  /**
   * Parse AI response into icon cues
   */
  parseAIResponse(responseText) {
    try {
      // Extract JSON from response (might have markdown backticks)
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.warn('[IconCueGenerator] No JSON array found in AI response');
        return [];
      }
      
      const suggestions = JSON.parse(jsonMatch[0]);
      
      // Convert AI suggestions to icon cue format
      const iconCues = suggestions.map(s => ({
        timestamp: s.timestamp || 0,
        slot_id: s.slot_id || 'slot_2',
        action: s.action || 'appear',
        transition: 'fade_in',
        duration_ms: 300,
        easing: 'ease-out',
        asset_role: this.iconTypeToAssetRole(s.icon_type),
        generated_by: 'ai_analysis',
        generation_confidence: 0.75,
        notes: s.notes || 'AI-generated suggestion',
      }));
      
      return iconCues;
      
    } catch (error) {
      console.error('[IconCueGenerator] Failed to parse AI response:', error);
      return [];
    }
  }
  
  /**
   * Save generated cues to database
   */
  async saveCues(episodeId, iconCues, method, userId) {
    const savedCues = [];
    
    for (const cue of iconCues) {
      // Get asset_id from asset_role if possible
      let assetId = null;
      if (cue.asset_role) {
        const assetResult = await pool.query(
          `SELECT id FROM assets 
           WHERE asset_role = $1 AND episode_id = $2
           ORDER BY created_at DESC LIMIT 1`,
          [cue.asset_role, episodeId]
        );
        
        if (assetResult.rows.length > 0) {
          assetId = assetResult.rows[0].id;
        }
      }
      
      const result = await pool.query(
        `INSERT INTO icon_cues (
          episode_id, asset_id, timestamp, duration_ms, slot_id,
          action, transition, easing, icon_state, position_data,
          is_anchor, anchor_name, status, generated_by, generation_confidence, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *`,
        [
          episodeId,
          assetId,
          cue.timestamp,
          cue.duration_ms || 300,
          cue.slot_id,
          cue.action,
          cue.transition || 'fade_in',
          cue.easing || 'ease-out',
          cue.icon_state || null,
          cue.position_data ? JSON.stringify(cue.position_data) : null,
          cue.is_anchor || false,
          cue.anchor_name || null,
          'suggested', // All generated cues start as suggested
          cue.generated_by || method,
          cue.generation_confidence || 0.80,
          cue.notes || null,
        ]
      );
      
      savedCues.push(result.rows[0]);
    }
    
    return savedCues;
  }
  
  /**
   * Get slot mapping for asset role
   */
  async getSlotMapping(assetRole) {
    const result = await pool.query(
      'SELECT * FROM icon_slot_mappings WHERE asset_role = $1',
      [assetRole]
    );
    
    return result.rows[0] || null;
  }
  
  /**
   * Convert icon type to asset role
   */
  iconTypeToAssetRole(iconType) {
    const mapping = {
      'voice': 'UI.ICON.VOICE.IDLE',
      'voice_idle': 'UI.ICON.VOICE.IDLE',
      'voice_active': 'UI.ICON.VOICE.ACTIVE',
      'closet': 'UI.ICON.CLOSET',
      'to_do': 'UI.ICON.TODO_LIST',
      'todo': 'UI.ICON.TODO_LIST',
      'to_do_list': 'UI.ICON.TODO_LIST',
      'jewelry': 'UI.ICON.JEWELRY_BOX',
      'jewelry_box': 'UI.ICON.JEWELRY_BOX',
      'purse': 'UI.ICON.PURSE',
      'perfume': 'UI.ICON.PERFUME',
      'location': 'UI.ICON.LOCATION',
      'mail': 'UI.ICON.MAIL',
      'bestie_news': 'UI.ICON.BESTIE_NEWS',
      'coins': 'UI.ICON.COINS',
      'gallery': 'UI.ICON.GALLERY',
      'career_history': 'UI.ICON.CAREER_HISTORY',
    };
    
    return mapping[iconType.toLowerCase()] || 'UI.ICON.RESERVED';
  }
}

module.exports = new IconCueGeneratorService();
