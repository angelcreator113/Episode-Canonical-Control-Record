/**
 * Data Migration Script: Migrate Wardrobe to Library
 * Identifies unique wardrobe items and creates library entries
 * Updates wardrobe records with library_item_id references
 */

require('dotenv').config();
const { models, sequelize } = require('../src/models');
const { WardrobeLibrary, Wardrobe, WardrobeLibraryReferences } = models;

async function migrateWardrobeToLibrary() {
  console.log('🚀 Starting wardrobe to library migration...\n');

  const stats = {
    totalWardrobe: 0,
    uniqueItems: 0,
    libraryCreated: 0,
    wardrobeUpdated: 0,
    errors: 0,
  };

  try {
    // Get all wardrobe items (not deleted)
    const wardrobeItems = await Wardrobe.findAll({
      where: { deleted_at: null },
      order: [['created_at', 'ASC']],
    });

    stats.totalWardrobe = wardrobeItems.length;
    console.log(`📊 Found ${stats.totalWardrobe} wardrobe items\n`);

    if (stats.totalWardrobe === 0) {
      console.log('✅ No wardrobe items to migrate');
      return stats;
    }

    // Group items by unique identifier (name + s3_url)
    const uniqueItemsMap = new Map();

    wardrobeItems.forEach((item) => {
      const key = `${item.name}|||${item.s3_url || 'no-url'}`;

      if (!uniqueItemsMap.has(key)) {
        uniqueItemsMap.set(key, {
          name: item.name,
          character: item.character,
          clothing_category: item.clothing_category,
          description: item.description,
          s3_url: item.s3_url,
          s3_url_processed: item.s3_url_processed,
          thumbnail_url: item.thumbnail_url,
          color: item.color,
          season: item.season,
          tags: item.tags || [],
          notes: item.notes,
          wardrobeIds: [item.id],
        });
      } else {
        // Add this wardrobe ID to the list
        uniqueItemsMap.get(key).wardrobeIds.push(item.id);
      }
    });

    stats.uniqueItems = uniqueItemsMap.size;
    console.log(`🔍 Identified ${stats.uniqueItems} unique items\n`);

    // Create library entries for each unique item
    for (const [key, itemData] of uniqueItemsMap.entries()) {
      try {
        console.log(`📝 Creating library entry for: ${itemData.name}`);

        // Determine item type from clothing_category
        const itemTypeMap = {
          dress: 'dress',
          top: 'top',
          bottom: 'bottom',
          shoes: 'shoes',
          accessories: 'accessory',
          jewelry: 'accessory',
          perfume: 'accessory',
        };

        const itemType = itemTypeMap[itemData.clothing_category] || 'other';

        // Create library item
        const libraryItem = await WardrobeLibrary.create({
          name: itemData.name,
          description: itemData.description || itemData.notes,
          type: 'item',
          itemType,
          imageUrl: itemData.s3_url_processed || itemData.s3_url || 'https://via.placeholder.com/300',
          thumbnailUrl: itemData.thumbnail_url || itemData.s3_url,
          s3Key: itemData.s3_url ? itemData.s3_url.split('.com/')[1] : null,
          defaultCharacter: itemData.character,
          defaultSeason: itemData.season,
          color: itemData.color,
          tags: Array.isArray(itemData.tags) ? itemData.tags : [],
          createdBy: 'migration-script',
          updatedBy: 'migration-script',
          totalUsageCount: itemData.wardrobeIds.length,
        });

        stats.libraryCreated++;
        console.log(`  ✅ Created library item #${libraryItem.id}`);

        // Create S3 reference if s3_url exists
        if (itemData.s3_url) {
          try {
            const s3Key = itemData.s3_url.split('.com/')[1];
            if (s3Key) {
              await WardrobeLibraryReferences.create({
                libraryItemId: libraryItem.id,
                s3Key,
                referenceCount: itemData.wardrobeIds.length,
                contentType: 'image/jpeg',
              });
              console.log(`  📎 Created S3 reference for key: ${s3Key}`);
            }
          } catch (refError) {
            console.warn(`  ⚠️  Failed to create S3 reference: ${refError.message}`);
          }
        }

        // Update all wardrobe items with this library_item_id
        const updateCount = await Wardrobe.update(
          { library_item_id: libraryItem.id },
          {
            where: { id: itemData.wardrobeIds },
          }
        );

        stats.wardrobeUpdated += updateCount[0];
        console.log(`  🔗 Linked ${updateCount[0]} wardrobe items to library\n`);
      } catch (itemError) {
        console.error(`  ❌ Error creating library item: ${itemError.message}\n`);
        stats.errors++;
      }
    }

    // Verify migration
    const linkedCount = await Wardrobe.count({
      where: {
        library_item_id: { [require('sequelize').Op.not]: null },
        deleted_at: null,
      },
    });

    console.log('\n📊 Migration Summary:');
    console.log('═══════════════════════════════════════');
    console.log(`Total wardrobe items:      ${stats.totalWardrobe}`);
    console.log(`Unique items identified:   ${stats.uniqueItems}`);
    console.log(`Library entries created:   ${stats.libraryCreated}`);
    console.log(`Wardrobe items linked:     ${stats.wardrobeUpdated}`);
    console.log(`Verification count:        ${linkedCount}`);
    console.log(`Errors:                    ${stats.errors}`);
    console.log('═══════════════════════════════════════\n');

    if (linkedCount === stats.totalWardrobe) {
      console.log('✅ Migration completed successfully! All items linked.');
    } else {
      console.warn(
        `⚠️  Warning: ${stats.totalWardrobe - linkedCount} items not linked. Check errors above.`
      );
    }

    return stats;
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  (async () => {
    try {
      await sequelize.authenticate();
      console.log('✅ Database connected\n');

      const stats = await migrateWardrobeToLibrary();

      console.log('\n✅ Migration script completed');
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Migration script failed:', error);
      process.exit(1);
    }
  })();
}

module.exports = { migrateWardrobeToLibrary };
