/**
 * Admin › Overview (Evoni, 2026-11-13): real status, and a failure told
 * apart from zero. "0" means the server answered and there is nothing; a
 * read that failed says "Could not be loaded" with what the server said.
 */
import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('../../lib/pulseSummary', () => ({ loadPulseSummary: vi.fn() }));
vi.mock('./AdminShowGate', () => ({ default: ({ children }) => children('show-1') }));

import apiClient from '../../services/api';
import { loadPulseSummary } from '../../lib/pulseSummary';
import AdminOverview from './AdminOverview';

const refused = (status) => Object.assign(new Error('refused'), { response: { status } });
const summary = (over = {}) => ({ reviewCount: 0, stats: { scheduled: 0, today: 0 }, failed: [], ...over });
const renderOverview = () => render(<MemoryRouter><AdminOverview /></MemoryRouter>);
const text = (id) => screen.getByTestId(id).textContent;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  apiClient.get.mockImplementation(async (url) => (url.includes('audit-logs')
    ? { data: { pagination: { total: 0 } } }
    : { data: { refusals: [] } }));
  loadPulseSummary.mockResolvedValue(summary());
});

describe('Admin overview', () => {
  test('everything answered and nothing is waiting: zeros, said as answers', async () => {
    renderOverview();
    await waitFor(() => expect(text('adm-ov-review')).toContain('0 Nothing waiting'));
    expect(text('adm-ov-scheduled')).toContain('0');
    expect(text('adm-ov-audit')).toContain('0 entries recorded');
    expect(text('adm-ov-refusals')).toContain('0 since the server last started');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('real numbers, with links to where each is handled', async () => {
    loadPulseSummary.mockResolvedValue(summary({ reviewCount: 7, stats: { scheduled: 3, today: 2 } }));
    apiClient.get.mockImplementation(async (url) => (url.includes('audit-logs') ? { data: { pagination: { total: 41 } } } : { data: { refusals: [{}, {}] } }));
    renderOverview();
    await waitFor(() => expect(text('adm-ov-review')).toContain('7 waiting for you'));
    expect(text('adm-ov-scheduled')).toContain('3 2 today');
    expect(text('adm-ov-audit')).toContain('41 entries recorded');
    expect(text('adm-ov-refusals')).toContain('2 since the server last started');
    expect(screen.getByText('Open the Audit Log').getAttribute('href')).toBe('/admin/audit');
    expect(screen.getByText('Open Review').getAttribute('href')).toBe('/admin?tab=pulse&sub=review');
  });

  test('a failed audit log read is a failure with its status, not a zero; Refresh asks again', async () => {
    apiClient.get.mockImplementation(async (url) => { if (url.includes('audit-logs')) throw refused(500); return { data: { refusals: [] } }; });
    renderOverview();
    await waitFor(() => expect(text('adm-ov-audit')).toContain('Could not be loaded (the server answered 500)'));
    expect(text('adm-ov-audit')).not.toContain('entries recorded');
    expect(text('adm-ov-refusals')).toContain('0 since the server last started');
    apiClient.get.mockImplementation(async (url) => (url.includes('audit-logs') ? { data: { pagination: { total: 5 } } } : { data: { refusals: [] } }));
    fireEvent.click(screen.getByTestId('adm-ov-refresh'));
    await waitFor(() => expect(text('adm-ov-audit')).toContain('5 entries recorded'));
  });

  test('Pulse reads that failed are named, and the count is not shown as a number', async () => {
    loadPulseSummary.mockResolvedValue(summary({ reviewCount: 0, failed: ['drafts', 'comments'] }));
    renderOverview();
    await waitFor(() => expect(text('adm-ov-review')).toContain('Could not be loaded (2 of 9 reads failed: drafts, comments)'));
    expect(text('adm-ov-review')).not.toContain('Nothing waiting');
    expect(text('adm-ov-scheduled')).toContain('Could not be loaded (the drafts could not be read)');
  });

  test('the whole Pulse summary failing is a failure on both rows', async () => {
    loadPulseSummary.mockRejectedValue(refused(503));
    renderOverview();
    await waitFor(() => expect(text('adm-ov-review')).toContain('Could not be loaded (the server answered 503)'));
    expect(text('adm-ov-scheduled')).toContain('Could not be loaded (the server answered 503)');
  });
});
