export const CANVAS_PRESETS = {
  youtube: {
    name: 'YouTube',
    icon: '▶️',
    width: 1920,
    height: 1080,
    ratio: '16:9',
    description: 'Standard YouTube video',
    color: '#FF0000'
  },
  youtube_shorts: {
    name: 'YouTube Shorts',
    icon: '📱',
    width: 1080,
    height: 1920,
    ratio: '9:16',
    description: 'Vertical short-form video',
    color: '#FF0000'
  },
  instagram_feed: {
    name: 'Instagram Feed',
    icon: '📷',
    width: 1080,
    height: 1080,
    ratio: '1:1',
    description: 'Square Instagram post',
    color: '#E4405F'
  },
  instagram_story: {
    name: 'Instagram Story',
    icon: '📱',
    width: 1080,
    height: 1920,
    ratio: '9:16',
    description: 'Vertical story format',
    color: '#E4405F'
  },
  instagram_reel: {
    name: 'Instagram Reel',
    icon: '🎬',
    width: 1080,
    height: 1920,
    ratio: '9:16',
    description: 'Vertical reel format',
    color: '#E4405F'
  },
  tiktok: {
    name: 'TikTok',
    icon: '🎵',
    width: 1080,
    height: 1920,
    ratio: '9:16',
    description: 'Vertical TikTok video',
    color: '#000000'
  },
  facebook: {
    name: 'Facebook',
    icon: '👥',
    width: 1280,
    height: 720,
    ratio: '16:9',
    description: 'Facebook video post',
    color: '#1877F2'
  },
  twitter: {
    name: 'Twitter/X',
    icon: '🐦',
    width: 1280,
    height: 720,
    ratio: '16:9',
    description: 'Twitter video',
    color: '#1DA1F2'
  },
  linkedin: {
    name: 'LinkedIn',
    icon: '💼',
    width: 1920,
    height: 1080,
    ratio: '16:9',
    description: 'LinkedIn video',
    color: '#0A66C2'
  },
  custom: {
    name: 'Custom',
    icon: '⚙️',
    width: 1920,
    height: 1080,
    ratio: 'Custom',
    description: 'Custom dimensions',
    color: '#6B7280'
  }
};

export const ASSET_CATEGORIES = {
  background: { label: 'Background', icon: '🖼️', layer: 1, types: ['image', 'video'] },
  raw_footage: { label: 'Raw Footage', icon: '🎬', layer: 2, types: ['video'] },
  wardrobe: { label: 'Wardrobe', icon: '👗', layer: 3, types: ['image'] },
  prop: { label: 'Prop', icon: '🎨', layer: 3, types: ['image'] },
  graphic: { label: 'Graphic', icon: '✨', layer: 3, types: ['image'] },
  text: { label: 'Text', icon: '📝', layer: 4, types: ['image'] },
  audio: { label: 'Audio', icon: '🎵', layer: 5, types: ['audio'] },
  b_roll: { label: 'B-Roll', icon: '🎥', layer: 2, types: ['video'] }
};

export const getPresetsByRatio = (ratio) => {
  return Object.entries(CANVAS_PRESETS)
    .filter(([_, preset]) => preset.ratio === ratio)
    .map(([key, preset]) => ({ key, ...preset }));
};

export const getDefaultPreset = () => CANVAS_PRESETS.youtube;
