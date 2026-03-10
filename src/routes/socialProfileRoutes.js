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
function buildGenerationPrompt(handle, platform, vibe_sentence, characterContext) {
  // Default to JustAWoman (Book 1) if no character context provided
  const ctx = characterContext || {
    name: 'JustAWoman',
    description: 'A Black woman, mother, wife, content creator in fashion/beauty/lifestyle.',
    wound: 'She does everything right and the right room has not found her yet.',
    goal: 'To be legendary.',
    audience: 'Besties',
    detail: 'She posts for women. Men show up with their wallets and something in her responds.\nShe watches certain creators alone, at night, and does not tell her husband.',
  };

  return `You are generating a complete social media creator profile for a literary fiction franchise.

This creator exists in the online world that ${ctx.name} — the protagonist — moves through daily.
${ctx.description}
Their wound: ${ctx.wound}
Their goal: ${ctx.goal}. Their audience: ${ctx.audience || 'their followers'}.
${ctx.detail || ''}

THE CREATOR SPARK:
Handle: ${handle}
Platform: ${platform}
Vibe: ${vibe_sentence}

Generate a complete, psychologically specific social profile. This is ADULT LITERARY FICTION.
Write real content — explicit if the character warrants it. Do not sanitize.
The persona vs. real signal gap is where the character lives. Find it.
Generate a REALISTIC follower count for the platform and creator type — not everyone is mega-famous.

Respond ONLY in valid JSON:
{
  "display_name": "How their name appears on the platform",
  "follower_tier": "micro|mid|macro|mega",
  "follower_count_approx": "e.g. 2.3k or 47k or 1.2M — be realistic for this type of creator on this platform",
  "content_category": "primary content category",
  "archetype": "polished_curator|messy_transparent|soft_life|explicitly_paid|overnight_rise|cautionary|the_peer|the_watcher|chaos_creator|community_builder",

  "content_persona": "2-3 sentences: what they show the world. The curated version. What their audience believes about them.",
  "real_signal": "2-3 sentences: what is actually leaking through. The crack in the performance. What a close reader sees that the casual viewer doesn't.",
  "posting_voice": "How they write captions. Sentence length. Punctuation habits. Emoji use. What they say vs. what they don't. Give 1 example caption in their actual voice.",
  "comment_energy": "What their comment section feels like. Who shows up. What people project onto them. Any recurring dynamics.",

  "adult_content_present": true or false,
  "adult_content_type": "If present: what kind, how explicit, what format it takes. null if absent.",
  "adult_content_framing": "If present: how they frame it to their audience — empowerment, desperation, business, art, accident. null if absent.",

  "parasocial_function": "What this creator does to ${ctx.name} specifically. Not generally — specifically. What does watching this person activate in them?",
  "emotional_activation": "One phrase: the specific emotional cocktail watching them produces. e.g. 'inspiration that curdles into inadequacy'",
  "watch_reason": "Why ${ctx.name} cannot stop watching even when it costs them something.",
  "what_it_costs_her": "What watching this creator takes from ${ctx.name}. Their peace, their confidence, their time, their fidelity to themselves.",

  "current_trajectory": "rising|plateauing|unraveling|pivoting|silent|viral_moment",
  "trajectory_detail": "What is specifically happening right now in their online life. Be specific — a recent post, a pattern, a shift.",

  "moment_log": [
    {
      "moment_type": "live|post|comment|dm|collab|controversy|disappearance",
      "description": "The specific moment ${ctx.name} encountered. What happened. What was said or shown.",
      "platform_format": "tiktok live|instagram reel|youtube video|etc",
      "protagonist_reaction": "How ${ctx.name} responded internally. What they felt. What they did after.",
      "lala_seed": true or false,
      "lala_seed_reason": "If true: why this moment contains narrative seed potential."
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
  "lala_relevance_reason": "Why this creator matters to the protagonist's arc. What energy or behavior this creator models.",
  "book_relevance": ["How they feed into the protagonist's story arc", "Potential future role if any"],

  "world_exists": true or false,
  "crossing_trigger": "What story event would cause this creator to cross from parasocial into ${ctx.name}'s real world.",
  "crossing_mechanism": "How they would actually enter — DM, comment section, mutual connection, physical location, brand event."
}`;
}

// ── POST /generate ───────────────────────────────────────────────────────────
// Three inputs → full profile generated
router.post('/generate', optionalAuth, async (req, res) => {
  const { handle, platform, vibe_sentence, series_id, character_context, character_key } = req.body;

  if (!handle || !platform || !vibe_sentence) {
    return res.status(400).json({ error: 'handle, platform, and vibe_sentence are required' });
  }

  const db = req.app.locals.db || require('../models');

  try {
    const response = await client.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages:   [{ role: 'user', content: buildGenerationPrompt(handle, platform, vibe_sentence, character_context) }],
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

    // Auto-assign the generating protagonist as a follower
    if (character_key) {
      await autoAssignFollower(db, profile.id, character_context, character_key);
    }

    return res.json({ profile });
  } catch (err) {
    console.error('Social profile generation error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── Auto-assign follower helper ──────────────────────────────────────────────
async function autoAssignFollower(db, profileId, characterContext, characterKey) {
  if (!db.SocialProfileFollower || !characterKey) return;
  try {
    await db.SocialProfileFollower.findOrCreate({
      where: { social_profile_id: profileId, character_key: characterKey },
      defaults: {
        character_name: characterContext?.name || characterKey,
        follow_context: 'Auto-assigned on profile generation',
        influence_type: 'aspiration',
        influence_level: 5,
      },
    });
  } catch (e) {
    console.warn('Auto-assign follower failed:', e.message);
  }
}

// ── GET / ────────────────────────────────────────────────────────────────────
router.get('/', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  const { Op } = require('sequelize');
  const { series_id, archetype, status, platform, page, limit, search, sort } = req.query;
  try {
    const where = {};
    if (series_id) where.series_id = series_id;
    if (archetype) where.archetype = archetype;
    if (status)    where.status    = status;
    if (platform)  where.platform  = platform;
    if (search) {
      where[Op.or] = [
        { handle: { [Op.iLike]: `%${search}%` } },
        { display_name: { [Op.iLike]: `%${search}%` } },
      ];
    }

    // Sorting
    let order;
    switch (sort) {
      case 'newest':  order = [['created_at', 'DESC']]; break;
      case 'oldest':  order = [['created_at', 'ASC']]; break;
      case 'handle':  order = [['handle', 'ASC']]; break;
      case 'score':   order = [['lala_relevance_score', 'DESC'], ['created_at', 'DESC']]; break;
      default:        order = [['lala_relevance_score', 'DESC'], ['created_at', 'DESC']];
    }

    // Pagination
    const pageNum  = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 24));
    const offset   = (pageNum - 1) * pageSize;

    const { count, rows } = await db.SocialProfile.findAndCountAll({
      where,
      order,
      limit: pageSize,
      offset,
      include: db.SocialProfileFollower ? [{
        model: db.SocialProfileFollower,
        as: 'followers',
        attributes: ['character_key', 'character_name', 'influence_type', 'influence_level'],
      }] : [],
    });

    return res.json({
      profiles: rows,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total: count,
        totalPages: Math.ceil(count / pageSize),
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /bulk/finalize ──────────────────────────────────────────────────────
// Finalize multiple profiles at once
router.post('/bulk/finalize', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array required' });
  }
  if (ids.length > 100) {
    return res.status(400).json({ error: 'Maximum 100 profiles per bulk finalize' });
  }
  try {
    const { Op } = require('sequelize');
    const [count] = await db.SocialProfile.update(
      { status: 'finalized' },
      { where: { id: { [Op.in]: ids }, status: 'generated' } }
    );
    return res.json({ finalized: count });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /bulk/delete ────────────────────────────────────────────────────────
// Delete multiple profiles at once
router.post('/bulk/delete', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array required' });
  }
  if (ids.length > 100) {
    return res.status(400).json({ error: 'Maximum 100 profiles per bulk delete' });
  }
  try {
    const { Op } = require('sequelize');
    const count = await db.SocialProfile.destroy(
      { where: { id: { [Op.in]: ids } } }
    );
    return res.json({ deleted: count });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /:id ─────────────────────────────────────────────────────────────────
router.get('/:id', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  try {
    const profile = await db.SocialProfile.findByPk(req.params.id, {
      include: db.SocialProfileFollower ? [{
        model: db.SocialProfileFollower,
        as: 'followers',
      }] : [],
    });
    if (!profile) return res.status(404).json({ error: 'Not found' });
    return res.json({ profile });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /:id/followers ───────────────────────────────────────────────────────
router.get('/:id/followers', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  try {
    const followers = await db.SocialProfileFollower.findAll({
      where: { social_profile_id: req.params.id },
      order: [['influence_level', 'DESC']],
    });
    return res.json({ followers });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /:id/followers ──────────────────────────────────────────────────────
// Add or update a character following this profile
router.post('/:id/followers', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  const { character_key, character_name, follow_context, emotional_reaction, influence_type, influence_level } = req.body;
  if (!character_key || !character_name) {
    return res.status(400).json({ error: 'character_key and character_name required' });
  }
  try {
    const profile = await db.SocialProfile.findByPk(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const [follower, created] = await db.SocialProfileFollower.findOrCreate({
      where: { social_profile_id: profile.id, character_key },
      defaults: { character_name, follow_context, emotional_reaction, influence_type, influence_level: influence_level || 5 },
    });
    if (!created) {
      await follower.update({ character_name, follow_context, emotional_reaction, influence_type, influence_level: influence_level || follower.influence_level });
    }
    return res.json({ follower, created });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── DELETE /:id/followers/:characterKey ───────────────────────────────────────
// Remove a character from following this profile
router.delete('/:id/followers/:characterKey', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  try {
    const count = await db.SocialProfileFollower.destroy({
      where: { social_profile_id: req.params.id, character_key: req.params.characterKey },
    });
    return res.json({ removed: count > 0 });
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
// Promotes a social profile into a world character — auto-creates RegistryCharacter
router.post('/:id/cross', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  const { crossing_note, registry_id } = req.body;
  try {
    const profile = await db.SocialProfile.findByPk(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Not found' });
    if (profile.status === 'crossed') return res.status(409).json({ error: 'Already crossed into world.' });

    // Auto-create registry character from social profile
    let registryCharacter = null;
    if (registry_id || profile.registry_character_id) {
      const targetRegistry = registry_id || (await db.CharacterRegistry.findOne({ order: [['created_at', 'DESC']] }))?.id;

      if (targetRegistry) {
        const charKey = profile.handle.replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_]/g, '_');
        registryCharacter = await db.RegistryCharacter.create({
          registry_id: targetRegistry,
          character_key: charKey,
          display_name: profile.display_name || profile.handle,
          icon: '\uD83D\uDCF1',
          role_type: 'pressure',
          status: 'accepted',
          core_desire: profile.parasocial_function || null,
          core_wound: profile.what_it_costs_her || null,
          description: `Social media creator (${profile.platform}). ${profile.content_persona || ''}`.trim(),
          personality: profile.real_signal || null,
          metadata: {
            source: 'social_profile_crossing',
            social_profile_id: profile.id,
            platform: profile.platform,
            archetype: profile.archetype,
            follower_tier: profile.follower_tier,
          },
        });

        await profile.update({
          registry_character_id: registryCharacter.id,
        });
      }
    }

    await profile.update({
      status: 'crossed',
      world_exists: true,
      crossed_at: new Date(),
      crossing_trigger: crossing_note || profile.crossing_trigger,
    });

    // Log the crossing as a world timeline event
    try {
      await db.WorldTimelineEvent.create({
        event_name: `${profile.display_name || profile.handle} crosses into the story world`,
        event_description: `Social media creator ${profile.handle} (${profile.platform}) enters the story via: ${profile.crossing_mechanism || 'direct encounter'}. Trigger: ${crossing_note || profile.crossing_trigger || 'story need'}`,
        event_type: 'character',
        impact_level: profile.lala_relevance_score >= 7 ? 'major' : 'moderate',
        characters_involved: registryCharacter ? [registryCharacter.id] : [],
      });
    } catch { /* WorldTimelineEvent table may not exist yet */ }

    return res.json({
      profile,
      registry_character: registryCharacter,
      crossed: true,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── PUT /:id ─────────────────────────────────────────────────────────────────
// Update editable fields on a profile
router.put('/:id', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  try {
    const profile = await db.SocialProfile.findByPk(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Not found' });

    const allowed = [
      'handle', 'platform', 'vibe_sentence', 'display_name',
      'content_persona', 'real_signal', 'posting_voice', 'comment_energy',
      'parasocial_function', 'emotional_activation', 'watch_reason',
      'what_it_costs_her', 'current_trajectory', 'trajectory_detail',
      'pinned_post', 'lala_relevance_score', 'lala_relevance_reason',
      'adult_content_present', 'adult_content_type', 'adult_content_framing',
      'crossing_trigger', 'crossing_mechanism', 'archetype',
      'follower_count_approx', 'sample_captions', 'sample_comments',
      'book_relevance', 'status',
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    await profile.update(updates);
    return res.json({ profile });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── DELETE /:id ──────────────────────────────────────────────────────────────
// Permanently delete a profile
router.delete('/:id', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  try {
    const profile = await db.SocialProfile.findByPk(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Not found' });
    await profile.destroy();
    return res.json({ deleted: true, id: req.params.id });
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

PARASOCIAL FUNCTION (what this creator does to the protagonist):
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
module.exports.buildGenerationPrompt = buildGenerationPrompt;
module.exports.autoAssignFollower = autoAssignFollower;
