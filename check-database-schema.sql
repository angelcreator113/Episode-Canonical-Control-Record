-- Check which tables exist in the database
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check thumbnail_compositions columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'thumbnail_compositions' 
ORDER BY ordinal_position;

-- Check episode_wardrobe table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'episode_wardrobe' 
ORDER BY ordinal_position;

-- Check composition_assets table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'composition_assets' 
ORDER BY ordinal_position;
