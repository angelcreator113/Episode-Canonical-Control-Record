/**
 * The Events tab's editors wear the studio theme (audit VISUAL-01/02,
 * batch 4, sixth screen): the inline event editor, the "Edit details"
 * modal and the compare modal in Producer Mode set colors only through
 * tokens, the AI revise action is the primary (no indigo gradient), and
 * the financial preview's text sits on its surfaces at 4.5:1.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../styles/contrast';

const jsx = readFileSync(resolve(__dirname, 'WorldAdmin.jsx'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../styles/design-tokens.css'), 'utf8');
const HEX = /#[0-9a-f]{3,8}\b/i;
// Task references ("Task #1786") are not colors.

const editorStart = jsx.indexOf('{editingEvent && (', jsx.indexOf('{/* Event editor */}'));
const editor = jsx.slice(editorStart, jsx.indexOf('{/* Generate-options toolbar', editorStart));
const modalStart = jsx.indexOf('{eventDetailModal && (() => {');
const modal = jsx.slice(modalStart, jsx.indexOf("{activeTab === 'opportunities' && (", modalStart));

describe('Events tab editors theme', () => {
  test('the slices are the editors', () => {
    expect(editor).toMatch(/data-testid="event-editor"/);
    expect(editor.length).toBeGreaterThan(5000);
    expect(modal).toMatch(/Financial Preview/);
    expect(modal).toMatch(/🔍 Compare|compareEvents/);
    expect(modal.length).toBeGreaterThan(20000);
  });

  test('the inline editor sets colors only through tokens', () => {
    expect(stripTaskRefs(editor)).not.toMatch(HEX);
    expect(editor).toMatch(/data-testid="event-editor" style=\{\{ background: 'var\(--surface-card\)', border: '2px solid var\(--primary\)'/);
  });

  test('the Edit details and compare modals set colors only through tokens', () => {
    expect(stripTaskRefs(modal)).not.toMatch(HEX);
  });

  test('the AI revise action is the primary, not an indigo gradient', () => {
    for (const slice of [editor, modal]) {
      expect(slice).not.toMatch(/linear-gradient/);
      expect(slice).toMatch(/background: aiRevising \? 'var\(--lala-parchment-2\)' : 'var\(--primary\)'/);
      expect(slice).toMatch(/color: aiRevising \? 'var\(--text-faint\)' : 'var\(--text-inverse\)'/);
    }
    expect(modal).toMatch(/style=\{\{ \.\.\.S\.primaryBtn, padding: '6px 20px', fontSize: 13 \}\}>\s*💾 Save/);
  });

  test('the financial preview reads the success and danger text tokens on their surfaces', () => {
    expect(modal).toMatch(/background: 'var\(--success-bg\)', borderRadius: 8, border: '1px solid var\(--success-border\)' \}\}>\s*<div style=\{\{[^}]*color: 'var\(--success-text\)' \}\}>Income \(coins\)/);
    expect(modal).toMatch(/background: 'var\(--danger-bg\)', borderRadius: 8, border: '1px solid var\(--danger-border\)' \}\}>\s*<div style=\{\{[^}]*color: 'var\(--danger-text\)' \}\}>Expenses \(coins\)/);
    expect(modal).toMatch(/color: net >= 0 \? 'var\(--success-text\)' : 'var\(--danger-text\)'/);
    expect(modal).not.toMatch(/var\(--danger\)' \}\}>Expenses/);
  });

  test('every text pair the editors draw holds 4.5:1 or better', () => {
    const sources = [tokens];
    for (const [fg, bg] of [
      ['--text-inverse', '--primary'],
      ['--success-text', '--success-bg'],
      ['--danger-text', '--danger-bg'],
      ['--warning-text', '--warning-bg'],
      ['--info-text', '--info-bg'],
      ['--primary-text', '--primary-subtle'],
      ['--accent-dark', '--accent-subtle'],
      ['--lala-gold-text', '--surface-bg'],
      ['--lala-gold-text', '--lala-gold-soft'],
      ['--text-primary', '--lala-gold-soft'],
      ['--text-secondary', '--lala-parchment-2'],
      ['--danger', '--surface-card'],
    ]) {
      const ratio = contrast(readToken(sources, fg), readToken(sources, bg));
      expect({ fg, bg, ratio }).toMatchObject({ ratio: expect.any(Number) });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });
});
