/**
 * Audience polls (Task #3005; The Pulse spec §11), against the test database:
 * - Admin: a draft about an event (its episode found through the event),
 *   options of wardrobe item ids checked; edit only while a draft; open and
 *   close; admin-only writes;
 * - public read: drafts never shown; an open poll's labels without counts or
 *   any wardrobe, event or episode id; a closed poll with its counts;
 * - the vote: one per browser cookie, or per account when signed in; a
 *   soft cap per IP on anonymous votes, so a household votes twice (Task
 *   #3094); the cookie is set HttpOnly; hashes only, never the raw IP,
 *   cookie or account; a closed or past-due poll refuses; no salt, no vote
 *   (503, nothing stored); the vote limiter.
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
const SALT = 'test-salt-for-polls';

(shouldSkip ? describe.skip : describe)('The Pulse audience polls (Task #3005)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), other: uuid(), ep1: uuid(), gala: uuid(), elsewhere: uuid(), w1: uuid(), w2: uuid(), w3: uuid() };
  const GALA = `Gala ${tag}`;
  let admin;
  let editor;
  let pollId;
  let options;
  const savedSalt = process.env.POLL_HASH_SALT;
  const as = (token, req) => req.set('Authorization', `Bearer ${token}`);
  // Each voter its own IP (trust proxy is 1, so X-Forwarded-For is the client).
  const vote = (id, optionId, { cookie, ip = '203.0.113.1' } = {}) => {
    const req = request(app).post(`/api/v1/public/polls/${id}/vote`).set('X-Forwarded-For', ip);
    if (cookie) req.set('Cookie', cookie);
    return req.send({ option_id: optionId });
  };
  const cookieOf = (res) => (res.headers['set-cookie'] || [])[0]?.split(';')[0];

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    process.env.POLL_HASH_SALT = SALT;
    admin = TokenService.generateTokenPair({ id: 'test-admin-polls', email: 'evoni@polls.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-editor-polls', email: 'ed@polls.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW()), (:other, :name2, :slug2, NOW(), NOW())`,
      { show: ids.show, other: ids.other, name: `Polls ${tag}`, slug: `polls-${tag}`, name2: `Other ${tag}`, slug2: `other-${tag}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep1, :show, 'One', 1, 'published', NOW(), NOW())`, ids);
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, cost_coins, prestige, created_at, updated_at)
               VALUES (:gala, :show, :name, 'used', :ep1, 0, 5, NOW(), NOW()), (:elsewhere, :other, 'Elsewhere', 'draft', NULL, 0, 5, NOW(), NOW())`,
    { ...ids, name: GALA });
    for (const w of ['w1', 'w2', 'w3']) {
      await run(`INSERT INTO wardrobe (id, name, clothing_category, show_id, created_at, updated_at) VALUES (:id, :name, 'dress', :show, NOW(), NOW())`,
        { id: ids[w], name: `${w}-${tag}`, show: ids.show });
    }
  });

  afterAll(async () => {
    if (savedSalt === undefined) delete process.env.POLL_HASH_SALT; else process.env.POLL_HASH_SALT = savedSalt;
    await run('DELETE FROM pulse_polls WHERE show_id IN (:a)', { a: [ids.show, ids.other] });
    await run('DELETE FROM wardrobe WHERE id IN (:a)', { a: [ids.w1, ids.w2, ids.w3] });
    await run('DELETE FROM world_events WHERE show_id IN (:a)', { a: [ids.show, ids.other] });
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM shows WHERE id IN (:a)', { a: [ids.show, ids.other] });
  });

  test('Admin makes a draft about an event, with its episode; options are checked; only an admin writes', async () => {
    const body = {
      show_id: ids.show, world_event_id: ids.gala,
      options: [{ label: 'The pink set', wardrobe_ids: [ids.w1, ids.w2] }, { label: 'The black dress', wardrobe_ids: [ids.w3] }],
    };
    expect((await as(editor, request(app).post('/api/v1/pulse-polls')).send(body)).status).toBe(403);
    expect((await as(admin, request(app).post('/api/v1/pulse-polls')).send({ ...body, options: body.options.slice(0, 1) })).status).toBe(400);
    expect((await as(admin, request(app).post('/api/v1/pulse-polls')).send({ ...body, world_event_id: ids.elsewhere })).status).toBe(400);
    const missing = await as(admin, request(app).post('/api/v1/pulse-polls')).send({ ...body, options: [body.options[0], { label: 'x', wardrobe_ids: [uuid()] }] });
    expect(missing.status).toBe(400);
    expect(missing.body.error).toMatch(/was not found/);

    const res = await as(admin, request(app).post('/api/v1/pulse-polls')).send(body);
    expect(res.status).toBe(201);
    expect(res.body.poll).toMatchObject({ question: `Which look for ${GALA}?`, status: 'draft', world_event_id: ids.gala, episode_id: ids.ep1, total: 0 });
    expect(res.body.poll.options.map((o) => [o.label, o.wardrobe_ids, o.votes])).toEqual([
      ['The pink set', [ids.w1, ids.w2], 0], ['The black dress', [ids.w3], 0],
    ]);
    pollId = res.body.poll.id;
    options = res.body.poll.options;
  });

  test('a draft is never public and takes no vote; it edits, then opens; once open it no longer edits', async () => {
    expect((await request(app).get('/api/v1/public/polls')).body.polls.find((p) => p.id === pollId)).toBeUndefined();
    expect((await vote(pollId, options[0].id)).status).toBe(404);

    const edit = await as(admin, request(app).put(`/api/v1/pulse-polls/${pollId}`)).send({ question: 'Pink or black for the gala?' });
    expect(edit.body.poll.question).toBe('Pink or black for the gala?');
    expect((await as(editor, request(app).post(`/api/v1/pulse-polls/${pollId}/open`))).status).toBe(403);
    const open = await as(admin, request(app).post(`/api/v1/pulse-polls/${pollId}/open`));
    expect(open.body.poll.status).toBe('open');
    expect((await as(admin, request(app).put(`/api/v1/pulse-polls/${pollId}`)).send({ question: 'x' })).status).toBe(409);
    expect((await as(admin, request(app).post(`/api/v1/pulse-polls/${pollId}/open`))).status).toBe(409);

    // Public: the question and labels, no counts and no production ids.
    const pub = (await request(app).get('/api/v1/public/polls')).body.polls.find((p) => p.id === pollId);
    expect(pub).toEqual({
      id: pollId, question: 'Pink or black for the gala?', status: 'open', closes_at: null,
      options: [{ id: options[0].id, label: 'The pink set' }, { id: options[1].id, label: 'The black dress' }],
    });
    const raw = JSON.stringify(pub);
    for (const secret of [ids.w1, ids.w3, ids.gala, ids.ep1, ids.show]) expect(raw).not.toContain(secret);
  });

  test('one vote per browser; another browser on the same IP counts too; stored only as hashes; the cookie is HttpOnly', async () => {
    const first = await vote(pollId, options[0].id, { ip: '203.0.113.10' });
    expect(first.status).toBe(201);
    const cookie = cookieOf(first);
    expect(cookie).toMatch(/^pulse_voter=[0-9a-f-]{36}$/);
    expect(first.headers['set-cookie'][0]).toMatch(/HttpOnly/);
    expect(first.headers['set-cookie'][0]).toMatch(/SameSite=Lax/);

    // The same browser from another IP is refused.
    const again = await vote(pollId, options[1].id, { cookie, ip: '203.0.113.11' });
    expect(again.status).toBe(409);
    expect(again.body.error).toBe("You've voted already.");

    // Another browser on the same IP (a household, an office) counts (Task #3094); an option of no poll is refused.
    const sameIp = await vote(pollId, options[1].id, { ip: '203.0.113.10' });
    expect(sameIp.status).toBe(201);
    expect(cookieOf(sameIp)).not.toBe(cookie);
    expect((await vote(pollId, uuid(), { ip: '203.0.113.13' })).status).toBe(400);

    const [rows] = await run('SELECT voter_hash, ip_hash FROM pulse_poll_votes WHERE poll_id = :id', { id: pollId });
    expect(rows).toHaveLength(2);
    const voterId = cookie.split('=')[1];
    const hash = (kind, value) => crypto.createHash('sha256').update(`${SALT}:${kind}:${value}`).digest('hex');
    expect(rows.map((r) => r.ip_hash)).toContain(hash('ip', '203.0.113.10'));
    expect(rows.map((r) => r.voter_hash)).toContain(hash('voter', voterId));
    const stored = JSON.stringify(rows);
    expect(stored).not.toContain('203.0.113.10');
    expect(stored).not.toContain(voterId);
  });

  test('no salt, no vote: 503 and nothing stored', async () => {
    delete process.env.POLL_HASH_SALT;
    try {
      const res = await vote(pollId, options[0].id, { ip: '203.0.113.20' });
      expect(res.status).toBe(503);
      expect(res.headers['set-cookie']).toBeUndefined();
      expect((await as(admin, request(app).get(`/api/v1/pulse-polls?show_id=${ids.show}`))).body.voting_ready).toBe(false);
    } finally {
      process.env.POLL_HASH_SALT = SALT;
    }
    const [[{ n }]] = await run('SELECT COUNT(*)::int AS n FROM pulse_poll_votes WHERE poll_id = :id', { id: pollId });
    expect(n).toBe(2);
  });

  test('a signed-in voter votes as their account: no cookie, once per account whatever the browser or IP (Task #3094)', async () => {
    const made = await as(admin, request(app).post('/api/v1/pulse-polls')).send({
      show_id: ids.show, episode_id: ids.ep1, options: [{ label: 'A', wardrobe_ids: [] }, { label: 'B', wardrobe_ids: [] }],
    });
    const poll = made.body.poll;
    await as(admin, request(app).post(`/api/v1/pulse-polls/${poll.id}/open`));
    const first = await as(editor, vote(poll.id, poll.options[0].id, { ip: '203.0.113.50' }));
    expect(first.status).toBe(201);
    expect(first.headers['set-cookie']).toBeUndefined();
    const elsewhere = await as(editor, vote(poll.id, poll.options[1].id, { ip: '203.0.113.51', cookie: `pulse_voter=${uuid()}` }));
    expect(elsewhere.status).toBe(409);
    // A bad token votes as an anonymous browser, not as an error.
    expect((await vote(poll.id, poll.options[1].id, { ip: '203.0.113.52' }).set('Authorization', 'Bearer not-a-token')).status).toBe(201);

    const [rows] = await run('SELECT voter_hash, signed_in FROM pulse_poll_votes WHERE poll_id = :id ORDER BY created_at', { id: poll.id });
    const hash = (kind, value) => crypto.createHash('sha256').update(`${SALT}:${kind}:${value}`).digest('hex');
    expect(rows.map((r) => r.signed_in)).toEqual([true, false]);
    expect(rows[0].voter_hash).toBe(hash('account', 'test-editor-polls'));
    expect(JSON.stringify(rows)).not.toContain('test-editor-polls');
  });

  test('an IP casts at most IP_SOFT_CAP anonymous votes on a poll; account votes and other IPs are not held back (Task #3094)', async () => {
    const { castVote, IP_SOFT_CAP, PollError } = require('../../src/services/pulsePolls');
    const made = await as(admin, request(app).post('/api/v1/pulse-polls')).send({
      show_id: ids.show, episode_id: ids.ep1, options: [{ label: 'A', wardrobe_ids: [] }, { label: 'B', wardrobe_ids: [] }],
    });
    const poll = made.body.poll;
    await as(admin, request(app).post(`/api/v1/pulse-polls/${poll.id}/open`));
    const cast = (extra) => castVote(models, { pollId: poll.id, optionId: poll.options[0].id, voterId: uuid(), ip: '192.0.2.9', ...extra });
    // At once, so the lock is what keeps the count.
    const results = await Promise.allSettled(Array.from({ length: IP_SOFT_CAP + 3 }, () => cast()));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(IP_SOFT_CAP);
    const refused = results.filter((r) => r.status === 'rejected').map((r) => r.reason);
    expect(refused).toHaveLength(3);
    for (const err of refused) {
      expect(err).toBeInstanceOf(PollError);
      expect(err.status).toBe(429);
      expect(err.message).toBe('Too many votes from this network on this poll.');
    }
    await expect(cast({ voterId: 'account-1', account: true })).resolves.toEqual({ ok: true });
    await expect(cast({ ip: '192.0.2.10' })).resolves.toEqual({ ok: true });
    const [[{ n }]] = await run('SELECT COUNT(*)::int AS n FROM pulse_poll_votes WHERE poll_id = :id', { id: poll.id });
    expect(n).toBe(IP_SOFT_CAP + 2);
  });

  test('closing shows the counts publicly and refuses votes; a poll past its closing time reads and votes as closed', async () => {
    const closed = await as(admin, request(app).post(`/api/v1/pulse-polls/${pollId}/close`));
    expect(closed.body.poll).toMatchObject({ status: 'closed', total: 2 });
    expect((await vote(pollId, options[0].id, { ip: '203.0.113.30' })).status).toBe(409);
    const pub = (await request(app).get('/api/v1/public/polls')).body.polls.find((p) => p.id === pollId);
    expect(pub).toMatchObject({ status: 'closed', total: 2 });
    expect(pub.options.map((o) => [o.label, o.votes])).toEqual([['The pink set', 1], ['The black dress', 1]]);

    // A second poll, open, then past due.
    const made = await as(admin, request(app).post('/api/v1/pulse-polls')).send({
      show_id: ids.show, episode_id: ids.ep1, options: [{ label: 'A', wardrobe_ids: [] }, { label: 'B', wardrobe_ids: [] }],
    });
    expect(made.body.poll.question).toBe('Which look for One?');
    const second = made.body.poll;
    await as(admin, request(app).post(`/api/v1/pulse-polls/${second.id}/open`));
    await run("UPDATE pulse_polls SET closes_at = NOW() - INTERVAL '1 minute' WHERE id = :id", { id: second.id });
    expect((await vote(second.id, second.options[0].id, { ip: '203.0.113.40' })).status).toBe(409);
    const list = (await as(admin, request(app).get(`/api/v1/pulse-polls?show_id=${ids.show}`))).body;
    expect(list.voting_ready).toBe(true);
    expect(list.polls.find((p) => p.id === second.id).status).toBe('closed');
    expect((await as(admin, request(app).post('/api/v1/pulse-polls')).send({ show_id: ids.show, episode_id: ids.ep1, closes_at: '2001-01-01', options: second.options })).status).toBe(400);
  });

  test('the vote limiter stops a flood from one IP', async () => {
    const made = await as(admin, request(app).post('/api/v1/pulse-polls')).send({
      show_id: ids.show, episode_id: ids.ep1, options: [{ label: 'A', wardrobe_ids: [] }, { label: 'B', wardrobe_ids: [] }],
    });
    const poll = made.body.poll;
    await as(admin, request(app).post(`/api/v1/pulse-polls/${poll.id}/open`));
    const statuses = [];
    for (let i = 0; i < 12; i += 1) statuses.push((await vote(poll.id, poll.options[0].id, { ip: '198.51.100.7' })).status);
    expect(statuses).toContain(429);
  });
});
