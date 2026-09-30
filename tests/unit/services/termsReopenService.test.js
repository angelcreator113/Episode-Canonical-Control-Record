/**
 * Reopen terms (Evoni's Reopen terms ruling, docs/EVENT_EPISODE_FLOW.md
 * §8(cc), 2026-09-30; Task #2378): the eligibility rules, and the relock's
 * rebuild with Start Episode's own functions. The database path is in
 * tests/integration/termsReopen.integration.test.js.
 */

const {
  eligibilityReasons, reopenEligibility, planTermsRebuild, regenerateOffer, changedTerms, termsState, relockTerms,
} = require('../../../src/services/termsReopenService');
const { buildTermsSnapshot } = require('../../../src/services/eventTermsService');
const { calculateFinancials } = require('../../../src/services/episodeGeneratorService');

const LOCK = { id: 'ep-1', title: 'Gala Night', episode_number: 3 };

describe('eligibilityReasons — the ruling\'s test', () => {
  it('a draft episode with no ledger rows and every deliverable pending is eligible', () => {
    expect(eligibilityReasons({ lockEpisode: LOCK, episodeStatus: 'draft', ledgerRows: 0, nonPendingDeliverables: 0 })).toEqual([]);
  });

  it('terms that are not locked are not reopened', () => {
    expect(eligibilityReasons({ lockEpisode: null }).map((r) => r.code)).toEqual(['NOT_LOCKED']);
  });

  it('an episode that is not a draft', () => {
    const [reason] = eligibilityReasons({ lockEpisode: LOCK, episodeStatus: 'published' });
    expect(reason).toEqual({ code: 'EPISODE_NOT_DRAFT', message: 'The episode is published, not a draft.' });
  });

  it('ledger rows besides wardrobe purchases', () => {
    const [reason] = eligibilityReasons({ lockEpisode: LOCK, episodeStatus: 'draft', ledgerRows: 2 });
    expect(reason).toEqual({ code: 'LEDGER_ROWS', message: 'The episode has 2 ledger rows besides wardrobe purchases.' });
  });

  it('a deliverable past pending', () => {
    const [reason] = eligibilityReasons({ lockEpisode: LOCK, episodeStatus: 'draft', nonPendingDeliverables: 1 });
    expect(reason).toEqual({ code: 'DELIVERABLES_NOT_PENDING', message: '1 deliverable has moved past pending.' });
  });

  it('lists every rule that fails', () => {
    const codes = eligibilityReasons({ lockEpisode: LOCK, episodeStatus: 'in_build', ledgerRows: 1, nonPendingDeliverables: 3 }).map((r) => r.code);
    expect(codes).toEqual(['EPISODE_NOT_DRAFT', 'LEDGER_ROWS', 'DELIVERABLES_NOT_PENDING']);
  });
});

// A stand-in for sequelize: each query is answered by the first matching
// pattern, and every call is recorded.
function fakeSequelize(answers) {
  const calls = [];
  return {
    calls,
    QueryTypes: { SELECT: 'SELECT' },
    query: jest.fn(async (sql, opts = {}) => {
      calls.push({ sql, opts });
      const hit = answers.find(([pattern]) => pattern.test(sql));
      const rows = hit ? (typeof hit[1] === 'function' ? hit[1](sql, opts) : hit[1]) : [];
      return opts.type === 'SELECT' ? rows : [rows, { rowCount: rows.length }];
    }),
    transaction: jest.fn(async (fn) => fn({ id: 'tx' })),
  };
}

describe('reopenEligibility', () => {
  it('counts the ledger with NOT_WARDROBE_SPEND_ROW and the deliverables not pending', async () => {
    const db = fakeSequelize([
      [/FROM world_events/, [{ canon_consequences: {} }]],
      [/FROM episodes/, [{ status: 'draft' }]],
      [/FROM financial_transactions/, [{ cnt: '1' }]],
      [/FROM event_deliverables/, [{ cnt: '0' }]],
    ]);
    const check = await reopenEligibility(db, 'ev-1', { lockEpisode: LOCK });
    expect(check.eligible).toBe(false);
    expect(check.reasons.map((r) => r.code)).toEqual(['LEDGER_ROWS']);
    const ledgerSql = db.calls.find((c) => /financial_transactions/.test(c.sql)).sql;
    expect(ledgerSql).toMatch(/NOT IN \('select', 'lock_outfit', 'purchase'\)/);
    expect(ledgerSql).toMatch(/deleted_at IS NULL/);
    expect(db.calls.find((c) => /event_deliverables/.test(c.sql)).sql).toMatch(/COALESCE\(status, 'pending'\) <> 'pending'/);
  });

  it('reports an open reopen marker', async () => {
    const db = fakeSequelize([
      [/FROM world_events/, [{ canon_consequences: { terms_reopen: { at: 'then', episode_id: 'ep-1' } } }]],
      [/FROM episodes/, [{ status: 'draft' }]],
      [/COUNT/, [{ cnt: 0 }]],
    ]);
    const check = await reopenEligibility(db, 'ev-1', { lockEpisode: LOCK });
    expect(check.eligible).toBe(true);
    expect(check.reopened).toEqual({ at: 'then', episode_id: 'ep-1' });
  });
});

describe('planTermsRebuild — Start Episode\'s functions, rerun', () => {
  const event = { id: 'ev-1', is_paid: true, payment_amount: 900, cost_coins: 100, event_type: 'invite', requirements: {}, restrictions: [] };
  const deliverables = [
    { id: 'd1', description: 'One reel', required: true, owed_to: 'host', status: 'pending' },
    { id: 'd2', description: 'Three stories', required: true, owed_to: 'brand', status: 'pending' },
  ];

  it('rebuilds the snapshot, the warning, the deliverable tasks and the money; keeps the rest', () => {
    const plan = planTermsRebuild({
      event,
      deliverables,
      briefEventMetadata: { host_brand: 'Velvet', terms: { old: true }, affordability_warning: null },
      socialTasks: [
        { slot: 'arrival', label: 'Arrive', completed: true },
        { slot: 'deliverable_d1', deliverable_id: 'd1', label: 'One reel', completed: true },
        { slot: 'deliverable_gone', deliverable_id: 'gone', label: 'Removed', completed: false },
      ],
      wardrobeItems: [{ coin_cost: 50, acquisition_type: 'purchased' }],
      affordabilityWarning: { coins_needed: 100, coins_available: 10, shortfall: 90 },
    });

    expect(plan.eventMetadata).toEqual({
      host_brand: 'Velvet',
      terms: buildTermsSnapshot(event, deliverables),
      affordability_warning: { coins_needed: 100, coins_available: 10, shortfall: 90 },
    });
    expect(plan.socialTasks.map((t) => t.deliverable_id || t.slot)).toEqual(['arrival', 'd1', 'd2']);
    expect(plan.socialTasks.find((t) => t.deliverable_id === 'd1').completed).toBe(true);
    expect(plan.socialTasks.find((t) => t.deliverable_id === 'd2')).toMatchObject({ required: true, task_source: 'brand_deliverable', completed: false });
    expect(plan.financials).toEqual(calculateFinancials(event, [{ coin_cost: 50, acquisition_type: 'purchased' }]));
    expect(plan.episodeTotals).toEqual({ total_income: 900, total_expenses: 150, financial_score: 7 });
  });

  it('an episode without a todo list gets no task list', () => {
    expect(planTermsRebuild({ event, deliverables, socialTasks: null }).socialTasks).toBeNull();
  });
});

describe('changedTerms', () => {
  it('names the locked fields, deliverables and costs that changed since the reopen', () => {
    const before = termsState({ payment_amount: 200, is_paid: true, restrictions: [] }, [{ id: 'd1', description: 'Reel' }], []);
    const changed = changedTerms(before, { payment_amount: '900', is_paid: 'true', restrictions: null },
      [{ id: 'd1', description: 'Reel' }], [{ id: 'c1', amount: 10 }]);
    expect(changed).toEqual(['payment_amount', 'costs']);
  });
});

describe('regenerateOffer — offered, never forced', () => {
  it('reminds when the terms changed and mention money', () => {
    const offer = regenerateOffer({
      event: { is_paid: true, payment_amount: 500, invitation_asset_id: 'a1' },
      costs: [], deliverables: [], hasScript: true, changedFields: ['payment_amount'],
    });
    expect(offer.invitation).toEqual({ offered: true, mentionsMoney: true, reminder: 'Terms changed; the invitation mentions money. Regenerate?' });
    expect(offer.script).toEqual({ offered: true, mentionsMoney: true, reminder: 'Terms changed; the script mentions money. Regenerate?' });
  });

  it('no reminder for comped terms, or when nothing changed; nothing offered when there is nothing to regenerate', () => {
    const comped = regenerateOffer({ event: { deal_type: 'invited_comped', invitation_asset_id: 'a1' }, costs: [], deliverables: [], hasScript: false, changedFields: ['deal_type'] });
    expect(comped.invitation).toEqual({ offered: true, mentionsMoney: false, reminder: null });
    expect(comped.script.offered).toBe(false);
    const unchanged = regenerateOffer({ event: { cost_coins: 30, invitation_asset_id: 'a1' }, costs: [], deliverables: [], hasScript: true, changedFields: [] });
    expect(unchanged.invitation).toEqual({ offered: true, mentionsMoney: true, reminder: null });
  });
});

describe('relockTerms — orchestration', () => {
  it('refuses when the terms are not reopened, writing nothing', async () => {
    const db = fakeSequelize([
      [/FROM episode_briefs b/, [{ id: 'ep-1', title: 'Gala', episode_number: 1 }]],
      [/FROM world_events WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL FOR UPDATE/, [{ id: 'ev-1', canon_consequences: {} }]],
    ]);
    const result = await relockTerms(db, { showId: 's1', eventId: 'ev-1', user: { id: 'u1' } });
    expect(result.status).toBe(409);
    expect(result.body.code).toBe('TERMS_NOT_REOPENED');
    expect(db.calls.some((c) => /^\s*UPDATE/.test(c.sql))).toBe(false);
  });

  it('locks the episode then the event, rebuilds each piece and clears the marker in one transaction', async () => {
    const event = {
      id: 'ev-1', show_id: 's1', is_paid: true, payment_amount: 900, cost_coins: 0, requirements: {}, restrictions: [],
      canon_consequences: { automation: { kept: 1 }, terms_reopen: { at: 't0', before: termsState({ is_paid: true, payment_amount: 200, requirements: {}, restrictions: [] }, [], []) }, terms_history: [{ action: 'terms_reopened' }] },
    };
    const db = fakeSequelize([
      [/FROM episode_briefs b/, [{ id: 'ep-1', title: 'Gala', episode_number: 1 }]],
      [/FROM episodes WHERE id = :episodeId FOR UPDATE/, [{ id: 'ep-1' }]],
      [/FROM world_events WHERE id = :eventId AND show_id = :showId AND deleted_at IS NULL FOR UPDATE/, [event]],
      [/FROM event_deliverables/, []],
      [/FROM event_costs/, []],
      [/FROM wardrobe/, []],
      [/FROM character_state/, [{ coins: 1000 }]],
      [/SELECT id, event_metadata FROM episode_briefs/, [{ id: 'br-1', event_metadata: { host_brand: 'V' } }]],
      [/SELECT id, social_tasks FROM episode_todo_lists/, [{ id: 'td-1', social_tasks: [] }]],
      [/SELECT script_content/, [{ script_content: 'INT. GALA' }]],
    ]);

    const result = await relockTerms(db, { showId: 's1', eventId: 'ev-1', user: { id: 'u1', name: 'Evoni' } });

    expect(result.status).toBe(200);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    const sqls = db.calls.map((c) => c.sql);
    const idx = (re) => sqls.findIndex((s) => re.test(s));
    expect(idx(/FROM episodes WHERE id = :episodeId FOR UPDATE/)).toBeLessThan(idx(/FROM world_events .* FOR UPDATE/));
    const writes = db.calls.filter((c) => /^\s*UPDATE/.test(c.sql));
    expect(writes.map((c) => c.sql.match(/UPDATE (\w+)/)[1])).toEqual(['episode_briefs', 'event_deliverables', 'episode_todo_lists', 'episodes', 'world_events']);
    expect(writes.every((c) => c.opts.transaction?.id === 'tx')).toBe(true);
    const meta = JSON.parse(writes[0].opts.replacements.meta);
    expect(meta.terms.compensation).toEqual({ is_paid: true, payment_amount: 900 });
    expect(writes[3].opts.replacements).toMatchObject({ total_income: 900, total_expenses: 0, financial_score: 7 });
    const cc = JSON.parse(writes[4].opts.replacements.cc);
    expect(cc.terms_reopen).toBeUndefined();
    expect(cc.automation).toEqual({ kept: 1 });
    expect(cc.terms_history.map((h) => h.action)).toEqual(['terms_reopened', 'terms_relocked']);
    expect(cc.terms_history[1]).toMatchObject({ fields: ['payment_amount'], reopened_at: 't0', by: { id: 'u1', name: 'Evoni' } });
    expect(result.body.changed_fields).toEqual(['payment_amount']);
    expect(result.body.regenerate.script.reminder).toBe('Terms changed; the script mentions money. Regenerate?');
  });
});
