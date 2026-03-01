/**
 * Add missing columns to episode_wardrobe table
 * (is_episode_favorite, times_worn)
 */
const { Client } = require('pg');

async function run() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('Connected to DB');

  const sql = `
    DO $$ 
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'episode_wardrobe' AND column_name = 'is_episode_favorite'
      ) THEN
        ALTER TABLE episode_wardrobe 
        ADD COLUMN is_episode_favorite boolean DEFAULT false NOT NULL;
        CREATE INDEX idx_episode_wardrobe_favorites 
          ON episode_wardrobe(is_episode_favorite) 
          WHERE is_episode_favorite = true;
        RAISE NOTICE 'Added is_episode_favorite';
      ELSE
        RAISE NOTICE 'is_episode_favorite already exists';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'episode_wardrobe' AND column_name = 'times_worn'
      ) THEN
        ALTER TABLE episode_wardrobe 
        ADD COLUMN times_worn integer DEFAULT 1 NOT NULL;
        RAISE NOTICE 'Added times_worn';
      ELSE
        RAISE NOTICE 'times_worn already exists';
      END IF;
    END $$;
  `;

  await client.query(sql);
  console.log('Migration complete');

  // Verify
  const { rows } = await client.query(`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'episode_wardrobe'
    ORDER BY ordinal_position
  `);
  console.log('episode_wardrobe columns:', rows.map(r => r.column_name).join(', '));

  await client.end();
}

run().catch(err => { console.error(err); process.exit(1); });
