/**
 * Evoni, 2026-10-18: a Talk tab where she speaks with a character in Lala's
 * world as Dr. Amara Sinclair, their therapist; what the session revealed
 * comes back as suggestions only she sees.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../../services/api';
import CharacterTalkTab from './CharacterTalkTab';

const lala = { id: 'c-1', display_name: 'Lala' };
const said = {
  id: 's-1', created_at: '2026-10-18T10:00:00Z',
  messages: [{ from: 'dr_sinclair', text: 'What scares you?', at: '1' }, { from: 'character', text: 'Being ordinary.', at: '2' }],
  review: null,
};

describe('CharacterTalkTab', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, can_talk: true, sessions: [] } });
  });

  test('you are Dr. Sinclair; a line gets their answer', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { success: true, session: said } });
    render(<CharacterTalkTab character={lala} />);
    expect(await screen.findByText(/You are Dr. Amara Sinclair, Lala's therapist/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Dr. Sinclair'), { target: { value: 'What scares you?' } });
    fireEvent.click(screen.getByRole('button', { name: /Say it/ }));
    await screen.findByText('Being ordinary.');
    expect(api.post).toHaveBeenCalledWith('/api/v1/cast/characters/c-1/talk', { session_id: null, text: 'What scares you?' });
  });

  test('What came out of this: her note, and Apply on an inner-life change', async () => {
    const reviewed = {
      ...said,
      review: {
        session_note: 'She wants approval.',
        items: [
          { id: 'i-1', kind: 'inner', field: 'core_fear', value: 'Being ordinary, and wanting approval.', current: 'Being ordinary.', why: 'Maybe both.', status: 'open' },
          { id: 'i-2', kind: 'insight', text: 'A beat where she almost asks.', status: 'open' },
        ],
      },
    };
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, can_talk: true, sessions: [said] } });
    vi.mocked(api.post)
      .mockResolvedValueOnce({ data: { success: true, session: reviewed } })
      .mockResolvedValueOnce({ data: { success: true, session: { ...reviewed, review: { ...reviewed.review, items: [{ ...reviewed.review.items[0], status: 'applied' }, reviewed.review.items[1]] } } } });
    const onSaved = vi.fn();
    render(<CharacterTalkTab character={lala} onSaved={onSaved} />);
    fireEvent.click(await screen.findByRole('button', { name: /Oct/ }));
    fireEvent.click(screen.getByTestId('talk-review-run'));
    const review = await screen.findByTestId('talk-review');
    expect(review.textContent).toContain('She wants approval.');
    expect(review.textContent).toContain('Producer Insights (only you see these)');
    const item = screen.getByTestId('talk-item-i-1');
    expect(item.textContent).toContain('What they fear');
    expect(item.textContent).toContain('Now: Being ordinary.');
    fireEvent.click(within(item).getByRole('button', { name: 'Apply to their inner life' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ core_fear: 'Being ordinary, and wanting approval.' }));
    expect(api.post).toHaveBeenLastCalledWith('/api/v1/cast/talk/s-1/items/i-1', { action: 'apply' });
    expect((await screen.findByTestId('talk-item-i-1')).textContent).toContain('Applied');
  });

  test('a character outside Lala\'s world cannot be talked to', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, can_talk: false, sessions: [] } });
    render(<CharacterTalkTab character={lala} />);
    expect((await screen.findByTestId('talk-unavailable')).textContent).toContain('Talk is for characters in Lala\'s world');
  });
});
