'use strict';

/**
 * The editor audit of 2026-11-03 (Part A), the parts held without a database:
 * - A5: the edit's reads run on one REPEATABLE READ snapshot, so the rows and
 *   the edit_revision they report belong together.
 * - A7: the legacy Timeline Editor's writes are closed (410) unless the
 *   server opens them, and then only for an admin; its GET writes nothing.
 */

const fs = require('fs');
const path = require('path');
const { Transaction } = require('sequelize');
const { legacyTimelineWritesOpen } = require('../../../src/utils/timelineSaveGuard');
const edit = require('../../../src/services/episodeEditService');

const ROOT = path.resolve(__dirname, '../../..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

describe('A5: one snapshot per read', () => {
  const STOP = new Error('stop');
  const fakeSequelize = () => {
    const calls = [];
    return {
      calls,
      transaction: (opts, fn) => { calls.push(typeof opts === 'function' ? {} : opts); return Promise.reject(STOP); },
    };
  };

  test.each([
    ['loadEdit', (s) => edit.loadEdit(s, { episodeId: '00000000-0000-4000-8000-000000000001' })],
    ['reviewReadiness', (s) => edit.reviewReadiness(s, { episodeId: '00000000-0000-4000-8000-000000000001' })],
    ['mixPlanOf', (s) => edit.mixPlanOf(s, { episodeId: '00000000-0000-4000-8000-000000000001' })],
  ])('%s opens a REPEATABLE READ transaction', async (_name, call) => {
    const s = fakeSequelize();
    await expect(call(s)).rejects.toBe(STOP);
    expect(s.calls).toEqual([{ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }]);
  });
});

describe('A7: the legacy timeline writes are closed', () => {
  const run = () => {
    const res = { code: null, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
    let passed = false;
    legacyTimelineWritesOpen({}, res, () => { passed = true; });
    return { res, passed };
  };
  const before = process.env.LEGACY_TIMELINE_WRITES;
  afterEach(() => { if (before === undefined) delete process.env.LEGACY_TIMELINE_WRITES; else process.env.LEGACY_TIMELINE_WRITES = before; });

  test('closed by default: 410 LEGACY_TIMELINE_RETIRED, nothing passes', () => {
    delete process.env.LEGACY_TIMELINE_WRITES;
    const { res, passed } = run();
    expect(passed).toBe(false);
    expect(res.code).toBe(410);
    expect(res.body.code).toBe('LEGACY_TIMELINE_RETIRED');
  });

  test('opened only by LEGACY_TIMELINE_WRITES=on', () => {
    process.env.LEGACY_TIMELINE_WRITES = 'true';
    expect(run().passed).toBe(false);
    process.env.LEGACY_TIMELINE_WRITES = 'on';
    expect(run().passed).toBe(true);
  });

  test('both writes sit behind the gate and then an admin check; the GET creates no row', () => {
    const episodes = read('src/routes/episodes.js');
    expect(episodes).toMatch(/'\/:id\/save',\s*validateUUIDParam\('id'\),\s*requireAuth,\s*require\('..\/utils\/timelineSaveGuard'\)\.legacyTimelineWritesOpen,\s*authorize\(\['ADMIN'\]\)/);
    const td = read('src/routes/timelineData.js');
    expect(td).toMatch(/router\.put\('\/:episodeId\/timeline-data',\s*validateUUIDParam\('episodeId'\),\s*requireAuth,\s*legacyTimelineWritesOpen,\s*authorize\(\['ADMIN'\]\)/);
    const get = td.slice(td.indexOf("router.get('/:episodeId/timeline-data'"), td.indexOf('router.put('));
    expect(get).not.toMatch(/\.create\(/);
  });
});
