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

// A piece's category as the shopping list's line (the server's
// todoListService listSlotOf names the same lines).
const CANONICAL_TO_LINE = {
  dress: 'dress', top: 'top', bottom: 'bottom', shoes: 'shoes',
  bag: 'purse', accessory: 'accessories', jewelry: 'jewelry', perfume: 'perfume',
};
export function lineOfPiece(piece) {
  return CANONICAL_TO_LINE[canonicalCategory(piece?.category || piece?.clothing_category)] || null;
}

/**
 * The shopping list's lines with the look's pieces: each line the piece the
 * look holds for it (owned, ticked; or to buy, its coins), or nothing yet.
 * The total is what the pieces still to buy cost.
 */
export function shoppingLines(doc, outfitPieces = []) {
  const pieces = Array.isArray(outfitPieces) ? outfitPieces : [];
  const used = new Set();
  const lines = (doc?.items || []).map((item) => {
    const piece = pieces.find((p, i) => !used.has(i) && lineOfPiece(p) === item.slot);
    if (piece) used.add(pieces.indexOf(piece));
    return {
      ...item,
      piece: piece || null,
      owned: piece ? piece.is_owned === true : false,
      cost: piece && piece.is_owned !== true ? Number(piece.coin_cost) || 0 : 0,
    };
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
