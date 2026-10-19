/**
 * Beat 14's opportunity (Evoni, 2026-10-19: "during beat 14 we should include
 * an opportunity invitation from someone at the event"; "depend on how the
 * episode went, replace the random follow-up offer"). On the test database.
 */
jest.unmock('uuid');

const { Sequelize } = require('sequelize');
const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const migration = require('../../src/migrations/20261019140000-opportunity-offered-in-episode');
const beat14 = require('../../src/services/beat14Opportunity');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const TAG = uuid().slice(0, 8);
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)("Beat 14's opportunity", () => {
  const show = uuid();
  const ep = uuid();
  const ep2 = uuid();
  const ev = uuid();
  const profiles = {};
  let token;
  let editorToken;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const asEditor = (r) => r.set('Authorization', `Bearer ${editorToken}`);
  const url = (e = ep) => `/api/v1/opportunities/${show}/episode/${e}/beat14`;

  beforeAll(async () => {
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    // Attach and detach are ADMIN only (Evoni, 2026-10-19).
    token = TokenService.generateTokenPair({ id: 'test-admin-beat14', email: 'admin@beat14.dev', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editorToken = TokenService.generateTokenPair({ id: 'test-user-beat14', email: 'user@beat14.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :slug, CAST('{}' AS jsonb), NOW(), NOW())`,
      { show, name: `Beat 14 ${TAG}`, slug: `beat14-${TAG}` });
    for (const who of ['host', 'guest', 'outsider']) {
      const [[p]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
        VALUES (:h, 'instagram', 'test', :name, 'lalaverse', NOW(), NOW()) RETURNING id`, { h: `${who}${TAG}`, name: `${who[0].toUpperCase()}${who.slice(1)} ${TAG}` });
      profiles[who] = p.id;
    }
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES
      (:ep, :show, 'The Studio', 7, 'draft', NOW(), NOW()), (:ep2, :show, 'The Next One', 8, 'draft', NOW(), NOW())`, { ep, ep2, show });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, prestige, status, used_in_episode_id, source_profile_id, canon_consequences, created_at, updated_at)
      VALUES (:ev, :show, 'Studio Session', 'brand_activation', 7, 'used', :ep, :host, CAST(:cc AS jsonb), NOW(), NOW())`,
      { ev, show, ep, host: profiles.host, cc: JSON.stringify({ automation: { guest_profiles: [{ profile_id: profiles.guest, featured: true }] } }) });
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await run('DELETE FROM opportunities WHERE show_id = :show', { show });
    await run('DELETE FROM world_events WHERE id = :ev', { ev });
    await run('DELETE FROM episodes WHERE show_id = :show', { show });
    await run('DELETE FROM social_profiles WHERE id IN (:ids)', { ids: Object.values(profiles) });
    await run('DELETE FROM shows WHERE id = :show', { show });
    await sequelize.close();
  });

  test('lists who at the event can offer it, and the open opportunities to attach', async () => {
    await run(`INSERT INTO opportunities (id, show_id, name, opportunity_type, status, status_history, created_at, updated_at)
      VALUES (gen_random_uuid(), :show, 'Velour Cover', 'editorial', 'offered', CAST('[]' AS jsonb), NOW(), NOW())`, { show });
    const res = await auth(request(app).get(url()));
    expect(res.status).toBe(200);
    expect(res.body.data.opportunity).toBeNull();
    expect(res.body.data.people.map((p) => [p.profile_id, p.role])).toEqual([[profiles.host, 'host'], [profiles.guest, 'guest']]);
    expect(res.body.data.candidates.map((c) => c.name)).toEqual(['Velour Cover']);
  });

  test('only an admin attaches or detaches it; a signed-in non-admin can still read it', async () => {
    const put = await asEditor(request(app).put(url())).send({ create: { name: 'Sable Teaser', connector_profile_id: profiles.guest } });
    expect(put.status).toBe(403);
    const del = await asEditor(request(app).delete(url()));
    expect(del.status).toBe(403);
    expect((await rows('SELECT id FROM opportunities WHERE show_id = :show AND offered_in_episode_id = :ep', { show, ep })).length).toBe(0);
    const read = await asEditor(request(app).get(url()));
    expect(read.status).toBe(200);
  });

  test('every other deal write is ADMIN only too; the list still reads for anyone signed in', async () => {
    const id = uuid();
    const base = `/api/v1/opportunities/${show}`;
    const writes = [
      request(app).post(base).send({ name: 'Not allowed' }),
      request(app).put(`${base}/${id}`).send({ name: 'Not allowed' }),
      request(app).post(`${base}/${id}/advance`).send({ status: 'considering' }),
      request(app).post(`${base}/${id}/to-event`).send({}),
      request(app).delete(`${base}/${id}`),
      request(app).post(`${base}/episode-complete/${ep}`).send({}),
      request(app).post(`${base}/${id}/undo`).send({}),
    ];
    for (const w of writes) expect((await asEditor(w)).status).toBe(403);
    expect((await rows("SELECT id FROM opportunities WHERE show_id = :show AND name = 'Not allowed'", { show })).length).toBe(0);
    expect((await asEditor(request(app).get(base))).status).toBe(200);
  });

  test('the invitation comes from someone at the event', async () => {
    const res = await auth(request(app).put(url())).send({ create: { name: 'Sable Campaign Shoot', connector_profile_id: profiles.outsider } });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('someone at the event');
  });

  test('a new one is held for the episode; attaching an open one replaces it, and removing gives that one its status back', async () => {
    const made = await auth(request(app).put(url())).send({ create: { name: 'Sable Campaign Shoot', opportunity_type: 'campaign', pitch: 'Lead the campaign', connector_profile_id: profiles.guest } });
    expect(made.status).toBe(200);
    expect(made.body.data.opportunity).toMatchObject({ name: 'Sable Campaign Shoot', status: 'held', contact_name: `Guest ${TAG}`, narrative_stakes: 'Lead the campaign' });
    const madeId = made.body.data.opportunity.id;

    const [open] = await rows("SELECT id FROM opportunities WHERE show_id = :show AND name = 'Velour Cover'", { show });
    const swapped = await auth(request(app).put(url())).send({ opportunity_id: open.id, connector_profile_id: profiles.host });
    expect(swapped.status).toBe(200);
    expect(swapped.body.data.opportunity).toMatchObject({ id: open.id, status: 'held', connector_profile_id: profiles.host });
    const [gone] = await rows('SELECT deleted_at, offered_in_episode_id FROM opportunities WHERE id = :id', { id: madeId });
    expect(gone.deleted_at).not.toBeNull();
    expect(gone.offered_in_episode_id).toBeNull();

    // Another episode cannot offer the one this episode holds.
    const taken = await auth(request(app).put(url(ep2))).send({ opportunity_id: open.id, connector_profile_id: profiles.host });
    expect([400, 409]).toContain(taken.status);

    const removed = await auth(request(app).delete(url()));
    expect(removed.status).toBe(200);
    const [back] = await rows('SELECT status, offered_in_episode_id FROM opportunities WHERE id = :id', { id: open.id });
    expect(back).toEqual({ status: 'offered', offered_in_episode_id: null });
  });

  test('at completion it is offered when the episode lands, and no random offer follows', async () => {
    await auth(request(app).put(url())).send({ create: { name: 'Sable Ambassador', connector_profile_id: profiles.guest } });
    const event = (await rows('SELECT * FROM world_events WHERE id = :ev', { ev }))[0];
    const out = await beat14.resolveAtCompletion(models, { episodeId: ep, event, tierFinal: 'pass' });
    expect(out).toMatchObject({ name: 'Sable Ambassador', status: 'offered' });
    const [row] = await rows('SELECT status, offer_date FROM opportunities WHERE id = :id', { id: out.id });
    expect(row.status).toBe('offered');
    expect(row.offer_date).not.toBeNull();
    // The post-event marker characterSyncService.postEventOpportunitiesExist reads, so no random offer follows.
    const marked = await rows('SELECT id FROM opportunities WHERE show_id = :show AND status_history @> CAST(:m AS jsonb)', { show, m: JSON.stringify([{ source_event_id: ev }]) });
    expect(marked.map((m) => m.id)).toEqual([out.id]);
  });

  test('when the episode fails, it expires', async () => {
    await run('UPDATE opportunities SET offered_in_episode_id = NULL WHERE offered_in_episode_id = :ep', { ep });
    await auth(request(app).put(url())).send({ create: { name: 'Sable Lookbook', connector_profile_id: profiles.host } });
    const out = await beat14.resolveAtCompletion(models, { episodeId: ep, event: { id: ev, name: 'Studio Session' }, tierFinal: 'fail' });
    expect(out).toMatchObject({ name: 'Sable Lookbook', status: 'expired' });
    expect(await beat14.resolveAtCompletion(models, { episodeId: ep2, event: null, tierFinal: 'pass' })).toBeNull();
  });

  // The show tab's opportunities (Evoni, 2026-10-19): a negotiating one can
  // be beat 14's; the list names the episode; held is not undone here.
  test('a negotiating one is attached, the list names its episode, and held cannot be undone', async () => {
    await run('UPDATE opportunities SET offered_in_episode_id = NULL WHERE offered_in_episode_id = :ep', { ep });
    const id = uuid();
    await run(`INSERT INTO opportunities (id, show_id, name, opportunity_type, status, status_history, created_at, updated_at)
      VALUES (:id, :show, 'Velour Runway', 'runway', 'negotiating', CAST(:h AS jsonb), NOW(), NOW())`,
    { id, show, h: JSON.stringify([{ status: 'offered' }, { status: 'considering' }, { status: 'negotiating' }]) });
    const put = await auth(request(app).put(url())).send({ opportunity_id: id, connector_profile_id: profiles.host });
    expect(put.status).toBe(200);
    expect(put.body.data.opportunity).toMatchObject({ id, status: 'held' });

    const list = await auth(request(app).get(`/api/v1/opportunities/${show}`));
    expect(list.body.opportunities.find((o) => o.id === id).beat14_episode).toEqual({ id: ep, title: 'The Studio' });

    const held = await auth(request(app).post(`/api/v1/opportunities/${show}/${id}/undo`));
    expect(held.status).toBe(409);
    expect((await auth(request(app).delete(url()))).status).toBe(200);
    const [back] = await rows('SELECT status FROM opportunities WHERE id = :id', { id });
    expect(back.status).toBe('negotiating');
  });

  test('undo takes the last step back and says so in the history', async () => {
    const id = uuid();
    await run(`INSERT INTO opportunities (id, show_id, name, opportunity_type, status, status_history, created_at, updated_at)
      VALUES (:id, :show, 'Velour Fitting', 'runway', 'preparing', CAST(:h AS jsonb), NOW(), NOW())`,
    { id, show, h: JSON.stringify([{ status: 'offered' }, { status: 'preparing' }]) });
    expect((await auth(request(app).post(`/api/v1/opportunities/${show}/${id}/advance`)).send({ to_status: 'active' })).status).toBe(200);
    const res = await auth(request(app).post(`/api/v1/opportunities/${show}/${id}/undo`));
    expect(res.status).toBe(200);
    expect(res.body.undone).toEqual({ from: 'active', to: 'preparing' });
    const [row] = await rows('SELECT status, status_history FROM opportunities WHERE id = :id', { id });
    expect(row.status).toBe('preparing');
    expect(row.status_history[row.status_history.length - 1]).toMatchObject({ status: 'preparing', note: 'Undone', undone_from: 'active' });
    expect((await auth(request(app).post(`/api/v1/opportunities/${show}/not-an-id/undo`))).status).toBe(400);
  });
});
