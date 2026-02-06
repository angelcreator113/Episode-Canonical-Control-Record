/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // ============================================================
  // 1. CREATE NEW TABLE: ai_edit_plans
  // ============================================================
  pgm.createTable('ai_edit_plans', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    episode_id: {
      type: 'uuid',
      notNull: true,
      references: 'episodes',
      onDelete: 'CASCADE',
    },
    edit_structure: {
      type: 'jsonb',
      notNull: true,
      comment: 'Complete timeline with clips, transitions, layers',
    },
    overall_confidence_score: {
      type: 'decimal(3,2)',
      notNull: true,
      default: 0.00,
      comment: 'AI confidence 0.00-1.00',
    },
    status: {
      type: 'varchar(50)',
      notNull: true,
      default: 'draft',
      comment: 'draft | awaiting_approval | approved | rejected',
    },
    generated_by: {
      type: 'varchar(100)',
      notNull: true,
      default: 'claude-sonnet-4',
    },
    generation_prompt: {
      type: 'text',
      comment: 'Prompt used to generate this plan',
    },
    user_feedback: {
      type: 'text',
      comment: 'User feedback if rejected',
    },
    approved_at: {
      type: 'timestamp',
    },
    approved_by: {
      type: 'varchar(255)',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    deleted_at: {
      type: 'timestamp',
    },
  });

  pgm.createIndex('ai_edit_plans', 'episode_id');
  pgm.createIndex('ai_edit_plans', 'status');
  pgm.createIndex('ai_edit_plans', ['episode_id', 'status']);

  // ============================================================
  // 2. CREATE NEW TABLE: editing_decisions
  // ============================================================
  pgm.createTable('editing_decisions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    episode_id: {
      type: 'uuid',
      notNull: true,
      references: 'episodes',
      onDelete: 'CASCADE',
    },
    scene_id: {
      type: 'uuid',
      references: 'scenes',
      onDelete: 'SET NULL',
    },
    action_type: {
      type: 'varchar(100)',
      notNull: true,
      comment: 'TRIM_CLIP | REORDER_CLIPS | SELECT_TAKE | CHANGE_TRANSITION | etc.',
    },
    before_state: {
      type: 'jsonb',
      notNull: true,
      comment: 'State before user action',
    },
    after_state: {
      type: 'jsonb',
      notNull: true,
      comment: 'State after user action',
    },
    context: {
      type: 'jsonb',
      comment: 'Scene type, energy level, timing context',
    },
    ai_suggested: {
      type: 'boolean',
      notNull: true,
      default: false,
      comment: 'Was this action originally suggested by AI?',
    },
    user_id: {
      type: 'varchar(255)',
      notNull: true,
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('editing_decisions', 'episode_id');
  pgm.createIndex('editing_decisions', 'scene_id');
  pgm.createIndex('editing_decisions', 'action_type');
  pgm.createIndex('editing_decisions', 'user_id');
  pgm.createIndex('editing_decisions', 'created_at');

  // ============================================================
  // 3. CREATE NEW TABLE: ai_revisions
  // ============================================================
  pgm.createTable('ai_revisions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    original_plan_id: {
      type: 'uuid',
      notNull: true,
      references: 'ai_edit_plans',
      onDelete: 'CASCADE',
    },
    revision_number: {
      type: 'integer',
      notNull: true,
      comment: 'Incremental revision number (1, 2, 3)',
    },
    feedback_type: {
      type: 'varchar(100)',
      notNull: true,
      comment: 'pacing_too_slow | transitions_jarring | wrong_clips | etc.',
    },
    user_feedback_text: {
      type: 'text',
      notNull: true,
    },
    revised_plan: {
      type: 'jsonb',
      notNull: true,
      comment: 'New edit structure based on feedback',
    },
    confidence_score_before: {
      type: 'decimal(3,2)',
      notNull: true,
    },
    confidence_score_after: {
      type: 'decimal(3,2)',
      notNull: true,
    },
    changes_summary: {
      type: 'text',
      comment: 'AI explanation of what changed',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('ai_revisions', 'original_plan_id');
  pgm.createIndex('ai_revisions', ['original_plan_id', 'revision_number']);

  // ============================================================
  // 4. CREATE NEW TABLE: video_processing_jobs
  // ============================================================
  pgm.createTable('video_processing_jobs', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    episode_id: {
      type: 'uuid',
      notNull: true,
      references: 'episodes',
      onDelete: 'CASCADE',
    },
    edit_plan_id: {
      type: 'uuid',
      notNull: true,
      references: 'ai_edit_plans',
      onDelete: 'CASCADE',
    },
    status: {
      type: 'varchar(50)',
      notNull: true,
      default: 'queued',
      comment: 'queued | processing | completed | failed | cancelled',
    },
    processing_method: {
      type: 'varchar(50)',
      notNull: true,
      comment: 'lambda | ec2',
    },
    complexity_score: {
      type: 'decimal(3,2)',
      comment: 'Estimated complexity (0.00-1.00)',
    },
    estimated_duration_seconds: {
      type: 'integer',
      comment: 'Estimated processing time',
    },
    processing_duration_seconds: {
      type: 'integer',
      comment: 'Actual processing time (calculated by trigger)',
    },
    progress_percentage: {
      type: 'integer',
      notNull: true,
      default: 0,
      comment: '0-100',
    },
    output_s3_key: {
      type: 'varchar(500)',
      comment: 'S3 key of final rendered video',
    },
    output_url: {
      type: 'text',
      comment: 'Presigned URL for final video',
    },
    error_message: {
      type: 'text',
    },
    lambda_request_id: {
      type: 'varchar(255)',
    },
    ec2_instance_id: {
      type: 'varchar(255)',
    },
    started_at: {
      type: 'timestamp',
    },
    completed_at: {
      type: 'timestamp',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('video_processing_jobs', 'episode_id');
  pgm.createIndex('video_processing_jobs', 'edit_plan_id');
  pgm.createIndex('video_processing_jobs', 'status');
  pgm.createIndex('video_processing_jobs', 'processing_method');

  // Trigger to calculate processing_duration_seconds
  pgm.sql(`
    CREATE OR REPLACE FUNCTION calculate_processing_duration()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.started_at IS NOT NULL AND NEW.completed_at IS NOT NULL THEN
        NEW.processing_duration_seconds := EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at))::INTEGER;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  pgm.sql(`
    CREATE TRIGGER update_processing_duration
    BEFORE UPDATE ON video_processing_jobs
    FOR EACH ROW
    EXECUTE FUNCTION calculate_processing_duration();
  `);

  // ============================================================
  // 5. CREATE NEW TABLE: ai_training_data
  // ============================================================
  pgm.createTable('ai_training_data', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    video_id: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
      comment: 'YouTube video ID or internal identifier',
    },
    source_type: {
      type: 'varchar(50)',
      notNull: true,
      comment: 'youtube_user | youtube_inspiration | manual_upload',
    },
    video_title: {
      type: 'varchar(500)',
    },
    video_url: {
      type: 'text',
    },
    s3_key: {
      type: 'varchar(500)',
      comment: 'S3 key if downloaded',
    },
    duration_seconds: {
      type: 'integer',
    },
    avg_clip_duration: {
      type: 'decimal(5,2)',
      comment: 'Average clip duration in seconds',
    },
    total_clips: {
      type: 'integer',
    },
    pacing_rhythm: {
      type: 'varchar(50)',
      comment: 'fast | medium | slow | dynamic',
    },
    transition_patterns: {
      type: 'jsonb',
      comment: 'Cut, dissolve, wipe frequencies',
    },
    overlay_usage: {
      type: 'jsonb',
      comment: 'How overlays are used',
    },
    text_style: {
      type: 'jsonb',
      comment: 'Font, size, animation patterns',
    },
    music_presence: {
      type: 'boolean',
      default: false,
    },
    is_user_style: {
      type: 'boolean',
      notNull: true,
      default: false,
      comment: 'Is this the user\'s own content?',
    },
    analyzed_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('ai_training_data', 'source_type');
  pgm.createIndex('ai_training_data', 'is_user_style');
  pgm.createIndex('ai_training_data', 'analyzed_at');

  // ============================================================
  // 6. CREATE NEW TABLE: script_metadata
  // ============================================================
  pgm.createTable('script_metadata', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    script_id: {
      type: 'uuid',
      notNull: true,
      references: 'episode_scripts',
      onDelete: 'CASCADE',
    },
    scene_id: {
      type: 'varchar(100)',
      notNull: true,
      comment: 'Scene identifier from script (e.g., INTRO, MAIN-1)',
    },
    scene_type: {
      type: 'varchar(50)',
      notNull: true,
      comment: 'intro | main | transition | outro',
    },
    duration_target_seconds: {
      type: 'integer',
      comment: 'AI-suggested duration',
    },
    energy_level: {
      type: 'varchar(50)',
      comment: 'high | medium | low',
    },
    estimated_clips_needed: {
      type: 'integer',
      comment: 'How many clips AI estimates are needed',
    },
    visual_requirements: {
      type: 'jsonb',
      comment: 'Suggested visuals (wardrobe, B-roll, etc.)',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('script_metadata', 'script_id');
  pgm.createIndex('script_metadata', ['script_id', 'scene_id']);
  pgm.createIndex('script_metadata', 'scene_type');

  // ============================================================
  // 7. CREATE NEW TABLE: scene_layer_configuration
  // ============================================================
  pgm.createTable('scene_layer_configuration', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    scene_id: {
      type: 'uuid',
      notNull: true,
      unique: true,
      references: 'scenes',
      onDelete: 'CASCADE',
    },
    layers: {
      type: 'jsonb',
      notNull: true,
      comment: '5-layer structure with placeholders or actual content',
    },
    composite_complexity: {
      type: 'varchar(50)',
      notNull: true,
      default: 'medium',
      comment: 'simple | medium | complex',
    },
    estimated_render_time_seconds: {
      type: 'integer',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('scene_layer_configuration', 'scene_id');

  // ============================================================
  // 8. CREATE NEW TABLE: layer_presets
  // ============================================================
  pgm.createTable('layer_presets', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
    },
    description: {
      type: 'text',
    },
    category: {
      type: 'varchar(100)',
      notNull: true,
      comment: 'intro | main_content | product_showcase | outro',
    },
    layer_template: {
      type: 'jsonb',
      notNull: true,
      comment: '5-layer template with placeholders',
    },
    placeholders: {
      type: 'jsonb',
      comment: 'List of placeholders (BACKGROUND_IMAGE, MAIN_CLIP, etc.)',
    },
    preview_url: {
      type: 'text',
    },
    is_system_preset: {
      type: 'boolean',
      notNull: true,
      default: false,
      comment: 'True if built-in, false if user-created',
    },
    times_used: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    created_by: {
      type: 'varchar(255)',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    deleted_at: {
      type: 'timestamp',
    },
  });

  pgm.createIndex('layer_presets', 'category');
  pgm.createIndex('layer_presets', 'is_system_preset');

  // ============================================================
  // 9. MODIFY EXISTING TABLE: episodes
  // ============================================================
  pgm.addColumns('episodes', {
    ai_edit_enabled: {
      type: 'boolean',
      notNull: true,
      default: false,
      comment: 'Enable AI editing features for this episode',
    },
    current_ai_edit_plan_id: {
      type: 'uuid',
      references: 'ai_edit_plans',
      onDelete: 'SET NULL',
      comment: 'Active AI edit plan',
    },
    final_video_s3_key: {
      type: 'varchar(500)',
      comment: 'S3 key of final rendered video',
    },
    rendering_status: {
      type: 'varchar(50)',
      comment: 'not_started | queued | rendering | completed | failed',
    },
  });

  pgm.createIndex('episodes', 'ai_edit_enabled');
  pgm.createIndex('episodes', 'current_ai_edit_plan_id');
  pgm.createIndex('episodes', 'rendering_status');

  // ============================================================
  // 10. MODIFY EXISTING TABLE: scenes
  // ============================================================
  pgm.addColumns('scenes', {
    source_filename: {
      type: 'varchar(500)',
      comment: 'Original filename (e.g., EPISODE-SCENE-TAKE-1.mp4)',
    },
    take_number: {
      type: 'integer',
      comment: 'Take number extracted from filename',
    },
    raw_footage_s3_key: {
      type: 'varchar(500)',
      comment: 'S3 key for raw uploaded footage',
    },
    raw_footage_duration: {
      type: 'decimal(10,2)',
      comment: 'Duration in seconds from FFmpeg metadata',
    },
    raw_footage_metadata: {
      type: 'jsonb',
      comment: 'FFmpeg metadata (resolution, codec, framerate, etc.)',
    },
    ai_selected: {
      type: 'boolean',
      notNull: true,
      default: false,
      comment: 'Was this clip selected by AI for use?',
    },
    ai_confidence_score: {
      type: 'decimal(3,2)',
      comment: 'AI confidence if selected (0.00-1.00)',
    },
  });

  pgm.createIndex('scenes', 'source_filename');
  pgm.createIndex('scenes', 'take_number');
  pgm.createIndex('scenes', 'ai_selected');

  // ============================================================
  // 11. MODIFY EXISTING TABLE: episode_scripts
  // ============================================================
  pgm.addColumns('episode_scripts', {
    ai_analysis_enabled: {
      type: 'boolean',
      notNull: true,
      default: false,
      comment: 'Enable AI scene detection for this script',
    },
    last_analyzed_at: {
      type: 'timestamp',
      comment: 'Last time AI analyzed this script',
    },
  });

  pgm.createIndex('episode_scripts', 'ai_analysis_enabled');
};

exports.down = (pgm) => {
  // Drop in reverse order to handle dependencies

  // Remove columns from existing tables
  pgm.dropColumns('episode_scripts', ['ai_analysis_enabled', 'last_analyzed_at']);
  pgm.dropColumns('scenes', [
    'source_filename',
    'take_number',
    'raw_footage_s3_key',
    'raw_footage_duration',
    'raw_footage_metadata',
    'ai_selected',
    'ai_confidence_score',
  ]);
  pgm.dropColumns('episodes', [
    'ai_edit_enabled',
    'current_ai_edit_plan_id',
    'final_video_s3_key',
    'rendering_status',
  ]);

  // Drop new tables
  pgm.dropTable('layer_presets');
  pgm.dropTable('scene_layer_configuration');
  pgm.dropTable('script_metadata');
  pgm.dropTable('ai_training_data');

  // Drop trigger and function for video_processing_jobs
  pgm.sql('DROP TRIGGER IF EXISTS update_processing_duration ON video_processing_jobs;');
  pgm.sql('DROP FUNCTION IF EXISTS calculate_processing_duration();');

  pgm.dropTable('video_processing_jobs');
  pgm.dropTable('ai_revisions');
  pgm.dropTable('editing_decisions');
  pgm.dropTable('ai_edit_plans');
};
