/**
 * "Ready to film?" (Script tab audit, 2026-10-15): the script-wide checks in
 * one card at the top of the Script tab; a row a beat fixes opens that beat.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab from './EpisodeScriptTab';
import { scriptHealth } from '../../lib/scriptHealth';

// JustAWoman speaks here: Lala's voice has its own rows (see "Lala's voice" below).
const SCRIPT = '## BEAT: 1 · Opening Ritual\nMe: Hi besties.\n\n## BEAT: 2 · Login Sequence\nMe: Logging in.\n[UI:OPEN Nowhere]';
// "Ready to film?" starts folded (Script page audit 4, 2026-10-19): these
// tests open it, as Evoni would.
const renderTab = (script = SCRIPT, locked = []) => {
  const r = render(
    <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: script, script_locked_beats: locked }} show={{ id: 'show-1' }} /></MemoryRouter>,
  );
  const toggle = screen.queryByTestId('script-health-toggle');
  if (toggle?.getAttribute('aria-expanded') === 'false') fireEvent.click(toggle);
  return r;
};

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
  try { window.localStorage.clear(); } catch (err) { console.error(err); }
});

describe('Ready to film?', () => {
  test('lists the missing canonical beats, the phone gaps by beat, approvals and saved state', () => {
    renderTab();
    expect(screen.getByTestId('script-health').textContent).toContain('Ready to film?');
    const beats = screen.getByTestId('script-health-beats');
    expect(beats.getAttribute('data-ok')).toBe('false');
    expect(beats.textContent).toContain('3 (Welcome)');
    expect(beats.textContent).toContain('14 (Cliffhanger)');
    expect(screen.getByTestId('script-health-phone-beat-2').textContent).toContain("Beat 2: Nowhere isn't made yet");
    expect(screen.getByTestId('script-health-approved').textContent).toBe('0 of 2 beats approved.');
    expect(screen.getByTestId('script-health-saved').getAttribute('data-ok')).toBe('true');
    expect(screen.getByTestId('script-health-sum').textContent).toBe('3 to check');
  });

  test("a row's Open beat opens that beat", () => {
    renderTab();
    expect(screen.getByTestId('script-beat-2').className).not.toContain('is-open');
    fireEvent.click(screen.getByTestId('script-health-open-phone-beat-2'));
    expect(screen.getByTestId('script-beat-2').className).toContain('is-open');
  });

  test('an edit shows as unsaved', () => {
    renderTab();
    fireEvent.click(screen.getByTestId('script-beat-down-1'));
    expect(screen.getByTestId('script-health-saved').textContent).toBe('Unsaved changes.');
  });

  // Folded at every width, open or closed not remembered (Script page audit 4, 2026-10-19).
  test('folds and opens; a new visit starts folded again, and nothing is stored', () => {
    const set = vi.spyOn(Storage.prototype, 'setItem');
    const { unmount } = renderTab();
    expect(screen.getByTestId('script-health-beats')).toBeTruthy();
    fireEvent.click(screen.getByTestId('script-health-toggle'));
    expect(screen.queryByTestId('script-health-beats')).toBeNull();
    expect(screen.getByTestId('script-health-toggle').getAttribute('aria-expanded')).toBe('false');
    unmount();
    render(<MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: SCRIPT, script_locked_beats: [] }} show={{ id: 'show-1' }} /></MemoryRouter>);
    expect(screen.getByTestId('script-health-toggle').getAttribute('aria-expanded')).toBe('false');
    expect(set.mock.calls.some(([k]) => k === 'esp-health-collapsed')).toBe(false);
    set.mockRestore();
  });

  test('a look piece never put on is flagged at the getting-ready beat', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => (url === '/api/v1/wardrobe/outfit/ep-1'
      ? { data: { items: [{ id: 'w-1', name: 'Gold Heels' }] } } : { data: { data: [] } }));
    renderTab();
    await waitFor(() => expect(screen.getByTestId('script-health-uncued').textContent).toContain('Gold Heels'));
    expect(screen.getByTestId('script-health-open-uncued')).toBeTruthy();
  });
});

describe('scriptHealth', () => {
  const canonical = [{ number: 1, name: 'A' }, { number: 2, name: 'B' }];
  const beats = [{ id: 'beat-1', number: 1, lines: ['Lala (V.O.): hi'], approved: true }, { id: 'beat-2', number: 2, lines: ['[DELIVER: nope]'], approved: true }];

  test('every check clear reads ok', () => {
    const rows = scriptHealth({ beats: beats.slice(0, 1), canonical: canonical.slice(0, 1), cover: [{ key: 'hook', label: 'x', source: 'Forward hook', beat: 1 }] });
    expect(rows.every((r) => r.ok)).toBe(true);
    expect(rows.map((r) => r.key)).toEqual(['beats', 'cover', 'voice', 'approved', 'saved']);
  });

  test('cover gaps, deal cues and an unsaved draft are flagged', () => {
    const rows = scriptHealth({ beats, canonical, cover: [{ key: 'goal-0', label: 'Meet Sable', source: 'Goal', beat: null }], unsaved: 'x' });
    expect(rows.find((r) => r.key === 'cover-goal-0').text).toBe('Goal not in the script yet: Meet Sable');
    const deal = rows.find((r) => r.key === 'deal-beat-2');
    expect(deal.beatId).toBe('beat-2');
    expect(deal.text).toBe('Beat 2: [DELIVER: nope] is not a deliverable of this event');
    expect(rows.find((r) => r.key === 'saved').text).toBe('Generated but not saved: Save keeps it.');
  });
});

// Script phone paths (Evoni, 2026-10-16): a tap the phone can't make from
// where it is, fixed from its row or all at once.
describe('phone paths', () => {
  const PHONE = [
    { id: 'homepage', name: 'Homepage', category: 'phone', is_home: true, screen_links: [{ label: 'Messages Icon', target: 'messages_page' }, { label: 'Closet Icon', target: 'closet' }] },
    { id: 'messages_page', name: 'Messages Page', category: 'phone' },
    { id: 'closet', name: 'closet', category: 'phone' },
    { id: 'InviteLetterOverlay', name: 'Invitation', category: 'phone' },
  ];
  const PATHS = '## BEAT: 3 · Welcome\n[UI:OPEN closet]\nMe: "The closet."\n\n## BEAT: 4 · Interruption Pulse 1\n[UI:CLICK Messages Icon]\n\n## BEAT: 5 · Reveal\n[UI:CLICK Messages Icon]';
  beforeEach(() => {
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (url === '/api/v1/ui-overlays/show-1/frame') return { data: { frame_url: null } };
      if (url.startsWith('/api/v1/ui-overlays/show-1')) return { data: { data: PHONE } };
      return { data: { data: [] } };
    });
  });
  const raw = () => { fireEvent.click(screen.getByRole('button', { name: 'Raw editor' })); return screen.getByRole('textbox', { name: 'Raw script' }).value; };

  test('"Go home first" fixes its beat', async () => {
    renderTab(PATHS);
    const fix = await screen.findByTestId('script-health-fix-phone-beat-4');
    expect(fix.textContent).toBe('Go home first');
    fireEvent.click(fix);
    expect(await screen.findByText(/Added 1 phone step/)).toBeTruthy();
    expect(raw()).toContain('## BEAT: 4 · Interruption Pulse 1\n[UI:OPEN Homepage]\n[UI:CLICK Messages Icon]');
  });

  test('Fix all fixes every beat, and the rows clear', async () => {
    renderTab(PATHS);
    fireEvent.click(await screen.findByTestId('script-health-fix-all'));
    await waitFor(() => expect(screen.queryByTestId('script-health-fix-all')).toBeNull());
    expect(screen.queryByTestId('script-health-phone-beat-4')).toBeNull();
    expect(screen.queryByTestId('script-health-phone-beat-5')).toBeNull();
    expect(raw().match(/\[UI:OPEN Homepage\]/g)).toHaveLength(2);
  });

  test('an approved beat offers no fix, and Fix all leaves it as it is', async () => {
    renderTab(PATHS, [4]);
    await screen.findByTestId('script-health-fix-phone-beat-5');
    expect(screen.getByTestId('script-health-phone-beat-4')).toBeTruthy();
    expect(screen.queryByTestId('script-health-fix-phone-beat-4')).toBeNull();
    fireEvent.click(screen.getByTestId('script-health-fix-phone-beat-5'));
    expect(raw()).toContain('## BEAT: 4 · Interruption Pulse 1\n[UI:CLICK Messages Icon]');
  });
});

// Two show rules (Evoni, 2026-10-17): Lala's voice icon is clicked before
// she talks; beat 5 shows the invitation letter, never the login screen.
describe("Lala's voice and the invitation", () => {
  const raw = () => { fireEvent.click(screen.getByRole('button', { name: 'Raw editor' })); return screen.getByRole('textbox', { name: 'Raw script' }).value; };
  const RULES = '## BEAT: 4 · Interruption Pulse 1\nMe: ooh\nLala: hi\n\n## BEAT: 5 · Reveal\n[UI:DISPLAY Start button]\nMe: read it';

  test('each is flagged, and its row fixes it', async () => {
    renderTab(RULES);
    expect(screen.getByTestId('script-health-voice-beat-4').textContent).toContain('Beat 4: Lala talks before her voice icon is clicked.');
    expect(screen.getByTestId('script-health-reveal').textContent).toContain('Beat 5: shows the login screen; it shows the invitation letter.');
    fireEvent.click(screen.getByTestId('script-health-fix-voice-beat-4'));
    expect(await screen.findByText(/Added 1 voice click/)).toBeTruthy();
    fireEvent.click(screen.getByTestId('script-health-fix-reveal'));
    expect(await screen.findByText(/Added the invitation in beat 5/)).toBeTruthy();
    const text = raw();
    expect(text).toContain('Me: ooh\n[UI:CLICK Voice Icon]\nLala: hi');
    expect(text).toContain('## BEAT: 5 · Reveal\n[UI:OPEN Invitation]\nMe: read it');
    expect(text).not.toContain('Start button');
  });

  test('an approved beat is flagged but offers no fix', () => {
    renderTab(RULES, [4, 5]);
    expect(screen.getByTestId('script-health-voice-beat-4')).toBeTruthy();
    expect(screen.queryByTestId('script-health-fix-voice-beat-4')).toBeNull();
    expect(screen.queryByTestId('script-health-fix-reveal')).toBeNull();
  });
});

// Beat 14's opportunity, checked for real (Script page audit, 2026-10-19).
describe("scriptHealth: beat 14's opportunity", () => {
  const opp = { name: 'Sable Campaign Shoot', contact_name: 'Sable Reyes', status: 'held' };
  const DM = '[UI:DM Sable Reyes: The Sable campaign shoot is yours if you want it.]';
  const row = (lines, { o = opp, intent = 'pass', other = [] } = {}) => scriptHealth({
    beats: [...other, { id: 'beat-14', number: 14, lines }], beat14: { opportunity: o }, designedIntent: intent,
  }).find((r) => r.key === 'beat14');

  test('ok only when beat 14 has a DM or notification naming it', () => {
    expect(row([DM])).toMatchObject({ ok: true, beatId: 'beat-14', text: 'Beat 14 offers Sable Campaign Shoot, from Sable Reyes.' });
    const missing = row(['Me: and then?'], { other: [{ id: 'beat-11', number: 11, lines: [DM] }] });
    expect(missing.ok).toBe(false);
    expect(missing.text).toContain("Beat 14 doesn't deliver Sable Campaign Shoot yet");
  });

  test('designed to fail: ok only when beat 14 does not deliver it', () => {
    expect(row(['Me: nothing came'], { intent: 'fail' })).toMatchObject({ ok: true, text: "Beat 14's opportunity, Sable Campaign Shoot, does not come: the episode is designed to fail." });
    expect(row([DM], { intent: 'fail' })).toMatchObject({ ok: false, text: 'Beat 14 delivers Sable Campaign Shoot, but the episode is designed to fail: the invitation does not come.' });
  });

  test('after completion: expired never comes, offered came, whatever the intent', () => {
    expect(row([DM], { o: { ...opp, status: 'expired' } }).ok).toBe(false);
    expect(row(['Me: quiet'], { o: { ...opp, status: 'expired' } }).text).toContain('the episode did not land');
    expect(row([DM], { o: { ...opp, status: 'offered' }, intent: 'fail' }).ok).toBe(true);
  });

  // The invitation is an optional ending (Evoni, 2026-10-19; Script page audit 4).
  test('nothing attached is an optional note, not a row to fix', () => {
    expect(row([DM], { o: null })).toMatchObject({ ok: true });
    expect(row([DM], { o: null }).text).toMatch(/\(optional\)/);
  });
});

// A beat 14 read that fails says so in the side panel (Script page audit, 2026-10-19).
describe("beat 14's opportunity, unread", () => {
  test('beat 14 open: a one-line note, and the console says why', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (String(url).endsWith('/beat14')) throw new Error('down');
      return { data: { data: [] } };
    });
    renderTab('## BEAT: 13 · Wrap\nMe: bye\n\n## BEAT: 14 · Cliffhanger\nMe: and then?');
    const beat = screen.getByTestId('script-beat-14');
    if (!beat.className.includes('is-open')) fireEvent.click(beat.querySelector('.esp-beat-head'));
    // The context panel is tabs (Evoni, 2026-10-22 layout list).
    fireEvent.click(await screen.findByTestId('script-side-tab-checks'));
    expect((await screen.findByTestId('script-beat14-unread')).textContent).toBe("Couldn't read beat 14's opportunity.");
    expect(spy).toHaveBeenCalledWith('[EpisodeScript] beat 14 opportunity load failed:', expect.any(Error));
    spy.mockRestore();
  });
});
