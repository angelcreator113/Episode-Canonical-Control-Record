const router = require('express').Router();
const multer = require('multer');
const controller = require('../controllers/wardrobeLibraryController');
const { authenticate } = require('../middleware/auth');
const notifications = require('../services/notifications');

// Optional auth — pass-through if auth unavailable
let optionalAuth;
try {
  const authModule = require('../middleware/auth');
  optionalAuth = authModule.optionalAuth || authModule.authenticate || ((req, res, next) => next());
} catch (e) {
  optionalAuth = (req, res, next) => next();
}

// Development: Skip auth if in development mode
const isDevelopment = process.env.NODE_ENV === 'development';
const authMiddleware = isDevelopment
  ? (req, res, next) => {
      req.user = { id: 'dev-user', email: 'dev@example.com', name: 'Dev User' };
      next();
    }
  : authenticate;

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WebP allowed.'));
    }
  },
});

/**
 * Wardrobe Library Routes
 * Manage wardrobe library items and outfit sets
 */

// Debug logging
router.use((req, res, next) => {
  console.log(`🔍 Wardrobe Library Route: ${req.method} ${req.path}`);
  next();
});

// Advanced search and analytics (must be before :id routes)
router.get('/stats', controller.getStats);
router.get('/advanced-search', controller.advancedSearch);
router.get('/suggestions', controller.getSuggestions);
router.get('/check-duplicates', controller.duplicateDetection);
router.get('/analytics/most-used', controller.getMostUsedItems);
router.get('/analytics/never-used', controller.getNeverUsedItems);

// Bulk operations
router.post('/bulk-assign', controller.bulkAssign);

// ── GET /for-chapter/:chapterId ───────────────────────────────────────
// All wardrobe pieces in a chapter — for NI, Continuity Guard, Chapter Brief
router.get('/for-chapter/:chapterId', optionalAuth, async (req, res) => {
  try {
    const { chapterId } = req.params;
    const models        = req.app.get('models') || require('../models');

    const chapterAssignments = await models.WardrobeContentAssignment.findAll({
      where: { content_type: 'chapter', content_id: chapterId, removed_at: null },
    });

    const lines = await models.StorytellerLine?.findAll({
      where: { chapter_id: chapterId }, attributes: ['id'],
    }) || [];

    const lineAssignments = lines.length
      ? await models.WardrobeContentAssignment.findAll({
          where: { content_type: 'scene_line', content_id: lines.map(l => l.id), removed_at: null },
        })
      : [];

    const all = [...chapterAssignments, ...lineAssignments];

    const enriched = await Promise.all(all.map(async (a) => {
      const item = await models.WardrobeLibrary?.findByPk(a.library_item_id);
      return {
        ...a.toJSON(),
        item: item ? {
          id:        item.id,
          name:      item.name,
          category:  item.category,
          color:     item.color,
          image_url: item.processed_image_url || item.image_url,
          brand:     item.brand,
        } : null,
      };
    }));

    res.json({
      chapter_id:     chapterId,
      total:          enriched.length,
      chapter_pieces: enriched.filter(a => a.content_type === 'chapter'),
      line_pieces:    enriched.filter(a => a.content_type === 'scene_line'),
      all_pieces:     enriched,
    });

  } catch (err) {
    console.error('GET /for-chapter/:chapterId error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /analyze-image — AI analyzes uploaded wardrobe image ─────────
// Returns: name, item_type, color, description, season, occasion, tags, brand estimate
router.post('/analyze-image', optionalAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image provided' });
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' });

    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Convert buffer to base64
    const base64 = req.file.buffer.toString('base64');
    const mediaType = req.file.mimetype || 'image/jpeg';

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: `You are a fashion stylist analyzing a clothing/accessory item for a wardrobe database.

Analyze this image and return JSON:
{
  "name": "descriptive name (e.g. 'Floral Smocked Sundress')",
  "item_type": "dress|top|bottom|shoes|accessory|jewelry|bag|outerwear|swimwear|activewear",
  "color": "primary color name",
  "colors": ["all colors present"],
  "description": "2-3 sentences: material, style, fit, notable details",
  "season": "spring|summer|fall|winter|all-season",
  "occasion": "casual|formal|business|party|athletic|brunch|date_night|resort",
  "brand_guess": "brand name if identifiable, or null",
  "price_estimate": "estimated retail price as a single number, minimum $150. This is a luxury fashion world — price as if sold at a high-end boutique. Examples: 250, 450, 1200",
  "aesthetic_tags": ["tag1", "tag2", "tag3"],
  "tier": "basic|mid|luxury|elite",
  "style_notes": "one sentence about what kind of person wears this and when"
}

Return ONLY the JSON.` },
        ],
      }],
    });

    const text = response.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'AI analysis failed — no JSON returned' });

    const analysis = JSON.parse(match[0]);
    return res.json({ success: true, data: analysis });
  } catch (err) {
    console.error('[WardrobeAnalyze] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Library CRUD operations
router.post('/', upload.single('image'), controller.uploadToLibrary);
router.get('/', controller.listLibrary);
router.get('/:id', controller.getLibraryItem);
router.put('/:id', upload.single('image'), controller.updateLibraryItem);
router.delete('/:id', controller.deleteLibraryItem);

// Outfit set management (Phase 3)
router.get('/:id/items', controller.getOutfitItems);
router.post('/:id/items', controller.addItemsToOutfit);
router.delete('/:setId/items/:itemId', controller.removeItemFromOutfit);

// Episode assignment
router.post('/:id/assign', controller.assignToEpisode);

// Usage tracking and analytics (Phase 5)
router.get('/:id/usage', authMiddleware, controller.getUsageHistory);
router.get('/:id/usage/shows', authMiddleware, controller.getCrossShowUsage);
router.get('/:id/usage/timeline', authMiddleware, controller.getUsageTimeline);
router.post('/:id/track-view', authMiddleware, controller.trackView);
router.post('/:id/track-selection', authMiddleware, controller.trackSelection);

// ── POST /:id/assign-content ─────────────────────────────────────────
// Assign a library item to any content type
router.post('/:id/assign-content', optionalAuth, async (req, res) => {
  try {
    const library_item_id = parseInt(req.params.id, 10);
    const {
      content_type,
      content_id,
      scene_context,
      character_id,
      character_name,
      narrative_function,
      auto_trigger_press,
    } = req.body;

    const models = req.app.get('models') || require('../models');

    const item = await models.WardrobeLibrary.findByPk(library_item_id);
    if (!item) return res.status(404).json({ error: 'Library item not found' });

    const assignment = await models.WardrobeContentAssignment.create({
      library_item_id,
      content_type,
      content_id,
      scene_context:      scene_context      || null,
      character_id:       character_id       || null,
      character_name:     character_name     || null,
      narrative_function: narrative_function || null,
    });

    // Log to usage history (existing system — new event type)
    await models.WardrobeUsageHistory?.create({
      wardrobe_library_id: library_item_id,
      event_type:  'assigned_to_content',
      event_data:  { content_type, content_id, scene_context },
      character_id: character_id || null,
    }).catch(e => console.warn('[wardrobe] usage history create error:', e?.message));

    // Auto-trigger Press notification if piece has uncovered brand tag
    let pressTriggered = false;
    if (auto_trigger_press && ['chapter', 'scene_line'].includes(content_type)) {
      const existingTag = await models.WardrobeBrandTag?.findOne({
        where: { wardrobe_item_id: String(library_item_id), coverage_status: 'uncovered' },
      });
      if (existingTag) {
        const brand = await models.LalaverseBrand?.findByPk(existingTag.brand_id);
        if (brand) {
          const PRESS_MAP = {
            fashion:   ['Solène (Undressed)', 'Taye (First Look)'],
            beauty:    ['Solène (Undressed)', 'Reyna (The Real Rate)'],
            lifestyle: ['Asha (The Cost of Wanting More)', 'Taye (First Look)'],
          };
          await notifications.sendWardrobeAlert({
            pieceName:    item.name,
            brandName:    brand.name,
            brandType:    brand.type,
            eventName:    scene_context || 'Book scene',
            sceneSummary: scene_context,
            pressReady:   PRESS_MAP[brand.category] || ['Solène (Undressed)'],
            wardrobeUrl:  `${process.env.APP_URL}/wardrobe/library/${library_item_id}`,
          }).catch(console.error);

          await assignment.update({ press_triggered: true, press_tag_id: existingTag.id });
          pressTriggered = true;
        }
      }
    }

    res.json({ ok: true, assignment, press_triggered: pressTriggered });

  } catch (err) {
    console.error('POST /:id/assign-content error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /:id/assignments ──────────────────────────────────────────────
// All places this library item has been assigned — across all content types
router.get('/:id/assignments', optionalAuth, async (req, res) => {
  try {
    const library_item_id = parseInt(req.params.id, 10);
    const models          = req.app.get('models') || require('../models');

    const assignments = await models.WardrobeContentAssignment.findAll({
      where: { library_item_id, removed_at: null },
      order: [['created_at', 'DESC']],
    });

    const grouped = { episode: [], chapter: [], scene_line: [], press: [], social: [] };

    for (const a of assignments) {
      const entry = { ...a.toJSON() };

      // Enrich with readable content label
      try {
        if (a.content_type === 'chapter') {
          const ch = await models.StorytellerChapter?.findByPk(a.content_id);
          entry.content_label = ch?.title || 'Chapter';
        } else if (a.content_type === 'scene_line') {
          const ln = await models.StorytellerLine?.findByPk(a.content_id);
          entry.content_label = ln?.content?.slice(0, 60) + '…' || 'Line';
        }
      } catch (err) { console.warn('[wardrobe] content label lookup error:', err?.message); }

      (grouped[a.content_type] = grouped[a.content_type] || []).push(entry);
    }

    res.json({ library_item_id, total: assignments.length, grouped });

  } catch (err) {
    console.error('GET /:id/assignments error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
