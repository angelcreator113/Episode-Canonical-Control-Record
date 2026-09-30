/**
 * Deal build PR 2: the deal type on the event (docs/DEAL_DESIGN.md §2.2;
 * Task #2330). Evoni's answers (docs/EVENT_EPISODE_FLOW.md §8(cc)): the deal
 * type is drafted by a fixed rule (QUESTION 2), the opportunity mapping is
 * approved (QUESTION 9), and it locks with the terms (QUESTION 14).
 *
 * Through the real routes: creation drafts it and records the draft
 * (rule 14); the draft follows deliverable, brand and type changes while it
 * is still Auto-drafted; an edit makes it Edited and the rule stops; the
 * terms lock refuses a change; an event with no recorded draft (created
 * before this PR) is never backfilled.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { convertOpportunityToEvent } = require('../../src/services/careerPipelineService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const asJson = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

(shouldSkip ? describe.skip : describe)('Deal type: fixed-rule draft, editable until the terms lock (Task #2330)', () => {
  let token;
  const shows = [];

  beforeAll(() => {
    token = TokenService.generateTokenPair({
      id: 'test-user-deal-type', email: 'test@deal-type.dev', name: 'Deal Type Test',
      groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });

  afterAll(async () => {
    for (const show of shows) {
      const events = `(SELECT id FROM world_events WHERE show_id = :show)`;
      await run(`DELETE FROM event_deliverables WHERE event_id IN ${events}`, { show });
      await run(`DELETE FROM episode_briefs WHERE show_id = :show`, { show });
      await run(`UPDATE opportunities SET event_id = NULL WHERE show_id = :show`, { show });
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM opportunities WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  async function newShow() {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show, name: `Deal type ${show.slice(0, 8)}`, slug: `deal-type-${show.slice(0, 8)}` });
    return show;
  }

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const create = (show, body) => auth(request(app).post(`/api/v1/world/${show}/events`)).send(body);
  const put = (show, id, body) => auth(request(app).put(`/api/v1/world/${show}/events/${id}`)).send(body);
  const addDeliverable = (show, id, body) => auth(request(app).post(`/api/v1/world/${show}/events/${id}/deliverables`)).send(body);

  async function stored(id) {
    const [row] = await q(`SELECT deal_type, canon_consequences FROM world_events WHERE id = :id`, { id });
    const automation = asJson(row.canon_consequences)?.automation || {};
    return {
      deal_type: row.deal_type,
      source: automation.auto_drafted?.deal_type ?? null,
      drafted: automation.drafted_values?.deal_type ?? null,
    };
  }

  it('an invite is drafted invited_comped by the rule, and the draft is recorded', async () => {
    const show = await newShow();
    const res = await create(show, { name: 'Maison Rue Soirée', event_type: 'invite' });
    expect(res.status).toBe(201);
    expect(res.body.event.deal_type).toBe('invited_comped');
    expect(await stored(res.body.event.id)).toEqual({ deal_type: 'invited_comped', source: 'rule', drafted: 'invited_comped' });
  });

  it('any other event type is drafted self_funded', async () => {
    const show = await newShow();
    const res = await create(show, { name: 'Fail Test Night', event_type: 'fail_test' });
    expect(res.status).toBe(201);
    expect(await stored(res.body.event.id)).toMatchObject({ deal_type: 'self_funded', source: 'rule' });
  });

  it('a brand plus a brand-owed deliverable re-drafts to brand_partnership while still Auto-drafted', async () => {
    const show = await newShow();
    const { body } = await create(show, { name: 'Velour Launch', event_type: 'invite', host_brand: 'Velour' });
    const id = body.event.id;
    expect((await stored(id)).deal_type).toBe('invited_comped');

    // A host-owed deliverable does not count.
    expect((await addDeliverable(show, id, { description: 'Arrive by eight', owed_to: 'host' })).status).toBe(201);
    expect((await stored(id)).deal_type).toBe('invited_comped');

    expect((await addDeliverable(show, id, { description: 'One reel in the coat', owed_to: 'brand' })).status).toBe(201);
    expect(await stored(id)).toEqual({ deal_type: 'brand_partnership', source: 'rule', drafted: 'brand_partnership' });

    // Clearing the brand through the PUT re-drafts it back.
    expect((await put(show, id, { host_brand: null })).status).toBe(200);
    expect((await stored(id)).deal_type).toBe('invited_comped');
  });

  it('Evoni\'s edit makes it Edited, and the rule no longer moves it', async () => {
    const show = await newShow();
    const { body } = await create(show, { name: 'Gallery Night', event_type: 'invite', host_brand: 'Aurum' });
    const id = body.event.id;

    const edited = await put(show, id, { deal_type: 'paid_appearance' });
    expect(edited.status).toBe(200);
    expect(edited.body.event.deal_type).toBe('paid_appearance');

    // A brand-owed deliverable would draft brand_partnership, but the value is Edited.
    await addDeliverable(show, id, { description: 'Two stories', owed_to: 'brand' });
    expect(await stored(id)).toEqual({ deal_type: 'paid_appearance', source: 'rule', drafted: 'invited_comped' });
  });

  it('an unknown deal type is refused with 400', async () => {
    const show = await newShow();
    const { body } = await create(show, { name: 'Brunch', event_type: 'guest' });
    const res = await put(show, body.event.id, { deal_type: 'sponsorship' });
    expect(res.status).toBe(400);
    expect((await stored(body.event.id)).deal_type).toBe('invited_comped');
  });

  it('once the terms lock, a changed deal type is refused and the draft stays put', async () => {
    const show = await newShow();
    const { body } = await create(show, { name: 'Locked Gala', event_type: 'invite', host_brand: 'Velour' });
    const id = body.event.id;
    const ep = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Episode 1', 1, 'draft', NOW(), NOW())`, { ep, show });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, event_id, status, created_at, updated_at)
               VALUES (:brief, :ep, :show, :id, 'draft', NOW(), NOW())`, { brief: uuid(), ep, show, id });

    const res = await put(show, id, { deal_type: 'paid_appearance' });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'EVENT_TERMS_LOCKED', fields: ['deal_type'] });

    // The same value is not a change, so a full-form save still works.
    expect((await put(show, id, { deal_type: 'invited_comped', name: 'Locked Gala' })).status).toBe(200);

    // A brand change on the locked event does not re-draft it.
    expect((await put(show, id, { host_brand: 'Other' })).status).toBe(200);
    expect((await stored(id)).deal_type).toBe('invited_comped');
  });

  it('an event with no recorded draft (created before this PR) is never backfilled', async () => {
    const show = await newShow();
    const id = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, host_brand, status, created_at, updated_at)
               VALUES (:id, :show, 'Legacy Gala', 'invite', 'Velour', 'ready', NOW(), NOW())`, { id, show });
    await addDeliverable(show, id, { description: 'A reel', owed_to: 'brand' });
    await put(show, id, { event_type: 'guest' });
    expect(await stored(id)).toEqual({ deal_type: null, source: null, drafted: null });
  });

  it('an opportunity\'s type maps to the deal type, with source opportunity (QUESTION 9)', async () => {
    const show = await newShow();
    const cases = [['modeling', 'paid_appearance'], ['brand_deal', 'appearance_plus_deliverables'], ['pr_gifting', 'gifted']];
    for (const [opportunityType, expected] of cases) {
      const opp = await models.Opportunity.create({ show_id: show, name: `${opportunityType} offer`, opportunity_type: opportunityType });
      const result = await convertOpportunityToEvent(opp.id, show, models);
      expect(result.event.deal_type).toBe(expected);
      expect(await stored(result.event.id)).toEqual({ deal_type: expected, source: 'opportunity', drafted: expected });
    }
  });
});
