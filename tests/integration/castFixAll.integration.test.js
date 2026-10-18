/**
 * Fix what can be fixed (services/castFixAll; Evoni, 2026-10-18), through
 * the routes, against the test database, with the AI faked. One registry
 * in a show:
 *   - Sable: on the feed with "1.2M" written on her profile (an estimate),
 *     her description saying 900K and a yacht, her work set, her income and
 *     what she owns missing, no type, Active, no voice
 *   - Lala: no feed person; exactly one LalaVerse profile has her name; every
 *     fact set and a type, not Active yet
 *   - Twin: two profiles have her name; Echo: the one profile with her name
 *     is already another character's
 *   - Dr. Sinclair: never touched
 * Then: the rewrites are queued, not applied; Apply all applies them and
 * skips a stale one; Undo restores and refuses what changed since; ADMIN
 * only; the AI budget stopping the run keeps what was done.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

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
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const reply = (obj) => ({ content: [{ text: JSON.stringify(obj) }], usage: { input_tokens: 1, output_tokens: 1 } });

const YACHT = 'She summers on a yacht off the coast.';
/** The fake AI: answers by what the prompt asks for. */
function fakeAi({ budget = false } = {}) {
  mockCreate.mockImplementation(async ({ messages }) => {
    if (budget) throw Object.assign(new Error('AI daily budget exceeded ($50.00 / $50). Call blocked.'), { status: 429, code: 'AI_BUDGET_EXCEEDED' });
    const prompt = messages[0].content;
    if (prompt.includes('propose their hard facts')) {
      return reply({ occupation: 'Should not overwrite', income: { amount: 40000, cadence: 'per_year', source: 'Brand deals' }, major_possessions: ['A sewing machine'], why: 'Her studio.' });
    }
    if (prompt.includes('which Enneagram type')) return reply({ enneagram: { type: 4, wing: 3 }, mbti: null, why: 'Her longing to be seen.' });
    if (prompt.includes('consistency check found')) return reply({ items: [{ n: 1, verdict: 'fix', sentence: 'She dreams of summers on a yacht off the coast.', why: 'She cannot afford one.' }] });
    return reply({ tone: 'warm', signature_phrases: [] });
  });
}

(shouldSkip ? describe.skip : describe)('Fix what can be fixed', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid(), reg2: uuid(), sable: uuid(), lala: uuid(), twin: uuid(), echo: uuid(), owner: uuid(), dr: uuid(), late1: uuid(), late2: uuid() };
  const p = {};
  let admin;
  let user;
  let run1;
  const post = (path, body, token = admin) => request(app).post(`/api/v1/cast/consistency/${path}`).set('Authorization', `Bearer ${token}`).send(body);
  const character = async (id) => (await q('SELECT * FROM registry_characters WHERE id = :id', { id }))[0];
  const profile = async (h, name, extra = {}) => {
    const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, current_state, follower_count_approx, created_at, updated_at)
      VALUES (:h, 'pulse', 'test', :name, 'lalaverse', 'rising', :approx, NOW(), NOW()) RETURNING id`, { h, name, approx: extra.approx || null });
    return row.id;
  };
  const addCharacter = (id, reg, name, { depth = 'sparked', feed = null, description = null, facts = {}, typology = null, extra = null, key = null } = {}) => run(
    `INSERT INTO registry_characters (id, registry_id, character_key, display_name, depth_level, feed_profile_id, description, canon_facts, typology, extra_fields, created_at, updated_at)
     VALUES (:id, :reg, :key, :name, CAST(:depth AS enum_registry_characters_depth_level), :feed, :description, CAST(:facts AS jsonb), CAST(:typology AS jsonb), CAST(:extra AS jsonb), NOW(), NOW())`,
    { id, reg, key: key || `${name.toLowerCase()}-${tag}`, name, depth, feed, description, facts: JSON.stringify(facts), typology: typology ? JSON.stringify(typology) : null, extra: extra ? JSON.stringify(extra) : null });

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-fixall', email: 'evoni@fixall.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    user = TokenService.generateTokenPair({ id: 'test-user-fixall', email: 'u@fixall.dev', name: 'U', groups: ['USER'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `Fixall ${tag}`, slug: `fixall-${tag}` });
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Fixall', :show, NOW(), NOW())", ids);
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg2, 'Fixall late', :show, NOW(), NOW())", ids);

    p.sable = await profile(`@sable${tag}`, `Sable${tag}`, { approx: '1.2M' });
    await addCharacter(ids.sable, ids.reg, `Sable${tag}`, {
      depth: 'active', feed: p.sable, description: `She has 900K followers. ${YACHT}`, facts: { occupation: 'Studio owner' },
    });
    p.lala = await profile(`@lala${tag}`, `Lala${tag}`, { approx: '10K' });
    await addCharacter(ids.lala, ids.reg, `Lala${tag}`, {
      facts: { occupation: 'Stylist', income: { amount: 50000, cadence: 'per_year' }, major_possessions: ['A closet'] }, typology: { enneagram: { type: 3, wing: 4 } },
    });
    p.twinA = await profile(`@twina${tag}`, `Twin${tag}`);
    p.twinB = await profile(`@twinb${tag}`, `Twin${tag}`);
    await addCharacter(ids.twin, ids.reg, `Twin${tag}`);
    p.echo = await profile(`@echo${tag}`, `Echo${tag}`);
    await addCharacter(ids.owner, ids.reg2, `Owner${tag}`, { feed: p.echo });
    await addCharacter(ids.echo, ids.reg, `Echo${tag}`);
    await addCharacter(ids.dr, ids.reg, `Amara${tag}`, { extra: { classification: 'confidential_professional' } });
  });

  afterAll(async () => {
    const chars = Object.values(ids);
    await run('DELETE FROM pulse_voices WHERE registry_character_id IN (:chars)', { chars });
    await run('DELETE FROM pulse_requests WHERE show_id = :show', ids).catch((err) => console.error('cleanup', err.message));
    await run('DELETE FROM pulse_followers WHERE show_id = :show', ids);
    await run('DELETE FROM character_fact_changes WHERE registry_character_id IN (:chars)', { chars }).catch((err) => console.error('cleanup', err.message));
    await run('DELETE FROM consistency_flag_log WHERE registry_character_id IN (:chars)', { chars }).catch((err) => console.error('cleanup', err.message));
    await run('DELETE FROM registry_characters WHERE registry_id IN (:reg, :reg2)', ids);
    await run('DELETE FROM character_registries WHERE id IN (:reg, :reg2)', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:a)', { a: Object.values(p) });
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  it('is ADMIN only and needs registry ids', async () => {
    expect((await post('fix-all', { registry_id: ids.reg }, user)).status).toBe(403);
    expect((await post('apply-rewrites', { items: [] }, user)).status).toBe(403);
    expect((await post('undo', { change: {} }, user)).status).toBe(403);
    expect((await post('fix-all', { registry_id: 'nope' })).status).toBe(400);
  });

  it('runs every character through the steps their page has', async () => {
    fakeAi();
    const res = await post('fix-all', { registry_id: ids.reg });
    expect(res.status).toBe(200);
    run1 = res.body;
    const byName = Object.fromEntries(res.body.characters.map((c) => [c.name.replace(tag, ''), c]));
    expect(Object.keys(byName).sort()).toEqual(['Echo', 'Lala', 'Sable', 'Twin']);   // Dr. Sinclair is not touched
    expect(res.body.stopped).toBeNull();

    // Sable: followers confirmed, her missing facts filled (her work kept), a type, the 900K fixed, her voice built.
    const sable = byName.Sable;
    expect(sable.changes.map((c) => c.kind)).toEqual(['followers', 'facts', 'typology', 'text', 'voice']);
    const [ledger] = await q("SELECT count_after, status FROM pulse_followers WHERE social_profile_id = :pid AND deleted_at IS NULL", { pid: p.sable });
    expect(ledger).toEqual({ count_after: 1200000, status: 'accepted' });
    const row = await character(ids.sable);
    expect(row.canon_facts.occupation).toBe('Studio owner');
    expect(row.canon_facts.income).toMatchObject({ amount: 40000, cadence: 'per_year' });
    expect(row.canon_facts.major_possessions).toEqual(['A sewing machine']);
    expect(row.typology.enneagram).toEqual({ type: 4, wing: 3 });
    expect(row.description).toContain('1.2M followers');
    // The yacht rewrite is queued, not applied.
    expect(row.description).toContain(YACHT);
    expect(sable.queued).toEqual([expect.objectContaining({ character_id: ids.sable, verdict: 'fix', before: YACHT, after: 'She dreams of summers on a yacht off the coast.' })]);
    // Her voice is built and waits for Evoni.
    const [voice] = await q('SELECT approved_at FROM pulse_voices WHERE registry_character_id = :id AND deleted_at IS NULL', { id: ids.sable });
    expect(voice).toEqual({ approved_at: null });

    // Lala: matched to the one profile with her name; not Active, so no voice.
    expect(byName.Lala.changes.map((c) => c.kind)).toContain('feed_profile');
    expect((await character(ids.lala)).feed_profile_id).toBe(p.lala);
    expect(byName.Lala.left).toContain('Their voice: make them Active first.');
    // Twin and Echo are left for her.
    expect(byName.Twin.changes).toEqual([]);
    expect(byName.Twin.left[0]).toMatch(/2 feed profiles fit/);
    expect((await character(ids.twin)).feed_profile_id).toBeNull();
    expect(byName.Echo.left[0]).toMatch(new RegExp(`already Owner${tag}'s`));
    expect((await character(ids.echo)).feed_profile_id).toBeNull();
    expect((await character(ids.dr)).feed_profile_id).toBeNull();
  });

  it('Apply all swaps the queued rewrites in and skips one whose sentence has gone', async () => {
    const [item] = run1.characters.find((c) => c.id === ids.sable).queued;
    const res = await post('apply-rewrites', { items: [item, { ...item }] });
    expect(res.status).toBe(200);
    expect(res.body.applied).toBe(1);
    expect(res.body.skipped).toBe(1);
    expect(res.body.results[1].error).toMatch(/has changed|no longer there/);
    expect((await character(ids.sable)).description).toContain('She dreams of summers on a yacht off the coast.');

    // A "fine" verdict is kept as written: marked intentional, and Undo unmarks it.
    const fine = await post('apply-rewrites', { items: [{ character_id: ids.sable, flag_id: item.flag_id, verdict: 'fine', why: 'A dream, not a yacht.' }] });
    expect(fine.body.applied).toBe(1);
    const kept = (await character(ids.sable)).canon_facts.intentional;
    expect(kept).toEqual([expect.objectContaining({ id: item.flag_id, note: 'A dream, not a yacht.' })]);
    expect((await post('undo', { change: fine.body.results[0].change })).status).toBe(200);
    expect((await character(ids.sable)).canon_facts.intentional).toEqual([]);
  });

  it('Undo puts a change back, and refuses one that has changed since', async () => {
    const sable = run1.characters.find((c) => c.id === ids.sable);
    const type = sable.changes.find((c) => c.kind === 'typology');
    expect((await post('undo', { change: type })).status).toBe(200);
    expect((await character(ids.sable)).typology).toBeNull();
    expect((await post('undo', { change: type })).status).toBe(409);

    const followerFix = sable.changes.find((c) => c.kind === 'text');
    await run("UPDATE registry_characters SET description = 'Rewritten by hand.' WHERE id = :sable", ids);
    expect((await post('undo', { change: followerFix })).status).toBe(409);
    expect((await character(ids.sable)).description).toBe('Rewritten by hand.');

    const facts = sable.changes.find((c) => c.kind === 'facts');
    expect((await post('undo', { change: facts })).status).toBe(200);
    const row = await character(ids.sable);
    expect(row.canon_facts.income).toBeNull();
    expect(row.canon_facts.occupation).toBe('Studio owner');

    const voice = sable.changes.find((c) => c.kind === 'voice');
    expect((await post('undo', { change: voice })).status).toBe(200);
    expect(await q('SELECT id FROM pulse_voices WHERE registry_character_id = :id AND deleted_at IS NULL', { id: ids.sable })).toEqual([]);

    const followers = sable.changes.find((c) => c.kind === 'followers');
    expect((await post('undo', { change: followers })).status).toBe(200);
    expect(await q('SELECT id FROM pulse_followers WHERE social_profile_id = :pid AND deleted_at IS NULL', { pid: p.sable })).toEqual([]);

    const link = run1.characters.find((c) => c.id === ids.lala).changes.find((c) => c.kind === 'feed_profile');
    expect((await post('undo', { change: link })).status).toBe(200);
    expect((await character(ids.lala)).feed_profile_id).toBeNull();

    expect((await post('undo', { change: { ...type, character_id: ids.dr } })).status).toBe(403);
  });

  it('the AI budget stopping the run keeps what was done and says why', async () => {
    p.late1 = await profile(`@late1${tag}`, `Late1${tag}`, { approx: '5K' });
    p.late2 = await profile(`@late2${tag}`, `Late2${tag}`, { approx: '6K' });
    await addCharacter(ids.late1, ids.reg2, `Late1${tag}`, { feed: p.late1 });
    await addCharacter(ids.late2, ids.reg2, `Late2${tag}`, { feed: p.late2 });
    await run('DELETE FROM registry_characters WHERE id = :owner', ids);
    fakeAi({ budget: true });
    const res = await post('fix-all', { registry_id: ids.reg2 });
    expect(res.status).toBe(200);
    expect(res.body.stopped).toMatch(/budget exceeded/);
    const [late1, late2] = res.body.characters;
    expect(late1.changes.map((c) => c.kind)).toEqual(['followers']);   // done before the first AI call
    expect(late1.left.at(-1)).toMatch(/^Stopped here/);
    expect(late2.changes).toEqual([]);
    expect(late2.left).toEqual(['Not reached: the run stopped.']);
    const [ledger] = await q('SELECT count_after FROM pulse_followers WHERE social_profile_id = :pid AND deleted_at IS NULL', { pid: p.late1 });
    expect(ledger.count_after).toBe(5000);
  });
});
