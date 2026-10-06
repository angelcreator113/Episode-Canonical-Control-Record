import { describe, test, expect } from 'vitest';
import { estimateRows, moneyTiles, termsNote, lineCounts } from './episodeMoney';

const deal = (lines, extra = {}) => ({
  event: { id: 'ev-1', name: 'Studio Session' },
  lines,
  unplanned: [],
  projection: { projected_net: lines.reduce((s, l) => s + lineCounts(l), 0), actual_balance: 1900, projected_balance: 2339, conditional: [] },
  ...extra,
});
const reel = { key: 'content_fee|d-1', category: 'content_fee', label: 'Instagram Reel fee', kind: 'income', amount: 439, signed: 439, state: 'pending', trigger: 'on approval', payer: { who: 'brand', name: 'Sable' } };
const entry = { key: 'covered|c-1', category: 'event_cost', label: 'Entry / ticket', kind: 'expense', amount: 0, signed: 0, covered: true, covered_amount: 50, state: 'covered', trigger: null, payer: { who: 'host', name: null } };

describe('episodeMoney', () => {
  test("the mock's estimate: a reel fee, a comped entry and a deal with no bonus", () => {
    const rows = estimateRows(deal([reel, entry]));
    expect(rows.map((r) => [r.label, r.source, r.when, r.amountText, r.chip])).toEqual([
      ['Instagram Reel fee', 'Deal · Paid content · Paid by Sable', 'On approval', '+439', 'Pending'],
      ['Entry / ticket', 'Event cost · comped by the host', 'At Complete', '0', 'Comped 50'],
      ['Performance bonus', 'Deal', 'At Complete', '0', 'None in deal'],
    ]);
  });

  test('the tiles add up the rows; the net is the projected net', () => {
    const t = moneyTiles(deal([reel, entry]));
    expect(t.earns).toEqual({ total: 439, note: 'Instagram Reel fee, on approval' });
    expect(t.spends).toEqual({ total: 0, note: 'Nothing to pay; Entry / ticket is comped' });
    expect(t.net.total).toBe(439);
    expect(t.net.balance).toEqual({ now: 1900, after: 2339 });
  });

  test('a posted line counts its ledger row; a bonus not earned counts nothing', () => {
    expect(lineCounts({ ...reel, state: 'posted', posted: { signed: 400 } })).toBe(400);
    expect(lineCounts({ key: 'b', category: 'deal_bonus', signed: 200, conditional: true, state: 'not_earned' })).toBe(0);
  });

  test('no event, no deal: no bonus row and no terms note; after Complete the note says so', () => {
    expect(estimateRows({ event: null, lines: [], unplanned: [] })).toEqual([]);
    expect(termsNote({ event: null })).toBeNull();
    expect(termsNote({ event: { id: 'e' }, spending: { editable: false } })).toContain('The episode is complete');
  });
});
