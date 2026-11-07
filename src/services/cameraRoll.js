'use strict';

/**
 * A character's camera roll (Evoni, 2026-10-19: "every character in
 * LalaWorld should have an official headshot, but their other photos should
 * look like moments from an actual life … photographs should have a purpose.
 * Give each character a believable camera roll"; migration
 * 20261019220000-camera-roll, table camera_roll_moments).
 *
 *   rollFor(db, characterId, { audience })   the headshot, the moments, the
 *       made photos and the album counts. An ADMIN sees every moment and
 *       photo; anyone else only the approved photos that are not private.
 *   setHeadshot(db, characterId, { assetId | url, by })   the one official
 *       headshot (a media_asset_links row, role 'headshot'). The old one stays
 *       tagged as a picture of them; it is only no longer the headshot.
 *   plan(db, characterId, { count, idea, by })   one Claude call
 *       (claude-sonnet-4-6, the two-attempt loop; logged and budget-gated by
 *       aiCostTracker) proposes moments from their life; nothing is made.
 *   updateMoment / keep / drop
 *   make(db, momentId, { by })   one image call through the image budget
 *       (imageCostService.runImageCall, via mediaVariations.editImage): a
 *       photo with their face, or anyone else's, is made from their official
 *       headshot as the reference, so they look like themselves; one with no
 *       face is made from the words alone. Stored like other studio images
 *       (pulseImageService) and saved in the library: approved, public when
 *       the moment was posted, private otherwise.
 *   makeKept(db, characterId, { by })   every kept moment, one by one,
 *       stopping at a budget refusal; reports made, failed (nothing sent),
 *       uncertain (needs a check) and skipped, one outcome per photo.
 *
 * The rules: a photo has a reason (purpose) and whoever would plausibly take
 * it (taken_by); at most a third show their face; a photographer only for
 * work and events; the outfit follows the purpose (at home in private, going
 * out to be seen). How many: Lala 24, the main show's cast 12, anyone else 6.
 *
 * Who: LalaWorld characters only. Never a confidential professional (Dr.
 * Amara Sinclair), never the JustAWoman record, never a Before Lala
 * character.
 */

const crypto = require('crypto');
const { isConfidential } = require('../utils/confidentialCharacters');

const MODELS = ['claude-sonnet-4-6'];
const ROUTE = 'camera-roll';
// A phone's camera roll is portrait (Evoni, 2026-10-19: it costs the same as landscape).
const PHONE_SIZE = { width: 1024, height: 1536 };
const STATUSES = Object.freeze(['proposed', 'kept', 'dropped', 'made', 'failed', 'making', 'uncertain']);
// A Make claims a photo from one of these (migration 20261107150000).
const MAKEABLE = Object.freeze(['proposed', 'kept', 'failed']);
// A 'making' claim older than this was interrupted; it is reconciled, never re-run.
const MAKE_STALE_MINUTES = 15;
// A one-time authorization to make an uncertain photo again expires after this.
const AUTHORIZATION_HOURS = 24;
const PURPOSES = Object.freeze(['posted', 'private', 'sent', 'work', 'memory', 'screenshot']);
const TAKERS = Object.freeze(['selfie', 'mirror', 'friend', 'timer', 'photographer']);
const OUTFITS = Object.freeze(['at_home', 'going_out', 'work', 'event', 'none']);
const ALBUMS = Object.freeze(['everyday', 'work', 'travel', 'events', 'social', 'fashion', 'objects']);
const ALBUM_LABELS = Object.freeze({
  everyday: 'Everyday Life', work: 'Work & Projects', travel: 'Travel & Places', events: 'Events',
  social: 'Social', fashion: 'Fashion & Wardrobe', objects: 'Objects & Details',
});
const TARGETS = Object.freeze({ lala: 24, main: 12, other: 6 });
const IDEA_MAX = 200;
const IMAGE_MODEL = 'gpt-image-1.5';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EDITABLE = Object.freeze(['proposed', 'kept', 'failed']);

class CameraRollError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

let client = null;
function getClient() {
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

const text = (v, n) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim().slice(0, n));
const nameOf = (c) => c?.selected_name || c?.display_name || 'this person';
const oneOf = (list, v, fallback) => (list.includes(v) ? v : fallback);

// ── Who has a camera roll ──────────────────────────────────────────────────

function worldOfRegistry(registry) {
  return /book\s*1|before lala/i.test(registry?.book_tag || '') ? 'book-1' : 'lalaverse';
}

/** Why this character has no camera roll, or null when they may have one. */
async function refusalFor(db, character, registry) {
  if (isConfidential(character)) return { status: 403, reason: `${nameOf(character)} is a confidential professional, so no photos are made of them.` };
  if (String(character.character_key || '').toLowerCase() === 'justawoman') {
    return { status: 403, reason: 'JustAWoman is not part of LalaWorld\'s camera rolls.' };
  }
  if (character.feed_profile_id) {
    const [[p]] = await db.sequelize.query('SELECT is_justawoman_record FROM social_profiles WHERE id = :id', { replacements: { id: character.feed_profile_id } });
    if (p?.is_justawoman_record) return { status: 403, reason: 'JustAWoman is not part of LalaWorld\'s camera rolls.' };
  }
  const world = character.world || worldOfRegistry(registry);
  if (world !== 'lalaverse') return { status: 409, reason: `${nameOf(character)} is not a LalaWorld character; camera rolls are for LalaWorld characters only.` };
  return null;
}

async function load(db, characterId) {
  if (!UUID_RE.test(String(characterId))) throw new CameraRollError(404, 'Character not found.');
  const character = await db.RegistryCharacter.findByPk(characterId);
  if (!character) throw new CameraRollError(404, 'Character not found.');
  const registry = character.registry_id ? await db.CharacterRegistry.findByPk(character.registry_id) : null;
  return { character, registry };
}

async function eligible(db, characterId) {
  const loaded = await load(db, characterId);
  const refused = await refusalFor(db, loaded.character, loaded.registry);
  if (refused) throw new CameraRollError(refused.status, refused.reason);
  return loaded;
}

/** How many photos their camera roll holds: Lala 24, the main show's cast 12, anyone else 6. */
async function targetFor(db, character, registry) {
  if (String(character.character_key || '').toLowerCase() === 'lala') return TARGETS.lala;
  const main = await require('../utils/mainShow').mainShowId(db.sequelize);
  return main && registry?.show_id && String(registry.show_id) === String(main) ? TARGETS.main : TARGETS.other;
}

// ── The official headshot ──────────────────────────────────────────────────

async function headshotOf(db, characterId) {
  const [[row]] = await db.sequelize.query(
    `SELECT ma.id AS asset_id, ma.url FROM media_asset_links l JOIN media_assets ma ON ma.id = l.asset_id AND ma.deleted_at IS NULL
      WHERE l.entity_type = 'character' AND l.entity_id = :id AND l.role = 'headshot' AND l.deleted_at IS NULL LIMIT 1`,
    { replacements: { id: String(characterId) } });
  return row || null;
}

/** A portrait they already have that could be their headshot (shown, never written). */
function headshotSuggestion(character) {
  const appearance = character.appearance && typeof character.appearance === 'object' ? character.appearance : {};
  const made = Array.isArray(appearance.portraits) ? appearance.portraits.find((p) => p && p.url) : null;
  const url = character.portrait_url || made?.url || null;
  return url ? { url } : null;
}

async function setHeadshot(db, characterId, { assetId = null, url = null, by = null } = {}) {
  const { character } = await eligible(db, characterId);
  const media = require('./mediaLibrary');
  let asset;
  if (assetId) {
    asset = await media.getAsset(db, assetId);
  } else if (url) {
    asset = (await media.createAsset(db, { url, source: 'portrait', status: 'approved', visibility: 'internal', caption: `${nameOf(character)}'s official headshot`, by })).asset;
  } else {
    throw new CameraRollError(400, 'Choose a picture for the headshot (asset_id or url).');
  }
  if (asset.status === 'archived') throw new CameraRollError(409, 'An archived picture cannot be the headshot.');
  const id = String(character.id);
  await db.sequelize.transaction(async (transaction) => {
    // The old headshot stays a picture of them; it is only no longer the official one.
    await db.sequelize.query(
      `UPDATE media_asset_links SET role = 'pictured', updated_at = NOW()
        WHERE entity_type = 'character' AND entity_id = :id AND role = 'headshot' AND deleted_at IS NULL`,
      { replacements: { id }, transaction });
    const [, meta] = await db.sequelize.query(
      `UPDATE media_asset_links SET role = 'headshot', updated_at = NOW()
        WHERE asset_id = :asset AND entity_type = 'character' AND entity_id = :id AND deleted_at IS NULL`,
      { replacements: { id, asset: asset.id }, transaction });
    if (!meta?.rowCount) {
      await db.sequelize.query(
        `INSERT INTO media_asset_links (asset_id, entity_type, entity_id, role, created_by)
         VALUES (:asset, 'character', :id, 'headshot', :by)`,
        { replacements: { id, asset: asset.id, by }, transaction });
    }
    // The official headshot is seen by everyone signed in: approved, and not private.
    await db.sequelize.query(
      `UPDATE media_assets SET status = 'approved', visibility = CASE WHEN visibility = 'private' THEN 'internal' ELSE visibility END, updated_at = NOW()
        WHERE id = :asset`, { replacements: { asset: asset.id }, transaction });
  });
  return headshotOf(db, id);
}

// ── Moments: the rules ─────────────────────────────────────────────────────

const PHOTOGRAPHER_OK = (m) => m.purpose === 'work' || m.album === 'work' || m.album === 'events';

/** One moment as the rules allow it: known values, short text, a photographer only for work and events. */
function normalizeMoment(raw = {}) {
  const purpose = oneOf(PURPOSES, raw.purpose, 'private');
  const album = oneOf(ALBUMS, raw.album, purpose === 'work' ? 'work' : 'everyday');
  const m = {
    moment: text(raw.moment, 300),
    purpose,
    album,
    taken_by: oneOf(TAKERS, raw.taken_by, 'friend'),
    shows_face: raw.shows_face === true || raw.shows_face === 'true',
    outfit: oneOf(OUTFITS, raw.outfit, null),
    place_text: text(raw.place_text ?? raw.place, 200) || null,
    story_date: typeof raw.story_date === 'string' && DATE_RE.test(raw.story_date) && !Number.isNaN(Date.parse(raw.story_date)) ? raw.story_date : null,
  };
  if (m.taken_by === 'photographer' && !PHOTOGRAPHER_OK(m)) m.taken_by = 'friend';
  if (purpose === 'screenshot') m.shows_face = false;
  if (!m.outfit) {
    m.outfit = purpose === 'work' || album === 'work' ? 'work'
      : album === 'events' ? 'event'
        : purpose === 'posted' || album === 'social' || album === 'fashion' ? 'going_out'
          : album === 'objects' || purpose === 'screenshot' ? 'none' : 'at_home';
  }
  return m;
}

/**
 * A whole plan as the rules allow it: empty moments dropped, no more than
 * `limit`, and at most a third showing a face (the rest keep their moment
 * with the face out of frame; a selfie without a face becomes a friend's shot).
 */
function normalizePlan(list, limit) {
  const out = (Array.isArray(list) ? list : []).map(normalizeMoment).filter((m) => m.moment).slice(0, Math.max(0, limit));
  const maxFaces = Math.floor(out.length / 3);
  let faces = 0;
  for (const m of out) {
    if (!m.shows_face) continue;
    faces += 1;
    if (faces > maxFaces) {
      m.shows_face = false;
      if (m.taken_by === 'selfie' || m.taken_by === 'mirror') m.taken_by = 'friend';
    }
  }
  return out;
}

// ── Planning ───────────────────────────────────────────────────────────────

async function contextFor(db, character) {
  const { appearanceLines } = require('./characterAppearance');
  let places = [];
  try {
    places = (await require('./characterPlaceShare').placesForCharacter(db.sequelize, character.id)).places || [];
  } catch (err) {
    console.error('[cameraRoll] their places could not be read; planning without them:', err.message);
  }
  let profile = null;
  let events = [];
  if (character.feed_profile_id) {
    const [[p]] = await db.sequelize.query(
      'SELECT id, handle, city, public_persona, content_persona, vibe_sentence FROM social_profiles WHERE id = :id AND deleted_at IS NULL',
      { replacements: { id: character.feed_profile_id } });
    profile = p || null;
    if (profile) {
      try {
        events = await require('./characterEvents').eventsForProfile(db.sequelize, profile.id);
      } catch (err) {
        console.error('[cameraRoll] their events could not be read; planning without them:', err.message);
      }
    }
  }
  return { look: appearanceLines(character.appearance), places: places.slice(0, 8), profile, events: events.slice(0, 8) };
}

const placeName = (p) => text(p.label || p.scene_set_name, 80);

function promptFor(character, ctx, { count, idea, existing }) {
  const a = character.appearance && typeof character.appearance === 'object' ? character.appearance : {};
  const job = character.career_status || character.role_label || (Array.isArray(character.job_options) ? character.job_options[0] : null);
  const about = [
    `Name: ${nameOf(character)}`,
    job && `Work: ${text(job, 120)}`,
    character.age && `Age: ${character.age}`,
    (character.current_city || ctx.profile?.city) && `City: ${character.current_city || ctx.profile?.city}`,
    character.description && `Who they are: ${text(character.description, 500)}`,
    character.personality && `Personality: ${text(character.personality, 300)}`,
    ctx.profile?.public_persona && `On The Pulse: ${text(ctx.profile.public_persona, 200)}`,
    character.private_reality && `In private: ${text(character.private_reality, 200)}`,
  ].filter(Boolean).join('\n');
  const places = ctx.places.length
    ? ctx.places.map((p, i) => `${i + 1}. ${placeName(p)}${p.role ? ` (${p.role})` : ''}`).join('\n')
    : '(none saved)';
  const events = ctx.events.length
    ? ctx.events.map((e, i) => `${i + 1}. ${e.role === 'host' ? 'Hosts' : 'Guest at'} "${text(e.name, 80)}"${e.event_date ? ` on ${String(e.event_date).slice(0, 10)}` : ''}${e.episode_number != null ? ` (Episode ${e.episode_number})` : ''}`).join('\n')
    : '(none)';
  return `You are planning the camera roll of a character in LalaWorld, the world of the show Styling Adventures with Lala. These are the photos on their own phone: moments from an actual life, not a photoshoot. Every photo has a reason to exist.

WHO THEY ARE
${about}

HOW THEY LOOK
${ctx.look || '(not written yet)'}
At home they wear: ${a.at_home || '(not written)'}. Going out: ${a.going_out || '(not written)'}. They would never wear: ${a.never_wears || '(not written)'}.

THEIR SAVED PLACES
${places}

EVENTS THEY ARE IN
${events}
${existing.length ? `\nALREADY IN THEIR CAMERA ROLL (do not repeat)\n${existing.map((m) => `- ${m}`).join('\n')}\n` : ''}${idea ? `\nEVONI'S IDEA FOR THESE: ${idea}\n` : ''}
Plan ${count} photos. Rules:
- Each is one specific moment from their routine, work, places, friends and the events above. Vary the times of day and the days.
- purpose (why the photo exists): posted (they put it on The Pulse), private (kept for themselves), sent (sent to a friend), work (proof of work), memory, screenshot.
- taken_by: selfie, mirror, friend, timer, or photographer (only for work or an event).
- shows_face: true for at most a third of them. The rest are hands, food, a view, an object, their back, a page of notes.
- outfit: at_home for private moments, going_out when they mean to be seen, work, event, or none when they are not in it.
- album: everyday, work, travel, events, social, fashion or objects.
- place: one of their saved places by name when it fits, else a plain description in their city.
- event: the number of the event above when the photo is from it, else null.
- people: names of anyone else in the photo (usually nobody).
- story_date: YYYY-MM-DD when it is from a dated event, else null.

Answer with JSON only: {"moments":[{"moment":"","purpose":"","taken_by":"","shows_face":false,"outfit":"","album":"","place":"","event":null,"people":[],"story_date":null}]}`;
}

function parseMoments(raw) {
  const t = String(raw || '').trim();
  try {
    const parsed = JSON.parse((t.match(/\{[\s\S]*\}/) || [t])[0]);
    return Array.isArray(parsed?.moments) ? parsed.moments : [];
  } catch (err) {
    console.error('[cameraRoll] the plan could not be read:', err.message);
    return [];
  }
}

/** The people named in a moment: a registry character of the same registry when one matches, never a confidential one. */
async function peopleFor(db, character, names) {
  const list = (Array.isArray(names) ? names : []).map((n) => text(typeof n === 'string' ? n : n?.name, 80)).filter(Boolean).slice(0, 4);
  if (!list.length) return [];
  const rows = await db.RegistryCharacter.findAll({ where: { registry_id: character.registry_id }, limit: 300 });
  const out = [];
  for (const name of list) {
    const lower = name.toLowerCase();
    const hit = rows.find((r) => [r.selected_name, r.display_name].filter(Boolean).some((n) => n.toLowerCase() === lower));
    if (hit && (isConfidential(hit) || String(hit.character_key).toLowerCase() === 'justawoman')) continue;
    if (hit && String(hit.id) === String(character.id)) continue;
    out.push(hit ? { character_id: hit.id, name: nameOf(hit) } : { name });
  }
  return out;
}

async function liveMoments(db, characterId, { planned = false } = {}) {
  return db.CameraRollMoment.findAll({
    // planned: only the roll's own moments; a photo made for a Pulse post
    // (post_id, services/postPictures) is in the roll but not in its number.
    where: { character_id: characterId, status: ['proposed', 'kept', 'made', 'failed', 'making', 'uncertain'], ...(planned ? { post_id: null } : {}) },
    order: [['created_at', 'ASC']],
  });
}

async function plan(db, characterId, { count = null, idea = '', by = null } = {}) {
  const { character, registry } = await eligible(db, characterId);
  const target = await targetFor(db, character, registry);
  const existing = await liveMoments(db, character.id);
  const room = target - existing.filter((m) => !m.post_id).length;
  if (room <= 0) throw new CameraRollError(409, `Their camera roll already has ${existing.length} of ${target} photos planned. Drop some to plan more.`);
  const n = Math.max(1, Math.min(room, Number(count) > 0 ? Math.floor(Number(count)) : room));
  const ctx = await contextFor(db, character);
  const prompt = promptFor(character, ctx, { count: n, idea: text(idea, IDEA_MAX), existing: existing.map((m) => m.moment).slice(0, 30) });

  let message;
  for (const model of MODELS) {
    try {
      message = await getClient().messages.create({ model, max_tokens: 250 * n + 400, messages: [{ role: 'user', content: prompt }] });
      break;
    } catch (modelErr) {
      console.warn(`[cameraRoll] planning with ${model} failed:`, modelErr.message);
      if (modelErr.code === 'AI_BUDGET_EXCEEDED' || model === MODELS[MODELS.length - 1]) throw modelErr;
    }
  }
  const rawList = parseMoments(message?.content?.[0]?.text);
  const shaped = normalizePlan(rawList, n);
  if (!shaped.length) throw new CameraRollError(502, 'The AI answered with nothing usable. Nothing was saved; try again.');

  const rows = [];
  for (let i = 0; i < shaped.length; i += 1) {
    const m = shaped[i];
    const raw = rawList.filter((r) => text(r?.moment, 300))[i] || {};
    const place = m.place_text ? ctx.places.find((p) => placeName(p).toLowerCase() === m.place_text.toLowerCase()) || null : null;
    const evIndex = Number(raw.event);
    const event = Number.isInteger(evIndex) && evIndex >= 1 && evIndex <= ctx.events.length ? ctx.events[evIndex - 1] : null;
    if (event && m.album === 'everyday') m.album = 'events';
    rows.push(await db.CameraRollMoment.create({
      character_id: character.id, status: 'proposed', ...m,
      place_ref: place?.scene_set_id ? { type: 'scene_set', id: place.scene_set_id } : null,
      event_id: event?.id || null, episode_id: event?.episode_id || null,
      story_date: m.story_date || (event?.event_date ? String(event.event_date).slice(0, 10) : null),
      people: await peopleFor(db, character, raw.people), created_by: by,
    }));
  }
  return rows.map((r) => momentOut(r));
}

// ── Editing ────────────────────────────────────────────────────────────────

async function momentWithCharacter(db, momentId) {
  if (!UUID_RE.test(String(momentId))) throw new CameraRollError(404, 'That photo was not found.');
  const moment = await db.CameraRollMoment.findByPk(momentId);
  if (!moment) throw new CameraRollError(404, 'That photo was not found.');
  await eligible(db, moment.character_id);
  return moment;
}

/** Fields while it is proposed, kept or failed; once made only its purpose and album, which also set who may see the photo. */
async function updateMoment(db, momentId, fields = {}) {
  const moment = await momentWithCharacter(db, momentId);
  if (moment.status === 'dropped') throw new CameraRollError(409, 'That photo was dropped; keep it again first.');
  refuseWhileMakingOrUncertain(moment);
  const made = moment.status === 'made';
  const allowed = made ? ['purpose', 'album'] : ['moment', 'purpose', 'taken_by', 'shows_face', 'outfit', 'album', 'place_text', 'story_date'];
  const given = Object.keys(fields).filter((k) => allowed.includes(k));
  if (!given.length) throw new CameraRollError(400, made ? 'A made photo can change only its purpose and album.' : 'Nothing to change.');
  const base = momentOut(moment);
  // A new purpose or album sets the outfit again, unless an outfit is given too.
  if (!given.includes('outfit') && (given.includes('purpose') || given.includes('album'))) delete base.outfit;
  const merged = normalizeMoment({ ...base, ...Object.fromEntries(given.map((k) => [k, fields[k]])) });
  if (!merged.moment) throw new CameraRollError(400, 'Say what the moment is.');
  const patch = {};
  for (const k of given) patch[k] = merged[k];
  if (!made && !given.includes('outfit') && (given.includes('purpose') || given.includes('album'))) patch.outfit = merged.outfit;
  if (!made && given.includes('taken_by')) patch.taken_by = merged.taken_by;
  await writeIfUnchanged(db, moment, patch);
  if (made && moment.asset_id) await syncPhoto(db, moment);
  return momentOut(moment);
}

// An ordinary edit or status change writes only while the photo still has
// the status it was read with: a Make that claimed it meanwhile ('making'),
// or a result that made it 'uncertain' or 'made', is never overwritten (#3714).
async function writeIfUnchanged(db, moment, patch) {
  const [count] = await db.CameraRollMoment.update(patch, { where: { id: moment.id, status: moment.status } });
  if (!count) {
    throw Object.assign(new CameraRollError(409, 'That photo changed while it was being changed (it may be being made); look again.'), { code: 'PHOTO_CHANGED' });
  }
  await moment.reload();
}

/** A made photo follows its moment: public only when posted, and its camera-roll record. */
async function syncPhoto(db, moment) {
  await db.sequelize.query(
    `UPDATE media_assets SET visibility = :visibility,
            generation = jsonb_set(COALESCE(generation, '{}'::jsonb), '{camera_roll}', CAST(:roll AS JSONB)), updated_at = NOW()
      WHERE id = :id AND deleted_at IS NULL`,
    { replacements: { id: moment.asset_id, visibility: moment.purpose === 'posted' ? 'public' : 'private', roll: JSON.stringify(rollRecord(moment)) } });
}

async function setStatus(db, momentId, status) {
  const moment = await momentWithCharacter(db, momentId);
  if (moment.status === 'made') throw new CameraRollError(409, 'That photo is already made; remove the picture from the library instead.');
  refuseWhileMakingOrUncertain(moment);
  if (status === 'kept' && moment.status === 'dropped' && moment.make_resolution?.abandoned) {
    // Abandoned after an uncertain paid result: keeping it again would let
    // make-kept pay for it again without an authorization.
    throw Object.assign(new CameraRollError(409, 'This photo was abandoned after an uncertain paid result; plan a new photo instead.'), { code: 'PHOTO_ABANDONED' });
  }
  if (status === 'kept' && moment.status === 'dropped') {
    const { character, registry } = await load(db, moment.character_id);
    const live = await liveMoments(db, moment.character_id, { planned: true });
    const target = await targetFor(db, character, registry);
    if (live.length >= target) throw new CameraRollError(409, `Their camera roll already has ${target} photos planned.`);
  }
  await writeIfUnchanged(db, moment, { status, error: status === 'kept' ? null : moment.error });
  return momentOut(moment);
}

const keep = (db, id) => setStatus(db, id, 'kept');
const drop = (db, id) => setStatus(db, id, 'dropped');

// ── Making a photo ─────────────────────────────────────────────────────────

const TAKER_LOOK = Object.freeze({
  selfie: 'a selfie taken at arm\'s length on their own phone, slightly wide-angle, a little off-centre',
  mirror: 'a mirror selfie on their phone, the phone visible in their hand, outfit showing',
  friend: 'taken by a friend on a phone, casual framing, slightly off-centre, caught in the moment',
  timer: 'taken on a phone propped up on a timer, a little stiff, natural',
  photographer: 'taken by a working photographer at the event or job, still natural and unposed',
});

function rollRecord(m) {
  return { moment_id: m.id, purpose: m.purpose, taken_by: m.taken_by, album: m.album, story_date: m.story_date || null };
}

// The storage key of one attempt's photo: the photo and the claim, so it is
// found by its photo even if no library record was written (#3714 recovery).
function photoStorageKey(characterId, momentId, claimToken) {
  return `characters/${characterId}/camera-roll/${momentId}/${claimToken}.jpg`;
}

/** The image prompt: a candid phone photo of this moment, never a studio portrait. */
function photoPrompt(character, m, { look = '', referenced = false, wearing: outfitText = null } = {}) {
  const a = character.appearance && typeof character.appearance === 'object' ? character.appearance : {};
  // outfitText: what they wore that day when the story knows it (Lala's episode wardrobe, services/postPictures).
  const wearing = outfitText || { at_home: a.at_home, going_out: a.going_out || a.signature_style, work: a.signature_style, event: a.going_out || a.signature_style }[m.outfit];
  const others = (Array.isArray(m.people) ? m.people : []).map((p) => p?.name).filter(Boolean);
  const inFrame = m.shows_face
    ? `${nameOf(character)} is in the photo${referenced ? ', the same person as in the first reference image (keep their face exactly)' : ''}.`
    : 'Their face is not in the frame: show hands, the back of their head, what they are holding or looking at, or no person at all.';
  return [
    `A candid phone photo from the camera roll of ${nameOf(character)}, an original fictional person (not resembling any real person or celebrity).`,
    `The moment: ${m.moment}.`,
    m.place_text && `Where: ${m.place_text}.`,
    inFrame,
    others.length && `Also in it: ${others.join(', ')}${referenced ? ' (as in the other reference images)' : ''}.`,
    m.shows_face && look && `How they look: ${look.replace(/\n/g, '; ')}.`,
    wearing && m.outfit !== 'none' && `Wearing: ${wearing}.`,
    `${TAKER_LOOK[m.taken_by] || TAKER_LOOK.friend}.`,
    'Natural available light, real everyday surroundings, ordinary phone-camera quality, not a studio, not a photoshoot, no posed portrait.',
    'No text, no letters, no logos, no brand names, no watermark.',
  ].filter(Boolean).join(' ');
}

class PhotoOutcomeError extends CameraRollError {
  constructor(status, message) { super(status, message); this.code = 'PHOTO_OUTCOME_UNKNOWN'; }
}

function refuseWhileMakingOrUncertain(moment) {
  if (moment.status === 'making') throw Object.assign(new CameraRollError(409, 'That photo is being made right now.'), { code: 'PHOTO_BEING_MADE' });
  if (moment.status === 'uncertain') {
    throw new PhotoOutcomeError(409, 'That photo may already have been made and charged (a paid image request was sent and the run then failed). Check the library, then acknowledge, authorize one new attempt, or abandon it.');
  }
}

/**
 * A 'making' claim past MAKE_STALE_MINUTES was interrupted (a restart, a
 * timeout). Never re-run: with no attempt marker nothing was sent, so its
 * previous status comes back; with one, the request may have been accepted,
 * so it is 'uncertain'. Returns the reconciled status, or null.
 */
async function reconcileStale(db, momentId) {
  const [rows] = await db.sequelize.query(
    `UPDATE camera_roll_moments SET
        status = CASE WHEN make_attempted_at IS NULL THEN make_previous_status ELSE 'uncertain' END,
        error = CASE WHEN make_attempted_at IS NULL
          THEN 'An earlier make was interrupted before its image request; nothing was sent.'
          ELSE 'An earlier make was interrupted after its image request may have been sent; the photo may already have been made and charged.' END,
        make_claim_token = NULL, make_claimed_at = NULL,
        make_previous_status = CASE WHEN make_attempted_at IS NULL THEN NULL ELSE make_previous_status END,
        updated_at = NOW()
      WHERE id = :id AND status = 'making' AND make_claimed_at < NOW() - (:stale * INTERVAL '1 minute')
      RETURNING status`,
    { replacements: { id: momentId, stale: MAKE_STALE_MINUTES } });
  return rows.length ? rows[0].status : null;
}

/**
 * Claim the photo for one Make: one conditional UPDATE, so two Makes never
 * both claim it. From 'proposed', 'kept' or 'failed'; from 'uncertain' only
 * with an unused, unexpired one-time authorization (resolve 'authorize'),
 * which the claim consumes. Returns the claim token, or null.
 */
async function claimForMake(db, momentId, { authorizationId = null } = {}) {
  const token = crypto.randomUUID();
  const sql = authorizationId
    ? `UPDATE camera_roll_moments SET status = 'making', make_claim_token = :token, make_claimed_at = NOW(),
          make_previous_status = status, make_attempted_at = NULL,
          make_resolution = jsonb_set(make_resolution, '{authorization,used_at}', to_jsonb(NOW()::text)),
          updated_at = NOW()
        WHERE id = :id AND deleted_at IS NULL AND status = 'uncertain'
          AND make_resolution->'authorization'->>'id' = :auth
          AND make_resolution->'authorization'->>'used_at' IS NULL
          AND (make_resolution->'authorization'->>'expires_at')::timestamptz > NOW()
        RETURNING id`
    : `UPDATE camera_roll_moments SET status = 'making', make_claim_token = :token, make_claimed_at = NOW(),
          make_previous_status = status, make_attempted_at = NULL, updated_at = NOW()
        WHERE id = :id AND deleted_at IS NULL AND status IN (:makeable)
        RETURNING id`;
  const [rows] = await db.sequelize.query(sql, { replacements: { id: momentId, token, auth: authorizationId, makeable: MAKEABLE } });
  return rows.length ? token : null;
}

/** A write of this Make's result, only while it still holds the claim. Returns true when it did. */
async function fencedUpdate(db, momentId, token, set, replacements = {}) {
  const [rows] = await db.sequelize.query(
    `UPDATE camera_roll_moments SET ${set}, updated_at = NOW()
      WHERE id = :id AND make_claim_token = :token AND status = 'making' RETURNING id`,
    { replacements: { ...replacements, id: momentId, token } });
  return rows.length > 0;
}

/**
 * Make the photo: one image call through the image budget. One Make at a
 * time per photo (claimForMake); the attempt marker is committed before the
 * paid request is sent (if that write fails, nothing is sent); every result
 * is written only while this Make holds the claim (fencedUpdate).
 *   - nothing sent (the budget refused it, or a failure before the
 *     request): the photo goes back to its previous status, with the error
 *   - sent, then any failure (a timeout, a blank picture, storing it,
 *     saving it in the library): 'uncertain', which only resolve() moves on
 *   - made: 'made'
 */
async function make(db, momentId, { by = null, routeName = ROUTE, wearing = null, onAttempt = null, authorizationId = null } = {}) {
  let moment = await momentWithCharacter(db, momentId);
  if (moment.status === 'making' && await reconcileStale(db, moment.id)) moment = await db.CameraRollMoment.findByPk(moment.id);
  if (moment.status === 'made') throw new CameraRollError(409, 'That photo is already made.');
  if (moment.status === 'dropped') throw new CameraRollError(409, 'That photo was dropped; keep it first.');
  if (moment.status === 'making') refuseWhileMakingOrUncertain(moment);
  if (moment.status === 'uncertain' && !authorizationId) refuseWhileMakingOrUncertain(moment);
  const { character } = await load(db, moment.character_id);
  const others = (moment.people || []).filter((p) => p && p.character_id);
  const needsFace = moment.shows_face || others.length > 0;
  const headshot = await headshotOf(db, character.id);
  if (needsFace && !headshot) {
    throw new CameraRollError(409, `Set ${nameOf(character)}'s official headshot first: every photo with a face in it is made from it.`);
  }

  const variations = require('./mediaVariations');
  const refs = [];
  if (needsFace) {
    try {
      refs.push(await variations.imageBytes(headshot.url));
    } catch (err) {
      console.error(`[cameraRoll] the headshot of ${character.id} could not be read:`, err.message);
      throw new CameraRollError(409, `${nameOf(character)}'s headshot is not stored where the image tool can read it. Set a stored picture as their headshot.`);
    }
    for (const p of others.slice(0, 2)) {
      const theirs = await headshotOf(db, p.character_id);
      if (!theirs) continue;
      try {
        refs.push(await variations.imageBytes(theirs.url));
      } catch (err) {
        console.error(`[cameraRoll] ${p.name}'s headshot could not be read; left out:`, err.message);
      }
    }
  }
  const { appearanceLines, isBlank } = require('./characterAppearance');
  const prompt = photoPrompt(character, moment, { look: appearanceLines(character.appearance), referenced: refs.length > 0, wearing });

  const token = await claimForMake(db, moment.id, { authorizationId });
  if (!token) {
    const now = await db.CameraRollMoment.findByPk(moment.id);
    if (authorizationId && now?.status === 'uncertain') {
      throw Object.assign(new CameraRollError(409, 'That authorization is not valid any more (used, replaced, revoked or expired). Authorize one new attempt again.'), { code: 'AUTHORIZATION_INVALID' });
    }
    if (now && ['making', 'uncertain'].includes(now.status)) refuseWhileMakingOrUncertain(now);
    throw new CameraRollError(409, 'That photo cannot be made from where it stands now.');
  }

  // The durable attempt marker: committed before the request is sent. It
  // runs inside the image budget's call (mediaVariations.editImage
  // onAttempt), so a budget refusal never sets it.
  // Where this attempt's photo will be stored, decided before the request:
  // the key names the photo and this claim, and the attempt is recorded with
  // the marker, so a photo stored before a crash can always be found and
  // attached without making it again (resolve 'attach').
  const storageKey = photoStorageKey(character.id, moment.id, token);
  let marked = false;
  const markAttempt = async () => {
    const ok = await fencedUpdate(db, moment.id, token,
      `make_attempted_at = NOW(),
       make_resolution = jsonb_set(COALESCE(make_resolution, '{}'::jsonb), '{attempts}',
         COALESCE(make_resolution->'attempts', '[]'::jsonb)
           || jsonb_build_array(jsonb_build_object('claim_token', CAST(:token AS TEXT), 'storage_key', CAST(:key AS TEXT), 'at', NOW()::text)))`,
      { key: storageKey });
    if (!ok) throw Object.assign(new CameraRollError(409, 'This make no longer holds the photo; nothing was sent.'), { code: 'CLAIM_LOST' });
    marked = true;
    if (typeof onAttempt === 'function') await onAttempt();
  };

  const restoreOrUncertain = async (err, message) => {
    if (marked) {
      const ok = await fencedUpdate(db, moment.id, token,
        "status = 'uncertain', error = :error, make_claim_token = NULL, make_claimed_at = NULL",
        { error: `A paid image request was sent and the make then failed (${message}); the photo may already have been made and charged.` });
      if (!ok) console.error(`[cameraRoll] photo ${moment.id}: a newer claim holds it; this make's uncertain result was not written.`);
      return new PhotoOutcomeError(502, 'A paid image request was sent and the make then failed; the photo may already have been made and charged. Check the library, then acknowledge, authorize one new attempt, or abandon it.');
    }
    const ok = await fencedUpdate(db, moment.id, token,
      'status = make_previous_status, error = :error, make_claim_token = NULL, make_claimed_at = NULL, make_previous_status = NULL',
      { error: message });
    if (!ok) console.error(`[cameraRoll] photo ${moment.id}: a newer claim holds it; this make's result was not written.`);
    return null;
  };

  let buffer;
  let actual = null;
  try {
    buffer = await variations.editImage(prompt, refs, { routeName, size: PHONE_SIZE, onLogged: (l) => { actual = l.costUsd; }, onAttempt: markAttempt });
  } catch (err) {
    if (err.code === 'CLAIM_LOST') throw err;
    const message = err.code === 'AI_BUDGET_EXCEEDED'
      ? err.message
      : (err.status === 503 ? err.message : 'The image tool could not make this photo; nothing was saved.');
    console.error(`[cameraRoll] making photo ${moment.id} failed:`, err.message);
    const unknown = await restoreOrUncertain(err, message);
    if (unknown) throw unknown;
    if (err.code === 'AI_BUDGET_EXCEEDED') throw err;
    throw new CameraRollError(err.status && err.status < 500 ? err.status : 502, message);
  }

  try {
    if (await isBlank(buffer)) {
      throw new CameraRollError(422, 'The image service blocked this photo (it sends back a black picture when its filter flags one), so nothing was saved.');
    }

    const { storePulseImage } = require('./pulseImageService');
    const stored = await storePulseImage({ buffer, mimetype: 'image/png' }, {
      keyPrefix: `characters/${character.id}/camera-roll`, label: 'The photo', key: storageKey,
      metadata: { 'moment-id': String(moment.id), 'claim-token': String(token), 'character-id': String(character.id) },
    });
    const media = require('./mediaLibrary');
    const links = [{ entity_type: 'character', entity_id: String(character.id), role: moment.shows_face ? 'pictured' : 'owner' }];
    if (moment.place_ref?.type === 'scene_set' && UUID_RE.test(String(moment.place_ref.id))) links.push({ entity_type: 'scene_set', entity_id: String(moment.place_ref.id), role: 'location' });
    if (moment.event_id) links.push({ entity_type: 'event', entity_id: String(moment.event_id), role: 'pictured' });
    if (moment.episode_id) links.push({ entity_type: 'episode', entity_id: String(moment.episode_id), role: 'pictured' });
    for (const p of others) links.push({ entity_type: 'character', entity_id: String(p.character_id), role: 'pictured' });
    const kept = [];
    for (const l of links) {
      try {
        kept.push(media.normalizeLink(l));
      } catch (err) {
        console.error('[cameraRoll] a tag was left off the photo:', err.message);
      }
    }
    const estimate = require('./imageCostService').estimateImageCost({ model: IMAGE_MODEL, ...PHONE_SIZE, quality: 'high', count: 1 });
    let created;
    try {
      created = await media.createAsset(db, {
        url: stored.url, storageKey: stored.key, width: stored.width, height: stored.height,
        caption: moment.moment, source: 'generated', status: 'approved',
        visibility: moment.purpose === 'posted' ? 'public' : 'private',
        details: { notes: `${moment.purpose} · taken by ${moment.taken_by}` },
        generation: {
          camera_roll: { ...rollRecord(moment), claim_token: token, storage_key: stored.key }, prompt, model: IMAGE_MODEL, made_at: new Date().toISOString(), id: crypto.randomUUID(),
          references: refs.length ? [headshot.asset_id, ...others.map((p) => ({ character_id: p.character_id }))].slice(0, refs.length) : [],
        },
        links: kept, by,
      });
    } catch (err) {
      // A tag pointing at something no longer there: keep the photo with the character's own tag.
      if (!(err.status === 404)) throw err;
      console.error('[cameraRoll] a tag was not found; the photo keeps only its character:', err.message);
      created = await media.createAsset(db, {
        url: stored.url, storageKey: stored.key, width: stored.width, height: stored.height,
        caption: moment.moment, source: 'generated', status: 'approved',
        visibility: moment.purpose === 'posted' ? 'public' : 'private',
        details: { notes: `${moment.purpose} · taken by ${moment.taken_by}` },
        generation: { camera_roll: { ...rollRecord(moment), claim_token: token, storage_key: stored.key }, prompt, model: IMAGE_MODEL, made_at: new Date().toISOString(), id: crypto.randomUUID() },
        links: [links[0]], by,
      });
    }
    if (refs.length) {
      await media.addSources(db, created.asset.id, [{ role: 'portrait', source_asset_id: headshot.asset_id, character_id: character.id }], { by });
    }
    // What the call really cost when it was logged, else the estimate.
    const done = await fencedUpdate(db, moment.id, token,
      "status = 'made', asset_id = :asset, prompt = :prompt, error = NULL, cost = :cost, make_claim_token = NULL, make_claimed_at = NULL, make_previous_status = NULL",
      { asset: created.asset.id, prompt, cost: typeof actual === 'number' ? actual : estimate.usd });
    if (!done) {
      throw Object.assign(new CameraRollError(409, `The photo was made (library asset ${created.asset.id}) but this make no longer holds it, so it was not recorded on the photo.`), { code: 'CLAIM_LOST', sent: true, asset_id: created.asset.id });
    }
    moment = await db.CameraRollMoment.findByPk(moment.id);
    return { moment: momentOut(moment, created.asset.url), photo: photoOut(created.asset) };
  } catch (err) {
    if (err.code === 'CLAIM_LOST') throw err;
    console.error(`[cameraRoll] photo ${moment.id} was made but not saved:`, err.message);
    // The request was sent (marked): whatever failed after it, the photo may be made and charged.
    const unknown = await restoreOrUncertain(err, err.message || 'saving the photo failed');
    throw unknown || err;
  }
}

/**
 * Evoni's resolution of an uncertain photo (#3714). None of these sends a
 * paid request, and none returns it to 'kept':
 *   acknowledge  it stays 'uncertain' (seen, not made again); any unused
 *                authorization is revoked
 *   authorize    one new attempt: a one-time authorization (id, who, when,
 *                expires in AUTHORIZATION_HOURS) for exactly one Make that
 *                passes its id; it replaces any unused one. make-kept and
 *                post pictures never pass one
 *   abandon      'dropped', and it cannot be kept again (setStatus)
 *   attach       'made' with an image that already exists (asset_id, or
 *                the storage_key of one of its own attempts); see attach()
 */
async function resolve(db, momentId, { action, by = null, note = null, assetId = null, storageKey = null } = {}) {
  const ACTIONS = ['acknowledge', 'authorize', 'abandon', 'attach'];
  if (!ACTIONS.includes(action)) throw new CameraRollError(400, `Say what to do: ${ACTIONS.join(', ')}.`);
  if (action === 'attach') return attach(db, momentId, { by, note, assetId, storageKey });
  let moment = await momentWithCharacter(db, momentId);
  if (moment.status === 'making' && await reconcileStale(db, moment.id)) moment = await db.CameraRollMoment.findByPk(moment.id);
  if (moment.status !== 'uncertain') throw new CameraRollError(409, 'Only an uncertain photo is resolved this way.');
  const now = new Date();
  const prev = moment.make_resolution || {};
  const entry = { action, by, at: now.toISOString(), note: note ? String(note).slice(0, 300) : null };
  const history = [...(Array.isArray(prev.history) ? prev.history : []), entry];
  let resolution;
  let status = 'uncertain';
  if (action === 'acknowledge') {
    resolution = { ...prev, acknowledged: entry, authorization: null, history };
  } else if (action === 'authorize') {
    const authorization = { id: crypto.randomUUID(), by, at: entry.at, expires_at: new Date(now.getTime() + AUTHORIZATION_HOURS * 3600 * 1000).toISOString(), used_at: null, note: entry.note };
    resolution = { ...prev, authorization, history };
  } else {
    status = 'dropped';
    resolution = { ...prev, abandoned: entry, authorization: null, history };
  }
  // Only while it is still uncertain: a concurrent resolve or make loses cleanly.
  const [rows] = await db.sequelize.query(
    `UPDATE camera_roll_moments SET status = :status, make_resolution = CAST(:resolution AS JSONB), updated_at = NOW()
      WHERE id = :id AND status = 'uncertain' RETURNING id`,
    { replacements: { id: moment.id, status, resolution: JSON.stringify(resolution) } });
  if (!rows.length) throw new CameraRollError(409, 'That photo changed while it was being resolved; look again.');
  moment = await db.CameraRollMoment.findByPk(moment.id);
  return momentOut(moment);
}

// ── Attach: a photo that was already made, found and checked by Evoni ─────
//
// resolve(..., { action: 'attach', assetId | storageKey }) marks an uncertain
// photo made with an image that already exists (#3714 recovery). It never
// calls an image service and never changes or deletes an existing image or
// storage object. What it checks before anything is written:
//   - the photo is uncertain (or already made with this same image: then it
//     answers as before and changes nothing, so repeating Attach is safe);
//   - the image belongs to this photo and to one of its own recorded attempts
//     (make_resolution.attempts, written with the attempt marker): a library
//     record's generation.camera_roll names the photo and that claim, or the
//     storage key is that attempt's key and its stored metadata agree;
//   - no other photo already has the image.
// Evoni looks at the image first: these checks prove whose it is, not what
// it shows.
const ATTACH_CONFLICT = 'ATTACH_CONFLICT';
const conflict = (message) => Object.assign(new CameraRollError(409, message), { code: ATTACH_CONFLICT });

function attemptsOf(moment) {
  const list = moment.make_resolution && Array.isArray(moment.make_resolution.attempts) ? moment.make_resolution.attempts : [];
  return list.filter((a) => a && typeof a.claim_token === 'string' && typeof a.storage_key === 'string');
}

function generationOf(asset) {
  let g = asset.generation;
  if (typeof g === 'string') {
    try { g = JSON.parse(g); } catch (err) {
      console.error('[cameraRoll] an image\'s generation is not JSON:', err.message);
      return {};
    }
  }
  return g && typeof g === 'object' ? g : {};
}

async function assetRow(db, where, replacements) {
  const [rows] = await db.sequelize.query(
    `SELECT id, url, storage_key, generation FROM media_assets WHERE ${where} AND deleted_at IS NULL LIMIT 2`, { replacements });
  return rows;
}

// Checks that an existing library record belongs to this photo and one of
// its attempts, and that no other photo has it.
async function checkClaimOf(db, moment, asset, attempts) {
  const roll = generationOf(asset).camera_roll || {};
  if (String(roll.moment_id || '') !== String(moment.id)) throw conflict('That image was made for a different photo.');
  const attempt = attempts.find((a) => a.claim_token === roll.claim_token);
  if (!attempt) throw conflict('That image is not from one of this photo\'s own attempts.');
  if (asset.storage_key !== attempt.storage_key) throw conflict('That image is not stored where this photo\'s attempt stores it.');
  const [owners] = await db.sequelize.query(
    'SELECT id FROM camera_roll_moments WHERE asset_id = :a AND id <> :m LIMIT 1', { replacements: { a: asset.id, m: moment.id } });
  if (owners.length) throw conflict('Another photo already has that image.');
}

// Checks that the record is tagged to the photo's character.
async function checkTagOf(db, moment, asset) {
  const [links] = await db.sequelize.query(
    `SELECT 1 FROM media_asset_links WHERE asset_id = :a AND entity_type = 'character' AND entity_id = :c AND deleted_at IS NULL LIMIT 1`,
    { replacements: { a: asset.id, c: String(moment.character_id) } });
  if (!links.length) throw conflict('That image is not tagged to this photo\'s character.');
}

async function attach(db, momentId, { by = null, note = null, assetId = null, storageKey = null } = {}) {
  if (Boolean(assetId) === Boolean(storageKey)) throw new CameraRollError(400, 'Attach needs exactly one of asset_id or storage_key.');
  if (assetId && !UUID_RE.test(String(assetId))) throw new CameraRollError(400, 'asset_id is not a valid id.');
  let moment = await momentWithCharacter(db, momentId);
  if (moment.status === 'making' && await reconcileStale(db, moment.id)) moment = await db.CameraRollMoment.findByPk(moment.id);
  const attempts = attemptsOf(moment);

  // The image asked for: an existing library record, or the storage key of one of this photo's attempts.
  let asset = null;
  let attempt = null;
  if (assetId) {
    [asset] = await assetRow(db, 'id = :id', { id: assetId });
    if (!asset) throw new CameraRollError(404, 'That image is not in the library.');
  } else {
    attempt = attempts.find((a) => a.storage_key === storageKey);
    if (!attempt || photoStorageKey(moment.character_id, moment.id, attempt.claim_token) !== storageKey) {
      throw conflict('That storage key is not one of this photo\'s own attempts.');
    }
    const existing = await assetRow(db, 'storage_key = :k', { k: storageKey });
    if (existing.length > 1) throw conflict('More than one library record uses that storage key; look at them first.');
    [asset] = existing;
  }

  // Repeating an Attach that already happened changes nothing.
  if (moment.status === 'made' && asset && String(moment.asset_id) === String(asset.id)) return { ...momentOut(moment), attach: 'already_attached' };
  if (moment.status !== 'uncertain') throw new CameraRollError(409, 'Only an uncertain photo is attached this way.');

  const media = require('./mediaLibrary');
  const tag = { entity_type: 'character', entity_id: String(moment.character_id), role: moment.shows_face ? 'pictured' : 'owner' };
  let object = null;
  if (assetId) {
    await checkClaimOf(db, moment, asset, attempts);
    await checkTagOf(db, moment, asset);
  } else {
    // By storage key: the object itself must say whose it is.
    const { storedImage } = require('./pulseImageService');
    object = await storedImage(storageKey);
    if (!object) throw new CameraRollError(404, 'Nothing is stored under that key.');
    const meta = object.metadata || {};
    if (meta['moment-id'] !== String(moment.id) || meta['claim-token'] !== attempt.claim_token) {
      throw conflict('The stored image does not say it belongs to this photo and attempt.');
    }
  }
  if (storageKey && asset) {
    // A record for this key already exists (an earlier make, or another
    // attach that is still tagging it): its claim decides; then make sure it
    // carries the photo's own character tag (adding a tag never changes the image).
    await checkClaimOf(db, moment, asset, attempts);
    await media.linkAsset(db, asset.id, tag, { by });
  } else if (storageKey) {
    // Stored before a crash, with no library record: record it.
    const created = await media.createAsset(db, {
      url: object.url, storageKey, caption: moment.moment, source: 'generated', status: 'approved',
      visibility: moment.purpose === 'posted' ? 'public' : 'private',
      details: { notes: `${moment.purpose} · taken by ${moment.taken_by}` },
      generation: {
        camera_roll: { ...rollRecord(moment), claim_token: attempt.claim_token, storage_key: storageKey },
        model: IMAGE_MODEL, recovered: { by, at: new Date().toISOString(), from: 'storage' },
      },
      links: [tag], by,
    });
    // created.reused: the url was already in the library (another attach got
    // there first, or an unrelated record): that record's own claim decides.
    [asset] = await assetRow(db, 'id = :id', { id: created.asset.id });
    await checkClaimOf(db, moment, asset, attempts);
  }
  if (storageKey) await checkTagOf(db, moment, asset);

  const now = new Date();
  const prev = moment.make_resolution || {};
  const entry = { action: 'attach', by, at: now.toISOString(), note: note ? String(note).slice(0, 300) : null, asset_id: asset.id };
  const resolution = { ...prev, attached: entry, authorization: null, history: [...(Array.isArray(prev.history) ? prev.history : []), entry] };
  // Only while it is still uncertain and no other photo took the image meanwhile.
  const [rows] = await db.sequelize.query(
    `UPDATE camera_roll_moments SET status = 'made', asset_id = :asset, error = NULL,
            make_resolution = CAST(:resolution AS JSONB), updated_at = NOW()
      WHERE id = :id AND status = 'uncertain'
        AND NOT EXISTS (SELECT 1 FROM camera_roll_moments o WHERE o.asset_id = :asset AND o.id <> :id)
      RETURNING id`,
    { replacements: { id: moment.id, asset: asset.id, resolution: JSON.stringify(resolution) } });
  moment = await db.CameraRollMoment.findByPk(moment.id);
  if (!rows.length) {
    if (moment.status === 'made' && String(moment.asset_id) === String(asset.id)) return { ...momentOut(moment), attach: 'already_attached' };
    throw new CameraRollError(409, 'That photo changed while it was being attached; look again.');
  }
  return { ...momentOut(moment), attach: 'attached' };
}

async function makeKept(db, characterId, { by = null } = {}) {
  await eligible(db, characterId);
  const [kept, before] = await Promise.all([
    db.CameraRollMoment.findAll({ where: { character_id: characterId, status: 'kept' }, order: [['created_at', 'ASC']] }),
    db.CameraRollMoment.findAll({ where: { character_id: characterId, status: ['making', 'uncertain'] }, attributes: ['id', 'status'] }),
  ]);
  // Each photo ends in exactly one of: made; failed (nothing paid was sent,
  // so it can be tried again); uncertain (a paid request was sent and the
  // make then failed, or the photo was made but another make holds it: check
  // it); skipped (another make holds it, or it is not makeable from where it
  // stands; nothing was sent).
  const results = [];
  let stoppedForBudget = false;
  for (const m of kept) {
    try {
      await make(db, m.id, { by });
      results.push({ id: m.id, outcome: 'made' });
    } catch (err) {
      if (err.code === 'AI_BUDGET_EXCEEDED') { stoppedForBudget = true; break; }
      // A face shot with no headshot stops the run: every face shot would fail the same way.
      if (err instanceof CameraRollError && err.status === 409 && /headshot/.test(err.message)) throw err;
      console.error(`[cameraRoll] photo ${m.id} was not made:`, err.message);
      results.push({ id: m.id, outcome: makeKeptOutcome(err), code: err.code || null, message: err.message });
    }
  }
  const count = (o) => results.filter((r) => r.outcome === o).length;
  return {
    made: count('made'),
    failed: count('failed'),
    uncertain: count('uncertain'),
    skipped: count('skipped'),
    stopped_for_budget: stoppedForBudget,
    // Not tried at all: already being made, or already waiting for Evoni's check.
    already_making: before.filter((m) => m.status === 'making').length,
    already_uncertain: before.filter((m) => m.status === 'uncertain').length,
    results,
  };
}

// How makeKept reports one photo's failed make (see make: PhotoOutcomeError
// only when the attempt marker was set; CLAIM_LOST with sent when the photo
// was made but another make now holds it).
function makeKeptOutcome(err) {
  if (err instanceof PhotoOutcomeError) return 'uncertain';
  if (err.code === 'CLAIM_LOST') return err.sent ? 'uncertain' : 'skipped';
  if (['PHOTO_BEING_MADE', 'PHOTO_ABANDONED'].includes(err.code)) return 'skipped';
  if (err instanceof CameraRollError && err.status === 409 && /cannot be made from where it stands/.test(err.message)) return 'skipped';
  return 'failed';
}

// ── Reading ────────────────────────────────────────────────────────────────

function momentOut(m, url = null) {
  const r = typeof m.get === 'function' ? m.get({ plain: true }) : m;
  return {
    id: r.id, status: r.status, moment: r.moment, purpose: r.purpose, taken_by: r.taken_by, shows_face: Boolean(r.shows_face),
    outfit: r.outfit, album: r.album, place_text: r.place_text || null, story_date: r.story_date || null,
    event_id: r.event_id || null, episode_id: r.episode_id || null, people: Array.isArray(r.people) ? r.people : [],
    asset_id: r.asset_id || null, url, error: r.error || null, post_id: r.post_id || null, created_at: r.created_at,
    make_attempted_at: r.make_attempted_at || null, make_claimed_at: r.make_claimed_at || null, make_resolution: r.make_resolution || null,
  };
}

function photoOut(a) {
  let g = a.generation;
  if (typeof g === 'string') {
    try { g = JSON.parse(g); } catch (err) {
      console.error('[cameraRoll] a photo\'s generation is not JSON:', err.message);
      g = {};
    }
  }
  const roll = (g && g.camera_roll) || {};
  return {
    asset_id: a.id, url: a.url, caption: a.caption || null, album: roll.album || 'everyday', purpose: roll.purpose || null,
    taken_by: roll.taken_by || null, story_date: roll.story_date || null, moment_id: roll.moment_id || null, created_at: a.created_at,
  };
}

async function rollFor(db, characterId, { audience = 'member' } = {}) {
  const { character, registry } = await load(db, characterId);
  const refused = await refusalFor(db, character, registry);
  const media = require('./mediaLibrary');
  const base = { character: { id: character.id, name: nameOf(character) } };
  const albumsOf = (photos) => ALBUMS.map((key) => ({ key, label: ALBUM_LABELS[key], count: photos.filter((p) => p.album === key).length }));
  if (refused) {
    return { ...base, eligible: false, reason: refused.reason, target: 0, headshot: null, headshot_suggestion: null, albums: albumsOf([]), moments: [], photos: [] };
  }
  const [assets] = await db.sequelize.query(
    `SELECT ma.* FROM media_asset_links l JOIN media_assets ma ON ma.id = l.asset_id
      WHERE l.entity_type = 'character' AND l.entity_id = :id AND l.deleted_at IS NULL
        AND ma.generation->'camera_roll' IS NOT NULL AND ${media.visibilityWhere(audience)}
      ORDER BY ma.created_at DESC LIMIT 200`, { replacements: { id: String(character.id) } });
  const photos = assets.map(photoOut);
  const urls = new Map(photos.map((p) => [String(p.asset_id), p.url]));
  const moments = audience === 'admin'
    ? (await liveMoments(db, character.id)).map((m) => momentOut(m, m.asset_id ? urls.get(String(m.asset_id)) || null : null))
    : [];
  const headshot = await headshotOf(db, character.id);
  return {
    ...base, eligible: true, target: await targetFor(db, character, registry),
    headshot, headshot_suggestion: headshot ? null : headshotSuggestion(character),
    albums: albumsOf(photos), moments, photos,
  };
}

module.exports = {
  CameraRollError, PhotoOutcomeError, STATUSES, MAKEABLE, MAKE_STALE_MINUTES, AUTHORIZATION_HOURS, PURPOSES, TAKERS, OUTFITS, ALBUMS, ALBUM_LABELS, TARGETS, EDITABLE,
  normalizeMoment, normalizePlan, photoPrompt, promptFor, parseMoments, refusalFor, targetFor,
  rollFor, setHeadshot, headshotOf, plan, updateMoment, keep, drop, make, makeKept, resolve, reconcileStale, claimForMake, photoStorageKey,
  load, nameOf, momentOut, photoOut, IMAGE_MODEL, PHONE_SIZE,
};
