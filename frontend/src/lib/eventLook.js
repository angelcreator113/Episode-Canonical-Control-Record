/**
 * The event's look in the episode's Wardrobe (Evoni, 2026-10-07: "connect
 * wardrobe to the event"). The Event Package picks Lala's look for the
 * event (world_events.outfit_pieces: closet pieces by wardrobe id, PUT
 * /world/:showId/events/:eventId/outfit); the episode's Wardrobe styles the
 * look it locks. These helpers let the Wardrobe show the event's look,
 * start from it, and say whether the look on screen still matches it.
 */
import { outfitPieces } from './closetGrouping';

/** The event's look: [{ id, name, category, image_url, is_owned, coin_cost }], [] when none. */
export function eventLookPieces(event) {
  let pieces = event?.outfit_pieces;
  if (typeof pieces === 'string') {
    try { pieces = JSON.parse(pieces); } catch (err) {
      console.error('[eventLook] outfit_pieces parse failed:', err.message);
      pieces = [];
    }
  }
  return Array.isArray(pieces) ? pieces.filter((p) => p && p.id) : [];
}

/**
 * The look on screen against the event's: 'none' (the event has no look),
 * 'same' (the same pieces), 'differs' (some of the event's pieces are not
 * worn, or other pieces are), with what is not worn.
 */
export function lookAgainstEvent(filledSlots, eventPieces) {
  if (!eventPieces.length) return { state: 'none', notWorn: [], extra: 0 };
  const worn = new Set(outfitPieces(filledSlots).map(({ item }) => String(item?.id)));
  const ids = new Set(eventPieces.map((p) => String(p.id)));
  const notWorn = eventPieces.filter((p) => !worn.has(String(p.id)));
  const extra = [...worn].filter((id) => !ids.has(id)).length;
  return { state: notWorn.length === 0 && extra === 0 ? 'same' : 'differs', notWorn, extra };
}

/**
 * Where the episode's wardrobe list comes from: the event's approved
 * shopping list (Start Episode carries it, tagged from_event_document), or
 * the standard slots. { fromDocument, version }.
 */
export function shoppingListSource(tasks = []) {
  const tagged = (tasks || []).find((t) => t?.from_event_document?.type === 'shopping_list');
  return tagged ? { fromDocument: true, version: tagged.from_event_document.version || null } : { fromDocument: false, version: null };
}

/** The Event Package of an event, where its look and documents are made. */
export const eventPackagePath = (showId, event) => (showId && event?.id ? `/shows/${event.show_id || showId}/events/${event.id}` : null);
