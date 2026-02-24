/**
 * wardrobeBrands.js
 * src/routes/wardrobeBrands.js
 *
 * Wardrobe Brand Intelligence
 *
 * Every wardrobe piece can have a brand attached.
 * Right now: LalaVerse fictional brands only.
 * Later: real brands slot in -- same schema, additional fields.
 *
 * When a piece is tagged to a scene or event:
 *   -> coverage_status flips to 'uncovered'
 *   -> system checks which Press characters are ready to cover it
 *   -> email notification fires
 *   -> Press coverage can be generated from the piece's context
 */

'use strict';

const express       = require('express');
const router        = express.Router();
const notifications = require('../services/notifications');

/* Lazy model loader */
let _models = null;
function getModels() {
  if (!_models) { _models = require('../models'); }
  return _models;
}

let optionalAuth;
try {
  const m = require('../middleware/auth');
  optionalAuth = m.optionalAuth || m.authenticate || ((q,r,n)=>n());
} catch { optionalAuth = (q,r,n) => n(); }

let anthropic;
try {
  const Anthropic = require('@anthropic-ai/sdk');
  anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
} catch { anthropic = null; }

async function safeAI(system, user, max = 600) {
  if (!anthropic) return null;
  try {
    const r = await anthropic.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: max,
      system, messages: [{ role: 'user', content: user }],
    });
    return r.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
  } catch (e) { console.error('AI error:', e.message); return null; }
}

// -- FICTIONAL LALAVERSE BRANDS -- seed data --

const LALAVERSE_BRANDS_SEED = [
  {
    slug:        'velour_atelier',
    name:        'Velour Atelier',
    type:        'lalaverse',
    category:    'fashion',
    description: 'The house of record for LalaVerse events. Clean silhouettes, elevated fabrication, structured luxury. The brand Lala reaches for when the room matters.',
    aesthetic:   'Architectural minimalism. Ivory, bone, deep black. Nothing extraneous.',
    niche:       'Event and occasion dressing for women who arrive having already decided.',
    founder:     'A woman who built it after being told her taste was too specific.',
    press_angle: 'The decision a Velour piece represents -- not the garment, the choice.',
  },
  {
    slug:        'ori_beauty',
    name:        'Ori Beauty',
    type:        'lalaverse',
    category:    'beauty',
    description: 'Skincare and cosmetics built for melanin-rich skin. Deep knowledge of formulation. The brand that existed before the mainstream noticed the market.',
    aesthetic:   'Clean, warm, science-backed. The packaging is honest.',
    niche:       'Luxury skincare for Black women who have been underserved by luxury beauty.',
    founder:     'A cosmetic chemist who started making her own formulations because nothing worked.',
    press_angle: 'What it means to build a beauty brand for the people who were there first.',
  },
  {
    slug:        'the_column',
    name:        'The Column',
    type:        'lalaverse',
    category:    'fashion',
    description: 'Elevated basics. The wardrobe infrastructure. Pieces that go under everything and next to nothing -- both perfectly.',
    aesthetic:   'Quiet. Precise. The kind of piece you don\'t notice because it\'s exactly right.',
    niche:       'The foundation layer of a wardrobe built with intention.',
    founder:     'A stylist who got tired of not finding the piece she was describing to clients.',
    press_angle: 'The philosophy of building a wardrobe versus accumulating one.',
  },
  {
    slug:        'aura_fragrance',
    name:        'Aura Fragrance',
    type:        'lalaverse',
    category:    'beauty',
    description: 'Indie fragrance house. Warm, specific, uncommon. Built on the tradition of fragrance in Black and African diaspora culture -- oud, amber, warm florals done with restraint.',
    aesthetic:   'Warm darkness. Something you can\'t quite place but immediately recognize.',
    niche:       'Fragrance as identity -- specific, personal, not for everyone.',
    founder:     'A perfumer trained in Grasse who came home and made something her grandmother would have worn.',
    press_angle: 'The politics and poetry of scent. What it means to smell like yourself.',
  },
  {
    slug:        'first_light_studio',
    name:        'First Light Studio',
    type:        'lalaverse',
    category:    'lifestyle',
    description: 'Creative tools and accessories for the woman building something. Notebooks, desk objects, the things that surround the work.',
    aesthetic:   'Warm minimal. The things you want next to you when you\'re creating.',
    niche:       'The material culture of building -- what surrounds the creator.',
    founder:     'A graphic designer who wanted her workspace to feel like her work.',
    press_angle: 'What you surround yourself with when you\'re building something from nothing.',
  },
  {
    slug:        'carte_blanche',
    name:        'Carte Blanche',
    type:        'lalaverse',
    category:    'fashion',
    description: 'Statement pieces for specific moments. Not everyday. Not for everyone. The piece you wear when you\'ve decided something.',
    aesthetic:   'Bold structure. Rich color. Intentional drama without noise.',
    niche:       'The piece you put on when you\'re ready to be seen.',
    founder:     'A designer who started making clothes after a decade of dressing other people.',
    press_angle: 'What it means to dress for a decision rather than an occasion.',
  },
];

// -- WHICH PRESS CHARACTER COVERS WHICH BRAND CATEGORY --
const PRESS_COVERAGE_MAP = {
  fashion:   ['solene_beaumont', 'taye_okafor'],
  beauty:    ['solene_beaumont', 'reyna_voss'],
  lifestyle: ['asha_brennan', 'taye_okafor'],
};

function getPressReadyForCategory(category) {
  return PRESS_COVERAGE_MAP[category] || ['solene_beaumont'];
}

// -- ROUTE 1: POST /seed-brands --

router.post('/seed-brands', optionalAuth, async (req, res) => {
  try {
    const models  = getModels();
    const seeded  = [];

    for (const brand of LALAVERSE_BRANDS_SEED) {
      const [record] = await models.LalaverseBrand.findOrCreate({
        where:    { slug: brand.slug },
        defaults: brand,
      });
      seeded.push({ id: record.id, name: record.name, type: record.type });
    }

    res.json({ ok: true, seeded: seeded.length, brands: seeded });

  } catch (err) {
    console.error('POST /seed-brands error:', err);
    res.status(500).json({ error: err.message });
  }
});

// -- ROUTE 2: GET /brands --

router.get('/brands', optionalAuth, async (req, res) => {
  try {
    const models = getModels();
    const brands = await models.LalaverseBrand.findAll({
      order: [['name', 'ASC']],
    });

    const stats = await Promise.all(brands.map(async (b) => {
      const tags = await models.WardrobeBrandTag.findAll({
        where: { brand_id: b.id },
      });
      return {
        brand_id:    b.id,
        total:       tags.length,
        uncovered:   tags.filter(t => t.coverage_status === 'uncovered').length,
        covered:     tags.filter(t => t.coverage_status === 'covered').length,
        queued:      tags.filter(t => t.coverage_status === 'queued').length,
      };
    }));

    res.json(brands.map((b, i) => ({ ...b.toJSON(), stats: stats[i] })));

  } catch (err) {
    console.error('GET /brands error:', err);
    res.status(500).json({ error: err.message });
  }
});

// -- ROUTE 3: POST /brands --

router.post('/brands', optionalAuth, async (req, res) => {
  try {
    const {
      name, type = 'lalaverse', category, description,
      aesthetic, niche, founder, press_angle,
      contact_name, contact_email,
      partnership_status,
      website,
    } = req.body;

    const models = getModels();
    const slug   = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

    const brand = await models.LalaverseBrand.create({
      slug, name, type, category, description,
      aesthetic, niche, founder, press_angle,
      contact_name:       contact_name || null,
      contact_email:      contact_email || null,
      partnership_status: partnership_status || null,
      website:            website || null,
    });

    res.json(brand);

  } catch (err) {
    console.error('POST /brands error:', err);
    res.status(500).json({ error: err.message });
  }
});

// -- ROUTE 4: POST /tag-piece --

router.post('/tag-piece', optionalAuth, async (req, res) => {
  try {
    const {
      wardrobe_item_id,
      wardrobe_item_name,
      brand_id,
      event_name,
      scene_summary,
      chapter_id,
      show_id,
    } = req.body;

    const models = getModels();

    const brand = await models.LalaverseBrand.findByPk(brand_id);
    if (!brand) return res.status(404).json({ error: 'Brand not found' });

    const [tag, created] = await models.WardrobeBrandTag.findOrCreate({
      where: { wardrobe_item_id, brand_id },
      defaults: {
        wardrobe_item_id,
        wardrobe_item_name: wardrobe_item_name || 'Unnamed piece',
        brand_id,
        event_name:     event_name || null,
        scene_summary:  scene_summary || null,
        chapter_id:     chapter_id || null,
        show_id:        show_id || null,
        coverage_status: 'uncovered',
      },
    });

    if (!created) {
      await tag.update({
        event_name:      event_name || tag.event_name,
        scene_summary:   scene_summary || tag.scene_summary,
        chapter_id:      chapter_id || tag.chapter_id,
        coverage_status: tag.coverage_status === 'not_tagged' ? 'uncovered' : tag.coverage_status,
      });
    }

    const pressReady = getPressReadyForCategory(brand.category);

    // Fire email notification
    const appUrl = process.env.APP_URL || 'https://dev.primepisodes.com';
    await notifications.sendWardrobeAlert({
      pieceName:    wardrobe_item_name || 'Wardrobe piece',
      brandName:    brand.name,
      brandType:    brand.type,
      eventName:    event_name || 'Scene',
      sceneSummary: scene_summary,
      pressReady:   pressReady.map(slug =>
        slug === 'solene_beaumont' ? 'Solene (Undressed)' :
        slug === 'reyna_voss'      ? 'Reyna (The Real Rate)' :
        slug === 'taye_okafor'     ? 'Taye (First Look)' :
        slug === 'asha_brennan'    ? 'Asha (The Cost of Wanting More)' : slug
      ),
      wardrobeUrl: `${appUrl}/wardrobe/piece/${wardrobe_item_id}`,
    }).catch(e => console.error('Wardrobe notification failed:', e.message));

    res.json({
      ok:           true,
      tag:          tag,
      brand:        { name: brand.name, type: brand.type, category: brand.category },
      press_ready:  pressReady,
      notification: 'queued',
    });

  } catch (err) {
    console.error('POST /tag-piece error:', err);
    res.status(500).json({ error: err.message });
  }
});

// -- ROUTE 5: GET /pieces/uncovered --

router.get('/pieces/uncovered', optionalAuth, async (req, res) => {
  try {
    const { show_id } = req.query;
    const models = getModels();

    const where = { coverage_status: 'uncovered' };
    if (show_id) where.show_id = show_id;

    const tags = await models.WardrobeBrandTag.findAll({
      where,
      order: [['created_at', 'DESC']],
    });

    const enriched = await Promise.all(tags.map(async (tag) => {
      const brand = await models.LalaverseBrand.findByPk(tag.brand_id);
      return {
        ...tag.toJSON(),
        brand: brand ? {
          name:        brand.name,
          type:        brand.type,
          category:    brand.category,
          press_angle: brand.press_angle,
        } : null,
        press_ready: brand ? getPressReadyForCategory(brand.category) : [],
      };
    }));

    res.json(enriched);

  } catch (err) {
    console.error('GET /pieces/uncovered error:', err);
    res.status(500).json({ error: err.message });
  }
});

// -- ROUTE 6: POST /generate-coverage --

router.post('/generate-coverage', optionalAuth, async (req, res) => {
  try {
    const {
      tag_id,
      press_character_slug,
      format = 'newsletter',
    } = req.body;

    const models = getModels();
    const tag    = await models.WardrobeBrandTag.findByPk(tag_id);
    if (!tag) return res.status(404).json({ error: 'Tag not found' });

    const brand = await models.LalaverseBrand.findByPk(tag.brand_id);
    if (!brand) return res.status(404).json({ error: 'Brand not found' });

    const CHARACTER_VOICES = {
      solene_beaumont: {
        name:       'Solene Beaumont',
        pub:        'Undressed',
        system:     `You are Solene Beaumont, publisher of Undressed -- "On beauty, identity, and the decision to take up space."
You write about beauty and style as acts of self-definition. Literary, intimate, culturally specific.
You do not write about products. You write about what a piece represents -- the decision it embodies.
Your sentences are long and layered. You open with a specific sensory detail.
You never write: trends, shopping guides, generic empowerment, the word "iconic".
You sound like Zadie Smith writing about getting dressed.`,
      },
      reyna_voss: {
        name:       'Reyna Voss',
        pub:        'The Real Rate',
        system:     `You are Reyna Voss, publisher of The Real Rate -- "What the beauty economy actually pays."
You write about the business of beauty. Precise, dry, occasionally sharp.
When you write about a brand or piece you write about what it means for the business -- the positioning, the market, the economics.
Short declarative sentences. Numbers are load-bearing when available.
You never write: inspiration content, vague claims, anything that sounds like a press release.`,
      },
      taye_okafor: {
        name:       'Taye Okafor',
        pub:        'First Look',
        system:     `You are Taye Okafor, publisher of First Look -- "Who's worth watching. Before everyone knows it."
You write about culture -- what's rising, what's shifting, what matters.
When you cover a brand or piece you write about what it signals about where the creative world is moving.
Observational, authoritative, cool. Never fan behavior.
You never write: breathlessly, with superlatives, the word "iconic", anything that sounds like hype.`,
      },
      asha_brennan: {
        name:       'Asha Brennan',
        pub:        'The Cost of Wanting More',
        system:     `You are Asha Brennan, publisher of The Cost of Wanting More.
You write about the interior life of women who build. When you cover a brand or piece
you write about what it means for the woman wearing it -- the decision it represents,
the identity it participates in. Intimate, rigorous, specific.
You never write: motivationally, with silver linings, the phrase "you've got this".`,
      },
    };

    const voice = CHARACTER_VOICES[press_character_slug] || CHARACTER_VOICES.solene_beaumont;

    const FORMAT_SPECS = {
      newsletter: '350-500 words. Opens with the specific detail. Builds to the argument.',
      short:      '120-180 words. One idea. Dense.',
      social:     '80-100 words. The voice compressed to its essence.',
    };

    const userPrompt = `Write a ${format} post for ${voice.pub} about this wardrobe piece.

PIECE: ${tag.wardrobe_item_name}
BRAND: ${brand.name} (${brand.type === 'lalaverse' ? 'LalaVerse brand' : 'brand'})
BRAND DESCRIPTION: ${brand.description}
AESTHETIC: ${brand.aesthetic}
PRESS ANGLE: ${brand.press_angle}
APPEARED IN: ${tag.event_name || 'LalaVerse event'}
SCENE CONTEXT: ${tag.scene_summary || 'Lala wore this piece to the event.'}

FORMAT: ${FORMAT_SPECS[format]}

Write only the post. Start immediately. No preamble.`;

    const content = await safeAI(voice.system, userPrompt, 700)
      || `[Coverage generation failed -- check AI connection]`;

    await tag.update({
      coverage_status:    'queued',
      coverage_content:   content,
      coverage_author:    press_character_slug,
      coverage_generated: new Date(),
    });

    // Send notification
    const appUrl = process.env.APP_URL || 'https://dev.primepisodes.com';
    await notifications.sendCoverageReady({
      authorName:  voice.name,
      publication: voice.pub,
      topic:       `${tag.wardrobe_item_name} -- ${tag.event_name || 'LalaVerse'}`,
      excerpt:     content.slice(0, 200),
      pressUrl:    `${appUrl}/press`,
    }).catch(e => console.error('Coverage notification failed:', e.message));

    res.json({
      ok:           true,
      tag_id,
      author:       voice.name,
      publication:  voice.pub,
      content,
      word_count:   content.split(/\s+/).filter(Boolean).length,
      status:       'queued',
    });

  } catch (err) {
    console.error('POST /generate-coverage error:', err);
    res.status(500).json({ error: err.message });
  }
});

// -- ROUTE 7: POST /mark-published --

router.post('/mark-published', optionalAuth, async (req, res) => {
  try {
    const { tag_id, publish_url } = req.body;
    const models = getModels();
    const tag    = await models.WardrobeBrandTag.findByPk(tag_id);
    if (!tag) return res.status(404).json({ error: 'Tag not found' });

    await tag.update({
      coverage_status:   'covered',
      coverage_url:      publish_url || null,
      coverage_published: new Date(),
    });

    // FUTURE: when real brands come, fire brand outreach email here
    const brand = await models.LalaverseBrand.findByPk(tag.brand_id);
    if (brand?.type === 'real' && brand?.contact_email) {
      // Draft outreach -- not sending yet, queuing for review
      // await draftBrandOutreach({ brand, tag, publishUrl: publish_url });
    }

    res.json({ ok: true, status: 'covered', tag_id });

  } catch (err) {
    console.error('POST /mark-published error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
