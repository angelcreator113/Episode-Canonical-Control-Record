/**
 * The LalaVerse hub's tab cards and tones (the mock, 2026-10-06). Each tab
 * has a tone: a wash, a border, a text color and a dot. Every text color
 * reads 4.5:1 on its wash and on white, and the cards' descriptions read
 * 4.5:1 on every wash. The cards hold on a phone: on touch screens
 * styles/responsive.css gives every button min-width: 44px, which replaces
 * the flex default (min-width: auto), so tabs could squeeze to 44px and
 * their descriptions ran into each other (Evoni's screenshot, 2026-10-05).
 * Below 720px the cards never shrink and the strip scrolls sideways.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken } from '../styles/contrast';
import { HUB_TABS } from './UniversePage';

const css = readFileSync(resolve(__dirname, 'LalaVerseHub.css'), 'utf8');
const setupCss = readFileSync(resolve(__dirname, '../components/WorldSetupProgress.css'), 'utf8');
const responsive = readFileSync(resolve(__dirname, '../styles/responsive.css'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../styles/design-tokens.css'), 'utf8');
const t = (name) => readToken([tokens], name);

const toneOf = (key) => {
  const m = css.match(new RegExp(`\\.lvh-tone-${key}\\s*\\{([^}]*)\\}`));
  const vars = {};
  for (const [, name, value] of (m?.[1] || '').matchAll(/(--tone-[a-z]+):\s*var\((--[a-z0-9-]+)\)/g)) vars[name] = t(value);
  return vars;
};

describe('LalaVerse hub tones', () => {
  test('every tab has a tone whose text reads 4.5:1 on its wash and on white', () => {
    for (const { key } of HUB_TABS) {
      const tone = toneOf(key);
      expect(Object.keys(tone).sort(), key).toEqual(['--tone-dot', '--tone-line', '--tone-soft', '--tone-text']);
      expect(contrast(tone['--tone-text'], tone['--tone-soft']), key).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tone['--tone-text'], t('--surface-card')), key).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t('--text-secondary'), tone['--tone-soft']), key).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('the hub and the setup styles are tokens only', () => {
    for (const sheet of [css, setupCss]) {
      const body = sheet.replace(/\/\*[\s\S]*?\*\//g, '');
      expect(body).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(body).not.toMatch(/rgba?\(/i);
    }
  });

  test('on a phone the cards never shrink and the strip scrolls', () => {
    // The touch rule this guards against is still there.
    expect(responsive).toMatch(/min-width: 44px/);
    const phone = css.slice(css.indexOf('@media (max-width: 720px)'));
    expect(phone).toMatch(/\.lvh-tabs \{[^}]*overflow-x: auto/);
    expect(phone).toMatch(/\.lvh-tab \{[^}]*flex-shrink: 0/);
    expect(css).toMatch(/\.lvh-tab-desc \{[^}]*font-size: 11px/);
    expect(css).not.toMatch(/\.lvh-tab-desc \{[^}]*opacity/);
  });

  test('a done step\'s white check reads 4.5:1 on every step tone', () => {
    for (const [, value] of setupCss.matchAll(/\.wsp-tone-\d \.wsp-circle \{ --tone: var\((--[a-z0-9-]+)\); \}/g)) {
      expect(contrast(t('--text-inverse'), t(value)), value).toBeGreaterThanOrEqual(4.5);
    }
    expect([...setupCss.matchAll(/\.wsp-tone-\d \.wsp-circle/g)]).toHaveLength(7);
  });
});
