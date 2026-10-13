/**
 * Import orders (Task 3102): choose the CSV, the preview lists new lines
 * with their suggested piece and the ones already imported; Import sends the
 * ticked lines with their pieces; a kept line is put on a piece later; errors
 * say so in plain words; colours through tokens only.
 */
import React from 'react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import api from '../../services/api';
import OrderImportDialog from './OrderImportDialog';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

const PIECES = [{ id: 'w1', name: 'Pink Satin Slip Dress' }, { id: 'w2', name: 'Black Velvet Blazer' }];
const LINES = [
  { order_id: '111-1', asin: 'B0SATIN001', title: "Women's Pink Satin Slip Dress", order_date: '2026-09-14', price_paid: 48.99, quantity: 1, currency: 'USD', website: 'amazon.com', status: 'new', suggestion: { wardrobe_id: 'w1', name: 'Pink Satin Slip Dress', reason: 'name' } },
  { order_id: '111-2', asin: 'B0PHONECAS', title: 'Phone case, clear', order_date: '2026-09-21', price_paid: 12, quantity: 1, currency: 'USD', website: 'amazon.com', status: 'new', suggestion: null },
  { order_id: '111-0', asin: 'B0OLDORDER', title: 'Old scarf', order_date: '2026-08-01', price_paid: 9, quantity: 1, currency: 'USD', website: 'amazon.com', status: 'duplicate', suggestion: null },
];
let later;

beforeEach(() => {
  vi.clearAllMocks();
  later = [];
  vi.mocked(api.get).mockImplementation(async () => ({ data: { lines: later } }));
  vi.mocked(api.post).mockImplementation(async (url) => (url.endsWith('/preview')
    ? { data: { lines: LINES, cancelled: 1 } }
    : { data: { matched: 1, unmatched: 1, duplicates: 0, pieces: [{ id: 'w1', filled: ['real_price_paid'] }] } }));
});

const open = (props = {}) => render(<OrderImportDialog showId="s1" pieces={PIECES} onClose={vi.fn()} onImported={vi.fn()} {...props} />);
const chooseFile = () => fireEvent.change(screen.getByTestId('order-import-file'), { target: { files: [new File(['csv'], 'orders.csv', { type: 'text/csv' })] } });

describe('Import orders', () => {
  test('the preview lists new lines on their suggested piece and those already imported; Import sends the ticked lines', async () => {
    const onImported = vi.fn();
    open({ onImported });
    chooseFile();
    await screen.findByTestId('order-import-preview');
    const [url, body] = vi.mocked(api.post).mock.calls[0];
    expect(url).toBe('/api/v1/wardrobe-orders/preview');
    expect(body.get('show_id')).toBe('s1');
    expect(screen.getByText('2 new · 1 already imported · 1 cancelled, left out')).toBeTruthy();
    const [slip, phone] = screen.getAllByTestId('order-import-line');
    expect(within(slip).getByRole('combobox').value).toBe('w1');
    expect(slip.textContent).toContain('suggested by its name');
    expect(within(phone).getByRole('combobox').value).toBe('');
    expect(screen.getByTestId('order-import-duplicate').textContent).toContain('already imported');

    // The phone case goes on the blazer; Import sends both lines, without preview-only fields.
    fireEvent.change(within(phone).getByRole('combobox'), { target: { value: 'w2' } });
    fireEvent.click(screen.getByTestId('order-import-confirm'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/wardrobe-orders/confirm', expect.anything()));
    const sent = vi.mocked(api.post).mock.calls.find(([u]) => u.endsWith('/confirm'))[1];
    expect(sent.show_id).toBe('s1');
    expect(sent.lines.map((l) => [l.asin, l.wardrobe_id])).toEqual([['B0SATIN001', 'w1'], ['B0PHONECAS', 'w2']]);
    expect(sent.lines[0]).not.toHaveProperty('suggestion');
    expect((await screen.findByTestId('order-import-note')).textContent).toBe('1 put on a piece, 1 kept for later.');
    expect(onImported).toHaveBeenCalledWith(expect.objectContaining({ matched: 1 }));
  });

  test('an unticked line is not sent; a line kept for later is put on a piece', async () => {
    later = [{ id: 'l1', order_id: '110-9', asin: 'B0KEPTLINE', title: 'Kept hat', order_date: '2026-07-01', price_paid: '15.00', quantity: 1, currency: 'USD' }];
    vi.mocked(api.put).mockResolvedValue({ data: { piece: { id: 'w2', filled: ['real_product_name'] } } });
    open();
    const kept = await screen.findByTestId('order-import-later');
    expect(kept.textContent).toContain('Kept hat');
    fireEvent.change(within(kept).getByRole('combobox'), { target: { value: 'w2' } });
    fireEvent.click(within(kept).getByRole('button', { name: 'Put on piece' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/wardrobe-orders/l1', { wardrobe_id: 'w2' }));

    chooseFile();
    await screen.findByTestId('order-import-preview');
    fireEvent.click(within(screen.getAllByTestId('order-import-line')[1]).getByRole('checkbox'));
    expect(screen.getByTestId('order-import-confirm').textContent).toBe('Import 1 line');
    fireEvent.click(screen.getByTestId('order-import-confirm'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v1/wardrobe-orders/confirm', expect.anything()));
    expect(vi.mocked(api.post).mock.calls.find(([u]) => u.endsWith('/confirm'))[1].lines.map((l) => l.asin)).toEqual(['B0SATIN001']);
  });

  test("a file that isn't an order history says so", async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 400, data: { error: "That doesn't look like an Amazon order history CSV." } } });
    open();
    chooseFile();
    expect((await screen.findByTestId('order-import-error')).textContent).toBe("That doesn't look like an Amazon order history CSV.");
    expect(screen.queryByTestId('order-import-preview')).toBeNull();
  });

  test('colours only through tokens', () => {
    const css = readFileSync(resolve(__dirname, 'OrderImportDialog.css'), 'utf8');
    const jsx = readFileSync(resolve(__dirname, 'OrderImportDialog.jsx'), 'utf8');
    expect(css + jsx).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
