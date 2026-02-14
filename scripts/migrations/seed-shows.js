#!/usr/bin/env node
/**
 * Script to populate test shows
 */

const sequelize = require('./src/config/database');
const { Show } = require('./src/models');

const testShows = [
  {
    name: 'Breaking Bad',
    description: 'A high school chemistry teacher turned methamphetamine producer',
    genre: 'Drama',
    network: 'AMC',
    creator_name: 'Vince Gilligan',
    episode_count: 62,
    season_count: 5,
    premiere_date: '2008-01-20',
    status: 'archived',
    is_active: false,
  },
  {
    name: 'The Crown',
    description: 'The innerworkings of the British royal family',
    genre: 'Drama',
    network: 'Netflix',
    creator_name: 'Peter Morgan',
    episode_count: 50,
    season_count: 5,
    premiere_date: '2016-11-04',
    status: 'archived',
    is_active: false,
  },
  {
    name: 'Stranger Things',
    description: 'A group of friends face off against supernatural forces',
    genre: 'Science Fiction',
    network: 'Netflix',
    creator_name: 'The Duffer Brothers',
    episode_count: 42,
    season_count: 4,
    premiere_date: '2016-07-15',
    status: 'active',
    is_active: true,
  },
  {
    name: 'The Office',
    description: 'A mockumentary about office employees',
    genre: 'Comedy',
    network: 'NBC',
    creator_name: 'Greg Daniels',
    episode_count: 201,
    season_count: 9,
    premiere_date: '2005-03-24',
    status: 'archived',
    is_active: false,
  },
  {
    name: 'Game of Thrones',
    description: 'Power struggles and intrigue in a medieval fantasy world',
    genre: 'Fantasy',
    network: 'HBO',
    creator_name: 'David Benioff, D. B. Weiss',
    episode_count: 73,
    season_count: 8,
    premiere_date: '2011-04-17',
    status: 'archived',
    is_active: false,
  },
];

async function seedShows() {
  try {
    console.log('✓ Checking existing shows...');
    const existingCount = await Show.count();
    
    if (existingCount > 0) {
      console.log(`✓ Database already has ${existingCount} shows. Skipping seed.`);
      return;
    }

    console.log('✓ Creating test shows...');
    for (const showData of testShows) {
      // Generate slug manually
      const slug = showData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      
      await Show.create({
        ...showData,
        slug,
      });
      console.log(`  ✓ Created: ${showData.name}`);
    }

    const count = await Show.count();
    console.log(`\n✅ Successfully seeded ${count} shows!`);
    
  } catch (error) {
    console.error('❌ Error seeding shows:', error);
    process.exit(1);
  }
}

seedShows();
