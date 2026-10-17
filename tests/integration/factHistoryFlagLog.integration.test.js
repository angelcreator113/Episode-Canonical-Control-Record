/**
 * Fact history and flag log (the spec's #1 and #4; Evoni, 2026-10-17):
 * - each save on the fact sheet records the facts that changed, before and
 *   after, with why, who and the story moment; a save that changes nothing
 *   records nothing; the history reads with the follower ledger, newest first;
 * - every flag the check raises is logged and kept: seen again, it counts;
 *   fixed, it is fixed; gone from the text, it is gone; marked intentional,
 *   intentional; and the log is summed by check, field and character.
 */
jest.unmock('uuid');

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

(shouldSkip ? describe.skip : describe)('fact history and flag log', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  const ids = { show: crypto.randomUUID(), reg: crypto.randomUUID(), char: crypto.randomUUID(), ep: crypto.randomUUID() };
  let pid;
  let admin;
  const as = (method, path, body) => request(app)[method](`/api/v1/cast${path}`).set('Authorization', `Bearer ${admin}`).send(body);
  const logRows = async () => (await run('SELECT flag_id, check_key, status, times_seen, field_label FROM consistency_flag_log WHERE registry_character_id = :char ORDER BY first_seen_at', ids))[0];

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-history', email: 'evoni@history.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `History ${tag}`, slug: `history-${tag}` });
    await run("INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep, :show, 'Four', 4, 'published', NOW(), NOW())", ids);
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'History', :show, NOW(), NOW())", ids);
    const [[p]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
      VALUES (:h, 'pulse', 'Slow fashion.', 'Maren', 'lalaverse', NOW(), NOW()) RETURNING id`, { h: `@hist${tag}` });
    pid = p.id;
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, feed_profile_id, description, canon_facts, created_at, updated_at)
      VALUES (:char, :reg, :key, 'Maren', :pid, :desc, CAST(:facts AS jsonb), NOW(), NOW())`,
    { ...ids, key: `hist-${tag}`, pid, desc: 'Maren has 1.2M followers and a linen studio.', facts: JSON.stringify({ occupation: 'Slow-fashion creator' }) });
    await run(`INSERT INTO pulse_followers (show_id, social_profile_id, story_order, change, count_after, cause, reason, status, decided_by, decided_at, created_at, updated_at)
      VALUES (:show, :pid, 0, 1000000, 1000000, 'start', 'Where she started', 'accepted', 'auto', NOW() - INTERVAL '1 day', NOW(), NOW())`, { show: ids.show, pid });
  });

  afterAll(async () => {
    await run('DELETE FROM consistency_flag_log WHERE registry_character_id = :char', ids);
    await run('DELETE FROM character_fact_changes WHERE registry_character_id = :char', ids);
    await run('DELETE FROM pulse_followers WHERE show_id = :show', ids);
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id = :pid', { pid });
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  it('records each fact that changed, with why, who and when in the story, alongside the follower ledger', async () => {
    const saved = await as('put', `/characters/${ids.char}/facts`, {
      occupation: 'Slow-fashion creator and vintage reseller',
      income: { amount: 60000, cadence: 'per_year', source: 'brand deals' },
      followers: { count: 2000000, reason: 'The swap went viral' },
      reason: 'After the swap she started reselling',
    });
    expect(saved.status).toBe(200);
    const [rows] = await run('SELECT fact_key, before_value, after_value, reason, story_order, changed_by FROM character_fact_changes WHERE registry_character_id = :char ORDER BY fact_key', ids);
    expect(rows).toEqual([
      { fact_key: 'income', before_value: null, after_value: { amount: 60000, cadence: 'per_year', source: 'brand deals' }, reason: 'After the swap she started reselling', story_order: 47, changed_by: 'evoni@history.dev' },
      { fact_key: 'occupation', before_value: 'Slow-fashion creator', after_value: 'Slow-fashion creator and vintage reseller', reason: 'After the swap she started reselling', story_order: 47, changed_by: 'evoni@history.dev' },
    ]);

    // The same values again change nothing.
    await as('put', `/characters/${ids.char}/facts`, { occupation: 'Slow-fashion creator and vintage reseller' });
    const [[{ n }]] = await run('SELECT COUNT(*)::int AS n FROM character_fact_changes WHERE registry_character_id = :char', ids);
    expect(n).toBe(2);

    const res = await as('get', `/characters/${ids.char}/facts/history`);
    expect(res.status).toBe(200);
    const { history } = res.body;
    const occupation = history.find((h) => h.fact === 'occupation');
    expect(occupation).toMatchObject({ label: 'Occupation', from: 'Slow-fashion creator', to: 'Slow-fashion creator and vintage reseller', story_label: 'After Ep 4', by: 'evoni@history.dev', source: 'fact_sheet' });
    expect(history.find((h) => h.fact === 'income').to).toBe('60,000 a year from brand deals');
    const followers = history.filter((h) => h.source === 'followers');
    expect(followers.map((h) => [h.from, h.to, h.reason])).toEqual([['1M', '2M', 'The swap went viral'], [null, '1M', 'Where she started']]);
    expect(history[history.length - 1].reason).toBe('Where she started');
  });

  it('logs every flag and keeps it: seen again, fixed, gone, intentional; summed for the cast', async () => {
    // Her facts now say 2M; the description says 1.2M.
    expect((await as('get', `/characters/${ids.char}/check`)).body.flags).toHaveLength(1);
    await as('get', `/characters/${ids.char}/check`);
    let rows = await logRows();
    expect(rows).toEqual([expect.objectContaining({ check_key: 'followers', status: 'open', times_seen: 2, field_label: 'Description' })]);
    const flagId = rows[0].flag_id;

    expect((await as('post', `/characters/${ids.char}/check/fix`, { flag_id: flagId })).status).toBe(200);
    rows = await logRows();
    expect(rows[0]).toMatchObject({ flag_id: flagId, status: 'fixed' });

    // A new finding, then the text changes and it no longer appears: gone.
    await run("UPDATE registry_characters SET description = 'Maren has 3M followers.' WHERE id = :char", ids);
    await as('get', `/characters/${ids.char}/check`);
    await run("UPDATE registry_characters SET description = 'Maren sews.' WHERE id = :char", ids);
    await as('get', `/characters/${ids.char}/check`);
    rows = await logRows();
    expect(rows.map((r) => r.status)).toEqual(['fixed', 'gone']);

    // Marked intentional, it stays logged as intentional.
    await run("UPDATE registry_characters SET description = 'Maren tells everyone she has 5M followers.' WHERE id = :char", ids);
    const third = (await as('get', `/characters/${ids.char}/check`)).body.flags[0];
    expect((await as('post', `/characters/${ids.char}/check/intentional`, { flag_id: third.id })).status).toBe(200);
    rows = await logRows();
    expect(rows.map((r) => r.status)).toEqual(['fixed', 'gone', 'intentional']);
    await as('get', `/characters/${ids.char}/check`);
    expect((await logRows()).map((r) => r.status)).toEqual(['fixed', 'gone', 'intentional']);

    const sum = await as('get', `/flag-log?registry_id=${ids.reg}`);
    expect(sum.status).toBe(200);
    expect(sum.body.totals).toEqual({ total: 3, open: 0, resolved: 2, intentional: 1 });
    expect(sum.body.by_check).toEqual([{ check_key: 'followers', total: 3, open: 0, resolved: 2, intentional: 1 }]);
    expect(sum.body.by_field[0]).toMatchObject({ field: 'Description', total: 3 });
    expect(sum.body.by_character).toEqual([{ id: ids.char, name: 'Maren', total: 3, open: 0, resolved: 2, intentional: 1 }]);
    expect((await as('get', '/flag-log?registry_id=nope')).status).toBe(400);
  });
});
