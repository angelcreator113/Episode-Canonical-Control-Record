'use strict';

/**
 * Visual Memory, phase 4 (Evoni's "Character Visual Memory System", section
 * 5 "Contextual image suggestions"; 2026-10-19: "yes start phase 4"): the
 * right picture for a post's caption.
 *
 *   read caption → load canon → search the library first → suggest a
 *   targeted edit → make a new picture only when nothing fits → Evoni
 *   reviews it, and it goes on the post only when she attaches it.
 *
 *   readCaption(db, post, poster)   one text call (claude-sonnet-4-6, the
 *       two-attempt loop, cost-tracked and budget-gated by aiCostTracker)
 *       with the poster's character file as context. Returns { subject,
 *       activity, mood, setting, person_in_frame: yes | no | optional,
 *       objects[], avoid[] }. Cached on the post (feed_posts.gate_json.
 *       picture_reading, keyed by a hash of the caption), so asking again
 *       costs nothing until the caption changes. An answer that cannot be
 *       read falls back to a reading made from the caption's own words (not
 *       cached, flagged fallback: true).
 *   rank(reading, caption, candidates)   deterministic: phase 2's word score
 *       (postMedia.rankPictures) plus the reading's score, each with why.
 *       The candidates are the poster's tagged pictures, their places'
 *       pictures (character_places → scene_set tags) and the pictures of
 *       their wardrobe; any picture with a confidential character in it
 *       (Dr. Sinclair) is never a candidate.
 *   planFor(...)   nothing is run: 'use' when the best scores USE_AT or
 *       more; 'edit' (a phase-3 variation request, one change with the rest
 *       locked) when it scores EDIT_AT or more; otherwise 'create', from
 *       the reading and approved references only: their approved portraits
 *       when they are in the picture, the place's picture for the setting.
 *       A picture of them with no approved portrait is not made.
 *   suggest(db, postId)   the reading, the ranked pictures and the plan.
 *   run(db, postId, { choice, by })   'edit' is services/mediaVariations.
 *       createVariation; 'create' is the same image path (OpenAI
 *       gpt-image-1.5: images/edits with the references, images/generations
 *       when there are none) through imageCostService.runImageCall (route
 *       'picture-suggestion'; a refusal is a 429 and nothing is stored). The
 *       new picture is a media_assets row: source 'generated', status
 *       'draft', visibility 'private', generation { action, prompt, model,
 *       references, reading, post_id, review }, tagged with the poster and
 *       the place if one was used. Never put on the post, never canon.
 */

const crypto = require('crypto');
const { MediaError } = require('./mediaLibrary');
const { isConfidential } = require('../utils/confidentialCharacters');

const MODELS = ['claude-sonnet-4-6'];
const PERSON = Object.freeze(['yes', 'no', 'optional']);
const USE_AT = 10;
const EDIT_AT = 4;
const TOP = 6;
const MAX_PLACES = 10;
const MAX_WARDROBE = 20;
const ROUTE = 'picture-suggestion';
// Words in an avoid line that say nothing about the picture itself, and words
// that ask for an outfit; both as postMedia.stems reads them.
const stemSet = (words) => new Set(require('./postMedia').stems(words));
const VAGUE = stemSet('unrelated other random extra different new any people person things');
const OUTFIT = stemSet('outfit wearing dress gown look fit style clothes wardrobe');

const clean = (v, n) => {
  const t = v == null ? '' : String(v).replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, n) : '';
};
const list = (v, n = 8) => (Array.isArray(v) ? v : typeof v === 'string' && v ? [v] : [])
  .map((x) => clean(x, 80)).filter(Boolean).slice(0, n);
const captionKey = (caption) => crypto.createHash('sha256').update(String(caption || '')).digest('hex').slice(0, 16);

let client = null;
function getClient() {
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

/** A reading as the AI gave it, checked; null when there is nothing to use. */
function normalizeReading(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const person = String(raw.person_in_frame ?? '').toLowerCase();
  const r = {
    subject: clean(raw.subject, 160),
    activity: clean(raw.activity, 160),
    mood: clean(raw.mood, 80),
    setting: clean(raw.setting, 120),
    person_in_frame: PERSON.includes(person) ? person : (raw.person_in_frame === true ? 'yes' : raw.person_in_frame === false ? 'no' : 'optional'),
    objects: list(raw.objects),
    avoid: list(raw.avoid),
  };
  return r.subject || r.objects.length || r.setting || r.activity ? r : null;
}

/** The AI's answer read as JSON; null when it cannot be. */
function parseReading(text) {
  const raw = String(text || '').trim();
  try {
    return normalizeReading(JSON.parse((raw.match(/\{[\s\S]*\}/) || [raw])[0]));
  } catch (err) {
    console.error('[pictureSuggestions] the reading could not be read:', err.message);
    return null;
  }
}

/** When the AI's answer can't be read: a plainer reading from the caption's own words. */
function fallbackReading(caption) {
  const { stems, SETTINGS } = require('./postMedia');
  const raw = String(caption || '').toLowerCase();
  const setting = SETTINGS.find((s) => raw.includes(s)) || '';
  const words = stems(caption).filter((w) => w !== setting);
  return {
    subject: clean(caption, 160), activity: '', mood: '', setting,
    person_in_frame: /\b(selfie|me|my face|outfit|wearing|mirror)\b/.test(raw) ? 'yes' : 'optional',
    objects: words.slice(0, 4), avoid: [],
  };
}

function readingPrompt(caption, block, name) {
  return `You are choosing the picture for a post on The Pulse, the LalaVerse's social feed. Read the caption and say what the picture should show. Not every post needs a portrait: a caption about bread rising wants the bread, not a face. Stay inside who they are and the world below; never invent people, places, brands or outfits that are not in it.

${block ? `${block}\n\n` : ''}THE POST by ${name || 'them'}:
"${caption}"

Answer with JSON only:
{"subject": "what the picture is of, a few words",
 "activity": "what is happening, a few words, or empty",
 "mood": "one to three words",
 "setting": "where, in a few words (one of their places when it fits), or empty",
 "person_in_frame": "yes" | "no" | "optional",
 "objects": ["the things that should be visible"],
 "avoid": ["what must not be in it: unrelated outfits, places, products or people"]}`;
}

/** The post's reading: the cached one while the caption is unchanged, else one text call. */
async function readCaption(db, post, poster) {
  const caption = clean(post.content_text, 2000);
  if (!caption) throw new MediaError(400, 'This post has no caption to read.');
  const key = captionKey(caption);
  const saved = post.gate_json?.picture_reading;
  if (saved?.caption_key === key && normalizeReading(saved.reading)) {
    return { reading: normalizeReading(saved.reading), cached: true, fallback: false };
  }
  let block = '';
  try {
    const { loadCharacterFile, characterFileBlock } = require('./characterFile');
    const character = await db.RegistryCharacter.findByPk(poster.id);
    block = characterFileBlock(await loadCharacterFile(db, { character }));
  } catch (err) {
    console.error('[pictureSuggestions] the character file could not be read; reading without it:', err.message);
  }
  let message;
  for (const model of MODELS) {
    try {
      message = await getClient().messages.create({ model, max_tokens: 500, messages: [{ role: 'user', content: readingPrompt(caption, block, poster.name) }] });
      break;
    } catch (modelErr) {
      console.warn(`[pictureSuggestions] reading with ${model} failed:`, modelErr.message);
      if (modelErr.code === 'AI_BUDGET_EXCEEDED' || model === MODELS[MODELS.length - 1]) throw modelErr;
    }
  }
  const reading = parseReading(message?.content?.[0]?.text);
  if (!reading) return { reading: fallbackReading(caption), cached: false, fallback: true };
  const value = { caption_key: key, reading, model: MODELS[0], read_at: new Date().toISOString() };
  // Only the reading is added; the rest of gate_json (review, pillar, brand) stays as it is.
  await db.sequelize.query(
    `UPDATE feed_posts SET gate_json = COALESCE(gate_json, '{}'::jsonb) || jsonb_build_object('picture_reading', CAST(:v AS JSONB))
      WHERE id = :id`, { replacements: { id: post.id, v: JSON.stringify(value) } });
  return { reading, cached: false, fallback: false };
}

/** The poster's pictures, their places' pictures and their wardrobe's, once each, with no confidential character in any. */
async function candidatesFor(db, poster) {
  const media = require('./mediaLibrary');
  const byId = new Map();
  const add = (rows) => { for (const a of rows) if (!byId.has(a.id) && a.status !== 'archived') byId.set(a.id, a); };
  add(await media.listFor(db, { entityType: 'character', entityId: poster.id, audience: 'admin' }));
  const [places] = await db.sequelize.query(
    `SELECT scene_set_id FROM character_places WHERE registry_character_id = :id AND deleted_at IS NULL
      ORDER BY created_at ASC LIMIT ${MAX_PLACES}`, { replacements: { id: poster.id } });
  for (const p of places) add(await media.listFor(db, { entityType: 'scene_set', entityId: p.scene_set_id, audience: 'admin' }));
  const [[who]] = await db.sequelize.query(
    'SELECT character_key, display_name, selected_name FROM registry_characters WHERE id = :id', { replacements: { id: poster.id } });
  const names = [who?.character_key, who?.display_name, who?.selected_name].filter(Boolean).map((n) => n.toLowerCase());
  if (names.length) {
    const [rows] = await db.sequelize.query(
      `SELECT DISTINCT l.asset_id FROM media_asset_links l JOIN wardrobe w ON w.id::text = l.entity_id::text AND w.deleted_at IS NULL
        WHERE l.entity_type = 'wardrobe' AND l.deleted_at IS NULL AND LOWER(w.character) IN (:names) LIMIT ${MAX_WARDROBE}`,
      { replacements: { names } });
    for (const r of rows) {
      try {
        add([await media.getAsset(db, r.asset_id)]);
      } catch (err) {
        console.error('[pictureSuggestions] a wardrobe picture could not be read:', err.message);
      }
    }
  }
  const all = [...byId.values()];
  const people = [...new Set(all.flatMap((a) => (a.links || []).filter((l) => l.entity_type === 'character').map((l) => String(l.entity_id))))];
  if (!people.length) return all;
  const rows = await db.RegistryCharacter.findAll({ where: { id: people } });
  const hidden = new Set(rows.filter((c) => isConfidential(c)).map((c) => String(c.id)));
  return all.filter((a) => !(a.links || []).some((l) => l.entity_type === 'character' && hidden.has(String(l.entity_id))));
}

const isPortrait = (a) => a.source === 'portrait' || a.source === 'cover';
const isWardrobe = (a) => (a.links || []).some((l) => l.entity_type === 'wardrobe');
const isPlace = (a) => ['scene_set', 'venue'].includes(a.source) || (a.links || []).some((l) => l.entity_type === 'scene_set');

/** What the reading adds to one picture's score, and why. */
function readingScore(reading, asset, posterId = null) {
  const { stems, assetText } = require('./postMedia');
  const have = new Set(stems(assetText(asset)));
  const hit = (text) => stems(text).filter((w) => have.has(w));
  const why = [];
  let score = 0;
  const shown = reading.objects.filter((o) => hit(o).length);
  if (shown.length) { score += shown.length * 4; why.push(`shows ${shown.slice(0, 3).join(', ')}`); }
  // A picture of the place itself counts for more than a picture that happens to be there.
  if (reading.setting && hit(reading.setting).length) { score += isPlace(asset) ? 4 : 3; why.push(`set in the ${reading.setting}`); }
  const doing = hit(reading.activity).slice(0, 2);
  if (doing.length) { score += doing.length * 2; why.push(`the activity: ${reading.activity}`); }
  const counted = new Set(reading.objects.flatMap((o) => stems(o)));
  const about = hit(reading.subject).filter((w) => !counted.has(w)).slice(0, 3);
  score += about.length;
  const feel = hit(reading.mood).slice(0, 2);
  if (feel.length) { score += feel.length; why.push(`the mood: ${reading.mood}`); }
  const avoided = reading.avoid.filter((a) => stems(a).some((w) => !VAGUE.has(w) && have.has(w)));
  if (avoided.length) { score -= avoided.length * 5; why.push(`has what to avoid: ${avoided.slice(0, 2).join(', ')}`); }
  const wantsOutfit = [reading.subject, reading.activity, ...reading.objects].some((t) => stems(t).some((w) => OUTFIT.has(w)));
  if (reading.person_in_frame === 'no') {
    if (isPortrait(asset)) { score -= 4; why.push('a portrait, and this picture needs no one in it'); }
    if (isWardrobe(asset)) { score -= 3; why.push('an outfit, and this post is not about one'); }
  } else if (reading.person_in_frame === 'optional') {
    if (isPortrait(asset)) { score -= 2; why.push('a portrait (not every post needs one)'); }
    if (isWardrobe(asset) && !wantsOutfit) { score -= 2; why.push('an outfit, and this post is not about one'); }
  } else {
    if (isPortrait(asset)) score += 1;
    if (posterId && (asset.links || []).some((l) => l.entity_type === 'character' && String(l.entity_id) === String(posterId) && l.role === 'pictured')) {
      score += 2; why.push('they are in it');
    }
  }
  return { score, why, shown };
}

/** The candidates ranked for this reading: the same reading and pictures always give the same order. */
function rank(reading, caption, candidates, { posterId = null } = {}) {
  const { rankPictures } = require('./postMedia');
  return rankPictures(caption, candidates).map((r) => {
    const add = readingScore(reading, r.asset, posterId);
    const words = r.why.filter((w) => !/portrait/.test(w));
    return { asset: r.asset, score: r.score + add.score, ready: r.ready, shown: add.shown, why: [...add.why, ...words] };
  }).sort((x, y) => (y.score - x.score) || (Number(y.ready) - Number(x.ready))
    || (new Date(y.asset.created_at || 0) - new Date(x.asset.created_at || 0)) || String(x.asset.id).localeCompare(String(y.asset.id)));
}

/** The one change that would bring a nearly-right picture to the caption, everything else locked. */
function editFor(reading, best) {
  const missing = reading.objects.filter((o) => !best.shown.includes(o));
  if (missing.length) {
    return { kind: 'object', text: `add ${missing.slice(0, 3).join(' and ')}`, locks: ['face', 'wardrobe', 'location'] };
  }
  const doing = best.why.some((w) => w.startsWith('the activity'));
  const pictured = (best.asset.links || []).some((l) => l.entity_type === 'character' && l.role === 'pictured');
  if (reading.activity && !doing && pictured) return { kind: 'action', text: reading.activity, locks: ['face', 'wardrobe', 'location', 'props'] };
  return { kind: 'framing', text: `closer on ${reading.subject || reading.objects[0] || 'the subject'}`, locks: ['face', 'wardrobe', 'location', 'props'] };
}

/** The prompt for a new picture: the reading, with the references it may use. */
function createPrompt(reading, caption, { name, look = null, place = null, portraits = 0 } = {}) {
  const person = reading.person_in_frame === 'yes';
  const lines = [`A photograph for a post on The Pulse${name ? ` by ${name}` : ''}. The caption: "${clean(caption, 300)}".`];
  if (reading.subject) lines.push(`It shows ${reading.subject}${reading.activity ? `: ${reading.activity}` : ''}.`);
  if (reading.objects.length) lines.push(`In the frame: ${reading.objects.join(', ')}.`);
  if (reading.setting) lines.push(`Setting: ${reading.setting}.`);
  if (place) lines.push(`The place is the one in the ${portraits ? 'first ' : ''}reference image (${place}): keep its room, light and furniture as they are.`);
  if (reading.mood) lines.push(`Mood: ${reading.mood}.`);
  if (person) {
    lines.push(`${name || 'They'} is in the picture and must look exactly like the person in the reference portrait${portraits > 1 ? 's' : ''}${place ? ' that follow' : ''}: the same face, skin, hair and body.${look ? ` Their approved look:\n${look}` : ''}`);
    lines.push('Their clothes are simple and everyday unless the caption is about an outfit.');
  } else {
    lines.push('No people in the frame.');
  }
  if (reading.avoid.length) lines.push(`Leave out: ${reading.avoid.join('; ')}.`);
  lines.push('Photorealistic, natural light, no text, no logos, no real brands.');
  return lines.join('\n');
}

/** What to check before approving a new picture. The app does not look at it. */
function createReview(reading, { name, place }) {
  const reasons = [];
  if (reading.person_in_frame === 'yes') {
    reasons.push(`${name || 'They'} is in it: check they match their approved portraits and look.`);
    reasons.push('Check the outfit is one of theirs.');
  }
  if (place) reasons.push(`Check the place still reads as ${place}.`);
  reasons.push('Check it fits the caption and nothing unrelated slipped in.');
  return { needs_review: true, reasons };
}

/** The plan: use, edit or create. Nothing is run here. */
async function planFor(db, { reading, caption, ranked, poster }) {
  const best = ranked[0] || null;
  const editable = best && /^(https?:\/\/|data:image\/)/i.test(String(best.asset.url || ''));
  const use = best && best.score >= USE_AT ? { action: 'use', asset_id: best.asset.id, ready: best.ready } : null;
  const edit = !use && editable && best.score >= EDIT_AT
    ? { action: 'edit', asset_id: best.asset.id, ...(() => { const e = editFor(reading, best); return { change: { kind: e.kind, text: e.text }, locks: e.locks }; })() }
    : null;

  const placePick = ranked.find((r) => isPlace(r.asset) && r.asset.status === 'approved' && reading.setting
    && r.why.some((w) => w.startsWith('set in')));
  const references = [];
  if (placePick) references.push({ kind: 'place', asset_id: placePick.asset.id, url: placePick.asset.url, name: placePick.asset.caption || null });
  let blocked = null;
  let look = null;
  if (reading.person_in_frame === 'yes') {
    const { addedCharacter } = require('./mediaVariations');
    const who = await addedCharacter(db, poster.id);
    look = who.look || null;
    for (const url of who.portraitUrls) references.push({ kind: 'portrait', character_id: poster.id, url });
    if (!who.portraitUrls.length) {
      blocked = `There is no approved portrait of ${poster.name} yet, so a new picture with them in it is not made. Approve a portrait first, or use a picture without them.`;
    }
  }
  const place = placePick ? (placePick.asset.caption || 'their place') : null;
  const portraits = references.filter((r) => r.kind === 'portrait').length;
  const create = {
    action: 'create',
    prompt: createPrompt(reading, caption, { name: poster.name, look, place, portraits }),
    references, blocked, review: createReview(reading, { name: poster.name, place }),
  };
  return { recommended: use ? 'use' : edit ? 'edit' : 'create', use, edit, create, thresholds: { use: USE_AT, edit: EDIT_AT } };
}

async function context(db, postId) {
  const { loadPost, posterOf } = require('./postMedia');
  const post = await loadPost(db, postId);
  const poster = await posterOf(db, post);
  if (!poster) throw new MediaError(400, 'This post has no character in the registry, so there is nothing to suggest from.');
  return { post, poster };
}

/** The caption's reading, the poster's pictures ranked for it, and what to do. */
async function suggest(db, postId) {
  const { post, poster } = await context(db, postId);
  const read = await readCaption(db, post, poster);
  const ranked = rank(read.reading, post.content_text, await candidatesFor(db, poster), { posterId: poster.id });
  const plan = await planFor(db, { reading: read.reading, caption: post.content_text, ranked, poster });
  return {
    post_id: post.id, poster, ...read,
    ranked: ranked.slice(0, TOP).map((r) => ({
      id: r.asset.id, url: r.asset.url, caption: r.asset.caption, status: r.asset.status, visibility: r.asset.visibility,
      score: r.score, ready: r.ready, why: r.why,
    })),
    plan,
  };
}

/** Run the edit or the create Evoni chose. The result is a private draft; it is not put on the post. */
async function run(db, postId, { choice, by = null } = {}) {
  const action = String(choice?.action || '');
  if (!['edit', 'create'].includes(action)) throw new MediaError(400, 'Choose an edit or a new picture.');
  const { post, poster } = await context(db, postId);
  const saved = post.gate_json?.picture_reading;
  const reading = saved?.caption_key === captionKey(clean(post.content_text, 2000)) ? normalizeReading(saved.reading) : null;
  if (!reading) throw new MediaError(409, 'Ask for suggestions for this caption first.');
  const candidates = await candidatesFor(db, poster);

  if (action === 'edit') {
    const assetId = String(choice.asset_id || '');
    if (!candidates.some((a) => String(a.id) === assetId)) throw new MediaError(400, 'That picture is not one of theirs.');
    const out = await require('./mediaVariations').createVariation(db, {
      assetId, change: choice.change, locks: choice.locks, by,
    });
    return { action, ...out };
  }

  const ranked = rank(reading, post.content_text, candidates, { posterId: poster.id });
  const { create } = await planFor(db, { reading, caption: post.content_text, ranked, poster });
  if (create.blocked) throw new MediaError(409, create.blocked);
  const { editImage, imageBytes, MODEL } = require('./mediaVariations');
  const images = [];
  const used = [];
  for (const ref of create.references) {
    try {
      images.push(await imageBytes(ref.url));
      used.push(ref);
    } catch (err) {
      console.error(`[pictureSuggestions] a ${ref.kind} reference could not be read; it is left out:`, err.message);
    }
  }
  if (reading.person_in_frame === 'yes' && !used.some((r) => r.kind === 'portrait')) {
    throw new MediaError(502, `${poster.name}'s portrait could not be read, so nothing was made.`);
  }
  const buffer = await editImage(create.prompt, images, { routeName: ROUTE });

  const { storePulseImage } = require('./pulseImageService');
  const stored = await storePulseImage({ buffer, mimetype: 'image/png' }, { keyPrefix: 'media/suggestions', label: 'The new picture' });
  const place = used.find((r) => r.kind === 'place');
  const placeTag = place ? (ranked.find((r) => r.asset.id === place.asset_id)?.asset.links || []).find((l) => l.entity_type === 'scene_set') : null;
  const generation = {
    action: 'create', prompt: create.prompt, model: MODEL,
    references: used.map((r) => (r.kind === 'place' ? { kind: 'place', asset_id: r.asset_id } : { kind: 'portrait', character_id: r.character_id, url: r.url })),
    reading, post_id: post.id, review: create.review, made_at: new Date().toISOString(), id: crypto.randomUUID(),
  };
  const links = [{ entity_type: 'character', entity_id: poster.id, role: reading.person_in_frame === 'yes' ? 'pictured' : 'owner' }];
  if (placeTag) links.push({ entity_type: 'scene_set', entity_id: placeTag.entity_id, role: 'location' });
  const media = require('./mediaLibrary');
  const created = await media.createAsset(db, {
    url: stored.url, storageKey: stored.key, width: stored.width, height: stored.height,
    caption: clean(reading.subject || post.content_text, 200) || 'A new picture',
    source: 'generated', status: 'draft', visibility: 'private',
    details: { objects: reading.objects, ...(reading.setting ? { notes: `Made for the caption "${clean(post.content_text, 200)}"; set in ${reading.setting}` } : { notes: `Made for the caption "${clean(post.content_text, 200)}"` }) },
    generation, links, by,
  });
  return { action, asset: created.asset, review: create.review };
}

module.exports = {
  MODELS, USE_AT, EDIT_AT, PERSON, ROUTE,
  normalizeReading, parseReading, fallbackReading, readingScore, rank, editFor, createPrompt, planFor,
  readCaption, candidatesFor, suggest, run, captionKey,
};
