'use strict';

/**
 * Lala's Career list (Lala's Phone spec §5, "Otherwise: the Career list —
 * goals, brands worked with, milestones"; phase 3 issue 7, Task #3181;
 * docs/reads/2026-10-14-phone-phase3-read.md §2.5, §5, §6), read as of an
 * episode. Read only.
 *
 * "As of" episode N: what was true when N began. The episodes that count
 * are the show's live episodes accepted before N (evaluation_status
 * 'accepted', a lower episode number); with no episode, every accepted one.
 *
 *   goals       active and completed CareerGoals. A goal completed after the
 *               last counted episode was accepted (its completed_at later)
 *               is still active at N. Failed, paused and abandoned goals are
 *               left out.
 *   milestones  goals completed by then, and the career_milestone of each
 *               opportunity produced in a counted episode.
 *   brands      brands worked with (Evoni, 2026-10-14, ruling 4: derived
 *               from executed agreements and past deals, with a per-brand
 *               hide, no separate list): each counted episode's event brand
 *               (host_brand, else host) and each opportunity produced in a
 *               counted episode (brand_or_company). The brand agreement's
 *               EXECUTED state is phase 4 (#3123); executedAgreementBrands
 *               is its hook and reads nothing yet.
 *   hidden      shows.metadata.career_hidden_brands: brand names Evoni hid.
 *               A hidden brand stays in the data and is left out of
 *               `brands`; `hidden_brands` lists them so they can be shown
 *               again.
 */

const HIDDEN_KEY = 'career_hidden_brands';
const HIDDEN_MAX = 200;
const NAME_MAX = 200;

class CareerListError extends Error {
  constructor(message, status = 400, code = 'CAREER_LIST') {
    super(message);
    this.name = 'CareerListError';
    this.status = status;
    this.code = code;
  }
}

const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const brandKey = (name) => String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
const parseMeta = (v) => {
  if (!v) return {};
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch (err) {
    console.error('[CareerList] unreadable show metadata:', err.message);
    return {};
  }
};

/** The hidden brand names saved for the show. */
function hiddenBrandsOf(metadata) {
  const list = parseMeta(metadata)[HIDDEN_KEY];
  return Array.isArray(list) ? list.filter((b) => typeof b === 'string' && b.trim()) : [];
}

/** The brand agreements Lala executed (phase 4, #3123): none are stored yet. */
async function executedAgreementBrands() {
  return [];
}

/** The episodes that count as of `episodeId` (accepted, numbered below it), with when each was accepted. */
async function countedEpisodes(sequelize, showId, episodeId) {
  let below = null;
  if (episodeId) {
    const [[ep]] = await sequelize.query(
      'SELECT id, episode_number FROM episodes WHERE id = :episodeId AND show_id = :showId AND deleted_at IS NULL',
      { replacements: { episodeId, showId } });
    if (!ep) throw new CareerListError('Episode not found', 404, 'EPISODE_NOT_FOUND');
    below = Number.isInteger(Number(ep.episode_number)) ? Number(ep.episode_number) : 0;
  }
  const [rows] = await sequelize.query(
    `SELECT id, episode_number, title, evaluation_json->>'completed_at' AS completed_at
       FROM episodes
      WHERE show_id = :showId AND deleted_at IS NULL AND evaluation_status = 'accepted'
        ${below === null ? '' : 'AND COALESCE(episode_number, 0) < :below'}
      ORDER BY COALESCE(episode_number, 0) ASC`,
    { replacements: { showId, below } });
  return rows || [];
}

/** The Career list as of an episode (or now): { as_of, goals, milestones, brands, hidden_brands }. */
async function careerListAt(models, showId, { episodeId = null } = {}) {
  const { sequelize } = models;
  const [[show]] = await sequelize.query('SELECT id, metadata FROM shows WHERE id = :showId AND deleted_at IS NULL',
    { replacements: { showId } });
  if (!show) throw new CareerListError('Show not found', 404, 'SHOW_NOT_FOUND');

  const counted = await countedEpisodes(sequelize, showId, episodeId);
  const ids = counted.map((e) => e.id);
  const times = counted.map((e) => Date.parse(e.completed_at)).filter(Number.isFinite);
  // A goal completed after this moment had not happened yet at the episode.
  const cutoff = episodeId ? (times.length ? Math.max(...times) : -Infinity) : Infinity;

  const [goalRows] = await sequelize.query(
    `SELECT id, title, type, target_metric, target_value, current_value, status, completed_at, priority
       FROM career_goals
      WHERE show_id = :showId AND deleted_at IS NULL AND status IN ('active', 'completed')
      ORDER BY priority ASC, created_at ASC`,
    { replacements: { showId } });
  const goals = (goalRows || []).map((g) => {
    const doneAt = g.completed_at ? Date.parse(g.completed_at) : NaN;
    const done = g.status === 'completed' && Number.isFinite(doneAt) ? doneAt <= cutoff : g.status === 'completed' && !episodeId;
    return { id: g.id, title: g.title, type: g.type, metric: g.target_metric, target: Number(g.target_value), status: done ? 'completed' : 'active' };
  });

  const byEpisode = new Map(counted.map((e) => [e.id, { id: e.id, number: e.episode_number, title: e.title }]));
  const brandMap = new Map();
  const addBrand = (name, episodeIdOf) => {
    const n = text(name);
    if (!n) return;
    const key = brandKey(n);
    const entry = brandMap.get(key) || { name: n, episodes: [] };
    const ep = byEpisode.get(episodeIdOf);
    if (ep && !entry.episodes.some((x) => x.id === ep.id)) entry.episodes.push(ep);
    brandMap.set(key, entry);
  };

  let opportunities = [];
  if (ids.length) {
    const [events] = await sequelize.query(
      `SELECT used_in_episode_id, host_brand, host FROM world_events
        WHERE show_id = :showId AND deleted_at IS NULL AND used_in_episode_id IN (:ids)`,
      { replacements: { showId, ids } });
    for (const ev of events || []) addBrand(text(ev.host_brand) || text(ev.host), ev.used_in_episode_id);
    const [opps] = await sequelize.query(
      `SELECT episode_id, brand_or_company, career_milestone FROM opportunities
        WHERE show_id = :showId AND deleted_at IS NULL AND episode_id IN (:ids)`,
      { replacements: { showId, ids } });
    opportunities = opps || [];
    for (const o of opportunities) addBrand(o.brand_or_company, o.episode_id);
  }
  for (const b of await executedAgreementBrands(models, showId, ids)) addBrand(b.name, b.episode_id);

  const hidden = hiddenBrandsOf(show.metadata);
  const hiddenKeys = new Set(hidden.map(brandKey));
  const firstEpisode = (b) => Math.min(...b.episodes.map((e) => Number(e.number) || 0), Infinity);
  const brands = [...brandMap.values()]
    .filter((b) => !hiddenKeys.has(brandKey(b.name)))
    .sort((a, b) => firstEpisode(a) - firstEpisode(b) || a.name.localeCompare(b.name));

  const milestones = [
    ...goals.filter((g) => g.status === 'completed').map((g) => ({ kind: 'goal', title: g.title })),
    ...opportunities.filter((o) => text(o.career_milestone)).map((o) => ({ kind: 'opportunity', title: text(o.career_milestone), episode: byEpisode.get(o.episode_id) || null })),
  ];

  return {
    as_of: episodeId ? { episode_id: episodeId, episodes_counted: counted.length } : null,
    goals,
    milestones,
    brands,
    hidden_brands: hidden,
  };
}

/** Save the hidden brands (names); returns the saved list. */
async function saveHiddenBrands(models, showId, brands) {
  if (!Array.isArray(brands)) throw new CareerListError('brands must be a list of brand names.', 400, 'INVALID_BRANDS');
  if (brands.length > HIDDEN_MAX) throw new CareerListError(`At most ${HIDDEN_MAX} hidden brands.`, 400, 'INVALID_BRANDS');
  const clean = [];
  const seen = new Set();
  for (const b of brands) {
    if (typeof b !== 'string' || !b.trim() || b.trim().length > NAME_MAX) {
      throw new CareerListError(`Each brand is a name of 1 to ${NAME_MAX} characters.`, 400, 'INVALID_BRANDS');
    }
    const key = brandKey(b);
    if (!seen.has(key)) { seen.add(key); clean.push(b.trim()); }
  }
  const show = await models.Show.findByPk(showId);
  if (!show) throw new CareerListError('Show not found', 404, 'SHOW_NOT_FOUND');
  await show.update({ metadata: { ...parseMeta(show.metadata), [HIDDEN_KEY]: clean } });
  return clean;
}

module.exports = { careerListAt, saveHiddenBrands, hiddenBrandsOf, CareerListError, HIDDEN_KEY };
