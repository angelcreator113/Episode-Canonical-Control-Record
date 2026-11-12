'use strict';

/**
 * The one script save (A1c R1; docs/reads/2026-10-27-a1c-r1-spec.md §4.2):
 * C1 (text and version atomic), C2 (the revision), C3 (a generator's
 * revision), C9 (a genuine restore), C10 (line identities refused), the
 * overwrite guard under the lock, and lock-keeping left to each writer.
 * Recorder models stand in for Sequelize; the Postgres behaviour is in
 * tests/integration/scriptWriters.integration.test.js.
 */

const { saveEpisodeScript, ScriptSaveError, IDENTITY_WRITES, readScriptRevision } = require('../../../src/services/scriptSave');
const { scriptRevision } = require('../../../src/utils/scriptRevision');
const { scriptKeepingLocks } = require('../../../src/utils/scriptBeatLocks');

const SCRIPT = '## BEAT: 1 · Opening Ritual\nLala: "Hi besties."\n\n## BEAT: 2 · Creator Welcome\nPrime: "Welcome back."\n';
const VID = '11111111-2222-4333-8444-555555555555';

// An episode row, its versions and a transaction that rolls back on a throw.
function recorder(initial = {}, { versionFails = false, filmedAt = null } = {}) {
  const db = {
    episode: { id: 'ep-1', script_content: SCRIPT, script_locked_beats: [], script_line_keys: null, script_seq: '0', ...initial },
    versions: [],
  };
  const calls = { findByPk: [], updates: [], logs: [], seq: [], filmed: [] };
  const rowOf = () => {
    const data = db.episode;
    return {
      get id() { return data.id; },
      get script_content() { return data.script_content; },
      get script_locked_beats() { return data.script_locked_beats; },
      get(k) { return data[k]; },
      async update(vals, opts) { calls.updates.push({ vals, transaction: opts?.transaction || null }); Object.assign(data, vals); return this; },
    };
  };
  const EpisodeScriptVersion = {
    async findOne({ where }) {
      const rows = db.versions.filter((v) => v.episode_id === where.episode_id && (!where.id || v.id === where.id));
      return rows.length ? rows[rows.length - 1] : null;
    },
    async create(vals) {
      if (versionFails) throw new Error('version insert failed');
      const row = { id: `v-${db.versions.length + 1}`, ...vals };
      db.versions.push(row);
      return row;
    },
    async findAll() { return []; },
    async destroy() { return 0; },
  };
  const sequelize = {
    async transaction(fn) {
      const before = JSON.parse(JSON.stringify(db));
      const t = { LOCK: { UPDATE: 'UPDATE' }, afterCommit: () => {} };
      try { return await fn(t); } catch (err) { Object.assign(db, before); throw err; }
    },
    // The queries the save runs itself: whether the episode is filmed (asked
    // only of an episode that has a script), and the save number.
    async query(sql, { replacements, transaction }) {
      if (sql === 'SELECT MIN(created_at) AS frozen_at FROM episode_raw_clips WHERE episode_id = :episodeId') {
        calls.filmed.push({ id: replacements.episodeId, transaction: transaction || null });
        return [[{ frozen_at: filmedAt }], 1];
      }
      if (!/^UPDATE episodes SET script_seq = script_seq \+ 1 WHERE id = :episodeId RETURNING script_seq::text AS script_seq$/.test(sql)) throw new Error(`unexpected query: ${sql}`);
      calls.seq.push({ id: replacements.episodeId, transaction });
      db.episode.script_seq = (BigInt(db.episode.script_seq) + 1n).toString();
      return [[{ script_seq: db.episode.script_seq }], 1];
    },
  };
  const Episode = {
    sequelize,
    unscoped() { return Episode; },
    async findByPk(id, opts = {}) { calls.findByPk.push({ id, lock: opts.lock || null, attributes: opts.attributes || null }); return id === db.episode.id ? rowOf() : null; },
  };
  return { models: { Episode, EpisodeScriptVersion, sequelize }, db, calls };
}

const keep = (text) => (row) => {
  const locks = scriptKeepingLocks(row, text, { keepExtras: true });
  return { script: locks.script, kept: locks.changed, moved: locks.moved };
};
const refusalOf = async (promise) => { try { await promise; } catch (err) { return err; } throw new Error('expected a refusal'); };

let logSpy;
beforeEach(() => { logSpy = jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => { logSpy.mockRestore(); });

describe('saveEpisodeScript', () => {
  test('IDENTITY_WRITES is off in R1', () => {
    expect(IDENTITY_WRITES).toBe(false);
  });

  test('locks the row (unscoped, FOR UPDATE), keeps the replaced script, writes the text and never the line keys', async () => {
    const { models, db, calls } = recorder();
    const next = `${SCRIPT}Lala: "Bye."\n`;
    const saved = await saveEpisodeScript(models, 'ep-1', { writer: 'W1', source: 'save', revision: scriptRevision(SCRIPT), requireRevision: true, compose: keep(next) });
    expect(calls.findByPk[0]).toMatchObject({ id: 'ep-1', lock: 'UPDATE' });
    expect(db.episode.script_content).toBe(next);
    expect(db.versions).toHaveLength(1);
    expect(db.versions[0]).toMatchObject({ script_content: SCRIPT, source: 'save' });
    expect(calls.updates).toHaveLength(1);
    expect(Object.keys(calls.updates[0].vals)).toEqual(['script_content']);
    expect(saved.script_revision).toBe(scriptRevision(next));
    expect(db.episode.script_line_keys).toBeNull();
  });

  test('C2: a client write without a revision is refused, even on an empty script', async () => {
    for (const script of [SCRIPT, '', null]) {
      const { models, db, calls } = recorder({ script_content: script });
      const err = await refusalOf(saveEpisodeScript(models, 'ep-1', { requireRevision: true, compose: keep('x') }));
      expect(err).toBeInstanceOf(ScriptSaveError);
      expect(err.status).toBe(409);
      expect(err.body).toMatchObject({ success: false, code: 'SCRIPT_REVISION_REQUIRED', current_revision: scriptRevision(script) });
      expect(calls.updates).toHaveLength(0);
      expect(db.versions).toHaveLength(0);
    }
  });

  test('C2: a stale revision is refused with the current one', async () => {
    const { models, calls } = recorder();
    const err = await refusalOf(saveEpisodeScript(models, 'ep-1', { requireRevision: true, revision: scriptRevision('older'), compose: keep('x') }));
    expect(err.body).toMatchObject({ code: 'SCRIPT_CHANGED', current_revision: scriptRevision(SCRIPT) });
    expect(err.body.draft).toBeUndefined();
    expect(calls.updates).toHaveLength(0);
  });

  test('the initial-write contract: a new episode\'s empty-script revision saves its first script', async () => {
    const { models, db } = recorder({ script_content: '' });
    await saveEpisodeScript(models, 'ep-1', { requireRevision: true, revision: scriptRevision(''), compose: keep(SCRIPT) });
    expect(db.episode.script_content).toBe(SCRIPT);
  });

  test('C10: an episode with line identities is refused, nothing written', async () => {
    const { models, db, calls } = recorder({ script_line_keys: { v: 1, lines: [] } });
    const err = await refusalOf(saveEpisodeScript(models, 'ep-1', { revision: scriptRevision(SCRIPT, { v: 1, lines: [] }), requireRevision: true, compose: keep('x') }));
    expect(err.body).toMatchObject({ code: 'LINE_IDENTITY_ACTIVE' });
    expect(calls.updates).toHaveLength(0);
    expect(db.versions).toHaveLength(0);
    expect(db.episode.script_line_keys).toEqual({ v: 1, lines: [] });
  });

  test('C1: a version that can\'t be kept fails the save, and nothing changes', async () => {
    const { models, db, calls } = recorder({}, { versionFails: true });
    await expect(saveEpisodeScript(models, 'ep-1', { requireRevision: true, revision: scriptRevision(SCRIPT), compose: keep('new text') }))
      .rejects.toThrow('version insert failed');
    expect(db.episode.script_content).toBe(SCRIPT);
    expect(calls.updates).toHaveLength(0);
  });

  test('C3: a generator whose script changed while it ran gets its draft back, unsaved', async () => {
    const { models, db, calls } = recorder();
    const err = await refusalOf(saveEpisodeScript(models, 'ep-1', { writer: 'W10', source: 'generate', expectRevision: scriptRevision('what it read'), compose: () => ({ script: 'GENERATED' }) }));
    expect(err.body).toMatchObject({ code: 'SCRIPT_CHANGED', draft: 'GENERATED', saved: false, current_revision: scriptRevision(SCRIPT) });
    expect(calls.updates).toHaveLength(0);
    expect(db.versions).toHaveLength(0);
  });

  test('the overwrite guard is checked under the lock', async () => {
    const { models, calls } = recorder();
    const err = await refusalOf(saveEpisodeScript(models, 'ep-1', { guard: {}, compose: () => ({ script: 'GENERATED' }) }));
    expect(err.body).toMatchObject({ code: 'SCRIPT_OVERWRITE_CONFIRMATION_REQUIRED' });
    expect(calls.updates).toHaveLength(0);
    const ok = recorder();
    await saveEpisodeScript(ok.models, 'ep-1', { guard: { confirmOverwrite: true }, compose: () => ({ script: 'GENERATED' }) });
    expect(ok.db.episode.script_content).toBe('GENERATED');
  });

  test('skipIfScript leaves a script as it is, and an empty one is written', async () => {
    const has = recorder();
    const saved = await saveEpisodeScript(has.models, 'ep-1', { skipIfScript: true, compose: () => ({ script: 'SKELETON' }) });
    expect(saved.skipped).toBe(true);
    expect(has.calls.updates).toHaveLength(0);
    const empty = recorder({ script_content: '' });
    await saveEpisodeScript(empty.models, 'ep-1', { skipIfScript: true, compose: () => ({ script: 'SKELETON' }) });
    expect(empty.db.episode.script_content).toBe('SKELETON');
  });

  test('a missing episode is a 404 refusal', async () => {
    const { models } = recorder();
    const err = await refusalOf(saveEpisodeScript(models, 'ep-x', { compose: keep('x') }));
    expect(err.status).toBe(404);
    expect(err.body.code).toBe('EPISODE_NOT_FOUND');
  });

  test('lock-keeping is the writer\'s: a locked beat comes back as approved', async () => {
    const { models, db } = recorder({ script_locked_beats: [1] });
    const edited = SCRIPT.replace('Hi besties.', 'Changed.');
    const saved = await saveEpisodeScript(models, 'ep-1', { requireRevision: true, revision: scriptRevision(SCRIPT), compose: keep(edited) });
    expect(db.episode.script_content).toContain('Hi besties.');
    expect(saved.locked_beats_kept).toEqual([1]);
  });

  test('Approve writes the locks with the text, in the one update; a lock alone writes only the locks', async () => {
    const { models, calls } = recorder();
    await saveEpisodeScript(models, 'ep-1', { source: 'lock', requireRevision: true, revision: scriptRevision(SCRIPT), compose: () => ({ script: `${SCRIPT}x`, lockedBeats: [1] }) });
    expect(calls.updates).toHaveLength(1);
    expect(calls.updates[0].vals).toEqual({ script_content: `${SCRIPT}x`, script_locked_beats: [1] });
    const alone = recorder({ script_content: null });
    await saveEpisodeScript(alone.models, 'ep-1', { source: 'lock', requireRevision: true, revision: scriptRevision(null), compose: () => ({ script: '', lockedBeats: [2] }) });
    expect(alone.calls.updates[0].vals).toEqual({ script_locked_beats: [2] });
    expect(alone.db.episode.script_content).toBeNull();
  });

  describe('C9: a restore', () => {
    const OLD = '## BEAT: 1 · Opening Ritual\nLala: "An older opening."\n';
    const withVersion = (extra = {}) => {
      const r = recorder(extra);
      r.db.versions.push({ id: VID, episode_id: 'ep-1', script_content: OLD, source: 'save' });
      return r;
    };

    test('the server\'s copy of the version, put back as the page does, is a restore', async () => {
      const { models, db } = withVersion();
      const saved = await saveEpisodeScript(models, 'ep-1', { requireRevision: true, revision: scriptRevision(SCRIPT), restoredFrom: VID, compose: keep(OLD) });
      expect(saved.version_source).toBe('restore');
      expect(db.episode.script_content).toBe(OLD);
      expect(db.versions[db.versions.length - 1]).toMatchObject({ script_content: SCRIPT, source: 'restore' });
    });

    test('a version edited after it was put back is an ordinary save of the page\'s text', async () => {
      const { models, db } = withVersion();
      const edited = `${OLD}Lala: "And an edit."\n`;
      const saved = await saveEpisodeScript(models, 'ep-1', { requireRevision: true, revision: scriptRevision(SCRIPT), restoredFrom: VID, compose: keep(edited) });
      expect(saved.version_source).toBe('save');
      expect(db.episode.script_content).toBe(edited);
      expect(db.versions[db.versions.length - 1]).toMatchObject({ source: 'save' });
    });

    test('a version that is not this episode\'s, or not an id, is an ordinary save', async () => {
      for (const from of ['22222222-2222-4333-8444-555555555555', 'not-an-id', 42]) {
        const { models } = withVersion();
        const saved = await saveEpisodeScript(models, 'ep-1', { requireRevision: true, revision: scriptRevision(SCRIPT), restoredFrom: from, compose: keep(OLD) });
        expect(saved.version_source).toBe('save');
      }
    });
  });

  test('the identity plan is logged as counts after the write, and not for a refusal', async () => {
    const { models } = recorder();
    await saveEpisodeScript(models, 'ep-1', { writer: 'W1', requireRevision: true, revision: scriptRevision(SCRIPT), compose: keep(`${SCRIPT}Lala: "Bye."\n`) });
    const lines = logSpy.mock.calls.map((c) => String(c[0])).filter((l) => l.startsWith('[line-identity-plan]'));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('"writer":"W1"');
    expect(lines[0]).not.toContain('Bye');
    logSpy.mockClear();
    await refusalOf(saveEpisodeScript(models, 'ep-1', { requireRevision: true, compose: keep('x') }));
    expect(logSpy.mock.calls.filter((c) => String(c[0]).startsWith('[line-identity-plan]'))).toHaveLength(0);
  });

  test('a caller\'s transaction: the write is inside it, and the log waits for its commit', async () => {
    const { models, calls } = recorder();
    let committed;
    const t = { LOCK: { UPDATE: 'UPDATE' }, afterCommit: (fn) => { committed = fn; } };
    await saveEpisodeScript(models, 'ep-1', { requireRevision: true, revision: scriptRevision(SCRIPT), transaction: t, compose: keep('x') });
    expect(calls.updates[0].transaction).toBe(t);
    expect(logSpy.mock.calls.filter((c) => String(c[0]).startsWith('[line-identity-plan]'))).toHaveLength(0);
    committed();
    expect(logSpy.mock.calls.filter((c) => String(c[0]).startsWith('[line-identity-plan]'))).toHaveLength(1);
  });

  test('readScriptRevision reads the stored text and keys, unscoped', async () => {
    const { models, calls } = recorder();
    expect(await readScriptRevision(models, 'ep-1')).toBe(scriptRevision(SCRIPT));
    expect(calls.findByPk[0].attributes).toEqual(['id', 'script_content', 'script_line_keys']);
    expect(await readScriptRevision(models, 'ep-x')).toBeNull();
  });

  test('the plan log can never fail a save: a throwing logger, with or without the caller\'s transaction', async () => {
    const planLog = require('../../../src/services/identityPlanLog');
    const spy = jest.spyOn(planLog, 'logIdentityPlan').mockImplementation(() => { throw new Error('logger broke on "Velour"'); });
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    const own = recorder();
    const saved = await saveEpisodeScript(own.models, 'ep-1', { requireRevision: true, revision: scriptRevision(SCRIPT), compose: keep('x') });
    expect(saved.script_content).toBe('x');
    expect(own.db.episode.script_content).toBe('x');
    const theirs = recorder();
    let committed;
    const t = { LOCK: { UPDATE: 'UPDATE' }, afterCommit: (fn) => { committed = fn; } };
    await saveEpisodeScript(theirs.models, 'ep-1', { requireRevision: true, revision: scriptRevision(SCRIPT), transaction: t, compose: keep('y') });
    expect(() => committed()).not.toThrow();
    expect(err.mock.calls.map((c) => String(c[0])).every((m) => !m.includes('Velour'))).toBe(true);
    spy.mockRestore(); err.mockRestore();
  });

  test('the plan log off: the save logs nothing and saves as before', async () => {
    const before = process.env.SCRIPT_IDENTITY_PLAN_LOG;
    process.env.SCRIPT_IDENTITY_PLAN_LOG = 'off';
    try {
      const { models, db } = recorder();
      await saveEpisodeScript(models, 'ep-1', { requireRevision: true, revision: scriptRevision(SCRIPT), compose: keep('z') });
      expect(db.episode.script_content).toBe('z');
      expect(logSpy.mock.calls.filter((c) => String(c[0]).startsWith('[line-identity-plan]'))).toHaveLength(0);
    } finally {
      if (before === undefined) delete process.env.SCRIPT_IDENTITY_PLAN_LOG; else process.env.SCRIPT_IDENTITY_PLAN_LOG = before;
    }
  });

  test('the save number: one more for each save that changes the text (a clear and a restore of the same text included), none for a lock alone or a refusal', async () => {
    const { models, db, calls } = recorder();
    const save = async (text, extra = {}) => saveEpisodeScript(models, 'ep-1', { writer: 'W1', compose: () => ({ script: text }), ...extra });
    expect((await save(`${SCRIPT}x`)).script_seq).toBe('1');
    expect((await save('')).script_seq).toBe('2');
    expect((await save(SCRIPT)).script_seq).toBe('3');
    expect((await save('')).script_seq).toBe('4');
    expect((await save(SCRIPT)).script_seq).toBe('5');
    // The same text again, or the locks alone: no change, no number.
    expect((await save(SCRIPT)).script_seq).toBeNull();
    expect((await save(SCRIPT, { compose: () => ({ script: SCRIPT, lockedBeats: [1] }) })).script_seq).toBeNull();
    expect(db.episode.script_seq).toBe('5');
    // Each number was taken inside the save's transaction.
    expect(calls.seq.every((c) => c.transaction && c.id === 'ep-1')).toBe(true);
    // A refused or failed save takes none.
    await refusalOf(saveEpisodeScript(models, 'ep-1', { writer: 'W1', requireRevision: true, revision: 'sr1-0000000000000000000000000000000000000000', compose: () => ({ script: 'z' }) }));
    expect(db.episode.script_seq).toBe('5');
  });

  test('the save number past 2^53 comes back exact, as a decimal string', async () => {
    const { models } = recorder({ script_seq: '9007199254740993' });
    const out = await saveEpisodeScript(models, 'ep-1', { writer: 'W1', compose: () => ({ script: 'changed' }) });
    expect(out.script_seq).toBe('9007199254740994');
    expect(typeof out.script_seq).toBe('string');
  });

  test('the save number rolls back with a save whose version cannot be kept', async () => {
    const { models, db } = recorder({}, { versionFails: true });
    await refusalOf(saveEpisodeScript(models, 'ep-1', { writer: 'W1', compose: () => ({ script: 'other' }) }));
    expect(db.episode.script_seq).toBe('0');
  });

  test('every check runs under the row lock: the row is locked before the revision, the guard, the compose and the write', async () => {
    const { models, calls } = recorder();
    const order = [];
    const realFind = models.Episode.findByPk;
    models.Episode.findByPk = async (...a) => { order.push(`lock:${a[1]?.lock}`); return realFind(...a); };
    await saveEpisodeScript(models, 'ep-1', {
      requireRevision: true, revision: scriptRevision(SCRIPT), guard: { confirmOverwrite: true },
      compose: (row) => { order.push('compose'); return keep('w')(row); },
    });
    expect(order).toEqual(['lock:UPDATE', 'compose']);
    expect(calls.findByPk).toHaveLength(1);
  });

  // A filmed episode's script (Evoni, 2026-11-12).
  describe('a filmed episode', () => {
    const FILMED = '2026-11-01T10:00:00.000Z';
    const gen = (models, opts = {}) => saveEpisodeScript(models, 'ep-1', { writer: 'W10', source: 'generate', guard: { confirmOverwrite: true }, compose: () => ({ script: 'generated' }), ...opts });
    const edit = (models, opts = {}) => saveEpisodeScript(models, 'ep-1', { writer: 'W1', source: 'save', compose: () => ({ script: 'edited by hand' }), ...opts });

    test('a generator is refused, whatever the request confirms; nothing is written, kept or numbered', async () => {
      const { models, db, calls } = recorder({}, { filmedAt: FILMED });
      for (const opts of [{}, { filmedConfirm: 'ep-1' }, { guard: { confirmOverwrite: true, confirm_filmed_edit: 'ep-1' } }, { expectRevision: scriptRevision(SCRIPT) }]) {
        // eslint-disable-next-line no-await-in-loop
        const err = await refusalOf(gen(models, opts));
        expect(err.status).toBe(409);
        expect(err.body).toMatchObject({ success: false, code: 'FILMED_SCRIPT_PROTECTED', episode_id: 'ep-1', filmed_at: FILMED, saved: false });
      }
      expect(db.episode.script_content).toBe(SCRIPT);
      expect(db.versions).toEqual([]);
      expect(calls.updates).toEqual([]);
      expect(calls.seq).toEqual([]);
    });

    test('the generator is refused before its compose runs, and the filmed question is asked under the row lock', async () => {
      const { models, calls } = recorder({}, { filmedAt: FILMED });
      const compose = jest.fn(() => ({ script: 'generated' }));
      await refusalOf(gen(models, { compose }));
      expect(compose).not.toHaveBeenCalled();
      expect(calls.findByPk).toHaveLength(1);
      expect(calls.findByPk[0].lock).toBe('UPDATE');
      expect(calls.filmed).toHaveLength(1);
      expect(calls.filmed[0].transaction).toBeTruthy();
    });

    test("a person's edit needs this episode's own confirmation: none, another episode's, true and 'true' are all refused", async () => {
      const { models, db } = recorder({}, { filmedAt: FILMED });
      for (const filmedConfirm of [null, undefined, 'ep-2', true, 'true', '', 'EP-1']) {
        // eslint-disable-next-line no-await-in-loop
        const err = await refusalOf(edit(models, { filmedConfirm }));
        expect(err.status).toBe(409);
        expect(err.body).toMatchObject({ code: 'FILMED_SCRIPT_CONFIRMATION_REQUIRED', episode_id: 'ep-1', filmed_at: FILMED, current_revision: scriptRevision(SCRIPT) });
      }
      expect(db.episode.script_content).toBe(SCRIPT);
      expect(db.versions).toEqual([]);
    });

    test('with it, the edit is saved, the replaced script is kept as a version, and the next save must bring it again', async () => {
      const { models, db } = recorder({}, { filmedAt: FILMED });
      const out = await edit(models, { filmedConfirm: 'ep-1' });
      expect(out.script_content).toBe('edited by hand');
      expect(db.episode.script_content).toBe('edited by hand');
      expect(db.versions).toHaveLength(1);
      expect(db.versions[0].script_content).toBe(SCRIPT);
      expect(out.script_seq).toBe('1');
      // Nothing was remembered: the same save without the value is refused.
      const err = await refusalOf(saveEpisodeScript(models, 'ep-1', { writer: 'W1', source: 'save', compose: () => ({ script: 'a second edit' }) }));
      expect(err.body.code).toBe('FILMED_SCRIPT_CONFIRMATION_REQUIRED');
      expect(db.episode.script_content).toBe('edited by hand');
    });

    test('a lock alone, and a save of the same text, change no words and need no confirmation', async () => {
      const { models, db } = recorder({}, { filmedAt: FILMED });
      const out = await saveEpisodeScript(models, 'ep-1', { writer: 'W2', source: 'lock', compose: (row) => ({ script: row.script_content, lockedBeats: [1] }) });
      expect(out.script_seq).toBeNull();
      expect(db.episode.script_locked_beats).toEqual([1]);
      expect(db.episode.script_content).toBe(SCRIPT);
    });

    test("the Script Writer's Lock (manualApply) is a person's edit: confirmation required, then saved; without manualApply it is a generator", async () => {
      const { models, db } = recorder({}, { filmedAt: FILMED });
      const lock = (opts) => saveEpisodeScript(models, 'ep-1', { writer: 'W4', source: 'generate', guard: { confirmOverwrite: true }, compose: () => ({ script: 'a reviewed draft' }), ...opts });
      expect((await refusalOf(lock({}))).body.code).toBe('FILMED_SCRIPT_PROTECTED');
      expect((await refusalOf(lock({ manualApply: true }))).body.code).toBe('FILMED_SCRIPT_CONFIRMATION_REQUIRED');
      expect((await refusalOf(lock({ manualApply: true, filmedConfirm: 'ep-2' }))).body.code).toBe('FILMED_SCRIPT_CONFIRMATION_REQUIRED');
      expect(db.episode.script_content).toBe(SCRIPT);
      const out = await lock({ manualApply: true, filmedConfirm: 'ep-1' });
      expect(out.script_content).toBe('a reviewed draft');
      expect(out.version_source).toBe('generate');
    });

    test('manualApply does not skip the overwrite guard or the revision', async () => {
      const { models } = recorder({}, { filmedAt: FILMED });
      const base = { writer: 'W4', source: 'generate', manualApply: true, filmedConfirm: 'ep-1', compose: () => ({ script: 'a reviewed draft' }) };
      expect((await refusalOf(saveEpisodeScript(models, 'ep-1', { ...base, guard: {} }))).body.code).toBe('SCRIPT_OVERWRITE_CONFIRMATION_REQUIRED');
      expect((await refusalOf(saveEpisodeScript(models, 'ep-1', { ...base, guard: { confirmOverwrite: true }, requireRevision: true, revision: scriptRevision('stale') }))).body.code).toBe('SCRIPT_CHANGED');
    });

    test('a filmed episode with no script yet: a generator may write its first one, and the filmed question is not asked', async () => {
      for (const script_content of [null, '', '   \n']) {
        const { models, db, calls } = recorder({ script_content }, { filmedAt: FILMED });
        // eslint-disable-next-line no-await-in-loop
        const out = await gen(models);
        expect(out.script_content).toBe('generated');
        expect(db.episode.script_content).toBe('generated');
        expect(calls.filmed).toEqual([]);
      }
    });

    test('an episode that is not filmed: generators and edits save as before, with no confirmation', async () => {
      const a = recorder();
      expect((await gen(a.models)).script_content).toBe('generated');
      const b = recorder();
      expect((await edit(b.models)).script_content).toBe('edited by hand');
      // A confirmation sent for an unfilmed episode changes nothing.
      const c = recorder();
      expect((await edit(c.models, { filmedConfirm: 'ep-2' })).script_content).toBe('edited by hand');
    });

    test('skipIfScript still leaves a filmed script alone without an error (Start with no confirmOverwrite)', async () => {
      const { models, db } = recorder({}, { filmedAt: FILMED });
      const out = await gen(models, { guard: null, skipIfScript: true });
      expect(out.skipped).toBe(true);
      expect(db.episode.script_content).toBe(SCRIPT);
    });

    test('filmedScriptRefusal (the routes\' check before a model is asked) and filmedConfirmOf', async () => {
      const { filmedScriptRefusal, filmedConfirmOf } = require('../../../src/services/scriptSave');
      const filmed = recorder({}, { filmedAt: FILMED });
      expect(await filmedScriptRefusal(filmed.models.sequelize, { id: 'ep-1', script_content: SCRIPT }))
        .toEqual({ success: false, code: 'FILMED_SCRIPT_PROTECTED', error: expect.stringMatching(/filmed/), episode_id: 'ep-1', filmed_at: FILMED, saved: false });
      expect(await filmedScriptRefusal(filmed.models.sequelize, { id: 'ep-1', script_content: '' })).toBeNull();
      expect(await filmedScriptRefusal(recorder().models.sequelize, { id: 'ep-1', script_content: SCRIPT })).toBeNull();
      expect(await filmedScriptRefusal(filmed.models.sequelize, null)).toBeNull();
      expect(filmedConfirmOf({ confirm_filmed_edit: 'ep-1' })).toBe('ep-1');
      for (const body of [null, undefined, {}, { confirm_filmed_edit: true }, { confirm_filmed_edit: 1 }, { confirmFilmedEdit: 'ep-1' }]) expect(filmedConfirmOf(body)).toBeNull();
    });
  });
});
