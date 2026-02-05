/**
 * Migration: Fix Wardrobe Table Schema
 * Corrects column mismatches between migration and model
 */

exports.up = (pgm) => {
  // Check if columns exist before trying to modify
  // Drop incorrect columns if they exist
  pgm.sql(`
    DO $$ 
    BEGIN
      -- Drop columns that shouldn't exist
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wardrobe' AND column_name='brand') THEN
        ALTER TABLE wardrobe DROP COLUMN brand;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wardrobe' AND column_name='price') THEN
        ALTER TABLE wardrobe DROP COLUMN price;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wardrobe' AND column_name='purchase_link') THEN
        ALTER TABLE wardrobe DROP COLUMN purchase_link;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wardrobe' AND column_name='website') THEN
        ALTER TABLE wardrobe DROP COLUMN website;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wardrobe' AND column_name='size') THEN
        ALTER TABLE wardrobe DROP COLUMN size;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wardrobe' AND column_name='occasion') THEN
        ALTER TABLE wardrobe DROP COLUMN occasion;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wardrobe' AND column_name='outfit_set_id') THEN
        ALTER TABLE wardrobe DROP COLUMN outfit_set_id;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wardrobe' AND column_name='outfit_set_name') THEN
        ALTER TABLE wardrobe DROP COLUMN outfit_set_name;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wardrobe' AND column_name='scene_description') THEN
        ALTER TABLE wardrobe DROP COLUMN scene_description;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wardrobe' AND column_name='outfit_notes') THEN
        ALTER TABLE wardrobe DROP COLUMN outfit_notes;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wardrobe' AND column_name='image_url') THEN
        ALTER TABLE wardrobe DROP COLUMN image_url;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wardrobe' AND column_name='s3_key') THEN
        ALTER TABLE wardrobe DROP COLUMN s3_key;
      END IF;

      -- Add correct columns if they don't exist
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wardrobe' AND column_name='description') THEN
        ALTER TABLE wardrobe ADD COLUMN description text;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wardrobe' AND column_name='s3_url') THEN
        ALTER TABLE wardrobe ADD COLUMN s3_url text;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wardrobe' AND column_name='s3_url_processed') THEN
        ALTER TABLE wardrobe ADD COLUMN s3_url_processed text;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wardrobe' AND column_name='notes') THEN
        ALTER TABLE wardrobe ADD COLUMN notes text;
      END IF;

      -- Fix tags column if it's jsonb instead of text[]
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wardrobe' AND column_name='tags' AND data_type='jsonb') THEN
        ALTER TABLE wardrobe DROP COLUMN tags;
        ALTER TABLE wardrobe ADD COLUMN tags text[] DEFAULT '{}';
      END IF;
    END $$;
  `);
};

exports.down = (pgm) => {
  // Revert is complex, so we'll just note it here
  // In practice, you'd rarely need to roll this back
};
