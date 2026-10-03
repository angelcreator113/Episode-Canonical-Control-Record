'use strict';

/**
 * Pitch Me (Evoni, 2026-10-03, episode creation step 6): Prime Studios as
 * a producer pitching possibilities, not AI writing the show. One Haiku
 * call proposes three episode setups from the living world; nothing is
 * written. Evoni builds the one she wants from the New Episode page, which
 * creates the event through POST /world/:showId/events.
 *
 * Inputs (loadPitchInputs) are what the next-event ranker already reads,
 * plus the world's people, brands and places to choose from:
 *   - Lala's state (character_state 'lala'; coins = ledger balance)
 *   - the season's next slot, goals and narrative debt (loadSeasonInputs)
 *   - the Feed's most relevant guest-eligible LalaVerse creators
 *   - lalaverse_brands, World Locations
 *   - the show's most recent events, so the pitches do not repeat them
 *
 * The model may only use the people, brands and places it is given:
 * parsePitches drops any creator id, brand or location it was not given,
 * and any category or format outside WorldEvent's lists. Text is trimmed
 * and capped. A pitch without a usable title, premise and organizer is
 * dropped.
 */

const MODELS = ['claude-haiku-4-5-20251001'];
const LIMITS = { creators: 15, brands: 15, locations: 20, recent: 10 };
const CAP = { title: 40, short: 160, premise: 400 };

const clip = (v, n) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');
const label = (v) => String(v || '').replace(/_/g, ' ');

async function safe(what, fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.error(`[EpisodePitch] ${what} load failed:`, err.message);
    return fallback;
  }
}

async function loadPitchInputs(models, showId) {
  const { sequelize, SocialProfile, LalaverseBrand, WorldLocation, WorldEvent } = models;
  const { Op } = require('sequelize');

  const state = await safe('state', async () => {
    const [rows] = await sequelize.query(
      `SELECT coins, reputation, brand_trust, influence, stress
         FROM character_state WHERE show_id = :showId AND character_key = 'lala' LIMIT 1`,
      { replacements: { showId } });
    const s = rows?.[0] || {};
    const { getCurrentBalance } = require('./financialTransactionService');
    return { ...s, coins: await getCurrentBalance(sequelize, showId) };
  }, {});

  const season = await safe('season', async () => {
    const { loadSeasonInputs } = require('./seasonSuggestionService');
    return loadSeasonInputs(sequelize, showId);
  }, null);

  const creators = await safe('creators', async () => {
    if (!SocialProfile) return [];
    const { guestEligibilityWhere } = require('./eventAutomationService');
    const rows = await SocialProfile.findAll({
      where: guestEligibilityWhere(Op),
      order: [['lala_relevance_score', 'DESC'], ['id', 'ASC']],
      limit: LIMITS.creators,
      attributes: ['id', 'handle', 'display_name', 'archetype', 'content_category', 'lala_relationship'],
    });
    return rows.map((r) => (r.toJSON ? r.toJSON() : r));
  }, []);

  const brands = await safe('brands', async () => {
    if (!LalaverseBrand) return [];
    const rows = await LalaverseBrand.findAll({ attributes: ['name', 'category'], order: [['name', 'ASC']], limit: LIMITS.brands });
    return rows.map((r) => (r.toJSON ? r.toJSON() : r)).filter((b) => b.name);
  }, []);

  const locations = await safe('locations', async () => {
    if (!WorldLocation) return [];
    const rows = await WorldLocation.findAll({ attributes: ['id', 'name', 'city'], order: [['name', 'ASC']], limit: LIMITS.locations });
    return rows.map((r) => (r.toJSON ? r.toJSON() : r)).filter((l) => l.name);
  }, []);

  const recent = await safe('recent events', async () => {
    if (!WorldEvent) return [];
    const rows = await WorldEvent.findAll({
      where: { show_id: showId },
      attributes: ['name', 'category', 'format', 'host_brand'],
      order: [['created_at', 'DESC']],
      limit: LIMITS.recent,
    });
    return rows.map((r) => (r.toJSON ? r.toJSON() : r));
  }, []);

  return { state, season, creators, brands, locations, recent };
}

function buildPitchPrompt(inputs) {
  const { CATEGORY_VALUES, FORMAT_VALUES } = require('../models/WorldEvent');
  const { state = {}, season, creators = [], brands = [], locations = [], recent = [] } = inputs || {};
  const lines = [];
  lines.push(`Lala: ${[
    state.coins != null ? `${state.coins} coins` : null,
    state.reputation != null ? `reputation ${state.reputation}/10` : null,
    state.brand_trust != null ? `brand trust ${state.brand_trust}/10` : null,
    state.influence != null ? `influence ${state.influence}/10` : null,
    state.stress != null ? `stress ${state.stress}/10` : null,
  ].filter(Boolean).join(', ') || 'state not recorded'}.`);
  if (season?.slot) {
    lines.push(`Next season slot ${season.slot.label || season.slot.slot_number}: ${[
      season.slot.story_purpose && `purpose "${season.slot.story_purpose}"`,
      season.slot.career_focus && `career focus ${label(season.slot.career_focus)}`,
      season.slot.desired_pressure && `pressure ${label(season.slot.desired_pressure)}`,
    ].filter(Boolean).join('; ')}.`);
  }
  if (season?.goals?.length) lines.push(`Career goals: ${season.goals.map((g) => g.title).filter(Boolean).slice(0, 5).join('; ')}.`);
  if (season?.debt?.length) lines.push(`Unresolved story threads: ${season.debt.map((d) => (typeof d === 'string' ? d : d?.text || d?.title)).filter(Boolean).slice(0, 5).join('; ')}.`);
  if (recent.length) lines.push(`Recent events (do not repeat): ${recent.map((e) => e.name).filter(Boolean).join('; ')}.`);

  const creatorBlock = creators.length
    ? creators.map((c) => `- id ${c.id}: ${c.display_name || c.handle}${c.content_category ? `, ${label(c.content_category)}` : ''}${c.archetype ? `, ${label(c.archetype)}` : ''}${c.lala_relationship ? `, Lala: ${label(c.lala_relationship)}` : ''}`).join('\n')
    : '(none)';
  const brandBlock = brands.length ? brands.map((b) => `- ${b.name}${b.category ? ` (${label(b.category)})` : ''}`).join('\n') : '(none)';
  const placeBlock = locations.length ? locations.map((l) => `- id ${l.id}: ${l.name}${l.city ? `, ${l.city}` : ''}`).join('\n') : '(none)';

  return `You are the producer of "Styling Adventures with Lala", pitching what Lala's next episode could be. Each episode is one event Lala is invited to. Pitch three different, plausible setups that grow from where she is now. Make the three different in kind: one career move, one relationship move, one with a surprise or chaos.

${lines.join('\n')}

Creators on the Feed (use ids exactly):
${creatorBlock}

Brands:
${brandBlock}

Places (use ids exactly):
${placeBlock}

Rules:
- The organizer is one creator (by id) or one brand (by exact name) from the lists. Never invent a person, brand or place.
- featured: 2 to 4 creator ids from the list (not the organizer), each with a role: friend, tension, opportunity, wildcard, romantic, mentor or rival.
- venue_location_id: one place id from the list, or null.
- category: one of ${CATEGORY_VALUES.join(', ')}. format: one of ${FORMAT_VALUES.join(', ')}.
- title: under 40 characters, no quotation marks, never the show's name.
- premise: two sentences. opportunity, pressure, wildcard: one short sentence each.

Return ONLY this JSON, no other text:
{"pitches": [{"title": "", "kind": "career|relationship|chaos", "category": "", "format": "", "organizer": {"kind": "creator|brand", "profile_id": null, "brand": null}, "featured": [{"profile_id": 0, "role": ""}], "venue_location_id": null, "premise": "", "opportunity": "", "pressure": "", "wildcard": ""}]}`;
}

const ROLES = new Set(['friend', 'tension', 'opportunity', 'wildcard', 'romantic', 'mentor', 'rival']);
const KINDS = new Set(['career', 'relationship', 'chaos']);

function parsePitches(text, inputs) {
  const { CATEGORY_VALUES, FORMAT_VALUES } = require('../models/WorldEvent');
  const { cleanEventName } = require('../utils/cleanEventName');
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) return [];
  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch (err) {
    console.error('[EpisodePitch] the model returned invalid JSON:', err.message);
    return [];
  }
  const creators = new Map((inputs?.creators || []).map((c) => [String(c.id), c]));
  const brands = new Map((inputs?.brands || []).map((b) => [String(b.name).toLowerCase(), b.name]));
  const places = new Map((inputs?.locations || []).map((l) => [String(l.id), l]));
  const nameOf = (c) => c.display_name || c.handle;

  const out = [];
  for (const p of Array.isArray(parsed?.pitches) ? parsed.pitches : []) {
    const title = clip(cleanEventName(String(p?.title || '')), CAP.title);
    const premise = clip(p?.premise, CAP.premise);
    let organizer = null;
    const o = p?.organizer || {};
    if (o.kind === 'creator' && creators.has(String(o.profile_id))) {
      const c = creators.get(String(o.profile_id));
      organizer = { kind: 'creator', profile_id: c.id, name: nameOf(c) };
    } else if (o.kind === 'brand' && brands.has(String(o.brand || '').toLowerCase())) {
      organizer = { kind: 'brand', name: brands.get(String(o.brand).toLowerCase()) };
    }
    if (!title || !premise || !organizer) continue;

    const seen = new Set(organizer.kind === 'creator' ? [String(organizer.profile_id)] : []);
    const featured = [];
    for (const f of Array.isArray(p?.featured) ? p.featured : []) {
      const id = String(f?.profile_id);
      if (!creators.has(id) || seen.has(id)) continue;
      seen.add(id);
      const c = creators.get(id);
      featured.push({ profile_id: c.id, handle: c.handle, display_name: nameOf(c), role: ROLES.has(f?.role) ? f.role : null });
      if (featured.length >= 4) break;
    }
    const place = places.get(String(p?.venue_location_id)) || null;
    out.push({
      title,
      kind: KINDS.has(p?.kind) ? p.kind : null,
      category: CATEGORY_VALUES.includes(p?.category) ? p.category : null,
      format: FORMAT_VALUES.includes(p?.format) ? p.format : null,
      organizer,
      featured,
      venue: place ? { id: place.id, name: place.name } : null,
      premise,
      opportunity: clip(p?.opportunity, CAP.short) || null,
      pressure: clip(p?.pressure, CAP.short) || null,
      wildcard: clip(p?.wildcard, CAP.short) || null,
    });
    if (out.length >= 3) break;
  }
  return out;
}

/**
 * Three pitches, or { error, status } when the model is unavailable or
 * returns nothing usable. Two attempts with a 2s backoff on 529/503, as
 * the suggest-names route does.
 */
async function pitchEpisodes(models, showId, { client } = {}) {
  const inputs = await loadPitchInputs(models, showId);
  if (!inputs.creators.length && !inputs.brands.length) {
    return { error: 'Lala\'s world has no Feed creators or brands to pitch with yet.', status: 422 };
  }
  const prompt = buildPitchPrompt(inputs);
  const Anthropic = require('@anthropic-ai/sdk');
  const api = client || new Anthropic();
  let response = null;
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await api.messages.create({ model, max_tokens: 1500, messages: [{ role: 'user', content: prompt }] });
        break;
      } catch (err) {
        const status = err?.status || err?.error?.status;
        console.error(`[EpisodePitch] ${model} attempt ${attempt + 1} failed:`, status || err.message);
        if ((status === 529 || status === 503) && attempt < 1) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        if (status === 529 || status === 503 || status === 404) break;
        throw err;
      }
    }
    if (response) break;
  }
  if (!response) return { error: 'The AI service is temporarily overloaded. Please try again.', status: 503 };
  const pitches = parsePitches(response.content?.[0]?.text || '', inputs);
  if (!pitches.length) return { error: 'No usable pitches came back. Please try again.', status: 502 };
  return { pitches };
}

module.exports = { loadPitchInputs, buildPitchPrompt, parsePitches, pitchEpisodes, MODELS };
