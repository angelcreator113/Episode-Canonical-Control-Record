require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: console.log
});

async function createTemplateStudioTable() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection authenticated');

    // Create template_studio table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS template_studio (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        status VARCHAR(50) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
        locked BOOLEAN DEFAULT false,
        
        -- Canvas configuration
        canvas_config JSONB NOT NULL DEFAULT '{
          "width": 1280,
          "height": 720,
          "background_color": "#000000"
        }'::jsonb,
        
        -- Template structure
        role_slots JSONB NOT NULL DEFAULT '[]'::jsonb,
        safe_zones JSONB DEFAULT '{}'::jsonb,
        required_roles TEXT[] DEFAULT ARRAY[]::TEXT[],
        optional_roles TEXT[] DEFAULT ARRAY[]::TEXT[],
        formats_supported TEXT[] DEFAULT ARRAY['YOUTUBE']::TEXT[],
        
        -- Metadata
        created_by UUID,
        published_at TIMESTAMP,
        locked_at TIMESTAMP,
        parent_template_id UUID REFERENCES template_studio(id) ON DELETE SET NULL,
        
        -- Timestamps
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        
        -- Constraints
        UNIQUE(name, version)
      );
    `);
    
    console.log('✅ Created template_studio table');

    // Add indexes for performance
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_template_studio_status 
        ON template_studio(status);
      CREATE INDEX IF NOT EXISTS idx_template_studio_locked 
        ON template_studio(locked);
      CREATE INDEX IF NOT EXISTS idx_template_studio_name 
        ON template_studio(name);
      CREATE INDEX IF NOT EXISTS idx_template_studio_created_by 
        ON template_studio(created_by);
      CREATE INDEX IF NOT EXISTS idx_template_studio_parent_template_id 
        ON template_studio(parent_template_id);
      CREATE INDEX IF NOT EXISTS idx_template_studio_formats_supported 
        ON template_studio USING GIN(formats_supported);
    `);
    
    console.log('✅ Added indexes');

    // Add trigger for updated_at
    await sequelize.query(`
      CREATE OR REPLACE FUNCTION update_template_studio_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      DROP TRIGGER IF EXISTS trigger_template_studio_updated_at ON template_studio;
      
      CREATE TRIGGER trigger_template_studio_updated_at
        BEFORE UPDATE ON template_studio
        FOR EACH ROW
        EXECUTE FUNCTION update_template_studio_updated_at();
    `);
    
    console.log('✅ Added updated_at trigger');

    // Verify table structure
    const [columns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'template_studio' 
      ORDER BY ordinal_position;
    `);
    
    console.log('\n✅ Template Studio columns:');
    columns.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });

    // Verify indexes
    const [indexes] = await sequelize.query(`
      SELECT indexname, indexdef
      FROM pg_indexes 
      WHERE tablename = 'template_studio'
      ORDER BY indexname;
    `);
    
    console.log('\n✅ Indexes:');
    indexes.forEach(idx => {
      console.log(`   - ${idx.indexname}`);
    });

    console.log('\n✅ Template Studio table setup complete!');
    
  } catch (error) {
    console.error('❌ Error creating template_studio table:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run the migration
createTemplateStudioTable()
  .then(() => {
    console.log('\n✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
