/**
 * Reset Templates and Seed New Ones
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const { sequelize, models } = require('./src/models');
const { v4: uuidv4 } = require('uuid');

const newTemplates = [
  {
    id: uuidv4(),
    name: 'Styling Adventure With Lala',
    description: 'A fashion and lifestyle template featuring styling tips, outfit coordination, and fashion trends.',
    slug: 'styling-adventure-lala',
    defaultStatus: 'draft',
    defaultCategories: ['Fashion', 'Lifestyle', 'Styling'],
    isActive: true,
    usageCount: 0,
  },
  {
    id: uuidv4(),
    name: 'Day in a life of a content creator',
    description: 'Behind-the-scenes look at a content creator\'s daily routine, including planning, filming, and editing processes.',
    slug: 'day-in-life-content-creator',
    defaultStatus: 'draft',
    defaultCategories: ['Lifestyle', 'Behind-the-scenes', 'Content Creation'],
    isActive: true,
    usageCount: 0,
  },
  {
    id: uuidv4(),
    name: 'Documentary Series',
    description: 'In-depth documentary template for educational and storytelling-focused content.',
    slug: 'documentary-series',
    defaultStatus: 'draft',
    defaultCategories: ['Documentary', 'Educational', 'Storytelling'],
    isActive: true,
    usageCount: 0,
  },
  {
    id: uuidv4(),
    name: 'Interview & Q&A',
    description: 'Interactive template for interviews, Q&A sessions, and discussions with guests.',
    slug: 'interview-qa',
    defaultStatus: 'draft',
    defaultCategories: ['Interview', 'Discussion', 'Entertainment'],
    isActive: true,
    usageCount: 0,
  },
  {
    id: uuidv4(),
    name: 'Comedy Sketch Show',
    description: 'Comedy-focused template for sketches, humor bits, and entertainment content.',
    slug: 'comedy-sketch-show',
    defaultStatus: 'draft',
    defaultCategories: ['Comedy', 'Entertainment', 'Humor'],
    isActive: true,
    usageCount: 0,
  },
];

async function resetAndSeed() {
  try {
    console.log('🔄 Resetting templates...');
    
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Check what exists (including soft-deleted)
    const existing = await models.EpisodeTemplate.findAll({ 
      attributes: ['id', 'slug'], 
      raw: true,
      paranoid: false // Include soft-deleted
    });
    console.log(`📊 Found ${existing.length} existing templates (including soft-deleted)`);
    
    // Get conflicting slugs
    const conflictingSlugs = newTemplates.map(t => t.slug);
    const conflicting = existing.filter(e => conflictingSlugs.includes(e.slug));
    
    if (conflicting.length > 0) {
      console.log(`⚠️  Permanently deleting ${conflicting.length} templates with conflicting slugs...`);
      const ids = conflicting.map(c => c.id);
      await sequelize.query('DELETE FROM episode_templates WHERE id IN (:ids)', {
        replacements: { ids },
        type: sequelize.QueryTypes.DELETE
      });
    }

    // Create new templates
    const created = await models.EpisodeTemplate.bulkCreate(newTemplates);
    console.log(`\n✅ Successfully created ${created.length} new templates:\n`);
    
    created.forEach((t, i) => {
      console.log(`   ${i + 1}. ${t.name}`);
      console.log(`      Categories: ${t.defaultCategories.join(', ')}`);
    });

    console.log('\n✨ Phase 6: Template seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.errors) {
      error.errors.forEach(e => {
        console.error('   -', e.message);
      });
    }
    process.exit(1);
  }
}

resetAndSeed();
