/** Admin › The Pulse › Uploads' styles are tokens only, and their pairs read 4.5:1 (docs/VISUAL_SYSTEM.md §3). */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken } from '../../styles/contrast';

const css = readFileSync(resolve(__dirname, 'PulseUploads.css'), 'utf8');
const jsx = ['PulseImageSpot.jsx', 'PulseCitiesCard.jsx', 'PulseCharactersCard.jsx', 'PulseFitsCard.jsx', '../../pages/AdminPulse.jsx']
  .map((f) => readFileSync(resolve(__dirname, f), 'utf8')).join('\n');
const tokens = readFileSync(resolve(__dirname, '../../styles/design-tokens.css'), 'utf8');
const t = (name) => readToken([tokens], name);

describe('Uploads theme', () => {
  test('tokens only, in the stylesheet and the components', () => {
    const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(body).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(body).not.toMatch(/rgba?\(/i);
    expect(jsx.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/['"`]#[0-9a-f]{3,8}\b/i);
  });

  test('each text-on-fill pair reads 4.5:1', () => {
    const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .map(([, sel, b]) => ({ sel: sel.trim(), bg: b.match(/background:\s*var\((--[a-z0-9-]+)\)/)?.[1], fg: b.match(/(?:^|;|\s)color:\s*var\((--[a-z0-9-]+)\)/)?.[1] }))
      .filter((r) => r.bg && r.fg);
    expect(rules.length).toBeGreaterThan(6);
    for (const r of rules) expect(contrast(t(r.fg), t(r.bg)), r.sel).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t('--danger-text'), t('--surface-card'))).toBeGreaterThanOrEqual(4.5);
  });
});
