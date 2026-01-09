/**
 * Episode Seed Script
 * Populates the database with test episodes for "Just a Woman in Her Prime"
 * 
 * Usage: node seed-episodes.js
 */

const { Sequelize } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Initialize Sequelize
const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'episode_metadata_dev',
  logging: false,
  pool: {
    max: parseInt(process.env.DB_POOL_MAX || '10'),
    min: parseInt(process.env.DB_POOL_MIN || '2'),
  },
  dialectOptions: {
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  },
});

// Import Episode model
const Episode = require('./src/models/Episode')(sequelize);

const testEpisodes = [
  {
    id: uuidv4(),
    showName: 'Just a Woman in Her Prime',
    seasonNumber: 1,
    episodeNumber: 1,
    episodeTitle: 'The New Beginning',
    airDate: new Date('2025-01-15'),
    plotSummary: 'Lala starts her new role and discovers unexpected challenges.',
    director: 'Maria Santos',
    writer: 'Jessica Chen',
    durationMinutes: 45,
    rating: 'PG-13',
    genre: 'Drama,Comedy',
    uploadDate: new Date(),
    lastModified: new Date(),
  },
  {
    id: uuidv4(),
    showName: 'Just a Woman in Her Prime',
    seasonNumber: 1,
    episodeNumber: 2,
    episodeTitle: 'Finding Her Voice',
    airDate: new Date('2025-01-22'),
    plotSummary: 'Lala learns to stand up for herself in the workplace.',
    director: 'Maria Santos',
    writer: 'Jessica Chen',
    durationMinutes: 44,
    rating: 'PG-13',
    genre: 'Drama,Comedy',
    uploadDate: new Date(),
    lastModified: new Date(),
  },
  {
    id: uuidv4(),
    showName: 'Just a Woman in Her Prime',
    seasonNumber: 1,
    episodeNumber: 3,
    episodeTitle: 'Unexpected Allies',
    airDate: new Date('2025-01-29'),
    plotSummary: 'A guest star joins the cast and creates surprising moments.',
    director: 'James Mitchell',
    writer: 'Alexandra Brown',
    durationMinutes: 46,
    rating: 'PG-13',
    genre: 'Drama,Comedy',
    uploadDate: new Date(),
    lastModified: new Date(),
  },
  {
    id: uuidv4(),
    showName: 'Just a Woman in Her Prime',
    seasonNumber: 1,
    episodeNumber: 4,
    episodeTitle: 'The Guest Episode',
    airDate: new Date('2025-02-05'),
    plotSummary: 'A special guest appearance brings new dynamics to the show.',
    director: 'Maria Santos',
    writer: 'Jessica Chen',
    durationMinutes: 45,
    rating: 'PG-13',
    genre: 'Drama,Comedy',
    uploadDate: new Date(),
    lastModified: new Date(),
  },
  {
    id: uuidv4(),
    showName: 'Just a Woman in Her Prime',
    seasonNumber: 1,
    episodeNumber: 5,
    episodeTitle: 'Rising to the Challenge',
    airDate: new Date('2025-02-12'),
    plotSummary: 'Lala faces her biggest professional challenge yet.',
    director: 'James Mitchell',
    writer: 'Alexandra Brown',
    durationMinutes: 47,
    rating: 'PG-13',
    genre: 'Drama,Comedy',
    uploadDate: new Date(),
    lastModified: new Date(),
  },
];

async function seedEpisodes() {
  try {
    console.log('🌱 Starting episode seed script...');
    
    // Check database connection
    await sequelize.authenticate();
    console.log('✅ Connected to database');
    
    // Check if episodes already exist
    const existingCount = await Episode.count();
    if (existingCount > 0) {
      console.log(`⚠️  Database already has ${existingCount} episodes. Skipping seed.`);
      console.log('   To reset, delete episodes and try again.');
      process.exit(0);
    }

    // Insert test episodes
    console.log(`📝 Creating ${testEpisodes.length} test episodes...`);
    const created = await Episode.bulkCreate(testEpisodes);
    
    console.log(`✅ Successfully created ${created.length} episodes:`);
    created.forEach((ep, index) => {
      console.log(`   ${index + 1}. Season ${ep.seasonNumber}, Episode ${ep.episodeNumber}: "${ep.episodeTitle}"`);
      console.log(`      ID: ${ep.id}`);
    });

    console.log('\n✨ Seed complete!');
    console.log('You can now select episodes in the Thumbnail Composer.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding episodes:', error);
    process.exit(1);
  }
}

// Run the seed
seedEpisodes();
