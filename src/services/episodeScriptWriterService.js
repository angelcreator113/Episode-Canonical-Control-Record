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
 * 8. Opportunity pipeline (career context)
 *
 * Output: Structured script_json + rendered script_text, saved as versioned EpisodeScript.
 */

const Anthropic = require('@anthropic-ai/sdk');
const crypto = require('crypto');

const CLAUDE_MODEL = 'claude-sonnet-4-6';
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
  11: { name: 'Event Outcome',        jawihp: true,  lala: true,  ui: 'ARRIVAL',                   mood: 'climax' },
  12: { name: 'Deliverable Creation', jawihp: false, lala: true,  ui: 'CONTENT_CREATE',            mood: 'accomplishment' },
  13: { name: 'Recap Panel',          jawihp: true,  lala: false, ui: 'STATS_UPDATE',              mood: 'reflection' },
  14: { name: 'Cliffhanger',          jawihp: true,  lala: false, ui: 'FADE_OUT',                  mood: 'suspense' },
};

/**
 * Load all context data for script generation
 */
async function loadScriptContext(episodeId, showId, models) {
  const { EpisodeBrief, ScenePlan, SceneSet, SceneAngle, FranchiseKnowledge,
          WorldEvent, WorldLocation, Opportunity, sequelize } = models;

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

  // 3. Event data
  context.event = null;
  try {
    context.event = await WorldEvent.findOne({
      where: { used_in_episode_id: episodeId },
    }).then(e => e?.toJSON());
  } catch { /* non-blocking */ }

  // 4. Financial state
  context.financial = null;
  try {
    const episode = await models.Episode.findByPk(episodeId);
    if (episode) {
      const income = parseFloat(episode.total_income) || 0;
      const expenses = parseFloat(episode.total_expenses) || 0;
      context.financial = {
        total_income: income,
        total_expenses: expenses,
        balance: income - expenses,
        financial_score: episode.financial_score,
        pressure_level: income - expenses < 0 ? 'desperate'
          : income - expenses < 500 ? 'tight'
          : income - expenses < 2000 ? 'comfortable'
          : 'flush',
      };
      // Add event cost if available
      if (context.event?.cost_coins) {
        context.financial.event_cost = context.event.cost_coins;
        context.financial.can_afford = (income - expenses) >= context.event.cost_coins;
      }
    }
  } catch { /* non-blocking */ }

  // 5. Wardrobe for this episode
  context.wardrobe = [];
  try {
    const [rows] = await sequelize.query(
      `SELECT w.id, w.name, w.clothing_category, w.brand, w.price, w.tier,
              w.aesthetic_tags, w.event_types, w.occasion, w.coin_cost,
              w.lala_reaction_own, w.acquisition_type, w.is_owned,
              w.s3_url_processed, w.thumbnail_url
       FROM episode_wardrobe ew
       JOIN wardrobe w ON w.id = ew.wardrobe_id AND w.deleted_at IS NULL
       WHERE ew.episode_id = :episodeId`,
      { replacements: { episodeId } }
    );
    context.wardrobe = rows || [];
  } catch { /* non-blocking */ }

  // 5b. Wardrobe Intelligence — repeat detection, brand loyalty, outfit scoring
  context.wardrobeIntelligence = null;
  if (context.wardrobe.length > 0 && context.event) {
    try {
      const { getWardrobeIntelligence } = require('./wardrobeIntelligenceService');
      context.wardrobeIntelligence = await getWardrobeIntelligence(context.wardrobe, context.event, showId, models);
    } catch (wiErr) {
      console.warn('[ScriptWriter] Wardrobe intelligence failed (non-blocking):', wiErr.message);
    }
  }

  // 6. Show Brain franchise laws
  context.franchiseLaws = [];
  if (FranchiseKnowledge) {
    try {
      context.franchiseLaws = await FranchiseKnowledge.findAll({
        where: { status: 'active', always_inject: true },
        attributes: ['title', 'content', 'category'],
        limit: 50,
      }).then(laws => laws.map(l => l.toJSON()));
    } catch { /* non-blocking */ }
  }

  // 7. Feed moments from scene plan
  context.feedMoments = context.scenePlan
    .filter(b => b.feed_moment)
    .map(b => ({ beat_number: b.beat_number, ...b.feed_moment }));

  // 8. Active opportunities (career context)
  context.opportunities = [];
  if (Opportunity) {
    try {
      context.opportunities = await Opportunity.findAll({
        where: {
          show_id: showId,
          status: ['offered', 'considering', 'booked', 'preparing', 'active'],
        },
        attributes: ['name', 'opportunity_type', 'status', 'brand_or_company', 'prestige',
                     'payment_amount', 'career_impact', 'emotional_arc'],
        limit: 10,
        order: [['prestige', 'DESC']],
      }).then(opps => opps.map(o => o.toJSON()));
    } catch { /* non-blocking */ }
  }

  // 9. Lala's world state
  context.worldState = null;
  try {
    const [rows] = await sequelize.query(
      `SELECT * FROM world_state_snapshots WHERE show_id = :showId ORDER BY created_at DESC LIMIT 1`,
      { replacements: { showId } }
    );
    context.worldState = rows?.[0] || null;
  } catch { /* non-blocking */ }

  // 10. Social profiles — host + guests for real character voices
  context.socialProfiles = [];
  try {
    const auto = context.event?.canon_consequences?.automation || {};
    const profileIds = [auto.host_profile_id, ...(auto.guest_profiles || []).map(g => g.profile_id)].filter(Boolean);
    if (profileIds.length > 0) {
      const [rows] = await sequelize.query(
        `SELECT id, handle, display_name, creator_name, platform, archetype, posting_voice,
                content_persona, lala_relevance_score, celebrity_tier, follow_motivation
         FROM social_profiles WHERE id IN (:ids) AND deleted_at IS NULL`,
        { replacements: { ids: profileIds } }
      );
      context.socialProfiles = rows || [];
    }
  } catch { /* non-blocking */ }

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

  // 13. Arc / season phase — emotional temperature
  context.arcPhase = null;
  try {
    const [arc] = await sequelize.query(
      `SELECT name, current_phase, phase_title, emotional_temperature FROM show_arcs
       WHERE show_id = :showId AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`,
      { replacements: { showId }, type: sequelize.QueryTypes.SELECT }
    );
    context.arcPhase = arc || null;
  } catch { /* non-blocking */ }

  // 14. Character state — exact coin balance for internal monologue
  context.characterState = null;
  try {
    const [state] = await sequelize.query(
      `SELECT coins, reputation, brand_trust, influence, stress FROM character_state
       WHERE show_id = :showId AND character_key = 'justawoman' LIMIT 1`,
      { replacements: { showId }, type: sequelize.QueryTypes.SELECT }
    );
    context.characterState = state || null;
  } catch { /* non-blocking */ }

  // 15. Designed intent from brief — SLAY/PASS/SAFE/FAIL direction
  context.designedIntent = context.brief?.designed_intent || null;

  return context;
}

/**
 * Build the full prompt for Claude
 */
function buildFullPrompt(context) {
  const { brief, scenePlan, event, financial, wardrobe, franchiseLaws, opportunities, worldState } = context;

  // Scene plan with full context
  const beatContext = scenePlan.length > 0
    ? scenePlan.map(b => {
        const tpl = BEAT_TEMPLATES[b.beat_number] || {};
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
  let financialContext = 'Financial data not available';
  if (financial) {
    const emoji = financial.pressure_level === 'desperate' ? '🚨'
      : financial.pressure_level === 'tight' ? '⚠️'
      : financial.pressure_level === 'comfortable' ? '✅'
      : '💰';
    financialContext = `${emoji} FINANCIAL PRESSURE: ${financial.pressure_level.toUpperCase()}
  Income: $${financial.total_income} | Expenses: $${financial.total_expenses} | Balance: $${financial.balance}
  Financial score: ${financial.financial_score || 'N/A'}`;
    if (financial.event_cost) {
      financialContext += `\n  Event cost: ${financial.event_cost} coins | Can afford: ${financial.can_afford ? 'YES' : 'NO — THIS CREATES TENSION'}`;
    }
    if (financial.pressure_level === 'desperate' || financial.pressure_level === 'tight') {
      financialContext += `\n  SCRIPT DIRECTIVE: Lala's financial stress should bleed into her behavior — checking prices, hesitating at checkout, inner monologue about money.`;
    }
  }

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
    wardrobeContext += `\nBeat 11 (Event Outcome): Her outfit choice affects how the event goes.`;
  }

  // Wardrobe Intelligence (repeat detection, brand loyalty, match score, feed triggers)
  const wi = context.wardrobeIntelligence;
  if (wi?.script_context) {
    wardrobeContext += `\n\n═══ WARDROBE INTELLIGENCE ═══\n${wi.script_context}`;
  }

  // Event context
  let eventContext = 'No event assigned';
  if (event) {
    eventContext = `EVENT: ${event.name}
  Type: ${event.event_type} | Prestige: ${event.prestige}/10 | Cost: ${event.cost_coins} coins
  Dress code: ${event.dress_code || 'Not specified'}
  Host: ${event.host || 'Unknown'}${event.host_brand ? ` (${event.host_brand})` : ''}
  Narrative stakes: ${event.narrative_stakes || 'None specified'}
  Career tier: ${event.career_tier || 1}`;
    if (event.career_milestone) eventContext += `\n  Milestone: ${event.career_milestone}`;
    if (event.fail_consequence) eventContext += `\n  If she fails: ${event.fail_consequence}`;
    if (event.success_unlock) eventContext += `\n  If she succeeds: ${event.success_unlock}`;
  }

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

  // Opportunities context
  let oppContext = '';
  if (opportunities.length > 0) {
    oppContext = `\n═══ ACTIVE CAREER PIPELINE ═══\n`;
    oppContext += opportunities.map(o =>
      `- ${o.name} (${o.opportunity_type}, prestige ${o.prestige}/10, ${o.status}) — ${o.career_impact || ''}`
    ).join('\n');
    oppContext += `\nSCRIPT DIRECTIVE: Lala is aware of her career pipeline. Upcoming opportunities fuel her motivation and anxiety.`;
  }

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
${oppContext}
${stateContext}

═══ WARDROBE ═══
${wardrobeContext}

${(() => {
  // Social profiles — host + guests with real voices
  let socialBlock = '';
  if (context.socialProfiles?.length > 0) {
    socialBlock = '═══ CHARACTERS AT THE EVENT ═══\n';
    socialBlock += context.socialProfiles.map(p =>
      `${p.creator_name || p.display_name || p.handle} (@${p.handle}, ${p.platform})
  Archetype: ${p.archetype || 'unknown'} | Tier: ${p.celebrity_tier || 'accessible'}
  Voice: ${p.posting_voice || 'Standard social media voice'}
  Lala follows because: ${p.follow_motivation || 'general interest'}
  SCRIPT DIRECTIVE: When this character speaks, use THEIR voice — not generic dialogue.`
    ).join('\n\n');
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
    arcBlock = `═══ SEASON ARC ═══\n${context.arcPhase.name || 'Current Arc'} — Phase: ${context.arcPhase.phase_title || context.arcPhase.current_phase}\nEmotional Temperature: ${context.arcPhase.emotional_temperature || 'neutral'}\nSCRIPT DIRECTIVE: The emotional tone of this episode should match the season phase.\n`;
  }

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
    charBlock = `═══ LALA'S STATS ═══\n🪙 ${cs.coins} coins | ⭐ ${cs.reputation}/10 rep | 🤝 ${cs.brand_trust}/10 trust | 📣 ${cs.influence}/10 influence | 😰 ${cs.stress}/10 stress\nSCRIPT DIRECTIVE: Use the exact coin number in Lala's internal monologue when she checks her balance.\n`;
  }

  return [socialBlock, taskBlock, prevBlock, arcBlock, intentBlock, charBlock].filter(Boolean).join('\n');
})()}
═══ 14-BEAT SCENE PLAN ═══
${beatContext}

═══ OUTPUT FORMAT ═══
Return a JSON array of 14 beats. Each beat object:
{
  "beat_number": 1,
  "beat_name": "Opening Ritual",
  "location": "Lala's Apartment",
  "angle": "wide",
  "lines": [
    { "speaker": "Me", "type": "dialogue", "text": "..." },
    { "speaker": "Lala", "type": "dialogue", "text": "..." },
    { "speaker": null, "type": "action", "text": "(Camera pans...)" },
    { "speaker": null, "type": "direction", "text": "[TRANSITION: glow dissolve]" },
    { "speaker": null, "type": "stat", "text": "[STAT: coins +50]" },
    { "speaker": "Lala", "type": "internal", "text": "She thinks: ..." },
    { "speaker": null, "type": "feed_moment", "text": "@handle posted: ..." }
  ]
}

═══ SCRIPT RULES ═══
1. Beat 8 MUST reference specific wardrobe items BY NAME
2. Feed moments: When a beat has a FEED MOMENT, show Lala checking her phone, seeing the post, and reacting — both externally and internally
3. Financial pressure: If money is tight, show Lala's internal stress about costs — checking prices, calculating, second-guessing
4. JAWIHP reacts to EVERYTHING in real time — she is the warm bridge between Lala and the audience
5. Lala's lines are ALWAYS short and punchy — max 2-3 sentences
6. Community engagement: ask audience to react in comments at least twice
7. Stats only appear as "stat" type lines
8. End Beat 14 with a forward hook that seeds the next episode
9. Each beat should have 3-8 lines minimum — make them ALIVE
10. Inner monologue ("internal" type) reveals what Lala is REALLY feeling vs. what she shows

Return ONLY the JSON array. No markdown, no preamble.`;
}

/**
 * Generate a full episode script
 */
async function generateEpisodeScript(episodeId, showId, models) {
  const context = await loadScriptContext(episodeId, showId, models);

  const prompt = buildFullPrompt(context);
  const promptHash = crypto.createHash('sha256').update(prompt).digest('hex').slice(0, 16);

  console.log(`[ScriptWriter] Generating script for episode ${episodeId}`);
  console.log(`[ScriptWriter] Context: ${context.scenePlan.length} beats, ${context.wardrobe.length} wardrobe items, ${context.feedMoments.length} feed moments`);
  console.log(`[ScriptWriter] Financial: ${context.financial?.pressure_level || 'unknown'}, Event: ${context.event?.name || 'none'}`);

  const response = await getClient().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 12000,
    messages: [{ role: 'user', content: prompt }],
  });

  const rawText = response.content[0]?.text || '';
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
    generation_model: CLAUDE_MODEL,
    generation_tokens: tokens,
    generation_cost: (tokens / 1000000) * 3, // approximate
    generation_prompt_hash: promptHash,
    context_snapshot: {
      brief_id: context.brief?.id,
      event_name: context.event?.name,
      wardrobe_count: context.wardrobe.length,
      feed_moments_count: context.feedMoments.length,
      financial_pressure: context.financial?.pressure_level,
      opportunities_count: context.opportunities.length,
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
    await models.Episode.update(
      { script_content: scriptText },
      { where: { id: episodeId } }
    );
  } catch { /* non-blocking */ }

  return script;
}

/**
 * Render structured JSON script to human-readable text
 */
function renderScriptText(scriptJson) {
  if (!Array.isArray(scriptJson)) return '';

  return scriptJson.map(beat => {
    const header = `\n═══ BEAT ${beat.beat_number}: ${beat.beat_name} ═══`;
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

module.exports = { generateEpisodeScript, loadScriptContext, renderScriptText };
