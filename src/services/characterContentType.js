'use strict';

/**
 * What a character is known for on The Pulse: their content type (Evoni,
 * 2026-10-17: "this world is all about content creation and sometimes a
 * persons content can be different than what they do for work and these
 * things make people interesting").
 *
 * Two different things, kept apart:
 *   - their job: the occupation fact (services/characterFacts), what pays
 *     the bills;
 *   - their content type: one of the Society tab's archetypes
 *     (services/societyArchetypes), stored by name on their feed profile's
 *     society_archetype. It is what the LalaVerse knows them for, and what
 *     their posts are.
 * A nurse who is known as The Entertainer is not an error: the gap between
 * the two is part of who they are, and the generators are told so.
 *
 *   contentTypeOf(db, { character, feedProfile })
 *     → { current, list, occupation, profile, differs }
 *     current: the archetype ({ name, content, audience, narrative }) or
 *     { name } for a stored name no longer on the list; null when none.
 *   setContentType(db, { feedProfile, name })  name from the list, or null
 *     to clear. A ContentTypeError 409 with no feed profile, 400 for a name
 *     not on the list.
 *   suggestContentType(db, { character, feedProfile })
 *     → { suggestion: { name, why, differs_from_job, tension }, archetype }
 *     one Sonnet call over their character file and the list; nothing is
 *     saved: Evoni keeps it or picks another.
 *   suggestForUnset(db, { limit, profileIds })  the same, for LalaVerse feed
 *     profiles with no content type yet (the Society tab's "0 in the Feed"),
 *     at most BATCH_MAX, one at a time (profileIds: only these); nothing is
 *     saved. → { unset, suggestions, failed, more }
 *   applyContentTypes(db, items)  [{ profile_id, name }] → saved, skipped.
 *   contentTypeBlock(current, occupation)  the prompt section.
 */

const {
  loadSocietyArchetypes, matchSocietyArchetype, societyArchetypeMenu,
} = require('./societyArchetypes');

const MODELS = ['claude-sonnet-4-6'];
const BATCH_MAX = 12;
const sentence = (s) => `${String(s).replace(/[.\s]+$/, '')}.`;
const text = (v, max = 600) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

class ContentTypeError extends Error {
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

const plain = (row) => (row && typeof row.get === 'function' ? row.get({ plain: true }) : row || null);

/** The archetype a stored name stands for; a name no longer on the list is kept as { name }. */
function currentOf(list, stored) {
  if (!stored) return null;
  return matchSocietyArchetype(list, stored) || { name: stored };
}

async function occupationOf(db, character, feedProfile) {
  if (!character) return null;
  try {
    const facts = await require('./characterFacts').factsOf(db, { character, feedProfile });
    return facts?.occupation && !(facts.undecided || []).includes('occupation') ? facts.occupation : null;
  } catch (err) {
    console.error('[characterContentType] their occupation could not be read:', err.message);
    return null;
  }
}

async function contentTypeOf(db, { character = null, feedProfile = null }) {
  const fp = plain(feedProfile);
  const list = await loadSocietyArchetypes(db);
  const current = currentOf(list, fp?.society_archetype);
  return {
    current,
    list,
    occupation: await occupationOf(db, character, feedProfile),
    profile: fp ? { id: fp.id, handle: fp.handle || null, display_name: fp.display_name || null, feed_layer: fp.feed_layer || null } : null,
  };
}

async function setContentType(db, { feedProfile, name }) {
  if (!feedProfile) throw new ContentTypeError(409, 'They are not on the feed yet: match them to a feed person first. The content type is kept on their feed profile.');
  let next = null;
  if (name !== null && name !== undefined && name !== '') {
    const found = matchSocietyArchetype(await loadSocietyArchetypes(db), name);
    if (!found) throw new ContentTypeError(400, `"${text(name, 100)}" is not on the Society tab's list of content types.`);
    next = found.name;
  }
  await feedProfile.update({ society_archetype: next });
  return next;
}

/** The prompt section: what they are known for, next to what they do for work. */
function contentTypeBlock(current, occupation = null) {
  if (!current?.name) return '';
  const more = [
    current.content && `What they post: ${sentence(current.content)}`,
    current.audience && `Their effect on their audience: ${sentence(current.audience)}`,
    current.narrative && `What they do in the story: ${sentence(current.narrative)}`,
  ].filter(Boolean).join(' ');
  const job = occupation
    ? ` Their job is ${occupation}. What they post and what they do for work can differ: where they do, that gap is part of who they are, not an error. Their posts come from the content type, and the job shows only the way it would in this kind of content.`
    : '';
  return `KNOWN FOR ON THE PULSE (their content type: what the LalaVerse knows them for, and what their posts are): ${current.name}.${more ? ` ${more}` : ''}${job}`;
}

async function ask(prompt) {
  let message;
  for (const model of MODELS) {
    try {
      message = await getClient().messages.create({ model, max_tokens: 500, messages: [{ role: 'user', content: prompt }] });
      break;
    } catch (modelErr) {
      console.warn(`[characterContentType] suggesting with ${model} failed:`, modelErr.message);
      if (model === MODELS[MODELS.length - 1]) throw modelErr;
    }
  }
  const raw = (message?.content?.[0]?.text || '').trim();
  try {
    return JSON.parse((raw.match(/\{[\s\S]*\}/) || [raw])[0]);
  } catch (err) {
    console.error('[characterContentType] the suggestion could not be read:', err.message);
    throw new ContentTypeError(502, 'The suggestion came back in a form that could not be read. Try again.');
  }
}

async function suggestContentType(db, { character = null, feedProfile = null, list = null }) {
  if (!feedProfile) throw new ContentTypeError(409, 'They are not on the feed yet: match them to a feed person first.');
  const archetypes = list || await loadSocietyArchetypes(db);
  if (!archetypes.length) throw new ContentTypeError(409, 'The Society tab has no content types saved.');
  const { characterFilePrompt } = require('./characterFile');
  const { file, block } = await characterFilePrompt(db, { character, feedProfile });
  if (!block) throw new ContentTypeError(409, 'There is nothing written about them yet to read their content from.');
  const occupation = await occupationOf(db, file.character || character, feedProfile);
  const fp = plain(feedProfile);
  const name = fp.display_name || file.character?.display_name || 'this creator';

  const prompt = `Everyone in the LalaVerse makes content on The Pulse. Decide what ${name} is KNOWN FOR there: the kind of content they post and are recognized for.

This is not their job. What they post can differ from what they do for work (a nurse known for comedy skits, a lawyer known for thrift hauls), and a gap like that makes a person interesting. Choose from what they show the world (the mask), their voice and their posts first; their job and their private life only as far as they shape what they post.
${occupation ? `Their job: ${occupation}.\n` : ''}${fp.archetype ? `How they behave online (a different list, not a content type): ${fp.archetype}.\n` : ''}
${block}
${societyArchetypeMenu(archetypes)}

Answer with JSON only:
{"society_archetype": "the name exactly as written above", "why": "two sentences: what in their file makes this what they are known for", "differs_from_job": true or false, "tension": "when it differs: one sentence on what the gap between their job and their content says about them; else null"}`;

  const parsed = await ask(prompt);
  const archetype = matchSocietyArchetype(archetypes, parsed.society_archetype || parsed.name);
  if (!archetype) throw new ContentTypeError(502, 'The suggestion named no content type on the list. Try again.');
  const differs = parsed.differs_from_job === true;
  return {
    suggestion: {
      name: archetype.name,
      why: text(parsed.why) || null,
      differs_from_job: differs,
      tension: differs ? (text(parsed.tension, 400) || null) : null,
    },
    archetype,
  };
}

async function suggestForUnset(db, { limit = BATCH_MAX, profileIds = null } = {}) {
  const n = Math.max(1, Math.min(BATCH_MAX, Number(limit) || BATCH_MAX));
  const where = { feed_layer: 'lalaverse', society_archetype: null };
  if (Array.isArray(profileIds) && profileIds.length) where.id = profileIds.slice(0, 100);
  const unset = await db.SocialProfile.count({ where });
  const profiles = await db.SocialProfile.findAll({ where, order: [['created_at', 'ASC']], limit: n });
  const list = await loadSocietyArchetypes(db);
  const suggestions = [];
  const failed = [];
  for (const fp of profiles) {
    const who = { profile_id: fp.id, handle: fp.handle || null, display_name: fp.display_name || null };
    try {
      const character = db.RegistryCharacter
        ? await db.RegistryCharacter.findOne({ where: { feed_profile_id: fp.id }, order: [['updated_at', 'DESC']] })
        : null;
      const { suggestion } = await suggestContentType(db, { character, feedProfile: fp, list });
      suggestions.push({ ...who, character_id: character?.id || null, ...suggestion });
    } catch (err) {
      console.error(`[characterContentType] no suggestion for profile ${fp.id}:`, err.message);
      failed.push({ ...who, error: err instanceof ContentTypeError ? err.message : 'The suggestion failed. Try again.' });
    }
  }
  return { unset, suggestions, failed, more: Math.max(0, unset - profiles.length) };
}

async function applyContentTypes(db, items) {
  if (!Array.isArray(items) || !items.length) throw new ContentTypeError(400, 'Nothing to save: send items as [{ profile_id, name }].');
  if (items.length > 100) throw new ContentTypeError(400, 'Save at most 100 at a time.');
  const list = await loadSocietyArchetypes(db);
  const saved = [];
  const skipped = [];
  for (const item of items) {
    const archetype = matchSocietyArchetype(list, item?.name);
    if (!archetype) { skipped.push({ profile_id: item?.profile_id || null, error: 'not on the list' }); continue; }
    const fp = item?.profile_id ? await db.SocialProfile.findByPk(item.profile_id) : null;
    if (!fp) { skipped.push({ profile_id: item?.profile_id || null, error: 'profile not found' }); continue; }
    await fp.update({ society_archetype: archetype.name });
    saved.push({ profile_id: fp.id, name: archetype.name });
  }
  return { saved, skipped };
}

module.exports = {
  ContentTypeError,
  contentTypeOf,
  setContentType,
  suggestContentType,
  suggestForUnset,
  applyContentTypes,
  contentTypeBlock,
  BATCH_MAX,
};
