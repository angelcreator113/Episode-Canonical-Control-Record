// ============================================================================
// SEED DATA SCRIPT
// ============================================================================
// This script populates the database with sample data for development & testing
// Show: "Styling Adventures w Lala"
// Episodes: 10
// Clips: 30 (10 Lala, 10 WomanInPrime, 10 Guest)
// Outfits: 20
// UI Elements: 5
// Backgrounds: 3

// TODO: Implement in Phase 1 when database schema is finalized

const { getPool } = require('../src/config/database');
const { v4: uuidv4 } = require('uuid');

async function seedDatabase() {
  const pool = getPool();

  try {
    console.log('Starting database seed...');

    // Create show
    const showId = uuidv4();
    const show = {
      id: showId,
      name: 'Styling Adventures w Lala',
      description: 'Fashion and lifestyle content featuring Lala and guests',
      created_at: new Date(),
      updated_at: new Date(),
    };
    console.log('✓ Show created:', show.name);

    // Create 10 sample episodes
    const episodes = [];
    for (let i = 1; i <= 10; i++) {
      const episodeId = uuidv4();
      episodes.push({
        id: episodeId,
        show_id: showId,
        episode_number: i,
        title: `Episode ${i}: Style Challenge #${i}`,
        description: `In this episode, Lala explores styling trends for season ${i}`,
        air_date: new Date(2025, 0, i),
        created_at: new Date(),
        updated_at: new Date(),
      });
    }
    console.log(`✓ Created ${episodes.length} sample episodes`);

    // Create 30 sample clips
    const clips = [];
    const talentSources = [
      { name: 'Lala', count: 10 },
      { name: 'WomanInHerPrime', count: 10 },
      { name: 'Guest', count: 10 },
    ];

    let clipIndex = 1;
    talentSources.forEach(({ name, count }) => {
      for (let i = 0; i < count; i++) {
        const clipId = uuidv4();
        clips.push({
          id: clipId,
          episode_id: episodes[Math.floor(Math.random() * episodes.length)].id,
          title: `Clip: ${name} - Style Tip #${i + 1}`,
          talent_source: name,
          duration_seconds: Math.floor(Math.random() * 600) + 60,
          created_at: new Date(),
          updated_at: new Date(),
        });
        clipIndex++;
      }
    });
    console.log(`✓ Created ${clips.length} sample clips (Lala, WomanInPrime, Guest)`);

    // Create 20 sample outfits
    const outfits = [];
    for (let i = 1; i <= 20; i++) {
      const outfitId = uuidv4();
      outfits.push({
        id: outfitId,
        name: `Outfit ${i}: ${['Casual', 'Formal', 'Business', 'Evening', 'Weekend'][i % 5]} Look`,
        description: `Complete outfit set featuring coordinated pieces`,
        metadata: {
          colors: ['Black', 'White', 'Blue', 'Red', 'Green'][i % 5],
          style: ['Casual', 'Formal', 'Business', 'Evening', 'Weekend'][i % 5],
          occasion: 'General',
          seasonalFit: ['Spring', 'Summer', 'Fall', 'Winter'][i % 4],
        },
        created_at: new Date(),
        updated_at: new Date(),
      });
    }
    console.log(`✓ Created ${outfits.length} sample outfits`);

    // Create 5 UI Elements
    const uiElements = [];
    const uiTypes = ['Header', 'Footer', 'Navigation', 'Button', 'Modal'];
    uiTypes.forEach((type) => {
      const elementId = uuidv4();
      uiElements.push({
        id: elementId,
        name: `${type} Element`,
        element_type: type,
        description: `UI element for ${type} component`,
        created_at: new Date(),
        updated_at: new Date(),
      });
    });
    console.log(`✓ Created ${uiElements.length} UI elements`);

    // Create 3 Backgrounds
    const backgrounds = [];
    const bgNames = ['Studio Backdrop', 'Outdoor Scene', 'Indoor Setting'];
    bgNames.forEach((name) => {
      const bgId = uuidv4();
      backgrounds.push({
        id: bgId,
        name,
        description: `Background: ${name}`,
        created_at: new Date(),
        updated_at: new Date(),
      });
    });
    console.log(`✓ Created ${backgrounds.length} backgrounds`);

    console.log('\n✅ Database seeding completed successfully!');
    console.log(`
    Summary:
    - Show: 1 (Styling Adventures w Lala)
    - Episodes: ${episodes.length}
    - Clips: ${clips.length}
    - Outfits: ${outfits.length}
    - UI Elements: ${uiElements.length}
    - Backgrounds: ${backgrounds.length}
    `);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await getPool().end();
  }
}

// Run seed
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
