/**
 * Producer Mode's Cast & Continuity wears the studio theme (audit
 * VISUAL-01/02, batch 5, fourth screen): the three sub-tab slices of
 * WorldAdmin.jsx (Lala's State & Continuity with its stat bars and
 * history; Lala's Finances with its overview, per-episode table,
 * breakdowns, closet, goals and ladder; Activity & Decisions) set colors
 * only through tokens. The stat bars read the teal, warning and danger
 * fills; the AI-suggest action is the primary (it was a pink-to-teal
 * gradient under white); the finance panels read the gold, success,
 * danger and teal families with text twins (the half-alpha hex text is
 * the twin at full strength); the balance trend's line is gold and its
 * points success or danger.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../styles/contrast';

const jsx = readFileSync(resolve(__dirname, 'WorldAdmin.jsx'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../styles/design-tokens.css'), 'utf8');
const HEX = /#[0-9a-f]{3,8}\b/i;

const slice = (text, start, end) => {
  const a = text.indexOf(start);
  const b = text.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error(`marker missing: ${start} / ${end}`);
  return text.slice(a, b);
};
const state = slice(jsx, "{activeTab === 'characters' && subTab === 'characters-list' && (", "{activeTab === 'release' && show && (");
const finances = slice(jsx, "{activeTab === 'characters' && subTab === 'finances' && (", "{activeTab === 'characters' && subTab === 'decisions' && (");
const decisions = slice(jsx, "{activeTab === 'characters' && subTab === 'decisions' && (", '{/* ═══ FLOATING TOAST NOTIFICATION');

describe('Cast & Continuity theme', () => {
  test.each([['State & Continuity', state], ['Finances', finances], ['Activity & Decisions', decisions]])('the %s slice sets colors only through tokens', (_name, text) => {
    expect(stripTaskRefs(text)).not.toMatch(HEX);
    expect(text).not.toMatch(/linear-gradient/);
  });

  test('the stat bars, the AI-suggest action and the goal bar read the fills', () => {
    expect(state).toMatch(/background: key === 'stress' \? \(val >= 5 \? 'var\(--danger\)' : 'var\(--warning\)'\) : isCoin \? \(val < 0 \? 'var\(--danger\)' : 'var\(--primary\)'\) : 'var\(--primary\)'/);
    expect(state).toMatch(/color: \(key === 'stress' && val >= 5\) \|\| \(isCoin && val < 0\) \? 'var\(--danger-text\)' : 'var\(--text-primary\)'/);
    expect(finances).toMatch(/border: 'none', borderRadius: 6, background: 'var\(--primary\)', color: 'var\(--text-inverse\)', cursor: 'pointer', whiteSpace: 'nowrap'/);
    expect(finances).toMatch(/background: balance >= Number\(nextGoal\.threshold\) \? 'var\(--success\)' : 'var\(--lala-gold\)'/);
    expect(finances).toMatch(/borderBottom: active \? '2px solid var\(--lala-gold\)' : '2px solid transparent'/);
  });

  test('the finance panels read the families with text twins', () => {
    expect(finances).toMatch(/renderBars\(financeBreakdowns\.income\.breakdown, incomeMax, 'var\(--success-text\)'\)/);
    expect(finances).toMatch(/renderBars\(financeBreakdowns\.expenses\.breakdown, expenseMax, 'var\(--danger-text\)'\)/);
    expect(finances).toMatch(/\{ label: 'Lifetime income', value: `\+\$\{\(t\.lifetime_income \|\| 0\)\.toLocaleString\(\)\}`, color: 'var\(--success-text\)' \}/);
    expect(finances).toMatch(/background: 'var\(--success-bg\)', border: '1px solid var\(--success-border\)', borderRadius: 10/);
    expect(finances).toMatch(/background: 'var\(--danger-bg\)', border: '1px solid var\(--danger-border\)', borderRadius: 10/);
    expect(finances).toMatch(/background: 'var\(--primary-subtle\)', border: '1px solid var\(--primary-light\)', borderRadius: 10/);
    expect(finances).toMatch(/background: 'var\(--surface-bg\)', border: '1px solid var\(--lala-gold-line\)', borderRadius: 10/);
    expect(finances).toMatch(/color: 'var\(--lala-gold-text\)', fontFamily: "'DM Mono', monospace", letterSpacing: 0\.5, marginBottom: 4 \}\}>CURRENT BALANCE/);
    expect(finances).toMatch(/stroke="var\(--lala-gold\)"/);
    expect(finances).toMatch(/fill=\{p\.net >= 0 \? 'var\(--success\)' : 'var\(--danger\)'\}/);
    expect(finances).toMatch(/border: '1px solid var\(--primary\)', borderRadius: 5, background: 'var\(--primary\)', color: 'var\(--text-inverse\)'/);
    expect(finances).not.toMatch(/var\(--[a-z-]+\)80\b/);
    expect(decisions).toMatch(/background: 'var\(--primary-subtle\)', borderRadius: 4, fontSize: 11, fontWeight: 600, color: 'var\(--primary-text\)'/);
    expect(state + finances + decisions).not.toMatch(/color: 'var\(--lala-gold\)'/);
  });

  test('every text pair the tab draws holds 4.5:1 or better', () => {
    const sources = [tokens];
    for (const [fg, bg] of [
      ['--text-inverse', '--primary'],
      ['--text-primary', '--surface-card'],
      ['--text-primary', '--surface-bg'],
      ['--text-secondary', '--surface-card'],
      ['--text-secondary', '--surface-bg'],
      ['--text-secondary', '--lala-parchment-2'],
      ['--danger-text', '--surface-card'],
      ['--danger-text', '--danger-bg'],
      ['--success-text', '--success-bg'],
      ['--success-text', '--surface-card'],
      ['--primary-text', '--primary-subtle'],
      ['--primary-text', '--surface-card'],
      ['--warning-text', '--surface-bg'],
      ['--lala-gold-text', '--surface-bg'],
      ['--lala-gold-text', '--surface-card'],
    ]) {
      const ratio = contrast(readToken(sources, fg), readToken(sources, bg));
      expect({ fg, bg, ratio }).toMatchObject({ ratio: expect.any(Number) });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
    // White on the old pink-to-teal gradient's ends, kept below 4.5 so it is never reused.
    expect(contrast('#ffffff', '#FBCFE8')).toBeLessThan(4.5);
    expect(contrast('#ffffff', '#14B8A6')).toBeLessThan(4.5);
  });
});
