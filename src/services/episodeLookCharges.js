'use strict';

/**
 * What Lala's look costs at Finalize: one rule for the charge and for the
 * estimate (Evoni, 2026-10-06: "add the look's to-buy cost to the estimate
 * as a planned line, posted at Finalize").
 *
 * financialTransactionService.finalizeEpisodeFinancials charges the look
 * from these three steps, and the Money page's plan
 * (episodeMoneyLines.plannedLines) lists the same charges as its "Lala's
 * look" lines, so the estimate is what Finalize books:
 *
 *   loadLookPieces   the outfit: the one locked in the episode's styling
 *                    game (its approved episode_wardrobe links) when there
 *                    is one, else the pieces chosen there and not rejected
 *                    (the look the Wardrobe and the Event Package show;
 *                    Evoni, 2026-10-07: one rule), else the outfit saved on
 *                    the event, with each piece's current ownership
 *                    (Evoni, 2026-10-05);
 *   boughtPieceIds   pieces Lala has already paid for, by any counted
 *                    wardrobe_purchase row of the show (§8(z) Law 4,
 *                    "Purchased things cost money once"; Task #2248);
 *   lookCharges      per piece: a rented piece with a rental price is a
 *                    wardrobe_rental; an unowned piece not yet bought is a
 *                    wardrobe_purchase at its coin_cost (Task #2346; a
 *                    snapshot written before coin_cost falls back to
 *                    price); gifted and borrowed pieces cost nothing.
 */

const { countedLedgerRows } = require('../utils/ledgerBalanceFilter');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The look's pieces, as Finalize charges them. */
async function loadLookPieces(sequelize, { episodeId, event, transaction = null }) {
  const tq = transaction ? { transaction } : {};
  let outfitPieces = [];
  let linked = [];
  try {
    linked = await sequelize.query(
      `SELECT w.id, w.name, w.is_owned, w.coin_cost, w.price, w.tier, w.brand,
              w.acquisition_type, w.rental_price,
              COALESCE(ew.approval_status, 'pending') AS approval_status
         FROM episode_wardrobe ew JOIN wardrobe w ON w.id = ew.wardrobe_id
        WHERE ew.episode_id = :episodeId AND ew.deleted_at IS NULL
          AND COALESCE(ew.approval_status, 'pending') <> 'rejected'
          AND w.deleted_at IS NULL AND w.parent_item_id IS NULL
        ORDER BY ew.created_at ASC, w.id ASC`,
      { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT, ...tq }
    );
  } catch (lockedErr) {
    console.error('[FinancialTx] Could not read the episode\'s outfit for episode', episodeId, lockedErr.message);
  }
  const lockedOutfit = linked.filter((p) => p.approval_status === 'approved');
  const strip = ({ approval_status: _status, ...p }) => p;
  if (lockedOutfit.length > 0) {
    outfitPieces = lockedOutfit.map(strip);
  } else if (linked.length > 0) {
    outfitPieces = linked.map(strip);
  } else if (event?.outfit_pieces) {
    outfitPieces = typeof event.outfit_pieces === 'string'
      ? JSON.parse(event.outfit_pieces) : event.outfit_pieces;
    // The snapshot's is_owned is from when it was saved; a piece Lala owns
    // now is not charged.
    const snapIds = outfitPieces.map((p) => String(p?.id ?? '')).filter((id) => UUID_RE.test(id));
    if (snapIds.length > 0) {
      try {
        const ownedRows = await sequelize.query(
          'SELECT id FROM wardrobe WHERE id IN (:snapIds) AND is_owned = true',
          { replacements: { snapIds }, type: sequelize.QueryTypes.SELECT, ...tq }
        );
        const ownedNow = new Set((ownedRows || []).map((r) => String(r.id)));
        outfitPieces = outfitPieces.map((p) => (ownedNow.has(String(p?.id)) ? { ...p, is_owned: true } : p));
      } catch (ownedErr) {
        console.error('[FinancialTx] Could not read current ownership for episode', episodeId, ownedErr.message);
      }
    }
  }
  return Array.isArray(outfitPieces) ? outfitPieces : [];
}

/**
 * Pieces Lala has already paid for: any counted wardrobe_purchase row of the
 * show for the piece, from any spend (select, lock-outfit, purchase) or an
 * earlier finalize. source_id is a uuid column: a non-uuid piece id would
 * fail the query and, inside D2's transaction, abort it (#2252), so only
 * uuids are asked about.
 */
async function boughtPieceIds(sequelize, { showId, episodeId, pieces }) {
  const pieceIds = (pieces || []).map((p) => String(p?.id ?? '')).filter((id) => UUID_RE.test(id));
  if (pieceIds.length === 0) return new Set();
  try {
    const boughtRows = await sequelize.query(
      `SELECT DISTINCT ft.source_id FROM financial_transactions ft
        WHERE ft.show_id = :showId AND ft.category = 'wardrobe_purchase'
          AND ft.source_id IN (:pieceIds) AND ${countedLedgerRows('ft')}`,
      { replacements: { showId, pieceIds }, type: sequelize.QueryTypes.SELECT }
    );
    return new Set((boughtRows || []).map((r) => String(r.source_id)));
  } catch (boughtErr) {
    console.error('[FinancialTx] Could not read earlier purchases for episode', episodeId, boughtErr.message);
    return new Set();
  }
}

/** What Finalize charges for each piece: [{ category, piece, amount }]. Pure. */
function lookCharges(pieces, bought = new Set()) {
  const charges = [];
  for (const piece of pieces || []) {
    const acq = piece.acquisition_type || 'purchased';
    if (acq === 'gifted' || acq === 'borrowed') continue;
    if (acq === 'rented' && piece.rental_price > 0) {
      charges.push({ category: 'wardrobe_rental', piece, amount: parseFloat(piece.rental_price) });
    } else if (!piece.is_owned && !bought.has(String(piece.id))) {
      const cost = piece.coin_cost != null
        ? (parseFloat(piece.coin_cost) || 0)
        : (parseFloat(piece.price) || 0);
      if (cost > 0) charges.push({ category: 'wardrobe_purchase', piece, amount: cost });
    }
  }
  return charges;
}

/**
 * Lala's look as the Event Package shows it once the event has started an
 * episode (Evoni, 2026-10-06: "wardrobe pieces are not showing"). After
 * Start Episode the look is chosen in the episode's styling game, which
 * links pieces to the episode (episode_wardrobe); the event's own
 * outfit_pieces is only the look picked before. By the rule Finalize
 * charges by (loadLookPieces):
 *   state 'locked'  the approved links, the look Finalize charges;
 *   state 'chosen'  pieces linked but not locked yet (pending, not rejected);
 *   state 'event'   no links: the outfit saved on the event;
 *   state 'none'    nothing chosen anywhere.
 * Returns { episode_id, state, pieces: [{ id, name, is_owned, coin_cost, image_url }] }.
 * image_url is the piece's picture (Evoni, 2026-10-07: show the images, not
 * just the names): the wardrobe row's thumbnail or image for a linked piece,
 * the outfit snapshot's image_url for the event's own; null without one.
 */
async function episodeLook(sequelize, { episodeId, event, showId = null }) {
  const slim = (p) => ({
    id: p.id,
    name: p.name || null,
    is_owned: p.is_owned === true,
    coin_cost: p.coin_cost != null ? (parseFloat(p.coin_cost) || 0) : (p.price != null ? (parseFloat(p.price) || 0) : null),
    acquisition_type: p.acquisition_type || null,
    rental_price: p.rental_price != null ? (parseFloat(p.rental_price) || 0) : null,
    image_url: p.thumbnail_url || p.s3_url_processed || p.s3_url || p.image_url || null,
  });
  // Each piece's charge by the rule Finalize charges by (lookCharges): the
  // Wardrobe and the Event Package used to add up every unowned piece's
  // coin_cost, so the same look cost three amounts (Evoni, 2026-10-07).
  const priced = async (state, rows) => {
    const bought = showId ? await boughtPieceIds(sequelize, { showId, episodeId, pieces: rows }) : new Set();
    const byPiece = new Map(lookCharges(rows, bought).map((c) => [String(c.piece.id), c]));
    const pieces = rows.map((p) => {
      const c = byPiece.get(String(p.id));
      const acq = p.acquisition_type || 'purchased';
      const why = c ? null
        : (acq === 'gifted' || acq === 'borrowed') ? acq
          : bought.has(String(p.id)) ? 'bought' : p.is_owned ? 'owned' : 'free';
      return { ...slim(p), charge: c ? { category: c.category, amount: c.amount } : null, free_because: why };
    });
    const total = pieces.reduce((sum, p) => sum + (p.charge ? p.charge.amount : 0), 0);
    return { episode_id: episodeId, state, pieces, total };
  };
  let linked = [];
  try {
    linked = await sequelize.query(
      `SELECT w.id, w.name, w.is_owned, w.coin_cost, w.price, w.thumbnail_url, w.s3_url_processed, w.s3_url,
              w.acquisition_type, w.rental_price,
              COALESCE(ew.approval_status, 'pending') AS approval_status
         FROM episode_wardrobe ew JOIN wardrobe w ON w.id = ew.wardrobe_id
        WHERE ew.episode_id = :episodeId AND ew.deleted_at IS NULL
          AND COALESCE(ew.approval_status, 'pending') <> 'rejected'
          AND w.deleted_at IS NULL AND w.parent_item_id IS NULL
        ORDER BY ew.created_at ASC, w.id ASC`,
      { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
    );
  } catch (linkErr) {
    console.error('[EpisodeLook] Could not read the episode\'s look for episode', episodeId, linkErr.message);
  }
  const approved = linked.filter((p) => p.approval_status === 'approved');
  if (approved.length) return priced('locked', approved);
  if (linked.length) return priced('chosen', linked);
  const saved = await loadLookPieces(sequelize, { episodeId, event });
  return priced(saved.length ? 'event' : 'none', saved);
}

module.exports = { UUID_RE, loadLookPieces, boughtPieceIds, lookCharges, episodeLook };
