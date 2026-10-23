/**
 * The Event Package's in-world documents beside the invitation (Evoni,
 * 2026-10-06): Lala's shopping list and her career plan, each Draft, Edit,
 * Redraft and Approve like the invitation. The server keeps them in the
 * event's canon_consequences.documents (src/services/eventDocumentsService.js);
 * these are its four routes and the pure helpers the cards draw from.
 */
import api from '../services/api';
import { canonicalCategory } from './closetGrouping';
import { formatEventDate } from '../utils/eventDate';

const base = (showId, eventId) => `/api/v1/world/${showId}/events/${eventId}/documents`;

export const getEventDocumentsApi = async (showId, eventId) =>
  (await api.get(base(showId, eventId))).data?.data || { shopping_list: null, career_plan: null };
export const draftEventDocumentApi = async (showId, eventId, type) =>
  (await api.post(`${base(showId, eventId)}/${type}/draft`)).data?.data;
export const editEventDocumentApi = async (showId, eventId, type, items) =>
  (await api.put(`${base(showId, eventId)}/${type}`, { items })).data?.data;
export const approveEventDocumentApi = async (showId, eventId, type) =>
  (await api.post(`${base(showId, eventId)}/${type}/approve`)).data?.data;

/** The status chip: Not drafted, Draft, or Approved. */
export function docState(doc) {
  if (!doc) return { key: 'none', label: 'Not drafted' };
  if (doc.status === 'approved') return { key: 'approved', label: 'Approved' };
  return { key: 'draft', label: 'Draft' };
}

/**
 * The document's overlay (Evoni, 2026-10-07: the documents as overlays),
 * drawn on approval (eventDocumentOverlayService): current when drawn from
 * the approved version as it stands, outdated once edited or redrafted.
 */
export function docOverlay(doc, lookTotal = null) {
  if (!doc) return null;
  const url = doc.overlay?.url || null;
  if (url && doc.status === 'approved' && doc.overlay.version === doc.version) {
    // A shopping list drawn with another total: the look changed since.
    const drawn = doc.overlay.look_total;
    if (lookTotal != null && drawn != null && Number(drawn) !== Number(lookTotal)) {
      return { key: 'outdated', url, label: 'Overlay out of date: the look changed' };
    }
    return { key: 'current', url, label: 'Overlay ready' };
  }
  if (url) {
    return { key: 'outdated', url, label: doc.status === 'approved' ? 'Overlay out of date' : 'Overlay out of date until approved' };
  }
  return { key: 'not_made', url: null, label: doc.status === 'approved' ? 'No overlay yet' : 'Overlay made on approval' };
}

// A piece's category as the shopping list's line (the server's
// todoListService listSlotOf names the same lines).
const CANONICAL_TO_LINE = {
  dress: 'dress', top: 'top', bottom: 'bottom', shoes: 'shoes',
  bag: 'purse', accessory: 'accessories', jewelry: 'jewelry', perfume: 'perfume',
  hair: 'hair',   // the hairstyle or wig (Task #3167)
  outerwear: 'outerwear', // a jacket over the outfit (Task #3205)
};
export function lineOfPiece(piece) {
  return CANONICAL_TO_LINE[canonicalCategory(piece?.category || piece?.clothing_category)] || null;
}
/**
 * A list line's slot read the way a piece's category is (Task #3205): the
 * drafted list's slots are the AI's words, so "heels" or "clutch" still
 * name the shoes and purse lines. A slot no category names keeps its own.
 */
export function lineOfSlot(slot) {
  if (slot == null || slot === '') return null;
  return CANONICAL_TO_LINE[canonicalCategory(slot)] || String(slot).toLowerCase().trim();
}

// What a piece costs on the list, and whether Lala has it. A piece of the
// episode's look carries the charge Finalize books for it (the server's
// episodeLookCharges.episodeLook), so the list adds up what the Money page
// does: owned, already bought, gifted or borrowed costs nothing; rented, its
// rental (Evoni, 2026-10-09: "Lala's shopping list overlay is not showing the
// correct total for everything"). Without one, its coin_cost unless owned.
function pieceCost(piece) {
  if (piece && 'charge' in piece) return piece.charge ? Number(piece.charge.amount) || 0 : 0;
  return piece && piece.is_owned !== true ? Number(piece.coin_cost) || 0 : 0;
}
function pieceHad(piece) {
  if (piece && 'charge' in piece) return !piece.charge && piece.free_because !== 'free';
  return piece?.is_owned === true;
}

/**
 * The shopping list's lines with the look's pieces: each line the piece the
 * look holds for it (had, ticked; or to buy, its coins), or nothing yet. A
 * piece no line takes is a line of its own, so the total is every piece the
 * look costs (the server's eventDocumentOverlayService.shoppingLines draws
 * the same lines).
 *
 * The main outfit line (slot dress) is a dress, or a top and a bottom, as
 * the Wardrobe locks a look and the episode's list ticks it (todoListService
 * listSlotsFilled; Task #3205). With no dress, it takes the look's top and
 * bottom, costing both; when the list has its own top and bottom lines and
 * they hold them, it is covered (`covered`) and costs nothing more. Before,
 * it took a dress only, so a top and a skirt fell to the end as extra lines
 * and the outfit read as still to find. `filled` says a line has its piece.
 */
export function shoppingLines(doc, outfitPieces = []) {
  const pieces = Array.isArray(outfitPieces) ? outfitPieces.filter(Boolean) : [];
  const used = new Set();
  const take = (slot) => {
    const index = pieces.findIndex((p, i) => !used.has(i) && lineOfPiece(p) === slot);
    if (index >= 0) used.add(index);
    return index >= 0 ? pieces[index] : null;
  };
  const line = (base, piece) => ({ ...base, piece, owned: piece ? pieceHad(piece) : false, cost: piece ? pieceCost(piece) : 0, filled: Boolean(piece) });
  const items = doc?.items || [];
  const slots = items.map((item) => lineOfSlot(item.slot));
  const lines = items.map((item, n) => line(item, take(slots[n])));
  const main = lines.findIndex((l, n) => slots[n] === 'dress' && !l.piece);
  if (main >= 0) {
    // Each half is on its own line already, or still free for this one.
    const onOwnLine = (slot) => lines.some((l, n) => slots[n] === slot && l.piece);
    const free = (slot) => pieces.some((p, i) => !used.has(i) && lineOfPiece(p) === slot);
    const halves = ['top', 'bottom'];
    if (halves.every((s) => onOwnLine(s) || free(s))) {
      const taken = halves.filter((s) => !onOwnLine(s)).map(take);
      lines[main] = taken.length
        ? { ...lines[main], piece: taken[0], pieces: taken, filled: true, owned: taken.every(pieceHad), cost: taken.reduce((n, p) => n + pieceCost(p), 0) }
        : { ...lines[main], filled: true, covered: true };
    }
  }
  pieces.forEach((p, i) => {
    if (!used.has(i)) lines.push(line({ slot: 'extra', label: p.name || 'Another piece', extra: true }, p));
  });
  return { lines, total: lines.reduce((n, l) => n + l.cost, 0) };
}

/** The career plan's two sections, This event and Bigger goals. */
export function careerSections(doc) {
  const items = doc?.items || [];
  return {
    thisEvent: items.filter((i) => (i.section || 'this_event') === 'this_event'),
    biggerGoals: items.filter((i) => i.section === 'bigger_goals'),
  };
}

/** "for Studio by Sable · Nov 12": who it is for, and when. */
export function documentByline(event) {
  const who = event?.host_brand || event?.host || event?.name || '';
  // A stored "YYYY-MM-DD" reads as that day in every time zone; free text
  // ("Friday, March 15th") reads as written (formatEventDate).
  const when = formatEventDate(event?.event_date, { style: 'monthDay' }) || '';
  return [who && `for ${who}`, when].filter(Boolean).join(' · ');
}

/**
 * "Look changed — redraft the list?" (Evoni, 2026-10-23). A drafted
 * shopping list records no pieces it was drafted from (its items are slots
 * and labels), so EventDocuments keeps, per event, the look's piece ids
 * when each list version was first seen or drafted in this tab
 * (sessionStorage; a reload keeps it, a new tab starts again):
 * { shopping_list: { version, pieces } }.
 */
const BASELINE_KEY = (eventId) => `evd-look-baseline:${eventId}`;

/** The look's piece ids as one comparable key: order does not matter. */
export function lookPiecesKey(pieces) {
  return (Array.isArray(pieces) ? pieces : []).map((p) => (p?.id == null ? '' : String(p.id))).filter(Boolean).sort().join(',');
}

export function readLookBaselines(eventId) {
  if (!eventId) return {};
  try {
    const raw = window.sessionStorage.getItem(BASELINE_KEY(eventId));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    console.error('[eventDocuments] look baseline read failed:', err);
    return {};
  }
}

export function writeLookBaselines(eventId, value) {
  if (!eventId) return;
  try {
    window.sessionStorage.setItem(BASELINE_KEY(eventId), JSON.stringify(value || {}));
  } catch (err) {
    console.error('[eventDocuments] look baseline write failed:', err);
  }
}

/** Whether the look differs from the one this list version was drafted (or first seen) with. */
export function lookChangedSince(baseline, version, lookKey) {
  if (!baseline || version == null || baseline.version !== version) return false;
  return String(baseline.pieces ?? '') !== String(lookKey ?? '');
}
