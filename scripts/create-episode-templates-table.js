require('dotenv').config();
const { sequelize } = require('../src/models');

async function createTable() {
  try {
    console.log('📋 Creating episode_templates table...\n');

    await sequelize.authenticate();
    console.log('✅ Connected to database\n');

    // Drop table if exists (clean slate)
    await sequelize.query('DROP TABLE IF EXISTS episode_templates CASCADE;');
    console.log('🗑️  Dropped existing table (if any)\n');

    // Create table
    await sequelize.query(`
      CREATE TABLE episode_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE,
        description TEXT DEFAULT '',
        default_status VARCHAR(50) DEFAULT 'draft',
        default_categories JSONB DEFAULT '[]'::jsonb,
        default_duration INTEGER,
        config JSONB DEFAULT '{}'::jsonb,
        icon VARCHAR(100) DEFAULT '📺',
        color VARCHAR(50) DEFAULT '#667eea',
        sort_order INTEGER DEFAULT 0,
        usage_count INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        is_default BOOLEAN DEFAULT false,
        is_system_template BOOLEAN DEFAULT false,
        created_by UUID,
        updated_by UUID,
        last_used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        deleted_at TIMESTAMP
      );
    `);
    console.log('✅ Table created\n');

    // Create indexes
    await sequelize.query(`
      CREATE UNIQUE INDEX episode_templates_name_unique 
      ON episode_templates(name) WHERE deleted_at IS NULL;
    `);
    
    await sequelize.query(`
      CREATE UNIQUE INDEX episode_templates_slug_unique 
      ON episode_templates(slug) WHERE deleted_at IS NULL;
    `);
    
    await sequelize.query(`
      CREATE INDEX episode_templates_is_active_idx ON episode_templates(is_active);
    `);
    
    await sequelize.query(`
      CREATE INDEX episode_templates_is_default_idx ON episode_templates(is_default);
    `);
    
    await sequelize.query(`
      CREATE INDEX episode_templates_sort_order_idx ON episode_templates(sort_order);
    `);
    
    console.log('✅ Indexes created\n');

    // Insert default templates
    await sequelize.query(`
      INSERT INTO episode_templates 
        (id, name, slug, description, default_status, default_categories, default_duration, 
         icon, color, sort_order, is_active, is_default, is_system_template, created_at, updated_at)
      VALUES
        (
          '00000000-0000-0000-0000-000000000001',
          'Standard Episode',
          'standard-episode',
          'Default template for regular episodes',
          'draft',
          '["general"]'::jsonb,
          30,
          '📺',
          '#667eea',
          1,
          true,
          true,
          true,
          NOW(),
          NOW()
        ),
        (
          '00000000-0000-0000-0000-000000000002',
          'Fashion Show',
          'fashion-show',
          'Template for fashion and style episodes',
          'draft',
          '["fashion", "style"]'::jsonb,
          45,
          '👗',
          '#ec4899',
          2,
          true,
          false,
          true,
          NOW(),
          NOW()
        ),
        (
          '00000000-0000-0000-0000-000000000003',
          'Tutorial',
          'tutorial',
          'Template for how-to and tutorial content',
          'draft',
          '["tutorial", "education"]'::jsonb,
          20,
          '🎓',
          '#10b981',
          3,
          true,
          false,
          true,
          NOW(),
          NOW()
        );
    `);
    console.log('✅ Default templates inserted\n');

    // Verify
    const [results] = await sequelize.query('SELECT name, icon, slug FROM episode_templates ORDER BY sort_order;');
    console.log('📋 Templates created:');
    results.forEach(t => {
      console.log(`   ${t.icon} ${t.name} (${t.slug})`);
    });

    await sequelize.close();
    console.log('\n✅ Setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

createTable();