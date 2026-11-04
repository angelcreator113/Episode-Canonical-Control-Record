/**
 * Start Episode's explicit offer decision (services/startOfferDecision;
 * Evoni's ruling: "Add an explicit offer decision before starting an
 * episode, but do not force acceptance. Preserve legitimate decline and
 * negotiation paths.").
 *
 * Scheduling an opportunity as an event never accepts it, so an event can
 * reach Start Episode with its opportunity still open. Start then asks
 * (409 OFFER_DECISION_REQUIRED) and applies the chosen decision in the
 * same transaction as the episode. An event with no opportunity, or an
 * accepted one, starts as before.
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
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('Start Episode: an explicit offer decision', () => {
  const show = uuid();
  const TAG = `offer-decision-${show.slice(0, 8)}`;
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  const makeEvent = async (name, opportunityId = null) => {
    const id = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, opportunity_id, created_at, updated_at)
               VALUES (:id, :show, :name, 'invite', 'ready', 5, :opportunityId, NOW(), NOW())`,
    { id, show, name: `${name} ${TAG}`, opportunityId });
    return id;
  };
  const makeOpp = async (name, status, { eventId = null } = {}) => {
    const id = uuid();
    await run(`INSERT INTO opportunities (id, show_id, name, opportunity_type, status, status_history, payment_amount, event_id, created_at, updated_at)
               VALUES (:id, :show, :name, 'campaign', :status, CAST(:history AS jsonb), 1200, :eventId, NOW(), NOW())`,
    { id, show, name: `${name} ${TAG}`, status, eventId, history: JSON.stringify([{ status, date: new Date().toISOString(), note: 'seeded' }]) });
    return id;
  };
  // An event scheduled from an opportunity: linked both ways, as
  // scheduleOpportunityAsEvent writes it.
  const scheduled = async (name, status) => {
    const opp = await makeOpp(name, status);
    const event = await makeEvent(name, opp);
    await run('UPDATE opportunities SET event_id = :event WHERE id = :opp', { event, opp });
    return { opp, event };
  };
  const start = (event, body = {}) =>
    auth(request(app).post(`/api/v1/world/${show}/events/${event}/generate-episode`)).send({ draft_script: false, ...body });
  const oppRow = async (id) => (await rows('SELECT status, status_history, booking_date, event_id FROM opportunities WHERE id = :id', { id }))[0];
  const episodesOf = (event) => rows('SELECT id FROM episode_briefs WHERE event_id = :event AND deleted_at IS NULL', { event });

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-offer-decision', email: 'user@offer-decision.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :name, :slug, NOW(), NOW())`,
      { id: show, name: `OD ${show.slice(0, 8)}`, slug: `od-${show.slice(0, 8)}` });
    await models.CharacterState.create({ show_id: show, character_key: 'lala', coins: 1000, reputation: 3 });
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    const shows = [show];
    const q = (sql) => sequelize.query(sql, { replacements: { shows } });
    await q('DELETE FROM scene_plans WHERE episode_id IN (SELECT id FROM episodes WHERE show_id IN (:shows))').catch(() => {});
    await q('DELETE FROM scene_set_episodes WHERE episode_id IN (SELECT id FROM episodes WHERE show_id IN (:shows))').catch(() => {});
    for (const t of ['episode_spending_lines', 'episode_briefs', 'episode_todo_lists']) {
      await q(`DELETE FROM ${t} WHERE episode_id IN (SELECT id FROM episodes WHERE show_id IN (:shows))`).catch(() => {});
    }
    for (const t of ['feed_posts', 'financial_transactions', 'character_state_history', 'character_state']) {
      await q(`DELETE FROM ${t} WHERE show_id IN (:shows)`).catch(() => {});
    }
    await q('UPDATE world_events SET used_in_episode_id = NULL WHERE show_id IN (:shows)');
    await q('UPDATE opportunities SET event_id = NULL WHERE show_id IN (:shows)');
    await q('DELETE FROM episodes WHERE show_id IN (:shows)');
    await q('DELETE FROM world_events WHERE show_id IN (:shows)');
    await q('DELETE FROM opportunities WHERE show_id IN (:shows)');
    await q('DELETE FROM shows WHERE id IN (:shows)');
    await sequelize.close();
  });

  it('an event with no opportunity starts as before, no decision asked', async () => {
    const event = await makeEvent('Plain gala');
    const res = await start(event);
    expect(res.status).toBe(201);
    expect(res.body.data.offerDecisions).toEqual([]);
  });

  it('an open offer and no decision: 409 OFFER_DECISION_REQUIRED with the offer, nothing created or changed', async () => {
    const { opp, event } = await scheduled('Spring Capsule', 'offered');
    const res = await start(event);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      success: false,
      code: 'OFFER_DECISION_REQUIRED',
      decisions: ['accept', 'negotiate', 'decline', 'proceed_unaccepted'],
      opportunity: { id: opp, name: `Spring Capsule ${TAG}`, status: 'offered', payment_amount: 1200 },
    });
    expect(await episodesOf(event)).toHaveLength(0);
    const row = await oppRow(opp);
    expect(row.status).toBe('offered');
    expect(row.status_history).toHaveLength(1);
  });

  it('linked only by opportunities.event_id it is asked about too', async () => {
    const event = await makeEvent('Back-linked');
    const opp = await makeOpp('Back-linked', 'considering', { eventId: event });
    const res = await start(event);
    expect(res.status).toBe(409);
    expect(res.body.opportunity).toMatchObject({ id: opp, status: 'considering' });
  });

  it('accept: walked to booked through STATUS_FLOW\'s steps, each in the history with the episode and event', async () => {
    const { opp, event } = await scheduled('Accept me', 'offered');
    const res = await start(event, { offer_decision: 'accept' });
    expect(res.status).toBe(201);
    const episodeId = res.body.data.episode.id;
    expect(res.body.data.offerDecisions).toEqual([{ id: opp, name: `Accept me ${TAG}`, decision: 'accept', from: 'offered', to: 'booked' }]);
    const row = await oppRow(opp);
    expect(row.status).toBe('booked');
    expect(row.booking_date).toBeTruthy();
    const steps = row.status_history.slice(1);
    expect(steps.map((h) => [h.from, h.status])).toEqual([['offered', 'considering'], ['considering', 'negotiating'], ['negotiating', 'booked']]);
    for (const h of steps) expect(h).toMatchObject({ decision: 'accept', event_id: event, episode_id: episodeId });
  });

  it('negotiate: walked to negotiating; one already negotiating stays there with a note', async () => {
    const a = await scheduled('Negotiate offered', 'offered');
    const resA = await start(a.event, { offer_decision: 'negotiate' });
    expect(resA.status).toBe(201);
    const rowA = await oppRow(a.opp);
    expect(rowA.status).toBe('negotiating');
    expect(rowA.status_history.slice(1).map((h) => h.status)).toEqual(['considering', 'negotiating']);

    const b = await scheduled('Negotiate negotiating', 'negotiating');
    const resB = await start(b.event, { offer_decision: 'negotiate' });
    expect(resB.status).toBe(201);
    const rowB = await oppRow(b.opp);
    expect(rowB.status).toBe('negotiating');
    expect(rowB.status_history[rowB.status_history.length - 1]).toMatchObject({
      status: 'negotiating', from: 'negotiating', decision: 'negotiate', event_id: b.event, episode_id: resB.body.data.episode.id,
    });
  });

  it('decline: declined in one legal step, and the episode still starts without the deal', async () => {
    const { opp, event } = await scheduled('Decline me', 'negotiating');
    const res = await start(event, { offer_decision: 'decline' });
    expect(res.status).toBe(201);
    expect(await episodesOf(event)).toHaveLength(1);
    const row = await oppRow(opp);
    expect(row.status).toBe('declined');
    expect(row.status_history[row.status_history.length - 1]).toMatchObject({ status: 'declined', from: 'negotiating', decision: 'decline', event_id: event });
  });

  it('proceed_unaccepted: the status is not changed; a history note records the start', async () => {
    const { opp, event } = await scheduled('Not yet', 'considering');
    const res = await start(event, { offer_decision: 'proceed_unaccepted' });
    expect(res.status).toBe(201);
    const row = await oppRow(opp);
    expect(row.status).toBe('considering');
    expect(row.booking_date).toBeNull();
    expect(row.status_history[row.status_history.length - 1]).toMatchObject({
      status: 'considering', from: 'considering', decision: 'proceed_unaccepted',
      note: 'Episode started without accepting the offer; status unchanged',
      event_id: event, episode_id: res.body.data.episode.id,
    });
  });

  it('an unknown decision is a 400, nothing created', async () => {
    const { event } = await scheduled('Odd decision', 'offered');
    const res = await start(event, { offer_decision: 'book_it' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('OFFER_DECISION_INVALID');
    expect(await episodesOf(event)).toHaveLength(0);
  });

  it('a move STATUS_FLOW has no step for (held → booked) is a 409 OFFER_DECISION_ILLEGAL; proceed_unaccepted still starts', async () => {
    const { opp, event } = await scheduled('Held one', 'held');
    const res = await start(event, { offer_decision: 'accept' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('OFFER_DECISION_ILLEGAL');
    expect(await episodesOf(event)).toHaveLength(0);
    expect((await oppRow(opp)).status).toBe('held');

    const ok = await start(event, { offer_decision: 'proceed_unaccepted' });
    expect(ok.status).toBe(201);
    expect((await oppRow(opp)).status).toBe('held');
  });

  it('an accepted (booked) or closed (declined) offer is not asked about and is not changed', async () => {
    for (const status of ['booked', 'declined']) {
      const { opp, event } = await scheduled(`Settled ${status}`, status);
      const res = await start(event);
      expect(res.status).toBe(201);
      expect(res.body.data.offerDecisions).toEqual([]);
      const row = await oppRow(opp);
      expect(row.status).toBe(status);
      expect(row.status_history).toHaveLength(1);
    }
  });

  it('generate-episode-from-many asks for the anchor\'s decision the same way', async () => {
    const { opp, event } = await scheduled('Anchor offer', 'offered');
    const url = `/api/v1/world/${show}/events/generate-episode-from-many`;
    const refused = await auth(request(app).post(url)).send({ event_ids: [event] });
    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({ code: 'OFFER_DECISION_REQUIRED', opportunity: { id: opp } });
    const ok = await auth(request(app).post(url)).send({ event_ids: [event], offer_decision: 'decline' });
    expect(ok.status).toBe(201);
    expect((await oppRow(opp)).status).toBe('declined');
  });
});
