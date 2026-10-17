'use strict';

/**
 * The character file: one source every character generator reads (Evoni,
 * 2026-10-17: "are the generators all in communication with each other so
 * each character is enhanced and very well thought of"; the spec's Piece 1
 * "portable character file"). Before it, each generator assembled its own
 * slice: the facts here, the typology there, relationships in one place,
 * recent posts in another, so a section written by one never knew what
 * another had decided.
 *
 *   loadCharacterFile(db, { character, feedProfile })  the file, from the
 *     registry character (its feed profile loaded when not given) or from a
 *     feed profile alone (its registry character found by feed_profile_id).
 *     Never throws: a part that cannot be read is left out and logged.
 *       { character, feedProfile, facts, typology, inner, mask, behind,
 *         relationships, events, recentPosts }
 *   characterFileBlock(file)   the prompt block: facts (characterFacts
 *     factsPromptBlock), the typology seed, then each part under a heading
 *     that says which zone it belongs to: the inner life (author-only), the
 *     mask (what they show, true or not), behind it (what is actually
 *     true), the people in their life, their events, their latest posts.
 *     '' when there is nothing. { publicOnly }: only what the public sees
 *     (facts, mask, events, posts), for a generator that writes from the
 *     public face alone (the voice build).
 *   characterFilePrompt(db, { character, feedProfile, publicOnly })  both at once:
 *     { facts, block } (facts for holdToFacts and isDecided).
 */

const INNER_KEYS = ['want_architecture', 'core_desire', 'core_fear', 'core_wound', 'wound', 'hidden_want', 'the_mask', 'living_state'];
const CHARACTER_MASK_KEYS = ['mask_persona', 'self_narrative'];
const PROFILE_MASK_KEYS = ['public_persona', 'content_persona', 'lifestyle_claim'];
const BEHIND_KEYS = [['truth_persona', 'character'], ['private_reality', 'profile'], ['lifestyle_reality', 'profile'], ['real_signal', 'profile']];
const MAX_RELATIONSHIPS = 10;
const MAX_POSTS = 5;
const CLIP = 320;

const clip = (v, max = CLIP) => {
  if (v === null || v === undefined || v === '') return '';
  const s = (typeof v === 'string' ? v : JSON.stringify(v)).replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
};
const label = (k) => k.replace(/_/g, ' ');
const plain = (row) => (row && typeof row.get === 'function' ? row.get({ plain: true }) : row || null);

async function part(name, read, fallback) {
  try {
    return await read();
  } catch (err) {
    console.error(`[characterFile] ${name} could not be read:`, err.message);
    return fallback;
  }
}

async function loadCharacterFile(db, { character = null, feedProfile } = {}) {
  let c = plain(character);
  let fp = feedProfile === undefined ? undefined : plain(feedProfile);
  if (!c && fp?.id && db.RegistryCharacter) {
    c = plain(await part('the registry character', () => db.RegistryCharacter.findOne({ where: { feed_profile_id: fp.id }, order: [['updated_at', 'DESC']] }), null));
  }
  if (fp === undefined) {
    fp = c?.feed_profile_id && db.SocialProfile
      ? plain(await part('the feed profile', () => db.SocialProfile.findByPk(c.feed_profile_id), null))
      : null;
  }
  const file = {
    character: c, feedProfile: fp, facts: null, typology: c?.typology || null,
    inner: {}, mask: {}, behind: {}, relationships: [], events: [], recentPosts: [],
  };
  if (!c && !fp) return file;

  if (c) {
    const { factsOf } = require('./characterFacts');
    file.facts = await part('the facts', () => factsOf(db, { character: c, feedProfile: fp || null }), null);
    for (const k of INNER_KEYS) if (clip(c[k])) file.inner[k] = clip(c[k]);
    for (const k of CHARACTER_MASK_KEYS) if (clip(c[k])) file.mask[k] = clip(c[k]);
  }
  for (const k of PROFILE_MASK_KEYS) if (clip(fp?.[k])) file.mask[k] = clip(fp[k]);
  for (const [k, from] of BEHIND_KEYS) {
    const v = from === 'character' ? c?.[k] : fp?.[k];
    if (clip(v)) file.behind[k] = clip(v);
  }

  if (c?.id) {
    file.relationships = await part('the relationships', async () => {
      const [rows] = await db.sequelize.query(
        `SELECT CASE WHEN cr.character_id_a = :id THEN rb.display_name ELSE ra.display_name END AS person,
                cr.relationship_type AS kind, cr.status,
                CASE WHEN cr.character_id_a = :id THEN cr.source_knows ELSE cr.target_knows END AS knows
           FROM character_relationships cr
           JOIN registry_characters ra ON ra.id = cr.character_id_a AND ra.deleted_at IS NULL
           JOIN registry_characters rb ON rb.id = cr.character_id_b AND rb.deleted_at IS NULL
          WHERE cr.confirmed = true AND (cr.character_id_a = :id OR cr.character_id_b = :id)
          ORDER BY cr.created_at ASC
          LIMIT ${MAX_RELATIONSHIPS}`, { replacements: { id: c.id } });
      return rows.map((r) => ({ person: r.person || 'someone', kind: r.kind || null, status: r.status || null, knows: clip(r.knows, 200) || null }));
    }, []);
  }
  if (fp?.id) {
    file.events = await part('the events', () => require('./characterEvents').eventsForProfile(db.sequelize, fp.id), []);
    file.recentPosts = await part('the recent posts', async () => {
      const [rows] = await db.sequelize.query(
        `SELECT content_text FROM feed_posts
          WHERE social_profile_id = :pid AND status = 'live' AND deleted_at IS NULL AND content_text IS NOT NULL AND content_text <> ''
          ORDER BY COALESCE(posted_at, created_at) DESC LIMIT ${MAX_POSTS}`, { replacements: { pid: fp.id } });
      return rows.map((r) => clip(r.content_text, 200));
    }, []);
  }
  return file;
}

const lines = (obj) => Object.entries(obj).map(([k, v]) => `- ${label(k)}: ${v}`).join('\n');

function characterFileBlock(file, { publicOnly = false } = {}) {
  if (!file || (!file.character && !file.feedProfile)) return '';
  const { factsPromptBlock } = require('./characterFacts');
  const { seedBlock } = require('./characterTypology');
  // Their chosen name, as the tab and every generator's instruction name them
  // (sixth audit: "Sable's home" over "THE CHARACTER FILE for The Rival").
  const name = file.character?.selected_name || file.character?.display_name || file.feedProfile?.display_name || null;
  const sections = [
    file.facts ? factsPromptBlock(file.facts) : '',
    publicOnly ? '' : seedBlock(file.typology),
    !publicOnly && Object.keys(file.inner).length ? `INNER LIFE (author-only: it drives them; they never say it outright):\n${lines(file.inner)}` : '',
    Object.keys(file.mask).length ? `THE MASK (what they show the world, true or not; their public voice comes from here):\n${lines(file.mask)}` : '',
    !publicOnly && Object.keys(file.behind).length ? `BEHIND THE MASK (what is actually true; the public does not see it, and a gap between this and the mask is intentional, not an error):\n${lines(file.behind)}` : '',
    !publicOnly && file.relationships.length ? `PEOPLE IN THEIR LIFE (confirmed relationships; stay consistent with them):\n${file.relationships.map((r) => `- ${r.person}${r.kind ? ` (${r.kind}${r.status && r.status !== 'Active' ? `, ${r.status.toLowerCase()}` : ''})` : ''}${r.knows ? `: privately knows ${r.knows}` : ''}`).join('\n')}` : '',
    file.events.length ? `THEIR EVENTS:\n${require('./characterEvents').eventsPromptLines(file.events)}` : '',
    file.recentPosts.length ? `THEIR LATEST POSTS ON THE PULSE (what the public has already seen of them):\n${file.recentPosts.map((t) => `- ${t}`).join('\n')}` : '',
  ].filter(Boolean);
  if (!sections.length) return '';
  return `THE CHARACTER FILE${name ? ` for ${name}` : ''} (one source every generator reads: what you write agrees with all of it and never contradicts it):\n\n${sections.join('\n\n')}`;
}

async function characterFilePrompt(db, { publicOnly = false, ...opts } = {}) {
  const file = await loadCharacterFile(db, opts);
  return { file, facts: file.facts, block: characterFileBlock(file, { publicOnly }) };
}

module.exports = { loadCharacterFile, characterFileBlock, characterFilePrompt, INNER_KEYS, PROFILE_MASK_KEYS };
