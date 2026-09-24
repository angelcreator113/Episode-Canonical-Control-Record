'use strict';

/**
 * Career Pipeline Service
 *
 * Orchestrates the full career lifecycle:
 *   Career Goal (active) → auto-generate Opportunity → convert to Event → Episode → completion
 *   → advance Opportunity status → update Goal progress → check Goal completion → spawn unlocks
 *
 * Called from:
 *   - Opportunity advance route (status changes)
 *   - Episode completion flow
 *   - Goal sync endpoint
 */

const { v4: uuidv4 } = require('uuid');
const { withAutoScheduledDate } = require('../utils/eventDateDefault');
const {
  deliverablesFromOpportunity, restrictionsFromOpportunity, compensationFromOpportunity, insertEventDeliverables,
} = require('./eventTermsService');

// ── METRIC → OPPORTUNITY TYPE MAPPING ────────────────────────────────────────
const _METRIC_OPP_TYPES = { // eslint-disable-line no-unused-vars
  coins:              ['brand_deal', 'campaign', 'ambassador'],
  reputation:         ['editorial', 'award_show', 'interview'],
  brand_trust:        ['brand_deal', 'ambassador', 'campaign'],
  influence:          ['podcast', 'interview', 'panel'],
  followers:          ['campaign', 'podcast', 'brand_deal'],
  portfolio_strength: ['editorial', 'modeling', 'runway'],
  engagement_rate:    ['brand_deal', 'podcast'],
};

// ── 1. OPPORTUNITY COMPLETION → GOAL PROGRESS ────────────────────────────────

/**
 * When an opportunity reaches 'completed' or 'paid', update linked career goals.
 * Returns { goals_updated, goals_completed, unlocks }
 */
async function onOpportunityAdvanced(opportunityId, newStatus, models) {
  const { Opportunity, CareerGoal, sequelize } = models;
  const result = { goals_updated: [], goals_completed: [], unlocks: [] };

  // Only act on meaningful status changes
  if (!['completed', 'paid'].includes(newStatus)) return result;

  const opp = Opportunity
    ? await Opportunity.findByPk(opportunityId)
    : null;
  if (!opp) return result;

  const showId = opp.show_id;

  // Load active goals for this show
  let goals = [];
  if (CareerGoal) {
    goals = await CareerGoal.findAll({ where: { show_id: showId, status: 'active' } });
  } else {
    const [rows] = await sequelize.query(
      `SELECT * FROM career_goals WHERE show_id = :showId AND status = 'active'`,
      { replacements: { showId } }
    );
    goals = rows || [];
  }

  for (const goal of goals) {
    const g = goal.toJSON ? goal.toJSON() : goal;
    let increment = 0;

    // Calculate how much this opportunity contributes to the goal
    if (g.target_metric === 'coins' && opp.payment_amount) {
      increment = parseFloat(opp.payment_amount) || 0;
    } else if (g.target_metric === 'reputation' && opp.prestige) {
      increment = opp.prestige >= 7 ? 2 : opp.prestige >= 5 ? 1 : 0;
    } else if (g.target_metric === 'brand_trust' && opp.opportunity_type === 'brand_deal') {
      increment = opp.prestige >= 5 ? 2 : 1;
    } else if (g.target_metric === 'influence') {
      increment = opp.prestige >= 6 ? 2 : 1;
    } else if (g.target_metric === 'portfolio_strength' && ['editorial', 'modeling', 'runway'].includes(opp.opportunity_type)) {
      increment = 1;
    } else if (g.target_metric === 'followers' && opp.social_boost) {
      increment = opp.social_boost;
    }

    if (increment <= 0) continue;

    const newValue = (g.current_value || 0) + increment;

    if (CareerGoal && goal.update) {
      await goal.update({ current_value: newValue });
    } else {
      await sequelize.query(
        `UPDATE career_goals SET current_value = :val, updated_at = NOW() WHERE id = :id`,
        { replacements: { val: newValue, id: g.id } }
      );
    }

    result.goals_updated.push({ id: g.id, title: g.title, metric: g.target_metric, added: increment, new_value: newValue });

    // Check if goal is now complete
    if (newValue >= g.target_value) {
      if (CareerGoal && goal.update) {
        await goal.update({ status: 'completed', completed_at: new Date() });
      } else {
        await sequelize.query(
          `UPDATE career_goals SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = :id`,
          { replacements: { id: g.id } }
        );
      }
      result.goals_completed.push({ id: g.id, title: g.title });

      // Process unlocks
      const spawned = await spawnGoalUnlocks(g, showId, models);
      result.unlocks.push(...spawned);
    }
  }

  return result;
}

// ── 2. GOAL COMPLETION → SPAWN NEW OPPORTUNITIES ────────────────────────────

/**
 * Spawn a just-completed goal's unlocks_on_complete as new opportunities.
 * Shared by onOpportunityAdvanced (manual Advance) and completeEpisode's
 * step 17 (Task #1817) so both completion paths spawn the same way.
 *
 * goal: plain object with id, title, priority, unlocks_on_complete
 *       (array, or a JSON string). Returns the spawned list (possibly empty).
 * A malformed unlocks_on_complete string throws, as it always has here;
 * callers that must not fail wrap this call.
 */
async function spawnGoalUnlocks(goal, showId, models) {
  const unlocks = Array.isArray(goal.unlocks_on_complete)
    ? goal.unlocks_on_complete
    : (typeof goal.unlocks_on_complete === 'string' ? JSON.parse(goal.unlocks_on_complete) : []);

  if (unlocks.length === 0) return [];
  return spawnUnlockOpportunities(showId, goal, unlocks, models);
}

/**
 * When a goal completes, its unlocks_on_complete items become new opportunities.
 */
async function spawnUnlockOpportunities(showId, completedGoal, unlocks, models) {
  const { Opportunity, sequelize } = models;
  const spawned = [];

  for (const unlock of unlocks) {
    // unlock can be a string like "maison_belle_contract" or an object { type, description, prestige }
    const unlockObj = typeof unlock === 'string' ? { type: 'brand_deal', description: unlock } : unlock;

    const name = unlockObj.description || unlockObj.name || `Unlocked: ${completedGoal.title}`;
    const oppData = {
      id: uuidv4(),
      show_id: showId,
      name,
      opportunity_type: unlockObj.type || 'brand_deal',
      category: unlockObj.category || 'fashion',
      status: 'offered',
      prestige: unlockObj.prestige || Math.min(10, (completedGoal.priority <= 2 ? 7 : 5)),
      career_impact: `Unlocked by completing: "${completedGoal.title}"`,
      career_goal_id: completedGoal.id,
      narrative_stakes: `This opportunity appeared because Lala achieved her goal. The stakes are higher now.`,
      what_lala_wants: unlockObj.what_lala_wants || 'Prove she deserves the next level',
      status_history: [{ status: 'offered', date: new Date().toISOString(), note: `Auto-generated from goal completion: ${completedGoal.title}` }],
    };

    try {
      if (Opportunity) {
        const opp = await Opportunity.create(oppData);
        spawned.push({ id: opp.id, name, source_goal: completedGoal.title });
      } else {
        await sequelize.query(
          `INSERT INTO opportunities (id, show_id, name, opportunity_type, category, status, prestige,
           career_impact, career_goal_id, narrative_stakes, what_lala_wants, status_history, created_at, updated_at)
           VALUES (:id, :show_id, :name, :opportunity_type, :category, 'offered', :prestige,
           :career_impact, :career_goal_id, :narrative_stakes, :what_lala_wants, :status_history, NOW(), NOW())`,
          { replacements: { ...oppData, status_history: JSON.stringify(oppData.status_history) } }
        );
        spawned.push({ id: oppData.id, name, source_goal: completedGoal.title });
      }
    } catch (err) {
      console.warn(`[CareerPipeline] Failed to spawn unlock opportunity: ${err.message}`);
    }
  }

  return spawned;
}

// ── 3. OPPORTUNITY → EVENT WITH REVERSE LINK ────────────────────────────────

/**
 * Enhanced opportunity-to-event conversion that sets opportunity_id on the event.
 */
async function convertOpportunityToEvent(opportunityId, showId, models) {
  const { Opportunity, WorldEvent, sequelize } = models;

  const opp = Opportunity ? await Opportunity.findByPk(opportunityId) : null;
  if (!opp) throw new Error('Opportunity not found');

  // Terms the opportunity proposes (Task #1814, eventTermsService.js).
  // automation.payment_amount below stays as it was; payment_amount is the
  // event's own contractual-pay column. is_paid stays off until the money
  // slice rules on payout (see compensationFromOpportunity).
  const compensation = compensationFromOpportunity(opp);

  const eventData = {
    id: uuidv4(),
    show_id: showId,
    name: opp.name,
    event_type: opp.opportunity_type === 'brand_deal' ? 'brand_deal' : 'invite',
    host: opp.brand_or_company || opp.contact_name || opp.name,
    host_brand: opp.brand_or_company || null,
    prestige: opp.prestige || 5,
    description: opp.narrative_stakes || `${opp.opportunity_type} opportunity: ${opp.name}`,
    narrative_stakes: opp.what_could_go_wrong || opp.narrative_stakes || null,
    location_hint: opp.venue_name || null,
    dress_code: opp.wardrobe_brief?.dress_code || null,
    opportunity_id: opp.id,
    restrictions: restrictionsFromOpportunity(opp),
    is_paid: compensation.is_paid,
    payment_amount: compensation.payment_amount,
    canon_consequences: {
      automation: {
        source: 'opportunity',
        opportunity_id: opp.id,
        opportunity_type: opp.opportunity_type,
        brand: opp.brand_or_company,
        connector_handle: opp.connector_handle,
        wardrobe_brief: opp.wardrobe_brief,
        payment_amount: opp.payment_amount,
        career_milestone: opp.career_milestone,
        career_goal_id: opp.career_goal_id || null,
      },
    },
    status: 'ready',
  };
  // No date comes from an opportunity: the system default, 45 days out,
  // flagged as automation.event_date_auto (Task #1755).
  const dated = withAutoScheduledDate(null, eventData.canon_consequences);
  eventData.event_date = dated.event_date;
  eventData.canon_consequences = dated.canon_consequences;

  let event;
  if (WorldEvent) {
    event = await WorldEvent.create(eventData);
  } else {
    await sequelize.query(
      `INSERT INTO world_events (id, show_id, name, event_type, host, host_brand, prestige, description,
       narrative_stakes, location_hint, opportunity_id, event_date, canon_consequences,
       restrictions, is_paid, payment_amount, status, created_at, updated_at)
       VALUES (:id, :show_id, :name, :event_type, :host, :host_brand, :prestige, :description,
       :narrative_stakes, :location_hint, :opportunity_id, :event_date, :canon_consequences,
       :restrictions, :is_paid, :payment_amount, 'ready', NOW(), NOW())`,
      { replacements: {
        ...eventData,
        canon_consequences: JSON.stringify(eventData.canon_consequences),
        restrictions: JSON.stringify(eventData.restrictions),
      } }
    );
    event = eventData;
  }

  // Deliverables (Task #1814). The event already exists, so a failure here
  // is logged and the event stands without them; they can be added in the
  // Event Package.
  const deliverableRows = deliverablesFromOpportunity(opp);
  let deliverablesCarried = 0;
  if (deliverableRows.length > 0) {
    try {
      if (!sequelize) throw new Error('sequelize not available');
      deliverablesCarried = await insertEventDeliverables(sequelize, event.id || eventData.id, deliverableRows);
    } catch (err) {
      console.error('[CareerPipeline] Deliverable carry failed (event created without deliverables):', err.message);
    }
  }

  // Link event back to opportunity
  await opp.update({ event_id: event.id || eventData.id });

  return {
    event: event.toJSON ? event.toJSON() : event,
    opportunity: opp.toJSON ? opp.toJSON() : opp,
    deliverables: deliverablesCarried,
  };
}

// ── 4. EPISODE COMPLETION → CASCADE ──────────────────────────────────────────

/**
 * When an episode is marked complete, complete its linked opportunity
 * (booked/preparing/active → completed, with status_history and episode_id).
 *
 * Task #1817 (Evoni's ruling, option 1): this hook completes the opportunity
 * ONLY. It no longer cascades into onOpportunityAdvanced and no longer
 * credits episode.total_income to coins goals — completeEpisode's step 17
 * (+1 per active goal) is the single goal advance on completion, and it
 * spawns unlocks for goals it completes. Manual Advance still goes through
 * onOpportunityAdvanced unchanged.
 *
 * Returns { opportunities_advanced }.
 */
async function onEpisodeCompleted(episodeId, showId, models) {
  const { Episode, WorldEvent, Opportunity, sequelize } = models;
  const result = { opportunities_advanced: [] };

  const episode = await Episode.findByPk(episodeId);
  if (!episode) return result;

  // Find the world event linked to this episode
  let event = null;
  if (WorldEvent) {
    // Scoped to the only field this function actually reads (event.id, at
    // the opportunity lookup below). event.opportunity_id is also read
    // there, but that column isn't declared on the model at this basis
    // (see WorldEvent.js's own comment) so it was already never populated
    // via this query — not changed by this scoping.
    event = await WorldEvent.findOne({ where: { used_in_episode_id: episodeId }, attributes: ['id'] });
  }
  if (!event) {
    try {
      const [rows] = await sequelize.query(
        `SELECT * FROM world_events WHERE used_in_episode_id = :episodeId LIMIT 1`,
        { replacements: { episodeId } }
      );
      event = rows?.[0];
    } catch { /* no event */ }
  }

  // Find the opportunity linked to the event or episode
  let opp = null;
  if (Opportunity) {
    if (event?.opportunity_id) {
      opp = await Opportunity.findByPk(event.opportunity_id);
    }
    if (!opp) {
      opp = await Opportunity.findOne({ where: { episode_id: episodeId } });
    }
    if (!opp && event) {
      opp = await Opportunity.findOne({ where: { event_id: event.id } });
    }
  }

  // Complete the opportunity if found (no goal cascade — see header)
  if (opp && ['booked', 'preparing', 'active'].includes(opp.status)) {
    const history = opp.status_history || [];
    history.push({ status: 'completed', date: new Date().toISOString(), note: `Episode ${episode.episode_number || episodeId} completed`, from: opp.status });

    await opp.update({ status: 'completed', status_history: history, episode_id: episodeId });
    result.opportunities_advanced.push({ id: opp.id, name: opp.name, from: history[history.length - 1].from, to: 'completed' });
  }

  return result;
}

// ── 5. CAREER TIER GATING ────────────────────────────────────────────────────

/**
 * Filter opportunities or events by career tier.
 * Returns only items the character has unlocked based on their reputation.
 */
async function getAccessibleCareerTier(showId, models) {
  const { sequelize } = models;
  try {
    const [states] = await sequelize.query(
      `SELECT reputation FROM character_state WHERE show_id = :showId AND character_key = 'lala' LIMIT 1`,
      { replacements: { showId } }
    );
    const rep = states?.[0]?.reputation || 0;
    // Tier 1: rep 0-2, Tier 2: rep 3-4, Tier 3: rep 5-6, Tier 4: rep 7-8, Tier 5: rep 9-10
    return Math.min(5, Math.floor(rep / 2) + 1);
  } catch {
    return 1;
  }
}

module.exports = {
  onOpportunityAdvanced,
  onEpisodeCompleted,
  convertOpportunityToEvent,
  spawnUnlockOpportunities,
  spawnGoalUnlocks,
  getAccessibleCareerTier,
};
