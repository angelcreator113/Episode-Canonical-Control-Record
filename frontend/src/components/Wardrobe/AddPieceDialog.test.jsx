/**
 * Add piece (Evoni, 2026-10-07: "fix and redesign wardrobe add piece").
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
import api from '../../services/api';
import AddPieceDialog from './AddPieceDialog';
import {
  missingForAdd, missingText, applyAutoFill, pieceFormData, autoFillErrorText, uploadErrorText, photoDropped, EMPTY_PIECE,
} from '../../lib/wardrobeAddPiece';

const photo = () => new File(['x'], 'dress.png', { type: 'image/png' });
const pick = (file = photo()) => fireEvent.change(screen.getByTestId('add-piece-file'), { target: { files: [file] } });
const type = (label, value) => fireEvent.change(screen.getByLabelText(label, { exact: false }), { target: { value } });

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:preview');
  globalThis.URL.revokeObjectURL = vi.fn();
});

describe('wardrobeAddPiece helpers', () => {
  test('what is missing, in plain words', () => {
    // Task #3143: every uploaded piece is bought, so a piece for sale needs a price.
    expect(missingForAdd(EMPTY_PIECE, null)).toEqual(['a photo', 'a name', 'a category', 'a price (or a story price in coins)']);
    expect(missingText(['a photo', 'a name', 'a category'])).toBe('Add a photo, a name and a category');
    expect(missingText(['a name'])).toBe('Add a name');
    expect(missingForAdd({ ...EMPTY_PIECE, name: ' Dress ', clothingCategory: 'dress' }, photo())).toEqual(['a price (or a story price in coins)']);
    expect(missingForAdd({ ...EMPTY_PIECE, name: ' Dress ', clothingCategory: 'dress', price: '120' }, photo())).toEqual([]);
    expect(missingForAdd({ ...EMPTY_PIECE, name: ' Dress ', clothingCategory: 'dress', coinCost: '300' }, photo())).toEqual([]);
    expect(missingForAdd({ ...EMPTY_PIECE, name: ' Dress ', clothingCategory: 'dress', coinCost: '0', price: '120' }, photo())).toEqual(['a price (or a story price in coins)']);
    // Never for sale, so no price is asked for.
    expect(missingForAdd({ ...EMPTY_PIECE, name: ' Dress ', clothingCategory: 'dress', lockType: 'season_drop' }, photo())).toEqual([]);
  });

  test('auto-fill fills what is empty and keeps what she typed', () => {
    const prev = { ...EMPTY_PIECE, price: '300', name: '' };
    const next = applyAutoFill(prev, {
      success: true, gameplay: true,
      data: { name: 'Gold Slip', item_type: 'Skirt', color: 'gold', price_estimate: '$450', coin_cost: 450, lock_type: 'coin', aesthetic_tags: ['silk'] },
    });
    expect(next).toMatchObject({ name: 'Gold Slip', clothingCategory: 'bottom', color: 'gold', price: '300', coinCost: 300, lockType: 'coin', tags: 'silk', aestheticTags: 'silk' });
    expect(applyAutoFill(prev, { data: { lock_type: 'coin' } }).lockType).toBe('none'); // no gameplay mode
  });

  test('the upload sends only what is set, trimmed', () => {
    const fd = pieceFormData({ ...EMPTY_PIECE, name: ' Gold Slip ', clothingCategory: 'dress', brand: '  ', color: 'gold', lockType: 'coin', website: 'https://x' }, photo(), 'show-1');
    expect(fd.get('name')).toBe('Gold Slip');
    expect(fd.get('brand')).toBeNull();
    expect(fd.get('color')).toBe('gold');
    expect(fd.get('purchaseLink')).toBe('https://x');
    expect(fd.get('lockType')).toBe('coin');
    expect(fd.get('acquisitionType')).toBeNull();
    // Task #3143: no ownership is sent; every uploaded piece starts unowned.
    expect(fd.get('isOwned')).toBeNull();
    expect(fd.get('showId')).toBe('show-1');
    expect(fd.get('image')).toBeTruthy();
  });

  test('the Real world section: filled fields are sent with real_source manual; none sends none (Task 3083)', () => {
    const base = { ...EMPTY_PIECE, name: 'Gold Slip', clothingCategory: 'dress' };
    const fd = pieceFormData(base, null, 'show-1', { real_brand: ' Reformation ', real_price_paid: '128.50', real_size: '' });
    expect(fd.get('real_brand')).toBe('Reformation');
    expect(fd.get('real_price_paid')).toBe('128.50');
    expect(fd.has('real_size')).toBe(false);
    expect(fd.get('real_source')).toBe('manual');
    const none = pieceFormData(base, null, 'show-1', { real_brand: '  ' });
    expect(none.has('real_brand')).toBe(false);
    expect(none.has('real_source')).toBe(false);
    expect(pieceFormData(base, null, 'show-1').has('real_source')).toBe(false);
  });

  test('errors in plain words: no .env, PM2 or service workers', () => {
    expect(autoFillErrorText({ response: { status: 503, data: { error: 'ANTHROPIC_API_KEY not set' } } })).toBe("Fill-in from photo isn't available right now. Fill the fields yourself.");
    expect(autoFillErrorText({ code: 'ECONNABORTED', message: 'timeout of 120000ms exceeded' })).toMatch(/took too long/);
    expect(autoFillErrorText({ message: 'Network Error' })).toMatch(/Couldn't reach the server/);
    expect(autoFillErrorText({ response: { status: 413 } })).toMatch(/under 5 MB/);
    expect(autoFillErrorText({ response: { status: 429 } })).toMatch(/paused/);
    expect(uploadErrorText({ response: { data: { error: 'Missing required field: character' } } })).toBe("The piece wasn't added: Missing required field: character");
    expect(photoDropped(photo(), { id: 'w1', s3_url: null })).toBe(true);
    expect(photoDropped(photo(), { id: 'w1', s3_url: 'https://img' })).toBe(false);
    expect(photoDropped(null, { id: 'w1' })).toBe(false);
  });
});

describe('AddPieceDialog', () => {
  test('says what is missing until a photo, a name and a category are in; then adds the piece', async () => {
    const onAdded = vi.fn();
    api.post.mockResolvedValue({ data: { success: true, data: { id: 'w1', name: 'Gold Slip', s3_url: 'https://img/w1.png' } } });
    render(<AddPieceDialog showId="show-1" onClose={() => {}} onAdded={onAdded} />);
    expect(screen.getByRole('dialog', { name: 'Add a piece' })).toBeTruthy();
    expect(screen.getByTestId('add-piece-missing').textContent).toBe('Add a photo, a name, a category and a price (or a story price in coins)');
    expect(screen.getByTestId('add-piece-save').disabled).toBe(true);
    pick();
    type('Name', 'Gold Slip');
    expect(screen.getByTestId('add-piece-missing').textContent).toBe('Add a category and a price (or a story price in coins)');
    type('Category', 'dress');
    expect(screen.getByTestId('add-piece-missing').textContent).toBe('Add a price (or a story price in coins)');
    type('Price ($)', '120');
    expect(screen.queryByTestId('add-piece-missing')).toBeNull();
    fireEvent.click(screen.getByTestId('add-piece-save'));
    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    expect(api.post.mock.calls[0][0]).toBe('/api/v1/wardrobe');
    expect(onAdded.mock.calls[0][0]).toMatchObject({ id: 'w1' });
    expect(onAdded.mock.calls[0][1]).toMatchObject({ photoDropped: false });
  });

  test('the Real world section opens under More, and what she types goes with the piece; a refused field is said plainly (Task 3083)', async () => {
    const onAdded = vi.fn();
    api.post.mockRejectedValueOnce({ response: { status: 400, data: { error: 'Invalid real-world fields', details: ['real_price_paid must be a number of zero or more'] } } });
    api.post.mockResolvedValueOnce({ data: { success: true, data: { id: 'w3', s3_url: 'https://img/w3.png' } } });
    render(<AddPieceDialog showId="show-1" onClose={() => {}} onAdded={onAdded} />);
    pick(); type('Name', 'Gold Slip'); type('Category', 'dress'); type('Price ($)', '120');
    const section = screen.getByTestId('wardrobe-real-world');
    expect(section.querySelector('input[name="real_brand"]')).toBeNull();
    section.open = true;
    fireEvent(section, new Event('toggle'));
    const field = (name) => section.querySelector(`input[name="${name}"]`);
    await waitFor(() => expect(field('real_brand')).toBeTruthy());
    fireEvent.change(field('real_brand'), { target: { value: 'Reformation' } });
    fireEvent.change(field('real_price_paid'), { target: { value: '-3' } });
    fireEvent.click(screen.getByTestId('add-piece-save'));
    expect((await screen.findByTestId('add-piece-error')).textContent).toBe('Real world: Price paid must be a number of zero or more.');
    fireEvent.change(field('real_price_paid'), { target: { value: '128' } });
    fireEvent.click(screen.getByTestId('add-piece-save'));
    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    const sent = api.post.mock.calls[1][1];
    expect(sent.get('real_brand')).toBe('Reformation');
    expect(sent.get('real_price_paid')).toBe('128');
    expect(sent.get('real_source')).toBe('manual');
  });

  test('a Real world field alone counts as a started piece: clicking outside keeps it (Task 3083)', async () => {
    const onClose = vi.fn();
    render(<AddPieceDialog showId="show-1" onClose={onClose} onAdded={() => {}} />);
    const section = screen.getByTestId('wardrobe-real-world');
    section.open = true;
    fireEvent(section, new Event('toggle'));
    await waitFor(() => expect(section.querySelector('input[name="real_brand"]')).toBeTruthy());
    fireEvent.change(section.querySelector('input[name="real_brand"]'), { target: { value: 'Reformation' } });
    fireEvent.click(screen.getByTestId('add-piece-backdrop'));
    expect(onClose).not.toHaveBeenCalled();
  });

  test('an upload error stays in the dialog, with the piece kept', async () => {
    const onAdded = vi.fn();
    api.post.mockRejectedValue({ response: { status: 500, data: { error: 'S3 is down' } } });
    render(<AddPieceDialog showId="show-1" onClose={() => {}} onAdded={onAdded} />);
    pick(); type('Name', 'Gold Slip'); type('Category', 'dress'); type('Price ($)', '120');
    fireEvent.click(screen.getByTestId('add-piece-save'));
    expect((await screen.findByTestId('add-piece-error')).textContent).toBe("The piece wasn't added: S3 is down");
    expect(onAdded).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Name', { exact: false }).value).toBe('Gold Slip');
  });

  test('a photo the server could not store is reported, not hidden', async () => {
    const onAdded = vi.fn();
    api.post.mockResolvedValue({ data: { success: true, data: { id: 'w2', s3_url: null } } });
    render(<AddPieceDialog showId="show-1" onClose={() => {}} onAdded={onAdded} />);
    pick(); type('Name', 'Gold Slip'); type('Category', 'dress'); type('Price ($)', '120');
    fireEvent.click(screen.getByTestId('add-piece-save'));
    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    expect(onAdded.mock.calls[0][1]).toMatchObject({ photoDropped: true });
  });

  test('clicking outside or Escape closes an empty dialog, never a started one', () => {
    const onClose = vi.fn();
    const { unmount } = render(<AddPieceDialog showId="show-1" onClose={onClose} />);
    fireEvent.click(screen.getByTestId('add-piece-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    const onClose2 = vi.fn();
    render(<AddPieceDialog showId="show-1" onClose={onClose2} />);
    type('Name', 'Gold Slip');
    fireEvent.click(screen.getByTestId('add-piece-backdrop'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose2).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose2).toHaveBeenCalledTimes(1);
  });

  test('Fill in from the photo fills the form; a refusal says so in plain words', async () => {
    api.post.mockResolvedValueOnce({ data: { success: true, gameplay: true, data: { name: 'Pearl Clutch', item_type: 'bag', color: 'ivory', brand_guess: 'Maison Rêve', brand_is_fictional: true } } });
    render(<AddPieceDialog showId="show-1" onClose={() => {}} />);
    pick();
    fireEvent.click(screen.getByTestId('add-piece-autofill'));
    await waitFor(() => expect(screen.getByLabelText('Name', { exact: false }).value).toBe('Pearl Clutch'));
    expect(api.post.mock.calls[0][0]).toBe('/api/v1/wardrobe-library/analyze-image');
    expect(screen.getByLabelText('Category', { exact: false }).value).toBe('bag');
    expect(screen.getByText('A LalaVerse brand, filled in from the photo')).toBeTruthy();

    api.post.mockRejectedValueOnce({ response: { status: 503, data: { error: 'ANTHROPIC_API_KEY missing' } } });
    fireEvent.click(screen.getByTestId('add-piece-autofill'));
    expect((await screen.findByTestId('add-piece-autofill-error')).textContent).toBe("Fill-in from photo isn't available right now. Fill the fields yourself.");
    expect(document.body.textContent).not.toMatch(/PM2|\.env|Service Worker/);
  });

  // Task #3151: the photo sits on the backdrop of the category chosen, as in the closet.
  test("the photo's preview sits on its category's backdrop", async () => {
    render(<AddPieceDialog showId="show-1" onClose={() => {}} />);
    pick();
    const preview = await screen.findByTestId('add-piece-preview');
    expect(preview.dataset.backdrop).toBe('other');
    type('Category', 'shoes');
    expect(screen.getByTestId('add-piece-preview').dataset.backdrop).toBe('shoes');
  });

  test('In the story summarises its fields while closed', () => {
    render(<AddPieceDialog showId="show-1" onClose={() => {}} />);
    expect(screen.getByTestId('add-piece-story').textContent).toContain('Lala buys it · purchased · bought for its price · price required');
    type('Price ($)', '120');
    expect(screen.getByTestId('add-piece-story').textContent).toContain('Lala buys it · purchased · bought for its price · 120 coins');
    expect(screen.queryByText('Lala already owns it')).toBeNull();
  });
});
