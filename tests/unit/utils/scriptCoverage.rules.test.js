// ============================================================================
// The show's rules in the coverage check (utils/scriptCoverage.js with
// utils/scriptRuleChecks.js; Evoni, 2026-10-17 and 2026-10-18): what the
// script breaks is missing in its beat, and the writer's one-beat prompt
// asks for it in the rule's own words. Pure; no database.
// ============================================================================

const { scriptCoverage, beatRequirements } = require('../../../src/utils/scriptCoverage');
const { CANONICAL_BEATS } = require('../../../src/constants/canonicalBeats');

const beat = (n, ...lines) => [`## BEAT: ${n} · ${CANONICAL_BEATS[n - 1].name}`, ...lines].join('\n');
const MONEY = { look: [{ id: 'p1', name: 'Velvet Blazer', amount: 120 }], recap: [{ label: 'Entry fee', amount: 45 }], income: [], shopping: { lines: [], total: 0 } };
const RULES = { money: MONEY, shoppingApproved: true };
// Every phone beat has its [UI:] moment, so only the rules can be missing.
const lines = {
  8: ['[UI:OPEN Closet]', '[WEAR: p1]', '[STAT: coins -120]'],
  9: ['[UI:DISPLAY Shopping list]', 'Me: the blazer, 120', '[UI:HIDE Shopping list]'],
  12: ['[UI:SHOW phone]', '[STAT: reputation +2]', '[STAT: brand_trust +1]', '[STAT: influence +1]', '[STAT: stress -1]', '[UI:HIDE phone]'],
  13: ['[UI:CLICK Voice Icon]', 'Lala: that felt like me', '[STAT: coins -45]', '(JustAWoman watches, silent.)'],
};
const script = (over = {}) => CANONICAL_BEATS.map((c) => beat(c.number, ...(over[c.number] || lines[c.number] || ['[UI:OPEN Mail]']))).join('\n\n');

test('a script that keeps every rule has nothing missing', () => {
  expect(scriptCoverage(script(), { rules: RULES }).missing).toEqual([]);
});

test('each broken rule is missing in its beat, and the writer is asked for it', () => {
  const broken = script({
    4: ['[UI:OPEN Mail]', '[STAT: coins -45]'],
    8: ['[UI:OPEN Closet]', '[WEAR: p1]'],
    9: ['[UI:OPEN Mail]'],
    12: ['[UI:SHOW phone]', '[STAT: reputation +2]', '[STAT: coins -20]'],
    13: ['Me: done'],
  });
  const { missing } = scriptCoverage(broken, { rules: RULES });
  expect(missing.map((g) => [g.kind, g.rule, g.target])).toEqual([
    ['rule', 'beat8-p1', 8], ['rule', 'beat9', 9], ['rule', 'beat12', 12], ['rule', 'beat12-coins', 12],
    ['rule', 'beat13', 13], ['rule', 'coins-4', 4], ['rule', 'beat13-costs', 13], ['rule', 'silent', 11],
  ]);
  expect(beatRequirements(missing.filter((g) => g.target === 8))).toEqual(['Right after the [WEAR: p1] line, write the coin line for "Velvet Blazer" on its own line, exactly: [STAT: coins -120]']);
  expect(beatRequirements(missing.filter((g) => g.target === 9))[0]).toContain('[UI:DISPLAY Shopping list]');
  expect(beatRequirements(missing.filter((g) => g.target === 12)).join(' ')).toContain('[STAT: brand_trust ±n]');
  expect(beatRequirements(missing.filter((g) => g.target === 13)).join(' ')).toContain('Lala says how the outcome feels');
  expect(beatRequirements(missing.filter((g) => g.target === 4))[0]).toContain('comes off in beat 13 (the Recap Panel) only');
  expect(beatRequirements(missing.filter((g) => g.target === 11))[0]).toContain('(JustAWoman watches, silent.)');
});

test('without the rules in the facts, coverage is as before', () => {
  expect(scriptCoverage(script({ 13: ['Me: done'] }), {}).missing).toEqual([]);
});
