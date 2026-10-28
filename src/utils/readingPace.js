/**
 * Her learned reading pace, a show setting (Evoni, 2026-10-28: "learn my
 * real reading pace"). Stored on Show.metadata.reading_pace, no new table:
 *
 *   { [performer]: { use: 'mine' | 'standard',
 *                    episodes: { [episodeId]: { ratios: [n], takes: n, at } } } }
 *
 * The browser works the figures out from an episode's takes
 * (frontend/src/lib/learnedPace) and sends them here as takes are saved;
 * every episode's ratios together give the show-wide pace. `use` is her
 * switch between her pace and the standard 150 words a minute.
 */

const PERFORMERS = ['justawoman', 'lala', 'guest'];
const USES = ['mine', 'standard'];
const MAX_EPISODES = 12;
const MAX_RATIOS = 60;

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

const cleanRatios = (list) => (Array.isArray(list) ? list : [])
  .map(Number)
  .filter((n) => Number.isFinite(n) && n > 0 && n <= 10)
  .slice(0, MAX_RATIOS)
  .map((n) => Math.round(n * 100) / 100);

function cleanEntry(e) {
  if (!isObj(e)) return null;
  const ratios = cleanRatios(e.ratios);
  if (!ratios.length) return null;
  const takes = Number.isInteger(Number(e.takes)) && Number(e.takes) >= 0 ? Math.min(1000, Number(e.takes)) : 0;
  return { ratios, takes, at: typeof e.at === 'string' ? e.at.slice(0, 40) : null };
}

/** The newest MAX_EPISODES entries. */
function newest(episodes) {
  const ids = Object.keys(episodes).sort((a, b) => String(episodes[b].at || '').localeCompare(String(episodes[a].at || '')));
  return Object.fromEntries(ids.slice(0, MAX_EPISODES).map((id) => [id, episodes[id]]));
}

/** The stored setting, cleaned: { [performer]: { use, episodes } }. */
function readReadingPace(metadata) {
  const raw = isObj(metadata) && isObj(metadata.reading_pace) ? metadata.reading_pace : {};
  const out = {};
  for (const p of PERFORMERS) {
    const r = raw[p];
    if (!isObj(r)) continue;
    const episodes = {};
    if (isObj(r.episodes)) {
      for (const [id, e] of Object.entries(r.episodes)) {
        const clean = cleanEntry(e);
        if (clean && id.length <= 64) episodes[id] = clean;
      }
    }
    out[p] = { use: USES.includes(r.use) ? r.use : 'mine', episodes: newest(episodes) };
  }
  return out;
}

/**
 * A PUT body: { performer, episode_id?, ratios?, takes?, use? }. Ratios
 * with an episode replace that episode's figures (an empty list removes
 * them); `use` sets the switch. { value } or { error }.
 */
function readReadingPaceBody(body) {
  const b = isObj(body) ? body : {};
  const performer = b.performer == null ? 'justawoman' : b.performer;
  if (!PERFORMERS.includes(performer)) return { error: `performer is one of: ${PERFORMERS.join(', ')}.` };
  const value = { performer };
  if (b.use !== undefined) {
    if (!USES.includes(b.use)) return { error: "use is 'mine' or 'standard'." };
    value.use = b.use;
  }
  if (b.episode_id !== undefined) {
    if (typeof b.episode_id !== 'string' || !b.episode_id.trim() || b.episode_id.length > 64) return { error: 'episode_id is the episode\'s id.' };
    if (!Array.isArray(b.ratios)) return { error: 'ratios is a list of numbers.' };
    value.episodeId = b.episode_id.trim();
    value.ratios = cleanRatios(b.ratios);
    value.takes = Number.isInteger(Number(b.takes)) && Number(b.takes) >= 0 ? Math.min(1000, Number(b.takes)) : 0;
  }
  if (value.use === undefined && value.episodeId === undefined) return { error: 'Send use, or episode_id with ratios.' };
  return { value };
}

/** The setting with a read body applied (every other performer and episode kept). */
function mergeReadingPace(metadata, value, at = new Date().toISOString()) {
  const all = readReadingPace(metadata);
  const mine = all[value.performer] || { use: 'mine', episodes: {} };
  const episodes = { ...mine.episodes };
  if (value.episodeId) {
    if (value.ratios.length) episodes[value.episodeId] = { ratios: value.ratios, takes: value.takes, at };
    else delete episodes[value.episodeId];
  }
  all[value.performer] = { use: value.use || mine.use, episodes: newest(episodes) };
  return all;
}

module.exports = { readReadingPace, readReadingPaceBody, mergeReadingPace, PERFORMERS, MAX_EPISODES };
