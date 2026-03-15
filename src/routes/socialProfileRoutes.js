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

// ── Feed caps ─────────────────────────────────────────────────────────────────
const FEED_CAPS = { real_world: 443, lalaverse: 200 };

async function checkFeedCap(db, layer) {
  const cap = FEED_CAPS[layer] || 443;
  const count = await db.SocialProfile.count({
    where: { feed_layer: layer, lalaverse_cap_exempt: false },
  });
  return { count, cap, remaining: cap - count, atCap: count >= cap };
}

// ── JustAWoman record guard ──────────────────────────────────────────────────
function guardJustAWomanRecord(req, res, next) {
  const db = req.app.locals.db || require('../models');
  db.SocialProfile.findByPk(req.params.id).then(profile => {
    if (profile?.is_justawoman_record) {
      return res.status(403).json({
        error: 'This record is locked',
        message: "JustAWoman's LalaVerse profile is hand-authored and permanently locked.",
      });
    }
    next();
  }).catch(next);
}

// ── LalaVerse city culture ───────────────────────────────────────────────────
const CITY_CULTURE = {
  nova_prime:   'High fashion, aspirational, image-first. Polished curators dominate. Brand deals are currency.',
  velour_city:  'Music, nightlife, culture. Chaos creators and community builders. Authenticity is the brand.',
  the_drift:    'Underground, countercultural, anti-algorithm. Messy transparents and watchers. Fame is suspicious.',
  solenne:      'Luxury, slow content, soft life. Soft life archetype and overnight rises. Aesthetics over metrics.',
  cascade_row:  'Commerce, hustle, explicitly paid. Industry peers and cautionary tales. ROI is the language.',
};

// ── Generation prompt ─────────────────────────────────────────────────────────
function buildGenerationPrompt(handle, platform, vibe_sentence, characterContext, advancedContext) {
  // Default to JustAWoman (Book 1) if no character context provided
  const ctx = characterContext || {
    name: 'JustAWoman',
    description: 'A Black woman, mother, wife, content creator in fashion/beauty/lifestyle.',
    wound: 'She does everything right and the right room has not found her yet.',
    goal: 'To be legendary.',
    audience: 'Besties',
    detail: 'She posts for women. Men show up with their wallets and something in her responds.\nShe watches certain creators alone, at night, and does not tell her husband.',
  };

  const adv = advancedContext || {};
  const advancedHints = [];
  if (adv.location_hint) advancedHints.push(`Location hint: ${adv.location_hint}`);
  if (adv.follower_hint) advancedHints.push(`Follower range hint: ${adv.follower_hint}`);
  if (adv.relationship_hint) advancedHints.push(`Known relationships: ${adv.relationship_hint}`);
  if (adv.drama_hint) advancedHints.push(`Drama/controversy context: ${adv.drama_hint}`);
  if (adv.aesthetic_hint) advancedHints.push(`Aesthetic/vibe detail: ${adv.aesthetic_hint}`);
  if (adv.revenue_hint) advancedHints.push(`Monetization context: ${adv.revenue_hint}`);
  const advBlock = advancedHints.length > 0
    ? `\n\nADDITIONAL CONTEXT (use to inform the profile):\n${advancedHints.join('\n')}`
    : '';

  return `You are generating a complete, data-rich social media creator profile for a literary fiction franchise.

This creator exists in the online world that ${ctx.name} — the protagonist — moves through daily.
${ctx.description}
Their wound: ${ctx.wound}
Their goal: ${ctx.goal}. Their audience: ${ctx.audience || 'their followers'}.
${ctx.detail || ''}

THE CREATOR SPARK:
Handle: ${handle}
Platform: ${platform}
Vibe: ${vibe_sentence}${advBlock}

Generate a COMPLETE, psychologically specific social profile with realistic metrics.
This is ADULT LITERARY FICTION. Write real content — explicit if the character warrants it. Do not sanitize.
The persona vs. real signal gap is where the character lives. Find it.

IMPORTANT:
- Generate REALISTIC follower counts for the platform and creator type. Not everyone is mega-famous.
- Generate REALISTIC engagement and posting metrics. Be specific with numbers.
- Generate a real geographic base — be specific (city, not just country).
- Known associates: reference specific types of other creators they'd orbit with (use realistic-sounding handles).
- Revenue streams: be specific about how this creator actually makes money.
- Build the network: who do they collab with, who do they beef with, who are they dating or co-parenting with.

Respond ONLY in valid JSON:
{
  "display_name": "How their name appears on the platform",

  "follower_tier": "micro|mid|macro|mega",
  "follower_count_approx": "e.g. 2.3k or 47k or 1.2M — realistic for this creator type on this platform",
  "influencer_tier_detail": "Nuanced tier analysis — where they sit relative to their niche, trajectory within their tier, why they're at this level. 2-3 sentences.",

  "post_frequency": "Specific posting cadence — e.g. '3-4 TikToks/day, stories every 2 hours, goes live Thursdays at 10pm'",
  "engagement_rate": "Realistic engagement rate as percentage — e.g. '4.2% (high for macro tier)' or '12% (typical micro creator with tight community)'",
  "platform_metrics": {
    "avg_views": "e.g. 45k per video",
    "avg_likes": "e.g. 3.2k",
    "avg_comments": "e.g. 180",
    "stories_per_day": "e.g. 8-12",
    "lives_per_week": "e.g. 2 (usually unplanned, usually emotional)",
    "best_performing_format": "e.g. 'get ready with me videos where she cries at the end'",
    "worst_performing_format": "e.g. 'paid partnership posts — audience can tell instantly'"
  },

  "content_category": "primary content category",
  "archetype": "polished_curator|messy_transparent|soft_life|explicitly_paid|overnight_rise|cautionary|the_peer|the_watcher|chaos_creator|community_builder",

  "geographic_base": "Specific city and state/region — e.g. 'Houston, TX' or 'South London' or 'Atlanta metro'",
  "geographic_cluster": "The creator scene they're part of — e.g. 'Atlanta mommy influencer circuit' or 'LA beauty creator scene' or 'DMV lifestyle'",
  "age_range": "Estimated age range — e.g. 'mid-20s' or 'early 30s' or '28'",
  "relationship_status": "Current relationship status — be specific and messy if relevant. e.g. 'single mom, co-parenting with baby daddy who has a new girl' or 'married but the husband is never in content' or 'situationship with another creator she won't name'",

  "content_persona": "2-3 sentences: what they show the world. The curated version.",
  "real_signal": "2-3 sentences: what is actually leaking through. The crack in the performance.",
  "posting_voice": "How they write captions. Sentence length. Punctuation habits. Emoji use. Give 1 example caption in their actual voice.",
  "comment_energy": "What their comment section feels like. Who shows up. What people project onto them.",

  "aesthetic_dna": {
    "visual_style": "e.g. 'warm-toned, soft-focus, always golden hour'",
    "color_palette": "e.g. 'neutrals and nudes, occasional pop of burgundy'",
    "editing_style": "e.g. 'heavy filters, face-tuned but not obviously, cinematic transitions'",
    "vibe_tags": ["e.g. clean girl", "soft luxury", "unbothered"]
  },

  "revenue_streams": ["List each revenue source — e.g. 'Brand deals (Fashion Nova, lip gloss brands)', 'OnlyFans ($25/month tier)', 'Amazon storefront', 'YouTube AdSense (~$2k/month)'"],
  "brand_partnerships": [
    { "brand": "e.g. Fashion Nova", "type": "paid post", "visible": true },
    { "brand": "e.g. unnamed hair company", "type": "gifted/barter", "visible": false }
  ],

  "audience_demographics": {
    "primary_age": "e.g. 18-34",
    "gender_split": "e.g. 78% women, 18% men, 4% other",
    "psychographic": "Who actually watches — e.g. 'women who want her life but can't admit it' or 'men who think they have a chance'",
    "top_audience_locations": ["e.g. Atlanta", "Houston", "Lagos"]
  },

  "known_associates": [
    {
      "handle": "@realistic_handle — make up a handle that sounds real for this platform/scene",
      "platform": "same or different platform",
      "relationship_type": "collab|rival|couple|ex|baby_daddy|baby_mama|bestie|mentor|copycat|shade|situationship|family|management|feud|secret_link",
      "drama_level": 0-10,
      "description": "Brief — what the connection is and why it matters"
    }
  ],
  "collab_style": "How they collaborate with others. Who they seek out, who they avoid, what collabs look like. 2-3 sentences.",
  "controversy_history": [
    {
      "event": "What happened — be specific",
      "date_approx": "e.g. 'Summer 2025' or 'last October'",
      "severity": "minor|moderate|major|career_threatening",
      "resolved": true or false,
      "narrative_potential": "How this drama could matter to the protagonist's story"
    }
  ],

  "adult_content_present": true or false,
  "adult_content_type": "If present: what kind, how explicit. null if absent.",
  "adult_content_framing": "If present: how they frame it — empowerment, desperation, business, art, accident. null if absent.",

  "parasocial_function": "What this creator does to ${ctx.name} specifically. What does watching this person activate in them?",
  "emotional_activation": "One phrase: the specific emotional cocktail watching them produces.",
  "watch_reason": "Why ${ctx.name} cannot stop watching even when it costs them something.",
  "what_it_costs_her": "What watching this creator takes from ${ctx.name}.",

  "current_trajectory": "rising|plateauing|unraveling|pivoting|silent|viral_moment",
  "trajectory_detail": "What is specifically happening right now. Be specific — a recent post, a pattern, a shift.",

  "moment_log": [
    {
      "moment_type": "live|post|comment|dm|collab|controversy|disappearance",
      "description": "The specific moment. What happened. What was said or shown.",
      "platform_format": "tiktok live|instagram reel|youtube video|etc",
      "protagonist_reaction": "How ${ctx.name} responded internally.",
      "lala_seed": true or false,
      "lala_seed_reason": "If true: why this moment contains narrative seed potential."
    },
    {
      "moment_type": "Generate at least 2-3 moments for a richer timeline",
      "description": "Another key moment — different type than the first",
      "platform_format": "different format",
      "protagonist_reaction": "Different emotional register",
      "lala_seed": false,
      "lala_seed_reason": null
    }
  ],

  "sample_captions": [
    "Caption 1 — in their exact voice, platform-appropriate",
    "Caption 2 — a different mood, same voice",
    "Caption 3 — their most revealing caption",
    "Caption 4 — a sponsored post in their voice (shows how they sell)",
    "Caption 5 — a cryptic/emotional post that made people speculate"
  ],
  "sample_comments": [
    "Fan comment — what people say to them",
    "Critic or complicated follower",
    "Comment that reveals projection",
    "Comment from someone who clearly knows them personally"
  ],
  "pinned_post": "Their most visible content. The thing someone sees first. Write it as the actual post text.",

  "lala_relevance_score": 0-10,
  "lala_relevance_reason": "Why this creator matters to the protagonist's arc.",
  "book_relevance": ["How they feed into the story arc", "Potential future role"],

  "world_exists": true or false,
  "crossing_trigger": "What story event would cause this creator to cross into ${ctx.name}'s real world.",
  "crossing_mechanism": "How they would actually enter — DM, comment section, mutual connection, physical location, brand event."
}`;
}

// ── POST /generate ───────────────────────────────────────────────────────────
// Three inputs + optional advanced context → full profile generated
// Supports feed_layer: 'real_world' (default) or 'lalaverse'
router.post('/generate', optionalAuth, async (req, res) => {
  const {
    handle, platform, vibe_sentence, series_id,
    character_context, character_key, advanced_context,
    feed_layer, city, lala_relationship, career_pressure,
  } = req.body;

  if (!handle || !platform || !vibe_sentence) {
    return res.status(400).json({ error: 'handle, platform, and vibe_sentence are required' });
  }

  const layer = feed_layer || 'real_world';
  if (layer === 'lalaverse' && !city) {
    return res.status(400).json({ error: 'city is required for LalaVerse Feed profiles' });
  }

  const db = req.app.locals.db || require('../models');

  try {
    // Layer-aware cap check — soft warning, never hard block.
    // The number has meaning without preventing deliberate overrides.
    const capCheck = await checkFeedCap(db, layer);
    res.set('X-Creator-Cap-Count', `${capCheck.count}/${capCheck.cap}`);
    if (capCheck.atCap) {
      res.set('X-Creator-Cap-Warning', 'true');
      res.set('X-Creator-Cap-Exceeded', 'true');
    } else if (capCheck.remaining <= 23) {
      res.set('X-Creator-Cap-Warning', 'approaching');
    }

    // Build prompt — inject LalaVerse city culture context when applicable
    let prompt = buildGenerationPrompt(handle, platform, vibe_sentence, character_context, advanced_context);
    if (layer === 'lalaverse' && city) {
      prompt += `\n\nLALAVERSE CONTEXT:
This creator lives in ${city.replace(/_/g, ' ')} — ${CITY_CULTURE[city] || ''}
Generate a profile that feels native to that city's creator culture.
Lala's relationship to this creator: ${lala_relationship || 'mutual_unaware'}.
Career position relative to Lala: ${career_pressure || 'level'}.
Do not reference JustAWoman or the real world in any generated content.
Lala does not know she was built. The world she lives in feels complete and self-contained.`;
    }

    const response = await client.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 6000,
      messages:   [{ role: 'user', content: prompt }],
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
      // Enhanced fields
      post_frequency:        generated.post_frequency,
      engagement_rate:       generated.engagement_rate,
      platform_metrics:      generated.platform_metrics || {},
      geographic_base:       generated.geographic_base,
      geographic_cluster:    generated.geographic_cluster,
      age_range:             generated.age_range,
      relationship_status:   generated.relationship_status,
      known_associates:      generated.known_associates || [],
      revenue_streams:       generated.revenue_streams || [],
      brand_partnerships:    generated.brand_partnerships || [],
      audience_demographics: generated.audience_demographics || {},
      aesthetic_dna:         generated.aesthetic_dna || {},
      controversy_history:   generated.controversy_history || [],
      collab_style:          generated.collab_style,
      influencer_tier_detail:generated.influencer_tier_detail,
      // LalaVerse layer fields
      feed_layer:            layer,
      city:                  layer === 'lalaverse' ? city : null,
      lala_relationship:     layer === 'lalaverse' ? (lala_relationship || 'mutual_unaware') : null,
      career_pressure:       layer === 'lalaverse' ? (career_pressure || 'level') : null,
    });

    // Auto-assign ALL characters as followers based on intelligent follow engine
    const followResults = await autoAssignAllFollowers(db, profile.id, {
      ...generated,
      platform,
      archetype: generated.archetype,
      content_category: generated.content_category,
    });

    // Auto-link relationships — match known_associates against existing profiles
    if (db.SocialProfileRelationship && generated.known_associates?.length) {
      await autoLinkRelationships(db, profile, generated.known_associates);
    }

    // Reload profile with followers included
    const fullProfile = await db.SocialProfile.findByPk(profile.id, {
      include: db.SocialProfileFollower ? [{ model: db.SocialProfileFollower, as: 'followers' }] : [],
    });

    return res.json({ profile: fullProfile || profile, follow_results: followResults });
  } catch (err) {
    console.error('Social profile generation error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── INTELLIGENT AUTO-FOLLOW ENGINE ───────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
//
// FOLLOW PSYCHOLOGY — Why people follow on social media:
//   1. Identity & Relatability — "someone like me"
//   2. Aspiration — "who I want to become"
//   3. Entertainment — drama, humor, spectacle
//   4. Information — learning, authority, expertise
//   5. Social Proof — everyone else follows them
//   6. Personal Connection — they know them or feel they do
//   7. Parasocial Bond — emotional investment in their life
//
// Each character has a psychological follow profile that determines what kinds
// of creators they'd naturally gravitate toward, weighted by their wound, goal,
// and narrative function.
// ══════════════════════════════════════════════════════════════════════════════

const CHARACTER_FOLLOW_PROFILES = {
  // ── JustAWoman: Black woman, mother, wife, fashion/beauty/lifestyle creator ──
  // Wound: "She does everything right and the right room has not found her yet."
  // Watching creators alone at night. Men show up with their wallets.
  justawoman: {
    name: 'JustAWoman',
    // Content categories she's drawn to (weight 0-1)
    category_affinity: {
      'fashion':        0.95, 'beauty':       0.95, 'lifestyle':     0.90,
      'motherhood':     0.85, 'family':       0.80, 'faith':         0.70,
      'fitness':        0.75, 'relationships': 0.85, 'luxury':       0.80,
      'entrepreneurship': 0.70, 'cooking':    0.65, 'home':          0.70,
      'mental health':  0.60, 'travel':       0.70, 'music':         0.55,
      'comedy':         0.65, 'gossip':       0.75, 'drama':         0.80,
      'adult content':  0.45, 'sex work':     0.40, 'onlyfans':      0.40,
      'finance':        0.50, 'tech':         0.30, 'gaming':        0.15,
      'crypto':         0.10, 'sports':       0.35, 'politics':      0.40,
    },
    // Archetypes that draw her in (weight 0-1)
    archetype_affinity: {
      polished_curator:    0.90,  // She mirrors and envies this
      messy_transparent:   0.85,  // Can't look away — the cracks she won't show
      soft_life:           0.80,  // The life she wants but can't fully access
      explicitly_paid:     0.50,  // Something in her responds to this
      overnight_rise:      0.70,  // Jealousy mixed with fascination
      cautionary:          0.75,  // Watches to confirm her own choices were right
      the_peer:            0.65,  // Comfortable, low-stakes following
      the_watcher:         0.30,  // Too passive to engage her
      chaos_creator:       0.60,  // Guilty pleasure
      community_builder:   0.70,  // She respects this, wants to be this
    },
    // Follow motivation biases (which motivations drive her)
    motivation_weights: {
      identity:     0.25,  // She follows people who reflect her life
      aspiration:   0.30,  // The room she hasn't found yet — she's looking for it
      entertainment: 0.15, // Late-night scrolling
      information:  0.10,  // Learning beauty/business
      parasocial:   0.20,  // Emotional investment in strangers' lives
    },
    // Base follow probability adjustments
    drama_bonus:       0.10,  // Drama draws her in more than she'd admit
    adult_penalty:    -0.15,  // Conflicted — watches but wouldn't follow openly
    same_platform_bonus: { instagram: 0.10, tiktok: 0.05, youtube: 0.05 },
    follower_tier_affinity: { micro: 0.70, mid: 0.85, macro: 0.90, mega: 0.75 },
    base_follow_threshold: 0.35,  // Minimum score to auto-follow
  },

  // ── Lala: The daughter. Digitally native, sharp, pattern-reader ──
  // Wound: "She inherited her mother's ambition but not her patience."
  // The algorithm sees her before she sees herself. Creating = consuming.
  lala: {
    name: 'Lala',
    category_affinity: {
      'fashion':        0.85, 'beauty':       0.90, 'lifestyle':     0.80,
      'motherhood':     0.20, 'family':       0.30, 'faith':         0.15,
      'fitness':        0.70, 'relationships': 0.80, 'luxury':       0.75,
      'entrepreneurship': 0.65, 'cooking':    0.25, 'home':          0.20,
      'mental health':  0.55, 'travel':       0.60, 'music':         0.80,
      'comedy':         0.85, 'gossip':       0.90, 'drama':         0.95,
      'adult content':  0.55, 'sex work':     0.50, 'onlyfans':      0.55,
      'finance':        0.40, 'tech':         0.50, 'gaming':        0.45,
      'crypto':         0.30, 'sports':       0.30, 'politics':      0.35,
    },
    archetype_affinity: {
      polished_curator:    0.65,  // She sees through this — respects the craft
      messy_transparent:   0.90,  // Fascinated — this is the algorithm's favorite
      soft_life:           0.70,  // Wants it but won't admit it
      explicitly_paid:     0.75,  // She studies the business model
      overnight_rise:      0.95,  // This is what she wants AND fears
      cautionary:          0.85,  // Studies the fall to avoid it
      the_peer:            0.50,  // Boring — swipes past
      the_watcher:         0.60,  // Eerie mirror of herself
      chaos_creator:       0.90,  // Maximum engagement — she can't resist
      community_builder:   0.55,  // Respects but doesn't engage much
    },
    motivation_weights: {
      identity:     0.15,  // She's still figuring out who she is
      aspiration:   0.25,  // Studying what she wants to become
      entertainment: 0.30, // High — she consumes content voraciously
      information:  0.10,  // Learning the game
      parasocial:   0.20,  // Emotional investment she won't name
    },
    drama_bonus:       0.15,  // Drama is her #1 engagement driver
    adult_penalty:    -0.05,  // More unfazed than her mother
    same_platform_bonus: { tiktok: 0.15, instagram: 0.08, youtube: 0.05 },
    follower_tier_affinity: { micro: 0.80, mid: 0.75, macro: 0.70, mega: 0.60 },
    base_follow_threshold: 0.30,  // Lower threshold — she follows more freely
  },
};

/**
 * Compute follow probability for a character against a generated profile.
 * Returns { probability, motivation, influence_type, influence_level, follow_context, emotional_reaction }
 */
function computeFollowScore(characterKey, profileData) {
  const charProfile = CHARACTER_FOLLOW_PROFILES[characterKey];
  if (!charProfile) return null;

  const d = profileData; // shorthand for the generated/saved profile data
  let score = 0;
  let dominantMotivation = 'entertainment';
  let motivationScores = {};

  // ── 1. Content Category Match ──────────────────────────────────────────
  const category = (d.content_category || '').toLowerCase();
  let categoryScore = 0;
  for (const [cat, weight] of Object.entries(charProfile.category_affinity)) {
    if (category.includes(cat)) {
      categoryScore = Math.max(categoryScore, weight);
    }
  }
  // Partial match — try splitting the category
  if (categoryScore === 0 && category) {
    const words = category.split(/[\s\/,&]+/);
    for (const word of words) {
      for (const [cat, weight] of Object.entries(charProfile.category_affinity)) {
        if (cat.includes(word) || word.includes(cat)) {
          categoryScore = Math.max(categoryScore, weight * 0.7);
        }
      }
    }
  }
  if (categoryScore === 0) categoryScore = 0.40; // Unknown category — neutral
  score += categoryScore * 0.30; // 30% weight

  // ── 2. Archetype Match ─────────────────────────────────────────────────
  const archetype = d.archetype || '';
  const archetypeScore = charProfile.archetype_affinity[archetype] || 0.45;
  score += archetypeScore * 0.25; // 25% weight

  // ── 3. Drama Factor ────────────────────────────────────────────────────
  // Controversy, drama in known_associates, messy trajectory
  let dramaFactor = 0;
  const controversies = d.controversy_history || [];
  if (controversies.length > 0) dramaFactor += 0.15;
  if (controversies.some(c => c.severity === 'major' || c.severity === 'career_threatening')) dramaFactor += 0.15;

  const associates = d.known_associates || [];
  const avgDrama = associates.length > 0
    ? associates.reduce((sum, a) => sum + (a.drama_level || 0), 0) / associates.length
    : 0;
  if (avgDrama > 5) dramaFactor += 0.10;

  const trajectory = (d.current_trajectory || '').toLowerCase();
  if (['unraveling', 'viral_moment'].includes(trajectory)) dramaFactor += 0.10;
  if (trajectory === 'rising') dramaFactor += 0.05;

  dramaFactor = Math.min(0.40, dramaFactor);
  score += (dramaFactor + charProfile.drama_bonus) * 0.15; // 15% weight

  // ── 4. Follower Tier (social proof) ────────────────────────────────────
  const tier = (d.follower_tier || 'mid').toLowerCase();
  const tierScore = charProfile.follower_tier_affinity[tier] || 0.60;
  score += tierScore * 0.10; // 10% weight

  // ── 5. Platform Alignment ──────────────────────────────────────────────
  const platform = (d.platform || '').toLowerCase();
  const platformBonus = charProfile.same_platform_bonus[platform] || 0;
  score += platformBonus; // Direct bonus

  // ── 6. Adult Content Adjustment ────────────────────────────────────────
  if (d.adult_content_present) {
    score += charProfile.adult_penalty;
  }

  // ── 7. Lala Relevance Score Boost ──────────────────────────────────────
  const lalaScore = d.lala_relevance_score || 0;
  if (lalaScore >= 7) score += 0.08;
  else if (lalaScore >= 4) score += 0.04;

  // ── 8. Geographic/Cultural Cluster Bonus ───────────────────────────────
  const cluster = (d.geographic_cluster || '').toLowerCase();
  const geo = (d.geographic_base || '').toLowerCase();
  // Both characters orbit a Black American creator ecosystem
  if (cluster.includes('atlanta') || cluster.includes('houston') || cluster.includes('dmv') ||
      geo.includes('atlanta') || geo.includes('houston') || geo.includes('new york') ||
      cluster.includes('black') || cluster.includes('urban')) {
    score += 0.06;
  }

  // Clamp score
  score = Math.max(0, Math.min(1, score));

  // ── Determine dominant motivation ──────────────────────────────────────
  // Score each motivation based on what this specific profile offers
  motivationScores = {
    identity:     categoryScore * charProfile.motivation_weights.identity * (archetypeScore > 0.7 ? 1.3 : 1),
    aspiration:   (tierScore > 0.7 ? 1.2 : 1) * charProfile.motivation_weights.aspiration * (archetype === 'soft_life' || archetype === 'polished_curator' ? 1.3 : 1),
    entertainment: charProfile.motivation_weights.entertainment * (1 + dramaFactor) * (archetype === 'chaos_creator' || archetype === 'messy_transparent' ? 1.3 : 1),
    information:  charProfile.motivation_weights.information * (archetype === 'community_builder' || category.includes('education') || category.includes('business') ? 1.5 : 0.7),
    parasocial:   charProfile.motivation_weights.parasocial * (archetypeScore > 0.75 ? 1.2 : 1) * (lalaScore > 5 ? 1.3 : 1),
  };

  let maxMotivation = 0;
  for (const [mot, val] of Object.entries(motivationScores)) {
    if (val > maxMotivation) {
      maxMotivation = val;
      dominantMotivation = mot;
    }
  }

  // ── Map motivation to influence_type ───────────────────────────────────
  const MOTIVATION_TO_INFLUENCE = {
    identity:      'mirror',
    aspiration:    'aspiration',
    entertainment: 'escape',
    information:   'authority',
    parasocial:    'obsession',
  };
  const influenceType = MOTIVATION_TO_INFLUENCE[dominantMotivation] || 'aspiration';

  // ── Compute influence level (1-10) ─────────────────────────────────────
  const influenceLevel = Math.max(1, Math.min(10, Math.round(score * 10)));

  // ── Generate follow context ────────────────────────────────────────────
  const MOTIVATION_CONTEXTS = {
    identity:      `Follows because this creator reflects ${charProfile.name}'s own life — the same struggles, the same stage, the same unspoken questions.`,
    aspiration:    `Follows because this creator represents something ${charProfile.name} wants — the life, the confidence, the room she hasn't found yet.`,
    entertainment: `Follows for the spectacle. The drama, the mess, the content that pulls ${charProfile.name} in before she can think about why.`,
    information:   `Follows to learn. This creator teaches something ${charProfile.name} needs — a skill, a mindset, a way of moving through the world.`,
    parasocial:    `Follows because ${charProfile.name} feels like she knows this person. The daily updates, the vulnerabilities — it's become personal even though it isn't.`,
  };

  // ── Generate emotional reaction ────────────────────────────────────────
  const emojis = { identity: 'seen', aspiration: 'yearning', entertainment: 'captivated', information: 'respect', parasocial: 'invested' };
  const emotionalBase = emojis[dominantMotivation] || 'curious';
  let emotionalReaction = `Primary response: ${emotionalBase}.`;

  if (d.adult_content_present && score > 0.3) {
    emotionalReaction += characterKey === 'justawoman'
      ? ` Watches alone at night. Does not tell her husband.`
      : ` Studies the performance without flinching. Notes what gets the most engagement.`;
  }
  if (archetypeScore > 0.80) {
    emotionalReaction += characterKey === 'justawoman'
      ? ` This creator activates something deep — envy wrapped in admiration.`
      : ` This creator is exactly what the algorithm would build if it could dream.`;
  }

  return {
    probability: score,
    motivation: dominantMotivation,
    influence_type: influenceType,
    influence_level: influenceLevel,
    follow_context: MOTIVATION_CONTEXTS[dominantMotivation],
    emotional_reaction: emotionalReaction,
  };
}

/**
 * Auto-assign followers for ALL characters against a newly generated profile.
 * Each character independently evaluates whether they'd follow.
 */
async function autoAssignAllFollowers(db, profileId, profileData) {
  if (!db.SocialProfileFollower) return [];
  const results = [];

  for (const [charKey, charProfile] of Object.entries(CHARACTER_FOLLOW_PROFILES)) {
    try {
      const evaluation = computeFollowScore(charKey, profileData);
      if (!evaluation) continue;

      // Check if this character would follow
      if (evaluation.probability >= charProfile.base_follow_threshold) {
        const [follower, created] = await db.SocialProfileFollower.findOrCreate({
          where: { social_profile_id: profileId, character_key: charKey },
          defaults: {
            character_name: charProfile.name,
            follow_context: evaluation.follow_context,
            emotional_reaction: evaluation.emotional_reaction,
            influence_type: evaluation.influence_type,
            influence_level: evaluation.influence_level,
            follow_motivation: evaluation.motivation,
            follow_probability: Math.round(evaluation.probability * 100) / 100,
            auto_generated: true,
            discovered_in: 'Auto-follow engine — profile generation',
          },
        });
        results.push({
          character_key: charKey,
          character_name: charProfile.name,
          followed: true,
          created,
          probability: evaluation.probability,
          motivation: evaluation.motivation,
          influence_type: evaluation.influence_type,
          influence_level: evaluation.influence_level,
        });
      } else {
        results.push({
          character_key: charKey,
          character_name: charProfile.name,
          followed: false,
          probability: evaluation.probability,
          motivation: evaluation.motivation,
          reason: `Score ${(evaluation.probability * 100).toFixed(0)}% below threshold ${(charProfile.base_follow_threshold * 100).toFixed(0)}%`,
        });
      }
    } catch (e) {
      console.warn(`Auto-follow failed for ${charKey}:`, e.message);
    }
  }

  return results;
}

// Keep legacy function for backward compatibility (bulk routes import it)
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
        auto_generated: true,
      },
    });
  } catch (e) {
    console.warn('Auto-assign follower failed:', e.message);
  }
}

// ── Auto-link relationships — match known_associates against existing profiles ─
const VALID_REL_TYPES = new Set([
  'collab','rival','couple','ex','baby_daddy','baby_mama','bestie','mentor',
  'copycat','shade','situationship','family','management','feud','secret_link',
]);

async function autoLinkRelationships(db, profile, knownAssociates) {
  if (!db.SocialProfileRelationship) return;
  const { Op } = require('sequelize');

  for (const assoc of knownAssociates) {
    try {
      if (!assoc.handle) continue;
      const normalizedHandle = assoc.handle.startsWith('@') ? assoc.handle : `@${assoc.handle}`;

      // Find existing profile with this handle
      const target = await db.SocialProfile.findOne({
        where: {
          handle: { [Op.iLike]: normalizedHandle },
          id: { [Op.ne]: profile.id },
        },
      });

      if (!target) continue; // No match — the associate doesn't exist yet

      const relType = VALID_REL_TYPES.has(assoc.relationship_type) ? assoc.relationship_type : 'collab';

      await db.SocialProfileRelationship.findOrCreate({
        where: {
          source_profile_id: profile.id,
          target_profile_id: target.id,
          relationship_type: relType,
        },
        defaults: {
          drama_level: Math.min(10, Math.max(0, parseInt(assoc.drama_level) || 0)),
          description: assoc.description || null,
          auto_generated: true,
          direction: 'mutual',
          public_visibility: 'public',
        },
      });
    } catch (e) {
      console.warn('Auto-link relationship failed:', e.message);
    }
  }
}

// ── GET / ────────────────────────────────────────────────────────────────────
router.get('/', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  const { Op } = require('sequelize');
  const { series_id, archetype, status, platform, page, limit, search, sort, feed_layer } = req.query;
  try {
    const where = {};
    if (series_id)  where.series_id  = series_id;
    if (archetype)  where.archetype  = archetype;
    if (status)     where.status     = status;
    if (platform)   where.platform   = platform;
    if (feed_layer) {
      if (feed_layer === 'lalaverse' && db.SocialProfileFollower) {
        // Include lalaverse profiles + real_world profiles that Lala follows
        const { Op: opInner } = require('sequelize');
        const lalaFollowedIds = await db.SocialProfileFollower.findAll({
          attributes: ['social_profile_id'],
          where: { character_key: 'lala' },
          raw: true,
        }).then(rows => rows.map(r => r.social_profile_id));

        // Find which of those are real_world profiles
        const crossoverIds = lalaFollowedIds.length > 0
          ? await db.SocialProfile.findAll({
              attributes: ['id'],
              where: { id: { [opInner.in]: lalaFollowedIds }, feed_layer: 'real_world' },
              raw: true,
            }).then(rows => rows.map(r => r.id))
          : [];

        if (crossoverIds.length > 0) {
          where[Op.or] = [
            { feed_layer: 'lalaverse' },
            { id: { [Op.in]: crossoverIds } },
          ];
        } else {
          where.feed_layer = feed_layer;
        }
      } else {
        where.feed_layer = feed_layer;
      }
    }
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

    // Count totals by status (unfiltered by status, but respecting layer) for header stats
    // Use only the native layer for cap/stats (crossover profiles don't count against lalaverse cap)
    const baseWhere = {};
    if (series_id)  baseWhere.series_id  = series_id;
    if (feed_layer) baseWhere.feed_layer = feed_layer;
    const statusCounts = await db.SocialProfile.findAll({
      where: baseWhere,
      attributes: [
        'status',
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count'],
      ],
      group: ['status'],
      raw: true,
    });
    const counts = {};
    for (const row of statusCounts) {
      counts[row.status] = parseInt(row.count, 10);
    }

    // Count crossover profiles (real_world profiles Lala follows) shown in this result set
    const crossoverCount = (feed_layer === 'lalaverse')
      ? rows.filter(r => r.feed_layer === 'real_world').length
      : 0;

    return res.json({
      profiles: rows,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total: count,
        totalPages: Math.ceil(count / pageSize),
      },
      statusCounts: {
        total: Object.values(counts).reduce((a, b) => a + b, 0),
        generated: counts.generated || 0,
        finalized: counts.finalized || 0,
        crossed: counts.crossed || 0,
        archived: counts.archived || 0,
      },
      crossoverCount,
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
    const [changed] = await db.SocialProfile.update(
      { status: 'finalized' },
      { where: { id: { [Op.in]: ids }, status: 'generated' } }
    );
    const skipped = ids.length - changed;
    return res.json({ finalized: changed, skipped, total: ids.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /bulk/cross ─────────────────────────────────────────────────────────
// Cross (promote) multiple finalized profiles at once
router.post('/bulk/cross', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array required' });
  }
  if (ids.length > 100) {
    return res.status(400).json({ error: 'Maximum 100 profiles per bulk cross' });
  }
  try {
    const { Op } = require('sequelize');
    const [changed] = await db.SocialProfile.update(
      { status: 'crossed', world_exists: true, crossed_at: new Date() },
      { where: { id: { [Op.in]: ids }, status: 'finalized' } }
    );
    const skipped = ids.length - changed;
    return res.json({ crossed: changed, skipped, total: ids.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /bulk/archive ───────────────────────────────────────────────────────
// Archive multiple profiles at once
router.post('/bulk/archive', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array required' });
  }
  if (ids.length > 100) {
    return res.status(400).json({ error: 'Maximum 100 profiles per bulk archive' });
  }
  try {
    const { Op } = require('sequelize');
    const [changed] = await db.SocialProfile.update(
      { status: 'archived' },
      { where: { id: { [Op.in]: ids }, status: { [Op.ne]: 'archived' } } }
    );
    const skipped = ids.length - changed;
    return res.json({ archived: changed, skipped, total: ids.length });
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

// ── GET /export ──────────────────────────────────────────────────────────
// Export profiles as JSON or CSV (must be before /:id to avoid route conflict)
router.get('/export', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  const { format, feed_layer, status } = req.query;
  try {
    const where = {};
    if (feed_layer) where.feed_layer = feed_layer;
    if (status) where.status = status;

    const profiles = await db.SocialProfile.findAll({ where, order: [['created_at', 'DESC']] });

    if (format === 'csv') {
      const headers = ['handle', 'platform', 'display_name', 'archetype', 'follower_tier', 'follower_count_approx', 'content_category', 'geographic_base', 'age_range', 'current_trajectory', 'lala_relevance_score', 'status', 'feed_layer'];
      const csvRows = [headers.join(',')];
      for (const p of profiles) {
        csvRows.push(headers.map(h => {
          const val = p[h] ?? '';
          return `"${String(val).replace(/"/g, '""')}"`;
        }).join(','));
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="feed-profiles.csv"');
      return res.send(csvRows.join('\n'));
    }

    return res.json({ profiles, count: profiles.length });
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
router.post('/:id/finalize', optionalAuth, guardJustAWomanRecord, async (req, res) => {
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
router.post('/:id/cross', optionalAuth, guardJustAWomanRecord, async (req, res) => {
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
router.put('/:id', optionalAuth, guardJustAWomanRecord, async (req, res) => {
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

// ── POST /:id/regenerate ──────────────────────────────────────────────────
// Re-generate a profile using the same handle/platform/vibe (or overrides)
router.post('/:id/regenerate', optionalAuth, guardJustAWomanRecord, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  try {
    const profile = await db.SocialProfile.findByPk(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Not found' });

    const handle = req.body.handle || profile.handle;
    const platform = req.body.platform || profile.platform;
    const vibe_sentence = req.body.vibe_sentence || profile.vibe_sentence;
    const character_context = req.body.character_context || null;
    const advanced_context = req.body.advanced_context || null;

    const layer = profile.feed_layer || 'real_world';
    let prompt = buildGenerationPrompt(handle, platform, vibe_sentence, character_context, advanced_context);
    if (layer === 'lalaverse' && profile.city) {
      prompt += `\n\nLALAVERSE CONTEXT:
This creator lives in ${(profile.city || '').replace(/_/g, ' ')} — ${CITY_CULTURE[profile.city] || ''}
Generate a profile that feels native to that city's creator culture.
Lala's relationship to this creator: ${profile.lala_relationship || 'mutual_unaware'}.
Career position relative to Lala: ${profile.career_pressure || 'level'}.`;
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 6000,
      messages: [{ role: 'user', content: prompt }],
    });

    let generated;
    try {
      generated = JSON.parse(response.content[0].text.replace(/```json|```/g, '').trim());
    } catch {
      return res.status(500).json({ error: 'Regeneration failed to parse. Try again.' });
    }

    await profile.update({
      vibe_sentence,
      full_profile: generated,
      generation_model: 'claude-sonnet-4-20250514',
      display_name: generated.display_name,
      follower_tier: generated.follower_tier,
      follower_count_approx: generated.follower_count_approx,
      content_category: generated.content_category,
      archetype: generated.archetype,
      content_persona: generated.content_persona,
      real_signal: generated.real_signal,
      posting_voice: generated.posting_voice,
      comment_energy: generated.comment_energy,
      adult_content_present: generated.adult_content_present || false,
      adult_content_type: generated.adult_content_type,
      adult_content_framing: generated.adult_content_framing,
      parasocial_function: generated.parasocial_function,
      emotional_activation: generated.emotional_activation,
      watch_reason: generated.watch_reason,
      what_it_costs_her: generated.what_it_costs_her,
      current_trajectory: generated.current_trajectory,
      trajectory_detail: generated.trajectory_detail,
      moment_log: generated.moment_log || [],
      sample_captions: generated.sample_captions || [],
      sample_comments: generated.sample_comments || [],
      pinned_post: generated.pinned_post,
      lala_relevance_score: generated.lala_relevance_score || 0,
      lala_relevance_reason: generated.lala_relevance_reason,
      book_relevance: generated.book_relevance || [],
      crossing_trigger: generated.crossing_trigger,
      crossing_mechanism: generated.crossing_mechanism,
      post_frequency: generated.post_frequency,
      engagement_rate: generated.engagement_rate,
      platform_metrics: generated.platform_metrics || {},
      geographic_base: generated.geographic_base,
      geographic_cluster: generated.geographic_cluster,
      age_range: generated.age_range,
      relationship_status: generated.relationship_status,
      known_associates: generated.known_associates || [],
      revenue_streams: generated.revenue_streams || [],
      brand_partnerships: generated.brand_partnerships || [],
      audience_demographics: generated.audience_demographics || {},
      aesthetic_dna: generated.aesthetic_dna || {},
      controversy_history: generated.controversy_history || [],
      collab_style: generated.collab_style,
      influencer_tier_detail: generated.influencer_tier_detail,
    });

    const fullProfile = await db.SocialProfile.findByPk(profile.id, {
      include: db.SocialProfileFollower ? [{ model: db.SocialProfileFollower, as: 'followers' }] : [],
    });

    return res.json({ profile: fullProfile || profile, regenerated: true });
  } catch (err) {
    console.error('Social profile regeneration error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /:id/crossing-preview ───────────────────────────────────────────
// Preview what the crossing would create without actually creating it
router.post('/:id/crossing-preview', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  try {
    const profile = await db.SocialProfile.findByPk(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Not found' });
    if (profile.status === 'crossed') return res.status(409).json({ error: 'Already crossed.' });

    const charKey = profile.handle.replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const preview = {
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
      timeline_event: {
        event_name: `${profile.display_name || profile.handle} crosses into the story world`,
        event_description: `Social media creator ${profile.handle} (${profile.platform}) enters the story via: ${profile.crossing_mechanism || 'direct encounter'}. Trigger: ${profile.crossing_trigger || 'story need'}`,
        impact_level: profile.lala_relevance_score >= 7 ? 'major' : 'moderate',
      },
    };

    return res.json({ preview, profile_id: profile.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── DELETE /:id ──────────────────────────────────────────────────────────────
// Permanently delete a profile
router.delete('/:id', optionalAuth, guardJustAWomanRecord, async (req, res) => {
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
// Returns formatted profile for story engine injection.
// IMPORTANT: Only voice-safe fields are included. Author-knowledge fields
// (from full_profile JSONB: blind_spot, actual_narrative, foreclosed_*,
// justawoman_mirror, mirror_proposed_by_amber) are withheld here.
// Those fields are available only to the evaluation agent via storyEvaluationRoutes.
// See DEV-030: author-knowledge injection split.
router.get('/:id/scene-context', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  try {
    const p = await db.SocialProfile.findByPk(req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });

    // Voice-safe formatted context (no author-knowledge fields)
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

    // Return voice-safe profile subset — strip author-knowledge and raw JSONB
    const voiceProfile = {
      id: p.id,
      handle: p.handle,
      platform: p.platform,
      display_name: p.display_name,
      follower_tier: p.follower_tier,
      follower_count_approx: p.follower_count_approx,
      content_category: p.content_category,
      archetype: p.archetype,
      content_persona: p.content_persona,
      real_signal: p.real_signal,
      posting_voice: p.posting_voice,
      comment_energy: p.comment_energy,
      adult_content_present: p.adult_content_present,
      adult_content_type: p.adult_content_type,
      adult_content_framing: p.adult_content_framing,
      parasocial_function: p.parasocial_function,
      emotional_activation: p.emotional_activation,
      watch_reason: p.watch_reason,
      what_it_costs_her: p.what_it_costs_her,
      current_trajectory: p.current_trajectory,
      trajectory_detail: p.trajectory_detail,
      sample_captions: p.sample_captions,
      pinned_post: p.pinned_post,
      current_state: p.current_state,
      geographic_base: p.geographic_base,
      aesthetic_dna: p.aesthetic_dna,
      collab_style: p.collab_style,
    };

    return res.json({ context, profile: voiceProfile });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── FOLLOW ENGINE ROUTES ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// ── GET /follow-engine/evaluate/:id — evaluate follow probability for a profile ─
router.get('/follow-engine/evaluate/:id', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  try {
    const profile = await db.SocialProfile.findByPk(parseInt(req.params.id));
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const profileData = {
      ...profile.dataValues,
      ...(profile.full_profile || {}),
    };

    const evaluations = {};
    for (const charKey of Object.keys(CHARACTER_FOLLOW_PROFILES)) {
      evaluations[charKey] = computeFollowScore(charKey, profileData);
    }

    return res.json({ profile_id: profile.id, handle: profile.handle, evaluations });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /follow-engine/run — re-evaluate and auto-follow for ALL existing profiles ─
router.post('/follow-engine/run', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  if (!db.SocialProfileFollower) return res.status(404).json({ error: 'Follower model not available' });

  try {
    const { dry_run } = req.body; // If true, evaluate but don't create follows
    const profiles = await db.SocialProfile.findAll({
      attributes: ['id', 'handle', 'platform', 'archetype', 'content_category', 'follower_tier',
        'content_persona', 'lala_relevance_score', 'adult_content_present', 'current_trajectory',
        'geographic_base', 'geographic_cluster', 'controversy_history', 'known_associates', 'full_profile'],
    });

    const results = { total_profiles: profiles.length, follows_created: 0, follows_skipped: 0, details: [] };

    for (const profile of profiles) {
      const profileData = {
        ...profile.dataValues,
        ...(profile.full_profile || {}),
      };

      if (dry_run) {
        // Just evaluate, don't write
        const evals = {};
        for (const charKey of Object.keys(CHARACTER_FOLLOW_PROFILES)) {
          evals[charKey] = computeFollowScore(charKey, profileData);
        }
        results.details.push({ profile_id: profile.id, handle: profile.handle, evaluations: evals });
      } else {
        const followResults = await autoAssignAllFollowers(db, profile.id, profileData);
        const created = followResults.filter(r => r.followed && r.created).length;
        const skipped = followResults.filter(r => !r.followed).length;
        results.follows_created += created;
        results.follows_skipped += skipped;
        results.details.push({ profile_id: profile.id, handle: profile.handle, results: followResults });
      }
    }

    return res.json(results);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /follow-engine/stats — follow analytics summary ─────────────────────
router.get('/follow-engine/stats', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  if (!db.SocialProfileFollower) return res.json({ stats: {} });
  const { fn, col, literal } = require('sequelize');

  try {
    // Total follows per character
    const charFollows = await db.SocialProfileFollower.findAll({
      attributes: ['character_key', [fn('COUNT', '*'), 'count']],
      group: ['character_key'],
      raw: true,
    });

    // Follows by motivation
    const motivationBreakdown = await db.SocialProfileFollower.findAll({
      attributes: ['character_key', 'follow_motivation', [fn('COUNT', '*'), 'count']],
      where: { follow_motivation: { [require('sequelize').Op.ne]: null } },
      group: ['character_key', 'follow_motivation'],
      raw: true,
    });

    // Follows by influence type
    const influenceBreakdown = await db.SocialProfileFollower.findAll({
      attributes: ['character_key', 'influence_type', [fn('COUNT', '*'), 'count']],
      where: { influence_type: { [require('sequelize').Op.ne]: null } },
      group: ['character_key', 'influence_type'],
      raw: true,
    });

    // Avg influence level per character
    const avgInfluence = await db.SocialProfileFollower.findAll({
      attributes: ['character_key', [fn('AVG', col('influence_level')), 'avg_influence']],
      group: ['character_key'],
      raw: true,
    });

    // Total profiles vs followed profiles
    const totalProfiles = await db.SocialProfile.count();
    const followedProfiles = await db.SocialProfileFollower.count({
      distinct: true,
      col: 'social_profile_id',
    });

    return res.json({
      total_profiles: totalProfiles,
      followed_profiles: followedProfiles,
      unfollowed_profiles: totalProfiles - followedProfiles,
      character_follows: charFollows,
      motivation_breakdown: motivationBreakdown,
      influence_breakdown: influenceBreakdown,
      avg_influence: avgInfluence,
      character_profiles: Object.fromEntries(
        Object.entries(CHARACTER_FOLLOW_PROFILES).map(([k, v]) => [k, {
          name: v.name,
          threshold: v.base_follow_threshold,
          top_categories: Object.entries(v.category_affinity)
            .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cat, w]) => ({ category: cat, weight: w })),
          top_archetypes: Object.entries(v.archetype_affinity)
            .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([arch, w]) => ({ archetype: arch, weight: w })),
        }])
      ),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── RELATIONSHIP / NETWORK ROUTES ────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// ── GET /network — full creator relationship graph ──────────────────────────
router.get('/network', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  if (!db.SocialProfileRelationship) return res.json({ nodes: [], edges: [] });

  try {
    const { cluster, type } = req.query;

    // Build relationship filter
    const relWhere = {};
    if (type) relWhere.relationship_type = type;

    const relationships = await db.SocialProfileRelationship.findAll({
      where: relWhere,
      include: [
        { model: db.SocialProfile, as: 'sourceProfile', attributes: ['id','handle','platform','display_name','follower_tier','follower_count_approx','archetype','geographic_cluster','content_category'] },
        { model: db.SocialProfile, as: 'targetProfile', attributes: ['id','handle','platform','display_name','follower_tier','follower_count_approx','archetype','geographic_cluster','content_category'] },
      ],
      order: [['drama_level', 'DESC']],
    });

    // Build node map
    const nodeMap = new Map();
    const edges = [];
    for (const rel of relationships) {
      const src = rel.sourceProfile;
      const tgt = rel.targetProfile;
      if (!src || !tgt) continue;

      // Optional geographic cluster filter
      if (cluster && src.geographic_cluster !== cluster && tgt.geographic_cluster !== cluster) continue;

      if (!nodeMap.has(src.id)) nodeMap.set(src.id, {
        id: src.id, handle: src.handle, platform: src.platform,
        display_name: src.display_name, follower_tier: src.follower_tier,
        follower_count: src.follower_count_approx, archetype: src.archetype,
        cluster: src.geographic_cluster, category: src.content_category,
      });
      if (!nodeMap.has(tgt.id)) nodeMap.set(tgt.id, {
        id: tgt.id, handle: tgt.handle, platform: tgt.platform,
        display_name: tgt.display_name, follower_tier: tgt.follower_tier,
        follower_count: tgt.follower_count_approx, archetype: tgt.archetype,
        cluster: tgt.geographic_cluster, category: tgt.content_category,
      });

      edges.push({
        source: src.id, target: tgt.id,
        type: rel.relationship_type, direction: rel.direction,
        drama_level: rel.drama_level, visibility: rel.public_visibility,
        description: rel.description,
      });
    }

    return res.json({ nodes: Array.from(nodeMap.values()), edges });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /network/clusters — geographic cluster summary ──────────────────────
router.get('/network/clusters', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  try {
    const profiles = await db.SocialProfile.findAll({
      where: { geographic_cluster: { [require('sequelize').Op.ne]: null } },
      attributes: ['geographic_cluster', [require('sequelize').fn('COUNT', '*'), 'count']],
      group: ['geographic_cluster'],
      order: [[require('sequelize').fn('COUNT', '*'), 'DESC']],
      raw: true,
    });
    return res.json({ clusters: profiles });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /network/drama — highest drama relationships ────────────────────────
router.get('/network/drama', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  if (!db.SocialProfileRelationship) return res.json({ relationships: [] });

  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const relationships = await db.SocialProfileRelationship.findAll({
      where: { drama_level: { [require('sequelize').Op.gte]: 5 } },
      include: [
        { model: db.SocialProfile, as: 'sourceProfile', attributes: ['id','handle','platform','display_name','archetype'] },
        { model: db.SocialProfile, as: 'targetProfile', attributes: ['id','handle','platform','display_name','archetype'] },
      ],
      order: [['drama_level', 'DESC']],
      limit,
    });
    return res.json({ relationships });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /:id/relationships — relationships for a specific profile ───────────
router.get('/:id/relationships', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  if (!db.SocialProfileRelationship) return res.json({ relationships: [] });
  const { Op } = require('sequelize');

  try {
    const profileId = parseInt(req.params.id);
    const relationships = await db.SocialProfileRelationship.findAll({
      where: {
        [Op.or]: [
          { source_profile_id: profileId },
          { target_profile_id: profileId },
        ],
      },
      include: [
        { model: db.SocialProfile, as: 'sourceProfile', attributes: ['id','handle','platform','display_name','follower_tier','archetype'] },
        { model: db.SocialProfile, as: 'targetProfile', attributes: ['id','handle','platform','display_name','follower_tier','archetype'] },
      ],
      order: [['drama_level', 'DESC']],
    });
    return res.json({ relationships });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /:id/relationships — manually add a relationship ───────────────────
router.post('/:id/relationships', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  if (!db.SocialProfileRelationship) return res.status(404).json({ error: 'Relationship model not available' });

  try {
    const { target_profile_id, relationship_type, drama_level, description, direction, public_visibility, timeline_notes, narrative_function } = req.body;

    if (!target_profile_id || !relationship_type) {
      return res.status(400).json({ error: 'target_profile_id and relationship_type are required' });
    }
    if (!VALID_REL_TYPES.has(relationship_type)) {
      return res.status(400).json({ error: `Invalid relationship_type. Valid: ${Array.from(VALID_REL_TYPES).join(', ')}` });
    }

    const sourceId = parseInt(req.params.id);
    const targetId = parseInt(target_profile_id);

    // Verify both profiles exist
    const [source, target] = await Promise.all([
      db.SocialProfile.findByPk(sourceId),
      db.SocialProfile.findByPk(targetId),
    ]);
    if (!source || !target) return res.status(404).json({ error: 'One or both profiles not found' });

    const rel = await db.SocialProfileRelationship.create({
      source_profile_id: sourceId,
      target_profile_id: targetId,
      relationship_type,
      drama_level: Math.min(10, Math.max(0, parseInt(drama_level) || 0)),
      description: description || null,
      direction: direction || 'mutual',
      public_visibility: public_visibility || 'public',
      timeline_notes: timeline_notes || null,
      narrative_function: narrative_function || null,
      auto_generated: false,
    });

    return res.json({ relationship: rel });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── DELETE /relationships/:relId — remove a relationship ────────────────────
router.delete('/relationships/:relId', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  if (!db.SocialProfileRelationship) return res.status(404).json({ error: 'Relationship model not available' });

  try {
    const rel = await db.SocialProfileRelationship.findByPk(parseInt(req.params.relId));
    if (!rel) return res.status(404).json({ error: 'Relationship not found' });
    await rel.destroy();
    return res.json({ deleted: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.buildGenerationPrompt = buildGenerationPrompt;
module.exports.autoAssignFollower = autoAssignFollower;
module.exports.autoAssignAllFollowers = autoAssignAllFollowers;
module.exports.computeFollowScore = computeFollowScore;
module.exports.autoLinkRelationships = autoLinkRelationships;
module.exports.CHARACTER_FOLLOW_PROFILES = CHARACTER_FOLLOW_PROFILES;
