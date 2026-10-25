/**
 * YouTube chapters from a whole-episode take's beat markers (lib/fullEpisodeTake
 * cleanMarks: [{ beat, t }] in take time). YouTube's own rules for chapters in
 * a description: the first one starts at 0:00, there are at least 3, and each
 * is at least 10 seconds long. A beat shorter than that is joined with the one
 * after it (the last beat with the one before), and the list says so.
 *
 *   youtubeChapters(marks, { names, duration }) →
 *     { chapters: [{ t, title, beats }], notes: [string], ok, text }
 *
 * `names` is a beat number → name lookup (a Map, an object or a function);
 * without one, the canonical beat names. `duration` is the take's length in
 * seconds, when known: it checks the last chapter's length too.
 * Pure: no React, no network.
 */
import { cleanMarks } from './fullEpisodeTake';
import { beatName } from './canonicalBeats';

export const MIN_CHAPTERS = 3;
export const MIN_SECONDS = 10;
export const INTRO_TITLE = 'Intro';

/** "0:00", "4:05", "1:02:05": whole seconds, as YouTube reads them. */
export function chapterClock(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

function nameOf(names, beat) {
  let n = null;
  if (typeof names === 'function') n = names(beat);
  else if (names instanceof Map) n = names.get(beat);
  else if (names && typeof names === 'object') n = names[beat];
  const s = String(n || '').trim();
  return s || beatName(beat);
}

const joinTitles = (a, b) => `${a} & ${b}`;

/**
 * The chapters for a take's markers. Times are whole seconds (YouTube drops
 * the tenths), so the 10-second check is on what YouTube will see.
 */
export function youtubeChapters(marks, { names = null, duration = null } = {}) {
  const clean = cleanMarks(marks);
  const notes = [];
  const end = Number(duration) > 0 ? Math.floor(Number(duration)) : null;
  let list = clean.map((m) => ({ t: Math.floor(m.t), title: nameOf(names, m.beat), beats: [m.beat] }));

  // Two beats on the same second: the later one is the chapter.
  list = list.filter((c, i) => i === list.length - 1 || c.t !== list[i + 1].t);

  // The first chapter starts at 0:00: what comes before the first beat is an
  // Intro when it is long enough, else the first beat starts at 0:00.
  if (list.length && list[0].t > 0) {
    if (list[0].t >= MIN_SECONDS) {
      list.unshift({ t: 0, title: INTRO_TITLE, beats: [] });
      notes.push(`The ${chapterClock(list[1].t)} before the first beat is an "${INTRO_TITLE}" chapter.`);
    } else {
      list[0] = { ...list[0], t: 0 };
    }
  }

  // Too-short chapters joined with a neighbour, until every one is long enough.
  const lengthOf = (i) => (i < list.length - 1 ? list[i + 1].t - list[i].t : end != null ? end - list[i].t : Infinity);
  let i = 0;
  while (i < list.length && list.length > 1) {
    if (lengthOf(i) >= MIN_SECONDS) { i += 1; continue; }
    const short = list[i];
    if (i < list.length - 1) {
      const next = list[i + 1];
      notes.push(`"${short.title}" is under ${MIN_SECONDS} seconds, so it is joined with "${next.title}".`);
      list.splice(i, 2, { t: short.t, title: joinTitles(short.title, next.title), beats: [...short.beats, ...next.beats] });
    } else {
      const prev = list[i - 1];
      notes.push(`"${short.title}" is under ${MIN_SECONDS} seconds, so it is joined with "${prev.title}".`);
      list.splice(i - 1, 2, { t: prev.t, title: joinTitles(prev.title, short.title), beats: [...prev.beats, ...short.beats] });
      i -= 1;
    }
  }

  const ok = list.length >= MIN_CHAPTERS && list[0]?.t === 0;
  if (!clean.length) notes.push('This take has no beat markers, so there are no chapters.');
  else if (!ok) notes.push(`YouTube needs at least ${MIN_CHAPTERS} chapters of ${MIN_SECONDS} seconds or more. This take has ${list.length}, so YouTube will not show them.`);
  const text = list.map((c) => `${chapterClock(c.t)} ${c.title}`).join('\n');
  return { chapters: list, notes, ok, text };
}

/**
 * A draft description to paste on YouTube: the title, the synopsis when
 * there is one, then the chapters (left out when YouTube would not show them).
 */
export function draftDescription({ title = '', synopsis = '', chapters = null } = {}) {
  const parts = [];
  const head = String(title || '').trim();
  const body = String(synopsis || '').trim();
  if (head) parts.push(head);
  if (body) parts.push(body);
  if (chapters?.ok && chapters.text) parts.push(`Chapters\n${chapters.text}`);
  return parts.join('\n\n');
}
