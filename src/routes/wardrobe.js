const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const wardrobeController = require('../controllers/wardrobeController');
const { asyncHandler } = require('../middleware/errorHandler');

let optionalAuth;
try {
  const authModule = require('../middleware/auth');
  optionalAuth = authModule.optionalAuth || authModule.authenticate || ((req, res, next) => next());
} catch (e) {
  optionalAuth = (req, res, next) => next();
}

async function getModels() {
  try { return require('../models'); } catch (e) { return null; }
}

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

/**
 * Wardrobe Routes
 * Base path: /api/v1/wardrobe
 */

// Get staging items (unassigned wardrobe items)
router.get('/staging', asyncHandler(wardrobeController.getStagingItems));

// ═══════════════════════════════════════════
// GET /api/v1/wardrobe/categories-audit
// Diagnostic: returns every distinct clothing_category value in the DB with a
// count and its resolved slot, so creators can see at a glance which items
// fall outside the 5-slot taxonomy. Call with ?show_id=... to scope.
// Used by the Wardrobe tab to render the "Unassigned (N)" warning card.
// ═══════════════════════════════════════════
router.get('/categories-audit', optionalAuth, async (req, res) => {
  try {
    const { show_id } = req.query;
    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not available' });
    const { getSlotForCategory } = require('../utils/wardrobeSlots');

    const where = show_id ? 'WHERE (show_id = :show_id OR show_id IS NULL) AND deleted_at IS NULL' : 'WHERE deleted_at IS NULL';
    const [rows] = await models.sequelize.query(
      `SELECT clothing_category AS category, COUNT(*)::int AS count
       FROM wardrobe ${where}
       GROUP BY clothing_category
       ORDER BY count DESC`,
      { replacements: show_id ? { show_id } : {} }
    );

    const report = (rows || []).map(r => ({
      category: r.category,
      count: r.count,
      slot: getSlotForCategory(r.category),
      mapped: getSlotForCategory(r.category) !== null,
    }));
    const unmapped = report.filter(r => !r.mapped);
    const unmappedCount = unmapped.reduce((s, r) => s + r.count, 0);

    return res.json({
      success: true,
      total_rows: report.reduce((s, r) => s + r.count, 0),
      distinct_categories: report.length,
      unmapped_count: unmappedCount,
      unmapped_categories: unmapped.map(r => r.category).filter(Boolean),
      breakdown: report,
    });
  } catch (err) {
    console.error('[categories-audit] failed:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════
// GET /api/v1/wardrobe/outfit/:episode_id
// Returns wardrobe items linked (locked) to an episode
// ═══════════════════════════════════════════
router.get('/outfit/:episode_id', optionalAuth, async (req, res) => {
  try {
    const { episode_id } = req.params;
    if (!episode_id) return res.status(400).json({ error: 'episode_id is required' });

    const models = await getModels();
    if (!models) return res.json({ items: [] }); // graceful — no models = empty outfit

    // Check if episode_wardrobe table exists
    const [tables] = await models.sequelize.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'episode_wardrobe' LIMIT 1`
    );
    if (!tables?.length) return res.json({ items: [] });

    const [items] = await models.sequelize.query(`
      SELECT w.*,
        (SELECT COUNT(*) FROM wardrobe wp WHERE wp.parent_item_id = w.id AND wp.deleted_at IS NULL) as attachment_count
      FROM episode_wardrobe ew
      JOIN wardrobe w ON w.id = ew.wardrobe_id
      WHERE ew.episode_id = :episode_id
        AND (w.deleted_at IS NULL)
        AND w.parent_item_id IS NULL
      ORDER BY ew.created_at ASC
    `, { replacements: { episode_id } });

    // Fetch attachment pieces for items that have them
    const itemIds = (items || []).filter(i => parseInt(i.attachment_count) > 0).map(i => i.id);
    let allPieces = [];
    if (itemIds.length > 0) {
      const [pieces] = await models.sequelize.query(`
        SELECT * FROM wardrobe WHERE parent_item_id IN (:itemIds) AND deleted_at IS NULL
        ORDER BY attachment_type ASC, name ASC
      `, { replacements: { itemIds } });
      allPieces = pieces || [];
    }

    // Parse JSON fields so frontend gets arrays/objects
    const safeParseJSON = (val, fallback) => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'object' && val !== null) return val;
      if (typeof val === 'string') { try { return JSON.parse(val); } catch { return fallback; } }
      return fallback;
    };
    const parsed = (items || []).map(item => ({
      ...item,
      aesthetic_tags: safeParseJSON(item.aesthetic_tags, []),
      event_types: safeParseJSON(item.event_types, []),
      dress_code_keywords: safeParseJSON(item.dress_code_keywords, []),
      attachment_pieces: allPieces.filter(p => p.parent_item_id === item.id),
    }));

    return res.json({ items: parsed });
  } catch (error) {
    console.error('Load outfit error:', error.message);
    // Return empty array instead of 500 — outfit loading should never block gameplay
    return res.json({ items: [] });
  }
});

// ═══════════════════════════════════════════
// GET /api/v1/wardrobe/outfit-score/:episodeId
// Returns synergy score for the locked outfit
// ═══════════════════════════════════════════
router.get('/outfit-score/:episodeId', optionalAuth, async (req, res) => {
  try {
    const { episodeId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not available' });

    // Get the episode's event context from world_events
    const [episodes] = await models.sequelize.query(
      `SELECT e.*, we.name as event_name, we.event_type, we.dress_code,
              we.dress_code_keywords, we.prestige, we.strictness, we.host_brand
       FROM episodes e
       LEFT JOIN world_events we ON we.used_in_episode_id = e.id
       WHERE e.id = :episodeId`,
      { replacements: { episodeId } }
    );

    const ep = episodes?.[0];
    const event = ep ? {
      name: ep.event_name,
      event_type: ep.event_type,
      dress_code: ep.dress_code,
      dress_code_keywords: _parseJSON(ep.dress_code_keywords, []),
      prestige: ep.prestige,
      strictness: ep.strictness,
      host_brand: ep.host_brand,
    } : {};

    const result = await getOutfitScore(models, episodeId, event);
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('Outfit score endpoint error:', error);
    return res.status(500).json({ error: 'Failed to compute outfit score', detail: error.message });
  }
});

// List all wardrobe items
router.get('/', asyncHandler(wardrobeController.listWardrobeItems));

// Create new wardrobe item
router.post('/', upload.single('image'), asyncHandler(wardrobeController.createWardrobeItem));

// Get item usage across shows/episodes
router.get('/:id/usage', asyncHandler(wardrobeController.getItemUsage));

// Get single wardrobe item
router.get('/:id', asyncHandler(wardrobeController.getWardrobeItem));

// Update wardrobe item
router.put('/:id', upload.single('image'), asyncHandler(wardrobeController.updateWardrobeItem));

// Process background removal for wardrobe item
router.post('/:id/process-background', asyncHandler(wardrobeController.processBackgroundRemoval));

// AI-regenerate as a studio product shot (Flux Kontext img2img)
router.post('/:id/regenerate-product-shot', asyncHandler(wardrobeController.regenerateProductShot));

// Set which image variant (original | processed | regenerated | null=auto)
// the grid card should show for this item
router.patch('/:id/primary-variant', asyncHandler(wardrobeController.setPrimaryImageVariant));

// Promote a colored-backdrop variant of this item to a phone screen
// (creates an Asset row with overlay_type='wardrobe_detail')
router.post('/:id/send-to-phone', asyncHandler(wardrobeController.sendToPhone));

// AI upscale wardrobe image (4x via Real-ESRGAN)
router.post('/:id/upscale', asyncHandler(wardrobeController.aiUpscaleItem));

// Regenerate thumbnail for existing item
router.post('/:id/regenerate-thumbnail', asyncHandler(wardrobeController.regenerateThumbnail));

// Premium enhancement pipeline (all enhancements combined)
router.post('/:id/premium-enhance', asyncHandler(wardrobeController.premiumEnhance));

// Add drop shadow to transparent PNG
router.post('/:id/add-shadow', asyncHandler(wardrobeController.addDropShadow));

// AI analysis (colors + tags) using Claude Vision
router.post('/:id/analyze', asyncHandler(wardrobeController.analyzeItem));

// ═══════════════════════════════════════════
// BULK OPERATIONS
// ═══════════════════════════════════════════

// Bulk enhance multiple wardrobe items
router.post('/bulk/enhance', asyncHandler(wardrobeController.bulkEnhance));

// Bulk AI upscale multiple items (limit 10)
router.post('/bulk/upscale', asyncHandler(wardrobeController.bulkUpscale));

// Bulk AI analysis (colors + tags)
router.post('/bulk/analyze', asyncHandler(wardrobeController.bulkAnalyze));

// Bulk regenerate missing thumbnails
router.post('/bulk/regenerate-thumbnails', asyncHandler(wardrobeController.bulkRegenerateThumbnails));

// POST /api/v1/wardrobe/bulk/sync-coin-costs?show_id=<id>
// One-shot backfill: sets coin_cost = price × USD_TO_COINS for rows where
// price is non-null but coin_cost is null or 0 and the item isn't already
// manually customised. Returns { updated, skipped } so the UI can toast a
// result. Use after enabling the POST/PUT auto-sync to heal historical data.
router.post('/bulk/sync-coin-costs', optionalAuth, async (req, res) => {
  try {
    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not available' });
    const { USD_TO_COINS } = require('../utils/financialRates');
    const { show_id } = req.query;
    const where = show_id ? 'AND (show_id = :show_id OR show_id IS NULL)' : '';
    const [rows] = await models.sequelize.query(
      `SELECT id, price FROM wardrobe
       WHERE deleted_at IS NULL
         AND (coin_cost IS NULL OR coin_cost = 0)
         AND price IS NOT NULL AND price > 0
         ${where}`,
      { replacements: show_id ? { show_id } : {} }
    );
    let updated = 0;
    for (const r of rows || []) {
      const coins = Math.round(parseFloat(r.price) * USD_TO_COINS);
      if (!Number.isFinite(coins) || coins <= 0) continue;
      await models.sequelize.query(
        `UPDATE wardrobe SET coin_cost = :coins, updated_at = NOW() WHERE id = :id`,
        { replacements: { coins, id: r.id } }
      );
      updated++;
    }
    return res.json({ success: true, data: { updated, scanned: (rows || []).length, skipped: (rows || []).length - updated } });
  } catch (err) {
    console.error('[bulk/sync-coin-costs] failed:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Delete wardrobe item (with safeguards)
router.delete('/:id', asyncHandler(wardrobeController.deleteWardrobeItem));


// ═══════════════════════════════════════════
// SEED DATA — 40 game-ready wardrobe items
// ═══════════════════════════════════════════

const SEED_WARDROBE = [

  // ═══════════════════════════════════════════
  // TIER: BASIC (10 items) — Owned from start
  // ═══════════════════════════════════════════

  {
    name: 'Everyday White Tee',
    clothing_category: 'top',
    tier: 'basic', lock_type: 'none', is_owned: true, is_visible: true,
    era_alignment: 'foundation',
    aesthetic_tags: ['casual', 'clean', 'minimal'],
    event_types: ['casual', 'meetup', 'photowalk'],
    coin_cost: 0, reputation_required: 0, outfit_match_weight: 3,
    color: 'white', season: 'all-season',
    lala_reaction_own: 'Simple but she makes it work.',
    lala_reaction_reject: 'Too basic for this. We need to level up.',
  },
  {
    name: 'High-Rise Black Jeans',
    clothing_category: 'bottom',
    tier: 'basic', lock_type: 'none', is_owned: true, is_visible: true,
    era_alignment: 'foundation',
    aesthetic_tags: ['casual', 'street', 'versatile'],
    event_types: ['casual', 'meetup', 'photowalk', 'brunch'],
    coin_cost: 0, reputation_required: 0, outfit_match_weight: 3,
    color: 'black', season: 'all-season',
    lala_reaction_own: 'My ride-or-die jeans.',
    lala_reaction_reject: 'Jeans? To THIS event? Bestie, no.',
  },
  {
    name: 'White Canvas Sneakers',
    clothing_category: 'shoes',
    tier: 'basic', lock_type: 'none', is_owned: true, is_visible: true,
    era_alignment: 'foundation',
    aesthetic_tags: ['casual', 'clean', 'street'],
    event_types: ['casual', 'meetup', 'photowalk', 'market'],
    coin_cost: 0, reputation_required: 0, outfit_match_weight: 2,
    color: 'white', season: 'all-season',
    lala_reaction_own: 'Clean kicks. Always reliable.',
    lala_reaction_reject: 'Sneakers aren\'t giving what we need today.',
  },
  {
    name: 'Simple Gold Hoops',
    clothing_category: 'jewelry',
    tier: 'basic', lock_type: 'none', is_owned: true, is_visible: true,
    era_alignment: 'foundation',
    aesthetic_tags: ['minimal', 'elegant', 'versatile'],
    event_types: ['casual', 'brunch', 'meetup', 'salon'],
    coin_cost: 0, reputation_required: 0, outfit_match_weight: 2,
    color: 'gold', season: 'all-season',
    lala_reaction_own: 'My everyday earrings. They go with everything.',
    lala_reaction_reject: 'Too simple for this moment.',
  },
  {
    name: 'Floral Midi Skirt',
    clothing_category: 'bottom',
    tier: 'basic', lock_type: 'none', is_owned: true, is_visible: true,
    era_alignment: 'foundation',
    aesthetic_tags: ['romantic', 'soft', 'feminine'],
    event_types: ['garden', 'brunch', 'cafe', 'meetup'],
    coin_cost: 0, reputation_required: 0, outfit_match_weight: 4,
    color: 'blush', season: 'spring',
    lala_reaction_own: 'She\'s giving cottagecore princess.',
    lala_reaction_reject: 'Florals? For THIS? Groundbreaking... no.',
  },
  {
    name: 'Oversized Blazer',
    clothing_category: 'top',
    tier: 'basic', lock_type: 'none', is_owned: true, is_visible: true,
    era_alignment: 'foundation',
    aesthetic_tags: ['smart', 'elevated', 'versatile'],
    event_types: ['panel', 'brunch', 'brand_meeting', 'meetup'],
    coin_cost: 0, reputation_required: 0, outfit_match_weight: 4,
    color: 'beige', season: 'all-season',
    lala_reaction_own: 'Instant upgrade. Throw this over anything.',
    lala_reaction_reject: 'The blazer isn\'t enough today.',
  },
  {
    name: 'Basic Black Crossbody',
    clothing_category: 'accessories',
    tier: 'basic', lock_type: 'none', is_owned: true, is_visible: true,
    era_alignment: 'foundation',
    aesthetic_tags: ['minimal', 'practical', 'versatile'],
    event_types: ['casual', 'meetup', 'photowalk', 'market'],
    coin_cost: 0, reputation_required: 0, outfit_match_weight: 2,
    color: 'black', season: 'all-season',
    lala_reaction_own: 'Hands-free. Practical queen.',
    lala_reaction_reject: 'This bag is giving...nothing.',
  },
  {
    name: 'Cotton Sundress',
    clothing_category: 'dress',
    tier: 'basic', lock_type: 'none', is_owned: true, is_visible: true,
    era_alignment: 'foundation',
    aesthetic_tags: ['casual', 'soft', 'feminine'],
    event_types: ['garden', 'cafe', 'market', 'casual'],
    coin_cost: 0, reputation_required: 0, outfit_match_weight: 4,
    color: 'yellow', season: 'summer',
    lala_reaction_own: 'Easy breezy. She\'s that girl.',
    lala_reaction_reject: 'Sundress energy isn\'t what we need.',
  },
  {
    name: 'Fresh Citrus Eau de Toilette',
    clothing_category: 'perfume',
    tier: 'basic', lock_type: 'none', is_owned: true, is_visible: true,
    era_alignment: 'foundation',
    aesthetic_tags: ['fresh', 'light', 'casual'],
    event_types: ['casual', 'garden', 'brunch', 'meetup'],
    coin_cost: 0, reputation_required: 0, outfit_match_weight: 2,
    color: 'clear', season: 'summer',
    lala_reaction_own: 'Light and fresh. For the casual days.',
    lala_reaction_reject: 'This scent isn\'t memorable enough.',
  },
  {
    name: 'Denim Jacket',
    clothing_category: 'top',
    tier: 'basic', lock_type: 'none', is_owned: true, is_visible: true,
    era_alignment: 'foundation',
    aesthetic_tags: ['casual', 'street', 'layering'],
    event_types: ['casual', 'photowalk', 'meetup'],
    coin_cost: 0, reputation_required: 0, outfit_match_weight: 3,
    color: 'blue', season: 'fall',
    lala_reaction_own: 'A classic. Never goes wrong.',
    lala_reaction_reject: 'Denim jacket to a soirée? Read the room.',
  },

  // ═══════════════════════════════════════════
  // TIER: MID (10 items) — Coin locked, affordable
  // ═══════════════════════════════════════════

  {
    name: 'Satin Wrap Blouse',
    clothing_category: 'top',
    tier: 'mid', lock_type: 'coin', is_owned: false, is_visible: true,
    era_alignment: 'glow_up',
    aesthetic_tags: ['elegant', 'romantic', 'elevated'],
    event_types: ['brunch', 'soiree', 'salon', 'brand_meeting'],
    coin_cost: 150, reputation_required: 0, outfit_match_weight: 5,
    color: 'champagne', season: 'all-season',
    lala_reaction_own: 'This satin? She\'s expensive without trying.',
    lala_reaction_locked: 'Ooh... 150 coins. Soon.',
    lala_reaction_reject: 'Pretty, but not the vibe today.',
  },
  {
    name: 'Pleated Midi Dress',
    clothing_category: 'dress',
    tier: 'mid', lock_type: 'coin', is_owned: false, is_visible: true,
    era_alignment: 'glow_up',
    aesthetic_tags: ['elegant', 'feminine', 'sophisticated'],
    event_types: ['brunch', 'garden', 'soiree', 'preview'],
    coin_cost: 200, reputation_required: 0, outfit_match_weight: 6,
    color: 'sage', season: 'spring',
    lala_reaction_own: 'The way this moves? Cinema.',
    lala_reaction_locked: 'Two hundred coins... she\'s calling my name.',
    lala_reaction_reject: 'Beautiful but not bold enough for tonight.',
  },
  {
    name: 'Pointed-Toe Mules',
    clothing_category: 'shoes',
    tier: 'mid', lock_type: 'coin', is_owned: false, is_visible: true,
    era_alignment: 'glow_up',
    aesthetic_tags: ['elegant', 'modern', 'sharp'],
    event_types: ['brunch', 'brand_meeting', 'soiree', 'panel'],
    coin_cost: 120, reputation_required: 0, outfit_match_weight: 4,
    color: 'nude', season: 'all-season',
    lala_reaction_own: 'Sharp. Professional. Main character.',
    lala_reaction_locked: 'These mules are 120... not today.',
    lala_reaction_reject: 'Mules to a gala? We\'re better than that.',
  },
  {
    name: 'Pearl Drop Earrings',
    clothing_category: 'jewelry',
    tier: 'mid', lock_type: 'coin', is_owned: false, is_visible: true,
    era_alignment: 'glow_up',
    aesthetic_tags: ['elegant', 'romantic', 'classic'],
    event_types: ['garden', 'soiree', 'brunch', 'salon', 'gala'],
    coin_cost: 100, reputation_required: 0, outfit_match_weight: 4,
    color: 'pearl', season: 'all-season',
    lala_reaction_own: 'Pearls are never wrong.',
    lala_reaction_locked: 'A hundred coins for these pearls... tempting.',
    lala_reaction_reject: 'Pearls are elegant but I need BOLD.',
  },
  {
    name: 'Structured Leather Tote',
    clothing_category: 'accessories',
    tier: 'mid', lock_type: 'coin', is_owned: false, is_visible: true,
    era_alignment: 'glow_up',
    aesthetic_tags: ['elevated', 'professional', 'structured'],
    event_types: ['brand_meeting', 'panel', 'preview', 'brunch'],
    coin_cost: 180, reputation_required: 0, outfit_match_weight: 4,
    color: 'cognac', season: 'fall',
    lala_reaction_own: 'This bag means business.',
    lala_reaction_locked: 'Ugh... 180. That leather though.',
    lala_reaction_reject: 'Too professional. I need glamour.',
  },
  {
    name: 'Corset Top',
    clothing_category: 'top',
    tier: 'mid', lock_type: 'coin', is_owned: false, is_visible: true,
    era_alignment: 'glow_up',
    aesthetic_tags: ['bold', 'trendy', 'statement'],
    event_types: ['soiree', 'competition', 'collab', 'photoshoot'],
    coin_cost: 160, reputation_required: 0, outfit_match_weight: 5,
    color: 'black', season: 'all-season',
    lala_reaction_own: 'Main character energy ACTIVATED.',
    lala_reaction_locked: 'She\'s 160 coins and she KNOWS it.',
    lala_reaction_reject: 'Corset? For a garden party? Too much.',
  },
  {
    name: 'A-Line Trench Coat',
    clothing_category: 'top',
    tier: 'mid', lock_type: 'reputation', is_owned: false, is_visible: true,
    era_alignment: 'glow_up',
    aesthetic_tags: ['classic', 'elevated', 'sophisticated'],
    event_types: ['brand_meeting', 'preview', 'editorial', 'panel'],
    coin_cost: 0, reputation_required: 3, outfit_match_weight: 5,
    color: 'camel', season: 'fall',
    lala_reaction_own: 'The trench coat era begins.',
    lala_reaction_locked: 'That\'s reputation tier 3... I\'m not there yet.',
    lala_reaction_reject: 'A trench isn\'t the statement I need.',
  },
  {
    name: 'Block Heel Sandals',
    clothing_category: 'shoes',
    tier: 'mid', lock_type: 'coin', is_owned: false, is_visible: true,
    era_alignment: 'glow_up',
    aesthetic_tags: ['elegant', 'comfortable', 'garden'],
    event_types: ['garden', 'soiree', 'brunch', 'salon'],
    coin_cost: 100, reputation_required: 0, outfit_match_weight: 4,
    color: 'tan', season: 'summer',
    lala_reaction_own: 'Elegant AND walkable? Sold.',
    lala_reaction_locked: 'A hundred coins... practical investment.',
    lala_reaction_reject: 'Not the shoe for this moment.',
  },
  {
    name: 'Rose & Vanilla Body Mist',
    clothing_category: 'perfume',
    tier: 'mid', lock_type: 'coin', is_owned: false, is_visible: true,
    era_alignment: 'glow_up',
    aesthetic_tags: ['romantic', 'soft', 'warm'],
    event_types: ['garden', 'soiree', 'brunch', 'date'],
    coin_cost: 80, reputation_required: 0, outfit_match_weight: 3,
    color: 'pink', season: 'spring',
    lala_reaction_own: 'She smells like a love letter.',
    lala_reaction_locked: '80 coins for a scent... worth it.',
    lala_reaction_reject: 'Too sweet for this vibe.',
  },
  {
    name: 'Fitted Blazer Dress',
    clothing_category: 'dress',
    tier: 'mid', lock_type: 'coin', is_owned: false, is_visible: true,
    era_alignment: 'glow_up',
    aesthetic_tags: ['sharp', 'powerful', 'modern'],
    event_types: ['brand_meeting', 'panel', 'competition', 'preview'],
    coin_cost: 250, reputation_required: 0, outfit_match_weight: 6,
    color: 'black', season: 'all-season',
    lala_reaction_own: 'Power. That\'s what this says.',
    lala_reaction_locked: '250... she\'s expensive but she\'s worth it.',
    lala_reaction_reject: 'Too corporate for the energy we need.',
  },

  // ═══════════════════════════════════════════
  // TIER: LUXURY (12 items) — Rep/coin locked
  // ═══════════════════════════════════════════

  {
    name: 'Silk Column Gown',
    clothing_category: 'dress',
    tier: 'luxury', lock_type: 'reputation', is_owned: false, is_visible: true,
    era_alignment: 'luxury',
    aesthetic_tags: ['couture', 'elegant', 'statement'],
    event_types: ['gala', 'awards', 'editorial', 'luxury_launch'],
    coin_cost: 500, reputation_required: 5, outfit_match_weight: 8,
    color: 'ivory', season: 'all-season',
    lala_reaction_own: 'This gown doesn\'t walk. It glides.',
    lala_reaction_locked: 'Reputation 5... one day I\'ll wear you.',
    lala_reaction_reject: 'Too formal for tonight. Saving you.',
  },
  {
    name: 'Diamond Tennis Bracelet',
    clothing_category: 'jewelry',
    tier: 'luxury', lock_type: 'coin', is_owned: false, is_visible: true,
    era_alignment: 'luxury',
    aesthetic_tags: ['luxury', 'sparkling', 'statement'],
    event_types: ['gala', 'awards', 'luxury_launch', 'editorial'],
    coin_cost: 800, reputation_required: 0, outfit_match_weight: 6,
    color: 'diamond', season: 'all-season',
    lala_reaction_own: 'Every time my wrist catches light... it\'s over.',
    lala_reaction_locked: '800 coins. She\'s EXPENSIVE.',
    lala_reaction_reject: 'Diamonds but not the right occasion.',
  },
  {
    name: 'Patent Leather Stilettos',
    clothing_category: 'shoes',
    tier: 'luxury', lock_type: 'coin', is_owned: false, is_visible: true,
    era_alignment: 'luxury',
    aesthetic_tags: ['bold', 'powerful', 'luxury'],
    event_types: ['gala', 'awards', 'luxury_launch', 'editorial', 'brand_meeting'],
    coin_cost: 600, reputation_required: 0, outfit_match_weight: 6,
    color: 'red', season: 'all-season',
    lala_reaction_own: 'Red bottoms but make it PATENT.',
    lala_reaction_locked: '600 for heels... but LOOK at them.',
    lala_reaction_reject: 'Stilettos aren\'t practical for this.',
  },
  {
    name: 'Vintage Silk Clutch',
    clothing_category: 'accessories',
    tier: 'luxury', lock_type: 'reputation', is_owned: false, is_visible: true,
    era_alignment: 'luxury',
    aesthetic_tags: ['vintage', 'elegant', 'romantic'],
    event_types: ['gala', 'soiree', 'awards', 'garden'],
    coin_cost: 400, reputation_required: 5, outfit_match_weight: 5,
    color: 'emerald', season: 'all-season',
    lala_reaction_own: 'Vintage emerald. Nobody has this.',
    lala_reaction_locked: 'Rep 5 required... and I WANT it.',
    lala_reaction_reject: 'Beautiful but not the right green.',
  },
  {
    name: 'Oud & Amber Parfum',
    clothing_category: 'perfume',
    tier: 'luxury', lock_type: 'coin', is_owned: false, is_visible: true,
    era_alignment: 'luxury',
    aesthetic_tags: ['luxury', 'bold', 'powerful'],
    event_types: ['gala', 'luxury_launch', 'brand_meeting', 'awards'],
    coin_cost: 350, reputation_required: 0, outfit_match_weight: 5,
    color: 'amber', season: 'winter',
    lala_reaction_own: 'I smell like legacy.',
    lala_reaction_locked: '350 for a fragrance... but it\'s THAT fragrance.',
    lala_reaction_reject: 'Too heavy for this event.',
  },
  {
    name: 'Embroidered Cape Blazer',
    clothing_category: 'top',
    tier: 'luxury', lock_type: 'reputation', is_owned: false, is_visible: true,
    era_alignment: 'luxury',
    aesthetic_tags: ['couture', 'bold', 'statement'],
    event_types: ['gala', 'awards', 'editorial', 'luxury_launch'],
    coin_cost: 700, reputation_required: 6, outfit_match_weight: 7,
    color: 'midnight', season: 'all-season',
    lala_reaction_own: 'Cape blazer energy. She\'s a villain arc.',
    lala_reaction_locked: 'Rep 6... the cape is waiting for me.',
    lala_reaction_reject: 'The cape is powerful but not today.',
  },
  {
    name: 'Cashmere Wrap Cardigan',
    clothing_category: 'top',
    tier: 'luxury', lock_type: 'coin', is_owned: false, is_visible: true,
    era_alignment: 'luxury',
    aesthetic_tags: ['cozy', 'soft', 'elegant'],
    event_types: ['brand_meeting', 'retreat', 'brunch', 'preview'],
    coin_cost: 450, reputation_required: 0, outfit_match_weight: 5,
    color: 'cream', season: 'fall',
    lala_reaction_own: 'Cashmere. She FEELS expensive.',
    lala_reaction_locked: '450... but this cashmere though.',
    lala_reaction_reject: 'Cozy but not the power move.',
  },
  {
    name: 'High-Slit Satin Skirt',
    clothing_category: 'bottom',
    tier: 'luxury', lock_type: 'coin', is_owned: false, is_visible: true,
    era_alignment: 'luxury',
    aesthetic_tags: ['bold', 'romantic', 'dramatic'],
    event_types: ['gala', 'soiree', 'photoshoot', 'editorial'],
    coin_cost: 500, reputation_required: 0, outfit_match_weight: 6,
    color: 'burgundy', season: 'fall',
    lala_reaction_own: 'The slit? Dramatic. The satin? Luxurious.',
    lala_reaction_locked: '500 for this skirt... she\'s worth every coin.',
    lala_reaction_reject: 'Gorgeous but I need a full look.',
  },
  {
    name: 'Architectural Gold Cuff',
    clothing_category: 'jewelry',
    tier: 'luxury', lock_type: 'reputation', is_owned: false, is_visible: true,
    era_alignment: 'luxury',
    aesthetic_tags: ['bold', 'statement', 'modern'],
    event_types: ['gala', 'editorial', 'awards', 'luxury_launch'],
    coin_cost: 300, reputation_required: 5, outfit_match_weight: 5,
    color: 'gold', season: 'all-season',
    lala_reaction_own: 'This cuff makes a statement before I do.',
    lala_reaction_locked: 'Rep 5 for this gold... I\'m almost there.',
    lala_reaction_reject: 'Too bold for today\'s vibe.',
  },
  {
    name: 'Crystal-Embellished Pumps',
    clothing_category: 'shoes',
    tier: 'luxury', lock_type: 'coin', is_owned: false, is_visible: true,
    era_alignment: 'luxury',
    aesthetic_tags: ['sparkling', 'glamorous', 'statement'],
    event_types: ['gala', 'awards', 'editorial'],
    coin_cost: 750, reputation_required: 0, outfit_match_weight: 7,
    color: 'crystal', season: 'all-season',
    lala_reaction_own: 'Every step is a light show.',
    lala_reaction_locked: '750?! Okay... saving up.',
    lala_reaction_reject: 'Crystal shoes to a brunch? Too much.',
  },
  {
    name: 'Velvet Corset Gown',
    clothing_category: 'dress',
    tier: 'luxury', lock_type: 'reputation', is_owned: false, is_visible: true,
    era_alignment: 'luxury',
    aesthetic_tags: ['dramatic', 'romantic', 'couture'],
    event_types: ['gala', 'awards', 'luxury_launch'],
    coin_cost: 900, reputation_required: 6, outfit_match_weight: 9,
    color: 'deep_plum', season: 'winter',
    lala_reaction_own: 'Velvet corset gown. Main character confirmed.',
    lala_reaction_locked: 'Rep 6... and 900 coins. She\'s a dream.',
    lala_reaction_reject: 'Saving this for THE event.',
  },
  {
    name: 'Rose Gold Chain Belt',
    clothing_category: 'accessories',
    tier: 'luxury', lock_type: 'coin', is_owned: false, is_visible: true,
    era_alignment: 'luxury',
    aesthetic_tags: ['elegant', 'modern', 'accent'],
    event_types: ['soiree', 'gala', 'editorial', 'photoshoot'],
    coin_cost: 200, reputation_required: 0, outfit_match_weight: 4,
    color: 'rose_gold', season: 'all-season',
    lala_reaction_own: 'The chain belt ties everything together.',
    lala_reaction_locked: '200 for a belt... but it completes everything.',
    lala_reaction_reject: 'A belt isn\'t the priority right now.',
  },

  // ═══════════════════════════════════════════
  // TIER: ELITE (8 items) — Brand exclusive / high rep
  // ═══════════════════════════════════════════

  {
    name: 'Maison Belle Signature Gown',
    clothing_category: 'dress',
    tier: 'elite', lock_type: 'brand_exclusive', is_owned: false, is_visible: true,
    era_alignment: 'prime',
    aesthetic_tags: ['couture', 'luxury', 'iconic'],
    event_types: ['gala', 'awards', 'celestial_ball', 'finale'],
    coin_cost: 0, reputation_required: 8,
    unlock_requirement: { brand_trust_min: 7, event_completed: 'maison_belle_brand_interest' },
    outfit_match_weight: 10,
    color: 'midnight_gold', season: 'all-season',
    lala_reaction_own: 'Maison Belle designed this FOR me.',
    lala_reaction_locked: 'The Maison Belle gown... I have to earn her.',
    lala_reaction_reject: 'I would NEVER reject this. Unless...',
  },
  {
    name: 'Couture Feather Cape',
    clothing_category: 'top',
    tier: 'elite', lock_type: 'reputation', is_owned: false, is_visible: true,
    era_alignment: 'prime',
    aesthetic_tags: ['dramatic', 'iconic', 'couture'],
    event_types: ['celestial_ball', 'awards', 'finale', 'gala'],
    coin_cost: 1500, reputation_required: 8, outfit_match_weight: 9,
    color: 'white', season: 'all-season',
    lala_reaction_own: 'She entered. Nobody else matters.',
    lala_reaction_locked: 'Rep 8... the feather cape is endgame.',
    lala_reaction_reject: 'Even I know this is for the finale.',
  },
  {
    name: 'Diamond Choker Necklace',
    clothing_category: 'jewelry',
    tier: 'elite', lock_type: 'coin', is_owned: false, is_visible: true,
    era_alignment: 'prime',
    aesthetic_tags: ['luxury', 'statement', 'iconic'],
    event_types: ['gala', 'awards', 'celestial_ball', 'finale'],
    coin_cost: 2000, reputation_required: 0, outfit_match_weight: 8,
    color: 'diamond', season: 'all-season',
    lala_reaction_own: 'This choker costs more than my first season.',
    lala_reaction_locked: 'Two THOUSAND coins. One day.',
    lala_reaction_reject: 'Diamonds... but where would I even wear this?',
  },
  {
    name: 'Custom Crystal Heels',
    clothing_category: 'shoes',
    tier: 'elite', lock_type: 'brand_exclusive', is_owned: false, is_visible: true,
    era_alignment: 'prime',
    aesthetic_tags: ['couture', 'sparkling', 'iconic'],
    event_types: ['celestial_ball', 'awards', 'finale'],
    coin_cost: 0, reputation_required: 9,
    unlock_requirement: { brand_trust_min: 8 },
    outfit_match_weight: 9,
    color: 'iridescent', season: 'all-season',
    lala_reaction_own: 'Glass slipper energy. But make it fashion.',
    lala_reaction_locked: 'Brand exclusive... I need that trust level.',
    lala_reaction_reject: 'These are for the FINAL moment.',
  },
  {
    name: 'Noir Exclusive Clutch',
    clothing_category: 'accessories',
    tier: 'elite', lock_type: 'reputation', is_owned: false, is_visible: true,
    era_alignment: 'prime',
    aesthetic_tags: ['luxury', 'elegant', 'exclusive'],
    event_types: ['gala', 'awards', 'celestial_ball', 'luxury_launch'],
    coin_cost: 1200, reputation_required: 7, outfit_match_weight: 7,
    color: 'black_gold', season: 'all-season',
    lala_reaction_own: 'This clutch has a waitlist. I didn\'t wait.',
    lala_reaction_locked: 'Rep 7... the Noir clutch awaits.',
    lala_reaction_reject: 'Not pulling her out for anything less than a gala.',
  },
  {
    name: 'Legacy Parfum — "Prime"',
    clothing_category: 'perfume',
    tier: 'elite', lock_type: 'season_drop', is_owned: false, is_visible: true,
    era_alignment: 'prime',
    aesthetic_tags: ['iconic', 'bold', 'signature'],
    event_types: ['gala', 'awards', 'celestial_ball', 'finale', 'documentary'],
    coin_cost: 0, reputation_required: 0,
    season_unlock_episode: 20,
    outfit_match_weight: 8,
    color: 'gold', season: 'all-season',
    lala_reaction_own: 'My signature scent. They\'ll remember this.',
    lala_reaction_locked: 'Drops in Episode 20... the wait.',
    lala_reaction_reject: 'I would never reject my own fragrance.',
  },
  {
    name: 'Celestial Ball Gown',
    clothing_category: 'dress',
    tier: 'elite', lock_type: 'brand_exclusive', is_owned: false, is_visible: false,
    era_alignment: 'legacy',
    aesthetic_tags: ['couture', 'iconic', 'legendary'],
    event_types: ['celestial_ball'],
    coin_cost: 0, reputation_required: 10,
    unlock_requirement: { reputation_min: 10, brand_trust_min: 9, event_completed: 'celestial_ball_invite' },
    outfit_match_weight: 10,
    color: 'constellation', season: 'all-season',
    lala_reaction_own: 'This is the dress that changed everything.',
    lala_reaction_locked: 'I can\'t even see this yet. It\'s endgame.',
    lala_reaction_reject: 'Reject the Celestial Gown? ...never.',
  },
  {
    name: 'Crown Headpiece',
    clothing_category: 'accessories',
    tier: 'elite', lock_type: 'reputation', is_owned: false, is_visible: false,
    era_alignment: 'legacy',
    aesthetic_tags: ['iconic', 'couture', 'legendary'],
    event_types: ['celestial_ball', 'finale', 'awards'],
    coin_cost: 0, reputation_required: 10, outfit_match_weight: 10,
    color: 'gold_diamond', season: 'all-season',
    lala_reaction_own: 'Not a tiara. A crown.',
    lala_reaction_locked: 'This exists. I just can\'t see it yet.',
    lala_reaction_reject: 'You don\'t reject a crown. You earn it.',
  },
];


// ═══════════════════════════════════════════
// POST /api/v1/wardrobe/seed
// ═══════════════════════════════════════════

router.post('/seed', optionalAuth, async (req, res) => {
  try {
    const { show_id, clear_existing = false } = req.body;
    if (!show_id) return res.status(400).json({ error: 'show_id is required' });

    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    if (clear_existing) {
      await models.sequelize.query(
        `DELETE FROM wardrobe WHERE show_id = :show_id AND name IN (:names)`,
        { replacements: { show_id, names: SEED_WARDROBE.map(i => i.name) } }
      );
    }

    let created = 0, skipped = 0;
    const results = [];

    for (const item of SEED_WARDROBE) {
      // Check duplicate
      const [existing] = await models.sequelize.query(
        `SELECT id FROM wardrobe WHERE show_id = :show_id AND name = :name AND deleted_at IS NULL LIMIT 1`,
        { replacements: { show_id, name: item.name } }
      );
      if (existing?.length > 0) { skipped++; continue; }

      const id = uuidv4();
      await models.sequelize.query(
        `INSERT INTO wardrobe
         (id, show_id, name, clothing_category, color, season,
          tier, lock_type, unlock_requirement, is_owned, is_visible,
          era_alignment, aesthetic_tags, event_types, outfit_match_weight,
          coin_cost, reputation_required, influence_required, season_unlock_episode,
          lala_reaction_own, lala_reaction_locked, lala_reaction_reject,
          created_at, updated_at)
         VALUES
         (:id, :show_id, :name, :clothing_category, :color, :season,
          :tier, :lock_type, CAST(:unlock_requirement AS JSONB), :is_owned, :is_visible,
          :era_alignment, CAST(:aesthetic_tags AS JSONB), CAST(:event_types AS JSONB), :outfit_match_weight,
          :coin_cost, :reputation_required, :influence_required, :season_unlock_episode,
          :lala_reaction_own, :lala_reaction_locked, :lala_reaction_reject,
          NOW(), NOW())`,
        {
          replacements: {
            id, show_id,
            name: item.name,
            clothing_category: item.clothing_category,
            color: item.color || null,
            season: item.season || 'all-season',
            tier: item.tier,
            lock_type: item.lock_type,
            unlock_requirement: JSON.stringify(item.unlock_requirement || {}),
            is_owned: item.is_owned,
            is_visible: item.is_visible,
            era_alignment: item.era_alignment || null,
            aesthetic_tags: JSON.stringify(item.aesthetic_tags || []),
            event_types: JSON.stringify(item.event_types || []),
            outfit_match_weight: item.outfit_match_weight || 5,
            coin_cost: item.coin_cost || 0,
            reputation_required: item.reputation_required || 0,
            influence_required: item.influence_required || 0,
            season_unlock_episode: item.season_unlock_episode || null,
            lala_reaction_own: item.lala_reaction_own || null,
            lala_reaction_locked: item.lala_reaction_locked || null,
            lala_reaction_reject: item.lala_reaction_reject || null,
          },
        }
      );
      created++;
      results.push({ name: item.name, tier: item.tier, lock_type: item.lock_type, is_owned: item.is_owned });
    }

    const tierBreakdown = {
      basic: results.filter(r => r.tier === 'basic').length,
      mid: results.filter(r => r.tier === 'mid').length,
      luxury: results.filter(r => r.tier === 'luxury').length,
      elite: results.filter(r => r.tier === 'elite').length,
    };

    return res.json({
      success: true,
      created, skipped,
      total: SEED_WARDROBE.length,
      tier_breakdown: tierBreakdown,
      owned: results.filter(r => r.is_owned).length,
      locked: results.filter(r => !r.is_owned).length,
    });
  } catch (error) {
    console.error('Seed wardrobe error:', error);
    return res.status(500).json({ error: 'Failed to seed wardrobe', message: error.message });
  }
});

// ─── helper ───
function parseJSON(val, fallback) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'object' && val !== null) return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return fallback; }
  }
  return fallback;
}


// ═══════════════════════════════════════════
// POST /api/v1/wardrobe/browse-pool
// ═══════════════════════════════════════════

router.post('/browse-pool', optionalAuth, async (req, res) => {
  try {
    const { show_id, episode_id, character_state = {} } = req.body;

    // Auto-load event context from episode if not provided
    let { event_name, dress_code, dress_code_keywords, event_type, prestige, strictness, host_brand } = req.body;

    if (!show_id) return res.status(400).json({ error: 'show_id is required' });

    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    // Auto-lookup event from episode if caller didn't supply prestige
    if (episode_id && !prestige) {
      const [evRows] = await models.sequelize.query(`
        SELECT we.name, we.event_type, we.dress_code, we.dress_code_keywords,
               we.prestige, we.strictness, we.host_brand
        FROM world_events we
        WHERE we.used_in_episode_id = :episode_id
        LIMIT 1
      `, { replacements: { episode_id } });

      if (evRows?.[0]) {
        const ev = evRows[0];
        event_name = event_name || ev.name || '';
        event_type = event_type || ev.event_type || '';
        dress_code = dress_code || ev.dress_code || '';
        dress_code_keywords = dress_code_keywords?.length ? dress_code_keywords : (ev.dress_code_keywords || []);
        prestige = prestige || ev.prestige || 5;
        strictness = strictness || ev.strictness || 5;
        host_brand = host_brand || ev.host_brand || '';
      }
    }

    // Defaults after lookup
    event_name = event_name || '';
    dress_code = dress_code || '';
    dress_code_keywords = dress_code_keywords || [];
    event_type = event_type || '';
    prestige = prestige || 5;
    strictness = strictness || 5;
    host_brand = host_brand || '';

    // 1. Fetch all visible wardrobe items for this show
    const [allItems] = await models.sequelize.query(
      `SELECT * FROM wardrobe 
       WHERE show_id = :show_id 
       AND deleted_at IS NULL 
       AND (is_visible = true OR is_owned = true)
       ORDER BY tier, name`,
      { replacements: { show_id } }
    );

    if (allItems.length === 0) {
      return res.json({ success: true, pool: [], message: 'No wardrobe items found. Seed items first.' });
    }

    // 2. Parse dress code into keywords
    const dressCodeWords = [
      ...dress_code.toLowerCase().split(/[\s,]+/).filter(Boolean),
      ...(Array.isArray(dress_code_keywords) ? dress_code_keywords : []).map(k => k.toLowerCase()),
    ];
    const eventTypeLower = event_type.toLowerCase();
    const brandLower = (host_brand || '').toLowerCase();

    // 3. Score each item
    const scored = allItems.map(item => {
      const aesthetics = parseJSON(item.aesthetic_tags, []);
      const eventTypes = parseJSON(item.event_types, []);
      let score = 0;
      const reasons = [];
      let riskLevel = 'safe';

      // ── Dress code match (0-30 pts) ──
      const aestheticLower = aesthetics.map(a => a.toLowerCase());
      let dressCodeHits = 0;
      for (const kw of dressCodeWords) {
        if (aestheticLower.some(a => a.includes(kw) || kw.includes(a))) {
          dressCodeHits++;
        }
      }
      if (dressCodeHits > 0) {
        const dressScore = Math.min(30, dressCodeHits * 10);
        score += dressScore;
        reasons.push(`Dress code match (${dressCodeHits} keywords)`);
      }

      // ── Event type match (0-20 pts) ──
      const eventTypeLowerArr = eventTypes.map(e => e.toLowerCase());
      if (eventTypeLowerArr.includes(eventTypeLower) || eventTypeLowerArr.some(e => eventTypeLower.includes(e))) {
        score += 20;
        reasons.push('Event type compatible');
      }

      // ── Tier alignment (0-15 pts) ──
      const TIER_VALS = { basic: 1, mid: 2, luxury: 3, elite: 4 };
      const itemTierVal = TIER_VALS[item.tier] || 1;
      const eventTierVal = prestige <= 3 ? 1 : prestige <= 5 ? 2 : prestige <= 8 ? 3 : 4;
      const tierDiff = Math.abs(itemTierVal - eventTierVal);
      if (tierDiff === 0) { score += 15; reasons.push('Perfect tier match'); }
      else if (tierDiff === 1) { score += 8; reasons.push('Close tier'); }
      else if (tierDiff >= 2) { score -= 5; reasons.push('Tier mismatch'); }

      // ── Match weight bonus ──
      score += (item.outfit_match_weight || 5);

      // ── Brand alignment (0-10 pts) ──
      if (brandLower && aestheticLower.some(a => a.includes(brandLower))) {
        score += 10;
        reasons.push('Brand compatible');
      }

      // ── Ownership bonus/penalty ──
      if (item.is_owned) {
        score += 5;
        reasons.push('Owned ✅');
      } else {
        if (item.lock_type === 'brand_exclusive') {
          riskLevel = 'locked_tease';
          reasons.push('Brand exclusive 🏛️');
        } else if (item.lock_type === 'season_drop') {
          riskLevel = 'locked_tease';
          reasons.push(`Drops Ep ${item.season_unlock_episode} 🕒`);
        } else if (item.lock_type === 'reputation') {
          const rep = character_state.reputation || 1;
          if (rep >= (item.reputation_required || 0)) {
            score += 3;
            reasons.push('Reputation unlockable');
            riskLevel = 'stretch';
          } else {
            riskLevel = 'locked_tease';
            reasons.push(`Needs Rep ${item.reputation_required}`);
          }
        } else if (item.lock_type === 'coin') {
          const coins = character_state.coins || 0;
          if (coins >= (item.coin_cost || 0)) {
            score += 3;
            reasons.push('Affordable');
            riskLevel = 'stretch';
          } else {
            riskLevel = 'stretch';
            reasons.push(`Needs ${item.coin_cost} coins`);
          }
        }
      }

      // ── Risky detection ──
      if (item.is_owned && dressCodeHits === 0 && tierDiff >= 2) {
        riskLevel = 'risky';
        reasons.push('Wrong vibe for this event');
      }

      // ── Determine Lala reaction ──
      let lala_reaction = '';
      if (!item.is_owned) {
        lala_reaction = item.lala_reaction_locked || 'I can\'t have this yet...';
      } else if (riskLevel === 'risky') {
        lala_reaction = item.lala_reaction_reject || 'This isn\'t right for today.';
      } else if (score >= 40) {
        lala_reaction = item.lala_reaction_own || 'This could work.';
      } else {
        lala_reaction = item.lala_reaction_reject || 'Maybe... but not today.';
      }

      return {
        ...item,
        aesthetic_tags: aesthetics,
        event_types: eventTypes,
        unlock_requirement: parseJSON(item.unlock_requirement, {}),
        match_score: Math.max(0, score),
        match_reasons: reasons,
        risk_level: riskLevel,
        lala_reaction,
        can_select: item.is_owned || (item.lock_type === 'reputation' && (character_state.reputation || 1) >= (item.reputation_required || 0)) || (item.lock_type === 'coin' && (character_state.coins || 0) >= (item.coin_cost || 0)),
        can_purchase: !item.is_owned && item.lock_type === 'coin' && (character_state.coins || 0) >= (item.coin_cost || 0),
      };
    });

    // 4. Build the curated pool
    const owned = scored.filter(i => i.is_owned).sort((a, b) => b.match_score - a.match_score);
    const stretch = scored.filter(i => i.risk_level === 'stretch').sort((a, b) => b.match_score - a.match_score);
    const risky = owned.filter(i => i.risk_level === 'risky').sort((a, b) => a.match_score - b.match_score);
    const locked = scored.filter(i => i.risk_level === 'locked_tease').sort((a, b) => b.match_score - a.match_score);

    const pool = [];
    const addedIds = new Set();

    const addToPool = (item, role) => {
      if (!item || addedIds.has(item.id)) return false;
      addedIds.add(item.id);
      pool.push({ ...item, pool_role: role });
      return true;
    };

    // Prestige-aware slot counts: high-prestige events offer more stretch options
    const safeOwned = owned.filter(i => i.risk_level !== 'risky');
    const safeCount = prestige >= 7 ? 2 : 4;
    const stretchCount = prestige >= 7 ? 5 : 2;
    for (let i = 0; i < Math.min(safeCount, safeOwned.length); i++) addToPool(safeOwned[i], 'safe');

    for (let i = 0; i < Math.min(stretchCount, stretch.length); i++) addToPool(stretch[i], 'stretch');

    // 1 risky item
    if (risky.length > 0) addToPool(risky[0], 'risky');

    // 1 locked tease
    if (locked.length > 0) addToPool(locked[0], 'locked_tease');

    // Fill to at least 6
    const remaining = scored.filter(i => !addedIds.has(i.id)).sort((a, b) => b.match_score - a.match_score);
    let idx = 0;
    while (pool.length < 6 && idx < remaining.length) {
      addToPool(remaining[idx], remaining[idx].is_owned ? 'safe' : 'stretch');
      idx++;
    }

    // Ensure required categories have at least 3 items in pool
    const REQUIRED_CATEGORIES = ['shoes', 'dress'];
    for (const cat of REQUIRED_CATEGORIES) {
      const alreadyHas = pool.filter(i => i.clothing_category === cat).length;
      if (alreadyHas < 2) {
        const best = scored
          .filter(i => i.clothing_category === cat && !addedIds.has(i.id))
          .sort((a, b) => b.match_score - a.match_score)
          .slice(0, 3 - alreadyHas);
        best.forEach(item => addToPool(item, item.is_owned ? 'safe' : 'stretch'));
      }
    }

    // 5. Shuffle with slight randomness
    const shuffled = pool.sort((a, b) => {
      if (a.is_owned && !b.is_owned) return -1;
      if (!a.is_owned && b.is_owned) return 1;
      return (b.match_score + Math.random() * 10) - (a.match_score + Math.random() * 10);
    });

    return res.json({
      success: true,
      event_context: { event_name, dress_code, dress_code_keywords: dressCodeWords, event_type, prestige, strictness, host_brand },
      pool: shuffled,
      pool_breakdown: {
        total: shuffled.length,
        safe: shuffled.filter(i => i.pool_role === 'safe').length,
        stretch: shuffled.filter(i => i.pool_role === 'stretch').length,
        risky: shuffled.filter(i => i.pool_role === 'risky').length,
        locked_tease: shuffled.filter(i => i.pool_role === 'locked_tease').length,
      },
      scoring_summary: {
        highest_score: Math.max(...shuffled.map(i => i.match_score)),
        avg_score: Math.round(shuffled.reduce((s, i) => s + i.match_score, 0) / (shuffled.length || 1)),
        selectable: shuffled.filter(i => i.can_select).length,
      },
    });
  } catch (error) {
    console.error('Browse pool error:', error);
    return res.status(500).json({ error: 'Failed to generate browse pool', message: error.message });
  }
});


// ═══════════════════════════════════════════
// POST /api/v1/wardrobe/select
// ═══════════════════════════════════════════

router.post('/select', optionalAuth, async (req, res) => {
  try {
    const { episode_id, wardrobe_id, show_id } = req.body;
    if (!episode_id || !wardrobe_id) {
      return res.status(400).json({ error: 'episode_id and wardrobe_id are required' });
    }

    const models = await getModels();
    if (!models || !models.sequelize) {
      return res.status(500).json({ error: 'Models not available' });
    }

    // 1. Verify item exists and is selectable (owned, rep-unlockable, or coin-purchasable)
    const [items] = await models.sequelize.query(
      `SELECT id, name, is_owned, lock_type, coin_cost, reputation_required FROM wardrobe WHERE id = :wardrobe_id AND deleted_at IS NULL`,
      { replacements: { wardrobe_id } }
    );
    if (!items?.length) return res.status(404).json({ error: 'Wardrobe item not found' });
    const item = items[0];
    const repOk = item.lock_type === 'reputation' && (req.body.reputation || 0) >= (item.reputation_required || 0);

    // Auto-purchase coin-locked items inline during select
    let coinPurchased = false;
    if (!item.is_owned && !repOk && item.lock_type === 'coin' && show_id) {
      const cost = item.coin_cost || 0;
      const [states] = await models.sequelize.query(
        `SELECT id, coins FROM character_state WHERE show_id = :show_id AND character_key = 'lala' ORDER BY updated_at DESC LIMIT 1`,
        { replacements: { show_id } }
      );
      const currentCoins = states?.[0]?.coins ?? 0;
      if (currentCoins >= cost) {
        // Deduct coins
        await models.sequelize.query(
          `UPDATE character_state SET coins = coins - :cost, updated_at = NOW() WHERE id = :id`,
          { replacements: { cost, id: states[0].id } }
        );
        // Mirror the spend into the financial ledger so the budget shown
        // in event modals (and goal-progress, finalize-financials, etc.)
        // tracks the same balance as the Characters tab. Without this,
        // wardrobe purchases drop character_state.coins but the ledger
        // never sees the spend, so getCurrentBalance keeps returning the
        // pre-purchase number.
        try {
          const { logTransaction, getCurrentBalance } = require('../services/financialTransactionService');
          const ledgerBefore = await getCurrentBalance(models.sequelize, show_id);
          await logTransaction(models.sequelize, show_id, {
            type: 'expense',
            category: 'wardrobe_purchase',
            amount: cost,
            description: `Wardrobe purchase: ${item.name}`,
            source_type: 'wardrobe',
            source_id: wardrobe_id,
            source_name: item.name,
            balance_before: ledgerBefore,
            balance_after: ledgerBefore - cost,
            metadata: { wardrobe_id, item_name: item.name, flow: 'select' },
          });
        } catch (e) {
          console.warn('[Wardrobe /select] ledger mirror failed:', e.message);
        }
        // Mark item as owned
        await models.sequelize.query(
          `UPDATE wardrobe SET is_owned = true, updated_at = NOW() WHERE id = :wardrobe_id`,
          { replacements: { wardrobe_id } }
        );
        coinPurchased = true;
        item.is_owned = true;
        console.log(`[SELECT] Auto-purchased "${item.name}" for ${cost} coins`);
      } else {
        return res.status(400).json({ error: `Not enough coins — need ${cost}, have ${currentCoins}` });
      }
    }

    if (!item.is_owned && !repOk) {
      return res.status(400).json({ error: 'Item is not owned — cannot select a locked item' });
    }

    // 2. Upsert link — use ONLY guaranteed columns (id, episode_id, wardrobe_id, created_at, updated_at)
    //    The RDS table may have been created from a simpler migration that lacks approval_status, worn_at, etc.
    await models.sequelize.query(
      `INSERT INTO episode_wardrobe (id, episode_id, wardrobe_id, created_at, updated_at)
       VALUES (gen_random_uuid(), :episode_id, :wardrobe_id, NOW(), NOW())
       ON CONFLICT (episode_id, wardrobe_id) DO UPDATE SET updated_at = NOW()`,
      { replacements: { episode_id, wardrobe_id } }
    );

    // 3. Increment times_worn (non-fatal)
    try {
      await models.sequelize.query(
        `UPDATE wardrobe SET times_worn = COALESCE(times_worn, 0) + 1, updated_at = NOW() WHERE id = :wardrobe_id`,
        { replacements: { wardrobe_id } }
      );
    } catch (e) { /* non-fatal */ }

    const resp = {
      success: true,
      message: coinPurchased ? `Purchased & selected: ${item.name}` : `Selected: ${item.name}`,
      item,
    };
    if (coinPurchased) resp.coin_purchased = true;
    return res.json(resp);
  } catch (error) {
    console.error('[SELECT] error:', error);
    return res.status(500).json({ error: 'Failed to select wardrobe item', detail: error.message });
  }
});


// ═══════════════════════════════════════════
// POST /api/v1/wardrobe/purchase  (FIXED)
// ═══════════════════════════════════════════

router.post('/purchase', optionalAuth, async (req, res) => {
  try {
    const { wardrobe_id, show_id } = req.body;
    if (!wardrobe_id || !show_id) {
      return res.status(400).json({ error: 'wardrobe_id and show_id required' });
    }

    const models = await getModels();

    // 1. Get item
    const [items] = await models.sequelize.query(
      `SELECT * FROM wardrobe WHERE id = :wardrobe_id AND deleted_at IS NULL`,
      { replacements: { wardrobe_id } }
    );
    if (!items?.length) return res.status(404).json({ error: 'Item not found' });
    const item = items[0];

    if (item.is_owned) return res.json({ success: true, already_owned: true, message: 'Already owned', item, cost: 0 });
    if (item.lock_type !== 'coin') return res.status(400).json({ error: `Cannot purchase — lock type is ${item.lock_type}` });

    // 2. Get Lala's coins
    const [states] = await models.sequelize.query(
      `SELECT * FROM character_state WHERE show_id = :show_id AND character_key = 'lala' ORDER BY updated_at DESC LIMIT 1`,
      { replacements: { show_id } }
    );
    const currentCoins = states?.[0]?.coins ?? 0;
    const cost = item.coin_cost || 0;

    if (currentCoins < cost) {
      return res.status(400).json({
        error: 'Not enough coins',
        current: currentCoins,
        needed: cost,
        deficit: cost - currentCoins,
      });
    }

    // 3. Deduct coins
    const newCoins = currentCoins - cost;
    await models.sequelize.query(
      `UPDATE character_state SET coins = :newCoins, updated_at = NOW()
       WHERE show_id = :show_id AND character_key = 'lala'`,
      { replacements: { newCoins, show_id } }
    );

    // 3b. Mirror the spend into the financial ledger (see /select for
    // rationale). Non-fatal — purchase already succeeded.
    try {
      const { logTransaction, getCurrentBalance } = require('../services/financialTransactionService');
      const ledgerBefore = await getCurrentBalance(models.sequelize, show_id);
      await logTransaction(models.sequelize, show_id, {
        type: 'expense',
        category: 'wardrobe_purchase',
        amount: cost,
        description: `Wardrobe purchase: ${item.name}`,
        source_type: 'wardrobe',
        source_id: wardrobe_id,
        source_name: item.name,
        balance_before: ledgerBefore,
        balance_after: ledgerBefore - cost,
        metadata: { wardrobe_id, item_name: item.name, flow: 'purchase' },
      });
    } catch (e) {
      console.warn('[Wardrobe /purchase] ledger mirror failed:', e.message);
    }

    // 4. Mark item as owned
    await models.sequelize.query(
      `UPDATE wardrobe SET is_owned = true, updated_at = NOW() WHERE id = :wardrobe_id`,
      { replacements: { wardrobe_id } }
    );

    // 5. Log purchase in state history (non-fatal — purchase already succeeded)
    try {
      await models.sequelize.query(
        `INSERT INTO character_state_history (id, show_id, character_key, deltas_json, source, notes, created_at)
         VALUES (gen_random_uuid(), :show_id, 'lala', :deltas, 'wardrobe_purchase', :notes, NOW())`,
        {
          replacements: {
            show_id,
            deltas: JSON.stringify({ coins: -cost }),
            notes: `Purchased: ${item.name} (${cost} coins)`,
          },
        }
      );
    } catch (histErr) {
      // If history table doesn't exist or source ENUM rejects — try without UUID
      try {
        await models.sequelize.query(
          `INSERT INTO character_state_history (show_id, character_key, deltas_json, source, notes, created_at)
           VALUES (:show_id, 'lala', :deltas, 'manual', :notes, NOW())`,
          {
            replacements: {
              show_id,
              deltas: JSON.stringify({ coins: -cost }),
              notes: `Purchased: ${item.name} (${cost} coins)`,
            },
          }
        );
      } catch (e) {
        console.warn('Could not log purchase history:', e.message);
      }
    }

    return res.json({
      success: true,
      message: `Purchased "${item.name}" for ${cost} coins`,
      item: { ...item, is_owned: true },
      coins_before: currentCoins,
      coins_after: newCoins,
      cost,
    });
  } catch (error) {
    console.error('Wardrobe purchase error:', error);
    return res.status(500).json({ error: 'Failed to purchase', detail: error.message });
  }
});


// ═══════════════════════════════════════════
// OUTFIT SCORING HELPER
// ═══════════════════════════════════════════

function _parseJSON(val, fallback) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'object' && val !== null) return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return fallback; }
  }
  return fallback;
}

/**
 * getOutfitScore - Fetches locked outfit for an episode and computes synergy
 * 
 * @param {object} models - Sequelize models
 * @param {string} episodeId - Episode UUID
 * @param {object} event - Event object with dress_code, prestige, event_type, etc.
 * @returns {object} { score, items, breakdown, confidence, hasOutfit }
 */
async function getOutfitScore(models, episodeId, event = {}) {
  try {
    // 1. Fetch all wardrobe items linked to this episode
    //    NOTE: episode_wardrobe on RDS only has: id, episode_id, wardrobe_id, scene, worn_at, notes, created_at, updated_at
    const [rows] = await models.sequelize.query(
      `SELECT w.*
       FROM episode_wardrobe ew
       JOIN wardrobe w ON w.id = ew.wardrobe_id
       WHERE ew.episode_id = :episodeId
       AND w.deleted_at IS NULL
       ORDER BY w.clothing_category`,
      { replacements: { episodeId } }
    );

    if (!rows || rows.length === 0) {
      return {
        hasOutfit: false,
        score: 0,
        items: [],
        breakdown: {},
        confidence: { label: 'No outfit', emoji: '❌', color: '#94a3b8' },
        message: 'No wardrobe items assigned to this episode',
      };
    }

    // 2. Parse JSON fields
    const items = rows.map(item => ({
      ...item,
      aesthetic_tags: _parseJSON(item.aesthetic_tags, []),
      event_types: _parseJSON(item.event_types, []),
    }));

    // 3. Calculate synergy
    const TIER_VALS = { basic: 1, mid: 2, luxury: 3, elite: 4 };

    const dressCodeWords = [
      ...(event.dress_code || '').toLowerCase().split(/[\s,]+/).filter(Boolean),
      ...(event.dress_code_keywords || []).map(k => k.toLowerCase()),
    ];
    const eventTypeLower = (event.event_type || '').toLowerCase();
    const prestige = event.prestige || 5;

    let totalItemScore = 0;
    const scoredItems = items.map(item => {
      const aestheticLower = (item.aesthetic_tags || []).map(a => a.toLowerCase());
      const eventTypesLower = (item.event_types || []).map(e => e.toLowerCase());
      let itemScore = 0;

      // Dress code match
      let dressCodeHits = 0;
      for (const kw of dressCodeWords) {
        if (aestheticLower.some(a => a.includes(kw) || kw.includes(a))) dressCodeHits++;
      }
      if (dressCodeHits > 0) itemScore += Math.min(30, dressCodeHits * 10);

      // Event type match
      if (eventTypesLower.some(e => e.includes(eventTypeLower) || eventTypeLower.includes(e))) {
        itemScore += 20;
      }

      // Tier alignment
      const itemTierVal = TIER_VALS[item.tier] || 1;
      const eventTierVal = prestige <= 3 ? 1 : prestige <= 5 ? 2 : prestige <= 8 ? 3 : 4;
      const tierDiff = Math.abs(itemTierVal - eventTierVal);
      if (tierDiff === 0) itemScore += 15;
      else if (tierDiff === 1) itemScore += 8;

      // Match weight
      itemScore += (item.outfit_match_weight || 5);

      totalItemScore += itemScore;
      return { ...item, individual_score: itemScore };
    });

    const baseAvg = totalItemScore / items.length;
    const baseScore = Math.min(35, baseAvg * 0.6);

    // Aesthetic synergy — shared tags between items
    let aestheticBonus = 0;
    if (items.length >= 2) {
      const tagSets = items.map(i => new Set((i.aesthetic_tags || []).map(t => t.toLowerCase())));
      let sharedCount = 0;
      let pairs = 0;
      for (let a = 0; a < tagSets.length; a++) {
        for (let b = a + 1; b < tagSets.length; b++) {
          pairs++;
          for (const tag of tagSets[a]) {
            if (tagSets[b].has(tag)) sharedCount++;
          }
        }
      }
      aestheticBonus = Math.min(25, (sharedCount / Math.max(1, pairs)) * 15);
    }

    // Tier harmony
    const tiers = items.map(i => TIER_VALS[i.tier] || 1);
    const avgTier = tiers.reduce((a, b) => a + b, 0) / tiers.length;
    const tierVariance = tiers.reduce((s, t) => s + Math.abs(t - avgTier), 0) / tiers.length;
    const tierBonus = Math.max(0, 15 - tierVariance * 8);

    // Event alignment
    let eventHits = 0;
    items.forEach(i => {
      const et = (i.event_types || []).map(e => e.toLowerCase());
      if (et.some(e => e.includes(eventTypeLower) || eventTypeLower.includes(e))) eventHits++;
    });
    const eventBonus = items.length > 0 ? Math.min(15, (eventHits / items.length) * 15) : 0;

    // Slot coverage
    const slotBonus = Math.min(10, items.length * 1.5);

    const total = Math.round(Math.min(100, baseScore + aestheticBonus + tierBonus + eventBonus + slotBonus));

    // Confidence level
    const CONFIDENCE_LEVELS = [
      { min: 0, label: 'Nervous', emoji: '😰', color: '#dc2626' },
      { min: 30, label: 'Unsure', emoji: '😕', color: '#eab308' },
      { min: 50, label: 'Okay', emoji: '🙂', color: '#22c55e' },
      { min: 70, label: 'Confident', emoji: '😊', color: '#6366f1' },
      { min: 85, label: 'Slaying', emoji: '👑', color: '#8b5cf6' },
    ];
    let confidence = CONFIDENCE_LEVELS[0];
    for (let i = CONFIDENCE_LEVELS.length - 1; i >= 0; i--) {
      if (total >= CONFIDENCE_LEVELS[i].min) { confidence = CONFIDENCE_LEVELS[i]; break; }
    }

    return {
      hasOutfit: true,
      score: total,
      items: scoredItems.map(i => ({
        id: i.id,
        name: i.name,
        category: i.clothing_category,
        tier: i.tier,
        individual_score: i.individual_score,
        aesthetic_tags: i.aesthetic_tags,
      })),
      breakdown: {
        base: Math.round(baseScore),
        aesthetic: Math.round(aestheticBonus),
        tier_harmony: Math.round(tierBonus),
        event_alignment: Math.round(eventBonus),
        coverage: Math.round(slotBonus),
      },
      confidence,
      item_count: items.length,
    };
  } catch (err) {
    console.error('getOutfitScore error:', err);
    return {
      hasOutfit: false,
      score: 0,
      items: [],
      breakdown: {},
      confidence: { label: 'Error', emoji: '⚠️', color: '#dc2626' },
      message: err.message,
    };
  }
}


// ═══════════════════════════════════════════
// GET /api/v1/wardrobe/outfit-history/:showId
// Returns outfit history across all episodes for a show
// ═══════════════════════════════════════════
router.get('/outfit-history/:showId', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not available' });

    const [rows] = await models.sequelize.query(
      `SELECT e.id as episode_id, e.episode_number, e.title as episode_title,
              w.id as item_id, w.name as item_name, w.clothing_category, w.tier,
              w.aesthetic_tags, w.s3_url, w.thumbnail_url,
              ew.worn_at,
              we.name as event_name, we.dress_code, we.prestige
       FROM episode_wardrobe ew
       JOIN wardrobe w ON w.id = ew.wardrobe_id AND w.deleted_at IS NULL
       JOIN episodes e ON e.id = ew.episode_id AND e.deleted_at IS NULL
       LEFT JOIN world_events we ON we.used_in_episode_id = e.id
       WHERE e.show_id = :showId
       ORDER BY e.episode_number ASC, w.clothing_category ASC`,
      { replacements: { showId } }
    );

    // Group by episode
    const episodes = {};
    for (const row of rows) {
      if (!episodes[row.episode_id]) {
        episodes[row.episode_id] = {
          episode_id: row.episode_id,
          episode_number: row.episode_number,
          episode_title: row.episode_title,
          event_name: row.event_name,
          dress_code: row.dress_code,
          prestige: row.prestige,
          items: [],
        };
      }
      episodes[row.episode_id].items.push({
        id: row.item_id,
        name: row.item_name,
        category: row.clothing_category,
        tier: row.tier,
        aesthetic_tags: _parseJSON(row.aesthetic_tags, []),
        thumbnail_url: row.thumbnail_url || row.s3_url,
        worn_at: row.worn_at,
      });
    }

    return res.json({
      success: true,
      history: Object.values(episodes),
      episode_count: Object.keys(episodes).length,
    });
  } catch (error) {
    console.error('Outfit history error:', error);
    return res.status(500).json({ error: 'Failed to load outfit history', detail: error.message });
  }
});

// ═══════════════════════════════════════════
// ATTACHMENT PIECES & MATCHING SETS
// ═══════════════════════════════════════════

// GET /api/v1/wardrobe/:id/pieces — list attachment pieces for an item
router.get('/:id/pieces', optionalAuth, async (req, res) => {
  try {
    const models = await getModels();
    if (!models) return res.json({ success: true, pieces: [] });
    const [pieces] = await models.sequelize.query(`
      SELECT * FROM wardrobe
      WHERE parent_item_id = :parentId AND deleted_at IS NULL
      ORDER BY attachment_type ASC, name ASC
    `, { replacements: { parentId: req.params.id } });
    return res.json({ success: true, pieces: pieces || [] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/wardrobe/:id/pieces — add an attachment piece to an item
router.post('/:id/pieces', optionalAuth, async (req, res) => {
  try {
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const parentId = req.params.id;
    const { name, attachment_type, clothing_category, description, color, s3_url, brand, existing_item_id } = req.body;

    if (existing_item_id) {
      // Link an existing wardrobe item as an attachment piece
      await models.sequelize.query(
        `UPDATE wardrobe SET parent_item_id = :parentId, attachment_type = :attachType, updated_at = NOW()
         WHERE id = :itemId AND deleted_at IS NULL`,
        { replacements: { parentId, attachType: attachment_type || 'accessory', itemId: existing_item_id } }
      );
      return res.json({ success: true, message: 'Existing item linked as attachment piece' });
    }

    // Create a new attachment piece
    if (!name) return res.status(400).json({ success: false, error: 'name is required' });

    // Get parent info to inherit character/show
    const [parent] = await models.sequelize.query(
      `SELECT character, character_id, show_id FROM wardrobe WHERE id = :parentId AND deleted_at IS NULL`,
      { replacements: { parentId } }
    );
    if (!parent?.length) return res.status(404).json({ success: false, error: 'Parent item not found' });

    const pieceId = uuidv4();
    await models.sequelize.query(`
      INSERT INTO wardrobe (id, name, clothing_category, attachment_type, parent_item_id, description, color, s3_url, brand,
        character, character_id, show_id, created_at, updated_at)
      VALUES (:id, :name, :category, :attachType, :parentId, :description, :color, :s3Url, :brand,
        :character, :characterId, :showId, NOW(), NOW())
    `, { replacements: {
      id: pieceId,
      name,
      category: clothing_category || attachment_type || 'accessories',
      attachType: attachment_type || 'accessory',
      parentId,
      description: description || null,
      color: color || null,
      s3Url: s3_url || null,
      brand: brand || null,
      character: parent[0].character,
      characterId: parent[0].character_id,
      showId: parent[0].show_id,
    } });

    return res.json({ success: true, piece: { id: pieceId, name, attachment_type, parent_item_id: parentId } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/v1/wardrobe/:id/pieces/:pieceId — detach a piece (soft-delete or unlink)
router.delete('/:id/pieces/:pieceId', optionalAuth, async (req, res) => {
  try {
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const { detach } = req.query; // ?detach=true just unlinks, otherwise soft-deletes

    if (detach === 'true') {
      // Just unlink — keep the item as standalone
      await models.sequelize.query(
        `UPDATE wardrobe SET parent_item_id = NULL, attachment_type = NULL, updated_at = NOW()
         WHERE id = :pieceId AND parent_item_id = :parentId AND deleted_at IS NULL`,
        { replacements: { pieceId: req.params.pieceId, parentId: req.params.id } }
      );
    } else {
      // Soft-delete the piece
      await models.sequelize.query(
        `UPDATE wardrobe SET deleted_at = NOW() WHERE id = :pieceId AND parent_item_id = :parentId AND deleted_at IS NULL`,
        { replacements: { pieceId: req.params.pieceId, parentId: req.params.id } }
      );
    }

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/v1/wardrobe/:id/set — mark an item as a matching set (jewelry set, dress ensemble)
router.put('/:id/set', optionalAuth, async (req, res) => {
  try {
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const { is_set, set_name } = req.body;

    await models.sequelize.query(
      `UPDATE wardrobe SET is_set = :isSet, set_name = :setName, updated_at = NOW()
       WHERE id = :id AND deleted_at IS NULL`,
      { replacements: { isSet: is_set !== false, setName: set_name || null, id: req.params.id } }
    );

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
module.exports.getOutfitScore = getOutfitScore;
