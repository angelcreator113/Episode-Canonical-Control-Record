/**
 * Talk (Evoni, 2026-10-18): a confidential session with a character in
 * Lala's world, as Dr. Amara Sinclair (services/characterTalk, migration
 * 20261018150000-character-conversations). Against the test database,
 * through the routes, with the AI faked:
 *   - the character answers from their character file, in their world;
 *     the session is saved; her earlier notes come back next time
 *   - What came out of this: her note, an inner-life change, a candidate
 *     secret, a Producer Insight; Apply writes only that field, Send makes a
 *     candidate secret, Keep and Dismiss write nothing else
 *   - JustAWoman's people and Dr. Sinclair herself cannot be talked to
 *   - ADMIN only, reads included
 *   - the migration adds Dr. Sinclair as a draft confidential professional
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { sequelize } = require('../../src/models');
const migration = require('../../src/migrations/20261018150000-character-conversations');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const reply = (text) => ({ content: [{ text }], usage: { input_tokens: 1, output_tokens: 1 } });

(shouldSkip ? describe.skip : describe)('Talk: a session with Dr. Amara Sinclair', () => {
  let admin;
  let user;
  const ids = { reg: uuid(), lala: uuid(), book: uuid() };

  beforeAll(async () => {
    await migration.up(sequelize.getQueryInterface());
    admin = TokenService.generateTokenPair({ id: 'test-admin-talk', email: 'evoni@talk.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    user = TokenService.generateTokenPair({ id: 'test-user-talk', email: 'user@talk.dev', name: 'User', groups: ['USER'], role: 'USER' }).accessToken;
    await run("INSERT INTO character_registries (id, title, created_at, updated_at) VALUES (:reg, 'Talk registry', NOW(), NOW())", ids);
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, world, core_fear, created_at, updated_at)
               VALUES (:lala, :reg, :key, 'Talk Lala', 'lalaverse', 'Being ordinary.', NOW(), NOW())`, { ...ids, key: `talk-lala-${ids.lala.slice(0, 8)}` });
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, world, created_at, updated_at)
               VALUES (:book, :reg, :key, 'Book One Friend', 'book-1', NOW(), NOW())`, { ...ids, key: `talk-book-${ids.book.slice(0, 8)}` });
  });

  afterAll(async () => {
    await run('DELETE FROM character_conversations WHERE registry_character_id IN (:lala, :book)', ids);
    await run('DELETE FROM character_secrets WHERE registry_character_id = :lala', ids).catch(() => {});
    await run('DELETE FROM registry_characters WHERE id IN (:lala, :book)', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
  });

  beforeEach(() => mockCreate.mockReset());

  it('adds Dr. Sinclair as a draft confidential professional with no feed profile', async () => {
    const [dr] = await q("SELECT status, world, feed_profile_id, extra_fields FROM registry_characters WHERE character_key = 'amara_sinclair' AND deleted_at IS NULL");
    expect(dr).toBeTruthy();
    expect(dr.status).toBe('draft');
    expect(dr.world).toBe('lalaverse');
    expect(dr.feed_profile_id).toBeNull();
    const extra = typeof dr.extra_fields === 'string' ? JSON.parse(dr.extra_fields) : dr.extra_fields;
    expect(extra.classification).toBe('confidential_professional');
  });

  it('is ADMIN only, reads included', async () => {
    const res = await request(app).get(`/api/v1/cast/characters/${ids.lala}/talk`).set('Authorization', `Bearer ${user}`);
    expect(res.status).toBe(403);
  });

  it('a character in Lala\'s world answers from their file, and the session is saved', async () => {
    mockCreate.mockResolvedValueOnce(reply('Ordinary scares me more than failing.'));
    const res = await request(app).post(`/api/v1/cast/characters/${ids.lala}/talk`).set('Authorization', `Bearer ${admin}`)
      .send({ text: 'What scares you most right now?' });
    expect(res.status).toBe(200);
    const s = res.body.session;
    expect(s.messages.map((m) => m.from)).toEqual(['dr_sinclair', 'character']);
    expect(s.messages[1].text).toBe('Ordinary scares me more than failing.');
    const call = mockCreate.mock.calls[0][0];
    expect(call.system).toContain('Dr. Amara Sinclair');
    expect(call.system).toContain('Being ordinary.');
    expect(call.system).toContain('the LalaVerse');
    expect(call.system).toContain('never name JustAWoman');
    expect(call.messages).toEqual([{ role: 'user', content: 'What scares you most right now?' }]);

    mockCreate.mockResolvedValueOnce(reply('Maybe both.'));
    const again = await request(app).post(`/api/v1/cast/characters/${ids.lala}/talk`).set('Authorization', `Bearer ${admin}`)
      .send({ session_id: s.id, text: 'Her approval, or the work?' });
    expect(again.body.session.id).toBe(s.id);
    expect(again.body.session.messages).toHaveLength(4);
    expect(mockCreate.mock.calls[1][0].messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
  });

  it('What came out of this: her note and three kinds of suggestion; Apply, Send, Keep and Dismiss', async () => {
    const [{ id: sessionId }] = await q('SELECT id FROM character_conversations WHERE registry_character_id = :lala', ids);
    mockCreate.mockResolvedValueOnce(reply(JSON.stringify({
      session_note: 'She wants Vivienne\'s approval more than she admits.',
      inner: [{ field: 'core_fear', value: 'Being ordinary, and being seen to want approval.', why: 'Maybe both.' }, { field: 'description', value: 'not allowed' }],
      secrets: [{ text: 'She rehearses what she will say to Vivienne.', why: 'She hesitated.' }],
      insights: [{ text: 'A beat where Lala almost asks Vivienne directly.', why: 'Unspoken want.' }],
    })));
    const res = await request(app).post(`/api/v1/cast/talk/${sessionId}/review`).set('Authorization', `Bearer ${admin}`);
    expect(res.status).toBe(200);
    const { review } = res.body.session;
    expect(review.session_note).toMatch(/approval/);
    expect(review.items.map((i) => i.kind)).toEqual(['inner', 'secret', 'insight']);
    const [inner, secret, insight] = review.items;
    expect(inner.current).toBe('Being ordinary.');

    const apply = await request(app).post(`/api/v1/cast/talk/${sessionId}/items/${inner.id}`).set('Authorization', `Bearer ${admin}`).send({ action: 'apply' });
    expect(apply.status).toBe(200);
    const [lala] = await q('SELECT core_fear FROM registry_characters WHERE id = :lala', ids);
    expect(lala.core_fear).toBe('Being ordinary, and being seen to want approval.');

    const wrong = await request(app).post(`/api/v1/cast/talk/${sessionId}/items/${secret.id}`).set('Authorization', `Bearer ${admin}`).send({ action: 'apply' });
    expect(wrong.status).toBe(400);
    const send = await request(app).post(`/api/v1/cast/talk/${sessionId}/items/${secret.id}`).set('Authorization', `Bearer ${admin}`).send({ action: 'send' });
    expect(send.status).toBe(200);
    const secrets = await q('SELECT text, status FROM character_secrets WHERE registry_character_id = :lala', ids);
    expect(secrets).toEqual([{ text: 'She rehearses what she will say to Vivienne.', status: 'candidate' }]);

    const keep = await request(app).post(`/api/v1/cast/talk/${sessionId}/items/${insight.id}`).set('Authorization', `Bearer ${admin}`).send({ action: 'keep' });
    expect(keep.body.session.review.items.map((i) => i.status)).toEqual(['applied', 'sent', 'kept']);
    const twice = await request(app).post(`/api/v1/cast/talk/${sessionId}/items/${insight.id}`).set('Authorization', `Bearer ${admin}`).send({ action: 'dismiss' });
    expect(twice.status).toBe(400);
  });

  it('a new session carries Dr. Sinclair\'s earlier note', async () => {
    mockCreate.mockResolvedValueOnce(reply('Better, I think.'));
    await request(app).post(`/api/v1/cast/characters/${ids.lala}/talk`).set('Authorization', `Bearer ${admin}`).send({ text: 'How was your week?' });
    expect(mockCreate.mock.calls[0][0].system).toContain('She wants Vivienne\'s approval more than she admits.');
    const list = await request(app).get(`/api/v1/cast/characters/${ids.lala}/talk`).set('Authorization', `Bearer ${admin}`);
    expect(list.body.can_talk).toBe(true);
    expect(list.body.sessions).toHaveLength(2);
  });

  it('JustAWoman\'s people and Dr. Sinclair herself cannot be talked to', async () => {
    const book = await request(app).post(`/api/v1/cast/characters/${ids.book}/talk`).set('Authorization', `Bearer ${admin}`).send({ text: 'Hello' });
    expect(book.status).toBe(400);
    const [dr] = await q("SELECT id FROM registry_characters WHERE character_key = 'amara_sinclair' AND deleted_at IS NULL");
    const self = await request(app).get(`/api/v1/cast/characters/${dr.id}/talk`).set('Authorization', `Bearer ${admin}`);
    expect(self.body.can_talk).toBe(false);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
