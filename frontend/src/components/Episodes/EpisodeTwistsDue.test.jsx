/**
 * Script tab › Must cover › Season twists due here (2026-10-23): the
 * episode's plants and payoffs with their descriptions, the "Maybe in beat
 * N" hint from their key words, Mark planted / Mark paid off (only on a
 * click), the error, and nothing when none are due.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import EpisodeTwistsDue, { twistHint } from './EpisodeTwistsDue';

const URL = '/api/v1/episodes/ep-4/season-twists';
const RING = { id: 't1', title: 'The silver ring', description: 'Maren hides her bare hand', status: 'planted', planted_in: { episode_number: 1, title: 'The Brunch' } };
const KEY = { id: 't2', title: 'The spare key', description: 'A key on her chain', status: 'planned', planted_in: null };
const BEATS = [
  { number: 1, lines: ['LALA: Morning.'] },
  { number: 5, lines: ['MAREN: (tucks her hand away) That silver ring? Gone.'] },
];

beforeEach(() => { vi.clearAllMocks(); });

describe('EpisodeTwistsDue', () => {
  test('lists the plant and the payoff with descriptions and a hint', async () => {
    api.get.mockResolvedValue({ data: { plant: [KEY], payoff: [RING] } });
    render(<EpisodeTwistsDue episodeId="ep-4" beats={BEATS} />);
    const plant = within(await screen.findByTestId('script-twist-plant-t2'));
    expect(api.get).toHaveBeenCalledWith(URL);
    expect(plant.getByText('Plant:')).toBeTruthy();
    expect(plant.getByText(/The spare key/)).toBeTruthy();
    expect(plant.getByText('A key on her chain')).toBeTruthy();
    expect(plant.queryByTestId('script-twist-plant-t2-hint')).toBeNull();
    const payoff = within(screen.getByTestId('script-twist-payoff-t1'));
    expect(payoff.getByText('Pay off:')).toBeTruthy();
    expect(payoff.getByText(/planted in episode 1/)).toBeTruthy();
    expect(payoff.getByTestId('script-twist-payoff-t1-hint').textContent).toMatch(/^Maybe in beat 5/);
    expect(payoff.getByTestId('script-twist-payoff-t1-mark').textContent).toBe('Mark paid off');
  });

  test('a done twist says so and offers no button', async () => {
    api.get.mockResolvedValue({ data: { plant: [{ ...KEY, status: 'planted' }], payoff: [] } });
    render(<EpisodeTwistsDue episodeId="ep-4" beats={BEATS} />);
    expect((await screen.findByTestId('script-twist-plant-t2-done')).textContent).toContain('Planted');
    expect(screen.queryByTestId('script-twist-plant-t2-mark')).toBeNull();
  });

  test('Mark planted marks it, only when clicked', async () => {
    api.get.mockResolvedValue({ data: { plant: [KEY], payoff: [] } });
    api.post.mockResolvedValue({ data: { plant: [{ ...KEY, status: 'planted' }], payoff: [] } });
    render(<EpisodeTwistsDue episodeId="ep-4" beats={BEATS} />);
    const btn = await screen.findByTestId('script-twist-plant-t2-mark');
    expect(btn.textContent).toBe('Mark planted');
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(btn);
    expect(api.post).toHaveBeenCalledWith(`${URL}/t2/mark`, { as: 'planted' });
    expect(await screen.findByTestId('script-twist-plant-t2-done')).toBeTruthy();
  });

  test('says why when marking fails', async () => {
    api.get.mockResolvedValue({ data: { plant: [KEY], payoff: [] } });
    api.post.mockRejectedValue({ response: { data: { error: 'That twist is not due in this episode.' } } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<EpisodeTwistsDue episodeId="ep-4" beats={BEATS} />);
    fireEvent.click(await screen.findByTestId('script-twist-plant-t2-mark'));
    expect((await screen.findByRole('alert')).textContent).toBe('That twist is not due in this episode.');
    expect(screen.getByTestId('script-twist-plant-t2-mark')).toBeTruthy();
  });

  test('nothing when none are due', async () => {
    api.get.mockResolvedValue({ data: { plant: [], payoff: [] } });
    const { container, unmount } = render(<EpisodeTwistsDue episodeId="ep-4" beats={BEATS} />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(container.innerHTML).toBe('');
    unmount();
  });

  // Script tab audit 6 (2026-10-24): a failed read says so, with Retry.
  test("a failed read says Couldn't read twists, and Retry reads again", async () => {
    api.get.mockRejectedValueOnce(new Error('down')).mockResolvedValue({ data: { plant: [KEY], payoff: [] } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<EpisodeTwistsDue episodeId="ep-4" beats={BEATS} />);
    expect((await screen.findByTestId('script-twists-unread')).textContent).toContain("Couldn't read twists.");
    fireEvent.click(screen.getByTestId('script-twists-retry'));
    expect(await screen.findByTestId('script-twist-plant-t2')).toBeTruthy();
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  test('Undo takes a mark back', async () => {
    api.get.mockResolvedValue({ data: { plant: [{ ...KEY, status: 'planted' }], payoff: [{ ...RING, status: 'paid_off' }] } });
    api.post.mockResolvedValue({ data: { plant: [KEY], payoff: [{ ...RING, status: 'paid_off' }] } });
    render(<EpisodeTwistsDue episodeId="ep-4" beats={BEATS} />);
    expect(await screen.findByTestId('script-twist-payoff-t1-undo')).toBeTruthy();
    fireEvent.click(screen.getByTestId('script-twist-plant-t2-undo'));
    expect(api.post).toHaveBeenCalledWith(`${URL}/t2/mark`, { as: 'planted', undo: true });
    expect(await screen.findByTestId('script-twist-plant-t2-mark')).toBeTruthy();
  });

  test('paying off a twist not planted yet asks first', async () => {
    api.get.mockResolvedValue({ data: { plant: [], payoff: [KEY] } });
    api.post.mockResolvedValue({ data: { plant: [], payoff: [{ ...KEY, status: 'paid_off' }] } });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<EpisodeTwistsDue episodeId="ep-4" beats={BEATS} />);
    fireEvent.click(await screen.findByTestId('script-twist-payoff-t2-mark'));
    expect(confirm.mock.calls[0][0]).toBe('"The spare key" has not been planted yet. Mark it paid off anyway?');
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('script-twist-payoff-t2-mark'));
    expect(api.post).toHaveBeenCalledWith(`${URL}/t2/mark`, { as: 'paid_off' });
    confirm.mockRestore();
  });

  test('the hint: the title\'s key words, else the description\'s', () => {
    expect(twistHint(BEATS, { title: 'The silver ring' })).toBe(5);
    expect(twistHint(BEATS, { title: 'Something else', description: 'A blue scarf on the stairs' })).toBe(null);
    expect(twistHint([{ number: 3, lines: ['A key hangs on her chain.'] }], { title: 'Spare', description: 'key chain' })).toBe(3);
  });
});
