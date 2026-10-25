/**
 * Beat 14's candidates scored by fit with the episode's event, and the
 * "Suggest one" draft (Evoni, 2026-10-25). Pure.
 */
const {
  scoreCandidate, rankCandidates, draftSuggestion, typesForEvent, oppMovesGoal, FORMAT_FIT, BEST_MIN,
} = require('../../../src/services/beat14Fit');

const EVENT = { id: 'ev-1', name: 'Spring Showcase', format: 'showcase', category: 'fashion', event_type: 'invite', prestige: 7, host_brand: 'Maison Belle' };
const BRANDS = [
  { company_id: 'co-host', name: 'Maison Belle', role: 'host', person: 'Sable Reyes' },
  { company_id: 'co-guest', name: 'Velour', role: 'guest', person: 'Nia Vale' },
];
const GOAL = { id: 'g-1', title: 'Grow audience to 100K', target_metric: 'followers' };
const ctx = (over = {}) => ({ event: EVENT, brands: BRANDS, goals: [GOAL], state: { reputation: 4 }, ...over });
const texts = (fit) => fit.reasons.map((r) => r.text);

describe('scoreCandidate: each reason', () => {
  test('same company as the host, or as a guest (by company, or by name when it has no company)', () => {
    expect(texts(scoreCandidate({ company_id: 'co-host', opportunity_type: 'podcast' }, ctx()))).toEqual(['Same brand as the host']);
    expect(texts(scoreCandidate({ company_id: 'co-guest', opportunity_type: 'podcast' }, ctx()))).toEqual(['Same brand as a guest, Nia Vale']);
    expect(texts(scoreCandidate({ brand_or_company: ' maison belle ', opportunity_type: 'podcast' }, ctx()))).toEqual(['Same brand as the host']);
    // A company id that differs is not matched by name.
    expect(scoreCandidate({ company_id: 'other', brand_or_company: 'Maison Belle', opportunity_type: 'podcast' }, ctx()).score).toBe(0);
  });

  test('the type suits the event: format first, then words in its name, then category', () => {
    expect(texts(scoreCandidate({ opportunity_type: 'runway' }, ctx()))).toEqual(['Runway suits a showcase']);
    expect(scoreCandidate({ opportunity_type: 'runway' }, ctx()).score).toBe(3);
    expect(texts(scoreCandidate({ opportunity_type: 'editorial' }, ctx()))).toEqual(['Editorial suits a fashion event']);
    expect(scoreCandidate({ opportunity_type: 'editorial' }, ctx()).score).toBe(2);
    const named = { name: 'Nova Prime Runway Night', prestige: 3 };
    expect(texts(scoreCandidate({ opportunity_type: 'modeling' }, ctx({ event: named })))).toEqual(['Modeling suits a runway event']);
    expect(texts(scoreCandidate({ opportunity_type: 'campaign' }, ctx({ event: { name: 'Deal', event_type: 'brand_deal' } })))).toEqual(['Campaign suits a brand deal event']);
  });

  test('every format in the map names real opportunity types', () => {
    const { TYPES } = require('../../../src/services/beat14Opportunity');
    for (const types of Object.values(FORMAT_FIT)) for (const t of types) expect(TYPES).toContain(t);
    expect(typesForEvent(EVENT).slice(0, 2)).toEqual(['runway', 'modeling']);
  });

  test('moves a goal nothing else in the season moves yet: by what it carries, or by career_goal_id', () => {
    expect(texts(scoreCandidate({ opportunity_type: 'podcast', social_boost: 5000 }, ctx()))).toEqual(['Moves Grow audience to 100K']);
    expect(texts(scoreCandidate({ opportunity_type: 'podcast', career_goal_id: 'g-1' }, ctx()))).toEqual(['Moves Grow audience to 100K']);
    expect(scoreCandidate({ opportunity_type: 'podcast', social_boost: 0 }, ctx()).score).toBe(0);
    const coins = { id: 'g-2', title: 'Earn 3,000 coins', target_metric: 'coins' };
    const rep = { id: 'g-3', title: 'Reputation 8', target_metric: 'reputation' };
    expect(oppMovesGoal({ payment_amount: '500.00' }, coins)).toBe(true);
    expect(oppMovesGoal({ payment_amount: 0 }, coins)).toBe(false);
    expect(oppMovesGoal({ prestige: 6 }, rep, { reputation: 4 })).toBe(true);
    expect(oppMovesGoal({ prestige: 3 }, rep, { reputation: 4 })).toBe(false);
    expect(oppMovesGoal({ prestige: 9 }, { id: 'g-4', title: 'Less stress', target_metric: 'stress' })).toBe(false);
  });

  test('prestige within one point of the event', () => {
    expect(texts(scoreCandidate({ opportunity_type: 'podcast', prestige: 7 }, ctx()))).toEqual(["Prestige 7, as the event's"]);
    expect(texts(scoreCandidate({ opportunity_type: 'podcast', prestige: 8 }, ctx()))).toEqual(["Prestige 8, near the event's 7"]);
    expect(scoreCandidate({ opportunity_type: 'podcast', prestige: 9 }, ctx()).score).toBe(0);
  });

  test('no event or no host: nothing about the event scores, a goal still does', () => {
    const none = ctx({ event: null, brands: [] });
    expect(scoreCandidate({ company_id: 'co-host', opportunity_type: 'runway', prestige: 7 }, none)).toEqual({ score: 0, reasons: [] });
    expect(texts(scoreCandidate({ opportunity_type: 'runway', social_boost: 10 }, none))).toEqual(['Moves Grow audience to 100K']);
    expect(scoreCandidate(null, ctx())).toEqual({ score: 0, reasons: [] });
    expect(scoreCandidate({ opportunity_type: 'runway' })).toEqual({ score: 0, reasons: [] });
  });
});

describe('rankCandidates', () => {
  const list = [
    { id: 'a', opportunity_type: 'podcast', prestige: 2 },
    { id: 'b', opportunity_type: 'runway', prestige: 7 },
    { id: 'c', company_id: 'co-host', opportunity_type: 'runway', prestige: 7 },
    { id: 'd', opportunity_type: 'interview', prestige: 1 },
    { id: 'e', opportunity_type: 'campaign', social_boost: 10, prestige: 1 },
  ];

  test('best fits first, ties keep their order, the unranked rest below as they came', () => {
    const out = rankCandidates(list, ctx());
    expect(out.map((c) => c.id)).toEqual(['c', 'e', 'b', 'a', 'd']);
    expect(out.map((c) => c.fit.score)).toEqual([9, 6, 4, 0, 0]);
    expect(out[0].fit.reasons.map((r) => r.kind)).toEqual(['brand', 'type', 'prestige']);
  });

  test('"Best fit" on the top score only, and only when it reaches BEST_MIN', () => {
    expect(rankCandidates(list, ctx()).filter((c) => c.fit.best).map((c) => c.id)).toEqual(['c']);
    const twins = [{ id: 'x', company_id: 'co-host' }, { id: 'y', company_id: 'co-host' }];
    expect(rankCandidates(twins, ctx()).map((c) => c.fit.best)).toEqual([true, true]);
    const weak = rankCandidates([{ id: 'z', opportunity_type: 'editorial' }], ctx());
    expect(weak[0].fit.score).toBeLessThan(BEST_MIN);
    expect(weak[0].fit.best).toBe(false);
  });

  test('with no event, the order is unchanged and nothing is best', () => {
    const out = rankCandidates(list, { event: null, brands: [], goals: [] });
    expect(out.map((c) => c.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(out.some((c) => c.fit.best)).toBe(false);
    expect(rankCandidates([], ctx())).toEqual([]);
  });
});

describe('draftSuggestion', () => {
  const host = { profile_id: 7, name: 'Sable Reyes', role: 'host' };
  const guest = { profile_id: 9, name: 'Nia Vale', role: 'guest' };

  test('from the host, with the host brand, the event\'s first type and a pitch', () => {
    expect(draftSuggestion({ event: EVENT, person: host, brand: 'Maison Belle' })).toEqual({
      name: 'Maison Belle runway booking',
      opportunity_type: 'runway',
      pitch: 'Sable Reyes hosted Spring Showcase and wants Lala for a runway booking with Maison Belle.',
      connector_profile_id: 7,
      brand: 'Maison Belle',
    });
  });

  test('an uncovered goal picks the type among the event\'s, and the pitch names it', () => {
    const d = draftSuggestion({ event: EVENT, person: host, brand: null, goal: GOAL });
    expect(d.opportunity_type).toBe('campaign');
    expect(d.name).toBe('Maison Belle campaign shoot');
    expect(d.pitch).toMatch(/Done well, it moves Grow audience to 100K\.$/);
  });

  test('a guest with no brand offers it in their own name', () => {
    const d = draftSuggestion({ event: { ...EVENT, format: null, category: null, name: 'Supper' }, person: guest });
    expect(d).toMatchObject({ name: 'Nia Vale brand deal', opportunity_type: 'brand_deal', connector_profile_id: 9, brand: null });
    expect(d.pitch).toBe('Nia Vale was at Supper and wants Lala for a brand deal.');
  });

  test('no event or nobody to offer it: null', () => {
    expect(draftSuggestion({ event: null, person: host })).toBeNull();
    expect(draftSuggestion({ event: EVENT, person: null })).toBeNull();
    expect(draftSuggestion()).toBeNull();
  });
});
