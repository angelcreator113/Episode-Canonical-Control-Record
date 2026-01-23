/**
 * Migration: Create scene_templates table
 * Date: 2026-01-16
 * 
 * Scene templates provide reusable scene structures and settings
 * that can be applied when creating new scenes.
 */

exports.up = (pgm) => {
  pgm.createTable('scene_templates', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    name: {
      type: 'varchar(200)',
      notNull: true,
    },
    description: {
      type: 'text',
    },
    scene_type: {
      type: 'varchar(50)',
      default: 'main',
    },
    mood: {
      type: 'varchar(50)',
    },
    location: {
      type: 'varchar(255)',
    },
    duration_seconds: {
      type: 'integer',
    },
    structure: {
      type: 'jsonb',
      default: '{}',
    },
    default_settings: {
      type: 'jsonb',
      default: '{}',
    },
    created_by: {
      type: 'uuid',
    },
    is_public: {
      type: 'boolean',
      default: false,
      notNull: true,
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Create indexes for common queries
  pgm.createIndex('scene_templates', 'created_by', { 
    name: 'idx_scene_templates_created_by' 
  });
  
  pgm.createIndex('scene_templates', 'is_public', { 
    name: 'idx_scene_templates_is_public' 
  });
  
  pgm.createIndex('scene_templates', 'scene_type', { 
    name: 'idx_scene_templates_scene_type' 
  });

  // Insert default templates
  pgm.sql(`
    INSERT INTO scene_templates (name, description, scene_type, mood, structure, is_public)
    VALUES 
      (
        'Standard Interview',
        'Basic interview setup with intro and outro',
        'main',
        'neutral',
        '{"sections": ["intro", "questions", "conclusion"], "duration_per_section": [30, 300, 30]}'::jsonb,
        true
      ),
      (
        'Product Review',
        'Product showcase and demonstration',
        'main',
        'upbeat',
        '{"sections": ["unboxing", "features", "demo", "verdict"], "duration_per_section": [60, 120, 180, 60]}'::jsonb,
        true
      ),
      (
        'Tutorial Scene',
        'Step-by-step instructional scene',
        'main',
        'serious',
        '{"sections": ["intro", "step_1", "step_2", "step_3", "recap"], "duration_per_section": [30, 120, 120, 120, 30]}'::jsonb,
        true
      ),
      (
        'Vlog Opening',
        'Engaging intro for vlogs',
        'intro',
        'upbeat',
        '{"elements": ["hook", "greeting", "topic_intro"], "style": "energetic"}'::jsonb,
        true
      )
  `);
};

exports.down = (pgm) => {
  pgm.dropTable('scene_templates');
};
