const { sequelize } = require('./src/models');

(async () => {
  try {
    console.log('🔧 Adding composition_config column to thumbnail_compositions...\n');
    
    // Check if column already exists
    const [existing] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'thumbnail_compositions' AND column_name = 'composition_config'
    `);
    
    if (existing.length > 0) {
      console.log('✅ composition_config column already exists');
      process.exit(0);
    }
    
    // Add composition_config column
    await sequelize.query(`
      ALTER TABLE thumbnail_compositions 
      ADD COLUMN composition_config JSONB DEFAULT '{}'::jsonb;
    `);
    console.log('✅ Added composition_config column');
    
    // Add comment
    await sequelize.query(`
      COMMENT ON COLUMN thumbnail_compositions.composition_config IS 
      'Stores visibility toggles, text field values, and per-composition overrides';
    `);
    console.log('✅ Added column comment');
    
    // Create GIN index for efficient JSON queries
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_thumbnail_compositions_config 
      ON thumbnail_compositions USING GIN (composition_config);
    `);
    console.log('✅ Created GIN index on composition_config');
    
    // Set default for existing rows
    await sequelize.query(`
      UPDATE thumbnail_compositions 
      SET composition_config = '{}'::jsonb 
      WHERE composition_config IS NULL;
    `);
    console.log('✅ Set default values for existing rows');
    
    console.log('\n✨ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
