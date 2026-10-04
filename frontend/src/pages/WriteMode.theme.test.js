/**
 * WriteMode wears the studio theme (audit VISUAL-01/02, batch 6, first
 * screen, part one of two): WriteMode.css and WriteMode.jsx carry no hex
 * literal; the page's `--wm-*` palette aliases the tokens; the five hex
 * gradients are gone (the frosted parchment bars stay rgba); Apply, Send,
 * Leave, Save review, the mode toggle, Focus, History, the restore and
 * paragraph actions, the review badge and Run are the primary under white
 * (they were ink or gold under parchment: gold under parchment is 2.7:1);
 * gold is a border, a fill under no text, or gold text; the pacing pips
 * and the goal ring read success, warning, info, danger and gold; the
 * rgba warm-grey and gold-wash tints are part two (text, 2026-10-04:
 * every color: is a token; see the test below) and part three (the washes
 * behind surfaces, borders and shadows).
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../styles/contrast';

const css = readFileSync(resolve(__dirname, 'WriteMode.css'), 'utf8');
const jsx = readFileSync(resolve(__dirname, 'WriteMode.jsx'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../styles/design-tokens.css'), 'utf8');
const HEX = /#[0-9a-f]{3,8}\b/i;
const t = (name) => readToken([tokens, css], name);
const rule = (selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|[\\s,])${escaped}\\s*\\{`, 'g');
  const blocks = [];
  let m;
  while ((m = re.exec(css))) blocks.push(css.slice(m.index, css.indexOf('}', m.index)));
  if (!blocks.length) throw new Error(`rule missing: ${selector}`);
  return blocks.join('\n');
};

describe('WriteMode theme, part one', () => {
  test('the stylesheet and the page carry no hex literal and no hex gradient', () => {
    expect(stripTaskRefs(css)).not.toMatch(HEX);
    expect(stripTaskRefs(jsx)).not.toMatch(HEX);
    expect(css).not.toMatch(/var\(--[a-z0-9-]+,\s*#/i);
    expect(css).not.toMatch(/gradient\([^)]*#/);
    expect(jsx).not.toMatch(/gradient/);
    // The arc compass track is the one color gradient left, in tokens.
    expect(css).toMatch(/linear-gradient\(90deg, var\(--success\), var\(--wm-gold\), var\(--danger\)\)/);
  });

  test('the page palette aliases the tokens', () => {
    expect(css).toMatch(/:root \{\n  --wm-parchment: var\(--surface-bg\);\n  --wm-ink: var\(--text-primary\);\n  --wm-gold: var\(--lala-gold\);\n  --wm-gold-text: var\(--lala-gold-text\);\n  --wm-muted: var\(--text-secondary\);\n  --wm-border: var\(--lala-parchment-3\);\n\}/);
    expect(t('--wm-gold-text')).toBe(t('--lala-gold-text'));
  });

  test('the filled actions are the primary under white', () => {
    for (const sel of ['.wm-mode-btn.active', '.wm-send-btn:hover:not(:disabled)', '.wm-focus-btn.active', '.wm-history-btn.active', '.wm-history-restore:hover', '.wm-para-actions button:hover:not(:disabled)', '.wm-review-save']) {
      const r = rule(sel);
      expect(r, sel).toMatch(/background:\s+var\(--primary\);/);
      expect(r, sel).toMatch(/color:\s+var\(--text-inverse\);/);
      expect(r, sel).toMatch(/border-color:\s+var\(--primary\);/);
    }
    for (const sel of ['.wm-apply-btn', '.wm-modal-leave', '.wm-history-badge', '.wm-tab-badge', '.wm-chapter-instruction-run']) {
      const r = rule(sel);
      expect(r, sel).toMatch(/background:\s+var\(--primary\);/);
      expect(r, sel).toMatch(/color:\s+var\(--text-inverse\);/);
    }
    expect(rule('.wm-apply-btn:hover:not(:disabled)')).toMatch(/background: var\(--primary-dark\);/);
    expect(rule('.wm-modal-leave:hover')).toMatch(/background: var\(--primary-dark\);/);
    expect(rule('.wm-preview-accept')).toMatch(/background: var\(--primary\) !important;/);
    expect(rule('.wm-para-delete:hover:not(:disabled)')).toMatch(/background: var\(--danger\) !important;\n\s+color: var\(--text-inverse\) !important;/);
  });

  test('gold is a border, a fill under no text, or gold text', () => {
    expect(css).not.toMatch(/(?<![a-z-])color:\s+var\(--wm-gold\);/);
    expect(css).not.toMatch(/background:\s+var\(--wm-gold\);\n\s+color:/);
    expect(rule('.wm-save-status')).toMatch(/color: var\(--wm-gold-text\);/);
    expect(rule('.wm-write-all-btn')).toMatch(/border: 1px solid var\(--wm-gold\);[\s\S]*color: var\(--wm-gold-text\);/);
    expect(rule('.wm-goal-fill')).toMatch(/background: var\(--wm-gold\);/);
    expect(rule('.wm-manuscript-page')).toMatch(/var\(--surface-card\);/);
    expect(rule('.wm-mic-btn.listening')).toMatch(/background: var\(--wm-ink\);/);
    expect(rule('.wm-center-tab--active')).toMatch(/border-bottom-color: var\(--wm-gold\);/);
  });

  test('statuses and the pacing arc read the families', () => {
    expect(rule('.wm-review-stat.approved')).toMatch(/color: var\(--success-text\);/);
    expect(rule('.wm-review-stat.pending')).toMatch(/color: var\(--danger-text\);/);
    expect(rule('.wm-mic-error')).toMatch(/color: var\(--danger-text\);/);
    expect(rule('.wm-tension-pip--action')).toMatch(/background: var\(--danger\);/);
    expect(rule('.wm-tension-pip--tension')).toMatch(/background: var\(--warning\);/);
    expect(rule('.wm-tension-pip--interior')).toMatch(/background: var\(--info\);/);
    expect(rule('.wm-tension-pip--calm')).toMatch(/background: var\(--success\);/);
    expect(jsx).toMatch(/progress >= 1 \? 'var\(--success\)' : progress >= 0\.5 \? 'var\(--lala-gold\)' : 'var\(--danger\)'/);
    expect(jsx).toMatch(/goalMet \? 'var\(--success\)' : pct > 50 \? 'var\(--lala-gold\)' : 'var\(--danger\)'/);
    expect(jsx).toMatch(/fill=\{p\.tone === 'action' \? 'var\(--danger\)' : p\.tone === 'interior' \? 'var\(--info\)' : p\.tone === 'calm' \? 'var\(--success\)' : 'var\(--lala-gold\)'\}/);
    expect(jsx.match(/listening \? 'var\(--surface-bg\)' : 'var\(--text-primary\)'/g)).toHaveLength(3);
  });

  test('part two: no text colour is a translucent ink or gold; text reads the tokens', () => {
    // color: only (not background-color, border-color): the 102 ink and gold
    // rgba text tints became --wm-ink, --wm-muted, --wm-gold-text or, on a
    // placeholder or disabled control, --text-faint (2026-10-04).
    expect(css).not.toMatch(/(^|[^-\w])color:\s*rgba\(/m);
    expect(css).toMatch(/\.wm-review-stat\.total\s*\{ color: var\(--wm-muted\); \}/);
    expect(css).toMatch(/\.wm-line-edit\s*\{ color: var\(--wm-muted\); \}/);
    const faint = [...css.matchAll(/([^{}]+)\{[^{}]*color: var\(--text-faint\)[^{}]*\}/g)].map((m) => m[1].trim());
    for (const sel of faint) expect(sel, sel).toMatch(/::placeholder|:disabled|\[disabled\]|\.disabled/);
    expect(contrast(t('--text-faint'), t('--wm-parchment'))).toBeLessThan(4.5); // faint is for placeholders only
  });

  test('part three: the washes that match a token are the token; the rest only shrink', () => {
    // 2026-10-04: 94 plain background and border washes whose colour over the
    // parchment is within 8 RGB steps of --lala-parchment-2, --lala-gold-soft
    // or --lala-gold-line are those tokens; shadows, gradients, white glass
    // and washes with no near token stay rgba. A ratchet: never more again.
    // Real colours only: the header comment documents the palette as rgba(28,24,20,_).
    const rgba = (css.match(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[0-9.]+\s*\)/g) || []).length;
    expect(rgba).toBeLessThanOrEqual(260);
    expect((css.match(/var\(--lala-parchment-2\)/g) || []).length).toBeGreaterThanOrEqual(78);
    expect((css.match(/var\(--lala-gold-soft\)/g) || []).length).toBeGreaterThanOrEqual(13);
    expect((css.match(/var\(--lala-gold-line\)/g) || []).length).toBeGreaterThanOrEqual(3);
    expect(css).toMatch(/\.wm-focus-exit:hover \{[^}]*background: rgba\(28, 24, 20, 0\.6\)/); // a dark overlay stays glass
  });

  test('every text pair the page uses reads at 4.5:1 or better', () => {
    const pairs = [
      ['--text-inverse', '--primary'], ['--text-inverse', '--primary-dark'], ['--text-inverse', '--danger'],
      ['--wm-ink', '--wm-parchment'], ['--wm-ink', '--surface-card'], ['--wm-ink', '--lala-parchment-2'],
      ['--wm-gold-text', '--wm-parchment'], ['--wm-gold-text', '--surface-card'],
      ['--wm-muted', '--wm-parchment'], ['--wm-muted', '--surface-card'],
      ['--success-text', '--wm-parchment'], ['--danger-text', '--wm-parchment'],
    ];
    for (const [fg, bg] of pairs) expect(contrast(t(fg), t(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    // retired: parchment on gold, gold as text on parchment, parchment on the light gold badge
    expect(contrast('#FAF7F0', '#B8962E')).toBeLessThan(4.5);
    expect(contrast('#B8962E', '#FAF7F0')).toBeLessThan(4.5);
    expect(contrast('#FAF7F0', '#C9A84C')).toBeLessThan(4.5);
  });
});
