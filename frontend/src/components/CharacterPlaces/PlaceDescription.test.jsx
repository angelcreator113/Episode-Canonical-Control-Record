/**
 * "Write from their profile" on a place card (Evoni, 2026-10-17): the
 * description is written from their profile, the facts it used are shown,
 * those it lacked are named, and nothing saves until it is chosen.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

import api from '../../services/api';
import PlaceDescription from './PlaceDescription';

const DRAFT = {
  description: 'A one-bedroom rental in Silk Row with one staged corner.',
  used: [{ label: 'City', value: 'Dazzle District' }, { label: 'Home price range', value: 'Modest ($1,500 to $3,000 a month)' }, { label: 'Shown vs real', value: 'massive gap' }],
  missing: ['Style'], gap: true, current: null, role: 'home',
};
const renderIt = (onNote = vi.fn(), role = 'home') => render(<PlaceDescription characterId="c-1" setId="set-1" setName="Sable's Home" role={role} onNote={onNote} />);

describe('PlaceDescription', () => {
  beforeEach(() => { api.post.mockReset(); api.put.mockReset(); });

  test('writes from their profile, shows what it used and lacked, saves only on Use', async () => {
    api.post.mockResolvedValue({ data: { success: true, data: DRAFT } });
    api.put.mockResolvedValue({ data: { success: true } });
    const onNote = vi.fn();
    renderIt(onNote);
    fireEvent.click(screen.getByTestId('place-describe-home-set-1'));
    const text = await screen.findByTestId('place-describe-text-home-set-1');
    expect(api.post).toHaveBeenCalledWith('/api/v1/cast/characters/c-1/places/describe', { scene_set_id: 'set-1', role: 'home' });
    expect(text.value).toBe(DRAFT.description);
    expect(screen.getByText(/shown vs real/i, { selector: 'label' })).toBeTruthy();
    expect(screen.getByTestId('place-describe-used-home-set-1').textContent).toMatch(/City: Dazzle District/);
    expect(screen.getByTestId('place-describe-missing-home-set-1').textContent).toMatch(/Not on their profile yet: Style/);
    expect(api.put).not.toHaveBeenCalled();

    fireEvent.change(text, { target: { value: 'Edited by Evoni.' } });
    fireEvent.click(screen.getByTestId('place-describe-use-home-set-1'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/scene-sets/set-1', { canonical_description: 'Edited by Evoni.' }));
    await waitFor(() => expect(onNote).toHaveBeenCalledWith({ text: "Sable's Home's description saved" }));
    expect(screen.queryByTestId('place-describe-draft-home-set-1')).toBeNull();
  });

  test('a set with a description shows it and offers to replace it, not save over it', async () => {
    api.post.mockResolvedValue({ data: { success: true, data: { ...DRAFT, current: 'A bright loft.' } } });
    renderIt();
    fireEvent.click(screen.getByTestId('place-describe-home-set-1'));
    expect(await screen.findByText('A bright loft.')).toBeTruthy();
    expect(screen.getByTestId('place-describe-use-home-set-1').textContent).toBe('Replace it with this');
    fireEvent.click(screen.getByText('Cancel'));
    expect(api.put).not.toHaveBeenCalled();
  });

  test('Cancel after a failed save clears its error (sixth audit)', async () => {
    api.post.mockResolvedValue({ data: { success: true, data: DRAFT } });
    api.put.mockRejectedValue({ response: { data: { error: 'Could not save' } } });
    renderIt();
    fireEvent.click(screen.getByTestId('place-describe-home-set-1'));
    fireEvent.click(await screen.findByTestId('place-describe-use-home-set-1'));
    expect((await screen.findByRole('alert')).textContent).toBe('Could not save');
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('a place of work says its description is shared with the events held there (sixth audit)', async () => {
    api.post.mockResolvedValue({ data: { success: true, data: { ...DRAFT, role: 'work' } } });
    renderIt(vi.fn(), 'work');
    fireEvent.click(screen.getByTestId('place-describe-work-set-1'));
    expect((await screen.findByTestId('place-describe-shared-work-set-1')).textContent).toMatch(/every event held there/);
    expect(api.post).toHaveBeenCalledWith('/api/v1/cast/characters/c-1/places/describe', { scene_set_id: 'set-1', role: 'work' });
  });

  test('a refused write says why', async () => {
    api.post.mockRejectedValue({ response: { data: { error: 'Daily AI budget reached' } } });
    renderIt();
    fireEvent.click(screen.getByTestId('place-describe-home-set-1'));
    expect((await screen.findByRole('alert')).textContent).toBe('Daily AI budget reached');
  });
});
