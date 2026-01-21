-- Drop and recreate junction tables for clean slate
-- This ensures no schema conflicts from previous attempts

DROP TABLE IF EXISTS episode_assets CASCADE;
DROP TABLE IF EXISTS episode_wardrobe CASCADE;
DROP TABLE IF EXISTS wardrobe CASCADE;

-- Now run the creation scripts
\i create-wardrobe-tables.sql
\i create-episode-assets.sql
