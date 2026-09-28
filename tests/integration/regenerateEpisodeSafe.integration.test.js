/**
 * POST /world/:showId/events/:eventId/regenerate-episode keeps the existing
 * episode and its event link until the replacement exists
 * (docs/EVENT_EPISODE_FLOW.md §8(w) P3; Task #2210).
 *
 * It used to unlink the event and soft-delete the old episode before calling
 * the generator, outside any transaction, so a generation failure left the
 * old episode deleted and the event unlinked.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('regenerate-episode keeps the old episode until the new one exists (§8(w) P3)', () => {
  let token;
  const shows = [];

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-safe-regenerate',
      email: 'test@safe-regenerate.dev',
      name: 'Safe Regenerate Test',
      groups: ['USER', 'EDITOR'],
      role: 'USER',
    }).accessToken;
  });

  // A show with one live episode (number 1) started from one used event.
  async function seed() {
    const ids = { show: uuid(), oldEp: uuid(), event: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `Regenerate show ${ids.show.slice(0, 8)}`, slug: `regen-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:oldEp, :show, 'Original episode', 1, 'draft', NOW(), NOW())`, ids);
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, times_used, created_at, updated_at)
               VALUES (:event, :show, 'Regenerate Gala', 'used', :oldEp, 1, NOW(), NOW())`, ids);
    return ids;
  }

  const regenerate = (ids) => request(app)
    .post(`/api/v1/world/${ids.show}/events/${ids.event}/regenerate-episode`)
    .set('Authorization', `Bearer ${token}`)
    .send({});

  const state = async (ids) => {
    const [ev] = await q(`SELECT used_in_episode_id, status, times_used FROM world_events WHERE id = :event`, ids);
    const [old] = await q(`SELECT deleted_at FROM episodes WHERE id = :oldEp`, ids);
    return { ev, oldDeletedAt: old.deleted_at };
  };

  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    for (const show of shows) {
      const eps = `(SELECT id FROM episodes WHERE show_id = :show)`;
      for (const t of ['episode_briefs', 'scene_plans', 'episode_todo_lists']) {
        await run(`DELETE FROM ${t} WHERE episode_id IN ${eps}`, { show }).catch((err) => console.warn(`cleanup ${t}:`, err.message));
      }
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  it('a generation failure leaves the old episode live and the event linked to it', async () => {
    const ids = await seed();
    jest.spyOn(models.EpisodeBrief, 'create').mockRejectedValue(new Error('injected brief failure'));

    const res = await regenerate(ids);

    expect(res.status).toBe(500);
    const after = await state(ids);
    expect(after.oldDeletedAt).toBeNull();
    expect(after.ev.used_in_episode_id).toBe(ids.oldEp);
    expect(after.ev.status).toBe('used');
    const live = await q(`SELECT id FROM episodes WHERE show_id = :show AND deleted_at IS NULL`, ids);
    expect(live.map((e) => e.id)).toEqual([ids.oldEp]);
  });

  it('a success links a new episode, supersedes the old one, and keeps its number', async () => {
    const ids = await seed();

    const res = await regenerate(ids);

    expect(res.status).toBe(201);
    expect(res.body.replaced_episode_id).toBe(ids.oldEp);
    const newId = res.body.data.episode.id;
    expect(newId).not.toBe(ids.oldEp);
    const after = await state(ids);
    expect(after.oldDeletedAt).not.toBeNull();
    expect(after.ev.used_in_episode_id).toBe(newId);
    expect(after.ev.status).toBe('used');
    expect(after.ev.times_used).toBe(2);
    const [created] = await q(`SELECT episode_number, deleted_at FROM episodes WHERE id = :newId`, { newId });
    expect(created).toEqual({ episode_number: 1, deleted_at: null });
    const [brief] = await q(`SELECT event_id FROM episode_briefs WHERE episode_id = :newId`, { newId });
    expect(brief.event_id).toBe(ids.event);
  });
});
