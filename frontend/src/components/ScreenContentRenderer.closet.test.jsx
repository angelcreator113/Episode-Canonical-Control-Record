/**
 * Lala's Phone closet screens (Task #3151): each piece sits on its Producer
 * Mode backdrop, as in the closet, on the wardrobe grid and the wishlist.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('./phone/PhoneMapView', () => ({ default: () => null }));

import api from '../services/api';
import ScreenContentRenderer from './ScreenContentRenderer';

const zone = (content_type, config = {}) => ({ id: 'z1', content_type, content_config: config, x: 0, y: 0, width: 100, height: 100 });

beforeEach(() => { vi.mocked(api.get).mockReset(); });

describe("Lala's Phone closet screens", () => {
  test('the wardrobe grid draws each piece on its slot backdrop, owned badge kept', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [
      { id: 'w1', name: 'Gold Slip', clothing_category: 'dress', is_owned: true, s3_url_processed: 'slip-nobg.png' },
      { id: 'w2', name: 'Crimson Pump', clothing_category: 'shoes', is_owned: false, coin_cost: 200 },
    ] } });
    render(<ScreenContentRenderer zones={[zone('wardrobe_grid')]} showId="s-1" />);
    const slip = await screen.findByTestId('phone-closet-piece-w1');
    expect(slip.dataset.backdrop).toBe('body');
    expect(slip.querySelector('img').getAttribute('src')).toBe('slip-nobg.png');
    // No picture: the shoes' own icon on the shoes backdrop.
    const pump = screen.getByTestId('phone-closet-piece-w2');
    expect(pump.dataset.backdrop).toBe('shoes');
    expect(pump.textContent).toBe('👠');
    expect(screen.getByText('OWNED')).toBeTruthy();
  });

  test('the wishlist draws each piece on its slot backdrop (the read now carries the category)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { closet: { wishlist: [
      { id: 'w3', name: 'Pearl Drops', clothing_category: 'jewelry', coin_cost: 5000, tier: 'luxury', image_url: 'pearls.png' },
    ] } } } });
    render(<ScreenContentRenderer zones={[zone('closet_wishlist_grid')]} showId="s-1" />);
    const pearls = await screen.findByTestId('phone-wishlist-piece-w3');
    expect(pearls.dataset.backdrop).toBe('jewelry');
    expect(pearls.querySelector('img').getAttribute('src')).toBe('pearls.png');
  });

  test('the Hair area reads hairstyles and wigs on the Hair backdrop; Accessories leaves them out, bows kept (Task 3167)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [
      { id: 'h1', name: 'Honey Lace Wig', clothing_category: 'hair', is_owned: true },
    ] } });
    render(<ScreenContentRenderer zones={[zone('wardrobe_hair')]} showId="s-1" />);
    const wig = await screen.findByTestId('phone-closet-piece-h1');
    expect(wig.dataset.backdrop).toBe('hair');
    expect(vi.mocked(api.get).mock.calls[0][0]).toContain(`category=${encodeURIComponent('hair,wig,wigs,hairstyle,hairstyles')}`);

    vi.mocked(api.get).mockResolvedValue({ data: { data: [
      { id: 'h2', name: 'Honey Lace Wig', clothing_category: 'hair', is_owned: true },
      { id: 'b1', name: 'Velvet Bow', clothing_category: 'hair bow', is_owned: true },
    ] } });
    render(<ScreenContentRenderer zones={[{ ...zone('wardrobe_accessories'), id: 'z2' }]} showId="s-1" />);
    await screen.findByTestId('phone-closet-piece-b1');
    expect(screen.queryByTestId('phone-closet-piece-h2')).toBeNull();
  });

  // Jewelry is its own section, outside Accessories (Evoni, 2026-10-15).
  const CLOSET = [
    { id: 'j1', name: 'Pearl Drops', clothing_category: 'earrings', is_owned: true },
    { id: 'j2', name: 'Gold Chain', clothing_category: 'necklace', is_owned: true },
    { id: 'j3', name: 'Tennis Bracelet', clothing_category: 'jewelry', is_owned: true },
    { id: 'j4', name: 'Rose Watch', clothing_category: 'watch', is_owned: true },
    { id: 'a1', name: 'Quilted Clutch', clothing_category: 'bag', is_owned: true },
    { id: 'a2', name: 'Velvet Bow', clothing_category: 'hair bow', is_owned: true },
    { id: 'd1', name: 'Gold Slip', clothing_category: 'dress', is_owned: true },
  ];

  test('the Jewelry area shows the jewelry, and nothing else', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: CLOSET } });
    render(<ScreenContentRenderer zones={[zone('wardrobe_jewelry')]} showId="s-1" />);
    await screen.findByTestId('phone-closet-piece-j1');
    for (const id of ['j2', 'j3', 'j4']) expect(screen.getByTestId(`phone-closet-piece-${id}`)).toBeTruthy();
    for (const id of ['a1', 'a2', 'd1']) expect(screen.queryByTestId(`phone-closet-piece-${id}`)).toBeNull();
    expect(screen.getByTestId('phone-closet-piece-j1').dataset.backdrop).toBe('jewelry');
  });

  test('Accessories keeps bags and bows and leaves the jewelry out', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: CLOSET } });
    render(<ScreenContentRenderer zones={[zone('wardrobe_accessories')]} showId="s-1" />);
    await screen.findByTestId('phone-closet-piece-a1');
    expect(screen.getByTestId('phone-closet-piece-a2')).toBeTruthy();
    for (const id of ['j1', 'j2', 'j3', 'j4', 'd1']) expect(screen.queryByTestId(`phone-closet-piece-${id}`)).toBeNull();
  });

  test('an empty Jewelry area says so in its own word', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [CLOSET[4]] } });
    render(<ScreenContentRenderer zones={[zone('wardrobe_jewelry', { scope: 'owned' })]} showId="s-1" />);
    expect(await screen.findByText('No jewelry owned')).toBeTruthy();
  });
});
