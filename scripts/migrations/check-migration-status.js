/**
 * Check Migration Status
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkStatus() {
  const client = await pool.connect();
  
  try {
    const result = await client.query('SELECT name, run_on FROM pgmigrations ORDER BY run_on DESC LIMIT 25');
    console.log(`\nRecorded migrations (${result.rows.length} total):\n`);
    result.rows.forEach(row => {
      console.log(`  ${row.name} - ${row.run_on.toISOString()}`);
    });
    
    const has2026125 = result.rows.find(r => r.name.includes('20260125'));
    if (has2026125) {
      console.log('\n⚠️  Migration 20260125000001-add-asset-role-system is already recorded!');
      console.log('   This might have been added by mistake.');
      console.log('   Do you want to remove it so it can be run? (manually delete from pgmigrations table)');
    } else {
      console.log('\n✅ Migration 20260125000001-add-asset-role-system is NOT recorded yet.');
      console.log('   It should run when you execute: npm run migrate up');
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

checkStatus().catch(console.error);
