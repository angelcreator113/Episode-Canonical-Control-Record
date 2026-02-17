// Node.js script to add character_id to wardrobe table and migrate data
const { Pool } = require('pg');

const pool = new Pool({
  host: '127.0.0.1',
  user: 'postgres',
  password: 'Ayanna123',
  database: 'episode_metadata',
});

async function migrate() {
  try {
    // 1. Add character_id column and index
    await pool.query(`
      ALTER TABLE wardrobe ADD COLUMN IF NOT EXISTS character_id UUID REFERENCES characters(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_wardrobe_character_id ON wardrobe(character_id);
    `);

    // 2. Migrate existing string values to character_id
    await pool.query(`
      UPDATE wardrobe w
      SET character_id = c.id
      FROM characters c
      WHERE LOWER(w.character) = c.name
        AND c.show_id = (SELECT id FROM shows LIMIT 1);
    `);

    // 3. Verify
    const { rows } = await pool.query(`
      SELECT w.id, w.name, w.character, w.character_id, c.display_name
      FROM wardrobe w
      LEFT JOIN characters c ON w.character_id = c.id
      LIMIT 10;
    `);
    console.log('Wardrobe migration sample:', rows);
  } catch (e) {
    console.error('Migration error:', e);
  } finally {
    await pool.end();
  }
}

migrate();
