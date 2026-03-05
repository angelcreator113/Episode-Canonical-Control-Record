#!/usr/bin/env node
// Fix: add deleted_at column for paranoid soft deletes
const config = require('./src/config/sequelize.js');
const Sequelize = require('sequelize');

process.env.DB_SSL_REJECT_UNAUTHORIZED = 'false';
const seq = new Sequelize(config.production);

(async () => {
  try {
    await seq.query(`
      ALTER TABLE storyteller_stories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
      ALTER TABLE social_media_imports ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
      ALTER TABLE novel_assemblies ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    `);
    console.log('✓ deleted_at columns added to all 3 tables');
  } catch (e) {
    console.error('✗ Failed:', e.message);
  } finally {
    await seq.close();
  }
})();
