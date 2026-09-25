/**
 * EpisodeWardrobeGameplay — the styling game draws real garment images
 * (Task #1931). The api module is mocked; no network.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    request: vi.fn(),
  },
}));

import api from '../services/api';
import EpisodeWardrobeGameplay from './EpisodeWardrobeGameplay';

const RAW = 'https://bucket.s3.amazonaws.com/wardrobe/sage-corset-midi.jpg';
const PROCESSED = 'https://bucket.s3.amazonaws.com/wardrobe/rose-gown-nobg.png';
const THUMB = 'https://bucket.s3.amazonaws.com/wardrobe/ivory-slip-thumb.jpg';

const base = {
  clothing_category: 'dress',
  tier: 'mid',
  pool_role: 'safe',
  is_owned: true,
  is_visible: true,
  can_select: true,
  aesthetic_tags: ['romantic'],
  event_types: [],
  primary_image_variant: null,
};

const POOL = [
  { ...base, id: 'w1', name: 'Sage Corset Midi', match_score: 50, s3_url: RAW },
  { ...base, id: 'w2', name: 'Rose Gown', match_score: 45, tier: 'luxury', s3_url: RAW, thumbnail_url: THUMB, s3_url_processed: PROCESSED },
  { ...base, id: 'w3', name: 'Ivory Slip', match_score: 40, s3_url: RAW, thumbnail_url: THUMB },
  { ...base, id: 'w4', name: 'Bare Dress', match_score: 30 },
  { ...base, id: 'w5', name: 'Broken Dress', match_score: 20, s3_url: 'https://bucket.s3.amazonaws.com/wardrobe/missing.jpg' },
];

function mockApi() {
  api.post.mockImplementation((url) => {
    if (url === '/api/v1/wardrobe/browse-pool') {
      return Promise.resolve({ data: { pool: POOL, pool_breakdown: {} } });
    }
    return Promise.resolve({ data: { success: true } });
  });
  api.get.mockImplementation((url) => {
    if (url.startsWith('/api/v1/wardrobe/outfit/')) return Promise.resolve({ data: { items: [] } });
    if (url.startsWith('/api/v1/wardrobe/outfit-history/')) return Promise.resolve({ data: { history: [] } });
    if (url.endsWith('/todo')) return Promise.resolve({ data: { data: null } });
    return Promise.resolve({ data: { data: [] } });
  });
}

async function renderGame() {
  render(
    <EpisodeWardrobeGameplay
      episodeId="ep-1"
      showId="show-1"
      event={{ name: 'Garden Gala', event_type: 'gala', prestige: 6, strictness: 5 }}
      characterState={{ coins: 500, reputation: 3 }}
    />
  );
  await screen.findByText('Sage Corset Midi');
}

describe('EpisodeWardrobeGameplay — garment images', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    window.localStorage.clear();
    mockApi();
  });

  test('keeps the 7 slots, Outfit Synergy and the confidence line', async () => {
    await renderGame();
    for (const label of ['Body', 'Top', 'Bottom', 'Shoes', 'Accessories', 'Jewelry', 'Perfume']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByText('Outfit Synergy')).toBeTruthy();
    expect(screen.getByText(/I don't know about this/)).toBeTruthy();
  });

  test('an item with only s3_url shows that URL in its card', async () => {
    await renderGame();
    const img = screen.getByAltText('Sage Corset Midi');
    expect(img.tagName).toBe('IMG');
    expect(img.getAttribute('src')).toBe(RAW);
  });

  test('an item with a processed URL shows it ahead of thumbnail and s3_url', async () => {
    await renderGame();
    expect(screen.getByAltText('Rose Gown').getAttribute('src')).toBe(PROCESSED);
  });

  test('an item with a thumbnail and s3_url shows the thumbnail', async () => {
    await renderGame();
    expect(screen.getByAltText('Ivory Slip').getAttribute('src')).toBe(THUMB);
  });

  test('an item with no image shows the category emoji', async () => {
    await renderGame();
    const fallback = screen.getByRole('img', { name: 'Bare Dress' });
    expect(fallback.tagName).not.toBe('IMG');
    expect(fallback.textContent).toBe('👗');
  });

  test('a broken image falls back to the emoji', async () => {
    await renderGame();
    const img = screen.getByAltText('Broken Dress');
    expect(img.tagName).toBe('IMG');
    fireEvent.error(img);
    await waitFor(() => {
      const fallback = screen.getByRole('img', { name: 'Broken Dress' });
      expect(fallback.tagName).not.toBe('IMG');
      expect(fallback.textContent).toBe('👗');
    });
  });

  test('the card keeps tier, fit and equip state beside the image', async () => {
    await renderGame();
    const card = screen.getByAltText('Rose Gown').closest('[style*="border-radius: 12px"]');
    expect(card).toBeTruthy();
    expect(within(card).getByText(/luxury/)).toBeTruthy();
    expect(within(card).getByText('45')).toBeTruthy();
    expect(within(card).getByText(/Tap to equip/)).toBeTruthy();
  });

  test('an equipped item shows its image in the slot', async () => {
    await renderGame();
    fireEvent.click(screen.getByText('Sage Corset Midi'));
    await waitFor(() => {
      const imgs = screen.getAllByAltText('Sage Corset Midi');
      expect(imgs.length).toBe(2);
      imgs.forEach((i) => expect(i.getAttribute('src')).toBe(RAW));
    });
  });
});
