'use strict';

/**
 * The Episode Story Record (Evoni, 2026-10-17, stage C of the storytelling
 * plan): after an episode, what happened, what each character knew and
 * learned, which secrets were hinted at or revealed, what changed
 * emotionally, and what is left open. "The short-story writer uses that
 * record to deepen the experience and create additional clues. The
 * chapter-book writer uses both."
 *
 * The "What changed" card (Evoni, 2026-10-23: approved plan "from a
 * finished script to the story to the next episode", PR 2): the app reads
 * the finished script and proposes what changed, she ticks, edits or drops
 * each item, then Save writes it. Besides the record's own fields, a draft
 * proposes
 *   goals          the episode's relationship goals, covered or not, and in
 *                  which beat (utils/scriptCoverage goalCovered's beat goes in)
 *   relationships  pairs of the cast whose relationship moved: type,
 *                  romantic or not, stage before and after, the beat
 *   follow_ups     what Lala owes someone after this episode
 *   threads        each with action new | advance | close
 *   twists         the season twists due here (services/seasonTwists) the
 *                  script plants or pays off
 * Every proposed item has a key and keep (true unless she unticks it; a
 * goal the script does not cover starts unticked), and a quote: the line in
 * the script that shows it, kept only when the script has it. Reading it
 * again keeps the keys of what a Save already wrote (keepSavedKeys).
 * Stages include flirting (Evoni, 2026-10-23).
 *
 * A record is drafted (one AI call over the whole script, outcome, cast
 * with Lala and unlinked guests, their kept secrets, the goals, the cast's
 * current relationships, the show's open follow-ups and open threads) and
 * counts only once Evoni approves it: writers read approved records, and
 * approving (Save) writes each kept item, once (`applied`):
 *   secrets        hidden -> hinted; -> revealed, with the episode as where
 *   threads        new: a show_story_threads row (source 'record'); advance:
 *                  marked advanced by this episode; close: closed
 *   relationships  character_relationships found or made for the pair, and a
 *                  relationship_events row for this episode; a person not in
 *                  the registry is skipped and reported (not_linked)
 *   follow_ups     show_follow_ups rows, open
 *   goals          the to-do list's matching social task ticked (source 'record')
 *   twists         season_twists planted / paid off in this episode (never moved back)
 *
 *   getRecord(sequelize, episodeId)      { record, cast, threads, goals, twists } for the page
 *   draftRecord(sequelize, episodeId)    drafts (or redrafts) it; saves a draft
 *   draftLater(sequelize, episodeId)     the same after completion, when there is
 *                                        none yet; never throws
 *   updateRecord(sequelize, episodeId, body)  edits; an approved record goes back to draft
 *   approveRecord(sequelize, episodeId, { by })  Save: { ...getRecord, result: { written, skipped } }
 *   recordBlock(sequelize, episodeId)    the approved record as prompt text; ''
 *   castOf / openThreads                 the episode's cast with their kept secrets, and
 *                                        the show's unresolved threads (also for services/storyCanon)
 *
 * Raw SQL (episode_story_records, migrations 20261018050000 and
 * 20261023210000; show_follow_ups, 20261023210000); no model.
 */

const crypto = require('crypto');
const { episodeCast } = require('./storyGenerationService');
const { secretsFor } = require('./characterSecrets');
const { lalaCharacter } = require('./lalaFeedProfile');
const { EPISODE_EVENT_ID_SQL } = require('../utils/episodeEventSql');
const { splitScriptBeats } = require('../utils/scriptBeatLocks');
const { goalCovered } = require('../utils/scriptCoverage');
const { goalPerson } = require('../utils/scriptRuleChecks');
const { twistsForEpisode } = require('./seasonTwists');

const MODELS = ['claude-sonnet-4-6'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// The whole script (Evoni, 2026-10-23): 9,000 characters cut off beats 11-14.
const SCRIPT_LIMIT = 40000;
const MAX_TOKENS = 4000;
const MAX = { what: 3000, field: 600, quote: 240, people: 12, secrets: 12, threads: 10, relationships: 12, follow_ups: 10, goals: 8, twists: 8 };
// relationship_events.relationship_stage (models/RelationshipEvent; free text).
// flirting (Evoni, 2026-10-23): a love interest starts somewhere before lovers.
const STAGES = ['strangers', 'acquaintances', 'flirting', 'friends', 'close_friends', 'lovers', 'partners', 'exes', 'enemies'];
const ACTIONS = ['new', 'advance', 'close'];
// A romantic relationship is a love interest (relationship_type is free text;
// worldStudio's role pairs use love_interest).
const ROMANTIC_TYPE = 'love_interest';
const KEY_RE = /^[A-Za-z0-9_-]{6,64}$/;

class RecordError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; this.name = 'RecordError'; }
}

const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const parse = (v, fallback) => {
  if (v === null || v === undefined) return fallback;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch (err) {
    console.error('[episodeStoryRecord] unreadable JSON:', err.message);
    return fallback;
  }
};
const intIn = (v, lo, hi) => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return Number.isInteger(n) && n >= lo && n <= hi ? n : null;
};
const keyOf = (v) => (typeof v === 'string' && KEY_RE.test(v) ? v : crypto.randomUUID());
const stageOf = (v) => {
  const s = typeof v === 'string' ? v.trim().toLowerCase().replace(/[\s-]+/g, '_') : '';
  return STAGES.includes(s) ? s : null;
};
const typeOf = (v) => str(v, 100).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
// Letters and digits only, for comparing words across quotes and punctuation.
const flat = (v) => String(v || '').toLowerCase().replace(/['’‘`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
/**
 * The line that shows it (Evoni, 2026-10-23: "show the line it found"). It
 * stays only when the script says it, so the card never quotes words the
 * model made up.
 */
const quoteOf = (v, scriptFlat) => {
  const q = str(v, MAX.quote).replace(/^["“'‘]+|["”'’]+$/g, '').trim();
  const f = flat(q);
  return f.length >= 8 && scriptFlat && scriptFlat.includes(f) ? q : '';
};
const wordSet = (v) => new Set(flat(v).split(' ').filter((w) => w.length >= 3));
/** Two follow-ups say the same thing: most of their words are shared. */
function sameText(x, y) {
  if (flat(x) === flat(y)) return true;
  const a = wordSet(x);
  const b = wordSet(y);
  if (!a.size || !b.size) return false;
  const shared = [...a].filter((w) => b.has(w)).length;
  return shared / (a.size + b.size - shared) >= 0.6;
}

async function episodeOf(sequelize, episodeId) {
  if (!UUID_RE.test(String(episodeId || ''))) throw new RecordError('episodeId must be a UUID');
  const [[episode]] = await sequelize.query(
    `SELECT id, show_id, episode_number, title, description, script_content, evaluation_json
       FROM episodes WHERE id = :episodeId AND deleted_at IS NULL`, { replacements: { episodeId } });
  if (!episode) throw new RecordError('Episode not found', 404);
  return episode;
}

const shape = (r) => (r ? {
  id: r.id, episode_id: r.episode_id, status: r.status, what_happened: r.what_happened || '',
  characters: r.characters || [], secrets: r.secrets || [], threads: r.threads || [],
  relationships: r.relationships || [], follow_ups: r.follow_ups || [], goals: r.goals || [], twists: r.twists || [],
  applied: r.applied || {},
  drafted_at: r.drafted_at, approved_by: r.approved_by, approved_at: r.approved_at, updated_at: r.updated_at,
} : null);

async function rowOf(sequelize, episodeId, transaction) {
  const [[row]] = await sequelize.query(
    'SELECT * FROM episode_story_records WHERE episode_id = :episodeId AND deleted_at IS NULL',
    { replacements: { episodeId }, ...(transaction ? { transaction } : {}) });
  return row || null;
}

/**
 * Who was in it: Lala, then the event's host and guests, each with their
 * kept secrets. A guest not linked in the registry stays, by their Feed
 * profile (id `profile:<profile id>`, linked false), so the card can say
 * who to link. `profiles` are the Feed profiles, for goalPerson.
 */
async function castOf(sequelize, episodeId) {
  const [[event]] = await sequelize.query(
    `SELECT id, name, host, venue_name, narrative_stakes, canon_consequences, source_profile_id
       FROM world_events WHERE id = ${EPISODE_EVENT_ID_SQL}`, { replacements: { episodeId } });
  const rows = await episodeCast(sequelize, event);
  const lala = await lalaCharacter(sequelize);
  const seen = new Set();
  const people = [];
  const add = (p) => {
    const keys = [p.id, p.profile_id != null ? `profile:${p.profile_id}` : null].filter(Boolean);
    if (keys.some((k) => seen.has(k))) return;
    keys.forEach((k) => seen.add(k));
    people.push(p);
  };
  add(lala?.id
    ? { id: lala.id, name: 'Lala', profile_id: lala.feed_profile_id ?? null, linked: true, is_lala: true }
    : { id: 'lala', name: 'Lala', profile_id: null, linked: false, is_lala: true });
  for (const c of rows) {
    const name = c.char_name || c.creator_name || c.display_name || c.handle;
    if (c.char_id) add({ id: c.char_id, name, profile_id: c.profile_id ?? null, linked: true });
    else if (c.profile_id != null) add({ id: `profile:${c.profile_id}`, name, profile_id: c.profile_id, linked: false });
  }
  const secrets = await secretsFor(sequelize, people.filter((c) => c.linked).map((c) => c.id));
  return {
    event: event || null,
    profiles: rows.filter((r) => r.profile_id != null).map((r) => ({ id: r.profile_id, creator_name: r.creator_name, display_name: r.display_name, handle: r.handle })),
    cast: people.map((c) => ({
      ...c,
      secrets: (secrets.get(c.id) || []).map((s) => ({ id: s.id, text: s.text, state: s.state, known_by: s.known_by_people.map((p) => p.name) })),
    })),
  };
}

async function openThreads(sequelize, showId) {
  if (!showId) return [];
  try {
    const [rows] = await sequelize.query(
      `SELECT id, title, description FROM show_story_threads
        WHERE show_id = :showId AND deleted_at IS NULL AND status <> 'closed' ORDER BY created_at`, { replacements: { showId } });
    return rows;
  } catch (err) {
    console.error('[episodeStoryRecord] open threads could not be read:', err.message);
    return [];
  }
}

/**
 * The episode's relationship goals: its to-do list's goal tasks (Start
 * Episode copies them from the event), else the event's own goals. Each
 * { slot, label, completed, beat }: beat is where the script covers it
 * (utils/scriptCoverage goalCovered), or null.
 */
async function goalsOf(sequelize, episode, event, profiles) {
  let tasks = null;
  try {
    const [[list]] = await sequelize.query(
      'SELECT social_tasks FROM episode_todo_lists WHERE episode_id = :episodeId AND deleted_at IS NULL LIMIT 1',
      { replacements: { episodeId: episode.id } });
    if (list) tasks = parse(list.social_tasks, []);
  } catch (err) {
    console.error('[episodeStoryRecord] the to-do list could not be read:', err.message);
  }
  const automation = parse(event?.canon_consequences, {})?.automation || {};
  const eventGoals = (Array.isArray(automation.relationship_goals) ? automation.relationship_goals : []).filter((g) => g && g.label);
  const goals = Array.isArray(tasks)
    ? tasks.filter((t) => t && t.task_source === 'goal' && t.slot && t.label)
    : eventGoals.map((g) => ({ slot: g.slot || 'relationship', label: g.label, completed: false }));
  const { beats } = splitScriptBeats(String(episode.script_content || ''));
  return goals.slice(0, MAX.goals).map((g) => {
    const own = eventGoals.find((e) => (e.slot || 'relationship') === g.slot);
    const person = goalPerson({ ...g, profile_id: g.profile_id ?? own?.profile_id ?? null }, event, profiles);
    return {
      slot: g.slot, label: String(g.label).trim(), completed: !!g.completed, beat: beats.length ? goalCovered(beats, g, person) : null,
      // Carried from an earlier episode (services/storyCarryForward).
      ...(g.follow_up_id ? { follow_up_id: g.follow_up_id } : {}),
    };
  });
}

/** The cast's current relationships with each other (linked people only), each with its latest stage. */
async function relationshipsOf(sequelize, cast) {
  const ids = cast.filter((c) => c.linked && UUID_RE.test(c.id)).map((c) => c.id);
  if (ids.length < 2) return [];
  try {
    const [rows] = await sequelize.query(
      `SELECT cr.id, cr.character_id_a, cr.character_id_b, cr.relationship_type, cr.is_romantic, cr.tension_state, cr.situation,
              (SELECT re.relationship_stage FROM relationship_events re
                WHERE re.relationship_id = cr.id AND re.deleted_at IS NULL AND re.relationship_stage IS NOT NULL
                ORDER BY re.created_at DESC LIMIT 1) AS stage
         FROM character_relationships cr
        WHERE cr.deleted_at IS NULL AND cr.character_id_a IN (:ids) AND cr.character_id_b IN (:ids)
        ORDER BY cr.created_at`, { replacements: { ids } });
    return rows;
  } catch (err) {
    console.error('[episodeStoryRecord] relationships could not be read:', err.message);
    return [];
  }
}

/** The show's open follow-ups (show_follow_ups); [] before the migration has run. */
async function openFollowUps(sequelize, showId) {
  if (!showId) return [];
  try {
    const [rows] = await sequelize.query(
      `SELECT f.id, f.text, f.due_hint, f.from_episode_id, f.registry_character_id, f.profile_id, e.episode_number
         FROM show_follow_ups f LEFT JOIN episodes e ON e.id = f.from_episode_id
        WHERE f.show_id = :showId AND f.status = 'open' AND f.deleted_at IS NULL ORDER BY f.created_at`, { replacements: { showId } });
    return rows;
  } catch (err) {
    console.error('[episodeStoryRecord] open follow-ups could not be read:', err.message);
    return [];
  }
}

/** The record (or null), the cast with their secrets, the show's open threads and the episode's goals. */
async function getRecord(sequelize, episodeId) {
  const episode = await episodeOf(sequelize, episodeId);
  const { event, cast, profiles } = await castOf(sequelize, episode.id);
  return {
    record: shape(await rowOf(sequelize, episode.id)), cast,
    threads: await openThreads(sequelize, episode.show_id), goals: await goalsOf(sequelize, episode, event, profiles),
    twists: await dueTwists(sequelize, episode.id),
  };
}

/** The season twists this episode plants or pays off (services/seasonTwists), as { id, title, description, what }. */
async function dueTwists(sequelize, episodeId) {
  const { plant, payoff } = await twistsForEpisode(sequelize, episodeId);
  return [
    ...plant.map((t) => ({ id: t.id, title: t.title, description: t.description, status: t.status, what: 'planted' })),
    ...payoff.map((t) => ({ id: t.id, title: t.title, description: t.description, status: t.status, what: 'paid_off' })),
  ];
}

/**
 * A record's fields from a body, kept to the cast, their secrets, the
 * threads, the goals and the twists due. `script` is the episode's script:
 * a quote stays only when it is in it.
 */
function clean(body, { cast, threads, goals = [], twists = [], script = '' }) {
  const scriptFlat = flat(script);
  const quote = (v) => quoteOf(v, scriptFlat);
  const twistById = new Map(twists.map((t) => [t.id, t]));
  const people = new Map(cast.map((c) => [c.id, c]));
  const secrets = new Map(cast.flatMap((c) => c.secrets.map((s) => [s.id, { ...s, character_id: c.id }])));
  const threadIds = new Set(threads.map((t) => t.id));
  const goalBySlot = new Map(goals.map((g) => [g.slot, g]));
  const list = (name) => {
    if (!Array.isArray(body[name])) throw new RecordError(`${name} is a list.`);
    return body[name];
  };
  const out = {};
  if (body.what_happened !== undefined) out.what_happened = str(body.what_happened, MAX.what);
  if (body.characters !== undefined) {
    out.characters = list('characters').filter((c) => people.has(c?.character_id)).slice(0, MAX.people).map((c) => ({
      character_id: c.character_id, name: people.get(c.character_id).name,
      knew: str(c.knew, MAX.field), learned: str(c.learned, MAX.field), changed: str(c.changed, MAX.field),
    }));
  }
  if (body.secrets !== undefined) {
    const seen = new Set();
    out.secrets = list('secrets').filter((s) => secrets.has(s?.secret_id) && ['hinted', 'revealed'].includes(s.what) && !seen.has(s.secret_id) && seen.add(s.secret_id))
      .slice(0, MAX.secrets).map((s) => {
        const known = secrets.get(s.secret_id);
        return { secret_id: s.secret_id, character_id: known.character_id, text: known.text, what: s.what, how: str(s.how, MAX.field), keep: s.keep !== false };
      });
  }
  if (body.threads !== undefined) {
    out.threads = list('threads').map((t) => {
      const thread_id = threadIds.has(t?.thread_id) ? t.thread_id : null;
      // A new thread has no id; an open one is advanced unless it is closed.
      let action = ACTIONS.includes(t?.action) ? t.action : (thread_id ? 'advance' : 'new');
      if (!thread_id) action = 'new';
      else if (action === 'new') action = 'advance';
      return { key: keyOf(t?.key), thread_id, title: str(t?.title, 200), note: str(t?.note, MAX.field), quote: quote(t?.quote), action, keep: t?.keep !== false };
    }).filter((t) => t.title).slice(0, MAX.threads);
  }
  if (body.relationships !== undefined) {
    const pairs = new Set();
    out.relationships = list('relationships').filter((r) => {
      if (!people.has(r?.a) || !people.has(r?.b) || r.a === r.b) return false;
      const pair = [r.a, r.b].sort().join('|');
      return pairs.has(pair) ? false : pairs.add(pair);
    }).slice(0, MAX.relationships).map((r) => ({
      key: keyOf(r.key), a: r.a, b: r.b, a_name: people.get(r.a).name, b_name: people.get(r.b).name,
      type: typeOf(r.type) || (r.is_romantic === true ? ROMANTIC_TYPE : ''), is_romantic: r.is_romantic === true,
      stage_before: stageOf(r.stage_before), stage_after: stageOf(r.stage_after),
      tension_before: intIn(r.tension_before, 0, 10), tension_after: intIn(r.tension_after, 0, 10),
      evidence_beat: intIn(r.evidence_beat, 1, 14), note: str(r.note, MAX.field), quote: quote(r.quote), keep: r.keep !== false,
    }));
  }
  if (body.follow_ups !== undefined) {
    out.follow_ups = list('follow_ups').map((f) => {
      const person = people.has(f?.person) ? f.person : null;
      return { key: keyOf(f?.key), person, name: person ? people.get(person).name : '', text: str(f?.text, MAX.field), due_hint: str(f?.due_hint, 200), quote: quote(f?.quote), keep: f?.keep !== false };
    }).filter((f) => f.text).slice(0, MAX.follow_ups);
  }
  if (body.goals !== undefined) {
    const seen = new Set();
    out.goals = list('goals').filter((g) => goalBySlot.has(g?.slot) && !seen.has(g.slot) && seen.add(g.slot)).map((g) => ({
      key: keyOf(g.key), slot: g.slot, label: goalBySlot.get(g.slot).label, covered: g.covered === true,
      beat: intIn(g.beat, 1, 14), note: str(g.note, MAX.field), quote: quote(g.quote),
      // Ticked on the card means ticked on Save, so a goal the script does
      // not cover starts unticked (Evoni, 2026-10-23).
      keep: g.keep === undefined ? g.covered === true : g.keep !== false,
    }));
  }
  // Twists: only the ones due in this episode, planted where it plants
  // them and paid off where it pays them off.
  if (body.twists !== undefined) {
    const seen = new Set();
    out.twists = list('twists').filter((t) => {
      const due = twistById.get(t?.twist_id);
      return due && t.what === due.what && !seen.has(due.id) && seen.add(due.id);
    }).slice(0, MAX.twists).map((t) => ({
      twist_id: t.twist_id, title: twistById.get(t.twist_id).title, what: t.what,
      beat: intIn(t.beat, 1, 14), note: str(t.note, MAX.field), quote: quote(t.quote), keep: t.keep !== false,
    }));
  }
  return out;
}

const LISTS = ['characters', 'secrets', 'threads', 'relationships', 'follow_ups', 'goals', 'twists'];

async function save(sequelize, episode, fields, { status, drafted = false }) {
  const existing = await rowOf(sequelize, episode.id);
  const json = (v) => JSON.stringify(v || []);
  if (!existing) {
    await sequelize.query(
      `INSERT INTO episode_story_records (episode_id, show_id, status, what_happened, ${LISTS.join(', ')}, drafted_at, created_at, updated_at)
       VALUES (:episodeId, :showId, :status, :what, ${LISTS.map((c) => `CAST(:${c} AS jsonb)`).join(', ')}, ${drafted ? 'NOW()' : 'NULL'}, NOW(), NOW())`,
      { replacements: {
        episodeId: episode.id, showId: episode.show_id || null, status, what: fields.what_happened || null,
        ...Object.fromEntries(LISTS.map((c) => [c, json(fields[c])])),
      } });
  } else {
    const sets = ['status = :status', 'updated_at = NOW()'];
    const replacements = { id: existing.id, status };
    if (drafted) sets.push('drafted_at = NOW()', 'approved_by = NULL', 'approved_at = NULL');
    if (fields.what_happened !== undefined) { sets.push('what_happened = :what'); replacements.what = fields.what_happened || null; }
    for (const col of LISTS) {
      if (fields[col] !== undefined) { sets.push(`${col} = CAST(:${col} AS jsonb)`); replacements[col] = json(fields[col]); }
    }
    await sequelize.query(`UPDATE episode_story_records SET ${sets.join(', ')} WHERE id = :id`, { replacements });
  }
  return shape(await rowOf(sequelize, episode.id));
}

let client = null;
function getClient() {
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

function draftPrompt({ episode, event, cast, threads, goals = [], relationships = [], followUps = [], twists = [] }) {
  const evaluation = parse(episode.evaluation_json, null);
  const names = new Map(cast.map((c) => [c.id, c.name]));
  const people = cast.map((c) => {
    const secrets = c.secrets.length
      ? c.secrets.map((s) => `    - [${s.id}] ${s.text} (the audience: ${s.state}; known to: ${s.known_by.join(', ') || 'no one else'})`).join('\n')
      : '    (no kept secrets)';
    return `- [${c.id}] ${c.name}${c.is_lala ? ' (Lala herself)' : ''}${c.linked ? '' : ' (not in the character registry yet)'}\n  Secrets:\n${secrets}`;
  }).join('\n') || '(no characters are linked to this episode)';
  const open = threads.length ? threads.map((t) => `- [${t.id}] ${t.title}${t.description ? `: ${String(t.description).slice(0, 200)}` : ''}`).join('\n') : '(none)';
  const goalLines = goals.length
    ? goals.map((g) => `- [${g.slot}] ${g.label}${g.follow_up_id ? ' (owed from an earlier episode)' : ''}${g.completed ? ' (already ticked)' : ''}${g.beat ? ` (the script check finds it in beat ${g.beat})` : ' (the script check did not find it)'}`).join('\n')
    : '(none)';
  const relLines = relationships.length
    ? relationships.map((r) => `- [${r.character_id_a}] ${names.get(r.character_id_a) || '?'} and [${r.character_id_b}] ${names.get(r.character_id_b) || '?'}: ${r.relationship_type}${r.is_romantic ? ', romantic' : ''}${r.stage ? `, stage ${r.stage}` : ''}${r.tension_state ? `, ${r.tension_state}` : ''}`).join('\n')
    : '(none recorded between these people)';
  const followLines = followUps.length
    ? followUps.map((f) => `- ${f.text}${f.due_hint ? ` (due: ${f.due_hint})` : ''}${f.episode_number ? ` (from episode ${f.episode_number})` : ''}`).join('\n')
    : '(none)';
  const twistLines = twists.length
    ? twists.map((t) => `- [${t.id}] ${t.what === 'planted' ? 'PLANT' : 'PAY OFF'}: ${t.title}${t.description ? ` (${String(t.description).slice(0, 300)})` : ''}`).join('\n')
    : '(none)';
  const script = String(episode.script_content || '').trim();
  return `You keep the story record for "Styling Adventures with Lala". Read this episode and record what the audience saw, and what changed. Record only what is on the page: do not invent events, and do not reveal a secret the script only hints at.

EPISODE ${episode.episode_number ?? '?'}: "${episode.title || 'Untitled'}"${episode.description ? `\n${String(episode.description).slice(0, 1000)}` : ''}
${event ? `EVENT: ${event.name || ''}${event.venue_name ? ` at ${event.venue_name}` : ''}${event.narrative_stakes ? `\nSTAKES: ${event.narrative_stakes}` : ''}` : ''}
${evaluation ? `OUTCOME: ${String(evaluation.tier_final || '').toUpperCase()} (${evaluation.score ?? '?'}/100) ${evaluation.narrative_lines?.short || ''}` : ''}

THE PEOPLE IN IT, WITH THE SECRETS THEY KEEP:
${people}

LALA'S RELATIONSHIP GOALS FOR THIS EPISODE:
${goalLines}

THEIR RELATIONSHIPS SO FAR:
${relLines}

WHAT LALA STILL OWES PEOPLE (OPEN FOLLOW-UPS):
${followLines}

THE SHOW'S OPEN THREADS:
${open}

SEASON TWISTS THIS EPISODE WAS MEANT TO PLANT OR PAY OFF:
${twistLines}

THE SCRIPT:
${script ? script.slice(0, SCRIPT_LIMIT) : '(no script: work from the outline above)'}

Answer with JSON only:
{
  "what_happened": "one paragraph: what happened in this episode, as the audience saw it",
  "characters": [{"character_id": "an id above", "knew": "what they knew going in that mattered here", "learned": "what they found out here, or empty", "changed": "how they changed emotionally, or empty"}],
  "secrets": [{"secret_id": "an id above", "what": "hinted or revealed", "how": "the moment on the page that hints at or reveals it"}],
  "threads": [{"thread_id": "an open thread's id above, or null for a new one", "action": "new, advance or close", "title": "the question left open", "note": "where it stands after this episode", "quote": "the script's words that show it"}],
  "relationships": [{"a": "a person's id above", "b": "another person's id above", "type": "a short label, e.g. love_interest, friend, rival, mentor, collaborator", "is_romantic": true, "stage_before": "${STAGES.join(' | ')}", "stage_after": "the same list", "tension_before": 0, "tension_after": 0, "evidence_beat": 11, "note": "what changed between them, in a sentence", "quote": "the script's words that show it"}],
  "follow_ups": [{"person": "the id of who Lala owes, or null", "text": "what she should do next, e.g. follow up about the collab", "due_hint": "when, e.g. next episode", "quote": "the script's words that show it"}],
  "goals": [{"slot": "a goal's [slot] above", "covered": true, "beat": 11, "note": "how the script covers it, or why it does not", "quote": "the script's words that cover it, or empty"}],
  "twists": [{"twist_id": "a twist's id above", "what": "planted for a PLANT, paid_off for a PAY OFF", "beat": 6, "note": "how the script does it", "quote": "the script's words that do it"}]
}
List a secret only when the script shows it; "revealed" only when the audience now knows it. A relationship only when something between two people changed on the page; tension is 0 (none) to 10. "close" a thread only when the script answers its question. A follow-up only for something left for a later episode. One entry for each goal above. A twist only when the script really plants or pays it off. Each "quote" is copied word for word from the script, at most 25 words; leave it empty rather than paraphrase. "flirting" is for two people drawn to each other who are not together yet.`;
}

/** Drafts the record from the episode; saves it as a draft (a redraft replaces an earlier one). */
async function draftRecord(sequelize, episodeId) {
  const episode = await episodeOf(sequelize, episodeId);
  const { event, cast, profiles } = await castOf(sequelize, episode.id);
  const threads = await openThreads(sequelize, episode.show_id);
  if (!String(episode.script_content || '').trim() && !episode.description) {
    throw new RecordError('This episode has no script or description yet to record.', 409);
  }
  const goals = await goalsOf(sequelize, episode, event, profiles);
  const relationships = await relationshipsOf(sequelize, cast);
  const followUps = await openFollowUps(sequelize, episode.show_id);
  const twists = await dueTwists(sequelize, episode.id);
  let message;
  for (const model of MODELS) {
    try {
      message = await getClient().messages.create({ model, max_tokens: MAX_TOKENS, messages: [{ role: 'user', content: draftPrompt({ episode, event, cast, threads, goals, relationships, followUps, twists }) }] });
      break;
    } catch (modelErr) {
      console.warn(`[episodeStoryRecord] drafting with ${model} failed:`, modelErr.message);
      if (model === MODELS[MODELS.length - 1]) throw modelErr;
    }
  }
  let parsed;
  try {
    const raw = (message?.content?.[0]?.text || '').trim();
    parsed = JSON.parse((raw.match(/\{[\s\S]*\}/) || [raw])[0]);
  } catch (err) {
    console.error('[episodeStoryRecord] the draft could not be read:', err.message);
    throw new RecordError('The draft came back in a form that could not be read. Try again.', 502);
  }
  const listOf = (v) => (Array.isArray(v) ? v : []);
  const fields = clean({
    what_happened: parsed.what_happened, characters: listOf(parsed.characters), secrets: listOf(parsed.secrets), threads: listOf(parsed.threads),
    relationships: listOf(parsed.relationships), follow_ups: listOf(parsed.follow_ups), goals: listOf(parsed.goals), twists: listOf(parsed.twists),
  }, { cast, threads, goals, twists, script: episode.script_content });
  const saved = keepSavedKeys(fields, await rowOf(sequelize, episode.id));
  return { record: await save(sequelize, episode, saved, { status: 'draft', drafted: true }), cast, threads, goals, twists };
}

/**
 * Read it again (Evoni, 2026-10-23: "the card shows only what's new since
 * the last Save"). A read gives its items new keys; an item an earlier Save
 * already wrote takes that item's key back, so the card sees it as saved
 * (record.applied) and Save skips it. The same thread (by id or title), the
 * same pair of people, a follow-up saying much the same thing.
 */
function keepSavedKeys(fields, prev) {
  if (!prev) return fields;
  const applied = parse(prev.applied, {});
  const carry = (kind, same) => {
    const was = (parse(prev[kind], []) || []).filter((o) => o && o.key && applied[kind]?.[o.key]);
    const used = new Set();
    fields[kind] = (fields[kind] || []).map((x) => {
      const old = was.find((o) => !used.has(o.key) && same(o, x));
      if (!old) return x;
      used.add(old.key);
      return { ...x, key: old.key };
    });
  };
  const pair = (r) => [r.a, r.b].sort().join('|');
  carry('threads', (o, x) => (x.thread_id && (o.thread_id || applied.threads[o.key].thread_id) === x.thread_id) || flat(o.title) === flat(x.title));
  carry('relationships', (o, x) => pair(o) === pair(x));
  carry('follow_ups', (o, x) => sameText(o.text, x.text));
  return fields;
}

/** After completion: drafts the record when the episode has none. Never throws. */
async function draftLater(sequelize, episodeId) {
  try {
    if (await rowOf(sequelize, episodeId)) return null;
    return await draftRecord(sequelize, episodeId);
  } catch (err) {
    console.error('[episodeStoryRecord] drafting after completion failed (non-blocking):', err.message);
    return null;
  }
}

/** Evoni's edits. An approved record goes back to draft until she approves it again. */
async function updateRecord(sequelize, episodeId, body = {}) {
  const episode = await episodeOf(sequelize, episodeId);
  const { event, cast, profiles } = await castOf(sequelize, episode.id);
  const threads = await openThreads(sequelize, episode.show_id);
  const goals = await goalsOf(sequelize, episode, event, profiles);
  const twists = await dueTwists(sequelize, episode.id);
  const fields = clean(body, { cast, threads, goals, twists, script: episode.script_content });
  return { record: await save(sequelize, episode, fields, { status: 'draft' }), cast, threads, goals, twists };
}

// ── Save: each kept item, written once ─────────────────────────────────────

async function applyThread(sequelize, t, { episode, transaction }) {
  if (t.action === 'new') {
    // A redraft gives its items new keys: a thread of the same title is the same thread.
    const [[same]] = await sequelize.query(
      `SELECT id FROM show_story_threads WHERE show_id = :showId AND deleted_at IS NULL AND LOWER(title) = LOWER(:title) LIMIT 1`,
      { replacements: { showId: episode.show_id, title: t.title }, transaction });
    if (same) return { thread_id: same.id, action: 'exists', text: `Thread already there: ${t.title}` };
    const row = await require('./storyThreadService').createThread(sequelize, episode.show_id,
      { title: t.title, description: t.note || null, source: 'record', episode_id: episode.id }, { transaction });
    return { thread_id: row.id, action: 'new', text: `New thread: ${t.title}` };
  }
  if (t.action === 'close') {
    await sequelize.query(
      `UPDATE show_story_threads SET status = 'closed', closed_at = NOW(), last_advanced_episode_id = :episodeId, last_advanced_at = NOW(), updated_at = NOW()
        WHERE id = :id AND deleted_at IS NULL AND status <> 'closed'`,
      { replacements: { id: t.thread_id, episodeId: episode.id }, transaction });
    return { thread_id: t.thread_id, action: 'close', text: `Closed: ${t.title}` };
  }
  // The advance of services/storyCanon acceptProposal; the note stays in the record.
  await sequelize.query(
    `UPDATE show_story_threads SET status = 'advanced', last_advanced_episode_id = :episodeId, last_advanced_at = NOW(), updated_at = NOW()
      WHERE id = :id AND deleted_at IS NULL AND status <> 'closed'`,
    { replacements: { id: t.thread_id, episodeId: episode.id }, transaction });
  return { thread_id: t.thread_id, action: 'advance', text: `Moved on: ${t.title}${t.note ? ` (${t.note})` : ''}` };
}

async function applyRelationship(sequelize, r, { episode, people, transaction }) {
  const a = people.get(r.a);
  const b = people.get(r.b);
  const unlinked = [a, b].filter((p) => !p?.linked || !UUID_RE.test(p.id));
  if (unlinked.length) return { skipped: unlinked.map((p) => ({ kind: 'relationship', reason: 'not_linked', name: p?.name || '?', profile_id: p?.profile_id ?? null })) };
  const [[found]] = await sequelize.query(
    `SELECT id, situation FROM character_relationships
      WHERE deleted_at IS NULL AND ((character_id_a = :a AND character_id_b = :b) OR (character_id_a = :b AND character_id_b = :a))
      ORDER BY (is_romantic = :romantic) DESC, updated_at DESC LIMIT 1`,
    { replacements: { a: a.id, b: b.id, romantic: r.is_romantic }, transaction });
  const lalaSide = a.is_lala || b.is_lala;
  let relationshipId;
  let made = false;
  if (found) {
    relationshipId = found.id;
    await sequelize.query(
      `UPDATE character_relationships
          SET is_romantic = is_romantic OR :romantic, confirmed = true,
              situation = COALESCE(situation, :note),
              lala_connection = CASE WHEN :lalaSide AND lala_connection = 'none' THEN 'knows_lala' ELSE lala_connection END,
              updated_at = NOW()
        WHERE id = :id`,
      { replacements: { id: relationshipId, romantic: r.is_romantic, note: r.note || null, lalaSide }, transaction });
  } else {
    const type = r.is_romantic ? ROMANTIC_TYPE : (r.type || 'acquaintance');
    // The unique index (a, b, type) counts a soft-deleted row: that one comes back.
    const [[row]] = await sequelize.query(
      `INSERT INTO character_relationships (id, character_id_a, character_id_b, relationship_type, connection_mode, lala_connection, status,
              situation, is_romantic, confirmed, created_at, updated_at)
       VALUES (gen_random_uuid(), :a, :b, :type, 'IRL', :lalaConnection, 'Active', :note, :romantic, true, NOW(), NOW())
       ON CONFLICT (character_id_a, character_id_b, relationship_type)
         DO UPDATE SET deleted_at = NULL, confirmed = true, is_romantic = character_relationships.is_romantic OR EXCLUDED.is_romantic, updated_at = NOW()
       RETURNING id`,
      { replacements: { a: a.id, b: b.id, type, lalaConnection: lalaSide ? 'knows_lala' : 'none', note: r.note || null, romantic: r.is_romantic }, transaction });
    relationshipId = row.id;
    made = true;
  }
  // One event for the pair in this episode.
  const [[already]] = await sequelize.query(
    `SELECT id FROM relationship_events WHERE relationship_id = :id AND deleted_at IS NULL AND metadata->>'episode_id' = :episodeId LIMIT 1`,
    { replacements: { id: relationshipId, episodeId: episode.id }, transaction });
  let eventId = already?.id || null;
  if (!eventId) {
    const before = r.stage_before;
    const eventType = before === r.stage_after ? 'milestone' : (!before || before === 'strangers' ? 'first_meeting' : 'escalation');
    const [[ev]] = await sequelize.query(
      `INSERT INTO relationship_events (id, relationship_id, event_type, title, description, tension_before, tension_after, relationship_stage, metadata, created_at, updated_at)
       VALUES (gen_random_uuid(), :id, :eventType, :title, :description, :tb, :ta, :stage, CAST(:metadata AS jsonb), NOW(), NOW())
       RETURNING id`,
      { replacements: {
        id: relationshipId, eventType, title: `Episode ${episode.episode_number ?? ''}: ${a.name} and ${b.name}`.slice(0, 255),
        description: r.note || null, tb: r.tension_before, ta: r.tension_after, stage: r.stage_after,
        metadata: JSON.stringify({ episode_id: episode.id, beat: r.evidence_beat, stage_before: before, source: 'record' }),
      }, transaction });
    eventId = ev.id;
  }
  const stage = r.stage_before || r.stage_after ? `, ${r.stage_before || '?'} to ${r.stage_after || '?'}` : '';
  return {
    relationship_id: relationshipId, event_id: eventId,
    text: `${made ? 'New relationship' : 'Relationship'}: ${a.name} and ${b.name}${r.is_romantic ? ' (love interest)' : r.type ? ` (${r.type.replace(/_/g, ' ')})` : ''}${stage}`,
  };
}

async function applyFollowUp(sequelize, f, { episode, people, by, transaction }) {
  const person = f.person ? people.get(f.person) : null;
  const [[same]] = await sequelize.query(
    `SELECT id FROM show_follow_ups WHERE show_id = :showId AND from_episode_id = :episodeId AND deleted_at IS NULL AND LOWER(text) = LOWER(:text) LIMIT 1`,
    { replacements: { showId: episode.show_id, episodeId: episode.id, text: f.text }, transaction });
  if (same) return { follow_up_id: same.id, text: `Follow-up already there: ${f.text}` };
  const [[row]] = await sequelize.query(
    `INSERT INTO show_follow_ups (id, show_id, from_episode_id, profile_id, registry_character_id, text, due_hint, status, created_by, created_at, updated_at)
     VALUES (gen_random_uuid(), :showId, :episodeId, :profileId, :characterId, :text, :due, 'open', :by, NOW(), NOW())
     RETURNING id`,
    { replacements: {
      showId: episode.show_id, episodeId: episode.id,
      profileId: Number.isInteger(Number(person?.profile_id)) && person?.profile_id != null ? Number(person.profile_id) : null,
      characterId: person?.linked && UUID_RE.test(person.id) ? person.id : null,
      text: f.text, due: f.due_hint || null, by,
    }, transaction });
  return { follow_up_id: row.id, text: `Follow-up: ${f.text}${f.due_hint ? ` (${f.due_hint})` : ''}` };
}

/** Ticks the to-do list's goal tasks the record says are covered; { ticked: [slot], missing: bool }. */
async function tickGoals(sequelize, goals, { episode, transaction }) {
  if (!goals.length) return { ticked: [], missing: false };
  const [[list]] = await sequelize.query(
    'SELECT id, social_tasks FROM episode_todo_lists WHERE episode_id = :episodeId AND deleted_at IS NULL LIMIT 1',
    { replacements: { episodeId: episode.id }, transaction });
  if (!list) return { ticked: [], missing: true };
  const bySlot = new Map(goals.map((g) => [g.slot, g]));
  const ticked = [];
  const tasks = parse(list.social_tasks, []).map((t) => {
    const g = t && bySlot.get(t.slot);
    if (!g || t.task_source !== 'goal' || t.completed) return t;
    ticked.push(g.slot);
    return { ...t, completed: true, completed_source: 'record', ...(g.beat ? { completed_beat: g.beat } : {}) };
  });
  if (ticked.length) {
    await sequelize.query('UPDATE episode_todo_lists SET social_tasks = CAST(:tasks AS jsonb), updated_at = NOW() WHERE id = :id',
      { replacements: { id: list.id, tasks: JSON.stringify(tasks) }, transaction });
    // A follow-up carried from an earlier episode is done in this one.
    await require('./storyCarryForward').settleFollowUps(sequelize, tasks.filter((t) => t && ticked.includes(t.slot)), { episodeId: episode.id, transaction });
  }
  return { ticked, missing: false };
}

/**
 * Save (Evoni, 2026-10-23): it counts. Writers read it, each kept secret
 * moves on with the audience, and each kept item is written, once: what
 * was written is in `applied`, so a second Save writes nothing new.
 * Returns getRecord's shape and result { written: [{ kind, text }],
 * skipped: [{ kind, reason, name }] }.
 */
async function approveRecord(sequelize, episodeId, { by = null } = {}) {
  const episode = await episodeOf(sequelize, episodeId);
  if (!(await rowOf(sequelize, episode.id))) throw new RecordError('There is no record to approve yet. Draft it first.', 409);
  const { cast } = await castOf(sequelize, episode.id);
  const people = new Map(cast.map((c) => [c.id, c]));
  const where = `Episode ${episode.episode_number ?? ''}${episode.title ? `: ${episode.title}` : ''}`.trim();
  const written = [];
  const skipped = [];
  await sequelize.transaction(async (transaction) => {
    // Read inside the transaction, locked: two Saves at once write once.
    const [[row]] = await sequelize.query(
      'SELECT * FROM episode_story_records WHERE episode_id = :episodeId AND deleted_at IS NULL FOR UPDATE',
      { replacements: { episodeId: episode.id }, transaction });
    if (!String(row.what_happened || '').trim()) throw new RecordError('Say what happened before approving it.');
    const applied = { ...parse(row.applied, {}) };
    const done = (kind) => { applied[kind] = { ...(applied[kind] || {}) }; return applied[kind]; };
    const kept = (items) => (items || []).filter((x) => x && x.keep !== false);

    const secretsDone = done('secrets');
    for (const s of kept(row.secrets)) {
      if (secretsDone[s.secret_id] === s.what || (secretsDone[s.secret_id] === 'revealed')) continue;
      // Revealed wins; a hint never takes back a reveal.
      const allowed = s.what === 'revealed' ? "('hidden', 'hinted')" : "('hidden')";
      const [, meta] = await sequelize.query(
        `UPDATE character_secrets SET state = :state, state_where = CAST(:where AS jsonb), updated_at = NOW()
          WHERE id = :id AND deleted_at IS NULL AND state IN ${allowed}`,
        { replacements: { id: s.secret_id, state: s.what, where: JSON.stringify({ note: where, episode_id: episode.id }) }, transaction });
      secretsDone[s.secret_id] = s.what;
      if (meta?.rowCount) written.push({ kind: 'secret', text: `${s.what === 'revealed' ? 'Revealed' : 'Hinted at'}: ${s.text}` });
    }

    if (episode.show_id) {
      const threadsDone = done('threads');
      for (const t of kept(row.threads)) {
        if (!t.key || threadsDone[t.key]) continue;
        const r = await applyThread(sequelize, t, { episode, transaction });
        threadsDone[t.key] = { thread_id: r.thread_id, action: r.action };
        written.push({ kind: 'thread', text: r.text });
      }
    } else if (kept(row.threads).length || kept(row.follow_ups).length) {
      skipped.push({ kind: 'thread', reason: 'no_show', name: '' });
    }

    const relDone = done('relationships');
    for (const r of kept(row.relationships)) {
      if (!r.key || relDone[r.key]) continue;
      const out = await applyRelationship(sequelize, r, { episode, people, transaction });
      if (out.skipped) { skipped.push(...out.skipped); continue; }
      relDone[r.key] = { relationship_id: out.relationship_id, event_id: out.event_id };
      written.push({ kind: 'relationship', text: out.text });
    }

    if (episode.show_id) {
      const followDone = done('follow_ups');
      for (const f of kept(row.follow_ups)) {
        if (!f.key || followDone[f.key]) continue;
        const out = await applyFollowUp(sequelize, f, { episode, people, by, transaction });
        followDone[f.key] = out.follow_up_id;
        written.push({ kind: 'follow_up', text: out.text });
      }
    }

    const goalsDone = done('goals');
    const toTick = kept(row.goals).filter((g) => g.covered && !goalsDone[g.slot]);
    const { ticked, missing } = await tickGoals(sequelize, toTick, { episode, transaction });
    for (const g of toTick) {
      goalsDone[g.slot] = true;
      if (ticked.includes(g.slot)) written.push({ kind: 'goal', text: `Goal ticked: ${g.label}${g.beat ? ` (beat ${g.beat})` : ''}` });
    }
    if (missing) skipped.push({ kind: 'goal', reason: 'no_todo_list', name: '' });

    // Twists: planted, or paid off, in this episode; never moved back.
    const twistsDone = done('twists');
    for (const t of kept(row.twists)) {
      if (twistsDone[t.twist_id] === t.what || twistsDone[t.twist_id] === 'paid_off') continue;
      const sql = t.what === 'paid_off'
        ? `UPDATE season_twists SET status = 'paid_off', paid_off_episode_id = :episodeId, updated_at = NOW()
            WHERE id = :id AND deleted_at IS NULL AND status IN ('planned', 'planted')`
        : `UPDATE season_twists SET status = 'planted', planted_episode_id = :episodeId, updated_at = NOW()
            WHERE id = :id AND deleted_at IS NULL AND status = 'planned'`;
      const [, meta] = await sequelize.query(sql, { replacements: { id: t.twist_id, episodeId: episode.id }, transaction });
      twistsDone[t.twist_id] = t.what;
      if (meta?.rowCount) written.push({ kind: 'twist', text: `${t.what === 'paid_off' ? 'Twist paid off' : 'Twist planted'}: ${t.title}${t.beat ? ` (beat ${t.beat})` : ''}` });
    }

    await sequelize.query(
      `UPDATE episode_story_records SET status = 'approved', approved_by = :by, approved_at = NOW(), applied = CAST(:applied AS jsonb), updated_at = NOW() WHERE id = :id`,
      { replacements: { id: row.id, by, applied: JSON.stringify(applied) }, transaction });
  });
  return { ...(await getRecord(sequelize, episode.id)), result: { written, skipped } };
}

/** The approved record as prompt text for the short story and chapter writers; '' when none. */
async function recordBlock(sequelize, episodeId) {
  let row;
  try {
    [[row]] = await sequelize.query(
      `SELECT what_happened, characters, secrets, threads FROM episode_story_records
        WHERE episode_id = :episodeId AND deleted_at IS NULL AND status = 'approved'`, { replacements: { episodeId } });
  } catch (err) {
    // Before the migration has run the table is not there: writers go without it.
    console.error('[episodeStoryRecord] the record could not be read:', err.message);
    return '';
  }
  if (!row) return '';
  const kept = (items) => (items || []).filter((x) => x && x.keep !== false);
  const lines = ['THE EPISODE STORY RECORD (approved; what the audience saw. Stay consistent with it; go beneath it, never against it):'];
  if (row.what_happened) lines.push(`What happened: ${row.what_happened}`);
  for (const c of row.characters || []) {
    const parts = [c.knew && `knew ${c.knew}`, c.learned && `learned ${c.learned}`, c.changed && `changed: ${c.changed}`].filter(Boolean);
    if (parts.length) lines.push(`- ${c.name}: ${parts.join('; ')}`);
  }
  if (kept(row.secrets).length) {
    lines.push('Secrets the audience has seen so far in this episode:');
    for (const s of kept(row.secrets)) lines.push(`- ${s.what === 'revealed' ? 'Revealed' : 'Hinted'}: ${s.text}${s.how ? ` (${s.how})` : ''}`);
  }
  if (kept(row.threads).length) {
    lines.push('Left open:');
    for (const t of kept(row.threads)) lines.push(`- ${t.title}${t.note ? `: ${t.note}` : ''}`);
  }
  return lines.join('\n');
}

module.exports = {
  RecordError, getRecord, draftRecord, draftLater, updateRecord, approveRecord, recordBlock, draftPrompt, clean,
  castOf, openThreads, keepSavedKeys, STAGES, SCRIPT_LIMIT,
};
