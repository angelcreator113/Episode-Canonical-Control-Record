/**
 * eventTermsService (Task #1814, slice 1a) — the helpers both
 * opportunity-to-event paths and Start Episode use to carry, store and
 * snapshot an event's terms. No database: sequelize.query is a recorder.
 */

const {
  deliverablesFromOpportunity,
  restrictionsFromOpportunity,
  compensationFromOpportunity,
  insertEventDeliverables,
  listEventDeliverables,
  stampDeliverablesEpisode,
  buildTermsSnapshot,
  normalizeRestrictions,
} = require('../../../src/services/eventTermsService');

function recorder(result = [[]]) {
  const calls = [];
  return {
    calls,
    sequelize: { query: jest.fn(async (sql, opts) => { calls.push({ sql, opts }); return result; }) },
  };
}

describe('deliverablesFromOpportunity', () => {
  test('maps the stored shape {description, completed} (type defaults) to pending rows', () => {
    const rows = deliverablesFromOpportunity({
      deliverables: [{ description: 'Sponsored content', completed: false }, { description: 'Story mentions', completed: true }],
    });
    expect(rows).toEqual([
      { description: 'Sponsored content', deliverable_type: null, due_date: null, required: true, owed_to: 'brand' },
      { description: 'Story mentions', deliverable_type: null, due_date: null, required: true, owed_to: 'brand' },
    ]);
  });

  test('carries type and due_date when present, trims, skips entries without a description', () => {
    const rows = deliverablesFromOpportunity({
      deliverables: [
        { type: ' post ', description: ' Tagged post ', due_date: '2026-11-07' },
        { type: 'story', description: '   ' },
        null,
        'Walk the show',
      ],
    });
    expect(rows).toEqual([
      // D15: a pre-D15 key becomes its format (post → Instagram post, answer 8).
      { description: 'Tagged post', deliverable_type: 'instagram_post', platform: 'instagram', quantity: 1, due_date: '2026-11-07', required: true, owed_to: 'brand' },
      { description: 'Walk the show', deliverable_type: null, due_date: null, required: true, owed_to: 'brand' },
    ]);
  });

  test('D15: a format key is kept, free text stays untyped', () => {
    const rows = deliverablesFromOpportunity({
      deliverables: [
        { type: 'tiktok_video', description: 'Unboxing' },
        { type: 'Sponsored story', description: 'Story mention' },
        { type: 'story_set_3', description: 'Three stories' },
      ],
    });
    expect(rows.map((r) => [r.deliverable_type, r.platform, r.quantity])).toEqual([
      ['tiktok_video', undefined, undefined],
      ['Sponsored story', undefined, undefined],
      ['instagram_stories', 'instagram', 3],
    ]);
  });

  test('accepts the JSONB column as a string (raw SQL rows) and tolerates junk', () => {
    expect(deliverablesFromOpportunity({ deliverables: '[{"description":"Appear on show"}]' }))
      .toEqual([{ description: 'Appear on show', deliverable_type: null, due_date: null, required: true, owed_to: 'brand' }]);
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(deliverablesFromOpportunity({ deliverables: 'not json' })).toEqual([]);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
    expect(deliverablesFromOpportunity({ deliverables: null })).toEqual([]);
    expect(deliverablesFromOpportunity({})).toEqual([]);
  });
});

describe('restrictionsFromOpportunity', () => {
  test('exclusivity becomes one restriction entry; none when empty', () => {
    expect(restrictionsFromOpportunity({ exclusivity: 'No competing beauty brands for 90 days' }))
      .toEqual([{ type: 'exclusivity', description: 'No competing beauty brands for 90 days' }]);
    expect(restrictionsFromOpportunity({ exclusivity: '  ' })).toEqual([]);
    expect(restrictionsFromOpportunity({ exclusivity: null })).toEqual([]);
  });
});

describe('compensationFromOpportunity', () => {
  test('DECIMAL string rounds to the INTEGER column; is_paid stays off until the money slice', () => {
    expect(compensationFromOpportunity({ payment_amount: '1500.00' })).toEqual({ is_paid: false, payment_amount: 1500 });
    expect(compensationFromOpportunity({ payment_amount: '249.50' })).toEqual({ is_paid: false, payment_amount: 250 });
    expect(compensationFromOpportunity({ payment_amount: 99.49 })).toEqual({ is_paid: false, payment_amount: 99 });
  });

  test('zero, missing, rounding to zero, or junk is unpaid with 0', () => {
    for (const payment_amount of ['0.00', 0, null, undefined, '0.40', 'abc', '-50']) {
      expect(compensationFromOpportunity({ payment_amount })).toEqual({ is_paid: false, payment_amount: 0 });
    }
  });
});

describe('insertEventDeliverables', () => {
  test('one multi-row INSERT, every row pending, returns the count', async () => {
    const { sequelize, calls } = recorder();
    const n = await insertEventDeliverables(sequelize, 'ev-1', [
      { description: 'A', deliverable_type: 'post', due_date: null, required: true },
      { description: 'B', deliverable_type: null, due_date: '2026-11-07', required: false },
    ]);
    expect(n).toBe(2);
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toMatch(/^INSERT INTO event_deliverables/);
    expect(calls[0].sql.match(/'pending'/g)).toHaveLength(2);
    const r = calls[0].opts.replacements;
    expect(r).toMatchObject({
      event_id: 'ev-1', description0: 'A', type0: 'post', due0: null, required0: true,
      description1: 'B', type1: null, due1: '2026-11-07', required1: false,
    });
    expect(r.id0).not.toBe(r.id1);
    // T2 (Task #2294): owed_to is written per row; a row without one is the host's.
    expect(r).toMatchObject({ owed0: 'host', owed1: 'host' });
    // D15: platform (a known one, else null) and quantity (default 1) per row.
    expect(r).toMatchObject({ platform0: null, quantity0: 1, platform1: null, quantity1: 1 });
    expect(calls[0].sql).toMatch(/required, owed_to, status/);
  });

  test('owed_to is carried; an unknown value is the host\'s (T2)', async () => {
    const { sequelize, calls } = recorder();
    await insertEventDeliverables(sequelize, 'ev-1', [
      { description: 'A', owed_to: 'brand' },
      { description: 'B', owed_to: 'sponsor' },
    ]);
    expect(calls[0].opts.replacements).toMatchObject({ owed0: 'brand', owed1: 'host' });
  });

  test('no rows, no query', async () => {
    const { sequelize, calls } = recorder();
    expect(await insertEventDeliverables(sequelize, 'ev-1', [])).toBe(0);
    expect(calls).toHaveLength(0);
  });
});

describe('listEventDeliverables / stampDeliverablesEpisode', () => {
  test('list reads live rows for the event', async () => {
    const { sequelize, calls } = recorder([[{ id: 'd1' }]]);
    expect(await listEventDeliverables(sequelize, 'ev-1')).toEqual([{ id: 'd1' }]);
    expect(calls[0].sql).toMatch(/FROM event_deliverables\s+WHERE event_id = :eventId AND deleted_at IS NULL/);
  });

  test('stamp sets episode_id on the event\'s live rows', async () => {
    const { sequelize, calls } = recorder([[], { rowCount: 3 }]);
    expect(await stampDeliverablesEpisode(sequelize, 'ev-1', 'ep-9')).toBe(3);
    expect(calls[0].sql).toMatch(/^UPDATE event_deliverables SET episode_id = :episodeId/);
    expect(calls[0].sql).toMatch(/WHERE event_id = :eventId AND deleted_at IS NULL/);
    expect(calls[0].opts.replacements).toEqual({ eventId: 'ev-1', episodeId: 'ep-9' });
  });
});

describe('buildTermsSnapshot', () => {
  test('the four kinds of term, each from its own home', () => {
    const snap = buildTermsSnapshot(
      {
        requirements: { reputation_min: 3 },
        restrictions: [{ type: 'exclusivity', description: 'No rival brands' }],
        is_paid: true,
        payment_amount: 1500,
        rewards: { coins: 99 },
      },
      [{ id: 'd1', description: 'Tagged post', deliverable_type: 'post', due_date: null, required: true, status: 'pending', episode_id: null }]
    );
    expect(snap).toEqual({
      access_requirements: { reputation_min: 3 },
      deliverables: [{ id: 'd1', description: 'Tagged post', deliverable_type: 'post', platform: null, quantity: 1, due_date: null, required: true, owed_to: 'host', status: 'pending' }],
      restrictions: [{ type: 'exclusivity', description: 'No rival brands' }],
      compensation: { is_paid: true, payment_amount: 1500 },
    });
  });

  test('empty event: empty terms, unpaid', () => {
    expect(buildTermsSnapshot({}, [])).toEqual({
      access_requirements: {}, deliverables: [], restrictions: [], compensation: { is_paid: false, payment_amount: 0 },
    });
  });

  test('raw-SQL string JSON is parsed', () => {
    const snap = buildTermsSnapshot({ requirements: '{"coins_min":10}', restrictions: '[{"type":"other","description":"x"}]' }, []);
    expect(snap.access_requirements).toEqual({ coins_min: 10 });
    expect(snap.restrictions).toEqual([{ type: 'other', description: 'x' }]);
  });
});

describe('normalizeRestrictions', () => {
  test('strings and objects normalise; empty entries dropped; type defaults to other', () => {
    expect(normalizeRestrictions(['No rivals', { type: 'exclusivity', description: ' 90 days ' }, { description: '' }]))
      .toEqual({ value: [{ type: 'other', description: 'No rivals' }, { type: 'exclusivity', description: '90 days' }] });
  });

  test('not an array, or a bad entry, is an error', () => {
    expect(normalizeRestrictions({ reputation_min: 3 }).error).toMatch(/array/);
    expect(normalizeRestrictions('No rivals').error).toMatch(/array/);
    expect(normalizeRestrictions([42]).error).toBeTruthy();
    expect(normalizeRestrictions([[1]]).error).toBeTruthy();
  });
});
