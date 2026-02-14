require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: console.log
});

async function addTemplateStudioColumn() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection authenticated');

    // Add template_studio_id column
    await sequelize.query(`
      ALTER TABLE thumbnail_compositions 
      ADD COLUMN IF NOT EXISTS template_studio_id UUID REFERENCES template_studio(id) ON DELETE SET NULL;
    `);
    
    console.log('✅ Added template_studio_id column');

    // Add index for performance
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_compositions_template_studio_id 
        ON thumbnail_compositions(template_studio_id);
    `);
    
    console.log('✅ Added index on template_studio_id');

    // Verify column exists
    const [columns] = await sequelize.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'thumbnail_compositions' 
        AND column_name = 'template_studio_id';
    `);
    
    if (columns.length > 0) {
      console.log('✅ Verified: template_studio_id column exists');
      console.log(`   Type: ${columns[0].data_type}`);
    } else {
      console.warn('⚠️  Column not found after creation');
    }

    console.log('\n✅ Migration complete!');
    
  } catch (error) {
    console.error('❌ Error adding column:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

addTemplateStudioColumn()
  .then(() => {
    console.log('\n✅ Success');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
