const { Client } = require('pg');
require('dotenv').config();

async function createSceneTemplatesTable() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✓ Connected to database');

    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS scene_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(200) NOT NULL,
        description TEXT,
        scene_type VARCHAR(50) DEFAULT 'main',
        mood VARCHAR(50),
        location VARCHAR(255),
        duration_seconds INTEGER,
        structure JSONB DEFAULT '{}',
        default_settings JSONB DEFAULT '{}',
        created_by UUID,
        is_public BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await client.query(createTableSQL);
    console.log('✓ scene_templates table created successfully');

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_scene_templates_created_by ON scene_templates(created_by);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_scene_templates_is_public ON scene_templates(is_public);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_scene_templates_scene_type ON scene_templates(scene_type);
    `);
    
    console.log('✓ Indexes created successfully');

    // Insert some default templates
    const defaultTemplates = [
      {
        name: 'Standard Interview',
        description: 'Basic interview setup with intro and outro',
        scene_type: 'main',
        mood: 'neutral',
        structure: {
          sections: ['intro', 'questions', 'conclusion'],
          duration_per_section: [30, 300, 30]
        }
      },
      {
        name: 'Product Review',
        description: 'Product showcase and demonstration',
        scene_type: 'main',
        mood: 'upbeat',
        structure: {
          sections: ['unboxing', 'features', 'demo', 'verdict'],
          duration_per_section: [60, 120, 180, 60]
        }
      },
      {
        name: 'Tutorial Scene',
        description: 'Step-by-step instructional scene',
        scene_type: 'main',
        mood: 'serious',
        structure: {
          sections: ['intro', 'step_1', 'step_2', 'step_3', 'recap'],
          duration_per_section: [30, 120, 120, 120, 30]
        }
      },
      {
        name: 'Vlog Opening',
        description: 'Engaging intro for vlogs',
        scene_type: 'intro',
        mood: 'upbeat',
        duration_seconds: 30,
        structure: {
          elements: ['hook', 'greeting', 'topic_intro'],
          style: 'energetic'
        }
      }
    ];

    for (const template of defaultTemplates) {
      await client.query(`
        INSERT INTO scene_templates (name, description, scene_type, mood, duration_seconds, structure, is_public)
        VALUES ($1, $2, $3, $4, $5, $6, true)
        ON CONFLICT DO NOTHING
      `, [
        template.name,
        template.description,
        template.scene_type,
        template.mood,
        template.duration_seconds || null,
        JSON.stringify(template.structure)
      ]);
    }

    console.log('✓ Default templates inserted');
    console.log('✅ Scene templates table setup complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

createSceneTemplatesTable();
