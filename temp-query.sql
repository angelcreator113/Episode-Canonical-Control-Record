SELECT 
    id, 
    name,
    description,
    asset_type,
    LENGTH(name) as name_len,
    octet_length(name) as name_bytes
FROM assets 
WHERE name LIKE '%?%' 
   OR name LIKE '%Ã%'
   OR description LIKE '%?%'
   OR description LIKE '%Ã%'
LIMIT 5;
