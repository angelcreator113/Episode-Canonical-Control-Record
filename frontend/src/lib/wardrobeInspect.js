/**
 * The styling game's item modal (EpisodeWardrobeGameplay's inspector), in
 * plain parts (Task #3144; docs/reads/2026-10-06-wardrobe-unlock-read.md §4
 * fixes 1 and 2).
 *
 * Only POST /wardrobe/browse-pool scores a piece and writes Lala's line. A
 * piece opened from the Full Closet or Search came from the closet listing,
 * which sets match_score 0 and no lala_reaction, so the modal showed
 * "Match Score 0/60" and an empty LALA SAYS "". Now:
 *   - score: the pool's entry for the same piece when there is one, else the
 *     piece's own when it carries match reasons, else none (hidden);
 *   - lalaSays: the pool's line, else the piece's stored line for its state
 *     (lala_reaction_locked when she can't have it, lala_reaction_own when
 *     she owns it), else none (hidden);
 *   - cannotBuy: why a piece she can neither wear nor buy is out of reach,
 *     never a bare "Locked".
 */
import { priceRequired } from '../utils/wardrobeReach';

const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const coinsText = (n) => `🪙 ${Number(n || 0).toLocaleString()}`;

/** The pool's entry for a piece, by id, or null. */
export function poolEntryOf(item, pool = []) {
  if (!item) return null;
  return (pool || []).find((p) => String(p.id) === String(item.id)) || null;
}

/** { value, reasons } for a scored piece, or null when it was never scored. */
export function inspectScore(item, pool = []) {
  const entry = poolEntryOf(item, pool);
  if (entry && Number.isFinite(Number(entry.match_score))) {
    return { value: Number(entry.match_score), reasons: entry.match_reasons || [] };
  }
  if (Array.isArray(item?.match_reasons) && item.match_reasons.length > 0) {
    return { value: Number(item.match_score) || 0, reasons: item.match_reasons };
  }
  return null;
}

/** Lala's line about a piece, or null when there is none to show. */
export function inspectLalaSays(item, pool = []) {
  const entry = poolEntryOf(item, pool);
  const said = text(entry?.lala_reaction) || text(item?.lala_reaction);
  if (said) return said;
  if (item?.is_owned === true) return text(item?.lala_reaction_own);
  if (!item?.can_select) return text(item?.lala_reaction_locked);
  return null;
}

/**
 * Why Lala can neither wear nor buy a piece now, in words; null when she can
 * do one or the other.
 */
export function inspectCannotBuy(item, coins = 0) {
  if (!item || item.can_select || item.can_purchase) return null;
  if (item.lock_type === 'brand_exclusive') return 'Brand exclusive: not for sale';
  if (item.lock_type === 'season_drop') {
    return item.season_unlock_episode ? `Season drop: arrives in Episode ${item.season_unlock_episode}, not for sale` : 'Season drop: not for sale';
  }
  if (priceRequired(item)) return 'Price required: give it a coin price in the Wardrobe before Lala can buy it';
  return `Not enough coins: it costs ${coinsText(item.coin_cost)}, Lala has ${coinsText(coins)}`;
}
