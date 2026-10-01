'use strict';

/**
 * Episode title approval and title card (Task #2386, ruling P11, Evoni
 * 2026-09-30, verbatim):
 *
 *   "An episode title can be approved. Approving it offers "Design title
 *    card" with its cost shown. The card uses the show's image style and the
 *    event's visual direction, so the invitation and title look like one
 *    production, and it belongs to that episode. Changing an approved title
 *    marks the card outdated and offers a redesign."
 *
 * State lives on the episode row (migration 20261001120000):
 *   title_approved_at / title_approved_value — the approval. It holds only
 *     while title_approved_value equals the current title; PUT /episodes/:id
 *     clears title_approved_at whenever it changes the title
 *     (episodeController.updateEpisode), so a changed title must be approved
 *     again before a card is designed for it.
 *   title_card_asset_id / title_card_title — the current card and the title
 *     it was designed for. The card is outdated when title_card_title differs
 *     from the current title.
 *
 * A card is designed only for an approved title (409 TITLE_NOT_APPROVED
 * otherwise); every caller — the episode page and Producer Mode's
 * "Generate Episode Title" button — goes through designTitleCard. The image
 * uses the show's style (shows.style_prefix via uiOverlayService.
 * getStylePrefix) and the visual direction of the episode's source event
 * (eventVisualDirection, the same derivation its invitation uses). The card
 * is an assets row with the episode's episode_id and show_id; a redesign
 * soft-deletes every earlier live title card of that episode, so there is
 * one current card.
 */

const crypto = require('crypto');
const imageGen = require('./imageGenerationService');
const { deriveEventVisualDirection } = require('./eventVisualDirection');

const TITLE_CARD_ROLE = 'UI.OVERLAY.EPISODE_TITLE';
// The exact generation options the card is made with; the estimate shown
// before designing is priced from these same options.
const TITLE_CARD_OPTIONS = Object.freeze({ size: 'landscape', quality: 'hd', useCase: 'invitation' });

class TitleCardError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Estimated cost of one title card, from the image rate table. */
function estimateTitleCard() {
  const e = imageGen.estimateGenerationCost(TITLE_CARD_OPTIONS);
  return { usd: e.usd, priced: e.priced, unit: e.unit, units: e.units, model: e.model };
}

/**
 * Approval and card state of an episode row (pure).
 * @param {object} ep   — episodes row (title, title_approved_*, title_card_*)
 * @param {object} [card] — the current card's assets row (id, s3_url_processed, s3_url_raw)
 */
function titleCardState(ep, card = null) {
  const title = ep.title || '';
  const approved = Boolean(ep.title_approved_at) && ep.title_approved_value === title;
  const hasCard = Boolean(ep.title_card_asset_id);
  const outdated = hasCard && ep.title_card_title !== title;
  let offer = null;
  if (title && (!hasCard || outdated) && (approved || outdated)) {
    offer = {
      offered: true,
      kind: hasCard ? 'redesign' : 'design',
      // An outdated card's redesign is offered at once (P11); the new title
      // is approved as part of it.
      requires_approval: !approved,
      estimate: estimateTitleCard(),
    };
  }
  return {
    title,
    approved,
    approved_at: approved ? ep.title_approved_at : null,
    approved_value: ep.title_approved_value || null,
    card: hasCard ? {
      asset_id: ep.title_card_asset_id,
      designed_for: ep.title_card_title,
      outdated,
      image_url: card ? (card.s3_url_processed || card.s3_url_raw || null) : null,
    } : null,
    offer: offer || { offered: false },
  };
}

/**
 * The title card image prompt (pure). The show's style leads; the event's
 * visual direction sets background, frame, decoration, palette and richness.
 * With no source event the card keeps the house look (dark, gold frame).
 */
function buildTitleCardPrompt({ stylePrefix = '', title, episodeNumber = null, direction = null }) {
  const safeTitle = String(title || '').replace(/"/g, "'").trim();
  const look = direction
    ? [
      `Visual direction — the same as this episode's event invitation (${direction.theme} theme), so the invitation and the title card read as one production:`,
      `Background: ${direction.background}.`,
      `Border/Frame: ${direction.border}.`,
      `Decorative elements: ${direction.florals} — edges and corners only, never behind the text.`,
      direction.palette && direction.palette.length > 0 ? `Color palette emphasis: ${direction.palette.join(', ')}.` : '',
      `Richness: ${direction.richness}.`,
      `Atmosphere: ${direction.atmosphere}.`,
    ].filter(Boolean).join('\n')
    : 'Elegant dark background (#1A1A1A) with thin gold (#B8962E) border frame. Subtle gold sparkle particles around the text.';
  const episodeLine = episodeNumber ? `Below it: "Episode ${episodeNumber}" in smaller matching text.` : '';
  return [
    `${stylePrefix}A luxury episode title card, landscape, flat graphic design filling the whole image edge to edge.`,
    look,
    `Center text reading "${safeTitle}" in refined serif typography that suits the palette. ${episodeLine}`.trim(),
    'The text MUST be clearly readable — this is a title card. Luxury fashion show episode intro.',
  ].join('\n');
}

async function loadEpisode(sequelize, episodeId, transaction) {
  const [ep] = await sequelize.query(
    `SELECT id, show_id, title, episode_number, title_approved_at, title_approved_value,
            title_card_asset_id, title_card_title
       FROM episodes WHERE id = :episodeId AND deleted_at IS NULL LIMIT 1`,
    { replacements: { episodeId }, type: sequelize.QueryTypes.SELECT, transaction }
  );
  return ep || null;
}

async function loadCard(sequelize, assetId) {
  if (!assetId) return null;
  const [card] = await sequelize.query(
    `SELECT id, s3_url_processed, s3_url_raw FROM assets WHERE id = :assetId AND deleted_at IS NULL LIMIT 1`,
    { replacements: { assetId }, type: sequelize.QueryTypes.SELECT }
  );
  return card || null;
}

function notFound() {
  return new TitleCardError('Episode not found', 404, 'EPISODE_NOT_FOUND');
}

/**
 * P11 as amended (2026-09-30): the state also carries the title overlay
 * (episodeTitleOverlayService) and its offer. The overlay's lettering styles
 * cost nothing; the AI flourish behind them is offered with its estimate.
 * The framed card above stays as the full-screen option.
 */
async function withOverlay(models, episodeId, state) {
  const overlay = require('./episodeTitleOverlayService');
  return {
    ...state,
    overlay: await overlay.getTitleOverlayState(models, episodeId),
    overlay_offer: state.approved
      ? { offered: true, variants: overlay.VARIANTS.map((v) => ({ key: v.key, label: v.label })), flourish_estimate: overlay.flourishEstimate() }
      : { offered: false },
  };
}

/** GET state. */
async function getTitleCardState(models, episodeId) {
  const ep = await loadEpisode(models.sequelize, episodeId);
  if (!ep) throw notFound();
  return withOverlay(models, episodeId, titleCardState(ep, await loadCard(models.sequelize, ep.title_card_asset_id)));
}

/**
 * Approve the episode's current title. `expectedTitle`, when given, must be
 * the current title (the one the person saw), else 409 TITLE_CHANGED.
 */
async function approveTitle(models, episodeId, { expectedTitle } = {}) {
  const { sequelize } = models;
  const ep = await loadEpisode(sequelize, episodeId);
  if (!ep) throw notFound();
  const title = ep.title || '';
  if (!title.trim()) throw new TitleCardError('The episode has no title to approve.', 400, 'TITLE_EMPTY');
  if (expectedTitle !== undefined && expectedTitle !== null && expectedTitle !== title) {
    throw new TitleCardError('The title changed since this page loaded. Reload and approve the current title.', 409, 'TITLE_CHANGED');
  }
  const [rows] = await sequelize.query(
    `UPDATE episodes SET title_approved_at = NOW(), title_approved_value = :title, updated_at = NOW()
      WHERE id = :episodeId AND title = :title AND deleted_at IS NULL
      RETURNING id, show_id, title, episode_number, title_approved_at, title_approved_value,
                title_card_asset_id, title_card_title`,
    { replacements: { episodeId, title } }
  );
  if (!rows || rows.length === 0) {
    throw new TitleCardError('The title changed while approving. Reload and approve the current title.', 409, 'TITLE_CHANGED');
  }
  return withOverlay(models, episodeId, titleCardState(rows[0], await loadCard(sequelize, rows[0].title_card_asset_id)));
}

async function uploadCard(imageUrl, episodeId) {
  const S3_BUCKET = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET;
  if (!S3_BUCKET || !imageUrl) return imageUrl;
  const axios = require('axios');
  const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
  const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
  const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
  const s3 = new S3Client({ region: AWS_REGION });
  const s3Key = `overlays/episode-title/${episodeId}/${crypto.randomUUID()}.png`;
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET, Key: s3Key, Body: imgRes.data,
    ContentType: 'image/png', CacheControl: 'max-age=31536000',
  }));
  return `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
}

/**
 * Design (or redesign) the episode's title card. Requires the current title
 * approved. `showId`, when given, must be the episode's show.
 * Budget refusals from the image service propagate (status 429).
 */
async function designTitleCard(models, episodeId, { showId = null } = {}) {
  const { sequelize } = models;
  const ep = await loadEpisode(sequelize, episodeId);
  if (!ep) throw notFound();
  if (showId && ep.show_id && ep.show_id !== showId) {
    throw new TitleCardError('Episode not found in this show', 404, 'EPISODE_NOT_IN_SHOW');
  }
  const state = titleCardState(ep);
  if (!state.approved) {
    throw new TitleCardError(
      'Approve this episode\'s title first — the title card is designed from the approved title (episode page, Approve title).',
      409, 'TITLE_NOT_APPROVED'
    );
  }
  const title = ep.title;
  const ownerShowId = ep.show_id || showId;

  const { getStylePrefix } = require('./uiOverlayService');
  const { findSourceEvent } = require('./episodeMoneyService');
  const stylePrefix = ownerShowId ? await getStylePrefix(ownerShowId, models) : '';
  const event = await findSourceEvent(sequelize, episodeId);
  const direction = event ? deriveEventVisualDirection(event) : null;
  const prompt = buildTitleCardPrompt({ stylePrefix, title, episodeNumber: ep.episode_number, direction });

  const imageUrl = await imageGen.generateImageUrl(prompt, TITLE_CARD_OPTIONS);
  if (!imageUrl) throw new TitleCardError('Image generation did not return an image.', 502, 'IMAGE_EMPTY');
  const url = await uploadCard(imageUrl, episodeId);

  const assetId = crypto.randomUUID();
  const metadata = {
    source: 'episode-title-card',
    episode_title: title,
    episode_number: ep.episode_number,
    event_id: event ? event.id : null,
    theme: direction ? direction.theme : null,
    replaces_asset_id: ep.title_card_asset_id || null,
    prompt,
  };
  await sequelize.transaction(async (transaction) => {
    await sequelize.query(
      `INSERT INTO assets (id, name, asset_type, asset_role, asset_group, asset_scope, purpose, category, entity_type,
         s3_url_raw, s3_url_processed, show_id, episode_id, metadata, created_at, updated_at)
       VALUES (:id, :name, 'UI_OVERLAY', :role, 'EPISODE', 'EPISODE', 'MAIN', 'overlay', 'prop',
         :url, :url, :showId, :episodeId, :metadata, NOW(), NOW())`,
      { replacements: {
        id: assetId, name: `${title} — Title Card`, role: TITLE_CARD_ROLE, url,
        showId: ownerShowId, episodeId, metadata: JSON.stringify(metadata),
      }, transaction }
    );
    // One current card: every earlier live title card of this episode is
    // soft-deleted (including ones made before P11 by the old button).
    await sequelize.query(
      `UPDATE assets SET deleted_at = NOW(), updated_at = NOW()
        WHERE episode_id = :episodeId AND asset_role = :role AND deleted_at IS NULL AND id <> :assetId`,
      { replacements: { episodeId, role: TITLE_CARD_ROLE, assetId }, transaction }
    );
    await sequelize.query(
      `UPDATE episodes SET title_card_asset_id = :assetId, title_card_title = :title, updated_at = NOW()
        WHERE id = :episodeId`,
      { replacements: { assetId, title, episodeId }, transaction }
    );
  });

  const after = await loadEpisode(sequelize, episodeId);
  return {
    assetId,
    imageUrl: url,
    title,
    replaced: ep.title_card_asset_id || null,
    state: titleCardState(after || { ...ep, title_card_asset_id: assetId, title_card_title: title },
      { s3_url_processed: url }),
  };
}

module.exports = {
  TITLE_CARD_ROLE,
  TITLE_CARD_OPTIONS,
  TitleCardError,
  estimateTitleCard,
  titleCardState,
  buildTitleCardPrompt,
  getTitleCardState,
  approveTitle,
  designTitleCard,
};
