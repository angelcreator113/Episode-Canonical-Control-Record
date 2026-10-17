/**
 * Where profiles break most (the spec's #4; Evoni, 2026-10-17): the flag
 * log across the cast, by check, field and character, on request.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }));

import api from '../../services/api';
import CastFlagLog from './CastFlagLog';

const row = (extra) => ({ total: 3, open: 1, resolved: 1, intentional: 1, ...extra });
const view = () => render(<MemoryRouter><CastFlagLog registryIds={['r1']} /></MemoryRouter>);

describe('CastFlagLog', () => {
  beforeEach(() => api.get.mockReset());

  test('shows the log by check, field and character', async () => {
    api.get.mockResolvedValue({ data: { success: true, totals: row(), by_check: [row({ check_key: 'followers' })], by_field: [row({ field: 'Description' })], by_character: [row({ id: 'm1', name: 'Maren' })] } });
    view();
    fireEvent.click(screen.getByText('Show the flag log'));
    expect((await screen.findByTestId('cast-log-summary')).textContent).toBe('3 findings logged: 1 open, 1 resolved, 1 intentional.');
    expect(api.get).toHaveBeenCalledWith('/api/v1/cast/flag-log?registry_id=r1');
    expect(screen.getByTestId('cast-log-checks').textContent).toContain('Follower count3 raised · 1 open · 1 resolved · 1 intentional');
    expect(screen.getByTestId('cast-log-fields').textContent).toContain('Description');
    expect(screen.getByRole('link', { name: 'Maren' }).getAttribute('href')).toBe('/character/m1');
  });

  test('an empty log says how it fills', async () => {
    api.get.mockResolvedValue({ data: { success: true, totals: { total: 0, open: 0, resolved: 0, intentional: 0 }, by_check: [], by_field: [], by_character: [] } });
    view();
    fireEvent.click(screen.getByText('Show the flag log'));
    expect((await screen.findByTestId('cast-log-summary')).textContent).toMatch(/^Nothing logged yet/);
    expect(screen.queryByTestId('cast-log-checks')).toBeNull();
  });
});
