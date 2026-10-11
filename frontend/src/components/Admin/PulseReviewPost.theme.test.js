/**
 * The feed's director tools (Task 2925) wear the studio theme: no hex
 * literal in the components or their stylesheet; buttons are lavender under
 * inverse text, AA.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken } from '../../styles/contrast';

const css = readFileSync(resolve(__dirname, 'PulseReviewPost.css'), 'utf8');
const jsx = ['PulseReviewPost.jsx', 'PulseReview.jsx'].map((f) => readFileSync(resolve(__dirname, f), 'utf8')).join('\n');
const tokens = readFileSync(resolve(__dirname, '../../styles/design-tokens.css'), 'utf8');
const HEX = /#[0-9a-f]{3,8}\b/i;
const t = (name) => readToken([tokens, css], name);

describe('Review tools: studio tokens', () => {
  test('no hex literal in the components or the stylesheet', () => {
    expect(css).not.toMatch(HEX);
    expect(jsx).not.toMatch(HEX);
  });
  test('buttons are lavender under inverse text; the draft badge reads warning on warning', () => {
    expect(css).toMatch(/\.prv-btn \{[^}]*background: var\(--lala-lavender\); color: var\(--text-inverse\)/);
    expect(contrast(t('--text-inverse'), t('--lala-lavender'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t('--warning-text'), t('--warning-bg'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t('--lala-lavender-text'), t('--lala-lavender-soft'))).toBeGreaterThanOrEqual(4.5);
  });
});
