/**
 * #3714: the planner never offers a one-click re-make of a photo whose paid
 * outcome is unknown. An uncertain photo offers Acknowledge, Authorize one
 * new attempt (asks first) and Abandon; once authorized, "Make once more"
 * (asks first) sends the authorization id. A photo being made offers nothing.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() } }));

import api from '../../services/api';
import CameraRollPlanner, { pendingAuthorization, makeKeptSummary } from './CameraRollPlanner';

const base = { moment: 'Coffee on the step', purpose: 'private', taken_by: 'friend', shows_face: false, outfit: 'none', album: 'everyday', people: [] };
const later = () => new Date(Date.now() + 3600 * 1000).toISOString();
const renderIt = (moments) => render(<CameraRollPlanner characterId="c-1" name="Maren" target={6} moments={moments} photoCount={0} onChanged={vi.fn()} />);

describe('pendingAuthorization', () => {
  test('only an unused, unexpired authorization counts', () => {
    expect(pendingAuthorization({})).toBeNull();
    expect(pendingAuthorization({ make_resolution: { authorization: { id: 'x', used_at: null, expires_at: later() } } })).toMatchObject({ id: 'x' });
    expect(pendingAuthorization({ make_resolution: { authorization: { id: 'x', used_at: 'now', expires_at: later() } } })).toBeNull();
    expect(pendingAuthorization({ make_resolution: { authorization: { id: 'x', used_at: null, expires_at: new Date(Date.now() - 1000).toISOString() } } })).toBeNull();
  });
});

describe('makeKeptSummary', () => {
  test('tells made, failed before sending, needs a check and skipped apart', () => {
    expect(makeKeptSummary({ made: 1 })).toBe('1 photo made.');
    const all = makeKeptSummary({ made: 2, failed: 1, uncertain: 1, skipped: 1, already_making: 1, already_uncertain: 2, stopped_for_budget: true });
    expect(all).toMatch(/^2 photos made/);
    expect(all).toMatch(/1 failed before anything was sent/);
    expect(all).toMatch(/1 needs a check: may already be made and charged/);
    expect(all).toMatch(/1 skipped/);
    expect(all).toMatch(/1 already being made/);
    expect(all).toMatch(/2 already waiting for a check/);
    expect(all).toMatch(/stopped at the daily image budget/);
    expect(makeKeptSummary({ made: 0, uncertain: 2 })).toMatch(/2 need a check/);
  });
});

describe('CameraRollPlanner safety states', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset().mockResolvedValue({ data: { success: true, data: {} } });
  });

  test('an uncertain photo: Check, its reason, no Make/Try again/Edit/Drop; acknowledge and abandon post resolve', async () => {
    renderIt([{ ...base, id: 'u1', status: 'uncertain', error: 'A paid image request was sent and the make then failed.' }]);
    expect(screen.getByText('Check')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toMatch(/paid image request was sent/);
    expect(screen.queryByText(/Make this photo|Try again/)).toBeNull();
    expect(screen.queryByText('Edit')).toBeNull();
    fireEvent.click(screen.getByTestId('cr-acknowledge'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/camera-roll/moments/u1/resolve', { action: 'acknowledge' }));
    fireEvent.click(screen.getByTestId('cr-abandon'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/camera-roll/moments/u1/resolve', { action: 'abandon' }));
    expect(api.post.mock.calls.some((c) => /\/make$/.test(c[0]))).toBe(false);
  });

  test('authorize asks first, then posts resolve authorize; it never makes', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    renderIt([{ ...base, id: 'u2', status: 'uncertain', error: 'may be made' }]);
    confirm.mockReturnValueOnce(false);
    fireEvent.click(screen.getByTestId('cr-authorize'));
    expect(api.post).not.toHaveBeenCalled();
    confirm.mockReturnValueOnce(true);
    fireEvent.click(screen.getByTestId('cr-authorize'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/camera-roll/moments/u2/resolve', { action: 'authorize' }));
    expect(api.post.mock.calls.some((c) => /\/make$/.test(c[0]))).toBe(false);
    confirm.mockRestore();
  });

  test('with an authorization: Make once more asks first and sends its id', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderIt([{ ...base, id: 'u3', status: 'uncertain', error: 'may be made', make_resolution: { authorization: { id: 'auth-1', used_at: null, expires_at: later() } } }]);
    expect(screen.queryByTestId('cr-authorize')).toBeNull();
    fireEvent.click(screen.getByTestId('cr-make-authorized'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/camera-roll/moments/u3/make', { authorization_id: 'auth-1' }));
    expect(confirm).toHaveBeenCalled();
    confirm.mockRestore();
  });

  test('a photo being made offers no action', () => {
    renderIt([{ ...base, id: 'm1', status: 'making' }]);
    expect(screen.getByText('Being made')).toBeTruthy();
    expect(screen.getByTestId('cr-making')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Make|Try again|Drop|Edit|Keep/ })).toBeNull();
  });

  test('kept and failed photos still offer Make and Try again', () => {
    renderIt([{ ...base, id: 'k1', status: 'kept' }, { ...base, id: 'f1', status: 'failed', error: 'budget' }]);
    expect(screen.getByText(/Make this photo/)).toBeTruthy();
    expect(screen.getByText(/Try again/)).toBeTruthy();
  });
});
