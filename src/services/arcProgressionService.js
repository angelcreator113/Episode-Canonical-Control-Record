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

// ── SEED ARC 1 ──────────────────────────────────────────────────────────────

/**
 * Create Arc 1 for a show with 3 phases.
 */
async function seedArc(showId, models) {
  const { sequelize } = models;

  // Check if arc already exists
  const [existing] = await sequelize.query(
    'SELECT id FROM show_arcs WHERE show_id = :showId AND arc_number = 1 AND deleted_at IS NULL',
    { replacements: { showId } }
  );
  if (existing?.length > 0) return { exists: true, arc_id: existing[0].id };

  const arcId = uuidv4();
  const phases = [
    {
      phase: 1,
      title: 'Foundation',
      tagline: 'Prove you belong',
      episode_start: 1,
      episode_end: 8,
      status: 'active',
      activated_at: new Date().toISOString(),
      activated_by: 'auto',
      emotional_arc: 'curiosity → first stumble → finding her footing',
      feed_behavior: {
        follow_bias: 'aspiration',
        event_prestige_max: 6,
        follow_emotions: ['excitement', 'anxiety', 'admiration'],
        feed_tone: 'Lala watches from the outside. Everything feels aspirational and slightly out of reach.',
      },
      goal_summary: { total: 0, completed: 0, failed: 0, carried: 0 },
    },
    {
      phase: 2,
      title: 'Ascension',
      tagline: 'Climb the ladder',
      episode_start: 9,
      episode_end: 16,
      status: 'upcoming',
      emotional_arc: 'ambition → competition → first real loss → determination',
      feed_behavior: {
        follow_bias: 'competition',
        event_prestige_max: 8,
        follow_emotions: ['competition', 'jealousy', 'motivation'],
        feed_tone: 'Lala is in the mix now. People know her name. The shade gets personal.',
      },
      goal_summary: { total: 0, completed: 0, failed: 0, carried: 0 },
    },
    {
      phase: 3,
      title: 'Legacy',
      tagline: 'Become uncopyable',
      episode_start: 17,
      episode_end: 24,
      status: 'upcoming',
      emotional_arc: 'confidence → crisis of identity → building her own room → transcendence',
      feed_behavior: {
        follow_bias: 'study',
        event_prestige_max: 10,
        follow_emotions: ['admiration', 'obsession', 'motivation'],
        feed_tone: 'Lala stops watching and starts being watched. The feed follows her.',
      },
      goal_summary: { total: 0, completed: 0, failed: 0, carried: 0 },
    },
  ];

  await sequelize.query(
    `INSERT INTO show_arcs (id, show_id, arc_number, title, tagline, description,
     season_number, episode_start, episode_end, phases, current_phase, status,
     narrative_debt, progression_log, emotional_temperature, icon, color,
     created_at, updated_at)
     VALUES (:id, :showId, 1, :title, :tagline, :description,
     1, 1, 24, :phases, 1, 'active',
     '[]', :log, 'rising', '📖', '#B8962E',
     NOW(), NOW())`,
    { replacements: {
      id: arcId,
      showId,
      title: 'Soft Luxury Ascension',
      tagline: 'Lala earns her place in the luxury tier',
      description: 'The full 24-episode journey from nobody to uncopyable. Fashion is strategy. Reputation is currency. Legacy is built episode by episode.',
      phases: JSON.stringify(phases),
      log: JSON.stringify([{
        from_phase: null, to_phase: 1,
        triggered_by: 'auto', trigger_reason: 'Arc seeded — Phase 1 activated',
        timestamp: new Date().toISOString(),
      }]),
    } }
  );

  return { exists: false, arc_id: arcId, phases: phases.length };
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
 * Get goal completion status for a phase.
 */
async function getPhaseGoalStatus(showId, phase, models) {
  const { sequelize } = models;
  try {
    const [goals] = await sequelize.query(
      `SELECT id, title, type, target_metric, target_value, current_value, status, priority
       FROM career_goals WHERE show_id = :showId
       AND episode_range IS NOT NULL
       AND (episode_range->>0)::int >= :start AND (episode_range->>0)::int <= :end
       ORDER BY priority ASC`,
      { replacements: { showId, start: phase.episode_start, end: phase.episode_end } }
    );

    const completed = goals.filter(g => g.status === 'completed');
    const failed = goals.filter(g => g.status === 'failed');
    const active = goals.filter(g => g.status === 'active');
    const primary = goals.filter(g => g.type === 'primary');
    const primaryIncomplete = primary.filter(g => g.status !== 'completed');

    return {
      total: goals.length,
      completed: completed.length,
      failed: failed.length,
      active_remaining: active.length,
      primary_total: primary.length,
      primary_incomplete: primaryIncomplete.length,
      goals,
      has_warning: primaryIncomplete.length > 0 || active.length > 0,
      warning_message: primaryIncomplete.length > 0
        ? `Phase "${phase.title}" has ${primaryIncomplete.length} incomplete primary goal(s): ${primaryIncomplete.map(g => `"${g.title}" (${g.current_value}/${g.target_value} ${g.target_metric})`).join(', ')}. Advancing will mark these as carried forward — they become narrative debt.`
        : active.length > 0
          ? `Phase "${phase.title}" has ${active.length} active goal(s) that haven't been completed or failed yet.`
          : null,
    };
  } catch {
    return { total: 0, completed: 0, failed: 0, active_remaining: 0, primary_total: 0, primary_incomplete: 0, goals: [], has_warning: false };
  }
}

// ── ADVANCE PHASE ───────────────────────────────────────────────────────────

/**
 * Advance to the next phase. Handles both auto and manual triggers.
 *
 * @param {string} showId
 * @param {object} models
 * @param {object} options - { triggered_by: 'auto'|'manual', force: false, episode_number }
 */
async function advancePhase(showId, models, options = {}) {
  const { triggered_by = 'auto', force = false, episode_number = null } = options;
  const { sequelize } = models;

  const [arcRows] = await sequelize.query(
    `SELECT * FROM show_arcs WHERE show_id = :showId AND status = 'active' AND deleted_at IS NULL LIMIT 1`,
    { replacements: { showId } }
  );
  if (!arcRows?.length) throw new Error('No active arc found');

  const arc = arcRows[0];
  const phases = typeof arc.phases === 'string' ? JSON.parse(arc.phases) : [...arc.phases];
  const currentIdx = phases.findIndex(p => p.phase === arc.current_phase);
  const currentPhase = phases[currentIdx];
  const nextPhase = phases[currentIdx + 1];

  if (!nextPhase && !force) {
    // Final phase — complete the arc
    return completeArc(showId, arc, phases, models, options);
  }

  // Get goal status for warning
  const goalStatus = await getPhaseGoalStatus(showId, currentPhase, models);

  // If not forced and there are warnings, return the warning
  if (!force && goalStatus.has_warning && triggered_by === 'manual') {
    return {
      needs_confirmation: true,
      warning: goalStatus.warning_message,
      goal_status: goalStatus,
      current_phase: currentPhase,
      next_phase: nextPhase,
    };
  }

  // Mark incomplete goals as carried_forward and build narrative debt
  const newDebt = [];
  const existingDebt = typeof arc.narrative_debt === 'string' ? JSON.parse(arc.narrative_debt) : [...(arc.narrative_debt || [])];

  for (const goal of goalStatus.goals) {
    if (goal.status === 'active' || (goal.status !== 'completed' && goal.type === 'primary')) {
      // Mark as carried_forward in the database
      try {
        await sequelize.query(
          "UPDATE career_goals SET status = 'failed', updated_at = NOW() WHERE id = :id AND status = 'active'",
          { replacements: { id: goal.id } }
        );
      } catch { /* non-critical */ }

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

  // Activate next phase
  if (nextPhase) {
    nextPhase.status = 'active';
    nextPhase.activated_at = new Date().toISOString();
    nextPhase.activated_by = triggered_by;
  }

  // Activate next phase's career goals
  if (nextPhase) {
    try {
      await sequelize.query(
        `UPDATE career_goals SET status = 'active', updated_at = NOW()
         WHERE show_id = :showId AND status = 'paused'
         AND episode_range IS NOT NULL
         AND (episode_range->>0)::int >= :start AND (episode_range->>0)::int <= :end`,
        { replacements: { showId, start: nextPhase.episode_start, end: nextPhase.episode_end } }
      );
    } catch { /* non-critical */ }
  }

  // Build progression log entry
  const existingLog = typeof arc.progression_log === 'string' ? JSON.parse(arc.progression_log) : [...(arc.progression_log || [])];
  existingLog.push({
    from_phase: currentPhase.phase,
    to_phase: nextPhase?.phase || null,
    triggered_by,
    trigger_reason: triggered_by === 'auto'
      ? `Episode ${episode_number || currentPhase.episode_end} completed — phase boundary reached`
      : 'Showrunner manual override',
    episode_number: episode_number || currentPhase.episode_end,
    timestamp: new Date().toISOString(),
    goals_completed: goalStatus.completed,
    goals_carried: newDebt.length,
    warning_acknowledged: goalStatus.has_warning,
  });

  const allDebt = [...existingDebt, ...newDebt];
  const temp = computeEmotionalTemperature({ ...arc, narrative_debt: allDebt, phases, current_phase: nextPhase?.phase || arc.current_phase });

  // Save
  await sequelize.query(
    `UPDATE show_arcs SET
     phases = :phases, current_phase = :nextPhase, current_episode = :ep,
     narrative_debt = :debt, progression_log = :log,
     emotional_temperature = :temp, updated_at = NOW()
     WHERE id = :id`,
    { replacements: {
      phases: JSON.stringify(phases),
      nextPhase: nextPhase?.phase || arc.current_phase,
      ep: episode_number || currentPhase.episode_end,
      debt: JSON.stringify(allDebt),
      log: JSON.stringify(existingLog),
      temp,
      id: arc.id,
    } }
  );

  return {
    success: true,
    advanced_from: currentPhase.title,
    advanced_to: nextPhase?.title || 'Arc Complete',
    triggered_by,
    narrative_debt_added: newDebt.length,
    total_narrative_debt: allDebt.length,
    emotional_temperature: temp,
    goals_carried: newDebt.map(d => ({ title: d.goal_title, weight: d.narrative_weight })),
  };
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

async function completeArc(showId, arc, phases, models, options) {
  const { sequelize } = models;
  const { episode_number, triggered_by = 'auto' } = options;

  // Final phase goal check
  const finalPhase = phases[phases.length - 1];
  const goalStatus = await getPhaseGoalStatus(showId, finalPhase, models);

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
    goals_carried: 0,
  });

  await sequelize.query(
    `UPDATE show_arcs SET status = 'completed', phases = :phases,
     progression_log = :log, emotional_temperature = :temp,
     current_episode = :ep, updated_at = NOW() WHERE id = :id`,
    { replacements: {
      phases: JSON.stringify(phases),
      log: JSON.stringify(existingLog),
      temp: goalStatus.completed >= goalStatus.total * 0.7 ? 'unstoppable' : 'rising',
      ep: episode_number || finalPhase.episode_end,
      id: arc.id,
    } }
  );

  return {
    success: true,
    arc_completed: true,
    arc_title: arc.title,
    total_goals_completed: phases.reduce((sum, p) => sum + (p.goal_summary?.completed || 0), 0),
    total_narrative_debt: (arc.narrative_debt || []).length,
    emotional_temperature: goalStatus.completed >= goalStatus.total * 0.7 ? 'unstoppable' : 'rising',
  };
}

// ── GET ARC CONTEXT FOR AI PROMPTS ──────────────────────────────────────────

/**
 * Returns arc context that can be injected into AI generation prompts.
 * Used by script writer, feed generator, and event pipeline.
 */
async function getArcContext(showId, models) {
  const { sequelize } = models;

  const [arcRows] = await sequelize.query(
    `SELECT * FROM show_arcs WHERE show_id = :showId AND status = 'active' AND deleted_at IS NULL LIMIT 1`,
    { replacements: { showId } }
  );
  if (!arcRows?.length) return null;

  const arc = arcRows[0];
  const phases = typeof arc.phases === 'string' ? JSON.parse(arc.phases) : arc.phases;
  const currentPhase = phases.find(p => p.phase === arc.current_phase);
  const debt = typeof arc.narrative_debt === 'string' ? JSON.parse(arc.narrative_debt) : (arc.narrative_debt || []);

  return {
    arc_title: arc.title,
    arc_tagline: arc.tagline,
    season: arc.season_number,
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
  advancePhase,
  getArcContext,
  computeEmotionalTemperature,
};
