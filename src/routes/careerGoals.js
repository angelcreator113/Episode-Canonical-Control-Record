/**
 * Career Goals Routes
 * 
 * GET    /api/v1/world/:showId/goals          — List goals (active, completed, all)
 * POST   /api/v1/world/:showId/goals          — Create goal
 * PUT    /api/v1/world/:showId/goals/:goalId  — Update goal
 * DELETE /api/v1/world/:showId/goals/:goalId  — Delete goal
 * POST   /api/v1/world/:showId/goals/sync     — Sync goal progress from character state
 * GET    /api/v1/world/:showId/suggest-events  — Suggest events based on active goals
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


// ═══════════════════════════════════════════
// GET /api/v1/world/:showId/goals
// ═══════════════════════════════════════════

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


// ═══════════════════════════════════════════
// POST /api/v1/world/:showId/goals
// ═══════════════════════════════════════════

router.post('/world/:showId/goals', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const {
      title, description, type = 'secondary',
      target_metric, target_value, current_value = 0,
      priority = 3, icon = '🎯', color = '#6366f1',
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


// ═══════════════════════════════════════════
// PUT /api/v1/world/:showId/goals/:goalId
// ═══════════════════════════════════════════

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


// ═══════════════════════════════════════════
// DELETE /api/v1/world/:showId/goals/:goalId
// ═══════════════════════════════════════════

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


// ═══════════════════════════════════════════
// POST /api/v1/world/:showId/goals/sync
// Sync goal current_value from character state
// ═══════════════════════════════════════════

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


// ═══════════════════════════════════════════
// GET /api/v1/world/:showId/suggest-events
// Suggest events from library based on active goals
// ═══════════════════════════════════════════

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

      // Prestige alignment with reputation (±2 range)
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
      if (helpsRepGoal && costsCoins) { score += 2; reasons.push('prestige vs money tension — great drama'); }

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


// ═══════════════════════════════════════════
// SEED DATA — 24 Goals (3 Passive + 5 Primary + 16 Secondary)
// ═══════════════════════════════════════════

const SEED_GOALS = [
  // ─── PASSIVE (Always Active) ───
  {
    title: 'Stay Consistent',
    type: 'passive',
    target_metric: 'consistency_streak',
    target_value: 7,
    icon: '🔥',
    color: '#f97316',
    description: 'Maintain a 7-day posting streak. Losing the streak costs brand trust and engagement.',
    priority: 5,
  },
  {
    title: 'Manage Stress',
    type: 'passive',
    target_metric: 'stress',
    target_value: 3,
    icon: '😰',
    color: '#eab308',
    description: 'Keep stress at or below 3. Stress 5+ increases flop risk. Stress 8+ forces a rest episode.',
    priority: 5,
  },
  {
    title: 'Keep the Lights On',
    type: 'passive',
    target_metric: 'coins',
    target_value: 0,
    icon: '🏦',
    color: '#dc2626',
    description: 'Never go below 0 coins. Negative coins blocks paid events and triggers forced budget episodes.',
    priority: 5,
  },

  // ─── TIER 1: EMERGING (Rep 0-2) — "Finding Her Voice" ───
  {
    title: 'First Impressions',
    type: 'primary',
    target_metric: 'reputation',
    target_value: 3,
    icon: '🌱',
    color: '#22c55e',
    description: 'Build enough reputation that brands start noticing. Attend 3+ events without a major flop.',
    priority: 1,
    unlocks_on_complete: ['brand_dms', 'tier_2_events'],
    fail_consequence: 'Season stalls — stuck in local events longer.',
    episode_range: { start: 1, end: 6 },
  },
  {
    title: 'Build the Portfolio',
    type: 'secondary',
    target_metric: 'portfolio_strength',
    target_value: 5,
    icon: '📸',
    color: '#6366f1',
    description: 'Create enough quality content that her feed looks professional. Complete 5 deliverables.',
    priority: 2,
    unlocks_on_complete: ['higher_event_invites', 'brand_gifting_access'],
    episode_range: { start: 1, end: 4 },
  },
  {
    title: 'First 5K',
    type: 'secondary',
    target_metric: 'followers',
    target_value: 5000,
    icon: '👥',
    color: '#8b5cf6',
    description: 'Grow audience to 5,000 followers. Every event post, story, and reel counts.',
    priority: 2,
    unlocks_on_complete: ['brand_collab_eligibility', 'creator_meetup_invites'],
    episode_range: { start: 2, end: 6 },
  },
  {
    title: 'Starter Fund',
    type: 'secondary',
    target_metric: 'coins',
    target_value: 500,
    icon: '🪙',
    color: '#eab308',
    description: 'Save enough coins to afford a mid-tier event entry. No impulse closet spending.',
    priority: 3,
    unlocks_on_complete: ['mid_tier_entry_fees', 'closet_upgrade_v2'],
    episode_range: { start: 1, end: 5 },
  },

  // ─── TIER 2: RISING (Rep 3-4) — "The Hustle" ───
  {
    title: 'Brand Girl Era',
    type: 'primary',
    target_metric: 'brand_trust',
    target_value: 4,
    icon: '🤝',
    color: '#6366f1',
    description: 'Prove she can deliver for brands. Complete every deliverable on time. Don\'t ghost a brand.',
    priority: 1,
    unlocks_on_complete: ['recurring_brand_deals', 'ambassador_trial'],
    fail_consequence: 'Brands stop reaching out. Must rebuild from Tier 1 events.',
    episode_range: { start: 7, end: 12 },
  },
  {
    title: 'The Money Talk',
    type: 'secondary',
    target_metric: 'coins',
    target_value: 2000,
    icon: '💰',
    color: '#16a34a',
    description: 'Stack coins for the luxury tier. Paid gigs + smart spending. Every coin counts.',
    priority: 2,
    unlocks_on_complete: ['prestige_entry_fees', 'emergency_fund'],
    episode_range: { start: 7, end: 10 },
  },
  {
    title: 'Growing Influence',
    type: 'secondary',
    target_metric: 'influence',
    target_value: 4,
    icon: '📣',
    color: '#ec4899',
    description: 'People aren\'t just seeing her content — they\'re sharing it. Influence drives event invites.',
    priority: 2,
    unlocks_on_complete: ['prestige_events', 'collab_opportunities'],
    episode_range: { start: 8, end: 12 },
  },
  {
    title: 'Survive the Flop',
    type: 'secondary',
    target_metric: 'reputation',
    target_value: 3,
    icon: '🛡️',
    color: '#64748b',
    description: 'After first major failure, don\'t spiral. Maintain reputation through the recovery arc.',
    priority: 2,
    unlocks_on_complete: ['comeback_narrative', 'audience_sympathy_boost'],
    fail_consequence: 'Reputation drops below Tier 2 threshold. Must re-earn entry.',
    episode_range: { start: 9, end: 11 },
  },

  // ─── TIER 3: ESTABLISHED (Rep 5-6) — "The Climb" ───
  {
    title: 'Luxury Access',
    type: 'primary',
    target_metric: 'reputation',
    target_value: 7,
    icon: '✨',
    color: '#FFD700',
    description: 'Break into the luxury tier. Get invited to events where the real industry lives.',
    priority: 1,
    unlocks_on_complete: ['luxury_brand_invites', 'fashion_week', 'press_credentials'],
    fail_consequence: 'Stuck in mid-tier. Must grind reputation through more events.',
    episode_range: { start: 13, end: 18 },
  },
  {
    title: 'Trust the Process',
    type: 'secondary',
    target_metric: 'brand_trust',
    target_value: 6,
    icon: '💎',
    color: '#7c3aed',
    description: 'Luxury brands need trust before they invest. Deliver flawlessly. No missed deadlines.',
    priority: 2,
    unlocks_on_complete: ['ambassador_trials', 'product_loans', 'showroom_access'],
    episode_range: { start: 13, end: 16 },
  },
  {
    title: '25K Strong',
    type: 'secondary',
    target_metric: 'followers',
    target_value: 25000,
    icon: '📈',
    color: '#06b6d4',
    description: 'Audience size matters for brand deals. 25K is where paid partnerships get serious.',
    priority: 2,
    unlocks_on_complete: ['paid_tier_increase', 'podcast_invites'],
    episode_range: { start: 14, end: 18 },
  },
  {
    title: 'Closet Upgrade',
    type: 'secondary',
    target_metric: 'coins',
    target_value: 5000,
    icon: '👗',
    color: '#f472b6',
    description: 'Save for the luxury closet upgrade. Better wardrobe = better outfit match = higher scores.',
    priority: 3,
    unlocks_on_complete: ['luxury_wardrobe_tier', 'exclusive_outfits', 'higher_base_match'],
    episode_range: { start: 13, end: 17 },
  },

  // ─── TIER 4: INFLUENTIAL (Rep 7-8) — "The Test" ───
  {
    title: 'The Maison Belle Contract',
    type: 'primary',
    target_metric: 'brand_trust',
    target_value: 8,
    icon: '🏛️',
    color: '#1a1a2e',
    description: 'THE goal. Secure a long-term contract with a luxury house. Brand trust 8 means they know she\'s reliable, creative, and on-brand.',
    priority: 1,
    unlocks_on_complete: ['signature_collection', 'creative_director_meetings', 'finale_invitation'],
    fail_consequence: 'Contract delayed to next season. Must maintain trust through pressure.',
    episode_range: { start: 19, end: 24 },
  },
  {
    title: 'The Pressure of Influence',
    type: 'secondary',
    target_metric: 'stress',
    target_value: 4,
    icon: '🧘',
    color: '#f59e0b',
    description: 'At this level, everything is high-stakes. Managing stress is survival. Burnout = career damage.',
    priority: 2,
    unlocks_on_complete: ['calm_under_pressure_brand'],
    episode_range: { start: 19, end: 22 },
  },
  {
    title: 'Financial Independence',
    type: 'secondary',
    target_metric: 'coins',
    target_value: 10000,
    icon: '🏦',
    color: '#16a34a',
    description: 'Past surviving — now building wealth. 10K coins = freedom to choose events by passion, not necessity.',
    priority: 2,
    unlocks_on_complete: ['event_choice_freedom', 'investment_opportunities'],
    episode_range: { start: 19, end: 23 },
  },
  {
    title: 'Global Reach',
    type: 'secondary',
    target_metric: 'influence',
    target_value: 8,
    icon: '🌍',
    color: '#3b82f6',
    description: 'International events, global campaigns, cross-cultural content. Influence 8 = the world is watching.',
    priority: 2,
    unlocks_on_complete: ['international_fashion_week', 'global_campaigns', 'documentary_interest'],
    episode_range: { start: 20, end: 24 },
  },

  // ─── TIER 5: ELITE (Rep 9-10) — "Legacy" ───
  {
    title: 'Legacy',
    type: 'primary',
    target_metric: 'reputation',
    target_value: 10,
    icon: '👑',
    color: '#FFD700',
    description: 'Maximum reputation. She\'s not just attending events — she IS the event. Icon status.',
    priority: 1,
    unlocks_on_complete: ['lifetime_achievement', 'co_design_collections', 'keynote_speaking', 'legacy_foundation'],
    episode_range: { start: 24, end: 30 },
  },
  {
    title: 'Give Back',
    type: 'secondary',
    target_metric: 'influence',
    target_value: 10,
    icon: '💝',
    color: '#ec4899',
    description: 'Use platform for good. Launch foundation, mentor emerging creators, create access for others.',
    priority: 2,
    unlocks_on_complete: ['philanthropy_events', 'legacy_documentary', 'lalas_closet_foundation'],
  },
  {
    title: 'The Perfect Collection',
    type: 'secondary',
    target_metric: 'coins',
    target_value: 25000,
    icon: '💎',
    color: '#a855f7',
    description: 'Enough wealth to launch her own line. The business goal behind the creative one.',
    priority: 2,
    unlocks_on_complete: ['signature_collection_launch', 'brand_ownership', 'financial_freedom'],
  },
];


// ═══════════════════════════════════════════
// POST /api/v1/world/:showId/goals/seed
// Import all 24 career goals
// ═══════════════════════════════════════════

router.post('/world/:showId/goals/seed', optionalAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const { clear_existing = false, activate_tier = 1 } = req.body;

    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    // Optionally clear existing goals
    if (clear_existing) {
      await models.sequelize.query(
        `DELETE FROM career_goals WHERE show_id = :showId`,
        { replacements: { showId } }
      );
    }

    // Get character state for auto-populating current values
    let charState = {};
    try {
      const [states] = await models.sequelize.query(
        `SELECT * FROM character_state WHERE show_id = :showId AND character_key = 'lala' LIMIT 1`,
        { replacements: { showId } }
      );
      if (states?.length) charState = states[0];
    } catch (e) {}

    // Determine which goals to activate based on tier
    const tierMap = {
      1: { primary: 'First Impressions', secondaries: ['Build the Portfolio', 'First 5K'] },
      2: { primary: 'Brand Girl Era', secondaries: ['The Money Talk', 'Growing Influence'] },
      3: { primary: 'Luxury Access', secondaries: ['Trust the Process', '25K Strong'] },
      4: { primary: 'The Maison Belle Contract', secondaries: ['The Pressure of Influence', 'Financial Independence'] },
      5: { primary: 'Legacy', secondaries: ['Give Back', 'The Perfect Collection'] },
    };

    const activeTier = tierMap[activate_tier] || tierMap[1];
    const activeNames = new Set([
      activeTier.primary,
      ...activeTier.secondaries,
      'Stay Consistent', 'Manage Stress', 'Keep the Lights On', // passives always active
    ]);

    let created = 0;
    let skipped = 0;
    const results = [];

    for (const goal of SEED_GOALS) {
      // Check if goal already exists for this show
      const [existing] = await models.sequelize.query(
        `SELECT id FROM career_goals WHERE show_id = :showId AND title = :title LIMIT 1`,
        { replacements: { showId, title: goal.title } }
      );

      if (existing?.length > 0) {
        skipped++;
        continue;
      }

      // Get current value from character state
      const currentValue = charState[goal.target_metric] !== undefined
        ? parseFloat(charState[goal.target_metric])
        : 0;

      // Determine status: active for current tier + passives, paused for others
      const isActive = activeNames.has(goal.title);
      const status = isActive ? 'active' : 'paused';

      const id = uuidv4();
      await models.sequelize.query(
        `INSERT INTO career_goals
         (id, show_id, title, description, type, target_metric, target_value,
          current_value, starting_value, status, priority, icon, color,
          unlocks_on_complete, fail_consequence, episode_range,
          created_at, updated_at)
         VALUES
         (:id, :showId, :title, :description, :type, :target_metric, :target_value,
          :current_value, :starting_value, :status, :priority, :icon, :color,
          :unlocks_on_complete, :fail_consequence, :episode_range,
          NOW(), NOW())`,
        {
          replacements: {
            id, showId,
            title: goal.title,
            description: goal.description || null,
            type: goal.type,
            target_metric: goal.target_metric,
            target_value: goal.target_value,
            current_value: currentValue,
            starting_value: currentValue,
            status,
            priority: goal.priority || 3,
            icon: goal.icon || '🎯',
            color: goal.color || '#6366f1',
            unlocks_on_complete: JSON.stringify(goal.unlocks_on_complete || []),
            fail_consequence: goal.fail_consequence || null,
            episode_range: goal.episode_range ? JSON.stringify(goal.episode_range) : null,
          },
        }
      );

      created++;
      results.push({ title: goal.title, type: goal.type, status, metric: goal.target_metric });
    }

    return res.json({
      success: true,
      created,
      skipped,
      total: SEED_GOALS.length,
      activate_tier,
      active_goals: results.filter(r => r.status === 'active').map(r => `${r.type}: ${r.title}`),
      paused_goals: results.filter(r => r.status === 'paused').map(r => `${r.type}: ${r.title}`),
    });
  } catch (error) {
    console.error('Seed goals error:', error);
    return res.status(500).json({ error: 'Failed to seed goals', message: error.message });
  }
});


module.exports = router;
