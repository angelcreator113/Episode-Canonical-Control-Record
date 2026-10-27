'use strict';

/**
 * Line identity for the one episode script (architecture A1a; Evoni,
 * 2026-10-26, docs/reads/2026-10-26-architecture-vs-gameplay-director-rev5.md
 * R2.1, R3.1, R3.6). Pure; no I/O. Nothing calls this yet: A1b adds the
 * storage, A1c the one save path.
 *
 * A line is every non-blank line of `episodes.script_content` that is not a
 * beat header: dialogue, directions, [UI:]/[WEAR:]/[TALK:] tags and hidden
 * cues such as [LEARNS:]. Headers are read by the same rules as the Script
 * tab and the beat locks (beatLabelNumber.normalizeBeatHeaders and
 * headerNumber, unchanged): a header's number, or the canonical beat its name
 * names, else its place among the headers. Text before the first header is
 * beat 0; a script with no header puts every line in beat null.
 *
 * A line's key (`ln_` + 10 base-32 characters) is minted once and never
 * changes or moves to other dialogue. The keys are stored beside the text, in
 * the same row (A1b):
 *   { v: 1, text_hash, lines: [{ k, b, h }], retired: [{ k, b, h, retired_in }] }
 * `lines` is aligned one to one with scriptLines(text); `retired` only grows.
 *
 * Reconciling a new text keeps keys by, in order: the editor's hints (the key
 * each line had when it was edited, whatever its words now), then exact
 * matches, then, only when the previous text is known, a line edited in
 * place; anything else gets a new key. A retired key is never matched again;
 * only restoring a version brings one back, and only for that version's own
 * line.
 *
 * Hashes are 32-bit FNV-1a over the UTF-8 bytes, 8 hex characters.
 * frontend/src/lib/lineKeys.js has the same scriptLines, normaliseLine,
 * lineHash, scriptTextHash and checkLineKeys; it never mints or reconciles.
 */

const crypto = require('crypto');
const { headerNumber, normalizeBeatHeaders } = require('./beatLabelNumber');

const VERSION = 1;
const HEADER_LINE_RE = /^\s*##\s*BEAT:\s*(.*)$/i;
const KEY_PREFIX = 'ln_';
const KEY_LENGTH = 10;
const KEY_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';
const KEY_RE = /^ln_[a-z2-7]{10}$/;
const MAX_MINT_TRIES = 100;
// A line edited in place keeps its key only when at least half its words are
// the same (Dice over the words).
const EDIT_SIMILARITY = 0.5;

function utf8Bytes(text) {
  const bytes = [];
  for (const ch of String(text)) {
    let c = ch.codePointAt(0);
    if (c >= 0xd800 && c <= 0xdfff) c = 0xfffd;
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return bytes;
}

function fnv1a(text) {
  let h = 0x811c9dc5;
  for (const b of utf8Bytes(text)) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** A line as compared: quotes, dashes and spacing written one way; words and case kept. */
function normaliseLine(text) {
  return String(text ?? '')
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐‑‒–—―−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

const lineHash = (text) => fnv1a(normaliseLine(text));

/** The whole script's hash, over its exact text. */
const scriptTextHash = (text) => fnv1a(String(text ?? ''));

/** The script's lines, in order: { b, at, index, text, norm, h }. */
function scriptLines(text) {
  const rows = normalizeBeatHeaders(text).split('\n');
  const hasHeader = rows.some((row) => HEADER_LINE_RE.test(row));
  const lines = [];
  let beat = hasHeader ? 0 : null;
  let headers = 0;
  let at = 0;
  for (const row of rows) {
    const header = row.match(HEADER_LINE_RE);
    if (header) {
      headers += 1;
      beat = headerNumber(header[1]) || headers;
      at = 0;
      continue;
    }
    if (!row.trim()) continue;
    const norm = normaliseLine(row);
    lines.push({ b: beat, at, index: lines.length, text: row, norm, h: fnv1a(norm) });
    at += 1;
  }
  return lines;
}

/**
 * Whether stored keys describe this text. Never repairs (R3.1).
 * { status: 'ok' | 'unkeyed' | 'mismatch', reason? }
 */
function checkLineKeys(text, stored) {
  if (!stored || !Array.isArray(stored.lines)) return { status: 'unkeyed' };
  if (stored.v !== VERSION) return { status: 'mismatch', reason: 'version' };
  if (stored.text_hash !== scriptTextHash(text)) return { status: 'mismatch', reason: 'text_hash' };
  const lines = scriptLines(text);
  if (lines.length !== stored.lines.length) return { status: 'mismatch', reason: 'line_count' };
  for (let i = 0; i < lines.length; i += 1) {
    const s = stored.lines[i];
    if (!s || s.h !== lines[i].h || s.b !== lines[i].b || !KEY_RE.test(String(s.k))) return { status: 'mismatch', reason: 'line', index: i };
  }
  return { status: 'ok' };
}

const defaultRand = () => crypto.randomInt(0, 0x100000000) / 0x100000000;

/** A new key that is not in `taken` (a Set of every key the episode has had). */
function mintLineKey(rand = defaultRand, taken = new Set()) {
  for (let t = 0; t < MAX_MINT_TRIES; t += 1) {
    let key = KEY_PREFIX;
    for (let i = 0; i < KEY_LENGTH; i += 1) key += KEY_ALPHABET[Math.floor(rand() * KEY_ALPHABET.length) % KEY_ALPHABET.length];
    if (!taken.has(key)) return key;
  }
  throw new Error('lineKeys: could not mint an unused key');
}

/** Every key an episode has had: live, retired, and in any stored version. */
function everyKey(stored, history = []) {
  const keys = new Set();
  for (const s of [stored, ...history]) {
    for (const e of s?.lines || []) if (e?.k) keys.add(e.k);
    for (const e of s?.retired || []) if (e?.k) keys.add(e.k);
  }
  return keys;
}

const words = (norm) => new Set((String(norm || '').toLowerCase().match(/[\p{L}\p{N}']+/gu)) || []);
function similarity(a, b) {
  const x = words(a);
  const y = words(b);
  if (!x.size && !y.size) return 1;
  let shared = 0;
  for (const w of x) if (y.has(w)) shared += 1;
  return (2 * shared) / (x.size + y.size);
}

// The longest common run of hashes, earliest lines matched first (the
// Script tab's nextLineIds rule). Returns [[oldPos, newPos], …] in order.
function commonRun(oldHashes, newHashes) {
  const n = oldHashes.length;
  const m = newHashes.length;
  const len = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      len[i][j] = oldHashes[i] === newHashes[j] ? len[i + 1][j + 1] + 1 : Math.max(len[i + 1][j], len[i][j + 1]);
    }
  }
  const pairs = [];
  for (let i = 0, j = 0; i < n && j < m;) {
    if (oldHashes[i] === newHashes[j] && len[i][j] === len[i + 1][j + 1] + 1) { pairs.push([i, j]); i += 1; j += 1; }
    else if (len[i + 1][j] >= len[i][j + 1]) i += 1;
    else j += 1;
  }
  return pairs;
}

const groupByBeat = (items) => {
  const groups = new Map();
  items.forEach((item, pos) => {
    const key = String(item.b);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(pos);
  });
  return groups;
};

/**
 * Pairs old lines with new ones. Items carry { b, h } and, when known, norm.
 * 1. exact: per beat, the longest common run of hashes;
 * 2. edited: in a gap between exact pairs of one beat, an old and a new line
 *    whose words are at least half the same (only when both norms are known);
 * 3. moved: a hash unique among the unpaired old lines and among the unpaired
 *    new lines, wherever it now is.
 * { pairs: [{ old, new, kind: 'kept' | 'edited' | 'moved' }], removed, added }
 */
function matchLines(oldLines, newLines) {
  const oldTaken = new Array(oldLines.length).fill(false);
  const newTaken = new Array(newLines.length).fill(false);
  const pairs = [];
  const take = (o, n, kind) => { oldTaken[o] = true; newTaken[n] = true; pairs.push({ old: o, new: n, kind }); };

  const oldBeats = groupByBeat(oldLines);
  const newBeats = groupByBeat(newLines);
  for (const [beat, newPos] of newBeats) {
    const oldPos = oldBeats.get(beat) || [];
    const run = commonRun(oldPos.map((p) => oldLines[p].h), newPos.map((p) => newLines[p].h));
    for (const [i, j] of run) take(oldPos[i], newPos[j], 'kept');

    // The gaps between exact pairs, with the lines on each side.
    const bounds = [[-1, -1], ...run, [oldPos.length, newPos.length]];
    for (let g = 0; g < bounds.length - 1; g += 1) {
      const olds = oldPos.slice(bounds[g][0] + 1, bounds[g + 1][0]).filter((p) => oldLines[p].norm != null);
      const news = newPos.slice(bounds[g][1] + 1, bounds[g + 1][1]).filter((p) => newLines[p].norm != null);
      const options = [];
      for (const o of olds) {
        for (const n of news) {
          const s = similarity(oldLines[o].norm, newLines[n].norm);
          if (s >= EDIT_SIMILARITY) options.push({ o, n, s });
        }
      }
      options.sort((a, b) => b.s - a.s || a.o - b.o || a.n - b.n);
      for (const { o, n } of options) if (!oldTaken[o] && !newTaken[n]) take(o, n, 'edited');
    }
  }

  const count = (items, taken) => {
    const c = new Map();
    items.forEach((it, p) => { if (!taken[p]) c.set(it.h, (c.get(it.h) || 0) + 1); });
    return c;
  };
  const oldCount = count(oldLines, oldTaken);
  const newCount = count(newLines, newTaken);
  newLines.forEach((it, n) => {
    if (newTaken[n] || newCount.get(it.h) !== 1 || oldCount.get(it.h) !== 1) return;
    const o = oldLines.findIndex((x, p) => !oldTaken[p] && x.h === it.h);
    if (o >= 0) take(o, n, 'moved');
  });

  pairs.sort((a, b) => a.new - b.new);
  return {
    pairs,
    removed: oldLines.map((_, p) => p).filter((p) => !oldTaken[p]),
    added: newLines.map((_, p) => p).filter((p) => !newTaken[p]),
  };
}

function mergeRetired(...lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const e of list || []) {
      if (!e?.k || seen.has(e.k)) continue;
      seen.add(e.k);
      out.push(e);
    }
  }
  return out;
}

/**
 * The keys for `nextText`, from the stored keys of the text it replaces.
 * opts:
 *   hints: hints[i] is the key the editor held for line i of nextText (or null);
 *   prevText: the text `stored` describes, when known (lets a line edited in
 *     place keep its key; ignored unless checkLineKeys(prevText, stored) is ok);
 *   rand: the random source for new keys; history: stored keys of versions;
 *   retiredIn: what to record as the change that retired a key.
 * { stored: { v, text_hash, lines, retired }, report }
 */
function reconcileLineKeys(stored, nextText, opts = {}) {
  const { hints = [], prevText, rand = defaultRand, history = [], retiredIn = null } = opts;
  const next = scriptLines(nextText);
  const prevLive = Array.isArray(stored?.lines) ? stored.lines : [];
  const prevRetired = Array.isArray(stored?.retired) ? stored.retired : [];
  const taken = everyKey(stored, history);
  const retiredKeys = new Set([...everyKey({ retired: prevRetired }), ...history.flatMap((s) => (s?.retired || []).map((e) => e.k))]);
  const liveByKey = new Map(prevLive.map((e, p) => [e.k, { e, p }]));

  const prevNorms = prevText != null && checkLineKeys(prevText, stored).status === 'ok'
    ? scriptLines(prevText).map((l) => l.norm)
    : null;

  const assigned = new Array(next.length).fill(null);
  const usedOld = new Set();
  const report = { kept: [], edited: [], moved: [], minted: [], retired: [], refusedHints: [] };
  const classify = (e, line) => (e.h !== line.h ? 'edited' : (e.b === line.b ? 'kept' : 'moved'));

  // 1. The editor's hints.
  next.forEach((line, i) => {
    const k = hints[i];
    if (k == null) return;
    const live = liveByKey.get(k);
    if (!live) { report.refusedHints.push({ index: i, key: k, reason: retiredKeys.has(k) || taken.has(k) ? 'retired' : 'unknown' }); return; }
    if (usedOld.has(live.p)) { report.refusedHints.push({ index: i, key: k, reason: 'duplicate' }); return; }
    usedOld.add(live.p);
    assigned[i] = k;
    report[classify(live.e, line)].push({ index: i, key: k });
  });

  // 2. Matching, among live keys only.
  const oldPos = prevLive.map((_, p) => p).filter((p) => !usedOld.has(p));
  const newPos = next.map((_, i) => i).filter((i) => assigned[i] == null);
  const { pairs } = matchLines(
    oldPos.map((p) => ({ b: prevLive[p].b, h: prevLive[p].h, norm: prevNorms ? prevNorms[p] : null })),
    newPos.map((i) => ({ b: next[i].b, h: next[i].h, norm: next[i].norm })),
  );
  for (const pair of pairs) {
    const p = oldPos[pair.old];
    const i = newPos[pair.new];
    usedOld.add(p);
    assigned[i] = prevLive[p].k;
    report[pair.kind].push({ index: i, key: prevLive[p].k });
  }

  // 3. New keys.
  next.forEach((_, i) => {
    if (assigned[i] != null) return;
    const k = mintLineKey(rand, taken);
    taken.add(k);
    assigned[i] = k;
    report.minted.push({ index: i, key: k });
  });

  const retiredNow = prevLive
    .filter((_, p) => !usedOld.has(p))
    .map((e) => ({ k: e.k, b: e.b, h: e.h, retired_in: retiredIn }));
  report.retired = retiredNow.map((e) => e.k);
  for (const list of ['kept', 'edited', 'moved']) report[list].sort((a, b) => a.index - b.index);

  return {
    stored: {
      v: VERSION,
      text_hash: scriptTextHash(nextText),
      lines: next.map((line, i) => ({ k: assigned[i], b: line.b, h: line.h })),
      retired: mergeRetired(prevRetired, retiredNow),
    },
    report,
  };
}

/**
 * Restoring a version: its text comes back with exactly its keys. A key is
 * reinstated only for the version's own line (its key and hash, which hold
 * because the keys must describe the version's text); every other key stays
 * or becomes retired. Throws when the version's keys don't describe its text;
 * the caller then reconciles instead.
 */
function restoreLineKeys(current, versionKeys, versionText, opts = {}) {
  const { retiredIn = null } = opts;
  const check = checkLineKeys(versionText, versionKeys);
  if (check.status !== 'ok') throw new Error(`lineKeys: the version's keys do not describe its text (${check.status}${check.reason ? `: ${check.reason}` : ''})`);
  const reinstated = new Set(versionKeys.lines.map((e) => e.k));
  const retiredNow = (current?.lines || [])
    .filter((e) => !reinstated.has(e.k))
    .map((e) => ({ k: e.k, b: e.b, h: e.h, retired_in: retiredIn }));
  const retired = mergeRetired(current?.retired, versionKeys.retired, retiredNow).filter((e) => !reinstated.has(e.k));
  const wasRetired = new Set(mergeRetired(current?.retired).map((e) => e.k));
  return {
    stored: {
      v: VERSION,
      text_hash: scriptTextHash(versionText),
      lines: versionKeys.lines.map((e) => ({ k: e.k, b: e.b, h: e.h })),
      retired,
    },
    report: {
      reinstated: versionKeys.lines.filter((e) => wasRetired.has(e.k)).map((e) => e.k),
      retired: retiredNow.map((e) => e.k),
    },
  };
}

/**
 * The key of a stored line (a voice clip's line_text, its beat when known) in
 * the current script, or null when the words are gone or more than one line
 * has them. Needs keys that describe the script.
 */
function keyForStoredLine(storedLine, scriptText, stored) {
  if (checkLineKeys(scriptText, stored).status !== 'ok') return null;
  const want = normaliseLine(storedLine?.line_text);
  if (!want) return null;
  const lines = scriptLines(scriptText);
  let found = lines.filter((l) => l.norm === want);
  if (found.length > 1 && storedLine?.b != null) found = found.filter((l) => l.b === Number(storedLine.b));
  return found.length === 1 ? stored.lines[found[0].index].k : null;
}

/**
 * The strict identity plan from one text to the next (A1c, Evoni,
 * 2026-10-27; docs/reads/2026-10-27-a1c-design-audit.md §2 and R4): which
 * lines would keep an identity with no editor hints, and which would not.
 * Exact text only; similarity alone never keeps an identity.
 *   - a text once in each: kept (same beat) or moved (another beat);
 *   - a text repeated the same number of times in each, with no other
 *     exactly-matched line moved past any copy: its copies are paired in
 *     order (group);
 *   - a repeated text whose count changed, or whose copies another line
 *     moved past: every copy is uncertain (uncertainGroup);
 *   - an unmatched new line with words at least half the same as an
 *     unmatched old line of its beat: uncertain, a suggestion only
 *     (uncertainSimilar); never paired;
 *   - every other new line is new; every unmatched old line is removed.
 * Pure. Used in A1c R1 only for counts (services/identityPlanLog.js); it
 * stores nothing and leaves matchLines and reconcileLineKeys as they are.
 * { pairs: [{ old, new, kind }], counts: { lines_before, lines_after,
 *   kept_exact, moved, kept_group, uncertain_group, uncertain_similar, new, removed } }
 */
function planLineIdentity(prevText, nextText) {
  const before = scriptLines(prevText);
  const after = scriptLines(nextText);
  const byHash = (lines) => {
    const m = new Map();
    lines.forEach((l, i) => { if (!m.has(l.h)) m.set(l.h, []); m.get(l.h).push(i); });
    return m;
  };
  const oldBy = byHash(before);
  const newBy = byHash(after);
  const pairs = [];
  const groups = [];
  const uncertainNew = new Set();
  for (const [h, news] of newBy) {
    const olds = oldBy.get(h);
    if (!olds) continue;
    if (olds.length === 1 && news.length === 1) {
      pairs.push({ old: olds[0], new: news[0], kind: before[olds[0]].b === after[news[0]].b ? 'kept' : 'moved', h });
    } else if (olds.length === news.length) {
      groups.push({ h, olds, news });
    } else {
      news.forEach((n) => uncertainNew.add(n));
    }
  }
  // A repeated group holds only when no other exact match crosses any copy.
  const candidate = [...pairs, ...groups.flatMap((g) => g.olds.map((o, k) => ({ old: o, new: g.news[k], kind: 'group', h: g.h })))];
  const crosses = (a, b) => (a.old - b.old) * (a.new - b.new) < 0;
  const failed = new Set();
  for (const g of groups) {
    const mine = candidate.filter((p) => p.h === g.h);
    const others = candidate.filter((p) => p.h !== g.h);
    if (mine.some((p) => others.some((q) => crosses(p, q)))) failed.add(g.h);
  }
  for (const g of groups) {
    if (failed.has(g.h)) { g.news.forEach((n) => uncertainNew.add(n)); continue; }
    g.olds.forEach((o, k) => pairs.push({ old: o, new: g.news[k], kind: 'group', h: g.h }));
  }
  const oldTaken = new Set(pairs.map((p) => p.old));
  const newTaken = new Set(pairs.map((p) => p.new));
  // Suggestions only: an unmatched new line like an unmatched old one in its beat.
  let similar = 0;
  after.forEach((line, n) => {
    if (newTaken.has(n) || uncertainNew.has(n)) return;
    const like = before.some((o, p) => !oldTaken.has(p) && o.b === line.b && similarity(o.norm, line.norm) >= EDIT_SIMILARITY);
    if (like) { similar += 1; uncertainNew.add(n); }
  });
  const count = (kind) => pairs.filter((p) => p.kind === kind).length;
  return {
    pairs: pairs.map(({ old, new: n, kind }) => ({ old, new: n, kind })).sort((a, b) => a.new - b.new),
    counts: {
      lines_before: before.length,
      lines_after: after.length,
      kept_exact: count('kept'),
      moved: count('moved'),
      kept_group: count('group'),
      uncertain_group: [...uncertainNew].length - similar,
      uncertain_similar: similar,
      new: after.length - newTaken.size,
      removed: before.length - oldTaken.size,
    },
  };
}

module.exports = {
  VERSION,
  KEY_RE,
  normaliseLine,
  lineHash,
  scriptTextHash,
  scriptLines,
  checkLineKeys,
  mintLineKey,
  matchLines,
  reconcileLineKeys,
  restoreLineKeys,
  keyForStoredLine,
  planLineIdentity,
};
