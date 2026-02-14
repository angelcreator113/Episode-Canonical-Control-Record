/**
 * Human-friendly labels for asset roles
 * Used in UI to translate CATEGORY.ROLE.VARIANT to readable text
 */
export const ROLE_LABELS = {
  // Backgrounds
  'BG.MAIN': 'Main Background',
  'BG.PATTERN': 'Background Pattern',
  'BG.TEXTURE': 'Background Texture',
  
  // Characters
  'CHAR.HOST.PRIMARY': 'LaLa (Primary Host)',
  'CHAR.CO_HOST.PRIMARY': 'JustAWoman (Co-Host)',
  'CHAR.HOST.ALTERNATE': 'LaLa (Alternate Pose)',
  
  // Guests
  'GUEST.REACTION.1': 'Guest Reaction Pose #1',
  'GUEST.REACTION.2': 'Guest Reaction Pose #2',
  'GUEST.HEADSHOT.PRIMARY': 'Guest Headshot',
  
  // Wardrobe Items
  'WARDROBE.ITEM.1': 'Wardrobe Item 1',
  'WARDROBE.ITEM.2': 'Wardrobe Item 2',
  'WARDROBE.ITEM.3': 'Wardrobe Item 3',
  'WARDROBE.ITEM.4': 'Wardrobe Item 4',
  'WARDROBE.ITEM.5': 'Wardrobe Item 5',
  'WARDROBE.ITEM.6': 'Wardrobe Item 6',
  'WARDROBE.ITEM.7': 'Wardrobe Item 7',
  'WARDROBE.ITEM.8': 'Wardrobe Item 8',
  
  // Wardrobe Icons
  'ICON.WARDROBE.1': 'Wardrobe Icon 1',
  'ICON.WARDROBE.2': 'Wardrobe Icon 2',
  'ICON.WARDROBE.3': 'Wardrobe Icon 3',
  'ICON.WARDROBE.4': 'Wardrobe Icon 4',
  'ICON.WARDROBE.5': 'Wardrobe Icon 5',
  'ICON.WARDROBE.6': 'Wardrobe Icon 6',
  'ICON.WARDROBE.7': 'Wardrobe Icon 7',
  'ICON.WARDROBE.8': 'Wardrobe Icon 8',
  
  // Text
  'TEXT.TITLE.PRIMARY': 'Episode Title',
  'TEXT.SUBTITLE.PRIMARY': 'Episode Subtitle',
  'TEXT.CTA.PRIMARY': 'Call to Action Text',
  
  // Brand
  'BRAND.SHOW.TITLE': 'Show Title/Logo',
  'BRAND.LOGO.PRIMARY': 'Brand Logo',
  'BRAND.LOGO.SECONDARY': 'Secondary Brand Logo',
  
  // UI Elements
  'UI.WARDROBE.PANEL': 'Wardrobe Display Panel',
  'UI.FRAME.PRIMARY': 'Decorative Frame',
  'UI.LOWER_THIRD': 'Lower Third Bar',
  
  // Icons
  'ICON.SOCIAL.YOUTUBE': 'YouTube Icon',
  'ICON.SOCIAL.INSTAGRAM': 'Instagram Icon',
  'ICON.PLAY': 'Play Button Icon'
};

/**
 * Get friendly label for a role, with fallback
 */
export function getRoleLabel(role) {
  return ROLE_LABELS[role] || role.split('.').join(' ');
}

/**
 * Get category from role string
 */
export function getRoleCategory(role) {
  const [category] = role.split('.');
  return category;
}

/**
 * Category colors for visual grouping
 */
export const CATEGORY_COLORS = {
  TEXT: '#3B82F6',    // Blue
  BG: '#10B981',      // Green
  CHAR: '#8B5CF6',    // Purple
  GUEST: '#F59E0B',   // Orange
  WARDROBE: '#EC4899', // Pink
  UI: '#6366F1',      // Indigo
  ICON: '#14B8A6',    // Teal
  BRAND: '#EF4444'    // Red
};

/**
 * Get color for a category
 */
export function getCategoryColor(category) {
  return CATEGORY_COLORS[category] || '#666';
}
