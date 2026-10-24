'use strict';

/**
 * Episode Script Writer Service
 *
 * AI writes full episode scripts by assembling:
 * 1. Episode Brief (archetype, designed intent, narrative purpose)
 * 2. Scene Plan (14 beats with grounded locations + angles)
 * 3. Feed Moments (social media triggers per beat)
 * 4. Financial Pressure (budget, income, expenses, stress level)
 * 5. Wardrobe (locked outfit filtered by event dress code + affordability)
 * 6. Show Brain (franchise voice laws)
 * 7. Event data (prestige, dress code, stakes)
 * 8. (retired: the Opportunity pipeline; see 3b, the event's career)
 *
 * Output: Structured script_json + rendered script_text, saved as versioned EpisodeScript.
 */

const Anthropic = require('@anthropic-ai/sdk');
const crypto = require('crypto');
const { eventCreatorOrganizer } = require('../utils/eventOrganizer');
const { LINKED_CHARACTER_JOIN } = require('../utils/registryLink');
const { storyBrief, BRIEF_COLUMNS } = require('./characterStoryBrief');
const { secretsFor } = require('./characterSecrets');
const { planForEpisode, withPlan } = require('./seasonRevealPlan');
const { familyLines } = require('./familyTies');
const { lalaStoryTies, lalaTieFields } = require('./relationshipTruth');
const { latestWorldSnapshotForShow } = require('./worldSnapshotForShow');
const { loadScriptCareer, careerBlock } = require('./scriptCareerService');
const { episodeEventId } = require('../utils/episodeEventSql');

// The model is the grounded writer's MODELS (writeScriptReply; Script page audit 3, 2026-10-19).
let client = null;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const JAWIHP_VOICE_DNA = `
JAWIHP (JustAWomanInHerPrime) — THE HOST:
- Addresses audience as "besties"
- Warm, hype-woman energy — celebrates everything
- Narrates what she's clicking/doing in real time
- Reacts naturally ("oh wow these are nice!!")
- Breaks fourth wall ("I can't believe it you guys")
- Drives all decisions — she chooses outfits, clicks icons, opens letters
- Uses casual grammar naturally ("Girl brunch!", "I know that's right")
- Community-building language ("put a dollar emoji in the comments")
- Never robotic, never formal, never generic

LALA — THE CHARACTER:
- Always calls people "bestie"
- Short, punchy, confident lines — max 2-3 sentences
- Self-aware about her attractiveness and status
- Loyal girls-girl ("If she can't go. It's a no for me")
- Slightly dramatic but always positive
- Her inner monologue reveals insecurity the audience sees but other characters don't
`.trim();

const BEAT_TEMPLATES = {
  1:  { name: 'Opening Ritual',       jawihp: true,  lala: false, ui: 'HEADPHONES_ON',             mood: 'intimate' },
  2:  { name: 'Login Sequence',       jawihp: true,  lala: true,  ui: 'LOGIN',                     mood: 'anticipation' },
  3:  { name: 'Welcome',              jawihp: true,  lala: false, ui: 'WELCOME',                   mood: 'warm' },
  4:  { name: 'Interruption Pulse 1', jawihp: true,  lala: true,  ui: 'MAIL_NOTIFICATION',         mood: 'disruption' },
  5:  { name: 'Reveal',               jawihp: true,  lala: true,  ui: 'OPEN_LETTER_INVITE_OVERLAY', mood: 'excitement' },
  6:  { name: 'Strategic Reaction',   jawihp: true,  lala: true,  ui: 'LALA_VOICE_COMMAND',        mood: 'tension' },
  7:  { name: 'Interruption Pulse 2', jawihp: true,  lala: true,  ui: 'SIDE_QUEST',                mood: 'escalation' },
  8:  { name: 'Transformation Loop',  jawihp: true,  lala: true,  ui: 'CLOSET_OPEN',               mood: 'transformation' },
  9:  { name: 'Reminder/Deadline',    jawihp: true,  lala: false, ui: 'TODO_LIST',                 mood: 'urgency' },
  10: { name: 'Event Travel',         jawihp: true,  lala: false, ui: 'LOCATION_ICON',             mood: 'anticipation' },
  11: { name: 'The Event',            jawihp: true,  lala: true,  ui: 'ARRIVAL',                   mood: 'climax' },
  12: { name: 'Fashion Challenge',    jawihp: true,  lala: true,  ui: 'FASHION_CHALLENGE',         mood: 'performance' },
  13: { name: 'Recap Panel',          jawihp: true,  lala: false, ui: 'STATS_UPDATE',              mood: 'reflection' },
  14: { name: 'Cliffhanger',          jawihp: true,  lala: false, ui: 'FADE_OUT',                  mood: 'suspense' },
};

/**
 * Load all context data for script generation
 */
// `lite` (the Script tab's writer, Script tab re-audit 2026-10-15): skip the
// wardrobe intelligence, which that writer never reads and which costs a
// query per piece of the look.
async function loadScriptContext(episodeId, showId, models, { lite = false } = {}) {
  const { EpisodeBrief, ScenePlan, SceneSet, SceneAngle, FranchiseKnowledge,
          WorldEvent, WorldLocation, sequelize } = models;

  const context = {};

  // 1. Episode Brief
  context.brief = await EpisodeBrief.findOne({
    where: { episode_id: episodeId },
  }).then(b => b?.toJSON()).catch(() => null);

  // 2. Scene Plan with scene sets + angles
  context.scenePlan = await ScenePlan.findAll({
    where: { episode_id: episodeId, deleted_at: null },
    order: [['beat_number', 'ASC']],
    include: [{
      model: SceneSet, as: 'sceneSet',
      attributes: ['id', 'name', 'scene_type', 'script_context', 'canonical_description'],
      required: false,
      include: [
        {
          model: SceneAngle, as: 'angles',
          attributes: ['id', 'angle_label', 'angle_name', 'still_image_url', 'generation_status', 'mood'],
          required: false,
        },
        ...(WorldLocation ? [{
          model: WorldLocation, as: 'worldLocation',
          attributes: ['id', 'name', 'narrative_role', 'sensory_details', 'location_type'],
          required: false,
        }] : []),
      ],
    }],
  }).then(plans => plans.map(p => p.toJSON())).catch(() => []);

  // 3. Event data: the episode's event, the brief's else the first stamped
  // (utils/episodeEventSql; Task #1917).
  context.event = null;
  try {
    const eventId = await episodeEventId(sequelize, episodeId);
    context.event = eventId && await WorldEvent.findByPk(eventId, {
      // context.event is passed wholesale into the wardrobe-intelligence
      // pipeline (getWardrobeIntelligence -> scoreOutfitForEvent and
      // several evaluate* helpers), which reads many of the event's
      // fields — scoped to the model's own pre-Task-#1640 attribute set
      // (WorldEvent.CURRENT_ATTRIBUTES) rather than a hand-traced minimal
      // list, so this keeps returning exactly what it always has.
      attributes: WorldEvent.CURRENT_ATTRIBUTES,
    }).then(e => e?.toJSON());
  } catch { /* non-blocking */ }
  // An event the brief names but Start Episode has not stamped yet
  // (used_in_episode_id is set at Start; the brief's event_id earlier):
  // still this episode's event (episodeEventsService reads both).
  if (!context.event && context.brief?.event_id) {
    try {
      context.event = await WorldEvent.findByPk(context.brief.event_id, {
        attributes: WorldEvent.CURRENT_ATTRIBUTES,
      }).then(e => e?.toJSON() || null);
    } catch (err) {
      console.error('[ScriptWriter] brief event lookup failed (non-blocking):', err.message);
    }
  }

  // 3b. Lala's career in this episode: the event's deal, what she owes,
  // what she wants from it (scriptCareerService).
  context.career = null;
  if (context.event?.id) {
    try {
      context.career = await loadScriptCareer(sequelize, context.event.id);
    } catch (err) {
      console.error('[ScriptWriter] career context failed (non-blocking):', err.message);
    }
  }

  // 4. Financial state, from the ledger (§8(z) Law 0 and Law 14; §8(aa)
  //    M4; Task #2288). Lala's balance is her ledger balance
  //    (getCurrentBalance), the number every screen shows; the episode's
  //    income and expenses are its counted ledger rows (M6: no voided row).
  //    Pressure and affordability follow Lala's balance, not one episode.
  context.financial = null;
  try {
    const episode = await models.Episode.findByPk(episodeId);
    if (episode) {
      const { getCurrentBalance } = require('./financialTransactionService');
      const { countedLedgerRows } = require('../utils/ledgerBalanceFilter');
      const balance = await getCurrentBalance(sequelize, episode.show_id);
      const [totals] = await sequelize.query(
        `SELECT
           COALESCE(SUM(CASE WHEN ft.type IN ('income', 'reward') THEN ft.amount ELSE 0 END), 0) AS income,
           COALESCE(SUM(CASE WHEN ft.type IN ('expense', 'deduction') THEN ft.amount ELSE 0 END), 0) AS expenses
           FROM financial_transactions ft
          WHERE ft.episode_id = :episodeId AND ${countedLedgerRows('ft')}`,
        { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
      );
      const income = Math.round(Number(totals?.income) || 0);
      const expenses = Math.round(Number(totals?.expenses) || 0);
      context.financial = {
        total_income: income,
        total_expenses: expenses,
        balance,
        financial_score: episode.financial_score,
        pressure_level: balance < 0 ? 'desperate'
          : balance < 500 ? 'tight'
          : balance < 2000 ? 'comfortable'
          : 'flush',
      };
      // Add event cost if available
      if (context.event?.cost_coins) {
        context.financial.event_cost = context.event.cost_coins;
        context.financial.can_afford = balance >= context.event.cost_coins;
      }
    }
  } catch (err) {
    console.error('[ScriptWriter] financial context failed (non-blocking):', err.message);
  }

  // 5. Wardrobe for this episode: the outfit locked on the Wardrobe tab,
  // as GET /wardrobe/outfit/:episode_id reads it (routes/wardrobe.js) and
  // the Script page's "What the script will use" shows it. A pending link
  // (a library assign awaiting approval) is not the locked outfit, and an
  // attachment travels with its parent piece (Evoni, 2026-10-08).
  context.wardrobe = [];
  try {
    const [rows] = await sequelize.query(
      `SELECT w.id, w.name, w.clothing_category, w.brand, w.price, w.tier,
              w.aesthetic_tags, w.event_types, w.occasion, w.coin_cost,
              w.lala_reaction_own, w.acquisition_type, w.is_owned,
              w.s3_url_processed, w.thumbnail_url
       FROM episode_wardrobe ew
       JOIN wardrobe w ON w.id = ew.wardrobe_id AND w.deleted_at IS NULL
       WHERE ew.episode_id = :episodeId AND ew.deleted_at IS NULL
         AND ew.approval_status = 'approved'
         AND w.parent_item_id IS NULL
       ORDER BY ew.created_at ASC`,
      { replacements: { episodeId } }
    );
    context.wardrobe = rows || [];
  } catch { /* non-blocking */ }

  // 5b. Wardrobe Intelligence — repeat detection, brand loyalty, outfit scoring
  context.wardrobeIntelligence = null;
  if (!lite && context.wardrobe.length > 0 && context.event) {
    try {
      const { getWardrobeIntelligence } = require('./wardrobeIntelligenceService');
      context.wardrobeIntelligence = await getWardrobeIntelligence(context.wardrobe, context.event, showId, models);
    } catch (wiErr) {
      console.warn('[ScriptWriter] Wardrobe intelligence failed (non-blocking):', wiErr.message);
    }
  }

  // 6. Show Brain rules: a deterministic, recorded selection (services/
  //    brainRules.js, 2026-10-04): severity then id, the show's scope,
  //    the first 50, with the omitted rules named.
  context.franchiseLaws = [];
  context.franchiseLawIds = [];
  context.brainRules = null;
  if (FranchiseKnowledge) {
    try {
      const { selectInjectedRules, brainRulesRecord } = require('./brainRules');
      const selection = await selectInjectedRules(FranchiseKnowledge, { showId });
      context.franchiseLaws = selection.rules;
      context.franchiseLawIds = selection.used.map(l => l.id);
      context.brainRules = brainRulesRecord(selection);
    } catch (rulesErr) {
      console.error('[ScriptWriter] Brain rules selection failed (non-blocking):', rulesErr.message);
    }
  }

  // 7. Feed moments from scene plan
  context.feedMoments = context.scenePlan
    .filter(b => b.feed_moment)
    .map(b => ({ beat_number: b.beat_number, ...b.feed_moment }));

  // 8. The old Opportunity pipeline is retired here (Evoni, 2026-10-09):
  //    the table is empty or stale for her; the event's deal, deliverables
  //    and goals (3b, scriptCareerService) are her career in the episode.

  // 9. Lala's world state
  // The newest snapshot of the show's universe (or of none); the old
  // show_id query named a column the table does not have.
  context.worldState = await latestWorldSnapshotForShow(sequelize, showId);
  // Its world facts and the latest world temperature (services/worldNow, 2026-10-18).
  context.worldNow = await require('./worldNow').worldNowForShow(sequelize, showId, context.worldState);

  // 10. Social profiles + linked character depth — host + guests with real literary depth
  context.socialProfiles = [];
  context.unfeaturedGuestCount = 0;
  try {
    const auto = context.event?.canon_consequences?.automation || {};
    // g.id is the pre-fix shape a guest written by the opportunity
    // pipeline may still carry (Task #1686, docs/GUEST_OWNERSHIP_READ.md
    // §6) — g.profile_id is preferred, g.id is the fallback.
    const allGuests = auto.guest_profiles || [];
    // Featured attendees (docs/EVENT_EPISODE_FLOW.md §8(q) ruling 3) are the
    // three to five guests the story actually uses. When any guest is
    // featured, only featured guests go into the script prompt, each with
    // its story role; the rest are counted, not named. An event with no
    // featured guests keeps today's behavior — every guest, unfiltered.
    const featuredGuests = allGuests.filter(g => g.featured);
    const promptGuests = featuredGuests.length > 0 ? featuredGuests : allGuests;
    context.unfeaturedGuestCount = featuredGuests.length > 0 ? allGuests.length - featuredGuests.length : 0;
    const storyRoleByProfileId = new Map(
      featuredGuests.map(g => [g.profile_id || g.id, g.story_role || null])
    );
    const profileIds = [eventCreatorOrganizer(context.event)?.profileId, ...promptGuests.map(g => g.profile_id || g.id)].filter(Boolean);
    if (profileIds.length > 0) {
      // Each guest's character is the registry entry linked to the profile
      // (ruling C3, utils/registryLink), the newest should two be. The join
      // on sp.registry_character_id compared an integer to a UUID and failed.
      const [rows] = await sequelize.query(
        `SELECT sp.id, sp.handle, sp.display_name, sp.creator_name, sp.aliases, sp.platform, sp.archetype,
                sp.posting_voice, sp.content_persona, sp.lala_relevance_score, sp.celebrity_tier,
                sp.follow_motivation, sp.follow_emotion, sp.lala_relationship, rc.id AS registry_character_id,
                rc.display_name as char_name, rc.core_belief, rc.pressure_type, rc.pressure_quote,
                rc.role_type, rc.role_label, rc.appearance_mode, rc.depth_level,
                rc.personality, rc.description as char_description,
                rc.character_archetype, rc.therapy_primary_defense, rc.therapy_emotional_state,
                rc.signature_trait, rc.emotional_baseline,
                ${BRIEF_COLUMNS.map((col) => `rc.${col}`).join(', ')}
         FROM social_profiles sp
         ${LINKED_CHARACTER_JOIN}
         WHERE sp.id IN (:ids) AND sp.deleted_at IS NULL`,
        { replacements: { ids: profileIds } }
      );
      // Their kept secrets, for the brief's revelation budget (services/characterSecrets).
      const secrets = await secretsFor(sequelize, (rows || []).map(r => r.registry_character_id));
      // The season's reveal plan for this episode decides what it may hint at or reveal.
      const plan = await planForEpisode(sequelize, episodeId);
      // Lala's story pair with each, where there is one, decides their tie to her (services/relationshipTruth).
      const lalaTies = await lalaStoryTies(sequelize, (rows || []).map(r => r.registry_character_id));
      context.socialProfiles = (rows || []).map(r => {
        // Parse personality JSON if present
        let personality = r.personality;
        if (typeof personality === 'string') try { personality = JSON.parse(personality); } catch { personality = null; }
        return { ...r, personality, story_role: storyRoleByProfileId.get(r.id) || null, secrets: withPlan(secrets.get(r.registry_character_id) || [], plan, 'episode'), ...lalaTieFields(r, lalaTies.get(r.registry_character_id)) };
      });
      // A confirmed romance with Lala (character_relationships, written by
      // the "What changed" card; Evoni, 2026-10-23): the script plays them
      // as her love interest. lala_relationship stays as it is.
      const romances = await lalaRomances(sequelize, context.socialProfiles.map(p => p.registry_character_id));
      for (const p of context.socialProfiles) {
        if (romances.has(p.registry_character_id)) p.lala_romance = romances.get(p.registry_character_id);
      }
    }
  } catch { /* non-blocking */ }

  // Their family ties, under the cast (services/familyTies familyLines).
  context.familyLines = [];
  try {
    context.familyLines = await familyLines(sequelize, (context.socialProfiles || []).map(p => p.registry_character_id));
  } catch (err) {
    console.error('[ScriptWriter] family lines could not be read (non-blocking):', err.message);
  }

  // 10b. The people the event's goals are about who are not above (a brand's
  // Pulse account, a guest not featured): only their names, so the coverage
  // check ticks a goal by them as the Script tab does (utils/scriptRuleChecks
  // goalPerson). Not in the prompt.
  context.goalProfiles = [];
  try {
    const goals = context.event?.canon_consequences?.automation?.relationship_goals;
    const have = new Set((context.socialProfiles || []).map((p) => String(p.id)));
    const ids = [...new Set((Array.isArray(goals) ? goals : []).map((g) => g?.profile_id).filter((id) => id != null && id !== '').map(String))].filter((id) => !have.has(id));
    if (ids.length > 0) {
      const [rows] = await sequelize.query(
        'SELECT id, handle, display_name, creator_name, aliases FROM social_profiles WHERE id IN (:ids) AND deleted_at IS NULL',
        { replacements: { ids } }
      );
      context.goalProfiles = rows || [];
    }
  } catch (err) {
    console.error('[ScriptWriter] goal profiles lookup failed (non-blocking):', err.message);
  }

  // 11. Social tasks — what content Lala needs to create during the event
  context.socialTasks = [];
  try {
    const [todoList] = await sequelize.query(
      `SELECT social_tasks FROM episode_todo_lists WHERE episode_id = :episodeId AND deleted_at IS NULL LIMIT 1`,
      { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
    );
    if (todoList?.social_tasks) {
      context.socialTasks = typeof todoList.social_tasks === 'string' ? JSON.parse(todoList.social_tasks) : todoList.social_tasks;
    }
  } catch { /* non-blocking */ }

  // 12. Previous episode outcome — continuity callbacks
  context.previousEpisode = null;
  try {
    const [prev] = await sequelize.query(
      `SELECT title, evaluation_json, episode_number FROM episodes
       WHERE show_id = :showId AND episode_number < (SELECT episode_number FROM episodes WHERE id = :episodeId)
       AND deleted_at IS NULL ORDER BY episode_number DESC LIMIT 1`,
      { replacements: { showId, episodeId }, type: sequelize.QueryTypes.SELECT }
    );
    if (prev?.evaluation_json) {
      const evalJson = typeof prev.evaluation_json === 'string' ? JSON.parse(prev.evaluation_json) : prev.evaluation_json;
      context.previousEpisode = {
        title: prev.title,
        episode_number: prev.episode_number,
        tier: evalJson.tier_final,
        score: evalJson.score,
        narrative: evalJson.narrative_lines?.short,
      };
    }
  } catch { /* non-blocking */ }

  // 13. Arc / season phase — the active arc, read through the shared
  // getArcContext (show_arcs has no name or phase_title column; the phase
  // title lives in its phases JSON).
  context.arcPhase = null;
  try {
    const { getArcContext } = require('./arcProgressionService');
    const arc = await getArcContext(showId, { sequelize });
    if (arc) {
      context.arcPhase = {
        name: arc.arc_title,
        current_phase: arc.current_phase.number,
        phase_title: arc.current_phase.title,
        emotional_arc: arc.current_phase.emotional_arc,
        emotional_temperature: arc.emotional_temperature,
        narrative_debt_summary: arc.narrative_debt.length > 0 ? arc.narrative_debt_summary : null,
      };
    }
  } catch (err) {
    console.error('[ScriptWriter] season arc context failed (non-blocking):', err.message);
  }

  // 13b. This episode's season position (§8(ff) A5): the slot's context,
  // snapshotted onto the episode at Start Episode.
  context.seasonPosition = null;
  try {
    const [row] = await sequelize.query(
      'SELECT season_context FROM episodes WHERE id = :episodeId AND deleted_at IS NULL',
      { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
    );
    const sc = row?.season_context;
    context.seasonPosition = (typeof sc === 'string' ? JSON.parse(sc) : sc) || null;
  } catch (err) {
    console.error('[ScriptWriter] season position failed (non-blocking):', err.message);
  }

  // 13c. The season twists this episode's slot plants or pays off
  // (services/seasonTwists, 2026-10-23); '' with none.
  context.twistBlock = '';
  try {
    context.twistBlock = await require('./seasonTwists').twistBlock(sequelize, episodeId);
  } catch (err) {
    console.error('[ScriptWriter] season twists failed (non-blocking):', err.message);
  }

  // 13d. Who knows about the relationships around the people here
  // (services/relationshipKnowers, 2026-10-23); '' with none.
  context.secrecyBlock = '';
  try {
    context.secrecyBlock = await relationshipSecrecyBlock(sequelize, (context.socialProfiles || []).map(p => p.registry_character_id));
  } catch (err) {
    console.error('[ScriptWriter] who knows failed (non-blocking):', err.message);
  }

  // 13e. The last episode's approved story record and what Lala still owes
  // people (services/storyCarryForward, 2026-10-23: Episode 1 feeds Episode 2); '' with none.
  context.carryBlock = '';
  try {
    context.carryBlock = await require('./storyCarryForward').carryForEpisode(sequelize, episodeId);
  } catch (err) {
    console.error('[ScriptWriter] carry-forward failed (non-blocking):', err.message);
  }

  // 14. Character state — exact coin balance for internal monologue
  context.characterState = null;
  try {
    const [state] = await sequelize.query(
      `SELECT coins, reputation, brand_trust, influence, stress FROM character_state
       WHERE show_id = :showId AND character_key = 'lala' LIMIT 1`,
      { replacements: { showId }, type: sequelize.QueryTypes.SELECT }
    );
    context.characterState = state || null;
  } catch { /* non-blocking */ }

  // 15. Designed intent from brief — SLAY/PASS/SAFE/FAIL direction
  context.designedIntent = context.brief?.designed_intent || null;

  // 16. The Pulse around the episode (Character Consistency Engine step 7;
  // services/scriptPulsePosts): posts feed the script.
  context.pulsePosts = [];
  try {
    context.pulsePosts = await require('./scriptPulsePosts').scriptPulsePosts(models, episodeId, showId);
  } catch (err) {
    console.error('[ScriptWriter] Pulse posts failed (non-blocking):', err.message);
  }

  return context;
}

/**
 * A cast member's two lines about Lala, as the cast block writes them (the
 * character page's "What the writers know" shows the same): her story tie
 * in words, and their tie and love interest. Each null when there is none.
 */
function lalaTieLines(p) {
  // The story pair's line already says a romance; the romance is not said twice.
  const romance = p?.lala_romance !== undefined && !p?.lala_story_tie ? `love interest${p.lala_romance ? `: ${p.lala_romance}` : ''}` : null;
  const ties = [LALA_TIES[p?.lala_relationship], romance].filter(Boolean);
  return {
    story: p?.lala_story_tie ? `With Lala in the story: ${p.lala_story_tie}` : null,
    withLala: ties.length ? `With Lala: ${ties.join('; ')}` : null,
  };
}

// Their family ties as one block under the cast; '' when there are none.
function familyBlock(lines) {
  return lines?.length ? `\n\nTHEIR FAMILY (stay consistent with it):\n${lines.map(l => `- ${l}`).join('\n')}` : '';
}

/**
 * Who may mention which relationship (Evoni, 2026-10-23: "so the writers
 * know who can mention it and who can't"): one line per relationship of
 * Lala (at every episode) or the people at the event, secrets first, e.g.
 * "Lala and Marcus Hale's romance is SECRET: only Jade Monroe knows. Nobody
 * else mentions it." '' with none.
 */
async function relationshipSecrecyBlock(sequelize, characterIds) {
  const [lalas] = await sequelize.query(
    "SELECT id FROM registry_characters WHERE LOWER(COALESCE(character_key, '')) = 'lala' AND deleted_at IS NULL");
  const lines = await require('./relationshipKnowers').relationshipSecrecyLines(sequelize, [...lalas.map(l => l.id), ...(characterIds || [])]);
  if (!lines.length) return '';
  return `═══ WHO KNOWS ABOUT WHOM ═══\n${lines.map(l => `- ${l}`).join('\n')}\nSCRIPT DIRECTIVE: Only the people named as knowing may speak of a secret relationship, and never where others can hear; nobody else mentions it.\n`;
}

// The people, the content she must make, continuity and her numbers: the
// blocks between the wardrobe and the beat plan. Shared with the Script
// tab's writer (groundedScriptGeneratorService; Script tab audit,
// 2026-10-15), which has its own season block, so it passes withSeason false.
function storyContextBlocks(context, { withSeason = true } = {}) {
  // Social profiles — host + guests with real voices
  let socialBlock = '';
  if (context.socialProfiles?.length > 0) {
    socialBlock = '═══ CHARACTERS AT THE EVENT ═══\n';
    if (context.socialProfiles.some(p => p.story_role !== null && p.story_role !== undefined) || context.unfeaturedGuestCount > 0) {
      socialBlock += 'Featured guests below are the named people the episode may use; others attending are present but not story participants.\n';
    }
    socialBlock += context.socialProfiles.map(p => {
      let block = `${p.creator_name || p.display_name || p.handle} (@${p.handle}, ${p.platform})
  Archetype: ${p.archetype || 'unknown'} | Tier: ${p.celebrity_tier || 'accessible'}
  Voice: ${p.posting_voice || 'Standard social media voice'}
  Lala follows because: ${p.follow_motivation || 'general interest'}${p.follow_emotion ? ` (feels: ${p.follow_emotion})` : ''}`;
      const lala = lalaTieLines(p);
      if (lala.story) block += `\n  ${lala.story}`;
      if (p.story_role) block += `\n  Story role: ${p.story_role}`;
      if (lala.withLala) block += `\n  ${lala.withLala}`;

      // Character literary depth (from registry) + therapy + life simulation
      if (p.core_belief || p.pressure_type || p.depth_level || p.core_wound || p.wound || p.want_architecture) {
        block += `\n  ── CHARACTER DEPTH ──`;
        if (p.role_type) block += `\n  Role: ${p.role_type}${p.role_label ? ` — ${p.role_label}` : ''}`;
        if (p.character_archetype) block += `\n  Archetype: ${p.character_archetype}`;
        if (p.core_belief) block += `\n  Core Belief: "${p.core_belief}"`;
        if (p.pressure_type) block += `\n  Pressure: ${p.pressure_type}${p.pressure_quote ? ` — "${p.pressure_quote}"` : ''}`;
        if (p.depth_level) block += `\n  Depth: ${p.depth_level} (${p.depth_level === 'sparked' ? 'surface only — keep dialogue simple' : p.depth_level === 'breathing' ? 'emerging complexity — hints of inner life' : p.depth_level === 'active' ? 'full inner world — internal monologue, contradictions' : 'fully alive — nuanced reactions, wound patterns visible'})`;

        // Their inner life as the episode may use it: it shapes what they
        // do and is never said (services/characterStoryBrief).
        const brief = storyBrief(p, { layer: 'episode', secrets: p.secrets });
        if (brief.lines.length) block += `\n  ${brief.lines.join('\n  ')}`;
        if (p.therapy_primary_defense) block += `\n  Primary Defense: ${p.therapy_primary_defense}`;
        if (p.signature_trait) block += `\n  Signature Trait: ${p.signature_trait}`;
        if (p.emotional_baseline) block += `\n  Baseline: ${p.emotional_baseline}`;

        // Emotional state from therapy (if available)
        if (p.therapy_emotional_state) {
          const tes = typeof p.therapy_emotional_state === 'string' ? JSON.parse(p.therapy_emotional_state) : p.therapy_emotional_state;
          const highEmotions = Object.entries(tes).filter(([_, v]) => v >= 4).map(([k, v]) => `${k}(${v})`);
          if (highEmotions.length > 0) block += `\n  High Emotions: ${highEmotions.join(', ')}`;
        }

        // Legacy personality fields
        if (p.personality?.wound) block += `\n  Wound Pattern: ${p.personality.wound}`;
        if (p.personality?.defense) block += `\n  Defense: ${p.personality.defense}`;
        if (p.char_description) block += `\n  Character: ${p.char_description.slice(0, 150)}`;
      }

      block += `\n  SCRIPT DIRECTIVE: When this character speaks, use THEIR voice. ${p.depth_level === 'alive' ? `Show their wound patterns and defense mechanisms in subtle behavior: under pressure the private truth shows in what they do, never in what anyone says about it.` : p.depth_level === 'active' ? `Include internal contradictions — what they say vs what they mean.${p.therapy_primary_defense ? ` Default defense: ${p.therapy_primary_defense}.` : ''}` : 'Keep them consistent with their archetype.'}`;

      return block;
    }).join('\n\n');
    if (context.unfeaturedGuestCount > 0) {
      socialBlock += `\n\n${context.unfeaturedGuestCount} more guest${context.unfeaturedGuestCount === 1 ? '' : 's'} attending — present, but not story participants.`;
    }
    socialBlock += familyBlock(context.familyLines);
    socialBlock += '\n';
  }

  // Social tasks — content Lala needs to create
  let taskBlock = '';
  if (context.socialTasks?.length > 0) {
    const required = context.socialTasks.filter(t => t.required);
    const before = context.socialTasks.filter(t => t.timing === 'before');
    const during = context.socialTasks.filter(t => t.timing === 'during');
    const after = context.socialTasks.filter(t => t.timing === 'after');
    taskBlock = `═══ SOCIAL MEDIA TASKS (${context.socialTasks.length} total, ${required.length} required) ═══\n`;
    if (before.length > 0) taskBlock += `BEFORE: ${before.map(t => t.label).join(', ')}\n`;
    if (during.length > 0) taskBlock += `DURING: ${during.map(t => t.label).join(', ')}\n`;
    if (after.length > 0) taskBlock += `AFTER: ${after.map(t => t.label).join(', ')}\n`;
    taskBlock += 'SCRIPT DIRECTIVE: Lala must reference creating this content — filming stories, going live, angling her phone. The content tasks are part of the episode action.\n';
  }

  // Previous episode continuity
  let prevBlock = '';
  if (context.previousEpisode) {
    const p = context.previousEpisode;
    prevBlock = `═══ PREVIOUS EPISODE ═══\n"${p.title}" (Episode ${p.episode_number}) — ${p.tier?.toUpperCase()} (${p.score}/100)\n${p.narrative || ''}\nSCRIPT DIRECTIVE: Reference what happened last time — ${p.tier === 'slay' ? 'Lala is riding high from her win' : p.tier === 'fail' ? 'Lala has something to prove after last week' : 'Lala is building momentum'}.\n`;
  }

  // Arc phase
  let arcBlock = '';
  if (context.arcPhase) {
    const a = context.arcPhase;
    const phase = a.phase_title ? `Phase ${a.current_phase}: ${a.phase_title}` : `Phase ${a.current_phase}`;
    arcBlock = `═══ SEASON ARC ═══\n${a.name || 'Current Arc'} — ${phase}\n`;
    if (a.emotional_arc) arcBlock += `Phase emotional arc: ${a.emotional_arc}\n`;
    arcBlock += `Emotional Temperature: ${a.emotional_temperature || 'neutral'}\n`;
    if (a.narrative_debt_summary) arcBlock += `${a.narrative_debt_summary}\n`;
    arcBlock += 'SCRIPT DIRECTIVE: The emotional tone of this episode should match the season phase.\n';
  }
  if (withSeason) arcBlock += buildSeasonPositionBlock(context.seasonPosition);

  // The season twists to plant or pay off here (services/seasonTwists), by
  // both writers: the Script tab's passes withSeason false for its own
  // season block, not for these.
  const twistBlock = context.twistBlock || '';
  const secrecyBlock = context.secrecyBlock || '';
  const carryBlock = context.carryBlock || '';

  // Designed intent direction
  let intentBlock = '';
  if (context.designedIntent) {
    const directions = {
      slay: 'This episode is DESIGNED TO SLAY. Build toward triumph. Outfit lands, content kills, event goes perfectly. But make the audience feel the stakes — success was not guaranteed.',
      pass: 'This episode should land solidly. Good but not perfect. Small wins, small missteps. Lala grows but the room doesn\'t part for her.',
      safe: 'This is a transitional episode. Nothing dramatic. But plant seeds — a look from someone, a notification she ignores, a price she doesn\'t check.',
      fail: 'This episode is DESIGNED TO FAIL. Build toward it gradually — a wrong outfit choice, a social faux pas, content that doesn\'t land. Make the audience feel it coming.',
    };
    intentBlock = `═══ EPISODE DIRECTION ═══\n${directions[context.designedIntent] || ''}\n`;
  }

  // Character state — exact numbers for internal monologue
  let charBlock = '';
  if (context.characterState) {
    const cs = context.characterState;
    charBlock = `═══ LALA'S STATS ═══\n🪙 ${cs.coins} coins | ⭐ ${cs.reputation}/10 rep | 🤝 ${cs.brand_trust}/10 trust | 📣 ${cs.influence}/10 influence | 😰 ${cs.stress}/10 stress\nSCRIPT DIRECTIVE: When she checks her balance, use the exact number as it stands at that point: this one before any coin line, and after the coin lines the number they leave (after the look, LALA'S COINS gives it when it is given); never another.\n`;
  }

  const pulseBlock = require('./scriptPulsePosts').pulseScriptBlock(context.pulsePosts);

  return [socialBlock, secrecyBlock, pulseBlock, taskBlock, prevBlock, carryBlock, arcBlock, twistBlock, intentBlock, charBlock].filter(Boolean).join('\n');
}

// Lala's money for the prompt: pressure, balance, the episode so far, and
// whether she can afford the event. Shared with the Script tab's writer.
function financialContextText(financial) {
  let financialContext = 'Financial data not available';
  if (financial) {
    const emoji = financial.pressure_level === 'desperate' ? '🚨'
      : financial.pressure_level === 'tight' ? '⚠️'
      : financial.pressure_level === 'comfortable' ? '✅'
      : '💰';
    financialContext = `${emoji} FINANCIAL PRESSURE: ${financial.pressure_level.toUpperCase()}
  Lala's balance: ${financial.balance} Prime Coins
  This episode so far: income ${financial.total_income} Prime Coins | expenses ${financial.total_expenses} Prime Coins
  Financial score: ${financial.financial_score || 'N/A'}`;
    if (financial.event_cost) {
      financialContext += `\n  Event cost: ${financial.event_cost} coins | Can afford: ${financial.can_afford ? 'YES' : 'NO — THIS CREATES TENSION'}`;
    }
    if (financial.pressure_level === 'desperate' || financial.pressure_level === 'tight') {
      financialContext += `\n  SCRIPT DIRECTIVE: Lala's financial stress should bleed into her behavior — checking prices, hesitating at checkout, inner monologue about money.`;
    }
  }
  return financialContext;
}

/**
 * Build the full prompt for Claude
 */
// The episode's place in the season (§8(ff) A5): "S1 · E7", its phase and
// the slot's intention. Empty when the episode has no season context.
// A10: "The script writer receives all purposes, primary first", each with
// the story thread it continues.
function buildSeasonPositionBlock(sc) {
  if (!sc || !sc.label) return '';
  const phase = sc.phase?.title ? `Phase ${sc.phase.number}: ${sc.phase.title}` : `Phase ${sc.phase?.number ?? '?'}`;
  let block = `═══ SEASON POSITION ═══\n${sc.label} — ${phase}${sc.position_in_phase ? `, episode ${sc.position_in_phase} of the phase` : ''}\n`;
  const purposes = seasonPurposes(sc);
  if (purposes.length === 1) {
    block += `Story purpose: ${purposes[0].text}\n`;
    if (purposes[0].story_thread) block += `Story thread it continues: ${purposes[0].story_thread}\n`;
  } else if (purposes.length > 1) {
    block += 'Story purposes (primary first):\n';
    purposes.forEach((p, i) => {
      block += `${i + 1}. ${p.primary ? '[Primary] ' : ''}${p.text}${p.story_thread ? ` (continues the thread "${p.story_thread}")` : ''}\n`;
    });
  }
  if (sc.career_focus) block += `Career focus: ${sc.career_focus}\n`;
  if (sc.desired_pressure) block += `Desired pressure: ${sc.desired_pressure}\n`;
  const range = sc.outcome_range;
  if (range && (range.min || range.max)) block += `Hoped-for outcome: ${range.min || '?'} to ${range.max || '?'}\n`;
  block += purposes.length > 1
    ? 'SCRIPT DIRECTIVE: This episode serves its place in the season; the primary purpose leads, and the others are woven in.\n'
    : 'SCRIPT DIRECTIVE: This episode serves its place in the season; the story purpose above is what it is for.\n';
  return block;
}

/**
 * A10: the snapshot's purposes, primary first. A snapshot written before
 * A10 has only story_purpose and story_thread.
 */
function seasonPurposes(sc) {
  // A purpose may name only a thread; it then reads as continuing that thread.
  const list = (Array.isArray(sc?.story_purposes) ? sc.story_purposes : [])
    .filter((p) => p && (p.text || p.story_thread))
    .map((p) => (p.text ? p : { ...p, text: `Continue the thread "${p.story_thread}"`, story_thread: null }));
  if (list.length) return [...list.filter((p) => p.primary), ...list.filter((p) => !p.primary)];
  return sc?.story_purpose ? [{ text: sc.story_purpose, primary: true, story_thread: sc.story_thread || null }] : [];
}

/**
 * The people among `characterIds` in a confirmed romantic relationship with
 * Lala (her registry character, the one services/whichLala names, which the
 * Relationships page shows; it used to match any registry's Lala):
 * Map(id -> its note, the relationship's situation or notes, or ''). Empty
 * when none or on a failed read.
 */
async function lalaRomances(sequelize, characterIds) {
  const ids = [...new Set((characterIds || []).filter(Boolean))];
  const out = new Map();
  if (!ids.length) return out;
  try {
    const lala = await require('./whichLala').lalaId(sequelize);
    if (!lala) return out;
    const [rows] = await sequelize.query(
      `SELECT CASE WHEN cr.character_id_a = :lala THEN cr.character_id_b ELSE cr.character_id_a END AS other,
              COALESCE(cr.situation, cr.notes, '') AS note
         FROM character_relationships cr
        WHERE cr.deleted_at IS NULL AND cr.is_romantic = true AND cr.confirmed = true
          AND :lala IN (cr.character_id_a, cr.character_id_b)
          AND (cr.character_id_a IN (:ids) OR cr.character_id_b IN (:ids))
        ORDER BY cr.updated_at DESC`, { replacements: { ids, lala } });
    for (const r of rows || []) if (!out.has(r.other)) out.set(r.other, String(r.note || '').trim().slice(0, 300));
  } catch (err) {
    console.error('[ScriptWriter] Lala\'s romances could not be read (non-blocking):', err.message);
  }
  return out;
}

// A guest's tie to Lala (social_profiles.lala_relationship), as the
// script should play it; the character page's labels (lib/characterPage).
const LALA_TIES = {
  direct: 'friends; they talk directly',
  aware: 'knows of her; they have not really met',
  one_sided: 'follows Lala; Lala barely knows them',
  mutual_unaware: "in Lala's circles; same world, not close",
  competitive: "Lala's rival; every exchange is a contest",
  justawoman: 'JustAWoman herself',
};

const parseJsonField = (v, fallback) => {
  if (v == null) return fallback;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch (err) { console.error('[ScriptWriter] event JSON field did not parse:', err.message); return fallback; }
};

/** The invitation's words as stored (canon_consequences.invitation_text): a string, or the generator's { opening, body, closing }. */
function invitationWords(event) {
  const t = parseJsonField(event?.canon_consequences, {})?.invitation_text;
  if (!t) return null;
  if (typeof t === 'string') return t.trim() || null;
  if (typeof t !== 'object') return null;
  const body = Array.isArray(t.body) ? t.body.join(' ') : t.body;
  return [t.opening, t.eventName, body, t.closing].filter((x) => typeof x === 'string' && x.trim()).join(' / ') || null;
}

/**
 * The EVENT block: what the event is, where and when, its look and feel,
 * how strict it is, what she needs to get in and what she may not do, and
 * the invitation's words (Evoni, 2026-10-09: the script was missing them).
 */
function eventContextBlock(event) {
  if (!event) return 'No event assigned';
  const lines = [`EVENT: ${event.name}`];
  if (event.description) lines.push(`  What it is: ${String(event.description).slice(0, 600)}`);
  lines.push(`  Type: ${event.event_type} | Prestige: ${event.prestige}/10 | Cost: ${event.cost_coins} coins`);
  const where = [event.venue_name, event.venue_address].filter(Boolean).join(', ');
  const when = [event.event_date, event.event_time].filter(Boolean).join(', ');
  if (where) lines.push(`  Where: ${where}`);
  if (when) lines.push(`  When: ${when}`);
  lines.push(`  Dress code: ${event.dress_code || 'Not specified'}`);
  const palette = (Array.isArray(parseJsonField(event.color_palette, null)) ? parseJsonField(event.color_palette, []) : [])
    .map((c) => (typeof c === 'string' ? c : c?.name || c?.hex)).filter(Boolean);
  const feel = [event.theme && `theme ${event.theme}`, event.mood && `mood ${event.mood}`, palette.length && `palette ${palette.join(', ')}`].filter(Boolean);
  if (feel.length) lines.push(`  Look and feel: ${feel.join(' | ')}`);
  lines.push(`  Host: ${event.host || 'Unknown'}${event.host_brand ? ` (${event.host_brand})` : ''}`);
  if (event.strictness) lines.push(`  Strictness: ${event.strictness}/10${event.strictness >= 7 ? ' (they will notice a wrong look)' : ''}`);
  if (event.deadline_type && event.deadline_type !== 'none') {
    lines.push(`  Time pressure: ${String(event.deadline_type).replace(/_/g, ' ')}${event.deadline_minutes ? ` (${event.deadline_minutes}-minute deadline)` : ''}`);
  }
  const req = parseJsonField(event.requirements, {}) || {};
  const needs = [
    req.reputation_min && `reputation ${req.reputation_min}+`,
    req.brand_trust_min && `brand trust ${req.brand_trust_min}+`,
    req.coins_min && `${req.coins_min}+ coins`,
  ].filter(Boolean);
  if (needs.length) lines.push(`  To get in she needs: ${needs.join(', ')}`);
  const restrictions = (Array.isArray(parseJsonField(event.restrictions, [])) ? parseJsonField(event.restrictions, []) : [])
    .map((r) => (typeof r === 'string' ? r : r?.description)).filter((r) => typeof r === 'string' && r.trim());
  if (restrictions.length) lines.push(`  Restrictions she agreed to: ${restrictions.join('; ')}`);
  lines.push(`  Narrative stakes: ${event.narrative_stakes || 'None specified'}`);
  lines.push(`  Career tier: ${event.career_tier || 1}`);
  if (event.career_milestone) lines.push(`  Milestone: ${event.career_milestone}`);
  if (event.fail_consequence) lines.push(`  If she fails: ${event.fail_consequence}`);
  if (event.success_unlock) lines.push(`  If she succeeds: ${event.success_unlock}`);
  const invite = invitationWords(event);
  if (invite) lines.push(`  THE INVITATION (the words on screen at Beat 5; Lala reads from it, never contradicts it): "${invite.slice(0, 800)}"`);
  return lines.join('\n');
}

// Who speaks in a beat, as the Script tab's writer has it (its
// BEAT_TEMPLATES, from canonicalBeats): Lala in 3, 10, 13 and 14 too
// (Script page audit 3, 2026-10-19). Empty for a beat it does not know.
function speakers(grounded, number) {
  const t = grounded.BEAT_TEMPLATES[Number(number)];
  return t ? { jawihp: t.jawihp, lala: t.lala } : {};
}

function buildFullPrompt(context) {
  const { brief, scenePlan, event, financial, wardrobe, franchiseLaws, worldState, worldNow = '' } = context;
  // The show's rules as the Script tab's writer says them (Script page audit
  // 3, 2026-10-19: this prompt had a "[STAT: coins +50]" example, no
  // cutscene, no voice click and no beat 14 opportunity): its blocks, who
  // speaks in each beat, and how beat 14 ends, read from it, not copied.
  const grounded = require('./groundedScriptGeneratorService');
  const { beat14Context, beat14Outcome } = require('./beat14Opportunity');
  const intent = brief?.designed_intent || null;
  const hook = typeof brief?.forward_hook === 'string' ? brief.forward_hook.trim() : '';
  const ending = beat14Outcome(context.beat14 || null, intent);
  const onScreen = context.onScreen || [];
  const voiceIcon = require('../utils/scriptShowRules').voiceIconName(onScreen.filter((o) => o?.category === 'phone_icon' || o?.category === 'icon'));

  // Scene plan with full context
  const beatContext = scenePlan.length > 0
    ? scenePlan.map(b => {
        const tpl = { ...(BEAT_TEMPLATES[b.beat_number] || {}), ...speakers(grounded, b.beat_number) };
        const loc = b.sceneSet?.worldLocation;
        const feedMoment = b.feed_moment;
        const scriptLines = b.script_lines;

        let entry = `═══ BEAT ${b.beat_number}: ${b.beat_name || tpl.name} ═══
  LOCATION: ${b.sceneSet?.name || 'Unknown'} (${b.sceneSet?.scene_type || ''})
  ANGLE: ${b.angle_label || 'wide'} | SHOT: ${b.shot_type || 'medium'}
  SCENE CONTEXT: ${b.scene_context || b.sceneSet?.script_context || 'No description'}
  EMOTIONAL INTENT: ${b.emotional_intent || tpl.mood || ''}
  DIRECTOR NOTE: ${b.director_note || ''}
  UI ACTION: ${tpl.ui || ''}
  TRANSITION IN: ${b.transition_in || 'cut'}
  JAWIHP SPEAKS: ${tpl.jawihp} | LALA SPEAKS: ${tpl.lala}`;

        if (loc?.narrative_role) entry += `\n  NARRATIVE ROLE: ${loc.narrative_role}`;
        if (loc?.sensory_details?.atmosphere) entry += `\n  ATMOSPHERE: ${loc.sensory_details.atmosphere}`;

        // Feed moment for this beat
        if (feedMoment) {
          entry += `\n  ── FEED MOMENT ──`;
          entry += `\n  TRIGGER: ${feedMoment.trigger_profile || '?'} ${feedMoment.trigger_action || ''}`;
          if (feedMoment.phone_screen) {
            entry += `\n  PHONE SCREEN: [${feedMoment.phone_screen.type}] ${feedMoment.phone_screen.content || ''}`;
          }
          if (feedMoment.lala_dialogue) entry += `\n  LALA SAYS: "${feedMoment.lala_dialogue}"`;
          if (feedMoment.lala_internal) entry += `\n  LALA THINKS: "${feedMoment.lala_internal}"`;
          if (feedMoment.behavior_shift) entry += `\n  BEHAVIOR SHIFT: ${feedMoment.behavior_shift}`;
        }

        // Existing script lines (from scene planner)
        if (scriptLines) {
          entry += `\n  ── SCRIPT SEED ──`;
          if (scriptLines.lala_line) entry += `\n  LALA LINE: "${scriptLines.lala_line}"`;
          if (scriptLines.lala_internal) entry += `\n  LALA INTERNAL: "${scriptLines.lala_internal}"`;
          if (scriptLines.justawoman_action) entry += `\n  JAWIHP ACTION: ${scriptLines.justawoman_action}`;
          if (scriptLines.direction) entry += `\n  DIRECTION: ${scriptLines.direction}`;
        }

        return entry;
      }).join('\n\n')
    : 'No scene plan — write based on standard 14-beat structure';

  // Financial pressure context
  const financialContext = financialContextText(financial);

  // Wardrobe context
  let wardrobeContext = 'No outfit locked for this episode';
  if (wardrobe.length > 0) {
    wardrobeContext = `LOCKED OUTFIT (${wardrobe.length} pieces):`;
    for (const item of wardrobe) {
      const affordable = item.price ? (financial?.balance >= item.price ? 'owned' : 'stretch buy') : 'owned';
      wardrobeContext += `\n  - ${item.name} (${item.clothing_category}, ${item.tier || 'basic'}, ${affordable})`;
      if (item.brand) wardrobeContext += ` [${item.brand}]`;
      if (item.lala_reaction_own) wardrobeContext += `\n    Lala: "${item.lala_reaction_own}"`;
    }
    wardrobeContext += `\n\nBeat 8 (Transformation): Reference EACH piece by name as Lala gets dressed.`;
    wardrobeContext += `\nBeat 11 (The Event): Her outfit choice affects how the event goes.`;
  }

  // Wardrobe Intelligence (repeat detection, brand loyalty, match score, feed triggers)
  const wi = context.wardrobeIntelligence;
  if (wi?.script_context) {
    wardrobeContext += `\n\n═══ WARDROBE INTELLIGENCE ═══\n${wi.script_context}`;
  }

  // Event context (eventContextBlock)
  const eventContext = eventContextBlock(event);

  // Franchise laws
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

  // World state
  const stateContext = worldState?.character_states
    ? `\nLALA'S STATE: ${JSON.stringify(worldState.character_states).slice(0, 300)}`
    : '';

  return `You are writing a full episode script for "Styling Adventures with Lala."
This is Episode ${brief?.position_in_arc || '?'} of Arc ${brief?.arc_number || '?'}.

${JAWIHP_VOICE_DNA}

═══ SHOW BRAIN ═══
${voiceLaws}

CORE LAW: The show must NEVER feel like a dashboard. It must feel like a luxury life simulator where a real woman navigates beauty, money, and social pressure.

═══ EPISODE BRIEF ═══
Arc: ${brief?.arc_number || '?'}, Position: ${brief?.position_in_arc || '?'}/8
Archetype: ${brief?.episode_archetype || 'Rising'}
Designed intent: ${brief?.designed_intent || 'pass'}
Narrative purpose: ${brief?.narrative_purpose || 'Not set'}
Forward hook: ${brief?.forward_hook || 'Not set'}
Allowed outcomes: ${JSON.stringify(brief?.allowed_outcomes || [])}

═══ ${eventContext} ═══

═══ FINANCIAL CONTEXT ═══
${financialContext}
${careerBlock(context.career, { beat14: ending })}
${stateContext}
${worldNow}
═══ WARDROBE ═══
${wardrobeContext}

${storyContextBlocks(context)}
${beat14Context(context.beat14 || null, intent)}
═══ 14-BEAT SCENE PLAN ═══
${beatContext}

═══ WHAT HAPPENS ON SCREEN ═══
${grounded.screenLinesText()}

${grounded.justAWomanOnCamera()}

${grounded.showRulesBlock({ eventData: event, phone: context.phone || null, onScreen })}

═══ OUTPUT FORMAT ═══
Return a JSON array of 14 beats. Each beat object:
{
  "beat_number": 1,
  "beat_name": "Opening Ritual",
  "location": "Lala's Apartment",
  "angle": "wide",
  "lines": [
    { "speaker": "Me", "type": "dialogue", "text": "..." },
    { "speaker": null, "type": "direction", "text": "[UI:CLICK ${voiceIcon}]" },
    { "speaker": "Lala", "type": "dialogue", "text": "..." },
    { "speaker": null, "type": "action", "text": "(Camera pans...)" },
    { "speaker": null, "type": "direction", "text": "[TRANSITION: glow dissolve]" },
    { "speaker": null, "type": "stat", "text": "[STAT: reputation +1]" },
    { "speaker": "Lala", "type": "internal", "text": "She thinks: ..." },
    { "speaker": null, "type": "feed_moment", "text": "@handle posted: ..." }
  ]
}

═══ SCRIPT RULES ═══
1. Beat 8 MUST reference specific wardrobe items BY NAME
Every [UI:], [WEAR:], [TRANSITION:] or [SFX:] line of the rules above is a "direction" line and every [STAT:] line a "stat" line, its text exactly the bracket.
2. Feed moments: When a gameplay beat (1–10 and 14) has a FEED MOMENT, show Lala checking her phone, seeing the post, and reacting — both externally and internally; the cutscene (11–13) has no phone
3. Financial pressure: If money is tight, show Lala's internal stress about costs — checking prices, calculating, second-guessing
4. JAWIHP reacts in real time while she plays (beats 1–10 and 14) — she is the warm bridge between Lala and the audience; in the cutscene she comments a little (JUSTAWOMAN ON CAMERA)
5. Lala's lines are ALWAYS short and punchy — max 2-3 sentences
6. Community engagement: ask audience to react in comments at least twice
7. Stats only appear as "stat" type lines
8. Beat 14 ends on ${grounded.beat14Ending(ending, hook)}
9. Each beat should have 3-8 lines minimum — make them ALIVE
10. Inner monologue ("internal" type) reveals what Lala is REALLY feeling vs. what she shows
${context.career && careerBlock(context.career) ? "11. Lala's career is on the page: name the deal, what she owes and what she wants from the event in the beats the CAREER block gives them, in her words, never as a list\n" : ''}
Return ONLY the JSON array. No markdown, no preamble.`;
}

/**
 * Generate a full episode script
 */
// The Sonnet call: { text, usage, model }. Two attempts per model, as the AI
// routes try; a refused budget or a rate limit is not tried again, and the
// route answers it as a 429 (Script page audit 3, 2026-10-19).
async function writeScriptReply(prompt) {
  const { MODELS, isBudgetOrRateLimit } = require('./groundedScriptGeneratorService');
  let lastErr = null;
  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await getClient().messages.create({ model, max_tokens: 12000, messages: [{ role: 'user', content: prompt }] });
        return { text: response.content?.[0]?.text || '', usage: response.usage || null, model };
      } catch (err) {
        lastErr = err;
        console.error(`[ScriptWriter] ${model} attempt ${attempt} failed:`, err.message);
        if (isBudgetOrRateLimit(err)) throw err;
      }
    }
  }
  throw lastErr;
}

// The script text after the grounded writer's free fixes (its
// deterministicFixes), nothing approved to skip: the route puts the locked
// beats back after. A failed fix is logged and the text kept.
function scriptTextAfterFixes(scriptText, context) {
  try {
    const { deterministicFixes } = require('./groundedScriptGeneratorService');
    return deterministicFixes(scriptText, { money: context.money || null, phone: context.phone || null, onScreen: context.onScreen || [] }, new Set()).script;
  } catch (err) {
    console.error('[ScriptWriter] free fixes failed (non-blocking):', err.message);
    return scriptText;
  }
}

// What the show's rules need that the old writer did not read (Script page
// audit 3, 2026-10-19): beat 14's attached opportunity, the show's screens
// and icons, Lala's coins. Each read that fails is logged and left out.
async function loadRulesContext(context, episodeId, showId, models) {
  try {
    context.beat14 = await require('./beat14Opportunity').loadForScript(models, { episodeId });
  } catch (err) {
    console.error('[ScriptWriter] beat 14 opportunity read failed (non-blocking):', err.message);
    context.beat14 = null;
  }
  try {
    context.onScreen = showId ? await require('./uiOverlayService').getAllOverlayTypes(showId, models) : [];
  } catch (err) {
    console.error('[ScriptWriter] on-screen read failed (non-blocking):', err.message);
    context.onScreen = [];
  }
  try {
    context.money = showId ? await require('./scriptMoneyContext').loadScriptMoney(models.sequelize, { showId, episodeId, event: context.event || null }) : null;
  } catch (err) {
    console.error('[ScriptWriter] money read failed (non-blocking):', err.message);
    context.money = null;
  }
  return context;
}

async function generateEpisodeScript(episodeId, showId, models) {
  const context = await loadRulesContext(await loadScriptContext(episodeId, showId, models), episodeId, showId, models);

  const prompt = buildFullPrompt(context);
  const promptHash = crypto.createHash('sha256').update(prompt).digest('hex').slice(0, 16);

  console.log(`[ScriptWriter] Generating script for episode ${episodeId}`);
  console.log(`[ScriptWriter] Context: ${context.scenePlan.length} beats, ${context.wardrobe.length} wardrobe items, ${context.feedMoments.length} feed moments`);
  console.log(`[ScriptWriter] Financial: ${context.financial?.pressure_level || 'unknown'}, Event: ${context.event?.name || 'none'}`);

  const response = await writeScriptReply(prompt);

  const rawText = response.text;
  const tokens = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);


  // Parse JSON from response
  let scriptJson = null;
  try {
    // Find JSON array in the response
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      scriptJson = JSON.parse(jsonMatch[0]);
    }
  } catch (parseErr) {
    console.warn('[ScriptWriter] JSON parse failed, saving as text only:', parseErr.message);
  }

  // Render text version from JSON
  let scriptText = rawText;
  if (scriptJson) {
    scriptText = renderScriptText(scriptJson);
  }
  // The free fixes the Script tab's writer makes, before it is saved
  // (Script page audit 3, 2026-10-19): voice clicks, no phone in the
  // cutscene, no + coin line, the closet's coin lines.
  scriptText = scriptTextAfterFixes(scriptText, context);

  // Count words
  const wordCount = scriptText.split(/\s+/).filter(Boolean).length;

  // Get next version number
  const { EpisodeScript } = models;
  const lastVersion = await EpisodeScript.findOne({
    where: { episode_id: episodeId },
    order: [['version', 'DESC']],
    attributes: ['version'],
  }).catch(() => null);
  const nextVersion = (lastVersion?.version || 0) + 1;

  // Save the script
  const script = await EpisodeScript.create({
    episode_id: episodeId,
    show_id: showId,
    episode_brief_id: context.brief?.id || null,
    version: nextVersion,
    status: 'draft',
    title: context.event?.name ? `Script: ${context.event.name}` : `Script v${nextVersion}`,
    script_text: scriptText,
    script_json: scriptJson,
    generation_model: response.model,
    generation_tokens: tokens,
    generation_cost: (tokens / 1000000) * 3, // approximate
    generation_prompt_hash: promptHash,
    context_snapshot: {
      brief_id: context.brief?.id,
      event_name: context.event?.name,
      wardrobe_count: context.wardrobe.length,
      feed_moments_count: context.feedMoments.length,
      financial_pressure: context.financial?.pressure_level,
      career: context.career ? { deal: !!context.career.deal, deliverables: context.career.deliverables.length, goals: context.career.goals.length } : null,
    },
    feed_moments_used: context.feedMoments,
    financial_context: context.financial,
    wardrobe_locked: context.wardrobe.map(w => ({
      wardrobe_id: w.id, name: w.name, category: w.clothing_category,
      tier: w.tier, price: w.price,
    })),
    scene_angles_used: context.scenePlan.map(b => ({
      beat_number: b.beat_number, scene_set_id: b.scene_set_id,
      angle_label: b.angle_label,
      still_image_url: b.sceneSet?.angles?.[0]?.still_image_url || null,
    })),
    word_count: wordCount,
    beat_count: scriptJson?.length || 14,
  });

  // Also save to episode.script_content for backwards compat
  try {
    const { scriptKeepingLocks } = require('../utils/scriptBeatLocks');
    const current = await models.Episode.findByPk(episodeId, { attributes: ['id', 'script_content', 'script_locked_beats'] });
    const nextScript = scriptKeepingLocks(current, scriptText).script;
    // Version history (services/scriptVersions.js; History audit H2,
    // 2026-10-24): the episode's script this replaces is kept first.
    const { snapshotScript } = require('./scriptVersions');
    await snapshotScript(models, current, { source: 'generate', next: nextScript });
    await models.Episode.update(
      { script_content: nextScript },
      { where: { id: episodeId } }
    );
  } catch (err) { console.error('[ScriptWriter] Could not copy the script to the episode (non-blocking):', err.message); }

  // Track which franchise laws were injected
  if (context.franchiseLawIds?.length > 0 && models.FranchiseKnowledge) {
    try {
      await models.sequelize.query(
        `UPDATE franchise_knowledge
         SET injection_count = COALESCE(injection_count, 0) + 1,
             last_injected_at = NOW(),
             updated_at = NOW()
         WHERE id IN (:ids)`,
        { replacements: { ids: context.franchiseLawIds } }
      );
      console.log(`[ScriptWriter] Updated injection_count for ${context.franchiseLawIds.length} franchise entries`);
    } catch (trackErr) {
      console.warn('[ScriptWriter] Injection tracking failed:', trackErr.message);
    }
  }

  // Auto-run franchise guard on generated script: the first 100 active
  // entries in the show's scope and the shared order (services/brainRules;
  // wiring map fix-list item 25). It took whichever 100 Postgres returned,
  // from every show.
  let guardResult = null;
  try {
    const { selectRules } = require('./brainRules');
    const guardEntries = await selectRules(models.FranchiseKnowledge, { showId, limit: 100 });

    if (guardEntries.length > 0 && scriptText.length > 100) {
      const Anthropic = require('@anthropic-ai/sdk');
      const guardClient = new Anthropic();
      const rulesText = guardEntries.map(e => `[${e.severity}] ${e.title}: ${typeof e.content === 'string' ? e.content.slice(0, 200) : JSON.stringify(e.content).slice(0, 200)}`).join('\n');

      const guardRes = await guardClient.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{ role: 'user', content: `Check this script against these franchise rules. Report any violations.

RULES:
${rulesText}

SCRIPT (first 3000 chars):
${scriptText.slice(0, 3000)}

Return JSON: { "violations": [{"rule": "rule title", "explanation": "what's wrong"}], "passed": true/false, "rules_checked": ${guardEntries.length} }
Return ONLY the JSON.` }],
      });

      const guardText = guardRes.content?.[0]?.text || '';
      const guardMatch = guardText.match(/\{[\s\S]*\}/);
      if (guardMatch) {
        guardResult = JSON.parse(guardMatch[0]);
        guardResult.rules_checked = guardEntries.length;
      }
    }
  } catch (guardErr) {
    console.warn('[ScriptWriter] Auto-guard failed (non-blocking):', guardErr.message);
  }

  // Store guard result and injected entries on the script record
  try {
    await script.update({
      context_snapshot: {
        ...script.context_snapshot,
        franchise_laws_injected: context.franchiseLawIds,
        franchise_laws_count: context.franchiseLawIds?.length || 0,
        brain_rules: context.brainRules,
        guard_result: guardResult,
        guard_passed: guardResult?.passed ?? null,
        guard_violations: guardResult?.violations?.length || 0,
      },
    });
  } catch { /* non-blocking */ }

  return { ...script.toJSON(), guardResult };
}

/**
 * Render structured JSON script to human-readable text
 */
function renderScriptText(scriptJson) {
  if (!Array.isArray(scriptJson)) return '';

  // Under the Script tab's own beat headers (Script page audit 3,
  // 2026-10-19): the "═══ BEAT n ═══" headers it was saved with were not
  // beats to the Script tab, nor to the free fixes.
  const { CANONICAL_BEATS } = require('../constants/canonicalBeats');
  const { beatHeader } = require('../utils/canonicalScriptBeats');
  return scriptJson.map(beat => {
    const canon = CANONICAL_BEATS.find((c) => c.number === Number(beat.beat_number));
    const header = canon ? beatHeader(canon) : `## BEAT: ${beat.beat_number} · ${beat.beat_name || ''}`.trimEnd();
    const location = beat.location ? `[${beat.location} — ${beat.angle || 'wide'}]` : '';
    const lines = (beat.lines || []).map(line => {
      switch (line.type) {
        case 'dialogue':
          return `${line.speaker}: ${line.text}`;
        case 'action':
          return `(${line.text.replace(/^\(|\)$/g, '')})`;
        case 'direction':
          return line.text.startsWith('[') ? line.text : `[${line.text}]`;
        case 'stat':
          return line.text.startsWith('[') ? line.text : `[STAT: ${line.text}]`;
        case 'internal':
          return `*${line.speaker || 'Lala'} thinks: ${line.text}*`;
        case 'feed_moment':
          return `📱 ${line.text}`;
        default:
          return line.text;
      }
    }).join('\n');
    return [header, location, lines].filter(Boolean).join('\n');
  }).join('\n\n');
}

module.exports = { generateEpisodeScript, loadScriptContext, renderScriptText, buildFullPrompt, buildSeasonPositionBlock, eventContextBlock, storyContextBlocks, financialContextText, LALA_TIES, lalaRomances, writeScriptReply, scriptTextAfterFixes, familyBlock, relationshipSecrecyBlock, lalaTieLines };
