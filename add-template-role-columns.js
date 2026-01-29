/**
 * Migration: Add missing role columns to thumbnail_templates table
 * Adds: show_id, version, is_active, required_roles, optional_roles, conditional_roles, paired_roles
 */

const { sequelize } = require('./src/models');

(async () => {
  try {
    console.log('🔄 Adding missing columns to thumbnail_templates...\n');
    
    // Add show_id column
    try {
      await sequelize.query(`
        ALTER TABLE thumbnail_templates 
        ADD COLUMN IF NOT EXISTS show_id UUID REFERENCES shows(id);
      `);
      console.log('✅ show_id column added');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✓ show_id already exists');
      } else {
        throw error;
      }
    }
    
    // Add version column
    try {
      await sequelize.query(`
        ALTER TABLE thumbnail_templates 
        ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL;
      `);
      console.log('✅ version column added');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✓ version already exists');
      } else {
        throw error;
      }
    }
    
    // Add is_active column
    try {
      await sequelize.query(`
        ALTER TABLE thumbnail_templates 
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL;
      `);
      console.log('✅ is_active column added');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✓ is_active already exists');
      } else {
        throw error;
      }
    }
    
    // Add required_roles column
    try {
      await sequelize.query(`
        ALTER TABLE thumbnail_templates 
        ADD COLUMN IF NOT EXISTS required_roles JSONB DEFAULT '[]'::jsonb NOT NULL;
      `);
      console.log('✅ required_roles column added');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✓ required_roles already exists');
      } else {
        throw error;
      }
    }
    
    // Add optional_roles column
    try {
      await sequelize.query(`
        ALTER TABLE thumbnail_templates 
        ADD COLUMN IF NOT EXISTS optional_roles JSONB DEFAULT '[]'::jsonb NOT NULL;
      `);
      console.log('✅ optional_roles column added');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✓ optional_roles already exists');
      } else {
        throw error;
      }
    }
    
    // Add conditional_roles column
    try {
      await sequelize.query(`
        ALTER TABLE thumbnail_templates 
        ADD COLUMN IF NOT EXISTS conditional_roles JSONB DEFAULT '{}'::jsonb NOT NULL;
      `);
      console.log('✅ conditional_roles column added');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✓ conditional_roles already exists');
      } else {
        throw error;
      }
    }
    
    // Add paired_roles column
    try {
      await sequelize.query(`
        ALTER TABLE thumbnail_templates 
        ADD COLUMN IF NOT EXISTS paired_roles JSONB DEFAULT '{}'::jsonb NOT NULL;
      `);
      console.log('✅ paired_roles column added');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✓ paired_roles already exists');
      } else {
        throw error;
      }
    }
    
    // Verify the schema
    console.log('\n📊 Verifying schema...');
    const [results] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'thumbnail_templates'
      ORDER BY ordinal_position;
    `);
    
    console.log('\n✅ Current thumbnail_templates schema:');
    results.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
    
    console.log('\n✨ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
