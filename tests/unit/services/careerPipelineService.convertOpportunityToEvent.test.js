/**
 * careerPipelineService.convertOpportunityToEvent carries the opportunity's
 * terms onto the event (Task #1814, slice 1a): deliverables into
 * event_deliverables rows, exclusivity into restrictions, payment_amount
 * into is_paid / payment_amount. The existing automation.payment_amount
 * copy stays. A failed deliverable insert is logged and never fails the
 * conversion. No database.
 */

const { convertOpportunityToEvent } = require('../../../src/services/careerPipelineService');

function makeOpportunity(over = {}) {
  const data = {
    id: 'opp-1',
    name: 'Maison Belle Campaign',
    opportunity_type: 'brand_deal',
    brand_or_company: 'Maison Belle',
    prestige: 7,
    narrative_stakes: 'First real campaign',
    what_could_go_wrong: null,
    venue_name: null,
    wardrobe_brief: { dress_code: 'chic' },
    connector_handle: null,
    career_milestone: null,
    career_goal_id: null,
    deliverables: [
      { description: 'Sponsored content', completed: false },
      { type: 'story', description: 'Story mentions', completed: false },
    ],
    exclusivity: 'No competing beauty brands for 90 days',
    payment_amount: '1500.00', // DECIMAL(10,2) as node-postgres returns it
    ...over,
  };
  return {
    ...data,
    update: jest.fn(async () => {}),
    toJSON: () => data,
  };
}

function makeModels({ opp, failDeliverables = false, withModel = true } = {}) {
  const queries = [];
  const created = [];
  const models = {
    Opportunity: { findByPk: jest.fn(async () => opp) },
    sequelize: {
      query: jest.fn(async (sql, opts) => {
        queries.push({ sql, opts });
        if (/INSERT INTO event_deliverables/.test(sql)) {
          if (failDeliverables) throw new Error('relation "event_deliverables" does not exist');
          return [[]];
        }
        if (/INSERT INTO world_events/.test(sql)) return [[]];
        throw new Error(`Unexpected query in test: ${sql}`);
      }),
    },
  };
  if (withModel) {
    models.WorldEvent = {
      create: jest.fn(async (data) => { created.push(data); return { ...data, toJSON: () => data }; }),
    };
  }
  return { models, queries, created };
}

describe('convertOpportunityToEvent — terms carry (Task #1814)', () => {
  test('restrictions, is_paid and payment_amount go on the event; automation.payment_amount is kept', async () => {
    const opp = makeOpportunity();
    const { models, created } = makeModels({ opp });
    await convertOpportunityToEvent('opp-1', 'show-1', models);

    expect(created).toHaveLength(1);
    const ev = created[0];
    expect(ev.restrictions).toEqual([{ type: 'exclusivity', description: 'No competing beauty brands for 90 days' }]);
    expect(ev.is_paid).toBe(true);
    expect(ev.payment_amount).toBe(1500);
    expect(ev.opportunity_id).toBe('opp-1');
    expect(ev.canon_consequences.automation.payment_amount).toBe('1500.00');
    // Access requirements are their own term and are not written here.
    expect(ev).not.toHaveProperty('requirements');
  });

  test('deliverables become pending event_deliverables rows for the created event', async () => {
    const opp = makeOpportunity();
    const { models, queries, created } = makeModels({ opp });
    const result = await convertOpportunityToEvent('opp-1', 'show-1', models);

    const inserts = queries.filter(q => /INSERT INTO event_deliverables/.test(q.sql));
    expect(inserts).toHaveLength(1);
    expect(inserts[0].opts.replacements).toMatchObject({
      event_id: created[0].id,
      description0: 'Sponsored content', type0: null,
      description1: 'Story mentions', type1: 'story',
    });
    expect(inserts[0].sql.match(/'pending'/g)).toHaveLength(2);
    expect(result.deliverables).toBe(2);
    expect(opp.update).toHaveBeenCalledWith({ event_id: created[0].id });
  });

  test('payment rounds to the INTEGER column; zero is unpaid', async () => {
    const a = makeModels({ opp: makeOpportunity({ payment_amount: '99.50' }) });
    await convertOpportunityToEvent('opp-1', 'show-1', a.models);
    expect(a.created[0]).toMatchObject({ is_paid: true, payment_amount: 100 });

    const b = makeModels({ opp: makeOpportunity({ payment_amount: '0.00', exclusivity: null, deliverables: [] }) });
    const result = await convertOpportunityToEvent('opp-1', 'show-1', b.models);
    expect(b.created[0]).toMatchObject({ is_paid: false, payment_amount: 0, restrictions: [] });
    expect(b.queries.filter(q => /INSERT INTO event_deliverables/.test(q.sql))).toHaveLength(0);
    expect(result.deliverables).toBe(0);
  });

  test('a failed deliverable insert is logged and the event still stands', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const opp = makeOpportunity();
    const { models, created } = makeModels({ opp, failDeliverables: true });
    const result = await convertOpportunityToEvent('opp-1', 'show-1', models);
    expect(created).toHaveLength(1);
    expect(result.event.id).toBe(created[0].id);
    expect(result.deliverables).toBe(0);
    expect(opp.update).toHaveBeenCalledWith({ event_id: created[0].id });
    expect(error).toHaveBeenCalledWith(
      '[CareerPipeline] Deliverable carry failed (event created without deliverables):',
      'relation "event_deliverables" does not exist'
    );
    error.mockRestore();
  });

  test('raw-SQL fallback (no WorldEvent model) writes the same terms', async () => {
    const opp = makeOpportunity();
    const { models, queries } = makeModels({ opp, withModel: false });
    await convertOpportunityToEvent('opp-1', 'show-1', models);
    const insert = queries.find(q => /INSERT INTO world_events/.test(q.sql));
    expect(insert.sql).toMatch(/restrictions, is_paid, payment_amount/);
    expect(JSON.parse(insert.opts.replacements.restrictions))
      .toEqual([{ type: 'exclusivity', description: 'No competing beauty brands for 90 days' }]);
    expect(insert.opts.replacements).toMatchObject({ is_paid: true, payment_amount: 1500 });
    expect(queries.filter(q => /INSERT INTO event_deliverables/.test(q.sql))).toHaveLength(1);
  });
});
