/**
 * Post moments draft feed posts (Task #2885): each [UI:POST words] line of
 * the saved script drafts one FeedPost (status draft, the episode's own, its
 * story time "during the episode"), linked to its beat through a phone
 * moment (feed_moments.feed_post_id). Saving again drafts nothing twice.
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

const SCRIPT = [
  '## BEAT: 4 · Interruption Pulse 1',
  '[UI:NOTIFY STUDIO BY SABLE: You are invited]',
  '## BEAT: 12 · Deliverable Creation',
  'Lala: "Okay, posting it."',
  '[UI:POST Studio night, statement look.]',
].join('\n');

(shouldSkip ? describe.skip : describe)('Script post moments draft feed posts', () => {
  let token;
  const shows = [];

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-post-drafts', email: 'evoni@post-drafts.dev', name: 'Post Drafts', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });

  afterAll(async () => {
    for (const show of shows) {
      await run('DELETE FROM feed_moments WHERE show_id = :show', { show });
      await run('DELETE FROM feed_posts WHERE show_id = :show', { show });
      await run('DELETE FROM episodes WHERE show_id = :show', { show });
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
  });

  const url = (ep) => `/api/v1/feed-posts/episodes/${ep}/script-drafts`;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const drafts = async (show) => {
    const [rows] = await run(
      `SELECT fp.id, fp.status, fp.content_text, fp.episode_id, fp.timeline_position, fp.story_order, fm.beat_number
         FROM feed_posts fp LEFT JOIN feed_moments fm ON fm.feed_post_id = fp.id
        WHERE fp.show_id = :show ORDER BY fp.created_at`, { show });
    return rows;
  };

  async function seed(script = SCRIPT) {
    const ids = { show: uuid(), ep: uuid() };
    shows.push(ids.show);
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())',
      { ...ids, name: `Posts ${ids.show.slice(0, 8)}`, slug: `posts-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, created_at, updated_at)
               VALUES (:ep, :show, 'Wearable Experiments', 1, 'draft', :script, NOW(), NOW())`, { ...ids, script });
    return ids;
  }

  it('needs a signed-in user', async () => {
    const ids = await seed();
    expect((await request(app).get(url(ids.ep))).status).toBe(401);
    expect((await request(app).post(url(ids.ep))).status).toBe(401);
  });

  it('reading drafts nothing; drafting makes one linked draft per Post line', async () => {
    const ids = await seed();
    const before = await auth(request(app).get(url(ids.ep)));
    expect(before.body.data).toEqual([{ beat: 12, text: 'Studio night, statement look.', post_id: null, status: null }]);
    expect(await drafts(ids.show)).toEqual([]);

    const res = await auth(request(app).post(url(ids.ep)));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([expect.objectContaining({ beat: 12, text: 'Studio night, statement look.', status: 'draft', created: true })]);
    const rows = await drafts(ids.show);
    expect(rows).toEqual([expect.objectContaining({
      status: 'draft', content_text: 'Studio night, statement look.', episode_id: ids.ep,
      timeline_position: 'during_episode', story_order: null, beat_number: 12,
    })]);
    expect(rows[0].id).toBe(res.body.data[0].post_id);

    const after = await auth(request(app).get(url(ids.ep)));
    expect(after.body.data[0]).toMatchObject({ post_id: rows[0].id, status: 'draft' });
  });

  it('saving again drafts nothing twice; a new Post line drafts only itself', async () => {
    const ids = await seed();
    await auth(request(app).post(url(ids.ep)));
    const again = await auth(request(app).post(url(ids.ep)));
    expect(again.body.data).toEqual([expect.objectContaining({ created: false })]);
    expect(await drafts(ids.show)).toHaveLength(1);

    await run('UPDATE episodes SET script_content = :s WHERE id = :ep', { ep: ids.ep, s: `${SCRIPT}\n[UI:POST Thank you STUDIO BY SABLE.]` });
    const more = await auth(request(app).post(url(ids.ep)));
    expect(more.body.data.map((d) => [d.text, d.created])).toEqual([['Studio night, statement look.', false], ['Thank you STUDIO BY SABLE.', true]]);
    expect(await drafts(ids.show)).toHaveLength(2);
  });

  it('no Post lines, nothing drafted; an unknown episode is 404', async () => {
    const ids = await seed('## BEAT: 1 · Opening Ritual\nPrime: "Hi."');
    expect((await auth(request(app).post(url(ids.ep)))).body.data).toEqual([]);
    expect((await auth(request(app).post(url(uuid())))).status).toBe(404);
  });
});
