/**
 * episodeOrchestrationRoute.js
 * POST /api/v1/memories/generate-episode-orchestration
 *
 * Generates a director-level 9-beat orchestration plan for a Styling Adventures episode.
 * Outputs TWO parallel structures:
 *   1. orchestration — structured beat plan with UI action grammar, motion cues, economy hooks
 *   2. prose_script — JLAW narrator beats + Lala dialogue, readable format
 *
 * Beat 6 (Transformation Loop) is wired directly to the wardrobe browse-pool
 * scoring engine — it pulls actual item names, tiers, and Lala reactions
 * instead of generating placeholder wardrobe descriptions.
 */

'use strict';

const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { requireAuth } = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/aiRateLimiter');

const client = new Anthropic();

// ── Browse-pool scoring (inlined from wardrobeRoutes.js logic) ────────────

async function getWardrobePool(show_id, event) {
  try {
    const db = require('../models');

    // Pull all wardrobe items for this show
    const [items] = await db.sequelize.query(
      `SELECT * FROM game_wardrobe WHERE show_id = :show_id`,
      { replacements: { show_id } }
    );

    if (!items || items.length === 0) return null;

    const dresscodeKw = (event.dress_code_keywords || []).map(k => k.toLowerCase());
    const eventTypes = (event.event_types || [event.event_type]).map(e => (e || '').toLowerCase());
    const eventPrestige = event.prestige || 5;

    const prestigeTierMap = { basic: 1, mid: 2, luxury: 3, elite: 4 };
    const prestige4 = Math.ceil((eventPrestige / 10) * 4);

    const scored = items.map(item => {
      let score = 0;
      const aestheticTags = (item.aesthetic_tags || []).map(t => t.toLowerCase());
      const itemEventTypes = (item.event_types || []).map(t => t.toLowerCase());

      // Dress code keyword match (max 30)
      const kwMatches = aestheticTags.filter(t => dresscodeKw.includes(t)).length;
      score += Math.min(kwMatches * 10, 30);

      // Event type match (max 20)
      const evMatches = itemEventTypes.filter(t => eventTypes.includes(t)).length;
      score += Math.min(evMatches * 10, 20);

      // Tier alignment (max 15)
      const itemTierNum = prestigeTierMap[item.tier] || 2;
      const tierDiff = Math.abs(itemTierNum - prestige4);
      score += Math.max(0, 15 - tierDiff * 5);

      // Match weight bonus
      score += item.outfit_match_weight || 0;

      // Brand alignment (max 10)
      if (event.host_brand && item.brand_alignment === event.host_brand) score += 10;

      // Ownership
      const isOwned = item.is_owned;
      const canUnlock = !isOwned && item.lock_type === 'coin';

      let riskLevel;
      if (isOwned && score >= 30) riskLevel = 'safe';
      else if (canUnlock) riskLevel = 'stretch';
      else if (isOwned) riskLevel = 'risky';
      else riskLevel = 'locked_tease';

      return { ...item, score, riskLevel, isOwned, canUnlock };
    });

    scored.sort((a, b) => b.score - a.score);

    // Curate pool
    const safe = scored.filter(i => i.riskLevel === 'safe').slice(0, 3);
    const stretch = scored.filter(i => i.riskLevel === 'stretch').slice(0, 3);
    const risky = scored.filter(i => i.riskLevel === 'risky').slice(0, 1);
    const tease = scored.filter(i => i.riskLevel === 'locked_tease').slice(0, 1);

    const pool = [...safe, ...stretch, ...risky, ...tease];

    // Ensure required categories
    const required = ['dress', 'shoes'];
    for (const cat of required) {
      const hasIt = pool.some(i => i.clothing_category === cat);
      if (!hasIt) {
        const fallback = scored.find(i => i.clothing_category === cat && !pool.includes(i));
        if (fallback) pool.push(fallback);
      }
    }

    // Group by category for Beat 6
    const byCategory = pool.reduce((acc, item) => {
      const cat = item.clothing_category || 'other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push({
        id: item.id,
        name: item.name,
        tier: item.tier,
        is_owned: item.is_owned,
        coin_cost: item.coin_cost,
        lock_type: item.lock_type,
        score: item.score,
        risk_level: item.riskLevel,
        lala_reaction_own: item.lala_reaction_own,
        lala_reaction_locked: item.lala_reaction_locked,
        aesthetic_tags: item.aesthetic_tags,
      });
      return acc;
    }, {});

    return { pool, byCategory, total: pool.length };
  } catch (err) {
    console.error('wardrobe pool error:', err);
    return null;
  }
}

// ── Main route ────────────────────────────────────────────────────────────

router.post('/generate-episode-orchestration', requireAuth, aiRateLimiter, async (req, res) => {
  const {
    show_id,
    episode_id,
    archetype = 'Invite Episode',
    arc_stage = 'early',
    reputation_level = 3,
    money_pressure = 'medium',
    tone = 'luxury',
    event_id,
    episode_number,
  } = req.body;

  if (!show_id) return res.status(400).json({ error: 'show_id required' });

  try {
    const db = require('../models');

    // Load event if provided
    let event = null;
    if (event_id) {
      const [rows] = await db.sequelize.query(
        `SELECT * FROM world_events WHERE id = :event_id LIMIT 1`,
        { replacements: { event_id } }
      );
      event = rows[0] || null;
    }

    // Load wardrobe pool wired to this event
    let wardrobePool = null;
    if (show_id) {
      wardrobePool = await getWardrobePool(show_id, event || {});
    }

    // Build orchestration prompt
    const prompt = buildOrchestrationPrompt({
      archetype,
      arc_stage,
      reputation_level,
      money_pressure,
      tone,
      event,
      wardrobePool,
      episode_number,
    });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 6000,
      system: `You are the showrunner and director of Styling Adventures with Lala — 
a Twitch-style fashion game show where Lala (a confident AI content creator) navigates 
game events in LalaVerse. JustAWoman plays as Lala on stream. The audience watches.

You write director-level episode orchestration: beat structure, UI action grammar, 
motion timing, economy hooks, and character behavior notes. You also write the prose 
script (JLAW narrator voice + Lala dialogue).

Lala speaks with wit, confidence, and zero apology. She is not performing — she lives 
in this world. JLAW narrates with warmth, realness, and occasional vulnerability. 
The audience feels both of them.

Respond ONLY with valid JSON. No preamble, no markdown fences.`,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = message.content[0].text.trim().replace(/```json|```/g, '').trim();
    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: 'Claude returned invalid JSON', raw });
    }

    // Attach actual wardrobe pool data to Beat 6 in the orchestration
    if (wardrobePool && result.orchestration) {
      const beat6 = result.orchestration.beats?.find(b => b.beat_number === 6);
      if (beat6) {
        beat6.wardrobe_pool = wardrobePool.byCategory;
        beat6.wardrobe_pool_total = wardrobePool.total;
      }
    }

    // Save to episode if episode_id provided
    if (episode_id && db.Episode) {
      try {
        await db.sequelize.query(
          `UPDATE episodes SET orchestration_data = :data, updated_at = NOW()
           WHERE id = :episode_id`,
          {
            replacements: {
              episode_id,
              data: JSON.stringify(result),
            },
          }
        );
      } catch (saveErr) {
        console.error('Could not save orchestration to episode:', saveErr.message);
        // Non-fatal — still return the result
      }
    }

    res.json({
      ...result,
      meta: {
        show_id,
        episode_id: episode_id || null,
        archetype,
        arc_stage,
        reputation_level,
        tone,
        event: event ? { id: event.id, name: event.name } : null,
        wardrobe_items_in_pool: wardrobePool?.total || 0,
      },
    });
  } catch (err) {
    console.error('orchestration error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Prompt builder ─────────────────────────────────────────────────────────

function buildOrchestrationPrompt({ archetype, arc_stage, reputation_level, money_pressure, tone, event, wardrobePool, episode_number }) {
  const eventBlock = event ? `
EVENT FOR THIS EPISODE:
  Name: ${event.name}
  Category: ${event.event_category || 'industry'}
  Dress code: ${event.dress_code || 'elegant'}
  Dress code keywords: ${(event.dress_code_keywords || []).join(', ')}
  Style aesthetic: ${event.style_aesthetic || 'elevated'}
  Prestige: ${event.prestige || 5}/10
  Strictness: ${event.strictness || 5}/10
  Reputation required: ${event.reputation_score || 1}
  Coin cost: ${event.coin_cost || 0}
  Host brand: ${event.host_brand || 'none'}
  Description: ${event.description || ''}
` : `NO SPECIFIC EVENT ASSIGNED — generate a fitting industry event for this archetype.`;

  const wardrobeBlock = wardrobePool ? `
WARDROBE POOL (from inventory, pre-scored against this event):
${wardrobePool.pool.slice(0, 8).map(item =>
    `  - [${item.tier.toUpperCase()}] ${item.name} (category: ${item.clothing_category}, score: ${item.score}/100, owned: ${item.is_owned}, risk: ${item.riskLevel})`
  ).join('\n')}

Beat 6 (Transformation Loop) MUST reference specific items from this pool by name.
DO NOT invent wardrobe items. Use only items listed above.
For each transformation slot (outfit, accessories, shoes, purse, fragrance), pick the best scoring item from the relevant category.
Include Lala's reaction line from the item's own personality.
` : `NO WARDROBE POOL AVAILABLE — describe Beat 6 generically with placeholder categories.`;

  const archetypeGuide = {
    'Invite Episode': 'Standard flow: arrive, style, attend, earn. Emphasis on the reveal moment and the transformation.',
    'Upgrade Episode': 'Lala levels up — reputation, wardrobe tier, or recognition. Beat 8 should feel earned.',
    'Guest Episode': 'Another character appears. Lala has to navigate the dynamic while maintaining her look and presence.',
    'Failure Episode': 'Dress code mismatch, late arrival, event denial, or reputation dip. Beat 8 delivers consequences. Beat 9 sets up recovery.',
    'Brand Deal Episode': 'A brand opportunity appears. Economy hooks are front and center. Beat 7 Interruption is the deal offer.',
    'Deliverable Episode': 'Lala has a creator task to complete. The episode structure bends around delivery, not attendance.',
  }[archetype] || 'Standard episode flow.';

  return `Generate a complete 9-beat episode orchestration for Styling Adventures with Lala.

INPUTS:
  Archetype: ${archetype}
  Arc stage: ${arc_stage} (early episodes build reputation; mid episodes create stakes; finale episodes pay off)
  Reputation level: ${reputation_level}/10
  Money pressure: ${money_pressure}
  Tone: ${tone}
  Episode number: ${episode_number || 'unspecified'}

${eventBlock}
${wardrobeBlock}

ARCHETYPE GUIDE: ${archetypeGuide}

UI ACTION GRAMMAR (use exactly these tags):
  [UI:OPEN PanelName] [UI:CLICK Element] [UI:SCROLL ItemName x5]
  [UI:SELECT ItemName] [UI:VOICE_ACTIVATE Lala] [UI:CLOSE PanelName]
  [FX:SPARKLE] [FX:GLOW] [FX:CONFETTI] [SCENE:LOAD LocationName]
  [MAIL:type=invite from=BrandName prestige=8 cost=100]
  [STAT_CHANGE:reputation=+1] [STAT_CHANGE:coins=-100] [STAT_CHANGE:dream_fund=+50]
  [CAM:zoom_in] [CAM:zoom_out] [MUSIC:theme_name]

BEAT STRUCTURE:
1. Opening Ritual (8-12s) — hook + ritual, login sequence, Lala idle, no event reveal yet
2. Creator Welcome (10-15s) — JLAW sets tone, teases mystery, Lala pose check
3. Interruption #1 — Mail ping (5-8s) — notification spike
4. Reveal #1 — Invite letter (15-20s) — event name, cost, tone, Lala's first reaction
5. Stakes + Intention (12-18s) — checklist appears, Lala voice activates, what's at risk
6. Transformation Loop (30-45s) — 5 micro-segments: outfit → accessories → shoes → purse → fragrance
   Each segment: [UI action] → [Lala reaction line] → [CHECKLIST item ✓]
   USE ACTUAL ITEM NAMES FROM THE WARDROBE POOL.
7. Interruption #2 — Optional (8-12s) — brand deal / DM / reminder — choose based on archetype
8. Event Travel + Payoff (15-20s) — location shift, final look reveal, what happens at the event
9. CTA + Cliffhanger (10-15s) — comment prompt, next episode teased

Return a JSON object with this structure:
{
  "episode_title_options": ["Option 1", "Option 2", "Option 3"],
  "episode_description": "2-sentence episode description for YouTube/TikTok",
  "orchestration": {
    "beats": [
      {
        "beat_number": 1,
        "beat_name": "Opening Ritual",
        "duration_target": "8-12s",
        "ui_actions": ["[UI:OPEN LoginScreen]", "[CAM:soft_zoom]"],
        "jlaw_narration": "JLAW narrator line here",
        "lala_dialogue": "Lala's line here (null if Lala is silent this beat)",
        "lala_motion": "What Lala is physically doing",
        "cursor_state": "active | inactive",
        "music": "track description",
        "economy_hook": null,
        "notes": "Director notes"
      }
    ],
    "total_duration_estimate": "4-6 min",
    "economy_hooks_summary": ["list", "of", "all", "economy", "moments"],
    "archetype": "${archetype}"
  },
  "prose_script": {
    "full_script": "Complete readable script with JLAW narrator sections and Lala dialogue blocks, formatted for reading/teleprompter",
    "word_count_estimate": 400
  }
}`;
}

module.exports = router;
