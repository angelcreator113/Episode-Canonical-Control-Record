'use strict';

/**
 * The episode's style sheet (docs/design/2026-10-landing-and-stylesheet.md
 * Part 2, "Style sheet panel" and "Style sheet template"; Task #2814).
 *
 * buildStyleSheet gathers every value the 1024 x 1536 template prints, and
 * only from canon: the episode, its event (Event Package), the event's
 * venue, the saved look (episodeLook: locked, else chosen, else the event's
 * outfit) and the Lookbook. A value the canon does not hold is null, never
 * invented; an empty required wardrobe slot is flagged "needed".
 *
 * Images come back as downscaled data URLs so the browser can read their
 * pixels (palette) and draw the PNG without S3's CORS getting in the way.
 * The server fetches only URLs already stored on this episode's own rows
 * (Lookbook photos, its event's scene set, its look's pieces), never one a
 * caller supplies. No AI, no image generation, no cost.
 */

const crypto = require('crypto');
const { LookbookError, getLookbook } = require('./episodeLookbookService');

const MAX_SIDE = 900;
const FETCH_TIMEOUT_MS = 15000;
const MAX_BYTES = 15 * 1024 * 1024;

// The seven WARDROBE BREAKDOWN columns, in the template's order.
const COLUMNS = Object.freeze([
  { key: 'body', label: 'BODY' },
  { key: 'shoes', label: 'SHOES' },
  { key: 'bag', label: 'BAG' },
  { key: 'jewelry', label: 'JEWELRY' },
  { key: 'hair', label: 'HAIR' },
  { key: 'perfume', label: 'PERFUME' },
  { key: 'nails', label: 'NAILS' },
]);
// A required closet slot → the column that shows "Needed" when it is empty.
const SLOT_COLUMN = Object.freeze({ outfit: 'body', shoes: 'shoes', jewelry: 'jewelry', fragrance: 'perfume', accessories: 'bag' });

const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const parseJson = (v, fallback) => {
  if (v == null) return fallback;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch (err) {
    console.error('[StyleSheet] unreadable JSON field:', err.message);
    return fallback;
  }
};

// ── Images ──

async function fetchBuffer(url) {
  if (url.startsWith('data:')) {
    const comma = url.indexOf(',');
    if (comma < 0) return null;
    return Buffer.from(url.slice(comma + 1), url.slice(0, comma).includes(';base64') ? 'base64' : 'utf8');
  }
  if (!/^https?:\/\//i.test(url)) return null;
  const axios = require('axios');
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: FETCH_TIMEOUT_MS, maxContentLength: MAX_BYTES });
  return Buffer.from(res.data);
}

/** A stored image as a downscaled data URL, or null when it cannot be read. */
async function inlineImage(url, cache) {
  if (!url) return null;
  if (cache.has(url)) return cache.get(url);
  const job = (async () => {
    try {
      const buffer = await fetchBuffer(String(url));
      if (!buffer || !buffer.length) return null;
      const sharp = require('sharp');
      const img = sharp(buffer, { failOn: 'none' }).rotate().resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true });
      const { hasAlpha } = await sharp(buffer, { failOn: 'none' }).metadata();
      const out = hasAlpha ? await img.png().toBuffer() : await img.jpeg({ quality: 82 }).toBuffer();
      return `data:image/${hasAlpha ? 'png' : 'jpeg'};base64,${out.toString('base64')}`;
    } catch (err) {
      console.error('[StyleSheet] image could not be read for the sheet:', String(url).slice(0, 80), err.message);
      return null;
    }
  })();
  cache.set(url, job);
  return job;
}

// ── Canon reads ──

async function loadEpisode(sequelize, episodeId) {
  const [[ep]] = await sequelize.query(
    'SELECT id, show_id, episode_number, title FROM episodes WHERE id = :id AND deleted_at IS NULL',
    { replacements: { id: episodeId } });
  if (!ep) throw new LookbookError('Episode not found', 404, 'EPISODE_NOT_FOUND');
  return ep;
}

// The episode's event (its anchor, as Wardrobe and Scenes read it), as the
// full row: listEpisodeEvents returns only the attributes it lists.
async function loadEvent(models, episodeId) {
  try {
    const { listEpisodeEvents } = require('./episodeEventsService');
    const anchor = (await listEpisodeEvents(models, episodeId)).events[0] || null;
    if (!anchor) return null;
    const [[row]] = await models.sequelize.query(
      'SELECT * FROM world_events WHERE id = :id AND deleted_at IS NULL', { replacements: { id: anchor.id } });
    return row || null;
  } catch (err) {
    console.error('[StyleSheet] reading the episode\'s event failed:', err.message);
    return null;
  }
}

async function one(sequelize, sql, replacements) {
  try {
    const [[row]] = await sequelize.query(sql, { replacements });
    return row || null;
  } catch (err) {
    console.error('[StyleSheet] read failed:', err.message);
    return null;
  }
}

/**
 * EVENT DETAILS and the venue, from the event row. Host: the creator's
 * display name, then the brand, then the host text. TYPE: format, then
 * category (event_type is a game mechanic). WHEN: the free text as written.
 * VIBE: mood, else the dress code keywords.
 */
async function eventDetails(sequelize, event) {
  if (!event) return { event: null, venue: { name: null, chip: null } };
  const auto = parseJson(event.canon_consequences, {})?.automation || {};
  const pick = (key) => text(event[key]) || text(auto[key]);
  const profileId = event.source_profile_id || auto.host_profile_id || null;
  const profile = profileId
    ? await one(sequelize, 'SELECT display_name, handle FROM social_profiles WHERE id = :id', { id: profileId })
    : null;
  const host = text(profile?.display_name) || pick('host_brand') || pick('host') || text(auto.host_display_name) || null;
  const keywords = (parseJson(event.dress_code_keywords, []) || []).map(text).filter(Boolean);
  const when = [pick('event_date'), pick('event_time')].filter(Boolean).join(', ') || null;
  const locationId = event.venue_location_id || auto.venue_location_id || null;
  const location = locationId
    ? await one(sequelize, 'SELECT name, city, district FROM world_locations WHERE id = :id', { id: locationId })
    : null;
  return {
    event: {
      id: event.id,
      name: text(event.name),
      host,
      type: text(event.format) || text(event.category) || null,
      dress_code: text(event.dress_code),
      when,
      vibe: text(event.mood) || (keywords.length ? keywords.join(', ') : null),
      keywords,
    },
    venue: {
      name: pick('venue_name') || text(location?.name),
      // The city chip prints only what the location holds; never invented.
      chip: text(location?.district) || text(location?.city),
    },
  };
}

function isBag(category) {
  const c = String(category || '').toLowerCase();
  return /\b(bag|bags|handbag|purse|clutch|tote|minaudi)/.test(c);
}

/** The saved look's pieces by column, and the required columns left empty. */
async function wardrobeColumns(sequelize, ep, event) {
  const { getSlotForCategory } = require('../utils/wardrobeSlots');
  const { requiredSlotsFor } = require('./wardrobeSlotCoverageService');
  let look = { state: 'none', pieces: [] };
  try {
    const { episodeLook } = require('./episodeLookCharges');
    look = await episodeLook(sequelize, { episodeId: ep.id, event, showId: ep.show_id || null });
  } catch (err) {
    console.error('[StyleSheet] reading the saved look failed:', err.message);
  }
  const byColumn = { body: [], shoes: [], bag: [], jewelry: [], perfume: [] };
  for (const p of look.pieces || []) {
    const slot = getSlotForCategory(p.category);
    if (slot === 'outfit') byColumn.body.push(p);
    else if (slot === 'shoes') byColumn.shoes.push(p);
    else if (slot === 'jewelry') byColumn.jewelry.push(p);
    else if (slot === 'fragrance') byColumn.perfume.push(p);
    else if (slot === 'accessories' && isBag(p.category)) byColumn.bag.push(p);
  }
  const show = await one(sequelize, 'SELECT metadata FROM shows WHERE id = :id', { id: ep.show_id || null });
  const required = requiredSlotsFor(show ? { metadata: parseJson(show.metadata, {}) } : null).map((s) => SLOT_COLUMN[s]).filter(Boolean);
  return { state: look.state || 'none', pieces: look.pieces || [], byColumn, required };
}

// ── The sheet ──

const firstImage = (lb, spot) => lb.images?.[spot]?.[0] || null;

async function buildStyleSheet(models, episodeId) {
  const { sequelize } = models;
  const ep = await loadEpisode(sequelize, episodeId);
  const lb = await getLookbook(models, episodeId);
  const event = await loadEvent(models, episodeId);
  const { event: details, venue } = await eventDetails(sequelize, event);
  const wardrobe = await wardrobeColumns(sequelize, ep, event);
  const cache = new Map();
  const inline = (url) => inlineImage(url, cache);

  // THE VENUE: the first venue image in the Lookbook (sorted; "choose
  // angle" reorders), else the event's look or set base.
  const venueImages = (lb.images?.venue || []).filter((i) => i.in_lookbook)
    .map((i) => ({ id: i.id, label: i.source === 'upload' ? 'Your photo' : (lb.venue_options || []).find((o) => o.image_id === i.id)?.label || 'Venue', url: i.image_url }));
  const venueFallback = (lb.venue_options || [])[0] || null;
  const chosenVenue = venueImages[0] || (venueFallback ? { id: null, label: venueFallback.label, url: venueFallback.image_url } : null);

  const hairPhoto = firstImage(lb, 'hair');
  const nailsPhoto = firstImage(lb, 'nails');
  const columns = [];
  for (const col of COLUMNS) {
    let name = null;
    let url = null;
    let source = 'saved look';
    if (col.key === 'hair' || col.key === 'nails') {
      source = 'Lookbook';
      name = text(col.key === 'hair' ? lb.hair_name : lb.nails_name);
      url = (col.key === 'hair' ? hairPhoto : nailsPhoto)?.image_url || null;
    } else {
      const pieces = wardrobe.byColumn[col.key];
      if (pieces.length) {
        name = pieces.map((p) => p.name).filter(Boolean).join(' + ') || null;
        url = (pieces.find((p) => p.image_url) || {}).image_url || null;
      }
    }
    const filled = Boolean(name || url);
    columns.push({ key: col.key, label: col.label, name, source, image: await inline(url), needed: !filled && wardrobe.required.includes(col.key) });
  }

  // KEY INSPO: her inspo photos, topped up with further venue images, then
  // the two textures cut from the pieces.
  const inspoUploads = (lb.images?.inspo || []).filter((i) => i.source === 'upload').map((i) => ({ label: 'Inspo', url: i.image_url }));
  const extraVenue = venueImages.slice(1).map((v) => ({ label: v.label, url: v.url }));
  const inspoPhotos = [...inspoUploads, ...extraVenue].slice(0, 2);
  const textures = (lb.texture_pieces || []).slice(0, 2);

  const notes = lb.beauty_notes || {};
  const keywords = details?.keywords || [];
  const sheet = {
    episode: {
      id: ep.id,
      number: ep.episode_number ?? null,
      label: ep.episode_number != null ? `EPISODE ${String(ep.episode_number).padStart(2, '0')}` : null,
      title: text(ep.title),
    },
    event: details,
    venue: {
      ...venue,
      image: await inline(chosenVenue?.url),
      image_label: chosenVenue?.label || null,
      chosen_image_id: chosenVenue?.id || null,
      options: await Promise.all(venueImages.map(async (v) => ({ id: v.id, label: v.label, image: await inline(v.url) }))),
    },
    look: {
      front: await inline(firstImage(lb, 'front')?.image_url),
      side: await inline(firstImage(lb, 'side')?.image_url),
      back: await inline(firstImage(lb, 'back')?.image_url),
      hero: await inline(firstImage(lb, 'hero')?.image_url),
    },
    look_images: {
      front: firstImage(lb, 'front'), side: firstImage(lb, 'side'), back: firstImage(lb, 'back'), hero: firstImage(lb, 'hero'),
    },
    wardrobe: { state: wardrobe.state, columns },
    beauty: {
      eyes: await inline(firstImage(lb, 'eyes')?.image_url),
      lips: await inline(firstImage(lb, 'lips')?.image_url),
      skin: await inline(firstImage(lb, 'skin')?.image_url),
      nails: await inline(nailsPhoto?.image_url),
      notes: { eyes: text(notes.eyes), lips: text(notes.lips), skin: text(notes.skin) },
    },
    hair_name: text(lb.hair_name),
    nails_name: text(lb.nails_name),
    palette: Array.isArray(lb.palette) && lb.palette.length ? lb.palette : null,
    // The saved look's piece images, for the browser to take five colours from.
    palette_sources: (await Promise.all(wardrobe.pieces.filter((p) => p.image_url).map((p) => inline(p.image_url)))).filter(Boolean),
    mood_words: Array.isArray(lb.mood_words) && lb.mood_words.length ? lb.mood_words : keywords,
    tagline: text(lb.tagline),
    inspo: {
      photos: await Promise.all(inspoPhotos.map(async (p) => ({ label: p.label, image: await inline(p.url) }))),
      textures: await Promise.all(textures.map(async (t) => ({ label: t.name, image: await inline(t.image_url) }))),
    },
  };

  // "Filled in for you": each row's source and state.
  const missingColumns = columns.filter((c) => c.needed).map((c) => c.label);
  const beautyCount = ['eyes', 'lips', 'skin'].filter((k) => sheet.beauty[k]).length;
  sheet.rows = [
    { key: 'event', label: 'Event details', source: 'Event Package',
      state: !details ? 'missing' : (details.host && details.when && details.dress_code ? 'ready' : 'partial'),
      detail: details ? [details.name, details.host, details.when].filter(Boolean).join(' · ') : 'No event linked to this episode' },
    { key: 'venue', label: 'Venue', source: lb.scene_set ? `Scene set: ${lb.scene_set.name}` : 'Scene set',
      state: sheet.venue.image ? 'ready' : (venue.name ? 'partial' : 'missing'),
      detail: [venue.name, venue.chip, chosenVenue?.label].filter(Boolean).join(' · ') || 'No venue image yet' },
    { key: 'wardrobe', label: 'Wardrobe breakdown', source: 'Saved look',
      state: missingColumns.length ? 'partial' : (wardrobe.pieces.length ? 'ready' : 'missing'),
      detail: missingColumns.length ? `Needed: ${missingColumns.map((l) => l[0] + l.slice(1).toLowerCase()).join(', ')}` : `${wardrobe.pieces.length} piece${wardrobe.pieces.length === 1 ? '' : 's'}` },
    { key: 'beauty', label: 'Hair, nails and beauty', source: 'Lookbook',
      state: hairPhoto && nailsPhoto && beautyCount === 3 ? 'ready' : (hairPhoto || nailsPhoto || beautyCount ? 'partial' : 'missing'),
      detail: `Hair ${hairPhoto ? '✓' : '—'} · Nails ${nailsPhoto ? '✓' : '—'} · Beauty ${beautyCount} of 3` },
    { key: 'palette', label: 'Color palette', source: 'Piece images',
      state: sheet.palette ? 'ready' : (sheet.palette_sources.length ? 'partial' : 'missing'),
      detail: sheet.palette ? (sheet.palette.some((s) => s.source === 'edited') ? 'Adjusted by you' : 'From the pieces') : (sheet.palette_sources.length ? 'Taken from the pieces when you preview' : 'No piece images yet') },
    { key: 'mood', label: 'Mood words', source: 'Event keywords',
      state: sheet.mood_words.length ? 'ready' : 'missing',
      detail: sheet.mood_words.length ? sheet.mood_words.join(', ') : 'The event has no keywords' },
    { key: 'tagline', label: 'Tagline', source: 'You',
      state: sheet.tagline ? 'ready' : 'missing', detail: sheet.tagline || 'Not written yet' },
  ];

  // What the approval was given for: every value and image URL, not the
  // inlined pixels. A change after Approve marks the sheet out of date.
  const hash = crypto.createHash('sha256').update(JSON.stringify({
    episode: sheet.episode, event: details, venue: { ...venue, url: chosenVenue?.url || null },
    columns: columns.map((c) => [c.key, c.name, c.needed]), lookbook: lb.images, notes, palette: sheet.palette,
    mood: sheet.mood_words, tagline: sheet.tagline, hair: sheet.hair_name, nails: sheet.nails_name,
  })).digest('hex');
  sheet.inputs_hash = hash;
  sheet.status = lb.sheet_status;
  sheet.approved_at = lb.approved_at || null;
  const stored = await models.EpisodeLookbook.findOne({ where: { episode_id: ep.id }, attributes: ['sheet_inputs_hash'] });
  const approvedHash = stored ? stored.sheet_inputs_hash : null;
  sheet.stale = lb.sheet_status === 'approved' && Boolean(approvedHash) && approvedHash !== hash;
  sheet.readiness = lb.readiness;
  sheet.cost_usd = 0;
  return sheet;
}

/** Approve the sheet as it stands: Draft → Approved, with who and when. */
async function approveStyleSheet(models, episodeId, user) {
  const sheet = await buildStyleSheet(models, episodeId);
  if (sheet.status === 'approved') throw new LookbookError('The style sheet is already approved.', 409, 'ALREADY_APPROVED');
  const by = user ? String(user.email || user.id || user.sub || '').slice(0, 255) || null : null;
  await models.EpisodeLookbook.update(
    { sheet_status: 'approved', approved_at: new Date(), approved_by: by, sheet_inputs_hash: sheet.inputs_hash },
    { where: { episode_id: episodeId } });
  return buildStyleSheet(models, episodeId);
}

/** Reopen an approved sheet: back to Draft, so the Lookbook can change. */
async function reopenStyleSheet(models, episodeId) {
  const { sequelize } = models;
  await loadEpisode(sequelize, episodeId);
  await models.EpisodeLookbook.update(
    { sheet_status: 'draft', approved_at: null, approved_by: null, sheet_inputs_hash: null },
    { where: { episode_id: episodeId } });
  return buildStyleSheet(models, episodeId);
}

module.exports = { COLUMNS, buildStyleSheet, approveStyleSheet, reopenStyleSheet, inlineImage, isBag };
