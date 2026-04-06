/**
 * eventGeneratorRoute.js
 * POST /api/v1/memories/generate-events
 *
 * Generates the full 24-event library for the Styling Adventures show.
 * Category split: 12 industry · 4 dating · 4 family · 4 social_drama
 * Episodes are flexible — events have no fixed episode mapping.
 *
 * Drop into your memoriesRoutes.js or register as a standalone route.
 */

'use strict';

const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { optionalAuth } = require('../middleware/auth');

const client = new Anthropic();

const MODELS = ['claude-sonnet-4-6'];

// POST /generate-events
router.post('/generate-events', optionalAuth, async (req, res) => {
  const { show_id, replace_existing = false } = req.body;

  if (!show_id) {
    return res.status(400).json({ error: 'show_id required' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  try {
    const db = require('../models');

    // Check existing
    if (!replace_existing) {
      const existing = await db.sequelize.query(
        `SELECT COUNT(*) as count FROM world_events WHERE show_id = :show_id`,
        { replacements: { show_id }, type: db.sequelize.QueryTypes.SELECT }
      );
      const count = parseInt(existing[0]?.count || 0);
      if (count >= 20) {
        return res.status(409).json({
          error: 'Events already exist. Pass replace_existing: true to regenerate.',
          existing_count: count,
        });
      }
    }

    const prompt = buildEventPrompt();

    let message;
    for (const model of MODELS) {
      try {
        message = await client.messages.create({
          model,
          max_tokens: 8000,
          system: `You are the architect of LalaVerse — a fashion game world where Lala, a stylish AI content creator,
navigates industry events, dating scenarios, family obligations, and social drama.
Each event is a real game mechanic: it has a reputation gate, a coin cost, a dress code, and aesthetic stakes.
Respond ONLY with a valid JSON array. No preamble, no markdown, no explanation.`,
          messages: [{ role: 'user', content: prompt }],
        });
        break;
      } catch (modelErr) {
        console.warn(`Event generation with ${model} failed:`, modelErr.message);
        if (model === MODELS[MODELS.length - 1]) throw modelErr;
      }
    }

    const raw = message.content[0].text.trim().replace(/```json|```/g, '').trim();
    let events;
    try {
      events = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: 'Claude returned invalid JSON', raw });
    }

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(500).json({ error: 'No events returned', raw });
    }

    // Upsert into world_events
    const { v4: uuidv4 } = require('uuid');
    const now = new Date();
    const toInsert = events.map(ev => ({
      id: uuidv4(),
      show_id,
      name: ev.name,
      event_type: ev.event_type || ev.event_category || 'invite',
      host_brand: ev.host_brand || null,
      description: ev.description,
      prestige: ev.prestige ?? 3,
      cost_coins: ev.coin_cost ?? ev.cost_coins ?? 0,
      strictness: ev.strictness ?? 3,
      dress_code: ev.dress_code,
      dress_code_keywords: JSON.stringify(ev.dress_code_keywords || []),
      status: 'ready',
      created_at: now,
      updated_at: now,
    }));

    if (replace_existing) {
      await db.sequelize.query(
        `DELETE FROM world_events WHERE show_id = :show_id`,
        { replacements: { show_id } }
      );
    }

    // Bulk insert via raw SQL matching actual table schema
    for (const ev of toInsert) {
      await db.sequelize.query(
        `INSERT INTO world_events
           (id, show_id, name, event_type, host_brand, description,
            prestige, cost_coins, strictness, dress_code,
            dress_code_keywords, status, created_at, updated_at)
         VALUES
           (:id, :show_id, :name, :event_type, :host_brand, :description,
            :prestige, :cost_coins, :strictness, :dress_code,
            :dress_code_keywords::jsonb, :status, :created_at, :updated_at)
         ON CONFLICT DO NOTHING`,
        { replacements: ev }
      );
    }

    const breakdown = events.reduce((acc, ev) => {
      acc[ev.event_category] = (acc[ev.event_category] || 0) + 1;
      return acc;
    }, {});

    res.status(201).json({
      generated: events.length,
      breakdown,
      events,
    });
  } catch (err) {
    console.error('generate-events error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Prompt ────────────────────────────────────────────────────────────────

function buildEventPrompt() {
  return `Generate exactly 24 LalaVerse game events for the Styling Adventures fashion show.

CATEGORY SPLIT (non-negotiable):
- industry: 12 events (primary — this is a fashion show first)
- dating: 4 events
- family: 4 events
- social_drama: 4 events

INDUSTRY EVENTS (12): Include the following types spread across the 12:
  galas, press days, VIP receptions, runway shows, cocktail evenings, 
  brand salons, editorial shoots, awards ceremonies, charity galas, 
  launch events, industry showcases, rooftop/garden socials.
  
  Already existing (include these with the SAME name, add full details):
  - Velour Annual Gala (rep 8, prestige 9, elite tier)
  - Industry VIP Reception (rep 5, prestige 7)
  - Press Day Showcase (rep 3, prestige 5)
  - Sunset Charity Gala (rep 6, prestige 8)
  - Salon de Mode Preview (rep 4, prestige 6)
  - Rooftop Cocktail Evening (rep 3, prestige 5)
  - Afternoon Garden Social (rep 2, prestige 4)
  Generate 5 new industry events to complete the 12.

DATING EVENTS (4): Scenarios where Lala's personal life collides with her career.
  Examples: a situationship going public at an industry event, a first date at 
  a luxury restaurant, a reunion with someone who knew her before she was known,
  a press photographer catching something she did not intend.

FAMILY EVENTS (4): Family obligations that create direct tension with career momentum.
  JustAWoman built these events knowing the cost family demands on ambition.
  Examples: a celebration that conflicts with a major brand opportunity, 
  a family member visiting during a critical launch week, a difficult conversation
  about money and priorities, a milestone that reframes why any of this matters.

SOCIAL_DRAMA EVENTS (4): Reputation-altering social moments.
  Examples: a feud with another creator that becomes public, an alliance that 
  costs her in the wrong rooms, a moment of exclusion at an event she earned,
  a rumor that spreads faster than the truth.

For each event return a JSON object with these exact fields:
{
  "name": "string — specific and evocative, not generic",
  "event_category": "industry | dating | family | social_drama",
  "event_type": "string — more specific type tag (gala, press_day, date, family_obligation, etc.)",
  "description": "2-3 sentences. What is this event. What is actually at stake for Lala.",
  "reputation_score": number 1-10 (minimum reputation required to attend),
  "coin_cost": number (0-500, 0 for family/drama events that don't cost coins),
  "prestige": number 1-10 (how prestigious is this event in the world),
  "strictness": number 1-10 (how strict is the dress code),
  "dress_code": "string — the formal dress code requirement",
  "dress_code_keywords": ["array", "of", "style", "keywords", "for", "matching"],
  "style_aesthetic": "string — the aesthetic of the event (e.g. 'minimalist luxury', 'old money editorial')",
  "tier": "basic | mid | luxury | elite",
  "host_brand": "string or null — if an in-world brand hosts (Velour Atelier, Ori Beauty, etc.)",
  "career_echo_potential": "1 sentence — how this event connects to JustAWoman's journey or LalaVerse franchise mythology. Can be null for straightforward events."
}

Return a JSON array of exactly 24 objects. No other text.`;
}

module.exports = router;
