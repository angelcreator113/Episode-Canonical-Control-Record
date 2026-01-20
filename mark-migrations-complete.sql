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
