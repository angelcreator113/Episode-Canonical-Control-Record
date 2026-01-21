const { Sequelize } = require('sequelize');

// Database connection for dev environment
const sequelize = new Sequelize('episode_metadata', 'postgres', 'Ayanna123!!', {
  host: 'episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com',
  dialect: 'postgres',
  port: 5432,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
});

async function checkTables() {
  try {
    // Test connection
    await sequelize.authenticate();
    console.log('✓ Database connection established');

    // Check if tables exist
    const [episodeAssets] = await sequelize.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'episode_assets'
    `);
    console.log(`\n✓ episode_assets table: ${episodeAssets[0].count > 0 ? 'EXISTS' : 'MISSING'}`);

    const [episodeWardrobe] = await sequelize.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'episode_wardrobe'
    `);
    console.log(`✓ episode_wardrobe table: ${episodeWardrobe[0].count > 0 ? 'EXISTS' : 'MISSING'}`);

    const [wardrobe] = await sequelize.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'wardrobe'
    `);
    console.log(`✓ wardrobe table: ${wardrobe[0].count > 0 ? 'EXISTS' : 'MISSING'}`);

    // Check schema for episode_assets
    if (episodeAssets[0].count > 0) {
      const [schema] = await sequelize.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'episode_assets'
        ORDER BY ordinal_position
      `);
      console.log('\n✓ episode_assets schema:');
      schema.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    }

    // Check schema for episode_wardrobe
    if (episodeWardrobe[0].count > 0) {
      const [schema] = await sequelize.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'episode_wardrobe'
        ORDER BY ordinal_position
      `);
      console.log('\n✓ episode_wardrobe schema:');
      schema.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    }

    // Check schema for wardrobe
    if (wardrobe[0].count > 0) {
      const [schema] = await sequelize.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'wardrobe'
        ORDER BY ordinal_position
      `);
      console.log('\n✓ wardrobe schema:');
      schema.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    }

    // Check foreign key constraints
    const [fkeys] = await sequelize.query(`
      SELECT 
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_name IN ('episode_assets', 'episode_wardrobe', 'wardrobe')
      ORDER BY tc.table_name
    `);
    console.log('\n✓ Foreign key constraints:');
    fkeys.forEach(fk => {
      console.log(`  - ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

checkTables();
