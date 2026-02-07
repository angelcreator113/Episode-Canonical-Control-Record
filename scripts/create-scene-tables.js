const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: console.log
});

async function createTables() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Create video_scenes table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS video_scenes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        training_video_id UUID REFERENCES ai_training_data(id) ON DELETE CASCADE,
        scene_number INTEGER NOT NULL,
        start_time DECIMAL(10,3) NOT NULL,
        end_time DECIMAL(10,3) NOT NULL,
        duration DECIMAL(10,3) NOT NULL,
        thumbnail_url TEXT,
        thumbnail_s3_key VARCHAR(500),
        scene_type VARCHAR(100),
        shot_type VARCHAR(100),
        scene_description TEXT,
        has_text_overlay BOOLEAN DEFAULT false,
        has_music BOOLEAN DEFAULT false,
        brightness_level VARCHAR(50),
        motion_level VARCHAR(50),
        color_palette JSONB,
        analysis_result JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_scenes_video ON video_scenes(training_video_id);
      CREATE INDEX IF NOT EXISTS idx_scenes_number ON video_scenes(scene_number);
      CREATE INDEX IF NOT EXISTS idx_scenes_type ON video_scenes(scene_type);
    `);

    console.log('✅ video_scenes table created');

    // Create scene_patterns table (learned patterns)
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS scene_patterns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pattern_name VARCHAR(255) NOT NULL,
        pattern_type VARCHAR(100) NOT NULL,
        description TEXT,
        average_duration DECIMAL(10,3),
        typical_position VARCHAR(50),
        common_characteristics JSONB,
        example_count INTEGER DEFAULT 0,
        confidence_score DECIMAL(3,2),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_patterns_type ON scene_patterns(pattern_type);
    `);

    console.log('✅ scene_patterns table created');

    await sequelize.close();
    console.log('🎉 All scene tables created successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createTables();
