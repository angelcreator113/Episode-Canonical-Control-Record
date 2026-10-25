/**
 * The Event Package's flow routes (Evoni, 2026-10-25: "I want them all"):
 *   GET  /api/v1/world/:showId/events/:eventId/flow          beat 14's best fit, the brand's usual choices, clashes
 *   POST /api/v1/world/:showId/events/:eventId/fill-missing  AI drafts for every empty field, writes nothing
 * Against the test database, the Anthropic SDK mocked. Velour Night is
 * hosted by Maison Velour, whose two earlier events were black tie,
 * prestige 8, brand partnerships; Gallery Late is on the same day with one
 * of its guests; an open Maison Velour campaign is the best fit.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { sequelize } = require('../../src/models');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const reply = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }], usage: { input_tokens: 1, output_tokens: 1 } });

(shouldSkip ? describe.skip : describe)('event flow routes', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  const brand = `Maison Velour ${tag}`;
  const ids = {
    show: crypto.randomUUID(), loc: crypto.randomUUID(), ev: crypto.randomUUID(), past1: crypto.randomUUID(),
    past2: crypto.randomUUID(), gallery: crypto.randomUUID(), used: crypto.randomUUID(), opp: crypto.randomUUID(), other: crypto.randomUUID(),
  };
  let host;
  let guest;
  let token;
  const flow = (eventId = ids.ev, t = token) => {
    const r = request(app).get(`/api/v1/world/${ids.show}/events/${eventId}/flow`);
    return t ? r.set('Authorization', `Bearer ${t}`) : r;
  };
  const fill = (eventId = ids.ev, t = token, body = {}) => {
    const r = request(app).post(`/api/v1/world/${ids.show}/events/${eventId}/fill-missing`).send(body);
    return t ? r.set('Authorization', `Bearer ${t}`) : r;
  };

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';
    token = TokenService.generateTokenPair({ id: 'test-user-evflow', email: 'evoni@evflow.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `EvFlow ${tag}`, slug: `evflow-${tag}` });
    const [[h]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
      VALUES (:h, 'pulse', 'Couture.', 'Ama Velour', 'lalaverse', NOW(), NOW()) RETURNING id`, { h: `@ama${tag}` });
    const [[g]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
      VALUES (:h, 'pulse', 'Art.', 'Nia Cole', 'lalaverse', NOW(), NOW()) RETURNING id`, { h: `@nia${tag}` });
    host = Number(h.id);
    guest = Number(g.id);
    await run(`INSERT INTO world_locations (id, name, city, venue_type, venue_details, created_at, updated_at)
      VALUES (:loc, 'The Glasshouse', 'Lalaville', 'rooftop_bar', CAST(:d AS jsonb), NOW(), NOW())`, { loc: ids.loc, d: JSON.stringify({ dress_code: 'All white' }) });
    const guests = (list) => JSON.stringify({ automation: { guest_profiles: list } });
    const insert = (id, name, extra = {}, minutesAgo = 0) => run(`INSERT INTO world_events
        (id, show_id, name, event_type, prestige, status, host_brand, dress_code, deal_type, event_date, source_profile_id,
         venue_location_id, canon_consequences, used_in_episode_id, created_at, updated_at)
      VALUES (:id, :show, :name, 'invite', :prestige, 'draft', :brand, :dress, :deal, :date, :src, :loc, CAST(:cc AS jsonb), :used,
         NOW() - (:m || ' minutes')::interval, NOW())`, {
      id, show: ids.show, name, prestige: extra.prestige ?? 5, brand: extra.brand ?? null, dress: extra.dress ?? null,
      deal: extra.deal ?? null, date: extra.date ?? null, src: extra.src ?? null, loc: extra.loc ?? null,
      cc: extra.cc ?? '{}', used: extra.used ?? null, m: String(minutesAgo),
    });
    await insert(ids.past1, 'Velour Spring', { brand, dress: 'black tie', prestige: 8, deal: 'brand_partnership' }, 30);
    await insert(ids.past2, 'Velour Summer', { brand, dress: 'Black tie', prestige: 8, deal: 'brand_partnership' }, 20);
    await insert(ids.gallery, 'Gallery Late', { date: '2026-11-01', cc: guests([{ id: guest, display_name: 'Nia Cole' }]) }, 10);
    await insert(ids.ev, 'Velour Night', { brand, date: '2026-11-01', src: host, loc: ids.loc, cc: guests([{ id: guest, display_name: 'Nia Cole', featured: true }]) }, 0);
    await insert(ids.used, 'Already Started', { used: crypto.randomUUID() }, 5);
    await run(`INSERT INTO opportunities (id, show_id, name, opportunity_type, status, brand_or_company, created_at, updated_at)
      VALUES (:id, :show, 'Maison Velour SS27 campaign', 'campaign', 'offered', :brand, NOW(), NOW())`, { id: ids.opp, show: ids.show, brand });
    await run(`INSERT INTO opportunities (id, show_id, name, opportunity_type, status, created_at, updated_at)
      VALUES (:id, :show, 'Podcast slot', 'podcast', 'offered', NOW(), NOW())`, { id: ids.other, show: ids.show });
  });

  beforeEach(() => mockCreate.mockReset());

  afterAll(async () => {
    await run('DELETE FROM opportunities WHERE show_id = :show', ids);
    await run('DELETE FROM world_events WHERE show_id = :show', ids);
    await run('DELETE FROM world_locations WHERE id = :loc', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:a, :b)', { a: host, b: guest });
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  describe('GET …/flow', () => {
    it('needs a sign-in (401)', async () => {
      expect((await flow(ids.ev, null)).status).toBe(401);
    });

    it('an event not in this show: 404', async () => {
      expect((await flow(crypto.randomUUID())).status).toBe(404);
    });

    it("beat 14's best fit, the brand's usual choices and the clashes", async () => {
      const res = await flow();
      expect(res.status).toBe(200);
      expect(res.body.errors).toBeUndefined();
      expect(res.body.beat14).toMatchObject({
        episode_id: null,
        host: { profile_id: host, name: 'Ama Velour' },
        best: { id: ids.opp, name: 'Maison Velour SS27 campaign', fit: { best: true } },
        draft: null,
      });
      expect(res.body.beat14.best.fit.reasons.map((r) => r.text)).toContain('Same brand as the host');
      expect(res.body.defaults).toEqual([
        // Spelled as the newest of them spells it.
        { field: 'dress_code', value: 'Black tie', source: 'brand', basis: `${brand}'s usual, 2 of its 2 other events` },
        { field: 'prestige', value: 8, source: 'brand', basis: `${brand}'s usual, 2 of its 2 other events` },
        { field: 'deal_type', value: 'brand_partnership', source: 'brand', basis: `${brand}'s usual, 2 of its 2 other events` },
      ]);
      expect(res.body.clashes.sameDay).toEqual([{ id: ids.gallery, name: 'Gallery Late' }]);
      expect(res.body.clashes.doubleBooked).toEqual([{ id: guest, name: 'Nia Cole', events: [{ id: ids.gallery, name: 'Gallery Late' }] }]);
      expect(res.body.clashes.lines.map((l) => l.kind)).toEqual(expect.arrayContaining(['day', 'guest']));
      // Writes nothing.
      const [[row]] = await run('SELECT dress_code, prestige, deal_type FROM world_events WHERE id = :ev', ids);
      expect(row).toEqual({ dress_code: null, prestige: 5, deal_type: null });
    });
  });

  describe('a follow-up event, through the existing create route and PUT', () => {
    it('keeps the host, brand, organizer, venue type, deal type and the chain, and nothing else', async () => {
      // The body useFollowUpEvent sends (frontend lib/eventFollowUp).
      const body = {
        name: 'Ama Velour — follow-up', event_type: 'invite', host: null, host_brand: brand, source_profile_id: host,
        location_hint: 'Rooftop bar', parent_event_id: ids.ev, chain_reason: 'Follow-up to Velour Night',
      };
      const created = await request(app).post(`/api/v1/world/${ids.show}/events`).set('Authorization', `Bearer ${token}`).send(body);
      expect(created.status).toBe(201);
      const ev = created.body.event;
      expect(ev).toMatchObject({ name: body.name, host_brand: brand, source_profile_id: host, location_hint: 'Rooftop bar', parent_event_id: ids.ev, chain_reason: 'Follow-up to Velour Night', status: 'draft' });
      expect(ev.venue_location_id || null).toBeNull();
      // Create drafts its own deal type after answering, so the PUT reads the row's version first.
      const fresh = await request(app).get(`/api/v1/world/${ids.show}/events/${ev.id}`).set('Authorization', `Bearer ${token}`);
      const put = await request(app).put(`/api/v1/world/${ids.show}/events/${ev.id}`).set('Authorization', `Bearer ${token}`)
        .send({ deal_type: 'brand_partnership', expected_updated_at: fresh.body.event.updated_at });
      expect(put.status).toBe(200);
      const [[row]] = await run('SELECT deal_type, canon_consequences FROM world_events WHERE id = :id', { id: ev.id });
      expect(row.deal_type).toBe('brand_partnership');
      expect(row.canon_consequences?.automation?.guest_profiles).toBeUndefined();
    });
  });

  describe('POST …/fill-missing', () => {
    it('needs a sign-in (401) and is AI rate limited', async () => {
      expect((await fill(ids.ev, null)).status).toBe(401);
      const router = require('../../src/routes/worldEvents/flow');
      const layer = router.stack.find((l) => l.route?.path === '/world/:showId/events/:eventId/fill-missing');
      expect(layer.route.methods.post).toBe(true);
      const { aiRateLimiter } = require('../../src/middleware/aiRateLimiter');
      const handles = layer.route.stack.map((s) => s.handle);
      expect(handles.map((h) => h.name)).toContain('requireAuth');
      expect(handles).toContain(aiRateLimiter);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('an event not in this show: 404; one that started its episode: 409', async () => {
      expect((await fill(crypto.randomUUID())).status).toBe(404);
      expect((await fill(ids.used)).status).toBe(409);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('returns only drafts for empty fields on the PUT allowlist, and saves nothing', async () => {
      mockCreate.mockResolvedValue(reply({ drafts: [
        { field: 'category', value: 'luxury_prestige', reason: 'A black-tie house night.' },
        { field: 'dress_code', value: 'Black tie', reason: 'The house always asks for it.' },
        { field: 'theme', value: 'Midnight velvet', reason: 'The house colours.' },
        { field: 'status', value: 'used', reason: 'Not a field to draft.' },
        { field: 'used_in_episode_id', value: crypto.randomUUID(), reason: 'Never.' },
        { field: 'format', value: 'rave', reason: 'Not a format.' },
      ] }));
      const res = await fill();
      expect(res.status).toBe(200);
      expect(res.body.data.drafts).toEqual([
        { field: 'category', label: 'Category', value: 'luxury_prestige', source: 'ai', reason: 'A black-tie house night.' },
        { field: 'dress_code', label: 'Dress code', value: 'Black tie', source: 'ai', reason: 'The house always asks for it.' },
        { field: 'theme', label: 'Invitation theme', value: 'Midnight velvet', source: 'ai', reason: 'The house colours.' },
      ]);
      expect(res.body.data.asked).toEqual(expect.arrayContaining(['category', 'format', 'dress_code', 'theme', 'description']));
      expect(mockCreate).toHaveBeenCalledTimes(1);
      const prompt = mockCreate.mock.calls[0][0].messages[0].content;
      for (const fact of ['Velour Night', brand, 'Ama Velour', 'The Glasshouse, Lalaville (rooftop bar)']) expect(prompt).toContain(fact);
      const [[row]] = await run('SELECT category, dress_code, theme, status FROM world_events WHERE id = :ev', ids);
      expect(row).toEqual({ category: null, dress_code: null, theme: null, status: 'draft' });
    });

    it('a mode it does not know: 400, no AI call', async () => {
      const res = await fill(ids.ev, token, { mode: 'everything' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('mode must be one of missing, ideas');
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("mode 'ideas': the six basics, set ones included, each draft with what it replaces; saves nothing", async () => {
      mockCreate.mockResolvedValue(reply({ drafts: [
        { field: 'event_date', value: '2099-11-08', reason: 'A Sunday close to the season finale.' },
        { field: 'event_time', value: '20:00', reason: 'A later start.' },
        { field: 'theme', value: 'Midnight velvet', reason: 'Not one of the six.' },
      ] }));
      const res = await fill(ids.ev, token, { mode: 'ideas' });
      expect(res.status).toBe(200);
      expect(res.body.data.asked).toEqual(['category', 'format', 'event_date', 'event_time', 'description', 'dress_code']);
      expect(res.body.data.drafts).toEqual([
        { field: 'event_date', label: 'Date', value: '2099-11-08', source: 'ai', reason: 'A Sunday close to the season finale.', current: '2026-11-01' },
        { field: 'event_time', label: 'Time', value: '20:00', source: 'ai', reason: 'A later start.' },
      ]);
      const prompt = mockCreate.mock.calls[0][0].messages[0].content;
      expect(prompt).toContain('event_date: 2026-11-01');
      expect(prompt).toContain('different from its current value');
      const [[row]] = await run('SELECT event_date, event_time FROM world_events WHERE id = :ev', ids);
      expect(row.event_time).toBeNull();
      expect(String(row.event_date).slice(0, 10) === '2026-11-01' || new Date(row.event_date).toISOString().startsWith('2026-11-01')).toBe(true);
    });

    it('an unreadable answer: 200 with no drafts', async () => {
      mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'Sorry.' }], usage: { input_tokens: 1, output_tokens: 1 } });
      const res = await fill();
      expect(res.status).toBe(200);
      expect(res.body.data.drafts).toEqual([]);
    });
  });
});
