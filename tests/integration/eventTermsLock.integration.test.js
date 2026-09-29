/**
 * The terms lock is enforced server-side (docs/EVENT_EPISODE_FLOW.md
 * §8(x) D4, §8(w) P9; Task #2230). Once an event has started a live episode,
 * the event PUT, inject and the brief PUT refuse changes to its access
 * requirements, compensation, restrictions and episode link.
 *
 * Before this, only the deliverable routes held the lock; everything else
 * relied on the UI hiding its controls.
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

const REQUIREMENTS = { reputation_min: 3 };

(shouldSkip ? describe.skip : describe)('terms lock enforced server-side (§8(x) D4)', () => {
  let token;
  const shows = [];

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-terms-lock',
      email: 'test@terms-lock.dev',
      name: 'Terms Lock Test',
      groups: ['USER', 'EDITOR'],
      role: 'USER',
    }).accessToken;
  });

  // started: linked by its brief (§8(w) P2) and used_in_episode_id.
  // legacy:  linked by used_in_episode_id only (no brief names it).
  // open:    never used.  deadLink: points at a soft-deleted episode.
  async function seed() {
    const ids = { show: uuid(), ep: uuid(), ep2: uuid(), gone: uuid(), free: uuid(), brief: uuid(), openBrief: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `Lock show ${ids.show.slice(0, 8)}`, slug: `lock-${ids.show.slice(0, 8)}` });
    // `free` has no event yet: world_events_used_in_episode_unique allows one
    // linked event per episode.
    for (const [key, n, deleted] of [['ep', 1, false], ['ep2', 2, false], ['gone', 3, true], ['free', 4, false]]) {
      await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, deleted_at, created_at, updated_at)
                 VALUES (:id, :show, :title, :n, 'draft', :deleted, NOW(), NOW())`,
        { id: ids[key], show: ids.show, title: `Episode ${n}`, n, deleted: deleted ? new Date() : null });
    }
    const event = async (name, usedIn) => {
      const id = uuid();
      await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, is_paid, payment_amount,
                   requirements, restrictions, created_at, updated_at)
                 VALUES (:id, :show, :name, :status, :usedIn, false, 0, CAST(:reqs AS jsonb), '[]'::jsonb, NOW(), NOW())`,
        { id, show: ids.show, name, status: usedIn ? 'used' : 'ready', usedIn, reqs: JSON.stringify(REQUIREMENTS) });
      return id;
    };
    ids.started = await event('Started Gala', ids.ep);
    ids.legacy = await event('Legacy Gala', ids.ep2);
    ids.open = await event('Open Gala', null);
    ids.deadLink = await event('Dead Link Gala', ids.gone);
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, event_id, status, created_at, updated_at)
               VALUES (:brief, :ep, :show, :started, 'draft', NOW(), NOW())`, ids);
    return ids;
  }

  const put = (ids, eventId, body) => request(app)
    .put(`/api/v1/world/${ids.show}/events/${eventId}`)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
  const inject = (ids, eventId, episodeId) => request(app)
    .post(`/api/v1/world/${ids.show}/events/${eventId}/inject`)
    .set('Authorization', `Bearer ${token}`)
    .send({ episode_id: episodeId });
  const putBrief = (episodeId, body) => request(app)
    .put(`/api/v1/episode-brief/${episodeId}`)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
  const row = async (id) => (await q(`SELECT name, is_paid, payment_amount, requirements, restrictions, used_in_episode_id
                                       FROM world_events WHERE id = :id`, { id }))[0];

  afterAll(async () => {
    for (const show of shows) {
      await run(`DELETE FROM episode_briefs WHERE show_id = :show`, { show });
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  describe('event PUT', () => {
    it('refuses a change to compensation on a started event, and writes nothing', async () => {
      const ids = await seed();

      const res = await put(ids, ids.started, { is_paid: true, payment_amount: 500, name: 'Renamed' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('EVENT_TERMS_LOCKED');
      expect(res.body.fields).toEqual(['is_paid', 'payment_amount']);
      expect(res.body.error).toBe('This event started Episode 1 "Episode 1", so its terms are locked: compensation can\'t change now.');
      expect(await row(ids.started)).toEqual(expect.objectContaining({ name: 'Started Gala', is_paid: false, payment_amount: 0 }));
    });

    it('refuses changes to requirements, restrictions and the episode link', async () => {
      const ids = await seed();

      const reqs = await put(ids, ids.started, { requirements: { reputation_min: 7 } });
      const restr = await put(ids, ids.started, { restrictions: [{ type: 'other', description: 'No rival brands' }] });
      const unlink = await put(ids, ids.started, { used_in_episode_id: null });
      const relink = await put(ids, ids.started, { used_in_episode_id: ids.ep2 });

      for (const res of [reqs, restr, unlink, relink]) expect(res.status).toBe(409);
      expect(reqs.body.fields).toEqual(['requirements']);
      expect(restr.body.fields).toEqual(['restrictions']);
      expect(unlink.body.fields).toEqual(['used_in_episode_id']);
      const after = await row(ids.started);
      expect(after.requirements).toEqual(REQUIREMENTS);
      expect(after.restrictions).toEqual([]);
      expect(after.used_in_episode_id).toBe(ids.ep);
    });

    it('accepts a full-form save that resends the locked fields unchanged, and saves the rest', async () => {
      const ids = await seed();

      const res = await put(ids, ids.started, {
        name: 'Started Gala (renamed)', is_paid: false, payment_amount: 0,
        requirements: { ...REQUIREMENTS }, restrictions: [], used_in_episode_id: ids.ep, cost_coins: 250,
      });

      expect(res.status).toBe(200);
      expect(await row(ids.started)).toEqual(expect.objectContaining({ name: 'Started Gala (renamed)', used_in_episode_id: ids.ep }));
    });

    it('allows restoring a cleared link to the episode that started the event', async () => {
      const ids = await seed();
      await run(`UPDATE world_events SET used_in_episode_id = NULL WHERE id = :id`, { id: ids.started });

      const res = await put(ids, ids.started, { used_in_episode_id: ids.ep });

      expect(res.status).toBe(200);
      expect((await row(ids.started)).used_in_episode_id).toBe(ids.ep);
    });

    it('locks an event linked only by used_in_episode_id to a live episode', async () => {
      const ids = await seed();

      const res = await put(ids, ids.legacy, { payment_amount: 300 });

      expect(res.status).toBe(409);
      expect(res.body.episode.id).toBe(ids.ep2);
    });

    it('leaves unstarted events, and events whose episode is deleted, editable', async () => {
      const ids = await seed();

      const open = await put(ids, ids.open, { is_paid: true, payment_amount: 300, requirements: { reputation_min: 5 } });
      const dead = await put(ids, ids.deadLink, { payment_amount: 120, used_in_episode_id: null });

      expect(open.status).toBe(200);
      expect(dead.status).toBe(200);
      expect(await row(ids.open)).toEqual(expect.objectContaining({ is_paid: true, payment_amount: 300 }));
      expect(await row(ids.deadLink)).toEqual(expect.objectContaining({ payment_amount: 120, used_in_episode_id: null }));
    });
  });

  describe('inject', () => {
    it('refuses to move a started event to another episode', async () => {
      const ids = await seed();

      const res = await inject(ids, ids.started, ids.ep2);

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('EVENT_TERMS_LOCKED');
      expect(res.body.error).toBe('This event started Episode 1 "Episode 1", so it can\'t be moved to another episode. Its terms and episode link are locked.');
      expect((await row(ids.started)).used_in_episode_id).toBe(ids.ep);
    });

    it('still injects a started event into its own episode, and an unstarted event into a free one', async () => {
      const ids = await seed();

      expect((await inject(ids, ids.started, ids.ep)).status).toBe(200);
      expect((await inject(ids, ids.open, ids.free)).status).toBe(200);
      expect((await row(ids.open)).used_in_episode_id).toBe(ids.free);
    });
  });

  describe('brief PUT', () => {
    it("refuses to change or clear a brief's source event", async () => {
      const ids = await seed();

      const change = await putBrief(ids.ep, { event_id: ids.open });
      const clear = await putBrief(ids.ep, { event_id: null });

      expect(change.status).toBe(409);
      expect(clear.status).toBe(409);
      expect(change.body.code).toBe('EVENT_TERMS_LOCKED');
      const [brief] = await q(`SELECT event_id FROM episode_briefs WHERE id = :brief`, ids);
      expect(brief.event_id).toBe(ids.started);
    });

    it('still edits other brief fields, and sets a source event on a brief that has none', async () => {
      const ids = await seed();
      await run(`INSERT INTO episode_briefs (id, episode_id, show_id, status, created_at, updated_at)
                 VALUES (:openBrief, :ep2, :show, 'draft', NOW(), NOW())`, ids);

      const other = await putBrief(ids.ep, { narrative_purpose: 'Raise the stakes', event_id: ids.started });
      const set = await putBrief(ids.ep2, { event_id: ids.legacy });

      expect(other.status).toBe(200);
      expect(set.status).toBe(200);
      const [b2] = await q(`SELECT event_id FROM episode_briefs WHERE id = :openBrief`, ids);
      expect(b2.event_id).toBe(ids.legacy);
    });
  });
});
