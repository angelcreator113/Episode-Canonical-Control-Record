/**
 * teleprompterRemoteService (Teleprompter batch 3): only the token's sha256
 * is stored; a phone is looked up by that hash among live sessions; commands
 * come from a fixed list and bump command_seq in one UPDATE; the desktop
 * sees only its own session; a missing table is a 409 that says so.
 */
const crypto = require('crypto');
const remote = require('../../../src/services/teleprompterRemoteService');

const ID = '22222222-2222-4222-8222-222222222222';
const missing = () => Object.assign(new Error('relation "teleprompter_remote_sessions" does not exist'), { original: { code: '42P01', message: 'relation "teleprompter_remote_sessions" does not exist' } });

describe('pure pieces', () => {
  test('newToken is 32 random bytes (base64url); hashToken is its sha256', () => {
    const t = remote.newToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(t, 'base64url')).toHaveLength(32);
    expect(remote.hashToken(t)).toBe(crypto.createHash('sha256').update(t).digest('hex'));
    expect(remote.newToken()).not.toBe(t);
  });
  test('readCommand takes only the allowlist', () => {
    remote.COMMANDS.forEach((c) => expect(remote.readCommand(c)).toBe(c));
    ['', 'delete', 'TOGGLE', null, '__proto__'].forEach((c) => expect(() => remote.readCommand(c)).toThrow(/command must be one of/));
  });
  test('readToken: a malformed token reads as an ended session (410)', () => {
    expect(() => remote.readToken('short')).toThrow(expect.objectContaining({ status: 410 }));
    expect(() => remote.readToken(undefined)).toThrow(expect.objectContaining({ status: 410 }));
    expect(remote.readToken(` ${'a'.repeat(43)} `)).toBe('a'.repeat(43));
  });
  test('readState keeps only known fields, bounded', () => {
    const s = remote.readState({ running: true, beat: 8, beatName: 'x'.repeat(500), speed: 9999, evil: '<script>', pacing: 'warp' });
    expect(s).toMatchObject({ running: true, recording: false, beat: 8, speed: 100, pacing: null });
    expect(s.beatName).toHaveLength(120);
    expect(s).not.toHaveProperty('evil');
  });
});

describe('queries', () => {
  test('createSession stores the hash, never the token, and expires in two hours', async () => {
    const query = jest.fn(async () => [[{ id: ID, expires_at: 'later', command_seq: 0 }]]);
    const { session, token } = await remote.createSession({ query }, { userId: 'u1', episodeId: 'not-a-uuid' });
    expect(session.id).toBe(ID);
    const [sql, { replacements }] = query.mock.calls[0];
    expect(sql).toMatch(/INTERVAL '2 hours'/);
    expect(replacements).toEqual({ userId: 'u1', episodeId: null, tokenHash: remote.hashToken(token) });
    expect(JSON.stringify(query.mock.calls)).not.toContain(token);
  });

  test('addCommand finds the session by hash among live, unexpired ones and bumps the seq atomically', async () => {
    const query = jest.fn(async () => [[{ command_seq: 3, state: { running: true }, expires_at: 'later' }]]);
    const token = remote.newToken();
    const out = await remote.addCommand({ query }, { token, command: 'faster' });
    expect(out).toEqual({ seq: 3, state: { running: true }, expires_at: 'later' });
    const [sql, { replacements }] = query.mock.calls[0];
    expect(sql).toMatch(/command_seq = command_seq \+ 1/);
    expect(sql).toMatch(/WHERE token_hash = :tokenHash AND deleted_at IS NULL AND expires_at > NOW\(\)/);
    expect(replacements).toEqual({ tokenHash: remote.hashToken(token), command: 'faster' });
  });

  test('a token with no live session is a 410; a bad command never reaches the database', async () => {
    const query = jest.fn(async () => [[]]);
    await expect(remote.addCommand({ query }, { token: remote.newToken(), command: 'toggle' })).rejects.toMatchObject({ status: 410 });
    await expect(remote.stateByToken({ query: jest.fn(async () => [[]]) }, { token: remote.newToken() })).rejects.toMatchObject({ status: 410 });
    const never = jest.fn();
    await expect(remote.addCommand({ query: never }, { token: remote.newToken(), command: 'rm -rf' })).rejects.toMatchObject({ status: 400 });
    expect(never).not.toHaveBeenCalled();
  });

  test("commandsAfter: the owner's commands after a seq, in order; an expired or someone else's session is ended", async () => {
    const recent = [{ seq: 4, command: 'toggle', at: 't4' }, { seq: 2, command: 'faster', at: 't2' }, { seq: 3, command: 'bogus' }, { seq: 5, command: 'bigger', at: 't5' }];
    const query = jest.fn(async () => [[{ command_seq: 5, last_command: { recent }, expires_at: 'later', expired: false }]]);
    const out = await remote.commandsAfter({ query }, { id: ID, userId: 'u1', after: 2 });
    expect(out.commands.map((c) => c.seq)).toEqual([4, 5]);
    expect(out).toMatchObject({ seq: 5, ended: false });
    expect(query.mock.calls[0][0]).toMatch(/user_id = :userId AND deleted_at IS NULL/);
    expect(query.mock.calls[0][1].replacements).toEqual({ id: ID, userId: 'u1' });
    const none = await remote.commandsAfter({ query: jest.fn(async () => [[]]) }, { id: ID, userId: 'u2', after: 0 });
    expect(none).toMatchObject({ ended: true, commands: [] });
    const expired = await remote.commandsAfter({ query: jest.fn(async () => [[{ command_seq: 1, last_command: { recent }, expired: true }]]) }, { id: ID, userId: 'u1' });
    expect(expired).toMatchObject({ ended: true, commands: [] });
  });

  test('a missing table (42P01) is a 409 that says the update has not run', async () => {
    const query = jest.fn(async () => { throw missing(); });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(remote.createSession({ query }, { userId: 'u1' })).rejects.toMatchObject({ status: 409, code: 'MIGRATION_PENDING', message: remote.NOT_READY });
    await expect(remote.addCommand({ query }, { token: remote.newToken(), command: 'toggle' })).rejects.toMatchObject({ status: 409 });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
