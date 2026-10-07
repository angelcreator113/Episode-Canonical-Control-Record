/**
 * Producer Mode → Episodes → Production, to Evoni's mock (2026-10-07): the
 * five stages an episode moves through, the season pipeline (episodes by
 * stage, the season's open slots under Planning) and the "From the event"
 * panel. Pure: ShowEpisodesBoard renders.
 *
 * A stage is the episode's status, the one the board's drag changes:
 * draft → Planning, scripted → Script, in_build → Production, in_review →
 * Edit, scheduled or published (or an accepted evaluation) → Released.
 * Nothing else moves an episode between stages, so the stage bar and the
 * board always agree. Archived episodes sit in no column.
 */
import { resolveEventVenueAndDate } from '../utils/eventReadiness';
import { computeEventPackageReadiness, describeMissing } from '../utils/eventReadinessSections';

export const STAGES = [
  { key: 'planning', label: 'Planning', status: 'draft' },
  { key: 'script', label: 'Script', status: 'scripted' },
  { key: 'production', label: 'Production', status: 'in_build' },
  { key: 'edit', label: 'Edit', status: 'in_review' },
  { key: 'released', label: 'Released', status: 'published' },
];

export const STATUS_LABEL = {
  draft: 'Draft', scripted: 'Scripted', in_build: 'In build', in_review: 'In review',
  scheduled: 'Scheduled', published: 'Published', archived: 'Archived',
};

/** The episode's stage key, or null for an archived episode. */
export function stageOf(ep) {
  if (!ep) return null;
  if (ep.status === 'archived') return null;
  if (ep.evaluation_status === 'accepted' || ep.status === 'published' || ep.status === 'scheduled') return 'released';
  if (ep.status === 'in_review' || ep.status === 'review') return 'edit';
  if (ep.status === 'in_build') return 'production';
  if (ep.status === 'scripted') return 'script';
  return 'planning';
}

/** "S1 E2" from the episode's season and number. */
export function episodeCode(ep) {
  if (!ep?.episode_number) return ep?.season_number ? `S${ep.season_number}` : 'Episode';
  return `S${ep.season_number || 1} E${ep.episode_number}`;
}

/** The episode's tags: its categories, as a clean list. */
export function episodeTags(ep) {
  let list = ep?.categories;
  if (typeof list === 'string') {
    try { list = JSON.parse(list); } catch { list = list.split(','); }
  }
  return (Array.isArray(list) ? list : []).map((t) => String(t || '').trim()).filter(Boolean);
}

/** The season's slots with no episode yet, in slot order. */
export function openSlots(roadmap) {
  return (roadmap?.phases || [])
    .flatMap((p) => p.slots || [])
    .filter((s) => !s.episode)
    .sort((a, b) => (a.slot_number || 0) - (b.slot_number || 0));
}

/** A card's short line: what the episode needs next, else its status. */
export function cardLine(ep) {
  const stage = stageOf(ep);
  if ((stage === 'planning' || stage === 'script') && !ep?.script_content) return 'needs script';
  return STATUS_LABEL[ep?.status] || ep?.status || '';
}

/**
 * The board's columns: each stage with its episodes in episode order, and
 * the open slots after Planning's episodes (they are planned, not started).
 */
export function pipelineColumns(episodes, roadmap) {
  const sorted = [...(episodes || [])].sort((a, b) => (a.episode_number || 0) - (b.episode_number || 0));
  const slots = openSlots(roadmap);
  return STAGES.map((stage) => {
    const eps = sorted.filter((ep) => stageOf(ep) === stage.key);
    const cards = eps.map((ep) => ({ kind: 'episode', id: ep.id, episode: ep }));
    if (stage.key === 'planning') slots.forEach((slot) => cards.push({ kind: 'slot', id: `slot-${slot.id || slot.slot_number}`, slot }));
    return { ...stage, cards, count: cards.length };
  });
}

/** The pipeline's line: "1 episode · 23 open slots"; total is the show's true count when known. */
export function pipelineSummary(episodes, roadmap, total = null) {
  const n = total ?? (episodes || []).filter((ep) => ep.status !== 'archived').length;
  const open = openSlots(roadmap).length;
  const parts = [`${n} episode${n === 1 ? '' : 's'}`];
  if (roadmap) parts.push(`${open} open slot${open === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

/**
 * The "From the event" panel: the event's name, where (venue · city), when
 * (its story date and time, as written), what it pays, and what the Event
 * Package still misses, by section ("People: featured attendees"). The venue reads through the
 * event's saved automation copy too (resolveEventVenueAndDate), so an
 * automated event's Place is not reported missing.
 */
export function eventPanel(event, locations = []) {
  if (!event) return null;
  const vd = resolveEventVenueAndDate(event);
  const loc = vd.venueLocationId ? (locations || []).find((l) => l.id === vd.venueLocationId) : null;
  const venue = vd.venueName || loc?.name || null;
  const city = loc?.city || null;
  const place = [venue, city].filter(Boolean).join(' · ') || null;
  const when = [vd.eventDate, vd.eventTime].filter(Boolean).join(' · ') || null;
  const pays = Number(event.payment_amount);
  const readiness = computeEventPackageReadiness(event, { venueLocation: loc || null });
  const stillNeeded = describeMissing(readiness.sections, 'all');
  return {
    id: event.id,
    name: event.name || 'Untitled event',
    place,
    when,
    earns: Number.isFinite(pays) && pays > 0 ? pays : null,
    stillNeeded,
  };
}
