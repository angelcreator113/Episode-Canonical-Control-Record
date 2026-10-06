/**
 * The Event Package's shopping list and career plan beside the invitation
 * (Evoni, 2026-10-06): Draft, Edit, Redraft, Approve through the routes,
 * stored in the event's canon_consequences.documents against real Postgres;
 * the rest of canon_consequences is kept, and an Event Package save that
 * carries an older copy of the documents does not overwrite them.
 */
jest.unmock('uuid');
jest.mock('../../src/services/todoListService', () => ({
  ...jest.requireActual('../../src/services/todoListService'),
  generateTasks: jest.fn(async () => [
    { slot: 'dress', label: 'Find a showstopper', description: 'Tonight matters', required: true },
    { slot: 'purse', label: 'Find a clutch', description: '', required: false },
  ]),
  generateCareerTasks: jest.fn(async () => [
    { slot: 'net_1', label: 'Follow up with STUDIO BY SABLE', description: '', required: false },
  ]),
}));

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

(shouldSkip ? describe.skip : describe)('event documents: shopping list and career plan', () => {
  let token;
  const shows = [];

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-docs', email: 'test@docs.dev', name: 'Docs Test', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });

  async function seed() {
    const ids = { show: uuid(), event: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `Docs ${ids.show.slice(0, 8)}`, slug: `docs-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, canon_consequences, status, created_at, updated_at)
               VALUES (:event, :show, 'Studio Session', 'invite', :cc, 'ready', NOW(), NOW())`,
      { ...ids, cc: JSON.stringify({ invitation_text: 'Dearest Lala' }) });
    return ids;
  }

  const base = (ids) => `/api/v1/world/${ids.show}/events/${ids.event}`;
  const auth = (req) => req.set('Authorization', `Bearer ${token}`);
  const stored = async (ids) => {
    const [row] = await q(`SELECT canon_consequences FROM world_events WHERE id = :event`, ids);
    return typeof row.canon_consequences === 'string' ? JSON.parse(row.canon_consequences) : row.canon_consequences;
  };

  afterAll(async () => {
    for (const show of shows) {
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  it('drafts, edits and approves a shopping list, keeping the rest of canon_consequences', async () => {
    const ids = await seed();
    const empty = await auth(request(app).get(`${base(ids)}/documents`));
    expect(empty.status).toBe(200);
    expect(empty.body.data).toEqual({ shopping_list: null, career_plan: null });

    const drafted = await auth(request(app).post(`${base(ids)}/documents/shopping_list/draft`));
    expect(drafted.status).toBe(200);
    expect(drafted.body.data).toMatchObject({ status: 'draft', version: 1 });
    expect(drafted.body.data.items.map((i) => i.label)).toEqual(['Find a showstopper', 'Find a clutch']);

    const edited = await auth(request(app).put(`${base(ids)}/documents/shopping_list`))
      .send({ items: [{ slot: 'shoes', label: 'Gold heels' }] });
    expect(edited.status).toBe(200);
    expect(edited.body.data).toMatchObject({ status: 'draft', version: 2, source: 'edited' });

    const approved = await auth(request(app).post(`${base(ids)}/documents/shopping_list/approve`));
    expect(approved.status).toBe(200);
    expect(approved.body.data).toMatchObject({ status: 'approved', version: 2 });

    const cc = await stored(ids);
    expect(cc.invitation_text).toBe('Dearest Lala');
    expect(cc.documents.shopping_list).toMatchObject({ status: 'approved', version: 2 });
    expect(cc.documents.shopping_list.history.map((h) => h.version)).toEqual([1]);
    expect(cc.documents.career_plan).toBeUndefined();
  });

  it('the career plan sits beside the shopping list; an Event Package save cannot overwrite either', async () => {
    const ids = await seed();
    await auth(request(app).post(`${base(ids)}/documents/shopping_list/draft`));
    const plan = await auth(request(app).post(`${base(ids)}/documents/career_plan/draft`));
    expect(plan.status).toBe(200);
    expect(plan.body.data.items[0]).toMatchObject({ label: 'Follow up with STUDIO BY SABLE', section: 'this_event' });

    // The Event Package sends back the canon_consequences it loaded, which
    // can hold an older copy of the documents.
    const save = await auth(request(app).put(base(ids)))
      .send({ canon_consequences: { invitation_text: 'Dearest Lala, see you there', documents: { shopping_list: { version: 0, items: [] } } } });
    expect(save.status).toBe(200);
    const cc = await stored(ids);
    expect(cc.invitation_text).toBe('Dearest Lala, see you there');
    expect(cc.documents.shopping_list.version).toBe(1);
    expect(cc.documents.career_plan.version).toBe(1);
  });

  it('refuses an unknown document, and editing before a draft', async () => {
    const ids = await seed();
    expect((await auth(request(app).post(`${base(ids)}/documents/invoice/draft`))).status).toBe(400);
    const early = await auth(request(app).put(`${base(ids)}/documents/career_plan`)).send({ items: [{ label: 'x' }] });
    expect(early.status).toBe(404);
    expect(early.body.error).toMatch(/Draft it first/);
  });
});
