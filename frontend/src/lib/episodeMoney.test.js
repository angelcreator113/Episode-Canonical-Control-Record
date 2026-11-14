import { describe, test, expect } from 'vitest';
import { estimateRows, moneyTiles, termsNote, lineCounts, deliverableFeeNote } from './episodeMoney';

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
      ['Entry / ticket', 'Event cost · comped by the host', 'Not charged', '0', 'Comped 50'],
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

  test("the look's pieces are one \"Lala's look\" row at Finalize, Planned until every piece has posted", () => {
    const gown = { key: 'wardrobe_purchase|w1', category: 'wardrobe_purchase', label: 'Gold Gown', kind: 'expense', amount: 200, signed: -200, state: 'planned', trigger: 'at Finalize', look: true, source: { type: 'wardrobe', id: 'w1' }, payer: { who: 'lala' } };
    const clutch = { ...gown, key: 'wardrobe_purchase|w2', label: 'Pearl Clutch', amount: 50, signed: -50, state: 'posted', posted: { signed: -50 }, source: { type: 'wardrobe', id: 'w2' } };
    const money = deal([reel, entry, gown, clutch], { look: { pieces: 3 } });
    const rows = estimateRows(money);
    expect(rows.map((r) => r.label)).toEqual(['Instagram Reel fee', 'Entry / ticket', "Lala's look", 'Performance bonus']);
    expect(rows[2]).toMatchObject({ source: 'Wardrobe · 1 to buy, 1 bought', when: 'At Finalize', amountText: '−250', chip: 'Planned', pieces: ['Gold Gown', 'Pearl Clutch'] });
    expect(moneyTiles(money).spends).toEqual({ total: -250, note: "Lala's look; Entry / ticket is comped" });
    expect(estimateRows(deal([{ ...clutch }], { look: { pieces: 1 } }))[0]).toMatchObject({ chip: 'Posted', source: 'Wardrobe · 1 bought' });
  });

  test('a look not chosen reads Not chosen; one with nothing to pay reads Nothing to pay (owned, gifted or borrowed); neither counts', () => {
    const notChosen = estimateRows(deal([reel], { look: { pieces: 0 } })).find((r) => r.key === 'look');
    expect(notChosen).toMatchObject({ amountText: '—', chip: 'Not chosen', counts: 0 });
    const owned = estimateRows(deal([reel], { look: { pieces: 2 } })).find((r) => r.key === 'look');
    expect(owned).toMatchObject({ amountText: '0', chip: 'Nothing to pay', source: 'Wardrobe · nothing to buy or rent' });
    expect(estimateRows(deal([reel])).some((r) => r.key === 'look')).toBe(false); // an API without look: no row
  });

  test('the terms note is only for an event with deal terms', () => {
    expect(termsNote({ event: { id: 'e', deal: false }, spending: { editable: true } })).toBeNull();
    expect(termsNote({ event: { id: 'e', deal: true }, spending: { editable: true } })).toMatch(/still a draft/);
  });
});

// A2 (Evoni, 2026-11-14): compensation no accepted agreement owes is shown
// as proposed, and never as money.
describe('episodeMoney: compensation that is not owed', () => {
  const fee = { key: 'appearance_fee|ev-1', category: 'appearance_fee', label: 'Appearance fee', kind: 'income', amount: 450, signed: 450, state: 'not_owed', not_owed_reason: 'owner_closed', trigger: 'at Complete', payer: { who: 'brand', name: 'Maison Belle' } };
  const cost = { key: 'event_cost|c-1', category: 'event_cost', label: 'Car to the gala', kind: 'expense', amount: 80, signed: -80, state: 'planned', trigger: 'at Finalize', payer: { who: 'lala' } };
  const money = { event: { id: 'ev-1', name: 'Velour Night' }, lines: [fee, cost], unplanned: [], projection: { projected_net: -80, actual_balance: 1000, projected_balance: 920, conditional: [] } };

  test('a not-owed line counts nothing, says what was proposed, and says why', () => {
    expect(lineCounts(fee)).toBe(0);
    const row = estimateRows(money).find((r) => r.label === 'Appearance fee');
    expect(row.amount).toBe(0);
    expect(row.amountText).toBe('0 (proposed 450)');
    expect(row.chip).toBe('Not owed: the offer was declined or closed');
    expect(row.chipKind).toBe('not_owed');
  });

  test('with no reason it still reads Not owed', () => {
    const row = estimateRows({ ...money, lines: [{ ...fee, not_owed_reason: null }] }).find((r) => r.label === 'Appearance fee');
    expect(row.chip).toBe('Not owed');
    expect(row.amountText).toBe('0 (proposed 450)');
  });

  test('the tiles earn nothing from it; her cost is still counted', () => {
    const t = moneyTiles(money);
    expect(t.earns.total).toBe(0);
    expect(t.spends.total).toBe(-80);
    expect(t.net.total).toBe(-80);
  });
});

describe('deliverableFeeNote: approval and the fee are separate', () => {
  test('booked says the amount booked', () => {
    expect(deliverableFeeNote({ fee_state: 'booked', proposed_fee: 120, booked_fee: 120 })).toEqual({ kind: 'booked', text: 'Booked 120' });
  });
  test('not owed says so, why, and what was only proposed', () => {
    expect(deliverableFeeNote({ fee_state: 'not_owed', fee_reason: 'owner_not_accepted', proposed_fee: 1200, booked_fee: null }))
      .toEqual({ kind: 'not_owed', text: 'Fee not booked: the offer is not accepted (proposed 1,200)' });
    expect(deliverableFeeNote({ fee_state: 'not_owed', fee_reason: null, proposed_fee: 120 }).text).toBe('Fee not booked (proposed 120)');
  });
  test('unresolved says what has to happen first', () => {
    expect(deliverableFeeNote({ fee_state: 'unresolved', fee_reason: 'no_owner', proposed_fee: 120 }))
      .toEqual({ kind: 'unresolved', text: 'The fee cannot be booked until the offers on this event are resolved' });
  });
  test('approved with nothing booked and no recorded reason is still not worded as earned', () => {
    expect(deliverableFeeNote({ fee_state: 'not_booked', proposed_fee: 120 }).text).toBe('Fee not booked (proposed 120)');
  });
  test('nothing to add for no fee, a fee that books on approval, or a row from before A2', () => {
    for (const d of [{ fee_state: 'none' }, { fee_state: 'expected', proposed_fee: 120 }, { fee: 120 }, null]) expect(deliverableFeeNote(d)).toBeNull();
  });
  test('no wording calls a proposed fee earned or paid', () => {
    for (const fee_state of ['not_owed', 'unresolved', 'not_booked']) {
      expect(deliverableFeeNote({ fee_state, proposed_fee: 120 }).text).not.toMatch(/earned|paid|income/i);
    }
  });
});
