/**
 * Story and Secrets follow the season switcher (Evoni, 2026-10-26, Season
 * page round 3: they "always show the season in progress even when a past
 * season (e.g. Season 1) is picked"). ?season=N on the threads, twists,
 * reveal plan and needs reads that season; a twist written in Season 1
 * reads back as Season 1. And the Cast tab's read (GET .../season/cast):
 * who appears in which slot (the event's host and guests, the approved
 * story record's people) and the relationship changes saved per part.
 * requireAuth throughout; a missing season is 404.
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

(shouldSkip ? describe.skip : describe)('Story, Secrets and Cast follow ?season=N', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  const ids = { show: uuid(), reg: uuid(), arc1: uuid(), arc2: uuid(), ep1: uuid(), ep2: uuid(), ev1: uuid(), ana: uuid(), ben: uuid(), rel: uuid() };
  const slots = {};
  const pids = [];
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    token = TokenService.generateTokenPair({
      id: 'test-user-season-r3', email: 'test@season-r3.dev', name: 'Round3', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())',
      { show: ids.show, name: `Round3 ${tag}`, slug: `round3-${tag}` });
    const phases = JSON.stringify([{ phase: 1, title: 'First', episode_start: 1, episode_end: 1 }, { phase: 2, title: 'Second', episode_start: 2, episode_end: 2 }]);
    for (const [n, status, arc] of [[1, 'completed', ids.arc1], [2, 'active', ids.arc2]]) {
      await run(`INSERT INTO show_arcs (id, show_id, arc_number, title, season_number, episode_start, episode_end,
                   phases, current_phase, status, narrative_debt, progression_log, emotional_temperature, created_at, updated_at)
                 VALUES (:arc, :show, :n, :title, :n, 1, 2, CAST(:phases AS jsonb), 1, :status, '[]', '[]', 'rising', NOW(), NOW())`,
      { arc, show: ids.show, n, title: `Season ${n} title`, status, phases });
    }
    for (const [ep, n] of [[ids.ep1, 1], [ids.ep2, 2]]) {
      await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, season_number, created_at, updated_at)
                 VALUES (:ep, :show, :title, :n, 'published', 1, NOW(), NOW())`, { ep, show: ids.show, title: `S1 E${n}`, n });
    }
    // Season 1: slot 1 has ep1, slot 2 has ep2. Season 2: two empty slots.
    for (const [arc, n] of [[ids.arc1, 1], [ids.arc2, 2]]) {
      for (const s of [1, 2]) {
        const id = uuid();
        slots[`${n}-${s}`] = id;
        await run(`INSERT INTO season_slots (id, show_id, arc_id, season_number, slot_number, phase, episode_id, created_at, updated_at)
                   VALUES (:id, :show, :arc, :n, :s, :s, :ep, NOW(), NOW())`,
        { id, show: ids.show, arc, n, s, ep: n === 1 ? (s === 1 ? ids.ep1 : ids.ep2) : null });
      }
    }
    // A thread Season 1 continues, and one only Season 2 does.
    await run(`INSERT INTO show_story_threads (id, show_id, title, status, created_at, updated_at)
               VALUES (gen_random_uuid(), :show, 'Old thread', 'open', NOW(), NOW()), (gen_random_uuid(), :show, 'New thread', 'open', NOW(), NOW())`, ids);
    await run(`UPDATE season_slots SET story_thread_id = (SELECT id FROM show_story_threads WHERE show_id = :show AND title = 'Old thread') WHERE id = :slot`,
      { ...ids, slot: slots['1-1'] });
    await run(`UPDATE season_slots SET story_thread_id = (SELECT id FROM show_story_threads WHERE show_id = :show AND title = 'New thread') WHERE id = :slot`,
      { ...ids, slot: slots['2-1'] });
    // Twists: one per season.
    await run(`INSERT INTO season_twists (show_id, arc_id, title, plant_slot_id, status, created_at, updated_at)
               VALUES (:show, :arc1, 'S1 twist', :p1, 'planned', NOW(), NOW()), (:show, :arc2, 'S2 twist', :p2, 'planned', NOW(), NOW())`,
    { ...ids, p1: slots['1-1'], p2: slots['2-1'] });

    // The cast: Ana hosts ep1's event, Ben is a guest; the record has them both
    // in ep2, and a saved relationship change in ep2.
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Round3', :show, NOW(), NOW())", ids);
    for (const [who, name] of [['ana', 'Ana'], ['ben', 'Ben']]) {
      const [[p]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
        VALUES (:h, 'pulse', 'Here.', :name, 'lalaverse', NOW(), NOW()) RETURNING id`, { h: `@${who}${tag}`, name });
      pids.push(p.id);
      await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, feed_profile_id, created_at, updated_at)
        VALUES (:id, :reg, :key, :name, :pid, NOW(), NOW())`, { id: ids[who], reg: ids.reg, key: `${who}-${tag}`, name, pid: p.id });
    }
    await run(`INSERT INTO world_events (id, show_id, name, status, source_profile_id, canon_consequences, used_in_episode_id, created_at, updated_at)
               VALUES (:ev1, :show, 'The launch', 'used', :host, CAST(:cc AS jsonb), :ep1, NOW(), NOW())`,
    { ...ids, host: pids[0], cc: JSON.stringify({ automation: { guest_profiles: [{ profile_id: pids[1], display_name: 'Ben' }] } }) });
    await run(`INSERT INTO episode_story_records (episode_id, show_id, status, characters, relationships, created_at, updated_at)
               VALUES (:ep2, :show, 'approved', CAST(:chars AS jsonb), CAST(:rels AS jsonb), NOW(), NOW())`,
    { ...ids,
      chars: JSON.stringify([{ character_id: ids.ana, name: 'Ana' }, { character_id: ids.ben, name: 'Ben' }]),
      rels: JSON.stringify([{ key: 'r1', a: ids.ana, b: ids.ben, a_name: 'Ana', b_name: 'Ben', type: 'friend', stage_before: 'friends', stage_after: 'rivals', keep: true }]) });
    await run(`INSERT INTO character_relationships (id, character_id_a, character_id_b, relationship_type, created_at, updated_at)
               VALUES (:rel, :ana, :ben, 'friend', NOW(), NOW())`, ids);
    await run(`INSERT INTO relationship_events (id, relationship_id, event_type, title, relationship_stage, metadata, created_at, updated_at)
               VALUES (gen_random_uuid(), :rel, 'escalation', 'Episode 2: Ana and Ben', 'rivals', CAST(:meta AS jsonb), NOW(), NOW())`,
    { ...ids, meta: JSON.stringify({ episode_id: ids.ep2, stage_before: 'friends', source: 'record' }) });
  });

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await run('DELETE FROM relationship_events WHERE relationship_id = :rel', ids);
    await run('DELETE FROM character_relationships WHERE id = :rel', ids);
    await run('DELETE FROM episode_story_records WHERE show_id = :show', ids);
    await run('DELETE FROM world_events WHERE show_id = :show', ids);
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:pids)', { pids });
    await run('DELETE FROM season_twists WHERE show_id = :show', ids);
    await run('DELETE FROM season_slots WHERE show_id = :show', ids);
    await run('DELETE FROM show_story_threads WHERE show_id = :show', ids);
    await run('DELETE FROM show_arcs WHERE show_id = :show', ids);
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  const get = (path) => auth(request(app).get(`/api/v1/world/${ids.show}/season/${path}`));

  it('needs a signed-in user', async () => {
    for (const p of ['threads?season=1', 'twists?season=1', 'reveals?season=1', 'needs?season=1', 'cast?season=1', 'cast']) {
      expect((await request(app).get(`/api/v1/world/${ids.show}/season/${p}`)).status).toBe(401);
    }
  });

  it('threads: Season 1 lists the threads it touched, with its own slot numbers; no season lists every thread', async () => {
    const past = await get('threads?season=1');
    expect(past.status).toBe(200);
    expect(past.body.threads.map((t) => [t.title, t.slot_numbers])).toEqual([['Old thread', [1]]]);
    const all = await get('threads');
    expect(all.body.threads.map((t) => t.title).sort()).toEqual(['New thread', 'Old thread']);
    // Without a season the slot numbers are every season's, as before.
    expect(all.body.threads.find((t) => t.title === 'New thread').slot_numbers).toEqual([1]);
  });

  it('twists and the reveal plan read Season 1 with ?season=1, the season in progress without', async () => {
    const past = await get('twists?season=1');
    expect(past.status).toBe(200);
    expect(past.body.arc.id).toBe(ids.arc1);
    expect(past.body.twists.map((t) => t.title)).toEqual(['S1 twist']);
    const now = await get('twists');
    expect(now.body.arc.id).toBe(ids.arc2);
    expect(now.body.twists.map((t) => t.title)).toEqual(['S2 twist']);
    const plan = await get('reveals?season=1');
    expect(plan.status).toBe(200);
    expect(plan.body.arc).toMatchObject({ id: ids.arc1, season_number: 1 });
    expect(plan.body.slots.map((s) => s.label)).toEqual(['S1 · E1', 'S1 · E2']);
    expect((await get('reveals')).body.arc.id).toBe(ids.arc2);
  });

  it('a twist written in Season 1 answers with Season 1', async () => {
    const res = await auth(request(app).put(`/api/v1/world/${ids.show}/season/twists`))
      .send({ title: 'Another S1 twist', plant_slot_id: slots['1-1'], payoff_slot_id: slots['1-2'] });
    expect(res.status).toBe(200);
    expect(res.body.arc.id).toBe(ids.arc1);
    expect(res.body.twists.map((t) => t.title).sort()).toEqual(['Another S1 twist', 'S1 twist']);
  });

  it('the needs read Season 1 with ?season=1', async () => {
    const res = await get('needs?season=1');
    expect(res.status).toBe(200);
    expect(res.body.arc.id).toBe(ids.arc1);
    expect(res.body.season_number).toBe(1);
  });

  it('a missing season is 404 and a bad one 400 on every read', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    for (const p of ['threads', 'twists', 'reveals', 'needs', 'cast']) {
      expect((await get(`${p}?season=7`)).status).toBe(404);
      expect((await get(`${p}?season=x`)).status).toBe(400);
    }
  });

  it('cast: who appears in which slot, and what changed in each part, once per pair', async () => {
    const res = await get('cast?season=1');
    expect(res.status).toBe(200);
    expect(res.body.arc).toMatchObject({ id: ids.arc1, season_number: 1 });
    const byName = Object.fromEntries(res.body.people.map((p) => [p.name, p]));
    expect(byName.Ana).toMatchObject({ character_id: ids.ana, slots: [1, 2], roles: { 1: 'host', 2: 'story' } });
    expect(byName.Ben).toMatchObject({ character_id: ids.ben, slots: [1, 2], roles: { 1: 'guest', 2: 'story' } });
    expect(res.body.parts.map((p) => [p.phase, p.changes.length])).toEqual([[1, 0], [2, 1]]);
    expect(res.body.parts[1].changes[0]).toMatchObject({
      slot_number: 2, source: 'saved', stage_before: 'friends', stage_after: 'rivals', a: { name: 'Ana' }, b: { name: 'Ben' },
    });
    // The season in progress has nobody yet.
    const now = await get('cast');
    expect(now.body.arc.id).toBe(ids.arc2);
    expect(now.body.people).toEqual([]);
  });
});
