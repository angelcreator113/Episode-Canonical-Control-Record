const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runAIMigrationSQL() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Running AI Editing Tables Migration...\n');
    
    await client.query('BEGIN');
    
    // 1. ai_edit_plans
    console.log('   Creating table: ai_edit_plans');
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_edit_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
        edit_structure JSONB NOT NULL,
        overall_confidence_score DECIMAL(3,2) NOT NULL DEFAULT 0.00,
        status VARCHAR(50) NOT NULL DEFAULT 'draft',
        generated_by VARCHAR(100) NOT NULL DEFAULT 'claude-sonnet-4',
        generation_prompt TEXT,
        user_feedback TEXT,
        approved_at TIMESTAMP,
        approved_by VARCHAR(255),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_ai_edit_plans_episode_id ON ai_edit_plans(episode_id);
      CREATE INDEX IF NOT EXISTS idx_ai_edit_plans_status ON ai_edit_plans(status);
      CREATE INDEX IF NOT EXISTS idx_ai_edit_plans_episode_id_status ON ai_edit_plans(episode_id, status);
    `);
    
    // 2. editing_decisions
    console.log('   Creating table: editing_decisions');
    await client.query(`
      CREATE TABLE IF NOT EXISTS editing_decisions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
        scene_id UUID REFERENCES scenes(id) ON DELETE SET NULL,
        action_type VARCHAR(100) NOT NULL,
        before_state JSONB NOT NULL,
        after_state JSONB NOT NULL,
        context JSONB,
        ai_suggested BOOLEAN NOT NULL DEFAULT FALSE,
        user_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_editing_decisions_episode_id ON editing_decisions(episode_id);
      CREATE INDEX IF NOT EXISTS idx_editing_decisions_scene_id ON editing_decisions(scene_id);
      CREATE INDEX IF NOT EXISTS idx_editing_decisions_action_type ON editing_decisions(action_type);
      CREATE INDEX IF NOT EXISTS idx_editing_decisions_user_id ON editing_decisions(user_id);
      CREATE INDEX IF NOT EXISTS idx_editing_decisions_created_at ON editing_decisions(created_at);
    `);
    
    // 3. ai_revisions
    console.log('   Creating table: ai_revisions');
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_revisions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        original_plan_id UUID NOT NULL REFERENCES ai_edit_plans(id) ON DELETE CASCADE,
        revision_number INTEGER NOT NULL,
        feedback_type VARCHAR(100) NOT NULL,
        user_feedback_text TEXT NOT NULL,
        revised_plan JSONB NOT NULL,
        confidence_score_before DECIMAL(3,2) NOT NULL,
        confidence_score_after DECIMAL(3,2) NOT NULL,
        changes_summary TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_ai_revisions_original_plan_id ON ai_revisions(original_plan_id);
      CREATE INDEX IF NOT EXISTS idx_ai_revisions_original_plan_id_revision_number ON ai_revisions(original_plan_id, revision_number);
    `);
    
    // 4. video_processing_jobs
    console.log('   Creating table: video_processing_jobs');
    await client.query(`
      CREATE TABLE IF NOT EXISTS video_processing_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
        edit_plan_id UUID NOT NULL REFERENCES ai_edit_plans(id) ON DELETE CASCADE,
        status VARCHAR(50) NOT NULL DEFAULT 'queued',
        processing_method VARCHAR(50) NOT NULL,
        complexity_score DECIMAL(3,2),
        estimated_duration_seconds INTEGER,
        processing_duration_seconds INTEGER,
        progress_percentage INTEGER NOT NULL DEFAULT 0,
        output_s3_key VARCHAR(500),
        output_url TEXT,
        error_message TEXT,
        lambda_request_id VARCHAR(255),
        ec2_instance_id VARCHAR(255),
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_video_processing_jobs_episode_id ON video_processing_jobs(episode_id);
      CREATE INDEX IF NOT EXISTS idx_video_processing_jobs_edit_plan_id ON video_processing_jobs(edit_plan_id);
      CREATE INDEX IF NOT EXISTS idx_video_processing_jobs_status ON video_processing_jobs(status);
      CREATE INDEX IF NOT EXISTS idx_video_processing_jobs_processing_method ON video_processing_jobs(processing_method);
    `);
    
    // Trigger for video_processing_jobs
    console.log('   Creating trigger and function for video_processing_jobs');
    await client.query(`
      CREATE OR REPLACE FUNCTION calculate_processing_duration()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.started_at IS NOT NULL AND NEW.completed_at IS NOT NULL THEN
          NEW.processing_duration_seconds := EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at))::INTEGER;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      CREATE TRIGGER update_processing_duration
      BEFORE UPDATE ON video_processing_jobs
      FOR EACH ROW
      EXECUTE FUNCTION calculate_processing_duration();
    `);
    
    // 5. ai_training_data
    console.log('   Creating table: ai_training_data');
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_training_data (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        video_id VARCHAR(255) NOT NULL UNIQUE,
        source_type VARCHAR(50) NOT NULL,
        video_title VARCHAR(500),
        video_url TEXT,
        s3_key VARCHAR(500),
        duration_seconds INTEGER,
        avg_clip_duration DECIMAL(5,2),
        total_clips INTEGER,
        pacing_rhythm VARCHAR(50),
        transition_patterns JSONB,
        overlay_usage JSONB,
        text_style JSONB,
        music_presence BOOLEAN DEFAULT FALSE,
        is_user_style BOOLEAN NOT NULL DEFAULT FALSE,
        analyzed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_ai_training_data_source_type ON ai_training_data(source_type);
      CREATE INDEX IF NOT EXISTS idx_ai_training_data_is_user_style ON ai_training_data(is_user_style);
      CREATE INDEX IF NOT EXISTS idx_ai_training_data_analyzed_at ON ai_training_data(analyzed_at);
    `);
    
    // 6. script_metadata
    console.log('   Creating table: script_metadata');
    await client.query(`
      CREATE TABLE IF NOT EXISTS script_metadata (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        script_id INTEGER NOT NULL REFERENCES episode_scripts(id) ON DELETE CASCADE,
        scene_id VARCHAR(100) NOT NULL,
        scene_type VARCHAR(50) NOT NULL,
        duration_target_seconds INTEGER,
        energy_level VARCHAR(50),
        estimated_clips_needed INTEGER,
        visual_requirements JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_script_metadata_script_id ON script_metadata(script_id);
      CREATE INDEX IF NOT EXISTS idx_script_metadata_script_id_scene_id ON script_metadata(script_id, scene_id);
      CREATE INDEX IF NOT EXISTS idx_script_metadata_scene_type ON script_metadata(scene_type);
    `);
    
    // 7. scene_layer_configuration
    console.log('   Creating table: scene_layer_configuration');
    await client.query(`
      CREATE TABLE IF NOT EXISTS scene_layer_configuration (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scene_id UUID NOT NULL UNIQUE REFERENCES scenes(id) ON DELETE CASCADE,
        layers JSONB NOT NULL,
        composite_complexity VARCHAR(50) NOT NULL DEFAULT 'medium',
        estimated_render_time_seconds INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_scene_layer_configuration_scene_id ON scene_layer_configuration(scene_id);
    `);
    
    // 8. layer_presets
    console.log('   Creating table: layer_presets');
    await client.query(`
      CREATE TABLE IF NOT EXISTS layer_presets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100) NOT NULL,
        layer_template JSONB NOT NULL,
        placeholders JSONB,
        preview_url TEXT,
        is_system_preset BOOLEAN NOT NULL DEFAULT FALSE,
        times_used INTEGER NOT NULL DEFAULT 0,
        created_by VARCHAR(255),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_layer_presets_category ON layer_presets(category);
      CREATE INDEX IF NOT EXISTS idx_layer_presets_is_system_preset ON layer_presets(is_system_preset);
    `);
    
    // 9. Add columns to episodes
    console.log('   Adding columns to table: episodes');
    await client.query(`
      ALTER TABLE episodes ADD COLUMN IF NOT EXISTS ai_edit_enabled BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE episodes ADD COLUMN IF NOT EXISTS current_ai_edit_plan_id UUID REFERENCES ai_edit_plans(id) ON DELETE SET NULL;
      ALTER TABLE episodes ADD COLUMN IF NOT EXISTS final_video_s3_key VARCHAR(500);
      ALTER TABLE episodes ADD COLUMN IF NOT EXISTS rendering_status VARCHAR(50);
      
      CREATE INDEX IF NOT EXISTS idx_episodes_ai_edit_enabled ON episodes(ai_edit_enabled);
      CREATE INDEX IF NOT EXISTS idx_episodes_current_ai_edit_plan_id ON episodes(current_ai_edit_plan_id);
      CREATE INDEX IF NOT EXISTS idx_episodes_rendering_status ON episodes(rendering_status);
    `);
    
    // 10. Add columns to scenes
    console.log('   Adding columns to table: scenes');
    await client.query(`
      ALTER TABLE scenes ADD COLUMN IF NOT EXISTS source_filename VARCHAR(500);
      ALTER TABLE scenes ADD COLUMN IF NOT EXISTS take_number INTEGER;
      ALTER TABLE scenes ADD COLUMN IF NOT EXISTS raw_footage_s3_key VARCHAR(500);
      ALTER TABLE scenes ADD COLUMN IF NOT EXISTS raw_footage_duration DECIMAL(10,2);
      ALTER TABLE scenes ADD COLUMN IF NOT EXISTS raw_footage_metadata JSONB;
      ALTER TABLE scenes ADD COLUMN IF NOT EXISTS ai_selected BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE scenes ADD COLUMN IF NOT EXISTS ai_confidence_score DECIMAL(3,2);
      
      CREATE INDEX IF NOT EXISTS idx_scenes_source_filename ON scenes(source_filename);
      CREATE INDEX IF NOT EXISTS idx_scenes_take_number ON scenes(take_number);
      CREATE INDEX IF NOT EXISTS idx_scenes_ai_selected ON scenes(ai_selected);
    `);
    
    // 11. Add columns to episode_scripts
    console.log('   Adding columns to table: episode_scripts');
    await client.query(`
      ALTER TABLE episode_scripts ADD COLUMN IF NOT EXISTS ai_analysis_enabled BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE episode_scripts ADD COLUMN IF NOT EXISTS last_analyzed_at TIMESTAMP;
      
      CREATE INDEX IF NOT EXISTS idx_episode_scripts_ai_analysis_enabled ON episode_scripts(ai_analysis_enabled);
    `);
    
    // Record the migration
    await client.query(`
      INSERT INTO pgmigrations (name, run_on)
      VALUES ('20260205000001-add-ai-editing-tables', NOW())
      ON CONFLICT (name) DO NOTHING
    `);
    
    await client.query('COMMIT');
    
    console.log('\n✅ AI Editing Tables Migration completed successfully!\n');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runAIMigrationSQL();
