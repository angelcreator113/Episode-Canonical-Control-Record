const { sequelize } = require('./src/models');

async function createSceneLibraryTables() {
  try {
    await sequelize.authenticate();
    console.log('✓ Database connected\n');

    // Create scene_library table
    console.log('Creating scene_library table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS scene_library (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        show_id UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE ON UPDATE CASCADE,
        video_asset_url TEXT,
        thumbnail_url TEXT,
        title VARCHAR(255),
        description TEXT,
        characters TEXT[],
        tags TEXT[],
        duration_seconds DECIMAL(10, 3),
        resolution VARCHAR(50),
        file_size_bytes BIGINT,
        processing_status VARCHAR(20) NOT NULL DEFAULT 'uploading',
        processing_error TEXT,
        s3_key TEXT,
        created_by VARCHAR(255),
        updated_by VARCHAR(255),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );
    `);
    console.log('✓ scene_library table created');

    // Create indexes
    console.log('Creating indexes...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_scene_library_show_id ON scene_library(show_id);
      CREATE INDEX IF NOT EXISTS idx_scene_library_processing_status ON scene_library(processing_status);
      CREATE INDEX IF NOT EXISTS idx_scene_library_created_at ON scene_library(created_at);
      CREATE INDEX IF NOT EXISTS idx_scene_library_tags ON scene_library USING GIN (tags);
      CREATE INDEX IF NOT EXISTS idx_scene_library_characters ON scene_library USING GIN (characters);
    `);
    console.log('✓ Indexes created');

    // Create episode_scenes table
    console.log('\nCreating episode_scenes table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS episode_scenes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE ON UPDATE CASCADE,
        scene_library_id UUID NOT NULL REFERENCES scene_library(id) ON DELETE CASCADE ON UPDATE CASCADE,
        scene_order INTEGER NOT NULL DEFAULT 0,
        trim_start DECIMAL(10, 3) DEFAULT 0,
        trim_end DECIMAL(10, 3),
        scene_type VARCHAR(50) DEFAULT 'main',
        episode_notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );
    `);
    console.log('✓ episode_scenes table created');

    // Create indexes for episode_scenes
    console.log('Creating episode_scenes indexes...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_episode_scenes_episode_id ON episode_scenes(episode_id);
      CREATE INDEX IF NOT EXISTS idx_episode_scenes_scene_library_id ON episode_scenes(scene_library_id);
      CREATE INDEX IF NOT EXISTS idx_episode_scenes_order ON episode_scenes(episode_id, scene_order);
    `);
    console.log('✓ episode_scenes indexes created');

    console.log('\n✅ All scene library tables created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

createSceneLibraryTables();
