const { Sequelize } = require('sequelize');

async function checkTables() {
  const db = new Sequelize('episode_metadata', 'admin', ',}nY$1O).-`N0hBI*3Plg:i!>', {
    host: 'episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com',
    port: 5432,
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: false
    }
  });

  try {
    const tables = await db.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
    );
    
    console.log('Tables in RDS:');
    tables[0].forEach(t => console.log('  ✓', t.table_name));
    
    // Check pgmigrations table
    const migrations = await db.query("SELECT name, run_on FROM pgmigrations ORDER BY run_on DESC LIMIT 5");
    console.log('\nRecent migrations:');
    migrations[0].forEach(m => console.log('  ✓', m.name, '-', m.run_on));
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkTables();
