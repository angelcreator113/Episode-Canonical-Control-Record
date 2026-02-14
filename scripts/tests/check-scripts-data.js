const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

async function checkScripts() {
  try {
    const result = await pool.query(`
      SELECT 
        id, 
        script_type, 
        version_number, 
        version_label,
        LEFT(content, 100) as content_preview,
        LENGTH(content) as content_length,
        is_primary, 
        is_latest,
        status,
        author
      FROM episode_scripts 
      WHERE episode_id = '51299ab6-1f9a-41af-951e-cd76cd9272a6' 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log('Scripts found:', result.rows.length);
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkScripts();
