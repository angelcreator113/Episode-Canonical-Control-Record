const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'episode_metadata'
});

async function fixTrigger() {
  try {
    await pool.query('DROP TRIGGER IF EXISTS tr_track_composition_changes ON thumbnail_compositions');
    await pool.query(`
      CREATE TRIGGER tr_track_composition_changes
      AFTER INSERT OR UPDATE ON thumbnail_compositions
      FOR EACH ROW
      EXECUTE PROCEDURE track_composition_changes()
    `);
    console.log('✓ Trigger recreated with EACH ROW');
    await pool.end();
  } catch (e) {
    console.error('✗ Error:', e.message);
    await pool.end();
  }
}

fixTrigger();
