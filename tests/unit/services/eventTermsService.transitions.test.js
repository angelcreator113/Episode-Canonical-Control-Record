/**
 * eventTermsService — deliverable fulfilment rules (Task #1815, slice 1b).
 * A deliverable moves pending → completed → submitted → approved, only
 * forward and one step at a time; each move names the timestamp column it
 * stamps (docs/EVENT_EPISODE_FLOW.md §8(t) item 4). Pure; no database.
 */

const {
  nextDeliverableStatus,
  validateDeliverableTransition,
  DELIVERABLE_STATUS_FLOW,
  DELIVERABLE_STATUS_TIMESTAMP,
  TRANSITION_CODES,
} = require('../../../src/services/eventTermsService');

describe('DELIVERABLE_STATUS_FLOW', () => {
  test('is the model\'s four statuses, in order', () => {
    expect(DELIVERABLE_STATUS_FLOW).toEqual(['pending', 'completed', 'submitted', 'approved']);
  });

  test('each status after pending has its own timestamp column', () => {
    expect(DELIVERABLE_STATUS_TIMESTAMP).toEqual({
      completed: 'completed_at', submitted: 'submitted_at', approved: 'approved_at',
    });
  });
});

describe('nextDeliverableStatus', () => {
  test.each([
    ['pending', 'completed'],
    ['completed', 'submitted'],
    ['submitted', 'approved'],
    ['approved', null],
    ['bogus', null],
    [undefined, null],
  ])('%s → %s', (from, next) => {
    expect(nextDeliverableStatus(from)).toBe(next);
  });
});

describe('validateDeliverableTransition', () => {
  test.each([
    ['pending', 'completed', 'completed_at'],
    ['completed', 'submitted', 'submitted_at'],
    ['submitted', 'approved', 'approved_at'],
  ])('%s → %s is allowed and stamps %s', (from, to, column) => {
    expect(validateDeliverableTransition(from, to)).toEqual({ ok: true, timestampColumn: column });
  });

  test.each([
    ['pending', 'submitted'],
    ['pending', 'approved'],
    ['completed', 'approved'],
  ])('skipping %s → %s is refused', (from, to) => {
    const r = validateDeliverableTransition(from, to);
    expect(r.ok).toBe(false);
    expect(r.code).toBe(TRANSITION_CODES.SKIPPED);
    expect(r.code).toBe('DELIVERABLE_STATUS_SKIPPED');
  });

  test.each([
    ['completed', 'pending'],
    ['submitted', 'completed'],
    ['approved', 'submitted'],
    ['approved', 'pending'],
  ])('moving back %s → %s is refused', (from, to) => {
    const r = validateDeliverableTransition(from, to);
    expect(r.ok).toBe(false);
    expect(r.code).toBe('DELIVERABLE_STATUS_BACKWARD');
  });

  test.each(['pending', 'completed', 'submitted', 'approved'])('%s to itself (no move) is refused', (s) => {
    const r = validateDeliverableTransition(s, s);
    expect(r.ok).toBe(false);
    expect(r.code).toBe('DELIVERABLE_STATUS_UNCHANGED');
  });

  test.each([['pending', 'done'], ['pending', ''], ['pending', null], ['pending', 'APPROVED'], ['weird', 'completed']])(
    'unknown status %s → %s is refused',
    (from, to) => {
      const r = validateDeliverableTransition(from, to);
      expect(r.ok).toBe(false);
      expect(r.code).toBe('DELIVERABLE_STATUS_UNKNOWN');
      expect(typeof r.error).toBe('string');
    }
  );
});
