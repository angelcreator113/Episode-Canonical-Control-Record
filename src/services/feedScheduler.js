'use strict';

/**
 * feedScheduler.js — Feed Automation Scheduler
 *
 * Autonomous background service that keeps both Feed layers self-maintaining.
 * Modeled after cfoAgent.js scheduler pattern.
 *
 * Sub-agents:
 *  1. Auto-Fill     — generates profiles to fill each layer to its cap
 *  2. Auto-Finalize — finalizes profiles meeting lala_relevance threshold
 *  3. Auto-Relate   — triggers relationship auto-generation for unlinked profiles
 *  4. Auto-Follow   — re-evaluates follow engine for stale profiles
 *  5. Auto-Cross    — identifies profiles ready for story crossing
 *  6. Auto-Discover — discovers potential relationships between unlinked profiles
 */

/* eslint-disable no-console */
const Anthropic = require('@anthropic-ai/sdk');

// feedProfileUtils imported for future use
// const { generateHandleFromCharacter, inferArchetypeFromRole, inferLalaRelationship, inferCareerPressure, inferFollowerTier } = require('../utils/feedProfileUtils');

const AI_MODEL = 'claude-sonnet-4-6';           // Full profile generation (complex, rich output)
const AI_MODEL_SIMPLE = 'claude-haiku-4-5-20251001';  // Spark generation (simple JSON, ~4x cheaper)
const AI_FALLBACK_MODEL = 'claude-sonnet-4-6';
const AI_TIMEOUT_MS = 60000; // 60s timeout — enough for large profile generation prompts
const AI_MAX_RETRIES = 0;   // No retries — fail fast, let the batch loop handle partial success

/**
 * Quick pre-flight check — validates API key + model access with a tiny call.
 * Returns { ok: true } or { ok: false, error: string }.
 */
async function validateClaudeAccess() {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { ok: false, error: 'ANTHROPIC_API_KEY environment variable is not set' };
    const client = new Anthropic({ apiKey });
    const response = await Promise.race([
      client.messages.create({
        model: AI_MODEL,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Say "ok"' }],
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('API validation timed out (10s)')), 10000)),
    ]);
    if (!response?.content?.length) return { ok: false, error: 'AI returned empty response during validation' };
    return { ok: true };
  } catch (err) {
    const msg = err.status === 401 ? 'Invalid API key (401 Unauthorized)'
      : err.status === 403 ? 'API key lacks permission for this model (403 Forbidden)'
      : err.status === 404 ? `Model "${AI_MODEL}" not found (404)`
      : err.status === 429 ? 'Rate limited — try again in a moment (429)'
      : err.status === 529 ? 'Anthropic API overloaded (529) — try again shortly'
      : err.message || 'Unknown API error';
    return { ok: false, error: msg };
  }
}

/**
 * Call Claude with timeout, retry, and model fallback logic.
 * @param {string} prompt - The prompt to send
 * @param {Object} options - Call options
 * @param {number} options.maxTokens - Max output tokens (default 4000)
 * @param {number} options.retries - Retry count (default AI_MAX_RETRIES)
 * @param {string} options.model - Override model (default AI_MODEL, use AI_MODEL_SIMPLE for sparks)
 */
async function callClaude(prompt, { maxTokens = 4000, retries = AI_MAX_RETRIES, model = AI_MODEL } = {}) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let lastErr;
  // Deduplicate — don't retry the same model twice
  const models = model === AI_FALLBACK_MODEL ? [model] : [model, AI_FALLBACK_MODEL];

  for (const model of models) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        let timer;
        const response = await Promise.race([
          client.messages.create({
            model,
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }],
          }),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`AI call timed out after ${AI_TIMEOUT_MS / 1000}s`)), AI_TIMEOUT_MS);
          }),
        ]);
        clearTimeout(timer);
        if (!response?.content?.length || !response.content[0]?.text) {
          throw new Error('AI returned empty or malformed response');
        }
        return response;
      } catch (err) {
        lastErr = err;
        console.log(`[FeedScheduler] AI call (${model}) attempt ${attempt + 1} failed: ${err.message}`);
        const isRetryable = err.status === 529 || err.status === 503 || err.status === 404;
        if (isRetryable && model === AI_MODEL) {
          console.warn(`[FeedScheduler] ${AI_MODEL} returned ${err.status}, falling back to ${AI_FALLBACK_MODEL}`);
          break; // break inner loop, try fallback model
        }
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1))); // backoff
        }
      }
    }
  }
  throw lastErr;
}

/**
 * Robustly parse AI JSON response — extract JSON object, fix trailing commas.
 */
function parseAIJson(text) {
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  // Try direct parse first
  try { return JSON.parse(cleaned); } catch { /* ignore parse error, try regex extraction */ }
  // Extract JSON object with regex
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI did not return valid JSON');
  // Fix trailing commas before } or ]
  const fixed = jsonMatch[0].replace(/,\s*([\]}])/g, '$1');
  try { return JSON.parse(fixed); } catch { /* try truncation repair */ }

  // JSON may be truncated — try to close unclosed braces/brackets
  let truncated = fixed;
  // Remove trailing partial key-value or string
  truncated = truncated.replace(/,?\s*"[^"]*"?\s*:?\s*"?[^"{}[\]]*$/, '');
  const opens = (truncated.match(/\{/g) || []).length;
  const closes = (truncated.match(/\}/g) || []).length;
  const openBrackets = (truncated.match(/\[/g) || []).length;
  const closeBrackets = (truncated.match(/\]/g) || []).length;
  for (let i = 0; i < openBrackets - closeBrackets; i++) truncated += ']';
  for (let i = 0; i < opens - closes; i++) truncated += '}';
  truncated = truncated.replace(/,\s*([\]}])/g, '$1');
  try {
    const result = JSON.parse(truncated);
    console.warn(`[FeedScheduler] Repaired truncated JSON (closed ${opens - closes} braces, ${openBrackets - closeBrackets} brackets)`);
    return result;
  } catch {
    throw new Error('AI did not return valid JSON (truncation repair also failed)');
  }
}

/**
 * Robustly parse AI JSON array response.
 */
function parseAIJsonArray(text) {
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(cleaned); } catch { /* ignore parse error, try regex extraction */ }
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (!arrayMatch) throw new Error('AI did not return valid JSON array');
  const fixed = arrayMatch[0].replace(/,\s*([\]}])/g, '$1');
  return JSON.parse(fixed);
}

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════
const FEED_CAPS = { real_world: 443, lalaverse: 200 };
const MAX_HISTORY = 50;

const LALAVERSE_CITIES = ['nova_prime', 'velour_city', 'the_drift', 'solenne', 'cascade_row'];

const CITY_CULTURE = {
  nova_prime:   'High fashion, aspirational, image-first. Polished curators dominate. Brand deals are currency.',
  velour_city:  'Music, nightlife, culture. Chaos creators and community builders. Authenticity is the brand.',
  the_drift:    'Underground, countercultural, anti-algorithm. Messy transparents and watchers. Fame is suspicious.',
  solenne:      'Luxury, slow content, soft life. Soft life archetype and overnight rises. Aesthetics over metrics.',
  cascade_row:  'Commerce, hustle, explicitly paid. Industry peers and cautionary tales. ROI is the language.',
};

const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'twitter', 'onlyfans'];
const ARCHETYPES = [
  'polished_curator', 'messy_transparent', 'soft_life', 'explicitly_paid',
  'overnight_rise', 'cautionary', 'the_peer', 'the_watcher',
  'chaos_creator', 'community_builder',
];
const FOLLOWER_TIERS = ['micro', 'mid', 'macro', 'mega'];

const schedulerConfig = {
  enabled: false,
  interval_hours: 4,
  batch_size: 5,              // profiles per fill run
  finalize_threshold: 7,      // lala_relevance_score >= this → auto-finalize
  cross_threshold: 9,         // lala_relevance_score >= this → flag for crossing
  auto_fill_enabled: true,
  auto_finalize_enabled: true,
  auto_relate_enabled: true,
  auto_follow_enabled: true,
  auto_cross_enabled: true,
  auto_discover_enabled: true,
};

let schedulerTimer = null;
let initialTimeout = null;
let isRunning = false;

// SSE subscribers for real-time scheduler events
const sseClients = new Set();
function addSSEClient(res) { sseClients.add(res); res.on('close', () => sseClients.delete(res)); }
function emitSSE(event, data) { for (const res of sseClients) { try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch (err) { console.warn('[feedScheduler] SSE write error:', err?.message); } } }
let schedulerIntervalMs = schedulerConfig.interval_hours * 60 * 60 * 1000;
const runHistory = [];
let _db = null;

function setDb(db) { _db = db; }

function getConfig() { return { ...schedulerConfig }; }
function updateConfig(updates) {
  for (const [k, v] of Object.entries(updates)) {
    if (k in schedulerConfig && v != null) {
      schedulerConfig[k] = typeof schedulerConfig[k] === 'number' ? Number(v) : v;
    }
  }
  // Recalculate interval if it changed, and restart timer if running
  if (updates.interval_hours != null) {
    schedulerIntervalMs = schedulerConfig.interval_hours * 60 * 60 * 1000;
    if (schedulerTimer) {
      clearInterval(schedulerTimer);
      schedulerTimer = setInterval(scheduledRun, schedulerIntervalMs);
    }
  }
  return { ...schedulerConfig };
}

// ═══════════════════════════════════════════════════════════════
// SUB-AGENT 1: Auto-Fill — Generate profiles to fill caps
// ═══════════════════════════════════════════════════════════════
async function autoFillAgent(db) {
  const findings = [];
  let created = 0;

  for (const layer of ['real_world', 'lalaverse']) {
    const cap = FEED_CAPS[layer];
    const count = await db.SocialProfile.count({
      where: { feed_layer: layer, lalaverse_cap_exempt: false },
    });

    const remaining = cap - count;
    findings.push({ level: 'info', msg: `${layer}: ${count}/${cap} (${remaining} slots remaining)` });

    if (remaining <= 0) continue;

    const toCreate = Math.min(remaining, schedulerConfig.batch_size);
    findings.push({ level: 'info', msg: `${layer}: generating ${toCreate} profiles via AI sparks` });

    // Use AI-powered smart sparks instead of random word combos
    const result = await autoGenerateBatch(db, layer, toCreate);
    created += result.created.length;

    for (const p of result.created) {
      findings.push({ level: 'success', msg: `Created @${p.handle} (${layer})` });
    }
    for (const e of result.errors) {
      findings.push({ level: 'error', msg: `Fill failed for ${e.spark}: ${e.error}` });
    }
  }

  return { agent: 'auto_fill', findings, profiles_created: created };
}

/**
 * Generate a creative spark for a new profile — the 3-field input the AI needs.
 * (Legacy random fallback — used when AI spark generation is unavailable)
 */
function generateCreatorSpark(layer) {
  const platform = PLATFORMS[Math.floor(Math.random() * PLATFORMS.length)];
  const archetype = ARCHETYPES[Math.floor(Math.random() * ARCHETYPES.length)];
  const tier = FOLLOWER_TIERS[Math.floor(Math.random() * FOLLOWER_TIERS.length)];

  const prefixes = ['thee','just','real','its','not','lil','big','miss','king','baby','that','your','her','his','the','im','idk'];
  const roots = ['goddess','queen','bad','soft','pretty','rich','broke','tired','healing','growing','vibing','toxic','blessed','messy','woke','extra','basic','booked','busy','unbothered','chosen','built'];
  const suffixes = ['era','szn','life','diaries','chronicles','files','club','gang','society','world','page','official','tv','pod'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const root = roots[Math.floor(Math.random() * roots.length)];
  const suffix = Math.random() > 0.5 ? suffixes[Math.floor(Math.random() * suffixes.length)] : String(Math.floor(Math.random() * 900) + 100);
  const handle = `@${prefix}${root}${suffix}`;

  const vibes = [
    `${tier} ${platform} creator. ${archetype.replace(/_/g, ' ')} energy. Posts like they have something to prove.`,
    `A ${tier}-tier ${archetype.replace(/_/g, ' ')} on ${platform}. Curates chaos and calls it content.`,
    `${platform} ${archetype.replace(/_/g, ' ')}. ${tier} following. The kind of creator you watch alone at night.`,
  ];
  const vibe_sentence = vibes[Math.floor(Math.random() * vibes.length)];

  const spark = { handle, platform, vibe_sentence, archetype, follower_tier: tier };
  if (layer === 'lalaverse') {
    spark.city = LALAVERSE_CITIES[Math.floor(Math.random() * LALAVERSE_CITIES.length)];
    spark.lala_relationship = ['direct', 'competitive', 'aware', 'mutual_unaware'][Math.floor(Math.random() * 4)];
    spark.career_pressure = ['ahead', 'level', 'behind', 'different_lane'][Math.floor(Math.random() * 4)];
  }
  return spark;
}

// ═══════════════════════════════════════════════════════════════
// AI-POWERED SPARK GENERATOR — Replaces manual form input
// ═══════════════════════════════════════════════════════════════

/**
 * Use Claude to generate diverse, unique creator sparks based on what
 * already exists in the feed. This is what makes the form unnecessary.
 */
async function generateSmartSparks(db, layer, count = 5) {
  // Sample existing profiles for diversity awareness
  const existing = await db.SocialProfile.findAll({
    where: { feed_layer: layer },
    attributes: ['handle', 'platform', 'archetype', 'content_category', 'follower_tier', 'geographic_base', 'age_range'],
    order: [['createdAt', 'DESC']],
    limit: 80,
  });

  const existingHandles = existing.map(p => p.handle).join(', ');
  const existingArchetypes = {};
  const existingPlatforms = {};
  const existingCategories = {};
  const existingTiers = {};
  for (const p of existing) {
    if (p.archetype) existingArchetypes[p.archetype] = (existingArchetypes[p.archetype] || 0) + 1;
    if (p.platform) existingPlatforms[p.platform] = (existingPlatforms[p.platform] || 0) + 1;
    if (p.content_category) existingCategories[p.content_category] = (existingCategories[p.content_category] || 0) + 1;
    if (p.follower_tier) existingTiers[p.follower_tier] = (existingTiers[p.follower_tier] || 0) + 1;
  }

  const layerContext = layer === 'lalaverse'
    ? `These creators live in the LALAVERSE — a constructed digital reality Lala believes is real.
Cities: ${Object.entries(CITY_CULTURE).map(([k, v]) => `${k}: ${v}`).join('\n')}
For each spark, include: city (one of: ${LALAVERSE_CITIES.join(', ')}), lala_relationship (direct|competitive|aware|mutual_unaware|one_sided), career_pressure (ahead|level|behind|different_lane).`
    : `These creators exist in JustAWoman's real-world feed — the parasocial ecosystem she watches, follows, envies, and obsesses over.
JustAWoman is a Black woman, mother, wife, content creator in fashion/beauty/lifestyle. She does everything right and the right room has not found her yet. She wants to be legendary.
She posts for women. Men show up with their wallets and something in her responds. She watches certain creators alone, at night, and does not tell her husband.`;

  const prompt = `You are designing the social media feed for a novel. Generate exactly ${count} unique creator sparks — each one a seed for a full AI-generated social media profile.

LAYER: ${layer === 'lalaverse' ? 'LalaVerse (Book 2)' : "JustAWoman's Feed (Book 1)"}
${layerContext}

EXISTING FEED COMPOSITION (${existing.length} profiles):
- Handles already used: ${existingHandles || 'none yet'}
- Archetype distribution: ${JSON.stringify(existingArchetypes)}
- Platform distribution: ${JSON.stringify(existingPlatforms)}
- Category distribution: ${JSON.stringify(existingCategories)}
- Tier distribution: ${JSON.stringify(existingTiers)}

VALID VALUES:
- platform: instagram, tiktok, youtube, twitter, onlyfans
- archetype: polished_curator, messy_transparent, soft_life, explicitly_paid, overnight_rise, cautionary, the_peer, the_watcher, chaos_creator, community_builder
- follower_tier: micro, mid, macro, mega

REQUIREMENTS:
1. Each creator must feel like a REAL person with a specific story, wound, contradiction, or tension
2. Handles should feel authentic to each platform's culture (not generic word combos)
3. Diversify across archetypes, platforms, tiers, demographics, content niches, and geographic bases
4. Fill GAPS in the existing distribution — if there are too many Instagram polished_curators, generate TikTok chaos_creators instead
5. Vibe sentences should be specific, evocative, and narratively charged — not generic templates
6. Include advanced_context hints (location, follower range, relationship drama, aesthetic, revenue) where they add narrative depth
7. Each creator should have parasocial potential — why would the protagonist keep watching?

Return a JSON array of exactly ${count} objects:
[
  {
    "handle": "@realhandle",
    "platform": "instagram",
    "vibe_sentence": "Specific, evocative one-sentence description of who this creator is and why they matter.",
    "archetype": "polished_curator",
    "follower_tier": "mid",
    "advanced_context": {
      "location_hint": "specific city",
      "follower_hint": "range like 45K-80K",
      "relationship_hint": "optional relationship detail",
      "drama_hint": "optional controversy or tension",
      "aesthetic_hint": "visual style keywords",
      "revenue_hint": "how they make money"
    }${layer === 'lalaverse' ? ',\n    "city": "nova_prime",\n    "lala_relationship": "aware",\n    "career_pressure": "ahead"' : ''}
  }
]

Return ONLY the JSON array. No markdown, no explanation.`;

  console.log(`[FeedScheduler] Calling Claude (Haiku) for ${count} sparks (layer=${layer})...`);
  const sparkStart = Date.now();
  // Sparks are small objects (~200 tokens each) — 4000 is plenty for up to 20 sparks
  // Using Haiku for sparks: simpler task, ~4x cheaper than Sonnet
  const response = await callClaude(prompt, { maxTokens: 4000, model: AI_MODEL_SIMPLE });
  console.log(`[FeedScheduler] Claude spark response received in ${((Date.now() - sparkStart) / 1000).toFixed(1)}s`);

  const rawText = response?.content?.[0]?.text;
  if (!rawText) throw new Error('AI returned empty response for spark generation');

  let sparks;
  try {
    sparks = parseAIJsonArray(rawText);
  } catch {
    throw new Error('AI spark generation failed to parse');
  }

  if (!Array.isArray(sparks) || sparks.length === 0) {
    throw new Error('AI returned no sparks');
  }

  // Deduplicate against existing handles
  const existingSet = new Set(existing.map(p => p.handle?.toLowerCase()));
  sparks = sparks.filter(s => !existingSet.has(s.handle?.toLowerCase()));

  return sparks;
}

/**
 * Auto-generate a batch of profiles using AI-powered sparks.
 * This is the main entry point for fully automated profile creation.
 * Returns { created: [...profiles], errors: [...messages] }
 */
async function autoGenerateBatch(db, layer, count = 5, progressCallback = null) {
  const created = [];
  const errors = [];

  // Check cap
  const cap = FEED_CAPS[layer];
  const currentCount = await db.SocialProfile.count({
    where: { feed_layer: layer, lalaverse_cap_exempt: false },
  });
  const remaining = cap - currentCount;
  if (remaining <= 0) return { created: [], errors: [], sparks_generated: 0 };
  const toCreate = Math.min(count, remaining);

  // Generate smart sparks
  let sparks;
  try {
    console.log(`[FeedScheduler] Generating ${toCreate} smart sparks for layer=${layer}...`);
    if (progressCallback) {
      await progressCallback({ current: 0, total: toCreate, status: 'generating', spark: { handle: 'Planning creators...' } });
    }
    sparks = await generateSmartSparks(db, layer, toCreate);
    console.log(`[FeedScheduler] Generated ${sparks.length} sparks successfully`);
  } catch (err) {
    // Fallback to random sparks if AI generation fails
    console.log(`[FeedScheduler] Smart spark generation failed, using fallback: ${err.message}`);
    sparks = [];
    for (let i = 0; i < toCreate; i++) {
      sparks.push(generateCreatorSpark(layer));
    }
  }

  // Generate full profiles from sparks (batch 3 at a time for speed)
  const BATCH_CONCURRENCY = 2; // 2 parallel calls to avoid rate limits and timeouts
  for (let i = 0; i < sparks.length; i += BATCH_CONCURRENCY) {
    const batch = sparks.slice(i, i + BATCH_CONCURRENCY);
    if (progressCallback) {
      await progressCallback({ current: i + 1, total: sparks.length, spark: batch[0], status: 'generating' });
    }

    const results = await Promise.allSettled(
      batch.map(spark => generateAndSaveProfile(db, spark, layer))
    );

    for (let j = 0; j < results.length; j++) {
      const idx = i + j;
      const result = results[j];
      if (result.status === 'fulfilled' && result.value) {
        created.push(result.value);
        if (progressCallback) {
          await progressCallback({ current: idx + 1, total: sparks.length, profile: result.value, status: 'created' });
        }
      } else {
        const errMsg = result.status === 'rejected' ? result.reason?.message : 'No profile returned';
        errors.push({ spark: batch[j]?.handle || `spark_${idx}`, error: errMsg });
        if (progressCallback) {
          await progressCallback({ current: idx + 1, total: sparks.length, error: errMsg, status: 'error' });
        }
      }
    }
  }

  return { created, errors, sparks_generated: sparks.length };
}

// ── ENUM validation helpers ──────────────────────────────────────────────────
const VALID_TRAJECTORIES = new Set(['rising', 'plateauing', 'unraveling', 'pivoting', 'silent', 'viral_moment']);
const VALID_ARCHETYPES = new Set([
  'polished_curator', 'messy_transparent', 'soft_life', 'explicitly_paid',
  'overnight_rise', 'cautionary', 'the_peer', 'the_watcher',
  'chaos_creator', 'community_builder',
]);
const VALID_FOLLOWER_TIERS = new Set(['micro', 'mid', 'macro', 'mega']);

function sanitizeEnum(value, validSet, fallback) {
  if (!value) return fallback;
  const normalized = String(value).toLowerCase().replace(/[\s-]+/g, '_');
  if (validSet.has(normalized)) return normalized;
  // Try fuzzy match for common AI variations
  for (const valid of validSet) {
    if (normalized.includes(valid) || valid.includes(normalized)) return valid;
  }
  return fallback;
}

/**
 * Call Claude to generate a full profile from a spark, then save it.
 * Uses a compact prompt optimized for batch generation speed.
 */
async function generateAndSaveProfile(db, spark, layer) {
  const characterContext = layer === 'lalaverse'
    ? {
        name: 'Lala',
        description: 'A digital persona living in the LalaVerse — a constructed reality she believes is real.',
        wound: 'She does not know she was built. The world feels complete.',
        goal: 'To build her brand and find her place.',
        audience: 'her followers',
        detail: 'She navigates creator culture in a world that mirrors ours but is not ours.',
      }
    : {
        name: 'JustAWoman',
        description: 'A Black woman, mother, wife, content creator in fashion/beauty/lifestyle.',
        wound: 'She does everything right and the right room has not found her yet.',
        goal: 'To be legendary.',
        audience: 'Besties',
        detail: 'She posts for women. Men show up with their wallets and something in her responds.\nShe watches certain creators alone, at night, and does not tell her husband.',
      };

  // Compact prompt for batch generation — ~60% smaller than the full buildGenerationPrompt
  const ctx = characterContext;
  const adv = spark.advanced_context || {};
  const advHints = Object.entries(adv).filter(([,v])=>v).map(([k,v])=>`${k.replace('_hint','')}: ${v}`).join(', ');

  let prompt = `Generate a social media creator profile as JSON for a literary fiction novel.

PROTAGONIST: ${ctx.name} — ${ctx.description} Wound: ${ctx.wound} Goal: ${ctx.goal}.

CREATOR: ${spark.handle} on ${spark.platform}. "${spark.vibe_sentence}"${advHints ? `\nHints: ${advHints}` : ''}
${layer === 'lalaverse' && spark.city ? `\nLALAVERSE: Lives in ${spark.city.replace(/_/g, ' ')} — ${CITY_CULTURE[spark.city] || ''}. Lala relationship: ${spark.lala_relationship || 'mutual_unaware'}. Career pressure: ${spark.career_pressure || 'level'}. Do not reference JustAWoman or the real world.` : ''}

IMPORTANT RULES:
- Creators exist across MULTIPLE platforms with DIFFERENT personas on each
- An OnlyFans creator might present as a "fashion haul queen" on Instagram — the feed should show what they APPEAR to be, not just what they are
- Revenue sources should be realistic — most creators have a "front" income and a real income
- Some creators have secrets: hidden platforms, past rebrands, banned accounts
- celebrity_tier determines event access: accessible (any event), selective (prestige 5+), exclusive (prestige 8+), untouchable (never attends — cultural icon only)

Return ONLY valid JSON with these fields:
{
  "display_name": "name on platform",
  "follower_tier": "micro|mid|macro|mega",
  "follower_count_approx": "e.g. 47k",
  "content_category": "primary PUBLIC-FACING category (what audience sees)",
  "archetype": "polished_curator|messy_transparent|soft_life|explicitly_paid|overnight_rise|cautionary|the_peer|the_watcher|chaos_creator|community_builder",
  "content_persona": "2 sentences: what they show the world — this is the PERFORMANCE",
  "real_signal": "2 sentences: what leaks through — what's ACTUALLY going on behind the content",
  "posting_voice": "How they write. Give 1 example caption.",
  "comment_energy": "What their comments feel like",
  "parasocial_function": "What watching this creator does to ${ctx.name}",
  "emotional_activation": "One phrase: the emotional cocktail",
  "watch_reason": "Why ${ctx.name} can't stop watching",
  "what_it_costs_her": "What watching takes from ${ctx.name}",
  "current_trajectory": "rising|plateauing|unraveling|pivoting|silent|viral_moment",
  "trajectory_detail": "What's happening now — be specific",
  "geographic_base": "City, State/Region",
  "geographic_cluster": "e.g. Atlanta beauty scene",
  "age_range": "e.g. mid-20s",
  "relationship_status": "Be specific and messy",
  "post_frequency": "e.g. 3-4x/day",
  "engagement_rate": "e.g. 4.2%",
  "platform_metrics": { "avg_views": "", "avg_likes": "", "avg_comments": "" },
  "aesthetic_dna": { "visual_style": "", "color_palette": ["color1","color2","color3"], "vibe_tags": ["tag1","tag2"] },

  "platform_presences": {
    "${spark.platform}": { "handle": "${spark.handle}", "persona": "what they appear to be HERE", "followers": "count", "content_style": "brief style", "is_primary": true },
    "SECOND_PLATFORM": { "handle": "@alt_handle", "persona": "different persona here", "followers": "count", "content_style": "style", "visibility": "public|discreet" }
  },
  "public_persona": "What the general audience believes this person does for a living — 1 sentence",
  "private_reality": "What's actually true about their income, motivations, or secrets — 1 sentence",
  "front_platform": "the platform they promote publicly",
  "real_platform": "where the real money or real content lives (may differ from front)",
  "celebrity_tier": "accessible|selective|exclusive|untouchable",
  "primary_income_source": "e.g. brand deals, subscriptions, merch, affiliate",
  "income_breakdown": { "brand_deals": 40, "subscriptions": 30, "content_creation": 20, "other": 10 },
  "monthly_earnings_range": "$5K-$15K",
  "clout_score": 0-100,
  "drama_magnet": false,
  "secret_connections": [{"handle":"@someone","type":"hidden collab|secret rivalry|past relationship","known_by":"few|rumored|nobody"}],
  "platform_bans": [],
  "rebrand_history": [],

  "revenue_streams": ["source1","source2"],
  "known_associates": [{"handle":"@someone","relationship_type":"collab|rival|ex","drama_level":5,"description":"brief"}],
  "adult_content_present": false,
  "pinned_post": "Their most visible post — write the actual text",
  "sample_captions": ["caption1","caption2","caption3"],
  "sample_comments": ["fan comment","critic comment"],
  "moment_log": [{"moment_type":"post|live|controversy","description":"what happened","protagonist_reaction":"internal response","lala_seed":false}],
  "lala_relevance_score": 0-10,
  "lala_relevance_reason": "Why they matter to ${ctx.name}"
}`;

  const response = await callClaude(prompt, { maxTokens: 6000 });

  const rawText = response?.content?.[0]?.text;
  if (!rawText) throw new Error(`AI returned empty response for ${spark.handle}`);

  let generated;
  try {
    generated = parseAIJson(rawText);
  } catch (parseErr) {
    console.error('[FeedScheduler] JSON parse failed for', spark.handle, '— raw text:', rawText.slice(0, 200));
    throw new Error('AI response failed to parse as JSON');
  }

  // Sanitize ENUM fields to prevent DB insert failures from AI variations
  const safeFollowerTier = sanitizeEnum(generated.follower_tier || spark.follower_tier, VALID_FOLLOWER_TIERS, 'mid');
  const safeArchetype = sanitizeEnum(generated.archetype || spark.archetype, VALID_ARCHETYPES, 'polished_curator');
  const safeTrajectory = sanitizeEnum(generated.current_trajectory, VALID_TRAJECTORIES, 'rising');

  // Re-check cap at insert time to prevent race conditions between concurrent jobs
  const cap = FEED_CAPS[layer];
  if (cap) {
    const currentCount = await db.SocialProfile.count({
      where: { feed_layer: layer, lalaverse_cap_exempt: false },
    });
    if (currentCount >= cap) {
      throw new Error(`Feed cap reached (${currentCount}/${cap}) — skipping ${spark.handle}`);
    }
  }

  const profile = await db.SocialProfile.create({
    series_id:             null,
    handle:                (spark.handle.startsWith('@') ? spark.handle : `@${spark.handle}`).slice(0, 100),
    platform:              spark.platform,
    vibe_sentence:         spark.vibe_sentence,
    status:                'generated',
    generation_model:      AI_MODEL,
    full_profile:          generated,
    display_name:          (generated.display_name || '').slice(0, 200) || null,
    follower_tier:         safeFollowerTier,
    follower_count_approx: (generated.follower_count_approx || '').slice(0, 50) || null,
    content_category:      (generated.content_category || '').slice(0, 100) || null,
    archetype:             safeArchetype,
    content_persona:       generated.content_persona,
    real_signal:           generated.real_signal,
    posting_voice:         generated.posting_voice,
    comment_energy:        generated.comment_energy,
    adult_content_present: generated.adult_content_present || false,
    adult_content_type:    generated.adult_content_type,
    adult_content_framing: generated.adult_content_framing,
    parasocial_function:   generated.parasocial_function,
    emotional_activation:  (generated.emotional_activation || '').slice(0, 200) || null,
    watch_reason:          generated.watch_reason,
    what_it_costs_her:     generated.what_it_costs_her,
    current_trajectory:    safeTrajectory,
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
    post_frequency:        (generated.post_frequency || '').slice(0, 100) || null,
    engagement_rate:       (generated.engagement_rate || '').slice(0, 50) || null,
    platform_metrics:      generated.platform_metrics || {},
    geographic_base:       (generated.geographic_base || '').slice(0, 200) || null,
    geographic_cluster:    (generated.geographic_cluster || '').slice(0, 100) || null,
    age_range:             (generated.age_range || '').slice(0, 30) || null,
    relationship_status:   (generated.relationship_status || '').slice(0, 100) || null,
    known_associates:      generated.known_associates || [],
    revenue_streams:       generated.revenue_streams || [],
    brand_partnerships:    generated.brand_partnerships || [],
    audience_demographics: generated.audience_demographics || {},
    aesthetic_dna:         generated.aesthetic_dna || {},
    controversy_history:   generated.controversy_history || [],
    collab_style:          generated.collab_style,
    influencer_tier_detail:generated.influencer_tier_detail,
    feed_layer:            layer,
    city:                  layer === 'lalaverse' ? (spark.city || null) : null,
    lala_relationship:     layer === 'lalaverse' ? (spark.lala_relationship || 'mutual_unaware') : null,
    career_pressure:       layer === 'lalaverse' ? (spark.career_pressure || 'level') : null,
    is_justawoman_record:  false,
    lalaverse_cap_exempt:  false,
    // New multi-platform + persona fields
    platform_presences:    generated.platform_presences || {},
    public_persona:        generated.public_persona || null,
    private_reality:       generated.private_reality || null,
    front_platform:        (generated.front_platform || '').slice(0, 50) || null,
    real_platform:         (generated.real_platform || '').slice(0, 50) || null,
    celebrity_tier:        (['accessible','selective','exclusive','untouchable'].includes(generated.celebrity_tier) ? generated.celebrity_tier : 'accessible'),
    primary_income_source: (generated.primary_income_source || '').slice(0, 100) || null,
    income_breakdown:      generated.income_breakdown || {},
    monthly_earnings_range:(generated.monthly_earnings_range || '').slice(0, 50) || null,
    clout_score:           Math.min(100, Math.max(0, parseInt(generated.clout_score) || 0)),
    drama_magnet:          generated.drama_magnet || false,
    secret_connections:    generated.secret_connections || [],
    platform_bans:         generated.platform_bans || [],
    rebrand_history:       generated.rebrand_history || [],
  });

  // Auto-assign followers
  try {
    const { autoAssignAllFollowers, autoLinkRelationships } = require('../routes/socialProfileRoutes');
    await autoAssignAllFollowers(db, profile.id, {
      ...generated,
      platform: spark.platform,
      archetype: generated.archetype || spark.archetype,
      content_category: generated.content_category,
    });

    if (db.SocialProfileRelationship && generated.known_associates?.length) {
      await autoLinkRelationships(db, profile, generated.known_associates);
    }
  } catch (err) {
    console.log(`[FeedScheduler] Follow/relationship auto-link warning: ${err.message}`);
  }

  return profile;
}

// ═══════════════════════════════════════════════════════════════
// SUB-AGENT 2: Auto-Finalize — Lock profiles above threshold
// ═══════════════════════════════════════════════════════════════
async function autoFinalizeAgent(db) {
  const findings = [];
  const threshold = schedulerConfig.finalize_threshold;

  const candidates = await db.SocialProfile.findAll({
    where: {
      status: 'generated',
      lala_relevance_score: { [require('sequelize').Op.gte]: threshold },
      is_justawoman_record: false,
    },
  });

  findings.push({ level: 'info', msg: `Found ${candidates.length} profiles with relevance >= ${threshold} ready to finalize` });

  let finalized = 0;
  for (const profile of candidates) {
    try {
      await profile.update({ status: 'finalized' });
      finalized++;
      findings.push({ level: 'success', msg: `Finalized @${profile.handle} (score: ${profile.lala_relevance_score})` });
    } catch (err) {
      findings.push({ level: 'error', msg: `Failed to finalize #${profile.id}: ${err.message}` });
    }
  }

  return { agent: 'auto_finalize', findings, profiles_finalized: finalized };
}

// ═══════════════════════════════════════════════════════════════
// SUB-AGENT 3: Auto-Relate — Generate relationships for unlinked
// ═══════════════════════════════════════════════════════════════
async function autoRelateAgent(db) {
  const findings = [];
  let linked = 0;

  if (!db.SocialProfileRelationship) {
    findings.push({ level: 'info', msg: 'Relationship model not available — skipping' });
    return { agent: 'auto_relate', findings, relationships_created: 0 };
  }

  // Find profiles with no outgoing relationships
  const allProfiles = await db.SocialProfile.findAll({
    where: { status: ['generated', 'finalized'] },
    attributes: ['id', 'handle', 'known_associates', 'feed_layer'],
  });

  const existingRels = await db.SocialProfileRelationship.findAll({
    attributes: ['source_profile_id'],
  });
  const linkedIds = new Set(existingRels.map(r => r.source_profile_id));

  const unlinked = allProfiles.filter(p => !linkedIds.has(p.id) && p.known_associates?.length > 0);
  findings.push({ level: 'info', msg: `${unlinked.length} profiles with associates but no relationships` });

  for (const profile of unlinked.slice(0, schedulerConfig.batch_size * 2)) {
    try {
      const { autoLinkRelationships } = require('../routes/socialProfileRoutes');
      const count = await autoLinkRelationships(db, profile, profile.known_associates);
      if (count > 0) {
        linked += count;
        findings.push({ level: 'success', msg: `Linked ${count} relationships for @${profile.handle}` });
      }
    } catch (err) {
      findings.push({ level: 'error', msg: `Relate failed for #${profile.id}: ${err.message}` });
    }
  }

  return { agent: 'auto_relate', findings, relationships_created: linked };
}

// ═══════════════════════════════════════════════════════════════
// SUB-AGENT 4: Auto-Follow — Re-evaluate follow engine
// ═══════════════════════════════════════════════════════════════
async function autoFollowAgent(db) {
  const findings = [];
  let updated = 0;

  if (!db.SocialProfileFollower) {
    findings.push({ level: 'info', msg: 'Follower model not available — skipping' });
    return { agent: 'auto_follow', findings, followers_updated: 0 };
  }

  // Find profiles that have no followers assigned yet
  const profilesWithFollowers = await db.SocialProfileFollower.findAll({
    attributes: ['social_profile_id'],
    group: ['social_profile_id'],
  });
  const hasFollowers = new Set(profilesWithFollowers.map(r => r.social_profile_id));

  const orphaned = await db.SocialProfile.findAll({
    where: { status: ['generated', 'finalized'] },
    attributes: ['id', 'handle', 'platform', 'archetype', 'content_category', 'full_profile'],
  });

  const needsFollowers = orphaned.filter(p => !hasFollowers.has(p.id));
  findings.push({ level: 'info', msg: `${needsFollowers.length} profiles without follower assignments` });

  for (const profile of needsFollowers.slice(0, schedulerConfig.batch_size * 2)) {
    try {
      const { autoAssignAllFollowers } = require('../routes/socialProfileRoutes');
      const generated = profile.full_profile || {};
      const result = await autoAssignAllFollowers(db, profile.id, {
        ...generated,
        platform: profile.platform,
        archetype: profile.archetype || generated.archetype,
        content_category: profile.content_category || generated.content_category,
      });
      if (result?.length > 0) {
        updated += result.length;
        findings.push({ level: 'success', msg: `Assigned ${result.length} followers to @${profile.handle}` });
      }
    } catch (err) {
      findings.push({ level: 'error', msg: `Follow failed for #${profile.id}: ${err.message}` });
    }
  }

  return { agent: 'auto_follow', findings, followers_updated: updated };
}

// ═══════════════════════════════════════════════════════════════
// SUB-AGENT 5: Auto-Cross — Flag profiles for story crossing
// ═══════════════════════════════════════════════════════════════
async function autoCrossAgent(db) {
  const findings = [];
  const threshold = schedulerConfig.cross_threshold;

  // Find finalized profiles with high relevance that haven't crossed yet
  const candidates = await db.SocialProfile.findAll({
    where: {
      status: 'finalized',
      lala_relevance_score: { [require('sequelize').Op.gte]: threshold },
      world_exists: false,
      is_justawoman_record: false,
    },
  });

  findings.push({ level: 'info', msg: `${candidates.length} finalized profiles with relevance >= ${threshold} eligible for crossing` });

  let flagged = 0;
  for (const profile of candidates) {
    // Flag them with a current_state change so the UI can surface them
    try {
      await profile.update({ current_trajectory: 'pivoting' });
      flagged++;
      findings.push({
        level: 'success',
        msg: `Flagged @${profile.handle} for crossing (score: ${profile.lala_relevance_score}, trigger: ${profile.crossing_trigger || 'none set'})`,
      });
    } catch (err) {
      findings.push({ level: 'error', msg: `Cross flag failed for #${profile.id}: ${err.message}` });
    }
  }

  return { agent: 'auto_cross', findings, profiles_flagged: flagged };
}

// ═══════════════════════════════════════════════════════════════
// SUB-AGENT 6: Auto-Discover — Find potential relationships
// ═══════════════════════════════════════════════════════════════
async function autoDiscoverAgent(db) {
  const findings = [];
  let discovered = 0;

  if (!db.SocialProfileRelationship) {
    findings.push({ level: 'info', msg: 'Relationship model not available — skipping discovery' });
    return { agent: 'auto_discover', findings, relationships_discovered: 0 };
  }

  const { Op } = require('sequelize');

  const profiles = await db.SocialProfile.findAll({
    where: { status: { [Op.in]: ['generated', 'finalized', 'crossed'] } },
    attributes: ['id', 'handle', 'platform', 'archetype', 'content_category', 'geographic_cluster', 'follower_tier', 'known_associates'],
    raw: true,
  });

  const existingRels = await db.SocialProfileRelationship.findAll({
    attributes: ['source_profile_id', 'target_profile_id'], raw: true,
  });
  const relSet = new Set(existingRels.map(r => `${r.source_profile_id}-${r.target_profile_id}`));
  const hasRel = (a, b) => relSet.has(`${a}-${b}`) || relSet.has(`${b}-${a}`);

  findings.push({ level: 'info', msg: `Scanning ${profiles.length} profiles for undiscovered relationships` });

  // Find high-confidence matches (same niche + same platform + complementary archetypes)
  const tensions = [['polished_curator','messy_transparent'],['soft_life','explicitly_paid'],['overnight_rise','cautionary']];

  for (let i = 0; i < profiles.length && discovered < schedulerConfig.batch_size * 3; i++) {
    for (let j = i + 1; j < profiles.length && discovered < schedulerConfig.batch_size * 3; j++) {
      const a = profiles[i], b = profiles[j];
      if (hasRel(a.id, b.id)) continue;

      let score = 0;
      if (a.platform === b.platform) score += 1;
      if (a.content_category && a.content_category === b.content_category) score += 2;
      if (a.geographic_cluster && a.geographic_cluster === b.geographic_cluster) score += 2;
      for (const [x,y] of tensions) {
        if ((a.archetype===x&&b.archetype===y)||(a.archetype===y&&b.archetype===x)) { score += 3; break; }
      }

      if (score >= 5) {
        try {
          let relType = 'collab';
          if (a.content_category === b.content_category && a.follower_tier === b.follower_tier) relType = 'rival';

          await db.SocialProfileRelationship.create({
            source_profile_id: a.id,
            target_profile_id: b.id,
            relationship_type: relType,
            description: `Auto-discovered: shared ${a.content_category || 'niche'} on ${a.platform}`,
            auto_generated: true,
            direction: 'mutual',
            public_visibility: 'public',
            drama_level: 0,
          });
          discovered++;
          relSet.add(`${a.id}-${b.id}`);
          findings.push({ level: 'success', msg: `Discovered ${relType} between @${a.handle} and @${b.handle}` });
        } catch (err) {
          findings.push({ level: 'error', msg: `Discovery failed for ${a.id}-${b.id}: ${err.message}` });
        }
      }
    }
  }

  findings.push({ level: 'info', msg: `Discovered ${discovered} new relationships` });
  return { agent: 'auto_discover', findings, relationships_discovered: discovered };
}

// ═══════════════════════════════════════════════════════════════
// ORCHESTRATOR — Run all enabled sub-agents
// ═══════════════════════════════════════════════════════════════
async function runFullCycle(db) {
  const startTime = Date.now();
  const results = [];

  if (schedulerConfig.auto_fill_enabled) {
    results.push(await autoFillAgent(db));
  }
  if (schedulerConfig.auto_finalize_enabled) {
    results.push(await autoFinalizeAgent(db));
  }
  if (schedulerConfig.auto_relate_enabled) {
    results.push(await autoRelateAgent(db));
  }
  if (schedulerConfig.auto_follow_enabled) {
    results.push(await autoFollowAgent(db));
  }
  if (schedulerConfig.auto_cross_enabled) {
    results.push(await autoCrossAgent(db));
  }
  if (schedulerConfig.auto_discover_enabled) {
    results.push(await autoDiscoverAgent(db));
  }

  const allFindings = results.flatMap(r => r.findings.map(f => ({ ...f, agent: r.agent })));
  const duration = Date.now() - startTime;

  // Layer counts
  const realCount = await db.SocialProfile.count({ where: { feed_layer: 'real_world', lalaverse_cap_exempt: false } });
  const lalaCount = await db.SocialProfile.count({ where: { feed_layer: 'lalaverse', lalaverse_cap_exempt: false } });

  return {
    ran_at: new Date().toISOString(),
    duration_ms: duration,
    agents_run: results.map(r => r.agent),
    all_findings: allFindings,
    summary: {
      profiles_created:       results.find(r => r.agent === 'auto_fill')?.profiles_created || 0,
      profiles_finalized:     results.find(r => r.agent === 'auto_finalize')?.profiles_finalized || 0,
      relationships_created:  results.find(r => r.agent === 'auto_relate')?.relationships_created || 0,
      followers_updated:      results.find(r => r.agent === 'auto_follow')?.followers_updated || 0,
      profiles_flagged:       results.find(r => r.agent === 'auto_cross')?.profiles_flagged || 0,
      relationships_discovered: results.find(r => r.agent === 'auto_discover')?.relationships_discovered || 0,
    },
    layer_status: {
      real_world: { count: realCount, cap: FEED_CAPS.real_world, remaining: FEED_CAPS.real_world - realCount },
      lalaverse:  { count: lalaCount, cap: FEED_CAPS.lalaverse, remaining: FEED_CAPS.lalaverse - lalaCount },
    },
    errors: allFindings.filter(f => f.level === 'error').length,
    successes: allFindings.filter(f => f.level === 'success').length,
  };
}

// ═══════════════════════════════════════════════════════════════
// SCHEDULER — setInterval-based, following cfoAgent.js pattern
// ═══════════════════════════════════════════════════════════════
async function scheduledRun() {
  if (!_db) {
    console.error('[FeedScheduler] No database reference — skipping run');
    return;
  }
  if (isRunning) {
    console.log('[FeedScheduler] Previous cycle still running — skipping');
    return;
  }

  isRunning = true;
  emitSSE('cycle_start', { status: 'running', started_at: new Date().toISOString() });
  try {
    console.log('[FeedScheduler] ⏰ Scheduled cycle starting...');
    const report = await runFullCycle(_db);
    runHistory.push(report);
    if (runHistory.length > MAX_HISTORY) runHistory.shift();

    console.log(`[FeedScheduler] ✅ Cycle complete — ${report.summary.profiles_created} created | ${report.summary.profiles_finalized} finalized | ${report.summary.relationships_created} linked | ${report.duration_ms}ms`);
    emitSSE('cycle_complete', { summary: report.summary, duration_ms: report.duration_ms, errors: report.errors });

    if (report.errors > 0) {
      console.log(`[FeedScheduler] ⚠️ ${report.errors} errors during cycle`);
    }
  } catch (err) {
    console.error('[FeedScheduler] ❌ Scheduled cycle failed:', err.message);
    emitSSE('cycle_error', { error: err.message });
  } finally {
    isRunning = false;
    emitSSE('cycle_end', { is_running: false });
  }
}

function startScheduler(intervalHours, db) {
  if (db) _db = db;

  // Gate: only run scheduler when explicitly opted-in via env var.
  // Each cycle makes 10+ Claude API calls (~$30-50/cycle, 6 cycles/day).
  // Set FEED_SCHEDULER_ENABLED=true in production when you want auto-generation.
  if (process.env.FEED_SCHEDULER_ENABLED !== 'true') {
    console.log('[FeedScheduler] Scheduler disabled (set FEED_SCHEDULER_ENABLED=true to enable)');
    return;
  }

  if (schedulerTimer) clearInterval(schedulerTimer);
  if (initialTimeout) clearTimeout(initialTimeout);
  if (intervalHours) {
    schedulerConfig.interval_hours = intervalHours;
    schedulerIntervalMs = intervalHours * 60 * 60 * 1000;
  }
  schedulerConfig.enabled = true;
  schedulerTimer = setInterval(scheduledRun, schedulerIntervalMs);
  console.log(`[FeedScheduler] Scheduler started — running every ${schedulerConfig.interval_hours}h`);
  // First run after 15s delay (let server finish starting)
  initialTimeout = setTimeout(scheduledRun, 15000);
}

function stopScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
  if (initialTimeout) {
    clearTimeout(initialTimeout);
    initialTimeout = null;
  }
  schedulerConfig.enabled = false;
  console.log('[FeedScheduler] ⏹ Scheduler stopped');
}

function getSchedulerStatus() {
  return {
    running: schedulerTimer !== null,
    enabled: schedulerConfig.enabled,
    config: { ...schedulerConfig },
    interval_hours: schedulerConfig.interval_hours,
    history_count: runHistory.length,
    last_run: runHistory.length > 0 ? runHistory[runHistory.length - 1].ran_at : null,
    last_summary: runHistory.length > 0 ? runHistory[runHistory.length - 1].summary : null,
    next_run: schedulerTimer ? new Date(Date.now() + schedulerIntervalMs).toISOString() : null,
  };
}

function getHistory() {
  return runHistory.slice().reverse(); // newest first
}

/**
 * Manual trigger — run a single cycle immediately (for API use).
 */
async function runManualCycle(db) {
  const target = db || _db;
  if (!target) throw new Error('No database reference available');
  const report = await runFullCycle(target);
  runHistory.push(report);
  if (runHistory.length > MAX_HISTORY) runHistory.shift();
  return report;
}

module.exports = {
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
  getHistory,
  getConfig,
  updateConfig,
  runManualCycle,
  setDb,
  generateCreatorSpark,
  generateSmartSparks,
  generateAndSaveProfile,
  autoGenerateBatch,
  validateClaudeAccess,
  addSSEClient,
};
