/**
 * 20261020120000-create-teleprompter-remote-and-voice-clips (Teleprompter
 * batch 3): two new tables, each with UUID ids, timestamps and deleted_at;
 * the token's hash unique; one live voice clip per line (a partial unique
 * index). Guarded: tables created only when absent, indexes IF NOT EXISTS;
 * down drops both when present.
 */
const migration = require('../../../src/migrations/20261020120000-create-teleprompter-remote-and-voice-clips');

function makeQI(tables = []) {
  const have = new Set(tables);
  const transaction = jest.fn(async (fn) => fn('tx'));
  const query = jest.fn(async (sql, opts = {}) => {
    if (/to_regclass/.test(sql)) return [[{ reg: have.has(opts.replacements.name.replace('public.', '')) ? opts.replacements.name : null }]];
    return [[], 0];
  });
  const qi = {
    sequelize: { query, transaction },
    createTable: jest.fn(async (name) => have.add(name)),
    dropTable: jest.fn(async (name) => have.delete(name)),
  };
  return { qi, have, transaction, query };
}
const S = {
  UUID: 'UUID', STRING: (n) => `STRING(${n})`, DATE: 'DATE', JSONB: 'JSONB', INTEGER: 'INTEGER', TEXT: 'TEXT',
  DECIMAL: (a, b) => `DECIMAL(${a},${b})`, BIGINT: 'BIGINT', literal: (v) => ({ literal: v }),
};

describe('teleprompter remote + voice clips migration', () => {
  test('up creates both tables with their columns, in one transaction', async () => {
    const { qi, transaction } = makeQI();
    await migration.up(qi, S);
    expect(transaction).toHaveBeenCalledTimes(1);
    const [[remoteName, remote, remoteOpts], [voiceName, voice]] = qi.createTable.mock.calls;
    expect(remoteName).toBe('teleprompter_remote_sessions');
    expect(remoteOpts).toEqual({ transaction: 'tx' });
    expect(Object.keys(remote)).toEqual(['id', 'user_id', 'episode_id', 'token_hash', 'expires_at', 'last_command', 'command_seq', 'state', 'created_at', 'updated_at', 'deleted_at']);
    expect(remote.id).toMatchObject({ type: 'UUID', primaryKey: true, defaultValue: { literal: 'gen_random_uuid()' } });
    expect(remote.command_seq).toMatchObject({ type: 'INTEGER', allowNull: false, defaultValue: 0 });
    expect(remote.token_hash).toMatchObject({ type: 'STRING(64)', allowNull: false });
    expect(remote.episode_id).toMatchObject({ allowNull: true, references: { model: 'episodes', key: 'id' } });
    expect(remote.deleted_at).toMatchObject({ allowNull: true });
    expect(voiceName).toBe('script_voice_clips');
    expect(Object.keys(voice)).toEqual(['id', 'episode_id', 'beat_number', 'line_index', 'speaker', 'line_text', 's3_key', 'url', 'content_type', 'duration_seconds', 'file_size_bytes', 'created_by', 'created_at', 'updated_at', 'deleted_at']);
    expect(voice.episode_id).toMatchObject({ allowNull: false, references: { model: 'episodes', key: 'id' }, onDelete: 'CASCADE' });
  });

  test('indexes: the token hash unique, one live clip per line', async () => {
    const { qi, query } = makeQI();
    await migration.up(qi, S);
    const sql = query.mock.calls.map(([q]) => q).filter((q) => /INDEX/.test(q));
    expect(sql.every((q) => /IF NOT EXISTS/.test(q))).toBe(true);
    expect(sql.some((q) => /UNIQUE INDEX IF NOT EXISTS teleprompter_remote_sessions_token_hash ON teleprompter_remote_sessions \(token_hash\)/.test(q))).toBe(true);
    expect(sql.some((q) => /UNIQUE INDEX IF NOT EXISTS script_voice_clips_one_live_per_line ON script_voice_clips \(episode_id, beat_number, line_index\)\s+WHERE deleted_at IS NULL/.test(q))).toBe(true);
    query.mock.calls.forEach(([q, opts]) => expect(opts.transaction).toBe('tx'));
    query.mock.calls.forEach(([q]) => expect(q).not.toMatch(/CREATE TABLE/i));
  });

  test('up is idempotent: tables already there are not created again', async () => {
    const { qi } = makeQI(['teleprompter_remote_sessions', 'script_voice_clips']);
    await migration.up(qi, S);
    expect(qi.createTable).not.toHaveBeenCalled();
    const half = makeQI(['teleprompter_remote_sessions']);
    await migration.up(half.qi, S);
    expect(half.qi.createTable.mock.calls.map(([n]) => n)).toEqual(['script_voice_clips']);
  });

  test('down drops both, and does nothing when they are gone', async () => {
    const { qi, have } = makeQI(['teleprompter_remote_sessions', 'script_voice_clips', 'episodes']);
    await migration.down(qi);
    expect([...have]).toEqual(['episodes']);
    const gone = makeQI([]);
    await migration.down(gone.qi);
    expect(gone.qi.dropTable).not.toHaveBeenCalled();
  });
});
