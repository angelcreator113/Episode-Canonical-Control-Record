/**
 * Producer Mode → Events card summary (Task #2361, Evoni's Events page
 * redesign of 2026-09-30, PR B).
 *
 * A card shows its name; organizer · date · deal type on one line; one
 * status chip; a readiness bar ("N of M ready"); and one primary button.
 * These helpers compute that line, the bar's counts and the deal-type
 * filter from the same sources the Event Package uses.
 */
import { resolveEventOrganizer, resolveEventVenueAndDate } from './eventReadiness';
import { DEAL_TYPES, DEAL_TYPE_LABELS } from './eventTerms';

/** The filter value for an event with no deal type yet. */
export const DEAL_TYPE_NOT_SET = 'not_set';

/**
 * Readiness counts over every Event Package item (computeEventPackageReadiness
 * sections): { ready, total }. Gate and warning items both count.
 */
export function readinessCounts(readiness) {
  const items = (readiness?.sections || []).flatMap((s) => s.items || []);
  return { ready: items.filter((i) => i.satisfied).length, total: items.length };
}

/**
 * The card's one meta line, as parts: [{ key, text, missing }].
 * Organizer always shows ("No organizer" when none); date and deal type
 * show only when set.
 */
export function eventCardMetaParts(event) {
  const organizer = resolveEventOrganizer(event);
  const { eventDate } = resolveEventVenueAndDate(event);
  const organizerName = organizer.hasOrganizer
    ? (organizer.organizerKind === 'brand' ? organizer.brandName : organizer.creatorName)
    : null;
  const dealType = event?.deal_type || null;
  const parts = [{ key: 'organizer', text: organizerName || 'No organizer', missing: !organizerName }];
  if (eventDate) parts.push({ key: 'date', text: String(eventDate), missing: false });
  if (dealType) parts.push({ key: 'deal_type', text: DEAL_TYPE_LABELS[dealType] || dealType, missing: false });
  return parts;
}

/** The deal-type filter value an event falls under. */
export function dealTypeFilterKey(event) {
  return event?.deal_type || DEAL_TYPE_NOT_SET;
}

/** Does an event pass the deal-type filter ('all', a deal type, or not_set)? */
export function matchesDealTypeFilter(event, filter) {
  return !filter || filter === 'all' || dealTypeFilterKey(event) === filter;
}

/** Filter options with counts: [{ key, label, count }], 'all' first, 'not_set' last. */
export function dealTypeFilterOptions(events) {
  const list = events || [];
  const count = (key) => list.filter((ev) => dealTypeFilterKey(ev) === key).length;
  return [
    { key: 'all', label: 'All deal types', count: list.length },
    ...DEAL_TYPES.map((key) => ({ key, label: DEAL_TYPE_LABELS[key] || key, count: count(key) })),
    { key: DEAL_TYPE_NOT_SET, label: 'Deal type not set', count: count(DEAL_TYPE_NOT_SET) },
  ];
}
