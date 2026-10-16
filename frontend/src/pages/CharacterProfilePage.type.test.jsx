/**
 * Their type on the character page (Character Consistency Engine step 6a):
 * set the Enneagram type, wing and MBTI; a suggestion fills the form only.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../config/api', () => ({ API_URL: '/api/v1' }));
vi.mock('../components/CharacterDepthPanel', () => ({ default: () => null }));

import api from '../services/api';
import { TheirType } from './CharacterProfilePage';

const SAVED = { typology: { enneagram: { type: 3, wing: 4 }, mbti: 'ENTJ', why: 'Her worth is her output.' }, label: 'Type 3w4, The Achiever' };

describe('TheirType', () => {
  beforeEach(() => { api.get.mockReset(); api.post.mockReset(); api.put.mockReset(); });

  test('none yet; set a type, a wing beside it and an MBTI', async () => {
    api.get.mockResolvedValue({ data: { typology: null, label: null } });
    api.put.mockResolvedValue({ data: SAVED });
    render(<TheirType character={{ id: 'c1' }} />);
    const card = await screen.findByTestId('ch-type');
    expect(await within(card).findByText(/No type set yet/)).toBeTruthy();
    fireEvent.click(within(card).getByText('Set their type'));
    fireEvent.change(within(card).getByLabelText('Enneagram type'), { target: { value: '3' } });
    const wing = within(card).getByLabelText('Wing');
    expect(Array.from(wing.options).map((o) => o.value)).toEqual(['', '2', '4']);
    fireEvent.change(wing, { target: { value: '4' } });
    fireEvent.change(within(card).getByLabelText('MBTI (how they phrase things only)'), { target: { value: 'ENTJ' } });
    fireEvent.change(within(card).getByLabelText('Why this type'), { target: { value: 'Her worth is her output.' } });
    fireEvent.click(within(card).getByText('Save type'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/cast/characters/c1/typology',
      { enneagram: { type: 3, wing: 4 }, mbti: 'ENTJ', why: 'Her worth is her output.' }));
    expect(await within(card).findByText('Enneagram Type 3w4, The Achiever')).toBeTruthy();
  });

  test('a suggestion fills the form and saves nothing until saved', async () => {
    api.get.mockResolvedValue({ data: { typology: null, label: null } });
    api.post.mockResolvedValue({ data: { suggestion: { enneagram: { type: 3, wing: 2 }, mbti: 'ESTJ', why: 'Love was earned.' }, label: 'Type 3w2, The Achiever' } });
    render(<TheirType character={{ id: 'c1' }} />);
    const card = await screen.findByTestId('ch-type');
    fireEvent.click(await within(card).findByText('Suggest a type from their writing'));
    const box = await within(card).findByTestId('ch-type-suggest');
    expect(box.textContent).toMatch(/Suggested: Enneagram Type 3w2, The Achiever/);
    expect(api.put).not.toHaveBeenCalled();
    fireEvent.click(within(box).getByText('Use this'));
    expect(within(card).getByLabelText('Enneagram type').value).toBe('3');
    expect(within(card).getByLabelText('Wing').value).toBe('2');
    expect(within(card).getByLabelText('Why this type').value).toBe('Love was earned.');
  });
});
