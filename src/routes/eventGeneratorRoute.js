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

    const prompt = await buildEventPrompt(db, show_id);

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
      location_hint: ev.location_hint || null,
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
            dress_code_keywords, location_hint, status, created_at, updated_at)
         VALUES
           (:id, :show_id, :name, :event_type, :host_brand, :description,
            :prestige, :cost_coins, :strictness, :dress_code,
            :dress_code_keywords::jsonb, :location_hint, :status, :created_at, :updated_at)
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

async function buildEventPrompt(db, show_id) {
  // Load Show Brain rules for context
  let brainContext = '';
  try {
    const brainEntries = await db.FranchiseKnowledge.findAll({
      where: { status: 'active', always_inject: true },
      attributes: ['title', 'content'],
      limit: 10,
      order: [['severity', 'ASC']],
    });
    if (brainEntries.length > 0) {
      const rules = brainEntries.map(e => {
        const content = typeof e.content === 'string' ? e.content : JSON.stringify(e.content);
        const summary = content.length > 200 ? content.slice(0, 200) + '...' : content;
        return `- ${e.title}: ${summary}`;
      }).join('\n');
      brainContext = `\nSHOW BRAIN RULES (follow these):\n${rules}\n`;
    }
  } catch (e) { /* franchise_knowledge may not exist */ }

  // Load World Locations for event placement
  let locationContext = '';
  try {
    const locations = await db.sequelize.query(
      `SELECT name, description, location_type, sensory_details FROM world_locations WHERE deleted_at IS NULL ORDER BY name LIMIT 20`,
      { type: db.sequelize.QueryTypes.SELECT }
    );
    if (locations.length > 0) {
      const locs = locations.map(l => {
        const sensory = l.sensory_details ? (typeof l.sensory_details === 'string' ? l.sensory_details : JSON.stringify(l.sensory_details)) : '';
        return `- ${l.name} (${l.location_type || 'venue'}): ${(l.description || '').slice(0, 100)}${sensory ? ' | ' + sensory.slice(0, 80) : ''}`;
      }).join('\n');
      locationContext = `\nAVAILABLE LALAVERSE LOCATIONS (use these for location_hint — do NOT invent new locations):\n${locs}\n`;
    }
  } catch (e) { /* world_locations may not exist */ }

  return `Generate exactly 24 LalaVerse game events for the Styling Adventures fashion show.
${brainContext}${locationContext}
CATEGORY SPLIT (non-negotiable):
- industry: 12 events (primary — this is a fashion show first)
- dating: 4 events
- family: 4 events
- social_drama: 4 events

INDUSTRY EVENTS (12): Include the following types spread across the 12:
  galas, press days, VIP receptions, runway shows, cocktail evenings,
  brand salons, editorial shoots, awards ceremonies, charity galas,
  launch events, industry showcases, rooftop/garden socials.

DATING EVENTS (4): Scenarios where Lala's personal life collides with her career.
  Lala is a SOLO creator — she does NOT have siblings. Dating events should involve
  romantic interests, situationships, or past relationships intersecting with career moments.

FAMILY EVENTS (4): Family obligations that create direct tension with career momentum.
  Focus on parents, extended family, or chosen family — NOT siblings.

SOCIAL_DRAMA EVENTS (4): Reputation-altering social moments.
  Creator feuds, exclusion from events, rumors, alliance betrayals.

For each event return a JSON object with these exact fields:
{
  "name": "string — specific and evocative, not generic",
  "event_type": "string — gala, press_day, date, family_obligation, feud, etc.",
  "description": "2-3 sentences. What is this event. What is actually at stake for Lala.",
  "prestige": number 1-10 (how prestigious is this event in the world),
  "cost_coins": number (0-500, 0 for family/drama events that don't cost coins),
  "strictness": number 1-10 (how strict is the dress code),
  "dress_code": "string — the formal dress code requirement",
  "dress_code_keywords": ["array", "of", "style", "keywords", "for", "matching"],
  "host_brand": "string or null — if an in-world brand hosts (Velour Atelier, Ori Beauty, etc.)",
  "location_hint": "string — use one of the AVAILABLE LALAVERSE LOCATIONS above, or describe a specific venue"
}

Return a JSON array of exactly 24 objects. No other text.`;
}

module.exports = router;
