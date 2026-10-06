/**
 * The Show Bible front page's styles are tokens only, and its gold reads:
 * gold text 4.5:1 on white and on the gold wash, ink 4.5:1 on the gold
 * button (docs/VISUAL_SYSTEM.md).
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken } from '../../styles/contrast';

const css = readFileSync(resolve(__dirname, 'ShowBibleSummary.css'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../../styles/design-tokens.css'), 'utf8');
const t = (name) => readToken([tokens], name);

describe('ShowBibleSummary theme', () => {
  test('tokens only', () => {
    const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(body).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(body).not.toMatch(/rgba?\(/i);
  });

  test('the gold reads', () => {
    expect(css).toMatch(/\.sbs-btn \{[^}]*background: var\(--lala-gold\); color: var\(--text-primary\)/);
    expect(contrast(t('--text-primary'), t('--lala-gold'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t('--lala-gold-text'), t('--surface-card'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t('--lala-gold-text'), t('--lala-gold-soft'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t('--text-secondary'), t('--lala-gold-soft'))).toBeGreaterThanOrEqual(4.5);
  });
});
