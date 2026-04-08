require('dotenv').config();
const { Sequelize } = require('sequelize');
// Check Neon database (from .env DATABASE_URL)
const s = new Sequelize(process.env.DATABASE_URL);

async function check() {
  try {
    const [tables] = await s.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
    console.log('Tables found:', tables.length);
    tables.forEach(t => console.log(' -', t.tablename));
    
    // Check row counts for ALL tables
    console.log('\nRow counts (tables with data):');
    let emptyCount = 0;
    for (const t of tables) {
      try {
        const [[row]] = await s.query(`SELECT COUNT(*) as cnt FROM "${t.tablename}"`);
        if (parseInt(row.cnt) > 0) {
          console.log(` - ${t.tablename}: ${row.cnt}`);
        } else {
          emptyCount++;
        }
      } catch (e) {
        console.log(` - ${t.tablename}: ERROR - ${e.message}`);
      }
    }
    console.log(`\n${emptyCount} tables are empty.`);
  } catch (e) {
    console.log('Error:', e.message);
  }
  process.exit(0);
}
check();
