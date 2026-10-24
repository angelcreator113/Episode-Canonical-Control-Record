'use strict';

/**
 * Invitation Generator Service v3
 *
 * An event's invitation is a run of versions, each its own INVITATION_LETTER
 * asset: a text-free background (s3_url_raw), the finished card
 * (s3_url_processed) and the card's words (metadata.text). Nothing edits a
 * version in place; every change makes a new pending version from a source
 * one, so history is complete and an approved card never changes under the
 * episode that shows it.
 *
 *   generate           Claude writes the words; 1-3 backgrounds are made
 *                      (variants share the words); one version each.
 *   reroll text        new words on the source's background (no image call).
 *   reroll background  new background(s) under the source's words.
 *   edit text          Evoni's words on the source's background (no AI).
 *   approve            one transaction: the version approved, linked to the
 *                      event, its words mirrored to
 *                      canon_consequences.invitation_text (the script
 *                      writer reads them), every other version superseded;
 *                      then the episode overlay is synced (P10).
 *   reject / delete    soft-delete; files removed from S3 only when no live
 *                      version still uses them (edits share a background).
 *
 * Every entry point is scoped: the event must be live in the show
 * (loadScopedEvent), and a version must belong to that event.
 *
 * Pipeline for one version:
 *   words -> background (Flux; Flux Kontext from the host brand's last
 *   approved background when there is one) -> text composited server-side
 *   (invitationCompositingService) -> S3 -> asset row (version number taken
 *   under the event's row lock).
 */

const axios = require('axios');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const {
  detectTheme, buildInvitationContent, contentFromText, compositeInvitation,
  compositeInvitationPrint, checkInvitationMoney, describeInvitationMoney,
} = require('./invitationCompositingService');
const { isDealEvent, listEventCosts } = require('./eventCostsService');
const { listEventDeliverables } = require('./eventTermsService');
const { deriveEventVisualDirection } = require('./eventVisualDirection');
const { loadScopedEvent } = require('../utils/eventScope');
const imageGen = require('./imageGenerationService');

const S3_BUCKET = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const s3 = new S3Client({ region: AWS_REGION });

const ASSET_TYPE = 'INVITATION_LETTER';
const SOURCE = 'invitation-generator-v3';
const MAX_VARIANTS = 3;

// The background's image options; episodeOverlaysService prices a
// regenerate from the same ones.
const INVITATION_IMAGE_OPTIONS = Object.freeze({ size: 'portrait', quality: 'hd', useCase: 'invitation' });

// The style fields a generate may set for that run only (the Invitation
// Style panel's fields; recorded on the version, never written to the event).
const STYLE_FIELDS = Object.freeze(['theme', 'mood', 'color_palette', 'floral_style', 'border_style']);

class InvitationError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ─── TERMS ───────────────────────────────────────────────────────────────────

/**
 * A deal event's terms rows, so the invitation can state the deal (Task
 * #2375; invitation ruling, docs/EVENT_EPISODE_FLOW.md §8(cc)): its
 * event_costs (entry, what the host or brand covers) and event_deliverables
 * (each with its fee). Legacy events return nulls; a failed read logs and
 * returns null for that part, and the builder states the rest.
 */
async function loadInvitationTerms(sequelize, event) {
  if (!isDealEvent(event)) return { costs: null, deliverables: null };
  let costs = null;
  let deliverables = null;
  try {
    costs = await listEventCosts(sequelize, event.id);
  } catch (err) {
    console.error('[InviteGen] event_costs read failed, invitation falls back to cost_coins:', err.message);
  }
  try {
    deliverables = await listEventDeliverables(sequelize, event.id);
  } catch (err) {
    console.error('[InviteGen] event_deliverables read failed, invitation names no deliverables:', err.message);
  }
  return { costs, deliverables };
}

// ─── STYLE ───────────────────────────────────────────────────────────────────

function cleanStyle(style) {
  const out = {};
  if (!style || typeof style !== 'object') return out;
  for (const key of STYLE_FIELDS) {
    const v = style[key];
    if (key === 'color_palette') {
      const list = Array.isArray(v) ? v : (typeof v === 'string' ? v.split(',') : []);
      const colors = list.map((c) => String(c).trim()).filter(Boolean).slice(0, 8);
      if (colors.length) out.color_palette = colors;
    } else if (typeof v === 'string' && v.trim()) {
      out[key] = v.trim().slice(0, 100);
    }
  }
  return out;
}

/** The event as this run sees it: its own style, with this run's choices over it. */
function styledEvent(event, style) {
  return { ...event, ...cleanStyle(style) };
}

// ─── BACKGROUND (no text) ────────────────────────────────────────────────────

function buildBackgroundPrompt(event) {
  const themeConfig = deriveEventVisualDirection(event);
  const colorText = themeConfig.palette.length > 0
    ? `Color palette emphasis: ${themeConfig.palette.join(', ')}.`
    : '';

  return `Create a luxury invitation card BACKGROUND as a flat graphic design, portrait orientation.

CRITICAL RULES:
- NO TEXT anywhere on the image. Zero text. No words. No letters. No numbers.
- This is a BACKGROUND ONLY — text will be added separately
- Leave a large clear central area (approximately 60% of card) completely empty for text overlay
- The design elements (border, florals, texture) should frame the edges only

CARD DESIGN:
Background: ${themeConfig.background}
Border/Frame: ${themeConfig.border}
Floral elements: ${themeConfig.florals} — EDGES AND CORNERS ONLY, not center
${colorText}
Richness: ${themeConfig.richness}

COMPOSITION:
- The card fills the ENTIRE image edge to edge — NO surrounding background, NO border gap, NO drop shadow
- Portrait card format (taller than wide), the card IS the image
- Decorative elements concentrated at top and bottom edges
- Large empty cream/ivory center zone — this is where text will appear
- Soft vignette effect toward center (lighter in middle, slightly darker at edges)
- ${themeConfig.atmosphere}
- The card surface extends to all four edges of the image

Style: High-end fashion editorial stationery. Think luxury wedding stationery meets fashion house invite.
Output: Edge-to-edge card surface, no outer background, suitable for text overlay compositing.`;
}

/** The Kontext prompt: the host's house style from the reference, this event's look. */
function buildBrandReferencePrompt(event) {
  const d = deriveEventVisualDirection(event);
  return `This image is an earlier invitation card background from the same host, ${event.host_brand}. Design a NEW invitation card background in the same house style — keep its border language, ornament, paper texture and gold treatment — for a different event.
For this event: background ${d.background}; florals ${d.florals}${d.palette.length ? `; colour palette ${d.palette.join(', ')}` : ''}; ${d.richness}; ${d.atmosphere}.
NO TEXT anywhere: no words, letters or numbers. Keep a large clear central area (about 60% of the card) empty for text. Portrait card, edge to edge, no outer background.`;
}

/**
 * The text-free background of the host brand's most recent approved
 * invitation in this show (another event's), for a consistent house style;
 * null when there is none. Legacy rows whose raw image is the composited
 * card are skipped: a reference with words would put words on the new card.
 */
async function findBrandStyleReference(sequelize, event) {
  const brand = event?.host_brand && String(event.host_brand).trim();
  if (!brand) return null;
  try {
    const rows = await sequelize.query(
      `SELECT a.s3_url_raw
         FROM world_events e
         JOIN assets a ON a.id = e.invitation_asset_id AND a.deleted_at IS NULL
        WHERE e.show_id = :showId
          AND e.id <> :eventId
          AND e.deleted_at IS NULL
          AND lower(trim(e.host_brand)) = lower(:brand)
          AND a.approval_status = 'approved'
          AND a.s3_url_raw IS NOT NULL
          AND a.s3_url_raw <> a.s3_url_processed
        ORDER BY a.updated_at DESC
        LIMIT 1`,
      { replacements: { showId: event.show_id, eventId: event.id, brand }, type: sequelize.QueryTypes.SELECT }
    );
    return rows?.[0]?.s3_url_raw || null;
  } catch (err) {
    console.error('[InviteGen] brand style reference lookup failed; generating without one:', err.message);
    return null;
  }
}

/**
 * Whether the invitation's image provider can run. generateImage sends
 * every use case to Flux on fal.ai (imageGenerationService), so it is
 * FAL_KEY; checked here once rather than in each route.
 */
function imageProviderReady() {
  return process.env.FAL_KEY ? { ready: true } : { ready: false, missing: 'FAL_KEY' };
}

function assertImageProviderReady() {
  const r = imageProviderReady();
  if (!r.ready) throw new InvitationError(503, `${r.missing} is not configured on the server, so invitation backgrounds cannot be made.`);
}

async function downloadImage(url, timeout = 60000) {
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout });
  return Buffer.from(res.data);
}

/**
 * One text-free background. Flux's filter answers a flagged prompt with an
 * all-black image (imageGenerationService nsfw_flagged); that is retried
 * once, never kept.
 */
async function generateBackground(event, { brandReferenceUrl = null } = {}) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = brandReferenceUrl
      ? await imageGen.generateImageFromImage(brandReferenceUrl, buildBrandReferencePrompt(event), { size: 'portrait' })
      : await imageGen.generateImage(buildBackgroundPrompt(event), INVITATION_IMAGE_OPTIONS);
    if (!result?.url) throw new InvitationError(502, 'Image generation did not return a picture.');
    if (result.nsfw_flagged) {
      console.warn(`[InviteGen] background came back black (flagged), try ${attempt + 1}`);
      continue;
    }
    return {
      buffer: await downloadImage(result.url),
      model: result.model || null,
      seed: result.seed || null,
      brandReference: !!brandReferenceUrl,
    };
  }
  throw new InvitationError(502, 'The image service returned a blank background twice. Try again, or change the style.');
}

// ─── S3 ──────────────────────────────────────────────────────────────────────

const EXTENSIONS = { 'image/png': 'png', 'image/jpeg': 'jpg' };

async function uploadToS3(buffer, eventId, suffix, contentType = 'image/png') {
  const s3Key = `invitations/${eventId}/${uuidv4()}-${suffix}.${EXTENSIONS[contentType] || 'png'}`;
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'max-age=31536000',
    Metadata: { source: SOURCE, event_id: String(eventId) },
  }));
  return `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
}

/** Our bucket's key for an invitation file URL, or null for anything else. */
function invitationKeyOf(url) {
  if (!url || !S3_BUCKET) return null;
  const bucketHost = `${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/`;
  const idx = url.indexOf(bucketHost);
  if (idx === -1) return null;
  const key = decodeURIComponent(url.slice(idx + bucketHost.length));
  return key.startsWith('invitations/') ? key : null;
}

/**
 * Remove a deleted version's files from S3, each only when no live asset
 * still uses it (an edit or text re-roll shares its source's background).
 * Best effort: a failure is logged, the delete stands.
 */
async function deleteVersionFiles(sequelize, asset) {
  const urls = [...new Set([asset.s3_url_processed, asset.s3_url_raw].filter(Boolean))];
  for (const url of urls) {
    const key = invitationKeyOf(url);
    if (!key) continue;
    try {
      const [row] = await sequelize.query(
        `SELECT COUNT(*)::int AS n FROM assets
          WHERE id <> :assetId AND deleted_at IS NULL
            AND (s3_url_processed = :url OR s3_url_raw = :url)`,
        { replacements: { assetId: asset.id, url }, type: sequelize.QueryTypes.SELECT }
      );
      if (Number(row?.n) > 0) continue;
      await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
      console.log(`[InviteGen] Removed ${key}`);
    } catch (err) {
      console.error(`[InviteGen] S3 cleanup of ${key} failed (the delete stands):`, err.message);
    }
  }
}

// ─── EVENTS AND VERSIONS ─────────────────────────────────────────────────────

/** The live event in this show, or a 404. */
async function loadEvent(sequelize, { showId, eventId, transaction, lock = false, columns = '*' }) {
  const event = await loadScopedEvent(sequelize, { showId, eventId, transaction, lock, columns });
  if (!event) throw new InvitationError(404, 'Event not found in this show.');
  return event;
}

function parseMetadata(row) {
  const m = row?.metadata;
  if (!m) return {};
  if (typeof m === 'string') {
    try { return JSON.parse(m) || {}; } catch (err) {
      console.error('[InviteGen] asset metadata is not JSON:', err.message);
      return {};
    }
  }
  return m;
}

/** A live version of this event's invitation, or a 404. */
async function loadVersion(sequelize, { eventId, assetId, transaction }) {
  if (!assetId) throw new InvitationError(400, 'assetId is required.');
  const rows = await sequelize.query(
    `SELECT * FROM assets
      WHERE id = :assetId
        AND asset_type = :type
        AND metadata->>'event_id' = :eventId
        AND deleted_at IS NULL
      LIMIT 1`,
    {
      replacements: { assetId, type: ASSET_TYPE, eventId: String(eventId) },
      type: sequelize.QueryTypes.SELECT,
      ...(transaction ? { transaction } : {}),
    }
  );
  if (!rows?.[0]) throw new InvitationError(404, 'That invitation version is not one of this event\'s.');
  return rows[0];
}

/**
 * A version's words: its own metadata.text, else (versions made before
 * v3) the edited words an in-place edit stored, else for the event's
 * approved version the event's canon_consequences.invitation_text; null
 * when none is known.
 */
function versionText(asset, event = null) {
  const meta = parseMetadata(asset);
  if (meta.text && typeof meta.text === 'object') return meta.text;
  if (meta.custom_text && typeof meta.custom_text === 'object') return meta.custom_text;
  if (event && event.invitation_asset_id === asset.id) {
    const cc = typeof event.canon_consequences === 'string'
      ? (() => { try { return JSON.parse(event.canon_consequences); } catch (err) { console.error('[InviteGen] canon_consequences is not JSON:', err.message); return {}; } })()
      : (event.canon_consequences || {});
    const t = cc.invitation_text;
    if (t && typeof t === 'object') return t;
  }
  return null;
}

/** The words to store: the card's text and frame, nothing else. */
function storedText(content) {
  const pick = ['eventName', 'eventSubtitle', 'opening', 'body', 'closing', 'hostName', 'hostBrand', 'prestige'];
  return Object.fromEntries(pick.filter((k) => content[k] !== undefined).map((k) => [k, content[k]]));
}

/**
 * Save one version: the event row is locked while the next number is
 * taken (every version ever made, deleted ones too, so a number is never
 * reused and two generates at once cannot share one), then the asset row
 * is written in the same transaction.
 */
async function saveVersion(models, { showId, event, content, backgroundUrl, cardUrl, kind, parentId = null, variantGroup = null, theme, style = {}, background = {}, moneyCheck = null }) {
  const { sequelize, Asset } = models;
  return sequelize.transaction(async (transaction) => {
    await loadEvent(sequelize, { showId, eventId: event.id, transaction, lock: true, columns: 'id' });
    const [row] = await sequelize.query(
      `SELECT GREATEST(
                COALESCE(MAX(CASE WHEN metadata->>'version' ~ '^[0-9]+$' THEN (metadata->>'version')::int END), 0),
                COUNT(*)::int
              ) + 1 AS next
         FROM assets
        WHERE asset_type = :type AND metadata->>'event_id' = :eventId`,
      { replacements: { type: ASSET_TYPE, eventId: String(event.id) }, type: sequelize.QueryTypes.SELECT, transaction }
    );
    const version = Number(row?.next) || 1;
    return Asset.create({
      id: uuidv4(),
      name: `${event.name} — Invitation v${version}`,
      asset_type: ASSET_TYPE,
      asset_role: 'UI.OVERLAY.INVITATION',
      asset_group: 'SHOW',
      asset_scope: 'SHOW',
      purpose: 'MAIN',
      category: 'overlay',
      entity_type: 'prop',
      s3_url_raw: backgroundUrl,
      s3_url_processed: cardUrl,
      processing_status: 'none',
      mood_tags: [event.mood, theme, ...(event.dress_code_keywords || []).slice(0, 2)].filter(Boolean),
      color_palette: event.color_palette || [],
      show_id: showId,
      approval_status: 'pending_review',
      metadata: {
        source: SOURCE,
        event_id: String(event.id),
        event_name: event.name,
        version,
        kind,
        parent_asset_id: parentId,
        variant_group: variantGroup,
        theme,
        theme_source: event.theme ? 'manual' : 'auto-detected',
        style: Object.keys(style).length ? style : null,
        prestige: event.prestige,
        host_brand: event.host_brand || null,
        text: storedText(content),
        text_source: content.source || (kind === 'edited' ? 'edited' : null),
        money_check: moneyCheck,
        image_model: background.model || null,
        image_seed: background.seed || null,
        brand_reference: !!background.brandReference,
        composited: true,
        generated_at: new Date().toISOString(),
      },
    }, { transaction });
  });
}

function versionSummary(asset) {
  const meta = parseMetadata(asset);
  return {
    assetId: asset.id,
    imageUrl: asset.s3_url_processed,
    version: meta.version || null,
    kind: meta.kind || null,
    variantGroup: meta.variant_group || null,
    moneyCheck: meta.money_check || null,
    textSource: meta.text_source || null,
    brandReference: !!meta.brand_reference,
  };
}

/** Composite the words on one background, upload both, save the version. */
async function makeVersion(models, ctx, { background, backgroundUrl = null, content, kind, parentId = null, variantGroup = null, moneyCheck = null }) {
  const { showId, event, theme, style } = ctx;
  const card = await compositeInvitation(background.buffer, event, content);
  if (!card) throw new InvitationError(500, 'Invitation text compositing is unavailable on the server (canvas/sharp).');
  const rawUrl = backgroundUrl || await uploadToS3(background.buffer, event.id, 'bg', 'image/jpeg');
  const cardUrl = await uploadToS3(card, event.id, kind, 'image/png');
  const asset = await saveVersion(models, {
    showId, event, content, backgroundUrl: rawUrl, cardUrl, kind, parentId, variantGroup, theme, style, background, moneyCheck,
  });
  return versionSummary(asset);
}

function variantCount(n) {
  const v = parseInt(n, 10);
  if (!Number.isFinite(v) || v < 1) return 1;
  return Math.min(v, MAX_VARIANTS);
}

async function runContext(models, { showId, eventId, style }) {
  const raw = await loadEvent(models.sequelize, { showId, eventId });
  const cleaned = cleanStyle(style);
  const event = styledEvent(raw, cleaned);
  return { showId: String(showId), raw, event, style: cleaned, theme: detectTheme(event) || 'default' };
}

async function backgroundsFor(models, ctx, count, useBrandStyle, progress) {
  const brandReferenceUrl = useBrandStyle === false ? null : await findBrandStyleReference(models.sequelize, ctx.event);
  const out = [];
  for (let i = 0; i < count; i += 1) {
    progress('background', count > 1 ? `Designing background ${i + 1} of ${count}` : 'Designing the background', { index: i + 1, of: count });
    out.push(await generateBackground(ctx.event, { brandReferenceUrl }));
  }
  return out;
}

const noProgress = () => {};

// ─── ENTRY POINTS ────────────────────────────────────────────────────────────

/**
 * Generate an invitation: Claude writes the words once; `variants` (1-3)
 * backgrounds are made under them; one pending version each.
 *
 * @returns {{ eventName, theme, versions: object[] }}
 */
async function generateInvitation(models, { showId, eventId, variants = 1, style = null, useBrandStyle = true, onProgress = noProgress }) {
  assertImageProviderReady();
  const ctx = await runContext(models, { showId, eventId, style });
  const count = variantCount(variants);
  console.log(`[InviteGen] Generating for: ${ctx.event.name} | Theme: ${ctx.theme} | Variants: ${count}`);

  onProgress('writing', 'Writing the invitation');
  const terms = await loadInvitationTerms(models.sequelize, ctx.event);
  const content = await buildInvitationContent(ctx.event, terms);

  const backgrounds = await backgroundsFor(models, ctx, count, useBrandStyle, onProgress);
  const variantGroup = count > 1 ? uuidv4() : null;
  const versions = [];
  for (let i = 0; i < backgrounds.length; i += 1) {
    onProgress('saving', count > 1 ? `Setting the text on card ${i + 1} of ${count}` : 'Setting the text on the card');
    versions.push(await makeVersion(models, ctx, {
      background: backgrounds[i], content, kind: 'generated', variantGroup, moneyCheck: content.moneyCheck,
    }));
  }
  return { eventName: ctx.event.name, theme: ctx.theme, versions };
}

/** New words on the source version's background (one text call, no image call). */
async function rerollText(models, { showId, eventId, assetId, onProgress = noProgress }) {
  const ctx = await runContext(models, { showId, eventId, style: null });
  const source = await loadVersion(models.sequelize, { eventId, assetId });
  if (!source.s3_url_raw) throw new InvitationError(409, 'This version has no saved background to write on.');
  Object.assign(ctx, styleOf(ctx, source));
  onProgress('writing', 'Writing new words');
  const terms = await loadInvitationTerms(models.sequelize, ctx.event);
  const content = await buildInvitationContent(ctx.event, terms);
  onProgress('saving', 'Setting the text on the card');
  const background = { buffer: await downloadImage(source.s3_url_raw), ...backgroundMeta(source) };
  const version = await makeVersion(models, ctx, {
    background, backgroundUrl: source.s3_url_raw, content, kind: 'text_reroll', parentId: source.id, moneyCheck: content.moneyCheck,
  });
  return { eventName: ctx.event.name, theme: ctx.theme, versions: [version] };
}

/** New background(s) under the source version's words (no text call). */
async function rerollBackground(models, { showId, eventId, assetId, variants = 1, style = null, useBrandStyle = true, onProgress = noProgress }) {
  assertImageProviderReady();
  const ctx = await runContext(models, { showId, eventId, style });
  const source = await loadVersion(models.sequelize, { eventId, assetId });
  const words = versionText(source, ctx.raw);
  if (!words) throw new InvitationError(409, 'This version\'s words were not saved (it predates version history), so they cannot be kept. Regenerate instead.');
  if (!style) Object.assign(ctx, styleOf(ctx, source));
  const content = { ...contentFromText(ctx.event, words) };
  const moneyCheck = await moneyCheckFor(models, ctx.event, content);
  const count = variantCount(variants);
  const backgrounds = await backgroundsFor(models, ctx, count, useBrandStyle, onProgress);
  const variantGroup = count > 1 ? uuidv4() : null;
  const versions = [];
  for (let i = 0; i < backgrounds.length; i += 1) {
    onProgress('saving', count > 1 ? `Setting the text on card ${i + 1} of ${count}` : 'Setting the text on the card');
    versions.push(await makeVersion(models, ctx, {
      background: backgrounds[i], content, kind: 'background_reroll', parentId: source.id, variantGroup, moneyCheck,
    }));
  }
  return { eventName: ctx.event.name, theme: ctx.theme, versions };
}

/**
 * Evoni's words on the source version's background, as a new pending
 * version (no AI). The money check is reported, not enforced: her words
 * stand, and the page tells her when they no longer state the terms.
 */
async function editInvitationText(models, { showId, eventId, assetId, opening, body, closing }) {
  const ctx = await runContext(models, { showId, eventId, style: null });
  const source = await loadVersion(models.sequelize, { eventId, assetId });
  if (!String(opening || '').trim() && !String(body || '').trim()) throw new InvitationError(400, 'Write an opening or a body.');
  Object.assign(ctx, styleOf(ctx, source));
  const content = { ...contentFromText(ctx.event, { opening, body, closing }), source: 'edited' };
  const moneyCheck = await moneyCheckFor(models, ctx.event, content);
  const backgroundUrl = source.s3_url_raw || source.s3_url_processed;
  const background = { buffer: await downloadImage(backgroundUrl, 30000), ...backgroundMeta(source) };
  const version = await makeVersion(models, ctx, {
    background, backgroundUrl, content, kind: 'edited', parentId: source.id, moneyCheck,
  });
  return { ...version, moneyCheck };
}

function backgroundMeta(source) {
  const meta = parseMetadata(source);
  return { model: meta.image_model || null, seed: meta.image_seed || null, brandReference: !!meta.brand_reference };
}

/** A derived version keeps its source's run style and theme. */
function styleOf(ctx, source) {
  const meta = parseMetadata(source);
  const style = cleanStyle(meta.style);
  const event = styledEvent(ctx.raw, style);
  return { style, event, theme: meta.theme || detectTheme(event) || 'default' };
}

async function moneyCheckFor(models, event, content) {
  const terms = await loadInvitationTerms(models.sequelize, event);
  return checkInvitationMoney(content, describeInvitationMoney(event, terms));
}

/**
 * Approve a version, in one transaction: it is approved (and loses any
 * superseded mark), linked as the event's invitation, its words mirrored to
 * canon_consequences.invitation_text, and every other version superseded —
 * whether or not the event has an episode yet. Then the episode overlay is
 * synced (P10; Start Episode does it when there is no episode yet); a
 * failure there is logged and does not undo the approval.
 */
async function approveInvitation(models, { showId, eventId, assetId }) {
  const { sequelize } = models;
  const { supersedeOtherInvitationVersions, syncEpisodeInvitationOverlay } = require('./episodeInvitationOverlayService');

  const { episodeId, superseded } = await sequelize.transaction(async (transaction) => {
    const event = await loadEvent(sequelize, {
      showId, eventId, transaction, lock: true,
      columns: 'id, used_in_episode_id, invitation_asset_id, canon_consequences',
    });
    const asset = await loadVersion(sequelize, { eventId, assetId, transaction });
    const words = versionText(asset, event);

    await sequelize.query(
      `UPDATE assets
          SET approval_status = 'approved',
              metadata = COALESCE(metadata, '{}'::jsonb) - 'superseded_by' - 'superseded_at',
              updated_at = NOW()
        WHERE id = :assetId`,
      { replacements: { assetId }, transaction }
    );
    await sequelize.query(
      words
        ? `UPDATE world_events
              SET invitation_asset_id = :assetId,
                  canon_consequences = jsonb_set(COALESCE(canon_consequences, '{}'::jsonb), '{invitation_text}', CAST(:words AS jsonb)),
                  updated_at = NOW()
            WHERE id = :eventId`
        : 'UPDATE world_events SET invitation_asset_id = :assetId, updated_at = NOW() WHERE id = :eventId',
      { replacements: { assetId, eventId, words: words ? JSON.stringify(words) : null }, transaction }
    );
    const count = await supersedeOtherInvitationVersions(sequelize, { eventId, assetId, transaction });
    return { episodeId: event.used_in_episode_id || null, superseded: count };
  });

  let overlay = null;
  if (episodeId) {
    try {
      overlay = await syncEpisodeInvitationOverlay(models, { eventId, episodeId });
    } catch (err) {
      console.error('[InviteGen] Episode invitation overlay sync failed (the approval stands):', err.message);
    }
  }
  return { episodeId, superseded, placementId: overlay?.placement?.id || null, anchor: overlay?.anchor || null };
}

/** Untag a version from its episode and remove its placements there. */
async function removeFromEpisode(models, assetId, transaction) {
  await models.sequelize.query(
    `UPDATE assets
        SET episode_id = NULL,
            metadata = COALESCE(metadata, '{}'::jsonb) - 'overlay_type' - 'episode_invitation' - 'invitation_episode_id',
            updated_at = NOW()
      WHERE id = :assetId`,
    { replacements: { assetId }, ...(transaction ? { transaction } : {}) }
  );
  if (models.TimelinePlacement) {
    await models.TimelinePlacement.destroy({ where: { asset_id: assetId }, ...(transaction ? { transaction } : {}) });
  }
}

/** Reject a pending version. The approved one is deleted, not rejected. */
async function rejectInvitation(models, { showId, eventId, assetId }) {
  const { sequelize } = models;
  const asset = await sequelize.transaction(async (transaction) => {
    const event = await loadEvent(sequelize, { showId, eventId, transaction, lock: true, columns: 'id, invitation_asset_id' });
    const version = await loadVersion(sequelize, { eventId, assetId, transaction });
    if (event.invitation_asset_id === assetId) {
      throw new InvitationError(409, 'This is the approved invitation. Delete it instead, or approve another version.');
    }
    await sequelize.query(
      `UPDATE assets SET approval_status = 'rejected', deleted_at = NOW(), updated_at = NOW() WHERE id = :assetId`,
      { replacements: { assetId }, transaction }
    );
    return version;
  });
  await deleteVersionFiles(sequelize, asset);
  return { assetId };
}

/**
 * Delete a version. When it is the approved one, the event loses its
 * invitation (and its mirrored words) and the episode its placement.
 */
async function deleteInvitationVersion(models, { showId, eventId, assetId }) {
  const { sequelize } = models;
  const { asset, wasCurrent } = await sequelize.transaction(async (transaction) => {
    const event = await loadEvent(sequelize, { showId, eventId, transaction, lock: true, columns: 'id, invitation_asset_id' });
    const version = await loadVersion(sequelize, { eventId, assetId, transaction });
    const current = event.invitation_asset_id === assetId;
    await removeFromEpisode(models, assetId, transaction);
    await sequelize.query(
      'UPDATE assets SET deleted_at = NOW(), updated_at = NOW() WHERE id = :assetId',
      { replacements: { assetId }, transaction }
    );
    if (current) {
      await sequelize.query(
        `UPDATE world_events
            SET invitation_asset_id = NULL,
                canon_consequences = COALESCE(canon_consequences, '{}'::jsonb) - 'invitation_text',
                updated_at = NOW()
          WHERE id = :eventId`,
        { replacements: { eventId }, transaction }
      );
    }
    return { asset: version, wasCurrent: current };
  });
  await deleteVersionFiles(sequelize, asset);
  return { assetId, wasCurrent };
}

/** Take a version off its episode (it stays in the show library). */
async function unlinkInvitation(models, { showId, eventId, assetId }) {
  await loadEvent(models.sequelize, { showId, eventId, columns: 'id' });
  await loadVersion(models.sequelize, { eventId, assetId });
  await removeFromEpisode(models, assetId);
  return { assetId };
}

/** Every live version, newest first, with its words and whether it is current or superseded. */
async function listInvitationVersions(models, { showId, eventId }) {
  const { sequelize } = models;
  const event = await loadEvent(sequelize, { showId, eventId, columns: 'id, invitation_asset_id, canon_consequences' });
  const rows = await sequelize.query(
    `SELECT id, name, s3_url_processed, s3_url_raw, approval_status, metadata, created_at
       FROM assets
      WHERE metadata->>'event_id' = :eventId
        AND asset_type = :type
        AND deleted_at IS NULL
      ORDER BY created_at DESC`,
    { replacements: { eventId: String(eventId), type: ASSET_TYPE }, type: sequelize.QueryTypes.SELECT }
  );
  return rows.map((r) => {
    const meta = parseMetadata(r);
    const current = r.id === event.invitation_asset_id;
    return {
      id: r.id,
      name: r.name,
      image_url: r.s3_url_processed,
      approval_status: r.approval_status,
      status: current ? 'current' : (meta.superseded_by ? 'superseded' : (r.approval_status || 'pending_review')),
      is_current: current,
      version: meta.version ?? null,
      kind: meta.kind || null,
      parent_asset_id: meta.parent_asset_id || null,
      variant_group: meta.variant_group || null,
      theme: meta.theme || null,
      theme_source: meta.theme_source || null,
      style: meta.style || null,
      text: versionText(r, event),
      text_source: meta.text_source || null,
      money_check: meta.money_check || null,
      brand_reference: !!meta.brand_reference,
      has_background: !!r.s3_url_raw && r.s3_url_raw !== r.s3_url_processed,
      created_at: r.created_at,
    };
  });
}

/** A version's words for the edit box (the approved one when no assetId). */
async function getInvitationText(models, { showId, eventId, assetId = null }) {
  const event = await loadEvent(models.sequelize, { showId, eventId, columns: 'id, invitation_asset_id, canon_consequences' });
  const id = assetId || event.invitation_asset_id;
  if (!id) return null;
  const asset = await loadVersion(models.sequelize, { eventId, assetId: id });
  return versionText(asset, event);
}

/**
 * The approved invitation as a print-ready PNG, with the card's own words.
 * A version made before v3 that kept no words or no text-free background is
 * returned as its finished card, unchanged — never rewritten by Claude.
 */
async function exportInvitationPrint(models, { showId, eventId }) {
  const { sequelize } = models;
  const event = await loadEvent(sequelize, { showId, eventId });
  if (!event.invitation_asset_id) throw new InvitationError(404, 'This event has no approved invitation.');
  const asset = await loadVersion(sequelize, { eventId, assetId: event.invitation_asset_id });
  const words = versionText(asset, event);
  const hasBackground = asset.s3_url_raw && asset.s3_url_raw !== asset.s3_url_processed;
  if (!words || !hasBackground) return downloadImage(asset.s3_url_processed);
  const style = cleanStyle(parseMetadata(asset).style);
  const styled = styledEvent(event, style);
  const print = await compositeInvitationPrint(await downloadImage(asset.s3_url_raw), styled, contentFromText(styled, words));
  return print || downloadImage(asset.s3_url_processed);
}

/**
 * What a generate (or background re-roll) will cost and look like, before
 * anything is spent: the per-image price from the rate table (Kontext when
 * the host brand's house style will be used), the total for `variants`, the
 * text call's model, whether a house-style reference exists (so the page can
 * offer it), and the visual direction the run will use.
 */
async function estimateInvitation(models, { showId, eventId, variants = 1, style = null, useBrandStyle = true }) {
  const ctx = await runContext(models, { showId, eventId, style });
  const count = variantCount(variants);
  const available = await findBrandStyleReference(models.sequelize, ctx.event);
  const reference = useBrandStyle === false ? null : available;
  const each = reference ? imageGen.estimateImageFromImageCost() : imageGen.estimateGenerationCost(INVITATION_IMAGE_OPTIONS);
  const direction = deriveEventVisualDirection(ctx.event);
  return {
    variants: count,
    maxVariants: MAX_VARIANTS,
    perImage: { usd: each.usd, priced: each.priced, model: each.model },
    imagesUsd: each.priced && each.usd != null ? Number((each.usd * count).toFixed(4)) : null,
    textModel: 'claude-haiku-4-5-20251001',
    brandReference: !!reference,
    brandReferenceAvailable: !!available,
    provider: imageProviderReady(),
    direction: {
      theme: direction.theme,
      themeSource: ctx.event.theme ? 'manual' : 'auto-detected',
      palette: direction.palette,
      florals: direction.florals,
      border: direction.border,
      richness: direction.richness,
      mood: ctx.event.mood || null,
    },
    style: {
      theme: ctx.event.theme || '',
      mood: ctx.event.mood || '',
      color_palette: Array.isArray(ctx.event.color_palette) ? ctx.event.color_palette : [],
      floral_style: ctx.event.floral_style || '',
      border_style: ctx.event.border_style || '',
    },
  };
}

/**
 * Generate for several events of the show, one after another (the image
 * provider's rate limits), at most IMAGE_CALLS_PER_OPERATION events. With
 * no ids, the show's live events that have no invitation.
 */
async function batchGenerateInvitations(models, { showId, eventIds = null, onProgress = noProgress }) {
  assertImageProviderReady();
  const { sequelize } = models;
  let targetIds = Array.isArray(eventIds) ? eventIds.filter(Boolean).map(String) : [];
  if (targetIds.length === 0) {
    const rows = await sequelize.query(
      'SELECT id FROM world_events WHERE show_id = :showId AND invitation_asset_id IS NULL AND deleted_at IS NULL ORDER BY created_at ASC',
      { replacements: { showId }, type: sequelize.QueryTypes.SELECT }
    );
    targetIds = rows.map((r) => String(r.id));
  }
  const maxBatch = parseInt(process.env.IMAGE_CALLS_PER_OPERATION, 10) || 3;
  const capped = targetIds.slice(0, maxBatch);
  const results = [];
  for (let i = 0; i < capped.length; i += 1) {
    const eventId = capped[i];
    onProgress('event', `Invitation ${i + 1} of ${capped.length}`, { eventId, index: i + 1, of: capped.length });
    try {
      const r = await generateInvitation(models, { showId, eventId, onProgress });
      results.push({ eventId, success: true, ...r.versions[0] });
    } catch (err) {
      console.error(`[InviteGen] Batch failed for ${eventId}:`, err.message);
      if (err.code === 'AI_BUDGET_EXCEEDED') throw err;
      results.push({ eventId, success: false, error: err.message });
    }
  }
  return { results, skipped: targetIds.length - capped.length, succeeded: results.filter((r) => r.success).length };
}

module.exports = {
  InvitationError,
  INVITATION_IMAGE_OPTIONS,
  MAX_VARIANTS,
  generateInvitation,
  rerollText,
  rerollBackground,
  editInvitationText,
  approveInvitation,
  rejectInvitation,
  deleteInvitationVersion,
  unlinkInvitation,
  listInvitationVersions,
  getInvitationText,
  exportInvitationPrint,
  estimateInvitation,
  batchGenerateInvitations,
  buildBackgroundPrompt,
  buildBrandReferencePrompt,
  findBrandStyleReference,
  imageProviderReady,
  cleanStyle,
  versionText,
  uploadToS3,
};
