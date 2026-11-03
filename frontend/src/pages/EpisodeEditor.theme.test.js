/** The editor's disabled buttons all look disabled (Evoni, 2026-11-03: Export Video looked tappable). */
import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const css = fs.readFileSync(path.join(__dirname, 'EpisodeEditor.css'), 'utf8');
const page = fs.readFileSync(path.join(__dirname, 'EpisodeEditor.jsx'), 'utf8');

describe('EpisodeEditor disabled buttons', () => {
  test('a disabled primary button takes the plain grey, not the accent blue', () => {
    expect(css).toMatch(/\.tle-btn-primary:disabled, \.tle-btn-primary\[aria-disabled='true'\] \{ background: var\(--tle-panel-2\); border-color: var\(--tle-line\); color: var\(--tle-text\); \}/);
    // It comes after the primary rule, so it wins.
    expect(css.indexOf('.tle-btn-primary:disabled')).toBeGreaterThan(css.indexOf('.tle-btn-primary {'));
  });
  test('Export Video is a disabled primary button', () => {
    expect(page).toMatch(/className="tle-btn tle-btn-primary" disabled aria-disabled="true"[^>]*aria-label=\{`Export Video/);
  });
});
