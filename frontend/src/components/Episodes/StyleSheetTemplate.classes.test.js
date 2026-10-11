/**
 * The style sheet template's class names belong to it alone (Evoni,
 * 2026-10-11: the Scene Sets banner turned into a tall tilted card once the
 * Style Page's CSS had loaded). Every stylesheet is global in the app, so
 * no other stylesheet may define a class the template uses. The template
 * renamed .ss-hero, .ss-chip and .ss-panel, which Scene Sets and Social
 * Systems also used.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const here = __dirname;
const template = readFileSync(resolve(here, 'StyleSheetTemplate.css'), 'utf8') + readFileSync(resolve(here, 'StyleSheetTemplate.jsx'), 'utf8');
const names = [...new Set(template.match(/\bss-[a-z0-9-]+/g))];

function cssFiles(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return cssFiles(p);
    return p.endsWith('.css') && !p.endsWith('StyleSheetTemplate.css') ? [p] : [];
  });
}

describe('style sheet template classes', () => {
  test('no other stylesheet defines a class the template uses', () => {
    const clashes = [];
    for (const file of cssFiles(resolve(here, '../..'))) {
      const css = readFileSync(file, 'utf8');
      for (const n of names) if (new RegExp(`\\.${n}(?![a-z0-9-])`).test(css)) clashes.push(`${n} in ${file}`);
    }
    expect(clashes).toEqual([]);
  });
});
