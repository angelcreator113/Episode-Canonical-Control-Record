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

async function checkEpisodesTable() {
  try {
    await sequelize.authenticate();
    console.log('✓ Database connection established\n');

    // Check episodes table schema
    const [schema] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'episodes'
      ORDER BY ordinal_position
    `);
    console.log('Episodes table schema:');
    schema.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default || 'none'})`);
    });

    // Check primary key
    const [pk] = await sequelize.query(`
      SELECT a.attname
      FROM   pg_index i
      JOIN   pg_attribute a ON a.attrelid = i.indrelid
                         AND a.attnum = ANY(i.indkey)
      WHERE  i.indrelid = 'episodes'::regclass
      AND    i.indisprimary;
    `);
    console.log('\nPrimary key columns:');
    pk.forEach(col => console.log(`  - ${col.attname}`));

    // Check a sample row
    const [rows] = await sequelize.query(`SELECT id FROM episodes LIMIT 1`);
    if (rows.length > 0) {
      console.log(`\nSample id value: ${rows[0].id}`);
      console.log(`Type: ${typeof rows[0].id}`);
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

checkEpisodesTable();
