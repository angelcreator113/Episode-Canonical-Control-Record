/**
 * The D1 reconciliation approval list holds exactly Evoni's approval of
 * 2026-09-29 (§8(y) Q9; Task #2250): the live show at 1900, with its four
 * test wardrobe purchases (1,440) voided. The deleted shows and the orphan
 * row have no entry.
 */
const { D1_RECONCILIATION_APPROVALS } = require('../../../src/config/d1ReconciliationApprovals');

describe('D1 reconciliation approvals (§8(y) Q9)', () => {
  it('holds exactly one approval: the live show at 1900', () => {
    expect(D1_RECONCILIATION_APPROVALS).toHaveLength(1);
    const [a] = D1_RECONCILIATION_APPROVALS;
    expect(a.show_id).toBe('9bd0655f-0426-4da4-95b8-44cdfd608b2b');
    expect(a.approved_balance).toBe(1900);
    expect(a.void_reason).toBeTruthy();
  });

  it('voids four distinct ledger rows', () => {
    const ids = D1_RECONCILIATION_APPROVALS[0].void_transaction_ids;
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
    ids.forEach((id) => expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/));
  });

  it('has no entry for the deleted shows or the orphan row', () => {
    const shows = D1_RECONCILIATION_APPROVALS.map((a) => a.show_id);
    ['bd52ee95', 'b1cff675', 'ae018fad'].forEach((prefix) => {
      expect(shows.some((s) => s.startsWith(prefix))).toBe(false);
    });
  });

  it('cannot be changed at run time', () => {
    expect(Object.isFrozen(D1_RECONCILIATION_APPROVALS)).toBe(true);
    expect(Object.isFrozen(D1_RECONCILIATION_APPROVALS[0])).toBe(true);
  });
});
