/**
 * My Little List ♡, the phone component (Evoni, 2026-10-26, Phase 2):
 * progress, rows, a gentle tick (optimistic, put back when the server says
 * no), notes that open, her reminders added, edited and removed, Minimise
 * and Close; read only unless interactive.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

import api from '../../services/api';
import MyLittleList from './MyLittleList';

const K = (c) => `mll_${c.repeat(24)}`;
const LIST = () => ({
  app: 'My Little List ♡',
  items: [
    { key: K('a'), title: 'Check my coins', note: null, done: false, can_check: true, can_edit: true, can_remove: true },
    { key: K('b'), title: 'Find something to wear', note: '0 of 3 pieces sorted', done: false, can_check: false, can_edit: true, can_remove: false },
    { key: K('c'), title: 'Meet some interesting people', note: null, done: true, can_check: true, can_edit: true, can_remove: false },
  ],
  progress: { done: 1, total: 3 },
});

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockResolvedValue({ data: LIST() });
  vi.mocked(api.patch).mockResolvedValue({ data: { success: true } });
  vi.mocked(api.post).mockResolvedValue({ data: { success: true, key: K('d') } });
  vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const rowOf = (title) => screen.getByText(title).closest('[data-testid="mll-row"]');

describe('what she sees', () => {
  test('her list as of the beat and line, with its progress', async () => {
    render(<MyLittleList episodeId="ep-1" beat={6} line={2} />);
    expect(await screen.findByText('Check my coins')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/api/v1/episodes/ep-1/my-little-list?beat=6&line=2');
    expect(screen.getByTestId('mll-progress').textContent).toContain('1 of 3');
    expect(rowOf('Meet some interesting people').dataset.done).toBe('true');
    expect(within(rowOf('Meet some interesting people')).getByRole('checkbox').getAttribute('aria-checked')).toBe('true');
  });

  test('a note opens and closes', async () => {
    render(<MyLittleList episodeId="ep-1" beat={5} />);
    await screen.findByText('Find something to wear');
    expect(screen.queryByTestId('mll-note')).toBeNull();
    fireEvent.click(within(rowOf('Find something to wear')).getByTestId('mll-note-toggle'));
    expect(screen.getByTestId('mll-note').textContent).toBe('0 of 3 pieces sorted');
    fireEvent.click(within(rowOf('Find something to wear')).getByTestId('mll-note-toggle'));
    expect(screen.queryByTestId('mll-note')).toBeNull();
  });

  test('Minimise folds it to a pill with the count; a tap opens it again; Close is offered when the phone can close it', async () => {
    const onClose = vi.fn();
    render(<MyLittleList episodeId="ep-1" beat={5} onClose={onClose} />);
    await screen.findByText('Check my coins');
    fireEvent.click(screen.getByTestId('mll-minimise'));
    expect(screen.getByTestId('mll-minimised').textContent).toContain('1/3');
    expect(screen.queryByText('Check my coins')).toBeNull();
    fireEvent.click(screen.getByTestId('mll-minimised'));
    expect(screen.getByText('Check my coins')).toBeTruthy();
    fireEvent.click(screen.getByTestId('mll-close'));
    expect(onClose).toHaveBeenCalled();
  });

  test('empty, failed, and outside an episode', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { items: [], progress: { done: 0, total: 0 } } });
    const { unmount } = render(<MyLittleList episodeId="ep-1" beat={3} />);
    expect(await screen.findByTestId('mll-empty')).toBeTruthy();
    unmount();
    vi.mocked(api.get).mockRejectedValueOnce(new Error('down'));
    const second = render(<MyLittleList episodeId="ep-1" beat={3} />);
    expect(await screen.findByTestId('mll-error')).toBeTruthy();
    second.unmount();
    render(<MyLittleList episodeId={null} />);
    expect(screen.getByText('Shown in an episode')).toBeTruthy();
  });

  test('read only: no add, edit or remove, and a box sends nothing', async () => {
    render(<MyLittleList episodeId="ep-1" beat={5} />);
    await screen.findByText('Check my coins');
    expect(screen.queryByTestId('mll-add')).toBeNull();
    expect(screen.queryByTestId('mll-edit')).toBeNull();
    expect(screen.queryByTestId('mll-remove')).toBeNull();
    fireEvent.click(within(rowOf('Check my coins')).getByRole('checkbox'));
    expect(api.patch).not.toHaveBeenCalled();
  });
});

describe('interactive', () => {
  test('a tick shows at once, with its animation, and is saved at the beat and line', async () => {
    render(<MyLittleList episodeId="ep-1" beat={6} line={2} interactive />);
    await screen.findByText('Check my coins');
    fireEvent.click(within(rowOf('Check my coins')).getByRole('checkbox'));
    expect(rowOf('Check my coins').dataset.done).toBe('true');
    expect(rowOf('Check my coins').className).toContain('just-ticked');
    expect(screen.getByTestId('mll-progress').textContent).toContain('2 of 3');
    expect(api.patch).toHaveBeenCalledWith(`/api/v1/episodes/ep-1/my-little-list/items/${K('a')}`, { done: true, beat: 6, line: 2 });
  });

  test('her outfit ticks itself: tapping it says so and sends nothing', async () => {
    render(<MyLittleList episodeId="ep-1" beat={8} interactive />);
    await screen.findByText('Find something to wear');
    fireEvent.click(within(rowOf('Find something to wear')).getByRole('checkbox'));
    expect(screen.getByTestId('mll-message').textContent).toBe('That one ticks itself as she plays.');
    expect(api.patch).not.toHaveBeenCalled();
  });

  test('a refused tick is put back, with the reason', async () => {
    vi.mocked(api.patch).mockRejectedValueOnce({ response: { status: 503, data: { code: 'PERSONAL_LIST_MIGRATION_PENDING' } } });
    render(<MyLittleList episodeId="ep-1" beat={3} interactive />);
    await screen.findByText('Check my coins');
    fireEvent.click(within(rowOf('Check my coins')).getByRole('checkbox'));
    await waitFor(() => expect(screen.getByTestId('mll-message').textContent).toMatch(/saving waits/));
    await waitFor(() => expect(rowOf('Check my coins').dataset.done).toBe('false'));
  });

  test('add a reminder, edit one, remove one', async () => {
    render(<MyLittleList episodeId="ep-1" beat={3} line={0} interactive />);
    await screen.findByText('Check my coins');
    fireEvent.click(screen.getByTestId('mll-add'));
    fireEvent.change(screen.getByTestId('mll-add-input'), { target: { value: 'Charge my phone' } });
    fireEvent.submit(screen.getByTestId('mll-add-input').closest('form'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/episodes/ep-1/my-little-list/items', { title: 'Charge my phone' }));

    fireEvent.click(within(rowOf('Check my coins')).getByTestId('mll-edit'));
    fireEvent.change(screen.getByTestId('mll-edit-input'), { target: { value: 'Check my coins twice' } });
    fireEvent.submit(screen.getByTestId('mll-edit-input').closest('form'));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(`/api/v1/episodes/ep-1/my-little-list/items/${K('a')}`, { title: 'Check my coins twice', beat: 3, line: 0 }));

    fireEvent.click(within(rowOf('Check my coins')).getByTestId('mll-remove'));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith(`/api/v1/episodes/ep-1/my-little-list/items/${K('a')}?beat=3&line=0`));
    // Only her own reminders can be removed.
    expect(within(rowOf('Meet some interesting people')).queryByTestId('mll-remove')).toBeNull();
  });
});
