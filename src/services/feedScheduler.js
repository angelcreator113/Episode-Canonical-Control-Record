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
 */

/* eslint-disable no-console */
const Anthropic = require('@anthropic-ai/sdk');

const {
  generateHandleFromCharacter,
  inferArchetypeFromRole,
  inferLalaRelationship,
  inferCareerPressure,
  inferFollowerTier,
} = require('../utils/feedProfileUtils');

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

let schedulerConfig = {
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
};

let schedulerTimer = null;
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
    findings.push({ level: 'info', msg: `${layer}: generating ${toCreate} profiles` });

    for (let i = 0; i < toCreate; i++) {
      try {
        const spark = generateCreatorSpark(layer);
        const profile = await generateAndSaveProfile(db, spark, layer);
        if (profile) {
          created++;
          findings.push({ level: 'success', msg: `Created @${profile.handle} (${layer})` });
        }
      } catch (err) {
        findings.push({ level: 'error', msg: `Fill failed: ${err.message}` });
      }
    }
  }

  return { agent: 'auto_fill', findings, profiles_created: created };
}

/**
 * Generate a creative spark for a new profile — the 3-field input the AI needs.
 */
function generateCreatorSpark(layer) {
  const platform = PLATFORMS[Math.floor(Math.random() * PLATFORMS.length)];
  const archetype = ARCHETYPES[Math.floor(Math.random() * ARCHETYPES.length)];
  const tier = FOLLOWER_TIERS[Math.floor(Math.random() * FOLLOWER_TIERS.length)];

  // Generate a realistic handle
  const prefixes = [
    'thee', 'just', 'real', 'its', 'not', 'lil', 'big', 'miss', 'king',
    'baby', 'that', 'your', 'her', 'his', 'the', 'im', 'idk',
  ];
  const roots = [
    'goddess', 'queen', 'bad', 'soft', 'pretty', 'rich', 'broke', 'tired',
    'healing', 'growing', 'vibing', 'toxic', 'blessed', 'messy', 'woke',
    'extra', 'basic', 'booked', 'busy', 'unbothered', 'chosen', 'built',
  ];
  const suffixes = [
    'era', 'szn', 'life', 'diaries', 'chronicles', 'files', 'club',
    'gang', 'society', 'world', 'page', 'official', 'tv', 'pod',
  ];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const root = roots[Math.floor(Math.random() * roots.length)];
  const suffix = Math.random() > 0.5
    ? suffixes[Math.floor(Math.random() * suffixes.length)]
    : String(Math.floor(Math.random() * 900) + 100);
  const handle = `@${prefix}${root}${suffix}`;

  // Vibe sentence templates
  const vibes = [
    `${tier} ${platform} creator. ${archetype.replace(/_/g, ' ')} energy. Posts like they have something to prove.`,
    `A ${tier}-tier ${archetype.replace(/_/g, ' ')} on ${platform}. Curates chaos and calls it content.`,
    `${platform} ${archetype.replace(/_/g, ' ')}. ${tier} following. The kind of creator you watch alone at night.`,
    `${tier} ${platform} presence. ${archetype.replace(/_/g, ' ')} archetype. Everyone in the comment section is projecting.`,
    `Rising ${platform} voice. ${archetype.replace(/_/g, ' ')}. The algorithm keeps pushing them and no one knows why.`,
    `${tier} creator on ${platform}. ${archetype.replace(/_/g, ' ')} coded. Their brand deals tell a story their content won't.`,
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

/**
 * Call Claude to generate a full profile from a spark, then save it.
 */
async function generateAndSaveProfile(db, spark, layer) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Build the generation prompt (importing the shared builder)
  const { buildGenerationPrompt } = require('../routes/socialProfileRoutes');

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

  let prompt = buildGenerationPrompt(
    spark.handle, spark.platform, spark.vibe_sentence,
    characterContext, null,
  );

  if (layer === 'lalaverse' && spark.city) {
    prompt += `\n\nLALAVERSE CONTEXT:
This creator lives in ${spark.city.replace(/_/g, ' ')} — ${CITY_CULTURE[spark.city] || ''}
Generate a profile that feels native to that city's creator culture.
Lala's relationship to this creator: ${spark.lala_relationship || 'mutual_unaware'}.
Career position relative to Lala: ${spark.career_pressure || 'level'}.
Do not reference JustAWoman or the real world in any generated content.
Lala does not know she was built. The world she lives in feels complete and self-contained.`;
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
    throw new Error('AI response failed to parse as JSON');
  }

  const profile = await db.SocialProfile.create({
    series_id:             null,
    handle:                spark.handle.startsWith('@') ? spark.handle : `@${spark.handle}`,
    platform:              spark.platform,
    vibe_sentence:         spark.vibe_sentence,
    status:                'generated',
    generation_model:      'claude-sonnet-4-20250514',
    full_profile:          generated,
    display_name:          generated.display_name,
    follower_tier:         generated.follower_tier || spark.follower_tier,
    follower_count_approx: generated.follower_count_approx,
    content_category:      generated.content_category,
    archetype:             generated.archetype || spark.archetype,
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
    feed_layer:            layer,
    city:                  layer === 'lalaverse' ? (spark.city || null) : null,
    lala_relationship:     layer === 'lalaverse' ? (spark.lala_relationship || 'mutual_unaware') : null,
    career_pressure:       layer === 'lalaverse' ? (spark.career_pressure || 'level') : null,
    is_justawoman_record:  false,
    lalaverse_cap_exempt:  false,
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
      await profile.update({ current_trajectory: 'crossing_ready' });
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

  try {
    console.log('[FeedScheduler] ⏰ Scheduled cycle starting...');
    const report = await runFullCycle(_db);
    runHistory.push(report);
    if (runHistory.length > MAX_HISTORY) runHistory.shift();

    console.log(`[FeedScheduler] ✅ Cycle complete — ${report.summary.profiles_created} created | ${report.summary.profiles_finalized} finalized | ${report.summary.relationships_created} linked | ${report.duration_ms}ms`);

    if (report.errors > 0) {
      console.log(`[FeedScheduler] ⚠️ ${report.errors} errors during cycle`);
    }
  } catch (err) {
    console.error('[FeedScheduler] ❌ Scheduled cycle failed:', err.message);
  }
}

function startScheduler(intervalHours, db) {
  if (db) _db = db;
  if (schedulerTimer) clearInterval(schedulerTimer);
  if (intervalHours) {
    schedulerConfig.interval_hours = intervalHours;
    schedulerIntervalMs = intervalHours * 60 * 60 * 1000;
  }
  schedulerConfig.enabled = true;
  schedulerTimer = setInterval(scheduledRun, schedulerIntervalMs);
  console.log(`[FeedScheduler] 🕐 Scheduler started — running every ${schedulerConfig.interval_hours}h`);
  // First run after 15s delay (let server finish starting)
  setTimeout(scheduledRun, 15000);
}

function stopScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    schedulerConfig.enabled = false;
    console.log('[FeedScheduler] ⏹ Scheduler stopped');
  }
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
  generateAndSaveProfile,
};
