/**
 * Episode Seed Script
 * Populates the database with test episodes for "Styling Adventures with Lala"
 * 
 * Usage: node scripts/migrations/seed-episodes.js
 * Run from repo root with: node scripts/migrations/seed-episodes.js
 * 
 * This script:
 * 1. Looks up the "Styling Adventures with Lala" show
 * 2. Creates 5 test episodes with correct schema columns
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const db = require('../../src/models');

async function seedEpisodes() {
  try {
    console.log('🌱 Starting episode seed script...');
    
    // Check database connection
    await db.sequelize.authenticate();
    console.log('✅ Connected to database');
    
    // Find the show — "Styling Adventures with Lala"
    const show = await db.Show.findOne({
      where: { name: 'Styling Adventures with Lala' }
    });
    
    if (!show) {
      console.log('⚠️  Show "Styling Adventures with Lala" not found. Run seed-lalaverse.js first.');
      console.log('   Alternatively, create the show manually or seed it.');
      process.exit(1);
    }
    
    console.log(`📺 Found show: ${show.name} (ID: ${show.id})`);
    
    // Check if episodes already exist for this show
    const existingCount = await db.Episode.count({ where: { show_id: show.id } });
    if (existingCount > 0) {
      console.log(`⚠️  Show already has ${existingCount} episodes. Skipping seed.`);
      console.log('   To reset, delete episodes and try again.');
      process.exit(0);
    }

    // Test episodes using correct schema columns
    const testEpisodes = [
      {
        show_id: show.id,
        season_number: 1,
        episode_number: 1,
        title: 'The New Beginning',
        description: 'Lala starts her new role and discovers unexpected challenges in the world of fashion.',
        air_date: new Date('2025-01-15'),
        status: 'draft',
        categories: ['fashion', 'lifestyle', 'introduction'],
      },
      {
        show_id: show.id,
        season_number: 1,
        episode_number: 2,
        title: 'Finding Her Voice',
        description: 'Lala learns to stand up for herself in the workplace and develops her unique style perspective.',
        air_date: new Date('2025-01-22'),
        status: 'draft',
        categories: ['fashion', 'personal-growth', 'workplace'],
      },
      {
        show_id: show.id,
        season_number: 1,
        episode_number: 3,
        title: 'Unexpected Allies',
        description: 'A guest star joins the cast and creates surprising moments that reshape Lala\'s journey.',
        air_date: new Date('2025-01-29'),
        status: 'draft',
        categories: ['fashion', 'collaboration', 'relationships'],
      },
      {
        show_id: show.id,
        season_number: 1,
        episode_number: 4,
        title: 'The Guest Episode',
        description: 'A special guest appearance brings new dynamics to the show and opens doors for Lala.',
        air_date: new Date('2025-02-05'),
        status: 'draft',
        categories: ['fashion', 'guest-feature', 'networking'],
      },
      {
        show_id: show.id,
        season_number: 1,
        episode_number: 5,
        title: 'Rising to the Challenge',
        description: 'Lala faces her biggest professional challenge yet and proves her worth in the fashion world.',
        air_date: new Date('2025-02-12'),
        status: 'draft',
        categories: ['fashion', 'challenge', 'triumph'],
      },
    ];

    // Insert test episodes
    console.log(`📝 Creating ${testEpisodes.length} test episodes...`);
    const created = await db.Episode.bulkCreate(testEpisodes);
    
    console.log(`✅ Successfully created ${created.length} episodes:`);
    created.forEach((ep, index) => {
      console.log(`   ${index + 1}. S${ep.season_number}E${ep.episode_number}: "${ep.title}"`);
      console.log(`      ID: ${ep.id}`);
    });

    console.log('\n✨ Seed complete!');
    console.log('Episodes are now available for the show.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding episodes:', error);
    process.exit(1);
  }
}

// Run the seed
seedEpisodes();
