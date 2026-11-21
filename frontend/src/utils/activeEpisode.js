/**
 * Which episode a page puts first, for one show (PR-03 of
 * docs/design/2026-11-studio-home-episode-command-center.md). Two answers,
 * kept apart (Evoni, 2026-11-17):
 *
 *   - the OFFICIAL PRODUCTION episode: the first unfinished episode in story
 *     order. It is what "Now producing" and "In production" mean. It is
 *     worked out from the show's episodes alone, so opening another episode
 *     never changes it;
 *   - the RESUME episode: the episode last opened in this browser, when it
 *     is still an unfinished episode of this show; otherwise the official
 *     production episode. It is what "Continue" and "Resume" mean.
 *
 * Both take the episodes of ONE show (a page passes the list it already
 * loaded). Only episode records count: a season slot with no episode is not
 * in the list, so it is never returned.
 *
 * "Last opened" is the browser's existing `working-episode-id` (the Episode
 * page and the Editor hub have written it for a long time); this file is its
 * one reader and its one writer. Nothing is stored on the server.
 *
 * A third thing, kept apart from both (PR-04): the RESUME LOCATION, the
 * last working tab visited inside an episode. It is kept per episode in
 * `working-episode-locations` (the 20 most recent), and it is only ever
 * read by a control that says "Resume": an address is never changed by it,
 * so a link, Back, Forward and refresh always decide where the page is.
 */
import { EP_TABS, DEFAULT_EP_TAB } from './episodeTabs';

const WORKING_KEY = 'working-episode-id';
const WORKING_TITLE_KEY = 'working-episode-title';
const LOCATIONS_KEY = 'working-episode-locations';
/** How many episodes' locations are kept: the most recently visited. */
export const MAX_EPISODE_LOCATIONS = 20;

/** The working statuses: an episode in one of these, and not completed, is unfinished. */
export const IN_PRODUCTION = ['draft', 'scripted', 'in_build', 'in_review'];

/** The episodes in production, in episode order. */
export function episodesInProduction(episodes) {
  return (episodes || [])
    .filter((e) => IN_PRODUCTION.includes(e.status) && e.evaluation_status !== 'accepted')
    .sort((a, b) => (a.episode_number || 0) - (b.episode_number || 0));
}

/** The show's official production episode: the first unfinished one in story order, or null. */
export function productionEpisode(episodes) {
  return episodesInProduction(episodes)[0] || null;
}

/**
 * The episode to resume: the remembered one while it is an unfinished
 * episode in this list, else the official production episode (null when
 * nothing is unfinished). A remembered id that is not in the list (another
 * show's, a deleted episode, one that cannot be read) or that is finished
 * is passed over.
 */
export function resumeEpisode(episodes, rememberedId) {
  const producing = episodesInProduction(episodes);
  const wanted = rememberedId == null ? '' : String(rememberedId);
  const remembered = wanted ? producing.find((e) => String(e.id) === wanted) : null;
  return remembered || producing[0] || null;
}

/** The id of the episode last opened in this browser, or null. */
export function rememberedEpisodeId() {
  try {
    return window.localStorage.getItem(WORKING_KEY) || null;
  } catch (err) {
    console.warn('[activeEpisode] storage unavailable:', err?.message);
    return null;
  }
}

/** Remembers the episode as the one last opened (its id, and its title beside it). */
export function rememberEpisode(episode) {
  if (!episode?.id) return;
  try {
    window.localStorage.setItem(WORKING_KEY, String(episode.id));
    window.localStorage.setItem(WORKING_TITLE_KEY, episode.title || episode.episodeTitle || 'Untitled');
  } catch (err) {
    console.warn('[activeEpisode] storage unavailable:', err?.message);
  }
}

// ── The resume location: the last working tab inside an episode ───────────

/**
 * The tabs that are places of work, by their ?tab= key, each with the gate
 * it needs (or null): Script, and every view of Production and Results.
 * The Overview is not one: every plain link lands there, so counting it
 * would replace "I was in Wardrobe" the moment the episode opened.
 */
const RESUMABLE = new Map(EP_TABS.flatMap((tab) => {
  if (tab.key === DEFAULT_EP_TAB) return [];
  return tab.subs ? tab.subs.map((sub) => [sub.key, sub.gate || null]) : [[tab.key, null]];
}));

/** The ?tab= keys that can be a resume location, in the tabs' own order. */
export const RESUMABLE_TABS = [...RESUMABLE.keys()];

/** Whether the tab is a place of work that is open now (`open`: { [gate]: true }). */
function resumable(tab, open = {}) {
  if (typeof tab !== 'string' || !RESUMABLE.has(tab)) return false;
  const gate = RESUMABLE.get(tab);
  return !gate || open?.[gate] === true;
}

/** The stored locations, { [episodeId]: { tab, at } }; anything unreadable is nothing. */
function readLocations() {
  try {
    const raw = window.localStorage.getItem(LOCATIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out = {};
    for (const [id, entry] of Object.entries(parsed)) {
      if (entry && typeof entry === 'object' && typeof entry.tab === 'string') {
        out[id] = { tab: entry.tab, at: Number(entry.at) || 0 };
      }
    }
    return out;
  } catch (err) {
    console.warn('[activeEpisode] locations not read:', err?.message);
    return {};
  }
}

function writeLocations(map) {
  try {
    if (Object.keys(map).length) window.localStorage.setItem(LOCATIONS_KEY, JSON.stringify(map));
    else window.localStorage.removeItem(LOCATIONS_KEY);
  } catch (err) {
    console.warn('[activeEpisode] locations not saved:', err?.message);
  }
}

/**
 * Remembers the tab as the episode's last working location. Nothing is
 * written for the Overview, for a key that is not a tab, or for a tab whose
 * gate is closed (Voice, unless `open.voiceStudio`): what was remembered
 * before stays. Only the 20 most recently visited episodes are kept.
 * Returns whether it was remembered.
 */
export function rememberEpisodeLocation(episodeId, tab, open = {}, now = Date.now()) {
  if (!episodeId || !resumable(tab, open)) return false;
  const map = readLocations();
  map[String(episodeId)] = { tab, at: now };
  const kept = Object.entries(map).sort(([, a], [, b]) => b.at - a.at).slice(0, MAX_EPISODE_LOCATIONS);
  writeLocations(Object.fromEntries(kept));
  return true;
}

/**
 * The episode's last working location, { tab, at }, or null: none was
 * remembered, the stored key is no longer a tab, or its gate is closed now
 * (Voice while it is switched off, or for someone who is not an admin). A
 * location that cannot be used now is passed over, not deleted, so it is
 * there again once it can be.
 */
export function episodeLocation(episodeId, open = {}) {
  if (!episodeId) return null;
  const entry = readLocations()[String(episodeId)];
  if (!entry || !resumable(entry.tab, open)) return null;
  return { tab: entry.tab, at: entry.at };
}

/**
 * Forgets one episode (it was deleted, or the server says it does not
 * exist): its location, and "last opened" when that is this episode. Every
 * other episode's location, and everything else in the browser, is left.
 */
export function forgetEpisode(episodeId) {
  if (!episodeId) return;
  const id = String(episodeId);
  const map = readLocations();
  if (id in map) {
    delete map[id];
    writeLocations(map);
  }
  try {
    if (window.localStorage.getItem(WORKING_KEY) === id) {
      window.localStorage.removeItem(WORKING_KEY);
      window.localStorage.removeItem(WORKING_TITLE_KEY);
    }
  } catch (err) {
    console.warn('[activeEpisode] storage unavailable:', err?.message);
  }
}
