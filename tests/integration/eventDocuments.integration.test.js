/**
 * The Event Package's shopping list (Evoni, 2026-10-06) and offer letter
 * (2026-10-24, in place of the career plan; deal events only) beside the
 * invitation: Draft, Edit, Redraft, Approve through the routes,
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
}));
jest.mock('../../src/services/offerLetterService', () => ({
  ...jest.requireActual('../../src/services/offerLetterService'),
  writeOfferLetter: jest.fn(async () => ({
    letter: { greeting: 'Dear Lala,', opening: 'Studio by Sable is pleased to offer you a partnership.', opportunity: 'Front the session.', next_steps: 'Reply to accept.', closing: 'Warm regards,', sender_name: 'Sable', sender_title: 'Founder' },
    source: 'claude',
    checks: { amounts: { ok: true, invented: [] } },
  })),
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

(shouldSkip ? describe.skip : describe)('event documents: shopping list and offer letter', () => {
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

  // A deal on the event: the offer letter is for deal events only.
  const makeDeal = (ids) => run(
    `UPDATE world_events SET deal_type = 'paid_appearance', appearance_fee = 500, is_paid = true WHERE id = :event`, ids);

  const base = (ids) => `/api/v1/world/${ids.show}/events/${ids.event}`;
  const auth = (req) => req.set('Authorization', `Bearer ${token}`);
  const stored = async (ids) => {
    const [row] = await q(`SELECT canon_consequences FROM world_events WHERE id = :event`, ids);
    return typeof row.canon_consequences === 'string' ? JSON.parse(row.canon_consequences) : row.canon_consequences;
  };

  afterAll(async () => {
    for (const show of shows) {
      await run(`DELETE FROM event_deliverables WHERE event_id IN (SELECT id FROM world_events WHERE show_id = :show)`, { show })
        .catch((err) => console.error('cleanup event_deliverables:', err.message));
      // Approving draws the document's overlay (an assets row).
      await run(`DELETE FROM assets WHERE show_id = :show AND asset_type = 'DOCUMENT_OVERLAY'`, { show })
        .catch((err) => console.error('cleanup document overlays:', err.message));
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  it('drafts, edits and approves a shopping list, keeping the rest of canon_consequences', async () => {
    const ids = await seed();
    const empty = await auth(request(app).get(`${base(ids)}/documents`));
    expect(empty.status).toBe(200);
    expect(empty.body.data).toMatchObject({ shopping_list: null, offer_letter: null, offer_eligible: false, offer_terms: [] });
    // The look the shopping list adds up, and Lala's coins, come with the documents (Task #2787).
    expect(empty.body.data.look).toEqual({ state: 'none', pieces: [], total: 0 });
    expect(typeof empty.body.data.balance).toBe('number');

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
    expect(cc.documents.offer_letter).toBeUndefined();
  });

  it('the offer letter sits beside the shopping list on a deal event; an Event Package save cannot overwrite either', async () => {
    const ids = await seed();
    await auth(request(app).post(`${base(ids)}/documents/shopping_list/draft`));
    // No deal yet: refused.
    expect((await auth(request(app).post(`${base(ids)}/documents/offer_letter/draft`))).status).toBe(409);
    await makeDeal(ids);
    const offer = await auth(request(app).post(`${base(ids)}/documents/offer_letter/draft`));
    expect(offer.status).toBe(200);
    expect(offer.body.data).toMatchObject({ type: 'offer_letter', status: 'draft', version: 1, items: [] });
    expect(offer.body.data.letter.opening).toMatch(/pleased to offer/);
    expect(typeof offer.body.data.terms_key).toBe('string');

    // Her own words through PUT { letter }.
    const edited = await auth(request(app).put(`${base(ids)}/documents/offer_letter`))
      .send({ letter: { opening: 'We would be delighted to work with you.', opportunity: 'Front the session.' } });
    expect(edited.status).toBe(200);
    expect(edited.body.data).toMatchObject({ version: 2, source: 'edited' });

    // The Event Package sends back the canon_consequences it loaded, which
    // can hold an older copy of the documents.
    const save = await auth(request(app).put(base(ids)))
      .send({ canon_consequences: { invitation_text: 'Dearest Lala, see you there', documents: { shopping_list: { version: 0, items: [] } } } });
    expect(save.status).toBe(200);
    const cc = await stored(ids);
    expect(cc.invitation_text).toBe('Dearest Lala, see you there');
    expect(cc.documents.shopping_list.version).toBe(1);
    expect(cc.documents.offer_letter.version).toBe(2);
  });

  it('refuses an unknown document, and editing before a draft', async () => {
    const ids = await seed();
    expect((await auth(request(app).post(`${base(ids)}/documents/invoice/draft`))).status).toBe(400);
    expect((await auth(request(app).post(`${base(ids)}/documents/career_plan/draft`))).status).toBe(400);
    const early = await auth(request(app).put(`${base(ids)}/documents/offer_letter`)).send({ letter: { opening: 'x' } });
    expect(early.status).toBe(404);
    expect(early.body.error).toMatch(/Draft it first/);
  });

  it("GET carries the offer letter's terms from the deal: the fee and each deliverable, never stored", async () => {
    const ids = await seed();
    const none = await auth(request(app).get(`${base(ids)}/documents`));
    expect(none.body.data).toMatchObject({ offer_eligible: false, offer_terms: [] });
    await makeDeal(ids);
    const { insertEventDeliverables } = require('../../src/services/eventTermsService');
    await insertEventDeliverables(models.sequelize, ids.event, [
      { description: 'Wearable art reel', deliverable_type: 'pulse_video', required: true, owed_to: 'brand' },
      { description: 'Story shout-out', deliverable_type: 'pulse_stories', quantity: 3, required: false, owed_to: 'host' },
    ]);
    const res = await auth(request(app).get(`${base(ids)}/documents`));
    expect(res.status).toBe(200);
    expect(res.body.data.offer_eligible).toBe(true);
    const byKey = Object.fromEntries(res.body.data.offer_terms.map((sec) => [sec.key, sec]));
    expect(byKey.fees.lines).toEqual([{ label: 'Appearance fee', detail: '', amount: 500 }]);
    const byLabel = Object.fromEntries(byKey.deliverables.lines.map((l) => [l.label, l]));
    expect(Object.keys(byLabel).sort()).toEqual(['Story shout-out', 'Wearable art reel']);
    expect(byLabel['Wearable art reel'].detail).toBe('1 Pulse video · for the brand · required');
    expect(byLabel['Story shout-out'].detail).toBe('3 Pulse stories · for the host · optional');
    // Never stored in a document.
    expect((await stored(ids)).documents).toBeUndefined();
  });
});
