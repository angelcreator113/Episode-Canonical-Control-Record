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
// Returns: name, item_type, color, description, season, occasion, tags, brand estimate,
// plus optional gameplay suggestions when show_id (and optionally episode_id) is
// passed in the form data. Gameplay mode pulls recent tier mix + the episode's
// event so Claude can propose context-appropriate coin_cost, lock_type, era,
// event_types, and Lala reaction blurbs.
router.post('/analyze-image', optionalAuth, upload.single('image'), async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' });

    const { showId, episodeId, wardrobe_id: wardrobeId, image_url: imageUrl } = req.body || {};

    // ── Resolve image buffer ─────────────────────────────────────────
    // Three input paths:
    //   1. multipart/form-data with req.file (user upload — the original flow)
    //   2. wardrobe_id — server fetches S3 image by looking up the row
    //   3. image_url — server fetches the URL directly
    // Paths 2 + 3 exist so the "AI Enhance" button on an already-uploaded item
    // doesn't have to fetch the image client-side (S3 CORS blocks that on the
    // dev environment). Server fetch sidesteps CORS entirely.
    let sourceBuffer = null;
    if (req.file) {
      sourceBuffer = req.file.buffer;
    } else if (wardrobeId || imageUrl) {
      try {
        let resolvedUrl = imageUrl;
        if (!resolvedUrl && wardrobeId) {
          const models = require('../models');
          const [rows] = await models.sequelize.query(
            `SELECT s3_url_processed, s3_url, thumbnail_url
             FROM wardrobe WHERE id = :id AND deleted_at IS NULL LIMIT 1`,
            { replacements: { id: wardrobeId } }
          );
          const w = rows?.[0];
          resolvedUrl = w?.s3_url_processed || w?.s3_url || w?.thumbnail_url || null;
        }
        if (!resolvedUrl) return res.status(400).json({ error: 'No image URL resolvable for this wardrobe item' });
        const axios = require('axios');
        const imgRes = await axios.get(resolvedUrl, { responseType: 'arraybuffer', timeout: 30000 });
        sourceBuffer = Buffer.from(imgRes.data);
      } catch (fetchErr) {
        console.error('[WardrobeAnalyze] server-side image fetch failed:', fetchErr.message);
        return res.status(502).json({ error: 'Could not fetch the wardrobe image server-side', message: fetchErr.message });
      }
    } else {
      return res.status(400).json({ error: 'Provide an image file, wardrobe_id, or image_url' });
    }

    const wantsGameplay = !!showId;

    // ── Build context summary (only when gameplay is requested) ─────────
    // Best-effort: any query that fails just falls out of the prompt block
    // so a misconfigured env never breaks the basic auto-fill flow.
    let contextBlock = '';
    if (wantsGameplay) {
      try {
        const models = require('../models');
        const contextLines = [];

        // Show name + era — prompt Claude with what universe we're in.
        if (models.Show) {
          const show = await models.Show.findByPk(showId);
          if (show) {
            contextLines.push(`Show: "${show.name || 'Untitled'}"`);
            if (show.current_era || show.era) contextLines.push(`Current era: ${show.current_era || show.era}`);
          }
        }

        // Recent wardrobe: last 10 items for tier distribution. Helps Claude
        // propose a tier that harmonizes (or intentionally contrasts).
        if (models.Wardrobe) {
          const recent = await models.Wardrobe.findAll({
            where: { show_id: showId, deleted_at: null },
            order: [['created_at', 'DESC']],
            limit: 10,
            attributes: ['name', 'tier', 'era_alignment', 'clothing_category'],
          });
          if (recent.length) {
            const tierCounts = recent.reduce((acc, w) => { acc[w.tier || 'unset'] = (acc[w.tier || 'unset'] || 0) + 1; return acc; }, {});
            const tierSummary = Object.entries(tierCounts).map(([t, n]) => `${t}×${n}`).join(', ');
            contextLines.push(`Recent wardrobe tier mix (last 10): ${tierSummary}`);
          }
        }

        // Episode event — if the item is being uploaded for a specific episode,
        // Claude can tailor event_types and lala_reaction blurbs to it.
        if (episodeId && models.Episode) {
          const episode = await models.Episode.findByPk(episodeId, {
            attributes: ['id', 'title', 'episode_number', 'event_type', 'event_name', 'dress_code'],
          });
          if (episode) {
            const ep = [`Episode ${episode.episode_number || '?'}: "${episode.title || 'Untitled'}"`];
            if (episode.event_type) ep.push(`event: ${episode.event_type}`);
            if (episode.event_name) ep.push(`"${episode.event_name}"`);
            if (episode.dress_code) ep.push(`dress code: ${episode.dress_code}`);
            contextLines.push(ep.join(' — '));
          }
        }

        if (contextLines.length) {
          contextBlock = `\n\nSHOW CONTEXT (use this to propose gameplay fields that fit the story):\n${contextLines.map(l => `- ${l}`).join('\n')}`;
        }
      } catch (ctxErr) {
        console.warn('[WardrobeAnalyze] Context build failed, continuing without:', ctxErr.message);
      }
    }

    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Resize + recompress before base64 encoding. Anthropic's vision API rejects
    // base64 images >5 MB, and phone photos from users commonly exceed that raw.
    // 1568px on the long side matches Anthropic's recommended max for vision and
    // keeps JPEG quality 85 under ~500 KB for typical garment shots.
    const sharp = require('sharp');
    const processed = await sharp(sourceBuffer)
      .rotate()
      .resize(1568, 1568, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    const base64 = processed.toString('base64');
    const mediaType = 'image/jpeg';

    // Two prompts: basic (current behavior) and gameplay (extended). Gameplay
    // mode gets more tokens since it's asking for 9 extra fields + 3 short
    // narrative blurbs.
    const basePrompt = `You are a fashion stylist analyzing a clothing/accessory item for a wardrobe database.

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

Return ONLY the JSON.`;

    const gameplayPrompt = `You are a fashion stylist AND a narrative designer for a luxury-world story game (the LalaVerse). Analyze this image and return JSON that covers BOTH the fashion metadata AND the in-story gameplay fields. Use the show context below to keep your gameplay suggestions consistent with the existing world.${contextBlock}

{
  "name": "descriptive name (e.g. 'Floral Smocked Sundress')",
  "item_type": "dress|top|bottom|shoes|accessory|jewelry|bag|outerwear|swimwear|activewear",
  "color": "primary color name",
  "colors": ["all colors present"],
  "description": "2-3 sentences: material, style, fit, notable details",
  "season": "spring|summer|fall|winter|all-season",
  "occasion": "casual|formal|business|party|athletic|brunch|date_night|resort",
  "brand_guess": "brand name if identifiable, or null",
  "price_estimate": "estimated retail price as a single number, minimum $150. Luxury-boutique pricing.",
  "aesthetic_tags": ["tag1", "tag2", "tag3"],
  "tier": "basic|mid|luxury|elite",
  "style_notes": "one sentence about what kind of person wears this and when",

  "coin_cost": "in-story price in LalaVerse coins — default to the same value as price_estimate unless the tier justifies a premium. integer only.",
  "acquisition_type": "purchased|gifted|borrowed|rented|custom|vintage — how Lala most likely got it given the tier and vibe",
  "lock_type": "none|coin|reputation|brand_exclusive|season_drop — pick 'none' for basic/mid staples, 'coin' or 'reputation' for luxury, 'brand_exclusive' for elite designer",
  "era_alignment": "foundation|glow_up|luxury|prime|legacy — which era of Lala's arc this item fits",
  "event_types": ["event1", "event2"],
  "outfit_match_weight": "integer 1-10, 10 = hero piece for curated outfits, 5 = neutral, 1 = filler",
  "lala_reaction_own": "one short sentence in Lala's voice about owning this — first person, confident, modern",
  "lala_reaction_locked": "one short sentence in Lala's voice when she can't have it yet — aspirational, not whiny",
  "lala_reaction_reject": "one short sentence when it's wrong for the occasion — self-aware, funny"
}

Return ONLY the JSON.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: wantsGameplay ? 1400 : 800,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: wantsGameplay ? gameplayPrompt : basePrompt },
        ],
      }],
    });

    const text = response.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'AI analysis failed — no JSON returned' });

    const analysis = JSON.parse(match[0]);
    return res.json({ success: true, data: analysis, gameplay: wantsGameplay });
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
