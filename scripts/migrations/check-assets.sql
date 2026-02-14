SELECT 
  id,
  name,
  asset_type,
  asset_role,
  asset_group,
  created_at
FROM assets
WHERE deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 10;
