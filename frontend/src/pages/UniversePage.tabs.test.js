/**
 * The LalaVerse hub's tab strip holds on a phone. On touch screens
 * styles/responsive.css gives every button min-width: 44px, which replaces
 * the flex default (min-width: auto), so the tabs could squeeze to 44px and
 * their one-line descriptions ran into each other (Evoni's screenshot,
 * 2026-10-05). The tabs never shrink and the strip scrolls sideways; the
 * description is 10px at full strength (it was 8px at 0.7 opacity) and reads
 * 4.5:1 on both the resting and the selected tab.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken } from '../styles/contrast';

const jsx = readFileSync(resolve(__dirname, 'UniversePage.jsx'), 'utf8');
const responsive = readFileSync(resolve(__dirname, '../styles/responsive.css'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../styles/design-tokens.css'), 'utf8');
const t = (name) => readToken([tokens], name);
const tabStyle = (jsx.match(/const tabStyle = \(active\) => \(\{([\s\S]*?)\}\);/) || [])[1] || '';

describe('LalaVerse hub tab strip', () => {
  test('the tabs never shrink, and the strip scrolls', () => {
    // The touch rule this guards against is still there.
    expect(responsive).toMatch(/min-width: 44px/);
    expect(tabStyle).toMatch(/flexShrink: 0/);
    expect(tabStyle).toMatch(/whiteSpace: 'nowrap'/);
    expect(jsx).toMatch(/role="tablist"[^>]*overflowX: 'auto'/);
  });

  test('the description is 10px at full strength and reads 4.5:1', () => {
    const desc = jsx.match(/<span style=\{\{ ([^}]*) \}\}>\{t\.desc\}<\/span>/)[1];
    expect(desc).toMatch(/fontSize: 10\b/);
    expect(desc).not.toMatch(/opacity/);
    expect(tabStyle).toMatch(/color: active \? 'var\(--text-inverse\)' : 'var\(--text-secondary\)'/);
    expect(tabStyle).toMatch(/background: active \? 'var\(--primary\)' : 'transparent'/);
    expect(contrast(t('--text-inverse'), t('--primary'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t('--text-secondary'), t('--surface-bg'))).toBeGreaterThanOrEqual(4.5);
  });
});
