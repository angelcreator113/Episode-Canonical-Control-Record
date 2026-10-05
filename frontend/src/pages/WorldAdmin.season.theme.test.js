/**
 * The Producer Mode Season Plan wears the studio theme (audit
 * VISUAL-01/02, batch 5, second screen): the Career Goals block (goal
 * editor, goal cards and progress bars, completed goals, suggested events
 * and the episode blueprint modal with its beats, feed moments, social
 * tasks and feed posts) and SeasonTab with the five helpers it renders
 * (BalanceTrend, PlanningInsights, StoryThreadsCard, SlotIntentionEditor,
 * SeasonRoadmap) set colors only through tokens. Lala's temperament, the
 * phase statuses, the thread statuses and the slot statuses are family
 * surfaces with text twins; a goal's own color is data (the API seeds and
 * defaults it) and falls back to the primary; the beat phases read family
 * surfaces with dots the beat number reads white on; the blueprint's
 * generate action is the primary; the advance action is the warning text
 * under white (its old fill was 2.2:1).
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
// The goals block is the second season-sub-tab block (the first mounts SeasonTab).
const firstSeason = jsx.indexOf("{activeTab === 'episodes' && subTab === 'season' && (");
const goals = slice(jsx, "{activeTab === 'episodes' && subTab === 'season' && (", "{activeTab === 'wardrobe' && subTab === 'scene-sets' && (", firstSeason + 1);
const season = slice(jsx, 'function BalanceTrend', 'function OpportunitiesTab');

describe('Season Plan theme', () => {
  test('the goals block and SeasonTab with its helpers set colors only through tokens', () => {
    expect(stripTaskRefs(goals)).not.toMatch(HEX);
    expect(goals).not.toMatch(/linear-gradient/);
    expect(stripTaskRefs(season)).not.toMatch(HEX);
    expect(season).not.toMatch(/linear-gradient|rgba\(184/);
  });

  test("a goal's color is data with a token fallback; the form no longer seeds a literal", () => {
    expect(goals).toMatch(/icon: '🎯', color: '', description: '' \}\); setEditingGoal\('new'\)/);
    expect(goals).toMatch(/placeholder="#RRGGBB"/);
    expect(goals).toMatch(/`2px solid \$\{g\.color \|\| 'var\(--primary\)'\}`/);
    expect(goals).toMatch(/background: pct >= 100 \? 'var\(--success\)' : \(g\.color \|\| 'var\(--primary\)'\)/);
  });

  test('the beat phases, the blueprint actions and the social task chips read the families', () => {
    expect(goals).toMatch(/const phaseColors = \{ before: 'var\(--warning-bg\)', during: 'var\(--info-bg\)', after: 'var\(--accent-subtle\)' \};/);
    expect(goals).toMatch(/const phaseDots = \{ before: 'var\(--warning-text\)', during: 'var\(--info-text\)', after: 'var\(--accent-dark\)' \};/);
    expect(goals).toMatch(/background: phaseDots\[beat\.phase\] \|\| 'var\(--text-secondary\)', color: 'var\(--text-inverse\)'/);
    expect(goals).toMatch(/border: 'none', background: 'var\(--primary\)', color: 'var\(--text-inverse\)', fontWeight: 600, fontSize: 12/);
    expect(goals).toMatch(/border: '1px solid var\(--lala-gold\)', background: 'transparent', color: 'var\(--lala-gold-text\)'/);
    expect(goals).toMatch(/background: 'var\(--info-bg\)', color: 'var\(--info-text\)'/);
    expect(goals).toMatch(/background: 'var\(--success-bg\)', color: 'var\(--success-text\)'/);
    expect(goals).toMatch(/background: 'var\(--lala-gold-soft\)', borderRadius: 8, border: '1px solid var\(--lala-gold-line\)'/);
    expect(goals).not.toMatch(/color: 'var\(--lala-gold\)'/);
  });

  test("Lala's temperament, the phase, thread and slot statuses are family surfaces with text twins", () => {
    expect(season).toMatch(/unstoppable: \{ color: 'var\(--lala-gold-text\)', bg: 'var\(--lala-gold-soft\)', label: 'Unstoppable' \}/);
    expect(season).toMatch(/rising: {6}\{ color: 'var\(--primary-text\)', bg: 'var\(--primary-subtle\)', label: 'Rising' \}/);
    expect(season).toMatch(/broken: {6}\{ color: 'var\(--danger-text\)', bg: 'var\(--danger-bg\)', label: 'Broken' \}/);
    expect(season).toMatch(/active: \{ bg: 'var\(--success-bg\)', color: 'var\(--success-text\)', border: 'var\(--success-border\)' \}/);
    expect(season).toMatch(/upcoming: \{ bg: 'var\(--lala-gold-soft\)', color: 'var\(--lala-gold-text\)', border: 'var\(--lala-gold-line\)' \}/);
    // The slot statuses are named in the JSX and coloured in WorldAdmin.css (the Season Arc redesign).
    expect(jsx).toMatch(/const SLOT_STATE_LABEL = \{ done: 'Done', in_production: 'In production', event_ready: 'Event pencilled', needs_event: 'Open' \};/);
    expect(css).toMatch(/\.wa-arc-slot\.state-done \.wa-arc-slot-state \{ color: var\(--lala-lavender-text\); \}/);
    expect(css).toMatch(/\.wa-arc-slot\.state-in_production \.wa-arc-slot-state \{ color: var\(--accent-dark\); \}/);
    expect(css).toMatch(/\.wa-arc-slot\.state-event_ready \.wa-arc-slot-state \{ color: var\(--warning-text\); \}/);
    expect(css).toMatch(/\.wa-arc-primary \{[^}]*background: var\(--lala-lavender\); color: var\(--text-inverse\);/);
    expect(season).toMatch(/stat\('Income', coins\(money\.season\.income\), 'var\(--success-text\)'\)/);
    expect(season).toMatch(/stroke="var\(--lala-gold\)"/);
    expect(season.match(/\.\.\.S\.primaryBtn, background: 'var\(--warning-text\)'/g)).toHaveLength(2);
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
