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

// List all wardrobe items
router.get('/', asyncHandler(wardrobeController.listWardrobeItems));

// Create new wardrobe item
router.post('/', upload.single('file'), asyncHandler(wardrobeController.createWardrobeItem));

// Get item usage across shows/episodes
router.get('/:id/usage', asyncHandler(wardrobeController.getItemUsage));

// Get single wardrobe item
router.get('/:id', asyncHandler(wardrobeController.getWardrobeItem));

// Update wardrobe item
router.put('/:id', upload.single('file'), asyncHandler(wardrobeController.updateWardrobeItem));

// Process background removal for wardrobe item
router.post('/:id/process-background', asyncHandler(wardrobeController.processBackgroundRemoval));

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
         (id, show_id, name, clothing_category, color, season, tags,
          tier, lock_type, unlock_requirement, is_owned, is_visible,
          era_alignment, aesthetic_tags, event_types, outfit_match_weight,
          coin_cost, reputation_required, influence_required, season_unlock_episode,
          lala_reaction_own, lala_reaction_locked, lala_reaction_reject,
          created_at, updated_at)
         VALUES
         (:id, :show_id, :name, :clothing_category, :color, :season, CAST(:tags AS JSONB),
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
            tags: JSON.stringify(item.aesthetic_tags || []),
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

module.exports = router;
