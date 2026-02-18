#!/usr/bin/env node
const { Sequelize } = require('sequelize');
const eco = require('./ecosystem.config.js').apps[0];
const cfg = eco.env_development || eco.env;

const seq = new Sequelize(cfg.DB_NAME, cfg.DB_USER, cfg.DB_PASSWORD, {
  host: cfg.DB_HOST, port: 5432, dialect: 'postgres',
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: false
});

(async () => {
  try {
    // Check SequelizeMeta
    const [rows] = await seq.query('SELECT name FROM "SequelizeMeta" ORDER BY name');
    console.log('=== SequelizeMeta entries ===');
    rows.forEach(r => console.log(' ', r.name));
    console.log(`Total: ${rows.length}`);

    // Check for missing table
    const [tables] = await seq.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='episode_wardrobe_defaults')"
    );
    console.log('\nepisode_wardrobe_defaults exists:', tables[0].exists);

    // Also check asset_usage_log
    const [tables2] = await seq.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='asset_usage_log')"
    );
    console.log('asset_usage_log exists:', tables2[0].exists);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await seq.close();
  }
})();
