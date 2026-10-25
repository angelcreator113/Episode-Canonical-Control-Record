/**
 * The Season Plan's pieces wear the studio theme (audit VISUAL-01/02, batch
 * 5, second screen), now on the Season page (Producer Mode's Season Plan
 * tab retired, 2026-10-25): Career Goals (components/Show/CareerGoals: goal
 * editor, goal cards and progress bars, completed goals, suggested events,
 * the debt and the phases) on the page's --sp-* tokens; Producer Mode's
 * episode blueprint modal with its beats, feed moments, social tasks and
 * feed posts; and the helpers SeasonPlan.jsx draws (BalanceTrend,
 * PlanningInsights, StoryThreadsCard, SlotIntentionEditor, the slot panel)
 * set colors only through tokens. Lala's temperament, the phase statuses,
 * the thread statuses and the slot statuses are family surfaces with text
 * twins; a goal's own color is data (the API seeds and defaults it) and
 * falls back to the page's pink; the beat phases read family surfaces with
 * dots the beat number reads white on; the blueprint's generate action is
 * the primary; the advance action is the warning text under white (its old
 * fill was 2.2:1).
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../styles/contrast';

const jsx = readFileSync(resolve(__dirname, 'WorldAdmin.jsx'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../styles/design-tokens.css'), 'utf8');
const css = readFileSync(resolve(__dirname, 'WorldAdmin.css'), 'utf8');
const HEX = /#[0-9a-f]{3,8}\b/i;

const slice = (text, start, end, from = 0) => {
  const a = text.indexOf(start, from);
  const b = text.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error(`marker missing: ${start} / ${end}`);
  return text.slice(a, b);
};
// Career Goals moved to the Season page's Goals tab (2026-10-25).
const goals = readFileSync(resolve(__dirname, '../components/Show/CareerGoals.jsx'), 'utf8');
const goalsCss = readFileSync(resolve(__dirname, '../components/Show/CareerGoals.css'), 'utf8');
// The episode blueprint modal stays in Producer Mode.
const blueprint = slice(jsx, 'EPISODE BLUEPRINT MODAL', "{activeTab === 'wardrobe' && subTab === 'scene-sets' && (");
// The Season Plan's helpers live in components/Show/SeasonPlan.jsx (2026-10-25).
const plan = readFileSync(resolve(__dirname, '../components/Show/SeasonPlan.jsx'), 'utf8');
const season = plan.slice(plan.indexOf('export function BalanceTrend'));

describe('Season Plan theme', () => {
  test('Career Goals, the blueprint modal and the Season Plan helpers set colors only through tokens', () => {
    expect(stripTaskRefs(goals).replace('#RRGGBB', '')).not.toMatch(HEX);
    expect(goals).not.toMatch(/linear-gradient/);
    expect(goalsCss.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(HEX);
    expect(goalsCss).not.toMatch(/var\(--(?!sp-|font-)[a-z-]+\)/);
    expect(stripTaskRefs(blueprint)).not.toMatch(HEX);
    expect(blueprint).not.toMatch(/linear-gradient/);
    expect(stripTaskRefs(season)).not.toMatch(HEX);
    expect(season).not.toMatch(/linear-gradient|rgba\(184/);
  });

  test("a goal's color is data with a token fallback; the form no longer seeds a literal", () => {
    expect(goals).toMatch(/const EMPTY_GOAL = \{ title: '', type: 'secondary', target_metric: 'reputation', target_value: 10, icon: '🎯', color: '', description: '' \};/);
    expect(goals).toMatch(/placeholder="#RRGGBB"/);
    expect(goals).toMatch(/style=\{goal\.color \? \{ borderColor: goal\.color \} : undefined\}/);
    expect(goals).toMatch(/\.\.\.\(goal\.color && !done \? \{ background: goal\.color \} : \{\}\)/);
    // With no colour of its own: the page's pink, and green once complete.
    expect(goalsCss).toMatch(/\.cg-bar > span \{[^}]*background: var\(--sp-pink\);/);
    expect(goalsCss).toMatch(/\.cg-bar > span\.is-done \{ background: var\(--sp-green\); \}/);
  });

  test('the beat phases, the blueprint actions and the social task chips read the families', () => {
    expect(blueprint).toMatch(/const phaseColors = \{ before: 'var\(--warning-bg\)', during: 'var\(--info-bg\)', after: 'var\(--accent-subtle\)' \};/);
    expect(blueprint).toMatch(/const phaseDots = \{ before: 'var\(--warning-text\)', during: 'var\(--info-text\)', after: 'var\(--accent-dark\)' \};/);
    expect(blueprint).toMatch(/background: phaseDots\[beat\.phase\] \|\| 'var\(--text-secondary\)', color: 'var\(--text-inverse\)'/);
    expect(blueprint).toMatch(/border: 'none', background: 'var\(--primary\)', color: 'var\(--text-inverse\)', fontWeight: 600, fontSize: 12/);
    expect(blueprint).toMatch(/border: '1px solid var\(--lala-gold\)', background: 'transparent', color: 'var\(--lala-gold-text\)'/);
    expect(blueprint).toMatch(/background: 'var\(--info-bg\)', color: 'var\(--info-text\)'/);
    expect(blueprint).toMatch(/background: 'var\(--success-bg\)', color: 'var\(--success-text\)'/);
    expect(blueprint).toMatch(/background: 'var\(--lala-gold-soft\)', borderRadius: 8, border: '1px solid var\(--lala-gold-line\)'/);
    expect(blueprint).not.toMatch(/color: 'var\(--lala-gold\)'/);
  });

  test("Lala's temperament, the phase, thread and slot statuses are family surfaces with text twins", () => {
    expect(season).toMatch(/unstoppable: \{ color: 'var\(--lala-gold-text\)', bg: 'var\(--lala-gold-soft\)', label: 'Unstoppable' \}/);
    expect(season).toMatch(/rising: {6}\{ color: 'var\(--primary-text\)', bg: 'var\(--primary-subtle\)', label: 'Rising' \}/);
    expect(season).toMatch(/broken: {6}\{ color: 'var\(--danger-text\)', bg: 'var\(--danger-bg\)', label: 'Broken' \}/);
    // The phase statuses are the Season page's chips (CareerGoals.css), each a soft ground with its text twin.
    expect(goalsCss).toMatch(/\.szn-chip\.is-phase-active \{ background: var\(--sp-green-soft\); color: var\(--sp-green\); \}/);
    expect(goalsCss).toMatch(/\.szn-chip\.is-phase-upcoming \{ background: var\(--sp-gold-soft\); color: var\(--sp-gold-text\); \}/);
    // The slot statuses are named in the JSX and coloured in WorldAdmin.css (the slot panel's chip).
    expect(plan).toMatch(/const SLOT_STATE_LABEL = \{ done: 'Done', in_production: 'In production', event_ready: 'Event pencilled', needs_event: 'Open' \};/);
    expect(css).toMatch(/\.wa-arc-panel\.state-done \.wa-arc-chip \{ background: var\(--lala-lavender-soft\); color: var\(--lala-lavender-text\); \}/);
    expect(css).toMatch(/\.wa-arc-panel\.state-in_production \.wa-arc-chip \{ background: var\(--accent-subtle\); color: var\(--accent-dark\); \}/);
    expect(css).toMatch(/\.wa-arc-panel\.state-event_ready \.wa-arc-chip \{ background: var\(--warning-bg\); color: var\(--warning-text\); \}/);
    expect(css).toMatch(/\.wa-arc-primary \{[^}]*background: var\(--lala-lavender\); color: var\(--text-inverse\);/);
    expect(season).toMatch(/stat\('Income', coins\(money\.season\.income\), 'var\(--success-text\)'\)/);
    expect(season).toMatch(/stroke="var\(--lala-gold\)"/);
    // One advance-with-debt confirm, at the roadmap's phase boundary (the Phase Controls copy went, 2026-10-17).
    expect(season.match(/\.\.\.S\.primaryBtn, background: 'var\(--warning-text\)'/g)).toHaveLength(1);
    expect(season).not.toMatch(/color: 'var\(--lala-gold\)'/);
  });

  test('every text pair the screen draws holds 4.5:1 or better', () => {
    const sources = [tokens];
    for (const [fg, bg] of [
      ['--text-inverse', '--primary'],
      ['--text-inverse', '--warning-text'],
      ['--text-inverse', '--info-text'],
      ['--text-inverse', '--accent-dark'],
      ['--text-inverse', '--gray-900'],
      ['--text-primary', '--surface-card'],
      ['--text-primary', '--lala-gold-soft'],
      ['--text-primary', '--warning-bg'],
      ['--text-primary', '--info-bg'],
      ['--text-primary', '--accent-subtle'],
      ['--text-secondary', '--surface-bg'],
      ['--text-secondary', '--surface-card'],
      ['--success-text', '--success-bg'],
      ['--danger-text', '--danger-bg'],
      ['--warning-text', '--warning-bg'],
      ['--warning-text', '--surface-card'],
      ['--info-text', '--info-bg'],
      ['--primary-text', '--primary-subtle'],
      ['--lala-gold-text', '--lala-gold-soft'],
      ['--lala-gold-text', '--surface-card'],
      // The Season Arc grid and panel.
      ['--text-inverse', '--lala-lavender'],
      ['--text-primary', '--lala-parchment'],
      ['--text-secondary', '--lala-parchment'],
      ['--lala-gold-text', '--lala-parchment'],
      ['--text-primary', '--lala-lavender-soft'],
      ['--lala-lavender-text', '--lala-lavender-soft'],
      ['--lala-lavender-text', '--surface-card'],
      ['--accent-dark', '--accent-subtle'],
      ['--accent-dark', '--surface-card'],
    ]) {
      const ratio = contrast(readToken(sources, fg), readToken(sources, bg));
      expect({ fg, bg, ratio }).toMatchObject({ ratio: expect.any(Number) });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
    // White on the old amber advance button and the old phase dots, kept below 4.5 so they are never reused.
    expect(contrast('#ffffff', '#f59e0b')).toBeLessThan(4.5);
    expect(contrast('#ffffff', '#3b82f6')).toBeLessThan(4.5);
    expect(contrast('#ffffff', '#8b5cf6')).toBeLessThan(4.5);
  });
});

describe('Season Plan, tidied (Evoni, 2026-10-17), as the Season page keeps it', () => {
  test('one advance control (at the phase boundary); the phases and history folded; Seed 24 goals only before there are any', () => {
    expect(season).not.toMatch(/Phase Controls<\/h3>/);
    expect(season).not.toMatch(/Advance Warning/);
    expect(goals).toMatch(/<details className="szn-fold" data-testid="season-phases-fold">/);
    expect(goals).toMatch(/\{goals\.length === 0 && !loadError && \(/);
    // Producer Mode no longer draws the Season Plan or its goals.
    expect(jsx).not.toMatch(/subTab === 'season'/);
    expect(jsx).not.toMatch(/career-goals-fold|SeasonTab/);
    expect(plan).not.toMatch(/export function SeasonTab|export function SeasonRoadmap/);
  });
});
