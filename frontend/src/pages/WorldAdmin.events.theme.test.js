/**
 * The Events queue wears the studio theme (audit VISUAL-01/02, batch 4,
 * fourth screen). The queue is the Events tab's header, bulk bar, filter
 * bar, templates panel, generate-options toolbar, cards, empty state,
 * pager and the Ideas drawer, plus the .wa-ev-* stylesheet and the five
 * queue states' colors. The inline event editor and the "Edit details"
 * modal are the Event Package's and migrate with it.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { EVENT_QUEUE_STATES } from '../utils/eventReadinessSections';
import { contrast, readToken, stripTaskRefs } from '../styles/contrast';

const jsx = readFileSync(resolve(__dirname, 'WorldAdmin.jsx'), 'utf8');
const css = readFileSync(resolve(__dirname, 'WorldAdmin.css'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../styles/design-tokens.css'), 'utf8');
// Task references ("Task #2361") are not colors.
const HEX = /#[0-9a-f]{3,8}\b/i;

const slice = (text, start, end) => {
  const a = text.indexOf(start);
  const b = text.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error(`marker missing: ${start} / ${end}`);
  return text.slice(a, b);
};

const QUEUE = [
  ['{/* Header — a queue, not an editor', '{/* Event editor */}'],
  ['{/* Generate-options toolbar', '{/* Nothing sits below the queue now.'],
  ['{eventsIdeasOpen && (', '{eventDetailModal && (() => {'],
];

describe('Events queue theme', () => {
  test.each(QUEUE)('the queue JSX from "%s" sets colors only through tokens', (start, end) => {
    expect(stripTaskRefs(slice(jsx, start, end))).not.toMatch(HEX);
  });

  test('the Generate action is lavender, not gold or green; the state cards and New event follow the redesign', () => {
    const header = slice(jsx, QUEUE[0][0], QUEUE[0][1]);
    expect(header).toMatch(/🗓️ Auto-Fill This Month/);
    expect(header).not.toMatch(/background: '#B8962E'/);
    expect(header).toMatch(/background: 'var\(--lala-lavender\)', color: 'var\(--text-inverse\)'[^}]*\}\}>\s*🎬 Generate from/);
    expect(header).toMatch(/className=\{`wa-ev-state\$\{on \? ' active' : ''\}`\}/);
    expect(header).toMatch(/style=\{S\.primaryBtn\}>\s*<Plus[^>]*\/>New event/);
  });

  test('every queue state colors its chip, bar and button through tokens', () => {
    for (const [key, cfg] of Object.entries(EVENT_QUEUE_STATES)) {
      expect({ key, color: cfg.color }).toMatchObject({ color: expect.stringMatching(/^var\(--[a-z0-9-]+\)$/) });
      expect({ key, bg: cfg.bg }).toMatchObject({ bg: expect.stringMatching(/^var\(--[a-z0-9-]+\)$/) });
    }
  });

  test('the .wa-ev-* stylesheet uses tokens only and the current page is the primary', () => {
    const block = css.slice(css.indexOf('.wa-ev-drawer-backdrop {'), css.indexOf('.wa-ev-pager-status {') + 120);
    expect(stripTaskRefs(block)).not.toMatch(HEX);
    expect(block).toMatch(/\.wa-ev-pager-btn\.is-current\s*{\s*background: var\(--primary\);/);
    expect(block).toMatch(/\.wa-ev-drawer-title\s*{[^}]*color: var\(--lala-gold-text\);/);
  });

  test('every state text sits on its surface and on white at 4.5:1 or better', () => {
    const sources = [tokens];
    const read = (v) => readToken(sources, v.match(/^var\((--[a-z0-9-]+)\)$/)[1]);
    const white = readToken(sources, '--surface-card');
    for (const [key, cfg] of Object.entries(EVENT_QUEUE_STATES)) {
      const fg = read(cfg.color);
      const onBg = contrast(fg, read(cfg.bg));
      const onWhite = contrast(fg, white);
      expect({ key, onBg }).toMatchObject({ onBg: expect.any(Number) });
      expect(onBg).toBeGreaterThanOrEqual(4.5);
      expect(onWhite).toBeGreaterThanOrEqual(4.5);
    }
    // The new text tokens this screen introduced, and the pairs it draws.
    for (const [fg, bg] of [
      ['--success-text', '--success-bg'],
      ['--info-text', '--info-bg'],
      ['--danger-text', '--danger-bg'],
      ['--lala-gold-text', '--lala-gold-soft'],
      ['--accent-dark', '--accent-subtle'],
      ['--text-inverse', '--primary'],
    ]) {
      expect({ fg, bg, ratio: contrast(readToken(sources, fg), readToken(sources, bg)) }).toMatchObject({ ratio: expect.any(Number) });
      expect(contrast(readToken(sources, fg), readToken(sources, bg))).toBeGreaterThanOrEqual(4.5);
    }
    // --danger as text on its own surface is the pair the audit's rule
    // forbids; it stays below 4.5 so nobody reuses it for text.
    expect(contrast(readToken(sources, '--danger'), readToken(sources, '--danger-bg'))).toBeLessThan(4.5);
  });
});
