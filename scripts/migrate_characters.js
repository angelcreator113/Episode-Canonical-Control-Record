// Node.js script to create characters table and seed initial data
const { Pool } = require('pg');

const pool = new Pool({
  host: '127.0.0.1',
  user: 'postgres',
  password: 'Ayanna123',
  database: 'episode_metadata',
});

async function migrate() {
  try {
    // 1. Create characters table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS characters (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        show_id UUID REFERENCES shows(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('main_character', 'creator', 'guest')),
        display_name VARCHAR(255),
        avatar_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(show_id, name)
      );
      CREATE INDEX IF NOT EXISTS idx_characters_show ON characters(show_id);
      CREATE INDEX IF NOT EXISTS idx_characters_role ON characters(role);
    `);

    // 2. Seed 3 known characters (adjust show name pattern as needed)
    await pool.query(`
      INSERT INTO characters (show_id, name, role, display_name)
      SELECT id, 'lala', 'main_character', 'Lala' FROM shows WHERE name ILIKE '%styling%' OR name ILIKE '%lala%' LIMIT 1;
      INSERT INTO characters (show_id, name, role, display_name)
      SELECT id, 'justawoman', 'creator', 'JustAWomanInHerPrime' FROM shows WHERE name ILIKE '%styling%' OR name ILIKE '%lala%' LIMIT 1;
      INSERT INTO characters (show_id, name, role, display_name)
      SELECT id, 'guest', 'guest', 'Guest' FROM shows WHERE name ILIKE '%styling%' OR name ILIKE '%lala%' LIMIT 1;
    `);

    // 3. Verify
    const { rows } = await pool.query('SELECT * FROM characters;');
    console.log('Characters table rows:', rows);
  } catch (e) {
    console.error('Migration error:', e);
  } finally {
    await pool.end();
  }
}

migrate();
