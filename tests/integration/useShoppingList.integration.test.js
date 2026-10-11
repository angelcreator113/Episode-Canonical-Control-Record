/**
 * "Use in episode" (Task #2883): the event's approved shopping list applied
 * to an episode already started, as the same tasks Start Episode makes
 * (shoppingListTasks), each tagged with the document it came from. A Draft
 * list is refused; applying twice adds nothing new; a completed task is
 * never lost.
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
const parse = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

const list = (status, version = 1, items = null) => ({
  type: 'shopping_list', status, version, source: 'draft', history: [],
  items: items || [
    { slot: 'dress', label: 'A statement dress', required: true },
    { slot: 'shoes', label: 'Crimson Satin Ballerina Pump', required: true },
    { slot: 'jewelry', label: 'Crimson Bloom Enamel Stud Earrings', required: false },
  ],
});

(shouldSkip ? describe.skip : describe)('Use an approved shopping list in the episode', () => {
  let token;
  const shows = [];

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-use-list', email: 'evoni@use-list.dev', name: 'Use List', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });

  afterAll(async () => {
    for (const show of shows) {
      await run('DELETE FROM episode_todo_lists WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)', { show });
      await run('DELETE FROM world_events WHERE show_id = :show', { show });
      await run('DELETE FROM episodes WHERE show_id = :show', { show });
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
  });

  const url = (ep) => `/api/v1/episodes/${ep}/todo/use-shopping-list`;
  const use = (ep) => request(app).post(url(ep)).set('Authorization', `Bearer ${token}`);
  const tasksOf = async (ep) => {
    const [[row]] = await run('SELECT tasks FROM episode_todo_lists WHERE episode_id = :ep AND deleted_at IS NULL', { ep });
    return row ? parse(row.tasks) : null;
  };
  const setList = (ev, doc) => run(
    `UPDATE world_events SET canon_consequences = CAST(:cc AS jsonb) WHERE id = :ev`,
    { ev, cc: JSON.stringify({ documents: { shopping_list: doc } }) });

  async function seed(doc) {
    const ids = { show: uuid(), ep: uuid(), ev: uuid() };
    shows.push(ids.show);
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())',
      { ...ids, name: `Use ${ids.show.slice(0, 8)}`, slug: `use-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Wearable Experiments', 1, 'draft', NOW(), NOW())`, ids);
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, canon_consequences, created_at, updated_at)
               VALUES (:ev, :show, 'Wearable Experiments Studio Session', 'used', :ep, CAST(:cc AS jsonb), NOW(), NOW())`,
      { ...ids, cc: JSON.stringify(doc ? { documents: { shopping_list: doc } } : {}) });
    return ids;
  }

  it('needs a signed-in user', async () => {
    const ids = await seed(list('approved'));
    expect((await request(app).post(url(ids.ep))).status).toBe(401);
  });

  it('a Draft list is refused, and nothing is written', async () => {
    const ids = await seed(list('draft'));
    const res = await use(ids.ep);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Approve the shopping list in the Event Package/);
    expect(await tasksOf(ids.ep)).toBeNull();
  });

  it('no list, or no event: says so', async () => {
    const ids = await seed(null);
    expect((await use(ids.ep)).status).toBe(404);
    expect((await use(uuid())).status).toBe(404);
  });

  it('an Approved list adds its tasks, tagged with the list; applying again adds nothing new', async () => {
    const ids = await seed(list('approved', 2));
    const first = await use(ids.ep);
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({ added: 3, removed: 0, kept_done: 0, version: 2 });
    const tasks = await tasksOf(ids.ep);
    expect(tasks.map((t) => [t.slot, t.label, t.completed])).toEqual([
      ['dress', 'A statement dress', false],
      ['shoes', 'Crimson Satin Ballerina Pump', false],
      ['jewelry', 'Crimson Bloom Enamel Stud Earrings', false],
    ]);
    expect(tasks[0].from_event_document).toEqual({ type: 'shopping_list', version: 2 });

    const again = await use(ids.ep);
    expect(again.body.data).toMatchObject({ added: 0, removed: 0 });
    expect(await tasksOf(ids.ep)).toEqual(tasks);
  });

  it('on a started episode: the standard slots give way, a matching line keeps its progress, done work stays', async () => {
    const ids = await seed(list('approved', 3));
    await run(`INSERT INTO episode_todo_lists (id, episode_id, show_id, event_id, tasks, status, created_at, updated_at)
               VALUES (:id, :ep, :show, :ev, CAST(:tasks AS jsonb), 'generated', NOW(), NOW())`, {
      ...ids, id: uuid(), tasks: JSON.stringify([
        { slot: 'dress', label: 'Outfit for the studio session', required: true, completed: false },
        { slot: 'shoes', label: 'Crimson Satin Ballerina Pump', required: true, completed: true },
        { slot: 'perfume', label: 'Fragrance', required: false, completed: true },
      ]),
    });
    const res = await use(ids.ep);
    expect(res.body.data).toMatchObject({ added: 2, removed: 1, kept_done: 1 });
    const tasks = await tasksOf(ids.ep);
    expect(tasks.map((t) => [t.slot, t.label, t.completed])).toEqual([
      ['dress', 'A statement dress', false],
      ['shoes', 'Crimson Satin Ballerina Pump', true],
      ['jewelry', 'Crimson Bloom Enamel Stud Earrings', false],
      ['perfume', 'Fragrance', true],
    ]);

    // A new version of the list: its lines replace the old version's open ones.
    await setList(ids.ev, list('approved', 4, [
      { slot: 'dress', label: 'A statement dress', required: true },
      { slot: 'purse', label: 'A crystal clutch', required: false },
    ]));
    const next = await use(ids.ep);
    expect(next.body.data).toMatchObject({ added: 1, removed: 1, version: 4 });
    expect((await tasksOf(ids.ep)).map((t) => [t.slot, t.completed])).toEqual([['dress', false], ['purse', false], ['shoes', true], ['perfume', true]]);
  });
});
