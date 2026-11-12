/**
 * The event a season slot shows (Evoni, 2026-11-12).
 *
 * The server derives it on read (services/seasonLoader slotEventView) and
 * sends it beside the raw pencil, never instead of it:
 *   slot.event        the pencilled event (season_slots.event_id), as before:
 *                     what the pencil controls read and write
 *   slot.event_view   { event, source, pencilled_event, needs_review,
 *                       review_reasons, pencil_disagrees }
 *
 *   empty slot        its pencilled event
 *   occupied slot     its episode's canonical event
 *   occupied, none    no primary event linked
 *
 * Every screen that shows "the slot's event" reads it here, so the Roadmap,
 * the calendar, the plan sheet and the counts agree. A server that does not
 * send event_view (an older one) is read as before: the pencil.
 */

/** The event the slot shows, or null. */
export function slotEvent(slot) {
  if (!slot) return null;
  return slot.event_view ? (slot.event_view.event || null) : (slot.event || null);
}

export const NO_PRIMARY_EVENT = 'No primary event linked';
export const NEEDS_REVIEW = 'Needs review';
const LEGACY_NOT_LINKED = 'Event not linked to this season slot';

const REASONS = {
  primary_link_missing: "the event's own link to this episode is missing",
  primary_linked_elsewhere: "the event's own link points at another episode",
  other_event_linked: 'another event is linked to this episode',
};

/**
 * What to say beside the slot's event, or null when there is nothing to say:
 *   { label, reasons, detail }
 * "Needs review" when the episode's event and the links disagree, or when
 * the slot still stores a pencilled event that is not the episode's event
 * (the pencil is kept and named, not replaced). "No primary event linked"
 * for a started slot whose episode has no event.
 */
export function slotEventNote(slot) {
  if (!slot?.episode) return null;
  const view = slot.event_view;
  // A server that does not derive: the slot's own link is all that is known.
  if (!view) return slot.event ? null : { label: LEGACY_NOT_LINKED, reasons: null, detail: "View the episode's events." };
  const reasons = (view.review_reasons || []).map((r) => REASONS[r]).filter(Boolean);
  if (view.pencil_disagrees) {
    reasons.push(view.pencilled_event?.name
      ? `this slot was pencilled for "${view.pencilled_event.name}", which is not the episode's event`
      : "this slot stores a pencilled event that is not the episode's event");
  }
  if (view.needs_review || view.pencil_disagrees) {
    return { label: NEEDS_REVIEW, reasons: reasons.join('; '), detail: `${reasons.join('; ')}. View the episode's events.` };
  }
  if (!view.event) return { label: NO_PRIMARY_EVENT, reasons: null, detail: "View the episode's events." };
  return null;
}
