/**
 * Direct Seeding Test
 * Bypasses HTTP - directly seeds templates
 */
const path = require('path');

// Load environment
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const { sequelize, models } = require('./src/models');
const { v4: uuidv4 } = require('uuid');

const testTemplates = [
  {
    id: uuidv4(),
    name: 'Styling Adventure With Lala',
    description: 'A fashion and lifestyle template featuring styling tips, outfit coordination, and fashion trends.',
    slug: 'styling-adventure-lala',
    default_status: 'draft',
    default_categories: ['Fashion', 'Lifestyle', 'Styling'],
    is_active: true,
    usage_count: 0,
  },
  {
    id: uuidv4(),
    name: 'Day in a life of a content creator',
    description: 'Behind-the-scenes look at a content creator\'s daily routine, including planning, filming, and editing processes.',
    slug: 'day-in-life-content-creator',
    default_status: 'draft',
    default_categories: ['Lifestyle', 'Behind-the-scenes', 'Content Creation'],
    is_active: true,
    usage_count: 0,
  },
  {
    id: uuidv4(),
    name: 'Documentary Series',
    description: 'In-depth documentary template for educational and storytelling-focused content.',
    slug: 'documentary-series',
    default_status: 'draft',
    default_categories: ['Documentary', 'Educational', 'Storytelling'],
    is_active: true,
    usage_count: 0,
  },
  {
    id: uuidv4(),
    name: 'Interview & Q&A',
    description: 'Interactive template for interviews, Q&A sessions, and discussions with guests.',
    slug: 'interview-qa',
    default_status: 'draft',
    default_categories: ['Interview', 'Discussion', 'Entertainment'],
    is_active: true,
    usage_count: 0,
  },
  {
    id: uuidv4(),
    name: 'Comedy Sketch Show',
    description: 'Comedy-focused template for sketches, humor bits, and entertainment content.',
    slug: 'comedy-sketch-show',
    default_status: 'draft',
    default_categories: ['Comedy', 'Entertainment', 'Humor'],
    is_active: true,
    usage_count: 0,
  },
];

async function seedTemplates() {
  try {
    console.log('🌱 Starting template seed...');
    
    // Authenticate
    await sequelize.authenticate();
    console.log('✅ Database connection authenticated');

    // Check existing
    const existing = await models.EpisodeTemplate.count();
    if (existing > 0) {
      console.log(`⏭️  Database already has ${existing} templates, skipping seed`);
      return;
    }

    // Create templates
    const created = await models.EpisodeTemplate.bulkCreate(testTemplates);
    console.log(`✅ Successfully created ${created.length} templates:`);
    
    created.forEach((t, i) => {
      console.log(`   ${i + 1}. ${t.name} (${t.default_categories.join(', ')})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  }
}

seedTemplates();
