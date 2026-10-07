/**
 * Show settings → Config (Evoni, 2026-10-07). It opened on its defaults (it
 * read the show from the wrong place), saved fields a show does not have,
 * and offered a 'paused' status the database refuses. Now it shows the show,
 * saves its name, description and status, and keeps the season settings in
 * the show's metadata beside what is there.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn(), request: vi.fn() },
}));

import api from '../services/api';
import ShowSettings from './ShowSettings';
import { settingsFromShow, settingsUpdate, settingsError, showFromResponse } from '../lib/showSettings';

const LALA_HOME = { address: '246 Olddy Paveway Ln', city: 'Los Angeles' };
const SHOW = {
  id: 'show-1', name: 'Styling Adventures', description: 'Lala styles.', status: 'in_development',
  metadata: { tagline: 'Dress the dream', era: 'Prime Era', season_length: 12, lala_home: LALA_HOME },
};

describe('showSettings helpers', () => {
  test('reads the show out of { status, data }', () => {
    expect(showFromResponse({ data: { status: 'SUCCESS', data: SHOW } })).toBe(SHOW);
    expect(showFromResponse({ data: { status: 'SUCCESS' } })).toBeNull();
  });

  test('the form is the stored show, with defaults only where nothing is stored', () => {
    expect(settingsFromShow(SHOW)).toEqual({
      name: 'Styling Adventures', description: 'Lala styles.', status: 'in_development',
      era: 'Prime Era', season_length: 12, economy_model: 'Prime Coins + Dream Fund',
    });
    expect(settingsFromShow({ ...SHOW, status: 'paused' }).status).toBe('active');
  });

  test('the save keeps the metadata already there', () => {
    const body = settingsUpdate({ ...settingsFromShow(SHOW), name: ' New Name ', economy_model: 'Coins Only' }, SHOW);
    expect(body).toEqual({
      name: 'New Name', description: 'Lala styles.', status: 'in_development',
      metadata: { tagline: 'Dress the dream', lala_home: LALA_HOME, era: 'Prime Era', season_length: 12, economy_model: 'Coins Only' },
    });
    expect(body).not.toHaveProperty('title');
    expect(settingsError({ ...settingsFromShow(SHOW), name: ' ' })).toBe('The show needs a name.');
  });
});

describe('ShowSettings Config', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    vi.mocked(api.get).mockImplementation(async (url) => (
      url.endsWith('/lala-home') ? { data: { success: true, lala_home: LALA_HOME } } : { data: { status: 'SUCCESS', data: SHOW } }
    ));
  });

  const open = () => render(
    <MemoryRouter initialEntries={['/shows/show-1/settings']}>
      <Routes><Route path="/shows/:id/settings" element={<ShowSettings />} /></Routes>
    </MemoryRouter>,
  );

  test('opens on the show, and saves its own fields', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: { status: 'SUCCESS', data: { ...SHOW, name: 'Styling Adventures with Lala' } } });
    open();
    await waitFor(() => expect(screen.getByTestId('settings-name').value).toBe('Styling Adventures'));
    expect(screen.getByDisplayValue('Prime Era')).toBeTruthy();
    expect(screen.getByDisplayValue('In development')).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Paused' })).toBeNull();

    fireEvent.change(screen.getByTestId('settings-name'), { target: { value: 'Styling Adventures with Lala' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save Changes' })[0]);
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const [url, body] = vi.mocked(api.put).mock.calls[0];
    expect(url).toBe('/api/v1/shows/show-1');
    expect(body).toMatchObject({ name: 'Styling Adventures with Lala', status: 'in_development' });
    expect(body.metadata).toMatchObject({ lala_home: LALA_HOME, tagline: 'Dress the dream', season_length: 12 });
    expect(await screen.findByText('Settings saved')).toBeTruthy();
  });

  test('a refused save says why', async () => {
    vi.mocked(api.put).mockRejectedValue({ response: { status: 500, data: { error: 'Failed to update show', message: 'invalid input value for enum' } } });
    open();
    await waitFor(() => expect(screen.getByTestId('settings-name').value).toBe('Styling Adventures'));
    fireEvent.change(screen.getByTestId('settings-name'), { target: { value: 'X' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save Changes' })[0]);
    expect(await screen.findByText('Not saved: invalid input value for enum')).toBeTruthy();
  });
});
