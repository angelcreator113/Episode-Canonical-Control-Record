/**
 * Season Plan › Reveal plan (stage E): each secret with its path through the
 * season and what is wrong with it; add to the plan; take a step out; done
 * episodes stay as they are; nothing shows without a season.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import SeasonRevealPlan from './SeasonRevealPlan';

const BASE = '/api/v1/world/show-1/season/reveals';
const PLAN = (more = {}) => ({ data: {
  arc: { id: 'a1', title: 'Soft Luxury', season_number: 1 },
  slots: [
    { id: 'sl2', slot_number: 2, label: 'S1 · E2', episode: { id: 'e2', title: 'The Brunch' }, done: true },
    { id: 'sl3', slot_number: 3, label: 'S1 · E3', episode: { id: 'e3', title: 'The Gala' }, done: false },
    { id: 'sl5', slot_number: 5, label: 'S1 · E5', episode: null, story_purpose: 'Maren breaks', done: false },
  ],
  secrets: [
    { id: 's1', character_name: 'Maren', text: 'She sold the ring', state: 'hidden' },
    { id: 's2', character_name: 'Maren', text: 'She owes rent', state: 'hinted' },
  ],
  reveals: [
    { id: 'r0', slot_id: 'sl2', secret_id: 's2', intent: 'hint', note: null, label: 'S1 · E2' },
    { id: 'r1', slot_id: 'sl5', secret_id: 's1', intent: 'reveal', note: 'Mo finds the ticket', label: 'S1 · E5' },
  ],
  warnings: [{ secret_id: 's1', text: 'Maren: She sold the ring is revealed in S1 · E5 with no hint before it.' }],
  ...more,
} });

let api;
beforeEach(() => {
  api = { get: vi.fn().mockResolvedValue(PLAN()), put: vi.fn(), delete: vi.fn() };
});

describe('Reveal plan', () => {
  test('each secret, its steps, its warning', async () => {
    render(<SeasonRevealPlan showId="show-1" api={api} />);
    const ring = within(await screen.findByTestId('srp-secret-s1'));
    expect(api.get).toHaveBeenCalledWith(BASE);
    expect(ring.getByText('Not hinted yet')).toBeTruthy();
    expect(within(screen.getByTestId('srp-step-r1')).getByText(/Reveal/).textContent).toContain('Mo finds the ticket');
    expect(ring.getByText(/with no hint before it/)).toBeTruthy();
    // A done episode's step stays; no way to take it out.
    expect(within(screen.getByTestId('srp-step-r0')).queryByRole('button')).toBeNull();
    expect(within(screen.getByTestId('srp-step-r1')).getByRole('button', { name: 'Take S1 · E5 out of the plan' })).toBeTruthy();
  });

  test('add a hint before the reveal', async () => {
    api.put.mockResolvedValue(PLAN({ warnings: [] }));
    render(<SeasonRevealPlan showId="show-1" api={api} />);
    await screen.findByTestId('srp-secret-s1');
    const episode = screen.getByLabelText('Episode');
    expect([...episode.options].map((o) => o.value)).toEqual(['', 'sl3', 'sl5']);
    fireEvent.change(episode, { target: { value: 'sl3' } });
    fireEvent.change(screen.getByLabelText('Secret'), { target: { value: 's1' } });
    fireEvent.change(screen.getByLabelText('How (optional)'), { target: { value: 'She hides her hand' } });
    fireEvent.click(screen.getByRole('button', { name: /Add to the plan/ }));
    expect(await screen.findByText('Added to the plan.')).toBeTruthy();
    expect(api.put).toHaveBeenCalledWith(BASE, { slot_id: 'sl3', secret_id: 's1', intent: 'hint', note: 'She hides her hand' });
    expect(screen.queryByText(/with no hint before it/)).toBeNull();
  });

  test('take a step out; a refusal says so', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    api.delete.mockResolvedValueOnce(PLAN({ reveals: [], warnings: [] }));
    render(<SeasonRevealPlan showId="show-1" api={api} />);
    fireEvent.click(within(await screen.findByTestId('srp-step-r1')).getByRole('button'));
    await waitFor(() => expect(screen.queryByTestId('srp-step-r1')).toBeNull());
    expect(api.delete).toHaveBeenCalledWith(`${BASE}/r1`);
    api.put.mockRejectedValueOnce({ response: { data: { error: 'That episode is done; its story record says what it showed.' } } });
    fireEvent.change(screen.getByLabelText('Episode'), { target: { value: 'sl3' } });
    fireEvent.change(screen.getByLabelText('Secret'), { target: { value: 's2' } });
    fireEvent.click(screen.getByRole('button', { name: /Add to the plan/ }));
    expect(await screen.findByText('That episode is done; its story record says what it showed.')).toBeTruthy();
  });

  test('no secrets yet says where to add them; no season shows nothing', async () => {
    api.get.mockResolvedValueOnce(PLAN({ secrets: [], reveals: [], warnings: [] }));
    const { unmount } = render(<SeasonRevealPlan showId="show-1" api={api} />);
    expect(await screen.findByText(/No one in this show keeps a secret yet/)).toBeTruthy();
    unmount();
    api.get.mockResolvedValueOnce({ data: { arc: null, slots: [], secrets: [], reveals: [], warnings: [] } });
    const { container } = render(<SeasonRevealPlan showId="show-1" api={api} />);
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    expect(container.textContent).toBe('');
  });
});
