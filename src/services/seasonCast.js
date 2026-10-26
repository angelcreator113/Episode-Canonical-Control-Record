'use strict';

/**
 * Who's in this season (the Season page's Cast tab; Evoni, 2026-10-25:
 * "What else can we improve on the Season page?" … "I want them all";
 * 2026-10-26: "Start the Season page round 3"). Plain counting over what
 * the app already saved, no AI call:
 *
 *   who appears where  each slot's event: its host (utils/eventOrganizer:
 *                      source_profile_id, else the automation copy's
 *                      host_profile_id) and guests (automation
 *                      guest_profiles), each a Feed profile joined to the
 *                      registry character linked to it (utils/registryLink);
 *                      and each slot episode's approved Episode Story
 *                      Record's `characters` (services/episodeStoryRecord).
 *                      The episode's event is the brief's (utils/episodeEventSql),
 *                      else the slot's pencilled event.
 *   what changed       per part, the relationship changes saved for the
 *                      season's episodes: relationship_events rows whose
 *                      metadata.episode_id is one of them (what "Save" on the
 *                      What changed card writes), and an approved record's
 *                      kept relationships that were not written (a person not
 *                      in the registry), once per pair per episode.
 *
 *   seasonCast(sequelize, showId, { arcId })  { arc, season_number, slots, people, parts }
 *   castFrom({ ... })                         pure, for the tests
 *
 * people  [{ key, name, character_id, profile_id, is_lala, slots: [n], roles: { n: 'host'|'guest'|'story' } }],
 *         most episodes first; character_id links the person page (/character/:id)
 * parts   [{ phase, title, episode_start, episode_end, changes: [{ slot_number, a, b, type, stage_before,
 *         stage_after, note, source: 'saved'|'record' }] }]
 *
 * arcId: another season's (?season=N, the caller checks it is this show's);
 * without it the season in progress, else the latest (as the twists read).
 * Reads only. Missing tables (an older database) read as empty, logged.
 */

const { loadSeason } = require('./seasonLoader');
const { arcPhases } = require('./seasonSlotService');
const { eventCreatorOrganizer } = require('../utils/eventOrganizer');
const { LINKED_CHARACTER_JOIN } = require('../utils/registryLink');
const { episodeEventIdSql } = require('../utils/episodeEventSql');

const ROLE_RANK = { host: 0, guest: 1, story: 2 };

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (err) {
    console.error('[seasonCast] a JSON field could not be read:', err.message);
    return fallback;
  }
}

const automationOf = (event) => {
  const cc = parseJson(event?.canon_consequences, {}) || {};
  return cc.automation && typeof cc.automation === 'object' ? cc.automation : {};
};

/** The Feed profile ids an event names: { host, guests }. */
function eventPeople(event) {
  if (!event) return { host: null, guests: [] };
  const host = eventCreatorOrganizer(event)?.profileId ?? null;
  // g.id is the older guest shape (Task #1686); profile_id is preferred.
  const guests = (Array.isArray(automationOf(event).guest_profiles) ? automationOf(event).guest_profiles : [])
    .map((g) => g?.profile_id ?? g?.id).filter((v) => v != null && String(v) !== String(host));
  return { host, guests: [...new Set(guests.map(String))] };
}

/**
 * The cast from what was read (pure):
 *   arc         the arc row (phases as stored or parsed)
 *   slots       [{ slot_number, phase, episode_id, event }]   event: the world_events row or null
 *   profiles    Map(String(profile id) → { name, character_id })
 *   records     [{ episode_id, characters, relationships }]   approved records only
 *   relEvents   [{ episode_id, a_id, b_id, a_name, b_name, relationship_type, stage_before, stage_after, note }]
 *   lalaId      Lala's registry id, or null
 */
function castFrom({ arc = null, slots = [], profiles = new Map(), records = [], relEvents = [], lalaId = null } = {}) {
  const people = new Map();
  const slotByEpisode = new Map(slots.filter((s) => s.episode_id).map((s) => [String(s.episode_id), s]));
  const touch = ({ key, name, character_id = null, profile_id = null }, slotNumber, role) => {
    if (!key || !name) return;
    let p = people.get(key);
    if (!p) {
      p = { key, name, character_id, profile_id, is_lala: Boolean(lalaId && character_id && String(character_id) === String(lalaId)), roles: {} };
      people.set(key, p);
    }
    if (!p.character_id && character_id) p.character_id = character_id;
    const was = p.roles[slotNumber];
    if (!was || ROLE_RANK[role] < ROLE_RANK[was]) p.roles[slotNumber] = role;
  };
  // A profile counts as its registry character when one is linked, so the
  // event's guest and the record's character are one person.
  const fromProfile = (profileId) => {
    const prof = profiles.get(String(profileId));
    if (!prof) return null;
    return { key: prof.character_id ? String(prof.character_id) : `profile:${profileId}`, name: prof.name, character_id: prof.character_id || null, profile_id: Number(profileId) };
  };

  for (const s of slots) {
    const { host, guests } = eventPeople(s.event);
    if (host != null) { const p = fromProfile(host); if (p) touch(p, s.slot_number, 'host'); }
    for (const g of guests) { const p = fromProfile(g); if (p) touch(p, s.slot_number, 'guest'); }
  }
  for (const r of records) {
    const slot = slotByEpisode.get(String(r.episode_id));
    if (!slot) continue;
    for (const c of parseJson(r.characters, []) || []) {
      const id = c?.character_id ? String(c.character_id) : null;
      if (!id || !c.name) continue;
      // A record names an unlinked guest as profile:<id>.
      const key = id === 'lala' && lalaId ? String(lalaId) : id;
      touch({ key, name: c.name, character_id: /^profile:/.test(key) || key === 'lala' ? null : key }, slot.slot_number, 'story');
    }
  }

  const peopleOut = [...people.values()].map((p) => {
    const nums = Object.keys(p.roles).map(Number).sort((a, b) => a - b);
    return { ...p, slots: nums };
  }).sort((a, b) => Number(b.is_lala) - Number(a.is_lala) || b.slots.length - a.slots.length || a.name.localeCompare(b.name));

  // What changed, once per pair per episode: a saved row wins over the record's own line.
  const changes = [];
  const seen = new Set();
  const pairKey = (episodeId, a, b) => `${episodeId}|${[String(a), String(b)].sort().join('|')}`;
  for (const e of relEvents) {
    const slot = slotByEpisode.get(String(e.episode_id));
    if (!slot) continue;
    const k = pairKey(e.episode_id, e.a_id, e.b_id);
    if (seen.has(k)) continue;
    seen.add(k);
    changes.push({
      slot_number: slot.slot_number, phase: Number(slot.phase), source: 'saved',
      a: { id: e.a_id || null, name: e.a_name || '?' }, b: { id: e.b_id || null, name: e.b_name || '?' },
      type: e.relationship_type || null, stage_before: e.stage_before || null, stage_after: e.stage_after || null, note: e.note || null,
    });
  }
  for (const r of records) {
    const slot = slotByEpisode.get(String(r.episode_id));
    if (!slot) continue;
    for (const rel of parseJson(r.relationships, []) || []) {
      if (!rel || rel.keep === false || !rel.a || !rel.b) continue;
      const k = pairKey(r.episode_id, rel.a, rel.b);
      if (seen.has(k)) continue;
      seen.add(k);
      const link = (id) => (/^profile:/.test(String(id)) || id === 'lala' ? null : id);
      changes.push({
        slot_number: slot.slot_number, phase: Number(slot.phase), source: 'record',
        a: { id: link(rel.a), name: rel.a_name || '?' }, b: { id: link(rel.b), name: rel.b_name || '?' },
        type: rel.type || null, stage_before: rel.stage_before || null, stage_after: rel.stage_after || null, note: rel.note || null,
      });
    }
  }
  changes.sort((x, y) => x.slot_number - y.slot_number || x.a.name.localeCompare(y.a.name));

  const parts = arcPhases(arc).map((p) => ({
    phase: Number(p.phase),
    title: p.title || null,
    episode_start: Number(p.episode_start),
    episode_end: Number(p.episode_end),
    changes: changes.filter((c) => c.phase === Number(p.phase)).map(({ phase, ...c }) => c),
  }));

  return {
    arc: arc ? { id: arc.id, title: arc.title, season_number: Number(arc.season_number) || 1 } : null,
    season_number: arc ? Number(arc.season_number) || 1 : null,
    slots: slots.map((s) => ({ slot_number: s.slot_number, phase: Number(s.phase), episode_id: s.episode_id || null, event_name: s.event?.name || null })),
    people: peopleOut,
    parts,
  };
}

async function rowsOf(sequelize, sql, replacements, label) {
  try {
    const [rows] = await sequelize.query(sql, { replacements });
    return rows;
  } catch (err) {
    console.error(`[seasonCast] ${label} could not be read:`, err.message);
    return [];
  }
}

async function seasonCast(sequelize, showId, { arcId = null } = {}) {
  const season = await loadSeason(sequelize, showId, arcId ? { arcId } : { anyStatus: true });
  if (!season) return { arc: null, season_number: null, slots: [], people: [], parts: [] };
  const { arc } = season;

  // Each slot's event: the episode's (the brief's, else the stamp), else the pencilled one.
  const slotRows = await rowsOf(sequelize,
    `SELECT s.slot_number, s.phase, ep.id AS episode_id, ev.id AS event_id, ev.name, ev.source_profile_id, ev.canon_consequences
       FROM season_slots s
       LEFT JOIN episodes ep ON ep.id = s.episode_id AND ep.deleted_at IS NULL
       LEFT JOIN world_events ev ON ev.deleted_at IS NULL
            AND ev.id = COALESCE(CASE WHEN ep.id IS NOT NULL THEN ${episodeEventIdSql('ep.id')} END, s.event_id)
      WHERE s.arc_id = :arcId AND s.deleted_at IS NULL
      ORDER BY s.slot_number`, { arcId: arc.id }, 'the slots\' events');
  const slots = slotRows.map((r) => ({
    slot_number: Number(r.slot_number), phase: Number(r.phase), episode_id: r.episode_id || null,
    event: r.event_id ? { id: r.event_id, name: r.name, source_profile_id: r.source_profile_id, canon_consequences: r.canon_consequences } : null,
  }));

  const profileIds = [...new Set(slots.flatMap((s) => { const p = eventPeople(s.event); return [p.host, ...p.guests]; })
    .filter((v) => v != null && /^\d+$/.test(String(v))).map(Number))];
  const profiles = new Map();
  if (profileIds.length) {
    const rows = await rowsOf(sequelize,
      `SELECT sp.id AS profile_id, COALESCE(rc.selected_name, rc.display_name, sp.display_name, sp.handle) AS name, rc.id AS character_id
         FROM social_profiles sp ${LINKED_CHARACTER_JOIN}
        WHERE sp.id IN (:ids) AND sp.deleted_at IS NULL`, { ids: profileIds }, 'the event cast');
    for (const r of rows) profiles.set(String(r.profile_id), { name: r.name, character_id: r.character_id || null });
  }

  const episodeIds = slots.map((s) => s.episode_id).filter(Boolean);
  const records = episodeIds.length ? await rowsOf(sequelize,
    `SELECT episode_id, characters, relationships FROM episode_story_records
      WHERE episode_id IN (:ids) AND deleted_at IS NULL AND status = 'approved'`, { ids: episodeIds }, 'the story records') : [];
  const relEvents = episodeIds.length ? await rowsOf(sequelize,
    `SELECT re.metadata->>'episode_id' AS episode_id, re.relationship_stage AS stage_after, re.metadata->>'stage_before' AS stage_before,
            re.description AS note, cr.relationship_type, cr.character_id_a AS a_id, cr.character_id_b AS b_id,
            COALESCE(ra.selected_name, ra.display_name) AS a_name, COALESCE(rb.selected_name, rb.display_name) AS b_name
       FROM relationship_events re
       JOIN character_relationships cr ON cr.id = re.relationship_id AND cr.deleted_at IS NULL
       LEFT JOIN registry_characters ra ON ra.id = cr.character_id_a
       LEFT JOIN registry_characters rb ON rb.id = cr.character_id_b
      WHERE re.deleted_at IS NULL AND re.metadata->>'episode_id' IN (:ids)
      ORDER BY re.created_at`, { ids: episodeIds.map(String) }, 'the relationship changes') : [];

  let lalaId = null;
  try {
    lalaId = await require('./whichLala').lalaId(sequelize);
  } catch (err) {
    console.error('[seasonCast] Lala could not be found (listed like anyone else):', err.message);
  }
  return castFrom({ arc, slots, profiles, records, relEvents, lalaId });
}

module.exports = { seasonCast, castFrom, eventPeople };
