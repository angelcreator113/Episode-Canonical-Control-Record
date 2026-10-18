/**
 * Settings (Evoni's mock, 2026-10-18, step 8 of the character page; "what
 * already works"): status, kept in the cast, feed profile, export and the
 * link, and the danger zone: archive, bring back, delete for good with the
 * name typed out.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../config/api', () => ({ API_URL: '/api/v1' }));

import api from '../services/api';
import CharacterProfilePage, { TabSettings } from './CharacterProfilePage';

const CHARACTER = { id: 'c1', display_name: 'Sable', status: 'accepted', cast_review: null, feed_profile_id: 7 };
const PROFILE = { id: 7, handle: 'studiobysable', display_name: 'STUDIO BY SABLE' };

const renderIt = (props = {}) => {
  const p = { character: CHARACTER, feedProfile: PROFILE, onSaved: vi.fn(), onExport: vi.fn(), onDeleted: vi.fn(), ...props };
  render(<MemoryRouter><TabSettings {...p} /></MemoryRouter>);
  return p;
};

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
});

describe('Settings', () => {
  test('status saves, finalized says it locks the page', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { character: { ...CHARACTER, status: 'finalized' } } });
    const p = renderIt();
    expect(screen.getByLabelText('Status').value).toBe('accepted');
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'finalized' } });
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/character-registry/characters/c1/set-status', { status: 'finalized' }));
    expect(p.onSaved).toHaveBeenCalledWith({ status: 'finalized' });
    expect((await screen.findByRole('status')).textContent).toBe('Status saved.');
  });

  test('kept in the cast toggles', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { cast_review: 'kept' } });
    const p = renderIt();
    const sw = screen.getByRole('switch', { name: 'Kept in the cast' });
    expect(sw.checked).toBe(false);
    fireEvent.click(sw);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/cast/characters/c1/keep', { kept: true }));
    expect(p.onSaved).toHaveBeenCalledWith({ cast_review: 'kept' });
  });

  test('feed profile, export and the link', () => {
    const p = renderIt();
    expect(screen.getByText('@studiobysable')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Match a different feed person/ }).getAttribute('href')).toBe('/character-registry');
    fireEvent.click(screen.getByRole('button', { name: /Export profile/ }));
    expect(p.onExport).toHaveBeenCalled();
    expect(screen.getByLabelText('Link to this page').value).toMatch(/\/character\/c1$/);
  });

  test('archive, then bring back', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
    vi.mocked(api.post).mockResolvedValue({ data: { restored: true } });
    renderIt();
    const danger = screen.getByTestId('ch-danger');
    expect(within(danger).queryByRole('button', { name: /Delete permanently/ })).toBeNull();
    fireEvent.click(within(danger).getByRole('button', { name: 'Archive Sable' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/v1/character-registry/characters/c1'));
    expect(screen.getByLabelText('Status').disabled).toBe(true);
    fireEvent.click(await within(danger).findByRole('button', { name: /Bring back/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/cast/characters/c1/restore'));
    expect(await within(danger).findByRole('button', { name: 'Archive Sable' })).toBeTruthy();
  });

  test('delete for good only with the name typed; a refusal says why', async () => {
    vi.mocked(api.delete)
      .mockResolvedValueOnce({ data: { success: true } })
      .mockRejectedValueOnce({ response: { status: 409, data: { error: 'Sable is used by 1 episode' } } })
      .mockResolvedValueOnce({ data: { deleted: true } });
    const p = renderIt();
    const danger = screen.getByTestId('ch-danger');
    fireEvent.click(within(danger).getByRole('button', { name: 'Archive Sable' }));
    fireEvent.click(await within(danger).findByRole('button', { name: /Delete permanently/ }));
    const go = within(danger).getByRole('button', { name: 'Delete for good' });
    expect(go.disabled).toBe(true);
    fireEvent.change(within(danger).getByLabelText(/to delete them for good/), { target: { value: 'sable' } });
    expect(go.disabled).toBe(true);
    fireEvent.change(within(danger).getByLabelText(/to delete them for good/), { target: { value: 'Sable' } });
    fireEvent.click(go);
    expect((await screen.findByRole('alert')).textContent).toBe('Sable is used by 1 episode');
    expect(p.onDeleted).not.toHaveBeenCalled();
    fireEvent.click(within(danger).getByRole('button', { name: 'Delete for good' }));
    await waitFor(() => expect(p.onDeleted).toHaveBeenCalled());
    expect(api.delete).toHaveBeenLastCalledWith('/api/v1/cast/characters/c1/permanent');
  });

  test('the tab opens from ?tab=settings', async () => {
    vi.mocked(api.get).mockImplementation(async (url) => (url === '/api/v1/character-registry/characters/c1' ? { data: { character: CHARACTER } } : { data: {} }));
    render(
      <MemoryRouter initialEntries={['/character/c1?tab=settings']}>
        <Routes><Route path="/character/:id" element={<CharacterProfilePage />} /></Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByTestId('ch-settings')).toBeTruthy();
  });
});
