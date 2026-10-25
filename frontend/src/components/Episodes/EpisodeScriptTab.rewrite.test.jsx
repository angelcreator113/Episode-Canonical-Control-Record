/**
 * Rewrite line, three versions (Evoni, 2026-10-25: "When I ask the script to
 * rewrite it's basically writing the same thing."):
 * - ✦ Rewrite opens a panel: six direction chips, a "How?" box (300
 *   characters) and Rewrite; Cancel and Escape close it;
 * - the request carries the direction, her note and her other lines;
 * - the three versions are radio cards with their angles; the chosen one
 *   goes in with "Use this"; "Keep mine" keeps the line;
 * - a tooSimilar reply says so; "Try again with…" asks again with a chip;
 * - "Use this" still refuses a line changed, an approved beat or an open editor.
 */
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../../services/api';
import EpisodeScriptTab, { rewriteVoiceSamples, REWRITE_DIRECTIONS } from './EpisodeScriptTab';

const SCRIPT = [
  '## BEAT: 1 · Opening Ritual',
  'Prime: "Hey besties. its been a minute."',
  'Lala: "Bestie, the closet is calling."',
  'Prime: "Lets go ahead and login."',
  '',
  '## BEAT: 2 · Login Sequence',
  'Me: "I am not crying, you are."',
  'Lala: "Logging in, gorgeous."',
].join('\n');
const VERSIONS = [
  { angle: 'Tighter', text: 'Besties. Long time.' },
  { angle: 'Punchier', text: 'We are BACK, besties!' },
  { angle: 'New angle', text: 'Okay, confession: did you miss me?' },
];
const renderTab = (props = {}) => render(
  <MemoryRouter><EpisodeScriptTab episode={{ id: 'ep-1', show_id: 'show-1', script_content: SCRIPT, script_locked_beats: [] }} show={{ id: 'show-1' }} {...props} /></MemoryRouter>,
);
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
const raw = () => { fireEvent.click(screen.getByRole('button', { name: 'Raw editor' })); return screen.getByRole('textbox', { name: 'Raw script' }).value; };
const beat1 = () => screen.getByTestId('script-beat-1');
const openPanel = (n = 0) => fireEvent.click(within(beat1()).getAllByRole('button', { name: /^Rewrite line:/ })[n]);
const toast = () => screen.getAllByRole('status').map((n) => n.textContent).join(' ');

beforeEach(() => {
  Object.values(api).forEach((fn) => fn?.mockReset?.());
  window.localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
});
afterEach(() => { vi.restoreAllMocks(); window.localStorage.clear(); });

describe('the direction panel', () => {
  test('✦ Rewrite opens it with six chips, a How? box and Rewrite; nothing is asked yet', () => {
    renderTab();
    openPanel();
    const panel = screen.getByTestId('script-rewrite-panel');
    expect(panel.getAttribute('role')).toBe('group');
    const chips = within(panel).getAllByRole('button', { pressed: false });
    expect(chips.map((c) => c.textContent)).toEqual(['Shorter', 'Punchier', 'Funnier', 'More emotional', 'More Lala', 'Surprise me']);
    expect(document.activeElement).toBe(chips[0]);
    const note = within(panel).getByRole('textbox', { name: /How\?/ });
    expect(note.maxLength).toBe(300);
    expect(within(beat1()).getAllByRole('button', { name: /^Rewrite line:/ })[0].getAttribute('aria-expanded')).toBe('true');
    expect(api.post).not.toHaveBeenCalled();
  });

  test('one chip at a time; a second tap clears it', () => {
    renderTab();
    openPanel();
    fireEvent.click(screen.getByTestId('script-rewrite-dir-funnier'));
    expect(screen.getByTestId('script-rewrite-dir-funnier').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByTestId('script-rewrite-dir-lala'));
    expect(screen.getByTestId('script-rewrite-dir-funnier').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('script-rewrite-dir-lala').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByTestId('script-rewrite-dir-lala'));
    expect(screen.getByTestId('script-rewrite-dir-lala').getAttribute('aria-pressed')).toBe('false');
  });

  test('Cancel and Escape close it, and focus goes back to ✦ Rewrite', async () => {
    renderTab();
    openPanel();
    fireEvent.click(screen.getByTestId('script-rewrite-cancel'));
    expect(screen.queryByTestId('script-rewrite-panel')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(within(beat1()).getAllByRole('button', { name: /^Rewrite line:/ })[0]));
    openPanel();
    fireEvent.keyDown(screen.getByTestId('script-rewrite-dir-shorter'), { key: 'Escape' });
    expect(screen.queryByTestId('script-rewrite-panel')).toBeNull();
  });

  test('a direction, her note and her other lines go with the request', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { rewrittenLine: VERSIONS[0].text, versions: VERSIONS, original: 'x' } });
    renderTab();
    openPanel();
    fireEvent.click(screen.getByTestId('script-rewrite-dir-funnier'));
    fireEvent.change(screen.getByTestId('script-rewrite-note'), { target: { value: 'tease the chat' } });
    fireEvent.click(screen.getByTestId('script-rewrite-go'));
    await screen.findByTestId('script-proposal');
    const [url, body] = vi.mocked(api.post).mock.calls[0];
    expect(url).toBe('/api/v1/episode-brief/ep-1/rewrite-line');
    expect(body).toMatchObject({ line: 'Prime: "Hey besties. its been a minute."', speaker: 'Prime', direction: 'funnier', instruction: 'tease the chat' });
    // Hers: Prime and Me, never Lala's, never the line itself.
    expect(body.voiceSamples).toEqual(['Lets go ahead and login.', 'I am not crying, you are.']);
  });

  test('Enter in the How? box asks; no direction or note sends neither', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { rewrittenLine: 'Bestie, the wardrobe awaits.' } });
    renderTab();
    openPanel(1);
    fireEvent.keyDown(screen.getByTestId('script-rewrite-note'), { key: 'Enter' });
    await screen.findByTestId('script-proposal');
    const body = vi.mocked(api.post).mock.calls[0][1];
    expect(body.direction).toBeUndefined();
    expect(body.instruction).toBeUndefined();
    expect(body.voiceSamples).toEqual(['Logging in, gorgeous.']);
  });
});

describe('the three versions', () => {
  test('radio cards with their angles; the first is chosen; another goes in with Use this', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { rewrittenLine: VERSIONS[0].text, versions: VERSIONS } });
    renderTab();
    openPanel();
    fireEvent.click(screen.getByTestId('script-rewrite-go'));
    const card = await screen.findByTestId('script-proposal');
    const radios = within(card).getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(radios[0].checked).toBe(true);
    expect(within(card).getAllByTestId('script-proposal-option').map((o) => o.textContent)).toEqual([
      'TighterPrime: Besties. Long time.', 'PunchierPrime: We are BACK, besties!', 'New anglePrime: Okay, confession: did you miss me?',
    ]);
    expect(within(card).getByRole('group', { name: 'Choose a version' })).toBeTruthy();
    expect(screen.getByTestId('script-proposal-live').textContent).toContain('3 versions; choose one, then Use this or Keep mine.');
    fireEvent.click(within(card).getByLabelText(/Punchier/));
    expect(radios[1].checked).toBe(true);
    fireEvent.click(within(card).getByRole('button', { name: 'Use this' }));
    const text = raw();
    expect(text).toContain('Prime: "We are BACK, besties!"');
    expect(text).not.toContain('its been a minute');
    expect(text).not.toContain('Long time');
  });

  test('Keep mine keeps the line', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { rewrittenLine: VERSIONS[0].text, versions: VERSIONS } });
    renderTab();
    openPanel();
    fireEvent.click(screen.getByTestId('script-rewrite-go'));
    fireEvent.click(await screen.findByRole('button', { name: 'Keep mine' }));
    expect(screen.queryByTestId('script-proposal')).toBeNull();
    expect(raw()).toBe(SCRIPT);
  });

  test('a version the same as the line, or the same as another, is left out', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { versions: [{ angle: 'Tighter', text: 'Hey besties. its been a minute.' }, VERSIONS[2], { angle: 'Punchier', text: VERSIONS[2].text }] } });
    renderTab();
    openPanel();
    fireEvent.click(screen.getByTestId('script-rewrite-go'));
    const card = await screen.findByTestId('script-proposal');
    expect(within(card).getAllByRole('radio')).toHaveLength(1);
    expect(card.textContent).toContain('Okay, confession');
  });

  test('tooSimilar: the card says to try a direction, and Try again with… asks with it', async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce({ data: { rewrittenLine: 'Hey besties, it has been a minute.', versions: [{ angle: 'Tighter', text: 'Hey besties, it has been a minute.' }], tooSimilar: true } })
      .mockResolvedValueOnce({ data: { rewrittenLine: VERSIONS[0].text, versions: VERSIONS } });
    renderTab();
    openPanel();
    fireEvent.click(screen.getByTestId('script-rewrite-go'));
    expect((await screen.findByTestId('script-proposal-too-similar')).textContent).toBe('These are close to your line — try a direction.');
    expect(screen.getByTestId('script-proposal-live').textContent).toContain('try a direction');
    fireEvent.click(screen.getByTestId('script-proposal-retry-surprise'));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.post).mock.calls[1][1]).toMatchObject({ direction: 'surprise', line: 'Prime: "Hey besties. its been a minute."' });
    await waitFor(() => expect(within(screen.getByTestId('script-proposal')).getAllByRole('radio')).toHaveLength(3));
    expect(screen.queryByTestId('script-proposal-too-similar')).toBeNull();
    expect(screen.getByTestId('script-proposal').textContent).toContain('Surprise me');
  });
});

describe('Use this still refuses', () => {
  test('a line changed while the versions were written', async () => {
    const reply = deferred();
    vi.mocked(api.post).mockReturnValue(reply.promise);
    renderTab();
    openPanel();
    fireEvent.click(screen.getByTestId('script-rewrite-go'));
    fireEvent.click(within(beat1()).getByText(/its been a minute/));
    const box = screen.getByRole('textbox', { name: 'Edit line' });
    fireEvent.change(box, { target: { value: 'Prime: "My own words."' } });
    fireEvent.click(within(box.closest('.esp-line-edit')).getByRole('button', { name: 'Save' }));
    await act(async () => { reply.resolve({ data: { rewrittenLine: VERSIONS[0].text, versions: VERSIONS } }); });
    fireEvent.click(within(await screen.findByTestId('script-proposal')).getAllByRole('radio')[2]);
    fireEvent.click(screen.getByTestId('script-proposal-accept'));
    expect(await screen.findByText(/changed or was approved while it was being rewritten/)).toBeTruthy();
    expect(raw()).toContain('Prime: "My own words."');
  });

  test('a line open in its beat with changed words', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { rewrittenLine: VERSIONS[0].text, versions: VERSIONS } });
    renderTab();
    openPanel();
    fireEvent.click(screen.getByTestId('script-rewrite-go'));
    await screen.findByTestId('script-proposal');
    fireEvent.click(within(beat1()).getByText(/Lets go ahead/));
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit line' }), { target: { value: 'Prime: "Typing."' } });
    fireEvent.click(screen.getByTestId('script-proposal-accept'));
    expect(toast()).toContain("Save or cancel the line you're editing first");
    expect(screen.getByTestId('script-proposal')).toBeTruthy();
  });

  test('a beat approved while the versions were written', async () => {
    const reply = deferred();
    vi.mocked(api.post).mockReturnValue(reply.promise);
    vi.mocked(api.put).mockResolvedValue({ data: { data: { script_locked_beats: [1] } } });
    renderTab();
    openPanel();
    fireEvent.click(screen.getByTestId('script-rewrite-go'));
    fireEvent.click(screen.getByTestId('script-lock-1'));
    await waitFor(() => expect(screen.getByTestId('script-lock-1').textContent).toBe('Unlock'));
    await act(async () => { reply.resolve({ data: { rewrittenLine: VERSIONS[0].text, versions: VERSIONS } }); });
    expect(await screen.findByText(/changed or was approved while it was being rewritten/)).toBeTruthy();
    expect(screen.queryByTestId('script-proposal')).toBeNull();
  });
});

describe('rewriteVoiceSamples', () => {
  const beats = [
    { id: 'a', lines: ['Lala: "One."', 'Prime: "Two."', 'Prime: "Mine."'] },
    { id: 'b', lines: ['JustAWoman: "Three."', 'JAWIHP: "Four."', 'Kelli: "Five."', 'Prime: "Two."', '[STAT: coins=+5]'] },
  ];
  test('hers for hers, Lala for Lala, the line itself never, eight at most, 300 characters each', () => {
    expect(rewriteVoiceSamples(beats, 'a', 'Prime: "Mine."', 'Prime')).toEqual(['Two.', 'Three.', 'Four.']);
    expect(rewriteVoiceSamples(beats, 'b', 'Lala: "Zero."', 'Lala')).toEqual(['One.']);
    expect(rewriteVoiceSamples(beats, 'b', 'Kelli: "Six."', 'Kelli')).toEqual(['Five.']);
    const many = [{ id: 'm', lines: Array.from({ length: 12 }, (_, i) => `Me: "${i}${'x'.repeat(400)}"`) }];
    const out = rewriteVoiceSamples(many, 'm', 'Me: "Here."', 'Me');
    expect(out).toHaveLength(8);
    expect(out.every((s) => s.length <= 300)).toBe(true);
  });
  test('six chips, the keys the route takes', () => {
    expect(REWRITE_DIRECTIONS.map((d) => d.key)).toEqual(['shorter', 'punchier', 'funnier', 'emotional', 'lala', 'surprise']);
  });
});
