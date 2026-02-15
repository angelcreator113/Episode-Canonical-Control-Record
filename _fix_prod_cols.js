// Temporary script to add missing columns to production DB
require('dotenv').config();
const { Sequelize } = require('sequelize');
const dbUrl = process.env.DATABASE_URL.replace('?sslmode=require', '');
console.log('Connecting to:', dbUrl.replace(/:[^:@]+@/, ':***@'));
const seq = new Sequelize(dbUrl, {
  logging: false,
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: false }
  }
});

async function fixColumns() {
  const columns = [
    'ALTER TABLE episodes ADD COLUMN IF NOT EXISTS current_ai_edit_plan_id UUID',
    'ALTER TABLE episodes ADD COLUMN IF NOT EXISTS platform VARCHAR(50)',
    'ALTER TABLE episodes ADD COLUMN IF NOT EXISTS width INTEGER',
    'ALTER TABLE episodes ADD COLUMN IF NOT EXISTS height INTEGER',
    'ALTER TABLE episodes ADD COLUMN IF NOT EXISTS aspect_ratio VARCHAR(20)',
    'ALTER TABLE episodes ADD COLUMN IF NOT EXISTS timeline_data JSONB',
    'ALTER TABLE episodes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ',
  ];

  for (const sql of columns) {
    try {
      await seq.query(sql);
      const col = sql.match(/ADD COLUMN IF NOT EXISTS (\S+)/)[1];
      console.log('OK:', col);
    } catch (e) {
      console.error('SKIP:', e.message);
    }
  }

  console.log('Done');
  process.exit(0);
}

fixColumns();
