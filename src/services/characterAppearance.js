'use strict';

/**
 * A character's appearance (Evoni, 2026-10-17: "we need an appearance tab
 * and a generator"; "yes to the portrait images"). How they look, written
 * down once, so every generator and the checker agree on it, and the
 * portraits made from it.
 *
 *   registry_characters.appearance  { summary, face, hair, skin, build,
 *     presence, marks, signature_style, palette: [], accessories, at_home,
 *     going_out, never_wears, why, set_by, set_at,
 *     portraits: [{ url, prompt, created_at }] }
 *
 *   normalizeAppearance(body, { by })   the stored shape (portraits kept by
 *     the caller); an AppearanceError 400 when nothing is written
 *   appearanceLines(appearance)  the look as "- label: value" lines ('' with none)
 *   suggestAppearance(db, { character, feedProfile })  one Sonnet call that
 *     reads their whole character file (facts, money, type, mask, city,
 *     what they already have written about their look) and proposes their
 *     appearance, with why; saves nothing
 *   portraitPrompt(appearance, name)  the image prompt: an original
 *     fictional person, no text, no logos, no real brands
 *   generatePortrait(db, character)  one image (imageGenerationService,
 *     budget-gated and logged) from the saved appearance, kept in the
 *     studio's storage (pulseImageService) and added to their portraits
 *     (the newest MAX_PORTRAITS); returns { url, cost }
 *   usePortrait(character, url)  makes one of their portraits their profile
 *     photo (portrait_url)
 * The look is never measurements (no height, weight or sizes in numbers):
 * how they read in a room, not a spec sheet.
 */

const MODELS = ['claude-sonnet-4-6'];
const TEXT_KEYS = ['summary', 'face', 'hair', 'skin', 'build', 'presence', 'marks', 'signature_style', 'accessories', 'at_home', 'going_out', 'never_wears'];
const LABELS = {
  summary: 'At a glance', face: 'Face', hair: 'Hair', skin: 'Skin', build: 'Build', presence: 'How they carry themselves',
  marks: 'Marks (scars, tattoos, piercings)', signature_style: 'Signature style', palette: 'Palette', accessories: 'Accessories',
  at_home: 'At home', going_out: 'Going out', never_wears: 'Never seen in',
};
const MAX_TEXT = 600;
const MAX_PORTRAITS = 6;
// What the look may already say elsewhere, read by the suggestion.
const LOOK_FIELDS = ['aesthetic_dna', 'physical_presence', 'signature_trait', 'appearance_mode'];
const PROFILE_LOOK_FIELDS = ['beauty_description', 'aesthetic_dna', 'beauty_factor', 'aesthetic_power', 'city'];

class AppearanceError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; this.name = 'AppearanceError'; }
}

let client = null;
function getClient() {
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

const text = (v, n = MAX_TEXT) => (typeof v === 'string' && v.trim() ? v.replace(/\s+/g, ' ').trim().slice(0, n) : null);

/** The stored shape from a body: text fields trimmed, palette a short list. */
function normalizeAppearance(body = {}, { by = null } = {}) {
  const out = {};
  for (const k of TEXT_KEYS) {
    const v = text(body[k]);
    if (v) out[k] = v;
  }
  const palette = (Array.isArray(body.palette) ? body.palette : String(body.palette || '').split(','))
    .map((p) => text(p, 40)).filter(Boolean).slice(0, 8);
  if (palette.length) out.palette = palette;
  if (!Object.keys(out).length) throw new AppearanceError('Write at least one thing about how they look.');
  const why = text(body.why, 600);
  if (why) out.why = why;
  out.set_by = by;
  out.set_at = new Date().toISOString();
  return out;
}

/** The look as prompt or display lines; '' with none. */
function appearanceLines(appearance) {
  if (!appearance || typeof appearance !== 'object') return '';
  const lines = [];
  for (const k of [...TEXT_KEYS.slice(0, 9), 'palette', ...TEXT_KEYS.slice(9)]) {
    const v = appearance[k];
    if (Array.isArray(v) ? v.length : v) lines.push(`- ${LABELS[k].toLowerCase()}: ${Array.isArray(v) ? v.join(', ') : v}`);
  }
  return lines.join('\n');
}

async function suggestAppearance(db, { character, feedProfile } = {}) {
  if (!character) throw new AppearanceError('Character not found.', 404);
  const { block } = await require('./characterFile').characterFilePrompt(db, { character, ...(feedProfile !== undefined ? { feedProfile } : {}) });
  const c = character.toJSON ? character.toJSON() : character;
  const fp = feedProfile ? (feedProfile.toJSON ? feedProfile.toJSON() : feedProfile) : null;
  const already = {};
  for (const f of LOOK_FIELDS) if (c[f] && !(typeof c[f] === 'object' && !Object.keys(c[f]).length)) already[f] = c[f];
  for (const f of PROFILE_LOOK_FIELDS) if (fp?.[f]) already[`feed_${f}`] = fp[f];
  if (!block && !Object.keys(already).length) {
    throw new AppearanceError('There is nothing written about them yet to read their look from.', 409);
  }
  const name = c.selected_name || c.display_name || 'this character';
  const prompt = `Write how ${name} looks: their appearance, the one source every scene, post and portrait will follow.

${block}
${Object.keys(already).length ? `\nWHAT IS ALREADY WRITTEN ABOUT THEIR LOOK (keep to it where it is specific):\n${JSON.stringify(already, null, 2)}\n` : ''}
Rules:
- Their look follows from who they are: what they can afford (their facts), how they want to be seen (their mask and type), where they live and what they do.
- They live in the LalaVerse: no real brands, designers, stores or celebrities. Describe the clothes, not the label.
- No measurements: no height, weight or sizes in numbers. How they read in a room, not a spec sheet.
- Specific and visual: a stranger could pick them out of a crowd. One or two sentences per part.

Answer with JSON only:
{"summary": "one line: how they look at a glance",
 "face": "", "hair": "", "skin": "", "build": "", "presence": "how they carry themselves, move, take up space",
 "marks": "scars, tattoos, piercings, or null",
 "signature_style": "", "palette": ["3-6 colours"], "accessories": "",
 "at_home": "what they wear when no one is looking", "going_out": "what they wear to be seen", "never_wears": "the one thing they would never be seen in",
 "why": "two sentences: how their look comes from who they are"}`;

  let message;
  for (const model of MODELS) {
    try {
      message = await getClient().messages.create({ model, max_tokens: 1200, messages: [{ role: 'user', content: prompt }] });
      break;
    } catch (modelErr) {
      console.warn(`[characterAppearance] suggesting with ${model} failed:`, modelErr.message);
      if (model === MODELS[MODELS.length - 1]) throw modelErr;
    }
  }
  const raw = (message?.content?.[0]?.text || '').trim();
  let parsed;
  try {
    parsed = JSON.parse((raw.match(/\{[\s\S]*\}/) || [raw])[0]);
  } catch (err) {
    console.error('[characterAppearance] the suggestion could not be read:', err.message);
    throw new AppearanceError('The suggestion came back in a form that could not be read. Try again.', 502);
  }
  try {
    const { set_by: _by, set_at: _at, ...proposal } = normalizeAppearance(parsed);
    return { proposal };
  } catch (err) {
    console.error('[characterAppearance] the suggestion was empty:', err.message);
    throw new AppearanceError('The suggestion came back empty. Try again.', 502);
  }
}

/** The image prompt for a portrait from the look. */
function portraitPrompt(appearance, name = 'this person') {
  const a = appearance || {};
  const parts = [
    a.summary,
    a.face && `Face: ${a.face}`,
    a.hair && `Hair: ${a.hair}`,
    a.skin && `Skin: ${a.skin}`,
    a.build && `Build: ${a.build}`,
    a.marks && `Marks: ${a.marks}`,
    (a.going_out || a.signature_style) && `Wearing: ${a.going_out || a.signature_style}`,
    a.palette?.length && `Colour palette: ${a.palette.join(', ')}`,
    a.accessories && `Accessories: ${a.accessories}`,
    a.presence && `Their presence: ${a.presence}`,
  ].filter(Boolean);
  return `Photorealistic editorial portrait photograph of ${name}, an original fictional person (not resembling any real person or celebrity). ${parts.join('. ')}. Head and shoulders, looking at the camera, soft natural light, simple softly blurred background. No text, no letters, no logos, no brand names, no watermark.`;
}

async function generatePortrait(db, character) {
  if (!character) throw new AppearanceError('Character not found.', 404);
  const appearance = character.appearance;
  if (!appearance || !appearance.summary) {
    throw new AppearanceError('Save their appearance first (at least "at a glance"): the portrait is made from it.', 409);
  }
  const prompt = portraitPrompt(appearance, character.selected_name || character.display_name);
  const imageGen = require('./imageGenerationService');
  const generated = await imageGen.generateImage(prompt, { useCase: 'character', size: 'portrait' });
  // The provider's link expires: keep the image in the studio's storage.
  const axios = require('axios');
  const download = await axios.get(generated.url, { responseType: 'arraybuffer', timeout: 60000 });
  const { storePulseImage } = require('./pulseImageService');
  const { url } = await storePulseImage(
    { buffer: Buffer.from(download.data), mimetype: 'image/jpeg', originalname: 'portrait.jpg' },
    { keyPrefix: `characters/${character.id}/generated`, maxSide: 1200, minSide: 200, label: 'The portrait' });
  const portraits = [{ url, prompt, created_at: new Date().toISOString() }, ...(appearance.portraits || [])].slice(0, MAX_PORTRAITS);
  await character.update({ appearance: { ...appearance, portraits } });
  return { url, cost: generated.cost_estimate ?? null };
}

async function usePortrait(character, url) {
  if (!character) throw new AppearanceError('Character not found.', 404);
  const known = (character.appearance?.portraits || []).some((p) => p.url === url);
  if (!known) throw new AppearanceError('That is not one of their portraits.', 400);
  await character.update({ portrait_url: url });
  return { portrait_url: url };
}

module.exports = {
  AppearanceError, normalizeAppearance, appearanceLines, suggestAppearance, portraitPrompt, generatePortrait, usePortrait,
  TEXT_KEYS, LABELS, MAX_PORTRAITS,
};
