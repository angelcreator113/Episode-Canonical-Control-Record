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
import { resetUndoStore } from './useUndo';

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
  resetUndoStore();
  window.sessionStorage.clear();
  api.get.mockResolvedValue({ data: { success: true, data: { shopping_list: null, career_plan: null } } });
});

describe('EventDocuments', () => {
  test('readOnly for one type: that document has no buttons, the other keeps its own', async () => {
    api.get.mockResolvedValue({ data: { success: true, data: { shopping_list: { ...SHOP, status: 'approved' }, career_plan: PLAN } } });
    render(<EventDocuments showId="show-1" eventId="ev-1" event={EVENT} readOnly={['shopping_list']} manageHref="/x" />);
    const shop = await screen.findByTestId('evd-shopping_list');
    expect(within(shop).queryAllByRole('button')).toHaveLength(0);
    expect(within(screen.getByTestId('evd-career_plan')).getByRole('button', { name: /Approve/ })).toBeTruthy();
  });

  // The episode's Wardrobe tab shows the shopping list on its own, read-only:
  // it is approved in the Event Package only (Evoni, 2026-10-11); no note is
  // written in for her (Task #2880).
  test('only="shopping_list" readOnly: the list alone, its state and where to change it, its own note or none', async () => {
    api.get.mockResolvedValue({ data: { success: true, data: { shopping_list: SHOP, career_plan: PLAN } } });
    const { unmount } = render(<EventDocuments showId="show-1" eventId="ev-1" event={EVENT} intro={false} only="shopping_list" readOnly manageHref="/shows/show-1/events/ev-1#epp-sec-documents" />);
    const shop = await screen.findByTestId('evd-shopping_list');
    expect(screen.queryByTestId('evd-career_plan')).toBeNull();
    expect(within(shop).queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByTestId('evd-state-shopping_list').textContent).toBe('Draft');
    expect(screen.getByTestId('evd-manage-shopping_list').getAttribute('href')).toBe('/shows/show-1/events/ev-1#epp-sec-documents');
    expect(screen.getByTestId('evd-manage-shopping_list').textContent).toContain('Change it in the Event Package');
    expect(screen.queryByTestId('evd-paper-note')).toBeNull();
    expect(screen.getByTestId('evd-shopping-paper').textContent).not.toMatch(/comfy enough/);
    unmount();
    api.get.mockResolvedValue({ data: { success: true, data: { shopping_list: { ...SHOP, note: ' Her own note. ' }, career_plan: null } } });
    render(<EventDocuments showId="show-1" eventId="ev-1" event={EVENT} intro={false} only="shopping_list" />);
    expect((await screen.findByTestId('evd-paper-note')).textContent).toBe('Her own note.');
  });

  test('nothing drafted: both cards say so and offer Draft', async () => {
    renderDocs();
    const shop = await screen.findByTestId('evd-shopping_list');
    // Not drafted: one line, no blank paper (Evoni's review, item 6).
    expect(shop.className).toContain('is-blank');
    expect(screen.getByTestId('evd-state-shopping_list').textContent).toBe('Not drafted');
    expect(screen.getByTestId('evd-state-career_plan').textContent).toBe('Not drafted');
    expect(within(shop).getByRole('button', { name: /Draft/ })).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith(BASE);
  });

  // A to-do list she crosses off in the show (Evoni, 2026-10-11): nothing is
  // ticked or struck because a piece is owned, and there is no balance.
  test('Draft writes the shopping list: each line its piece, nothing marked owned, the total without a balance', async () => {
    api.post.mockResolvedValue({ data: { success: true, data: SHOP } });
    renderDocs();
    const shop = await screen.findByTestId('evd-shopping_list');
    fireEvent.click(within(shop).getByRole('button', { name: /Draft/ }));
    const paper = await screen.findByTestId('evd-shopping-paper');
    expect(api.post).toHaveBeenCalledWith(`${BASE}/shopping_list/draft`, {});
    expect(within(paper).getByText("Lala's shopping list")).toBeTruthy();
    expect(within(paper).getByText('for Studio by Sable · Nov 12')).toBeTruthy();
    expect(screen.getByTestId('evd-line-dress').textContent).toContain('· 🪙 420');
    expect(screen.getByTestId('evd-line-jewelry').className).toBe('');
    expect(screen.getByTestId('evd-line-jewelry').textContent).toBe('Find earrings');
    expect(screen.getByTestId('evd-line-purse').textContent).not.toContain('🪙');
    for (const li of paper.querySelectorAll('li')) expect(li.querySelector('.evd-box').textContent).toBe('');
    expect(screen.getByTestId('evd-shopping-total').textContent).toBe('Total 🪙 420');
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

  test("the deal's deliverables come first, as Expected of her, required or optional, with who they are owed to", async () => {
    const deliverables = [
      { id: 'd-1', label: 'Wearable art reel', detail: '1 Instagram Reel · due 2026-11-14', required: true, owed_to: 'brand' },
      { id: 'd-2', label: 'Story shout-out', detail: '3 Instagram Stories', required: false, owed_to: 'host' },
    ];
    api.get.mockResolvedValue({ data: { success: true, data: { shopping_list: null, career_plan: PLAN, deliverables } } });
    renderDocs();
    const list = await screen.findByTestId('evd-career-deliverables');
    const reel = within(list).getByTestId('evd-deliverable-d-1');
    expect(reel.textContent).toContain('Wearable art reel');
    expect(reel.textContent).toContain('1 Instagram Reel · due 2026-11-14 · for the brand');
    expect(reel.textContent).toContain('Required');
    expect(within(list).getByTestId('evd-deliverable-d-2').textContent).toContain('3 Instagram Stories · for the host');
    expect(within(list).getByTestId('evd-deliverable-d-2').textContent).toContain('Optional');
    // Expected of her, then This event, then Bigger goals.
    const labels = [...screen.getByTestId('evd-career-card').querySelectorAll('.evd-career-label')].map((el) => el.textContent);
    expect(labels).toEqual(['Expected of her', 'This event', 'Bigger goals']);
  });

  test('with no deliverables in the deal, the section is left out', async () => {
    api.get.mockResolvedValue({ data: { success: true, data: { shopping_list: null, career_plan: PLAN, deliverables: [] } } });
    renderDocs();
    await screen.findByTestId('evd-career-card');
    expect(screen.queryByTestId('evd-career-deliverables')).toBeNull();
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
    expect(api.put).toHaveBeenCalledWith(`${BASE}/shopping_list`, { items: expect.arrayContaining([expect.objectContaining({ label: 'Gold heels' })]), note: '' });

    api.post.mockResolvedValueOnce({ data: { success: true, data: { ...SHOP, version: 2, status: 'approved' } } });
    fireEvent.click(within(shop).getByRole('button', { name: /Approve/ }));
    await waitFor(() => expect(screen.getByTestId('evd-state-shopping_list').textContent).toBe('Approved'));
    expect(api.post).toHaveBeenCalledWith(`${BASE}/shopping_list/approve`);
    expect(within(shop).queryByRole('button', { name: /Approve/ })).toBeNull();

    // Redraft over an approved, edited document is done at once, with Undo.
    const confirmSpy = vi.spyOn(window, 'confirm');
    api.post.mockResolvedValueOnce({ data: { success: true, data: { ...SHOP, version: 3 } } });
    fireEvent.click(within(shop).getByRole('button', { name: /Redraft/ }));
    await waitFor(() => expect(screen.getByTestId('evd-state-shopping_list').textContent).toBe('Draft'));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(api.post).toHaveBeenLastCalledWith(`${BASE}/shopping_list/draft`, {});
    expect(within(shop).getByTestId('evd-undo-shopping_list').textContent).toContain('Redrafted the shopping list');
    confirmSpy.mockRestore();
  });

  test('Undo after a Redraft restores the replaced version from history and approves it again when it was approved', async () => {
    const APPROVED = { ...SHOP, version: 2, status: 'approved', source: 'edited', items: [{ slot: 'shoes', label: 'Gold heels' }] };
    api.get.mockResolvedValue({ data: { success: true, data: { shopping_list: APPROVED, career_plan: null } } });
    renderDocs();
    const shop = await screen.findByTestId('evd-shopping_list');
    api.post.mockResolvedValueOnce({ data: { success: true, data: { ...SHOP, version: 3 } } });
    fireEvent.click(within(shop).getByTestId('evd-redraft-shopping_list'));
    await waitFor(() => expect(screen.getByTestId('evd-state-shopping_list').textContent).toBe('Draft'));
    expect(within(shop).getByTestId('evd-undo-shopping_list-region').getAttribute('role')).toBe('status');

    api.post.mockResolvedValueOnce({ data: { success: true, data: { ...APPROVED, version: 4, status: 'draft', source: 'restored' } } });
    api.post.mockResolvedValueOnce({ data: { success: true, data: { ...APPROVED, version: 4, status: 'approved', source: 'restored' } } });
    fireEvent.click(within(shop).getByRole('button', { name: /Undo/ }));
    await waitFor(() => expect(screen.getByTestId('evd-state-shopping_list').textContent).toBe('Approved'));
    expect(api.post).toHaveBeenCalledWith(`${BASE}/shopping_list/restore`, { fromVersion: 2 });
    expect(api.post).toHaveBeenLastCalledWith(`${BASE}/shopping_list/approve`);
    expect(screen.getByTestId('evd-meta-shopping_list').textContent).toContain('Version 4');
    expect(within(shop).queryByTestId('evd-undo-shopping_list')).toBeNull();
  });

  test('a failed Undo says so in the notice and keeps Undo', async () => {
    api.get.mockResolvedValue({ data: { success: true, data: { shopping_list: SHOP, career_plan: null } } });
    renderDocs();
    const shop = await screen.findByTestId('evd-shopping_list');
    api.post.mockResolvedValueOnce({ data: { success: true, data: { ...SHOP, version: 2 } } });
    fireEvent.click(within(shop).getByTestId('evd-redraft-shopping_list'));
    await screen.findByTestId('evd-undo-shopping_list');
    api.post.mockRejectedValueOnce(Object.assign(new Error('x'), { response: { data: { error: 'Server down' } } }));
    fireEvent.click(within(shop).getByRole('button', { name: /Undo/ }));
    expect((await screen.findByTestId('evd-undo-shopping_list-error')).textContent).toContain('Server down');
    expect(within(shop).getByRole('button', { name: /Undo/ })).toBeTruthy();
  });

  test('Redraft: no confirm, untouched or edited; each card shows its own Undo; off while editing', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    api.get.mockResolvedValue({ data: { success: true, data: { shopping_list: SHOP, career_plan: { ...PLAN, source: 'edited' } } } });
    api.post.mockResolvedValue({ data: { success: true, data: { ...SHOP, version: 2 } } });
    renderDocs();
    const shop = await screen.findByTestId('evd-shopping_list');
    fireEvent.click(within(shop).getByTestId('evd-redraft-shopping_list'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`${BASE}/shopping_list/draft`, {}));

    api.post.mockClear();
    api.post.mockResolvedValue({ data: { success: true, data: { ...PLAN, version: 2 } } });
    const plan = screen.getByTestId('evd-career_plan');
    fireEvent.click(within(plan).getByTestId('evd-redraft-career_plan'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`${BASE}/career_plan/draft`, {}));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(within(plan).getByTestId('evd-undo-career_plan').textContent).toContain('Redrafted the career plan');
    expect(within(shop).queryByTestId('evd-undo-shopping_list')).toBeNull();

    fireEvent.click(within(plan).getByRole('button', { name: /Edit/ }));
    expect(within(plan).getByTestId('evd-redraft-career_plan').disabled).toBe(true);
    confirmSpy.mockRestore();
  });

  test('the documents are read again when the outfit\'s pieces change', async () => {
    api.get.mockResolvedValue({ data: { success: true, data: { shopping_list: SHOP, career_plan: null } } });
    const { rerender } = render(<EventDocuments showId="show-1" eventId="ev-1" event={EVENT} outfitPieces={[{ id: 'p1', name: 'A', category: 'dress' }]} />);
    await screen.findByTestId('evd-shopping_list');
    expect(api.get).toHaveBeenCalledTimes(1);
    rerender(<EventDocuments showId="show-1" eventId="ev-1" event={EVENT} outfitPieces={[{ id: 'p1', name: 'A', category: 'dress' }]} />);
    expect(api.get).toHaveBeenCalledTimes(1);
    rerender(<EventDocuments showId="show-1" eventId="ev-1" event={EVENT} outfitPieces={[{ id: 'p2', name: 'B', category: 'dress' }]} />);
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
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

  test('an approved document shows its overlay; one without gets Make overlay, which draws it', async () => {
    const overlay = { asset_id: 'a-1', url: 'https://cdn/shop.png', version: 1 };
    api.get.mockResolvedValue({ data: { success: true, data: {
      shopping_list: { ...SHOP, status: 'approved', overlay },
      career_plan: { ...PLAN, status: 'approved' },
    } } });
    renderDocs();
    const shopOverlay = await screen.findByTestId('evd-overlay-shopping_list');
    expect(shopOverlay.textContent).toContain('Overlay ready');
    expect(shopOverlay.querySelector('img').getAttribute('src')).toBe(overlay.url);
    expect(screen.queryByTestId('evd-make-overlay-shopping_list')).toBeNull();

    expect(screen.getByTestId('evd-overlay-career_plan').textContent).toContain('No overlay yet');
    api.post.mockResolvedValueOnce({ data: { success: true, data: { ...PLAN, status: 'approved', overlay: { asset_id: 'a-2', url: 'https://cdn/plan.png', version: 1 } } } });
    fireEvent.click(screen.getByTestId('evd-make-overlay-career_plan'));
    await waitFor(() => expect(screen.getByTestId('evd-overlay-career_plan').textContent).toContain('Overlay ready'));
    expect(api.post).toHaveBeenCalledWith(`${BASE}/career_plan/approve`);
  });

  test('a draft edited after its overlay was drawn says the overlay is out of date', async () => {
    api.get.mockResolvedValue({ data: { success: true, data: {
      shopping_list: { ...SHOP, version: 2, overlay: { asset_id: 'a-1', url: 'https://cdn/shop.png', version: 1 } },
      career_plan: null,
    } } });
    renderDocs();
    const row = await screen.findByTestId('evd-overlay-shopping_list');
    expect(row.className).toContain('is-outdated');
    expect(row.textContent).toContain('Overlay out of date until approved');
    expect(screen.queryByTestId('evd-make-overlay-shopping_list')).toBeNull();
  });

  test('with no pieces passed (the episode\'s Overlays tab), the list adds up the look the server reads (Task #2787)', async () => {
    const approved = { ...SHOP, status: 'approved', overlay: { url: 'https://x/list.png', version: 1, look_total: 420 } };
    api.get.mockResolvedValue({ data: { success: true, data: {
      shopping_list: approved, career_plan: null, balance: 1500,
      look: { state: 'locked', total: 570, pieces: [
        { name: 'Sculpted Dress', category: 'dress', coin_cost: 420, charge: { category: 'wardrobe_purchase', amount: 420 }, free_because: null },
        { name: 'Pearl Choker', category: 'jewelry', coin_cost: 150, charge: { category: 'wardrobe_purchase', amount: 150 }, free_because: null },
      ] },
    } } });
    render(<EventDocuments showId="show-1" eventId="ev-1" event={EVENT} />);
    // No balance on the list (Evoni, 2026-10-11), even when the server sends one.
    await waitFor(() => expect(screen.getByTestId('evd-shopping-total').textContent).toBe('Total 🪙 570'));
    // Drawn with 420, the look now costs 570: the image is out of date and can be redrawn.
    expect(screen.getByTestId('evd-overlay-shopping_list').textContent).toContain('Overlay out of date: the look changed');
    expect(screen.getByTestId('evd-make-overlay-shopping_list')).toBeTruthy();
  });
});

describe('EventDocuments: "Look changed — redraft the list?" (the server\'s answer, 2026-10-24)', () => {
  const withLook = (changed, list = SHOP) => ({ data: { success: true, data: { shopping_list: { ...list, look_key: 'p1' }, career_plan: null, look: { state: 'chosen', pieces: [], total: 0 }, look_changed: changed } } });

  test('no notice while the look is the one the list was drafted from', async () => {
    api.get.mockResolvedValue(withLook(false));
    renderDocs();
    await screen.findByTestId('evd-shopping_list');
    expect(screen.queryByTestId('evd-look-changed')).toBeNull();
  });

  test('the look changed: the notice, and Keep saves the current look as the list\'s own', async () => {
    api.get.mockResolvedValueOnce(withLook(true));
    renderDocs();
    const notice = await screen.findByTestId('evd-look-changed');
    expect(notice.textContent).toContain('Look changed — redraft the list?');
    expect(notice.getAttribute('role')).toBe('status');
    api.post.mockResolvedValueOnce({ data: { success: true, data: { ...SHOP, look_key: 'p2' } } });
    api.get.mockResolvedValue(withLook(false));
    fireEvent.click(screen.getByTestId('evd-look-changed-keep'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`${BASE}/shopping_list/keep-look`));
    await waitFor(() => expect(screen.queryByTestId('evd-look-changed')).toBeNull());
  });

  test('Redraft from the notice drafts the list again', async () => {
    api.get.mockResolvedValueOnce(withLook(true));
    renderDocs();
    await screen.findByTestId('evd-look-changed');
    api.post.mockResolvedValueOnce({ data: { success: true, data: { ...SHOP, version: 2 } } });
    api.get.mockResolvedValue(withLook(false));
    fireEvent.click(screen.getByTestId('evd-look-changed-redraft'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`${BASE}/shopping_list/draft`, {}));
    await waitFor(() => expect(screen.queryByTestId('evd-look-changed')).toBeNull());
  });

  test('read-only, no notice', async () => {
    api.get.mockResolvedValue(withLook(true));
    render(<EventDocuments showId="show-1" eventId="ev-1" event={EVENT} readOnly manageHref="/x" />);
    await screen.findByTestId('evd-shopping_list');
    expect(screen.queryByTestId('evd-look-changed')).toBeNull();
  });
});

describe('EventDocuments: the documents rework (2026-10-24)', () => {
  test('one line re-worded on its own', async () => {
    api.get.mockResolvedValue({ data: { success: true, data: { shopping_list: SHOP, career_plan: null } } });
    renderDocs();
    await screen.findByTestId('evd-shopping-paper');
    api.post.mockResolvedValueOnce({ data: { success: true, data: { ...SHOP, version: 2, source: 'line_redraft', items: [SHOP.items[0], { slot: 'jewelry', label: 'Gold that catches the light' }, SHOP.items[2]] } } });
    fireEvent.click(screen.getByRole('button', { name: 'New words for: Find earrings' }));
    await waitFor(() => expect(screen.getByTestId('evd-line-jewelry').textContent).toContain('Gold that catches the light'));
    expect(api.post).toHaveBeenCalledWith(`${BASE}/shopping_list/lines/1/redraft`, { version: 1 });
    expect(screen.getByTestId('evd-meta-shopping_list').textContent).toContain('one line re-worded');
  });

  test('History lists the kept versions; Restore brings one back', async () => {
    const OLD = { ...SHOP, version: 1, status: 'approved', items: [{ slot: 'dress', label: 'The old dress line' }] };
    api.get.mockResolvedValue({ data: { success: true, data: { shopping_list: { ...SHOP, version: 2, history: [OLD] }, career_plan: null } } });
    renderDocs();
    fireEvent.click(await screen.findByTestId('evd-history-toggle-shopping_list'));
    const history = screen.getByTestId('evd-history-shopping_list');
    expect(history.textContent).toContain('Version 1 · drafted · approved · 1 line');
    expect(history.textContent).toContain('The old dress line');
    api.post.mockResolvedValueOnce({ data: { success: true, data: { ...OLD, version: 3, status: 'draft', source: 'restored', history: [] } } });
    fireEvent.click(screen.getByTestId('evd-restore-shopping_list-1'));
    await waitFor(() => expect(screen.getByTestId('evd-meta-shopping_list').textContent).toContain('Version 3 · restored'));
    expect(api.post).toHaveBeenCalledWith(`${BASE}/shopping_list/restore`, { fromVersion: 1 });
  });

  test('short of coins: says so, and Redraft within budget', async () => {
    api.get.mockResolvedValue({ data: { success: true, data: {
      shopping_list: SHOP, career_plan: null, balance: 100,
      look: { state: 'event', total: 420, pieces: [{ name: 'Sculpted Dress', category: 'dress', coin_cost: 420, charge: { amount: 420 } }] },
    } } });
    renderDocs();
    const budget = await screen.findByTestId('evd-budget');
    expect(budget.textContent).toContain('🪙 320 short');
    api.post.mockResolvedValueOnce({ data: { success: true, data: { ...SHOP, version: 2 } } });
    fireEvent.click(screen.getByTestId('evd-budget-redraft'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`${BASE}/shopping_list/draft`, { budget: true }));
  });

  test('closet suggestions sit under the line they could fill', async () => {
    api.get.mockResolvedValue({ data: { success: true, data: { shopping_list: SHOP, career_plan: null, closet: { purse: [{ id: 'w1', name: 'Black box clutch' }] } } } });
    renderDocs();
    expect((await screen.findByTestId('evd-closet-purse')).textContent).toBe('In her closet: Black box clutch');
  });

  test('the amount check is shown on the version', async () => {
    api.get.mockResolvedValue({ data: { success: true, data: { shopping_list: { ...SHOP, checks: { amounts: { ok: false, invented: [999] } } }, career_plan: null } } });
    renderDocs();
    expect((await screen.findByTestId('evd-amounts-shopping_list')).textContent).toContain('Names 999 coins, which no piece of the look costs');
  });

  test('the career plan: optional ideas, goal links, and the lines over the goal limit', async () => {
    const plan = { ...PLAN, items: [
      { slot: 'a', label: 'Pitch the Sable team', section: 'this_event', task_source: 'goal', goal_id: 'g-1' },
      { slot: 'b', label: 'Snap the florals', section: 'this_event', task_source: 'optional' },
      { slot: 'goal_1', label: 'Land a brand partnership', section: 'bigger_goals', goal_id: 'g-1' },
    ] };
    api.get.mockResolvedValue({ data: { success: true, data: {
      shopping_list: null, career_plan: plan,
      career_goals: [{ id: 'g-1', title: 'Land a brand partnership' }],
      career_carry: { limit: 1, carried: 1, dropped: ['Snap the florals'] },
    } } });
    renderDocs();
    const line0 = await screen.findByTestId('evd-plan-line-0');
    expect(line0.textContent).toContain('for: Land a brand partnership');
    expect(screen.getByTestId('evd-plan-line-1').textContent).toContain('optional idea');
    expect(screen.getByTestId('evd-not-carried-1')).toBeTruthy();
    expect(screen.getByTestId('evd-carry-career_plan').textContent).toContain('carries 1 of her goals; 1 line won’t reach the episode'.replace('’', "'"));
    // A bigger goal has no re-roll of its own.
    expect(within(screen.getByTestId('evd-plan-line-2')).queryByRole('button')).toBeNull();

    // The editor marks, as she types, what will not carry.
    fireEvent.click(within(screen.getByTestId('evd-career_plan')).getByRole('button', { name: /Edit/ }));
    expect(screen.getByTestId('evd-editor-limit').textContent).toContain('1 line marked below won');
    expect(screen.getByTestId('evd-editor-career_plan').querySelectorAll('.is-left-out')).toHaveLength(1);
  });
});
