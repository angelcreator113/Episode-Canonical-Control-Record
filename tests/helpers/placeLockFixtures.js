/**
 * Row fixtures for the Place lock suites (Foundation A): shows, episodes,
 * events, briefs, sets and locations, in the shapes the real writers leave.
 * Rows only: no DDL, no provider, no storage. cleanup() removes what was made.
 */
const crypto = require('crypto');

const uuid = () => crypto.randomUUID();

function placeLockFixtures(sequelize, models) {
  const run = (sql, replacements = {}, options = {}) => sequelize.query(sql, { replacements, ...options });
  const rows = async (sql, replacements = {}, options = {}) => (await run(sql, replacements, options))[0];
  const made = { shows: [], sets: [], locations: [] };
  let n = 0;

  /** A show with a ledger and Lala's state, so a real completion can run on its episodes. */
  async function mkShow(label = 'Place lock') {
    const show = uuid();
    made.shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST('{"starting_balance": 1000}' AS jsonb), NOW(), NOW())`,
    { show, name: `${label} ${show.slice(0, 8)}`, slug: `fnda-${show.slice(0, 8)}` });
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
               VALUES (:id, :show, 'lala', 1000, 3, 3, 3, 2, NOW(), NOW())`, { id: uuid(), show });
    return show;
  }

  async function mkLocation(name = 'Studio by Sable') {
    const loc = uuid();
    made.locations.push(loc);
    await run(`INSERT INTO world_locations (id, name, description, created_at, updated_at)
               VALUES (:loc, :name, 'A white photo studio.', NOW(), NOW())`, { loc, name: `${name} ${loc.slice(0, 6)}` });
    return loc;
  }

  async function mkSet(show, name, fields = {}) {
    const set = await models.SceneSet.create({ name, scene_type: 'EVENT_LOCATION', generation_status: 'complete', show_id: show, ...fields });
    made.sets.push(set.id);
    return set.id;
  }

  /** An episode: evaluation 'pending' (a draft) or 'accepted'; deleted soft-deletes it. */
  async function mkEpisode(show, { evaluation = 'pending', deleted = false, title = 'Ep' } = {}) {
    const id = uuid();
    n += 1;
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, evaluation_status, deleted_at, created_at, updated_at)
               VALUES (:id, :show, :title, :n, 'draft', :evaluation, :deletedAt, NOW(), NOW())`,
    { id, show, title: `${title} ${n}`, n: 500 + n, evaluation, deletedAt: deleted ? new Date() : null });
    return id;
  }

  /** An event; stamp is its used_in_episode_id. */
  async function mkEvent(show, { stamp = null, set = null, loc = null, name = 'Sable shoot', deleted = false } = {}) {
    const id = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, strictness, cost_coins, venue_location_id, scene_set_id, used_in_episode_id, canon_consequences, deleted_at, created_at, updated_at)
               VALUES (:id, :show, :name, 'invite', :status, 5, 5, 0, :loc, :set, :stamp, '{}'::jsonb, :deletedAt, NOW(), NOW())`,
    { id, show, name: `${name} ${id.slice(0, 6)}`, status: stamp ? 'used' : 'draft', loc, set, stamp, deletedAt: deleted ? new Date() : null });
    return id;
  }

  /** The episode's Brief naming an event (one Brief per episode); agoMinutes orders them, older first. */
  async function mkBrief(show, episode, event, { deleted = false, agoMinutes = 0 } = {}) {
    const id = uuid();
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, event_id, status, deleted_at, created_at, updated_at)
               VALUES (:id, :episode, :show, :event, 'draft', :deletedAt, NOW() - make_interval(mins => :ago), NOW())`,
    { id, episode, show, event, deletedAt: deleted ? new Date() : null, ago: agoMinutes });
    return id;
  }

  const setEvaluation = (episode, evaluation) => run('UPDATE episodes SET evaluation_status = :evaluation WHERE id = :episode', { episode, evaluation });
  const evaluationOf = async (episode) => (await rows('SELECT evaluation_status FROM episodes WHERE id = :episode', { episode }))[0]?.evaluation_status ?? null;
  const eventRow = async (id) => (await rows('SELECT * FROM world_events WHERE id = :id', { id }))[0] || null;

  /** Best effort: a row another table still points at is left, and said. */
  async function cleanup() {
    const tryRun = async (sql, replacements) => {
      try {
        await run(sql, replacements);
      } catch (err) {
        console.error('[placeLockFixtures] cleanup left rows behind:', err.message);
      }
    };
    for (const show of made.shows) {
      for (const t of ['season_specials', 'feed_posts', 'financial_transactions', 'character_state_history', 'character_state', 'franchise_knowledge', 'season_slots', 'show_arcs']) {
        await tryRun(`DELETE FROM ${t} WHERE show_id = :show`, { show });
      }
      for (const t of ['episode_spending_lines', 'episode_briefs', 'episode_todo_lists', 'scene_plans', 'scene_set_episodes', 'scenes', 'episode_wardrobe']) {
        await tryRun(`DELETE FROM ${t} WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)`, { show });
      }
      await tryRun('DELETE FROM scene_set_looks WHERE event_id IN (SELECT id FROM world_events WHERE show_id = :show)', { show });
      await tryRun('UPDATE world_events SET used_in_episode_id = NULL, scene_set_id = NULL WHERE show_id = :show', { show });
      await tryRun('DELETE FROM episodes WHERE show_id = :show', { show });
      await tryRun('DELETE FROM world_events WHERE show_id = :show', { show });
    }
    if (made.sets.length) {
      await tryRun('UPDATE scene_sets SET version_of_set_id = NULL WHERE id IN (:ids)', { ids: made.sets });
      await tryRun('DELETE FROM scene_sets WHERE id IN (:ids)', { ids: made.sets });
    }
    if (made.locations.length) await tryRun('DELETE FROM world_locations WHERE id IN (:ids)', { ids: made.locations });
    for (const show of made.shows) await tryRun('DELETE FROM shows WHERE id = :show', { show });
  }

  return { uuid, run, rows, made, mkShow, mkLocation, mkSet, mkEpisode, mkEvent, mkBrief, setEvaluation, evaluationOf, eventRow, cleanup };
}

/**
 * Resolves once a backend of this database waits on a lock while running a
 * statement that matches `like` (pg_stat_activity), instead of sleeping.
 * Rejects after timeoutMs.
 */
async function waitForLockWait(sequelize, like, { timeoutMs = 8000 } = {}) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const [found] = await sequelize.query(
      `SELECT pid, query FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock' AND pid <> pg_backend_pid() AND query ILIKE :like`,
      { replacements: { like } });
    if (found.length) return found[0];
    if (Date.now() > end) throw new Error(`no backend waited on a lock in a statement like ${like}`);
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
}

module.exports = { placeLockFixtures, waitForLockWait, uuid };
