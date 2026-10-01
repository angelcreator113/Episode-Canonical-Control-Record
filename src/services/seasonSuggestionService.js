'use strict';

/**
 * Next-event suggestions read the season (Evoni's rulings, 2026-10-01;
 * docs/EVENT_EPISODE_FLOW.md §8(ff); build PR 6 of
 * docs/SEASON_ARC_DESIGN_NOTE.md):
 *
 *   A4. "The next slot's intention, with Lala's current state (balance,
 *   goals, narrative debt, recent formats, people and places), drives
 *   next-event suggestions and avoids repetition. The Event Package shows a
 *   small read-only Season Context block (season, phase, slot, purpose).
 *   Season Arc provides intent; the Event Package owns the event's facts."
 *   Q8. "A repeat is the same format, host/brand or venue within the last 3
 *   episodes; it warns, never blocks."
 */

const { PRESSURE_LEVELS, episodeLabel } = require('./seasonSlotService');

const RECENT_EPISODES = 3;

/**
 * The pressure an event is likely to put on Lala, on the Q7 scale, from
 * what is known before it runs: how far its prestige sits above her
 * reputation (+1 for 1–2, +2 for 3 or more), a strict dress code (+1 at 7
 * or more), and an unpaid cost above half her balance (+1).
 * 0 Low, 1 Medium, 2–3 High, 4+ Peak.
 */
function estimatePressure(event, state) {
  let points = 0;
  const gap = (Number(event.prestige) || 5) - (Number(state.reputation) || 0);
  if (gap >= 3) points += 2;
  else if (gap >= 1) points += 1;
  if ((Number(event.strictness) || 5) >= 7) points += 1;
  const paid = !!event.is_paid && (Number(event.payment_amount) || 0) > 0;
  if (!paid && (Number(event.cost_coins) || 0) > (Number(state.coins) || 0) / 2) points += 1;
  if (points >= 4) return 'Peak';
  if (points >= 2) return 'High';
  if (points >= 1) return 'Medium';
  return 'Low';
}

/** Score and reason for how well an event's likely pressure fits the slot's desired pressure. */
function pressureFit(estimated, desired) {
  if (!desired || !PRESSURE_LEVELS.includes(desired)) return null;
  const d = Math.abs(PRESSURE_LEVELS.indexOf(estimated) - PRESSURE_LEVELS.indexOf(desired));
  if (d === 0) return { score: 12, reason: { kind: 'boost', text: `Fits the planned pressure (${desired})` } };
  if (d === 1) return { score: 4, reason: { kind: 'boost', text: `Close to the planned pressure (${estimated}, planned ${desired})` } };
  return { score: 0, reason: { kind: 'warn', text: `Pressure ${estimated}, planned ${desired}` } };
}

/** Score and reason when the event serves the slot's career focus (free text). */
function focusFit(event, focus, state) {
  const f = String(focus || '').toLowerCase();
  if (!f) return null;
  const paid = !!event.is_paid && (Number(event.payment_amount) || 0) > 0;
  if (/coin|money|income|pay|earn/.test(f) && paid) return { score: 8, reason: { kind: 'boost', text: `Serves the slot's focus: ${focus}` } };
  if (/reput|prestige|status/.test(f) && (Number(event.prestige) || 0) > (Number(state.reputation) || 0)) {
    return { score: 8, reason: { kind: 'boost', text: `Serves the slot's focus: ${focus}` } };
  }
  if (/brand|partner|deal/.test(f) && event.host_brand) return { score: 8, reason: { kind: 'boost', text: `Serves the slot's focus: ${focus}` } };
  return null;
}

/** Score and reasons for active goals the event moves: coins goals by paid events, reputation goals by prestige above her reputation. */
function goalFit(event, goals, state) {
  const paid = !!event.is_paid && (Number(event.payment_amount) || 0) > 0;
  const moved = (goals || []).filter((g) => (g.target_metric === 'coins' && paid)
    || (g.target_metric === 'reputation' && (Number(event.prestige) || 0) > (Number(state.reputation) || 0)));
  if (!moved.length) return null;
  return { score: 5, reason: { kind: 'boost', text: `Moves a goal: ${moved[0].title}` } };
}

function venueKey(e) {
  if (e.venue_location_id) return `loc:${e.venue_location_id}`;
  const name = String(e.venue_name || '').trim().toLowerCase();
  return name ? `name:${name}` : null;
}
function hostKey(e) {
  const v = String(e.host_brand || e.host || '').trim().toLowerCase();
  return v || null;
}

/**
 * Q8: what this event repeats from the last three episodes' events — its
 * format, host or brand, or venue — as warnings, never blocks.
 * `recent` is [{ label, format, host, host_brand, venue_location_id, venue_name }].
 */
function repeatsOf(event, recent) {
  const out = [];
  const firstMatch = (pred) => recent.find(pred);
  const fmt = event.format ? firstMatch((r) => r.format && r.format === event.format) : null;
  if (fmt) out.push({ kind: 'format', text: `Repeats the format "${event.format}" (${fmt.label})` });
  const hk = hostKey(event);
  const host = hk ? firstMatch((r) => hostKey(r) === hk) : null;
  if (host) out.push({ kind: 'host', text: `Repeats ${event.host_brand || event.host} (${host.label})` });
  const vk = venueKey(event);
  const venue = vk ? firstMatch((r) => venueKey(r) === vk) : null;
  if (venue) out.push({ kind: 'venue', text: `Repeats the venue ${event.venue_name || ''}`.trim() + ` (${venue.label})` });
  return out;
}

/**
 * What the suggestions read from the season: the next open slot and its
 * intention, the show's active goals, narrative debt, and the last three
 * episodes' events. Every part is null or empty when the show has none.
 */
async function loadSeasonInputs(sequelize, showId) {
  const [[slot]] = await sequelize.query(
    `SELECT s.slot_number, s.season_number, s.phase, s.story_purpose, s.career_focus, s.desired_pressure, s.outcome_range,
            a.narrative_debt
       FROM season_slots s
       JOIN show_arcs a ON a.id = s.arc_id AND a.status = 'active' AND a.deleted_at IS NULL
      WHERE s.show_id = :showId AND s.deleted_at IS NULL AND s.episode_id IS NULL AND s.locked_at IS NULL
      ORDER BY s.slot_number ASC LIMIT 1`,
    { replacements: { showId } }).catch((err) => {
    console.error('[seasonSuggestion] next slot load failed:', err.message);
    return [[]];
  });
  const [goals] = await sequelize.query(
    `SELECT title, target_metric FROM career_goals
      WHERE show_id = :showId AND status = 'active' AND deleted_at IS NULL`,
    { replacements: { showId } }).catch((err) => {
    console.error('[seasonSuggestion] goals load failed:', err.message);
    return [[]];
  });
  const [recentRows] = await sequelize.query(
    `SELECT ep.id AS episode_id, ep.episode_number, s.slot_number, s.season_number,
            ev.format, ev.host, ev.host_brand, ev.venue_location_id, ev.venue_name
       FROM episodes ep
       JOIN world_events ev ON ev.used_in_episode_id = ep.id AND ev.deleted_at IS NULL
       LEFT JOIN season_slots s ON s.episode_id = ep.id AND s.deleted_at IS NULL
      WHERE ep.show_id = :showId AND ep.deleted_at IS NULL
      ORDER BY ep.created_at DESC
      LIMIT :n`,
    { replacements: { showId, n: RECENT_EPISODES } }).catch((err) => {
    console.error('[seasonSuggestion] recent episodes load failed:', err.message);
    return [[]];
  });
  const recent = recentRows.map((r) => ({
    ...r,
    label: r.slot_number ? episodeLabel(r.season_number, r.slot_number) : 'a recent episode',
  }));
  let debt = slot?.narrative_debt;
  if (typeof debt === 'string') {
    try { debt = JSON.parse(debt); } catch (err) { console.error('[seasonSuggestion] debt parse failed:', err.message); debt = []; }
  }
  return {
    slot: slot ? {
      slot_number: slot.slot_number,
      label: episodeLabel(slot.season_number, slot.slot_number),
      story_purpose: slot.story_purpose,
      career_focus: slot.career_focus,
      desired_pressure: slot.desired_pressure,
    } : null,
    goals,
    debt: Array.isArray(debt) ? debt : [],
    recent,
  };
}

/** Applies the season's signals to one candidate: returns { score, reasons, estimated_pressure, repeats }. */
function scoreForSeason(event, state, inputs) {
  let score = 0;
  const reasons = [];
  const estimated = estimatePressure(event, state);
  for (const fit of [
    pressureFit(estimated, inputs.slot?.desired_pressure),
    focusFit(event, inputs.slot?.career_focus, state),
    goalFit(event, inputs.goals, state),
  ]) {
    if (fit) { score += fit.score; reasons.push(fit.reason); }
  }
  const repeats = repeatsOf(event, inputs.recent || []);
  for (const r of repeats) {
    score -= 6;
    reasons.push({ kind: 'warn', text: r.text });
  }
  return { score, reasons, estimated_pressure: estimated, repeats: repeats.map((r) => r.kind) };
}

module.exports = {
  RECENT_EPISODES,
  estimatePressure,
  pressureFit,
  focusFit,
  goalFit,
  repeatsOf,
  loadSeasonInputs,
  scoreForSeason,
};
