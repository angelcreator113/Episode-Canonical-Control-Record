/**
 * Asset Role Constants
 * Default canonical role set (~17 roles)
 * Keys are immutable; labels/required flags are workspace-editable
 */

export const ROLE_CATEGORIES = {
  CHARACTERS: 'Characters',
  UI_ICONS: 'UI Icons',
  UI_CHROME: 'UI Chrome',
  BRANDING: 'Branding',
  BACKGROUND: 'Background',
};

export const DEFAULT_ASSET_ROLES = [
  // ========== CHARACTERS ==========
  {
    role_key: 'HOST',
    role_label: 'Host (Lala)',
    category: ROLE_CATEGORIES.CHARACTERS,
    icon: '👩',
    color: '#ec4899',
    is_required: true,
    sort_order: 1,
    description: 'Primary show host',
  },
  {
    role_key: 'CO_HOST',
    role_label: 'Co-Host',
    category: ROLE_CATEGORIES.CHARACTERS,
    icon: '👤',
    color: '#f472b6',
    is_required: false,
    sort_order: 2,
    description: 'Secondary host or regular guest',
  },
  {
    role_key: 'GUEST_1',
    role_label: 'Guest 1',
    category: ROLE_CATEGORIES.CHARACTERS,
    icon: '🎤',
    color: '#a855f7',
    is_required: false,
    sort_order: 3,
    description: 'Featured guest slot 1',
  },
  {
    role_key: 'GUEST_2',
    role_label: 'Guest 2',
    category: ROLE_CATEGORIES.CHARACTERS,
    icon: '🎤',
    color: '#a855f7',
    is_required: false,
    sort_order: 4,
    description: 'Featured guest slot 2',
  },
  {
    role_key: 'GUEST_3',
    role_label: 'Guest 3',
    category: ROLE_CATEGORIES.CHARACTERS,
    icon: '🎤',
    color: '#a855f7',
    is_required: false,
    sort_order: 5,
    description: 'Featured guest slot 3',
  },

  // ========== UI ICONS ==========
  {
    role_key: 'ICON_CLOSET',
    role_label: 'Closet Icon',
    category: ROLE_CATEGORIES.UI_ICONS,
    icon: '👗',
    color: '#3b82f6',
    is_required: false,
    sort_order: 10,
    description: 'Wardrobe/closet UI element',
  },
  {
    role_key: 'ICON_JEWELRY',
    role_label: 'Jewelry Box Icon',
    category: ROLE_CATEGORIES.UI_ICONS,
    icon: '💎',
    color: '#3b82f6',
    is_required: false,
    sort_order: 11,
    description: 'Jewelry/accessories UI element',
  },
  {
    role_key: 'ICON_SHOES',
    role_label: 'Shoes Icon',
    category: ROLE_CATEGORIES.UI_ICONS,
    icon: '👠',
    color: '#3b82f6',
    is_required: false,
    sort_order: 12,
    description: 'Footwear UI element',
  },
  {
    role_key: 'ICON_MAKEUP',
    role_label: 'Makeup Icon',
    category: ROLE_CATEGORIES.UI_ICONS,
    icon: '💄',
    color: '#3b82f6',
    is_required: false,
    sort_order: 13,
    description: 'Beauty/makeup UI element',
  },

  // ========== UI CHROME ==========
  {
    role_key: 'CHROME_CURSOR',
    role_label: 'Cursor/Pointer',
    category: ROLE_CATEGORIES.UI_CHROME,
    icon: '👆',
    color: '#6b7280',
    is_required: false,
    sort_order: 20,
    description: 'Custom cursor design',
  },
  {
    role_key: 'CHROME_EXIT',
    role_label: 'Exit Button',
    category: ROLE_CATEGORIES.UI_CHROME,
    icon: '❌',
    color: '#6b7280',
    is_required: false,
    sort_order: 21,
    description: 'Exit/close button',
  },
  {
    role_key: 'CHROME_MINIMIZE',
    role_label: 'Minimize Button',
    category: ROLE_CATEGORIES.UI_CHROME,
    icon: '➖',
    color: '#6b7280',
    is_required: false,
    sort_order: 22,
    description: 'Minimize button',
  },

  // ========== BRANDING ==========
  {
    role_key: 'BRAND_SHOW_TITLE',
    role_label: 'Show Title Logo',
    category: ROLE_CATEGORIES.BRANDING,
    icon: '✨',
    color: '#8b5cf6',
    is_required: true,
    sort_order: 30,
    description: 'Main show title/logo',
  },
  {
    role_key: 'BRAND_SUBTITLE',
    role_label: 'Episode Subtitle',
    category: ROLE_CATEGORIES.BRANDING,
    icon: '📝',
    color: '#8b5cf6',
    is_required: false,
    sort_order: 31,
    description: 'Episode-specific subtitle',
  },
  {
    role_key: 'BRAND_WATERMARK',
    role_label: 'Watermark',
    category: ROLE_CATEGORIES.BRANDING,
    icon: '🔖',
    color: '#8b5cf6',
    is_required: false,
    sort_order: 32,
    description: 'Brand watermark overlay',
  },

  // ========== BACKGROUND ==========
  {
    role_key: 'BACKGROUND_MAIN',
    role_label: 'Background',
    category: ROLE_CATEGORIES.BACKGROUND,
    icon: '🌄',
    color: '#10b981',
    is_required: true,
    sort_order: 40,
    description: 'Primary background image',
  },
  {
    role_key: 'BACKGROUND_OVERLAY',
    role_label: 'Background Overlay',
    category: ROLE_CATEGORIES.BACKGROUND,
    icon: '🎨',
    color: '#10b981',
    is_required: false,
    sort_order: 41,
    description: 'Background texture/overlay',
  },
];

// Helper: Get role by key
export const getRoleByKey = (roles, roleKey) => {
  return roles.find(r => r.role_key === roleKey);
};

// Helper: Get required roles
export const getRequiredRoles = (roles) => {
  return roles.filter(r => r.is_required);
};

// Helper: Group roles by category
export const groupRolesByCategory = (roles) => {
  return roles.reduce((acc, role) => {
    const category = role.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(role);
    return acc;
  }, {});
};

// Helper: Validate if all required roles are assigned
export const validateRequiredRoles = (roles, assignedRoles) => {
  const required = getRequiredRoles(roles);
  const missing = required.filter(role => !assignedRoles[role.role_key]);
  
  return {
    valid: missing.length === 0,
    missing: missing.map(r => ({
      role_key: r.role_key,
      role_label: r.role_label,
      description: r.description,
    })),
  };
};

export default DEFAULT_ASSET_ROLES;
