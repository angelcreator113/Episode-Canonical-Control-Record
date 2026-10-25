'use strict';

/**
 * Character voices that learn (Evoni, 2026-10-25). Every character's voice
 * learns from what she approves and how she changes the AI's lines: Lala,
 * JustAWoman (her script labels Me, Prime, JustAWoman and JAWIHP) and every
 * cast member. The book and the show share one voice per character; each
 * rule and line carries where it was said:
 *
 *   gameplay   show beats 1-10 and 14
 *   cutscene   show beats 11-13 (utils/scriptShowRules isCutsceneBeat)
 *   narration  the book's prose
 *
 * What it keeps (migration 20261025200000; raw SQL here, the VoiceSignal and
 * VoiceRule models keep their old attributes so the book's existing routes
 * read the same before and after the migration):
 *
 *   character_voice_lines  every line she approved, per character
 *   voice_signals          what the AI wrote and what she made of it
 *   voice_rules            what was learned from them; a SMALL rule (a word,
 *                          a catchphrase, a greeting, line length, a banned
 *                          word, punctuation) applies by itself (auto_applied,
 *                          with Undo); a MAJOR one (personality, values,
 *                          attitude, a relationship stance) waits for her
 *                          Approve. A newer rule that conflicts with an older
 *                          one for the same character, context and kind
 *                          supersedes it (voices grow over the season); Undo
 *                          puts the older one back.
 *
 *   resolveCharacterKey / makeResolver   a script speaker's character slug
 *   captureOnLock(models, { episodeId, newlyLocked })  approved lines and
 *                          what she changed, when beats are locked
 *   recordSignal(...)      a rewrite she accepted (POST /api/v1/voice/signals)
 *   captureBookEdit / captureBookLine    the book's edits and approved lines
 *   learnVoice(models, { characterKey })  one AI side call per character per
 *                          run (Haiku 4.5): the new signals become rules
 *   characterVoiceView, episodeSpeakers, episodeRules, approveRule,
 *   dismissRule, undoRule  the review API (routes/characterVoiceRoutes.js)
 *   voicePromptBlock(models, { characterKeys, context })  "HOW <NAME> REALLY
 *                          SOUNDS" for the writers
 *
 * Before the migration has run every read returns nothing and every capture
 * is a logged no-op; the routes answer 409 (VoiceSchemaMissing). Nothing
 * here ever fails a script save or a lock: the callers fire and forget.
 */

const crypto = require('crypto');
const { QueryTypes } = require('sequelize');
const { speakerLine, scriptCast, unquote, isHerSpeaker } = require('../utils/scriptSpeaker');
const { isCutsceneBeat } = require('../utils/scriptShowRules');
const { usableFirstName } = require('../utils/firstNames');

// A side call (CLAUDE.md: Haiku 4.5 for side calls), two attempts.
const MODELS = ['claude-haiku-4-5-20251001'];
const MAX_TOKENS = 2000;

const CONTEXTS = ['gameplay', 'cutscene', 'narration'];
const RULE_CONTEXTS = [...CONTEXTS, 'all'];
const SIGNAL_SOURCES = ['episode_edit', 'episode_rewrite', 'approved_line', 'book_edit'];
const LINE_SOURCES = ['approved', 'edited', 'rewrite', 'book'];
const SMALL_TYPES = ['word_choice', 'catchphrase', 'greeting', 'line_length', 'banned_word', 'punctuation'];
const MAJOR_TYPES = ['personality', 'values', 'attitude', 'relationship'];
const RULE_TYPES = [...SMALL_TYPES, ...MAJOR_TYPES];
// One strong, explicit edit is enough for these; the rest need three alike.
const ONE_EDIT_TYPES = ['catchphrase', 'banned_word'];
const MIN_GROUP = 3;
const STRONG = 0.8;
const MAX_SIGNALS_PER_RUN = 40;
const LEARN_EVERY_MS = 2 * 60 * 1000;   // a character learns at most this often unless asked
const PROFILE_FIELDS = [
  ['speech_pattern', 'Speech pattern'],
  ['vocabulary_tone', 'Vocabulary and tone'],
  ['catchphrases', 'Catchphrases'],
  ['tell', 'Tell'],
  ['internal_monologue_style', 'Inner voice'],
  ['emotional_reactivity', 'When emotions hit'],
];
const KEY_RE = /^[a-z0-9][a-z0-9_-]{0,79}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class VoiceError extends Error {
  constructor(status, message, code = null) { super(message); this.status = status; this.code = code; }
}
class VoiceSchemaMissing extends VoiceError {
  constructor() { super(409, "The database update for learned voices hasn't run yet.", 'VOICE_SCHEMA_MISSING'); }
}

/** Postgres 42P01 (no table) or 42703 (no column): the migration has not run. */
function isSchemaMissing(err) {
  const code = err?.original?.code || err?.parent?.code || err?.code;
  return code === '42P01' || code === '42703'
    || /relation "?character_voice_lines"? does not exist|column "?[a-z_]+"? (of relation "?[a-z_]+"? )?does not exist/i.test(String(err?.message || ''));
}

const sql = (models, text, replacements = {}, options = {}) =>
  models.sequelize.query(text, { replacements, type: QueryTypes.SELECT, ...options });
const run = (models, text, replacements = {}, options = {}) =>
  models.sequelize.query(text, { replacements, ...options });

/** True when the migration's table and columns are there. */
async function schemaReady(models) {
  if (!models?.sequelize) return false;
  try {
    const [row] = await sql(models, `SELECT to_regclass('public.character_voice_lines') IS NOT NULL AS lines,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'voice_rules' AND column_name = 'supersedes_rule_id') AS rules,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'voice_signals' AND column_name = 'character_key') AS signals`);
    return Boolean(row?.lines && row?.rules && row?.signals);
  } catch (err) {
    console.error('[CharacterVoice] schema check failed:', err.message);
    return false;
  }
}
async function requireSchema(models) {
  if (!(await schemaReady(models))) throw new VoiceSchemaMissing();
}

const normText = (t) => String(t ?? '').replace(/[‘’]/g, '\'').replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
const textHash = (t) => crypto.createHash('sha256').update(normText(t).toLowerCase()).digest('hex');
const contextForBeat = (n) => (isCutsceneBeat(n) ? 'cutscene' : 'gameplay');
const normKey = (k) => String(k ?? '').trim().toLowerCase();
const isKey = (k) => KEY_RE.test(normKey(k));
const words = (t) => normText(t).toLowerCase().match(/[\p{L}\p{N}']+/gu) || [];

/** Word overlap of two lines, 0..1 (Jaccard). */
function similarity(a, b) {
  const A = new Set(words(a));
  const B = new Set(words(b));
  if (!A.size && !B.size) return 1;
  let both = 0;
  for (const w of A) if (B.has(w)) both += 1;
  return both / (A.size + B.size - both);
}

// ── Who a speaker is ────────────────────────────────────────────────────────

const plainName = (s) => String(s ?? '').trim().replace(/^@+/, '').replace(/\s*\([^)]*\)\s*$/, '').replace(/\s+/g, ' ').toLowerCase();
const slugOf = (s) => plainName(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

async function showOfEpisode(models, episodeId) {
  if (!episodeId || !UUID_RE.test(String(episodeId))) return null;
  try {
    const [row] = await sql(models, 'SELECT show_id FROM episodes WHERE id = :episodeId', { episodeId });
    return row?.show_id || null;
  } catch (err) {
    console.error('[CharacterVoice] episode show read failed:', err.message);
    return null;
  }
}

/** The registry's characters a speaker can name: the show's registries first, then those with no show. */
async function loadCandidates(models, showId) {
  const query = (aliases) => sql(models, `
    SELECT rc.id, rc.character_key, rc.display_name, rc.selected_name, sp.handle, sp.display_name AS profile_name,
           ${aliases ? 'sp.aliases' : 'NULL'} AS aliases, cr.show_id
      FROM registry_characters rc
      LEFT JOIN character_registries cr ON cr.id = rc.registry_id AND cr.deleted_at IS NULL
      LEFT JOIN social_profiles sp ON sp.id = rc.feed_profile_id AND sp.deleted_at IS NULL
     WHERE rc.deleted_at IS NULL AND rc.character_key IS NOT NULL
       ${showId ? 'AND (cr.show_id = :showId OR cr.show_id IS NULL)' : ''}
     ORDER BY (cr.show_id IS NOT NULL) DESC, rc.updated_at DESC NULLS LAST
     LIMIT 2000`, { showId });
  try {
    return await query(true);
  } catch (err) {
    // social_profiles.aliases came with 20261023220000; without it, names and handles still match.
    if (isSchemaMissing(err)) {
      try { return await query(false); } catch (err2) { console.error('[CharacterVoice] registry read failed:', err2.message); return []; }
    }
    console.error('[CharacterVoice] registry read failed:', err.message);
    return [];
  }
}

/**
 * A resolver for one show: resolve(speaker) → { characterKey, name } or null.
 * Her labels are 'justawoman', Lala is 'lala'; anyone else is the registry
 * character a name, a first name, a Feed handle or an alias names, by its
 * slug (character_key). A speaker no one answers to (Guest) is null.
 */
async function makeResolver(models, { showId = null, episodeId = null } = {}) {
  const show = showId && UUID_RE.test(String(showId)) ? showId : await showOfEpisode(models, episodeId);
  let candidates = null;
  const cache = new Map();
  const load = async () => {
    if (!candidates) candidates = models?.sequelize ? await loadCandidates(models, show) : [];
    return candidates;
  };
  const resolve = async (speaker) => {
    const raw = String(speaker ?? '').trim();
    if (!raw) return null;
    if (isHerSpeaker(raw) || plainName(raw) === 'just a woman') return { characterKey: 'justawoman', name: 'JustAWoman' };
    const name = plainName(raw);
    if (name === 'lala') return { characterKey: 'lala', name: 'Lala' };
    if (name === 'guest' || !name) return null;
    if (cache.has(name)) return cache.get(name);
    const list = await load();
    const slug = slugOf(raw);
    const pick = (c) => ({ characterKey: normKey(c.character_key), name: c.display_name || c.selected_name || raw });
    const aliasesOf = (c) => {
      let a = c.aliases;
      if (typeof a === 'string') { try { a = JSON.parse(a); } catch (err) { console.error('[CharacterVoice] aliases unreadable:', err.message); a = []; } }
      return Array.isArray(a) ? a.map((x) => plainName(typeof x === 'string' ? x : x?.name)) : [];
    };
    const tests = [
      (c) => normKey(c.character_key) === name || normKey(c.character_key) === slug,
      (c) => plainName(c.display_name) === name,
      (c) => plainName(c.selected_name) === name,
      (c) => plainName(c.profile_name) === name,
      (c) => plainName(c.handle) === name || slugOf(c.handle) === slug,
      (c) => aliasesOf(c).includes(name),
    ];
    let found = null;
    for (const t of tests) {
      const hit = list.find(t);
      if (hit) { found = pick(hit); break; }
    }
    if (!found) {
      // A first name stands for someone only when it names one character.
      const firsts = list.filter((c) => {
        const f = usableFirstName(c.display_name) || usableFirstName(c.selected_name);
        return f && plainName(f) === name;
      });
      const keys = new Set(firsts.map((c) => normKey(c.character_key)));
      if (keys.size === 1) found = pick(firsts[0]);
    }
    cache.set(name, found);
    return found;
  };
  return { resolve, showId: show };
}

async function resolveCharacterKey(models, { speaker, showId = null, episodeId = null } = {}) {
  const r = await (await makeResolver(models, { showId, episodeId })).resolve(speaker);
  return r ? r.characterKey : null;
}

// ── The script's dialogue ───────────────────────────────────────────────────

/** Each beat's spoken lines: Map(beatNumber → [{ speaker, label, words }]). */
function scriptDialogue(script) {
  const { splitScriptBeats } = require('../utils/scriptBeatLocks');
  const { beats } = splitScriptBeats(String(script || ''));
  const all = beats.flatMap((b) => b.text.split('\n').slice(1));
  const cast = scriptCast(all);
  const out = new Map();
  for (const b of beats) {
    const lines = [];
    for (const l of b.text.split('\n').slice(1)) {
      const sp = speakerLine(l, { cast });
      if (!sp) continue;
      const said = normText(unquote(sp.words));
      // A line that is only a stage direction says nothing.
      if (!said || !said.replace(/\([^)]*\)|\[[^\]]*\]/g, '').trim()) continue;
      lines.push({ speaker: sp.speaker, label: sp.label, words: said });
    }
    if (!out.has(b.number)) out.set(b.number, lines);
    else out.get(b.number).push(...lines);
  }
  return out;
}

/**
 * Pairs what the AI wrote with what she kept, per character, in one beat:
 * a line kept word for word pairs with itself and is no change; the rest
 * pair with the most alike line left (at least 0.2 of the words shared, or
 * the only line each side has). Returns [{ original, edited }] that differ.
 */
function alignChanges(aiLines, herLines) {
  const ai = aiLines.map((l) => l.words);
  const hers = herLines.map((l) => l.words);
  const used = new Set();
  const left = [];
  for (const h of hers) {
    const i = ai.findIndex((a, j) => !used.has(j) && normText(a).toLowerCase() === normText(h).toLowerCase());
    if (i >= 0) used.add(i); else left.push(h);
  }
  const changes = [];
  for (const h of left) {
    let best = -1;
    let score = -1;
    ai.forEach((a, j) => {
      if (used.has(j)) return;
      const s = similarity(a, h);
      if (s > score) { score = s; best = j; }
    });
    if (best < 0) continue;
    const onlyPair = ai.length - used.size === 1 && left.length === 1;
    if (score >= 0.2 || onlyPair) {
      used.add(best);
      changes.push({ original: ai[best], edited: h });
    }
  }
  return changes;
}

// ── Writing what she approved and changed ───────────────────────────────────

async function insertLine(models, row) {
  const text = normText(row.text);
  if (!text || !row.characterKey) return null;
  const [rows] = await run(models, `
    INSERT INTO character_voice_lines (character_key, show_id, episode_id, beat_number, book_id, chapter_id, context, text, text_hash, source)
    VALUES (:characterKey, :showId, :episodeId, :beatNumber, :bookId, :chapterId, :context, :text, :hash, :source)
    ON CONFLICT (character_key, text_hash) WHERE deleted_at IS NULL DO NOTHING
    RETURNING id`, {
    characterKey: normKey(row.characterKey), showId: row.showId || null, episodeId: row.episodeId || null,
    beatNumber: row.beatNumber ?? null, bookId: row.bookId || null, chapterId: row.chapterId || null,
    context: CONTEXTS.includes(row.context) ? row.context : 'gameplay', text: text.slice(0, 4000), hash: textHash(text),
    source: LINE_SOURCES.includes(row.source) ? row.source : 'approved',
  });
  return rows?.[0]?.id || null;
}

async function insertSignal(models, row) {
  const original = normText(row.original);
  const edited = normText(row.edited);
  if (!original || !edited || original === edited || !row.characterKey) return null;
  const rep = {
    original: original.slice(0, 4000), edited: edited.slice(0, 4000),
    sceneContext: row.sceneContext ? String(row.sceneContext).slice(0, 100) : null,
    diff: row.diffSummary ? String(row.diffSummary).slice(0, 1000) : null,
    characterKey: normKey(row.characterKey), context: CONTEXTS.includes(row.context) ? row.context : 'gameplay',
    episodeId: row.episodeId || null, beatNumber: row.beatNumber ?? null,
    source: SIGNAL_SOURCES.includes(row.source) ? row.source : 'episode_edit',
  };
  const [rows] = await run(models, `
    INSERT INTO voice_signals (original_text, edited_text, scene_context, diff_summary, character_key, context, episode_id, beat_number, source, status, pattern_confidence, created_at, updated_at)
    SELECT :original, :edited, :sceneContext, :diff, :characterKey, :context, :episodeId, :beatNumber, :source, CAST('raw' AS enum_voice_signals_status), 0, NOW(), NOW()
     WHERE NOT EXISTS (
       SELECT 1 FROM voice_signals
        WHERE character_key = :characterKey AND episode_id IS NOT DISTINCT FROM CAST(:episodeId AS uuid)
          AND beat_number IS NOT DISTINCT FROM CAST(:beatNumber AS integer)
          AND original_text = :original AND edited_text = :edited AND deleted_at IS NULL)
    RETURNING id`, rep);
  return rows?.[0]?.id || null;
}

/** The script as the AI wrote it: the first version kept after the newest Generate (or the oldest kept). */
async function aiScriptFor(models, episodeId) {
  // Compared in the database: a timestamp read into JavaScript loses its
  // microseconds, and the Generate row itself would read as "after" it.
  const [gen] = await sql(models, `SELECT id FROM episode_script_versions
    WHERE episode_id = :episodeId AND source = 'generate' ORDER BY created_at DESC, id DESC LIMIT 1`, { episodeId });
  // A Generate over an empty script keeps nothing (scriptVersions skips an
  // empty script), so without one the oldest kept version is the AI's.
  const [row] = gen
    ? await sql(models, `SELECT v.script_content FROM episode_script_versions v
        WHERE v.episode_id = :episodeId AND v.id <> :genId
          AND v.created_at >= (SELECT created_at FROM episode_script_versions WHERE id = :genId)
        ORDER BY v.created_at ASC, v.id ASC LIMIT 1`, { episodeId, genId: gen.id })
    : await sql(models, `SELECT script_content FROM episode_script_versions
        WHERE episode_id = :episodeId ORDER BY created_at ASC, id ASC LIMIT 1`, { episodeId });
  return row?.script_content || null;
}

const pending = new Set();
/** Runs a fire-and-forget task, logged; tests can await settled(). */
function background(label, fn) {
  const p = Promise.resolve().then(fn).catch((err) => {
    console.error(`[CharacterVoice] ${label} failed (the save went on):`, err.message);
    return null;
  });
  pending.add(p);
  p.finally(() => pending.delete(p));
  return p;
}
async function settled() {
  while (pending.size) await Promise.allSettled([...pending]);
}

/**
 * When beats are locked (PUT /episodes/:id/script-locks): every line a known
 * character says in the newly locked beats is an approved line, and each
 * line she changed from what the AI wrote is a signal. Then each character
 * with three or more new signals learns. Never throws.
 */
async function captureOnLock(models, { episodeId, newlyLocked = [], learn = true } = {}) {
  const summary = { lines: 0, signals: 0, learned: [] };
  try {
    const beats = [...new Set((newlyLocked || []).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 14))];
    if (!episodeId || !beats.length) return summary;
    if (!(await schemaReady(models))) {
      console.warn('[CharacterVoice] lock capture skipped: the voice migration has not run');
      return { ...summary, skipped: 'schema' };
    }
    const [episode] = await sql(models, 'SELECT id, show_id, script_content FROM episodes WHERE id = :episodeId', { episodeId });
    if (!episode?.script_content) return summary;
    const resolver = await makeResolver(models, { showId: episode.show_id, episodeId });
    const hers = scriptDialogue(episode.script_content);
    let ai = null;
    try {
      const aiText = await aiScriptFor(models, episodeId);
      ai = aiText ? scriptDialogue(aiText) : null;
    } catch (err) {
      console.error('[CharacterVoice] AI script read failed (lines are still kept):', err.message);
    }
    const touched = new Set();
    for (const n of beats) {
      const context = contextForBeat(n);
      const herLines = hers.get(n) || [];
      const byKey = new Map();
      for (const l of herLines) {
        const who = await resolver.resolve(l.speaker);
        if (!who) continue;
        if (!byKey.has(who.characterKey)) byKey.set(who.characterKey, { her: [], ai: [] });
        byKey.get(who.characterKey).her.push(l);
      }
      for (const l of ai?.get(n) || []) {
        const who = await resolver.resolve(l.speaker);
        if (who && byKey.has(who.characterKey)) byKey.get(who.characterKey).ai.push(l);
      }
      for (const [characterKey, sides] of byKey) {
        const changes = ai ? alignChanges(sides.ai, sides.her) : [];
        const changed = new Set(changes.map((c) => normText(c.edited).toLowerCase()));
        for (const l of sides.her) {
          const id = await insertLine(models, {
            characterKey, showId: episode.show_id, episodeId, beatNumber: n, context, text: l.words,
            source: changed.has(normText(l.words).toLowerCase()) ? 'edited' : 'approved',
          });
          if (id) summary.lines += 1;
        }
        for (const c of changes) {
          const id = await insertSignal(models, { ...c, characterKey, context, episodeId, beatNumber: n, source: 'episode_edit', sceneContext: `Episode beat ${n}` });
          if (id) { summary.signals += 1; touched.add(characterKey); }
        }
      }
    }
    if (learn) {
      for (const characterKey of touched) {
        const r = await maybeLearn(models, characterKey);
        if (r?.rules?.length) summary.learned.push(characterKey);
      }
    }
    if (summary.lines || summary.signals) {
      console.log(`[CharacterVoice] episode ${episodeId} beats ${beats.join(',')}: ${summary.lines} approved lines, ${summary.signals} edits`);
    }
  } catch (err) {
    console.error('[CharacterVoice] lock capture failed (the lock went on):', err.message);
  }
  return summary;
}

/** A rewrite she accepted on the Script tab (POST /api/v1/voice/signals). */
async function recordSignal(models, { episodeId, beatNumber = null, speaker, original, edited, direction = null, learn = true }) {
  await requireSchema(models);
  if (normText(original) === normText(edited)) return { skipped: true, reason: 'no change' };
  const who = await (await makeResolver(models, { episodeId })).resolve(speaker);
  if (!who) return { skipped: true, reason: 'unknown speaker' };
  const n = Number.isInteger(beatNumber) ? beatNumber : null;
  const context = n ? contextForBeat(n) : 'gameplay';
  const id = await insertSignal(models, {
    original, edited, characterKey: who.characterKey, context, episodeId, beatNumber: n, source: 'episode_rewrite',
    sceneContext: n ? `Episode beat ${n}` : 'Episode rewrite', diffSummary: direction ? `Rewrite direction: ${String(direction).slice(0, 200)}` : null,
  });
  if (!id) return { skipped: true, reason: 'already recorded', characterKey: who.characterKey };
  if (learn) background('learning after a rewrite', () => maybeLearn(models, who.characterKey));
  return { signal: { id, character_key: who.characterKey, name: who.name, context, beat_number: n, source: 'episode_rewrite' } };
}

/** Where a book line was said: the chapter or line says gameplay or cutscene; else narration. */
function bookContext(chapter, line) {
  const said = `${chapter?.chapter_type || ''} ${line?.voice_type || ''}`.toLowerCase();
  if (/cutscene/.test(said)) return 'cutscene';
  if (/gameplay/.test(said)) return 'gameplay';
  return 'narration';
}

/** The book's narrator: the book's character, or JustAWoman (Before Lala is her memoir). */
async function bookCharacterKey(models, book, characterName = null) {
  const resolver = await makeResolver(models, { showId: book?.show_id || null });
  if (characterName) {
    const who = await resolver.resolve(characterName);
    if (who) return who.characterKey;
  }
  if (book?.character_name) {
    const who = await resolver.resolve(book.character_name);
    return who ? who.characterKey : null;
  }
  return 'justawoman';
}

/** A book edit's signal row, tagged with its character and context, then learning. Never throws. */
async function captureBookEdit(models, { signalId = null, book = null, chapter = null, line = null, originalText, editedText, characterName = null, learn = true }) {
  try {
    if (!(await schemaReady(models))) return null;
    const characterKey = await bookCharacterKey(models, book, characterName);
    if (!characterKey) return null;
    const context = bookContext(chapter, line);
    if (signalId) {
      await run(models, `UPDATE voice_signals SET character_key = :characterKey, context = :context, source = 'book_edit',
        status = CASE WHEN status = 'analyzed' THEN CAST('raw' AS enum_voice_signals_status) ELSE status END, updated_at = NOW()
        WHERE id = :signalId`, { characterKey, context, signalId });
    } else {
      await insertSignal(models, { original: originalText, edited: editedText, characterKey, context, source: 'book_edit', sceneContext: chapter?.title || 'Book' });
    }
    if (learn) await maybeLearn(models, characterKey);
    return { characterKey, context };
  } catch (err) {
    console.error('[CharacterVoice] book edit capture failed (the edit is saved):', err.message);
    return null;
  }
}

/** An approved book line kept as one of the narrator's lines. Never throws. */
async function captureBookLine(models, { book = null, chapter = null, line }) {
  try {
    if (!line?.text || !(await schemaReady(models))) return null;
    const characterKey = await bookCharacterKey(models, book);
    if (!characterKey) return null;
    return await insertLine(models, {
      characterKey, showId: book?.show_id || null, bookId: book?.id || null, chapterId: chapter?.id || line.chapter_id || null,
      context: bookContext(chapter, line), text: line.text, source: 'book',
    });
  } catch (err) {
    console.error('[CharacterVoice] book line capture failed (the approval is saved):', err.message);
    return null;
  }
}

// ── Learning ────────────────────────────────────────────────────────────────

let client = null;
function getClient() {
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

const isBudget = (err) => err?.code === 'AI_BUDGET_EXCEEDED' || err?.status === 429;

async function askModel(prompt) {
  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const res = await getClient().messages.create({ model, max_tokens: MAX_TOKENS, messages: [{ role: 'user', content: prompt }] });
        return (res?.content || []).filter((b) => typeof b?.text === 'string').map((b) => b.text).join('').trim();
      } catch (err) {
        console.error(`[CharacterVoice] ${model} attempt ${attempt} failed:`, err.message);
        if (isBudget(err) || (model === MODELS[MODELS.length - 1] && attempt === 2)) throw err;
      }
    }
  }
  throw new Error('No model answered');
}

/** The reply's JSON object, or null. */
function parseReply(text) {
  const t = String(text || '').replace(/```json|```/g, '').trim();
  const at = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (at < 0 || end <= at) return null;
  try { return JSON.parse(t.slice(at, end + 1)); } catch (err) { console.error('[CharacterVoice] reply unreadable:', err.message); return null; }
}

/** A rule's machine-checkable form, cleaned, or null. */
function normalizeCheck(c) {
  if (!c || typeof c !== 'object') return null;
  const int = (v, lo, hi) => (Number.isInteger(Number(v)) && Number(v) >= lo && Number(v) <= hi ? Number(v) : null);
  const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
  switch (c.type) {
    case 'max_sentences': { const n = int(c.n, 1, 12); return n ? { type: 'max_sentences', n } : null; }
    case 'max_words': { const n = int(c.n, 1, 120); return n ? { type: 'max_words', n } : null; }
    case 'banned_word': { const word = str(c.word, 60); return word ? { type: 'banned_word', word } : null; }
    case 'uses_phrase': {
      const phrase = str(c.phrase, 80);
      if (!phrase) return null;
      const every = int(c.every_n_lines, 1, 50);
      return every ? { type: 'uses_phrase', phrase, every_n_lines: every } : { type: 'uses_phrase', phrase };
    }
    default: return null;
  }
}

function buildLearnPrompt(name, signals, rules) {
  return `You are learning how a character speaks from an author's edits. The character is ${name}.
Each SIGNAL is a line the AI wrote (ORIGINAL) and what the author made of it (EDITED), with where it was said:
gameplay (the show's playable beats), cutscene (the show's cinematic beats), narration (the book's prose).

SIGNALS:
${signals.map((s) => `#${s.id} [${s.context || 'gameplay'}]${s.diff_summary ? ` (${s.diff_summary})` : ''}
  ORIGINAL: ${s.original_text}
  EDITED:   ${s.edited_text}`).join('\n')}

RULES ALREADY IN USE (newest first):
${rules.length ? rules.map((r) => `R${r.id} [${r.context || 'all'}] ${r.rule_type}: ${r.rule_text}`).join('\n') : '(none)'}

For every signal, say what pattern it shows. Then write a rule only where three or more signals show the same pattern,
or where ONE edit is a strong, explicit catchphrase or banned word (the author added or removed one exact word or phrase).
Rule types: ${SMALL_TYPES.join(', ')} (small: how they say things) or ${MAJOR_TYPES.join(', ')} (major: who they are).
If a new rule replaces an older rule above (the voice grew), give that rule's number as supersedes.

Reply ONLY with JSON:
{"signals":[{"id":12,"pattern_tag":"snake_case_label","confidence":0.0,"diff_summary":"one sentence"}],
 "rules":[{"rule_text":"a direct instruction to a writer","rule_type":"line_length","context":"gameplay|cutscene|narration|all",
   "signal_ids":[12,13,14],"strong":false,"supersedes":null,
   "check":{"type":"max_sentences","n":2} or {"type":"max_words","n":20} or {"type":"banned_word","word":"..."} or {"type":"uses_phrase","phrase":"...","every_n_lines":6} or null}]}`;
}

const lastLearn = new Map();
const running = new Set();

/** Learns when a character has three or more new signals, and has not learned in the last two minutes. */
async function maybeLearn(models, characterKey) {
  const key = normKey(characterKey);
  try {
    const [row] = await sql(models, `SELECT COUNT(*)::int AS n FROM voice_signals
      WHERE character_key = :key AND status = 'raw' AND deleted_at IS NULL`, { key });
    if ((row?.n || 0) < MIN_GROUP) return null;
    if (Date.now() - (lastLearn.get(key) || 0) < LEARN_EVERY_MS) return null;
    return await learnVoice(models, { characterKey: key });
  } catch (err) {
    console.error(`[CharacterVoice] learning for ${key} failed:`, err.message);
    return null;
  }
}

/**
 * Reads a character's new signals (and the ones not yet part of a rule),
 * asks once what they show, and writes the rules three alike (or one strong
 * catchphrase or banned word) make. A small rule goes live by itself
 * (active, auto_applied); a major one is proposed. A rule that conflicts
 * with an older active one of the same context and kind supersedes it.
 * A refused budget is logged and nothing changes.
 */
async function learnVoice(models, { characterKey } = {}) {
  const key = normKey(characterKey);
  if (!isKey(key)) throw new VoiceError(400, 'characterKey must be a character slug');
  await requireSchema(models);
  if (running.has(key)) return { characterKey: key, skipped: 'already learning', analysed: 0, rules: [] };
  running.add(key);
  lastLearn.set(key, Date.now());
  try {
    const fresh = await sql(models, `SELECT id, original_text, edited_text, context, diff_summary, source, episode_id, beat_number, pattern_confidence, status
      FROM voice_signals WHERE character_key = :key AND status = 'raw' AND deleted_at IS NULL ORDER BY created_at ASC, id ASC LIMIT :limit`,
    { key, limit: MAX_SIGNALS_PER_RUN });
    if (!fresh.length) return { characterKey: key, analysed: 0, rules: [] };
    const earlier = await sql(models, `SELECT id, original_text, edited_text, context, diff_summary, source, episode_id, beat_number, pattern_confidence, status
      FROM voice_signals WHERE character_key = :key AND status = 'analyzed' AND proposed_rule_id IS NULL AND deleted_at IS NULL
      ORDER BY created_at DESC, id DESC LIMIT 30`, { key });
    const signals = [...earlier.reverse(), ...fresh];
    const known = await sql(models, `SELECT id, rule_text, rule_type, context, check_json, status FROM voice_rules
      WHERE character_key = :key AND status IN ('active', 'proposed') AND deleted_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 60`, { key });
    const rules = known.filter((r) => r.status === 'active');
    const name = (await characterName(models, key)) || key;

    let reply;
    try {
      reply = parseReply(await askModel(buildLearnPrompt(name, signals, rules)));
    } catch (err) {
      if (isBudget(err)) {
        console.error(`[CharacterVoice] learning for ${key} skipped: ${err.message}`);
        return { characterKey: key, skipped: 'budget', analysed: 0, rules: [] };
      }
      throw err;
    }
    if (!reply) return { characterKey: key, analysed: 0, rules: [], skipped: 'unreadable reply' };

    const byId = new Map(signals.map((s) => [Number(s.id), s]));
    const tags = new Map();
    for (const t of Array.isArray(reply.signals) ? reply.signals : []) {
      const id = Number(t?.id);
      if (!byId.has(id)) continue;
      const confidence = Math.max(0, Math.min(1, Number(t.confidence) || 0));
      tags.set(id, { pattern_tag: String(t.pattern_tag || 'general').slice(0, 100), confidence, diff_summary: t.diff_summary ? String(t.diff_summary).slice(0, 1000) : null });
    }
    const activeById = new Map(rules.map((r) => [Number(r.id), r]));
    const written = [];
    const grouped = new Set();

    await models.sequelize.transaction(async (transaction) => {
      for (const r of Array.isArray(reply.rules) ? reply.rules : []) {
        const ruleType = RULE_TYPES.includes(r?.rule_type) ? r.rule_type : null;
        const ruleText = typeof r?.rule_text === 'string' ? r.rule_text.trim().slice(0, 1000) : '';
        if (!ruleType || !ruleText) continue;
        const ids = [...new Set((Array.isArray(r.signal_ids) ? r.signal_ids : []).map(Number))].filter((id) => byId.has(id) && !grouped.has(id));
        const strong = r.strong === true && ONE_EDIT_TYPES.includes(ruleType)
          && ids.some((id) => (tags.get(id)?.confidence ?? 0) >= STRONG);
        if (ids.length < MIN_GROUP && !(strong && ids.length >= 1)) continue;
        const own = ids.map((id) => byId.get(id));
        const contexts = [...new Set(own.map((s) => s.context || 'gameplay'))];
        const context = RULE_CONTEXTS.includes(r.context) ? r.context : (contexts.length === 1 ? contexts[0] : 'all');
        const size = MAJOR_TYPES.includes(ruleType) ? 'major' : 'small';
        const check = normalizeCheck(r.check);
        const newest = own[own.length - 1];
        const [ep] = await sql(models, `SELECT MAX(episode_number)::int AS n FROM episodes WHERE id IN (:ids)`,
          { ids: own.map((s) => s.episode_id).filter(Boolean).concat(['00000000-0000-0000-0000-000000000000']) }, { transaction });

        // The same rule again: it gains the signals, no second rule.
        const same = known.concat(written.map((w) => w.row)).find((x) => x.rule_type === ruleType && (x.context || 'all') === context
          && (normText(x.rule_text).toLowerCase() === ruleText.toLowerCase()
            || (check && x.check_json && JSON.stringify(x.check_json) === JSON.stringify(check))));
        if (same) {
          await run(models, 'UPDATE voice_rules SET signal_count = COALESCE(signal_count, 0) + :n, updated_at = NOW() WHERE id = :id', { n: ids.length, id: same.id }, { transaction });
          await run(models, `UPDATE voice_signals SET status = 'promoted', proposed_rule_id = :rule, updated_at = NOW() WHERE id IN (:ids)`, { rule: same.id, ids }, { transaction });
          ids.forEach((id) => grouped.add(id));
          continue;
        }

        // An older rule it replaces: the one named, or one of the same kind and check.
        let older = activeById.get(Number(r.supersedes)) || null;
        if (older && ((older.context || 'all') !== context || older.rule_type !== ruleType)) older = null;
        if (!older && check) {
          older = rules.find((x) => x.rule_type === ruleType && (x.context || 'all') === context && x.check_json?.type === check.type) || null;
        }

        const status = size === 'small' ? 'active' : 'proposed';
        const [[row]] = await run(models, `
          INSERT INTO voice_rules (character_name, character_key, rule_text, rule_type, context, example_original, example_edited, signal_count,
                                   confirmed_by_author, status, size, auto_applied, from_episode_number, check_json, supersedes_rule_id,
                                   episode_id, beat_number, source, created_at, updated_at)
          VALUES (:name, :key, :ruleText, CAST(:ruleType AS enum_voice_rules_rule_type), :context, :exO, :exE, :count,
                  false, CAST(:status AS enum_voice_rules_status), :size, :auto, :fromEp, CAST(:check AS jsonb), :older,
                  :episodeId, :beatNumber, :source, NOW(), NOW())
          RETURNING id, rule_text, rule_type, context, status, size, auto_applied, from_episode_number, check_json, supersedes_rule_id`, {
          name: String(name).slice(0, 100), key, ruleText, ruleType, context, exO: newest.original_text, exE: newest.edited_text, count: ids.length,
          status, size, auto: size === 'small', fromEp: ep?.n ?? null, check: check ? JSON.stringify(check) : null, older: older ? older.id : null,
          episodeId: newest.episode_id || null, beatNumber: newest.beat_number ?? null, source: newest.source || null,
        }, { transaction });
        if (size === 'small' && older) {
          await run(models, `UPDATE voice_rules SET status = 'superseded', updated_at = NOW() WHERE id = :id AND status = 'active'`, { id: older.id }, { transaction });
          activeById.delete(Number(older.id));
        }
        await run(models, `UPDATE voice_signals SET status = 'promoted', proposed_rule_id = :rule, updated_at = NOW() WHERE id IN (:ids)`, { rule: row.id, ids }, { transaction });
        ids.forEach((id) => grouped.add(id));
        written.push({ row: { ...row, check_json: check }, signal_ids: ids });
      }
      // The rest are analysed: tagged, and kept for grouping with the next ones.
      for (const s of signals) {
        const id = Number(s.id);
        if (grouped.has(id)) continue;
        const t = tags.get(id);
        if (s.status !== 'raw' && !t) continue;
        await run(models, `UPDATE voice_signals SET status = 'analyzed', pattern_tag = COALESCE(:tag, pattern_tag),
          pattern_confidence = COALESCE(:conf, pattern_confidence), diff_summary = COALESCE(diff_summary, :diff), updated_at = NOW() WHERE id = :id`,
        { id, tag: t?.pattern_tag ?? null, conf: t?.confidence ?? null, diff: t?.diff_summary ?? null }, { transaction });
      }
    });
    if (written.length) console.log(`[CharacterVoice] ${key}: ${written.length} rule(s) from ${signals.length} signals`);
    return { characterKey: key, analysed: signals.length, rules: written.map((w) => ({ ...w.row, signal_ids: w.signal_ids })) };
  } finally {
    running.delete(key);
  }
}

// ── Reading and reviewing ───────────────────────────────────────────────────

/** A character's profile row (voice_signature), the show's registry first. */
async function profileOf(models, key, showId = null) {
  try {
    const rows = await sql(models, `
      SELECT rc.character_key, rc.display_name, rc.voice_signature
        FROM registry_characters rc
        LEFT JOIN character_registries cr ON cr.id = rc.registry_id AND cr.deleted_at IS NULL
       WHERE rc.deleted_at IS NULL
         AND (LOWER(rc.character_key) = :key
              OR (:key = 'justawoman' AND LOWER(REPLACE(rc.display_name, ' ', '')) = 'justawoman')
              OR (:key = 'lala' AND LOWER(rc.display_name) = 'lala'))
       ORDER BY ${showId ? '(cr.show_id = :showId) DESC NULLS LAST,' : ''} (LOWER(rc.character_key) = :key) DESC, rc.updated_at DESC NULLS LAST
       LIMIT 1`, { key, showId });
    return rows[0] || null;
  } catch (err) {
    console.error('[CharacterVoice] profile read failed:', err.message);
    return null;
  }
}

async function characterName(models, key) {
  if (key === 'justawoman') return 'JustAWoman';
  if (key === 'lala') return 'Lala';
  return (await profileOf(models, key))?.display_name || null;
}

function profileVoice(row) {
  let v = row?.voice_signature;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch (err) { console.error('[CharacterVoice] voice_signature unreadable:', err.message); v = null; } }
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}

const ruleShape = (r) => ({
  id: r.id, rule_text: r.rule_text, rule_type: r.rule_type, context: r.context || 'all', status: r.status, size: r.size || null,
  auto_applied: Boolean(r.auto_applied), confirmed_by_author: Boolean(r.confirmed_by_author), from_episode_number: r.from_episode_number ?? null,
  signal_count: r.signal_count ?? 0, example_original: r.example_original || null, example_edited: r.example_edited || null,
  check_json: r.check_json || null, supersedes_rule_id: r.supersedes_rule_id ?? null, created_at: r.created_at,
});

/** GET /voice/characters/:characterKey */
async function characterVoiceView(models, characterKey, { showId = null } = {}) {
  const key = normKey(characterKey);
  if (!isKey(key)) throw new VoiceError(400, 'characterKey must be a character slug');
  await requireSchema(models);
  const profile = await profileOf(models, key, showId);
  const rules = await sql(models, `SELECT * FROM voice_rules WHERE character_key = :key AND deleted_at IS NULL
    ORDER BY created_at DESC, id DESC LIMIT 100`, { key });
  const lines = await sql(models, `SELECT l.id, l.text, l.context, l.episode_id, e.episode_number, l.beat_number, l.source, l.created_at
      FROM character_voice_lines l LEFT JOIN episodes e ON e.id = l.episode_id
     WHERE l.character_key = :key AND l.deleted_at IS NULL ORDER BY l.created_at DESC LIMIT 40`, { key });
  const [counts] = await sql(models, `SELECT
      (SELECT COUNT(*)::int FROM character_voice_lines WHERE character_key = :key AND deleted_at IS NULL) AS lines,
      (SELECT COUNT(*)::int FROM voice_signals WHERE character_key = :key AND deleted_at IS NULL) AS signals,
      (SELECT COUNT(*)::int FROM voice_signals WHERE character_key = :key AND deleted_at IS NULL AND status IN ('raw', 'analyzed') AND proposed_rule_id IS NULL) AS signals_waiting`,
  { key });
  const by = (s) => rules.filter((r) => r.status === s).length;
  return {
    characterKey: key,
    name: key === 'justawoman' ? 'JustAWoman' : key === 'lala' ? 'Lala' : (profile?.display_name || key),
    profile_voice: profileVoice(profile),
    rules: rules.map(ruleShape),
    lines: lines.map((l) => ({ ...l, episode_number: l.episode_number ?? null })),
    counts: { ...counts, rules_active: by('active'), rules_proposed: by('proposed'), rules_superseded: by('superseded'), rules_dismissed: by('dismissed') },
  };
}

/** GET /voice/speakers?episodeId= : who speaks in the episode's script, and whose voice each is. */
async function episodeSpeakers(models, episodeId) {
  const [episode] = await sql(models, 'SELECT id, show_id, script_content FROM episodes WHERE id = :episodeId', { episodeId });
  if (!episode) throw new VoiceError(404, 'Episode not found');
  const resolver = await makeResolver(models, { showId: episode.show_id, episodeId });
  const seen = new Map();
  for (const lines of scriptDialogue(episode.script_content || '').values()) {
    for (const l of lines) {
      const s = seen.get(l.speaker) || { speaker: l.speaker, labels: [] };
      if (!s.labels.includes(l.label)) s.labels.push(l.label);
      seen.set(l.speaker, s);
    }
  }
  const out = [];
  for (const s of seen.values()) {
    const who = await resolver.resolve(s.speaker);
    out.push({ speaker: s.speaker, labels: s.labels, characterKey: who?.characterKey || null, name: who?.name || null });
  }
  return out;
}

/** GET /voice/episode/:episodeId/rules : the active rules of everyone who speaks in the episode. */
async function episodeRules(models, episodeId) {
  const speakers = await episodeSpeakers(models, episodeId);
  if (!(await schemaReady(models))) return { episodeId, speakers, rules: [], schema_pending: true };
  const keys = [...new Set(speakers.map((s) => s.characterKey).filter(Boolean))];
  if (!keys.length) return { episodeId, speakers, rules: [] };
  const rows = await sql(models, `SELECT * FROM voice_rules WHERE character_key IN (:keys) AND status = 'active' AND deleted_at IS NULL
    ORDER BY created_at DESC, id DESC LIMIT 200`, { keys });
  const names = new Map(speakers.filter((s) => s.characterKey).map((s) => [s.characterKey, s.name]));
  return { episodeId, speakers, rules: rows.map((r) => ({ ...ruleShape(r), character_key: r.character_key, name: names.get(r.character_key) || r.character_key })) };
}

async function ruleById(models, id, transaction = null) {
  if (!Number.isInteger(Number(id)) || Number(id) <= 0) throw new VoiceError(400, 'rule id must be a number');
  const [row] = await sql(models, 'SELECT * FROM voice_rules WHERE id = :id AND deleted_at IS NULL', { id: Number(id) }, transaction ? { transaction } : {});
  if (!row) throw new VoiceError(404, 'Rule not found');
  return row;
}

/** Approve: the rule goes live as hers; the older rule it replaces is superseded. */
async function approveRule(models, id) {
  await requireSchema(models);
  return models.sequelize.transaction(async (transaction) => {
    const rule = await ruleById(models, id, transaction);
    if (!['proposed', 'active', 'paused'].includes(rule.status)) throw new VoiceError(409, `This rule is ${rule.status}; only a proposed or live rule can be approved.`);
    await run(models, `UPDATE voice_rules SET status = 'active', confirmed_by_author = true, confirmed_at = NOW(), updated_at = NOW() WHERE id = :id`, { id: rule.id }, { transaction });
    let superseded = null;
    if (rule.supersedes_rule_id) {
      const [[s]] = await run(models, `UPDATE voice_rules SET status = 'superseded', updated_at = NOW() WHERE id = :id AND status = 'active' RETURNING id`, { id: rule.supersedes_rule_id }, { transaction });
      superseded = s?.id ?? null;
    }
    return { rule: ruleShape(await ruleById(models, rule.id, transaction)), superseded_rule_id: superseded };
  });
}

/** Dismiss: the rule stops applying. */
async function dismissRule(models, id) {
  await requireSchema(models);
  const rule = await ruleById(models, id);
  if (rule.status === 'dismissed') return { rule: ruleShape(rule) };
  await run(models, `UPDATE voice_rules SET status = 'dismissed', updated_at = NOW() WHERE id = :id`, { id: rule.id });
  return { rule: ruleShape(await ruleById(models, rule.id)) };
}

/** Undo: a rule that applied by itself is dismissed, and the rule it replaced is back. */
async function undoRule(models, id) {
  await requireSchema(models);
  return models.sequelize.transaction(async (transaction) => {
    const rule = await ruleById(models, id, transaction);
    if (!rule.auto_applied) throw new VoiceError(409, 'Only a rule that applied by itself can be undone; dismiss this one instead.');
    if (rule.status !== 'active') throw new VoiceError(409, `This rule is ${rule.status}, not live.`);
    await run(models, `UPDATE voice_rules SET status = 'dismissed', updated_at = NOW() WHERE id = :id`, { id: rule.id }, { transaction });
    let restored = null;
    if (rule.supersedes_rule_id) {
      const [[r]] = await run(models, `UPDATE voice_rules SET status = 'active', updated_at = NOW() WHERE id = :id AND status = 'superseded' AND deleted_at IS NULL RETURNING id`,
        { id: rule.supersedes_rule_id }, { transaction });
      if (r) restored = ruleShape(await ruleById(models, r.id, transaction));
    }
    return { rule: ruleShape(await ruleById(models, rule.id, transaction)), restored };
  });
}

// ── What the writers read ───────────────────────────────────────────────────

const CONTEXT_LABEL = {
  gameplay: 'gameplay, beats 1-10 and 14',
  cutscene: 'cutscene, beats 11-13',
  narration: 'book narration',
};
// The contexts a writer reads: one beat's own, the whole show's, or the book's.
const READS = {
  gameplay: ['gameplay'], cutscene: ['cutscene'], narration: ['narration'],
  show: ['gameplay', 'cutscene'], book: ['narration', 'gameplay', 'cutscene'],
};

const fieldText = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).join('; ')
  : typeof v === 'string' ? v.trim() : v && typeof v === 'object' ? Object.values(v).filter((x) => typeof x === 'string' && x.trim()).join('; ') : '');

/**
 * Each character's learned voice for a writer: [{ characterKey, name,
 * profile: [[label, text]], rules: [rule], lines: [text] }]. `context` is a
 * beat's ('gameplay', 'cutscene'), the book's prose ('narration'), the
 * whole show ('show') or the whole book ('book'). Rules: active, of that
 * context or 'all', newest first, at most 12. Lines: the newest `limitLines`
 * of that context, filled from any other. Without the migration, profiles
 * only.
 */
async function voicesFor(models, { characterKeys = [], context = 'show', limitLines = 8, showId = null } = {}) {
  const keys = [...new Set((characterKeys || []).map(normKey).filter(isKey))].slice(0, 8);
  if (!keys.length || !models?.sequelize) return [];
  const reads = READS[context] || READS.show;
  const ready = await schemaReady(models);
  const out = [];
  for (const key of keys) {
    const profile = await profileOf(models, key, showId);
    const voice = profileVoice(profile);
    const v = {
      characterKey: key,
      name: key === 'justawoman' ? 'JustAWoman' : key === 'lala' ? 'Lala' : (profile?.display_name || key),
      profile: PROFILE_FIELDS.map(([f, label]) => [label, fieldText(voice[f])]).filter(([, t]) => t),
      rules: [],
      lines: [],
    };
    if (ready) {
      try {
        v.rules = await sql(models, `SELECT id, rule_text, rule_type, context, check_json, size FROM voice_rules
          WHERE character_key = :key AND status = 'active' AND deleted_at IS NULL AND (context IS NULL OR context = 'all' OR context IN (:reads))
          ORDER BY created_at DESC, id DESC LIMIT 12`, { key, reads });
        const own = await sql(models, `SELECT text FROM character_voice_lines WHERE character_key = :key AND context IN (:reads) AND deleted_at IS NULL
          ORDER BY created_at DESC LIMIT :n`, { key, reads, n: limitLines });
        const more = own.length < limitLines ? await sql(models, `SELECT text FROM character_voice_lines
          WHERE character_key = :key AND context NOT IN (:reads) AND deleted_at IS NULL ORDER BY created_at DESC LIMIT :n`,
        { key, reads, n: limitLines - own.length }) : [];
        v.lines = [...own, ...more].map((l) => l.text);
      } catch (err) {
        if (!isSchemaMissing(err)) console.error(`[CharacterVoice] learned voice read for ${key} failed:`, err.message);
        else console.warn('[CharacterVoice] learned voice read skipped: the voice migration has not run');
      }
    }
    if (v.profile.length || v.rules.length || v.lines.length) out.push(v);
  }
  return out;
}

/** The writers' block: "HOW <NAME> REALLY SOUNDS" per character; '' when nothing is known. */
async function voicePromptBlock(models, options = {}) {
  try {
    const voices = await voicesFor(models, options);
    return voicesText(voices, options.context || 'show');
  } catch (err) {
    console.error('[CharacterVoice] voice block failed (the writer goes on without it):', err.message);
    return '';
  }
}

function voicesText(voices, context = 'show') {
  if (!voices.length) return '';
  const many = (READS[context] || READS.show).length > 1;
  const parts = voices.map((v) => {
    const out = [`HOW ${v.name.toUpperCase()} REALLY SOUNDS`];
    if (v.profile.length) out.push(`Profile: ${v.profile.map(([l, t]) => `${l}: ${t}`).join(' | ')}`);
    if (v.rules.length) {
      out.push('Learned rules (newest first; a newer rule replaces an older one):');
      for (const r of v.rules) {
        const where = r.context && r.context !== 'all' && many ? ` (${CONTEXT_LABEL[r.context] || r.context} only)` : '';
        out.push(`- ${r.rule_text}${where}`);
      }
    }
    if (v.lines.length) {
      out.push('Lines Evoni approved (write like these; never copy them):');
      for (const l of v.lines) out.push(`- "${l}"`);
    }
    return out.join('\n');
  });
  return `═══ LEARNED VOICES (from Evoni's approved lines and edits) ═══
These are how the characters really sound. Where they conflict with any voice notes elsewhere in this prompt (the JAWIHP voice DNA, a character's profile, the rules below), the learned voice wins.

${parts.join('\n\n')}
`;
}

/** The characters an episode's writers voice: her, Lala, and the cast linked to registry characters. */
async function episodeVoiceKeys(models, { registryCharacterIds = [] } = {}) {
  const keys = ['justawoman', 'lala'];
  const ids = [...new Set((registryCharacterIds || []).filter((id) => id && UUID_RE.test(String(id))))];
  if (!ids.length || !models?.sequelize) return keys;
  try {
    const rows = await sql(models, 'SELECT character_key FROM registry_characters WHERE id IN (:ids) AND deleted_at IS NULL', { ids });
    for (const r of rows) if (r.character_key && !keys.includes(normKey(r.character_key))) keys.push(normKey(r.character_key));
  } catch (err) {
    console.error('[CharacterVoice] cast keys read failed:', err.message);
  }
  return keys;
}

module.exports = {
  MODELS, CONTEXTS, RULE_TYPES, SMALL_TYPES, MAJOR_TYPES, SIGNAL_SOURCES, LINE_SOURCES,
  VoiceError, VoiceSchemaMissing, isSchemaMissing, schemaReady,
  resolveCharacterKey, makeResolver, contextForBeat, scriptDialogue, alignChanges, similarity, textHash,
  captureOnLock, recordSignal, captureBookEdit, captureBookLine, bookContext, background, settled,
  learnVoice, maybeLearn, normalizeCheck, parseReply, buildLearnPrompt,
  characterVoiceView, episodeSpeakers, episodeRules, approveRule, dismissRule, undoRule,
  voicesFor, voicesText, voicePromptBlock, episodeVoiceKeys,
  _reset: () => { lastLearn.clear(); running.clear(); client = null; },
};
