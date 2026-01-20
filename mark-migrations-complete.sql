-- First ensure the pgmigrations table has proper constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pgmigrations_name_key'
  ) THEN
    ALTER TABLE pgmigrations ADD CONSTRAINT pgmigrations_name_key UNIQUE (name);
  END IF;
END $$;

-- Mark existing migrations as completed to prevent re-creation attempts
INSERT INTO pgmigrations (name, run_on) 
VALUES 
  ('20240101000000-create-base-schema', NOW()),
  ('20240101000001-create-file-storage', NOW()),
  ('20260101000001-add-thumbnail-type', NOW()),
  ('20260105000000-add-composition-versioning', NOW()),
  ('20260105000001-add-filtering-indexes', NOW()),
  ('20260116105409-create-scenes-table', NOW()),
  ('20260116105500-add-advanced-scene-fields', NOW()),
  ('20260118000000-create-shows-table', NOW()),
  ('20260119000000-add-show-id-to-episodes', NOW())
ON CONFLICT (name) DO NOTHING;
