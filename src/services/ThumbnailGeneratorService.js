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
      backgroundImage, // Episode frame or gradient (Buffer)
      lalaImage, // Processed Lala promo with transparent BG (Buffer)
      guestImage, // Processed guest promo with transparent BG (Buffer)
      justawomanImage, // Optional JustAWoman promo with transparent BG (Buffer)
      justawomanPosition, // Optional custom position override for JustAWoman
      episodeTitle, // String
      episodeNumber, // Number
      brandLogo, // Optional logo image (Buffer)
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
    const {
      format,
      backgroundImage,
      lalaImage,
      guestImage,
      episodeTitle,
      episodeNumber,
      justawomanImage,
      justawomanPosition,
    } = config;

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
    const textBuffer = await this.createTextOverlay({ episodeTitle, episodeNumber }, format);
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
          left: Math.floor(format.width * 0.7),
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
          left: Math.floor(format.width * 0.7),
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
    const titleTruncated =
      titleStr.length > maxLength ? titleStr.substring(0, maxLength) + '...' : titleStr;

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
    return MVP_FORMATS.map((key) => ({
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

  /**
   * Generate thumbnail using Template Studio template
   * @param {Object} composition - Composition record with template_studio_id
   * @param {Object} format - Format specification
   * @returns {Promise<Buffer>} - Generated thumbnail buffer
   */
  async generateFromTemplateStudio(composition, format) {
    try {
      console.log(`🎨 Generating thumbnail using Template Studio (composition: ${composition.id})`);

      if (!composition.template_studio_id) {
        console.warn('⚠️  No template_studio_id, falling back to legacy generator');
        return null;
      }

      // Fetch template from database
      const { Sequelize } = require('sequelize');
      const sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        logging: false
      });

      const [templates] = await sequelize.query(`
        SELECT * FROM template_studio WHERE id = $1
      `, { bind: [composition.template_studio_id] });

      if (templates.length === 0) {
        console.error('❌ Template not found:', composition.template_studio_id);
        return null;
      }

      const template = templates[0];
      console.log(`✅ Using template: ${template.name} v${template.version}`);

      // Fetch composition assets
      const { CompositionAsset, Asset } = require('../models');
      const compositionAssets = await CompositionAsset.findAll({
        where: { composition_id: composition.id },
        include: [{
          model: Asset,
          as: 'asset',
          attributes: ['id', 'name', 's3_url_processed', 's3_url_raw', 'asset_role']
        }]
      });

      console.log(`📦 Found ${compositionAssets.length} assets for composition`);

      // Build asset map by role
      const assetsByRole = {};
      compositionAssets.forEach(ca => {
        if (ca.asset) {
          assetsByRole[ca.asset_role] = ca.asset;
        }
      });

      // Get text fields from composition_config
      const textFields = composition.composition_config?.text_fields || {};

      // Start building composite with canvas
      const canvasConfig = template.canvas_config;
      const { width, height, background_color } = canvasConfig;

      console.log(`📐 Canvas: ${width}×${height}, Background: ${background_color}`);

      // Create base canvas
      const canvas = sharp({
        create: {
          width,
          height,
          channels: 4,
          background: background_color || '#000000'
        }
      });

      // Sort role slots by z_index
      const roleSlots = [...template.role_slots].sort((a, b) => (a.z_index || 0) - (b.z_index || 0));
      console.log(`🎭 Processing ${roleSlots.length} role slots`);

      const composites = [];

      for (const slot of roleSlots) {
        const { role, position, z_index, conditional_rules, visible_by_default, text_style } = slot;

        // Check conditional visibility
        if (conditional_rules?.show_if) {
          const shouldShow = this.evaluateConditionalRule(conditional_rules.show_if, composition, assetsByRole);
          if (!shouldShow) {
            console.log(`⏭️  Skipping ${role} (conditional rule not met)`);
            continue;
          }
        }

        if (visible_by_default === false && !assetsByRole[role] && !textFields[role]) {
          console.log(`⏭️  Skipping ${role} (not visible by default, no asset)`);
          continue;
        }

        // Handle text fields
        if (role.startsWith('TEXT.') && textFields[role]) {
          const textValue = textFields[role];
          const textBuffer = await this.createTextOverlayFromTemplate(textValue, text_style, position);
          composites.push({
            input: textBuffer,
            top: position.y,
            left: position.x
          });
          console.log(`✅ Added text: ${role} = "${textValue}"`);
          continue;
        }

        // Handle image assets
        const asset = assetsByRole[role];
        if (!asset) {
          console.log(`⏭️  Skipping ${role} (no asset assigned)`);
          continue;
        }

        // Fetch and process asset image
        const imageUrl = asset.s3_url_processed || asset.s3_url_raw;
        if (!imageUrl) {
          console.warn(`⚠️  No image URL for ${role}`);
          continue;
        }

        try {
          // Download image (in production, use S3 client)
          const fetch = require('node-fetch');
          const imageResponse = await fetch(imageUrl);
          const imageBuffer = await imageResponse.buffer();

          // Resize to slot dimensions
          const resizedBuffer = await sharp(imageBuffer)
            .resize(position.width, position.height, {
              fit: 'cover',
              position: 'center'
            })
            .toBuffer();

          composites.push({
            input: resizedBuffer,
            top: position.y,
            left: position.x
          });

          console.log(`✅ Added asset: ${role} at (${position.x}, ${position.y})`);
        } catch (imageErr) {
          console.error(`❌ Failed to process ${role}:`, imageErr.message);
        }
      }

      // Composite all layers
      console.log(`🎬 Compositing ${composites.length} layers`);
      const thumbnail = await canvas
        .composite(composites)
        .png()
        .toBuffer();

      console.log(`✅ Generated thumbnail: ${thumbnail.length} bytes`);
      return thumbnail;

    } catch (error) {
      console.error('❌ Failed to generate from Template Studio:', error);
      throw error;
    }
  }

  /**
   * Evaluate conditional rule for slot visibility
   * @private
   */
  evaluateConditionalRule(ruleFlag, composition, assetsByRole) {
    switch (ruleFlag) {
      case 'EPISODE.HAS_GUEST':
        return assetsByRole['CHAR.GUEST.1'] !== undefined;
      
      case 'EPISODE.HAS_DUAL_GUESTS':
        return assetsByRole['CHAR.GUEST.1'] !== undefined && assetsByRole['CHAR.GUEST.2'] !== undefined;
      
      case 'COMPOSITION.ICONS_ENABLED':
        return Object.keys(assetsByRole).some(role => role.startsWith('UI.ICON.') && role !== 'UI.ICON.HOLDER.MAIN');
      
      case 'COMPOSITION.WARDROBE_ENABLED':
        return Object.keys(assetsByRole).some(role => role.startsWith('WARDROBE.ITEM.'));
      
      default:
        console.warn(`⚠️  Unknown conditional rule: ${ruleFlag}`);
        return true; // Default to visible
    }
  }

  /**
   * Create text overlay from template style
   * @private
   */
  async createTextOverlayFromTemplate(text, textStyle, position) {
    const {
      font_family = 'Arial',
      font_weight = 400,
      font_size = 48,
      color = '#ffffff',
      stroke,
      shadow
    } = textStyle || {};

    const { width, height } = position;

    // Build SVG with text styling
    let textStyles = `
      fill: ${color};
      font-size: ${font_size}px;
      font-family: '${font_family}', sans-serif;
      font-weight: ${font_weight};
    `;

    if (stroke) {
      textStyles += `
        stroke: ${stroke.color};
        stroke-width: ${stroke.width}px;
        paint-order: stroke fill;
      `;
    }

    // Note: SVG doesn't support text shadows directly, would need filter
    const svg = `
      <svg width="${width}" height="${height}">
        <text x="10" y="${font_size + 10}" style="${textStyles}">
          ${text}
        </text>
      </svg>
    `;

    return Buffer.from(svg);
  }
}

module.exports = new ThumbnailGeneratorService();
