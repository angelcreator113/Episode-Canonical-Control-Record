-- Check what tables exist in production database
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check if assets table exists and its columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'assets'
ORDER BY ordinal_position;

-- Check if compositions table exists and its columns  
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'compositions'
ORDER BY ordinal_position;
