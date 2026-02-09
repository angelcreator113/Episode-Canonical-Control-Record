export const ASSET_CATEGORIES = {
  background: {
    label: 'Background',
    icon: '🖼️',
    defaultLayer: 1,
    types: ['image', 'video'],
    description: 'Scenic shots, sets, backdrops'
  },
  raw_footage: {
    label: 'Raw Footage',
    icon: '🎬',
    defaultLayer: 2,
    types: ['video'],
    description: 'Main video content'
  },
  wardrobe: {
    label: 'Wardrobe',
    icon: '👗',
    defaultLayer: 3,
    types: ['image'],
    description: 'Clothing, accessories'
  },
  prop: {
    label: 'Prop',
    icon: '🎨',
    defaultLayer: 3,
    types: ['image'],
    description: 'Physical items'
  },
  graphic: {
    label: 'Graphic',
    icon: '✨',
    defaultLayer: 3,
    types: ['image'],
    description: 'Overlays, graphics'
  },
  text: {
    label: 'Text',
    icon: '📝',
    defaultLayer: 4,
    types: ['image'],
    description: 'Title cards, captions'
  },
  audio: {
    label: 'Audio',
    icon: '🎵',
    defaultLayer: 5,
    types: ['audio'],
    description: 'Music, SFX'
  },
  b_roll: {
    label: 'B-Roll',
    icon: '🎥',
    defaultLayer: 2,
    types: ['video'],
    description: 'Supplementary footage'
  }
};
