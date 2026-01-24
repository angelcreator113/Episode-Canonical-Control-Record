/**
 * Migration: Add library_item_id to wardrobe table
 * Links wardrobe items to the wardrobe_library system
 * Note: Only runs if wardrobe table exists
 */

exports.up = (pgm) => {
  // Add library_item_id column to wardrobe table (if table exists)
  pgm.sql(`
    DO $$ 
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wardrobe') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wardrobe' AND column_name = 'library_item_id') THEN
          ALTER TABLE wardrobe ADD COLUMN library_item_id integer REFERENCES wardrobe_library ON DELETE SET NULL;
          CREATE INDEX IF NOT EXISTS idx_wardrobe_library_item_id ON wardrobe (library_item_id);
        END IF;
      END IF;
    END $$;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DO $$ 
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wardrobe') THEN
        DROP INDEX IF EXISTS idx_wardrobe_library_item_id;
        ALTER TABLE wardrobe DROP COLUMN IF EXISTS library_item_id;
      END IF;
    END $$;
  `);
};
