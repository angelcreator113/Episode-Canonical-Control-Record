'use strict';

const { effectiveState } = require('../../../src/aiGateway/stopState');

const NOW = 1_000_000;
const fresh = NOW - 100;
const stale = NOW - 10_000;

const DB = {
  released: { readable: true, state: 'RELEASED', version: 5, readAt: fresh, pauses: {} },
  stopped: { readable: true, state: 'STOPPED', version: 5, readAt: fresh, pauses: {} },
  resumePending: { readable: true, state: 'RESUME_PENDING', version: 5, readAt: fresh, pauses: {} },
  unreadable: { readable: false },
  stale: { readable: true, state: 'RELEASED', version: 5, readAt: stale, pauses: {} },
  missing: undefined,
};
const LOCAL = {
  released: { readable: true, stopped: false, readAt: fresh },
  stopped: { readable: true, stopped: true, readAt: fresh },
  unreadable: { readable: false, stopped: true },
  stale: { readable: true, stopped: false, readAt: stale },
  missing: undefined,
};
const ACK = { current: { version: 5 }, old: { version: 4 }, missing: undefined };

describe('effective Stop state: full matrix', () => {
  const rows = [];
  for (const [dk, db] of Object.entries(DB)) {
    for (const [lk, local] of Object.entries(LOCAL)) {
      for (const [ak, ack] of Object.entries(ACK)) rows.push([dk, lk, ak, db, local, ack]);
    }
  }

  test.each(rows)('db=%s local=%s ack=%s', (dk, lk, ak, db, local, ack) => {
    const r = effectiveState({ db, local, ack, now: NOW });
    const fullyVerifiedReleased = dk === 'released' && lk === 'released' && ak === 'current';
    // RELEASED appears ONLY when both states are verified released and acknowledged.
    expect(r.effective === 'RELEASED').toBe(fullyVerifiedReleased);
    expect(r.allowSubmissions).toBe(fullyVerifiedReleased);
    // Any source that says stopped wins.
    if (['stopped', 'resumePending'].includes(dk) || ['stopped', 'unreadable'].includes(lk)) expect(r.effective).toBe('STOPPED');
    // Never "resumed" while anything is unreadable, stale or unacknowledged.
    if (['unreadable', 'stale', 'missing'].includes(dk) || ['unreadable', 'stale', 'missing'].includes(lk)) expect(r.allowSubmissions).toBe(false);
  });
});

describe('effective Stop state: precedence and status reads', () => {
  test('a database Resume does not clear a local emergency stop', () => {
    const r = effectiveState({ db: DB.released, local: LOCAL.stopped, ack: ACK.current, now: NOW });
    expect(r.effective).toBe('STOPPED');
    expect(r.reasons).toContain('local_emergency_stop');
  });
  test('a local release does not clear a database Stop', () => {
    expect(effectiveState({ db: DB.stopped, local: LOCAL.released, ack: ACK.current, now: NOW }).effective).toBe('STOPPED');
    expect(effectiveState({ db: DB.resumePending, local: LOCAL.released, ack: ACK.current, now: NOW }).effective).toBe('STOPPED');
  });
  test('a paused service is stopped for that service only', () => {
    const db = { ...DB.released, pauses: { video: true } };
    expect(effectiveState({ db, local: LOCAL.released, ack: ACK.current, now: NOW, service: 'video' }).effective).toBe('STOPPED');
    expect(effectiveState({ db, local: LOCAL.released, ack: ACK.current, now: NOW, service: 'writing' }).effective).toBe('RELEASED');
  });
  test('status reads: allowed when the state is verified (even stopped); cached-only when unverified', () => {
    expect(effectiveState({ db: DB.stopped, local: LOCAL.released, ack: ACK.current, now: NOW }).statusMode).toBe('allowed');
    expect(effectiveState({ db: DB.unreadable, local: LOCAL.released, ack: ACK.current, now: NOW }).statusMode).toBe('cached_only');
    expect(effectiveState({ db: DB.released, local: LOCAL.stale, ack: ACK.current, now: NOW }).statusMode).toBe('cached_only');
  });
  test('a read timestamp in the future beyond the staleness window is not trusted', () => {
    const db = { ...DB.released, readAt: NOW + 60_000 };
    expect(effectiveState({ db, local: LOCAL.released, ack: ACK.current, now: NOW }).allowSubmissions).toBe(false);
  });
  test('an unknown database state value is unverified', () => {
    const db = { ...DB.released, state: 'MAYBE' };
    expect(effectiveState({ db, local: LOCAL.released, ack: ACK.current, now: NOW }).allowSubmissions).toBe(false);
  });
});
