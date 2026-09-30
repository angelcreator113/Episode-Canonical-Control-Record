/**
 * Reopen terms (Evoni's Reopen terms ruling, docs/EVENT_EPISODE_FLOW.md
 * §8(cc), 2026-09-30; Task #2378): reopen a started event's terms while its
 * episode is a draft with no ledger rows but wardrobe purchases and every
 * deliverable pending; edit a locked field; Save and relock rebuilds the
 * brief's terms snapshot, deliverable stamping, deliverable tasks, the
 * estimated money and the affordability warning, and records both steps in
 * the event's history.
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

(shouldSkip ? describe.skip : describe)('reopen terms (§8(cc) Reopen ruling)', () => {
  let adminToken;
  let userToken;
  const shows = [];

  beforeAll(() => {
    adminToken = TokenService.generateTokenPair({
      id: 'test-admin-terms-reopen', email: 'admin@terms-reopen.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN',
    }).accessToken;
    userToken = TokenService.generateTokenPair({
      id: 'test-user-terms-reopen', email: 'user@terms-reopen.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });

  afterAll(async () => {
    for (const show of shows) {
      const eps = '(SELECT id FROM episodes WHERE show_id = :show)';
      await run(`DELETE FROM financial_transactions WHERE show_id = :show`, { show });
      await run(`DELETE FROM episode_todo_lists WHERE episode_id IN ${eps}`, { show });
      await run(`DELETE FROM episode_briefs WHERE show_id = :show`, { show });
      await run(`DELETE FROM event_deliverables WHERE event_id IN (SELECT id FROM world_events WHERE show_id = :show)`, { show });
      await run(`DELETE FROM world_events WHERE show_id = :show`, { show });
      await run(`DELETE FROM episodes WHERE show_id = :show`, { show });
      await run(`DELETE FROM shows WHERE id = :show`, { show });
    }
  });

  // A started legacy event (paid 200), its draft episode, the brief that
  // names it (snapshot of the old terms), a todo list with one generated
  // task and the deliverable's task, and one pending deliverable.
  async function seed() {
    const ids = { show: uuid(), ep: uuid(), event: uuid(), brief: uuid(), todo: uuid(), deliv: uuid() };
    shows.push(ids.show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { ...ids, name: `Reopen show ${ids.show.slice(0, 8)}`, slug: `reopen-${ids.show.slice(0, 8)}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, total_income, total_expenses, created_at, updated_at)
               VALUES (:ep, :show, 'Gala Night', 1, 'draft', 200, 0, NOW(), NOW())`, ids);
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, used_in_episode_id, is_paid, payment_amount,
                 cost_coins, requirements, restrictions, canon_consequences, created_at, updated_at)
               VALUES (:event, :show, 'Velvet Gala', 'invite', 'used', :ep, true, 200, 0, '{}'::jsonb, '[]'::jsonb,
                 '{"automation":{"kept":"yes"}}'::jsonb, NOW(), NOW())`, ids);
    await run(`INSERT INTO event_deliverables (id, event_id, description, required, owed_to, status, episode_id, created_at, updated_at)
               VALUES (:deliv, :event, 'One reel from the gala', true, 'host', 'pending', :ep, NOW(), NOW())`, ids);
    const oldTerms = {
      access_requirements: {}, restrictions: [], compensation: { is_paid: true, payment_amount: 200 },
      deliverables: [{ id: ids.deliv, description: 'One reel from the gala', status: 'pending' }],
    };
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, event_id, status, event_metadata, created_at, updated_at)
               VALUES (:brief, :ep, :show, :event, 'draft', CAST(:meta AS jsonb), NOW(), NOW())`,
      { ...ids, meta: JSON.stringify({ host_brand: 'Velvet', terms: oldTerms, affordability_warning: null }) });
    const tasks = [
      { slot: 'arrival', label: 'Arrive', required: false, task_source: 'goal', completed: true },
      { slot: `deliverable_${ids.deliv}`, label: 'One reel from the gala', deliverable_id: ids.deliv, owed_to: 'host',
        task_source: 'host_requirement', required: true, completed: false },
    ];
    await run(`INSERT INTO episode_todo_lists (id, episode_id, show_id, event_id, tasks, social_tasks, financial_summary, status, created_at, updated_at)
               VALUES (:todo, :ep, :show, :event, '[]'::jsonb, CAST(:tasks AS jsonb), '{"event_income":200}'::jsonb, 'generated', NOW(), NOW())`,
      { ...ids, tasks: JSON.stringify(tasks) });
    return ids;
  }

  const base = (ids) => `/api/v1/world/${ids.show}/events/${ids.event}`;
  const eligibility = (ids) => request(app).get(`${base(ids)}/terms/reopen-eligibility`).set('Authorization', `Bearer ${adminToken}`);
  const reopen = (ids, body = { confirm: true }, token = adminToken) =>
    request(app).post(`${base(ids)}/terms/reopen`).set('Authorization', `Bearer ${token}`).send(body);
  const relock = (ids) => request(app).post(`${base(ids)}/terms/relock`).set('Authorization', `Bearer ${adminToken}`).send({});
  const put = (ids, body) => request(app).put(base(ids)).set('Authorization', `Bearer ${adminToken}`).send(body);
  const eventRow = async (ids) => (await q('SELECT payment_amount, canon_consequences FROM world_events WHERE id = :event', ids))[0];

  it('reopen → edit a locked field → Save and relock rebuilds what Start Episode built', async () => {
    const ids = await seed();

    const before = await eligibility(ids);
    expect(before.status).toBe(200);
    expect(before.body).toMatchObject({ eligible: true, reasons: [], reopened: null });

    // Locked before the reopen.
    expect((await put(ids, { payment_amount: 900 })).status).toBe(409);

    const opened = await reopen(ids);
    expect(opened.status).toBe(200);
    expect(opened.body.reopened.by).toEqual({ id: 'test-admin-terms-reopen', name: 'Evoni' });

    // While reopened: the compensation and deliverables are editable; the
    // episode link is not; finalize and complete are refused.
    const edited = await put(ids, { payment_amount: 900, canon_consequences: { terms_reopen: null, terms_history: [] } });
    expect(edited.status).toBe(200);
    expect((await put(ids, { used_in_episode_id: null })).body.fields).toEqual(['used_in_episode_id']);
    const added = await request(app).post(`${base(ids)}/deliverables`).set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'Three stories at the door', required: true });
    expect(added.status).toBe(201);
    const newDeliv = added.body.deliverable?.id || added.body.data?.id;
    expect(newDeliv).toBeTruthy();

    const fin = await request(app).post(`/api/v1/world/${ids.show}/episodes/${ids.ep}/finalize-financials`).set('Authorization', `Bearer ${adminToken}`);
    expect(fin.status).toBe(409);
    expect(fin.body.code).toBe('EVENT_TERMS_REOPENED');
    const done = await request(app).post(`/api/v1/world/${ids.show}/episodes/${ids.ep}/complete`).set('Authorization', `Bearer ${adminToken}`);
    expect(done.status).toBe(409);
    expect(done.body.code).toBe('EVENT_TERMS_REOPENED');
    expect(await q('SELECT id FROM financial_transactions WHERE show_id = :show AND episode_id = :ep', ids)).toEqual([]);

    // The PUT above tried to clear the server-owned keys; they survived.
    const mid = await eventRow(ids);
    expect(mid.canon_consequences.terms_reopen).toBeTruthy();
    expect(mid.canon_consequences.terms_history).toHaveLength(1);

    const saved = await relock(ids);
    expect(saved.status).toBe(200);
    expect(saved.body.changed_fields).toEqual(['payment_amount', 'deliverables']);
    expect(saved.body.regenerate.invitation).toMatchObject({ offered: false, mentionsMoney: true });
    expect(saved.body.regenerate.script).toMatchObject({ offered: false, mentionsMoney: true });

    // Relocked, and both steps are in the event's history.
    expect((await put(ids, { payment_amount: 50 })).status).toBe(409);
    const after = await eventRow(ids);
    expect(Number(after.payment_amount)).toBe(900);
    expect(after.canon_consequences.terms_reopen).toBeUndefined();
    expect(after.canon_consequences.automation).toEqual({ kept: 'yes' });
    expect(after.canon_consequences.terms_history.map((h) => h.action)).toEqual(['terms_reopened', 'terms_relocked']);
    expect(after.canon_consequences.terms_history[1]).toMatchObject({ episode_id: ids.ep, fields: ['payment_amount', 'deliverables'] });

    // Brief: terms snapshot rebuilt; the rest of event_metadata kept.
    const [brief] = await q('SELECT event_metadata FROM episode_briefs WHERE id = :brief', ids);
    expect(brief.event_metadata.host_brand).toBe('Velvet');
    expect(brief.event_metadata.terms.compensation).toEqual({ is_paid: true, payment_amount: 900 });
    expect(brief.event_metadata.terms.deliverables.map((d) => d.id)).toEqual([ids.deliv, newDeliv]);
    expect(brief.event_metadata.affordability_warning).toBeNull();

    // Deliverable stamping.
    const stamped = await q('SELECT id, episode_id FROM event_deliverables WHERE event_id = :event AND deleted_at IS NULL', ids);
    expect(stamped.every((d) => d.episode_id === ids.ep)).toBe(true);

    // Deliverable tasks + estimated money.
    const [todo] = await q('SELECT social_tasks, financial_summary FROM episode_todo_lists WHERE id = :todo', ids);
    expect(todo.social_tasks.map((t) => t.deliverable_id || t.slot)).toEqual(['arrival', ids.deliv, newDeliv]);
    expect(todo.social_tasks[0].completed).toBe(true);
    expect(todo.financial_summary).toMatchObject({ event_income: 900, total_income: 900 });
    const [ep] = await q('SELECT total_income FROM episodes WHERE id = :ep', ids);
    expect(Number(ep.total_income)).toBe(900);
  });

  it('refuses without confirmation, for a non-admin, and a relock with nothing reopened', async () => {
    const ids = await seed();
    const noConfirm = await reopen(ids, {});
    expect(noConfirm.status).toBe(400);
    expect(noConfirm.body.code).toBe('TERMS_REOPEN_CONFIRM_REQUIRED');
    expect((await reopen(ids, { confirm: true }, userToken)).status).toBe(403);
    const nothing = await relock(ids);
    expect(nothing.status).toBe(409);
    expect(nothing.body.code).toBe('TERMS_NOT_REOPENED');
    expect((await eventRow(ids)).canon_consequences.terms_reopen).toBeUndefined();
  });

  it('a wardrobe purchase does not block; a finalize row, a non-draft episode and a moved deliverable do', async () => {
    const ids = await seed();
    await run(`INSERT INTO financial_transactions (id, show_id, episode_id, type, category, amount, status, metadata, created_at, updated_at)
               VALUES (:id, :show, :ep, 'expense', 'wardrobe_purchase', 40, 'executed', '{"flow":"purchase"}'::jsonb, NOW(), NOW())`,
      { ...ids, id: uuid() });
    expect((await eligibility(ids)).body.eligible).toBe(true);

    await run(`INSERT INTO financial_transactions (id, show_id, episode_id, type, category, amount, status, created_at, updated_at)
               VALUES (:id, :show, :ep, 'income', 'event_payment', 200, 'executed', NOW(), NOW())`, { ...ids, id: uuid() });
    await run(`UPDATE episodes SET status = 'published' WHERE id = :ep`, ids);
    await run(`UPDATE event_deliverables SET status = 'completed' WHERE id = :deliv`, ids);

    const check = await eligibility(ids);
    expect(check.body.eligible).toBe(false);
    expect(check.body.reasons.map((r) => r.code)).toEqual(['EPISODE_NOT_DRAFT', 'LEDGER_ROWS', 'DELIVERABLES_NOT_PENDING']);
    const refused = await reopen(ids);
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('TERMS_REOPEN_NOT_ELIGIBLE');
    expect((await eventRow(ids)).canon_consequences.terms_reopen).toBeUndefined();
  });
});
