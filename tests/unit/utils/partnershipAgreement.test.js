/**
 * The Creator Partnership Agreement's shared pieces (utils/partnershipAgreement;
 * Task #3206): the event's colours, the numbered clauses, OFFER or EXECUTED.
 */
const pa = require('../../../src/utils/partnershipAgreement');

describe('agreementColours', () => {
  test('with no palette the house colours stay', () => {
    expect(pa.agreementColours({})).toEqual({ ...pa.HOUSE, from_event: false });
    expect(pa.agreementColours({ color_palette: ['blush', 'gold'] })).toMatchObject({ head: pa.HOUSE.head, from_event: false });
  });

  test('a dark event colour heads the letter; another colours the rules', () => {
    const c = pa.agreementColours({ color_palette: ['#6a1b4d', '#E8C66A'] });
    expect(c).toMatchObject({ head: '#6A1B4D', rule: '#E8C66A', paper: pa.HOUSE.paper, from_event: true });
  });

  test('a light colour never becomes text: it colours the rules and the house ink heads', () => {
    const c = pa.agreementColours({ color_palette: ['#FFF1F5'] });
    expect(c.head).toBe(pa.HOUSE.head);
    expect(c.rule).toBe('#FFF1F5');
  });

  test('a palette stored as JSON text, short hex and {hex} objects are read', () => {
    expect(pa.agreementColours({ color_palette: '["#123"]' }).head).toBe('#112233');
    expect(pa.agreementColours({ color_palette: [{ hex: '#0b3d2e' }] }).head).toBe('#0B3D2E');
  });
});

describe('agreementClauses', () => {
  const event = { name: 'Velour Awards Night', host_brand: 'Velour', event_date: '2026-11-09', venue_name: 'The Glasshouse' };
  const terms = [
    { key: 'fees', title: 'Fees', lines: [{ label: 'Appearance fee', detail: null, amount: 500 }] },
    { key: 'covered', title: 'Covered', lines: [] },
    { key: 'deliverables', title: 'Deliverables', lines: [{ label: '1 Reel', detail: null, amount: null }] },
  ];

  test('1 is the engagement (who, what, when, where); then each section with lines, numbered in order', () => {
    const clauses = pa.agreementClauses(event, terms);
    expect(clauses.map((c) => [c.number, c.key])).toEqual([[1, 'engagement'], [2, 'fees'], [3, 'deliverables']]);
    expect(clauses[0].lines[0].label).toBe('Velour engages Lala (the Creator) for Velour Awards Night on November 9, 2026 at The Glasshouse.');
  });

  test('with no deal terms there is only the engagement; the host stands in for a brand', () => {
    const clauses = pa.agreementClauses({ name: 'Garden Party', host: 'Maren' }, []);
    expect(clauses).toHaveLength(1);
    expect(clauses[0].lines[0].label).toBe('Maren engages Lala (the Creator) for Garden Party.');
  });
});

describe('agreementStatus and the title', () => {
  test('OFFER until the event has started an episode, EXECUTED after', () => {
    const colours = pa.agreementColours({});
    expect(pa.agreementStatus(null, colours)).toEqual({ status: 'offer', label: 'OFFER', colour: colours.head, episode_id: null });
    expect(pa.agreementStatus({ id: 'ep-1', episode_number: 4 }, colours)).toEqual({ status: 'executed', label: 'EXECUTED', colour: pa.EXECUTED_INK, episode_id: 'ep-1' });
  });

  test('the title names the event', () => {
    expect(pa.agreementTitle({ name: 'Velour Awards Night' })).toBe('Creator Partnership Agreement · Velour Awards Night');
    expect(pa.agreementTitle({})).toBe('Creator Partnership Agreement');
  });
});
