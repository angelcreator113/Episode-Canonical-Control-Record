/**
 * World Events routes — AI suggestions for an event
 *
 * POST   /api/v1/world/:showId/events/:eventId/suggest-names
 * POST   /api/v1/world/:showId/events/:eventId/suggest-basics
 * POST   /api/v1/world/:showId/episode-pitches
 *
 * Part of the worldEvents router (Task #54 split it out of one 5,568-line
 * file); ./index.js mounts the parts in their original order.
 */

'use strict';

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../../middleware/auth');
const { aiRateLimiter } = require('../../middleware/aiRateLimiter');
const { isBudgetError } = require('../../services/imageCostService');
const { eventCreatorOrganizer } = require('../../utils/eventOrganizer');
const { buildSuggestNamesFraming } = require('../../utils/suggestNamesFraming');
const { cleanEventName } = require('../../utils/cleanEventName');
const { loadScopedEvent } = require('../../utils/eventScope');
const { getModels } = require('./helpers');

// ═══════════════════════════════════════════
// POST /api/v1/world/:showId/events/:eventId/suggest-names
//
// Three AI-written name options for an existing event, built from the
// event's own facts. Writes nothing — Evoni picks one (or types her own)
// through the existing PUT /world/:showId/events/:eventId route, whose
// allowedFields already includes 'name' (:389 below), so no new write
// path is added here. Task #1670.
// ═══════════════════════════════════════════

router.post('/world/:showId/events/:eventId/suggest-names', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const { showId, eventId } = req.params;

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ success: false, error: 'ANTHROPIC_API_KEY not configured' });
    }

    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    const event = await loadScopedEvent(models.sequelize, { showId, eventId });
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    // Host — prefer the linked SocialProfile (durable source_profile_id,
    // same field the single-event GET above reads, :158) for its name AND
    // archetype; fall back to the event's own legacy `host` text field
    // when there's no linked profile.
    // content_category is the organizer's niche for the framing sentence
    // (§8(u) R9, Task #2120).
    let hostLine = event.host ? `Host: ${event.host}` : null;
    let organizer = null;
    if (event.source_profile_id && models.SocialProfile) {
      const profile = await models.SocialProfile.findByPk(event.source_profile_id, {
        attributes: ['display_name', 'handle', 'archetype', 'content_category'],
      }).catch((e) => { console.error('[SuggestEventNames] organizer profile lookup failed:', e.message); return null; });
      if (profile) {
        organizer = profile;
        const hostName = profile.display_name || profile.handle;
        hostLine = profile.archetype
          ? `Host: ${hostName} (${String(profile.archetype).replace(/_/g, ' ')})`
          : `Host: ${hostName}`;
      }
    }

    // No show name (Task #2086): doctrine rule 11 says an event name never
    // uses the show name, so the show is not a fact the model sees.

    // Every fact line is conditional — most events have almost none of
    // these set today (no venue, no category, no format), so the prompt
    // below tells the model explicitly not to invent what's missing
    // rather than silently degrading to a generic prompt.
    const facts = [
      hostLine,
      event.category ? `Category: ${String(event.category).replace(/_/g, ' ')}` : null,
      event.format ? `Format: ${String(event.format).replace(/_/g, ' ')}` : null,
      event.venue_name ? `Venue: ${event.venue_name}` : null,
      event.event_date ? `Date: ${event.event_date}` : null,
      event.event_time ? `Time: ${event.event_time}` : null,
      event.dress_code ? `Dress code: ${event.dress_code}` : null,
      typeof event.prestige === 'number' ? `Prestige: ${event.prestige}/10` : null,
    ].filter(Boolean);

    const factsBlock = facts.length > 0
      ? facts.join('\n')
      : 'No details recorded for this event yet beyond it existing — do not invent any.';

    // Framed by the organizer's niche and the event's format and drafted
    // concept, or its description when it has no concept (§8(u) R9,
    // Task #2135, src/utils/suggestNamesFraming.js).
    const framing = buildSuggestNamesFraming(event, organizer);

    const prompt = `${framing} Suggest three short, creative names for it.

${factsBlock}

Rules:
- Each name is under 40 characters.
- No quotation marks in the name itself.
- Do not invent facts (a venue, a guest, a theme, a location) the details above don't give you — when details are sparse, lean on tone and whatever you do have (host, category, format) instead of making something up.
- Return three genuinely different options, not three variations on one phrase.

Return ONLY this JSON, no other text:
{"names": ["...", "...", "..."]}`;

    // Model choice: cheapest tier that writes well for a short, low-stakes
    // task (claude-haiku-4-5-20251001 — same model episodeGeneratorService.js
    // already uses for AI episode titles, :520, one tier below the
    // claude-sonnet-4-6 heavier generation routes like eventGeneratorRoute.js
    // use). Retry pattern matches the existing two-attempt-per-model loop
    // (e.g. src/routes/memories/interview.js:100-130): up to 2 attempts per
    // model with a 2s backoff on 529/503, falling through to the next model
    // (only one here) on repeated overload or a 404.
    const MODELS = ['claude-haiku-4-5-20251001'];
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic();
    let response;
    for (const model of MODELS) {
      let succeeded = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          response = await client.messages.create({
            model,
            max_tokens: 300,
            messages: [{ role: 'user', content: prompt }],
          });
          succeeded = true;
          break;
        } catch (apiErr) {
          const status = apiErr?.status || apiErr?.error?.status;
          if ((status === 529 || status === 503) && attempt < 1) {
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
          if (status === 529 || status === 503 || status === 404) break;
          throw apiErr;
        }
      }
      if (succeeded) break;
    }

    if (!response) {
      return res.status(503).json({ success: false, error: 'The AI service is temporarily overloaded. Please try again.' });
    }

    const text = response.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    // The model's raw text is logged, never returned (audit Low, 2026-10-23).
    if (!match) {
      console.error('[SuggestEventNames] no JSON in model reply:', text.slice(0, 500));
      return res.status(500).json({ success: false, error: 'The name suggestions could not be read. Please try again.' });
    }

    let parsed;
    try {
      parsed = JSON.parse(match[0]);
    } catch (parseErr) {
      console.error('[SuggestEventNames] invalid JSON in model reply:', parseErr.message, text.slice(0, 500));
      return res.status(500).json({ success: false, error: 'The name suggestions could not be read. Please try again.' });
    }

    // Clean any quote marks the model included anyway, the same way the
    // creation draft does (cleanEventName, Task #2139: double quotes
    // anywhere, single quotes only when they wrap the name, apostrophes
    // kept), and enforce the length rule defensively rather than trusting
    // the prompt alone.
    const names = Array.isArray(parsed.names)
      ? parsed.names
          .map((n) => cleanEventName(String(n || '')).slice(0, 40))
          .filter(Boolean)
          .slice(0, 3)
      : [];

    if (names.length === 0) {
      console.error('[SuggestEventNames] no usable names in model reply:', text.slice(0, 500));
      return res.status(500).json({ success: false, error: 'No usable names returned. Please try again.' });
    }

    return res.json({ success: true, names });
  } catch (err) {
    console.error('[SuggestEventNames] Error:', err);
    return res.status(500).json({ success: false, error: 'Name suggestions failed. Please try again.' });
  }
});


// ═══════════════════════════════════════════
// POST /api/v1/world/:showId/events/:eventId/suggest-basics
//
// AI suggestions for an event's basics — event_date, event_time,
// description, dress_code, category, format — from the event's own facts.
// Writes nothing: the page saves a chosen value through the event PUT.
// The contract and the checks are in src/utils/suggestBasics.js:
//   body  { fields?: string[] }   (default: every one of the six that is empty)
//   200   { success: true, data: { suggestions: [{ field, value, reason }] } }
//   400   fields not a list of the six
//   404   the event is not live in this show
//   429   the AI daily budget refused the call (aiCostTracker), with its reason
//   502   the model failed after its retries
//   503   ANTHROPIC_API_KEY not configured
// Every suggestion is checked before it is returned (category/format from
// WorldEvent's lists, a date not in the past, HH:MM, the length limits);
// an invalid one is dropped. Nothing usable: 200 with suggestions [].
// The call goes through the Anthropic SDK, which aiCostTracker patches:
// logged and budget-gated like every call.
// ═══════════════════════════════════════════

const SUGGEST_BASICS_FAILED = 'Couldn\'t get suggestions right now.';

router.post('/world/:showId/events/:eventId/suggest-basics', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const { showId, eventId } = req.params;

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ success: false, error: 'ANTHROPIC_API_KEY not configured' });
    }

    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });

    const event = await loadScopedEvent(models.sequelize, { showId, eventId });
    if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

    const {
      readRequestedFields, suggestionsFromReply, buildSuggestBasicsPrompt,
    } = require('../../utils/suggestBasics');
    const requested = readRequestedFields(req.body, event);
    if (requested.error) return res.status(400).json({ success: false, error: requested.error });
    if (requested.fields.length === 0) return res.json({ success: true, data: { suggestions: [] } });

    // The facts the model sees; each lookup is optional and logged.
    const logLookup = (what) => (e) => { console.error(`[SuggestBasics] ${what} lookup failed:`, e.message); return null; };
    const organizer = eventCreatorOrganizer(event);
    const cc = typeof event.canon_consequences === 'string'
      ? (() => { try { return JSON.parse(event.canon_consequences); } catch (e) { console.error('[SuggestBasics] canon_consequences parse failed:', e.message); return {}; } })()
      : (event.canon_consequences || {});
    const venueLocationId = event.venue_location_id || cc?.automation?.venue_location_id || null;
    const [profile, venue, season] = await Promise.all([
      (organizer?.profileId && models.SocialProfile)
        ? models.SocialProfile.findByPk(organizer.profileId, { attributes: ['display_name', 'handle'] }).catch(logLookup('organizer profile'))
        : Promise.resolve(null),
      (venueLocationId && models.WorldLocation)
        ? models.WorldLocation.findByPk(venueLocationId, { attributes: ['name', 'city'] }).catch(logLookup('venue location'))
        : Promise.resolve(null),
      require('../../services/seasonSlotService').eventSeasonContext(models.sequelize, showId, eventId).catch(logLookup('season context')),
    ]);
    const facts = {
      name: event.name || null,
      event_type: event.event_type || null,
      prestige: typeof event.prestige === 'number' ? event.prestige : null,
      host_brand: event.host_brand || null,
      organizer: profile?.display_name || profile?.handle || organizer?.displayName || organizer?.handle || event.host || null,
      venue: venue ? { name: venue.name, city: venue.city || null } : (event.venue_name ? { name: event.venue_name, city: null } : null),
      season: season ? [season.arc_title, season.label, season.phase?.title].filter(Boolean).join(' · ') || null : null,
    };
    const prompt = buildSuggestBasicsPrompt(event, facts, requested.fields);

    // The repo's two-attempt loop: up to 2 attempts per model, a 2s backoff
    // on 529/503. A budget refusal (aiCostTracker) is never retried.
    const MODELS = ['claude-sonnet-4-6'];
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic();
    let response = null;
    let lastErr = null;
    for (const model of MODELS) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          response = await client.messages.create({
            model,
            max_tokens: 1200,
            messages: [{ role: 'user', content: prompt }],
          });
          break;
        } catch (apiErr) {
          if (isBudgetError(apiErr)) {
            console.error('[SuggestBasics] AI budget refused the call:', apiErr.message);
            return res.status(429).json({ success: false, error: apiErr.message, code: apiErr.code });
          }
          lastErr = apiErr;
          const status = apiErr?.status || apiErr?.error?.status;
          if ((status === 529 || status === 503) && attempt < 1) {
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
          break;
        }
      }
      if (response) break;
    }
    if (!response) {
      console.error('[SuggestBasics] model call failed:', lastErr?.status || '', lastErr?.message || 'no response');
      return res.status(502).json({ success: false, error: SUGGEST_BASICS_FAILED });
    }

    const text = response.content?.[0]?.text || '';
    const suggestions = suggestionsFromReply(text, { fields: requested.fields });
    if (suggestions.length === 0) {
      // The raw reply is logged, never returned.
      console.error('[SuggestBasics] no usable suggestions in model reply:', text.slice(0, 500));
    }
    return res.json({ success: true, data: { suggestions } });
  } catch (err) {
    console.error('[SuggestBasics] Error:', err);
    return res.status(500).json({ success: false, error: SUGGEST_BASICS_FAILED });
  }
});


// ═══════════════════════════════════════════
// POST /api/v1/world/:showId/episode-pitches
//
// Pitch Me (episode creation step 6): three episode setups from the living
// world (episodePitchService), one Haiku call per click. Writes nothing:
// the New Episode page builds the chosen pitch through POST
// /world/:showId/events below.
// ═══════════════════════════════════════════

router.post('/world/:showId/episode-pitches', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ success: false, error: 'ANTHROPIC_API_KEY not configured' });
    }
    const models = await getModels();
    if (!models) return res.status(500).json({ success: false, error: 'Models not loaded' });
    const { pitchEpisodes } = require('../../services/episodePitchService');
    const result = await pitchEpisodes(models, req.params.showId);
    if (result.error) return res.status(result.status || 500).json({ success: false, error: result.error });
    return res.json({ success: true, pitches: result.pitches });
  } catch (err) {
    console.error('[EpisodePitch] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
