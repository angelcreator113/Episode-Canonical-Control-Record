/**
 * The Event Package's in-world documents beside the invitation (Evoni,
 * 2026-10-06): Lala's shopping list and her career plan, each Draft, Edit,
 * Redraft and Approve like the invitation. The server keeps them in the
 * event's canon_consequences.documents (src/services/eventDocumentsService.js);
 * these are its four routes and the pure helpers the cards draw from.
 */
import api from '../services/api';
import { canonicalCategory } from './closetGrouping';

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
};
export function lineOfPiece(piece) {
  return CANONICAL_TO_LINE[canonicalCategory(piece?.category || piece?.clothing_category)] || null;
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
 */
export function shoppingLines(doc, outfitPieces = []) {
  const pieces = Array.isArray(outfitPieces) ? outfitPieces.filter(Boolean) : [];
  const used = new Set();
  const line = (base, piece) => ({ ...base, piece, owned: piece ? pieceHad(piece) : false, cost: piece ? pieceCost(piece) : 0 });
  const lines = (doc?.items || []).map((item) => {
    const index = pieces.findIndex((p, i) => !used.has(i) && lineOfPiece(p) === item.slot);
    if (index >= 0) used.add(index);
    return line(item, index >= 0 ? pieces[index] : null);
  });
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
  let when = '';
  if (event?.event_date) {
    const d = new Date(event.event_date);
    if (!Number.isNaN(d.getTime())) when = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
  return [who && `for ${who}`, when].filter(Boolean).join(' · ');
}
