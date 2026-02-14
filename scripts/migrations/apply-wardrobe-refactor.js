/**
 * Apply Wardrobe System Refactor
 * Run this directly with: node apply-wardrobe-refactor.js
 */
const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  logging: console.log,
  dialect: 'postgres'
});

async function applyRefactor() {
  const transaction = await sequelize.transaction();
  
  try {
    console.log('🔄 Starting wardrobe system refactor...\n');

    // 1. Add show_id to wardrobe table
    console.log('1️⃣ Adding show_id to wardrobe table...');
    await sequelize.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'wardrobe' AND column_name = 'show_id'
        ) THEN
          ALTER TABLE wardrobe ADD COLUMN show_id uuid REFERENCES shows(id) ON DELETE SET NULL;
          CREATE INDEX idx_wardrobe_show_id ON wardrobe(show_id);
          COMMENT ON COLUMN wardrobe.show_id IS 'Primary show that owns this wardrobe item';
        END IF;
      END $$;
    `, { transaction });

    // 2. Add show_id and created_by to outfit_sets
    console.log('2️⃣ Updating outfit_sets table...');
    await sequelize.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'outfit_sets' AND column_name = 'show_id'
        ) THEN
          ALTER TABLE outfit_sets ADD COLUMN show_id uuid REFERENCES shows(id) ON DELETE CASCADE;
          CREATE INDEX idx_outfit_sets_show_id ON outfit_sets(show_id);
          COMMENT ON COLUMN outfit_sets.show_id IS 'Show that owns this default outfit set';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'outfit_sets' AND column_name = 'created_by'
        ) THEN
          ALTER TABLE outfit_sets ADD COLUMN created_by varchar(255);
          COMMENT ON COLUMN outfit_sets.created_by IS 'User who created this set';
        END IF;
      END $$;
    `, { transaction });

    // 3. Add is_episode_favorite and times_worn to episode_wardrobe
    console.log('3️⃣ Updating episode_wardrobe table...');
    await sequelize.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'episode_wardrobe' AND column_name = 'is_episode_favorite'
        ) THEN
          ALTER TABLE episode_wardrobe 
          ADD COLUMN is_episode_favorite boolean DEFAULT false NOT NULL;
          CREATE INDEX idx_episode_wardrobe_favorites 
            ON episode_wardrobe(is_episode_favorite) 
            WHERE is_episode_favorite = true;
          COMMENT ON COLUMN episode_wardrobe.is_episode_favorite IS 'Favorite look from this episode';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'episode_wardrobe' AND column_name = 'times_worn'
        ) THEN
          ALTER TABLE episode_wardrobe 
          ADD COLUMN times_worn integer DEFAULT 1 NOT NULL;
          COMMENT ON COLUMN episode_wardrobe.times_worn IS 'Times worn in this episode';
        END IF;
      END $$;
    `, { transaction });

    // 4. Create episode_outfits table
    console.log('4️⃣ Creating episode_outfits table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS episode_outfits (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        episode_id uuid NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
        name varchar(255) NOT NULL,
        description text,
        source_outfit_set_id integer REFERENCES outfit_sets(id) ON DELETE SET NULL,
        character varchar(255) NOT NULL,
        scene_ids jsonb DEFAULT '[]',
        occasion varchar(255),
        notes text,
        is_favorite boolean DEFAULT false NOT NULL,
        created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
        deleted_at timestamp with time zone
      );

      CREATE INDEX IF NOT EXISTS idx_episode_outfits_episode_id ON episode_outfits(episode_id);
      CREATE INDEX IF NOT EXISTS idx_episode_outfits_character ON episode_outfits(character);
      CREATE INDEX IF NOT EXISTS idx_episode_outfits_source_set ON episode_outfits(source_outfit_set_id);
      CREATE INDEX IF NOT EXISTS idx_episode_outfits_favorites 
        ON episode_outfits(is_favorite) WHERE is_favorite = true;

      COMMENT ON TABLE episode_outfits IS 'Episode-specific outfit instances - copied from defaults or custom';
      COMMENT ON COLUMN episode_outfits.source_outfit_set_id IS 'Default set this was copied from (null if custom)';
    `, { transaction });

    // 5. Create episode_outfit_items table
    console.log('5️⃣ Creating episode_outfit_items table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS episode_outfit_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        episode_outfit_id uuid NOT NULL REFERENCES episode_outfits(id) ON DELETE CASCADE,
        wardrobe_item_id uuid NOT NULL REFERENCES wardrobe(id) ON DELETE CASCADE,
        position integer DEFAULT 0 NOT NULL,
        required boolean DEFAULT true NOT NULL,
        notes text,
        created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
        UNIQUE(episode_outfit_id, wardrobe_item_id)
      );

      CREATE INDEX IF NOT EXISTS idx_episode_outfit_items_outfit ON episode_outfit_items(episode_outfit_id);
      CREATE INDEX IF NOT EXISTS idx_episode_outfit_items_wardrobe ON episode_outfit_items(wardrobe_item_id);
      CREATE INDEX IF NOT EXISTS idx_episode_outfit_items_position 
        ON episode_outfit_items(episode_outfit_id, position);

      COMMENT ON TABLE episode_outfit_items IS 'Items that make up episode outfit instances';
      COMMENT ON COLUMN episode_outfit_items.required IS 'Whether this item is required for the outfit';
    `, { transaction });

    // 6. Add required_flag to outfit_set_items
    console.log('6️⃣ Updating outfit_set_items table...');
    await sequelize.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'outfit_set_items' AND column_name = 'required_flag'
        ) THEN
          ALTER TABLE outfit_set_items 
          ADD COLUMN required_flag boolean DEFAULT true NOT NULL;
          COMMENT ON COLUMN outfit_set_items.required_flag IS 'Whether this item is required in the outfit';
        END IF;
      END $$;
    `, { transaction });

    // 7. Update table comments
    console.log('7️⃣ Adding documentation comments...');
    await sequelize.query(`
      COMMENT ON TABLE wardrobe IS 'Wardrobe items - can be used across multiple shows and episodes';
      COMMENT ON TABLE episode_wardrobe IS 'Tracks which wardrobe items are used in which episodes (usage tracking)';
      COMMENT ON TABLE outfit_sets IS 'Default outfit sets at Show level - templates for complete looks';
      COMMENT ON TABLE outfit_set_items IS 'Items that make up default outfit sets';
    `, { transaction });

    // 8. Record migration in pgmigrations table
    console.log('8️⃣ Recording migration...');
    await sequelize.query(`
      INSERT INTO pgmigrations (name, run_on)
      VALUES ('20260201000000-wardrobe-system-refactor', CURRENT_TIMESTAMP)
      ON CONFLICT DO NOTHING;
    `, { transaction });

    await transaction.commit();
    console.log('\n✅ Wardrobe system refactor complete!');
    console.log('\n📊 Summary:');
    console.log('  • Added show_id to wardrobe (primary ownership)');
    console.log('  • Added show_id to outfit_sets (show-level defaults)');
    console.log('  • Added is_episode_favorite to episode_wardrobe');
    console.log('  • Created episode_outfits table');
    console.log('  • Created episode_outfit_items table');
    console.log('  • Added required_flag to outfit_set_items');

  } catch (error) {
    await transaction.rollback();
    console.error('\n❌ Error during migration:', error.message);
    console.error(error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

applyRefactor();
