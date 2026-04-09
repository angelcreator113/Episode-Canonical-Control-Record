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

// ── METRIC → OPPORTUNITY TYPE MAPPING ────────────────────────────────────────
const METRIC_OPP_TYPES = {
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
      const unlocks = Array.isArray(g.unlocks_on_complete)
        ? g.unlocks_on_complete
        : (typeof g.unlocks_on_complete === 'string' ? JSON.parse(g.unlocks_on_complete) : []);

      if (unlocks.length > 0) {
        const spawned = await spawnUnlockOpportunities(showId, g, unlocks, models);
        result.unlocks.push(...spawned);
      }
    }
  }

  return result;
}

// ── 2. GOAL COMPLETION → SPAWN NEW OPPORTUNITIES ────────────────────────────

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

  let event;
  if (WorldEvent) {
    event = await WorldEvent.create(eventData);
  } else {
    await sequelize.query(
      `INSERT INTO world_events (id, show_id, name, event_type, host, host_brand, prestige, description,
       narrative_stakes, location_hint, opportunity_id, canon_consequences, status, created_at, updated_at)
       VALUES (:id, :show_id, :name, :event_type, :host, :host_brand, :prestige, :description,
       :narrative_stakes, :location_hint, :opportunity_id, :canon_consequences, 'ready', NOW(), NOW())`,
      { replacements: { ...eventData, canon_consequences: JSON.stringify(eventData.canon_consequences) } }
    );
    event = eventData;
  }

  // Link event back to opportunity
  await opp.update({ event_id: event.id || eventData.id });

  return { event: event.toJSON ? event.toJSON() : event, opportunity: opp.toJSON ? opp.toJSON() : opp };
}

// ── 4. EPISODE COMPLETION → CASCADE ──────────────────────────────────────────

/**
 * When an episode is marked complete, advance any linked opportunities
 * and update financial state on career goals.
 */
async function onEpisodeCompleted(episodeId, showId, models) {
  const { Episode, WorldEvent, Opportunity, sequelize } = models;
  const result = { opportunities_advanced: [], goals_updated: [], goals_completed: [], unlocks: [] };

  const episode = await Episode.findByPk(episodeId);
  if (!episode) return result;

  // Find the world event linked to this episode
  let event = null;
  if (WorldEvent) {
    event = await WorldEvent.findOne({ where: { used_in_episode_id: episodeId } });
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

  // Advance opportunity if found
  if (opp && ['booked', 'preparing', 'active'].includes(opp.status)) {
    const history = opp.status_history || [];
    history.push({ status: 'completed', date: new Date().toISOString(), note: `Episode ${episode.episode_number || episodeId} completed`, from: opp.status });

    await opp.update({ status: 'completed', status_history: history, episode_id: episodeId });
    result.opportunities_advanced.push({ id: opp.id, name: opp.name, from: history[history.length - 1].from, to: 'completed' });

    // Cascade to career goals
    const goalResult = await onOpportunityAdvanced(opp.id, 'completed', models);
    result.goals_updated.push(...goalResult.goals_updated);
    result.goals_completed.push(...goalResult.goals_completed);
    result.unlocks.push(...goalResult.unlocks);
  }

  // Update financial goals from episode financials
  if (episode.total_income || episode.total_expenses) {
    try {
      const income = parseFloat(episode.total_income) || 0;
      if (income > 0) {
        const [coinGoals] = await sequelize.query(
          `SELECT * FROM career_goals WHERE show_id = :showId AND status = 'active' AND target_metric = 'coins'`,
          { replacements: { showId } }
        );
        for (const g of (coinGoals || [])) {
          const newVal = (g.current_value || 0) + income;
          await sequelize.query(
            `UPDATE career_goals SET current_value = :val, updated_at = NOW() WHERE id = :id`,
            { replacements: { val: newVal, id: g.id } }
          );
          result.goals_updated.push({ id: g.id, title: g.title, metric: 'coins', added: income, new_value: newVal });

          if (newVal >= g.target_value) {
            await sequelize.query(
              `UPDATE career_goals SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = :id`,
              { replacements: { id: g.id } }
            );
            result.goals_completed.push({ id: g.id, title: g.title });

            const unlocks = typeof g.unlocks_on_complete === 'string' ? JSON.parse(g.unlocks_on_complete) : (g.unlocks_on_complete || []);
            if (unlocks.length > 0) {
              const spawned = await spawnUnlockOpportunities(showId, g, unlocks, models);
              result.unlocks.push(...spawned);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[CareerPipeline] Financial goal update failed:', err.message);
    }
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
  getAccessibleCareerTier,
};
