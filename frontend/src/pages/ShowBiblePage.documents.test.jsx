/**
 * The Show Bible's Documents tab speaks the ingest route's contract
 * (2026-10-04): it sends document_text and source_name (it sent text and
 * source, which the route refused with 400 every time), reads
 * entries_created, opens the Decisions review queue on Pending once entries
 * are in, lists stored documents by source_name and entries_created, and
 * shows the route's own error when it refuses.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../services/api';
import ShowBiblePage from './ShowBiblePage';

const DOCS = [{ id: 'd1', source_name: 'Show bible v3', entries_created: 12, created_at: '2026-10-01T00:00:00Z' }];
const renderAt = (url) => render(<MemoryRouter initialEntries={[url]}><ShowBiblePage embedded /></MemoryRouter>);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockImplementation(async (url) => (
    url.includes('/documents') ? { data: { documents: DOCS, count: 1 } } : { data: { data: [] } }
  ));
});

describe('Show Bible: the Documents contract', () => {
  test('lists stored documents by source_name and entries_created', async () => {
    renderAt('/universe?tab=bible&sub=documents');
    expect(await screen.findByText('Show bible v3')).toBeTruthy();
    expect(screen.getByText(/12 entries extracted/)).toBeTruthy();
  });

  test('Extract Knowledge sends document_text and source_name, then opens the review queue', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { entries_created: 3, entries: [], message: 'Extracted 3 entries — all pending review' } });
    renderAt('/universe?tab=bible&sub=documents');
    await screen.findByText('Show bible v3');
    fireEvent.change(screen.getByLabelText('Source name'), { target: { value: 'Lala character bio' } });
    fireEvent.change(screen.getByLabelText('Document text'), { target: { value: 'Lala never apologises in public.' } });
    fireEvent.click(screen.getByRole('button', { name: /Extract Knowledge/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/franchise-brain/ingest-document', { document_text: 'Lala never apologises in public.', source_name: 'Lala character bio' }));
    expect(await screen.findByText('Extracted 3 entries, now pending review')).toBeTruthy();
    // The review queue: Decisions, on Pending.
    await waitFor(() => expect(screen.getByRole('button', { name: /^⚖️ Decisions/ }).style.fontWeight).toBe('700'));
    expect(screen.getByRole('button', { name: /^Pending \(/ }).style.fontWeight).toBe('600');
    expect(screen.getByRole('button', { name: /^Pending \(/ }).style.color).not.toBe('rgb(148, 163, 184)');
  });

  test('a source name is never empty on the wire', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { entries_created: 0, entries: [] } });
    renderAt('/universe?tab=bible&sub=documents');
    await screen.findByText('Show bible v3');
    fireEvent.change(screen.getByLabelText('Document text'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /Extract Knowledge/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/franchise-brain/ingest-document', { document_text: 'x', source_name: 'Pasted document' }));
    expect(await screen.findByText('No entries could be extracted from that text')).toBeTruthy();
  });

  test("the route's refusal is shown as itself, not as a generic failure", async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { status: 400, data: { error: 'document_text is required' } } });
    renderAt('/universe?tab=bible&sub=documents');
    await screen.findByText('Show bible v3');
    fireEvent.change(screen.getByLabelText('Document text'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /Extract Knowledge/ }));
    expect(await screen.findByText('document_text is required')).toBeTruthy();
  });
});
