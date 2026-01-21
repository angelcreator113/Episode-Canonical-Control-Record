#!/usr/bin/env node
/**
 * Create scenes table
 */

require('dotenv').config();
const { Client } = require('pg');

async function createTable() {
  const client = new Client({
    host: '127.0.0.1',
    port: 5432,
    database: 'episode_metadata',
    user: 'postgres',
    password: 'Ayanna123',
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected!');
    
    console.log('🔄 Creating scenes table...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS scenes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
        scene_number INTEGER NOT NULL,
        title VARCHAR(255),
        description TEXT,
        duration_seconds INTEGER,
        location VARCHAR(255),
        scene_type VARCHAR(50),
        production_status VARCHAR(50) NOT NULL DEFAULT 'draft',
        mood VARCHAR(100),
        script_notes TEXT,
        start_timecode VARCHAR(20),
        end_timecode VARCHAR(20),
        is_locked BOOLEAN DEFAULT FALSE,
        locked_at TIMESTAMP WITH TIME ZONE,
        locked_by VARCHAR(255),
        characters JSONB DEFAULT '[]',
        created_by VARCHAR(255),
        updated_by VARCHAR(255),
        thumbnail_id UUID,
        assets JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE,
        CONSTRAINT scenes_scene_number_check CHECK (scene_number >= 1),
        CONSTRAINT scenes_scene_type_check CHECK (scene_type IN ('intro', 'main', 'outro', 'transition')),
        CONSTRAINT scenes_production_status_check CHECK (production_status IN ('draft', 'storyboarded', 'recorded', 'edited', 'complete'))
      );
      
      CREATE INDEX IF NOT EXISTS idx_scenes_episode_id ON scenes(episode_id);
      CREATE INDEX IF NOT EXISTS idx_scenes_scene_number ON scenes(scene_number);
      CREATE INDEX IF NOT EXISTS idx_scenes_production_status ON scenes(production_status);
      CREATE INDEX IF NOT EXISTS idx_scenes_scene_type ON scenes(scene_type);
    `);
    
    console.log('✅ Successfully created scenes table');
    
    // Add comments
    await client.query(`
      COMMENT ON TABLE scenes IS 'Individual scenes within episodes';
      COMMENT ON COLUMN scenes.scene_type IS 'Type of scene: intro, main, outro, transition';
      COMMENT ON COLUMN scenes.production_status IS 'Production status: draft, storyboarded, recorded, edited, complete';
      COMMENT ON COLUMN scenes.mood IS 'Scene mood or tone';
      COMMENT ON COLUMN scenes.script_notes IS 'Script or direction notes';
      COMMENT ON COLUMN scenes.characters IS 'Array of character names appearing in scene';
      COMMENT ON COLUMN scenes.assets IS 'DEPRECATED: Use scene_assets table instead';
    `);
    
    console.log('✅ Added table comments');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

createTable()
  .then(() => {
    console.log('✅ Migration complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
