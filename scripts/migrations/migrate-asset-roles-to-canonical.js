/**
 * Database Migration Script
 * Updates existing asset roles to use canonical role names
 * 
 * OLD ROLES → NEW CANONICAL ROLES:
 * CHAR.HOST.PRIMARY        → CHAR.HOST.LALA
 * CHAR.CO_HOST.PRIMARY     → CHAR.HOST.JUSTAWOMANINHERPRIME
 * GUEST.REACTION.1         → CHAR.GUEST.1
 * GUEST.REACTION.2         → CHAR.GUEST.2
 */

const { models, sequelize } = require('./src/models');

async function migrateAssetRoles() {
  console.log('🔧 Starting Asset Role Migration to Canonical Names...\n');

  try {
    // Start transaction
    const transaction = await sequelize.transaction();

    try {
      // Count assets that need migration
      const toMigrate = await models.Asset.count({
        where: {
          asset_role: {
            [sequelize.Sequelize.Op.in]: [
              'CHAR.HOST.PRIMARY',
              'CHAR.CO_HOST.PRIMARY',
              'GUEST.REACTION.1',
              'GUEST.REACTION.2'
            ]
          }
        },
        transaction
      });

      console.log(`📊 Found ${toMigrate} assets to migrate\n`);

      if (toMigrate === 0) {
        console.log('✅ No assets need migration. All roles are already canonical!');
        await transaction.rollback();
        return;
      }

      // Migration 1: CHAR.HOST.PRIMARY → CHAR.HOST.LALA
      console.log('🔄 Migrating CHAR.HOST.PRIMARY → CHAR.HOST.LALA');
      const [updated1] = await models.Asset.update(
        { asset_role: 'CHAR.HOST.LALA' },
        { 
          where: { asset_role: 'CHAR.HOST.PRIMARY' },
          transaction 
        }
      );
      console.log(`   ✓ Updated ${updated1} assets\n`);

      // Migration 2: CHAR.CO_HOST.PRIMARY → CHAR.HOST.JUSTAWOMANINHERPRIME
      console.log('🔄 Migrating CHAR.CO_HOST.PRIMARY → CHAR.HOST.JUSTAWOMANINHERPRIME');
      const [updated2] = await models.Asset.update(
        { asset_role: 'CHAR.HOST.JUSTAWOMANINHERPRIME' },
        { 
          where: { asset_role: 'CHAR.CO_HOST.PRIMARY' },
          transaction 
        }
      );
      console.log(`   ✓ Updated ${updated2} assets\n`);

      // Migration 3: GUEST.REACTION.1 → CHAR.GUEST.1
      console.log('🔄 Migrating GUEST.REACTION.1 → CHAR.GUEST.1');
      const [updated3] = await models.Asset.update(
        { asset_role: 'CHAR.GUEST.1' },
        { 
          where: { asset_role: 'GUEST.REACTION.1' },
          transaction 
        }
      );
      console.log(`   ✓ Updated ${updated3} assets\n`);

      // Migration 4: GUEST.REACTION.2 → CHAR.GUEST.2
      console.log('🔄 Migrating GUEST.REACTION.2 → CHAR.GUEST.2');
      const [updated4] = await models.Asset.update(
        { asset_role: 'CHAR.GUEST.2' },
        { 
          where: { asset_role: 'GUEST.REACTION.2' },
          transaction 
        }
      );
      console.log(`   ✓ Updated ${updated4} assets\n`);

      // Commit transaction
      await transaction.commit();

      const totalUpdated = updated1 + updated2 + updated3 + updated4;
      console.log('═'.repeat(60));
      console.log(`✅ Migration Complete! Updated ${totalUpdated} assets`);
      console.log('═'.repeat(60));

      // Show summary of current roles
      const roleCounts = await models.Asset.findAll({
        attributes: [
          'asset_role',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        where: {
          asset_role: {
            [sequelize.Sequelize.Op.ne]: null
          }
        },
        group: ['asset_role'],
        raw: true
      });

      console.log('\n📊 Current Asset Role Distribution:');
      console.log('─'.repeat(60));
      roleCounts.forEach(row => {
        console.log(`   ${row.asset_role.padEnd(40)} ${row.count} assets`);
      });
      console.log('─'.repeat(60));

    } catch (error) {
      await transaction.rollback();
      throw error;
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateAssetRoles()
    .then(() => {
      console.log('\n✨ Migration script completed successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('\n💥 Migration script failed:', err);
      process.exit(1);
    });
}

module.exports = { migrateAssetRoles };
