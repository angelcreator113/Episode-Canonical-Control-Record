/**
 * eventStakes — Event Package stakes and money (Task #1771).
 */
import { describe, test, expect } from 'vitest';
import { createRequire } from 'module';
import {
  DEADLINE_TYPES, CAREER_TIERS, COLUMN_DEFAULTS,
  projectEventDifficulty, describeEventMoney, resolveEventStakes,
  stakesDraftFrom, buildStakesUpdate, EDITABLE_STAKES,
} from './eventStakes';
import { calcEventDifficulty } from './eventReadiness';

const full = (extra = {}) => ({
  prestige: 7, strictness: 6, deadline_type: 'high', dress_code_keywords: ['elegant', 'formal'],
  career_tier: 3, cost_coins: 300, is_paid: false, ...extra,
});

// The PUT route's own lists, read from the source so a rename there fails here.
const nodeRequire = createRequire(import.meta.url);
const routeSrc = nodeRequire('fs').readFileSync(
  nodeRequire('path').resolve(nodeRequire('path').dirname(new URL(import.meta.url).pathname), '../../../src/routes/worldEvents.js'),
  'utf8'
);
const putBlock = routeSrc.slice(routeSrc.indexOf("router.put('/world/:showId/events/:eventId'"));
const listOf = (name) => {
  const m = putBlock.match(new RegExp(`const ${name} = (?:new Set\\()?\\[([\\s\\S]*?)\\]`));
  return [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
};

describe('the PUT allowlist', () => {
  test('every editable stakes field is in allowedFields, with the right type', () => {
    const allowed = listOf('allowedFields');
    const integers = listOf('integerFields');
    const strings = listOf('scalarStringFields');
    for (const k of EDITABLE_STAKES) expect(allowed).toContain(k);
    expect(integers).toEqual(expect.arrayContaining(['prestige', 'strictness', 'career_tier']));
    expect(strings).toContain('deadline_type');
  });

  test('deadline types match the old editor select and the formula weight table', () => {
    expect(DEADLINE_TYPES).toEqual(['none', 'low', 'medium', 'high', 'tonight', 'urgent']);
    expect(Object.keys(CAREER_TIERS)).toEqual(['1', '2', '3', '4', '5']);
  });
});

describe('projectEventDifficulty', () => {
  test('complete inputs: the unchanged calcEventDifficulty score and its label', () => {
    const p = projectEventDifficulty(full());
    expect(p.complete).toBe(true);
    expect(p.missing).toEqual([]);
    expect(p.score).toBe(calcEventDifficulty(full()));
    expect(p.label.text).toBe('Medium');
  });

  test('a missing input makes the projection incomplete instead of substituting a default', () => {
    const p = projectEventDifficulty(full({ deadline_type: null }));
    expect(p.complete).toBe(false);
    expect(p.score).toBeNull();
    expect(p.label).toBeNull();
    expect(p.missing.map((m) => m.key)).toEqual(['deadline_type']);
    // calcEventDifficulty itself would have returned a number here.
    expect(typeof calcEventDifficulty(full({ deadline_type: null }))).toBe('number');
  });

  test('zero prestige/strictness, unknown deadline and non-array keywords all count as missing', () => {
    const p = projectEventDifficulty({ prestige: 0, strictness: null, deadline_type: 'someday', dress_code_keywords: null });
    expect(p.missing.map((m) => m.key)).toEqual(['prestige', 'strictness', 'deadline_type', 'dress_code_keywords']);
  });

  test('an empty object is incomplete (the formula would say 3.7)', () => {
    expect(calcEventDifficulty({})).toBe(3.7);
    expect(projectEventDifficulty({}).complete).toBe(false);
  });

  test("an empty keyword list is a real value; 'none' carries a note", () => {
    const p = projectEventDifficulty(full({ dress_code_keywords: [], deadline_type: 'none' }));
    expect(p.complete).toBe(true);
    expect(p.notes[0]).toMatch(/"none" the same as "medium"/);
  });
});

describe('describeEventMoney', () => {
  test('paid, free, cost, missing — with no amounts in the words', () => {
    expect(describeEventMoney(full({ is_paid: true, payment_amount: 400 })).kind).toBe('paid');
    expect(describeEventMoney(full({ cost_coins: 0 })).kind).toBe('free');
    expect(describeEventMoney(full()).kind).toBe('cost');
    expect(describeEventMoney({ cost_coins: null }).kind).toBe('missing');
    for (const ev of [full({ is_paid: true, payment_amount: 400 }), full({ cost_coins: 0 }), full()]) {
      expect(describeEventMoney(ev).summary).not.toMatch(/\d/);
    }
  });
});

describe('resolveEventStakes', () => {
  test('the summary carries no numbers', () => {
    const s = resolveEventStakes(full({
      narrative_stakes: 'Her first night among the editors.', fail_consequence: 'The editors stop calling.',
      career_milestone: 'First editor-facing event', success_unlock: 'A shoot with the magazine',
    }));
    const summaryText = [
      s.career.summary, s.relationship.summary, s.challenge.pressure, s.money.summary,
    ].join(' ');
    expect(summaryText).not.toMatch(/\d/);
    expect(s.career.summary).toBe('A notable event, pitched at the Established career level.');
    expect(s.challenge.pressure).toBe('A tight deadline, a room with some expectations.');
  });

  test('details hold the numbers, marked stored, never "set"', () => {
    const s = resolveEventStakes(full());
    const byKey = Object.fromEntries(s.details.map((d) => [d.key, d]));
    expect(byKey.prestige).toMatchObject({ state: 'stored', display: '7 of 10' });
    expect(byKey.career_tier.display).toBe('3: Established (reputation 5–6)');
    expect(byKey.cost_coins).toMatchObject({ state: 'stored', display: '300 coins', readOnly: true });
    expect(s.details.every((d) => d.state === 'stored' || d.state === 'missing')).toBe(true);
  });

  test('a stored value equal to its column default says so; a cost of 100 may never have been chosen', () => {
    const s = resolveEventStakes(full({ prestige: 5, cost_coins: 100, deadline_type: 'medium', career_tier: 1 }));
    const byKey = Object.fromEntries(s.details.map((d) => [d.key, d]));
    expect(byKey.prestige.note).toMatch(/column default/);
    expect(byKey.deadline_type.note).toMatch(/column default/);
    expect(byKey.career_tier.note).toMatch(/column default/);
    expect(byKey.cost_coins.note).toMatch(/may never have been chosen/);
    expect(COLUMN_DEFAULTS.cost_coins).toBe(100);
  });

  test('unset fields read as missing, not as a default', () => {
    const s = resolveEventStakes({ prestige: null, strictness: null, deadline_type: null, career_tier: null, cost_coins: null });
    expect(s.details.map((d) => d.state)).toEqual(['missing', 'missing', 'missing', 'missing', 'missing']);
    expect(s.details.every((d) => d.display === null)).toBe(true);
    expect(s.career.missing).toBe(true);
    expect(s.relationship.missing).toBe(true);
    expect(s.challenge.pressure).toBeNull();
    expect(s.difficulty.complete).toBe(false);
  });

  test('an unrecognised deadline value is reported as stored-but-unrecognised', () => {
    const s = resolveEventStakes(full({ deadline_type: 'tomorrow' }));
    const d = s.details.find((x) => x.key === 'deadline_type');
    expect(d.state).toBe('missing');
    expect(d.note).toMatch(/"tomorrow"/);
  });

  test('a paid appearance lists the payment and says the cost is not charged', () => {
    const s = resolveEventStakes(full({ is_paid: true, payment_amount: 400 }));
    const byKey = Object.fromEntries(s.details.map((d) => [d.key, d]));
    expect(byKey.payment_amount.display).toBe('400 coins');
    expect(byKey.cost_coins.note).toMatch(/Not charged/);
  });
});

describe('buildStakesUpdate', () => {
  test('sends only what changed, as integers / the deadline string', () => {
    const ev = full();
    const draft = { ...stakesDraftFrom(ev), prestige: '9', deadline_type: 'urgent' };
    expect(buildStakesUpdate(ev, draft)).toEqual({ body: { prestige: 9, deadline_type: 'urgent' }, unchanged: false, errors: [] });
  });

  test('no change → unchanged; cost is never sent', () => {
    const ev = full();
    const r = buildStakesUpdate(ev, { ...stakesDraftFrom(ev), cost_coins: '50' });
    expect(r).toEqual({ body: {}, unchanged: true, errors: [] });
  });

  test('an empty draft leaves a field alone; prestige/strictness are never sent null', () => {
    const ev = { prestige: null, strictness: 5, deadline_type: null, career_tier: null };
    const draft = stakesDraftFrom(ev);
    expect(draft).toEqual({ prestige: '', strictness: '5', deadline_type: '', career_tier: '' });
    expect(buildStakesUpdate(ev, { ...draft, strictness: '' }).unchanged).toBe(true);
    expect(buildStakesUpdate(ev, { ...draft, career_tier: '4' }).body).toEqual({ career_tier: 4 });
  });

  test('out-of-range or unknown values are refused, nothing sent', () => {
    const ev = full();
    expect(buildStakesUpdate(ev, { prestige: '11' }).errors[0].key).toBe('prestige');
    expect(buildStakesUpdate(ev, { career_tier: '6' }).body).toEqual({});
    expect(buildStakesUpdate(ev, { deadline_type: 'soon' }).errors[0].key).toBe('deadline_type');
  });
});

describe('cost stays read-only (a default 100 cannot be told from a chosen 100)', () => {
  test('cost is not an editable stakes field and never reaches a draft or a PUT body', () => {
    expect(EDITABLE_STAKES).not.toContain('cost_coins');
    expect(stakesDraftFrom(full())).not.toHaveProperty('cost_coins');
    expect(buildStakesUpdate(full(), { cost_coins: '250', prestige: '8' }).body).toEqual({ prestige: 8 });
  });

  test('a 100 and a derived 150 are both only "stored"; neither is shown as chosen', () => {
    for (const cost of [100, 150]) {
      const d = resolveEventStakes(full({ cost_coins: cost })).details.find((x) => x.key === 'cost_coins');
      expect(d.state).toBe('stored');
      expect(d.readOnly).toBe(true);
    }
    const d150 = resolveEventStakes(full({ cost_coins: 150 })).details.find((x) => x.key === 'cost_coins');
    expect(d150.note).toBeNull();
  });

  test('a missing cost reads as missing, with no 100 filled in', () => {
    const s = resolveEventStakes(full({ cost_coins: undefined }));
    const d = s.details.find((x) => x.key === 'cost_coins');
    expect(d).toMatchObject({ state: 'missing', display: null });
    expect(s.money.kind).toBe('missing');
    expect(s.money.summary).toBeNull();
  });
});
