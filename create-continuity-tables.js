/**
 * Create Continuity Engine tables on RDS
 * Run from EC2: DB_SSL_REJECT_UNAUTHORIZED=false node create-continuity-tables.js
 */
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('episode_metadata', 'postgres', 'Ayanna123!!', {
  host: 'episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com',
  port: 5432,
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
});

async function run() {
  try {
    await sequelize.authenticate();
    console.log('Connected to RDS');

    // continuity_timelines
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS continuity_timelines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        show_id UUID REFERENCES shows(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL DEFAULT 'Untitled Timeline',
        description TEXT,
        season_tag VARCHAR(100),
        status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','active','locked')),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      );
    `);
    console.log('✓ continuity_timelines');

    // continuity_characters
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS continuity_characters (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timeline_id UUID NOT NULL REFERENCES continuity_timelines(id) ON DELETE CASCADE,
        character_key VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(255),
        color VARCHAR(20) NOT NULL DEFAULT '#5b7fff',
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      );
    `);
    console.log('✓ continuity_characters');

    // continuity_beats
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS continuity_beats (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timeline_id UUID NOT NULL REFERENCES continuity_timelines(id) ON DELETE CASCADE,
        beat_number INTEGER NOT NULL DEFAULT 1,
        name VARCHAR(500) NOT NULL,
        location VARCHAR(500) NOT NULL,
        time_tag VARCHAR(255),
        note TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      );
    `);
    console.log('✓ continuity_beats');

    // continuity_beat_characters (join)
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS continuity_beat_characters (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        beat_id UUID NOT NULL REFERENCES continuity_beats(id) ON DELETE CASCADE,
        character_id UUID NOT NULL REFERENCES continuity_characters(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✓ continuity_beat_characters');

    // Indexes
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_continuity_timelines_show ON continuity_timelines(show_id)`,
      `CREATE INDEX IF NOT EXISTS idx_continuity_characters_timeline ON continuity_characters(timeline_id)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_continuity_characters_timeline_key ON continuity_characters(timeline_id, character_key)`,
      `CREATE INDEX IF NOT EXISTS idx_continuity_beats_timeline ON continuity_beats(timeline_id)`,
      `CREATE INDEX IF NOT EXISTS idx_continuity_beats_timeline_num ON continuity_beats(timeline_id, beat_number)`,
      `CREATE INDEX IF NOT EXISTS idx_continuity_bc_beat ON continuity_beat_characters(beat_id)`,
      `CREATE INDEX IF NOT EXISTS idx_continuity_bc_char ON continuity_beat_characters(character_id)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_continuity_bc_unique ON continuity_beat_characters(beat_id, character_id)`,
    ];
    for (const idx of indexes) {
      await sequelize.query(idx);
    }
    console.log('✓ All indexes created');

    console.log('\nDone! 4 tables + 8 indexes created.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

run();
