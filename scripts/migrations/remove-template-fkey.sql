-- Remove foreign key constraint that prevents using template_studio IDs
-- This allows thumbnail_compositions.template_id to reference either:
-- - thumbnail_templates (legacy)
-- - template_studio (new system)

ALTER TABLE thumbnail_compositions 
DROP CONSTRAINT IF EXISTS thumbnail_compositions_template_id_fkey;

-- Optionally add comment to clarify template_id can reference multiple tables
COMMENT ON COLUMN thumbnail_compositions.template_id IS 'UUID referencing either thumbnail_templates (legacy) or template_studio (new system)';
