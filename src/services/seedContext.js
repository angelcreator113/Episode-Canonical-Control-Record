'use strict';

/**
 * What the relationship seed generator knows about the story (Evoni,
 * 2026-10-24: "How can we improve relationship seeds", then "I want them
 * all"). Generate used to see each person's core belief, pressure and a
 * line of personality, nothing of what has happened; these are the story's
 * own records, read for one AI call (services/relationshipSeeds).
 *
 * Pure reads. Each part answers null (or an empty list) when there is
 * nothing, or when its table or column is not there yet (before its
 * migration has run), so Generate still works on a younger database.
 *
 *   loadSeedContext(sequelize, { cast, lalaId, showId, episodeId, twistId, slotId, phase })
 *     { records, threads, twists, secrecy, families, confirmed, pulse,
 *       dismissals, episode, guests, twist, slot, phase, show_id }
 *   contextBlock(ctx)       the parts as prompt text, each capped
 *   basisCatalog(ctx)       the episodes, threads and twists a seed may cite, by id
 *
 * The parts:
 *   records     the last approved "What changed" records (episode_story_records):
 *               what happened, the relationships that moved, the threads left open
 *   threads     open story threads (show_story_threads)
 *   twists      season twists still planned or planted (season_twists)
 *   secrecy     who knows about the cast's secret or rumoured relationships
 *               (services/relationshipKnowers), confidential characters left out
 *   families    the cast's family ties with each other (services/familyTies)
 *   confirmed   the cast's confirmed relationships, with stage and romance
 *   pulse       Pulse pairs between the cast with no story pair yet
 *   dismissals  seeds Evoni turned down, with her reason and note
 *   episode / guests   Generate aimed at an episode: it and its guests in the cast
 *   twist       Generate aimed at a twist to pay off
 *   slot        Generate aimed at a season slot (planner PR 3, 2026-10-24): its
 *               purposes, planned pressure, part name and tagline, and the
 *               guests of its event who are in the cast
 *   phase       Generate aimed at a part of the active season: its name,
 *               tagline and emotional arc, its open slots' purposes and
 *               pressure, and their events' guests in the cast
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const nameOf = (c) => (c && (c.selected_name || c.display_name)) || '?';

// How much of each part the prompt takes: lines, and characters in all.
// The total stays near 6k tokens (about 24,000 characters).
const CAP = {
  records: { rows: 3, chars: 5000, what: 600, items: 5 },
  threads: { rows: 10, chars: 2000 },
  twists: { rows: 8, chars: 2000 },
  secrecy: { rows: 8, chars: 1500 },
  families: { rows: 14, chars: 1500 },
  confirmed: { rows: 30, chars: 3000 },
  pulse: { rows: 10, chars: 1000 },
  dismissals: { rows: 15, chars: 2000 },
};

const clip = (v, n) => {
  const s = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
};
const parse = (v, fallback) => {
  if (v === null || v === undefined) return fallback;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch (err) {
    console.error('[seedContext] unreadable JSON:', err.message);
    return fallback;
  }
};
const listOf = (v) => (Array.isArray(parse(v, [])) ? parse(v, []) : []);
const rows = async (sequelize, sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

/** One part, read safely: its rows, or `empty` when the read fails (a table not made yet). */
async function part(what, empty, read) {
  try {
    return await read();
  } catch (err) {
    console.error(`[seedContext] ${what} could not be read (Generate goes without it):`, err.message);
    return empty;
  }
}

/** The show the cast's story is in: the given one, the aimed episode's, else the newest approved record's. */
async function showOf(sequelize, { showId, episode }) {
  if (showId && UUID_RE.test(String(showId))) return String(showId);
  if (episode?.show_id) return String(episode.show_id);
  return part('the show', null, async () => {
    const [r] = await rows(sequelize,
      `SELECT show_id FROM episode_story_records
        WHERE deleted_at IS NULL AND status = 'approved' AND show_id IS NOT NULL
        ORDER BY approved_at DESC NULLS LAST, updated_at DESC LIMIT 1`);
    return r?.show_id ? String(r.show_id) : null;
  });
}

/** The last approved records, newest first, with their episode. */
function records(sequelize, showId) {
  return part('the approved story records', [], async () => {
    const found = await rows(sequelize,
      `SELECT r.episode_id, r.what_happened,
              to_jsonb(r)->'relationships' AS relationships, r.threads,
              e.episode_number, COALESCE(e.episode_title, e.title) AS title
         FROM episode_story_records r
         JOIN episodes e ON e.id = r.episode_id AND e.deleted_at IS NULL
        WHERE r.deleted_at IS NULL AND r.status = 'approved'
          ${showId ? 'AND (r.show_id = :showId OR e.show_id = :showId)' : ''}
        ORDER BY r.approved_at DESC NULLS LAST, r.updated_at DESC
        LIMIT ${CAP.records.rows}`, { showId });
    return found.map((r) => ({
      episode: { id: String(r.episode_id), number: r.episode_number == null ? null : Number(r.episode_number), title: r.title || null },
      what: clip(r.what_happened, CAP.records.what),
      relationships: listOf(r.relationships).filter((x) => x && x.keep !== false).slice(0, CAP.records.items).map((x) => {
        const move = [x.stage_before, x.stage_after].filter(Boolean).join(' → ');
        const kind = [String(x.type || '').replace(/_/g, ' '), x.is_romantic ? 'romantic' : null, move].filter(Boolean).join(', ');
        return clip(`${x.a_name || '?'} and ${x.b_name || '?'}${kind ? ` (${kind})` : ''}${x.note ? `: ${x.note}` : ''}`, 220);
      }),
      threads: listOf(r.threads).filter((x) => x && x.keep !== false && x.title).slice(0, CAP.records.items)
        .map((x) => clip(`${x.title}${x.note ? `: ${x.note}` : ''}`, 200)),
    }));
  });
}

/** Open story threads, newest first. */
function threads(sequelize, showId) {
  return part('the open story threads', [], async () => {
    const found = await rows(sequelize,
      `SELECT id, title, description, status FROM show_story_threads
        WHERE deleted_at IS NULL AND status <> 'closed' ${showId ? 'AND show_id = :showId' : ''}
        ORDER BY COALESCE(last_advanced_at, created_at) DESC LIMIT ${CAP.threads.rows}`, { showId });
    return found.map((t) => ({ id: String(t.id), title: clip(t.title, 200), description: clip(t.description, 200), status: t.status }));
  });
}

/** Season twists still to plant or to pay off. */
function twists(sequelize, showId, castIds) {
  return part('the season twists', [], async () => {
    const found = await rows(sequelize,
      `SELECT id, title, description, status, character_ids FROM season_twists
        WHERE deleted_at IS NULL AND status IN ('planned', 'planted') ${showId ? 'AND show_id = :showId' : ''}
        ORDER BY (status = 'planted') DESC, created_at DESC LIMIT ${CAP.twists.rows}`, { showId });
    return found.map((t) => ({
      id: String(t.id), title: clip(t.title, 200), description: clip(t.description, 260), status: t.status,
      character_ids: listOf(t.character_ids).map(String).filter((id) => castIds.includes(id)),
    }));
  });
}

/** The cast's confirmed relationships with each other, each with its stage (relationshipTruth's one read). */
function confirmed(sequelize, castIds) {
  if (castIds.length < 2) return [];
  return part('the confirmed relationships', [], () => require('./relationshipTruth').confirmedBetween(sequelize, castIds, { limit: CAP.confirmed.rows }));
}

/** The cast's family ties with each other (both in the cast), as lines. */
function families(sequelize, castIds, names) {
  if (castIds.length < 2) return [];
  return part('the family ties', [], async () => {
    const { familyRoleFor } = require('./familyTies');
    const found = await rows(sequelize,
      `SELECT cr.character_id_a, cr.character_id_b, cr.family_role, to_jsonb(cr)->>'reverse_family_role' AS reverse_family_role,
              to_jsonb(cr)->>'family_kind' AS family_kind, cr.tension_state, cb.gender AS b_gender, cb.pronouns AS b_pronouns
         FROM character_relationships cr
         JOIN registry_characters cb ON cb.id = cr.character_id_b
        WHERE cr.deleted_at IS NULL AND cr.confirmed = true AND cr.is_romantic = false AND cr.family_role IS NOT NULL
          AND cr.character_id_a IN (:ids) AND cr.character_id_b IN (:ids)
        ORDER BY cr.created_at ASC LIMIT ${CAP.families.rows}`, { ids: castIds });
    return found.map((r) => {
      const extra = [r.family_kind, r.tension_state].filter(Boolean).join('; ');
      return `${names.get(String(r.character_id_a)) || '?'} is ${names.get(String(r.character_id_b)) || '?'}'s ${familyRoleFor(r, r.character_id_a) || 'family'}${extra ? ` (${extra})` : ''}`;
    });
  });
}

/** Who knows about the cast's secret and rumoured relationships (confidential characters left out). */
function secrecy(sequelize, confirmedIds) {
  if (!confirmedIds.length) return [];
  return part('who knows', [], async () => {
    const { whoKnows, secrecyLine } = require('./relationshipKnowers');
    const map = await whoKnows(sequelize, confirmedIds, { forWriters: true });
    return [...map.values()].filter((e) => e.public_state !== 'known').slice(0, CAP.secrecy.rows).map(secrecyLine);
  });
}

/** Pulse pairs between the cast that no story pair stands for yet. */
function pulse(sequelize, cast, names) {
  const byProfile = new Map(cast.filter((c) => c.feed_profile_id != null).map((c) => [Number(c.feed_profile_id), String(c.id)]));
  if (byProfile.size < 2) return [];
  return part('the Pulse pairs', [], async () => {
    const found = await rows(sequelize,
      `SELECT source_profile_id, target_profile_id, relationship_type::text AS kind, description
         FROM social_profile_relationships
        WHERE character_relationship_id IS NULL
          AND source_profile_id IN (:profiles) AND target_profile_id IN (:profiles)
        ORDER BY updated_at DESC LIMIT ${CAP.pulse.rows}`, { profiles: [...byProfile.keys()] });
    return found.map((r) => {
      const a = names.get(byProfile.get(Number(r.source_profile_id)));
      const b = names.get(byProfile.get(Number(r.target_profile_id)));
      return a && b && a !== b ? clip(`${a} and ${b}: ${String(r.kind).replace(/_/g, ' ')}${r.description ? ` (${r.description})` : ''}`, 200) : null;
    }).filter(Boolean);
  });
}

/** Seeds Evoni turned down among the cast, newest first, with her reason and note. */
function dismissals(sequelize, castIds) {
  if (castIds.length < 2) return [];
  return part('the dismissed seeds', [], () => rows(sequelize,
    `SELECT cr.character_id_a, cr.character_id_b, cr.relationship_type,
            to_jsonb(cr)->>'dismiss_reason' AS dismiss_reason, to_jsonb(cr)->>'dismiss_note' AS dismiss_note
       FROM character_relationships cr
      WHERE cr.confirmed = false AND to_jsonb(cr)->>'dismiss_reason' IS NOT NULL
        AND cr.character_id_a IN (:ids) AND cr.character_id_b IN (:ids)
      ORDER BY cr.updated_at DESC LIMIT ${CAP.dismissals.rows}`, { ids: castIds }));
}

/** The aimed episode, with its guests who are in the cast (utils/eventAttendees). */
async function episodeAim(sequelize, episodeId, cast) {
  if (!episodeId || !UUID_RE.test(String(episodeId))) return { episode: null, guests: [] };
  return part('the aimed episode', { episode: null, guests: [] }, async () => {
    const [episode] = await rows(sequelize,
      `SELECT id, show_id, episode_number, COALESCE(episode_title, title) AS title FROM episodes WHERE id = :episodeId AND deleted_at IS NULL`,
      { episodeId });
    if (!episode) return { episode: null, guests: [] };
    const { EPISODE_EVENT_ID_SQL } = require('../utils/episodeEventSql');
    const { eventAttendees } = require('../utils/eventAttendees');
    const [event] = await rows(sequelize,
      `SELECT id, name, canon_consequences, source_profile_id FROM world_events WHERE id = ${EPISODE_EVENT_ID_SQL}`, { episodeId });
    const attending = event ? eventAttendees(event) : new Set();
    const guests = cast.filter((c) => c.feed_profile_id != null && attending.has(Number(c.feed_profile_id))).map((c) => String(c.id));
    return {
      episode: {
        id: String(episode.id), show_id: episode.show_id ? String(episode.show_id) : null,
        number: episode.episode_number == null ? null : Number(episode.episode_number), title: episode.title || null,
        event: event?.name || null,
      },
      guests,
    };
  });
}

/** The aimed twist. */
function twistAim(sequelize, twistId) {
  if (!twistId || !UUID_RE.test(String(twistId))) return null;
  return part('the aimed twist', null, async () => {
    const [t] = await rows(sequelize,
      `SELECT id, show_id, title, description, status, character_ids FROM season_twists WHERE id = :twistId AND deleted_at IS NULL`, { twistId });
    return t ? {
      id: String(t.id), show_id: t.show_id ? String(t.show_id) : null, title: clip(t.title, 200),
      description: clip(t.description, 400), status: t.status, character_ids: listOf(t.character_ids).map(String),
    } : null;
  });
}

const SLOT_CAP = { purposes: 3, slots: 8, purpose: 220 };

/** The cast's ids among an event's attendees (utils/eventAttendees). */
function guestsOf(event, cast) {
  if (!event) return [];
  const { eventAttendees } = require('../utils/eventAttendees');
  const attending = eventAttendees(event);
  return cast.filter((c) => c.feed_profile_id != null && attending.has(Number(c.feed_profile_id))).map((c) => String(c.id));
}

/** A slot's purposes as text, primary first (seasonIntentionService purposesOf). */
function purposeTexts(slot) {
  const { purposesOf } = require('./seasonIntentionService');
  return purposesOf(slot).map((p) => clip(p.text, SLOT_CAP.purpose)).filter(Boolean).slice(0, SLOT_CAP.purposes);
}

/** The part of the arc a phase number names: { number, title, tagline, emotional_arc }. */
function phaseInfo(phases, n) {
  const { arcPhases } = require('./seasonSlotService');
  const p = arcPhases({ phases }).find((x) => Number(x.phase) === Number(n));
  return p ? { number: Number(p.phase), title: p.title || null, tagline: p.tagline || null, emotional_arc: p.emotional_arc || null } : null;
}

/** The aimed slot, with its part, purposes, pressure and its event's guests in the cast. Null when not found. */
function slotAim(sequelize, slotId, cast) {
  if (!slotId || !UUID_RE.test(String(slotId))) return null;
  return part('the aimed slot', null, async () => {
    const { EPISODE_EVENT_ID_SQL } = require('../utils/episodeEventSql');
    const [s] = await rows(sequelize,
      `SELECT s.id, s.show_id, s.arc_id, s.slot_number, s.season_number, s.phase, s.story_purpose, s.story_purposes,
              s.story_thread_id, s.intention_source, s.desired_pressure, s.event_id, s.episode_id, a.phases
         FROM season_slots s JOIN show_arcs a ON a.id = s.arc_id AND a.deleted_at IS NULL
        WHERE s.id = :slotId AND s.deleted_at IS NULL`, { slotId });
    if (!s) return null;
    let event = null;
    if (s.event_id) {
      [event] = await rows(sequelize,
        'SELECT id, name, canon_consequences, source_profile_id FROM world_events WHERE id = :id AND deleted_at IS NULL', { id: s.event_id });
    } else if (s.episode_id) {
      [event] = await rows(sequelize,
        `SELECT id, name, canon_consequences, source_profile_id FROM world_events WHERE id = ${EPISODE_EVENT_ID_SQL}`, { episodeId: s.episode_id });
    }
    return {
      id: String(s.id), show_id: s.show_id ? String(s.show_id) : null, slot_number: Number(s.slot_number),
      season_number: s.season_number || 1, part: phaseInfo(s.phases, s.phase),
      purposes: purposeTexts(s), desired_pressure: s.desired_pressure || null,
      event: event?.name || null, guests: guestsOf(event, cast),
    };
  });
}

/** The aimed part of the show's active season: its words, its open slots and their events' guests. Null when not found. */
function phaseAim(sequelize, showId, phase, cast) {
  if (phase == null || !UUID_RE.test(String(showId || ''))) return null;
  return part('the aimed part', null, async () => {
    const [arc] = await rows(sequelize,
      `SELECT id, phases FROM show_arcs WHERE show_id = :showId AND status = 'active' AND deleted_at IS NULL
        ORDER BY arc_number ASC LIMIT 1`, { showId });
    const info = arc ? phaseInfo(arc.phases, phase) : null;
    if (!info) return null;
    const slotRows = await rows(sequelize,
      `SELECT s.slot_number, s.story_purpose, s.story_purposes, s.story_thread_id, s.intention_source, s.desired_pressure,
              ev.name AS event_name, ev.canon_consequences, ev.source_profile_id
         FROM season_slots s LEFT JOIN world_events ev ON ev.id = s.event_id AND ev.deleted_at IS NULL
        WHERE s.arc_id = :arcId AND s.phase = :phase AND s.deleted_at IS NULL AND s.accepted_at IS NULL
        ORDER BY s.slot_number ASC LIMIT ${SLOT_CAP.slots}`, { arcId: arc.id, phase: info.number });
    const guests = new Set();
    const slots = slotRows.map((r) => {
      for (const id of guestsOf(r.event_name ? r : null, cast)) guests.add(id);
      return { slot_number: Number(r.slot_number), purposes: purposeTexts(r), desired_pressure: r.desired_pressure || null, event: r.event_name || null };
    });
    return { show_id: String(showId), ...info, slots, guests: [...guests] };
  });
}

/**
 * Everything the generator is told, for the cast (rows with id, names,
 * feed_profile_id). Never throws for a missing table: that part is empty.
 */
async function loadSeedContext(sequelize, { cast = [], showId = null, episodeId = null, twistId = null, slotId = null, phase = null } = {}) {
  const castIds = cast.map((c) => String(c.id));
  // A company (services/companyCharacters) reads "(company)" in every line, so
  // the generator never takes it for a person.
  const names = new Map(cast.map((c) => [String(c.id), `${nameOf(c)}${c.company ? ' (company)' : ''}`]));
  const { episode, guests } = await episodeAim(sequelize, episodeId, cast);
  const twist = await twistAim(sequelize, twistId);
  const slot = await slotAim(sequelize, slotId, cast);
  const phaseAimed = await phaseAim(sequelize, showId || slot?.show_id, phase, cast);
  const show = await showOf(sequelize, { showId: showId || slot?.show_id || twist?.show_id, episode });
  const confirmedRows = await confirmed(sequelize, castIds);
  return {
    show_id: show,
    names,
    records: await records(sequelize, show),
    threads: await threads(sequelize, show),
    twists: await twists(sequelize, show, castIds),
    secrecy: await secrecy(sequelize, confirmedRows.map((r) => r.id)),
    families: await families(sequelize, castIds, names),
    confirmed: confirmedRows,
    pulse: await pulse(sequelize, cast, names),
    dismissals: await dismissals(sequelize, castIds),
    episode,
    guests,
    twist,
    slot,
    phase: phaseAimed,
  };
}

const REASON_WORDS = {
  wrong_for_them: 'wrong for them', too_soon: 'too soon (maybe later)', already_covered: 'already covered',
  not_this_type: 'not this type', other: 'other',
};

/** Lines kept to `rows` lines and `chars` characters in all. */
function capped(lines, { rows: max, chars }) {
  const out = [];
  let used = 0;
  for (const line of lines.slice(0, max)) {
    if (used + line.length > chars) break;
    out.push(line);
    used += line.length + 1;
  }
  return out;
}

const episodeLabel = (e) => `Episode ${e.number ?? '?'}${e.title ? ` "${e.title}"` : ''}`;

/** The context as prompt sections; a section with nothing says so. */
function contextBlock(ctx) {
  const names = ctx.names || new Map();
  const who = (id) => names.get(String(id)) || '?';
  const section = (title, lines, cap) => {
    const kept = cap ? capped(lines, cap) : lines;
    return `${title}\n${kept.length ? kept.join('\n') : '(none)'}`;
  };

  const recordLines = (ctx.records || []).map((r) => {
    const parts = [`- [episode ${r.episode.id}] ${episodeLabel(r.episode)}: ${r.what || '(no summary)'}`];
    if (r.relationships.length) parts.push(`  What moved between people: ${r.relationships.join('; ')}`);
    if (r.threads.length) parts.push(`  Left open: ${r.threads.join('; ')}`);
    return parts.join('\n');
  });
  const threadLines = (ctx.threads || []).map((t) => `- [thread ${t.id}] ${t.title}${t.description ? `: ${t.description}` : ''} (${t.status})`);
  const twistLines = (ctx.twists || []).map((t) => `- [twist ${t.id}] ${t.title}${t.description ? `: ${t.description}` : ''} (${t.status === 'planted' ? 'planted, not paid off yet' : 'planned'})${t.character_ids.length ? `; involves ${t.character_ids.map(who).join(', ')}` : ''}`);
  const confirmedLines = (ctx.confirmed || []).map((r) => {
    const bits = [String(r.relationship_type || 'connected').replace(/_/g, ' ')];
    if (r.is_romantic) bits.push('romantic');
    if (r.family_role) bits.push(`family: ${r.family_role}`);
    if (r.stage) bits.push(`now ${String(r.stage).replace(/_/g, ' ')}`);
    if (r.tension_state) bits.push(r.tension_state);
    if (r.status && r.status !== 'Active') bits.push(String(r.status).toLowerCase());
    return `- ${who(r.character_id_a)} and ${who(r.character_id_b)}: ${bits.join(', ')}${r.situation ? `. ${clip(r.situation, 140)}` : ''}`;
  });
  const dismissalLines = (ctx.dismissals || []).map((d) => `- ${who(d.character_id_a)} and ${who(d.character_id_b)} as ${String(d.relationship_type || '').replace(/_/g, ' ')}: ${REASON_WORDS[d.dismiss_reason] || d.dismiss_reason}${d.dismiss_note ? ` ("${clip(d.dismiss_note, 160)}")` : ''}`);

  return [
    section('WHAT HAS HAPPENED (the last approved episode records, newest first):', recordLines, CAP.records),
    section('OPEN STORY THREADS:', threadLines, CAP.threads),
    section('SEASON TWISTS STILL TO PLANT OR PAY OFF:', twistLines, CAP.twists),
    section('CONFIRMED RELATIONSHIPS (canon; never contradict them):', confirmedLines, CAP.confirmed),
    section('FAMILY (these people are family; never a romance between them):', (ctx.families || []).map((l) => `- ${l}`), CAP.families),
    section('WHO KNOWS (secret and rumoured relationships):', (ctx.secrecy || []).map((l) => `- ${l}`), CAP.secrecy),
    section('ON THE PULSE, NOT IN THE STORY YET:', (ctx.pulse || []).map((l) => `- ${l}`), CAP.pulse),
    section('EVONI TURNED THESE DOWN (learn from her reasons):', dismissalLines, CAP.dismissals),
  ].join('\n\n');
}

/** The episodes, threads and twists a seed may name in its basis, by id. */
function basisCatalog(ctx) {
  const episodes = new Map();
  for (const r of ctx.records || []) episodes.set(r.episode.id, { id: r.episode.id, number: r.episode.number, title: r.episode.title });
  if (ctx.episode) episodes.set(ctx.episode.id, { id: ctx.episode.id, number: ctx.episode.number, title: ctx.episode.title });
  const threadMap = new Map((ctx.threads || []).map((t) => [t.id, { id: t.id, title: t.title }]));
  const twistMap = new Map((ctx.twists || []).map((t) => [t.id, { id: t.id, title: t.title }]));
  if (ctx.twist) twistMap.set(ctx.twist.id, { id: ctx.twist.id, title: ctx.twist.title });
  return { episodes, threads: threadMap, twists: twistMap };
}

module.exports = { loadSeedContext, contextBlock, basisCatalog, episodeLabel, CAP, REASON_WORDS };
