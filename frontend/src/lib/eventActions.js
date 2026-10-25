/**
 * Where an event goes next, in words, for the Event Package (Evoni,
 * 2026-10-25: "What else can we improve on the event page and how it
 * flows?" … "I want them all and show me first"). Pure helpers:
 *
 *   beat14Line       what beat 14's preview says (GET …/flow's beat14)
 *   episodeStatus    the episode's stage, what it still needs and when it
 *                    releases (lib/releaseBoard readiness, lib/releaseSchedule)
 *   startCopies      what Start Episode copies from the event, read from what
 *                    the start actually carries (services/episodeGenerator-
 *                    Service generateEpisodeFromEvent): the pinned goals and
 *                    the guests (on the brief's canon_consequences), the deal
 *                    (the terms snapshot and frozen prices) with its
 *                    deliverables, the look (linked as the episode's approved
 *                    wardrobe), the venue and its set (the Event location),
 *                    the invitation, the cost lines (the episode's spending)
 *                    and the season slot
 *   followUpBody     the create body for "Make a follow-up event"
 *   FIELD_LABELS     the labels of the fields Fill what's missing and the
 *                    smart defaults speak of
 */
import { readiness } from './releaseBoard';
import { stageOf } from './episodePipeline';
import { formatDay, formatRelease, formatTime } from './releaseSchedule';
import { DEAL_TYPE_LABELS } from '../utils/eventTerms';
import { taxonomyLabel } from '../utils/eventTaxonomy';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const human = (v) => {
  const s = String(v || '').replace(/_/g, ' ').trim();
  return s ? s[0].toUpperCase() + s.slice(1) : '';
};

const automationOf = (event) => {
  const cc = event?.canon_consequences;
  return cc && typeof cc === 'object' && cc.automation && typeof cc.automation === 'object' ? cc.automation : {};
};

/**
 * Beat 14's preview: { tone, lead, name, tag, note } or null while it has
 * not loaded. `hasEpisode`: whether the event has started its episode.
 */
export function beat14Line(beat14, { hasEpisode = false } = {}) {
  if (!beat14) return null;
  const who = beat14.host ? "This event's host" : 'Someone at this event';
  if (beat14.attached) {
    return { tone: 'set', lead: 'Beat 14 offers:', name: beat14.attached.name, tag: beat14.attached.status === 'held' ? 'held until the episode is completed' : beat14.attached.status, note: null };
  }
  if (!beat14.people) {
    return { tone: 'empty', lead: 'Beat 14:', name: null, tag: null, note: 'Nobody at this event can offer the opportunity yet; choose an organizer or a guest.' };
  }
  const attachNote = hasEpisode ? 'Attach it on the episode\'s Script tab, beat 14.' : 'Attach it on beat 14 once the episode exists.';
  if (beat14.best) {
    const reason = beat14.best.fit?.reasons?.[0]?.text || null;
    return {
      tone: 'fit', lead: `${who} can offer:`, name: beat14.best.name,
      tag: beat14.best.fit?.best ? 'best fit' : reason ? reason.toLowerCase() : null,
      note: `${beat14.others ? `${plural(beat14.others, 'other open opportunity', 'other open opportunities')} also fit. ` : ''}${attachNote}`,
    };
  }
  if (beat14.draft) {
    return { tone: 'draft', lead: `${who} could offer:`, name: beat14.draft.name, tag: 'drafted, nothing open fits', note: attachNote };
  }
  return { tone: 'empty', lead: 'Beat 14:', name: null, tag: null, note: 'No open opportunity fits this event yet.' };
}

const STAGE_WORDS = { planning: 'In planning', script: 'Scripted', production: 'In production', edit: 'In the edit', released: 'Released' };

/**
 * The episode's status: { stage, needs: [label], when, line }, e.g. "In the
 * edit · needs thumbnail · releases Sun, Nov 1". `posts` null while they
 * load; `row` the episode's release schedule row (or null).
 */
export function episodeStatus(ep, posts = null, row = null) {
  if (!ep) return null;
  const stageKey = stageOf(ep);
  const stage = stageKey ? STAGE_WORDS[stageKey] : 'Archived';
  const released = stageKey === 'released';
  const needs = released ? [] : readiness(ep, posts, row)
    .filter((r) => r.state !== 'ready' && r.key !== 'cut' && r.key !== 'schedule' && !(r.key === 'feed' && posts == null))
    .map((r) => r.label.toLowerCase());
  let when = null;
  if (row?.date) {
    const day = formatDay(row.date);
    when = row.source === 'preview' ? `would release ${day}` : `${released ? 'released' : 'releases'} ${formatRelease(row) || day}`;
  } else if (ep.air_date) {
    when = `${released ? 'released' : 'releases'} ${formatDay(String(ep.air_date).slice(0, 10)) || ep.air_date}`;
  } else if (!released) {
    when = 'no release date yet';
  }
  const parts = [stage, needs.length ? `needs ${needs.join(', ')}` : released ? null : 'has what it needs', when].filter(Boolean);
  return { stage, needs, when, line: parts.join(' · ') };
}

const listOf = (seed, key) => (Array.isArray(seed?.data?.[key]) ? seed.data[key] : null);

/**
 * What Start Episode copies: [{ key, text }] in the dialog's order, and the
 * sentence "Starting this copies: 2 goals, 3 guests, the deal, the look,
 * the venue". Only what the event has is listed.
 */
export function startCopies(event, { seeds = null, invitationAsset = null, venueDate = null, seasonContext = null } = {}) {
  if (!event) return { items: [], sentence: null };
  const items = [];
  const pins = event.canon_consequences?.pinned_goal_ids;
  if (Array.isArray(pins) && pins.length) items.push({ key: 'goals', text: plural(pins.length, 'goal') });
  const guests = automationOf(event).guest_profiles;
  if (Array.isArray(guests) && guests.length) {
    const featured = guests.filter((g) => g && g.featured).length;
    items.push({ key: 'guests', text: `${plural(guests.length, 'guest')}${featured ? ` (${featured} featured)` : ''}` });
  }
  if (event.deal_type) {
    const deliverables = listOf(seeds?.deliverables, 'deliverables');
    items.push({ key: 'deal', text: deliverables?.length ? `the deal and its ${plural(deliverables.length, 'deliverable')}` : 'the deal' });
  }
  const pieces = Array.isArray(event.outfit_pieces) ? event.outfit_pieces.length : 0;
  if (pieces || event.outfit_set_id) items.push({ key: 'look', text: pieces ? `the look (${plural(pieces, 'piece')})` : 'the look' });
  const venue = venueDate?.venueLocationId || null;
  if (venue || event.scene_set_id) items.push({ key: 'venue', text: venue && event.scene_set_id ? 'the venue and its set' : venue ? 'the venue' : 'the set' });
  if (invitationAsset || event.invitation_asset_id) items.push({ key: 'invitation', text: invitationAsset?.approval_status === 'approved' ? 'the approved invitation' : 'the invitation' });
  const costs = listOf(seeds?.costs, 'costs');
  if (costs?.length) items.push({ key: 'costs', text: plural(costs.length, 'cost line') });
  if (seasonContext?.in_slot && seasonContext.label) items.push({ key: 'slot', text: `its season slot (${seasonContext.label})` });
  const sentence = items.length ? `Starting this copies: ${items.map((i) => i.text).join(', ')}.` : null;
  return { items, sentence };
}

/**
 * "Make a follow-up event": the create body (POST /world/:showId/events)
 * and the deal type to set after it ({ body, dealType }). The same host,
 * brand and organizer, the venue's type as the location hint (not the venue
 * itself), the event as its parent in the chain; no guests, dates or look.
 */
export function followUpBody(event, { organizer = null, venueLocation = null } = {}) {
  const who = organizer?.name || event?.host_brand || event?.host || event?.name || 'Event';
  const body = {
    name: `${who} — follow-up`.slice(0, 200),
    event_type: event?.event_type || 'invite',
    host: event?.host || null,
    host_brand: event?.host_brand || null,
    source_profile_id: event?.source_profile_id ?? null,
    location_hint: venueLocation?.venue_type ? human(venueLocation.venue_type) : null,
    parent_event_id: event?.id || null,
    chain_position: Number.isInteger(Number(event?.chain_position)) && event?.chain_position != null ? Number(event.chain_position) + 1 : null,
    chain_reason: event?.name ? `Follow-up to ${event.name}` : null,
  };
  return { body, dealType: event?.deal_type || null };
}

export const FIELD_LABELS = {
  category: 'Category', format: 'Format', event_date: 'Date', event_time: 'Time', description: 'Description', dress_code: 'Dress code',
  theme: 'Invitation theme', mood: 'Invitation mood', narrative_stakes: "What's at stake", fail_consequence: 'If it goes wrong',
  success_unlock: 'If it goes well', career_milestone: 'Career milestone', prestige: 'Prestige', deal_type: 'Deal type',
  appearance_fee: 'Appearance fee', partnership_base_fee: 'Partnership base', performance_fee: 'Performance fee',
};

/** A field's value in words ("Luxury & prestige", "Brand partnership", "1,500 coins"). */
export function fieldValueText(field, value) {
  if (value == null || value === '') return '';
  if (field === 'category' || field === 'format') return taxonomyLabel(value);
  if (field === 'deal_type') return DEAL_TYPE_LABELS[value] || human(value);
  if (field === 'prestige') return `Prestige ${value}`;
  if (field === 'event_time') return formatTime(value) || String(value);
  if (field === 'event_date') return formatDay(value) || String(value);
  if (/_fee$/.test(field)) return `${Number(value).toLocaleString('en-US')} coins`;
  return String(value);
}

// The fields whose draft is a number on the PUT.
export const NUMBER_FIELDS = new Set(['prestige', 'appearance_fee', 'partnership_base_fee', 'performance_fee']);
