/**
 * "Make one for me" on The Cast (Evoni, 2026-10-19): an optional idea, Make 1
 * or Make 3, then each proposal with Keep, Try again and Edit. Nothing is
 * saved until Keep.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

import api from '../../services/api';
import CastMakeForMe from './CastMakeForMe';

const REG = { id: 'r-1', title: 'LalaVerse' };
const SIENNA = {
  display_name: 'Sienna Vale', selected_name: 'Sienna Okafor-Vale', role_type: 'shadow', role_label: 'rival stylist',
  description: 'She dresses the women Lala wants to be.', current_city: 'dazzle_district', icon: '🦹',
  signature_trait: 'Never pays retail.', core_desire: 'To be the name.', core_fear: 'Being copied.',
  world: 'lalaverse', pulse: { handle: 'sienna_vale', bio: 'Styling the uninvited.', follower_count: 48000 },
};
const proposed = (list) => ({ data: { success: true, world: 'lalaverse', proposals: list } });

describe('CastMakeForMe', () => {
  beforeEach(() => { vi.mocked(api.post).mockReset(); });

  test('Make 1 sends the idea and shows the proposal with name, role, city, handle and traits', async () => {
    vi.mocked(api.post).mockResolvedValueOnce(proposed([SIENNA]));
    render(<CastMakeForMe registries={[REG]} registryId="r-1" />);
    fireEvent.change(screen.getByTestId('cmfm-idea'), { target: { value: 'a rival stylist' } });
    fireEvent.click(screen.getByTestId('cmfm-make-1'));
    const card = await screen.findByTestId('cmfm-proposal');
    expect(api.post).toHaveBeenCalledWith('/api/v1/character-generation/cast/propose', { registry_id: 'r-1', idea: 'a rival stylist', count: 1 });
    expect(card.textContent).toContain('Sienna Vale');
    expect(card.textContent).toContain('Shadow');
    expect(card.textContent).toContain('Dazzle District');
    expect(card.textContent).toContain('@sienna_vale');
    expect(card.textContent).toContain('Never pays retail.');
  });

  test('Keep saves that one and tells the page; Try again asks again and saves nothing', async () => {
    const onKept = vi.fn();
    vi.mocked(api.post)
      .mockResolvedValueOnce(proposed([SIENNA, { ...SIENNA, display_name: 'Two' }, { ...SIENNA, display_name: 'Three' }]))
      .mockResolvedValueOnce({ data: { success: true, character: { id: 'c-1', display_name: 'Sienna Vale' } } })
      .mockResolvedValueOnce(proposed([{ ...SIENNA, display_name: 'Fresh' }]));
    render(<CastMakeForMe registries={[REG]} registryId="r-1" onKept={onKept} />);
    fireEvent.click(screen.getByTestId('cmfm-make-3'));
    expect(await screen.findAllByTestId('cmfm-proposal')).toHaveLength(3);
    fireEvent.click(screen.getAllByTestId('cmfm-keep')[0]);
    await waitFor(() => expect(onKept).toHaveBeenCalledWith({ id: 'c-1', display_name: 'Sienna Vale' }, REG));
    expect(api.post).toHaveBeenNthCalledWith(2, '/api/v1/character-generation/cast/keep', { registry_id: 'r-1', proposal: SIENNA });
    expect(screen.getAllByTestId('cmfm-proposal')).toHaveLength(2);
    fireEvent.click(screen.getAllByTestId('cmfm-again')[0]);
    await waitFor(() => expect(screen.getByTestId('cmfm-proposal').textContent).toContain('Fresh'));
    expect(api.post).toHaveBeenNthCalledWith(3, '/api/v1/character-generation/cast/propose', { registry_id: 'r-1', idea: '', count: 3 });
  });

  test('Edit hands the proposal and its registry to the page', async () => {
    const onEdit = vi.fn();
    vi.mocked(api.post).mockResolvedValueOnce(proposed([SIENNA]));
    render(<CastMakeForMe registries={[REG]} registryId="r-1" onEdit={onEdit} />);
    fireEvent.click(screen.getByTestId('cmfm-make-1'));
    fireEvent.click(await screen.findByTestId('cmfm-edit'));
    expect(onEdit).toHaveBeenCalledWith(SIENNA, REG);
  });

  test('with several registries and none chosen, it asks for one first', () => {
    render(<CastMakeForMe registries={[REG, { id: 'r-2', title: 'Before Lala' }]} registryId={null} />);
    expect(screen.getByTestId('cmfm-make-1').disabled).toBe(true);
    fireEvent.change(screen.getByTestId('cmfm-registry'), { target: { value: 'r-2' } });
    expect(screen.getByTestId('cmfm-make-1').disabled).toBe(false);
  });

  test('a refusal is said plainly', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 429, data: { error: 'AI daily budget exceeded. Nothing was made.' } } });
    render(<CastMakeForMe registries={[REG]} registryId="r-1" />);
    fireEvent.click(screen.getByTestId('cmfm-make-1'));
    expect((await screen.findByTestId('cmfm-error')).textContent).toContain('Nothing was made');
  });

  test('a non-admin is told only an admin can make characters', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 403, data: { error: 'Forbidden' } } });
    render(<CastMakeForMe registries={[REG]} registryId="r-1" />);
    fireEvent.click(screen.getByTestId('cmfm-make-1'));
    expect((await screen.findByTestId('cmfm-error')).textContent).toContain('Only an admin');
  });
});
