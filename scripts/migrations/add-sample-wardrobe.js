const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false
});

async function addSampleWardrobe() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // First, get an episode ID
    const [episodes] = await sequelize.query('SELECT id FROM episodes LIMIT 1');
    if (episodes.length === 0) {
      console.error('❌ No episodes found. Create an episode first.');
      return;
    }
    const episodeId = episodes[0].id;
    console.log('📺 Using episode:', episodeId);

    // Sample wardrobe items
    const wardrobeItems = [
      {
        name: 'Purple Sequin Blazer',
        asset_type: 'CLOTHING_LALA',
        metadata: {
          clothingCategory: 'top',
          brand: 'Balmain',
          website: 'balmain.com',
          purchaseLink: 'https://www.balmain.com',
          price: '2450.00',
          color: 'Purple',
          size: 'S',
          occasion: 'red-carpet',
          season: 'all-season',
          character: 'lala',
          episodeId: episodeId,
          scene: 'Opening Interview',
          timesWorn: 3,
          lastWorn: '2024-01-15',
          outfitNotes: 'Pair with black leather pants and gold heels. Make sure to steam before use.',
          isFavorite: true,
          outfitSetId: 'set-001',
          outfitSetName: 'Purple Power Look',
          previousEpisodes: ['ep-001', 'ep-003'],
          plannedForEpisodes: [],
          tags: ['sparkly', 'designer', 'statement-piece']
        }
      },
      {
        name: 'Black Leather Pants',
        asset_type: 'CLOTHING_LALA',
        metadata: {
          clothingCategory: 'bottom',
          brand: 'The Kooples',
          website: 'thekooples.com',
          purchaseLink: 'https://www.thekooples.com',
          price: '495.00',
          color: 'Black',
          size: 'S',
          occasion: 'casual',
          season: 'all-season',
          character: 'lala',
          episodeId: episodeId,
          scene: 'Opening Interview',
          timesWorn: 5,
          lastWorn: '2024-01-15',
          outfitNotes: 'Goes with everything. Ultra versatile.',
          isFavorite: true,
          outfitSetId: 'set-001',
          outfitSetName: 'Purple Power Look',
          previousEpisodes: ['ep-001', 'ep-002', 'ep-003'],
          plannedForEpisodes: ['ep-010'],
          tags: ['versatile', 'leather', 'go-to']
        }
      },
      {
        name: 'Gold Strappy Heels',
        asset_type: 'CLOTHING_LALA',
        metadata: {
          clothingCategory: 'shoes',
          brand: 'Jimmy Choo',
          website: 'jimmychoo.com',
          purchaseLink: 'https://www.jimmychoo.com',
          price: '795.00',
          color: 'Gold',
          size: '7',
          occasion: 'formal',
          season: 'all-season',
          character: 'lala',
          episodeId: episodeId,
          scene: 'Opening Interview',
          timesWorn: 2,
          lastWorn: '2024-01-15',
          outfitNotes: 'Comfortable for long shoots. Add heel grips.',
          isFavorite: false,
          outfitSetId: 'set-001',
          outfitSetName: 'Purple Power Look',
          previousEpisodes: ['ep-003'],
          plannedForEpisodes: [],
          tags: ['heels', 'evening', 'gold-tone']
        }
      },
      {
        name: 'White Linen Shirt',
        asset_type: 'CLOTHING_JUSTAWOMAN',
        metadata: {
          clothingCategory: 'top',
          brand: 'Everlane',
          website: 'everlane.com',
          purchaseLink: 'https://www.everlane.com',
          price: '78.00',
          color: 'White',
          size: 'M',
          occasion: 'casual',
          season: 'spring',
          character: 'justawoman',
          episodeId: episodeId,
          scene: 'Coffee Shop Scene',
          timesWorn: 1,
          lastWorn: '2024-01-10',
          outfitNotes: 'Classic and clean. Keep crisp and pressed.',
          isFavorite: true,
          outfitSetId: 'set-002',
          outfitSetName: 'Casual Chic',
          previousEpisodes: [],
          plannedForEpisodes: ['ep-012'],
          tags: ['casual-chic', 'classic', 'easy']
        }
      },
      {
        name: 'Blue Denim Jeans',
        asset_type: 'CLOTHING_JUSTAWOMAN',
        metadata: {
          clothingCategory: 'bottom',
          brand: "Levi's",
          website: 'levis.com',
          purchaseLink: 'https://www.levis.com',
          price: '98.00',
          color: 'Blue',
          size: 'M',
          occasion: 'casual',
          season: 'all-season',
          character: 'justawoman',
          episodeId: episodeId,
          scene: 'Coffee Shop Scene',
          timesWorn: 4,
          lastWorn: '2024-01-10',
          outfitNotes: 'Perfect fit. Reliable go-to.',
          isFavorite: true,
          outfitSetId: 'set-002',
          outfitSetName: 'Casual Chic',
          previousEpisodes: ['ep-002', 'ep-004'],
          plannedForEpisodes: [],
          tags: ['denim', 'casual', 'comfortable']
        }
      },
      {
        name: 'Red Cocktail Dress',
        asset_type: 'CLOTHING_GUEST',
        metadata: {
          clothingCategory: 'dress',
          brand: 'Reformation',
          website: 'reformation.com',
          purchaseLink: 'https://www.thereformation.com',
          price: '248.00',
          color: 'Red',
          size: 'M',
          occasion: 'party',
          season: 'summer',
          character: 'guest',
          episodeId: episodeId,
          scene: 'Party Scene',
          timesWorn: 1,
          lastWorn: '2024-01-12',
          outfitNotes: 'Stunning statement piece. Reserve for special moments.',
          isFavorite: false,
          outfitSetId: '',
          outfitSetName: '',
          previousEpisodes: [],
          plannedForEpisodes: [],
          tags: ['bold', 'party', 'red-dress']
        }
      },
      {
        name: 'Diamond Stud Earrings',
        asset_type: 'CLOTHING_LALA',
        metadata: {
          clothingCategory: 'jewelry',
          brand: 'Tiffany & Co',
          website: 'tiffany.com',
          purchaseLink: 'https://www.tiffany.com',
          price: '3500.00',
          color: 'Silver',
          size: '1ct',
          occasion: 'formal',
          season: 'all-season',
          character: 'lala',
          episodeId: episodeId,
          scene: 'Multiple Scenes',
          timesWorn: 10,
          lastWorn: '2024-01-15',
          outfitNotes: 'Signature jewelry. Wear with almost everything.',
          isFavorite: true,
          outfitSetId: '',
          outfitSetName: '',
          previousEpisodes: ['ep-001', 'ep-002', 'ep-003', 'ep-004', 'ep-005'],
          plannedForEpisodes: ['ep-010', 'ep-011'],
          tags: ['signature', 'diamonds', 'luxury', 'go-to']
        }
      },
      {
        name: 'Chanel No. 5 Perfume',
        asset_type: 'CLOTHING_LALA',
        metadata: {
          clothingCategory: 'perfume',
          brand: 'Chanel',
          website: 'chanel.com',
          purchaseLink: 'https://www.chanel.com',
          price: '135.00',
          color: 'N/A',
          size: '3.4oz',
          occasion: 'everyday',
          season: 'all-season',
          character: 'lala',
          episodeId: episodeId,
          scene: 'All Scenes',
          timesWorn: 20,
          lastWorn: '2024-01-15',
          outfitNotes: 'Signature scent. Essential for character consistency.',
          isFavorite: true,
          outfitSetId: '',
          outfitSetName: '',
          previousEpisodes: ['ep-001', 'ep-002', 'ep-003', 'ep-004', 'ep-005', 'ep-006'],
          plannedForEpisodes: ['ep-010', 'ep-011', 'ep-012'],
          tags: ['signature-scent', 'luxury', 'iconic']
        }
      }
    ];

    console.log('\n🔄 Adding wardrobe items...\n');

    for (const item of wardrobeItems) {
      await sequelize.query(
        `INSERT INTO assets (id, name, asset_type, metadata, created_at, updated_at)
         VALUES (gen_random_uuid(), :name, :asset_type, :metadata, NOW(), NOW())`,
        {
          replacements: {
            name: item.name,
            asset_type: item.asset_type,
            metadata: JSON.stringify(item.metadata)
          }
        }
      );
      console.log(`✅ Added: ${item.name} (${item.metadata.character})`);
    }

    console.log('\n🎉 Successfully added 8 sample wardrobe items!');
    console.log('\n📊 Summary:');
    console.log('  - 5 Lala items (including 1 complete outfit set)');
    console.log('  - 2 Just a Woman items (1 complete outfit set)');
    console.log('  - 1 Guest item');
    console.log('  - Total Budget: $7,799.00');
    console.log('  - 5 Favorite items');
    console.log('  - 2 Complete outfit sets');
    console.log('  - Multiple items with repeat tracking\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

addSampleWardrobe();
