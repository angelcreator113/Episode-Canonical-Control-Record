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
    expect(missingForAdd(EMPTY_PIECE, null)).toEqual(['a photo', 'a name', 'a category']);
    expect(missingText(['a photo', 'a name', 'a category'])).toBe('Add a photo, a name and a category');
    expect(missingText(['a name'])).toBe('Add a name');
    expect(missingForAdd({ ...EMPTY_PIECE, name: ' Dress ', clothingCategory: 'dress' }, photo())).toEqual([]);
  });

  test('auto-fill fills what is empty and keeps what she typed', () => {
    const prev = { ...EMPTY_PIECE, price: '300', name: '' };
    const next = applyAutoFill(prev, {
      success: true, gameplay: true,
      data: { name: 'Gold Slip', item_type: 'Skirt', color: 'gold', price_estimate: '$450', coin_cost: 450, lock_type: 'coin', aesthetic_tags: ['silk'] },
    });
    expect(next).toMatchObject({ name: 'Gold Slip', clothingCategory: 'bottom', color: 'gold', price: '300', coinCost: 300, lockType: 'coin', isOwned: false, tags: 'silk', aestheticTags: 'silk' });
    expect(applyAutoFill(prev, { data: { lock_type: 'coin' } }).lockType).toBe('none'); // no gameplay mode
  });

  test('the upload sends only what is set, trimmed', () => {
    const fd = pieceFormData({ ...EMPTY_PIECE, name: ' Gold Slip ', clothingCategory: 'dress', brand: '  ', color: 'gold', lockType: 'coin', isOwned: false, website: 'https://x' }, photo(), 'show-1');
    expect(fd.get('name')).toBe('Gold Slip');
    expect(fd.get('brand')).toBeNull();
    expect(fd.get('color')).toBe('gold');
    expect(fd.get('purchaseLink')).toBe('https://x');
    expect(fd.get('lockType')).toBe('coin');
    expect(fd.get('acquisitionType')).toBeNull();
    expect(fd.get('isOwned')).toBe('false');
    expect(fd.get('showId')).toBe('show-1');
    expect(fd.get('image')).toBeTruthy();
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
    expect(screen.getByTestId('add-piece-missing').textContent).toBe('Add a photo, a name and a category');
    expect(screen.getByTestId('add-piece-save').disabled).toBe(true);
    pick();
    type('Name', 'Gold Slip');
    expect(screen.getByTestId('add-piece-missing').textContent).toBe('Add a category');
    type('Category', 'dress');
    expect(screen.queryByTestId('add-piece-missing')).toBeNull();
    fireEvent.click(screen.getByTestId('add-piece-save'));
    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    expect(api.post.mock.calls[0][0]).toBe('/api/v1/wardrobe');
    expect(onAdded.mock.calls[0][0]).toMatchObject({ id: 'w1' });
    expect(onAdded.mock.calls[0][1]).toMatchObject({ photoDropped: false });
  });

  test('an upload error stays in the dialog, with the piece kept', async () => {
    const onAdded = vi.fn();
    api.post.mockRejectedValue({ response: { status: 500, data: { error: 'S3 is down' } } });
    render(<AddPieceDialog showId="show-1" onClose={() => {}} onAdded={onAdded} />);
    pick(); type('Name', 'Gold Slip'); type('Category', 'dress');
    fireEvent.click(screen.getByTestId('add-piece-save'));
    expect((await screen.findByTestId('add-piece-error')).textContent).toBe("The piece wasn't added: S3 is down");
    expect(onAdded).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Name', { exact: false }).value).toBe('Gold Slip');
  });

  test('a photo the server could not store is reported, not hidden', async () => {
    const onAdded = vi.fn();
    api.post.mockResolvedValue({ data: { success: true, data: { id: 'w2', s3_url: null } } });
    render(<AddPieceDialog showId="show-1" onClose={() => {}} onAdded={onAdded} />);
    pick(); type('Name', 'Gold Slip'); type('Category', 'dress');
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

  test('In the story summarises its fields while closed', () => {
    render(<AddPieceDialog showId="show-1" onClose={() => {}} />);
    expect(screen.getByTestId('add-piece-story').textContent).toContain('Lala owns it · purchased · always available');
  });
});
