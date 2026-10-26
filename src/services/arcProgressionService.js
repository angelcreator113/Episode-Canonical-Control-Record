'use strict';

/**
 * Arc Progression Service
 *
 * Manages arc and phase transitions with automatic triggers and manual overrides.
 *
 * Auto: Episode completion triggers phase check → advance if boundary reached.
 * Manual: Showrunner can force advance/extend with warnings about narrative impact.
 *
 * Narrative debt: Failed goals from previous phases carry forward as emotional
 * weight that feeds into AI prompt generation for scripts, feed, and events.
 */

const { v4: uuidv4 } = require('uuid');

// ── EMOTIONAL TEMPERATURE CALCULATION ───────────────────────────────────────

function computeEmotionalTemperature(arc) {
  const debt = arc.narrative_debt || [];
  const phases = arc.phases || [];
  const currentPhase = phases.find(p => p.phase === arc.current_phase);

  if (!currentPhase?.goal_summary) return 'rising';

  const { completed = 0, failed = 0, total = 1 } = currentPhase.goal_summary;
  const debtCount = debt.length;
  const completionRate = completed / Math.max(1, total);

  if (completionRate >= 0.8 && debtCount === 0) return 'unstoppable';
  if (completionRate >= 0.6 && debtCount <= 1) return 'confident';
  if (completionRate >= 0.4) return 'rising';
  if (debtCount >= 3) return 'desperate';
  if (failed >= 2) return 'broken';
  return 'anxious';
}

// ── SEED A SEASON ───────────────────────────────────────────────────────────

/**
 * Seeds the show's next season: an arc with 3 phases and its 24 slots, in one
 * transaction. `setup` is the "Set up the season" form, already checked
 * (seasonSetupService.normaliseSetup); without it the defaults are used
 * (Season 1's original wording, or "Season N"). The arc and season numbers
 * follow the show's last (Season 2 after Season 1 is complete). Returns
 * { exists: true } when a season is still in progress.
 */
async function seedArc(showId, models, { setup = null } = {}) {
  const { sequelize } = models;
  const { nextNumbers, defaultSetup, buildPhases } = require('./seasonSetupService');

  return sequelize.transaction(async (transaction) => {
    // One seed at a time per show, so two clicks cannot make two seasons.
    await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:key))', { replacements: { key: `season-seed:${showId}` }, transaction });
    const [existing] = await sequelize.query(
      `SELECT id, season_number FROM show_arcs WHERE show_id = :showId AND status = 'active' AND deleted_at IS NULL
        ORDER BY arc_number ASC LIMIT 1`,
      { replacements: { showId }, transaction }
    );
    if (existing?.length > 0) return { exists: true, arc_id: existing[0].id, season_number: existing[0].season_number || 1 };

    const { arc_number: arcNumber, season_number: seasonNumber } = await nextNumbers(sequelize, showId, transaction);
    const chosen = setup || defaultSetup(seasonNumber);
    const phases = buildPhases(chosen);
    const arcId = uuidv4();

    await sequelize.query(
      `INSERT INTO show_arcs (id, show_id, arc_number, title, tagline, description,
       season_number, episode_start, episode_end, phases, current_phase, status,
       narrative_debt, progression_log, emotional_temperature, icon, color,
       cover_url, starts_on, ends_on, logline,
       created_at, updated_at)
       VALUES (:id, :showId, :arcNumber, :title, :tagline, :description,
       :seasonNumber, 1, 24, :phases, 1, 'active',
       '[]', :log, 'rising', '📖', '#B8962E',
       :coverUrl, :startsOn, :endsOn, :logline,
       NOW(), NOW())`,
      { replacements: {
        id: arcId,
        showId,
        arcNumber,
        seasonNumber,
        title: chosen.title,
        tagline: chosen.tagline || null,
        description: chosen.description || null,
        // The Season page's fields, when the form sent them (2026-10-25).
        coverUrl: chosen.cover_url || null,
        startsOn: chosen.starts_on || null,
        endsOn: chosen.ends_on || null,
        logline: chosen.logline || null,
        phases: JSON.stringify(phases),
        log: JSON.stringify([{
          from_phase: null, to_phase: 1,
          triggered_by: 'auto', trigger_reason: `Season ${seasonNumber} seeded — Phase 1 activated`,
          timestamp: new Date().toISOString(),
        }]),
      }, transaction }
    );

    // The season's 24 empty slots (Season Arc, §8(ff) A2).
    const { ensureSeasonSlots } = require('./seasonSlotService');
    const slots = await ensureSeasonSlots(sequelize, { id: arcId, show_id: showId, season_number: seasonNumber, phases }, { transaction });

    return { exists: false, arc_id: arcId, arc_number: arcNumber, season_number: seasonNumber, phases: phases.length, slots };
  });
}

// ── CHECK PHASE TRANSITION ──────────────────────────────────────────────────

/**
 * Check if completing an episode should trigger a phase transition.
 * Called after episode completion.
 *
 * Returns transition info or null if no transition needed.
 */
async function checkPhaseTransition(showId, episodeNumber, models) {
  const { sequelize } = models;

  const [arcRows] = await sequelize.query(
    `SELECT * FROM show_arcs WHERE show_id = :showId AND status = 'active' AND deleted_at IS NULL
     ORDER BY arc_number ASC LIMIT 1`,
    { replacements: { showId } }
  );
  if (!arcRows?.length) return null;

  const arc = arcRows[0];
  const phases = typeof arc.phases === 'string' ? JSON.parse(arc.phases) : arc.phases;
  const currentPhase = phases.find(p => p.phase === arc.current_phase);
  if (!currentPhase) return null;

  // Update current episode
  await sequelize.query(
    'UPDATE show_arcs SET current_episode = :ep, updated_at = NOW() WHERE id = :id',
    { replacements: { ep: episodeNumber, id: arc.id } }
  );

  // Check if we're at a phase boundary
  if (episodeNumber < currentPhase.episode_end) return null;

  // Phase boundary reached — gather goal status for warning
  const goalStatus = await getPhaseGoalStatus(showId, currentPhase, models);

  return {
    arc_id: arc.id,
    current_phase: currentPhase,
    next_phase: phases.find(p => p.phase === arc.current_phase + 1) || null,
    episode_number: episodeNumber,
    goal_status: goalStatus,
    is_final_phase: arc.current_phase >= phases.length,
    auto_advance: true,
  };
}

/**
 * Get goal completion status for a phase. Inside a transaction a failed
 * read is thrown, so the advance rolls back; outside one (the roadmap's
 * phase summary) it is logged and reads as no goals.
 */
async function getPhaseGoalStatus(showId, phase, models, { transaction = null } = {}) {
  const { sequelize } = models;
  try {
    const [goals] = await sequelize.query(
      `SELECT id, title, type, target_metric, target_value, current_value, status, priority
       FROM career_goals WHERE show_id = :showId AND deleted_at IS NULL
       AND episode_range IS NOT NULL
       AND (episode_range->>0)::int >= :start AND (episode_range->>0)::int <= :end
       ORDER BY priority ASC`,
      { replacements: { showId, start: phase.episode_start, end: phase.episode_end }, transaction }
    );

    // Goal ladders (utils/goalLadders; Evoni, 2026-10-25): a rung waiting up
    // next on its ladder (The Money Talk behind Starter Fund) is not judged by
    // a phase ending — only the rung being worked on is. The ladders are
    // built from every active goal of the show, not just this phase's, since
    // a ladder spans phases. Passive goals are not rungs and are judged as
    // before (an active passive goal in the phase is unmet).
    const [allActive] = await sequelize.query(
      `SELECT id, title, type, target_metric, target_value, status, priority, created_at, unlocks_on_complete
         FROM career_goals WHERE show_id = :showId AND status = 'active' AND deleted_at IS NULL`,
      { replacements: { showId }, transaction }
    );
    const { byGoal } = require('../utils/goalLadders').buildLadders(allActive);
    for (const g of goals) g.rung = byGoal.get(String(g.id))?.rung || null;
    const judged = goals.filter(g => g.rung !== 'up_next');

    const completed = goals.filter(g => g.status === 'completed');
    const failed = goals.filter(g => g.status === 'failed');
    const active = judged.filter(g => g.status === 'active');
    const upNext = goals.filter(g => g.rung === 'up_next');
    const primary = goals.filter(g => g.type === 'primary');
    const primaryIncomplete = judged.filter(g => g.type === 'primary' && g.status !== 'completed');

    return {
      total: goals.length,
      completed: completed.length,
      failed: failed.length,
      active_remaining: active.length,
      primary_total: primary.length,
      primary_incomplete: primaryIncomplete.length,
      up_next: upNext.length,
      goals,
      has_warning: primaryIncomplete.length > 0 || active.length > 0,
      warning_message: primaryIncomplete.length > 0
        ? `Phase "${phase.title}" has ${primaryIncomplete.length} incomplete primary goal(s): ${primaryIncomplete.map(g => `"${g.title}" (${g.current_value}/${g.target_value} ${g.target_metric})`).join(', ')}. Advancing will mark these as carried forward — they become narrative debt.`
        : active.length > 0
          ? `Phase "${phase.title}" has ${active.length} active goal(s) that haven't been completed or failed yet.`
          : null,
    };
  } catch (err) {
    if (transaction) throw err;
    console.error('[arcProgressionService] phase goal status failed:', err.message);
    return { total: 0, completed: 0, failed: 0, active_remaining: 0, primary_total: 0, primary_incomplete: 0, goals: [], has_warning: false };
  }
}

/**
 * A goal advancing leaves unmet: still active, or a primary not completed —
 * unless it is a rung waiting up next on its ladder (getPhaseGoalStatus sets
 * rung), which the phase ending leaves as it is.
 */
const isUnmet = (g) => g.rung !== 'up_next' && (g.status === 'active' || (g.status !== 'completed' && g.type === 'primary'));

/**
 * The current phase's slots that are not done (no accepted episode), so an
 * advance can say which stay open. They keep their part and stay editable.
 */
async function openSlotsOf(sequelize, arc, phase, transaction) {
  const { episodeLabel, slotState } = require('./seasonSlotService');
  const [rows] = await sequelize.query(
    `SELECT s.slot_number, ep.id AS episode_id, ep.evaluation_status, ev.id AS event_id
       FROM season_slots s
       LEFT JOIN episodes ep ON ep.id = s.episode_id AND ep.deleted_at IS NULL
       LEFT JOIN world_events ev ON ev.id = s.event_id AND ev.deleted_at IS NULL
      WHERE s.arc_id = :arcId AND s.phase = :phase AND s.deleted_at IS NULL
        AND (ep.id IS NULL OR ep.evaluation_status IS DISTINCT FROM 'accepted')
      ORDER BY s.slot_number ASC`,
    { replacements: { arcId: arc.id, phase: phase.phase }, transaction }
  );
  return rows.map((r) => ({
    slot_number: r.slot_number,
    label: episodeLabel(arc.season_number, r.slot_number),
    state: slotState({ episode: r.episode_id ? { evaluation_status: r.evaluation_status } : null, event: r.event_id ? { id: r.event_id } : null }),
  }));
}

// ── ADVANCE PHASE ───────────────────────────────────────────────────────────

/**
 * Advance to the next phase, or complete the season from the last one. One
 * transaction, the arc row locked: the goals marked failed, the next
 * phase's goals activated and the arc (phases, debt, log) are written
 * together or not at all.
 *
 * A manual advance asks first (needs_confirmation) when the phase has
 * unmet goals or slots not done; the answer lists both, and says when
 * advancing completes the season. Confirming sends force.
 *
 * @param {string} showId
 * @param {object} models
 * @param {object} options - { triggered_by: 'auto'|'manual', force: false, episode_number }
 */
async function advancePhase(showId, models, options = {}) {
  const { triggered_by = 'auto', force = false, episode_number = null } = options;
  const { sequelize } = models;

  return sequelize.transaction(async (transaction) => {
    const [arcRows] = await sequelize.query(
      `SELECT * FROM show_arcs WHERE show_id = :showId AND status = 'active' AND deleted_at IS NULL
        ORDER BY arc_number ASC LIMIT 1 FOR UPDATE`,
      { replacements: { showId }, transaction }
    );
    if (!arcRows?.length) throw new Error('No active arc found');

    const arc = arcRows[0];
    const phases = typeof arc.phases === 'string' ? JSON.parse(arc.phases) : [...arc.phases];
    const currentIdx = phases.findIndex(p => p.phase === arc.current_phase);
    const currentPhase = phases[currentIdx];
    const nextPhase = phases[currentIdx + 1];
    if (!currentPhase) throw new Error(`Phase ${arc.current_phase} not found in the season`);

    const goalStatus = await getPhaseGoalStatus(showId, currentPhase, models, { transaction });
    const openSlots = await openSlotsOf(sequelize, arc, currentPhase, transaction);
    const unmetGoals = goalStatus.goals.filter(isUnmet);

    if (!force && triggered_by === 'manual' && (goalStatus.has_warning || openSlots.length > 0)) {
      return {
        needs_confirmation: true,
        is_final: !nextPhase,
        warning: goalStatus.warning_message || null,
        open_slots: openSlots,
        unmet_goals: unmetGoals.map(g => ({
          id: g.id, title: g.title, type: g.type, target_metric: g.target_metric,
          current_value: g.current_value, target_value: g.target_value,
        })),
        goal_status: goalStatus,
        current_phase: currentPhase,
        next_phase: nextPhase || null,
      };
    }

    if (!nextPhase) {
      // Final phase — complete the arc
      return completeArc(arc, phases, goalStatus, sequelize, { ...options, transaction, open_slots: openSlots.length });
    }

    // Mark incomplete goals as failed and build narrative debt
    const newDebt = [];
    const existingDebt = typeof arc.narrative_debt === 'string' ? JSON.parse(arc.narrative_debt) : [...(arc.narrative_debt || [])];

    for (const goal of unmetGoals) {
      await sequelize.query(
        "UPDATE career_goals SET status = 'failed', updated_at = NOW() WHERE id = :id AND status = 'active'",
        { replacements: { id: goal.id }, transaction }
      );

      newDebt.push({
        goal_id: goal.id,
        goal_title: goal.title,
        target_metric: goal.target_metric,
        achieved: goal.current_value,
        target: goal.target_value,
        phase: currentPhase.title,
        phase_number: currentPhase.phase,
        narrative_weight: buildNarrativeWeight(goal, currentPhase),
        affects: ['feed_tone', 'event_stakes', 'script_prompts'],
        carried_at: new Date().toISOString(),
      });
    }

    // Update current phase status
    currentPhase.status = 'completed';
    currentPhase.completed_at = new Date().toISOString();
    currentPhase.goal_summary = {
      total: goalStatus.total,
      completed: goalStatus.completed,
      failed: goalStatus.failed + newDebt.length,
      carried: newDebt.length,
    };
    if (openSlots.length) currentPhase.left_open = openSlots.map(s => s.slot_number);

    // Activate next phase, and its career goals
    nextPhase.status = 'active';
    nextPhase.activated_at = new Date().toISOString();
    nextPhase.activated_by = triggered_by;
    await sequelize.query(
      `UPDATE career_goals SET status = 'active', updated_at = NOW()
       WHERE show_id = :showId AND status = 'paused' AND deleted_at IS NULL
       AND episode_range IS NOT NULL
       AND (episode_range->>0)::int >= :start AND (episode_range->>0)::int <= :end`,
      { replacements: { showId, start: nextPhase.episode_start, end: nextPhase.episode_end }, transaction }
    );

    // Build progression log entry
    const existingLog = typeof arc.progression_log === 'string' ? JSON.parse(arc.progression_log) : [...(arc.progression_log || [])];
    existingLog.push({
      from_phase: currentPhase.phase,
      to_phase: nextPhase.phase,
      triggered_by,
      trigger_reason: triggered_by === 'auto'
        ? `Episode ${episode_number || currentPhase.episode_end} completed — phase boundary reached`
        : openSlots.length
          ? `Showrunner advanced with ${openSlots.length} open ${openSlots.length === 1 ? 'slot' : 'slots'} (${openSlots.map(s => `E${s.slot_number}`).join(', ')})`
          : 'Showrunner manual override',
      episode_number: episode_number || currentPhase.episode_end,
      timestamp: new Date().toISOString(),
      goals_completed: goalStatus.completed,
      goals_carried: newDebt.length,
      slots_left_open: openSlots.length,
      warning_acknowledged: goalStatus.has_warning || openSlots.length > 0,
    });

    const allDebt = [...existingDebt, ...newDebt];
    const temp = computeEmotionalTemperature({ ...arc, narrative_debt: allDebt, phases, current_phase: nextPhase.phase });

    await sequelize.query(
      `UPDATE show_arcs SET
       phases = :phases, current_phase = :nextPhase, current_episode = :ep,
       narrative_debt = :debt, progression_log = :log,
       emotional_temperature = :temp, updated_at = NOW()
       WHERE id = :id`,
      { replacements: {
        phases: JSON.stringify(phases),
        nextPhase: nextPhase.phase,
        ep: episode_number || currentPhase.episode_end,
        debt: JSON.stringify(allDebt),
        log: JSON.stringify(existingLog),
        temp,
        id: arc.id,
      }, transaction }
    );

    return {
      success: true,
      advanced_from: currentPhase.title,
      advanced_to: nextPhase.title,
      triggered_by,
      narrative_debt_added: newDebt.length,
      total_narrative_debt: allDebt.length,
      emotional_temperature: temp,
      slots_left_open: openSlots.length,
      goals_carried: newDebt.map(d => ({ title: d.goal_title, weight: d.narrative_weight })),
    };
  });
}

function buildNarrativeWeight(goal, phase) {
  const weights = {
    reputation: `Lala never hit rep ${goal.target_value} in ${phase.title} — she carries that insecurity into every room she enters.`,
    coins: `The money wasn't there in ${phase.title}. Every outfit choice now comes with the memory of what she couldn't afford.`,
    influence: `The audience didn't grow fast enough in ${phase.title}. She wonders if anyone is really watching.`,
    brand_trust: `Brands passed on her in ${phase.title}. The rejection sits in her chest at every meeting.`,
    engagement_rate: `The engagement never hit ${goal.target_value}% in ${phase.title}. Numbers don't lie.`,
    portfolio_strength: `Her portfolio still feels thin from ${phase.title}. She knows it, and the industry knows it.`,
    consistency_streak: `She broke the streak in ${phase.title}. Consistency was supposed to be the easy part.`,
  };
  return weights[goal.target_metric] || `"${goal.title}" went unfinished in ${phase.title}. That weight doesn't disappear.`;
}

// ── COMPLETE ARC ────────────────────────────────────────────────────────────

async function completeArc(arc, phases, goalStatus, sequelize, options) {
  const { episode_number, triggered_by = 'auto', transaction, open_slots: openSlots = 0 } = options;

  // The final phase is the current one; its goals were read in the same transaction.
  const finalPhase = phases[phases.length - 1];

  finalPhase.status = 'completed';
  finalPhase.completed_at = new Date().toISOString();
  finalPhase.goal_summary = {
    total: goalStatus.total,
    completed: goalStatus.completed,
    failed: goalStatus.failed,
    carried: 0,
  };

  const existingLog = typeof arc.progression_log === 'string' ? JSON.parse(arc.progression_log) : [...(arc.progression_log || [])];
  existingLog.push({
    from_phase: finalPhase.phase, to_phase: null,
    triggered_by,
    trigger_reason: 'Final phase completed — arc complete',
    episode_number: episode_number || finalPhase.episode_end,
    timestamp: new Date().toISOString(),
    goals_completed: goalStatus.completed,
    goals_unmet: goalStatus.goals.filter(isUnmet).length,
    goals_carried: 0,
    slots_left_open: openSlots,
  });

  const temp = goalStatus.completed >= goalStatus.total * 0.7 ? 'unstoppable' : 'rising';
  await sequelize.query(
    `UPDATE show_arcs SET status = 'completed', phases = :phases,
     progression_log = :log, emotional_temperature = :temp,
     current_episode = :ep, updated_at = NOW() WHERE id = :id`,
    { replacements: {
      phases: JSON.stringify(phases),
      log: JSON.stringify(existingLog),
      temp,
      ep: episode_number || finalPhase.episode_end,
      id: arc.id,
    }, transaction }
  );

  const debt = typeof arc.narrative_debt === 'string' ? JSON.parse(arc.narrative_debt) : (arc.narrative_debt || []);
  return {
    success: true,
    arc_completed: true,
    arc_title: arc.title,
    total_goals_completed: phases.reduce((sum, p) => sum + (p.goal_summary?.completed || 0), 0),
    total_narrative_debt: debt.length,
    emotional_temperature: temp,
  };
}

// ── GET ARC CONTEXT FOR AI PROMPTS ──────────────────────────────────────────

/**
 * Returns arc context that can be injected into AI generation prompts.
 * Used by script writer, feed generator, and event pipeline.
 *
 * The show's active arc, or `arcId`'s when it is the show's (an episode of
 * an earlier season reads its own season, not the one in progress). The
 * season's logline and description (capped, seasonLine.CAP) and its part
 * count come with it, so seasonLine.fromArcContext can name the season.
 */
async function getArcContext(showId, models, { arcId = null } = {}) {
  const { sequelize } = models;
  const { loadSeason } = require('./seasonLoader');

  let season = arcId ? await loadSeason(sequelize, showId, { arcId, slots: false }) : null;
  if (season && (String(season.arc.show_id) !== String(showId) || season.arc.deleted_at)) season = null;
  if (!season) season = await loadSeason(sequelize, showId, { slots: false });
  if (!season) return null;

  const { arc } = season;
  const phases = arc.phases;
  const currentPhase = phases.find(p => Number(p.phase) === Number(arc.current_phase));
  let debt = arc.narrative_debt || [];
  if (typeof debt === 'string') {
    try { debt = JSON.parse(debt); } catch (err) {
      console.error('[arcProgressionService] the narrative debt could not be read; none used:', err.message);
      debt = [];
    }
  }
  if (!Array.isArray(debt)) debt = [];
  const { clip } = require('./seasonLine');

  return {
    arc_id: arc.id,
    arc_title: arc.title,
    arc_tagline: arc.tagline,
    arc_logline: arc.logline ? clip(arc.logline) : null,
    arc_description: arc.description ? clip(arc.description) : null,
    season: arc.season_number,
    phase_count: phases.length,
    current_phase: {
      number: currentPhase?.phase,
      title: currentPhase?.title,
      tagline: currentPhase?.tagline,
      emotional_arc: currentPhase?.emotional_arc,
      episode_range: [currentPhase?.episode_start, currentPhase?.episode_end],
    },
    current_episode: arc.current_episode,
    emotional_temperature: arc.emotional_temperature,
    feed_behavior: currentPhase?.feed_behavior || {},
    narrative_debt: debt.map(d => ({
      title: d.goal_title,
      weight: d.narrative_weight,
      from_phase: d.phase,
    })),
    narrative_debt_summary: debt.length > 0
      ? `Lala carries ${debt.length} unresolved failure(s) from previous phases: ${debt.map(d => d.narrative_weight).join(' ')}`
      : 'No narrative debt — Lala has met every challenge so far.',
  };
}

module.exports = {
  seedArc,
  checkPhaseTransition,
  getPhaseGoalStatus,
  isUnmet,
  advancePhase,
  getArcContext,
  computeEmotionalTemperature,
};
