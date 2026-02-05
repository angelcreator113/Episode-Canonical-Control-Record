/**
 * Video Composition Constants
 * Centralized configuration for video formats, roles, and settings
 */

// Social media platform formats
export const VIDEO_FORMATS = [
  { id: 'youtube', name: 'YouTube', icon: '📺', ratio: '16:9', width: 1920, height: 1080, color: '#FF0000' },
  { id: 'instagram', name: 'Instagram', icon: '📷', ratio: '1:1', width: 1080, height: 1080, color: '#E1306C' },
  { id: 'instagram-story', name: 'IG Story', icon: '📱', ratio: '9:16', width: 1080, height: 1920, color: '#C13584' },
  { id: 'tiktok', name: 'TikTok', icon: '🎵', ratio: '9:16', width: 1080, height: 1920, color: '#000000' },
  { id: 'twitter', name: 'Twitter', icon: '🐦', ratio: '16:9', width: 1280, height: 720, color: '#1DA1F2' },
  { id: 'linkedin', name: 'LinkedIn', icon: '💼', ratio: '16:9', width: 1920, height: 1080, color: '#0077B5' },
  { id: 'facebook', name: 'Facebook', icon: '👥', ratio: '16:9', width: 1280, height: 720, color: '#1877F2' },
];

// Scene composition roles
export const SCENE_ROLES = [
  { id: 'background', label: 'Background Scene', icon: '🖼️', color: '#8b5cf6', hint: 'Full canvas background' },
  { id: 'primary', label: 'Primary Scene', icon: '🎬', color: '#3b82f6', hint: 'Main scene content' },
  { id: 'b-roll', label: 'B-Roll', icon: '📹', color: '#10b981', hint: 'Supporting footage' },
  { id: 'transition', label: 'Transition', icon: '↔️', color: '#f59e0b', hint: 'Scene transition' },
  { id: 'overlay', label: 'Overlay', icon: '✨', color: '#ec4899', hint: 'Overlay on other scenes' },
];

// Asset composition roles
export const ASSET_ROLES = [
  { id: 'background', label: 'Background Image', icon: '🖼️', color: '#8b5cf6', hint: 'Full canvas background' },
  { id: 'primary', label: 'Primary Asset', icon: '🎨', color: '#3b82f6', hint: 'Main asset content' },
  { id: 'overlay', label: 'Overlay Asset', icon: '✨', color: '#ec4899', hint: 'Overlay on other content' },
  { id: 'effect', label: 'Visual Effect', icon: '🌟', color: '#f59e0b', hint: 'Visual effects layer' },
];

// Wardrobe composition roles
export const WARDROBE_ROLES = [
  { id: 'costume', label: 'Costume Reference', icon: '👗', color: '#8b5cf6', hint: 'Character costume/outfit' },
  { id: 'overlay', label: 'Wardrobe Overlay', icon: '✨', color: '#ec4899', hint: 'Overlay wardrobe item' },
  { id: 'background', label: 'Background Item', icon: '🎨', color: '#6366f1', hint: 'Background wardrobe element' },
];

// Canvas settings
export const SNAP_THRESHOLD = 5; // pixels
export const GRID_SIZE = 20; // pixels

// Element z-index ordering
export const ELEMENT_Z_INDEX = {
  background: 0,
  primary: 1,
  'b-roll': 2,
  costume: 2,
  transition: 3,
  overlay: 4,
  effect: 5
};

// Default element transforms
export const DEFAULT_ELEMENT_TRANSFORM = {
  x: 50,
  y: 50,
  width: 200,
  height: 150,
  scale: 1,
  opacity: 100,
  rotation: 0,
  visible: true,
  locked: false
};
