/**
 * The Episode Script tab wears the studio theme (audit VISUAL-01/02,
 * batch 4, ninth screen): the tab and its stylesheet set colors only
 * through tokens; the act and speaker colors are the text-safe family
 * tokens; Save, Approve Beat, Generate and Save Final Script are the
 * primary (they were purple, gold and green gradients); the approved
 * badge is ink on gold; the toast, guard and generate error read text
 * tokens on their surfaces.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../../styles/contrast';

const jsx = readFileSync(resolve(__dirname, 'EpisodeScriptTab.jsx'), 'utf8');
const css = readFileSync(resolve(__dirname, 'EpisodeScriptTab.css'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../../styles/design-tokens.css'), 'utf8');
const HEX = /#[0-9a-f]{3,8}\b/i;

describe('Episode Script theme', () => {
  test('the tab and its stylesheet carry no color literal and no gradient', () => {
    expect(stripTaskRefs(jsx)).not.toMatch(HEX);
    expect(stripTaskRefs(css)).not.toMatch(HEX);
    expect(jsx).not.toMatch(/linear-gradient/);
    expect(css).not.toMatch(/linear-gradient/);
  });

  test('acts and speakers read the text-safe family tokens', () => {
    expect(jsx).toMatch(/name: 'Opening Ritual',\s+icon: '🎬', color: 'var\(--primary-text\)'/);
    expect(jsx).toMatch(/name: 'Reveal',\s+icon: '✨', color: 'var\(--lala-gold-text\)'/);
    expect(jsx).toMatch(/name: 'Transformation Loop',\s+icon: '👗', color: 'var\(--accent-dark\)'/);
    expect(jsx).toMatch(/name: 'Event Outcome',\s+icon: '🏆', color: 'var\(--info-text\)'/);
    expect(jsx).toMatch(/name: 'Cliffhanger',\s+icon: '🔥', color: 'var\(--success-text\)'/);
    expect(jsx).toMatch(/const sc = \{ Prime: 'var\(--primary-text\)', Lala: 'var\(--accent-dark\)', Kelli: 'var\(--info-text\)', Guest: 'var\(--success-text\)' \};/);
  });

  test('every action is the primary and gold is never under white nor text', () => {
    expect(jsx).toMatch(/background: 'var\(--primary\)', color: 'var\(--text-inverse\)'[^}]*\}\}>Save</);
    expect(jsx).toMatch(/background: beat\.approved \? 'var\(--lala-gold-soft\)' : 'var\(--primary\)', color: beat\.approved \? 'var\(--lala-gold-text\)' : 'var\(--text-inverse\)'/);
    expect(jsx).toMatch(/background: saved \? 'var\(--success-bg\)' : 'var\(--primary\)', color: saved \? 'var\(--success-text\)' : 'var\(--text-inverse\)'/);
    expect(jsx).toMatch(/background: generating \? 'var\(--lala-parchment-2\)' : 'var\(--primary\)'/);
    expect(jsx).toMatch(/background: 'var\(--primary\)', color: 'var\(--text-inverse\)'[^}]*\}\}>💾 Save Final Script/);
    expect(jsx).toMatch(/background: 'var\(--lala-gold\)', color: 'var\(--text-primary\)'[^}]*\}\}>✓ APPROVED/);
    expect(jsx).not.toMatch(/(?<![-\w])color: 'var\(--lala-gold-text\)'[^}]*background: 'var\(--gray-900\)'/);
    expect(css).toMatch(/\.btn-save\s*\{[^}]*background: var\(--primary\);/);
    expect(css).toMatch(/\.preview-character\s*\{[^}]*color: var\(--primary-text\);/);
  });

  test('the toast, guard result and generate error read text tokens on their surfaces', () => {
    expect(jsx).toMatch(/background: toast\.type === 'error' \? 'var\(--danger-bg\)' : 'var\(--success-bg\)', color: toast\.type === 'error' \? 'var\(--danger-text\)' : 'var\(--success-text\)'/);
    expect(jsx).toMatch(/color: guardResult\.violations\?\.length > 0 \? 'var\(--danger-text\)' : 'var\(--success-text\)'/);
    expect(jsx).toMatch(/background: 'var\(--danger-bg\)', color: 'var\(--danger-text\)', border: '1px solid var\(--danger-border\)'/);
    expect(jsx).toMatch(/background: 'var\(--accent-subtle\)', border: '1px solid var\(--accent\)', color: 'var\(--text-primary\)'/);
  });

  test('every text pair the tab draws holds 4.5:1 or better', () => {
    const sources = [tokens];
    for (const [fg, bg] of [
      ['--text-inverse', '--primary'],
      ['--text-primary', '--lala-gold'],
      ['--primary-text', '--surface-card'],
      ['--primary-text', '--primary-subtle'],
      ['--lala-gold-text', '--surface-card'],
      ['--lala-gold-text', '--lala-gold-soft'],
      ['--accent-dark', '--surface-card'],
      ['--info-text', '--surface-card'],
      ['--success-text', '--surface-card'],
      ['--success-text', '--success-bg'],
      ['--danger-text', '--danger-bg'],
      ['--warning-text', '--surface-card'],
      ['--text-primary', '--accent-subtle'],
      ['--lala-gold', '--gray-900'],
      ['--lala-parchment-3', '--gray-900'],
      ['--text-inverse', '--gray-900'],
    ]) {
      const ratio = contrast(readToken(sources, fg), readToken(sources, bg));
      expect({ fg, bg, ratio }).toMatchObject({ ratio: expect.any(Number) });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
    // White on the old gold save gradient and on the old purple, kept
    // below 4.5 so they are never reused.
    expect(contrast('#ffffff', '#C9A83A')).toBeLessThan(4.5);
    expect(contrast('#ffffff', '#D4AF37')).toBeLessThan(4.5);
  });
});
