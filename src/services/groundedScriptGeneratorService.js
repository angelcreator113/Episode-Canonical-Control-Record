'use strict';

/**
 * Grounded Script Generator Service
 *
 * Generates episode scripts that sound like JAWIHP wrote them.
 * Assembles 6 data sources into one Claude call with locked voice DNA.
 */

const Anthropic = require('@anthropic-ai/sdk');
const { latestWorldSnapshotForShow } = require('./worldSnapshotForShow');

let client = null;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const JAWIHP_VOICE_DNA = `
JAWIHP (JustAWomanInHerPrime) voice rules — NEVER VIOLATE:
- Addresses the audience as "besties"
- Warm, hype-woman energy — celebrates everything
- Narrates what she's clicking/doing in real time
- Reacts naturally ("oh wow these are nice!!")
- Breaks fourth wall ("I can't believe it you guys")
- Drives all decisions — she chooses outfits, clicks icons, opens letters
- Uses casual grammar naturally ("Girl brunch!", "I know that's right")
- Community-building language ("put a dollar emoji in the comments")
- Never robotic, never formal, never generic AI narrator

LALA voice rules — NEVER VIOLATE:
- Always calls people "bestie"
- Short, punchy, confident lines
- Self-aware about her attractiveness and status
- Loyal and girls-girl ("If she can't go. It's a no for me")
- Slightly dramatic but always positive
- Examples: "Bestie, I love my photos.", "I'm a baddie in these internet streets.", "Bestie, this purse is everything!"
`.trim();

// The 14 beats come from canonicalBeats.js (§8(j); the §8(g) "owed" local
// list, episode creation step 7): name and screen action are canonical.
// Who speaks in each beat is this writer's own direction, kept here.
const { CANONICAL_BEATS } = require('../constants/canonicalBeats');
const { beatHeader } = require('../utils/canonicalScriptBeats');
const SPEAKS = {
  1: [true, false], 2: [true, true], 3: [true, false], 4: [true, true], 5: [true, true],
  6: [true, true], 7: [true, true], 8: [true, true], 9: [true, false], 10: [true, false],
  11: [true, true], 12: [false, true], 13: [true, false], 14: [true, false],
};
const BEAT_TEMPLATES = Object.fromEntries(CANONICAL_BEATS.map((b) => [b.number, {
  name: b.name, ui: b.screen_action, jawihp: SPEAKS[b.number][0], lala: SPEAKS[b.number][1],
}]));

// What the grounded prompt reads for an episode: brief, scene plan, franchise laws,
// event, wardrobe, Lala's state and season, read the same way for the whole
// script and for one beat.
async function groundedScriptInputs(episodeId, showId, models) {
  const { EpisodeBrief, ScenePlan, SceneSet, FranchiseKnowledge, sequelize } = models;

  // 1. Load Episode Brief
  const brief = await EpisodeBrief.findOne({ where: { episode_id: episodeId } }).catch(() => null);

  // 2. Load Scene Plan with scene context
  const scenePlan = await ScenePlan.findAll({
    where: { episode_id: episodeId, deleted_at: null },
    order: [['beat_number', 'ASC']],
    include: [{
      model: SceneSet, as: 'sceneSet',
      attributes: ['name', 'scene_type', 'script_context', 'canonical_description', 'world_location_id'],
      required: false,
      include: models.WorldLocation ? [{
        model: models.WorldLocation, as: 'worldLocation',
        attributes: ['narrative_role', 'sensory_details'],
        required: false,
      }] : [],
    }],
  }).catch(() => []);

  // 3. Show Brain rules: the same deterministic selection the episode
  //    script writer records (services/brainRules.js, 2026-10-04).
  let franchiseLaws = [];
  if (FranchiseKnowledge) {
    const { selectInjectedRules } = require('./brainRules');
    franchiseLaws = await selectInjectedRules(FranchiseKnowledge, { showId })
      .then((s) => s.rules)
      .catch((rulesErr) => { console.error('[GroundedScript] Brain rules selection failed:', rulesErr.message); return []; });
  }

  // 4. Load Event data
  let eventData = null;
  try {
    const [rows] = await sequelize.query(
      `SELECT * FROM world_events WHERE used_in_episode_id = :episodeId LIMIT 1`,
      { replacements: { episodeId } }
    );
    eventData = rows?.[0] || null;
  } catch { /* non-blocking */ }

  // 5. Load Wardrobe
  // #1883: this read WardrobeLibrary, which declares none of is_owned, slot,
  // tier, aesthetic_tags or lala_reaction_equipped (production's
  // wardrobe_library lacks is_owned, slot and lala_reaction_equipped), so it
  // failed on every call and the catch swallowed it: every script was built
  // with "Wardrobe not loaded". Lala's owned items live on Wardrobe, which
  // declares is_owned, tier and aesthetic_tags; its slot is clothing_category
  // (as the outfit query in 5b reads it). lala_reaction_equipped exists
  // nowhere and is dropped.
  let wardrobeItems = [];
  try {
    const { Wardrobe } = models;
    if (Wardrobe) {
      wardrobeItems = await Wardrobe.findAll({
        where: { is_owned: true, deleted_at: null },
        attributes: ['name', 'clothing_category', 'tier', 'aesthetic_tags'],
        limit: 40,
      });
    }
  } catch (err) {
    console.error('[ScriptGen] wardrobe query error:', err?.message);
  }

  // 5b. Load outfit synergy score for this episode
  let outfitScore = null;
  try {
    const [scoreRows] = await sequelize.query(
      `SELECT w.name, w.clothing_category, w.tier, w.aesthetic_tags
       FROM episode_wardrobe ew
       JOIN wardrobe w ON w.id = ew.wardrobe_id AND w.deleted_at IS NULL
       WHERE ew.episode_id = :episodeId AND ew.deleted_at IS NULL`,
      { replacements: { episodeId } }
    );
    if (scoreRows.length > 0) {
      outfitScore = { items: scoreRows, count: scoreRows.length };
    }
  } catch { /* non-blocking */ }

  // 6. Load Lala's stats
  // The newest snapshot of the show's universe (or of none); the old
  // show_id query named a column the table does not have.
  const lalaStats = await latestWorldSnapshotForShow(sequelize, showId);

  // 7. This episode's season position (§8(ff) A5), snapshotted at Start Episode
  let seasonContext = null;
  try {
    const [rows] = await sequelize.query(
      'SELECT season_context FROM episodes WHERE id = :episodeId AND deleted_at IS NULL',
      { replacements: { episodeId } }
    );
    const sc = rows?.[0]?.season_context;
    seasonContext = (typeof sc === 'string' ? JSON.parse(sc) : sc) || null;
  } catch (err) {
    console.error('[ScriptGen] season context failed (non-blocking):', err.message);
  }

  console.log(`[ScriptGen] Prompt for episode ${episodeId} with ${scenePlan.length} planned beats`);
  return { brief, scenePlan, franchiseLaws, eventData, wardrobeItems, lalaStats, outfitScore, seasonContext };
}

const MODELS = ['claude-sonnet-4-6'];

// A Sonnet call. The whole script tries once, as it always has (a second
// 8000-token try doubles a wait that already runs long); one beat tries
// twice, the retry the AI routes use.
async function writeWith(prompt, maxTokens, attempts) {
  let lastErr = null;
  for (const model of MODELS) {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const response = await getClient().messages.create({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] });
        return response.content[0]?.text || '';
      } catch (err) {
        lastErr = err;
        console.error(`[ScriptGen] ${model} attempt ${attempt} failed:`, err.message);
      }
    }
  }
  throw lastErr;
}

async function generateGroundedScript(episodeId, showId, models) {
  const prompt = buildScriptPrompt(await groundedScriptInputs(episodeId, showId, models));
  return writeWith(prompt, 8000, 1);
}

// One beat's text from the writer's reply: the section under the beat's own
// header, or the whole reply under that header when the header did not come
// back. The header is always the canonical one. null when nothing came back.
function beatFromReply(reply, beatNumber) {
  const canon = CANONICAL_BEATS.find((b) => b.number === beatNumber);
  if (!canon) return null;
  const { splitScriptBeats } = require('../utils/scriptBeatLocks');
  const split = splitScriptBeats(String(reply || '').trim());
  const own = split.beats.find((b) => b.number === beatNumber);
  const body = own
    ? own.text.split('\n').slice(1).join('\n')
    : [split.preamble, ...split.beats.map((b) => b.text.split('\n').slice(1).join('\n'))].join('\n');
  const lines = body.split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim());
  if (!lines.length) return null;
  return [beatHeader(canon), ...lines].join('\n');
}

// Evoni, 2026-10-09 (Task #2785): regenerate one beat, not the whole script.
// The grounded prompt, the script as it stands, and the one beat to write
// again; the reply is that beat, header first.
async function generateGroundedBeat(episodeId, showId, models, { beatNumber, currentScript }) {
  const canon = CANONICAL_BEATS.find((b) => b.number === beatNumber);
  if (!canon) throw new Error(`No canonical beat ${beatNumber}`);
  const prompt = buildScriptPrompt(await groundedScriptInputs(episodeId, showId, models), {
    only: { beat: canon, currentScript: String(currentScript || '') },
  });
  return beatFromReply(await writeWith(prompt, 1500, 2), beatNumber);
}

// A10: every season story purpose, primary first, each with its thread.
function seasonPurposeLines(sc) {
  // A purpose may name only a thread; it then reads as continuing that thread.
  const list = (Array.isArray(sc?.story_purposes) ? sc.story_purposes : [])
    .filter((p) => p && (p.text || p.story_thread))
    .map((p) => (p.text ? p : { ...p, text: `Continue the thread "${p.story_thread}"`, story_thread: null }));
  const purposes = list.length
    ? [...list.filter((p) => p.primary), ...list.filter((p) => !p.primary)]
    : (sc?.story_purpose ? [{ text: sc.story_purpose, primary: true, story_thread: sc.story_thread || null }] : []);
  if (!purposes.length) return 'Season story purpose: Not set';
  if (purposes.length === 1) return `Season story purpose: ${purposes[0].text}`;
  return ['Season story purposes (primary first):',
    ...purposes.map((p, n) => `${n + 1}. ${p.primary ? '[Primary] ' : ''}${p.text}${p.story_thread ? ` (thread: ${p.story_thread})` : ''}`)].join('\n');
}

function buildScriptPrompt({ brief, scenePlan, franchiseLaws, eventData, wardrobeItems, lalaStats, outfitScore, seasonContext = null }, { only = null } = {}) {
  // Every canonical beat, in order, whether or not the plan has its row
  // (§8(j): Generate Script instantiates all 14; it never invents its own).
  const planByBeat = new Map(scenePlan.map((b) => [Number(b.beat_number), b]));
  const beatContext = CANONICAL_BEATS.map((canon) => {
        const b = planByBeat.get(canon.number) || {};
        const tpl = BEAT_TEMPLATES[canon.number];
        const loc = b.sceneSet?.worldLocation;
        let entry = `${beatHeader(canon)}
  Purpose: ${canon.narrative_purpose}
  Location: ${b.sceneSet?.name || 'Not planned yet'}${b.sceneSet?.scene_type ? ` (${b.sceneSet.scene_type})` : ''}
  Angle: ${b.angle_label || ''} | Shot: ${b.shot_type || ''}
  Scene context: ${b.scene_context || b.sceneSet?.script_context || 'No description'}
  Emotional intent: ${b.emotional_intent || canon.emotional_intent || ''}
  Director note: ${b.director_note || ''}
  UI action: ${tpl.ui || ''}
  JAWIHP speaks: ${tpl.jawihp} | Lala speaks: ${tpl.lala}`;
        if (loc?.narrative_role) entry += `\n  Narrative role: ${loc.narrative_role}`;
        if (loc?.sensory_details?.atmosphere) entry += `\n  Atmosphere: ${loc.sensory_details.atmosphere}`;
        return entry;
      }).join('\n\n');

  const wardrobeBySlot = {};
  wardrobeItems.forEach(item => {
    const d = item.toJSON ? item.toJSON() : item;
    const slot = d.clothing_category || 'other';
    if (!wardrobeBySlot[slot]) wardrobeBySlot[slot] = [];
    wardrobeBySlot[slot].push(d.name);
  });
  const wardrobeContext = Object.entries(wardrobeBySlot)
    .map(([slot, items]) => `${slot}: ${items.slice(0, 3).join(', ')}`)
    .join('\n') || 'Wardrobe not loaded';

  let eventContext;
  if (eventData) {
    eventContext = `Event: ${eventData.name}\nPrestige: ${eventData.prestige}/10\nDress code: ${eventData.dress_code || 'Not specified'}\nCost: ${eventData.cost_coins} coins\nNarrative stakes: ${eventData.narrative_stakes || ''}`;
    if (eventData.invitation_asset_id) {
      eventContext += '\nInvitation: GENERATED — use in Beat 5 (Reveal). JAWIHP opens the mail and reads the invitation aloud. The InviteLetterOverlay should float up on screen.';
    }
    // Outcomes — creator-authored narrative threads this event opens. The
    // Rewards editor in WorldAdmin populates rewards.outcomes (one per line).
    // Surfacing them here gives the writer concrete success-state hooks to
    // weave into the back half of the episode (Beats 9-13: Result/Aftermath)
    // without inventing them on its own. Lenient parse handles JSON-string
    // legacy rows.
    const rewardsObj = (typeof eventData.rewards === 'string'
      ? (() => { try { return JSON.parse(eventData.rewards || '{}'); } catch { return {}; } })()
      : (eventData.rewards || {}));
    const outcomes = Array.isArray(rewardsObj.outcomes) ? rewardsObj.outcomes.filter(Boolean) : [];
    if (outcomes.length > 0) {
      eventContext += `\nIf this episode lands SLAY or PASS, these threads should be visibly opened in the back half (Beats 9-13). Reference them through dialogue, reactions, or a closing tag — not exposition:\n${outcomes.map(o => `  • ${o}`).join('\n')}`;
    }
  } else {
    eventContext = 'No event assigned';
  }

  const statsContext = lalaStats?.character_states
    ? JSON.stringify(lalaStats.character_states).slice(0, 200)
    : 'Stats not loaded';

  // Group Show Brain laws by category for structured injection
  const lawsByCategory = {};
  for (const l of franchiseLaws) {
    const cat = l.category || 'general';
    if (!lawsByCategory[cat]) lawsByCategory[cat] = [];
    try {
      const c = JSON.parse(l.content);
      lawsByCategory[cat].push(`${l.title}: ${c.summary || c.rule || c.description || ''}`);
    } catch {
      lawsByCategory[cat].push(l.title);
    }
  }
  const voiceLaws = Object.entries(lawsByCategory).map(([cat, rules]) =>
    `[${cat.replace(/_/g, ' ').toUpperCase()}]\n${rules.join('\n')}`
  ).join('\n\n') || 'No Show Brain laws loaded';

  return `You are writing a script for "Styling Adventures with Lala" — Episode ${brief?.position_in_arc || '?'} of Arc ${brief?.arc_number || '?'}.

${JAWIHP_VOICE_DNA}

═══ SHOW BRAIN ═══
${voiceLaws}

CORE LAW: The show must NEVER feel like a dashboard. It must feel like a luxury life simulator.

═══ EPISODE CONTEXT ═══
Arc: ${brief?.arc_number || '?'}, Position: ${brief?.position_in_arc || '?'}/8
Archetype: ${brief?.episode_archetype || 'Rising'}
Designed intent: ${brief?.designed_intent || 'pass'}
Narrative purpose: ${brief?.narrative_purpose || 'Not set'}
Forward hook: ${brief?.forward_hook || 'Not set'}
${seasonContext?.label ? `Season position: ${seasonContext.label}${seasonContext.phase?.title ? `, Phase ${seasonContext.phase.number}: ${seasonContext.phase.title}` : ''}
${seasonPurposeLines(seasonContext)}
` : ''}
═══ EVENT ═══
${eventContext}

═══ LALA'S STATE ═══
${statsContext}

═══ WARDROBE ═══
${wardrobeContext}
${outfitScore ? `\n═══ LOCKED OUTFIT ═══\nLala is wearing ${outfitScore.count} pieces for this event:\n${outfitScore.items.map(i => `- ${i.name} (${i.clothing_category}, ${i.tier})`).join('\n')}\nBeat 8 (Transformation): Reference these SPECIFIC items by name as Lala gets dressed.\nBeat 11 (Event Outcome): Her outfit choice affects how the event goes — she is wearing what she chose.` : ''}

═══ SCENE PLAN — 14 BEATS ═══
${beatContext}

═══ FORMAT ═══
Each of the 14 beats opens with its header line, exactly as written above, in order from 1 to 14:
${beatHeader(CANONICAL_BEATS[0])}
...
${beatHeader(CANONICAL_BEATS[CANONICAL_BEATS.length - 1])}
Do not add, merge, rename or skip beats. Under each header:
Me: [JAWIHP dialogue]
(Action description)
Lala: [Lala dialogue]
[STAT: coins +X]
[TRANSITION: description]

RULES:
1. Beat 8 MUST reference specific wardrobe items by name
2. JAWIHP reacts to everything in real time
3. Lala's lines are ALWAYS short and punchy — max 2-3 sentences
4. Community engagement: ask audience to react in comments at least twice
5. Stats only appear as [STAT:] tags
6. End with a forward hook seeding the next episode

${only ? `═══ THE SCRIPT AS IT STANDS ═══
${only.currentScript.trim() || '(empty)'}

═══ THIS TASK ═══
Write ONLY beat ${only.beat.number} again, keeping it consistent with the beats before and after it as they stand above and not repeating what they already say. Start with its header line, exactly:
${beatHeader(only.beat)}
Return only that beat. No other beats, no preamble.` : 'Write the complete 14-beat script now. No preamble — just the script.'}`;
}

module.exports = { generateGroundedScript, generateGroundedBeat, buildScriptPrompt, beatFromReply };
