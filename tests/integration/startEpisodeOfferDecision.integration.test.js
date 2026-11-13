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
 *
 * A1 (Evoni, 2026-11-13): a decision is an admin's, names the offers it is
 * about, needs a reason to decline or to start without accepting, and is
 * recorded with who and why in the offer's history and in one activity_logs
 * entry per offer, in the same commit as the episode.
 */
jest.unmock('uuid');

// Start Episode is an AI route (aiRateLimiter: 30 calls in five minutes per
// address by default); this file starts more episodes than that.
process.env.AI_RATE_LIMIT_PER_IP = '100000';

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
  let adminToken;
  const ADMIN_ID = 'test-admin-offer-decision';
  // Each test asks from its own address, so the app's per-address limits
  // (writes a minute, AI calls in five) count each test apart.
  let ip = 0;
  const from = (r) => r.set('X-Forwarded-For', `10.78.${ip}.1`);
  const auth = (r) => from(r).set('Authorization', `Bearer ${token}`);
  const asAdmin = (r) => from(r).set('Authorization', `Bearer ${adminToken}`);

  const makeEvent = async (name, opportunityId = null) => {
    const id = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, opportunity_id, created_at, updated_at)
               VALUES (:id, :show, :name, 'invite', 'ready', 5, :opportunityId, NOW(), NOW())`,
    { id, show, name: `${name} ${TAG}`, opportunityId });
    return id;
  };
  const makeOpp = async (name, status, { eventId = null, payment = 1200, brand = null, paymentType = null } = {}) => {
    const id = uuid();
    await run(`INSERT INTO opportunities (id, show_id, name, opportunity_type, status, status_history, payment_amount, payment_type, brand_or_company, event_id, created_at, updated_at)
               VALUES (:id, :show, :name, 'campaign', :status, CAST(:history AS jsonb), :payment, :paymentType, :brand, :eventId, NOW(), NOW())`,
    { id, show, name: `${name} ${TAG}`, status, eventId, payment, brand, paymentType, history: JSON.stringify([{ status, date: new Date().toISOString(), note: 'seeded' }]) });
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
  // An admin's decision about these offers, with a reason (A1).
  const decide = (event, opps, decision, body = {}) =>
    asAdmin(request(app).post(`/api/v1/world/${show}/events/${event}/generate-episode`)).send({
      draft_script: false, offer_decision: decision, offer_decision_opportunity_ids: opps, offer_decision_reason: 'Recorded for the test', ...body,
    });
  const auditOf = (id) => rows(`SELECT user_id, action, resource_type, resource_id, changes FROM activity_logs
                                 WHERE resource_type = 'opportunity' AND resource_id = :id ORDER BY id`, { id });
  const oppRow = async (id) => (await rows('SELECT status, status_history, booking_date, event_id FROM opportunities WHERE id = :id', { id }))[0];
  const episodesOf = (event) => rows('SELECT id FROM episode_briefs WHERE event_id = :event AND deleted_at IS NULL', { event });

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-offer-decision', email: 'user@offer-decision.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    adminToken = TokenService.generateTokenPair({
      id: ADMIN_ID, email: 'admin@offer-decision.dev', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN',
    }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :name, :slug, NOW(), NOW())`,
      { id: show, name: `OD ${show.slice(0, 8)}`, slug: `od-${show.slice(0, 8)}` });
    await models.CharacterState.create({ show_id: show, character_key: 'lala', coins: 1000, reputation: 3 });
  });
  beforeEach(() => {
    ip += 1;
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
    await q(`DELETE FROM activity_logs WHERE resource_type = 'opportunity' AND resource_id IN (SELECT id::text FROM opportunities WHERE show_id IN (:shows))`).catch(() => {});
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
    // Asked by an admin: the offer with its payment, as before.
    const res = await asAdmin(request(app).post(`/api/v1/world/${show}/events/${event}/generate-episode`)).send({ draft_script: false });
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
    const res = await decide(event, [opp], 'accept');
    expect(res.status).toBe(201);
    const episodeId = res.body.data.episode.id;
    expect(res.body.data.offerDecisions).toEqual([{ id: opp, name: `Accept me ${TAG}`, decision: 'accept', from: 'offered', to: 'booked' }]);
    const row = await oppRow(opp);
    expect(row.status).toBe('booked');
    expect(row.booking_date).toBeTruthy();
    const steps = row.status_history.slice(1);
    expect(steps.map((h) => [h.from, h.status])).toEqual([['offered', 'considering'], ['considering', 'negotiating'], ['negotiating', 'booked']]);
    for (const h of steps) expect(h).toMatchObject({ decision: 'accept', event_id: event, episode_id: episodeId });
    // One decision: every entry says what was decided, and the stages only
    // passed on the way say so (review of 2026-11-13). Booked, the status
    // reached, is not one of them.
    for (const h of steps) expect(h.decided).toEqual({ from: 'offered', to: 'booked' });
    expect(steps.map((h) => h.passed_through === true)).toEqual([true, true, false]);
    expect(steps[2]).not.toHaveProperty('passed_through');
  });

  it('negotiate: walked to negotiating; one already negotiating stays there with a note', async () => {
    const a = await scheduled('Negotiate offered', 'offered');
    const resA = await decide(a.event, [a.opp], 'negotiate');
    expect(resA.status).toBe(201);
    const rowA = await oppRow(a.opp);
    expect(rowA.status).toBe('negotiating');
    expect(rowA.status_history.slice(1).map((h) => h.status)).toEqual(['considering', 'negotiating']);

    const b = await scheduled('Negotiate negotiating', 'negotiating');
    const resB = await decide(b.event, [b.opp], 'negotiate');
    expect(resB.status).toBe(201);
    const rowB = await oppRow(b.opp);
    expect(rowB.status).toBe('negotiating');
    expect(rowB.status_history[rowB.status_history.length - 1]).toMatchObject({
      status: 'negotiating', from: 'negotiating', decision: 'negotiate', event_id: b.event, episode_id: resB.body.data.episode.id,
    });
  });

  it('decline: declined in one legal step, and the episode still starts without the deal', async () => {
    const { opp, event } = await scheduled('Decline me', 'negotiating');
    const res = await decide(event, [opp], 'decline');
    expect(res.status).toBe(201);
    expect(await episodesOf(event)).toHaveLength(1);
    const row = await oppRow(opp);
    expect(row.status).toBe('declined');
    expect(row.status_history[row.status_history.length - 1]).toMatchObject({ status: 'declined', from: 'negotiating', decision: 'decline', event_id: event });
  });

  it('proceed_unaccepted: the status is not changed; a history note records the start', async () => {
    const { opp, event } = await scheduled('Not yet', 'considering');
    const res = await decide(event, [opp], 'proceed_unaccepted');
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
    const res = await decide(event, [opp], 'accept');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('OFFER_DECISION_ILLEGAL');
    expect(await episodesOf(event)).toHaveLength(0);
    expect((await oppRow(opp)).status).toBe('held');

    const ok = await decide(event, [opp], 'proceed_unaccepted');
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
    const ok = await asAdmin(request(app).post(url)).send({
      event_ids: [event], offer_decision: 'decline', offer_decision_opportunity_ids: [opp], offer_decision_reason: 'The fee is too low',
    });
    expect(ok.status).toBe(201);
    expect((await oppRow(opp)).status).toBe('declined');
    expect(await auditOf(opp)).toHaveLength(1);
  });

  // ── A1 (Evoni, 2026-11-13): who, why, which offers ──

  it('a decision is an admin\'s: anyone else is refused 403 and nothing is started, changed or recorded', async () => {
    const { opp, event } = await scheduled('Admin only', 'offered');
    for (const decision of ['accept', 'negotiate', 'decline', 'proceed_unaccepted']) {
      const res = await start(event, { offer_decision: decision, offer_decision_opportunity_ids: [opp], offer_decision_reason: 'Trying' });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('OFFER_DECISION_FORBIDDEN');
    }
    expect(await episodesOf(event)).toHaveLength(0);
    const row = await oppRow(opp);
    expect(row.status).toBe('offered');
    expect(row.status_history).toHaveLength(1);
    expect(await auditOf(opp)).toHaveLength(0);
  });

  it('decline and proceed_unaccepted need a reason; accept and negotiate do not', async () => {
    for (const decision of ['decline', 'proceed_unaccepted']) {
      const { opp, event } = await scheduled(`Needs why ${decision}`, 'offered');
      for (const reason of [undefined, '', '   ']) {
        const res = await decide(event, [opp], decision, { offer_decision_reason: reason });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('OFFER_REASON_REQUIRED');
      }
      expect(await episodesOf(event)).toHaveLength(0);
      expect((await oppRow(opp)).status_history).toHaveLength(1);
      expect(await auditOf(opp)).toHaveLength(0);
    }
    for (const decision of ['accept', 'negotiate']) {
      const { opp, event } = await scheduled(`No why ${decision}`, 'offered');
      const res = await decide(event, [opp], decision, { offer_decision_reason: undefined });
      expect(res.status).toBe(201);
      const entries = await auditOf(opp);
      expect(entries).toHaveLength(1);
      expect(entries[0].changes.meta.reason).toBeNull();
    }
    const long = await scheduled('Too long a why', 'offered');
    const res = await decide(long.event, [long.opp], 'decline', { offer_decision_reason: 'x'.repeat(501) });
    expect(res.status).toBe(400);
    expect(await episodesOf(long.event)).toHaveLength(0);
  });

  it('a decision names the offers it is about: other offers, or none named, are refused 409 OFFER_DECISION_STALE', async () => {
    const { opp, event } = await scheduled('Named offer', 'offered');
    const other = await makeOpp('Arrived later', 'offered', { eventId: event });
    for (const ids of [undefined, [], [opp], [opp, uuid()], 'all']) {
      const res = await decide(event, ids, 'accept');
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('OFFER_DECISION_STALE');
      expect(res.body.opportunities.map((o) => o.id).sort()).toEqual([opp, other].sort());
    }
    expect(await episodesOf(event)).toHaveLength(0);
    for (const id of [opp, other]) {
      expect((await oppRow(id)).status).toBe('offered');
      expect(await auditOf(id)).toHaveLength(0);
    }
    const ok = await decide(event, [other, opp], 'accept');
    expect(ok.status).toBe(201);
    for (const id of [opp, other]) {
      expect((await oppRow(id)).status).toBe('booked');
      expect(await auditOf(id)).toHaveLength(1);
    }
  });

  it('each decision is recorded once: who, from, to, when, route, reason, event and episode; and nothing about the money', async () => {
    const { opp, event } = await scheduled('Recorded', 'offered');
    const res = await decide(event, [opp], 'decline', { offer_decision_reason: '  The brand changed the brief  ' });
    expect(res.status).toBe(201);
    const episodeId = res.body.data.episode.id;
    // The answer says what was decided, never why.
    expect(res.body.data.offerDecisions).toEqual([{ id: opp, name: `Recorded ${TAG}`, decision: 'decline', from: 'offered', to: 'declined' }]);
    expect(JSON.stringify(res.body)).not.toContain('The brand changed the brief');

    const last = (await oppRow(opp)).status_history.slice(-1)[0];
    expect(last).toMatchObject({
      status: 'declined', from: 'offered', decision: 'decline', event_id: event, episode_id: episodeId,
      by: { id: ADMIN_ID }, reason: 'The brand changed the brief', route: 'start_decision',
    });
    expect(Number.isNaN(Date.parse(last.date))).toBe(false);

    const entries = await auditOf(opp);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ user_id: ADMIN_ID, action: 'opportunity_status', resource_type: 'opportunity', resource_id: opp });
    expect(entries[0].changes).toEqual({ meta: {
      route: 'start_decision', from_status: 'offered', to_status: 'declined', decision: 'decline',
      reason: 'The brand changed the brief', show_id: show, event_id: event, episode_id: episodeId,
    } });
    expect(JSON.stringify(entries[0].changes)).not.toMatch(/1200|payment/);
  });

  it('accept walks three steps and is still one entry, from where it was to booked', async () => {
    const { opp, event } = await scheduled('One entry', 'offered');
    expect((await decide(event, [opp], 'accept')).status).toBe(201);
    const entries = await auditOf(opp);
    expect(entries).toHaveLength(1);
    expect(entries[0].changes.meta).toMatchObject({ from_status: 'offered', to_status: 'booked', decision: 'accept', passed_through: ['considering', 'negotiating'] });
    for (const h of (await oppRow(opp)).status_history.slice(1)) expect(h).toMatchObject({ by: { id: ADMIN_ID }, route: 'start_decision' });
  });

  it('a decision of one step, or of none, is not marked as a walk', async () => {
    const one = await scheduled('One step', 'negotiating');
    expect((await decide(one.event, [one.opp], 'accept')).status).toBe(201);
    const last = (await oppRow(one.opp)).status_history.slice(-1)[0];
    expect(last).toMatchObject({ status: 'booked', from: 'negotiating' });
    expect(last).not.toHaveProperty('decided');
    expect(last).not.toHaveProperty('passed_through');
    expect((await auditOf(one.opp))[0].changes.meta).not.toHaveProperty('passed_through');

    const two = await scheduled('Two steps', 'considering');
    expect((await decide(two.event, [two.opp], 'accept')).status).toBe(201);
    const steps = (await oppRow(two.opp)).status_history.slice(1);
    expect(steps.map((h) => [h.status, h.passed_through === true])).toEqual([['negotiating', true], ['booked', false]]);
    expect((await auditOf(two.opp))[0].changes.meta.passed_through).toEqual(['negotiating']);

    const none = await scheduled('No step', 'offered');
    expect((await decide(none.event, [none.opp], 'proceed_unaccepted')).status).toBe(201);
    const noted = (await oppRow(none.opp)).status_history.slice(-1)[0];
    expect(noted).not.toHaveProperty('decided');
    expect(noted).not.toHaveProperty('passed_through');
  });

  it('Undo after an accepted walk still goes back one status at a time', async () => {
    const { opp, event } = await scheduled('Walk then undo', 'offered');
    expect((await decide(event, [opp], 'accept')).status).toBe(201);
    const undo = await asAdmin(request(app).post(`/api/v1/opportunities/${show}/${opp}/undo`)).send({ from_status: 'booked', reason: 'Not signed after all' });
    expect(undo.status).toBe(200);
    expect(undo.body.undone).toEqual({ from: 'booked', to: 'negotiating' });
  });

  it('the question says whether the person asking can answer it', async () => {
    const { opp, event } = await scheduled('Who can answer', 'offered');
    const editor = await start(event);
    expect(editor.status).toBe(409);
    expect(editor.body).toMatchObject({ code: 'OFFER_DECISION_REQUIRED', can_decide: false, opportunity: { id: opp } });
    expect(editor.body.error).toMatch(/An admin decides/);
    const admin = await asAdmin(request(app).post(`/api/v1/world/${show}/events/${event}/generate-episode`)).send({ draft_script: false });
    expect(admin.status).toBe(409);
    expect(admin.body).toMatchObject({ code: 'OFFER_DECISION_REQUIRED', can_decide: true });
    expect(await episodesOf(event)).toHaveLength(0);
  });

  it('the entry that cannot be written takes the decision and the episode with it', async () => {
    const { opp, event } = await scheduled('No entry, no decision', 'offered');
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const spy = jest.spyOn(models.ActivityLog, 'logActivity').mockRejectedValueOnce(new Error('the audit trail is down'));
    const res = await decide(event, [opp], 'accept');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(await episodesOf(event)).toHaveLength(0);
    const row = await oppRow(opp);
    expect(row.status).toBe('offered');
    expect(row.status_history).toHaveLength(1);
    expect(await auditOf(opp)).toHaveLength(0);
  });

  it('the same Start sent again decides nothing again: its episode, no new history, no second entry', async () => {
    const { opp, event } = await scheduled('Replayed', 'offered');
    const key = uuid();
    const send = () => decide(event, [opp], 'decline').set('Idempotency-Key', key);
    const first = await send();
    expect(first.status).toBe(201);
    const before = await oppRow(opp);
    const again = await send();
    expect(again.status).toBe(200);
    expect(again.body.replayed).toBe(true);
    expect(again.body.data.episode.id).toBe(first.body.data.episode.id);
    expect(again.body.data.offerDecisions).toEqual([]);
    expect((await oppRow(opp)).status_history).toEqual(before.status_history);
    expect(await auditOf(opp)).toHaveLength(1);
    expect(await episodesOf(event)).toHaveLength(1);
  });

  it('two Starts at once with the same decision: one episode, one decision, one entry', async () => {
    const { opp, event } = await scheduled('At once', 'offered');
    const results = await Promise.all([decide(event, [opp], 'accept'), decide(event, [opp], 'accept')]);
    expect(results.map((r) => r.status).filter((c) => c === 201)).toHaveLength(1);
    expect(await episodesOf(event)).toHaveLength(1);
    expect((await oppRow(opp)).status_history.slice(1).map((h) => h.status)).toEqual(['considering', 'negotiating', 'booked']);
    expect(await auditOf(opp)).toHaveLength(1);
  });

  // ── Security review of 2026-11-13: the deal's terms never go to someone who cannot decide ──
  describe('what each Start route sends about the offer', () => {
    // An amount, a type and a brand that appear nowhere else in an answer.
    const TERMS = { payment: 987654, paymentType: 'usage_buyout_zq', brand: 'Maison Zephyrine' };
    const SECRET = /987654|usage_buyout_zq|Maison Zephyrine|payment_amount|payment_type/;
    const withTerms = async (name, status) => {
      const opp = await makeOpp(name, status, TERMS);
      const event = await makeEvent(name, opp);
      await run('UPDATE opportunities SET event_id = :event WHERE id = :opp', { event, opp });
      return { opp, event };
    };
    const ROUTES = [
      ['generate-episode', (as, event, body = {}) => as(request(app).post(`/api/v1/world/${show}/events/${event}/generate-episode`)).send({ draft_script: false, ...body })],
      ['generate-episode-from-many', (as, event, body = {}) => as(request(app).post(`/api/v1/world/${show}/events/generate-episode-from-many`)).send({ event_ids: [event], ...body })],
    ];

    describe.each(ROUTES)('%s', (route, call) => {
      it('the question, to someone who is not an admin: which offer waits, and nothing of its terms', async () => {
        const { opp, event } = await withTerms(`Private terms ${route}`, 'negotiating');
        const res = await call(auth, event);
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('OFFER_DECISION_REQUIRED');
        expect(res.body.can_decide).toBe(false);
        const named = { id: opp, name: `Private terms ${route} ${TAG}`, status: 'negotiating' };
        expect(res.body.opportunity).toEqual(named);
        expect(res.body.opportunities).toEqual([named]);
        expect(JSON.stringify(res.body)).not.toMatch(SECRET);
        expect(await episodesOf(event)).toHaveLength(0);
      });

      it('a decision refused 403, to someone who is not an admin: nothing of its terms', async () => {
        const { opp, event } = await withTerms(`Refused terms ${route}`, 'offered');
        for (const decision of ['accept', 'negotiate', 'decline', 'proceed_unaccepted']) {
          const res = await call(auth, event, { offer_decision: decision, offer_decision_opportunity_ids: [opp], offer_decision_reason: 'Trying' });
          expect(res.status).toBe(403);
          expect(res.body.code).toBe('OFFER_DECISION_FORBIDDEN');
          expect(res.body.opportunities).toEqual([{ id: opp, name: `Refused terms ${route} ${TAG}`, status: 'offered' }]);
          expect(JSON.stringify(res.body)).not.toMatch(SECRET);
        }
        expect(await episodesOf(event)).toHaveLength(0);
        expect((await oppRow(opp)).status).toBe('offered');
      });

      it('an unknown decision from someone who is not an admin: nothing of its terms', async () => {
        const { event } = await withTerms(`Odd decision ${route}`, 'offered');
        const res = await call(auth, event, { offer_decision: 'book_it' });
        expect(res.status).toBe(400);
        expect(JSON.stringify(res.body)).not.toMatch(SECRET);
      });

      it('a start that needs no decision, by someone who is not an admin: it starts, and the answer holds nothing of the settled offer\'s terms', async () => {
        const { opp, event } = await withTerms(`Settled terms ${route}`, 'booked');
        const res = await call(auth, event);
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(await episodesOf(event)).toHaveLength(1);
        expect(JSON.stringify(res.body)).not.toMatch(/987654|usage_buyout_zq|Maison Zephyrine/);
        expect(JSON.stringify(res.body)).not.toContain(opp);
      });

      it('an admin still gets the offer with its terms: the question, a refusal, and what was decided', async () => {
        const { opp, event } = await withTerms(`Admin terms ${route}`, 'offered');
        const full = { id: opp, name: `Admin terms ${route} ${TAG}`, status: 'offered', brand: 'Maison Zephyrine', payment_amount: 987654, payment_type: 'usage_buyout_zq' };
        const asked = await call(asAdmin, event);
        expect(asked.status).toBe(409);
        expect(asked.body).toMatchObject({ code: 'OFFER_DECISION_REQUIRED', can_decide: true });
        expect(asked.body.opportunity).toEqual(full);
        expect(asked.body.opportunities).toEqual([full]);

        const noReason = await call(asAdmin, event, { offer_decision: 'decline', offer_decision_opportunity_ids: [opp] });
        expect(noReason.status).toBe(400);
        expect(noReason.body.code).toBe('OFFER_REASON_REQUIRED');
        expect(noReason.body.opportunity).toEqual(full);

        const stale = await call(asAdmin, event, { offer_decision: 'accept', offer_decision_opportunity_ids: [uuid()] });
        expect(stale.status).toBe(409);
        expect(stale.body.code).toBe('OFFER_DECISION_STALE');
        expect(stale.body.opportunity).toEqual(full);

        const ok = await call(asAdmin, event, { offer_decision: 'accept', offer_decision_opportunity_ids: [opp] });
        expect(ok.status).toBe(201);
        const decided = route === 'generate-episode' ? ok.body.data.offerDecisions : (ok.body.data.offerDecisions || ok.body.offer_decisions);
        expect(decided).toEqual([{ id: opp, name: `Admin terms ${route} ${TAG}`, decision: 'accept', from: 'offered', to: 'booked' }]);
      });
    });
  });
});
