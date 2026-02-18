/**
 * Career Goals Routes
 * 
 * GET    /api/v1/world/:showId/goals          â€” List goals (active, completed, all)
 * POST   /api/v1/world/:showId/goals          â€” Create goal
 * PUT    /api/v1/world/:showId/goals/:goalId  â€” Update goal
 * DELETE /api/v1/world/:showId/goals/:goalId  â€” Delete goal
 * POST   /api/v1/world/:showId/goals/sync     â€” Sync goal progress from character state
 * GET    /api/v1/world/:showId/suggest-events  â€” Suggest events based on active goals
 * 
 * Location: src/routes/careerGoals.js
 */

'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

let optionalAuth;
try {
  const authModule = require('../middleware/auth');
  optionalAuth = authModule.optionalAuth || authModule.authenticate || ((req, res, next) => next());
} catch (e) {
  optionalAuth = (req, res, next) => next();
}

async function getModels() {
  try { return require('../models'); } catch (e) { return null; }
}


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// GET /api/v1/world/:showId/goals
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

router.get('/world/:showId/goals', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const { status, type } = req.query;
    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    let query = `SELECT * FROM career_goals WHERE show_id = :showId`;
    const replacements = { showId };

    if (status) { query += ` AND status = :status`; replacements.status = status; }
    if (type) { query += ` AND type = :type`; replacements.type = type; }

    query += ` ORDER BY CASE type WHEN 'primary' THEN 1 WHEN 'secondary' THEN 2 WHEN 'passive' THEN 3 END, priority ASC, created_at DESC`;

    const [goals] = await models.sequelize.query(query, { replacements });

    // Calculate progress for each
    const enriched = goals.map(g => ({
      ...g,
      progress: g.target_value > 0 ? Math.min(100, Math.round(((g.current_value - (g.starting_value || 0)) / (g.target_value - (g.starting_value || 0))) * 100)) : 0,
      remaining: Math.max(0, g.target_value - g.current_value),
    }));

    return res.json({ success: true, goals: enriched });
  } catch (error) {
    if (error.message?.includes('career_goals') || error.message?.includes('does not exist')) {
      return res.json({ success: true, goals: [], note: 'Table not yet created. Run migration.' });
    }
    console.error('List goals error:', error);
    return res.status(500).json({ error: 'Failed to load goals', message: error.message });
  }
});


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// POST /api/v1/world/:showId/goals
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

router.post('/world/:showId/goals', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const {
      title, description, type = 'secondary',
      target_metric, target_value, current_value = 0,
      priority = 3, icon = 'ðŸŽ¯', color = '#6366f1',
      unlocks_on_complete = [], fail_consequence,
      season_id, arc_id, episode_range,
    } = req.body;

    if (!title) return res.status(400).json({ error: 'Goal title is required' });
    if (!target_metric) return res.status(400).json({ error: 'target_metric is required' });

    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    // Enforce limits: 1 primary, 2 secondary active at a time
    if (type === 'primary' || type === 'secondary') {
      const [existing] = await models.sequelize.query(
        `SELECT COUNT(*) as count FROM career_goals WHERE show_id = :showId AND type = :type AND status = 'active'`,
        { replacements: { showId, type } }
      );
      const count = parseInt(existing[0]?.count || 0);
      const limit = type === 'primary' ? 1 : 2;
      if (count >= limit) {
        return res.status(400).json({
          error: `Maximum ${limit} active ${type} goal(s) allowed. Complete or pause an existing goal first.`,
        });
      }
    }

    // Auto-populate current_value from character state if metric matches
    let autoValue = current_value;
    try {
      const [states] = await models.sequelize.query(
        `SELECT * FROM character_state WHERE show_id = :showId AND character_key = 'lala' LIMIT 1`,
        { replacements: { showId } }
      );
      if (states?.length > 0 && states[0][target_metric] !== undefined) {
        autoValue = states[0][target_metric];
      }
    } catch (e) { /* no state */ }

    const id = uuidv4();
    await models.sequelize.query(
      `INSERT INTO career_goals
       (id, show_id, season_id, arc_id, title, description, type,
        target_metric, target_value, current_value, starting_value,
        status, priority, icon, color,
        unlocks_on_complete, fail_consequence, episode_range,
        created_at, updated_at)
       VALUES
       (:id, :showId, :season_id, :arc_id, :title, :description, :type,
        :target_metric, :target_value, :current_value, :starting_value,
        'active', :priority, :icon, :color,
        :unlocks_on_complete, :fail_consequence, :episode_range,
        NOW(), NOW())`,
      {
        replacements: {
          id, showId,
          season_id: season_id || null,
          arc_id: arc_id || null,
          title, description: description || null, type,
          target_metric, target_value,
          current_value: autoValue,
          starting_value: autoValue,
          priority, icon, color,
          unlocks_on_complete: JSON.stringify(unlocks_on_complete),
          fail_consequence: fail_consequence || null,
          episode_range: episode_range ? JSON.stringify(episode_range) : null,
        },
      }
    );

    const [created] = await models.sequelize.query(
      `SELECT * FROM career_goals WHERE id = :id`, { replacements: { id } }
    );

    const goal = created[0];
    goal.progress = 0;
    goal.remaining = goal.target_value - goal.current_value;

    return res.status(201).json({ success: true, goal });
  } catch (error) {
    console.error('Create goal error:', error);
    return res.status(500).json({ error: 'Failed to create goal', message: error.message });
  }
});


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PUT /api/v1/world/:showId/goals/:goalId
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

router.put('/world/:showId/goals/:goalId', optionalAuth, async (req, res) => {
  try {
    const { showId, goalId } = req.params;
    const updates = req.body;
    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    const allowedFields = [
      'title', 'description', 'type', 'target_metric', 'target_value',
      'current_value', 'status', 'priority', 'icon', 'color',
      'unlocks_on_complete', 'fail_consequence', 'season_id', 'arc_id', 'episode_range',
    ];

    const setClauses = [];
    const replacements = { showId, goalId };

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        const val = typeof updates[field] === 'object' ? JSON.stringify(updates[field]) : updates[field];
        setClauses.push(`${field} = :${field}`);
        replacements[field] = val;
      }
    }

    // Auto-set completed_at
    if (updates.status === 'completed') {
      setClauses.push('completed_at = NOW()');
    }

    if (setClauses.length === 0) return res.status(400).json({ error: 'No fields to update' });
    setClauses.push('updated_at = NOW()');

    await models.sequelize.query(
      `UPDATE career_goals SET ${setClauses.join(', ')} WHERE id = :goalId AND show_id = :showId`,
      { replacements }
    );

    const [updated] = await models.sequelize.query(
      `SELECT * FROM career_goals WHERE id = :goalId`, { replacements: { goalId } }
    );

    return res.json({ success: true, goal: updated[0] });
  } catch (error) {
    console.error('Update goal error:', error);
    return res.status(500).json({ error: 'Failed to update goal', message: error.message });
  }
});


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// DELETE /api/v1/world/:showId/goals/:goalId
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

router.delete('/world/:showId/goals/:goalId', optionalAuth, async (req, res) => {
  try {
    const { showId, goalId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    await models.sequelize.query(
      `DELETE FROM career_goals WHERE id = :goalId AND show_id = :showId`,
      { replacements: { showId, goalId } }
    );
    return res.json({ success: true, deleted: goalId });
  } catch (error) {
    console.error('Delete goal error:', error);
    return res.status(500).json({ error: 'Failed to delete goal', message: error.message });
  }
});


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// POST /api/v1/world/:showId/goals/sync
// Sync goal current_value from character state
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

router.post('/world/:showId/goals/sync', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    // Get character state
    const [states] = await models.sequelize.query(
      `SELECT * FROM character_state WHERE show_id = :showId AND character_key = 'lala' LIMIT 1`,
      { replacements: { showId } }
    );
    if (!states?.length) return res.json({ success: true, synced: 0, note: 'No character state found' });
    const state = states[0];

    // Get active goals
    const [goals] = await models.sequelize.query(
      `SELECT * FROM career_goals WHERE show_id = :showId AND status = 'active'`,
      { replacements: { showId } }
    );

    let synced = 0;
    const completed = [];

    for (const goal of goals) {
      const metricValue = state[goal.target_metric];
      if (metricValue === undefined) continue;

      const newValue = parseFloat(metricValue);
      if (newValue === goal.current_value) continue;

      // Update current value
      await models.sequelize.query(
        `UPDATE career_goals SET current_value = :val, updated_at = NOW() WHERE id = :id`,
        { replacements: { val: newValue, id: goal.id } }
      );
      synced++;

      // Check if goal is now complete
      if (newValue >= goal.target_value && goal.status === 'active') {
        await models.sequelize.query(
          `UPDATE career_goals SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = :id`,
          { replacements: { id: goal.id } }
        );
        completed.push({ id: goal.id, title: goal.title, metric: goal.target_metric });
      }
    }

    return res.json({ success: true, synced, completed });
  } catch (error) {
    console.error('Sync goals error:', error);
    return res.status(500).json({ error: 'Failed to sync goals', message: error.message });
  }
});


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// GET /api/v1/world/:showId/suggest-events
// Suggest events from library based on active goals
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

router.get('/world/:showId/suggest-events', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const { limit = 3 } = req.query;
    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    // Get active goals
    const [goals] = await models.sequelize.query(
      `SELECT * FROM career_goals WHERE show_id = :showId AND status = 'active'`,
      { replacements: { showId } }
    );

    // Get character state
    let charState = {};
    try {
      const [states] = await models.sequelize.query(
        `SELECT * FROM character_state WHERE show_id = :showId AND character_key = 'lala' LIMIT 1`,
        { replacements: { showId } }
      );
      if (states?.length) charState = states[0];
    } catch (e) {}

    // Get available events (not used, or reusable)
    const [events] = await models.sequelize.query(
      `SELECT * FROM world_events WHERE show_id = :showId AND status IN ('draft', 'ready') ORDER BY prestige ASC`,
      { replacements: { showId } }
    );

    if (!events.length) {
      return res.json({ success: true, suggestions: [], note: 'No available events in library' });
    }

    // Score each event against active goals
    const scored = events.map(ev => {
      let score = 0;
      const reasons = [];

      // Prestige alignment with reputation (Â±2 range)
      const rep = charState.reputation || 1;
      const prestigeDiff = Math.abs((ev.prestige || 5) - rep);
      if (prestigeDiff <= 2) { score += 3; reasons.push('prestige matches reputation'); }
      if (prestigeDiff <= 1) { score += 2; reasons.push('sweet spot difficulty'); }

      // Check requirements met
      const reqs = typeof ev.requirements === 'string' ? JSON.parse(ev.requirements || '{}') : (ev.requirements || {});
      let reqsMet = true;
      if (reqs.reputation_min && (charState.reputation || 0) < reqs.reputation_min) reqsMet = false;
      if (reqs.brand_trust_min && (charState.brand_trust || 0) < reqs.brand_trust_min) reqsMet = false;
      if (!reqsMet) { score -= 5; reasons.push('requirements not met'); }

      // Goal alignment
      for (const goal of goals) {
        // Paid events help coin goals
        if (goal.target_metric === 'coins' && ev.is_paid) {
          score += 3; reasons.push(`helps "${goal.title}" (coins)`);
        }
        // High prestige events help reputation goals
        if (goal.target_metric === 'reputation' && (ev.prestige || 0) >= 5) {
          score += 3; reasons.push(`helps "${goal.title}" (reputation)`);
        }
        // Brand deals help brand_trust goals
        if (goal.target_metric === 'brand_trust' && ev.event_type === 'brand_deal') {
          score += 3; reasons.push(`helps "${goal.title}" (brand trust)`);
        }
        // High influence events help influence goals
        if (goal.target_metric === 'influence' && (ev.prestige || 0) >= 6) {
          score += 2; reasons.push(`helps "${goal.title}" (influence)`);
        }
      }

      // Tension bonus: event creates conflict between goals
      const helpsCoinGoal = goals.some(g => g.target_metric === 'coins') && ev.is_paid;
      const costsCoins = (ev.cost_coins || 0) > 50;
      const helpsRepGoal = goals.some(g => g.target_metric === 'reputation') && (ev.prestige || 0) >= 5;
      if (helpsCoinGoal && !helpsRepGoal) { score += 1; reasons.push('money vs prestige tension'); }
      if (helpsRepGoal && costsCoins) { score += 2; reasons.push('prestige vs money tension â€” great drama'); }

      // Variety bonus: prefer different event types
      if (ev.event_type === 'fail_test') { score += 1; reasons.push('failure arc opportunity'); }

      return { ...ev, suggestion_score: score, suggestion_reasons: reasons, requirements_met: reqsMet };
    });

    // Sort by score, take top N
    scored.sort((a, b) => b.suggestion_score - a.suggestion_score);
    const suggestions = scored.slice(0, parseInt(limit));

    return res.json({
      success: true,
      suggestions,
      active_goals: goals.map(g => ({ id: g.id, title: g.title, type: g.type, target_metric: g.target_metric })),
      character_state: {
        reputation: charState.reputation, coins: charState.coins,
        brand_trust: charState.brand_trust, influence: charState.influence, stress: charState.stress,
      },
    });
  } catch (error) {
    console.error('Suggest events error:', error);
    return res.status(500).json({ error: 'Failed to suggest events', message: error.message });
  }
});


module.exports = router;
