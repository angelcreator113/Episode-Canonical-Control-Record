/**
 * Brain Update cards reach the generators card by card (Evoni's ruling,
 * 2026-10-08; wiring map fix-list item 24): a card marked "In every prompt"
 * in the Show Bible goes to every generator, and Brain Update keeps the
 * mark when it updates the card (services/brainSyncService.js).
 *
 * A synced card's words belong to its page, and the route refuses them
 * (409, "Managed by …"). The edit form sent the whole entry, so a synced
 * card could not be marked at all. Now it shows the page's words read-only
 * and sends only what the Show Bible owns: the mark, the scope, the show.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import api from '../services/api';
import ShowBiblePage from './ShowBiblePage';

const ENTRIES = [
  { id: 7, status: 'active', severity: 'important', category: 'franchise_law', always_inject: false, scope: 'franchise', show_id: null,
    title: 'The Connector — Social Archetype', content: 'The Connector (Social Archetype)\nContent: Collaborations', source_document: 'influencer-systems-v1.0',
    source_key: 'social_systems:archetype:the-connector', extracted_by: 'system' },
  { id: 8, status: 'active', severity: 'critical', category: 'franchise_law', always_inject: true, scope: 'franchise', show_id: null,
    title: 'Prime Coins are the only currency', content: 'Prime Coins only.', source_document: null },
];

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(api.get).mockImplementation(async (url) => (
    url.includes('/entries') ? { data: { entries: ENTRIES, count: ENTRIES.length } } : { data: { documents: [], count: 0 } }
  ));
  vi.mocked(api.patch).mockResolvedValue({ data: { message: 'Entry updated' } });
});

const openEntry = async (title) => {
  render(<MemoryRouter initialEntries={['/universe?tab=bible&sub=knowledge']}><ShowBiblePage embedded /></MemoryRouter>);
  fireEvent.click((await screen.findByTestId('bible-category-count-franchise_law')).closest('button'));
  // The front page's "Always true" lists the same rule; take the Knowledge list's row.
  const head = screen.getAllByText(title).map((el) => el.closest('button')).find((b) => b?.classList.contains('sbp-entry-head'));
  fireEvent.click(head);
  fireEvent.click(within(head.closest('li')).getByRole('button', { name: 'Edit' }));
  return screen.getByRole('dialog');
};

describe('Show Bible: marking a synced card (fix-list item 24)', () => {
  test("a synced card's words are its page's, read-only; Save sends only the mark, the scope and the show", async () => {
    const dialog = await openEntry('The Connector — Social Archetype');
    // Named as the card's source chip names its page.
    expect(within(dialog).getByTestId('sbp-managed-note').textContent).toContain('come from the Social Systems page');
    expect(within(dialog).getByDisplayValue('The Connector — Social Archetype').readOnly).toBe(true);
    expect(within(dialog).getByText(/Collaborations/, { selector: 'textarea' }).readOnly).toBe(true);
    for (const select of within(dialog).getAllByRole('combobox').filter((el) => el.getAttribute('aria-label') !== 'Scope')) {
      expect(select.disabled).toBe(true);
    }
    fireEvent.click(within(dialog).getByRole('checkbox'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalled());
    expect(api.patch).toHaveBeenCalledWith('/api/v1/franchise-brain/entries/7', { always_inject: true, scope: 'franchise', show_id: null });
  });

  test('an entry written here still edits in full', async () => {
    const dialog = await openEntry('Prime Coins are the only currency');
    expect(within(dialog).queryByTestId('sbp-managed-note')).toBeNull();
    const title = within(dialog).getByDisplayValue('Prime Coins are the only currency');
    expect(title.readOnly).toBe(false);
    fireEvent.change(title, { target: { value: 'Prime Coins are the only money' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalled());
    const [url, body] = vi.mocked(api.patch).mock.calls[0];
    expect(url).toBe('/api/v1/franchise-brain/entries/8');
    expect(body).toMatchObject({ title: 'Prime Coins are the only money', content: 'Prime Coins only.', severity: 'critical', always_inject: true, scope: 'franchise' });
  });
});
