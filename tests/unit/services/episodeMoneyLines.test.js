/**
 * Episode Money, Phase B (§8(gg) MB1–MB3 and Evoni's answers): the pure
 * line builder, episodeMoneyLines.
 */
const {
  plannedLines, buildMoneyLines, moneyWarnings, planSnapshot, reconcile, STATES, WARNING_CODES, RECON,
} = require('../../../src/services/episodeMoneyLines');

describe('episodeMoneyLines', () => {
  test('a legacy unpaid event: its entry cost is a line Lala pays at Complete', () => {
    const event = { id: 'ev-1', name: 'Old Gala', cost_coins: 100, is_paid: false, host: 'Old Host' };
    const plan = plannedLines({ event, hadSpending: true });
    expect(plan.map((l) => [l.category, l.amount, l.trigger, l.payer.who])).toEqual([
      ['event_entry', 100, 'at Complete', 'lala'],
    ]);
  });

  test('a legacy event that never had spending lines plans its styling extras', () => {
    const event = { id: 'ev-1', name: 'Old Gala', cost_coins: 0, is_free: true, prestige: 5 };
    const plan = plannedLines({ event, hadSpending: false });
    expect(plan.map((l) => l.category)).toEqual(['styling_extras']);
    expect(plannedLines({ event, hadSpending: true })).toEqual([]);
  });

  test('no event, no lines', () => {
    expect(plannedLines({ event: null })).toEqual([]);
  });

  test('a row matches its line by category and source; others are unplanned', () => {
    const plan = [
      { key: 'event_entry|ev-1', kind: 'expense', category: 'event_entry', amount: 100, conditional: false, covered: false, source: { id: 'ev-1' } },
      { key: 'event_spending|s-1', kind: 'expense', category: 'event_spending', amount: 30, conditional: false, covered: false, source: { id: 's-1' } },
    ];
    const rows = [
      { id: 'r1', category: 'event_entry', source_id: 'ev-1', amount: 100, signed: -100 },
      { id: 'r2', category: 'event_spending', source_id: 'other', amount: 30, signed: -30 },
    ];
    const { lines, unplanned, projection } = buildMoneyLines({ plan, rows, balance: 500 });
    expect(lines.map((l) => l.state)).toEqual([STATES.POSTED, STATES.PLANNED]);
    expect(unplanned.map((r) => r.id)).toEqual(['r2']);
    expect(projection).toEqual(expect.objectContaining({
      posted_net: -130, planned_net: -30, projected_net: -160, projected_balance: 470, open_count: 1,
    }));
  });

  test('a bonus row matches only the tier it was booked for', () => {
    const tierLine = (tier) => ({
      key: `deal_bonus|ev-1|${tier}`, kind: 'income', category: 'deal_bonus', amount: 100, tier,
      conditional: true, covered: false, source: { id: 'ev-1' },
    });
    const rows = [{ id: 'b1', category: 'deal_bonus', source_id: 'ev-1', metadata: '{"tier":"pass"}', amount: 100, signed: 100 }];
    const { lines, projection } = buildMoneyLines({ plan: [tierLine('slay'), tierLine('pass')], rows, completed: true });
    expect(lines.map((l) => [l.tier, l.state])).toEqual([['slay', STATES.NOT_EARNED], ['pass', STATES.POSTED]]);
    expect(projection.conditional).toEqual([]);
  });

  test('before Complete a bonus tier is planned, listed as conditional and never counted', () => {
    const plan = [{
      key: 'deal_bonus|ev-1|slay', kind: 'income', category: 'deal_bonus', label: 'Bonus (SLAY)', amount: 200, tier: 'slay',
      conditional: true, covered: false, source: { id: 'ev-1' },
    }];
    const { lines, projection } = buildMoneyLines({ plan, rows: [], balance: 10 });
    expect(lines[0].state).toBe(STATES.PLANNED);
    expect(projection.projected_net).toBe(0);
    expect(projection.projected_balance).toBe(10);
    expect(projection.conditional).toEqual([{ tier: 'slay', amount: 200, label: 'Bonus (SLAY)' }]);
  });

  describe('moneyWarnings (MB4, Q6)', () => {
    const cost = (key, amount, category = 'event_cost', state = STATES.PLANNED) => ({
      key, kind: 'expense', category, amount, signed: -amount, state, conditional: false, covered: false,
    });
    const income = (key, amount) => ({ key, kind: 'income', category: 'appearance_fee', amount, signed: amount, state: STATES.PLANNED, conditional: false, covered: false });

    test('nothing warns when the balance covers the costs and the projection stays above zero', () => {
      const lines = [cost('a', 50)];
      expect(moneyWarnings({ lines, balance: 100, projection: { projected_balance: 50 } })).toEqual([]);
    });

    test('costs above the balance warn with the shortfall, even when income would cover them', () => {
      const lines = [cost('a', 80), cost('s', 30, 'event_spending'), income('i', 500)];
      const [w] = moneyWarnings({ lines, balance: 100, projection: { projected_balance: 490 } });
      expect(w).toEqual(expect.objectContaining({
        code: WARNING_CODES.COSTS_EXCEED_BALANCE, shortfall: 10, costs: 110, spending: 30, have: 100, spending_alone: false,
      }));
      expect(w.message).toBe("This episode's costs and spending (110) are more than Lala has (100): 10 short if the income does not arrive.");
    });

    test('spending alone above the balance is named', () => {
      const lines = [cost('s', 120, 'event_spending')];
      const [w] = moneyWarnings({ lines, balance: 100, projection: { projected_balance: -20 } }).filter((x) => x.code === WARNING_CODES.COSTS_EXCEED_BALANCE);
      expect(w.spending_alone).toBe(true);
      expect(w.message).toBe('Event spending (120) is more than Lala has (100): 20 short before any income arrives.');
    });

    test('a projected balance below zero warns with its shortfall', () => {
      const ws = moneyWarnings({ lines: [], balance: 10, projection: { projected_balance: -40 } });
      expect(ws).toEqual([expect.objectContaining({ code: WARNING_CODES.PROJECTED_BELOW_ZERO, shortfall: 40 })]);
    });

    test('posted, covered and conditional lines are not open costs', () => {
      const lines = [
        cost('p', 500, 'event_cost', STATES.POSTED),
        { ...cost('c', 500), covered: true, state: STATES.COVERED },
      ];
      expect(moneyWarnings({ lines, balance: 10, projection: { projected_balance: 10 } })).toEqual([]);
    });
  });

  describe('planSnapshot and reconcile (MB6, Q7)', () => {
    const line = (over) => ({
      kind: 'income', category: 'appearance_fee', amount: 100, conditional: false, covered: false, state: STATES.PLANNED, ...over,
    });

    test('the snapshot keeps each line\'s plan fields and the balance', () => {
      const snap = planSnapshot({ lines: [line({ key: 'a', label: 'Fee', signed: 100, posted: null })], balance: 500, takenAt: '2026-10-01T00:00:00.000Z' });
      expect(snap).toEqual({
        taken_at: '2026-10-01T00:00:00.000Z',
        balance: 500,
        lines: [{ key: 'a', kind: 'income', category: 'appearance_fee', label: 'Fee', amount: 100, conditional: false, covered: false, state: STATES.PLANNED }],
      });
    });

    test('marks a bonus not earned, one earned, a fee outstanding, a line removed, a covered cost and an unplanned row', () => {
      const plan = [
        line({ key: 'bonus-slay', label: 'Bonus (SLAY)', category: 'deal_bonus', amount: 200, conditional: true, tier: 'slay' }),
        line({ key: 'bonus-pass', label: 'Bonus (PASS)', category: 'deal_bonus', amount: 50, conditional: true, tier: 'pass' }),
        line({ key: 'fee', label: 'Content fee', category: 'content_fee', amount: 120 }),
        line({ key: 'gone', label: 'Valet', kind: 'expense', category: 'event_spending', amount: 20 }),
        line({ key: 'ticket', label: 'Ticket', kind: 'expense', category: 'event_cost', amount: 0, covered: true, covered_amount: 40 }),
      ];
      const current = [
        { ...plan[0], state: STATES.NOT_EARNED, posted: null },
        { ...plan[1], state: STATES.POSTED, posted: { amount: 50, signed: 50 } },
        { ...plan[2], state: STATES.PENDING, posted: null },
        { ...plan[4], state: STATES.COVERED, posted: null },
      ];
      const unplanned = [{ id: 'r9', category: 'wardrobe_purchase', description: 'Purchase: Gown', signed: -90 }];

      const { rows, totals, highlighted } = reconcile({ plan, lines: current, unplanned });
      const status = Object.fromEntries(rows.map((r) => [r.label, r.status]));
      expect(status).toEqual({
        'Bonus (SLAY)': RECON.NOT_EARNED,
        'Bonus (PASS)': RECON.EARNED,
        'Content fee': RECON.OUTSTANDING,
        Valet: RECON.REMOVED,
        Ticket: RECON.COVERED,
        'Purchase: Gown': RECON.UNPLANNED,
      });
      expect(rows.find((r) => r.label === 'Content fee').pending).toBe(true);
      expect(rows.find((r) => r.label === 'Bonus (SLAY)')).toEqual(expect.objectContaining({ planned: 0, planned_conditional: 200, posted: null }));
      // Conditional bonuses are never in the planned net (Q3); the earned one is posted.
      expect(totals).toEqual({ planned_net: 120 - 20, posted_net: 50 - 90, difference: (50 - 90) - (120 - 20) });
      expect(highlighted).toBe(4); // not earned, outstanding, removed, unplanned
    });
  });
});
