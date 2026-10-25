/**
 * World Events routes — next-event suggestions
 *
 * GET    /api/v1/world/:showId/events/next-suggestions
 *
 * Part of the worldEvents router (Task #54 split it out of one 5,568-line
 * file); ./index.js mounts the parts in their original order.
 */

'use strict';

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../../middleware/auth');
const { careerTierFromReputation } = require('../../utils/careerTiers');

// ── NEXT-EVENT SUGGESTIONS ────────────────────────────────────────────────────
//
// State-aware recommendations for what episode to make next. Reads the live
// character_state (coins, reputation, stress, brand_trust, influence), looks
// at the previous episode's brief for chain seeds + brand continuity, and
// scores every unused event with a deterministic rubric. No AI in the loop —
// the rubric is the algorithm, every score has bullet-point justifications,
// and the creator still has to pick.
//
// Trigger surface: the "end of show" overlay on EpisodeDetail when the
// episode is evaluated. See NextEventSuggestionsOverlay.jsx for the consumer.
//
// The thresholds 250 (pressure) and 100 (critical) are deliberate product
// constants set with the showrunner; tweak in one place here if those move.
const COINS_PRESSURE = 250;
const COINS_CRITICAL = 100;

router.get('/world/:showId/events/next-suggestions', requireAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const { from_episode_id: fromEpisodeId } = req.query;
    const models = require('../../models');
    const { sequelize, WorldEvent, EpisodeBrief } = models;

    // ── 1. Live character state ──
    // Canonical character_key is 'lala' (F-Sec-3 decision; Task #1816).
    const [stateRows] = await sequelize.query(
      `SELECT coins, reputation, brand_trust, influence, stress
       FROM character_state
       WHERE show_id = :showId AND character_key = 'lala'
       LIMIT 1`,
      { replacements: { showId } }
    );
    const state = stateRows?.[0] || { coins: 500, reputation: 1, brand_trust: 1, influence: 1, stress: 0 };
    // Coins are the ledger balance, not the cached copy (Task #2273).
    const { getCurrentBalance } = require('../../services/financialTransactionService');
    state.coins = await getCurrentBalance(sequelize, showId);

    // Reputation → career tier gate. Tier 1: rep 0-2, Tier 2: rep 3-4, etc.
    const careerTier = careerTierFromReputation(state.reputation); // canonical bands (Task #2317)

    // ── 2. Previous episode context for chain + brand continuity ──
    let prevBrief = null;
    let prevEvent = null;
    if (fromEpisodeId) {
      prevBrief = await EpisodeBrief.findOne({ where: { episode_id: fromEpisodeId } });
      // The event the previous episode came from — needed for brand-continuity
      // bonus and direct chain matching (parent_event_id pointing here).
      const [prevEventRows] = await sequelize.query(
        `SELECT id, host_brand, source_profile_id FROM world_events
         WHERE id = ${require('../../utils/episodeEventSql').EPISODE_EVENT_ID_SQL}`,
        { replacements: { episodeId: fromEpisodeId } }
      );
      prevEvent = prevEventRows?.[0] || null;
    }
    const prevSeeds = Array.isArray(prevBrief?.narrative_chain?.seeds_future_events)
      ? prevBrief.narrative_chain.seeds_future_events
      : [];
    const prevHostBrand = prevEvent?.host_brand || null;
    const prevEventId = prevEvent?.id || null;

    // ── 3. Candidate events ──
    // Only events that are draft/ready and haven't been used in another
    // episode yet. We don't filter by career_tier here — we score it instead,
    // so creators can see "this is locked, you'd need higher rep."
    const candidates = await WorldEvent.findAll({
      where: {
        show_id: showId,
        status: ['draft', 'ready'],
        used_in_episode_id: null,
        deleted_at: null,
      },
      limit: 50,
      // Scoped to exactly what the scoring/response logic below reads —
      // see the `event: {...}` mapping further down for the full list.
      attributes: [
        'id', 'name', 'event_type', 'host', 'host_brand', 'prestige',
        'cost_coins', 'payment_amount', 'is_paid', 'strictness',
        'career_tier', 'career_milestone', 'parent_event_id', 'source_profile_id',
        'venue_location_id', 'venue_name',
      ],
    });
    // format is read on its own (Task #1640 keeps it out of the scoped
    // attributes above), for the Q8 repeat check; a database without the
    // column just has no format repeats.
    const formatById = {};
    if (candidates.length) {
      try {
        const [fmtRows] = await sequelize.query(
          'SELECT id, format FROM world_events WHERE id IN (:ids)',
          { replacements: { ids: candidates.map(c => c.id) } }
        );
        for (const row of fmtRows) formatById[row.id] = row.format;
      } catch (fmtErr) {
        console.error('[WorldEvents] next-suggestions format read failed (no format repeats):', fmtErr.message);
      }
    }

    // ── 3b. The season (§8(ff) A4, Q8): the next slot's intention, goals,
    // narrative debt, and the last three episodes' events for repeats.
    const { loadSeasonInputs, scoreForSeason } = require('../../services/seasonSuggestionService');
    const seasonInputs = await loadSeasonInputs(sequelize, showId);

    // ── 4. Score each candidate ──
    const scored = candidates.map(ev => {
      const e = { ...ev.toJSON(), format: formatById[ev.id] || null };
      let score = 0;
      const reasons = [];

      // Affordability check first — it's the most common dealbreaker.
      const affordable = (e.cost_coins || 0) <= (state.coins || 0);
      if (!affordable) {
        score -= 50;
        reasons.push({ kind: 'block', text: `Can't afford (cost ${e.cost_coins}, have ${state.coins})` });
      }

      // Financial pressure — paid events get a graduated bonus when Lala's
      // running low. The two thresholds are set above as product constants.
      const payment = parseInt(e.payment_amount, 10) || 0;
      const isPaid = !!e.is_paid && payment > 0;
      if (isPaid) {
        if (state.coins < COINS_CRITICAL) {
          score += 30;
          reasons.push({ kind: 'boost', text: `Lala is broke — paid event (+${payment} coins)` });
        } else if (state.coins < COINS_PRESSURE) {
          // Linear ramp from +25 at coins=100 down to +5 at coins=250
          const ramp = Math.round(25 - ((state.coins - COINS_CRITICAL) / (COINS_PRESSURE - COINS_CRITICAL)) * 20);
          score += ramp;
          reasons.push({ kind: 'boost', text: `Lala needs coins (+${payment})` });
        } else {
          score += 5;
        }
      }

      // Stress relief: high stress → bias toward easier (low-strictness) events.
      if ((state.stress || 0) >= 6 && (e.strictness || 5) <= 4) {
        score += 10;
        reasons.push({ kind: 'boost', text: 'Low-pressure recovery (Lala is stressed)' });
      }

      // Direct chain continuation — strongest signal.
      if (prevEventId && e.parent_event_id === prevEventId) {
        score += 30;
        reasons.push({ kind: 'boost', text: 'Direct chain continuation' });
      } else if (prevSeeds.length > 0) {
        // Soft seed match: if any seed string mentions this event's name or
        // type, count it as planted by the previous episode.
        const evHaystack = `${e.name || ''} ${e.event_type || ''} ${e.career_milestone || ''}`.toLowerCase();
        const seedHit = prevSeeds.some(seed => {
          const s = (typeof seed === 'string' ? seed : JSON.stringify(seed)).toLowerCase();
          return s.length > 4 && evHaystack.includes(s.slice(0, 20));
        });
        if (seedHit) {
          score += 18;
          reasons.push({ kind: 'boost', text: 'Seeded by last episode' });
        }
      }

      // Reputation alignment — closer prestige to current rep is better.
      const prestigeDelta = Math.abs((e.prestige || 5) - (state.reputation || 0));
      score += Math.max(0, 10 - prestigeDelta);

      // Brand continuity — same host brand as the prior episode.
      if (prevHostBrand && e.host_brand === prevHostBrand) {
        score += 8;
        reasons.push({ kind: 'boost', text: `Brand continuity (${e.host_brand})` });
      }

      // Career tier gate — penalise if locked, but still surface it so the
      // creator sees what's coming.
      if (e.career_tier && e.career_tier > careerTier) {
        score -= 20;
        reasons.push({ kind: 'block', text: `Career tier locked (need tier ${e.career_tier}, currently ${careerTier})` });
      }

      // The season: fit to the next slot's intention and Lala's goals, and
      // Q8 repeats, which warn and lower the score but never block.
      const season = scoreForSeason(e, state, seasonInputs);
      score += season.score;
      reasons.push(...season.reasons);

      return {
        estimated_pressure: season.estimated_pressure,
        repeats: season.repeats,
        event: {
          id: e.id,
          name: e.name,
          event_type: e.event_type,
          format: e.format,
          venue_name: e.venue_name,
          host: e.host,
          host_brand: e.host_brand,
          prestige: e.prestige,
          cost_coins: e.cost_coins,
          payment_amount: e.payment_amount,
          is_paid: e.is_paid,
          strictness: e.strictness,
          career_tier: e.career_tier,
          career_milestone: e.career_milestone,
          source_profile_id: e.source_profile_id,
        },
        score,
        affordable,
        reasons,
      };
    });

    // ── 5. Top 5 by score ──
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 5);

    return res.json({
      data: {
        state: {
          coins: state.coins,
          reputation: state.reputation,
          brand_trust: state.brand_trust,
          influence: state.influence,
          stress: state.stress,
          career_tier: careerTier,
        },
        thresholds: {
          coins_pressure: COINS_PRESSURE,
          coins_critical: COINS_CRITICAL,
        },
        suggestions: top,
        candidate_count: candidates.length,
        season: {
          next_slot: seasonInputs.slot,
          narrative_debt: seasonInputs.debt.map(d => d.narrative_weight || d.goal_title).filter(Boolean),
        },
      },
    });
  } catch (err) {
    console.error('[WorldEvents] Next suggestions error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
