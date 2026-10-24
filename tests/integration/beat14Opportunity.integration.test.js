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

    // Change on what is attached: only who offers it changes; the one made here stays.
    const resent = await auth(request(app).put(url())).send({ opportunity_id: madeId, connector_profile_id: profiles.host });
    expect(resent.status).toBe(200);
    expect(resent.body.data.opportunity).toMatchObject({ id: madeId, status: 'held', connector_profile_id: profiles.host, contact_name: `Host ${TAG}` });

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

  // Script page audit (2026-10-19): once completion offered or expired it,
  // detaching or replacing it deleted it or rolled it back, and one attached
  // after completion stayed held for good.
  test('once the episode is completed, beat 14 is final: attach and detach answer 409 and change nothing', async () => {
    await run("UPDATE episodes SET evaluation_status = 'accepted' WHERE id = :ep", { ep });
    try {
      const [before] = await rows('SELECT id, status, deleted_at FROM opportunities WHERE offered_in_episode_id = :ep', { ep });
      expect(before.status).toBe('expired');

      const removed = await auth(request(app).delete(url()));
      expect(removed.status).toBe(409);
      expect(removed.body.error).toContain('The episode is completed');
      const replaced = await auth(request(app).put(url())).send({ create: { name: 'Too Late', connector_profile_id: profiles.guest } });
      expect(replaced.status).toBe(409);

      const [after] = await rows('SELECT id, status, deleted_at FROM opportunities WHERE id = :id', { id: before.id });
      expect(after).toEqual(before);
      expect(await rows("SELECT id FROM opportunities WHERE show_id = :show AND name = 'Too Late'", { show })).toEqual([]);
    } finally {
      await run("UPDATE episodes SET evaluation_status = NULL WHERE id = :ep", { ep });
    }
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
    expect(list.body.opportunities.find((o) => o.id === id).beat14_episode).toEqual({ id: ep, title: 'The Studio', episode_number: 7, evaluation_status: null });

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
  // Evoni, 2026-10-23: "I currently have an opportunity from episode 1 in
  // the opportunities tab but I can't turn it into an event". A held one is
  // never stuck: Release offer, Schedule as Event now, and completion
  // without a recorded tier offers it.
  describe('a held one is never stuck', () => {
    const ep3 = uuid();
    const ev3 = uuid();
    const oppsUrl = `/api/v1/opportunities/${show}`;
    const holdOne = async (name) => {
      await run('UPDATE opportunities SET offered_in_episode_id = NULL WHERE offered_in_episode_id = :ep3', { ep3 });
      const made = await auth(request(app).put(url(ep3))).send({ create: { name, opportunity_type: 'campaign', connector_profile_id: profiles.guest } });
      expect(made.status).toBe(200);
      return made.body.data.opportunity.id;
    };
    const row = async (id) => (await rows('SELECT status, offer_date, event_id, offered_in_episode_id, status_history FROM opportunities WHERE id = :id', { id }))[0];
    let savedKey;

    beforeAll(async () => {
      // No model calls: the venue falls back without a key.
      savedKey = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep3, :show, 'Episode One', 1, 'draft', NOW(), NOW())`, { ep3, show });
      await run(`INSERT INTO world_events (id, show_id, name, event_type, prestige, status, used_in_episode_id, source_profile_id, canon_consequences, created_at, updated_at)
        VALUES (:ev3, :show, 'First Gala', 'brand_activation', 7, 'used', :ep3, :host, CAST(:cc AS jsonb), NOW(), NOW())`,
      { ev3, show, ep3, host: profiles.host, cc: JSON.stringify({ automation: { guest_profiles: [{ profile_id: profiles.guest, featured: true }] } }) });
    });
    afterEach(async () => {
      await run("UPDATE episodes SET evaluation_status = NULL, evaluation_json = NULL WHERE id = :ep3", { ep3 });
    });
    afterAll(async () => {
      if (savedKey !== undefined) process.env.ANTHROPIC_API_KEY = savedKey;
      await run('UPDATE opportunities SET event_id = NULL WHERE show_id = :show', { show });
      await run('DELETE FROM world_events WHERE show_id = :show AND id <> :ev', { show, ev });
    });

    test('the list says whether its episode is completed', async () => {
      const id = await holdOne('Sable Look');
      await run("UPDATE episodes SET evaluation_status = 'accepted' WHERE id = :ep3", { ep3 });
      const list = await auth(request(app).get(oppsUrl));
      expect(list.body.opportunities.find((o) => o.id === id).beat14_episode).toEqual({ id: ep3, title: 'Episode One', episode_number: 1, evaluation_status: 'accepted' });
    });

    test('Release offer: held → offered today, still beat 14 of its episode; 409 when not held; ADMIN only', async () => {
      const id = await holdOne('Sable Release');
      expect((await asEditor(request(app).post(`${oppsUrl}/${id}/release`))).status).toBe(403);
      expect((await row(id)).status).toBe('held');

      const res = await auth(request(app).post(`${oppsUrl}/${id}/release`));
      expect(res.status).toBe(200);
      expect(res.body.opportunity).toMatchObject({ id, status: 'offered', offered_in_episode_id: ep3 });
      const after = await row(id);
      expect(after.status).toBe('offered');
      expect(String(after.offer_date).slice(0, 10)).toBe(new Date().toISOString().slice(0, 10));
      expect(after.status_history[after.status_history.length - 1]).toMatchObject({ status: 'offered', note: 'Released by hand', tier: null, released: true, source_event_id: ev3 });

      const again = await auth(request(app).post(`${oppsUrl}/${id}/release`));
      expect(again.status).toBe(409);
      expect(again.body.error).toBe('Only one held for beat 14 can be released; this one is offered.');
      expect((await auth(request(app).post(`${oppsUrl}/not-an-id/release`))).status).toBe(400);

      // The writers still read it as beat 14's invitation, and Undo cannot put it back to held.
      const b14 = await auth(request(app).get(url(ep3)));
      expect(b14.body.data.opportunity).toMatchObject({ id, status: 'offered', completion_status: 'offered' });
      const undo = await auth(request(app).post(`${oppsUrl}/${id}/undo`));
      expect(undo.status).toBe(409);
      // Beat 14 is final for it, and says why.
      const detach = await auth(request(app).delete(url(ep3)));
      expect(detach.status).toBe(409);
      expect(detach.body.error).toContain('offered by hand');
    });

    test('completion after a release changes nothing and makes no random offer', async () => {
      const id = await holdOne('Sable Early Bird');
      expect((await auth(request(app).post(`${oppsUrl}/${id}/release`))).status).toBe(200);
      const before = await row(id);
      const event = (await rows('SELECT * FROM world_events WHERE id = :ev3', { ev3 }))[0];
      // A failed episode does not take it back either: it was released by hand.
      const out = await beat14.resolveAtCompletion(models, { episodeId: ep3, event, tierFinal: 'fail' });
      expect(out).toMatchObject({ id, status: 'offered' });
      expect(await row(id)).toEqual(before);
      // resolveAtCompletion returned it, so completion makes no random
      // offer; and the post-event marker is there for any other path.
      const made = await require('../../src/services/characterSyncService').generatePostEventOpportunities({ ...event, prestige: 9 }, 'slay', models);
      expect(made).toEqual([]);
      await run("UPDATE episodes SET evaluation_status = 'accepted', evaluation_json = CAST(:j AS jsonb) WHERE id = :ep3", { ep3, j: JSON.stringify({ tier_final: 'fail' }) });
      expect(await beat14.resolveHeldAfterCompletion(models, { episodeId: ep3 })).toBeNull();
      expect(await row(id)).toEqual(before);
    });

    test('a completed episode with no recorded tier offers it', async () => {
      const id = await holdOne('Sable No Tier');
      await run("UPDATE episodes SET evaluation_status = 'accepted', evaluation_json = NULL WHERE id = :ep3", { ep3 });
      const out = await beat14.resolveHeldAfterCompletion(models, { episodeId: ep3 });
      expect(out).toMatchObject({ id, status: 'offered' });
      const after = await row(id);
      expect(after.status).toBe('offered');
      expect(after.offer_date).not.toBeNull();
      expect(after.status_history[after.status_history.length - 1]).toMatchObject({ status: 'offered', tier: null, source_event_id: ev3, note: 'Completed without a recorded tier; offered' });
      // At completion itself, an evaluation without tier_final does the same.
      await run("UPDATE episodes SET evaluation_status = NULL WHERE id = :ep3", { ep3 });
      const id2 = await holdOne('Sable No Tier Two');
      expect(await beat14.resolveAtCompletion(models, { episodeId: ep3, event: { id: ev3, name: 'First Gala' }, tierFinal: undefined })).toMatchObject({ id: id2, status: 'offered' });
    });

    test('Schedule as Event now offers and books it, with its event, in one step', async () => {
      const id = await holdOne('Sable Schedule Early');
      // No connector, so no draft and no guest selection (no model calls).
      await run('UPDATE opportunities SET connector_profile_id = NULL WHERE id = :id', { id });
      expect((await asEditor(request(app).post(`/api/v1/feed-pipeline/${show}/schedule/${id}`))).status).toBe(403);
      expect((await row(id)).status).toBe('held');

      const res = await auth(request(app).post(`/api/v1/feed-pipeline/${show}/schedule/${id}`));
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ offered_early: true });
      const after = await row(id);
      expect(after).toMatchObject({ status: 'booked', event_id: res.body.data.event_id, offered_in_episode_id: ep3 });
      expect(after.offer_date).not.toBeNull();
      expect(after.status_history.slice(-2)).toEqual([
        expect.objectContaining({ status: 'offered', note: 'Scheduled before its episode was completed', tier: null, released: true, source_event_id: ev3 }),
        expect.objectContaining({ status: 'booked', note: 'Scheduled as event' }),
      ]);
      const [event] = await rows('SELECT name, opportunity_id, deleted_at FROM world_events WHERE id = :e', { e: res.body.data.event_id });
      expect(event).toEqual({ name: 'Sable Schedule Early', opportunity_id: id, deleted_at: null });
      // Still beat 14's invitation for the writers; completion leaves it booked.
      const b14 = await auth(request(app).get(url(ep3)));
      expect(b14.body.data.opportunity).toMatchObject({ id, status: 'booked', completion_status: 'offered' });
      expect(await beat14.resolveAtCompletion(models, { episodeId: ep3, event: { id: ev3, name: 'First Gala' }, tierFinal: 'pass' })).toMatchObject({ id, status: 'booked' });
      expect((await row(id)).status).toBe('booked');
    });

    test('a failed schedule leaves it held and removes the event it made', async () => {
      const id = await holdOne('Sable Schedule Fails');
      await run('UPDATE opportunities SET connector_profile_id = NULL WHERE id = :id', { id });
      const realQuery = sequelize.query.bind(sequelize);
      const spy = jest.spyOn(sequelize, 'query').mockImplementation((sql, ...rest) => {
        if (typeof sql === 'string' && /UPDATE opportunities SET event_id/.test(sql)) return Promise.reject(new Error('boom'));
        return realQuery(sql, ...rest);
      });
      let res;
      try {
        res = await auth(request(app).post(`/api/v1/feed-pipeline/${show}/schedule/${id}`));
      } finally {
        spy.mockRestore();
      }
      expect(res.status).toBe(500);
      const after = await row(id);
      expect(after).toMatchObject({ status: 'held', event_id: null, offer_date: null });
      const events = await rows("SELECT deleted_at FROM world_events WHERE show_id = :show AND name = 'Sable Schedule Fails'", { show });
      expect(events.length).toBe(1);
      expect(events[0].deleted_at).not.toBeNull();
      // A second try goes through: the removed event does not block the name.
      const retry = await auth(request(app).post(`/api/v1/feed-pipeline/${show}/schedule/${id}`));
      expect(retry.status).toBe(200);
      expect((await row(id)).status).toBe('booked');
    });

    test('the unused to-event route refuses a held one', async () => {
      const id = await holdOne('Sable To Event');
      const res = await auth(request(app).post(`${oppsUrl}/${id}/to-event`).send({}));
      expect(res.status).toBe(409);
      expect((await row(id)).status).toBe('held');
    });
  });
});
