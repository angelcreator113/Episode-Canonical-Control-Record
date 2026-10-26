/**
 * The Season page's round 3 AI buttons (2026-10-26): each asks nothing
 * until Evoni presses it, shows the answer, says plainly when the budget
 * refuses, and writes only on Accept, Apply or Save.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SeasonNextStep from './SeasonNextStep';
import SeasonFocusToday from './SeasonFocusToday';
import SeasonArcSuggestions from './SeasonArcSuggestions';
import SeasonCarried from './SeasonCarried';
import SeasonPitch from './SeasonPitch';
import SeasonAttentionDigest from './SeasonAttentionDigest';
import { attentionPayload } from '../../lib/seasonAi';

const SHOW = '11111111-1111-4111-8111-111111111111';
const budget = () => Object.assign(new Error('429'), {
  response: { status: 429, data: { code: 'AI_BUDGET_EXCEEDED', error: "Today's AI budget is used up, so nothing was asked and nothing changed. Try again tomorrow." } },
});
const items = [
  { key: 'release-1', kind: 'release', title: 'S2 · E3 releases in 2 days.', detail: 'The Gala', tone: 'soon', link: { tab: 'roadmap' } },
  { key: 'slots-2', kind: 'slots', title: 'Part 2: 1 slot with no event yet.', detail: 'E7', tone: 'calm', link: { tab: 'roadmap' } },
];
const makeApi = () => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() });
let api;
beforeEach(() => {
  api = makeApi();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('attentionPayload', () => {
  test('sends only kind, title and detail', () => {
    expect(attentionPayload(items)[0]).toEqual({ kind: 'release', title: 'S2 · E3 releases in 2 days.', detail: 'The Gala' });
  });
});

describe('What should I do next?', () => {
  test('nothing is asked until pressed; the sentences show; Dismiss hides them', async () => {
    api.post.mockResolvedValue({ data: { sentences: ["Lock E3's thumbnail today.", 'E7 needs an event; Fabric and Form fits it best.'] } });
    render(<SeasonNextStep api={api} showId={SHOW} items={items} />);
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('szn-next-step-ask'));
    const answer = await screen.findByTestId('szn-next-step-answer');
    expect(answer.textContent).toContain('Fabric and Form fits it best.');
    expect(answer.textContent).toContain('Nothing was changed.');
    expect(api.post).toHaveBeenCalledWith(`/api/v1/world/${SHOW}/season/ai/next-step`, { items: attentionPayload(items) });
    fireEvent.click(screen.getByTestId('szn-next-step-dismiss'));
    expect(screen.queryByTestId('szn-next-step-answer')).toBeNull();
    expect(screen.getByTestId('szn-next-step-ask')).toBeTruthy();
  });

  test('the budget refusal in plain words', async () => {
    api.post.mockRejectedValue(budget());
    render(<SeasonNextStep api={api} showId={SHOW} items={items} />);
    fireEvent.click(screen.getByTestId('szn-next-step-ask'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/AI budget is used up, so nothing was asked/);
  });

  test('no items: no button', () => {
    const { container } = render(<SeasonNextStep api={api} showId={SHOW} items={[]} />);
    expect(container.textContent).toBe('');
  });
});

describe('Focus for today', () => {
  test('one line from every show\'s items', async () => {
    api.post.mockResolvedValue({ data: { line: "Lock E3's thumbnail before anything else." } });
    render(<SeasonFocusToday api={api} seasons={[{ show_id: 'a', show: 'Lala', season_number: 2, items }, { show_id: 'b', show: 'Quiet', season_number: 1, items: [] }]} />);
    fireEvent.click(screen.getByTestId('du-focus-ask'));
    expect((await screen.findByTestId('du-focus-answer')).textContent).toContain('before anything else');
    const body = api.post.mock.calls[0][1];
    expect(body.seasons).toHaveLength(1);
    expect(body.seasons[0]).toMatchObject({ show: 'Lala', season_number: 2 });
  });

  test('disabled while the lists read, and with nothing waiting', () => {
    const { rerender } = render(<SeasonFocusToday api={api} seasons={[{ show_id: 'a', items }]} loading />);
    expect(screen.getByTestId('du-focus-ask').disabled).toBe(true);
    rerender(<SeasonFocusToday api={api} seasons={[{ show_id: 'a', items: [] }]} />);
    expect(screen.getByTestId('du-focus-ask').disabled).toBe(true);
    expect(screen.getByText('Nothing needs attention today.')).toBeTruthy();
  });

  test('the digest hands its lists\' items to the focus slot', async () => {
    api.get.mockImplementation(async (url) => {
      if (url.endsWith('/arc')) return { data: { arc: { id: 'arc', season_number: 2, phases: [] } } };
      return { data: {} };
    });
    const slot = vi.fn(() => null);
    render(<MemoryRouter><SeasonAttentionDigest api={api} seasons={[{ show_id: SHOW, show: 'Lala', season_number: 2 }]} focusSlot={slot} /></MemoryRouter>);
    await waitFor(() => expect(slot).toHaveBeenCalled());
    expect(slot.mock.calls.at(-1)[0].seasons[0]).toMatchObject({ show_id: SHOW, show: 'Lala', items: expect.any(Array) });
  });
});

describe('Arc suggestions', () => {
  const suggestions = [
    { kind: 'purpose', text: 'Truthville comes back with news.', why: 'Seen in E2 and E11 only.', slot_id: 's5', slot_number: 5, thread_id: null },
    { kind: 'twist', title: 'The ring', text: 'Maren is not wearing it.', why: 'Pays off in E9.', slot_id: 's6', slot_number: 6, payoff_slot_id: 's9', payoff_slot_number: 9 },
    { kind: 'note', text: 'Book Truthville as a guest.', why: 'No host yet.', cannot_apply: null },
  ];

  test('Accept applies one through the server; Skip drops one; a note is Copy only', async () => {
    const onApplied = vi.fn();
    api.post.mockImplementation(async (url) => (url.endsWith('/accept')
      ? { data: { applied: 'Added a story purpose to E5.' } } : { data: { suggestions } }));
    render(<SeasonArcSuggestions api={api} showId={SHOW} season="1" onApplied={onApplied} />);
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('szn-arc-ask'));
    await screen.findByTestId('szn-arc-suggestion-purpose');
    expect(api.post.mock.calls[0][0]).toBe(`/api/v1/world/${SHOW}/season/ai/arc-suggestions?season=1`);
    expect(screen.getByTestId('szn-arc-suggestion-twist').textContent).toContain('E6 → E9');
    const note = screen.getByTestId('szn-arc-suggestion-note');
    expect(within(note).queryByTestId('szn-arc-accept')).toBeNull();
    expect(within(note).getByTestId('szn-arc-copy')).toBeTruthy();

    fireEvent.click(within(screen.getByTestId('szn-arc-suggestion-purpose')).getByTestId('szn-arc-accept'));
    expect(await screen.findByText('Added a story purpose to E5.')).toBeTruthy();
    expect(api.post).toHaveBeenLastCalledWith(`/api/v1/world/${SHOW}/season/ai/arc-suggestions/accept`, expect.objectContaining({ kind: 'purpose', slot_id: 's5' }));
    expect(onApplied).toHaveBeenCalledTimes(1);

    fireEvent.click(within(screen.getByTestId('szn-arc-suggestion-twist')).getByTestId('szn-arc-skip'));
    expect(screen.queryByTestId('szn-arc-suggestion-twist')).toBeNull();
    expect(api.post).toHaveBeenCalledTimes(2);
  });

  test('the budget refusal in plain words', async () => {
    api.post.mockRejectedValue(budget());
    render(<SeasonArcSuggestions api={api} showId={SHOW} />);
    fireEvent.click(screen.getByTestId('szn-arc-ask'));
    expect((await screen.findByTestId('szn-arc-error')).textContent).toMatch(/nothing changed/);
  });
});

describe("What's carried into Season N+1?", () => {
  const data = {
    season: { arc_id: 'arc1', season_number: 1 },
    next_season: { arc_id: 'arc2', season_number: 2 },
    items: [
      { ref: 'T1', type: 'thread', id: 't1', title: 'The money', status: 'open', decision: 'continue', reason: 'Still open.', slot_id: 's3', slot_number: 3 },
      { ref: 'W1', type: 'twist', id: 'w1', title: 'The ring', status: 'planted', decision: 'drop', reason: 'No longer fits.', slot_id: null, slot_number: null },
      { ref: 'S1', type: 'secret', id: 'x1', title: 'Ana: She sold it.', status: 'kept', decision: 'resolve', reason: 'Time.', slot_id: 's2', slot_number: 2 },
    ],
  };

  test('nothing is ticked; only the ticked rows apply, with Evoni\'s choice', async () => {
    const onApplied = vi.fn();
    api.post.mockImplementation(async (url) => (url.includes('/apply')
      ? { data: { results: [{ id: 't1', ok: true, text: 'Closed the thread "The money".' }] } } : { data }));
    render(<SeasonCarried api={api} showId={SHOW} season="1" onApplied={onApplied} />);
    expect(screen.getByText("What's carried into Season 2?")).toBeTruthy();
    fireEvent.click(screen.getByTestId('szn-carried-ask'));
    const thread = await screen.findByTestId('szn-carried-row-thread');
    expect(thread.textContent).toContain('Stays open, linked to S2 · E3.');
    expect(screen.getByTestId('szn-carried-row-twist').textContent).toContain('Marks the twist dropped (kept, not deleted).');
    expect(screen.getByTestId('szn-carried-row-secret').textContent).toContain('Revealed in S2 · E2.');
    const apply = screen.getByTestId('szn-carried-apply');
    expect(apply.disabled).toBe(true);

    // Evoni changes the thread to Drop and ticks only it.
    fireEvent.click(within(thread).getByRole('radio', { name: 'Drop' }));
    expect(thread.textContent).toContain('Closes the thread (kept, not deleted).');
    fireEvent.click(within(thread).getByRole('checkbox'));
    fireEvent.click(apply);
    expect(await screen.findByTestId('szn-carried-results')).toBeTruthy();
    expect(api.post).toHaveBeenLastCalledWith(`/api/v1/world/${SHOW}/season/ai/carried/apply?season=1`,
      { decisions: [{ type: 'thread', id: 't1', decision: 'drop', slot_id: null }] });
    expect(onApplied).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('szn-carried-row-thread')).toBeNull();
    expect(screen.getByTestId('szn-carried-row-twist')).toBeTruthy();
  });

  test('no next season yet: says so', async () => {
    api.post.mockResolvedValue({ data: { ...data, next_season: { arc_id: null, season_number: 2 } } });
    render(<SeasonCarried api={api} showId={SHOW} season="1" />);
    fireEvent.click(screen.getByTestId('szn-carried-ask'));
    expect((await screen.findByTestId('szn-carried-no-next')).textContent).toContain('Season 2 is not set up yet');
  });
});

describe('Season pitch', () => {
  test('the logline until a pitch is saved; a draft is edited, then saved only on Save', async () => {
    api.get.mockResolvedValue({ data: { saved: null } });
    api.post.mockResolvedValue({ data: { pitch: 'Lala goes big.\nEverything is on the line.' } });
    api.put.mockResolvedValue({ data: { saved: { text: 'Lala goes bigger.\nEverything is on the line.' } } });
    render(<SeasonPitch api={api} showId={SHOW} season="2" fallback="The logline." />);
    expect(screen.getByTestId('splan-pitch-shown').textContent).toBe('The logline.');
    await waitFor(() => expect(screen.getByTestId('splan-pitch-draft').disabled).toBe(false));
    expect(api.get).toHaveBeenCalledWith(`/api/v1/world/${SHOW}/season/pitch?season=2`);
    fireEvent.click(screen.getByTestId('splan-pitch-draft'));
    const box = await screen.findByTestId('splan-pitch-box');
    expect(box.value).toBe('Lala goes big.\nEverything is on the line.');
    expect(api.put).not.toHaveBeenCalled();
    fireEvent.change(box, { target: { value: 'Lala goes bigger.\nEverything is on the line.' } });
    fireEvent.click(screen.getByTestId('splan-pitch-save'));
    await waitFor(() => expect(screen.getByTestId('splan-pitch-shown').textContent).toBe('Lala goes bigger.\nEverything is on the line.'));
    expect(api.put).toHaveBeenCalledWith(`/api/v1/world/${SHOW}/season/pitch?season=2`, { text: 'Lala goes bigger.\nEverything is on the line.' });
  });

  test('Cancel saves nothing; the budget refusal in plain words', async () => {
    api.get.mockResolvedValue({ data: { saved: { text: 'Saved pitch.' } } });
    api.post.mockRejectedValue(budget());
    render(<SeasonPitch api={api} showId={SHOW} />);
    await waitFor(() => expect(screen.getByTestId('splan-pitch-shown').textContent).toBe('Saved pitch.'));
    fireEvent.click(screen.getByTestId('splan-pitch-draft'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/AI budget is used up/);
    fireEvent.click(screen.getByTestId('splan-pitch-edit'));
    fireEvent.click(screen.getByTestId('splan-pitch-cancel'));
    expect(screen.getByTestId('splan-pitch-shown').textContent).toBe('Saved pitch.');
    expect(api.put).not.toHaveBeenCalled();
  });
});
