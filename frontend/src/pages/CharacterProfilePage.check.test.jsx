/**
 * The consistency check on the character page (Character Consistency Engine
 * step 3; Evoni, 2026-10-16): flag-only, with "It's intentional".
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../config/api', () => ({ API_URL: '/api/v1' }));
vi.mock('../components/CharacterDepthPanel', () => ({ default: () => null }));

import api from '../services/api';
import { ProfileCheck } from './CharacterProfilePage';

const FLAG = {
  id: 'abc123abc123', check: 'followers', field: 'character.description', field_label: 'Description',
  found: '1.2M followers', expected: '2M followers', excerpt: 'A slow-fashion creator with 1.2M followers who stopped posting.',
};
const result = (flags, intentional = []) => ({ data: { success: true, flags, intentional, checked: 12, skipped: { mask: 4, author: 2 }, undecided: [] } });

describe('ProfileCheck', () => {
  beforeEach(() => { api.get.mockReset(); api.post.mockReset(); api.delete.mockReset(); });

  test('runs on request and lists what disagrees, saying what was not checked', async () => {
    api.get.mockResolvedValue(result([FLAG]));
    render(<ProfileCheck characterId="c1" />);
    expect(api.get).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Check their profile against these facts'));
    const box = await screen.findByTestId('ch-check');
    expect(await within(box).findByText(/1 place disagrees with their facts/)).toBeTruthy();
    expect(within(box).getByText(/what they post \(4\) and author-only notes \(2\) are not checked/)).toBeTruthy();
    expect(within(box).getByText(FLAG.excerpt)).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/api/v1/cast/characters/c1/check');
  });

  test('"It\'s intentional" marks it and re-checks; it moves to the intentional list', async () => {
    api.get.mockResolvedValueOnce(result([FLAG])).mockResolvedValueOnce(result([], [{ ...FLAG, note: null }]));
    api.post.mockResolvedValue({ data: { success: true } });
    render(<ProfileCheck characterId="c1" />);
    fireEvent.click(screen.getByText('Check their profile against these facts'));
    fireEvent.click(await screen.findByText('It’s intentional'));
    expect(await screen.findByText('1 marked intentional')).toBeTruthy();
    expect(screen.getByText(/Everything agrees with their facts./)).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith('/api/v1/cast/characters/c1/check/intentional', { flag_id: FLAG.id, note: null });
  });

  test('a failed check says so', async () => {
    api.get.mockRejectedValue(Object.assign(new Error('x'), { response: { data: { error: 'Character not found' } } }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ProfileCheck characterId="c1" />);
    fireEvent.click(screen.getByText('Check their profile against these facts'));
    expect((await screen.findByRole('alert')).textContent).toBe('Character not found');
  });
});
