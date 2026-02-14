const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
/* eslint-disable no-console */

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'episode_metadata'
});

async function seedData() {
  try {
    console.log('🌱 Seeding test data...\n');

    // Create some test episodes
    const episodeIds = [];
    for (let i = 1; i <= 3; i++) {
      const id = uuidv4();
      await pool.query(`
        INSERT INTO episodes (id, episode_number, title, description, air_date, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      `, [
        id,
        i,
        `Episode ${i}: ${['Rainbow Dreams', 'Fashion Forward', 'Style Secrets'][i - 1]}`,
        `A wonderful episode exploring ${['color theory', 'modern fashion', 'wardrobe styling'][i - 1]}`,
        new Date(`2025-01-0${i}T00:00:00Z`),
        'published'
      ]);
      episodeIds.push(id);
      console.log(`✓ Created episode ${i}`);
    }

    // Create some test assets
    const assetIds = [];
    const assetTypes = ['PROMO_LALA', 'PROMO_GUEST', 'PROMO_JUSTAWOMANINPERPRIME'];
    for (let i = 0; i < 5; i++) {
      const id = uuidv4();
      const assetType = assetTypes[i % assetTypes.length];
      await pool.query(`
        INSERT INTO assets (id, name, asset_type, metadata, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
      `, [
        id,
        `Asset ${i + 1}: ${assetType}`,
        assetType,
        { episode_id: episodeIds[i % episodeIds.length], version: 1 }
      ]);
      assetIds.push(id);
      console.log(`✓ Created asset ${i + 1} (${assetType})`);
    }

    // Create some test compositions  
    for (let i = 0; i < 3; i++) {
      const id = uuidv4();
      const _result = await pool.query(`
        INSERT INTO thumbnail_compositions (id, episode_id, name, status, lala_asset_id, created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING id
      `, [
        id,
        episodeIds[i],
        `Composition ${i + 1}`,
        'draft',
        assetIds[i],
        'admin'
      ]);
      console.log(`✓ Created composition ${i + 1}`);
    }

    console.log('\n✅ Seed data created successfully!');
    await pool.end();

  } catch (error) {
    console.error('❌ Error seeding data:', error.message);
    await pool.end();
    process.exit(1);
  }
}

seedData();
