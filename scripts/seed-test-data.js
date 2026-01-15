/**
 * Seed Script - Create sample data for testing
 * Run with: node scripts/seed-test-data.js
 */

require('dotenv').config();
const db = require('../src/models');
const { Episode } = db.models;

async function seedData() {
  try {
    console.log('🌱 Starting database seeding...\n');
    
    await db.sequelize.authenticate();
    console.log('✅ Database connected\n');

    // Clear existing data (optional, uncomment if needed)
    // await Episode.destroy({ where: {} });

    // Create sample episodes
    console.log('Creating sample episodes...');
    const episodes = await Episode.bulkCreate([
      {
        episode_number: 1,
        title: 'Pilot Episode - Introduction to Styling',
        description: 'The first episode introduces basic styling techniques and color theory.',
        air_date: new Date('2025-01-15'),
        status: 'published',
        categories: ['Fashion', 'Tutorial', 'Styling'],
      },
      {
        episode_number: 2,
        title: 'Fabric Selection and Care',
        description: 'Learn how to select and care for different fabric types.',
        air_date: new Date('2025-01-22'),
        status: 'published',
        categories: ['Fabric', 'Care', 'Tutorial'],
      },
      {
        episode_number: 3,
        title: 'Pattern Matching Basics',
        description: 'Master the art of matching patterns and textures.',
        air_date: new Date('2025-01-29'),
        status: 'draft',
        categories: ['Patterns', 'Matching', 'Advanced'],
      },
      {
        episode_number: 4,
        title: 'Advanced Layering Techniques',
        description: 'Explore advanced methods for layering and combining styles.',
        air_date: new Date('2025-02-05'),
        status: 'draft',
        categories: ['Layering', 'Advanced', 'Techniques'],
      },
    ]);


    console.log(`✅ Created ${episodes.length} episodes\n`);

    console.log('='.repeat(50));
    console.log('✅ SEEDING COMPLETE!');
    console.log('='.repeat(50));
    console.log(`\nSummary:`);
    console.log(`  📺 Episodes: ${episodes.length}`);
    console.log(`\nYou can now access the episodes via:`);
    console.log(`  GET http://localhost:3002/api/v1/episodes`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

seedData();
