/**
 * PhoneHub — screen cards show their state and one next action (Task #2042,
 * doctrine rule 18: "Every screen shows its status in plain words and one
 * next action").
 *
 * screenCardStatus turns what the page already computes (the image, its
 * screenDiagnostics entry, and the zones leading to the screen) into up to
 * three lines, a status word and the first unmet step. The card draws them
 * and a "Continue →" that hands the step to the page.
 */

import React from 'react';
import { vi, describe, afterEach, test, expect } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';

vi.mock('./ScreenContentRenderer', () => ({ default: () => null }));
vi.mock('./phone/PhoneMapView', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, default: () => null };
});

import PhoneHub, { screenCardStatus } from './PhoneHub';

const diag = (counts, missingTarget = 0, brokenTarget = 0) => ({ counts: { tap: 0, icon: 0, content: 0, ...counts }, missingTarget, brokenTarget });
const texts = (status) => status.lines.map(l => l.text);

describe('screenCardStatus (Task #2042)', () => {
  test('a screen with no image needs its image first', () => {
    const s = screenCardStatus({ hasImage: false, diagnostics: undefined, isHome: false, incoming: 0 });
    expect(texts(s)).toEqual(['⚠ No image', '⚠ Nothing links here']);
    expect(s).toMatchObject({ ready: false, next: 'image' });
  });

  test('icons and links counted; every zone with a destination reads N/N linked', () => {
    const s = screenCardStatus({ hasImage: true, diagnostics: diag({ icon: 3, tap: 1 }), isHome: false, incoming: 2 });
    expect(texts(s)).toEqual(['✓ Image', '3 icons · 4/4 linked']);
    expect(s).toMatchObject({ ready: true, next: null });
  });

  test('one icon is singular', () => {
    expect(texts(screenCardStatus({ hasImage: true, diagnostics: diag({ icon: 1 }), incoming: 1 }))[1]).toBe('1 icon · 1/1 linked');
  });

  test('zones with no destination (none set, or a missing screen) come before incoming links', () => {
    const one = screenCardStatus({ hasImage: true, diagnostics: diag({ icon: 2 }, 1), isHome: false, incoming: 0 });
    expect(texts(one)).toEqual(['✓ Image', '⚠ 1 zone has no destination', '⚠ Nothing links here']);
    expect(one.next).toBe('links');
    const two = screenCardStatus({ hasImage: true, diagnostics: diag({ icon: 2, tap: 1 }, 1, 1), isHome: true });
    expect(texts(two)[1]).toBe('⚠ 2 zones have no destination');
  });

  test('a screen with no zones is not missing anything', () => {
    const s = screenCardStatus({ hasImage: true, diagnostics: diag({}), isHome: false, incoming: 1 });
    expect(texts(s)).toEqual(['✓ Image', 'No zones yet']);
    expect(s.ready).toBe(true);
  });

  test('the home screen is never "Nothing links here"', () => {
    const s = screenCardStatus({ hasImage: true, diagnostics: diag({ icon: 2 }), isHome: true, incoming: 0 });
    expect(texts(s)).not.toContain('⚠ Nothing links here');
    expect(s.ready).toBe(true);
  });

  test('nothing linking here is the last step', () => {
    const s = screenCardStatus({ hasImage: true, diagnostics: diag({ icon: 1 }), isHome: false, incoming: 0 });
    expect(s).toMatchObject({ ready: false, next: 'incoming' });
  });
});

// ── The card ────────────────────────────────────────────────────────────────

const HOME = {
  id: 'home', name: 'Homepage', category: 'phone', generated: true, is_home: true, url: 'https://x/home.png',
  screen_links: [
    { id: 'z1', x: 10, y: 20, w: 12, h: 9, target: 'calls', label: 'Calls', icon_overlay_id: 'call_icon' },
    { id: 'z2', x: 30, y: 20, w: 12, h: 9, label: 'Mail' },
  ],
};
const CALLS = { id: 'calls', name: 'Calls list', category: 'phone', generated: true, url: 'https://x/calls.png' };
const MAIL = { id: 'mail', name: 'Mail', category: 'phone', generated: true, url: 'https://x/mail.png' };
const DMS = { id: 'dms', name: 'DMs', category: 'phone', generated: false, url: null };
const CALL = { id: 'call_icon', name: 'Call', category: 'phone_icon', generated: true, url: 'https://x/call.png' };

const DIAGNOSTICS = new Map([
  ['home', diag({ icon: 1, tap: 1 }, 1)],
  ['calls', diag({})],
  ['mail', diag({})],
]);

function hub({ onContinue = vi.fn(), tab = 'screens', diagnostics = DIAGNOSTICS, active = HOME } = {}) {
  const utils = render(
    <PhoneHub
      screens={[HOME, CALLS, MAIL, DMS, CALL]}
      activeScreen={active}
      onSelectScreen={() => {}}
      onNavigate={() => {}}
      activeTab={tab}
      suppressSectionTabs
      screenDiagnostics={diagnostics}
      onContinue={onContinue}
    />,
  );
  return { ...utils, onContinue };
}
const card = (container, name) => Array.from(container.querySelectorAll('.screen-card')).find(c => within(c).queryByText(name));

afterEach(() => cleanup());

describe('PhoneHub screen cards (Task #2042)', () => {
  test('each card shows a status word and its lines', () => {
    const { container } = hub();
    const home = within(card(container, 'Homepage'));
    expect(home.getByText('★ HOME')).toBeTruthy();
    expect(home.getByText('Needs setup')).toBeTruthy();
    expect(home.getByText('✓ Image')).toBeTruthy();
    expect(home.getByText('⚠ 1 zone has no destination')).toBeTruthy();
    expect(home.queryByText('⚠ Nothing links here')).toBeNull();

    const calls = within(card(container, 'Calls list'));
    expect(calls.getByText('Ready')).toBeTruthy();
    expect(calls.getByText('No zones yet')).toBeTruthy();
    expect(calls.queryByText('⚠ Nothing links here')).toBeNull();
    expect(calls.queryByRole('button', { name: /Continue/ })).toBeNull();

    const mail = within(card(container, 'Mail'));
    expect(mail.getByText('Needs setup')).toBeTruthy();
    expect(mail.getByText('⚠ Nothing links here')).toBeTruthy();

    const dms = within(card(container, 'DMs'));
    expect(dms.getByText('⚠ No image')).toBeTruthy();
  });

  test('"Continue →" hands the card\'s first unmet step to the page, and nothing else', () => {
    const { container, onContinue } = hub();
    fireEvent.click(within(card(container, 'Homepage')).getByRole('button', { name: /Continue/ }));
    expect(onContinue).toHaveBeenLastCalledWith(HOME, 'links');
    fireEvent.click(within(card(container, 'Mail')).getByRole('button', { name: /Continue/ }));
    expect(onContinue).toHaveBeenLastCalledWith(MAIL, 'incoming');
    fireEvent.click(within(card(container, 'DMs')).getByRole('button', { name: /Continue/ }));
    expect(onContinue).toHaveBeenLastCalledWith(DMS, 'image');
    expect(onContinue).toHaveBeenCalledTimes(3);
    expect(screen.getAllByRole('button', { name: /Continue/ })).toHaveLength(3);
  });

  test('without onContinue there is no button; the lines still show', () => {
    const { container } = hub({ onContinue: null });
    expect(container.querySelector('.screen-card-continue')).toBeNull();
    expect(within(card(container, 'Mail')).getByText('⚠ Nothing links here')).toBeTruthy();
  });

  test('icon cards keep their own label and get no status', () => {
    const { container } = hub({ tab: 'icons' });
    const call = card(container.querySelector('.phone-hub-icon-grid'), 'Call');
    expect(within(call).getByText('✓ 1 screen')).toBeTruthy();
    expect(call.querySelector('[data-testid="screen-card-status"]')).toBeNull();
  });

  test('every status line and the button truncate on one row (375px)', () => {
    const { container } = hub();
    const css = container.querySelector('style').textContent;
    const rule = (sel) => css.slice(css.indexOf(`${sel} {`), css.indexOf('}', css.indexOf(`${sel} {`)));
    for (const sel of ['.screen-card-status__line', '.screen-card-continue']) {
      expect(rule(sel)).toMatch(/overflow: hidden/);
      expect(rule(sel)).toMatch(/text-overflow: ellipsis/);
      expect(rule(sel)).toMatch(/white-space: nowrap/);
    }
    expect(rule('.screen-card-continue')).toMatch(/max-width: 100%/);
  });
});
