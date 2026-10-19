'use strict';

/**
 * Visual Memory, phase 3 (Evoni's "Character Visual Memory System", section
 * 3 "Reuse and variation tools"; 2026-10-19: "yes start phase 3 after
 * deliverables"): a variation of a library picture.
 *
 *   "Every variation becomes a new linked asset; never overwrite its parent.
 *   Use the actual stored image as an editing reference, not a fresh
 *   text-only approximation. Allow users to lock face, wardrobe, location and
 *   key props. Flag identity or continuity drift for review."
 *
 *   createVariation(db, { assetId, change: { kind, text, characterId? },
 *                         locks, by })
 *     kind: object | action | time | weather | framing | add_character.
 *     One image call: OpenAI images/edits (gpt-image-1.5, as the scene sets'
 *     outpainting uses it) with the parent's own stored image as the first
 *     reference, and for add_character up to two of that character's own
 *     approved portraits after it. Budget-gated and logged by
 *     imageCostService.runImageCall (a refusal is a 429 and nothing is
 *     stored). The result is stored like other studio images
 *     (pulseImageService) and saved as a NEW media_assets row: source
 *     'generated', parent_asset_id = the parent, status 'draft', visibility
 *     'private', generation { kind, text, locks, prompt, model, references,
 *     parent_id, review }. It carries the parent's tags (not the posts that
 *     use the parent), plus the added character. The parent is never
 *     changed. A picture never makes canon.
 *   familyOf(db, assetId, { audience })  the original and every variation
 *     made from it (and from those), each with what it was made from.
 *
 * Drift review (no extra paid call): every variation waits as a private
 * draft for Evoni. generation.review lists what to look at, from the change
 * and the locks (a person added, a reframed outfit, a relit place, faces
 * left unlocked). The app does not look at the picture itself.
 */

const crypto = require('crypto');
const { MediaError } = require('./mediaLibrary');
const { isConfidential } = require('../utils/confidentialCharacters');

const KINDS = Object.freeze(['object', 'action', 'time', 'weather', 'framing', 'add_character']);
const LOCKS = Object.freeze(['face', 'wardrobe', 'location', 'props']);
// What each kind changes: that lock cannot stay on while it is the thing changed.
const CHANGES = Object.freeze({ object: 'props', action: null, time: null, weather: null, framing: null, add_character: null });
const MODEL = 'gpt-image-1.5';
const SIZE = { width: 1536, height: 1024 };
const MAX_PORTRAITS = 2;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const clean = (v, n) => {
  const t = v == null ? '' : String(v).replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, n) : '';
};

/** The change and locks as given, checked. */
function normalizeRequest({ change, locks } = {}) {
  const kind = String(change?.kind || '');
  if (!KINDS.includes(kind)) throw new MediaError(400, `What to change must be one of ${KINDS.join(', ')}.`);
  const text = clean(change?.text, 300);
  if (!text && kind !== 'add_character') throw new MediaError(400, 'Say what it should become.');
  const characterId = kind === 'add_character' ? String(change?.characterId || change?.character_id || '') : null;
  if (kind === 'add_character' && !UUID_RE.test(characterId)) throw new MediaError(400, 'Choose who to add.');
  const list = Array.isArray(locks) ? [...new Set(locks.map(String))] : [];
  for (const l of list) if (!LOCKS.includes(l)) throw new MediaError(400, `Locks are ${LOCKS.join(', ')}.`);
  if (CHANGES[kind] && list.includes(CHANGES[kind])) {
    throw new MediaError(400, `The ${CHANGES[kind]} are locked, so an object cannot change. Unlock them first.`);
  }
  return { kind, text, characterId, locks: list };
}

const LOCK_LINES = {
  face: 'Keep every person exactly as they are: the same face, skin, hair, body and identity.',
  wardrobe: 'Keep every outfit, accessory, fabric and colour exactly as it is.',
  location: 'Keep the place exactly as it is: the same room or setting, background, furniture and layout.',
  props: 'Keep the key objects exactly as they are',
};

/** The edit prompt: one change, everything locked kept as it is. */
function buildPrompt({ kind, text, locks }, { details = {}, added = null } = {}) {
  const lines = ['Edit this photograph. Change only what is asked; everything else stays as it is in the first image.'];
  if (kind === 'object') lines.push(`Change the object: ${text}.`);
  if (kind === 'action') lines.push(`Change what the person is doing: ${text}. Same person, same clothes, same place.`);
  if (kind === 'time') lines.push(`Change the time of day to ${text}; the light changes with it.`);
  if (kind === 'weather') lines.push(`Change the weather to ${text}.`);
  if (kind === 'framing') lines.push(`Reframe the shot: ${text}. Same scene, same people, same clothes.`);
  if (kind === 'add_character') {
    const look = added?.look ? ` Their approved look:\n${added.look}` : '';
    const refs = added?.portraits ? ' They must look exactly like the person in the reference portrait images that follow the first image.' : '';
    lines.push(`Add ${added?.name || 'this person'} to the scene${text ? `: ${text}` : ''}.${refs}${look}`);
  }
  for (const l of locks) {
    if (l === 'props') {
      const objects = Array.isArray(details.objects) && details.objects.length ? `: ${details.objects.join(', ')}` : '';
      lines.push(`${LOCK_LINES.props}${objects}.`);
    } else {
      lines.push(LOCK_LINES[l]);
    }
  }
  lines.push('Photorealistic. No text, no logos, no real brands.');
  return lines.join('\n');
}

/** What Evoni should look at before approving it. The app does not inspect the picture. */
function reviewFor({ kind, locks }, { pictured = 0 } = {}) {
  const reasons = [];
  if (kind === 'add_character') reasons.push('A person was added: check they match their approved portraits.');
  if (kind === 'add_character' && locks.includes('face') && pictured > 0) reasons.push('Faces were locked: check everyone already there still looks like themselves.');
  if (kind === 'framing' && locks.includes('wardrobe')) reasons.push('The framing changed: check the outfit is still the approved one.');
  if (['time', 'weather'].includes(kind) && locks.includes('location')) reasons.push('The light changed: check the place still reads as their established location.');
  if (kind === 'action' && locks.includes('props')) reasons.push('The action changed: check the key objects are still there.');
  if (!locks.includes('face') && pictured > 0) reasons.push('Faces were not locked: check every person is still who they are.');
  if (!locks.includes('wardrobe') && pictured > 0 && kind !== 'add_character') reasons.push('Wardrobe was not locked: check the outfits.');
  if (!reasons.length) reasons.push('Check it matches the original everywhere except what was changed.');
  return { locks, needs_review: true, reasons };
}

/** The new picture's details: the parent's, with what changed noted. */
function detailsFor(parentDetails, { kind, text }, added) {
  const d = { ...(parentDetails || {}) };
  if (kind === 'time') d.time_of_day = text;
  else if (kind === 'framing') d.camera_angle = text;
  const note = kind === 'add_character' ? `Variation: ${added?.name || 'a person'} added${text ? ` (${text})` : ''}` : `Variation (${kind}): ${text}`;
  d.notes = d.notes ? `${note}. ${d.notes}`.slice(0, 500) : note;
  return d;
}

/** The parent's tags a variation carries: everything but the posts that use the parent. */
function tagsFor(parentLinks, added) {
  const out = (parentLinks || [])
    .filter((l) => l.entity_type !== 'post')
    .map((l) => ({ entity_type: l.entity_type, entity_id: l.entity_id, role: l.role }));
  if (added && !out.some((l) => l.entity_type === 'character' && String(l.entity_id) === String(added.id))) {
    out.push({ entity_type: 'character', entity_id: added.id, role: 'pictured' });
  }
  return out;
}

/** The bytes of a stored picture: an http(s) address or an image data URL. */
async function imageBytes(url) {
  const u = String(url || '');
  const data = u.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/i);
  if (data) return { buffer: Buffer.from(data[2], 'base64'), mimetype: data[1].toLowerCase() };
  if (!/^https?:\/\//i.test(u)) throw new MediaError(400, 'This picture is not stored where the image tool can read it.');
  const axios = require('axios');
  const res = await axios.get(u, { responseType: 'arraybuffer', timeout: 30000 });
  const type = String(res.headers?.['content-type'] || 'image/png').split(';')[0];
  return { buffer: Buffer.from(res.data), mimetype: /^image\/(png|jpeg|webp)$/.test(type) ? type : 'image/png' };
}

/**
 * A picture with a confidential professional in it (Dr. Sinclair) is never
 * varied (Evoni, 2026-10-19), before any image call is made.
 */
async function refuseConfidential(db, parent) {
  const ids = (parent.links || []).filter((l) => l.entity_type === 'character').map((l) => l.entity_id);
  if (!ids.length) return;
  const people = await db.RegistryCharacter.findAll({ where: { id: ids } });
  if (people.some((c) => isConfidential(c))) throw new MediaError(403, 'This picture has a confidential character in it, so it is not varied.');
}

/** The added character: who they are, their look, and up to two approved portraits. */
async function addedCharacter(db, characterId) {
  const character = await db.RegistryCharacter.findByPk(characterId);
  if (!character) throw new MediaError(404, 'That character was not found.');
  if (isConfidential(character)) throw new MediaError(403, 'That character is not used in pictures.');
  const urls = [];
  if (character.portrait_url) urls.push(character.portrait_url);
  const [rows] = await db.sequelize.query(
    `SELECT ma.url FROM media_asset_links l JOIN media_assets ma ON ma.id = l.asset_id AND ma.deleted_at IS NULL
      WHERE l.entity_type = 'character' AND l.entity_id = :id AND l.deleted_at IS NULL
        AND ma.source = 'portrait' AND ma.status = 'approved' ORDER BY ma.created_at DESC LIMIT 4`,
    { replacements: { id: String(characterId) } });
  for (const r of rows) if (!urls.includes(r.url)) urls.push(r.url);
  const { appearanceLines } = require('./characterAppearance');
  return {
    id: character.id,
    name: character.selected_name || character.display_name || 'this person',
    look: appearanceLines(character.appearance),
    portraitUrls: urls.filter((u) => /^(https?:\/\/|data:image\/)/i.test(u)).slice(0, MAX_PORTRAITS),
  };
}

/**
 * One image call through the image budget gate: images/edits when there are
 * reference images (the first is the one edited), images/generations when
 * there are none (phase 4: a new picture with no person and no place to
 * keep). routeName is what ai_usage_logs records it under.
 */
async function editImage(prompt, images, { routeName = 'media-variation' } = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new MediaError(503, 'The image tool is not set up (OPENAI_API_KEY).');
  const text = prompt.length > 4000 ? `${prompt.slice(0, 3997)}...` : prompt;
  const axios = require('axios');
  const imageCost = require('./imageCostService');
  const plan = { model: MODEL, ...SIZE, quality: 'high', count: 1, inputImages: images.length > 0, routeName };
  let call;
  if (images.length) {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('model', MODEL);
    const field = images.length > 1 ? 'image[]' : 'image';
    images.forEach((img, i) => form.append(field, img.buffer, { filename: `reference-${i}.png`, contentType: img.mimetype }));
    form.append('prompt', text);
    form.append('n', '1');
    form.append('size', `${SIZE.width}x${SIZE.height}`);
    form.append('quality', 'high');
    call = () => axios.post('https://api.openai.com/v1/images/edits', form,
      { headers: { Authorization: `Bearer ${apiKey}`, ...form.getHeaders() }, timeout: 180000 });
  } else {
    call = () => axios.post('https://api.openai.com/v1/images/generations',
      { model: MODEL, prompt: text, n: 1, size: `${SIZE.width}x${SIZE.height}`, quality: 'high' },
      { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 180000 });
  }
  const response = await imageCost.runImageCall(plan, call);
  const item = response?.data?.data?.[0];
  if (item?.b64_json) return Buffer.from(item.b64_json, 'base64');
  if (item?.url) return (await imageBytes(item.url)).buffer;
  throw new MediaError(502, 'The image tool sent no picture back.');
}

async function createVariation(db, { assetId, change, locks, by = null } = {}) {
  const media = require('./mediaLibrary');
  const parent = await media.getAsset(db, assetId);
  await refuseConfidential(db, parent);
  const req = normalizeRequest({ change, locks });
  const added = req.kind === 'add_character' ? await addedCharacter(db, req.characterId) : null;
  const pictured = (parent.links || []).filter((l) => l.entity_type === 'character').length;

  const base = await imageBytes(parent.url);
  const portraits = [];
  for (const url of added?.portraitUrls || []) {
    try {
      portraits.push(await imageBytes(url));
    } catch (err) {
      console.error(`[mediaVariations] a portrait of ${added.id} could not be read; it is left out:`, err.message);
    }
  }
  const prompt = buildPrompt(req, { details: parent.details || {}, added: added ? { ...added, portraits: portraits.length > 0 } : null });
  const out = await editImage(prompt, [base, ...portraits]);

  const { storePulseImage } = require('./pulseImageService');
  const stored = await storePulseImage({ buffer: out, mimetype: 'image/png' }, { keyPrefix: 'media/variations', label: 'The variation' });
  const review = reviewFor(req, { pictured });
  const generation = {
    kind: req.kind, text: req.text || null, locks: req.locks, prompt, model: MODEL,
    references: [parent.id, ...(added ? added.portraitUrls.slice(0, portraits.length).map((u) => ({ character_id: added.id, url: u })) : [])],
    parent_id: parent.id, added_character_id: added?.id || null, review, made_at: new Date().toISOString(), id: crypto.randomUUID(),
  };
  const created = await media.createAsset(db, {
    url: stored.url, storageKey: stored.key, width: stored.width, height: stored.height,
    caption: parent.caption ? `${parent.caption} (variation)` : 'A variation',
    source: 'generated', status: 'draft', visibility: 'private',
    details: detailsFor(parent.details, req, added), generation, links: tagsFor(parent.links, added),
    parentAssetId: parent.id, by,
  });
  // What it was made from, structured (phase 4): the parent, and any portraits used.
  const used = added ? added.portraitUrls.slice(0, portraits.length) : [];
  await media.addSources(db, created.asset.id, [
    { role: 'parent', source_asset_id: parent.id },
    ...(await portraitSources(db, added?.id, used)),
  ], { by });
  return { asset: created.asset, parent_id: parent.id, review };
}

/** Portrait references as source rows: the library picture when the portrait is in it, else its address. */
async function portraitSources(db, characterId, urls) {
  if (!characterId || !urls?.length) return [];
  const inLibrary = await require('./mediaLibrary').assetsByUrl(db, urls);
  return urls.map((url) => {
    const a = inLibrary.get(url);
    return a ? { role: 'portrait', source_asset_id: a.id, character_id: characterId } : { role: 'portrait', source_url: url, character_id: characterId };
  });
}

/** The original at the top of this picture's family, and every variation under it. */
async function familyOf(db, assetId, { audience = 'admin' } = {}) {
  const media = require('./mediaLibrary');
  const start = await media.getAsset(db, assetId, { audience });
  const [[top]] = await db.sequelize.query(
    `WITH RECURSIVE up AS (
       SELECT id, parent_asset_id, 0 AS depth FROM media_assets WHERE id = :id
       UNION ALL
       SELECT ma.id, ma.parent_asset_id, up.depth + 1 FROM media_assets ma JOIN up ON ma.id = up.parent_asset_id WHERE up.depth < 20
     ) SELECT id FROM up ORDER BY depth DESC LIMIT 1`, { replacements: { id: start.id } });
  const [rows] = await db.sequelize.query(
    `WITH RECURSIVE down AS (
       SELECT id, 0 AS depth FROM media_assets WHERE id = :top
       UNION ALL
       SELECT ma.id, down.depth + 1 FROM media_assets ma JOIN down ON ma.parent_asset_id = down.id WHERE down.depth < 20
     ) SELECT ma.*, down.depth FROM down JOIN media_assets ma ON ma.id = down.id
       WHERE ${media.visibilityWhere(audience)} ORDER BY down.depth ASC, ma.created_at ASC LIMIT 100`,
    { replacements: { top: top.id } });
  return { root_id: top.id, items: rows };
}

module.exports = {
  KINDS, LOCKS, MODEL, normalizeRequest, buildPrompt, reviewFor, detailsFor, tagsFor, createVariation, familyOf,
  // Phase 4 (services/pictureSuggestions) makes new pictures through the same path.
  editImage, imageBytes, addedCharacter, portraitSources,
};
