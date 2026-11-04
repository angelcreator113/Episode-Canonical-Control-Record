/**
 * Integration Tests - the episode update's air date (P0; Evoni's ruling on
 * the Overview Air Date edit: "Fix field mapping, add validation and
 * regression tests").
 *
 * Against the test database, through the app (PUT /api/v1/episodes/:id):
 * a day as YYYY-MM-DD is saved as that day; an unreadable date is a 400 and
 * nothing is written; empty or null clears it; a key the update does not
 * keep (the Overview's old publish_date, episode_intent, creative_notes) is
 * not written and is named in ignored_fields.
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
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const one = async (sql, replacements = {}) =>
  (await sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT }))[0];

(shouldSkip ? describe.skip : describe)('PUT /episodes/:id air_date', () => {
  const shows = [];
  let token;

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-air-date', email: 'test@air-date.dev', name: 'Air Date',
      groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });

  afterAll(async () => {
    if (shows.length) {
      await run('DELETE FROM feed_posts WHERE show_id IN (:shows)', { shows });
      await run('DELETE FROM episodes WHERE show_id IN (:shows)', { shows });
      await run('DELETE FROM shows WHERE id IN (:shows)', { shows });
    }
  });

  async function seed({ air = null } = {}) {
    const ids = { show: uuid(), ep: uuid(), air };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `Air ${ids.show.slice(0, 8)}`, slug: `air-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, air_date, created_at, updated_at)
               VALUES (:ep, :show, 'Gala Night', 3, 'draft', CAST(:air AS timestamptz), NOW(), NOW())`, ids);
    return ids;
  }

  const put = (ep, body) => request(app).put(`/api/v1/episodes/${ep}`).set('Authorization', `Bearer ${token}`).send(body);
  const dayOf = async (ep) =>
    (await one(`SELECT to_char(air_date AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day FROM episodes WHERE id = :ep`, { ep })).day;

  test('a day as YYYY-MM-DD is saved as that day and returned', async () => {
    const ids = await seed();
    const res = await put(ids.ep, { air_date: '2026-12-01' });
    expect(res.status).toBe(200);
    expect(await dayOf(ids.ep)).toBe('2026-12-01');
    expect(String(res.body.data.air_date).slice(0, 10)).toBe('2026-12-01');
    expect(res.body).not.toHaveProperty('ignored_fields');

    // GET reads back the same day.
    const got = await request(app).get(`/api/v1/episodes/${ids.ep}`).set('Authorization', `Bearer ${token}`);
    expect(got.status).toBe(200);
    expect(String((got.body.data || got.body).air_date).slice(0, 10)).toBe('2026-12-01');
  });

  test('a full ISO timestamp is still kept (existing callers)', async () => {
    const ids = await seed();
    const res = await put(ids.ep, { air_date: '2026-11-01T00:00:00.000Z' });
    expect(res.status).toBe(200);
    expect(await dayOf(ids.ep)).toBe('2026-11-01');
  });

  test.each([
    ['not-a-date'],
    ['2026-02-30'],
    ['2026-13-01'],
    ['12/01/2026'],
    [20261201],
    [{ day: '2026-12-01' }],
  ])('an unreadable air date (%p) is a 400 and nothing is written', async (bad) => {
    const ids = await seed({ air: '2026-10-10T00:00:00Z' });
    const res = await put(ids.ep, { air_date: bad, title: 'Should not save' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('air_date: a date as YYYY-MM-DD, or empty to clear it.');
    const row = await one('SELECT title FROM episodes WHERE id = :ep', ids);
    expect(row.title).toBe('Gala Night');
    expect(await dayOf(ids.ep)).toBe('2026-10-10');
  });

  test.each([[''], [null]])('an empty air date (%p) clears it to null', async (empty) => {
    const ids = await seed({ air: '2026-10-10T00:00:00Z' });
    const res = await put(ids.ep, { air_date: empty });
    expect(res.status).toBe(200);
    const row = await one('SELECT air_date FROM episodes WHERE id = :ep', ids);
    expect(row.air_date).toBeNull();
    expect(res.body.data.air_date).toBeNull();
  });

  test('an update without air_date leaves it as it was', async () => {
    const ids = await seed({ air: '2026-10-10T00:00:00Z' });
    const res = await put(ids.ep, { title: 'Renamed' });
    expect(res.status).toBe(200);
    expect(await dayOf(ids.ep)).toBe('2026-10-10');
  });

  test('keys the update does not keep are not written and are named in ignored_fields', async () => {
    const ids = await seed({ air: '2026-10-10T00:00:00Z' });
    // What the Overview form sent before this fix.
    const res = await put(ids.ep, {
      title: 'Gala Night II', description: 'Synopsis.', publish_date: '2026-12-25',
      episode_intent: 'Win the room', creative_notes: 'Soft gold', show_id: uuid(),
    });
    expect(res.status).toBe(200);
    expect(res.body.ignored_fields).toEqual(['publish_date', 'episode_intent', 'creative_notes', 'show_id']);
    // An internal attribute is neither written nor named (A1b).
    const internal = await put(ids.ep, { title: 'Gala Night II', script_line_keys: { x: 'ln_1' } });
    expect(internal.status).toBe(200);
    expect(JSON.stringify(internal.body)).not.toContain('script_line_keys');
    const row = await one(`SELECT title, description, show_id, to_char(air_date AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day
                             FROM episodes WHERE id = :ep`, ids);
    expect(row).toEqual({ title: 'Gala Night II', description: 'Synopsis.', show_id: ids.show, day: '2026-10-10' });
  });

  // Scheduled posts follow an Air Date only through the existing rule
  // (services/postRelease shiftForAirDate, called by updateEpisode): a stored
  // date that moves to another stored date moves the episode's scheduled
  // drafts by the same amount. A first date, a cleared date, a refused date
  // and a save without air_date move nothing (Evoni, 2026-11-04: "verify that
  // changing an Air Date affects scheduled posts only through the intended
  // existing scheduling rules").
  describe('scheduled posts', () => {
    const DAY = 24 * 60 * 60 * 1000;
    const dayOf = (d) => d.toISOString().slice(0, 10);
    const future = (days) => { const d = new Date(Date.now() + days * DAY); d.setUTCHours(0, 0, 0, 0); return d; };
    const scheduled = (show, releaseAt, storyOrder = 31) => models.FeedPost.create({
      show_id: show, poster_handle: `air${show.slice(0, 6)}`, poster_display_name: 'Air', poster_platform: 'lalaverse',
      post_type: 'post', content_text: 'soon.', status: 'draft', release_state: 'scheduled', release_at: releaseAt,
      story_order: storyOrder, likes: 0, comments_count: 0, shares: 0, sample_comments: [], sort_order: 0,
    });
    beforeAll(() => jest.spyOn(console, 'log').mockImplementation(() => {}));

    it('a day from the Overview moves the episode\'s scheduled posts by exactly the change; other episodes stay', async () => {
      const air = future(20);
      const ids = await seed({ air: air.toISOString() });
      const before = new Date(air.getTime() - 2 * DAY + 18 * 60 * 60 * 1000);
      const mine = await scheduled(ids.show, before);
      const other = await scheduled(ids.show, before, 41);
      const res = await put(ids.ep, { air_date: dayOf(future(23)) });
      expect(res.status).toBe(200);
      expect(res.body.release_shift).toEqual({ shifted: [mine.id], held: [] });
      await mine.reload(); await other.reload();
      expect(mine.release_at.getTime()).toBe(before.getTime() + 3 * DAY);
      expect(other.release_at.getTime()).toBe(before.getTime());
    });

    it('a first date, a cleared date, a refused date and an unrelated save move nothing', async () => {
      const blank = await seed();
      const at = new Date(future(10).getTime() + 12 * 60 * 60 * 1000);
      const p = await scheduled(blank.show, at);
      const first = await put(blank.ep, { air_date: dayOf(future(12)) });
      expect(first.status).toBe(200);
      expect(first.body.release_shift).toBeUndefined();

      const refused = await put(blank.ep, { air_date: '12/01/2026' });
      expect(refused.status).toBe(400);
      const untouched = await put(blank.ep, { title: 'Gala Night II' });
      expect(untouched.body.release_shift).toBeUndefined();
      const cleared = await put(blank.ep, { air_date: '' });
      expect(cleared.status).toBe(200);
      expect(cleared.body.release_shift).toBeUndefined();

      await p.reload();
      expect(p.release_at.getTime()).toBe(at.getTime());
      expect(p.release_state).toBe('scheduled');
    });
  });
});
