/**
 * EventDocuments — the Event Package's shopping list and career plan beside
 * the invitation (Evoni, 2026-10-06): Draft, Edit, Redraft, Approve, in the
 * mock's two looks.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
import api from '../../services/api';
import EventDocuments from './EventDocuments';

const SHOP = {
  type: 'shopping_list', status: 'draft', version: 1, source: 'draft', history: [],
  items: [
    { slot: 'dress', label: 'Find a statement piece' },
    { slot: 'jewelry', label: 'Find earrings' },
    { slot: 'purse', label: 'Find a bag' },
  ],
};
const PLAN = {
  type: 'career_plan', status: 'draft', version: 1, source: 'draft', history: [],
  items: [
    { slot: 'net_1', label: 'Follow up with STUDIO BY SABLE', section: 'this_event' },
    { slot: 'goal_1', label: 'Land a brand partnership', section: 'bigger_goals' },
  ],
};
const EVENT = { id: 'ev-1', name: 'Studio Session', host_brand: 'Studio by Sable', event_date: '2026-11-12', dress_code: 'Smart-casual' };
const PIECES = [
  { name: 'Sculpted Dress', category: 'dress', coin_cost: 420, is_owned: false },
  { name: 'Gold Drops', category: 'earrings', coin_cost: 90, is_owned: true },
];
const BASE = '/api/v1/world/show-1/events/ev-1/documents';

const renderDocs = () => render(
  <EventDocuments showId="show-1" eventId="ev-1" event={EVENT} outfitPieces={PIECES} balance={1900} />,
);

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: { success: true, data: { shopping_list: null, career_plan: null } } });
});

describe('EventDocuments', () => {
  test('nothing drafted: both cards say so and offer Draft', async () => {
    renderDocs();
    const shop = await screen.findByTestId('evd-shopping_list');
    expect(within(shop).getByText(/Not drafted yet/)).toBeTruthy();
    expect(screen.getByTestId('evd-state-shopping_list').textContent).toBe('Not drafted');
    expect(screen.getByTestId('evd-state-career_plan').textContent).toBe('Not drafted');
    expect(within(shop).getByRole('button', { name: /Draft/ })).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith(BASE);
  });

  test('Draft writes the shopping list: each line its piece, owned ticked, the total against her coins', async () => {
    api.post.mockResolvedValue({ data: { success: true, data: SHOP } });
    renderDocs();
    const shop = await screen.findByTestId('evd-shopping_list');
    fireEvent.click(within(shop).getByRole('button', { name: /Draft/ }));
    const paper = await screen.findByTestId('evd-shopping-paper');
    expect(api.post).toHaveBeenCalledWith(`${BASE}/shopping_list/draft`);
    expect(within(paper).getByText("Lala's shopping list")).toBeTruthy();
    expect(within(paper).getByText('for Studio by Sable · Nov 12')).toBeTruthy();
    expect(screen.getByTestId('evd-line-dress').textContent).toContain('· 🪙 420');
    expect(screen.getByTestId('evd-line-jewelry').className).toBe('is-owned');
    expect(screen.getByTestId('evd-line-jewelry').textContent).toContain('· owned');
    expect(screen.getByTestId('evd-line-purse').textContent).not.toContain('🪙');
    expect(screen.getByTestId('evd-shopping-total').textContent).toBe('Total 🪙 420 / 1,900 coins');
    expect(screen.getByTestId('evd-state-shopping_list').textContent).toBe('Draft');
    expect(within(shop).getByRole('button', { name: /Redraft/ })).toBeTruthy();
  });

  test('the career plan shows This event and Bigger goals', async () => {
    api.get.mockResolvedValue({ data: { success: true, data: { shopping_list: null, career_plan: PLAN } } });
    renderDocs();
    const card = await screen.findByTestId('evd-career-card');
    expect(within(card).getByText('Follow up with STUDIO BY SABLE')).toBeTruthy();
    expect(within(card).getByText('Land a brand partnership')).toBeTruthy();
    expect(within(card).getByText('one step at a time, L.')).toBeTruthy();
  });

  test('Edit saves her lines through PUT; Approve approves; Redraft writes a new draft', async () => {
    api.get.mockResolvedValue({ data: { success: true, data: { shopping_list: SHOP, career_plan: null } } });
    api.put.mockResolvedValue({ data: { success: true, data: { ...SHOP, version: 2, source: 'edited', items: [{ slot: 'shoes', label: 'Gold heels' }], history: [SHOP] } } });
    renderDocs();
    const shop = await screen.findByTestId('evd-shopping_list');
    fireEvent.click(within(shop).getByRole('button', { name: /Edit/ }));
    const editor = screen.getByTestId('evd-editor-shopping_list');
    fireEvent.change(within(editor).getByLabelText('Line 1'), { target: { value: 'Gold heels' } });
    fireEvent.click(within(editor).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByTestId('evd-meta-shopping_list').textContent).toBe('Version 2 · edited · 1 earlier kept'));
    expect(api.put).toHaveBeenCalledWith(`${BASE}/shopping_list`, { items: expect.arrayContaining([expect.objectContaining({ label: 'Gold heels' })]) });

    api.post.mockResolvedValueOnce({ data: { success: true, data: { ...SHOP, version: 2, status: 'approved' } } });
    fireEvent.click(within(shop).getByRole('button', { name: /Approve/ }));
    await waitFor(() => expect(screen.getByTestId('evd-state-shopping_list').textContent).toBe('Approved'));
    expect(api.post).toHaveBeenCalledWith(`${BASE}/shopping_list/approve`);
    expect(within(shop).queryByRole('button', { name: /Approve/ })).toBeNull();

    api.post.mockResolvedValueOnce({ data: { success: true, data: { ...SHOP, version: 3 } } });
    fireEvent.click(within(shop).getByRole('button', { name: /Redraft/ }));
    await waitFor(() => expect(screen.getByTestId('evd-state-shopping_list').textContent).toBe('Draft'));
    expect(api.post).toHaveBeenLastCalledWith(`${BASE}/shopping_list/draft`);
  });

  test('a failed step says why', async () => {
    api.post.mockRejectedValue({ response: { data: { error: 'Budget reached' } } });
    renderDocs();
    const plan = await screen.findByTestId('evd-career_plan');
    fireEvent.click(within(plan).getByRole('button', { name: /Draft/ }));
    expect((await screen.findByRole('alert')).textContent).toBe('Budget reached');
  });

  test('colours only through tokens', () => {
    const css = readFileSync(resolve(__dirname, 'EventDocuments.css'), 'utf8');
    const jsx = readFileSync(resolve(__dirname, 'EventDocuments.jsx'), 'utf8');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(jsx).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
