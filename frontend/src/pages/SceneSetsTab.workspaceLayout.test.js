/**
 * The set's workspace keeps its tabs in view (Evoni, 2026-10-16: "when i
 * click advance my other tabs disappear"). The tab bar scrolls sideways,
 * and a scrolling flex item may shrink to nothing: a long tab (the
 * Advanced spec) squeezed it out of the dialog's column. The header, the
 * handoff line and the tabs never shrink; only the body scrolls. jsdom has
 * no layout, so the stylesheet is read.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const css = readFileSync(resolve(__dirname, 'SceneSetsTab.css'), 'utf8');

describe('the set workspace layout', () => {
  test('the header, handoff and tabs never shrink; the body scrolls', () => {
    expect(css).toMatch(/\.scene-sets-modal-header,\s*\.scene-sets-modal-handoff,\s*\.scene-sets-modal-tabs \{ flex-shrink: 0; \}/);
    expect(css).toMatch(/\.scene-sets-modal-body \{ min-height: 0; \}/);
    expect(css).toMatch(/\.scene-sets-modal-body \{\s*flex: 1;\s*overflow-y: auto;/);
  });
});
