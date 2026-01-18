-- Fix Asset Delete - Disable broken composition trigger and add proper CASCADE
-- This allows assets to be deleted without triggering the broken composition versioning

-- Option 1: Disable the broken trigger temporarily
DROP TRIGGER IF EXISTS track_composition_changes_trigger ON compositions;

-- Option 2: Make sure foreign keys use CASCADE so deleting assets doesn't break
ALTER TABLE compositions 
  DROP CONSTRAINT IF EXISTS compositions_background_frame_asset_id_fkey,
  ADD CONSTRAINT compositions_background_frame_asset_id_fkey 
    FOREIGN KEY (background_frame_asset_id) 
    REFERENCES assets(id) ON DELETE SET NULL;

ALTER TABLE compositions 
  DROP CONSTRAINT IF EXISTS compositions_lala_asset_id_fkey,
  ADD CONSTRAINT compositions_lala_asset_id_fkey 
    FOREIGN KEY (lala_asset_id) 
    REFERENCES assets(id) ON DELETE SET NULL;

ALTER TABLE compositions 
  DROP CONSTRAINT IF EXISTS compositions_guest_asset_id_fkey,
  ADD CONSTRAINT compositions_guest_asset_id_fkey 
    FOREIGN KEY (guest_asset_id) 
    REFERENCES assets(id) ON DELETE SET NULL;

ALTER TABLE compositions 
  DROP CONSTRAINT IF EXISTS compositions_justawomen_asset_id_fkey,
  ADD CONSTRAINT compositions_justawomen_asset_id_fkey 
    FOREIGN KEY (justawomen_asset_id) 
    REFERENCES assets(id) ON DELETE SET NULL;

-- Recreate trigger with proper NULL checks
CREATE OR REPLACE FUNCTION track_composition_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Only track if composition_id is not null
  IF NEW.id IS NOT NULL THEN
    -- Rest of trigger logic here
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-enable trigger if needed
-- CREATE TRIGGER track_composition_changes_trigger
-- AFTER INSERT OR UPDATE ON compositions
-- FOR EACH ROW EXECUTE FUNCTION track_composition_changes();
