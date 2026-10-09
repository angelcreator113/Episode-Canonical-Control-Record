'use strict';

/**
 * The episode's on-screen pieces, in one place (P15, Evoni 2026-09-30;
 * docs/EVENT_EPISODE_FLOW.md §8(w)).
 *
 * Production's Overlays tab lists every on-screen piece the episode owns:
 * the title overlay and the full-screen framed card (P11 as amended), the
 * event's invitation (P10) and its shopping list and career plan. The
 * task-list overlay (P14) is retired (Evoni, 2026-10-07: "retire the ai
 * made task list overlay"); the shopping list took its place. Each piece
 * carries its preview, its status (approved, outdated, not made), the beat
 * it is placed on, and the cost of its paid action. This service only
 * reads; each piece's actions stay with its own service and route.
 *
 * Status:
 *   - not_made  — no current piece;
 *   - outdated  — made for content that has since changed (the title, a
 *                 document); the invitation has no saved outdated state;
 *   - approved  — made for the current, approved content.
 * Placed beat: the piece's live timeline_placements row (episodeBeatPlacement
 * writes beat_number/beat_name into its properties); null when not placed.
 * Overlays are kept off beats for now (episodeBeatPlacement, Evoni
 * 2026-10-07); placements made before still show.
 *
 * The event's shopping list and career plan are pieces too (Evoni,
 * 2026-10-07: "add the document overlays to the episode's list"): each is
 * drawn as an image when approved (eventDocumentOverlayService), approved
 * while its overlay matches the approved version, outdated once edited,
 * not made until then. Listed only when an event started the episode.
 */

const imageGen = require('./imageGenerationService');
const { getTitleCardState } = require('./episodeTitleCardService');
const { TITLE_OVERLAY_BEAT } = require('./episodeTitleOverlayService');
const { loadEpisodeInvitationOverlay, INVITATION_BEAT } = require('./episodeInvitationOverlayService');
const { readDocuments } = require('./eventDocumentsService');
const { overlayState } = require('./eventDocumentOverlayService');

// The invitation's background is generated with these options
// (invitationGeneratorService callDallE3); its regenerate is priced from them.
const INVITATION_OPTIONS = Object.freeze({ size: 'portrait', quality: 'hd', useCase: 'invitation' });

const STATUSES = Object.freeze(['approved', 'outdated', 'not_made']);

function estimateInvitation() {
  const e = imageGen.estimateGenerationCost(INVITATION_OPTIONS);
  return { usd: e.usd, priced: e.priced, unit: e.unit, units: e.units, model: e.model };
}

/** approved / outdated / not_made for a piece with an image and an outdated flag. */
function pieceStatus(made, outdated) {
  if (!made) return 'not_made';
  return outdated ? 'outdated' : 'approved';
}

/** A placement row's beat, or null. */
function placedBeat(placement) {
  if (!placement) return null;
  const props = placement.properties || {};
  const number = props.beat_number == null ? null : Number(props.beat_number);
  return {
    number: Number.isFinite(number) ? number : null,
    name: props.beat_name || null,
    anchor: props.anchor || (placement.scene_id ? 'scene' : null),
    label: placement.label || null,
  };
}

/**
 * The pieces, from the states each service already returns (pure): the
 * episode's title overlay, framed card and invitation, then the event's two
 * documents (documentPieces).
 * @param {object} input
 * @param {object} input.title       — getTitleCardState (with overlay, overlay_offer)
 * @param {object|null} input.invitation — loadEpisodeInvitationOverlay, or null
 * @param {object|null} input.event  — the event that started the episode {id, show_id, name, canon_consequences}
 * @param {object} input.placements  — { [asset_id]: timeline_placements row }
 * @param {object} input.estimates   — { invitation } image estimate
 */
function overlayPieces({ title, invitation, event, placements = {}, estimates = {}, lookTotals = {} }) {
  const beatOf = (assetId) => (assetId ? placedBeat(placements[assetId]) : null);
  const overlay = title?.overlay || null;
  const card = title?.card || null;

  const titleOverlay = {
    key: 'title_overlay',
    label: 'Title overlay',
    status: pieceStatus(Boolean(overlay?.asset_id), overlay?.outdated),
    image_url: overlay?.image_url || null,
    asset_id: overlay?.asset_id || null,
    made_for: overlay?.designed_for || null,
    beat: beatOf(overlay?.asset_id),
    expected_beat: TITLE_OVERLAY_BEAT ? { number: TITLE_OVERLAY_BEAT.number, name: TITLE_OVERLAY_BEAT.name } : null,
    cost: {
      free: 'Lettering styles and the backing band cost nothing.',
      paid: title?.overlay_offer?.offered ? { action: 'Decorative flourish', estimate: title.overlay_offer.flourish_estimate || null } : null,
    },
    needs_title_approval: !title?.approved,
  };

  const framedCard = {
    key: 'framed_card',
    label: 'Full-screen framed card',
    status: pieceStatus(Boolean(card?.asset_id), card?.outdated),
    image_url: card?.image_url || null,
    asset_id: card?.asset_id || null,
    made_for: card?.designed_for || null,
    beat: beatOf(card?.asset_id),
    cost: {
      paid: title?.offer?.offered
        ? { action: title.offer.kind === 'redesign' ? 'Redesign the card' : 'Design the card', estimate: title.offer.estimate || null }
        : null,
    },
    needs_title_approval: !title?.approved,
  };

  const invitationPiece = {
    key: 'invitation',
    label: 'Invitation',
    status: pieceStatus(Boolean(invitation?.id), false),
    image_url: invitation?.url || null,
    asset_id: invitation?.id || null,
    beat: beatOf(invitation?.id),
    expected_beat: INVITATION_BEAT ? { number: INVITATION_BEAT.number, name: INVITATION_BEAT.name } : null,
    event: event ? { id: event.id, show_id: event.show_id, name: event.name } : null,
    cost: {
      paid: event ? { action: invitation ? 'Regenerate the invitation' : 'Generate the invitation', estimate: estimates.invitation || null } : null,
    },
  };

  return [titleOverlay, framedCard, invitationPiece, ...documentPieces(event, lookTotals)];
}

const DOCUMENT_PIECES = Object.freeze([
  { type: 'shopping_list', key: 'shopping_list_doc', label: 'Shopping list' },
  { type: 'career_plan', key: 'career_plan_doc', label: 'Career plan' },
]);
const DOC_STATUS = Object.freeze({ current: 'approved', outdated: 'outdated', not_made: 'not_made' });

/**
 * The event's documents as pieces: made (free) on approval in the Event
 * Package. lookTotals.shopping_list: the list's total with the look as it is
 * now; a shopping list drawn with another total reads outdated. Pure.
 */
function documentPieces(event, lookTotals = {}) {
  if (!event?.id) return [];
  const docs = readDocuments(event);
  return DOCUMENT_PIECES.map(({ type, key, label }) => {
    const doc = docs[type];
    return {
      key,
      label,
      status: DOC_STATUS[overlayState(doc, lookTotals[type] ?? null)],
      image_url: doc?.overlay?.url || null,
      asset_id: doc?.overlay?.asset_id || null,
      beat: null,
      document: { type, status: doc?.status || null, version: doc?.version || null },
      event: { id: event.id, show_id: event.show_id, name: event.name },
      cost: { free: 'Drawn when the document is approved; costs nothing.' },
    };
  });
}

/**
 * The banner's title chip (P15): the title overlay's status, else the framed
 * card's when only the card was made; not_made when neither exists. Pure.
 */
function titleChip(pieces) {
  const overlay = pieces.find((p) => p.key === 'title_overlay');
  const card = pieces.find((p) => p.key === 'framed_card');
  const lead = overlay?.status !== 'not_made' ? overlay : (card?.status !== 'not_made' ? card : overlay);
  return { status: lead?.status || 'not_made', piece: lead?.key || 'title_overlay' };
}

async function loadEpisodeRow(sequelize, episodeId) {
  const [ep] = await sequelize.query(
    'SELECT id, show_id, title FROM episodes WHERE id = :episodeId AND deleted_at IS NULL LIMIT 1',
    { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
  );
  return ep || null;
}

async function loadAnchorEvent(sequelize, episodeId) {
  const [event] = await sequelize.query(
    `SELECT id, show_id, name, canon_consequences, outfit_pieces, used_in_episode_id FROM world_events
      WHERE used_in_episode_id = :episodeId AND deleted_at IS NULL
      ORDER BY updated_at DESC LIMIT 1`,
    { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT }
  );
  return event || null;
}

async function loadPlacements(sequelize, episodeId, assetIds) {
  const ids = assetIds.filter(Boolean);
  if (ids.length === 0) return {};
  let rows;
  try {
    rows = await sequelize.query(
      `SELECT asset_id, scene_id, label, properties FROM timeline_placements
        WHERE episode_id = :episodeId AND asset_id IN (:ids) AND deleted_at IS NULL
        ORDER BY created_at DESC`,
      { replacements: { episodeId, ids }, type: sequelize.QueryTypes.SELECT }
    );
  } catch (err) {
    // The pieces still list without their beats (e.g. a database without the
    // table, which only a dead migration tree creates).
    console.error('[episodeOverlays] placements read failed; beats not shown:', err.message);
    return {};
  }
  const byAsset = {};
  for (const row of rows) {
    if (byAsset[row.asset_id]) continue;
    let properties = row.properties;
    if (typeof properties === 'string') {
      try { properties = JSON.parse(properties); } catch (err) {
        console.error('[episodeOverlays] placement properties parse failed:', err.message);
        properties = {};
      }
    }
    byAsset[row.asset_id] = { ...row, properties: properties || {} };
  }
  return byAsset;
}

/** The event's saved outfit as a list (the column may come back as text). */
function outfitPiecesOf(event) {
  const raw = event?.outfit_pieces;
  if (typeof raw !== 'string') return Array.isArray(raw) ? raw : [];
  try { return JSON.parse(raw); } catch (err) {
    console.error('[episodeOverlays] outfit_pieces parse failed:', err.message);
    return [];
  }
}

/**
 * The shopping list's total with the look as it is now, for an approved list
 * whose overlay recorded the total it was drawn with; {} otherwise.
 */
async function shoppingListTotals(sequelize, event) {
  const doc = event ? readDocuments(event).shopping_list : null;
  if (!doc?.overlay?.url || doc.overlay.look_total == null) return {};
  const { shoppingListContext, shoppingLines } = require('./eventDocumentOverlayService');
  const { look } = await shoppingListContext(sequelize, { ...event, outfit_pieces: outfitPiecesOf(event) });
  return look ? { shopping_list: shoppingLines(doc, look.pieces).total } : {};
}

/** GET /episodes/:id/overlays. null when the episode does not exist. */
async function getEpisodeOverlays(models, episodeId) {
  const { sequelize } = models;
  const ep = await loadEpisodeRow(sequelize, episodeId);
  if (!ep) return null;
  const [title, invitation, event] = await Promise.all([
    getTitleCardState(models, episodeId),
    loadEpisodeInvitationOverlay(sequelize, { showId: ep.show_id, episodeId }),
    loadAnchorEvent(sequelize, episodeId),
  ]);
  const placements = await loadPlacements(sequelize, episodeId, [
    title?.overlay?.asset_id, title?.card?.asset_id, invitation?.id,
  ]);
  const pieces = overlayPieces({
    title, invitation, event, placements,
    estimates: { invitation: estimateInvitation() },
    lookTotals: await shoppingListTotals(sequelize, event),
  });
  return {
    episode_id: ep.id,
    show_id: ep.show_id,
    title: { text: ep.title || '', approved: Boolean(title?.approved) },
    pieces,
    title_chip: titleChip(pieces),
    // The event its documents come from (the redesigned tab, 2026-10-07).
    event: event ? { id: event.id, show_id: event.show_id || ep.show_id, name: event.name || null } : null,
  };
}

module.exports = {
  STATUSES,
  INVITATION_OPTIONS,
  estimateInvitation,
  pieceStatus,
  placedBeat,
  overlayPieces,
  documentPieces,
  titleChip,
  getEpisodeOverlays,
};
