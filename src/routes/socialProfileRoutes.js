// ─────────────────────────────────────────────────────────────────────────────
// socialProfileRoutes.js — The Feed: Social Media Creator Profile Generator
//
// Routes:
// POST /generate          — 3-field spark → full AI-generated profile
// GET  /                  — list all profiles (filterable)
// GET  /:id               — single profile
// POST /:id/finalize      — lock profile
// POST /:id/cross         — promote to world character
// POST /:id/add-moment    — append encounter moment
// GET  /:id/scene-context — formatted context for story engine injection
// ─────────────────────────────────────────────────────────────────────────────

const express   = require('express');
const router    = express.Router();
const Anthropic = require('@anthropic-ai/sdk');

let optionalAuth;
try {
  const authModule = require('../middleware/auth');
  optionalAuth = authModule.optionalAuth || authModule.authenticate || ((req, res, next) => next());
} catch (e) {
  optionalAuth = (req, res, next) => next();
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Generation prompt ─────────────────────────────────────────────────────────
function buildGenerationPrompt(handle, platform, vibe_sentence) {
  return `You are generating a complete social media creator profile for a literary fiction franchise.

This creator exists in the online world that JustAWoman — the protagonist — moves through daily.
JustAWoman is a Black woman, mother, wife, content creator in fashion/beauty/lifestyle.
Her wound: she does everything right and the right room has not found her yet.
Her goal: to be legendary. Her audience: Besties.
She posts for women. Men show up with their wallets and something in her responds.
She watches certain creators alone, at night, and does not tell her husband.

THE CREATOR SPARK:
Handle: ${handle}
Platform: ${platform}
Vibe: ${vibe_sentence}

Generate a complete, psychologically specific social profile. This is ADULT LITERARY FICTION.
Write real content — explicit if the character warrants it. Do not sanitize.
The persona vs. real signal gap is where the character lives. Find it.

Respond ONLY in valid JSON:
{
  "display_name": "How their name appears on the platform",
  "follower_tier": "micro|mid|macro|mega",
  "follower_count_approx": "e.g. 47k or 1.2M",
  "content_category": "primary content category",
  "archetype": "polished_curator|messy_transparent|soft_life|explicitly_paid|overnight_rise|cautionary|the_peer|the_watcher|chaos_creator|community_builder",

  "content_persona": "2-3 sentences: what they show the world. The curated version. What their audience believes about them.",
  "real_signal": "2-3 sentences: what is actually leaking through. The crack in the performance. What a close reader sees that the casual viewer doesn't.",
  "posting_voice": "How they write captions. Sentence length. Punctuation habits. Emoji use. What they say vs. what they don't. Give 1 example caption in their actual voice.",
  "comment_energy": "What their comment section feels like. Who shows up. What people project onto them. Any recurring dynamics.",

  "adult_content_present": true or false,
  "adult_content_type": "If present: what kind, how explicit, what format it takes. null if absent.",
  "adult_content_framing": "If present: how they frame it to their audience — empowerment, desperation, business, art, accident. null if absent.",

  "parasocial_function": "What this creator does to JustAWoman specifically. Not generally — specifically. What does watching this person activate in her?",
  "emotional_activation": "One phrase: the specific emotional cocktail watching them produces. e.g. 'inspiration that curdles into inadequacy'",
  "watch_reason": "Why JustAWoman cannot stop watching even when it costs her something.",
  "what_it_costs_her": "What watching this creator takes from JustAWoman. Her peace, her confidence, her time, her fidelity to herself.",

  "current_trajectory": "rising|plateauing|unraveling|pivoting|silent|viral_moment",
  "trajectory_detail": "What is specifically happening right now in their online life. Be specific — a recent post, a pattern, a shift.",

  "moment_log": [
    {
      "moment_type": "live|post|comment|dm|collab|controversy|disappearance",
      "description": "The specific moment JustAWoman encountered. What happened. What was said or shown.",
      "platform_format": "tiktok live|instagram reel|youtube video|etc",
      "justawoman_reaction": "How JustAWoman responded internally. What she felt. What she did after.",
      "lala_seed": true or false,
      "lala_seed_reason": "If true: why this moment contains Lala seed potential."
    }
  ],

  "sample_captions": [
    "Caption 1 — in their exact voice, platform-appropriate length and format",
    "Caption 2 — a different mood, same voice",
    "Caption 3 — their most revealing caption. The one where something real got through."
  ],
  "sample_comments": [
    "Comment from a fan — what people say to them",
    "Comment from a critic or complicated follower",
    "Comment that reveals something about what people project onto this creator"
  ],
  "pinned_post": "Their most visible content. The thing someone sees first when they land on this profile. Write it as the actual post text.",

  "lala_relevance_score": 0-10,
  "lala_relevance_reason": "Why this creator matters to Lala's emergence. What energy or behavior this creator models that lives in Lala.",
  "book_relevance": ["Book 1: how they feed into JustAWoman's arc", "Potential Book 2 role if any"],

  "world_exists": true or false,
  "crossing_trigger": "What story event would cause this creator to cross from parasocial into JustAWoman's real world.",
  "crossing_mechanism": "How they would actually enter — DM, comment section, mutual connection, physical location, brand event."
}`;
}

// ── POST /generate ───────────────────────────────────────────────────────────
// Three inputs → full profile generated
router.post('/generate', optionalAuth, async (req, res) => {
  const { handle, platform, vibe_sentence, series_id } = req.body;

  if (!handle || !platform || !vibe_sentence) {
    return res.status(400).json({ error: 'handle, platform, and vibe_sentence are required' });
  }

  const db = req.app.locals.db || require('../models');

  try {
    const response = await client.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages:   [{ role: 'user', content: buildGenerationPrompt(handle, platform, vibe_sentence) }],
    });

    let generated;
    try {
      generated = JSON.parse(response.content[0].text.replace(/```json|```/g, '').trim());
    } catch {
      return res.status(500).json({ error: 'Profile generation failed to parse. Try again.' });
    }

    // Save as draft
    const profile = await db.SocialProfile.create({
      series_id:       series_id || null,
      handle:          handle.startsWith('@') ? handle : `@${handle}`,
      platform,
      vibe_sentence,
      status:          'generated',
      generation_model: 'claude-sonnet-4-20250514',
      full_profile:    generated,
      // Flatten key fields for querying
      display_name:          generated.display_name,
      follower_tier:         generated.follower_tier,
      follower_count_approx: generated.follower_count_approx,
      content_category:      generated.content_category,
      archetype:             generated.archetype,
      content_persona:       generated.content_persona,
      real_signal:           generated.real_signal,
      posting_voice:         generated.posting_voice,
      comment_energy:        generated.comment_energy,
      adult_content_present: generated.adult_content_present || false,
      adult_content_type:    generated.adult_content_type,
      adult_content_framing: generated.adult_content_framing,
      parasocial_function:   generated.parasocial_function,
      emotional_activation:  generated.emotional_activation,
      watch_reason:          generated.watch_reason,
      what_it_costs_her:     generated.what_it_costs_her,
      current_trajectory:    generated.current_trajectory,
      trajectory_detail:     generated.trajectory_detail,
      moment_log:            generated.moment_log || [],
      sample_captions:       generated.sample_captions || [],
      sample_comments:       generated.sample_comments || [],
      pinned_post:           generated.pinned_post,
      lala_relevance_score:  generated.lala_relevance_score || 0,
      lala_relevance_reason: generated.lala_relevance_reason,
      book_relevance:        generated.book_relevance || [],
      world_exists:          generated.world_exists || false,
      crossing_trigger:      generated.crossing_trigger,
      crossing_mechanism:    generated.crossing_mechanism,
    });

    return res.json({ profile });
  } catch (err) {
    console.error('Social profile generation error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET / ────────────────────────────────────────────────────────────────────
router.get('/', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  const { series_id, archetype, status, platform } = req.query;
  try {
    const where = {};
    if (series_id) where.series_id = series_id;
    if (archetype) where.archetype = archetype;
    if (status)    where.status    = status;
    if (platform)  where.platform  = platform;
    const profiles = await db.SocialProfile.findAll({
      where,
      order: [['lala_relevance_score', 'DESC'], ['created_at', 'DESC']],
    });
    return res.json({ profiles });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /:id ─────────────────────────────────────────────────────────────────
router.get('/:id', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  try {
    const profile = await db.SocialProfile.findByPk(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Not found' });
    return res.json({ profile });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /:id/finalize ──────────────────────────────────────────────────────
router.post('/:id/finalize', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  try {
    const profile = await db.SocialProfile.findByPk(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Not found' });
    await profile.update({ status: 'finalized' });
    return res.json({ profile });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /:id/cross ─────────────────────────────────────────────────────────
// Promotes a social profile into a world character (crossing event)
router.post('/:id/cross', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  const { crossing_note } = req.body;
  try {
    const profile = await db.SocialProfile.findByPk(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Not found' });
    if (profile.status === 'crossed') return res.status(409).json({ error: 'Already crossed into world.' });

    await profile.update({
      status:     'crossed',
      world_exists: true,
      crossed_at: new Date(),
      crossing_trigger: crossing_note || profile.crossing_trigger,
    });

    return res.json({
      profile,
      next_step: 'Create a registry character for this profile via POST /character-registry/characters with social_profile_id reference',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /:id/add-moment ─────────────────────────────────────────────────────
// Add a new encounter moment to the moment log
router.post('/:id/add-moment', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  try {
    const profile = await db.SocialProfile.findByPk(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Not found' });
    const moments = [...(profile.moment_log || []), req.body.moment];
    await profile.update({ moment_log: moments });
    return res.json({ profile });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /:id/scene-context ───────────────────────────────────────────────────
// Returns formatted profile for story engine injection
router.get('/:id/scene-context', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  try {
    const p = await db.SocialProfile.findByPk(req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });

    const context = `
SOCIAL PROFILE: ${p.handle} (${p.platform})
Display name: ${p.display_name} · ${p.follower_count_approx} followers · ${p.content_category}
Archetype: ${p.archetype}

CONTENT PERSONA: ${p.content_persona}
REAL SIGNAL: ${p.real_signal}
POSTING VOICE: ${p.posting_voice}
${p.adult_content_present ? `\nADULT CONTENT: ${p.adult_content_type}\nFRAMING: ${p.adult_content_framing}` : ''}

PARASOCIAL FUNCTION (what this creator does to JustAWoman):
${p.parasocial_function}
Emotional activation: ${p.emotional_activation}
Why she watches: ${p.watch_reason}
What it costs her: ${p.what_it_costs_her}

CURRENT TRAJECTORY: ${p.current_trajectory} — ${p.trajectory_detail}

PINNED POST: ${p.pinned_post}

SAMPLE CAPTIONS:
${(p.sample_captions || []).map((c, i) => `${i + 1}. ${c}`).join('\n')}
    `.trim();

    return res.json({ context, profile: p });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
