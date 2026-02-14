-- Fix UTF-8 Encoding Issues in Database
-- Run this to fix corrupted data in your PostgreSQL database

-- 1. Check current database encoding
SHOW SERVER_ENCODING;
SHOW CLIENT_ENCODING;

-- 2. Set client encoding to UTF8 for this session
SET CLIENT_ENCODING TO 'UTF8';

-- 3. Fix corrupted text in assets table
-- This converts double-encoded UTF-8 back to proper UTF-8

-- Example: Fix name field if it contains corrupted characters
UPDATE assets
SET name = convert_from(convert_to(name, 'LATIN1'), 'UTF8')
WHERE name ~ '[À-ÿ]{2,}' AND name !~ '^[A-Za-z0-9_\-\. ]+$';

-- Fix description field
UPDATE assets
SET description = convert_from(convert_to(description, 'LATIN1'), 'UTF8')
WHERE description IS NOT NULL 
  AND description ~ '[À-ÿ]{2,}' 
  AND description !~ '^[A-Za-z0-9_\-\. ]+$';

-- Fix other text fields that might be corrupted
UPDATE assets
SET asset_type = convert_from(convert_to(asset_type, 'LATIN1'), 'UTF8')
WHERE asset_type ~ '[À-ÿ]{2,}';

-- Check results
SELECT id, name, description, asset_type 
FROM assets 
WHERE name ~ '[×━─│┤┐└┴┬├┼╋╪╫╬]' 
   OR description ~ '[×━─│┤┐└┴┬├┼╋╪╫╬]'
LIMIT 10;

-- Note: If the above UPDATE queries don't work, your data might be 
-- beyond repair and you may need to re-upload assets with correct encoding.
