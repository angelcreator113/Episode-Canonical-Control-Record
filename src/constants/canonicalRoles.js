/**
 * Canonical Asset Roles
 * 
 * Single source of truth for all asset roles used across the system.
 * These roles define the contract between:
 * - Asset Manager (tagging assets)
 * - Thumbnail Composer (selecting assets)
 * - Template Studio (defining layouts)
 * - Thumbnail Generator (rendering final images)
 * 
 * CRITICAL: Do not modify role names without database migration.
 * Role names are stored in:
 * - assets.asset_role
 * - template_studio.required_roles[]
 * - template_studio.optional_roles[]
 * - thumbnail_compositions.asset_map{}
 */

const CANONICAL_ROLES = {
  // ==================== CHARACTERS (4) ====================
  'CHAR.HOST.LALA': {
    label: 'Lala (Host)',
    required: true,
    icon: '👩',
    color: '#667eea',
    category: 'CHAR',
    description: 'Primary host - Lala',
    defaultSize: { width: 400, height: 600 }
  },
  'CHAR.HOST.JUSTAWOMANINHERPRIME': {
    label: 'JustAWoman (Co-Host)',
    required: true,
    icon: '💜',
    color: '#9333ea',
    category: 'CHAR',
    description: 'Co-host - Just a Woman in Her Prime',
    defaultSize: { width: 400, height: 600 }
  },
  'CHAR.GUEST.1': {
    label: 'Guest 1',
    required: false,
    icon: '👤',
    color: '#3b82f6',
    category: 'CHAR',
    description: 'Primary guest',
    defaultSize: { width: 350, height: 550 }
  },
  'CHAR.GUEST.2': {
    label: 'Guest 2',
    required: false,
    icon: '👥',
    color: '#06b6d4',
    category: 'CHAR',
    description: 'Secondary guest',
    defaultSize: { width: 350, height: 550 }
  },
  
  // ==================== ICONS (8) ====================
  'UI.ICON.CLOSET': {
    label: 'Closet Icon',
    required: false,
    icon: '👗',
    color: '#ec4899',
    category: 'UI',
    description: 'Wardrobe/closet themed icon',
    defaultSize: { width: 80, height: 80 }
  },
  'UI.ICON.JEWELRY_BOX': {
    label: 'Jewelry Box Icon',
    required: false,
    icon: '💎',
    color: '#8b5cf6',
    category: 'UI',
    description: 'Jewelry box themed icon',
    defaultSize: { width: 80, height: 80 }
  },
  'UI.ICON.TODO_LIST': {
    label: 'To-Do List Icon',
    required: false,
    icon: '📋',
    color: '#10b981',
    category: 'UI',
    description: 'Task list or checklist icon',
    defaultSize: { width: 80, height: 80 }
  },
  'UI.ICON.SPEECH': {
    label: 'Speech Bubble Icon',
    required: false,
    icon: '💬',
    color: '#3b82f6',
    category: 'UI',
    description: 'Speech or conversation bubble',
    defaultSize: { width: 80, height: 80 }
  },
  'UI.ICON.LOCATION': {
    label: 'Location Pin Icon',
    required: false,
    icon: '📍',
    color: '#ef4444',
    category: 'UI',
    description: 'Location or map pin',
    defaultSize: { width: 80, height: 80 }
  },
  'UI.ICON.PERFUME': {
    label: 'Perfume Bottle Icon',
    required: false,
    icon: '🧴',
    color: '#a855f7',
    category: 'UI',
    description: 'Perfume or fragrance bottle',
    defaultSize: { width: 80, height: 80 }
  },
  'UI.ICON.POSE': {
    label: 'Pose Icon',
    required: false,
    icon: '💃',
    color: '#f59e0b',
    category: 'UI',
    description: 'Fashion pose or stance icon',
    defaultSize: { width: 80, height: 80 }
  },
  'UI.ICON.RESERVED': {
    label: 'Reserved Icon',
    required: false,
    icon: '⭐',
    color: '#fbbf24',
    category: 'UI',
    description: 'Reserved for future use',
    defaultSize: { width: 80, height: 80 }
  },

  // ==================== ICON HOLDER (1) ====================
  'UI.ICON.HOLDER.MAIN': {
    label: 'Icon Holder',
    required: false,
    icon: '📋',
    color: '#64748b',
    category: 'ASSET',
    description: 'Container panel for icon grid',
    defaultSize: { width: 300, height: 400 }
  },
  
  // ==================== BRANDING (1) ====================
  'BRAND.SHOW.TITLE_GRAPHIC': {
    label: 'Show Title Graphic',
    required: false,
    icon: '🎨',
    color: '#6366f1',
    category: 'ASSET',
    description: 'Show logo or title graphic',
    defaultSize: { width: 500, height: 200 }
  },

  // ==================== BACKGROUND (1) ====================
  'BG.MAIN': {
    label: 'Background',
    required: false,
    icon: '🖼️',
    color: '#10b981',
    category: 'BG',
    description: 'Main background image or video frame',
    defaultSize: { width: 1920, height: 1080 }
  },

  // ==================== TEXT FIELDS (4) ====================
  'TEXT.SHOW.TITLE': {
    label: 'Show Title',
    required: false,
    icon: '📝',
    color: '#3b82f6',
    category: 'TEXT',
    description: 'Show title text overlay',
    isTextField: true,
    defaultSize: { width: 800, height: 100 },
    defaultStyle: {
      fontSize: 48,
      fontFamily: 'Arial, sans-serif',
      fontWeight: 'bold',
      color: '#ffffff',
      textAlign: 'center',
      stroke: '#000000',
      strokeWidth: 2
    }
  },
  'TEXT.CUSTOM.1': {
    label: 'Custom Text 1',
    required: false,
    icon: '✏️',
    color: '#6366f1',
    category: 'TEXT',
    description: 'User-defined text field 1',
    isTextField: true,
    defaultSize: { width: 600, height: 80 },
    defaultStyle: {
      fontSize: 36,
      fontFamily: 'Arial, sans-serif',
      fontWeight: 'normal',
      color: '#ffffff',
      textAlign: 'center',
      stroke: '#000000',
      strokeWidth: 1
    }
  },
  'TEXT.CUSTOM.2': {
    label: 'Custom Text 2',
    required: false,
    icon: '✏️',
    color: '#8b5cf6',
    category: 'TEXT',
    description: 'User-defined text field 2',
    isTextField: true,
    defaultSize: { width: 600, height: 80 },
    defaultStyle: {
      fontSize: 36,
      fontFamily: 'Arial, sans-serif',
      fontWeight: 'normal',
      color: '#ffffff',
      textAlign: 'center',
      stroke: '#000000',
      strokeWidth: 1
    }
  },
  'TEXT.CUSTOM.3': {
    label: 'Custom Text 3',
    required: false,
    icon: '✏️',
    color: '#a855f7',
    category: 'TEXT',
    description: 'User-defined text field 3',
    isTextField: true,
    defaultSize: { width: 600, height: 80 },
    defaultStyle: {
      fontSize: 36,
      fontFamily: 'Arial, sans-serif',
      fontWeight: 'normal',
      color: '#ffffff',
      textAlign: 'center',
      stroke: '#000000',
      strokeWidth: 1
    }
  },
  
  // ==================== UI CHROME (3) ====================
  'UI.MOUSE.CURSOR': {
    label: 'Mouse Cursor',
    required: false,
    icon: '🖱️',
    color: '#6b7280',
    category: 'UI',
    description: 'Animated cursor or pointer',
    defaultSize: { width: 40, height: 40 }
  },
  'UI.BUTTON.EXIT': {
    label: 'Exit Button',
    required: false,
    icon: '❌',
    color: '#ef4444',
    category: 'UI',
    description: 'Window close/exit button',
    defaultSize: { width: 60, height: 60 }
  },
  'UI.BUTTON.MINIMIZE': {
    label: 'Minimize Button',
    required: false,
    icon: '➖',
    color: '#f59e0b',
    category: 'UI',
    description: 'Window minimize button',
    defaultSize: { width: 60, height: 60 }
  },
  
  // ==================== WARDROBE (9) ====================
  'WARDROBE.PANEL': {
    label: 'Wardrobe Panel',
    required: false,
    icon: '📋',
    color: '#8b5cf6',
    category: 'WARDROBE',
    description: 'Container panel for wardrobe items',
    autoManaged: true,
    defaultSize: { width: 350, height: 500 }
  },
  'WARDROBE.ITEM.1': {
    label: 'Wardrobe Item 1',
    required: false,
    icon: '👗',
    color: '#ec4899',
    category: 'WARDROBE',
    description: 'Wardrobe showcase item slot 1',
    defaultSize: { width: 100, height: 100 }
  },
  'WARDROBE.ITEM.2': {
    label: 'Wardrobe Item 2',
    required: false,
    icon: '👠',
    color: '#ec4899',
    category: 'WARDROBE',
    description: 'Wardrobe showcase item slot 2',
    defaultSize: { width: 100, height: 100 }
  },
  'WARDROBE.ITEM.3': {
    label: 'Wardrobe Item 3',
    required: false,
    icon: '👜',
    color: '#ec4899',
    category: 'WARDROBE',
    description: 'Wardrobe showcase item slot 3',
    defaultSize: { width: 100, height: 100 }
  },
  'WARDROBE.ITEM.4': {
    label: 'Wardrobe Item 4',
    required: false,
    icon: '💄',
    color: '#ec4899',
    category: 'WARDROBE',
    description: 'Wardrobe showcase item slot 4',
    defaultSize: { width: 100, height: 100 }
  },
  'WARDROBE.ITEM.5': {
    label: 'Wardrobe Item 5',
    required: false,
    icon: '💍',
    color: '#ec4899',
    category: 'WARDROBE',
    description: 'Wardrobe showcase item slot 5',
    defaultSize: { width: 100, height: 100 }
  },
  'WARDROBE.ITEM.6': {
    label: 'Wardrobe Item 6',
    required: false,
    icon: '👒',
    color: '#ec4899',
    category: 'WARDROBE',
    description: 'Wardrobe showcase item slot 6',
    defaultSize: { width: 100, height: 100 }
  },
  'WARDROBE.ITEM.7': {
    label: 'Wardrobe Item 7',
    required: false,
    icon: '👓',
    color: '#ec4899',
    category: 'WARDROBE',
    description: 'Wardrobe showcase item slot 7',
    defaultSize: { width: 100, height: 100 }
  },
  'WARDROBE.ITEM.8': {
    label: 'Wardrobe Item 8',
    required: false,
    icon: '⌚',
    color: '#ec4899',
    category: 'WARDROBE',
    description: 'Wardrobe showcase item slot 8',
    defaultSize: { width: 100, height: 100 }
  },
};

/**
 * Helper functions
 */

// Get all roles by category
const getRolesByCategory = (category) => {
  return Object.entries(CANONICAL_ROLES)
    .filter(([_, config]) => config.category === category)
    .reduce((acc, [role, config]) => ({ ...acc, [role]: config }), {});
};

// Get required roles
const getRequiredRoles = () => {
  return Object.entries(CANONICAL_ROLES)
    .filter(([_, config]) => config.required)
    .map(([role]) => role);
};

// Get optional roles
const getOptionalRoles = () => {
  return Object.entries(CANONICAL_ROLES)
    .filter(([_, config]) => !config.required)
    .map(([role]) => role);
};

// Get text field roles
const getTextFieldRoles = () => {
  return Object.entries(CANONICAL_ROLES)
    .filter(([_, config]) => config.isTextField)
    .reduce((acc, [role, config]) => ({ ...acc, [role]: config }), {});
};

// Get auto-managed roles (icon holder, wardrobe panel)
const getAutoManagedRoles = () => {
  return Object.entries(CANONICAL_ROLES)
    .filter(([_, config]) => config.autoManaged)
    .reduce((acc, [role, config]) => ({ ...acc, [role]: config }), {});
};

// Validate role exists
const isValidRole = (role) => {
  return role in CANONICAL_ROLES;
};

// Get role config
const getRoleConfig = (role) => {
  return CANONICAL_ROLES[role] || null;
};

// Get all categories
const getCategories = () => {
  return [...new Set(Object.values(CANONICAL_ROLES).map(config => config.category))];
};

module.exports = {
  CANONICAL_ROLES,
  getRolesByCategory,
  getRequiredRoles,
  getOptionalRoles,
  getTextFieldRoles,
  getAutoManagedRoles,
  isValidRole,
  getRoleConfig,
  getCategories
};
