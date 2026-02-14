require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: console.log
});

async function createCompositionOutputsTable() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection authenticated');

    // Create composition_outputs table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS composition_outputs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        composition_id UUID NOT NULL REFERENCES thumbnail_compositions(id) ON DELETE CASCADE,
        format VARCHAR(100) NOT NULL,
        status VARCHAR(50) DEFAULT 'PROCESSING' CHECK (status IN ('PROCESSING', 'READY', 'FAILED')),
        image_url TEXT,
        width INTEGER,
        height INTEGER,
        file_size INTEGER,
        error_message TEXT,
        generated_at TIMESTAMP DEFAULT NOW(),
        generated_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(composition_id, format)
      );
    `);
    
    console.log('✅ Created composition_outputs table');

    // Add indexes
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_composition_outputs_composition_id 
        ON composition_outputs(composition_id);
      CREATE INDEX IF NOT EXISTS idx_composition_outputs_status 
        ON composition_outputs(status);
      CREATE INDEX IF NOT EXISTS idx_composition_outputs_format 
        ON composition_outputs(format);
    `);
    
    console.log('✅ Added indexes');

    // Add new columns to thumbnail_compositions
    await sequelize.query(`
      ALTER TABLE thumbnail_compositions 
      ADD COLUMN IF NOT EXISTS layout_overrides JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS draft_overrides JSONB,
      ADD COLUMN IF NOT EXISTS draft_updated_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS draft_updated_by VARCHAR(255),
      ADD COLUMN IF NOT EXISTS has_unsaved_changes BOOLEAN DEFAULT false;
    `);
    
    console.log('✅ Added columns to thumbnail_compositions');

    // Verify composition_outputs table
    const [outputColumns] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'composition_outputs' 
      ORDER BY ordinal_position;
    `);
    
    console.log('\ncomposition_outputs columns:', outputColumns.map(c => c.column_name).join(', '));

    // Verify thumbnail_compositions columns
    const [compColumns] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'thumbnail_compositions' 
      ORDER BY ordinal_position;
    `);
    
    console.log('\nthumbnail_compositions columns:', compColumns.map(c => c.column_name).join(', '));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

createCompositionOutputsTable();
