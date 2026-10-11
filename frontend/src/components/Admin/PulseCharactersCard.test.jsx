/**
 * Uploads › Characters (Task #2921): the cast from every registry, once each
 * and by name; search; profile and cover photos upload and clear per
 * character (/api/v1/character-registry/characters/:id/photo?kind=).
 */
import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import api from '../../services/api';
import PulseCharactersCard from './PulseCharactersCard';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));

const REGISTRIES = [
  { id: 'r1', characters: [{ id: 'c2', display_name: 'Zara', portrait_url: null, cover_url: null }, { id: 'c1', display_name: 'Ava', portrait_url: '/uploads/portraits/ava.png', cover_url: null }] },
  { id: 'r2', characters: [{ id: 'c1', display_name: 'Ava', portrait_url: '/uploads/portraits/ava.png', cover_url: null }] },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockResolvedValue({ data: { registries: REGISTRIES } });
});

describe('Uploads › Characters', () => {
  test('each character once, by name, with empty spots as "+ Add"', async () => {
    render(<PulseCharactersCard />);
    await screen.findByTestId('pulse-character-c1');
    expect(api.get).toHaveBeenCalledWith('/api/v1/character-registry/registries?limit=100');
    const names = [...document.querySelectorAll('.pulse-character h4')].map((h) => h.textContent);
    expect(names).toEqual(['Ava', 'Zara']);
    const ava = within(screen.getByTestId('pulse-character-c1'));
    expect(ava.getByRole('img', { name: 'Ava' }).getAttribute('src')).toBe('/uploads/portraits/ava.png');
    expect(ava.getByTestId('char-c1-cover-add').textContent).toMatch(/\+ Add cover/);
    expect(within(screen.getByTestId('pulse-character-c2')).getByTestId('char-c2-portrait-add').textContent).toMatch(/\+ Add profile photo/);
  });

  test('search narrows the list', async () => {
    render(<PulseCharactersCard />);
    await screen.findByTestId('pulse-character-c1');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zar' } });
    expect(screen.queryByTestId('pulse-character-c1')).toBeNull();
    expect(screen.getByTestId('pulse-character-c2')).toBeTruthy();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'nobody' } });
    expect(screen.getByText('No character matches “nobody”.')).toBeTruthy();
  });

  test('a cover uploads to that character; Remove clears the profile photo', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, cover_url: 'https://cdn/zara-cover.jpg' } });
    vi.mocked(api.delete).mockResolvedValue({ data: { success: true, portrait_url: null } });
    render(<PulseCharactersCard />);
    await screen.findByTestId('pulse-character-c2');

    const file = new File(['x'], 'cover.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('char-c2-cover-file'), { target: { files: [file] } });
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const [url, form] = vi.mocked(api.post).mock.calls[0];
    expect(url).toBe('/api/v1/character-registry/characters/c2/photo?kind=cover');
    expect(form.get('image')).toBe(file);
    await waitFor(() => expect(screen.getByTestId('pulse-character-c2').querySelector('img.pulse-city-image')?.getAttribute('src')).toBe('https://cdn/zara-cover.jpg'));

    fireEvent.click(within(screen.getByTestId('pulse-character-c1')).getByRole('button', { name: /Remove/ }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/character-registry/characters/c1/photo?kind=portrait'));
    expect(await within(screen.getByTestId('pulse-character-c1')).findByTestId('char-c1-portrait-add')).toBeTruthy();
  });
});
