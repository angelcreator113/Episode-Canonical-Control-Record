'use strict';

/**
 * The Event Package's flow checks (Evoni, 2026-10-25: "What else can we
 * improve on the event page and how it flows?" … "I want them all"), pure:
 *
 *   smartDefaults  what a brand host usually brings (its dress code,
 *                  prestige and deal type across its other events in this
 *                  show) and what the venue usually asks for (its own dress
 *                  code, else the one most used there). One-tap suggestions
 *                  on the page; nothing is saved from here.
 *   clashes        another event on the same in-world day, a person at this
 *                  event and at another that day, and an event that costs
 *                  more than Lala has (checkAffordability's answer).
 *
 * services/eventFlowService reads the rows; GET …/events/:eventId/flow
 * answers with these.
 */

const parseJson = (value, fallback) => {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (err) {
    console.error('[eventFlowChecks] unreadable JSON on an event:', err.message);
    return fallback;
  }
};

const automationOf = (event) => {
  const cc = parseJson(event?.canon_consequences, {}) || {};
  return cc.automation && typeof cc.automation === 'object' ? cc.automation : {};
};

const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const key = (v) => String(v || '').trim().toLowerCase();

/** The event's in-world day, YYYY-MM-DD, from the column or its automation copy; null when it has none. */
function dayOf(event) {
  const raw = event?.event_date ?? automationOf(event).event_date ?? null;
  if (raw == null || raw === '') return null;
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw.toISOString().slice(0, 10);
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(raw).trim());
  return m ? m[1] : null;
}

/** The event's brand host (host_brand, or its automation copy), or null. */
function brandOf(event) {
  return text(event?.host_brand) || text(automationOf(event).host_brand);
}

/**
 * The most used value and how often: { value, count, of } or null. Text is
 * grouped without case (the first spelling seen is kept); ties go to the
 * newest, since `values` come newest first.
 */
function mostUsed(values) {
  const groups = new Map();
  let of = 0;
  for (const v of values) {
    if (v == null || v === '') continue;
    of += 1;
    const k = typeof v === 'string' ? key(v) : String(v);
    const g = groups.get(k);
    if (g) g.count += 1; else groups.set(k, { value: v, count: 1 });
  }
  let best = null;
  for (const g of groups.values()) if (!best || g.count > best.count) best = g;
  return best ? { ...best, of } : null;
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Smart defaults. `others`: the show's other live events, newest first.
 * `venue`: { id, name, dress_code } | null (the venue's own dress code, from
 * its venue_details). Returns [{ field, value, source: 'brand'|'venue',
 * basis }], one per field at most, leaving out a value the event already
 * has. The brand's come first; the venue's dress code only when the brand
 * gives none.
 */
function smartDefaults({ event, others = [], venue = null }) {
  if (!event) return [];
  const out = [];
  const has = (field, value) => key(event[field]) === key(value);
  const brand = brandOf(event);
  if (brand) {
    const past = others.filter((e) => e && String(e.id) !== String(event.id) && key(brandOf(e)) === key(brand));
    if (past.length) {
      const basis = (n) => `${brand}'s usual, ${n} of its ${plural(past.length, 'other event')}`;
      const dress = mostUsed(past.map((e) => text(e.dress_code)));
      if (dress && !has('dress_code', dress.value)) out.push({ field: 'dress_code', value: dress.value, source: 'brand', basis: basis(dress.count) });
      const prestige = mostUsed(past.map((e) => (Number.isInteger(Number(e.prestige)) && e.prestige != null ? Number(e.prestige) : null)));
      if (prestige && Number(event.prestige) !== prestige.value) out.push({ field: 'prestige', value: prestige.value, source: 'brand', basis: basis(prestige.count) });
      const deal = mostUsed(past.map((e) => text(e.deal_type)));
      if (deal && !has('deal_type', deal.value)) out.push({ field: 'deal_type', value: deal.value, source: 'brand', basis: basis(deal.count) });
    }
  }
  if (!out.some((s) => s.field === 'dress_code') && venue) {
    const own = text(venue.dress_code);
    if (own) {
      if (!has('dress_code', own)) out.push({ field: 'dress_code', value: own, source: 'venue', basis: `${venue.name || 'The venue'}'s own dress code` });
    } else {
      const there = others.filter((e) => e && String(e.id) !== String(event.id)
        && venue.id && String(e.venue_location_id || automationOf(e).venue_location_id || '') === String(venue.id));
      const dress = mostUsed(there.map((e) => text(e.dress_code)));
      if (dress && !has('dress_code', dress.value)) {
        out.push({ field: 'dress_code', value: dress.value, source: 'venue', basis: `Used at ${venue.name || 'this venue'} by ${dress.count} of ${plural(there.length, 'event')}` });
      }
    }
  }
  return out;
}

/** The people at an event as { id, name }: its guests, then its creator host. */
function peopleAt(event) {
  const people = new Map();
  const guests = automationOf(event).guest_profiles;
  for (const g of Array.isArray(guests) ? guests : []) {
    const id = Number(typeof g === 'object' && g ? (g.profile_id ?? g.social_profile_id ?? g.id) : g);
    if (Number.isInteger(id) && id > 0 && !people.has(id)) {
      people.set(id, { id, name: (g && (g.display_name || g.name || g.handle)) || `Profile ${id}` });
    }
  }
  const auto = automationOf(event);
  const host = Number(event?.source_profile_id ?? auto.host_profile_id);
  if (Number.isInteger(host) && host > 0 && !people.has(host)) {
    people.set(host, { id: host, name: auto.host_display_name || auto.host_handle || `Profile ${host}` });
  }
  return [...people.values()];
}

/**
 * Clashes. `others`: the show's other live events; `affordability`:
 * checkAffordability's answer with `balance`, or null when it could not be
 * read. Returns { day, sameDay: [{ id, name }], doubleBooked: [{ id, name,
 * events: [{ id, name }] }], money: { short, totalCost, balance } | null,
 * lines: [{ kind: 'day'|'guest'|'money', field, text }] }.
 */
function clashes({ event, others = [], affordability = null }) {
  const day = dayOf(event);
  const sameDay = day
    ? others.filter((e) => e && String(e.id) !== String(event.id) && dayOf(e) === day).map((e) => ({ id: e.id, name: e.name || 'Untitled event', people: peopleAt(e) }))
    : [];
  const doubleBooked = [];
  if (sameDay.length) {
    for (const person of peopleAt(event)) {
      const elsewhere = sameDay.filter((e) => e.people.some((p) => p.id === person.id));
      if (elsewhere.length) doubleBooked.push({ ...person, events: elsewhere.map(({ id, name }) => ({ id, name })) });
    }
  }
  let money = null;
  if (affordability && affordability.affordable === false) {
    const totalCost = Math.round(Number(affordability.totalCost) || 0);
    const balance = Math.round(Number(affordability.balance) || 0);
    money = { totalCost, balance, short: Math.max(0, totalCost - balance) };
  }
  const lines = [];
  if (sameDay.length) {
    const names = sameDay.map((e) => e.name);
    lines.push({ kind: 'day', field: 'date', text: `${names.length === 1 ? `${names[0]} is` : `${names.length} other events are`} on the same day${names.length > 1 ? ` (${names.join(', ')})` : ''}.` });
  }
  for (const p of doubleBooked) {
    lines.push({ kind: 'guest', field: 'guests', text: `${p.name} is also at ${p.events.map((e) => e.name).join(' and ')} that day.` });
  }
  if (money) {
    lines.push({ kind: 'money', field: 'money', text: `Costs about ${money.totalCost} coins; Lala has ${money.balance}, ${money.short} short right now.` });
  }
  return { day, sameDay: sameDay.map(({ id, name }) => ({ id, name })), doubleBooked, money, lines };
}

module.exports = { dayOf, brandOf, mostUsed, smartDefaults, peopleAt, clashes };
