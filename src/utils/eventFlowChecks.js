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
 *   scheduleOf     when an event runs, read strictly: its day, start, end
 *                  (an end time, an optional end date, a story-time offset),
 *                  what could not be read, and whether its date is still
 *                  the suggested one.
 *   scheduleCheck  the people at this event who are also at another whose
 *                  time overlaps it, or leaves too little time to get from
 *                  one to the other; and what could not be checked. Warnings
 *                  only (continuity PR 1, Evoni 2026-11-13): nothing is
 *                  refused, approved or saved from here.
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

// ── Schedule and continuity (PR 1: warnings only) ─────────────────────────

// Evoni's defaults (2026-11-13): storytelling assumptions, not distances.
// shows.metadata.continuity.travel_minutes may replace them per show.
const TRAVEL_MINUTES = Object.freeze({ same_venue: 0, same_city: 20, between_dream_cities: 45 });
// The suggested length of an event with no end time yet (Evoni, 2026-11-13).
const SUGGESTED_MINUTES = 180;
// Events further apart than this are not compared for travel.
const TRAVEL_WINDOW_MINUTES = 24 * 60;
// A declined or archived event holds nobody.
const NOT_HAPPENING = new Set(['declined', 'archived']);
// The widest offsets the world has: UTC-12 to UTC+14.
const OFFSET_MIN = -12 * 60;
const OFFSET_MAX = 14 * 60;

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const blank = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

/** A calendar day 'YYYY-MM-DD' as minutes since the epoch, or null when it is not a real day. */
function dayMinutes(value) {
  const m = DAY_RE.exec(String(value).trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date.getTime() / 60000;
}

/** A clock time 'HH:MM' (24-hour) as minutes after midnight, or null. */
function clockMinutes(value) {
  const m = TIME_RE.exec(String(value).trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

const pad = (n) => String(n).padStart(2, '0');
const dayText = (minutes) => new Date(minutes * 60000).toISOString().slice(0, 10);
const clockText = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

/** The travel minutes in force: the show's own where it has set whole, non-negative numbers, else the defaults. */
function travelMinutesOf(showMetadata) {
  const stored = parseJson(showMetadata, {})?.continuity?.travel_minutes;
  const out = { ...TRAVEL_MINUTES };
  if (stored && typeof stored === 'object') {
    for (const k of Object.keys(TRAVEL_MINUTES)) {
      if (Number.isInteger(stored[k]) && stored[k] >= 0 && stored[k] <= TRAVEL_WINDOW_MINUTES) out[k] = stored[k];
    }
  }
  return out;
}

/**
 * When the event runs. Read strictly: a date is YYYY-MM-DD, a time HH:MM;
 * anything else is said, never guessed.
 *
 *   day, start_time           its own (local) day and start
 *   end_time, end_day         its end. With no end time, three hours after
 *                             the start, marked end_suggested. With no end
 *                             date, an end at or before the start is the
 *                             next day. An end date makes a multi-day event.
 *   offset_minutes            minutes ahead of DREAM cities story time (0
 *                             when none is saved; offset_set says which)
 *   start, end                minutes since the epoch in story time, for
 *                             comparing events; null when not known
 *   provisional               the date is still the one suggested at
 *                             creation (automation.event_date_auto)
 *   problems                  [{ code, field, text }]: what is missing or
 *                             could not be read
 *   verifiable                start and end are both known
 */
function scheduleOf(event) {
  const auto = automationOf(event);
  const rawDay = blank(event?.event_date) ? auto.event_date : event.event_date;
  const rawTime = blank(event?.event_time) ? auto.event_time : event.event_time;
  const problems = [];
  const problem = (code, field, text) => problems.push({ code, field, text });

  let dayAt = null;
  if (blank(rawDay)) problem('date_missing', 'date', 'It has no date yet.');
  else {
    const asText = rawDay instanceof Date ? (Number.isNaN(rawDay.getTime()) ? '' : rawDay.toISOString().slice(0, 10)) : String(rawDay).trim();
    dayAt = dayMinutes(asText);
    if (dayAt === null) problem('date_unreadable', 'date', `Its date "${String(rawDay).trim().slice(0, 40)}" is not a calendar date, so its timing cannot be checked.`);
  }

  let startClock = null;
  if (blank(rawTime)) problem('time_missing', 'time', 'It has no start time yet.');
  else {
    startClock = clockMinutes(rawTime);
    if (startClock === null) problem('time_unreadable', 'time', `Its start time "${String(rawTime).trim().slice(0, 40)}" is not a 24-hour time, so its timing cannot be checked.`);
  }

  let offset = 0;
  const offsetSet = !blank(auto.utc_offset_minutes);
  if (offsetSet) {
    const n = Number(auto.utc_offset_minutes);
    if (Number.isInteger(n) && n >= OFFSET_MIN && n <= OFFSET_MAX) offset = n;
    else problem('offset_unreadable', 'offset', 'Its time offset could not be read, so its timing cannot be checked.');
  }

  let endClock = null;
  let endSuggested = false;
  if (blank(auto.event_end_time)) endSuggested = true;
  else {
    endClock = clockMinutes(auto.event_end_time);
    if (endClock === null) problem('end_unreadable', 'end', `Its end time "${String(auto.event_end_time).trim().slice(0, 40)}" is not a 24-hour time, so its timing cannot be checked.`);
  }
  let endDayAt = null;
  const endDateSet = !blank(auto.event_end_date);
  if (endDateSet) {
    endDayAt = dayMinutes(auto.event_end_date);
    if (endDayAt === null) problem('end_date_unreadable', 'end', `Its end date "${String(auto.event_end_date).trim().slice(0, 40)}" is not a calendar date, so its timing cannot be checked.`);
  }

  const offsetOk = !problems.some((x) => x.code === 'offset_unreadable');
  const localStart = dayAt !== null && startClock !== null ? dayAt + startClock : null;
  let localEnd = null;
  if (localStart !== null) {
    if (endSuggested && !endDateSet) localEnd = localStart + SUGGESTED_MINUTES;
    else if (endSuggested && endDateSet) problem('end_time_missing', 'end', 'It has an end date but no end time.');
    else if (endClock !== null && endDateSet && endDayAt !== null) {
      localEnd = endDayAt + endClock;
      if (localEnd <= localStart) { localEnd = null; problem('end_before_start', 'end', 'It ends before it starts.'); }
    } else if (endClock !== null && !endDateSet) {
      if (endClock === startClock) problem('end_equals_start', 'end', 'It ends at the minute it starts. For an event a day or longer, give its end date.');
      else localEnd = dayAt + endClock + (endClock < startClock ? 24 * 60 : 0);
    }
  }
  const usable = offsetOk && localStart !== null && localEnd !== null;
  return {
    day: dayAt !== null ? dayText(dayAt) : null,
    start_time: startClock !== null ? clockText(startClock) : null,
    end_time: localEnd !== null ? clockText(localEnd % (24 * 60)) : null,
    end_day: localEnd !== null ? dayText(localEnd - (localEnd % (24 * 60))) : null,
    ends_another_day: localEnd !== null && dayAt !== null ? localEnd - (localEnd % (24 * 60)) !== dayAt : false,
    end_suggested: localEnd !== null && endSuggested,
    offset_minutes: offset,
    offset_set: offsetSet,
    start: usable ? localStart - offset : null,
    end: usable ? localEnd - offset : null,
    provisional: dayAt !== null && !blank(auto.event_date_auto) && dayMinutes(auto.event_date_auto) === dayAt,
    problems,
    verifiable: usable,
  };
}

/** The event's venue id, from the column or its automation copy. */
const venueIdOf = (event) => event?.venue_location_id || automationOf(event).venue_location_id || null;

/**
 * The people at an event for the schedule: its creator host (role 'host'),
 * its guests (role 'guest'), and Lala when `lala` says how she is linked to
 * it ({ level: 'invited'|'planned'|'confirmed'|'committed' }). Lala is one
 * person, keyed 'lala', whichever list she is also in. `names`: { [profile
 * id]: display name }, for a person the event's own copy does not name.
 */
function participantsOf(event, { lala = null, lalaProfileId = null, names = {} } = {}) {
  const auto = automationOf(event);
  const host = Number(event?.source_profile_id ?? auto.host_profile_id);
  const lalaId = Number(lalaProfileId);
  const out = [];
  for (const p of peopleAt(event)) {
    if (Number.isInteger(lalaId) && lalaId > 0 && p.id === lalaId) continue;
    // A host known only by its id on the row is named from its profile (`names`).
    out.push({ key: `profile:${p.id}`, id: p.id, name: names[p.id] || p.name, role: p.id === host ? 'host' : 'guest' });
  }
  if (lala && lala.level) out.push({ key: 'lala', id: null, name: 'Lala', role: 'lala', level: lala.level });
  return out;
}

/**
 * How long getting from one event's place to the other's takes:
 * { minutes, basis } where basis is same_venue | same_city |
 * between_dream_cities, or minutes null with basis 'unknown' (a place is
 * not known) or 'outside' (a city outside the DREAM cities: no default).
 * `places`: { [eventId]: { venue_id, city, dream } }.
 */
function travelBetween(a, b, places, minutes) {
  const pa = places?.[a.id] || {};
  const pb = places?.[b.id] || {};
  if (pa.venue_id && pb.venue_id && String(pa.venue_id) === String(pb.venue_id)) return { minutes: minutes.same_venue, basis: 'same_venue' };
  if (!pa.city || !pb.city) return { minutes: null, basis: 'unknown' };
  if (key(pa.city) === key(pb.city)) return { minutes: minutes.same_city, basis: 'same_city' };
  if (pa.dream && pb.dream) return { minutes: minutes.between_dream_cities, basis: 'between_dream_cities' };
  return { minutes: null, basis: 'outside' };
}

const LALA_LEVEL_TEXT = { invited: 'invited to', planned: 'planned for', confirmed: 'confirmed for', committed: 'committed to' };
const span = (minutes) => {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
};

/**
 * Who is in two places. Warnings only.
 *
 *   event, others        this event and the show's other live events
 *   places               { [eventId]: { venue_id, city, dream } }
 *   lala                 { [eventId]: { level } }: how Lala is linked to each
 *   lalaProfileId        her Feed profile, so she is counted once
 *   names                { [profile id]: display name }
 *   travelMinutes        travelMinutesOf(show.metadata)
 *
 * Returns {
 *   schedule,            scheduleOf(event)
 *   conflicts: [{ person: { key, id, name, role, other_role },
 *                 other: { id, name, day, start_time, end_time, end_day },
 *                 kind: 'overlap' | 'travel' | 'travel_unknown' | 'unverified',
 *                 severity: 'host' | 'lala' | 'guest',
 *                 minutes, travel, provisional, text }],
 *   unchecked,           how many other events share someone but have no readable day
 *   lines: [{ kind, field, text }]
 * }
 * An overlap needs the same person at both and the two times to cross;
 * 'travel' is a gap shorter than the journey; 'travel_unknown' a short gap
 * whose journey has no assumption; 'unverified' the same day with a time
 * that could not be read. A date still the suggested one makes a conflict
 * provisional: counted, not listed one by one.
 */
function scheduleCheck({ event, others = [], places = {}, lala = {}, lalaProfileId = null, names = {}, travelMinutes = TRAVEL_MINUTES }) {
  const schedule = scheduleOf(event);
  const mine = participantsOf(event, { lala: lala[event.id], lalaProfileId, names });
  const conflicts = [];
  let unchecked = 0;

  for (const other of others) {
    if (!other || String(other.id) === String(event.id) || NOT_HAPPENING.has(String(other.status || ''))) continue;
    const theirs = new Map(participantsOf(other, { lala: lala[other.id], lalaProfileId, names }).map((p) => [p.key, p]));
    const shared = mine.filter((p) => theirs.has(p.key));
    if (!shared.length) continue;
    const their = scheduleOf(other);
    const otherView = { id: other.id, name: other.name || 'Untitled event', day: their.day, start_time: their.start_time, end_time: their.end_time, end_day: their.end_day };
    const provisional = schedule.provisional || their.provisional;

    let found = null;
    if (schedule.verifiable && their.verifiable) {
      if (schedule.start < their.end && their.start < schedule.end) {
        found = { kind: 'overlap', minutes: Math.min(schedule.end, their.end) - Math.max(schedule.start, their.start), travel: null };
      } else {
        const gap = schedule.start >= their.end ? schedule.start - their.end : their.start - schedule.end;
        if (gap < TRAVEL_WINDOW_MINUTES) {
          const travel = travelBetween(event, other, places, travelMinutes);
          if (travel.minutes !== null && gap < travel.minutes) found = { kind: 'travel', minutes: travel.minutes - gap, travel: { ...travel, gap } };
          else if (travel.minutes === null && (travel.basis === 'outside' || gap < travelMinutes.between_dream_cities)) {
            found = { kind: 'travel_unknown', minutes: null, travel: { ...travel, gap } };
          }
        }
      }
    } else if (schedule.day && their.day) {
      // A day apart at most: an overnight event reaches into the next day.
      if (Math.abs(dayMinutes(schedule.day) - dayMinutes(their.day)) <= 24 * 60) found = { kind: 'unverified', minutes: null, travel: null };
    } else if (!their.day) {
      unchecked += 1;
    }
    if (!found) continue;

    for (const person of shared) {
      const there = theirs.get(person.key);
      const severity = person.role === 'lala' ? 'lala' : (person.role === 'host' && there.role === 'host' ? 'host' : 'guest');
      conflicts.push({
        person: { key: person.key, id: person.id, name: person.name, role: person.role, other_role: there.role, ...(person.level ? { level: person.level, other_level: there.level } : {}) },
        other: otherView,
        ...found,
        severity,
        provisional,
        text: conflictText({ person, there, other: otherView, found, severity }),
      });
    }
  }

  const rank = { host: 0, lala: 1, guest: 2 };
  conflicts.sort((a, b) => Number(a.provisional) - Number(b.provisional) || rank[a.severity] - rank[b.severity] || a.person.name.localeCompare(b.person.name));

  const lines = [];
  for (const x of schedule.problems) lines.push({ kind: 'verify', field: 'date', text: x.text });
  if (schedule.verifiable && schedule.end_suggested) {
    lines.push({ kind: 'end', field: 'date', text: `No end time yet: checked as ending at ${schedule.end_time}${schedule.ends_another_day ? ' the next day' : ''} (three hours).` });
  }
  if (schedule.provisional) lines.push({ kind: 'provisional', field: 'date', text: 'The date is still the suggested one, so these checks are provisional.' });
  const firm = conflicts.filter((c) => !c.provisional);
  for (const c of firm) lines.push({ kind: c.severity === 'host' ? 'host' : c.kind === 'unverified' ? 'verify' : 'guest', field: 'guests', text: c.text });
  const soft = conflicts.length - firm.length;
  if (soft > 0) {
    lines.push({ kind: 'provisional', field: 'guests', text: `${soft} possible ${soft === 1 ? 'overlap depends' : 'overlaps depend'} on a suggested date.` });
  }
  if (unchecked > 0) {
    lines.push({ kind: 'verify', field: 'guests', text: `${unchecked} other ${unchecked === 1 ? 'event shares' : 'events share'} someone with this one but ${unchecked === 1 ? 'has' : 'have'} no readable date, so ${unchecked === 1 ? 'it was' : 'they were'} not checked.` });
  }
  return { schedule, conflicts, unchecked, lines };
}

function conflictText({ person, there, other, found, severity }) {
  const who = person.name;
  const when = other.start_time ? ` (${other.start_time}${other.end_time ? `–${other.end_time}` : ''})` : '';
  if (found.kind === 'unverified') {
    return `${who} is also at ${other.name} around then, and a time could not be read, so an overlap cannot be ruled out.`;
  }
  let verb;
  if (severity === 'host') verb = 'is hosting';
  else if (person.role === 'lala') verb = `is ${LALA_LEVEL_TEXT[there.level] || 'linked to'}`;
  else verb = there.role === 'host' ? 'is hosting' : 'is at';
  if (found.kind === 'overlap') return `${who} ${verb} ${other.name}${when} at the same time: ${span(found.minutes)} overlap.`;
  if (found.kind === 'travel') {
    return `${who} ${verb} ${other.name}${when} with ${span(found.travel.gap)} between them; getting there is taken as ${span(found.travel.minutes)}.`;
  }
  return found.travel.basis === 'outside'
    ? `${who} ${verb} ${other.name}${when} within a day, in a city outside the DREAM cities: the journey has no assumed time.`
    : `${who} ${verb} ${other.name}${when} with ${span(found.travel.gap)} between them, and a venue's city is not known.`;
}

module.exports = {
  dayOf, brandOf, mostUsed, smartDefaults, peopleAt, clashes,
  TRAVEL_MINUTES, SUGGESTED_MINUTES, travelMinutesOf, scheduleOf, participantsOf, travelBetween, scheduleCheck, venueIdOf,
};
