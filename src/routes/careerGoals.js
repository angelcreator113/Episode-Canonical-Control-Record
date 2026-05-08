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

const { requireAuth } = require('../middleware/auth');

async function getModels() {
  try { return require('../models'); } catch (e) { return null; }
}


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// GET /api/v1/world/:showId/goals
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

router.get('/world/:showId/goals', requireAuth, async (req, res) => {
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
// POST /api/v1/world/:showId/goals/seed
// Seed 24 career goals from the show bible
// ═══════════════════════════════════════════

router.post('/world/:showId/goals/seed', requireAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const { activate_tier = 1 } = req.body;
    const models = await getModels();
    if (!models) return res.status(500).json({ error: 'Models not loaded' });

    // Check for existing goals to avoid duplicates
    let existingTitles = new Set();
    try {
      const [existing] = await models.sequelize.query(
        'SELECT title FROM career_goals WHERE show_id = :showId',
        { replacements: { showId } }
      );
      existingTitles = new Set((existing || []).map(g => g.title.toLowerCase().trim()));
    } catch { /* table may not exist yet */ }

    // ── LALA'S 24 CAREER GOALS ──────────────────────────────────────────
    // Rooted in the show bible:
    //   Wound: "She inherited her mother's ambition but not her patience."
    //   Goal: "To become something that can't be copied."
    //   World: Fashion is strategy. Reputation is currency.
    //   Season 1: Soft Luxury Ascension — Lala earns her place
    //
    // 3 arcs of 8 episodes:
    //   Arc 1 (Ep 1-8):  Foundation — proving she belongs
    //   Arc 2 (Ep 9-16): Ascension — climbing the ladder
    //   Arc 3 (Ep 17-24): Legacy — becoming uncopyable

    const SEED_GOALS = [
      // ── ARC 1: FOUNDATION (Ep 1-8) ──
      {
        title: 'Earn a seat at the table',
        description: 'Reach reputation 5. The industry notices you. You\'re no longer scrolling from the outside.',
        type: 'primary', target_metric: 'reputation', target_value: 5, current_value: 0, starting_value: 0,
        priority: 1, icon: '⭐', color: '#B8962E',
        episode_range: [1, 8],
        unlocks_on_complete: [{ type: 'opportunity', name: 'First magazine feature offer' }],
        fail_consequence: 'Lala starts questioning if she was built for this world.',
      },
      {
        title: 'Build the war chest',
        description: 'Save 2,000 coins. Can\'t play the game if you can\'t afford the outfit.',
        type: 'secondary', target_metric: 'coins', target_value: 2000, current_value: 500, starting_value: 500,
        priority: 2, icon: '💫', color: '#22c55e',
        episode_range: [1, 8],
        unlocks_on_complete: [{ type: 'opportunity', name: 'Luxury brand sampling invite' }],
        fail_consequence: 'Lala starts cutting corners on wardrobe. People notice.',
      },
      {
        title: 'Find your people',
        description: 'Grow influence to 3. Build an audience that actually cares, not just numbers.',
        type: 'secondary', target_metric: 'influence', target_value: 3, current_value: 0, starting_value: 0,
        priority: 2, icon: '📈', color: '#6366f1',
        episode_range: [1, 8],
        unlocks_on_complete: [{ type: 'event', name: 'Creator meetup invitation' }],
        fail_consequence: 'The algorithm buries her. She wonders if anyone is watching.',
      },
      {
        title: 'Stay consistent',
        description: 'Post content 3 episodes in a row without missing. The game rewards the ones who show up.',
        type: 'passive', target_metric: 'consistency_streak', target_value: 3, current_value: 0, starting_value: 0,
        priority: 4, icon: '🔥', color: '#f59e0b',
        episode_range: [1, 8],
      },
      {
        title: 'Don\'t go broke',
        description: 'Never let coins drop below 100. Broke Lala is stressed Lala.',
        type: 'passive', target_metric: 'coins', target_value: 100, current_value: 500, starting_value: 500,
        priority: 5, icon: '🏦', color: '#ef4444',
        episode_range: [1, 24],
        fail_consequence: 'Financial stress affects outfit choices and event attendance.',
      },
      {
        title: 'Study the competition',
        description: 'Follow and analyze 10 creators in your lane. Know who you\'re up against.',
        type: 'passive', target_metric: 'custom', target_value: 10, current_value: 0, starting_value: 0,
        priority: 5, icon: '👀', color: '#8b5cf6',
        episode_range: [1, 12],
      },
      {
        title: 'Land your first brand deal',
        description: 'Get brand trust to 3. Someone has to believe in you before you believe in yourself.',
        type: 'secondary', target_metric: 'brand_trust', target_value: 3, current_value: 0, starting_value: 0,
        priority: 3, icon: '🤝', color: '#0ea5e9',
        episode_range: [1, 10],
        unlocks_on_complete: [{ type: 'opportunity', name: 'Paid partnership offer' }],
        fail_consequence: 'Brands pass on Lala. She wonders what they see that she doesn\'t.',
      },
      {
        title: 'Survive your first public failure',
        description: 'Fail at an event and recover. Reputation drops below 2 then climbs back to 3.',
        type: 'passive', target_metric: 'reputation', target_value: 3, current_value: 0, starting_value: 0,
        priority: 5, icon: '💪', color: '#ec4899',
        episode_range: [3, 10],
      },

      // ── ARC 2: ASCENSION (Ep 9-16) ──
      {
        title: 'Become somebody they talk about',
        description: 'Reach reputation 7. When you walk in, people already know your name.',
        type: 'primary', target_metric: 'reputation', target_value: 7, current_value: 0, starting_value: 0,
        priority: 1, icon: '👑', color: '#B8962E',
        episode_range: [9, 16],
        unlocks_on_complete: [{ type: 'opportunity', name: 'Award show nomination' }],
        fail_consequence: 'Lala plateaus. The industry moves on without her.',
      },
      {
        title: 'Build real influence',
        description: 'Reach influence 6. Not just followers — people who move when you speak.',
        type: 'secondary', target_metric: 'influence', target_value: 6, current_value: 0, starting_value: 0,
        priority: 2, icon: '📈', color: '#6366f1',
        episode_range: [9, 16],
        unlocks_on_complete: [{ type: 'event', name: 'Podcast feature request' }],
      },
      {
        title: 'Stack the coins',
        description: 'Reach 5,000 coins. Luxury costs luxury money. No more budget compromises.',
        type: 'secondary', target_metric: 'coins', target_value: 5000, current_value: 0, starting_value: 0,
        priority: 2, icon: '💰', color: '#22c55e',
        episode_range: [9, 16],
        unlocks_on_complete: [{ type: 'opportunity', name: 'Designer wardrobe partnership' }],
      },
      {
        title: 'Get the engagement rate up',
        description: 'Reach 7% engagement rate. Quality over quantity — the algorithm rewards real connection.',
        type: 'secondary', target_metric: 'engagement_rate', target_value: 7, current_value: 0, starting_value: 0,
        priority: 3, icon: '💬', color: '#f59e0b',
        episode_range: [9, 16],
      },
      {
        title: 'Build a portfolio that speaks',
        description: 'Portfolio strength to 5. When someone Googles you, what do they find?',
        type: 'passive', target_metric: 'portfolio_strength', target_value: 5, current_value: 0, starting_value: 0,
        priority: 4, icon: '📸', color: '#ec4899',
        episode_range: [9, 20],
      },
      {
        title: 'Make brands trust you with money',
        description: 'Brand trust to 6. They stop sending free product. They start writing checks.',
        type: 'secondary', target_metric: 'brand_trust', target_value: 6, current_value: 0, starting_value: 0,
        priority: 3, icon: '💎', color: '#0ea5e9',
        episode_range: [9, 16],
        unlocks_on_complete: [{ type: 'opportunity', name: 'Ambassador role offer' }],
        fail_consequence: 'A brand drops Lala for a competitor. The DM is devastating.',
      },
      {
        title: 'Outlast someone who started with more',
        description: 'Maintain momentum above 5 for 4 consecutive episodes while a competitor falls.',
        type: 'passive', target_metric: 'custom', target_value: 4, current_value: 0, starting_value: 0,
        priority: 5, icon: '🏁', color: '#8b5cf6',
        episode_range: [9, 16],
      },
      {
        title: 'Handle the drama without breaking',
        description: 'Survive a controversy (reputation drops 2+ points) and recover within 3 episodes.',
        type: 'passive', target_metric: 'custom', target_value: 1, current_value: 0, starting_value: 0,
        priority: 5, icon: '🛡️', color: '#ef4444',
        episode_range: [9, 20],
      },

      // ── ARC 3: LEGACY (Ep 17-24) ──
      {
        title: 'Become something that can\'t be copied',
        description: 'Reach reputation 9. The room she built herself. The ceiling she was always reaching for.',
        type: 'primary', target_metric: 'reputation', target_value: 9, current_value: 0, starting_value: 0,
        priority: 1, icon: '✦', color: '#B8962E',
        episode_range: [17, 24],
        unlocks_on_complete: [{ type: 'event', name: 'Lala\'s own event — she hosts' }],
        fail_consequence: 'She got close. Close enough to see what she could have been.',
      },
      {
        title: 'Max influence',
        description: 'Reach influence 9. When Lala moves, the culture moves with her.',
        type: 'secondary', target_metric: 'influence', target_value: 9, current_value: 0, starting_value: 0,
        priority: 2, icon: '🌟', color: '#6366f1',
        episode_range: [17, 24],
      },
      {
        title: 'Financial freedom',
        description: 'Reach 10,000 coins. Never stress about an outfit again. Never compromise.',
        type: 'secondary', target_metric: 'coins', target_value: 10000, current_value: 0, starting_value: 0,
        priority: 2, icon: '🏆', color: '#22c55e',
        episode_range: [17, 24],
        unlocks_on_complete: [{ type: 'opportunity', name: 'Launch her own brand' }],
      },
      {
        title: 'Build the room instead of entering it',
        description: 'Host your own event with prestige 8+. Stop waiting for invitations.',
        type: 'secondary', target_metric: 'custom', target_value: 1, current_value: 0, starting_value: 0,
        priority: 3, icon: '🏛️', color: '#B8962E',
        episode_range: [17, 24],
        unlocks_on_complete: [{ type: 'event', name: 'The Lala Gala — her legacy event' }],
      },
      {
        title: 'Brand trust at legendary',
        description: 'Brand trust to 9. Brands don\'t approach you — they apply.',
        type: 'secondary', target_metric: 'brand_trust', target_value: 9, current_value: 0, starting_value: 0,
        priority: 3, icon: '💎', color: '#0ea5e9',
        episode_range: [17, 24],
      },
      {
        title: 'Perfect portfolio',
        description: 'Portfolio strength to 8. Every piece tells a story. Every story is hers.',
        type: 'passive', target_metric: 'portfolio_strength', target_value: 8, current_value: 0, starting_value: 0,
        priority: 4, icon: '📸', color: '#ec4899',
        episode_range: [17, 24],
      },
      {
        title: 'The woman who builds rooms',
        description: 'Complete 3 primary goals across all arcs. The full journey from nobody to uncopyable.',
        type: 'passive', target_metric: 'custom', target_value: 3, current_value: 0, starting_value: 0,
        priority: 5, icon: '🪞', color: '#8b5cf6',
        episode_range: [1, 24],
      },
    ];

    let created = 0;
    let skipped = 0;

    for (const goal of SEED_GOALS) {
      if (existingTitles.has(goal.title.toLowerCase().trim())) {
        skipped++;
        continue;
      }

      const arcStart = goal.episode_range?.[0] || 1;
      const isActiveTier = arcStart <= (activate_tier === 1 ? 8 : activate_tier === 2 ? 16 : 24);

      try {
        await models.sequelize.query(
          `INSERT INTO career_goals (id, show_id, title, description, type, target_metric,
           target_value, current_value, starting_value, status, priority,
           unlocks_on_complete, fail_consequence, episode_range, icon, color, created_at, updated_at)
           VALUES (:id, :showId, :title, :description, :type, :target_metric,
           :target_value, :current_value, :starting_value, :status, :priority,
           :unlocks_on_complete, :fail_consequence, :episode_range, :icon, :color, NOW(), NOW())`,
          { replacements: {
            id: uuidv4(),
            showId,
            title: goal.title,
            description: goal.description,
            type: goal.type,
            target_metric: goal.target_metric,
            target_value: goal.target_value,
            current_value: goal.current_value || 0,
            starting_value: goal.starting_value || 0,
            status: isActiveTier ? 'active' : 'paused',
            priority: goal.priority,
            unlocks_on_complete: JSON.stringify(goal.unlocks_on_complete || []),
            fail_consequence: goal.fail_consequence || null,
            episode_range: JSON.stringify(goal.episode_range || [1, 24]),
            icon: goal.icon || '🎯',
            color: goal.color || '#6366f1',
          } }
        );
        created++;
      } catch (err) {
        console.warn(`[CareerGoals] Failed to seed "${goal.title}":`, err.message);
        skipped++;
      }
    }

    return res.json({
      success: true,
      created,
      skipped,
      total: SEED_GOALS.length,
      message: `Seeded ${created} career goals (${skipped} skipped). Arc 1 goals active, Arc 2-3 paused.`,
    });
  } catch (error) {
    console.error('[CareerGoals] Seed error:', error);
    return res.status(500).json({ error: error.message });
  }
});


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// POST /api/v1/world/:showId/goals
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

router.post('/world/:showId/goals', requireAuth, async (req, res) => {
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

router.put('/world/:showId/goals/:goalId', requireAuth, async (req, res) => {
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

router.delete('/world/:showId/goals/:goalId', requireAuth, async (req, res) => {
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

router.post('/world/:showId/goals/sync', requireAuth, async (req, res) => {
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

        // Spawn unlock opportunities from completed goal
        try {
          const unlocks = typeof goal.unlocks_on_complete === 'string'
            ? JSON.parse(goal.unlocks_on_complete)
            : (goal.unlocks_on_complete || []);
          if (unlocks.length > 0) {
            const { spawnUnlockOpportunities } = require('../services/careerPipelineService');
            await spawnUnlockOpportunities(showId, goal, unlocks, models);
          }
        } catch (err) { console.warn('[GoalSync] Unlock spawn failed:', err.message); }
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

router.get('/world/:showId/suggest-events', requireAuth, async (req, res) => {
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
    } catch (e) { console.warn('[career-goals] character state query error:', e?.message); }

    // Determine accessible career tier
    let careerTier = 5;
    try {
      const { getAccessibleCareerTier } = require('../services/careerPipelineService');
      careerTier = await getAccessibleCareerTier(showId, models);
    } catch { /* default to 5 — no gating */ }

    // Get available events (not used, or reusable), filtered by career tier
    const [events] = await models.sequelize.query(
      `SELECT * FROM world_events WHERE show_id = :showId AND status IN ('draft', 'ready')
       AND (career_tier IS NULL OR career_tier <= :careerTier)
       ORDER BY prestige ASC`,
      { replacements: { showId, careerTier } }
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
      // coins_min — gate on Lala's current balance. Editor in WorldAdmin
      // exposes this alongside the other two minimums.
      if (reqs.coins_min && (charState.coins || 0) < reqs.coins_min) reqsMet = false;
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
