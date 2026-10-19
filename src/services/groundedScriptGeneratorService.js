'use strict';

/**
 * Grounded Script Generator Service
 *
 * Generates episode scripts that sound like JAWIHP wrote them.
 * Assembles 6 data sources into one Claude call with locked voice DNA.
 */

const Anthropic = require('@anthropic-ai/sdk');
const { latestWorldSnapshotForShow } = require('./worldSnapshotForShow');
const { careerBlock } = require('./scriptCareerService');
const { beat14Outcome } = require('../utils/beat14Invitation');

let client = null;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const JAWIHP_VOICE_DNA = `
JAWIHP (JustAWomanInHerPrime) voice rules — NEVER VIOLATE:
- Addresses the audience as "besties" (or "chat")
- Warm, hype-woman energy, and varied: she celebrates, doubts, jokes, side-eyes and goes quiet
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
  11: [true, true], 12: [true, true], 13: [true, true], 14: [true, false],
};
// Beat 12, The Fashion Challenge (Evoni, 2026-10-18): JustAWoman styles
// and reacts from her corner, so she speaks there too.
// Beat 13: Lala says how the outcome feels (Evoni, 2026-10-17); the numbers
// stay on the stat card, which she does not see.
// The back half by the canonical beats' own names (Script page audit,
// 2026-10-19: the prompt still said "Beats 9-13: Result/Aftermath").
const BACK_HALF = `Beats 9-13: ${CANONICAL_BEATS.filter((b) => b.number >= 9 && b.number <= 13).map((b) => b.name).join(', ')}`;
const RECAP_NUMBER = (CANONICAL_BEATS.find((b) => /recap/i.test(b.name)) || { number: 13 }).number;
const BEAT_TEMPLATES = Object.fromEntries(CANONICAL_BEATS.map((b) => [b.number, {
  name: b.name, ui: b.screen_action, jawihp: SPEAKS[b.number][0], lala: SPEAKS[b.number][1],
}]));

// What the grounded prompt reads for an episode: brief, scene plan, franchise laws,
// event, wardrobe, Lala's state and season, read the same way for the whole
// script and for one beat.
async function groundedScriptInputs(episodeId, showId, models) {
  const { EpisodeBrief, ScenePlan, SceneSet, FranchiseKnowledge, sequelize } = models;

  // What the Script Writer page's writer reads (Evoni, 2026-10-15: "when a
  // script is being generated what information is it using?"): her career
  // at the event (deal, deliverables, goals), her money, who is at the
  // event, the content she must make, the previous episode, the arc and her
  // stats. One loader for both writers (episodeScriptWriterService
  // .loadScriptContext), so they read the same facts. Read first (Script tab
  // re-audit, 2026-10-15): the Show Brain rules, the event, the world
  // snapshot and the locked look it holds are not read a second time below.
  // A failed read leaves the script to the reads below.
  let story = null;
  try {
    const { loadScriptContext } = require('./episodeScriptWriterService');
    story = await loadScriptContext(episodeId, showId, models, { lite: true });
  } catch (err) {
    console.error('[ScriptGen] story context failed (non-blocking):', err.message);
  }

  // 1. Load Episode Brief
  // Every failed read here is logged (Script page audit, 2026-10-19).
  const brief = await EpisodeBrief.findOne({ where: { episode_id: episodeId } }).catch((err) => {
    console.error('[ScriptGen] brief read failed (non-blocking):', err.message);
    return null;
  });

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
  }).catch((err) => {
    console.error('[ScriptGen] scene plan read failed (non-blocking):', err.message);
    return [];
  });

  // 3. Show Brain rules: the same deterministic selection the episode
  //    script writer records (services/brainRules.js, 2026-10-04).
  let franchiseLaws = story ? (story.franchiseLaws || []) : [];
  if (!story && FranchiseKnowledge) {
    const { selectInjectedRules } = require('./brainRules');
    franchiseLaws = await selectInjectedRules(FranchiseKnowledge, { showId })
      .then((s) => s.rules)
      .catch((rulesErr) => { console.error('[GroundedScript] Brain rules selection failed:', rulesErr.message); return []; });
  }

  // 4. Load Event data: the episode's event (utils/episodeEventSql; Task #1917)
  let eventData = story?.event || null;
  if (!eventData) {
    try {
      const [rows] = await sequelize.query(
        `SELECT * FROM world_events WHERE id = ${require('../utils/episodeEventSql').EPISODE_EVENT_ID_SQL}`,
        { replacements: { episodeId } }
      );
      eventData = rows?.[0] || null;
    } catch (err) { console.error('[ScriptGen] event read failed (non-blocking):', err.message); }
  }

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
  // The locked look as the Script tab and the Script Writer read it
  // (approved pieces, no attachments), when the story read found one; else
  // every piece on the episode.
  let outfitScore = Array.isArray(story?.wardrobe) && story.wardrobe.length
    ? { items: story.wardrobe, count: story.wardrobe.length } : null;
  if (!outfitScore) try {
    const [scoreRows] = await sequelize.query(
      `SELECT w.id, w.name, w.clothing_category, w.tier, w.aesthetic_tags
       FROM episode_wardrobe ew
       JOIN wardrobe w ON w.id = ew.wardrobe_id AND w.deleted_at IS NULL
       WHERE ew.episode_id = :episodeId AND ew.deleted_at IS NULL`,
      { replacements: { episodeId } }
    );
    if (scoreRows.length > 0) {
      outfitScore = { items: scoreRows, count: scoreRows.length };
    }
  } catch (err) {
    console.error('[ScriptGen] episode outfit read failed (non-blocking):', err.message);
  }

  // 6. Load Lala's stats
  // The newest snapshot of the show's universe (or of none); the old
  // show_id query named a column the table does not have.
  const lalaStats = story ? (story.worldState ?? null) : await latestWorldSnapshotForShow(sequelize, showId);
  // The world facts and the latest world temperature (services/worldNow, 2026-10-18).
  const worldNow = story ? (story.worldNow || '') : await require('./worldNow').worldNowForShow(sequelize, showId, lalaStats);

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

  // What can be on screen (Script tab audit, 2026-10-15): the show's phone
  // screens, icons and overlays by name, so the script's [UI:] lines name
  // things the Script tab can find. getAllOverlayTypes logs and returns []
  // on a failed read.
  const { getAllOverlayTypes } = require('./uiOverlayService');
  const onScreen = showId ? await getAllOverlayTypes(showId, models) : [];
  // The phone's map (script phone paths, 2026-10-16): each screen's icons and
  // what they open, as the Script tab's phone check reads it, for the prompt
  // and for the steps added after writing. A failed read leaves both out.
  let phone = null;
  if (showId) {
    try {
      const { overlayStatusForShow } = require('./phoneOverlays');
      const { phoneFromOverlays } = require('../utils/phonePaths');
      phone = phoneFromOverlays(await overlayStatusForShow(models, showId, episodeId));
    } catch (err) {
      console.error('[ScriptGen] phone map failed (non-blocking):', err.message);
    }
  }

  // Lala's coins and the approved shopping list (Evoni, 2026-10-18;
  // scriptMoneyContext): the balance before the episode, each piece's cost,
  // the recap's costs. A failed read leaves the script without them.
  let money = null;
  if (showId) {
    try {
      money = await require('./scriptMoneyContext').loadScriptMoney(models.sequelize, { showId, episodeId, event: eventData });
    } catch (err) {
      console.error('[ScriptGen] money read failed (non-blocking):', err.message);
    }
  }

  // Beat 14's opportunity (Evoni, 2026-10-19; services/beat14Opportunity):
  // the invitation someone at the event offers. A failed read leaves it out.
  let beat14 = null;
  try {
    beat14 = await require('./beat14Opportunity').loadForScript(models, { episodeId });
  } catch (err) {
    console.error('[ScriptGen] beat 14 opportunity read failed (non-blocking):', err.message);
  }

  console.log(`[ScriptGen] Prompt for episode ${episodeId} with ${scenePlan.length} planned beats`);
  return { brief, scenePlan, franchiseLaws, eventData, wardrobeItems, lalaStats, outfitScore, seasonContext, onScreen, story, phone, worldNow, money, beat14 };
}

const MODELS = ['claude-sonnet-4-6'];

const isBudgetOrRateLimit = (err) => err?.code === 'AI_BUDGET_EXCEEDED' || err?.status === 429;

// A Sonnet call: { text, cut }. The whole script tries once, as it always
// has (a second 8000-token try doubles a wait that already runs long); one
// beat tries twice, the retry the AI routes use. `cut` is a reply stopped at
// its token limit, so its last beat may be half written.
async function writeWith(prompt, maxTokens, attempts) {
  let lastErr = null;
  for (const model of MODELS) {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const response = await getClient().messages.create({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] });
        const cut = response.stop_reason === 'max_tokens';
        if (cut) console.warn(`[ScriptGen] ${model} reply hit its ${maxTokens}-token limit`);
        return { text: response.content[0]?.text || '', cut };
      } catch (err) {
        lastErr = err;
        console.error(`[ScriptGen] ${model} attempt ${attempt} failed:`, err.message);
        // A refused budget or a rate limit is not tried again (Script page
        // audit, 2026-10-19): the route answers it as a 429.
        if (isBudgetOrRateLimit(err)) throw err;
      }
    }
  }
  throw lastErr;
}

// `lockedBeats`: the approved beats, [{ number, text }]. The writer reads
// them and writes the other beats around them; the route puts each one back
// word for word (utils/scriptBeatLocks.js).
//
// Then the coverage check (utils/scriptCoverage.js; Evoni, 2026-10-15: "is
// it making sure everything is being done within the script?"): what the
// episode needs that the script does not have (a deliverable, a goal, the
// hook, a wear cue, a phone moment, a beat that did not come back) is
// written into its beat in one pass, each such beat once, never an
// approved one. Returns { script, coverage: { missing, fixed_beats }, facts }.
//
// Script tab re-audit (2026-10-15):
// - a first draft with fewer than MIN_DRAFT_BEATS of the 14 beats (a
//   refusal, an empty reply) is not a script: it throws DRAFT_INCOMPLETE
//   before any fix is paid for, and nothing is saved;
// - the fix pass writes the beats that did not come back first (a reply
//   cut off at its limit loses the outcome, deliverable and hook beats),
//   then the half-written last beat of a cut reply, then the hook,
//   deliverables, goals, wear cues, phone moments;
// - a fix goes in only when it leaves the script missing less than before,
//   so a reply that is not the beat never replaces one that was.
const MAX_FIX_BEATS = 5;
const MIN_DRAFT_BEATS = CANONICAL_BEATS.length - MAX_FIX_BEATS;
const GAP_RANK = { beat: 0, cut: 1, hook: 2, opportunity: 2, deliverable: 3, goal: 4, wear: 5, phone: 6 };

class DraftIncompleteError extends Error {
  constructor(found) {
    super(`The writer sent back ${found} of the ${CANONICAL_BEATS.length} beats, too few to finish; nothing was saved. Try again.`);
    this.code = 'DRAFT_INCOMPLETE';
    this.found = found;
  }
}

async function generateGroundedScript(episodeId, showId, models, { lockedBeats = [] } = {}) {
  const inputs = await groundedScriptInputs(episodeId, showId, models);
  const draft = await writeWith(buildScriptPrompt(inputs, { lockedBeats }), 8000, 1);
  let script = draft.text;
  const facts = coverageFacts(inputs);
  const locked = new Set(lockedBeats.map((b) => b.number));
  const { scriptCoverage, beatRequirements, replaceBeatByNumber, insertBeatByNumber } = require('../utils/scriptCoverage');
  const { splitScriptBeats, withoutExtraCopies } = require('../utils/scriptBeatLocks');

  const drafted = splitScriptBeats(script).beats.map((b) => b.number);
  const isCanon = (n) => CANONICAL_BEATS.some((c) => c.number === n);
  const found = new Set([...drafted, ...locked].filter(isCanon)).size;
  // Approved beats count toward the 14, but a reply with none of the
  // unapproved beats is not a draft either (re-audit 2, 2026-10-15: with 9
  // approved, a refusal passed and was saved at the top of the script).
  const wrote = drafted.filter((n) => isCanon(n) && !locked.has(n)).length;
  if (found < MIN_DRAFT_BEATS || (wrote === 0 && locked.size < CANONICAL_BEATS.length)) {
    console.error(`[ScriptGen] Episode ${episodeId}: first draft has ${found} of ${CANONICAL_BEATS.length} beats${draft.cut ? ' (cut off)' : ''}; not saved`);
    throw new DraftIncompleteError(found);
  }
  // Approved beats are read as approved (the route puts them back word for
  // word anyway), so what they already cover is not written twice. A reply
  // that drafts an approved beat twice keeps only as many copies as are
  // approved (Script page audit, 2026-10-19: the second was saved as an
  // extra beat).
  const approvedCopies = new Map();
  for (const b of lockedBeats) approvedCopies.set(b.number, (approvedCopies.get(b.number) || 0) + 1);
  script = withoutExtraCopies(script, approvedCopies);
  for (const b of lockedBeats) {
    const withIt = replaceBeatByNumber(script, b.number, b.text);
    script = withIt !== script ? withIt : insertBeatByNumber(script, b.number, b.text);
  }

  const byBeat = new Map();
  const gapAt = (n, gap) => { if (!byBeat.has(n)) byBeat.set(n, []); byBeat.get(n).push(gap); };
  for (const gap of scriptCoverage(script, facts).missing) {
    if (!locked.has(gap.target)) gapAt(gap.target, gap);
  }
  // A cut reply's last beat stopped mid-line.
  const lastDrafted = drafted[drafted.length - 1];
  if (draft.cut && lastDrafted && !locked.has(lastDrafted)) gapAt(lastDrafted, { kind: 'cut', target: lastDrafted });
  const rank = (n) => Math.min(...byBeat.get(n).map((g) => GAP_RANK[g.kind] ?? 9));
  const targets = [...byBeat.keys()].sort((a, b) => rank(a) - rank(b) || a - b).slice(0, MAX_FIX_BEATS);
  const written = await Promise.allSettled(targets.map(async (n) => {
    const canon = CANONICAL_BEATS.find((b) => b.number === n);
    const prompt = buildScriptPrompt(inputs, {
      only: { beat: canon, currentScript: script, requirements: beatRequirements(byBeat.get(n)) },
    });
    return { n, text: beatFromReply((await writeWith(prompt, 1500, 2)).text, n) };
  }));
  const fixedBeats = [];
  const gapsIn = (s) => scriptCoverage(s, facts).missing.length;
  for (const r of written) {
    if (r.status !== 'fulfilled') { console.error('[ScriptGen] coverage fix failed (non-blocking):', r.reason?.message); continue; }
    const { n, text } = r.value;
    if (!text) continue;
    const isMissing = byBeat.get(n).some((g) => g.kind === 'beat');
    const next = isMissing ? insertBeatByNumber(script, n, text) : replaceBeatByNumber(script, n, text);
    if (next === script) continue;
    // A beat that did not come back, or the half-written last one, always
    // goes in (re-audit 2: a missing phone beat without its [UI:] line left
    // as many gaps as before, and was thrown away).
    const isCut = byBeat.get(n).some((g) => g.kind === 'cut');
    if (!isMissing && !isCut && gapsIn(next) >= gapsIn(script)) {
      console.warn(`[ScriptGen] Episode ${episodeId}: the rewrite of beat ${n} covered nothing more; the beat stays as written`);
      continue;
    }
    script = next; fixedBeats.push(n);
  }
  // Each costing piece's coin line right after its [WEAR: id] line
  // (utils/scriptMoney.js; Evoni, 2026-10-18), where the writer left it out;
  // approved beats are left as they are.
  let coinLines = 0;
  if (inputs.money) {
    try {
      const { scriptWithCoinLines } = require('../utils/scriptMoney');
      const skip = splitScriptBeats(script).beats.map((b, i) => (locked.has(b.number) ? i : -1)).filter((i) => i >= 0);
      const coined = scriptWithCoinLines(script, inputs.money, { skip });
      script = coined.script; coinLines = coined.added;
    } catch (err) {
      console.error('[ScriptGen] coin lines failed (non-blocking):', err.message);
    }
  }
  // The show's rules (utils/scriptShowRules.js; Evoni, 2026-10-17): Lala's
  // voice click before she talks, and the invitation in beat 5, never the
  // login screen; approved beats are left as they are. Before the phone
  // steps, so a click the phone can't make gets its path too.
  let voiceClicks = 0;
  let revealFixed = false;
  try {
    const { scriptWithShowRules } = require('../utils/scriptShowRules');
    const skip = splitScriptBeats(script).beats.map((b, i) => (locked.has(b.number) ? i : -1)).filter((i) => i >= 0);
    const ruled = scriptWithShowRules(script, rulesPhone(inputs.phone, inputs.onScreen || []), { skip });
    script = ruled.script; voiceClicks = ruled.voice_clicks; revealFixed = ruled.reveal;
  } catch (err) {
    console.error('[ScriptGen] show rules failed (non-blocking):', err.message);
  }
  // Before each tap the phone can't make from where it is, a step to the
  // icon's screen (utils/phonePaths.js, the Script tab's own check); approved
  // beats are left as they are, and read for where they leave the phone.
  let phoneSteps = 0;
  if (inputs.phone) {
    try {
      const { scriptWithPhonePaths } = require('../utils/phonePaths');
      const skip = splitScriptBeats(script).beats.map((b, i) => (locked.has(b.number) ? i : -1)).filter((i) => i >= 0);
      const paths = scriptWithPhonePaths(script, inputs.phone, { skip });
      if (paths.added) { script = paths.script; phoneSteps = paths.added; }
    } catch (err) {
      console.error('[ScriptGen] phone paths failed (non-blocking):', err.message);
    }
  }
  const { missing } = scriptCoverage(script, facts);
  if (fixedBeats.length || missing.length) {
    console.log(`[ScriptGen] Coverage for episode ${episodeId}: rewrote beats ${fixedBeats.join(', ') || 'none'}; still missing ${missing.length}`);
  }
  // The story layers the show holds nothing for (utils/storyLayers.js): the
  // writer kept them to this episode; the Script tab shows them.
  let storyGaps = [];
  try { storyGaps = require('../utils/storyLayers').storyLayers(inputs).gaps; } catch (err) { console.error('[ScriptGen] story gaps failed (non-blocking):', err.message); }
  return { script, coverage: { missing, fixed_beats: fixedBeats.sort((a, b) => a - b), phone_steps: phoneSteps, voice_clicks: voiceClicks, reveal_fixed: revealFixed, coin_lines: coinLines, story_gaps: storyGaps }, facts };
}

// Rule 6, how beat 14 ends: one instruction (Script page audit, 2026-10-19).
// With the invitation coming it ends on it and the forward hook is told
// through it; withheld, the hook comes and no offer does; with nothing
// attached, the forward hook as before.
function beat14Ending(ending, hook) {
  if (ending === 'invitation') return `the invitation in the BEAT 14 OPPORTUNITY block${hook ? `; the forward hook, "${hook}", is told through it` : ''}`;
  const told = hook ? `the forward hook: "${hook}"` : 'a forward hook seeding the next episode';
  return ending === 'withheld' ? `${told}; the BEAT 14 OPPORTUNITY does not come, and no other offer comes in its place` : told;
}

// What the coverage check needs from the writer's inputs.
function coverageFacts(inputs) {
  const career = inputs?.story?.career || null;
  return {
    deliverables: career?.deliverables || [],
    // The show's rules checked after writing (utils/scriptRuleChecks.js).
    rules: { money: inputs?.money || null, shoppingApproved: Boolean(inputs?.money?.shopping), cast: require('../utils/scriptRuleChecks').eventCast(inputs?.eventData || null, inputs?.story?.socialProfiles || []) },
    goals: career?.goals || [],
    forwardHook: inputs?.brief?.forward_hook || '',
    lockedPieces: (inputs?.outfitScore?.items || []).filter((p) => p?.id).map((p) => ({ id: p.id, name: p.name })),
    // Beat 14's opportunity, when it comes (Evoni, 2026-10-19): it must
    // arrive in the script. Not when the episode is designed to fail, nor once
    // it expired at completion (Script page audit, 2026-10-19).
    opportunity: beat14Outcome(inputs?.beat14, inputs?.brief?.designed_intent || null) === 'invitation'
      ? { name: inputs.beat14.name, from: inputs.beat14.contact_name || inputs.beat14.connector_handle || null }
      : null,
  };
}

// One beat's text from the writer's reply: the section under the beat's own
// header, or the whole reply under that header when it has no header at
// all. The header is always the canonical one. null when the reply is not
// this beat (Script tab re-audit, 2026-10-15): it has only other beats'
// headers, or no line of a script (a speaker's line, an action in
// parentheses, a [cue]), as a refusal has none.
// A speaker's line needs words after the colon, and a speaker who is not a
// lead-in ("Sure. Here is the beat:", "Note: …" were taken for beats; re-audit 2).
const SCRIPT_LINE = /^\s*(?:\[|\(|(?!(?:note|notes|sure|here|okay|ok|certainly|this|that|i)\b)[\p{L}][\p{L}\p{M}'’. -]{0,40}(?:\s*\([^)]*\))?\s*:\s*\S)/iu;
function beatFromReply(reply, beatNumber) {
  const canon = CANONICAL_BEATS.find((b) => b.number === beatNumber);
  if (!canon) return null;
  const { splitScriptBeats } = require('../utils/scriptBeatLocks');
  const split = splitScriptBeats(String(reply || '').trim());
  const own = split.beats.find((b) => b.number === beatNumber);
  if (!own && split.beats.length) return null;
  const body = own ? own.text.split('\n').slice(1).join('\n') : split.preamble;
  const lines = body.split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim());
  if (!lines.some((l) => SCRIPT_LINE.test(l))) return null;
  return [beatHeader(canon), ...lines].join('\n');
}

// Evoni, 2026-10-09 (Task #2785): regenerate one beat, not the whole script.
// The grounded prompt, the script as it stands, and the one beat to write
// again; the reply is that beat, header first.
// `instruction` (Script tab audit, 2026-10-15): Evoni's own ask for this
// beat ("punchier", "add a closet moment"), creative direction inside the
// same format rules; at most 300 characters, the route trims it.
async function generateGroundedBeat(episodeId, showId, models, { beatNumber, currentScript, instruction = '' }) {
  const canon = CANONICAL_BEATS.find((b) => b.number === beatNumber);
  if (!canon) throw new Error(`No canonical beat ${beatNumber}`);
  const direction = typeof instruction === 'string' ? instruction.trim().slice(0, 300) : '';
  const inputs = await groundedScriptInputs(episodeId, showId, models);
  const prompt = buildScriptPrompt(inputs, {
    only: { beat: canon, currentScript: String(currentScript || ''), instruction: direction },
  });
  const beat = beatFromReply((await writeWith(prompt, 1500, 2)).text, beatNumber);
  return beat ? beatAfterWriting(beat, beatNumber, inputs, currentScript) : beat;
}

// The fixes the whole script gets after writing, for one beat (Script page
// audit, 2026-10-19: a regenerated beat had none of them): the coin line
// after each costing [WEAR: id] when it is the closet beat of the script as
// it stands (utils/scriptWear.js closetIndex), and the show's rules, Lala's
// voice click and beat 5's invitation. The phone steps are left out: they
// need where the beat before left the phone. Each fix that fails is logged
// and the beat is kept as written.
function beatAfterWriting(beat, beatNumber, inputs, currentScript) {
  let text = beat;
  if (inputs.money) {
    try {
      const { scriptBeats, closetIndex } = require('../utils/scriptWear');
      const beats = scriptBeats(String(currentScript || ''));
      const at = closetIndex(beats);
      const closetNumber = at >= 0 ? beats[at].number : CLOSET_NUMBER;
      if (beatNumber === closetNumber) {
        text = require('../utils/scriptMoney').scriptWithCoinLines(text, inputs.money, { closetNumber }).script;
      }
    } catch (err) {
      console.error('[ScriptGen] coin lines for one beat failed (non-blocking):', err.message);
    }
  }
  try {
    const { scriptWithShowRules } = require('../utils/scriptShowRules');
    text = scriptWithShowRules(text, rulesPhone(inputs.phone, inputs.onScreen || [])).script;
  } catch (err) {
    console.error('[ScriptGen] show rules for one beat failed (non-blocking):', err.message);
  }
  return text;
}
const CLOSET_NUMBER = (CANONICAL_BEATS.find((b) => b.screen_action === 'CLOSET_OPEN') || { number: 8 }).number;

// The Script Writer's blocks for what `story` holds: money, career, the
// people at the event, the content she must make, continuity and her
// numbers (episodeScriptWriterService). Empty when it could not be read.
//
// Script tab re-audit (2026-10-15), so the prompt says one thing once:
// - her coins are the ledger's balance (FINANCIAL CONTEXT) wherever a
//   number is given, LALA'S STATS included;
// - the season is EPISODE CONTEXT's own (`hasSeason`), so the arc's phase
//   is not given a second time;
// - the closing hook is the brief's (`hook`) when it has one: the career
//   block's beat 14 line tells it through her career, not instead of it.
// A block that fails to render is left out (logged), never the whole script.
// Each block renders on its own: one that fails is logged and left out,
// never the rest (re-audit 2, 2026-10-15: one guest's bad JSON dropped her
// career, money and stats together). Returns { text, career, stats }: what
// rendered, so the rules and the fallback stats read only what is there.
function storyContext(story, { hasSeason = false, hook = '', balanceBefore = null, beat14 = null } = {}) {
  const none = { text: '', career: false, stats: false };
  if (!story) return none;
  const { storyContextBlocks, financialContextText } = require('./episodeScriptWriterService');
  const block = (name, render) => {
    try { return render() || ''; } catch (err) { console.error(`[ScriptGen] story block "${name}" failed (non-blocking):`, err.message); return ''; }
  };
  // Her coins as the episode starts (Evoni, 2026-10-18): the ledger already
  // holds this episode's posted pieces, so the balance it gives is the one
  // after the closet, and the script said "768" before she had shopped.
  const before = balanceBefore != null;
  const balance = before ? balanceBefore : story.financial?.balance;
  const told = {
    ...story,
    characterState: story.characterState && balance != null ? { ...story.characterState, coins: balance } : story.characterState,
    arcPhase: hasSeason ? null : story.arcPhase,
  };
  const financial = story.financial ? block('financial', () => `═══ FINANCIAL CONTEXT ═══\n${financialContextText(before ? { ...story.financial, balance, total_income: 0, total_expenses: 0 } : story.financial)}`) : '';
  // A function, so a `$` in the hook is written as it is. With beat 14's
  // invitation coming, the career block leaves beat 14 to it; with it
  // withheld, no offer comes (careerBlock; Script page audit, 2026-10-19).
  const career = block('career', () => {
    const text = careerBlock(story.career, { beat14 });
    if (!text || !hook) return text;
    const instead = beat14 === 'withheld' ? 'no offer comes: a goal still open, or what she does now' : 'a follow-up offer, a goal still open, or what this deal could lead to';
    return text.replace(/^- Beat 14: .*$/m, () => `- Beat 14: end on the forward hook, "${hook}", told through her career: ${instead}.`);
  });
  // The guests are the block most likely to hold bad data; without them the
  // rest (her stats, the last episode, the arc) still goes in.
  let rest = block('story', () => storyContextBlocks(told, { withSeason: false }));
  if (!rest && (told.socialProfiles || []).length) rest = block('story without guests', () => storyContextBlocks({ ...told, socialProfiles: [] }, { withSeason: false }));
  const blocks = [financial, career, rest].filter(Boolean);
  return {
    text: blocks.length ? `\n${blocks.join('\n\n')}\n` : '',
    career: !!career,
    stats: rest.includes("═══ LALA'S STATS ═══"),
  };
}

// The world snapshot's states for LALA'S STATE, with her coins the ledger's
// balance when it is known (re-audit 2: it gave a second number).
function snapshotStates(states, balance) {
  if (balance == null || !states || typeof states !== 'object') return states;
  const out = { ...states };
  if ('coins' in out) out.coins = balance;
  for (const key of Object.keys(out)) {
    if (/lala/i.test(key) && out[key] && typeof out[key] === 'object' && 'coins' in out[key]) out[key] = { ...out[key], coins: balance };
  }
  return out;
}

// A10: every season story purpose, primary first, each with its thread.
// The show's screens, icons and overlays by name (getAllOverlayTypes), for
// the [UI:] lines; empty when the show has none or they could not be read.
function onScreenContext(onScreen = []) {
  const names = (kind) => onScreen.filter((o) => o?.name && kind(o)).map((o) => o.name).slice(0, 40);
  // As the Script tab sorts them (frontend/src/lib/overlayUtils.js).
  const isIcon = (o) => o.category === 'phone_icon' || o.category === 'icon';
  const isProduction = (o) => o.category === 'production';
  const screens = names((o) => !isIcon(o) && !isProduction(o));
  const icons = names(isIcon);
  const overlays = names(isProduction);
  if (!screens.length && !icons.length && !overlays.length) return '';
  return `\n═══ ON SCREEN ═══\n${screens.length ? `Screens: ${screens.join(', ')}\n` : ''}${icons.length ? `Icons: ${icons.join(', ')}\n` : ''}${overlays.length ? `Overlays: ${overlays.join(', ')}\n` : ''}`;
}

// The phone the show rules name things on (utils/scriptShowRules.js): the
// phone map when it was read, else the show's overlay list.
function rulesPhone(phone, onScreen = []) {
  if (phone) return phone;
  const isIcon = (o) => o?.category === 'phone_icon' || o?.category === 'icon';
  return {
    screens: onScreen.filter((o) => o && !isIcon(o) && o.category !== 'production'),
    icons: onScreen.filter(isIcon),
    production: onScreen.filter((o) => o?.category === 'production'),
  };
}

// The three story layers and what feeds each (utils/storyLayers.js; Evoni,
// 2026-10-17). Left out, logged, when it cannot be built.
function layersText(inputs) {
  try { return require('../utils/storyLayers').storyLayers(inputs).text; } catch (err) { console.error('[ScriptGen] story layers failed (non-blocking):', err.message); return ''; }
}

// Lala's coins and the approved shopping list (utils/scriptMoney.js; Evoni,
// 2026-10-18). Left out, logged, when it cannot be built.
function moneyText(money) {
  try { return require('../utils/scriptMoney').moneyContext(money); } catch (err) { console.error('[ScriptGen] money block failed (non-blocking):', err.message); return ''; }
}

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

// Who Lala talks with when the cutscene begins (Evoni, 2026-10-19: "beat 11
// is when the cutscene begins, she should have a conversation with the host
// and 2 featured guest"): the event's host (its creator organizer, else its
// host field) and its first two featured guests
// (canon_consequences.automation.guest_profiles, `featured`; all guests when
// none is featured). A line for the prompt.
function cutsceneCast(eventData) {
  let cc = eventData?.canon_consequences;
  if (typeof cc === 'string') {
    try { cc = JSON.parse(cc); } catch (err) { console.error('[ScriptGen] canon_consequences is not valid JSON:', err.message); cc = null; }
  }
  const guests = Array.isArray(cc?.automation?.guest_profiles) ? cc.automation.guest_profiles.filter(Boolean) : [];
  const featured = guests.filter((g) => g.featured);
  const named = (featured.length ? featured : guests).map((g) => g.display_name || g.handle).filter(Boolean).slice(0, 2);
  let organizer = null;
  try { organizer = require('../utils/eventOrganizer').eventCreatorOrganizer(eventData); } catch (err) { console.error('[ScriptGen] event organizer read failed (non-blocking):', err.message); }
  const host = organizer?.displayName || organizer?.handle || eventData?.host || null;
  const hostText = host ? `the host, ${host}${eventData?.host_brand ? ` (${eventData.host_brand})` : ''}` : "the event's host";
  const guestText = named.length === 2 ? `the two featured guests, ${named[0]} and ${named[1]}`
    : named.length === 1 ? `the featured guest ${named[0]} and one more featured guest` : 'two featured guests of the event';
  return `${hostText} and ${guestText}`;
}

function buildScriptPrompt({ brief, scenePlan, franchiseLaws, eventData, wardrobeItems, lalaStats, outfitScore, seasonContext = null, onScreen = [], story = null, phone = null, worldNow = '', money = null, beat14 = null }, { only = null, lockedBeats = [] } = {}) {
  // Every canonical beat, in order, whether or not the plan has its row
  // (§8(j): Generate Script instantiates all 14; it never invents its own).
  const planByBeat = new Map(scenePlan.map((b) => [Number(b.beat_number), b]));
  const beatContext = CANONICAL_BEATS.map((canon) => {
        const b = planByBeat.get(canon.number) || {};
        const tpl = BEAT_TEMPLATES[canon.number];
        const loc = b.sceneSet?.worldLocation;
        let entry = `${beatHeader(canon)}
  Purpose: ${canon.narrative_purpose}
  Story job: ${canon.story_job}
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
    // The entry cost comes off in the Recap Panel only (Evoni, 2026-10-18;
    // Script page audit, 2026-10-19): said here when LALA'S COINS does not
    // say it, so a bare "Cost: N coins" is not charged on arrival.
    const entry = Number(eventData.cost_coins) > 0
      ? `Cost: ${eventData.cost_coins} coins${money ? '' : `, which comes off in the Recap Panel (Beat ${RECAP_NUMBER}) only, as [STAT: coins -${eventData.cost_coins}]; never earlier`}`
      : `Cost: ${eventData.cost_coins ?? 0} coins`;
    eventContext = `Event: ${eventData.name}\nPrestige: ${eventData.prestige}/10\nDress code: ${eventData.dress_code || 'Not specified'}\n${entry}\nNarrative stakes: ${eventData.narrative_stakes || ''}`;
    if (eventData.invitation_asset_id) {
      eventContext += '\nInvitation: GENERATED — use in Beat 5 (Reveal). JAWIHP opens the mail and reads the invitation aloud. The InviteLetterOverlay should float up on screen.';
    }
    // Outcomes — creator-authored narrative threads this event opens. The
    // Rewards editor in WorldAdmin populates rewards.outcomes (one per line).
    // Surfacing them here gives the writer concrete success-state hooks to
    // weave into the back half of the episode (Beats 9-13, by their canonical
    // names: BACK_HALF)
    // without inventing them on its own. Lenient parse handles JSON-string
    // legacy rows.
    const rewardsObj = (typeof eventData.rewards === 'string'
      ? (() => { try { return JSON.parse(eventData.rewards || '{}'); } catch { return {}; } })()
      : (eventData.rewards || {}));
    const outcomes = Array.isArray(rewardsObj.outcomes) ? rewardsObj.outcomes.filter(Boolean) : [];
    if (outcomes.length > 0) {
      eventContext += `\nIf this episode lands SLAY or PASS, these threads should be visibly opened in the back half (${BACK_HALF}). Reference them through dialogue, reactions, or a closing tag — not exposition:\n${outcomes.map(o => `  • ${o}`).join('\n')}`;
    }
  } else {
    eventContext = 'No event assigned';
  }

  // Her numbers come from LALA'S STATS when the story read has them; the
  // world snapshot is the fallback, given whole (a 200-character cut broke
  // it mid-object).
  const showRules = require('../utils/scriptShowRules');
  const rulesOn = rulesPhone(phone, onScreen);
  const hook = typeof brief?.forward_hook === 'string' ? brief.forward_hook.trim() : '';
  const balanceBefore = money?.balanceBefore ?? null;
  // How beat 14 ends (Script page audit, 2026-10-19): on the invitation,
  // with the hook told through it; or, withheld, with no offer at all.
  const ending = beat14Outcome(beat14, brief?.designed_intent || null);
  const told = storyContext(story, { hasSeason: !!seasonContext?.label, hook, balanceBefore, beat14: ending });
  const statsContext = told.stats ? ''
    : lalaStats?.character_states ? JSON.stringify(snapshotStates(lalaStats.character_states, balanceBefore ?? story?.financial?.balance)).slice(0, 1500)
    : 'Stats not loaded';
  const people = (story?.socialProfiles || []).length > 0;

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

${statsContext ? `═══ LALA'S STATE ═══\n${statsContext}\n` : ''}${worldNow}${told.text}
═══ WARDROBE ═══
${wardrobeContext}
${outfitScore ? `\n═══ LOCKED OUTFIT ═══\nLala is wearing ${outfitScore.count} pieces for this event:\n${outfitScore.items.map(i => `- ${i.name} (${i.clothing_category}, ${i.tier})${i.id ? ` [WEAR: ${i.id}]` : ''}`).join('\n')}\nBeat 8 (Transformation): Reference these SPECIFIC items by name as Lala gets dressed. Right after the line where she puts a piece on, write that piece's [WEAR: id] line exactly as shown above, once per piece.\nBeat 11 (The Event): Her outfit choice affects how the event goes — she is wearing what she chose, on camera in the cutscene.` : ''}
${moneyText(money)}${require('./beat14Opportunity').beat14Context(beat14, brief?.designed_intent || null)}${onScreenContext(onScreen)}${phone ? require('../utils/phonePaths').phoneMapContext(phone) : ''}${layersText({ brief, eventData, seasonContext, story })}

═══ SCENE PLAN — 14 BEATS ═══
${beatContext}
${!only && lockedBeats.length ? `
═══ APPROVED BEATS (LOCKED) ═══
These beats are approved and stay exactly as written. Write every other beat so it leads into and out of them, and does not repeat what they already say. For each of these, write its header line and nothing under it; the approved text goes back in its place.
${lockedBeats.map((b) => b.text).join('\n\n')}
` : ''}
═══ FORMAT ═══
${only ? 'The beat opens with its header line (given under THIS TASK). Under it:' : `Each of the 14 beats opens with its header line, exactly as written above, in order from 1 to 14:
${beatHeader(CANONICAL_BEATS[0])}
...
${beatHeader(CANONICAL_BEATS[CANONICAL_BEATS.length - 1])}
Do not add, merge, rename or skip beats. Under each header:`}
Me: [JAWIHP dialogue]
(Action description)
Lala: [Lala dialogue]
[STAT: coins -X] (a cost, only where LALA'S COINS puts one; other stats the same way, [STAT: reputation +1])
[TRANSITION: description]
[SFX: sound] / [EDIT: editing cue] (optional, for JustAWoman's moments; not on every line)
${people ? 'Another character at the event speaks as their name: [their words], in their own voice (CHARACTERS AT THE EVENT).\n' : ''}
What happens on screen goes on its own line, one moment per line, in this form (the Script tab reads these lines; write the name of a screen, icon or overlay exactly as it is listed under ON SCREEN when it is listed there):
[UI:SHOW phone] / [UI:HIDE phone] (Lala's phone comes on screen / goes away)
[UI:OPEN <screen>] [UI:CLICK <icon>] [UI:SCROLL <screen>] [UI:CLOSE <screen>]
[UI:DISPLAY <overlay>] / [UI:HIDE <overlay>]
[UI:NOTIFY <sender>: <words>] [UI:DM <sender>: <words>] [UI:POST <caption>]
Turn each beat's "UI action" above into one or more of these lines (CLOSET_OPEN is [UI:OPEN Closet], MAIL_NOTIFICATION is a [UI:NOTIFY …] line); never write the action's own name in brackets.

RULES:
1. Beat 8 MUST reference specific wardrobe items by name
2. JAWIHP reacts in real time to what she has seen (JUSTAWOMAN ON CAMERA)
3. Lala's lines are ALWAYS short and punchy — max 2-3 sentences
4. Community engagement: ask audience to react in comments at least twice
5. A change to her stats appears only as a [STAT:] tag; she may say her coin balance in her own words when she checks it
${!only || only.beat.number === 14 ? `6. ${only ? 'This beat ends' : 'Beat 14 ends'} on ${beat14Ending(ending, hook)}\n` : ''}${told.career ? "7. Lala's career is on the page: name the deal and what she wants from the event in the beats the CAREER block gives them, in her words, never as a list; what she owes need not be shown on screen\n" : ''}

═══ JUSTAWOMAN ON CAMERA ═══
JustAWoman (Me:) is playing the game on camera from her corner: she sees the game interface and reacts to it; Lala lives the experience. Two perspectives on the same moment. Lala cannot hear her commentary or see the audience's game interface.
- She reacts to the specific thing on screen (this outfit, this message, this price, this person, this result), never an interchangeable line like "This is exciting!".
- Only to what she has actually seen: nothing from a message before it arrives, or from the invitation before it is opened.
- Her lines mix four things, each on its own line or inside hers:
  - spoken commentary: jokes, predictions, doubts, celebrations, occasional criticism of the game;
  - performance, in parentheses: Me: (side-eyes the camera) "…", (leans toward the screen), (stunned silence);
  - player actions: the [UI:] lines she makes happen, and her hesitation, (hovers over Confirm, then pulls back);
  - sound and edit cues, optional: [SFX: notification ping], [EDIT: punch-in on her corner frame].
- Two modes. While playing (beats 1–12) she is emotionally involved and invested in Lala's business: "We cannot afford to embarrass ourselves tonight." While reviewing (beats 13–14) she briefly evaluates what happened: "That warning came after I spent the coins. You could've told me sooner." Write new lines; never reuse these.
- In the cutscene (beats 11–13) she is still on screen, watching it play like a cutscene in a video game: she comments a little between the characters' lines, a reaction here and there, never narrating every line, and she clicks nothing.
- Vary her energy and leave room to watch: let Lala's line finish before she reacts.
- She may talk to viewers as "besties" or "chat" and ask them to comment, but never invents viewer messages or comments.
- Her humor, opinions, small grudges, favorite characters and investment in Lala carry on from PREVIOUS EPISODE when it is given; never invent a past grudge or favorite.

═══ SHOW RULES ═══
- Beats 1–10 are gameplay: everything stems from Lala's phone. It is on screen from the moment the Start button is clicked in Beat 1 until she travels to the event in Beat 10. Never write [UI:SHOW phone] or [UI:HIDE phone] in between; the phone is already there.
- Beats 11–13 are the cutscene: an AI video, like a play moment in a video game, where the characters say their own lines to each other: Lala, ${cutsceneCast(eventData)}, and anyone else present, each as their name: [their words]. No phone and no phone UI: no [UI:SHOW phone], [UI:CLICK …], [UI:OPEN …] or [UI:SCROLL …] of phone screens, and no voice-icon click. What the video shows goes in (parentheses). Overlays that sit on the video are allowed: [UI:DISPLAY Stats Panel] / [UI:HIDE Stats Panel], and [TRANSITION: …]. JustAWoman (Me:) stays on screen and comments a little between their lines.
- Beat 11 (The Event): the cutscene begins. Lala has a real conversation with ${cutsceneCast(eventData)}.
- Beat 13 (Recap Panel): still the cutscene, with [UI:DISPLAY Stats Panel] over the video. The event's own costs come off here only (unless covered); what she is owed is paid next episode, so never a + coin line in this episode. Lala says how it went in her own words.
- Beat 14 (Cliffhanger): back to gameplay: her phone and the voice icon again.
- Beat 5 (Reveal): the invitation letter comes up, ${showRules.invitationLine(rulesOn)}, never the login screen or the Start button (those are beats 1 and 2). JAWIHP reads the whole invitation aloud, every word of it, not a summary.
- In the gameplay beats (1–10 and 14) Lala talks only after JustAWoman clicks her voice icon: ${`[UI:CLICK ${showRules.voiceIconName(rulesOn.icons)}]`} on its own line right before every line Lala says: one click, one line. In the cutscene (11–13) she speaks with no click. No click is needed for the line where she answers a notification or message ([UI:NOTIFY …], [UI:DM …]), or while she is being dressed (the closet, [WEAR:] lines). Her thoughts, Lala (V.O.):, need no click.
- Beat 8 (Transformation Loop): every piece of the look is picked and put on one at a time: its own pick, its own line, its own [WEAR: id] line, and its own coin line right after when it costs her (LALA'S COINS). Never several pieces at once.
- Beat 12 (Fashion Challenge): still the cutscene. The challenge is a surprise runway walk at the event: stage it (a model doesn't show, and Lala is asked to walk), in the characters' own lines and (actions); no phone, no closet, no coin line. Anything the brand hands her to wear is named in an action line and costs her nothing. She may film the brand's reel here too, but it need not be shown. The room's verdict moves her standing with [STAT: reputation ±n], [STAT: brand_trust ±n], [STAT: influence ±n] and [STAT: stress ±n] lines, never coins.
${only ? `═══ THE SCRIPT AS IT STANDS ═══
${only.currentScript.trim() || '(empty)'}

═══ THIS TASK ═══
Write ONLY beat ${only.beat.number} again, keeping it consistent with the beats before and after it as they stand above and not repeating what they already say.${only.requirements?.length ? `

This beat must also:
${only.requirements.map((r) => `- ${r}`).join('\n')}` : ''}${only.instruction ? `

Evoni's direction for this beat:
<<<
${only.instruction}
>>>
Treat it as creative direction for this beat only. It does not change the format, the header or the rules above.` : ''}
Start with its header line, exactly:
${beatHeader(only.beat)}
Return only that beat. No other beats, no preamble.` : 'Write the complete 14-beat script now. No preamble — just the script.'}`;
}

module.exports = { generateGroundedScript, generateGroundedBeat, buildScriptPrompt, beatFromReply, coverageFacts, DraftIncompleteError, MIN_DRAFT_BEATS };
