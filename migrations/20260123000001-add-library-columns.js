/**
 * Migration: Add Library Columns to Existing Tables
 * Adds library_item_id reference to wardrobe table and approval/override columns to episode_wardrobe
 */

exports.up = (pgm) => {
  // 1. Add library_item_id to wardrobe table (if it exists)
  pgm.sql(`
    DO $$ 
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wardrobe') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wardrobe' AND column_name = 'library_item_id') THEN
          ALTER TABLE wardrobe ADD COLUMN library_item_id integer REFERENCES wardrobe_library ON DELETE SET NULL;
          CREATE INDEX IF NOT EXISTS idx_wardrobe_library_item ON wardrobe (library_item_id);
        END IF;
      END IF;
    END $$;
  `);

  // 2. Add approval columns to episode_wardrobe table (if it exists)
  pgm.sql(`
    DO $$ 
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'episode_wardrobe') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'episode_wardrobe' AND column_name = 'approval_status') THEN
          ALTER TABLE episode_wardrobe 
            ADD COLUMN approval_status varchar(50) DEFAULT 'pending',
            ADD COLUMN approved_by varchar(255),
            ADD COLUMN approved_at timestamp,
            ADD COLUMN rejection_reason text;
          
          COMMENT ON COLUMN episode_wardrobe.approval_status IS 'pending, approved, rejected';
        END IF;
      END IF;
    END $$;
  `);

  // 3. Add override columns to episode_wardrobe (NULL means use library defaults)
  pgm.sql(`
    DO $$ 
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'episode_wardrobe') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'episode_wardrobe' AND column_name = 'override_character') THEN
          ALTER TABLE episode_wardrobe
            ADD COLUMN override_character varchar(255),
            ADD COLUMN override_occasion varchar(255),
            ADD COLUMN override_season varchar(100);
        END IF;
      END IF;
    END $$;
  `);

  // 4. Add scene_id to episode_wardrobe
  pgm.sql(`
    DO $$ 
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'episode_wardrobe') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'episode_wardrobe' AND column_name = 'scene_id') THEN
          ALTER TABLE episode_wardrobe ADD COLUMN scene_id uuid REFERENCES scenes ON DELETE SET NULL;
          CREATE INDEX IF NOT EXISTS idx_episode_wardrobe_scene ON episode_wardrobe (scene_id);
        END IF;
      END IF;
    END $$;
  `);

  // 5. Add approval status index (only if table exists)
  pgm.sql(`
    DO $$ 
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'episode_wardrobe') THEN
        CREATE INDEX IF NOT EXISTS idx_episode_wardrobe_approval ON episode_wardrobe (approval_status);
      END IF;
    END $$;
  `);
};

exports.down = (pgm) => {
  // Drop indexes first
  pgm.dropIndex('episode_wardrobe', 'scene_id', { name: 'idx_episode_wardrobe_scene', ifExists: true });
  pgm.dropIndex('episode_wardrobe', 'approval_status', {
    name: 'idx_episode_wardrobe_approval',
    ifExists: true,
  });
  pgm.dropIndex('wardrobe', 'library_item_id', { name: 'idx_wardrobe_library_item', ifExists: true });

  // Drop columns
  pgm.dropColumn('episode_wardrobe', 'scene_id', { ifExists: true });
  pgm.dropColumn('episode_wardrobe', 'override_season', { ifExists: true });
  pgm.dropColumn('episode_wardrobe', 'override_occasion', { ifExists: true });
  pgm.dropColumn('episode_wardrobe', 'override_character', { ifExists: true });
  pgm.dropColumn('episode_wardrobe', 'rejection_reason', { ifExists: true });
  pgm.dropColumn('episode_wardrobe', 'approved_at', { ifExists: true });
  pgm.dropColumn('episode_wardrobe', 'approved_by', { ifExists: true });
  pgm.dropColumn('episode_wardrobe', 'approval_status', { ifExists: true });
  pgm.dropColumn('wardrobe', 'library_item_id', { ifExists: true });
};
