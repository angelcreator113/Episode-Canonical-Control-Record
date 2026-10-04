/**
 * The Invitation Generator wears the studio theme (audit VISUAL-01/02,
 * batch 4 follow-up from the screenshot pass): the InvitationButton (its
 * preview modal, versions and toast) and the InvitationStyleFields panel,
 * mounted on the event detail modal and the Event Package page, set colors
 * only through tokens; the filled Generate action is the primary (gold
 * under white was 2.82:1); gold is an outline, a border, or gold text;
 * Approve is white on the success text; the versions, chips and toast read
 * their families.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../styles/contrast';

const jsx = readFileSync(resolve(__dirname, 'InvitationGenerator.jsx'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../styles/design-tokens.css'), 'utf8');
const HEX = /#[0-9a-f]{3,8}\b/i;

describe('Invitation Generator theme', () => {
  test('the component carries no color literal and no gradient; rgba is the scrim and the shadows only', () => {
    expect(stripTaskRefs(jsx)).not.toMatch(HEX);
    expect(jsx).not.toMatch(/linear-gradient/);
    expect(jsx).not.toMatch(/rgba\(184,\s*150,\s*46/);
    expect(jsx.match(/rgba\(/g).length).toBeLessThanOrEqual(5);
  });

  test('the buttons read the primary, gold-outline, success, danger and ink families', () => {
    expect(jsx).toMatch(/const goldBtn {2}= btn\('var\(--surface-bg\)', 'var\(--lala-gold-text\)', '1px solid var\(--lala-gold\)'\);/);
    expect(jsx).toMatch(/const goldFill = btn\('var\(--primary\)', 'var\(--text-inverse\)'\);/);
    expect(jsx).toMatch(/const greenBtn = btn\('var\(--success-text\)', 'var\(--text-inverse\)'\);/);
    expect(jsx).toMatch(/const redBtn {3}= btn\('var\(--surface-card\)', 'var\(--danger-text\)', '1px solid var\(--danger-border\)'\);/);
    expect(jsx).toMatch(/const grayBtn {2}= btn\('var\(--lala-parchment-2\)', 'var\(--text-secondary\)', '1px solid var\(--lala-parchment-3\)'\);/);
  });

  test('gold is never text nor under white; labels, tabs and links read gold text', () => {
    expect(jsx).not.toMatch(/color: 'var\(--lala-gold\)'/);
    expect(jsx).not.toMatch(/background: 'var\(--lala-gold\)'[^}]*color: 'var\(--text-inverse\)'/);
    expect(jsx).toMatch(/borderBottom: modalTab === tab\.key \? '2px solid var\(--lala-gold\)' : '2px solid transparent'/);
    expect(jsx).toMatch(/color: modalTab === tab\.key \? 'var\(--lala-gold-text\)' : 'var\(--text-secondary\)'/);
    expect(jsx).toMatch(/fontWeight: 700, color: 'var\(--lala-gold-text\)', textTransform: 'uppercase'/);
    expect(jsx).toMatch(/fontSize: 10, color: 'var\(--lala-gold-text\)', textDecoration: 'none', fontWeight: 600/);
    expect(jsx).toMatch(/borderBottom: '1px solid var\(--lala-gold-line\)'/);
    expect(jsx).toMatch(/border: '1px solid var\(--lala-gold\)', borderRadius: 10,/);
  });

  test('the versions, chips, errors and the toast read the token families', () => {
    expect(jsx).toMatch(/background: 'var\(--warning-bg\)', color: 'var\(--warning-text\)'/);
    expect(jsx).toMatch(/background: 'var\(--success-bg\)', color: 'var\(--success-text\)', borderRadius: 4, fontWeight: 700 \}\}>CURRENT/);
    expect(jsx).toMatch(/background: 'var\(--danger-bg\)', color: 'var\(--danger-text\)', border: '1px solid var\(--danger-border\)'/);
    expect(jsx.match(/background: toast\.type === 'error' \? 'var\(--danger-bg\)' : 'var\(--success-bg\)', color: toast\.type === 'error' \? 'var\(--danger-text\)' : 'var\(--success-text\)'/g)).toHaveLength(2);
    expect(jsx).toMatch(/border: isCurrent \? '2px solid var\(--lala-gold\)' : '1px solid var\(--lala-parchment-3\)'/);
  });

  test('every text pair the generator draws holds 4.5:1 or better', () => {
    const sources = [tokens];
    for (const [fg, bg] of [
      ['--text-inverse', '--primary'],
      ['--text-inverse', '--success-text'],
      ['--lala-gold-text', '--surface-bg'],
      ['--lala-gold-text', '--surface-card'],
      ['--danger-text', '--surface-card'],
      ['--danger-text', '--danger-bg'],
      ['--text-secondary', '--lala-parchment-2'],
      ['--text-secondary', '--surface-bg'],
      ['--text-secondary', '--surface-card'],
      ['--text-primary', '--surface-bg'],
      ['--warning-text', '--warning-bg'],
      ['--success-text', '--success-bg'],
      ['--success-text', '--surface-card'],
    ]) {
      const ratio = contrast(readToken(sources, fg), readToken(sources, bg));
      expect({ fg, bg, ratio }).toMatchObject({ ratio: expect.any(Number) });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
    // Gold as text, white on gold and white on the old green, kept below 4.5 so they are never reused.
    expect(contrast(readToken(sources, '--lala-gold'), readToken(sources, '--surface-card'))).toBeLessThan(4.5);
    expect(contrast(readToken(sources, '--text-inverse'), readToken(sources, '--lala-gold'))).toBeLessThan(4.5);
    expect(contrast('#ffffff', '#16a34a')).toBeLessThan(4.5);
  });
});
