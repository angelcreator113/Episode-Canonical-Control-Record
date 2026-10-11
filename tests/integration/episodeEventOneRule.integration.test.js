/**
 * One event per episode for the screens and the story engine (Task #1917;
 * §8(w) P2: the brief's event is canonical). The episode's tabs read
 * services/episodeEventsService listEpisodeEvents; the services read
 * utils/episodeEventSql. After a reassign moves the stamp
 * (world_events.used_in_episode_id) to another event, both must still name
 * the event the brief names.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const models = require('../../src/models');
const { EPISODE_EVENT_ID_SQL, episodeEventId } = require('../../src/utils/episodeEventSql');
const { listEpisodeEvents } = require('../../src/services/episodeEventsService');
const { findSourceEvent } = require('../../src/services/episodeMoneyService');
const { loadScoringEvent } = require('../../src/services/outfitScoreContext');
const { gatherEpisodeContext } = require('../../src/services/distributionService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('the episode\'s event, one rule (Task #1917)', () => {
  const show = uuid();
  const eps = [];

  beforeAll(async () => {
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())',
      { show, name: `One rule ${show.slice(0, 8)}`, slug: `one-rule-${show.slice(0, 8)}` });
  });
  afterAll(async () => {
    await run('DELETE FROM episode_briefs WHERE show_id = :show', { show });
    await run('DELETE FROM world_events WHERE show_id = :show', { show });
    await run('DELETE FROM episodes WHERE show_id = :show', { show });
    await run('DELETE FROM shows WHERE id = :show', { show });
  });

  async function episode() {
    const id = uuid();
    eps.push(id);
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:id, :show, 'Ep', :n, 'draft', NOW(), NOW())`, { id, show, n: eps.length });
    return id;
  }
  async function event(name, { stampedOn = null, prestige = 5, deleted = false } = {}) {
    const id = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, status, prestige, used_in_episode_id, created_at, updated_at, deleted_at)
               VALUES (:id, :show, :name, 'used', :prestige, :ep, NOW(), NOW(), ${deleted ? 'NOW()' : 'NULL'})`,
    { id, show, name, prestige, ep: stampedOn });
    return id;
  }
  const brief = (ep, eventId) => run(`INSERT INTO episode_briefs (id, episode_id, show_id, event_id, status, created_at, updated_at)
    VALUES (:id, :ep, :show, :eventId, 'draft', NOW(), NOW())`, { id: uuid(), ep, show, eventId });
  const serviceEventId = async (ep) => (await run(`SELECT id FROM world_events WHERE id = ${EPISODE_EVENT_ID_SQL}`, { episodeId: ep }))[0][0]?.id || null;

  it('after a reassign moves the stamp, every reader still names the brief\'s event', async () => {
    const ep = await episode();
    const briefEvent = await event('The brief\'s event');
    // A reassign stamped another, higher-prestige event with the episode; the brief was left alone.
    const moved = await event('Stamped by a reassign', { stampedOn: ep, prestige: 10 });
    await brief(ep, briefEvent);

    expect(await serviceEventId(ep)).toBe(briefEvent);
    expect((await listEpisodeEvents(models, ep)).anchor_event_id).toBe(briefEvent);
    expect((await findSourceEvent(sequelize, ep)).id).toBe(briefEvent);
    expect((await loadScoringEvent(sequelize, { episodeId: ep, showId: show })).id).toBe(briefEvent);
    // The script writer and the feed posts load by this id; distribution reads the SQL.
    expect(await episodeEventId(sequelize, ep)).toBe(briefEvent);
    expect((await gatherEpisodeContext(ep, show, sequelize)).event.name).toBe('The brief\'s event');
    expect(moved).not.toBe(briefEvent);
  });

  it('with no brief, the event stamped with the episode, as the tabs\' reader picks it', async () => {
    // One event per episode carries the stamp (world_events_used_in_episode_unique).
    const ep = await episode();
    const stamped = await event('Stamped', { stampedOn: ep, prestige: 2 });
    await event('Not linked', { prestige: 9 });
    expect(await serviceEventId(ep)).toBe(stamped);
    expect((await listEpisodeEvents(models, ep)).anchor_event_id).toBe(stamped);
    expect((await loadScoringEvent(sequelize, { episodeId: ep, showId: show })).id).toBe(stamped);
  });

  it('a brief naming a deleted event falls back to the stamp; no event at all is null', async () => {
    const ep = await episode();
    const gone = await event('Deleted', { deleted: true });
    const stamped = await event('Stamped', { stampedOn: ep });
    await brief(ep, gone);
    expect(await serviceEventId(ep)).toBe(stamped);
    const none = await episode();
    expect(await serviceEventId(none)).toBeNull();
    expect(await episodeEventId(sequelize, none)).toBeNull();
  });
});
