#!/usr/bin/env node
// One-shot migration runner — bypasses stuck earlier ES module migration
const m = require('./migrations/20260302120000-story-social-assembler.js');
const config = require('./src/config/sequelize.js');
const Sequelize = require('sequelize');

process.env.DB_SSL_REJECT_UNAUTHORIZED = 'false';
const seq = new Sequelize(config.production);
const qi = seq.getQueryInterface();

(async () => {
  try {
    await m.up(qi, Sequelize);
    await seq.query(`INSERT INTO "SequelizeMeta" (name) VALUES ('20260302120000-story-social-assembler.js')`);
    console.log('✓ Migration 20260302120000-story-social-assembler.js applied successfully');
  } catch (e) {
    console.error('✗ Migration failed:', e.message);
  } finally {
    await seq.close();
  }
})();
