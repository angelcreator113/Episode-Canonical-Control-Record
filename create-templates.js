const { sequelize } = require('./src/models');

(async () => {
  try {
    console.log('🔄 Creating thumbnail_templates table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS thumbnail_templates (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        platform VARCHAR(50),
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        aspect_ratio VARCHAR(20),
        layout_config JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ Table created');
    
    console.log('📝 Inserting sample templates...');
    
    const youtubeConfig = {
      background: { type: 'frame', blur: 5 },
      lala: {
        width_percent: 20,
        height_percent: 60,
        top_percent: 20,
        left_percent: 5
      },
      justawomen: {
        width_percent: 20,
        height_percent: 60,
        top_percent: 20,
        left_percent: 27
      },
      guest: {
        width_percent: 20,
        height_percent: 60,
        top_percent: 20,
        left_percent: 49
      },
      text: {
        top_percent: 85,
        left_percent: 5,
        font_size: 72,
        color: '#FFFFFF'
      }
    };

    const instagramConfig = {
      background: { type: 'frame', blur: 3 },
      lala: {
        width_percent: 25,
        height_percent: 50,
        top_percent: 25,
        left_percent: 10
      },
      justawomen: {
        width_percent: 25,
        height_percent: 50,
        top_percent: 25,
        left_percent: 37
      },
      guest: {
        width_percent: 25,
        height_percent: 50,
        top_percent: 25,
        left_percent: 65
      },
      text: {
        top_percent: 90,
        left_percent: 10,
        font_size: 48,
        color: '#FFFFFF'
      }
    };

    await sequelize.query(`
      INSERT INTO thumbnail_templates (id, name, platform, width, height, aspect_ratio, layout_config, created_at, updated_at)
      VALUES 
        ('youtube-1920x1080', 'YouTube (1920x1080)', 'YOUTUBE', 1920, 1080, '16:9', $1, NOW(), NOW()),
        ('instagram-1080x1080', 'Instagram (1080x1080)', 'INSTAGRAM', 1080, 1080, '1:1', $2, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, {
      bind: [
        JSON.stringify(youtubeConfig),
        JSON.stringify(instagramConfig)
      ]
    });
    
    console.log('✅ Templates inserted');
    process.exit(0);
  } catch(e) { 
    console.error('❌ Error:', e.message); 
    process.exit(1);
  }
})();
