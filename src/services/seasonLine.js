'use strict';

/**
 * The season line (Evoni's approval of the season-AI audit, 2026-10-25): how
 * every AI prompt names the season and the part it is in. The script
 * writers, distribution, the feed, the novel's reveal plan, the event
 * generators, the Pulse drafter, Lala's phone and the season planners each
 * wrote their own (or none, or read columns show_arcs does not have). They
 * read it here, so the logline and description Evoni writes on the Season
 * page reach all of them the same way.
 *
 *   fromArc(arc, { phase })      a show_arcs row (seasonLoader) → season; the
 *                                part is `phase`, else the arc's current one
 *   fromArcContext(ctx)          arcProgressionService.getArcContext → season
 *   fromSnapshot(sc)             an episode's season_context (Start Episode's
 *                                snapshot, seasonSlotService.snapshotEpisode)
 *   seasonLines(season, opts)    one to three lines; [] with no season
 *   seasonLine(season, opts)     the same, joined; '' with no season
 *   slotLines(sc, opts)          what an episode's slot asks of it: its
 *                                purposes, career focus, pressure and hoped-for
 *                                outcome; [] with none
 *   partLength(part)             the part's episode count from its range; null
 *   loadSeasonLine(sequelize, { showId, episodeId }, opts)
 *                                the episode's own season when it has a
 *                                snapshot, else the show's active season and
 *                                its current part; '' with none. Never throws.
 *
 * A season: { season_number, title, tagline, logline, description,
 *             part: { number, title, tagline, emotional_arc, episode_start,
 *                     episode_end } | null, part_count }
 *
 * Lines (each field only when it is set; each text capped at CAP):
 *   Season 2: "The Climb" — Every room has a price. Logline: Lala …
 *   Season description: …
 *   Current part: Part 2 of 3, "Ascension" (E9–E16, 8 episodes) — "Climb the ladder"; emotional arc: …
 */

const CAP = 300;

const clip = (v, n = CAP) => {
  const s = v == null ? '' : String(v).replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
};

function parseList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[seasonLine] the arc\'s phases could not be read; no part used:', err.message);
    return [];
  }
}

const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

function partOf(p) {
  if (!p) return null;
  const number = num(p.phase ?? p.number);
  if (number == null && !p.title) return null;
  return {
    number,
    title: p.title || null,
    tagline: p.tagline || null,
    emotional_arc: p.emotional_arc || null,
    episode_start: num(p.episode_start ?? p.episode_range?.[0]),
    episode_end: num(p.episode_end ?? p.episode_range?.[1]),
  };
}

/** A show_arcs row as a season; its part is `phase` (a number), else the arc's current phase. */
function fromArc(arc, { phase = null } = {}) {
  if (!arc) return null;
  const phases = parseList(arc.phases);
  const want = num(phase) ?? num(arc.current_phase);
  return {
    season_number: num(arc.season_number) || 1,
    title: arc.title || null,
    tagline: arc.tagline || null,
    logline: arc.logline || null,
    description: arc.description || null,
    part: partOf(phases.find((p) => num(p.phase) === want)),
    part_count: phases.length || null,
  };
}

/** arcProgressionService.getArcContext's result as a season. */
function fromArcContext(ctx) {
  if (!ctx) return null;
  return {
    season_number: num(ctx.season) || 1,
    title: ctx.arc_title || null,
    tagline: ctx.arc_tagline || null,
    logline: ctx.arc_logline || null,
    description: ctx.arc_description || null,
    part: partOf(ctx.current_phase),
    part_count: num(ctx.phase_count),
  };
}

/** An episode's season_context snapshot as a season (its own part). */
function fromSnapshot(sc) {
  if (!sc || typeof sc !== 'object' || !(sc.label || sc.arc_title || sc.season_number)) return null;
  return {
    season_number: num(sc.season_number) || 1,
    title: sc.arc_title || null,
    tagline: sc.arc_tagline || null,
    logline: sc.arc_logline || null,
    description: sc.arc_description || null,
    part: partOf(sc.phase),
    part_count: num(sc.phase_count),
  };
}

/** The part's episode count from its range, or null when it has none. */
function partLength(part) {
  const a = num(part?.episode_start);
  const b = num(part?.episode_end);
  return a != null && b != null && b >= a ? b - a + 1 : null;
}

/** "Part 2 of 3, "Ascension" (E9–E16, 8 episodes) — "Climb"; emotional arc: …" */
function partText(part, count) {
  const length = partLength(part);
  const range = length != null ? ` (E${part.episode_start}–E${part.episode_end}, ${length} episode${length === 1 ? '' : 's'})` : '';
  return `Part ${part.number ?? '?'}${count ? ` of ${count}` : ''}${part.title ? `, "${clip(part.title, 100)}"` : ''}${range}`
    + `${part.tagline ? ` — "${clip(part.tagline)}"` : ''}${part.emotional_arc ? `; emotional arc: ${clip(part.emotional_arc)}` : ''}`;
}

/**
 * One to three lines naming the season and its part; [] with no season.
 * title    the "Season N: title — tagline. Logline: …" line (false: the
 *          logline alone, for a prompt that names the season itself)
 * about    the description line
 * part     the part line; partLabel names it ("Current part", "This episode's part")
 */
function seasonLines(season, { title = true, about = true, part = true, partLabel = 'Current part', cap = CAP } = {}) {
  if (!season) return [];
  const out = [];
  const logline = clip(season.logline, cap);
  if (title) {
    out.push(`Season ${season.season_number || 1}${season.title ? `: "${clip(season.title, 200)}"` : ''}`
      + `${season.tagline ? ` — ${clip(season.tagline, cap)}` : ''}${logline ? `. Logline: ${logline}` : ''}`);
  } else if (logline) {
    out.push(`Season logline: ${logline}`);
  }
  const description = clip(season.description, cap);
  if (about && description) out.push(`Season description: ${description}`);
  if (part && season.part) out.push(`${partLabel}: ${partText(season.part, season.part_count)}`);
  return out;
}

function seasonLine(season, options) {
  return seasonLines(season, options).join('\n');
}

/**
 * What an episode's slot asks of it, from its snapshot: the purposes
 * (primary first), career focus, desired pressure and hoped-for outcome.
 * Each capped; [] with none of them.
 */
function slotLines(sc, { cap = 200, purposes: maxPurposes = 4 } = {}) {
  if (!sc || typeof sc !== 'object') return [];
  const list = (Array.isArray(sc.story_purposes) ? sc.story_purposes : [])
    .filter((p) => p && (p.text || p.story_thread))
    .map((p) => (p.text ? p : { ...p, text: `Continue the thread "${p.story_thread}"`, story_thread: null }));
  const purposes = list.length
    ? [...list.filter((p) => p.primary), ...list.filter((p) => !p.primary)]
    : (sc.story_purpose ? [{ text: sc.story_purpose, primary: true, story_thread: sc.story_thread || null }] : []);
  const out = [];
  const shown = purposes.slice(0, maxPurposes);
  if (shown.length === 1) out.push(`Slot purpose: ${clip(shown[0].text, cap)}${shown[0].story_thread ? ` (thread: ${clip(shown[0].story_thread, 100)})` : ''}`);
  else if (shown.length > 1) {
    out.push('Slot purposes (primary first):',
      ...shown.map((p, i) => `${i + 1}. ${p.primary ? '[Primary] ' : ''}${clip(p.text, cap)}${p.story_thread ? ` (thread: ${clip(p.story_thread, 100)})` : ''}`));
  }
  if (sc.career_focus) out.push(`Career focus: ${clip(sc.career_focus, 100)}`);
  if (sc.desired_pressure) out.push(`Desired pressure: ${clip(sc.desired_pressure, 20)}`);
  const range = sc.outcome_range && typeof sc.outcome_range === 'object' ? sc.outcome_range : null;
  if (range && (range.min || range.max)) out.push(`Hoped-for outcome: ${range.min || '?'} to ${range.max || '?'}`);
  return out;
}

/**
 * The season line for an episode (its own snapshot) or a show (the active
 * season and its current part). '' with none or on a failed read (logged).
 */
async function loadSeasonLine(sequelize, { showId = null, episodeId = null } = {}, options = {}) {
  try {
    if (episodeId) {
      const [rows] = await sequelize.query(
        'SELECT season_context, show_id FROM episodes WHERE id = :episodeId AND deleted_at IS NULL',
        { replacements: { episodeId } });
      let sc = rows?.[0]?.season_context || null;
      if (typeof sc === 'string') sc = JSON.parse(sc);
      const own = fromSnapshot(sc);
      if (own) return seasonLine(own, { partLabel: "This episode's part", ...options });
      if (!showId) showId = rows?.[0]?.show_id || null;
    }
    if (!showId) return '';
    const season = await require('./seasonLoader').loadSeason(sequelize, showId, { slots: false });
    return season ? seasonLine(fromArc(season.arc), options) : '';
  } catch (err) {
    console.error('[seasonLine] the season could not be read (the prompt goes without it):', err.message);
    return '';
  }
}

module.exports = {
  CAP, clip, fromArc, fromArcContext, fromSnapshot, partLength, seasonLines, seasonLine, slotLines, loadSeasonLine,
};
