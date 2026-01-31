-- ============================================
-- Asset Roles System Migration
-- Adds role registry and role assignment
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create asset_roles table (show-level role definitions)
CREATE TABLE IF NOT EXISTS asset_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  show_id UUID REFERENCES shows(id) ON DELETE CASCADE,
  role_key VARCHAR(100) NOT NULL, -- Immutable identifier (HOST, GUEST_1, etc.)
  role_label VARCHAR(255) NOT NULL, -- Editable display name
  category VARCHAR(100), -- Characters, UI, Branding, Background
  icon VARCHAR(50), -- Emoji or icon code
  color VARCHAR(20), -- Hex color for UI
  is_required BOOLEAN DEFAULT false, -- Must be filled for certain operations
  sort_order INTEGER DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(show_id, role_key)
);

CREATE INDEX idx_asset_roles_show ON asset_roles(show_id);
CREATE INDEX idx_asset_roles_key ON asset_roles(role_key);

-- 2. Add role_key to assets table
ALTER TABLE assets ADD COLUMN IF NOT EXISTS role_key VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_assets_role_key ON assets(role_key);

-- 3. Insert default role set (for all existing shows)
INSERT INTO asset_roles (show_id, role_key, role_label, category, icon, color, is_required, sort_order, description)
SELECT 
  s.id as show_id,
  roles.role_key,
  roles.role_label,
  roles.category,
  roles.icon,
  roles.color,
  roles.is_required,
  roles.sort_order,
  roles.description
FROM shows s
CROSS JOIN (
  VALUES
    -- CHARACTERS
    ('HOST', 'Host (Lala)', 'Characters', '👩', '#ec4899', true, 1, 'Primary show host'),
    ('CO_HOST', 'Co-Host', 'Characters', '👤', '#f472b6', false, 2, 'Secondary host or regular guest'),
    ('GUEST_1', 'Guest 1', 'Characters', '🎤', '#a855f7', false, 3, 'Featured guest slot 1'),
    ('GUEST_2', 'Guest 2', 'Characters', '🎤', '#a855f7', false, 4, 'Featured guest slot 2'),
    ('GUEST_3', 'Guest 3', 'Characters', '🎤', '#a855f7', false, 5, 'Featured guest slot 3'),
    
    -- UI ICONS
    ('ICON_CLOSET', 'Closet Icon', 'UI Icons', '👗', '#3b82f6', false, 10, 'Wardrobe/closet UI element'),
    ('ICON_JEWELRY', 'Jewelry Box Icon', 'UI Icons', '💎', '#3b82f6', false, 11, 'Jewelry/accessories UI element'),
    ('ICON_SHOES', 'Shoes Icon', 'UI Icons', '👠', '#3b82f6', false, 12, 'Footwear UI element'),
    ('ICON_MAKEUP', 'Makeup Icon', 'UI Icons', '💄', '#3b82f6', false, 13, 'Beauty/makeup UI element'),
    
    -- UI CHROME
    ('CHROME_CURSOR', 'Cursor/Pointer', 'UI Chrome', '👆', '#6b7280', false, 20, 'Custom cursor design'),
    ('CHROME_EXIT', 'Exit Button', 'UI Chrome', '❌', '#6b7280', false, 21, 'Exit/close button'),
    ('CHROME_MINIMIZE', 'Minimize Button', 'UI Chrome', '➖', '#6b7280', false, 22, 'Minimize button'),
    
    -- BRANDING
    ('BRAND_SHOW_TITLE', 'Show Title Logo', 'Branding', '✨', '#8b5cf6', true, 30, 'Main show title/logo'),
    ('BRAND_SUBTITLE', 'Episode Subtitle', 'Branding', '📝', '#8b5cf6', false, 31, 'Episode-specific subtitle'),
    ('BRAND_WATERMARK', 'Watermark', 'Branding', '🔖', '#8b5cf6', false, 32, 'Brand watermark overlay'),
    
    -- BACKGROUND
    ('BACKGROUND_MAIN', 'Background', 'Background', '🌄', '#10b981', true, 40, 'Primary background image'),
    ('BACKGROUND_OVERLAY', 'Background Overlay', 'Background', '🎨', '#10b981', false, 41, 'Background texture/overlay')
) AS roles(role_key, role_label, category, icon, color, is_required, sort_order, description)
ON CONFLICT (show_id, role_key) DO NOTHING;

-- 4. Create function to auto-populate roles for new shows
CREATE OR REPLACE FUNCTION create_default_roles_for_show()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO asset_roles (show_id, role_key, role_label, category, icon, color, is_required, sort_order, description)
  VALUES
    (NEW.id, 'HOST', 'Host (Lala)', 'Characters', '👩', '#ec4899', true, 1, 'Primary show host'),
    (NEW.id, 'CO_HOST', 'Co-Host', 'Characters', '👤', '#f472b6', false, 2, 'Secondary host or regular guest'),
    (NEW.id, 'GUEST_1', 'Guest 1', 'Characters', '🎤', '#a855f7', false, 3, 'Featured guest slot 1'),
    (NEW.id, 'GUEST_2', 'Guest 2', 'Characters', '🎤', '#a855f7', false, 4, 'Featured guest slot 2'),
    (NEW.id, 'GUEST_3', 'Guest 3', 'Characters', '🎤', '#a855f7', false, 5, 'Featured guest slot 3'),
    (NEW.id, 'ICON_CLOSET', 'Closet Icon', 'UI Icons', '👗', '#3b82f6', false, 10, 'Wardrobe/closet UI element'),
    (NEW.id, 'ICON_JEWELRY', 'Jewelry Box Icon', 'UI Icons', '💎', '#3b82f6', false, 11, 'Jewelry/accessories UI element'),
    (NEW.id, 'ICON_SHOES', 'Shoes Icon', 'UI Icons', '👠', '#3b82f6', false, 12, 'Footwear UI element'),
    (NEW.id, 'ICON_MAKEUP', 'Makeup Icon', 'UI Icons', '💄', '#3b82f6', false, 13, 'Beauty/makeup UI element'),
    (NEW.id, 'CHROME_CURSOR', 'Cursor/Pointer', 'UI Chrome', '👆', '#6b7280', false, 20, 'Custom cursor design'),
    (NEW.id, 'CHROME_EXIT', 'Exit Button', 'UI Chrome', '❌', '#6b7280', false, 21, 'Exit/close button'),
    (NEW.id, 'CHROME_MINIMIZE', 'Minimize Button', 'UI Chrome', '➖', '#6b7280', false, 22, 'Minimize button'),
    (NEW.id, 'BRAND_SHOW_TITLE', 'Show Title Logo', 'Branding', '✨', '#8b5cf6', true, 30, 'Main show title/logo'),
    (NEW.id, 'BRAND_SUBTITLE', 'Episode Subtitle', 'Branding', '📝', '#8b5cf6', false, 31, 'Episode-specific subtitle'),
    (NEW.id, 'BRAND_WATERMARK', 'Watermark', 'Branding', '🔖', '#8b5cf6', false, 32, 'Brand watermark overlay'),
    (NEW.id, 'BACKGROUND_MAIN', 'Background', 'Background', '🌄', '#10b981', true, 40, 'Primary background image'),
    (NEW.id, 'BACKGROUND_OVERLAY', 'Background Overlay', 'Background', '🎨', '#10b981', false, 41, 'Background texture/overlay')
  ON CONFLICT (show_id, role_key) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-populate roles for new shows
DROP TRIGGER IF EXISTS trigger_create_default_roles ON shows;
CREATE TRIGGER trigger_create_default_roles
  AFTER INSERT ON shows
  FOR EACH ROW
  EXECUTE FUNCTION create_default_roles_for_show();

COMMENT ON TABLE asset_roles IS 'Show-level asset role registry defining semantic slots for assets';
COMMENT ON COLUMN assets.role_key IS 'Semantic role assignment (references asset_roles.role_key)';
