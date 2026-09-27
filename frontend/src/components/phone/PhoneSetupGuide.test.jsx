/**
 * PhoneSetupGuide — five lines counted from what exists, and one "Continue
 * setup →" (Task #2053, doctrine rule 18).
 */

import React from 'react';
import { vi, describe, afterEach, test, expect } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import PhoneSetupGuide, { phoneSetupProgress } from './PhoneSetupGuide';

const diag = (counts, missingTarget = 0, brokenTarget = 0) => ({ counts: { tap: 0, icon: 0, content: 0, ...counts }, missingTarget, brokenTarget });
const scr = (id, over = {}) => ({ id, name: id, category: 'phone', generated: true, url: `https://x/${id}.png`, ...over });
const CALL = { id: 'call_icon', name: 'Call', category: 'phone_icon', generated: true, url: 'https://x/call.png' };
const MAIL = { id: 'mail_icon', name: 'Mail', category: 'phone_icon', generated: true, url: 'https://x/mail.png' };
const texts = (p) => Object.fromEntries(p.lines.map(l => [l.key, `${l.state} ${l.text}`]));

describe('phoneSetupProgress (Task #2053)', () => {
  test('counts screens with an image, placed icons, zones with a destination and content screens', () => {
    const home = scr('home', { screen_links: [{ id: 'z1', target: 'calls', icon_overlay_id: 'call_icon' }, { id: 'z2' }] });
    const calls = scr('calls');
    const dms = scr('dms', { generated: false, url: null });
    const p = phoneSetupProgress({
      screens: [home, calls, dms],
      icons: [CALL, MAIL],
      diagnostics: new Map([['home', diag({ icon: 1, tap: 1, content: 2 }, 1)], ['calls', diag({})]]),
    });
    expect(texts(p)).toEqual({
      screens: 'todo 2 with an image of 3',
      icons: 'todo 1 placed of 2',
      links: 'todo 1 of 2 zones have a destination',
      content: 'info 1 screen with content zones',
      preview: 'info not run yet',
    });
    expect(p.complete).toBe(false);
    expect(p.doneCount).toBe(0);
  });

  test('Continue goes to Screens first, then Links, then Icons', () => {
    const home = scr('home', { screen_links: [{ id: 'z1', icon_overlay_id: 'call_icon' }] });
    const dms = scr('dms', { generated: false, url: null });
    const diagnostics = new Map([['home', diag({ icon: 1 }, 1)]]);
    expect(phoneSetupProgress({ screens: [home, dms], icons: [CALL, MAIL], diagnostics }).next).toEqual({ key: 'screens', screen: dms });
    expect(phoneSetupProgress({ screens: [home], icons: [CALL, MAIL], diagnostics }).next).toEqual({ key: 'links', screen: home });
    const linked = new Map([['home', diag({ icon: 1 })]]);
    expect(phoneSetupProgress({ screens: [home], icons: [CALL, MAIL], diagnostics: linked }).next).toEqual({ key: 'icons', screen: null });
    expect(phoneSetupProgress({ screens: [home], icons: [CALL], diagnostics: linked }).next).toBeNull();
  });

  test('no screens at all: Screens is unmet, with no screen to open', () => {
    const p = phoneSetupProgress({ screens: [], icons: [] });
    expect(texts(p).screens).toBe('todo none yet');
    expect(p.next).toEqual({ key: 'screens', screen: null });
  });

  test('complete once Screens, Icons and Links are; Content and Preview never block', () => {
    const home = scr('home', { screen_links: [{ id: 'z1', target: 'home', icon_overlay_id: 'call_icon' }] });
    const p = phoneSetupProgress({
      screens: [home],
      icons: [CALL],
      diagnostics: new Map([['home', diag({ icon: 1 })]]),
      flowAudit: { deadLinks: [{}], unreachable: [{}, {}], cycles: [] },
    });
    expect(p.complete).toBe(true);
    expect(p.next).toBeNull();
    expect(texts(p).content).toBe('info 0 screens with content zones');
    expect(texts(p).preview).toBe('info 1 dead link, 2 screens not reached in the last flow test');
  });

  test('no icons and no zones yet count as nothing to do, not as done work', () => {
    const p = phoneSetupProgress({ screens: [scr('home')], icons: [], diagnostics: new Map([['home', diag({})]]) });
    expect(texts(p).icons).toBe('empty none yet');
    expect(texts(p).links).toBe('empty no zones yet');
    expect(p.complete).toBe(true);
  });

  test('a clean flow test reads "no issues"; cycles are not issues', () => {
    const p = phoneSetupProgress({ screens: [], flowAudit: { deadLinks: [], unreachable: [], cycles: [['a', 'b', 'a']] } });
    expect(texts(p).preview).toBe('info no issues in the last flow test');
    expect(p.lines.find(l => l.key === 'preview').canRun).toBe(false);
  });
});

afterEach(() => cleanup());

describe('PhoneSetupGuide (Task #2053)', () => {
  const progress = () => phoneSetupProgress({
    screens: [scr('home', { screen_links: [{ id: 'z1' }] }), scr('dms', { generated: false, url: null })],
    icons: [CALL],
    diagnostics: new Map([['home', diag({ tap: 1 }, 1)]]),
  });

  test('shows the five lines, in order, and one Continue', () => {
    const { container } = render(<PhoneSetupGuide progress={progress()} onContinue={() => {}} onToggle={() => {}} />);
    const lines = Array.from(container.querySelectorAll('.phone-setup-guide__line')).map(l => l.textContent.replace('Run', '').trim());
    expect(lines).toEqual([
      '⚠Screens: 1 with an image of 2',
      '⚠Icons: 0 placed of 1',
      '⚠Links: 0 of 1 zone has a destination',
      '·Content: 0 screens with content zones',
      '·Preview: not run yet',
    ]);
    expect(screen.getAllByRole('button', { name: /Continue setup/ })).toHaveLength(1);
    expect(screen.getByText('0 of 3 done')).toBeTruthy();
  });

  test('Continue hands the first unmet item to the page', () => {
    const onContinue = vi.fn();
    const p = progress();
    render(<PhoneSetupGuide progress={p} onContinue={onContinue} onToggle={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Continue setup/ }));
    expect(onContinue).toHaveBeenCalledWith({ key: 'screens', screen: p.next.screen });
    expect(p.next.screen.id).toBe('dms');
  });

  test('Run appears on Preview until a flow test has run', () => {
    const onRunPreview = vi.fn();
    render(<PhoneSetupGuide progress={progress()} onRunPreview={onRunPreview} onToggle={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    expect(onRunPreview).toHaveBeenCalledTimes(1);
  });

  test('collapsed: only the summary and the toggle', () => {
    const onToggle = vi.fn();
    const { container } = render(<PhoneSetupGuide progress={progress()} collapsed onToggle={onToggle} />);
    expect(container.querySelector('.phone-setup-guide__lines')).toBeNull();
    const toggle = screen.getByRole('button', { name: /Setup/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  test('complete: the summary says so and there is no Continue', () => {
    const p = phoneSetupProgress({ screens: [scr('home')], icons: [], diagnostics: new Map([['home', diag({})]]) });
    render(<PhoneSetupGuide progress={p} onContinue={() => {}} onToggle={() => {}} />);
    expect(screen.getByText('✓ Screens, icons and links are done')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Continue setup/ })).toBeNull();
  });
});
