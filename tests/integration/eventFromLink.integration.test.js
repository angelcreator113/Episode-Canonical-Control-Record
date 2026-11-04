/**
 * Evaluation and the outfit browse pool read the episode's event from its
 * link, not only from the script's [EVENT:] tag (Task #3608), against the
 * test database.
 *
 * Since A1c R1 (PR #3607) inject links an event to an episode whose script is
 * empty without writing a tag, so a script written afterwards has none. The
 * event comes from utils/episodeEventSql (the one rule, Task #1917); a tag in
 * the script still overrides the values it states; 422 only with neither.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const browsePoolGenerator = require('../../src/utils/browsePoolGenerator');

const { sequelize } = models;
const shouldSkip = !process.env.DATABASE_URL || process.env.DATABASE_URL?.includes('amazonaws.com') || !process.env.DATABASE_URL?.includes('episode_metadata_test');
const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

const TERMS = { name: 'Velour Gala', prestige: 7, cost: 150, strictness: 6, deadline: 'high', dress_code: 'romantic couture' };
const SCRIPT_NO_TAG = '## BEAT: OPENING\nLala: Tonight is the gala.\n';

(shouldSkip ? describe.skip : describe)('the episode event comes from its link (Task #3608)', () => {
  const shows = [];
  let auth;
  beforeAll(() => {
    const token = TokenService.generateTokenPair({ id: 'test-user-event-link', email: 'test@event-link.dev', name: 'Event Link', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    auth = { Authorization: `Bearer ${token}` };
  });

  async function seed({ linked = true, script = '' } = {}) {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :slug, CAST(:m AS jsonb), NOW(), NOW())`,
      { show, name: `EL ${show.slice(0, 8)}`, slug: `el-${show.slice(0, 8)}`, m: JSON.stringify({ starting_balance: 1000 }) });
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
               VALUES (:id, :show, 'lala', 1000, 3, 4, 3, 5, NOW(), NOW())`, { id: uuid(), show });
    const ep = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, created_at, updated_at)
               VALUES (:ep, :show, 'Ep 1', 1, 'draft', :script, NOW(), NOW())`, { ep, show, script });
    const event = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, prestige, cost_coins, strictness, deadline_type, dress_code, created_at, updated_at)
               VALUES (:event, :show, :name, :status, :linkedEp, :prestige, :cost, :strictness, :deadline, :dress, NOW(), NOW())`,
      { event, show, name: TERMS.name, status: linked ? 'used' : 'draft', linkedEp: linked ? ep : null, prestige: TERMS.prestige, cost: TERMS.cost, strictness: TERMS.strictness, deadline: TERMS.deadline, dress: TERMS.dress_code });
    return { show, ep, event };
  }

  const evaluate = (ep) => request(app).post(`/api/v1/episodes/${ep}/evaluate`).set(auth).send({});

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await new Promise((r) => setTimeout(r, 200));
    for (const show of shows) {
      for (const t of ['decision_log', 'episode_script_versions']) {
        await run(`DELETE FROM ${t} WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)`, { show })
          .catch((e) => console.error(`cleanup ${t}:`, e.message));
      }
      for (const t of ['character_state', 'world_events', 'episodes']) {
        await run(`DELETE FROM ${t} WHERE show_id = :show`, { show });
      }
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
  });

  it('evaluates an episode with a linked event and no tag, from the event\'s terms', async () => {
    const { ep } = await seed({ script: SCRIPT_NO_TAG });
    const res = await evaluate(ep);
    expect(res.status).toBe(200);
    expect(res.body.evaluation.event_parsed).toEqual(TERMS);
  });

  it('lets a tag in the script override the values it states, the rest from the link', async () => {
    const { ep } = await seed({ script: `[EVENT: name="Velour Gala" prestige=3]\n${SCRIPT_NO_TAG}` });
    const res = await evaluate(ep);
    expect(res.status).toBe(200);
    expect(res.body.evaluation.event_parsed).toEqual({ ...TERMS, prestige: 3 });
  });

  it('still evaluates from a tag alone when nothing is linked', async () => {
    const { ep } = await seed({ linked: false, script: `[EVENT: name="Tag Only" prestige=5 cost=80]\n${SCRIPT_NO_TAG}` });
    const res = await evaluate(ep);
    expect(res.status).toBe(200);
    expect(res.body.evaluation.event_parsed).toEqual({ name: 'Tag Only', prestige: 5, cost: 80 });
  });

  it('answers 422 naming both only when there is neither a linked event nor a tag', async () => {
    const { ep } = await seed({ linked: false, script: SCRIPT_NO_TAG });
    const res = await evaluate(ep);
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/no event is linked/);
    expect(res.body.error).toMatch(/\[EVENT:\] tag/);
  });

  it('gives the browse pool the linked event\'s dress code without a tag, and a tag still overrides', async () => {
    const spy = jest.spyOn(browsePoolGenerator, 'generateBrowsePool');
    const { show, ep } = await seed({ script: SCRIPT_NO_TAG });
    const res = await request(app).post(`/api/v1/world/${show}/browse-pool`).set(auth).send({ episode_id: ep });
    expect(res.status).toBe(200);
    expect(spy.mock.calls[0][0].event).toMatchObject({ dress_code: 'romantic couture', prestige: 7, strictness: 6 });

    await run('UPDATE episodes SET script_content = :s WHERE id = :ep', { ep, s: `[EVENT: name="Velour Gala" dress_code="black tie"]\n${SCRIPT_NO_TAG}` });
    const res2 = await request(app).post(`/api/v1/world/${show}/browse-pool`).set(auth).send({ episode_id: ep });
    expect(res2.status).toBe(200);
    expect(spy.mock.calls[1][0].event).toMatchObject({ dress_code: 'black tie', prestige: 7 });
  });

  it('end to end: inject into an empty script, save a script without a tag, evaluate', async () => {
    const { show, ep, event } = await seed({ linked: false, script: '' });

    const injected = await request(app).post(`/api/v1/world/${show}/events/${event}/inject`).set(auth).send({ episode_id: ep });
    expect(injected.status).toBe(200);
    expect(injected.body.script_tagged).toBe(false);

    // The Script tab's save: it sends back the revision it read (A1c R1).
    const page = await request(app).get(`/api/v1/episodes/${ep}`).set(auth);
    expect(page.status).toBe(200);
    const saved = await request(app).put(`/api/v1/episodes/${ep}`).set(auth)
      .send({ script_content: SCRIPT_NO_TAG, script_revision: page.body.script_revision });
    expect(saved.status).toBe(200);
    const [[row]] = await run('SELECT script_content FROM episodes WHERE id = :ep', { ep });
    expect(row.script_content).not.toMatch(/\[EVENT:/);

    const res = await evaluate(ep);
    expect(res.status).toBe(200);
    expect(res.body.evaluation.event_parsed).toEqual(TERMS);
  });
});
