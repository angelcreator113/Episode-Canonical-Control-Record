/**
 * Thumbnail Format Definitions
 * Standard output formats for thumbnail generation
 */

export const THUMBNAIL_FORMATS = {
  youtube_hero: {
    id: 'youtube_hero',
    name: 'YouTube Hero',
    width: 1920,
    height: 1080,
    aspectRatio: '16:9',
    description: 'Full HD hero image for YouTube'
  },
  youtube_thumbnail: {
    id: 'youtube_thumbnail',
    name: 'YouTube Thumbnail',
    width: 1280,
    height: 720,
    aspectRatio: '16:9',
    description: 'Standard YouTube thumbnail'
  },
  youtube_mobile: {
    id: 'youtube_mobile',
    name: 'YouTube Mobile',
    width: 640,
    height: 360,
    aspectRatio: '16:9',
    description: 'Mobile-optimized YouTube thumbnail'
  },
  instagram_square: {
    id: 'instagram_square',
    name: 'Instagram Square',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    description: 'Instagram feed post'
  },
  instagram_story: {
    id: 'instagram_story',
    name: 'Instagram Story',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    description: 'Instagram Stories format'
  },
  facebook_post: {
    id: 'facebook_post',
    name: 'Facebook Post',
    width: 1200,
    height: 630,
    aspectRatio: '1.91:1',
    description: 'Facebook feed post'
  },
  twitter_card: {
    id: 'twitter_card',
    name: 'Twitter Card',
    width: 1200,
    height: 675,
    aspectRatio: '16:9',
    description: 'Twitter summary card with large image'
  }
};

// Helper function to get format by ID
export const getFormat = (formatId) => {
  return THUMBNAIL_FORMATS[formatId] || THUMBNAIL_FORMATS.youtube_hero;
};

// Helper function to get all formats as array
export const getAllFormats = () => {
  return Object.values(THUMBNAIL_FORMATS);
};

// Helper function to get formats by platform
export const getFormatsByPlatform = (platform) => {
  return Object.values(THUMBNAIL_FORMATS).filter(f => 
    f.id.toLowerCase().startsWith(platform.toLowerCase())
  );
};
