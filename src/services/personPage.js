'use strict';

/**
 * One person page (Evoni, 2026-10-23: "one person page": story details,
 * Pulse account, relationships, family and episode history in one place;
 * then "shouldn't this information be in other tabs instead of creating a
 * new one?"). The character page reads it in one call (GET
 * /api/v1/person/:id, routes/person.js) and shows each part in the tab it
 * belongs to (components/PersonPage):
 *
 *   who            name, the name they post under, also-known-as names
 *                  (social_profiles.aliases, where the column exists), role,
 *                  a one-line summary
 *   pulse          their Pulse account (registry_characters.feed_profile_id):
 *                  handle, follower tier and count, their tie to Lala (the
 *                  Lala story pair decides it, services/relationshipTruth),
 *                  or null when they have none
 *   relationships  every confirmed story pair: the other person, its kind,
 *                  current stage, love interest, who knows
 *                  (services/relationshipKnowers) and whether the Pulse pair
 *                  says something else (relationshipTruth pulseKindFor)
 *   episodes       the episodes they are in, newest first, from the story
 *                  records' cast, the relationship events an episode wrote,
 *                  and the events they host or are a guest of; each with
 *                  their row in the story record (knew / learned / changed)
 *   writers        the lines the episode script writer reads about them,
 *                  made by the script writer's own functions
 *
 * Family is the Family section's own read (routes/families). Reads only.
 */

const { lalaStoryTies, lalaTieFields, pulseKindFor, storyCategory, storyWords, tieWords } = require('./relationshipTruth');
const { whoKnows, relationshipSecrecyLines } = require('./relationshipKnowers');
const { familyLines } = require('./familyTies');
const { eventsForProfile } = require('./characterEvents');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_EPISODES = 60;
const nameSql = (alias) => `COALESCE(NULLIF(${alias}.selected_name, ''), ${alias}.display_name)`;
const words = (v) => (v == null || v === '' ? null : String(v).replace(/_/g, ' '));
const clean = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

/** The first sentence of their prose, description or core belief, at most 200 characters. */
function summaryOf(c) {
  const text = clean(c.prose_overview) || clean(c.description) || clean(c.core_belief);
  if (!text) return null;
  const first = (text.match(/^.+?[.!?](?=\s|$)/) || [text])[0];
  return first.length > 200 ? `${first.slice(0, 199).trimEnd()}…` : first;
}

/** Their also-known-as names: social_profiles.aliases where the column exists ([] before its migration). */
async function aliasesOf(sequelize, profileId) {
  if (profileId == null) return [];
  try {
    const [[col]] = await sequelize.query(
      "SELECT 1 AS ok FROM information_schema.columns WHERE table_name = 'social_profiles' AND column_name = 'aliases' LIMIT 1");
    if (!col) return [];
    const [[row]] = await sequelize.query('SELECT aliases FROM social_profiles WHERE id = :id', { replacements: { id: profileId } });
    const list = Array.isArray(row?.aliases) ? row.aliases : [];
    return [...new Set(list.map(clean).filter(Boolean))];
  } catch (err) {
    console.error('[personPage] aliases could not be read:', err.message);
    return [];
  }
}

const STATE_LABEL = { secret: 'Secret', rumoured: 'Rumoured', known: 'Known' };

/**
 * Every confirmed story pair of theirs, newest first, each with the other
 * person, its words, stage, love interest, who knows and what the Pulse says.
 */
async function relationshipsOf(sequelize, characterId) {
  const [rows] = await sequelize.query(
    `SELECT cr.id, cr.character_id_a, cr.character_id_b, cr.relationship_type, cr.status, cr.is_romantic,
            cr.family_role, cr.is_blood_relation, cr.role_tag, cr.situation, cr.updated_at,
            st.relationship_stage AS stage,
            CASE WHEN cr.character_id_a = :id THEN cr.character_id_b ELSE cr.character_id_a END AS other_id,
            CASE WHEN cr.character_id_a = :id THEN ${nameSql('cb')} ELSE ${nameSql('ca')} END AS other_name,
            CASE WHEN cr.character_id_a = :id THEN cb.feed_profile_id ELSE ca.feed_profile_id END AS other_profile,
            CASE WHEN cr.character_id_a = :id THEN ca.feed_profile_id ELSE cb.feed_profile_id END AS my_profile
       FROM character_relationships cr
       JOIN registry_characters ca ON ca.id = cr.character_id_a AND ca.deleted_at IS NULL
       JOIN registry_characters cb ON cb.id = cr.character_id_b AND cb.deleted_at IS NULL
       LEFT JOIN LATERAL (
         SELECT e.relationship_stage FROM relationship_events e
          WHERE e.relationship_id = cr.id AND e.relationship_stage IS NOT NULL AND e.relationship_stage <> '' AND e.deleted_at IS NULL
          ORDER BY e.created_at DESC NULLS LAST LIMIT 1
       ) st ON true
      WHERE cr.deleted_at IS NULL AND cr.confirmed = true AND (cr.character_id_a = :id OR cr.character_id_b = :id)
      ORDER BY cr.updated_at DESC`, { replacements: { id: characterId } });
  if (!rows.length) return [];

  const knowers = await whoKnows(sequelize, rows.map((r) => r.id));
  // The Pulse pairs between the same two profiles, either way round.
  const pairs = rows.filter((r) => r.my_profile && r.other_profile && Number(r.my_profile) !== Number(r.other_profile));
  let pulses = [];
  if (pairs.length) {
    const mine = Number(pairs[0].my_profile);
    try {
      [pulses] = await sequelize.query(
        `SELECT spr.id, spr.source_profile_id, spr.target_profile_id, spr.relationship_type::text AS relationship_type,
                spr.public_visibility::text AS public_visibility, spr.character_relationship_id
           FROM social_profile_relationships spr
          WHERE (spr.source_profile_id = :mine AND spr.target_profile_id IN (:others))
             OR (spr.target_profile_id = :mine AND spr.source_profile_id IN (:others))`,
        { replacements: { mine, others: pairs.map((r) => Number(r.other_profile)) } });
    } catch (err) {
      console.error('[personPage] the Pulse pairs could not be read:', err.message);
    }
  }

  return rows.map((r) => {
    const category = storyCategory(r);
    const known = knowers.get(String(r.id));
    const online = r.other_profile
      ? pulses.filter((p) => [Number(p.source_profile_id), Number(p.target_profile_id)].includes(Number(r.other_profile)))
      : [];
    const kind = pulseKindFor(r);
    // As on the drift report: the Pulse disagrees when it has the pair and
    // none of its kinds fits the story's.
    const differs = Boolean(kind && online.length && !online.some((p) => kind.fits.includes(p.relationship_type)));
    const state = known?.public_state || null;
    return {
      id: r.id,
      other: { id: r.other_id, name: r.other_name || 'someone' },
      kind: words(r.family_role || r.relationship_type) || words(category) || 'connected',
      category,
      words: storyWords(r),
      stage: words(r.stage),
      status: r.status || null,
      love_interest: Boolean(r.is_romantic) || category === 'romance',
      public_state: state,
      public_label: state ? STATE_LABEL[state] : null,
      known_by: (known?.knowers || []).map((k) => k.name),
      online: online.length ? {
        differs,
        says: online.map((p) => `${words(p.relationship_type)}${p.public_visibility && p.public_visibility !== 'public' ? ` (${p.public_visibility})` : ''}`).join(', '),
      } : null,
      link: `/relationships?rel=${r.id}`,
    };
  });
}

/**
 * The episodes they are in, newest first: from the story records that list
 * them, the relationship events an episode wrote for them, and the events
 * they host or are a guest of. Each: { id, episode_number, title, show_id,
 * via: [...], record: { status, knew, learned, changed } | null,
 * changes: [{ relationship_id, with, stage, note }], link }.
 */
async function episodesOf(sequelize, characterId, profileId) {
  const byId = new Map();
  const add = (id, via) => {
    if (!UUID_RE.test(String(id || ''))) return null;
    if (!byId.has(id)) byId.set(id, { id, via: new Set(), record: null, changes: [], events: [] });
    const e = byId.get(id);
    if (via) e.via.add(via);
    return e;
  };

  // 1. The story records that have a row for them.
  try {
    const [recs] = await sequelize.query(
      `SELECT r.episode_id, r.status, c.value AS me
         FROM episode_story_records r
         CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(r.characters) = 'array' THEN r.characters ELSE '[]'::jsonb END) c
        WHERE r.deleted_at IS NULL AND c.value->>'character_id' = :id`, { replacements: { id: String(characterId) } });
    for (const r of recs) {
      const e = add(r.episode_id, 'story record');
      if (!e) continue;
      e.record = {
        status: r.status || 'draft',
        knew: clean(r.me?.knew) || null, learned: clean(r.me?.learned) || null, changed: clean(r.me?.changed) || null,
      };
    }
  } catch (err) {
    console.error('[personPage] the story records could not be read:', err.message);
  }

  // 2. What an episode changed in their relationships (relationship_events.metadata.episode_id).
  try {
    const [evs] = await sequelize.query(
      `SELECT e.metadata->>'episode_id' AS episode_id, e.relationship_id, e.relationship_stage, e.description, e.metadata->>'stage_before' AS stage_before,
              CASE WHEN cr.character_id_a = :id THEN ${nameSql('cb')} ELSE ${nameSql('ca')} END AS other_name
         FROM relationship_events e
         JOIN character_relationships cr ON cr.id = e.relationship_id AND cr.deleted_at IS NULL
         JOIN registry_characters ca ON ca.id = cr.character_id_a
         JOIN registry_characters cb ON cb.id = cr.character_id_b
        WHERE e.deleted_at IS NULL AND (cr.character_id_a = :id OR cr.character_id_b = :id)
          AND e.metadata->>'episode_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        ORDER BY e.created_at ASC`, { replacements: { id: characterId } });
    for (const r of evs) {
      const e = add(r.episode_id, 'relationship');
      if (!e) continue;
      const stage = r.relationship_stage
        ? (r.stage_before && r.stage_before !== r.relationship_stage ? `${words(r.stage_before)} → ${words(r.relationship_stage)}` : words(r.relationship_stage))
        : null;
      e.changes.push({ relationship_id: r.relationship_id, with: r.other_name || 'someone', stage, note: clean(r.description) || null });
    }
  } catch (err) {
    console.error('[personPage] the relationship events could not be read:', err.message);
  }

  // 3. The events they host or are a guest of, through their Pulse profile.
  if (profileId != null) {
    try {
      for (const ev of await eventsForProfile(sequelize, profileId)) {
        if (!ev.episode_id) continue;
        const e = add(ev.episode_id, ev.role === 'host' ? 'host' : 'guest');
        if (e) e.events.push({ id: ev.id, name: ev.name, role: ev.role });
      }
    } catch (err) {
      console.error('[personPage] their events could not be read:', err.message);
    }
  }

  if (!byId.size) return [];
  const [eps] = await sequelize.query(
    `SELECT id, show_id, episode_number, title, created_at FROM episodes
      WHERE id IN (:ids) AND deleted_at IS NULL
      ORDER BY episode_number DESC NULLS LAST, created_at DESC
      LIMIT ${MAX_EPISODES}`, { replacements: { ids: [...byId.keys()] } });
  return eps.map((ep) => {
    const e = byId.get(ep.id);
    return {
      id: ep.id, show_id: ep.show_id || null,
      episode_number: ep.episode_number == null ? null : Number(ep.episode_number),
      title: ep.title || null,
      via: [...e.via],
      record: e.record,
      changes: e.changes,
      events: e.events,
      link: `/episodes/${ep.id}`,
    };
  });
}

/**
 * The lines the episode script writer reads about them, made by its own
 * functions (services/episodeScriptWriterService): their Lala lines in the
 * cast block (lalaTieLines over lalaTieFields and lalaRomances), the family
 * block (familyLines, familyBlock) and the who-knows lines
 * (relationshipSecrecyLines). The cast block reads people through their
 * Pulse profile, so with none only the who-knows lines reach a script.
 */
async function writersPreview(sequelize, character, profile) {
  const sw = require('./episodeScriptWriterService');
  const id = character.id;
  const ties = await lalaStoryTies(sequelize, [id]);
  const p = { ...lalaTieFields({ lala_relationship: profile?.lala_relationship ?? null }, ties.get(id)) };
  const romances = await sw.lalaRomances(sequelize, [id]);
  if (romances.has(id)) p.lala_romance = romances.get(id);
  const lala = sw.lalaTieLines(p);
  const family = await familyLines(sequelize, [id]);
  const secrecy = await relationshipSecrecyLines(sequelize, [id]);
  return {
    in_cast_block: Boolean(profile),
    lala: [lala.story, lala.withLala].filter(Boolean),
    family,
    family_block: sw.familyBlock(family).trim() || null,
    secrecy,
  };
}

class PersonError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/** Everything the character page's tabs add about them, in one read. A PersonError(404) when there is no such character. */
async function personPage(sequelize, characterId) {
  if (!UUID_RE.test(String(characterId || ''))) throw new PersonError(400, 'id must be a character id (UUID)');
  const [[c]] = await sequelize.query(
    `SELECT id, character_key, display_name, selected_name, role_type, role_label, portrait_url,
            prose_overview, description, core_belief, feed_profile_id, status
       FROM registry_characters WHERE id = :id AND deleted_at IS NULL`, { replacements: { id: characterId } });
  if (!c) throw new PersonError(404, 'Character not found');

  let profile = null;
  if (c.feed_profile_id != null) {
    [[profile]] = await sequelize.query(
      `SELECT id, handle, display_name, creator_name, platform, feed_layer, follower_tier::text AS follower_tier,
              follower_count_approx, lala_relationship::text AS lala_relationship
         FROM social_profiles WHERE id = :pid AND deleted_at IS NULL`, { replacements: { pid: c.feed_profile_id } });
  }
  const isLala = String(c.character_key || '').toLowerCase() === 'lala';
  let lalaTie = null;
  if (!isLala) {
    const story = (await lalaStoryTies(sequelize, [c.id])).get(c.id);
    if (story) lalaTie = { from: 'story', tie: story.tie, words: story.words };
    else if (profile?.lala_relationship) lalaTie = { from: 'pulse', tie: profile.lala_relationship, words: tieWords(profile.lala_relationship) };
  }

  const name = clean(c.selected_name) || clean(c.display_name) || 'Unnamed';
  return {
    id: c.id,
    who: {
      name,
      online_as: profile?.display_name && profile.display_name !== name ? profile.display_name
        : c.display_name && c.display_name !== name ? c.display_name : null,
      aliases: (await aliasesOf(sequelize, profile?.id)).filter((a) => a !== name),
      role_type: c.role_type || null,
      role_label: c.role_label || null,
      is_lala: isLala,
      summary: summaryOf(c),
      portrait_url: c.portrait_url || null,
    },
    pulse: profile ? {
      id: profile.id,
      handle: profile.handle || null,
      display_name: profile.display_name || null,
      platform: profile.platform || null,
      follower_tier: profile.follower_tier || null,
      follower_count: profile.follower_count_approx || null,
      lala_tie: lalaTie,
      link: `/pulse?profile=${profile.id}`,
    } : null,
    lala_tie: lalaTie,
    relationships: await relationshipsOf(sequelize, c.id),
    episodes: await episodesOf(sequelize, c.id, profile?.id ?? null),
    writers: await writersPreview(sequelize, c, profile),
  };
}

module.exports = { personPage, writersPreview, relationshipsOf, episodesOf, summaryOf, PersonError };
