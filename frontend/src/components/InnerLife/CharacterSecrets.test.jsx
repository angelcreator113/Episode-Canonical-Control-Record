/**
 * Secrets (stage B): the kept ones with each layer's permission, where the
 * audience stands and who knows; suggestions to keep or discard; adding
 * one. The author edits; everyone else reads.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../../config/api', () => ({ API_URL: '/api/v1' }));

import api from '../../services/api';
import AuthContext from '../../contexts/AuthContext';
import CharacterSecrets from './CharacterSecrets';
import InnerLifeWorkspace from './InnerLifeWorkspace';

const BASE = '/api/v1/cast/characters/c1/secrets';
const RING = {
  id: 's1', text: 'She sold the ring', source_field: 'wound', status: 'confirmed', state: 'hidden', where: null, known_by: [], known_by_people: [],
  permissions: { episode: 'hint', short_story: 'hint', chapter: 'hint' },
};
const CAND = { ...RING, id: 's2', text: 'She never finished school', source_field: 'self_narrative', status: 'candidate' };
const CAST = [{ id: 'm1', name: 'Mo' }];

const renderIt = (isAuthor = true) => render(<CharacterSecrets character={{ id: 'c1' }} isAuthor={isAuthor} />);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.get).mockResolvedValue({ data: { success: true, secrets: [RING, CAND], cast: CAST } });
});

describe('Secrets', () => {
  test('the kept one with its layers, the audience and who knows; the suggested one apart', async () => {
    renderIt();
    const card = await screen.findByTestId('il-secret-s1');
    expect(api.get).toHaveBeenCalledWith(BASE);
    expect(within(card).getByText('She sold the ring')).toBeTruthy();
    expect(within(card).getByText('From: Wound')).toBeTruthy();
    expect(within(card).getByLabelText('Episode').value).toBe('hint');
    expect(within(card).getByLabelText('Chapter book').value).toBe('hint');
    expect(within(card).getByLabelText('The audience').value).toBe('hidden');
    expect(within(card).getByText(/No one else knows/)).toBeTruthy();
    expect(within(screen.getByTestId('il-secret-candidates')).getByText('She never finished school')).toBeTruthy();
  });

  test('a layer may reveal it; Mo knows it', async () => {
    vi.mocked(api.put)
      .mockResolvedValueOnce({ data: { secret: { ...RING, permissions: { ...RING.permissions, chapter: 'reveal' } } } })
      .mockResolvedValueOnce({ data: { secret: { ...RING, permissions: { ...RING.permissions, chapter: 'reveal' }, known_by: ['m1'], known_by_people: CAST } } });
    renderIt();
    const card = await screen.findByTestId('il-secret-s1');
    fireEvent.change(within(card).getByLabelText('Chapter book'), { target: { value: 'reveal' } });
    await waitFor(() => expect(within(card).getByLabelText('Chapter book').value).toBe('reveal'));
    expect(api.put).toHaveBeenCalledWith(`${BASE}/s1`, { permissions: { chapter: 'reveal' } });
    fireEvent.click(within(card).getByRole('button', { name: 'Mo' }));
    await waitFor(() => expect(within(card).getByRole('button', { name: 'Mo' }).getAttribute('aria-pressed')).toBe('true'));
    expect(api.put).toHaveBeenLastCalledWith(`${BASE}/s1`, { known_by: ['m1'] });
  });

  test('hinted asks where', async () => {
    vi.mocked(api.put).mockResolvedValueOnce({ data: { secret: { ...RING, state: 'hinted' } } }).mockResolvedValueOnce({ data: { secret: { ...RING, state: 'hinted', where: 'Episode 3' } } });
    renderIt();
    const card = await screen.findByTestId('il-secret-s1');
    expect(within(card).queryByLabelText('Where')).toBeNull();
    fireEvent.change(within(card).getByLabelText('The audience'), { target: { value: 'hinted' } });
    const where = await within(card).findByLabelText('Where');
    fireEvent.change(where, { target: { value: 'Episode 3' } });
    fireEvent.blur(where);
    await waitFor(() => expect(api.put).toHaveBeenLastCalledWith(`${BASE}/s1`, { where: 'Episode 3' }));
  });

  test('keep a suggestion, then retire a kept one', async () => {
    vi.mocked(api.put).mockResolvedValueOnce({ data: { secret: { ...CAND, status: 'confirmed' } } });
    renderIt();
    const cand = within(await screen.findByTestId('il-secret-candidates'));
    fireEvent.click(cand.getByRole('button', { name: 'Keep' }));
    await waitFor(() => expect(screen.queryByTestId('il-secret-candidates')).toBeNull());
    expect(api.put).toHaveBeenCalledWith(`${BASE}/s2`, { status: 'confirmed' });
    expect(within(screen.getByTestId('il-secret-s2')).getByLabelText('Episode')).toBeTruthy();

    vi.mocked(api.put).mockResolvedValueOnce({ data: { success: true } });
    fireEvent.click(within(screen.getByTestId('il-secret-s1')).getByRole('button', { name: 'Retire' }));
    await waitFor(() => expect(screen.queryByTestId('il-secret-s1')).toBeNull());
    expect(api.put).toHaveBeenLastCalledWith(`${BASE}/s1`, { status: 'retired' });
  });

  test('discard a suggestion', async () => {
    vi.mocked(api.delete).mockResolvedValueOnce({ data: { success: true } });
    renderIt();
    fireEvent.click(within(await screen.findByTestId('il-secret-candidates')).getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(screen.queryByTestId('il-secret-s2')).toBeNull());
    expect(api.delete).toHaveBeenCalledWith(`${BASE}/s2`);
  });

  test('add one, and suggest more', async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce({ data: { secret: { ...RING, id: 's3', text: 'She lies about her age' } } })
      .mockResolvedValueOnce({ data: { added: [{ ...CAND, id: 's4', text: 'She rehearses apologies' }] } });
    renderIt();
    fireEvent.change(await screen.findByLabelText('Add a secret'), { target: { value: 'She lies about her age' } });
    fireEvent.click(screen.getByRole('button', { name: /Add$/ }));
    expect(await screen.findByTestId('il-secret-s3')).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith(BASE, { text: 'She lies about her age' });
    fireEvent.click(screen.getByRole('button', { name: /Suggest secrets/ }));
    expect(await screen.findByText('1 suggested below. Keep the ones that are true.')).toBeTruthy();
    expect(api.post).toHaveBeenLastCalledWith(`${BASE}/suggest`);
    expect(screen.getByText('She rehearses apologies')).toBeTruthy();
  });

  test('a failed save says so', async () => {
    vi.mocked(api.put).mockRejectedValueOnce({ response: { data: { error: 'Each layer is hidden, hint or reveal.' } } });
    renderIt();
    const card = await screen.findByTestId('il-secret-s1');
    fireEvent.change(within(card).getByLabelText('Episode'), { target: { value: 'hidden' } });
    expect(await screen.findByText('Each layer is hidden, hint or reveal.')).toBeTruthy();
  });

  test('someone else reads the kept ones, with no controls and no suggestions', async () => {
    renderIt(false);
    const card = await screen.findByTestId('il-secret-s1');
    expect(within(card).queryByRole('combobox')).toBeNull();
    expect(within(card).getByText(/Not hinted yet · No one else knows/)).toBeTruthy();
    expect(screen.queryByTestId('il-secret-candidates')).toBeNull();
    expect(screen.queryByLabelText('Add a secret')).toBeNull();
  });

  test('a section of the Inner life, before Where it goes', async () => {
    render(
      <AuthContext.Provider value={{ user: { groups: ['admin'] } }}>
        <InnerLifeWorkspace character={{ id: 'c1', status: 'accepted' }} gen={{ busy: null, note: null, review: null, locked: false, preview: vi.fn() }} onSaved={vi.fn()} />
      </AuthContext.Provider>,
    );
    const pills = within(screen.getByRole('navigation', { name: 'Inner life sections' })).getAllByRole('button').map((b) => b.textContent);
    expect(pills.indexOf('Secrets')).toBe(pills.indexOf('Where it goes') - 1);
    fireEvent.click(screen.getByRole('button', { name: 'Secrets' }));
    expect(await screen.findByRole('heading', { name: 'Secrets' })).toBeTruthy();
    expect(await screen.findByTestId('il-secret-s1')).toBeTruthy();
  });
});
