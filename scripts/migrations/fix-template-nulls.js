const { sequelize } = require('./src/models');

(async () => {
  try {
    console.log('🔄 Fixing NULL values in thumbnail_templates...');
    
    await sequelize.query(`
      UPDATE thumbnail_templates 
      SET conditional_roles = '{}'::jsonb 
      WHERE conditional_roles IS NULL
    `);
    console.log('✅ Updated conditional_roles');
    
    await sequelize.query(`
      UPDATE thumbnail_templates 
      SET paired_roles = '{}'::jsonb 
      WHERE paired_roles IS NULL
    `);
    console.log('✅ Updated paired_roles');
    
    await sequelize.query(`
      ALTER TABLE thumbnail_templates 
      ALTER COLUMN conditional_roles SET NOT NULL,
      ALTER COLUMN conditional_roles SET DEFAULT '{}'::jsonb;
    `);
    console.log('✅ Set conditional_roles as NOT NULL');
    
    await sequelize.query(`
      ALTER TABLE thumbnail_templates 
      ALTER COLUMN paired_roles SET NOT NULL,
      ALTER COLUMN paired_roles SET DEFAULT '{}'::jsonb;
    `);
    console.log('✅ Set paired_roles as NOT NULL');
    
    console.log('\n✨ All NULL values fixed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
