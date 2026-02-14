// beatService.js - Beat Auto-Generation Service
// Phase 2.5: Animatic System

const { Beat, CharacterClip, Scene, CharacterProfile } = require('../models');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');

/**
 * Beat Generation Service
 * 
 * Automatically generates timeline beats from script lines
 * Creates the bridge between script and timeline
 */

class BeatService {
  /**
   * Generate beats from script lines for a scene
   * 
   * @param {string} sceneId - UUID of the scene
   * @param {Array} scriptLines - Array of script line objects
   * @param {Object} options - Generation options
   * @returns {Array} Generated beats
   * 
   * Script line format:
   * {
   *   id: 'line-uuid',
   *   character_id: 'char-uuid',
   *   character_name: 'LaLa',
   *   dialogue: 'How are you feeling today?',
   *   emotion: 'curious',
   *   estimated_duration: 2.5  // seconds (optional)
   * }
   */
  async generateBeatsFromScript(sceneId, scriptLines, options = {}) {
    const {
      defaultDuration = 2.5,  // Default duration if not specified
      paddingBetweenLines = 0.3,  // Pause between dialogue lines
      autoGenerateIdle = true,  // Generate idle beats automatically
      includeUIBeats = true   // Include UI action beats
    } = options;

    try {
      const beats = [];
      let currentTime = 0;

      // Process each script line
      for (let i = 0; i < scriptLines.length; i++) {
        const line = scriptLines[i];
        const duration = line.estimated_duration || defaultDuration;

        // Create dialogue beat
        const dialogueBeat = {
          id: uuidv4(),
          scene_id: sceneId,
          beat_type: 'dialogue',
          character_id: line.character_id,
          label: `${line.character_name}: ${this.truncateText(line.dialogue, 30)}`,
          start_time: currentTime,
          duration: duration,
          payload: {
            line: line.dialogue,
            emotion: line.emotion || 'neutral',
            script_line_id: line.id,
            character_name: line.character_name
          },
          status: 'draft'
        };

        beats.push(dialogueBeat);
        currentTime += duration;

        // Add padding before next line (if not last line)
        if (i < scriptLines.length - 1) {
          currentTime += paddingBetweenLines;
        }

        // Check if UI action should be triggered after this line
        if (includeUIBeats && line.ui_actions) {
          for (const action of line.ui_actions) {
            const uiBeat = {
              id: uuidv4(),
              scene_id: sceneId,
              beat_type: 'ui_action',
              character_id: null,
              label: action.label || `UI: ${action.type}`,
              start_time: currentTime - 0.5, // Slight overlap
              duration: action.duration || 1.0,
              payload: {
                action_type: action.type,
                element: action.element,
                parameters: action.parameters || {}
              },
              status: 'draft'
            };

            beats.push(uiBeat);
          }
        }
      }

      // Insert beats into database using Sequelize
      const insertedBeats = await this.bulkCreateBeats(beats);

      // If auto-generate idle enabled, create idle character clips
      if (autoGenerateIdle) {
        await this.generateIdleClips(sceneId, insertedBeats);
      }

      return insertedBeats;
    } catch (error) {
      console.error('Error generating beats:', error);
      throw error;
    }
  }

  /**
   * Bulk create beats in database using Sequelize
   */
  async bulkCreateBeats(beats) {
    if (beats.length === 0) return [];

    const createdBeats = await Beat.bulkCreate(beats, {
      returning: true,
      validate: true
    });

    return createdBeats;
  }

  /**
   * Generate idle character clips based on dialogue beats
   * When a character is NOT speaking, they need idle animation
   */
  async generateIdleClips(sceneId, beats) {
    try {
      // Get scene duration
      const scene = await Scene.findByPk(sceneId, {
        attributes: ['duration_seconds']
      });

      if (!scene) {
        throw new Error('Scene not found');
      }

      const sceneDuration = parseFloat(scene.duration_seconds);

      // Get all characters in this scene
      const uniqueCharacters = await Beat.findAll({
        where: {
          scene_id: sceneId,
          character_id: { [Op.ne]: null }
        },
        attributes: ['character_id'],
        group: ['character_id'],
        raw: true
      });

      const characterIds = uniqueCharacters.map(b => b.character_id);

      // For each character, find their speaking ranges
      const idleClips = [];

      for (const characterId of characterIds) {
        const speakingRanges = beats
          .filter(b => b.character_id === characterId && b.beat_type === 'dialogue')
          .map(b => ({
            start: parseFloat(b.start_time),
            end: parseFloat(b.start_time) + parseFloat(b.duration)
          }))
          .sort((a, b) => a.start - b.start);

        // Find idle ranges (gaps between speaking)
        const idleRanges = this.findIdleRanges(speakingRanges, sceneDuration);

        // Create idle clips for each idle range
        for (const range of idleRanges) {
          // Determine idle type based on context
          const idleType = this.determineIdleType(range, beats);

          const idleClip = {
            id: uuidv4(),
            scene_id: sceneId,
            character_id: characterId,
            beat_id: null,
            role: 'idle',
            start_time: range.start,
            duration: range.duration,
            video_url: null,  // Placeholder
            expression: idleType.expression,
            animation_type: idleType.animation,
            metadata: {
              auto_generated: true,
              context: idleType.context
            },
            status: 'placeholder'
          };

          idleClips.push(idleClip);
        }
      }

      // Insert idle clips
      if (idleClips.length > 0) {
        await this.bulkCreateCharacterClips(idleClips);
      }

      return idleClips;
    } catch (error) {
      console.error('Error generating idle clips:', error);
      throw error;
    }
  }

  /**
   * Find idle ranges (gaps between speaking)
   */
  findIdleRanges(speakingRanges, totalDuration) {
    const idleRanges = [];
    let lastEnd = 0;

    for (const range of speakingRanges) {
      if (range.start > lastEnd + 0.1) {  // At least 0.1s gap
        idleRanges.push({
          start: lastEnd,
          duration: range.start - lastEnd,
          end: range.start
        });
      }
      lastEnd = range.end;
    }

    // Add final idle range if scene continues after last speech
    if (lastEnd < totalDuration - 0.1) {
      idleRanges.push({
        start: lastEnd,
        duration: totalDuration - lastEnd,
        end: totalDuration
      });
    }

    return idleRanges;
  }

  /**
   * Determine idle animation type based on context
   */
  determineIdleType(range, beats) {
    // Find what's happening during this idle period
    const overlappingBeats = beats.filter(b => {
      const beatStart = parseFloat(b.start_time);
      const beatEnd = beatStart + parseFloat(b.duration);
      return beatStart < range.end && beatEnd > range.start;
    });

    // Check if someone else is speaking (character should be listening)
    const dialogueBeat = overlappingBeats.find(b => b.beat_type === 'dialogue');

    if (dialogueBeat) {
      // Someone is speaking - character is listening
      const emotion = dialogueBeat.payload.emotion;

      // Match listening expression to speaker's emotion
      const expressionMap = {
        excited: 'interested',
        happy: 'pleased',
        sad: 'concerned',
        angry: 'cautious',
        curious: 'engaged',
        neutral: 'attentive'
      };

      return {
        animation: 'listening',
        expression: expressionMap[emotion] || 'attentive',
        context: `listening_to_${dialogueBeat.payload.character_name}`
      };
    }

    // No one speaking - default idle
    return {
      animation: 'neutral_idle',
      expression: 'neutral',
      context: 'ambient'
    };
  }

  /**
   * Bulk create character clips using Sequelize
   */
  async bulkCreateCharacterClips(clips) {
    if (clips.length === 0) return [];

    const createdClips = await CharacterClip.bulkCreate(clips, {
      returning: true,
      validate: true
    });

    return createdClips;
  }

  /**
   * Get all beats for a scene
   */
  async getSceneBeats(sceneId, options = {}) {
    const { includeCharacter = false } = options;

    const queryOptions = {
      where: { scene_id: sceneId },
      order: [['start_time', 'ASC']]
    };

    // Optionally include character if available
    if (includeCharacter && CharacterProfile) {
      try {
        queryOptions.include = [
          {
            model: CharacterProfile,
            as: 'character',
            attributes: ['id', 'character_name', 'display_name'],
            required: false
          }
        ];
      } catch (error) {
        console.warn('Could not include CharacterProfile:', error.message);
      }
    }

    const beats = await Beat.findAll(queryOptions);
    return beats;
  }

  /**
   * Get all character clips for a scene
   */
  async getSceneCharacterClips(sceneId, options = {}) {
    const { includeAssociations = false } = options;

    const queryOptions = {
      where: { scene_id: sceneId },
      order: [
        ['character_id', 'ASC'],
        ['start_time', 'ASC']
      ]
    };

    // Optionally include associations if available
    if (includeAssociations) {
      const includes = [];

      if (CharacterProfile) {
        includes.push({
          model: CharacterProfile,
          as: 'character',
          attributes: ['id', 'character_name', 'display_name'],
          required: false
        });
      }

      if (Beat) {
        includes.push({
          model: Beat,
          as: 'beat',
          attributes: ['id', 'label', 'beat_type'],
          required: false
        });
      }

      if (includes.length > 0) {
        queryOptions.include = includes;
      }
    }

    const clips = await CharacterClip.findAll(queryOptions);
    return clips;
  }

  /**
   * Update beat
   */
  async updateBeat(beatId, updates) {
    const beat = await Beat.findByPk(beatId);

    if (!beat) {
      throw new Error('Beat not found');
    }

    const allowedFields = ['label', 'start_time', 'duration', 'payload', 'status'];
    const filteredUpdates = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      throw new Error('No valid fields to update');
    }

    await beat.update(filteredUpdates);
    return beat;
  }

  /**
   * Delete beat
   */
  async deleteBeat(beatId) {
    const beat = await Beat.findByPk(beatId);

    if (!beat) {
      throw new Error('Beat not found');
    }

    await beat.destroy();
    return beat;
  }

  /**
   * Generate placeholder character clips for all dialogue beats
   * Creates one clip per speaking beat
   */
  async generateDialogueClips(sceneId) {
    try {
      const dialogueBeats = await Beat.findAll({
        where: {
          scene_id: sceneId,
          beat_type: 'dialogue',
          character_id: { [Op.ne]: null }
        }
      });

      const clips = dialogueBeats.map(beat => ({
        id: uuidv4(),
        scene_id: sceneId,
        character_id: beat.character_id,
        beat_id: beat.id,
        role: 'dialogue',
        start_time: beat.start_time,
        duration: beat.duration,
        video_url: null,
        expression: beat.payload.emotion || 'neutral',
        animation_type: 'speaking',
        metadata: {
          auto_generated: true,
          script_line_id: beat.payload.script_line_id
        },
        status: 'placeholder'
      }));

      const createdClips = await this.bulkCreateCharacterClips(clips);
      return createdClips;
    } catch (error) {
      console.error('Error generating dialogue clips:', error);
      throw error;
    }
  }

  /**
   * Analyze scene script and return generation preview
   * Shows what will be generated without creating anything
   */
  async previewGeneration(sceneId, scriptLines, options = {}) {
    const {
      defaultDuration = 2.5,
      paddingBetweenLines = 0.3,
      autoGenerateIdle = true,
      includeUIBeats = true
    } = options;

    const preview = {
      total_duration: 0,
      beat_count: 0,
      dialogue_count: 0,
      ui_action_count: 0,
      character_clip_count: 0,
      idle_clip_count: 0,
      characters: new Set(),
      timeline: []
    };

    let currentTime = 0;

    for (let i = 0; i < scriptLines.length; i++) {
      const line = scriptLines[i];
      const duration = line.estimated_duration || defaultDuration;

      preview.timeline.push({
        type: 'dialogue',
        character: line.character_name,
        start: currentTime,
        duration: duration,
        text: this.truncateText(line.dialogue, 50)
      });

      preview.beat_count++;
      preview.dialogue_count++;
      preview.character_clip_count++;
      preview.characters.add(line.character_name);

      currentTime += duration;

      if (i < scriptLines.length - 1) {
        currentTime += paddingBetweenLines;
      }

      if (includeUIBeats && line.ui_actions) {
        preview.ui_action_count += line.ui_actions.length;
        preview.beat_count += line.ui_actions.length;
      }
    }

    preview.total_duration = currentTime;
    preview.characters = Array.from(preview.characters);

    // Estimate idle clips (rough calculation)
    if (autoGenerateIdle) {
      preview.idle_clip_count = Math.floor(
        preview.characters.length * preview.dialogue_count * 0.7
      );
      preview.character_clip_count += preview.idle_clip_count;
    }

    return preview;
  }

  /**
   * Utility: Truncate text with ellipsis
   */
  truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Clear all beats and character clips for a scene
   * Useful for regenerating from scratch
   */
  async clearSceneBeats(sceneId) {
    try {
      // Delete all character clips first (foreign key constraint)
      const clipsDeleted = await CharacterClip.destroy({
        where: { scene_id: sceneId }
      });

      // Delete all beats
      const beatsDeleted = await Beat.destroy({
        where: { scene_id: sceneId }
      });

      return {
        beats_deleted: beatsDeleted,
        clips_deleted: clipsDeleted
      };
    } catch (error) {
      console.error('Error clearing scene beats:', error);
      throw error;
    }
  }
}

module.exports = new BeatService();
