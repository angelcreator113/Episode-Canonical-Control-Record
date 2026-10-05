/**
 * The look builder beside Producer Mode's closet (Evoni's redesign,
 * 2026-10-05): building the look for the episode in production. Pure
 * helpers over the same slots the episode's styling game uses
 * (lib/closetGrouping: equipInto, the multi slots), the same reach rule
 * (utils/wardrobeReach) and the same save, POST /wardrobe/lock-outfit-atomic,
 * which re-checks every piece and the total cost on the server and buys and
 * links the whole look in one transaction, or none.
 */
import { GAME_SLOT_DEFS, MULTI_SLOTS, gameSlotFor, outfitPieces, slotPieces, equipInto } from './closetGrouping';
import { withReach } from '../utils/wardrobeReach';

/** The slots of a saved outfit (GET /wardrobe/outfit/:episodeId items). A saved piece is selectable. */
export function restoreLook(items) {
  const filled = {};
  for (const item of items || []) {
    const slot = gameSlotFor(item?.clothing_category);
    if (!slot) continue;
    const piece = { ...item, can_select: true, in_saved_look: true };
    if (MULTI_SLOTS.has(slot)) filled[slot] = [...(filled[slot] || []), piece];
    else filled[slot] = piece;
  }
  return filled;
}

/** The ids of every piece in the look. */
export function lookIds(filled) {
  return new Set(outfitPieces(filled).map(({ item }) => item.id));
}

/**
 * The look after adding or removing one piece: a piece already in the look
 * comes out; any other goes in by equipInto (a dress clears top and bottom,
 * a top or bottom clears the dress, accessories and jewelry add beside the
 * rest). A piece carries its reach for Lala's coins and reputation, unless
 * it is already in the saved look.
 */
export function toggleInLook(filled, item, characterState) {
  if (lookIds(filled).has(item.id)) {
    const slot = gameSlotFor(item.clothing_category);
    if (!slot) return filled;
    if (MULTI_SLOTS.has(slot)) {
      const rest = slotPieces(filled, slot).filter((p) => p.id !== item.id);
      const next = { ...filled };
      if (rest.length) next[slot] = rest; else delete next[slot];
      return next;
    }
    const next = { ...filled };
    delete next[slot];
    return next;
  }
  return equipInto(filled, withReach(item, characterState));
}

/** Whether a piece can go in the look, and why not. */
export function pieceReach(item, characterState, filled) {
  if (lookIds(filled).has(item.id)) return { ok: true };
  if (!gameSlotFor(item.clothing_category)) return { ok: false, why: 'This piece has no wardrobe slot' };
  const { can_select: canSelect } = withReach(item, characterState);
  if (canSelect) return { ok: true };
  if (item.lock_type === 'coin') return { ok: false, why: `Lala needs ${Number(item.coin_cost) || 0} coins for this piece` };
  if (item.lock_type === 'reputation') return { ok: false, why: `Lala needs reputation ${Number(item.reputation_required) || 0} for this piece` };
  return { ok: false, why: 'Lala does not own this piece and it is not for sale' };
}

/** The rows the panel lists: each slot's pieces, then the empty slots worth picking. */
export function lookRows(filled) {
  const rows = [];
  const hasTopOrBottom = Boolean(filled.top || filled.bottom);
  for (const def of GAME_SLOT_DEFS) {
    const pieces = slotPieces(filled, def.key);
    if (pieces.length) {
      for (const item of pieces) rows.push({ slot: def.key, label: def.label, item });
      continue;
    }
    if (def.key === 'body' && hasTopOrBottom) continue;
    if ((def.key === 'top' || def.key === 'bottom') && !hasTopOrBottom) continue;
    rows.push({ slot: def.key, label: def.key === 'body' ? 'Dress or top + bottom' : def.label, item: null, required: def.required || ((def.key === 'top' || def.key === 'bottom') && hasTopOrBottom) });
  }
  return rows;
}

/** What the look costs: the coin cost of every piece Lala does not own yet, and the coins after it and after payday. */
export function lookCosts(filled, coins, dealPays) {
  const cost = outfitPieces(filled)
    .filter(({ item }) => !(item.is_owned === true || item.in_saved_look))
    .reduce((sum, { item }) => sum + (Number(item.coin_cost) || 0), 0);
  const have = Number(coins) || 0;
  const pays = Number(dealPays) || 0;
  return { cost, have, after: have - cost, pays, payday: have - cost + pays };
}

/** Whether the look can be saved, and why not: a dress (or a top and a bottom) and shoes, every piece within reach. */
export function canSaveLook(filled, costs) {
  const hasBody = Boolean(filled.body || (filled.top && filled.bottom));
  if (!hasBody) return { ok: false, why: 'Pick a dress, or a top and a bottom' };
  if (!filled.shoes) return { ok: false, why: 'Pick shoes' };
  if (outfitPieces(filled).some(({ item }) => item.can_select === false)) return { ok: false, why: 'A piece is out of Lala\'s reach' };
  if (costs && costs.after < 0) return { ok: false, why: 'Lala cannot afford this look yet' };
  return { ok: true };
}

/** Whether a piece matches the event's dress-code keywords (its style, category, color, tags or aesthetic tags). */
export function matchesDressCode(item, keywords) {
  const want = (keywords || []).map((k) => String(k).toLowerCase()).filter(Boolean);
  if (!want.length) return false;
  const tags = [...(Array.isArray(item?.tags) ? item.tags : []), ...(Array.isArray(item?.aesthetic_tags) ? item.aesthetic_tags : [])];
  const words = [item?.style, item?.clothing_category, item?.category, item?.color, ...tags]
    .filter(Boolean).map((w) => String(w).toLowerCase());
  return want.some((k) => words.some((w) => w.includes(k) || k.includes(w)));
}

/** Two looks hold the same pieces. */
export function sameLook(a, b) {
  const x = lookIds(a);
  const y = lookIds(b);
  return x.size === y.size && [...x].every((id) => y.has(id));
}

/** An event's dress-code keywords: dress_code_keywords, else the words of its dress code (three letters or more). */
export function dressCodeKeywords(event) {
  const list = Array.isArray(event?.dress_code_keywords) ? event.dress_code_keywords.filter(Boolean) : [];
  if (list.length) return list.map((k) => String(k).toLowerCase());
  return String(event?.dress_code || '').toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 3);
}
