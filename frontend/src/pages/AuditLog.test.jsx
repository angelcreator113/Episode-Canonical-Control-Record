/**
 * The Audit Log page (/admin/audit) with real entries (issue #1948; Evoni,
 * 2026-11-11: "Confirm the audit page remains compatible with the new
 * entries"). Until the repair the table was always empty, so the page had
 * never rendered a row.
 *
 * The entries below are in the exact shape GET /api/v1/audit-logs returns:
 * the table's own names (action, createdAt, changes) beside the two names
 * this page reads (actionType, timestamp).
 */
import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AuditLogPage from './AuditLog';
import apiClient from '../services/api';

// One auth object for every render: the page's effect depends on `user`.
vi.mock('../contexts/AuthContext', () => {
  const auth = { isAuthenticated: true, loading: false, user: { id: 'admin-1', groups: ['admin'] } };
  return { useAuth: () => auth };
});
vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('../components/LoadingSpinner', () => ({ default: () => <div data-testid="loading" /> }));

// The page links back to Admin, so it renders inside a router.
const AuditLog = () => <MemoryRouter><AuditLogPage /></MemoryRouter>;

const EPISODE = '0b0f6a1e-6f0e-4f0e-9d53-3d5f3b9d7c11';
const FILE = '5d1c2a44-0c0a-4a5e-8a53-0e0a4f3f9b21';
const entry = (over) => ({
  id: 1, userId: 'user-1', action: 'edit', resourceType: 'episode', resourceId: EPISODE,
  changes: { before: { title: 'Before' }, after: { title: 'After' }, meta: { changedFields: ['title'] } },
  createdAt: '2026-11-11T21:00:00.000Z', actionType: 'edit', timestamp: '2026-11-11T21:00:00.000Z', ...over,
});
const ENTRIES = [
  entry(),
  // A script edit: the changed field carries a length and a digest, not the text.
  entry({ id: 2, changes: { before: { script_content: { long_text: true, length: 9000, sha256: 'a'.repeat(64) } }, after: { script_content: { long_text: true, length: 9100, sha256: 'b'.repeat(64) } }, meta: { changedFields: ['script_content'] } } }),
  entry({ id: 3, action: 'download', actionType: 'download', resourceType: 'file', resourceId: FILE, changes: { meta: { fileName: 'cut.mp4' } } }),
  // Nobody signed in, no resource id, nothing recorded.
  entry({ id: 4, userId: null, action: 'delete', actionType: 'delete', resourceType: 'metadata', resourceId: null, changes: null }),
];

beforeEach(() => {
  vi.clearAllMocks();
  apiClient.get.mockResolvedValue({ data: { status: 'SUCCESS', data: ENTRIES, pagination: { total: 4, limit: 50, offset: 0, pages: 1 } } });
});

describe('the Audit Log page with real entries', () => {
  test('renders every entry: time, user, action, resource and id', async () => {
    const { container } = render(<AuditLog />);
    await waitFor(() => expect(container.querySelectorAll('tbody tr')).toHaveLength(4));
    expect(screen.queryByTestId('audit-error')).toBeNull();

    const rows = [...container.querySelectorAll('tbody tr')];
    expect(rows[0].querySelector('.action').textContent.trim()).toBe('EDIT');
    expect(rows[0].querySelector('.resource').textContent).toBe('episode');
    expect(rows[0].querySelector('.details').textContent.trim()).toBe(EPISODE);
    expect(rows[0].querySelector('.userId').textContent).toBe('user-1');
    expect(rows[0].querySelector('.timestamp').textContent).toBe(new Date('2026-11-11T21:00:00.000Z').toLocaleString());
    expect(rows[2].querySelector('.action').textContent.trim()).toBe('DOWNLOAD');
    expect(rows[2].className).toContain('log-download');
    // No user and no resource id do not break the row.
    expect(rows[3].querySelector('.userId').textContent).toBe('system');
    expect(rows[3].querySelector('.action').textContent.trim()).toBe('DELETE');
    expect(rows[3].querySelector('.details').textContent.trim()).toBe('');
  });

  test('asks the route for what it filters by, with the names the route reads', async () => {
    const { container } = render(<AuditLog />);
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(1));
    expect(apiClient.get.mock.calls[0][0]).toMatch(/^\/api\/v1\/audit-logs\?limit=50&offset=0$/);

    fireEvent.change(container.querySelector('select[name="action"]'), { target: { name: 'action', value: 'download' } });
    fireEvent.change(container.querySelector('select[name="resource"]'), { target: { name: 'resource', value: 'episode' } });
    fireEvent.click(screen.getByText(/apply/i));
    await waitFor(() => expect(apiClient.get.mock.calls.length).toBeGreaterThan(1));
    const last = apiClient.get.mock.calls.at(-1)[0];
    expect(last).toContain('action=download');
    expect(last).toContain('resource=episode');
  });

  test('no entries shows no rows and no error', async () => {
    apiClient.get.mockResolvedValue({ data: { status: 'SUCCESS', data: [], pagination: { total: 0, limit: 50, offset: 0, pages: 0 } } });
    const { container } = render(<AuditLog />);
    await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId('loading')).toBeNull());
    expect(container.querySelectorAll('tbody tr')).toHaveLength(0);
    expect(screen.queryByTestId('audit-error')).toBeNull();
  });

  const page = (offset, total = 120) => ({ data: { status: 'SUCCESS', data: [entry({ id: offset + 1 })], pagination: { total, limit: 50, offset, pages: Math.ceil(total / 50) } } });
  const offsets = () => apiClient.get.mock.calls.map((c) => new URLSearchParams(c[0].split('?')[1]).get('offset'));

  test('Next and Previous load the page they name, at once (they used to load the page before)', async () => {
    apiClient.get.mockImplementation(async (url) => page(Number(new URLSearchParams(url.split('?')[1]).get('offset'))));
    render(<AuditLog />);
    await screen.findByText('1 / 3');
    fireEvent.click(screen.getByText('Next →'));
    await screen.findByText('2 / 3');
    fireEvent.click(screen.getByText('Next →'));
    await screen.findByText('3 / 3');
    expect(screen.getByText('Next →').disabled).toBe(true);
    fireEvent.click(screen.getByText('← Previous'));
    await screen.findByText('2 / 3');
    expect(offsets()).toEqual(['0', '50', '100', '50']);
  });

  test('paging keeps the applied filters; Clear empties them and reloads the first page', async () => {
    apiClient.get.mockImplementation(async (url) => page(Number(new URLSearchParams(url.split('?')[1]).get('offset'))));
    const { container } = render(<AuditLog />);
    await screen.findByText('1 / 3');
    fireEvent.change(container.querySelector('select[name="action"]'), { target: { name: 'action', value: 'delete' } });
    fireEvent.click(screen.getByText(/apply/i));
    await waitFor(() => expect(apiClient.get.mock.calls.at(-1)[0]).toContain('action=delete'));
    await screen.findByText('1 / 3');
    fireEvent.click(screen.getByText('Next →'));
    await screen.findByText('2 / 3');
    expect(apiClient.get.mock.calls.at(-1)[0]).toMatch(/offset=50&action=delete$/);
    fireEvent.click(screen.getByText('Clear'));
    await screen.findByText('1 / 3');
    expect(apiClient.get.mock.calls.at(-1)[0]).toMatch(/^\/api\/v1\/audit-logs\?limit=50&offset=0$/);
    expect(container.querySelector('select[name="action"]').value).toBe('');
  });

  test('the filter options are what is written: no View, no asset, template or thumbnail', () => {
    const { container } = render(<AuditLog />);
    const values = (name) => [...container.querySelectorAll(`select[name="${name}"] option`)].map((o) => o.value);
    expect(values('action')).toEqual(['', 'create', 'edit', 'delete', 'download', 'retry', 'cancel', 'detach_secondary_event']);
    expect(values('resource')).toEqual(['', 'episode', 'file', 'metadata', 'processing', 'job', 'world_event']);
  });

  test('a failed load says so with the status, keeps the filters, and Retry asks again for the same thing', async () => {
    apiClient.get.mockRejectedValueOnce(Object.assign(new Error('boom'), { response: { status: 500, data: { error: 'Failed to fetch audit logs' } } }));
    const { container } = render(<AuditLog />);
    const error = await screen.findByTestId('audit-error');
    expect(error.textContent).toContain('Failed to fetch audit logs (the server answered 500).');
    // Not shown as an empty log, and the filters are still there.
    expect(screen.queryByText(/No audit logs found/)).toBeNull();
    expect(container.querySelector('select[name="action"]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(container.querySelectorAll('tbody tr')).toHaveLength(4));
    expect(screen.queryByTestId('audit-error')).toBeNull();
    expect(offsets()).toEqual(['0', '0']);
  });
});
