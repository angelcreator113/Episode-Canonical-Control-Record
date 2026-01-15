/**
 * Thumbnail Generator Service
 * Handles multi-format social media thumbnail generation using Sharp
 */

const sharp = require('sharp');

/**
 * Define thumbnail formats for MVP (Phase 2.5)
 * Phase 3 will expand to all 8 formats
 */
const THUMBNAIL_FORMATS = {
  YOUTUBE: {
    id: 'youtube',
    name: 'YouTube Hero',
    platform: 'YouTube',
    width: 1920,
    height: 1080,
    aspectRatio: '16:9',
  },
  INSTAGRAM_FEED: {
    id: 'instagram-feed',
    name: 'Instagram Feed',
    platform: 'Instagram',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
  },
};

/**
 * MVP Formats Only
 */
const MVP_FORMATS = ['YOUTUBE', 'INSTAGRAM_FEED'];

class ThumbnailGeneratorService {
  /**
   * Generate thumbnails in all MVP formats
   * @param {Object} config - Composition configuration
   * @returns {Promise<Array>} - Array of generated thumbnails with metadata
   */
  async generateAllFormats(config) {
    const {
      backgroundImage,      // Episode frame or gradient (Buffer)
      lalaImage,            // Processed Lala promo with transparent BG (Buffer)
      guestImage,           // Processed guest promo with transparent BG (Buffer)
      justawomanImage,      // Optional JustAWoman promo with transparent BG (Buffer)
      justawomanPosition,   // Optional custom position override for JustAWoman
      episodeTitle,         // String
      episodeNumber,        // Number
      brandLogo,            // Optional logo image (Buffer)
    } = config;

    if (!backgroundImage || !lalaImage || !guestImage) {
      throw new Error('Missing required images: backgroundImage, lalaImage, guestImage');
    }

    const thumbnails = [];
    console.log('🎬 Generating thumbnails for all MVP formats...');

    // Generate each MVP format
    for (const formatKey of MVP_FORMATS) {
      const format = THUMBNAIL_FORMATS[formatKey];
      console.log(`  📐 Generating ${format.name} (${format.width}x${format.height})...`);

      try {
        const thumbnail = await this.generateSingleFormat({
          format,
          backgroundImage,
          lalaImage,
          guestImage,
          justawomanImage,
          justawomanPosition,
          episodeTitle,
          episodeNumber,
          brandLogo,
        });

        thumbnails.push({
          format: format.id,
          formatName: format.name,
          platform: format.platform,
          width: format.width,
          height: format.height,
          aspectRatio: format.aspectRatio,
          buffer: thumbnail,
        });

        console.log(`  ✅ ${format.name} complete`);
      } catch (error) {
        console.error(`  ❌ ${format.name} failed:`, error.message);
        throw error;
      }
    }

    console.log(`✅ Generated ${thumbnails.length} thumbnail formats`);
    return thumbnails;
  }

  /**
   * Generate single format thumbnail
   * @private
   */
  async generateSingleFormat(config) {
    const { format, backgroundImage, lalaImage, guestImage, episodeTitle, episodeNumber, justawomanImage, justawomanPosition } = config;

    // Calculate positions based on aspect ratio
    const layout = this.calculateLayout(format);

    // Build composite layers
    const composites = [];

    // 1. Semi-transparent overlay for text readability
    const overlayBuffer = Buffer.from(
      `<svg width="${format.width}" height="${format.height}">
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.2)"/>
      </svg>`
    );
    composites.push({
      input: overlayBuffer,
      blend: 'over',
    });

    // 2. Lala image (left/center positioning)
    const lalaResized = await sharp(lalaImage)
      .resize(layout.lala.width, layout.lala.height, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }, // Transparent background
      })
      .png()
      .toBuffer();

    composites.push({
      input: lalaResized,
      top: layout.lala.top,
      left: layout.lala.left,
      blend: 'over',
    });

    // 3. Guest image (right/center positioning)
    if (guestImage) {
      const guestResized = await sharp(guestImage)
        .resize(layout.guest.width, layout.guest.height, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();

      composites.push({
        input: guestResized,
        top: layout.guest.top,
        left: layout.guest.left,
        blend: 'over',
      });
    }

    // 4. JustAWoman image (top right corner, optional)
    if (justawomanImage) {
      const justawomanLayout = justawomanPosition || layout.justawoman;
      const justawomanResized = await sharp(justawomanImage)
        .resize(justawomanLayout.width, justawomanLayout.height, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();

      composites.push({
        input: justawomanResized,
        top: justawomanLayout.top,
        left: justawomanLayout.left,
        blend: 'over',
      });
    }

    // 5. Text overlay (episode title + number)
    const textBuffer = await this.createTextOverlay(
      { episodeTitle, episodeNumber },
      format
    );
    composites.push({
      input: textBuffer,
      top: layout.text.top,
      left: layout.text.left,
      blend: 'over',
    });

    // Composite everything
    const thumbnail = await sharp(backgroundImage)
      .resize(format.width, format.height, {
        fit: 'cover',
        position: 'center',
      })
      .composite(composites)
      .jpeg({ quality: 90, progressive: true })
      .toBuffer();

    return thumbnail;
  }

  /**
   * Calculate layout positions for different aspect ratios
   * @private
   */
  calculateLayout(format) {
    const isPortrait = format.height > format.width; // 9:16
    const isSquare = format.width === format.height; // 1:1

    if (isPortrait) {
      // Vertical layout (Instagram Story, TikTok) - NOT IN MVP
      return {
        lala: {
          width: Math.floor(format.width * 0.6),
          height: Math.floor(format.height * 0.4),
          top: Math.floor(format.height * 0.1),
          left: Math.floor(format.width * 0.2),
        },
        guest: {
          width: Math.floor(format.width * 0.5),
          height: Math.floor(format.height * 0.35),
          top: Math.floor(format.height * 0.5),
          left: Math.floor(format.width * 0.25),
        },
        justawoman: {
          width: Math.floor(format.width * 0.25),
          height: Math.floor(format.height * 0.25),
          top: Math.floor(format.height * 0.05),
          left: Math.floor(format.width * 0.70),
        },
        text: {
          top: Math.floor(format.height * 0.85),
          left: Math.floor(format.width * 0.05),
        },
      };
    } else if (isSquare) {
      // Square layout (Instagram Feed) - MVP
      return {
        lala: {
          width: Math.floor(format.width * 0.35),
          height: Math.floor(format.height * 0.55),
          top: Math.floor(format.height * 0.15),
          left: Math.floor(format.width * 0.08),
        },
        guest: {
          width: Math.floor(format.width * 0.35),
          height: Math.floor(format.height * 0.55),
          top: Math.floor(format.height * 0.15),
          left: Math.floor(format.width * 0.57),
        },
        justawoman: {
          width: Math.floor(format.width * 0.25),
          height: Math.floor(format.height * 0.25),
          top: Math.floor(format.height * 0.05),
          left: Math.floor(format.width * 0.70),
        },
        text: {
          top: Math.floor(format.height * 0.8),
          left: Math.floor(format.width * 0.05),
        },
      };
    } else {
      // Horizontal layout (YouTube, Facebook, Twitter) - MVP
      return {
        lala: {
          width: Math.floor(format.width * 0.25),
          height: Math.floor(format.height * 0.65),
          top: Math.floor(format.height * 0.15),
          left: Math.floor(format.width * 0.08),
        },
        guest: {
          width: Math.floor(format.width * 0.22),
          height: Math.floor(format.height * 0.6),
          top: Math.floor(format.height * 0.2),
          left: Math.floor(format.width * 0.7),
        },
        justawoman: {
          width: Math.floor(format.width * 0.18),
          height: Math.floor(format.height * 0.4),
          top: Math.floor(format.height * 0.05),
          left: Math.floor(format.width * 0.76),
        },
        text: {
          top: Math.floor(format.height * 0.65),
          left: Math.floor(format.width * 0.08),
        },
      };
    }
  }

  /**
   * Create text overlay SVG
   * @private
   */
  async createTextOverlay(config, format) {
    const { episodeTitle = 'Unknown Episode', episodeNumber = 0 } = config;
    
    // Ensure episodeTitle is a string
    const titleStr = String(episodeTitle || 'Unknown Episode');
    const maxLength = Math.floor(format.width / 50); // Rough char limit based on width
    const titleTruncated = titleStr.length > maxLength 
      ? titleStr.substring(0, maxLength) + '...'
      : titleStr;

    const fontSize = Math.max(24, Math.floor(format.width / 24));
    const episodeFontSize = Math.floor(fontSize * 0.6);

    const svg = `
      <svg width="${format.width}" height="${Math.floor(format.height * 0.2)}">
        <defs>
          <style>
            .title { 
              fill: white; 
              font-size: ${fontSize}px; 
              font-family: 'Arial', sans-serif; 
              font-weight: bold;
              text-anchor: start;
            }
            .episode {
              fill: #FFD700;
              font-size: ${episodeFontSize}px;
              font-family: 'Arial', sans-serif;
              font-weight: bold;
              text-anchor: start;
            }
          </style>
        </defs>
        <text x="30" y="${episodeFontSize + 10}" class="episode">Episode ${episodeNumber}</text>
        <text x="30" y="${episodeFontSize + fontSize + 15}" class="title">${titleTruncated}</text>
      </svg>
    `;

    return Buffer.from(svg);
  }

  /**
   * Get all available formats (for API documentation)
   */
  getAvailableFormats() {
    return MVP_FORMATS.map(key => ({
      ...THUMBNAIL_FORMATS[key],
      available: true,
    }));
  }

  /**
   * Get MVP formats only
   */
  getMVPFormats() {
    return this.getAvailableFormats();
  }
}

module.exports = new ThumbnailGeneratorService();
