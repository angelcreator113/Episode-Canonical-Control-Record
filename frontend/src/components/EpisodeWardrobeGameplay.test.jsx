/**
 * EpisodeWardrobeGameplay — the styling game draws real garment images
 * (Task #1931). The api module is mocked; no network.
 */
import React from 'react';
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

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

// The server's score answer (GET and POST /outfit-score/:episodeId).
const SERVER_BANDS = {
  Nervous: { label: 'Nervous', emoji: '😰', color: '#dc2626', lala: "I don't know about this..." },
  Okay: { label: 'Okay', emoji: '🙂', color: '#22c55e', lala: 'This could work.' },
  Confident: { label: 'Confident', emoji: '😊', color: '#6366f1', lala: 'I feel good about this.' },
  Slaying: { label: 'Slaying', emoji: '👑', color: '#8b5cf6', lala: "They're not ready for me." },
};
function serverScore(score, band) {
  return {
    success: true, hasOutfit: true, score, confidence: SERVER_BANDS[band],
    breakdown: { base: score - 30, aesthetic: 6, tier_harmony: 10, event_alignment: 6, coverage: 8 },
    items: [], item_count: 2,
  };
}
const isScoreUrl = (url) => url.startsWith('/api/v1/wardrobe/outfit-score/');

function mockApi() {
  api.post.mockImplementation((url) => {
    if (url === '/api/v1/wardrobe/browse-pool') {
      return Promise.resolve({ data: { pool: POOL, pool_breakdown: {} } });
    }
    if (isScoreUrl(url)) return Promise.resolve({ data: serverScore(55, 'Okay') });
    return Promise.resolve({ data: { success: true } });
  });
  api.get.mockImplementation((url) => {
    if (url.startsWith('/api/v1/wardrobe/outfit/')) return Promise.resolve({ data: { items: [] } });
    if (isScoreUrl(url)) return Promise.resolve({ data: serverScore(55, 'Okay') });
    if (url.startsWith('/api/v1/wardrobe/outfit-history/')) return Promise.resolve({ data: { history: [] } });
    if (url.endsWith('/todo')) return Promise.resolve({ data: { data: null } });
    return Promise.resolve({ data: { data: [] } });
  });
}

async function renderGame(props = {}, readyText = 'Sage Corset Midi') {
  const utils = render(
    <EpisodeWardrobeGameplay
      episodeId="ep-1"
      showId="show-1"
      event={{ id: 'ev-1', name: 'Garden Gala', event_type: 'gala', prestige: 6, strictness: 5 }}
      characterState={{ coins: 500, reputation: 3 }}
      {...props}
    />
  );
  await screen.findByText(readyText);
  return utils;
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
    // Task #1943: an empty outfit is not scored (no browser formula to say
    // "Nervous" on its own); the panel invites the first piece.
    expect(await screen.findByText('Equip a piece to see how Lala feels.')).toBeTruthy();
    expect(screen.queryByText(/I don't know about this/)).toBeNull();
    expect(api.post.mock.calls.filter(([url]) => isScoreUrl(url))).toHaveLength(0);
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

// ─── Task #1937: Closet/Search use the backend's reach rule; Lock is one request ───

const CLOSET = [
  { ...base, id: 'c-owned', name: 'Cotton Sundress', is_owned: true, lock_type: 'none', coin_cost: 0, can_select: undefined, pool_role: undefined },
  { ...base, id: 'c-cheap', name: 'Budget Wrap Dress', is_owned: false, lock_type: 'coin', coin_cost: 300, can_select: undefined, pool_role: undefined },
  { ...base, id: 'c-dear', name: 'Midnight Gown', is_owned: false, lock_type: 'coin', coin_cost: 900, can_select: undefined, pool_role: undefined },
  { ...base, id: 'c-rep', name: 'Invite-Only Gown', is_owned: false, lock_type: 'reputation', reputation_required: 5, can_select: undefined, pool_role: undefined },
];

function mockCloset() {
  mockApi();
  const poolGet = api.get.getMockImplementation();
  api.get.mockImplementation((url) => {
    if (url.startsWith('/api/v1/wardrobe?show_id=')) return Promise.resolve({ data: { data: CLOSET } });
    return poolGet(url);
  });
}

function cardOf(name) {
  return screen.getByText(name).closest('[style*="border-radius: 12px"]');
}

describe('EpisodeWardrobeGameplay — reach in Closet and Search (Task #1937)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    window.localStorage.clear();
    mockCloset();
  });

  test('Closet marks an affordable coin item buyable and an unaffordable one locked with its cost', async () => {
    await renderGame(); // 500 coins, reputation 3
    fireEvent.click(screen.getByRole('button', { name: 'Full Closet' }));
    await screen.findByText('Budget Wrap Dress');

    expect(within(cardOf('Budget Wrap Dress')).getByText(/Tap to equip · 🪙 300 on Lock/)).toBeTruthy();
    expect(within(cardOf('Midnight Gown')).getByText(/Need 900 coins/)).toBeTruthy();
    expect(within(cardOf('Invite-Only Gown')).getByText(/Rep 5\+/)).toBeTruthy();
    expect(within(cardOf('Cotton Sundress')).getByText('✅ Tap to equip')).toBeTruthy();

    // The affordable one equips; the unaffordable one opens the inspector instead.
    fireEvent.click(screen.getByText('Budget Wrap Dress'));
    await waitFor(() => expect(screen.getAllByText('Budget Wrap Dress').length).toBe(2));
    fireEvent.click(screen.getByText('Midnight Gown'));
    expect(await screen.findByText(/🔒 Need 900 coins/)).toBeTruthy();
  });

  test('Search uses the same rule', async () => {
    await renderGame();
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    fireEvent.change(await screen.findByPlaceholderText(/Search by name/), { target: { value: 'dress' } });
    await screen.findByText('Budget Wrap Dress');
    expect(within(cardOf('Budget Wrap Dress')).getByText(/Tap to equip · 🪙 300 on Lock/)).toBeTruthy();
  });
});

describe('EpisodeWardrobeGameplay — Lock is all-or-nothing (Task #1937)', () => {
  const DRESS = { ...base, id: 'd-draft', name: 'Draft Gown', match_score: 50, can_select: true, can_purchase: true, is_owned: false, lock_type: 'coin', coin_cost: 300 };
  const SHOES = { ...base, id: 's1', name: 'Canvas Sneakers', clothing_category: 'shoes', match_score: 20 };

  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    window.localStorage.clear();
    window.localStorage.setItem('wardrobe_draft_ep-1', JSON.stringify({ body: DRESS, shoes: SHOES }));
    mockApi();
  });

  test('Lock calls the atomic endpoint once with every piece', async () => {
    api.post.mockImplementation((url) => {
      if (url === '/api/v1/wardrobe/browse-pool') return Promise.resolve({ data: { pool: POOL, pool_breakdown: {} } });
      if (url === '/api/v1/wardrobe/lock-outfit-atomic') {
        return Promise.resolve({ data: { success: true, locked: [{ id: 'd-draft', coin_purchased: true }, { id: 's1', coin_purchased: false }], coins_spent: 300, coins_after: 200 } });
      }
      if (isScoreUrl(url)) return Promise.resolve({ data: serverScore(55, 'Okay') });
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    await renderGame();
    fireEvent.click(await screen.findByRole('button', { name: /Lock Outfit/ }));
    await screen.findByText('Outfit Locked');

    const lockCalls = api.post.mock.calls.filter(([url]) => url === '/api/v1/wardrobe/lock-outfit-atomic');
    expect(lockCalls).toHaveLength(1);
    expect(lockCalls[0][1]).toEqual({ episode_id: 'ep-1', show_id: 'show-1', wardrobe_ids: expect.arrayContaining(['d-draft', 's1']) });
    expect(lockCalls[0][1].wardrobe_ids).toHaveLength(2);
    expect(api.post.mock.calls.filter(([url]) => url === '/api/v1/wardrobe/select')).toHaveLength(0);
    // The header shows the returned balance.
    expect(await screen.findByText('🪙 200')).toBeTruthy();
  });

  // Evoni, 2026-10-05: the page's coin chip kept the old balance after a
  // purchase or a paid lock, and a purchase reloaded the pool twice.
  test('a paid lock tells the page its balance changed, and does not reload the pool', async () => {
    api.post.mockImplementation((url) => {
      if (url === '/api/v1/wardrobe/browse-pool') return Promise.resolve({ data: { pool: POOL, pool_breakdown: {} } });
      if (url === '/api/v1/wardrobe/lock-outfit-atomic') {
        return Promise.resolve({ data: { success: true, locked: [{ id: 'd-draft', coin_purchased: true }], coins_spent: 300, coins_after: 200 } });
      }
      if (isScoreUrl(url)) return Promise.resolve({ data: serverScore(55, 'Okay') });
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    const onCoinsChange = vi.fn();
    await renderGame({ onCoinsChange });
    const poolsBefore = api.post.mock.calls.filter(([url]) => url === '/api/v1/wardrobe/browse-pool').length;
    fireEvent.click(await screen.findByRole('button', { name: /Lock Outfit/ }));
    await screen.findByText('Outfit Locked');
    expect(await screen.findByText('🪙 200')).toBeTruthy();
    expect(onCoinsChange).toHaveBeenCalledTimes(1);
    expect(api.post.mock.calls.filter(([url]) => url === '/api/v1/wardrobe/browse-pool')).toHaveLength(poolsBefore);
  });

  test('a purchase reloads the pool once, quietly, and tells the page', async () => {
    const BAG = { ...base, id: 'bag-1', name: 'Pearl Clutch', clothing_category: 'accessories', match_score: 10, can_select: false, can_purchase: true, is_owned: false, lock_type: 'coin', coin_cost: 50 };
    api.post.mockImplementation((url) => {
      if (url === '/api/v1/wardrobe/browse-pool') return Promise.resolve({ data: { pool: [...POOL, BAG], pool_breakdown: {} } });
      if (url === '/api/v1/wardrobe/purchase') return Promise.resolve({ data: { success: true, cost: 50, coins_after: 450 } });
      if (isScoreUrl(url)) return Promise.resolve({ data: serverScore(55, 'Okay') });
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    const onCoinsChange = vi.fn();
    await renderGame({ onCoinsChange });
    fireEvent.click(screen.getByRole('button', { name: /Accessories/ }));
    const buy = await screen.findByText(/Buy for 50 coins/);
    const poolsBefore = api.post.mock.calls.filter(([url]) => url === '/api/v1/wardrobe/browse-pool').length;
    fireEvent.click(buy);
    expect(await screen.findByText(/Purchased "Pearl Clutch"/)).toBeTruthy();
    expect(onCoinsChange).toHaveBeenCalledTimes(1);
    expect(api.post.mock.calls.filter(([url]) => url === '/api/v1/wardrobe/browse-pool')).toHaveLength(poolsBefore + 1);
    expect(screen.queryByText(/Opening the closet/)).toBeNull();
  });

  test('a refused lock leaves the outfit unlocked and shows why', async () => {
    api.post.mockImplementation((url) => {
      if (url === '/api/v1/wardrobe/browse-pool') return Promise.resolve({ data: { pool: POOL, pool_breakdown: {} } });
      if (url === '/api/v1/wardrobe/lock-outfit-atomic') {
        return Promise.reject({ response: { status: 400, data: { success: false, error: 'Not enough coins — need 400, have 350' } } });
      }
      if (isScoreUrl(url)) return Promise.resolve({ data: serverScore(55, 'Okay') });
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    await renderGame();
    fireEvent.click(await screen.findByRole('button', { name: /Lock Outfit/ }));
    expect(await screen.findByText(/Not enough coins — need 400, have 350/)).toBeTruthy();
    expect(screen.queryByText('Outfit Locked')).toBeNull();
    expect(api.post.mock.calls.filter(([url]) => url === '/api/v1/wardrobe/lock-outfit-atomic')).toHaveLength(1);
  });
});

// ─── Task #1943: one scorer, one number (Evoni's ruling, 2026-09-26) ───

const SOURCE = readFileSync(resolve(process.cwd(), 'src/components/EpisodeWardrobeGameplay.jsx'), 'utf8');
const scorePosts = () => api.post.mock.calls.filter(([url]) => isScoreUrl(url));
const scoreGets = () => api.get.mock.calls.filter(([url]) => isScoreUrl(url));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

describe('EpisodeWardrobeGameplay — the server scores the outfit (Task #1943)', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    window.localStorage.clear();
    mockApi();
  });

  test('the component has no scoring formula of its own', () => {
    expect(SOURCE).not.toMatch(/calculateSynergy/);
    expect(SOURCE).not.toMatch(/TIER_VALS/);
    expect(SOURCE).not.toMatch(/hoverSynergy|setHoverItem/);
    // Lala's lines live with the server's confidence bands.
    expect(SOURCE).not.toMatch(/They're not ready for me/);
  });

  test("a draft shows the server's score and Lala's line from the response", async () => {
    api.post.mockImplementation((url) => {
      if (url === '/api/v1/wardrobe/browse-pool') return Promise.resolve({ data: { pool: POOL, pool_breakdown: {} } });
      if (isScoreUrl(url)) return Promise.resolve({ data: serverScore(88, 'Slaying') });
      return Promise.resolve({ data: { success: true } });
    });
    await renderGame();
    fireEvent.click(screen.getByText('Sage Corset Midi'));
    expect(await screen.findByText(/They're not ready for me/)).toBeTruthy();
    expect(screen.getByTestId('synergy-score').textContent).toMatch(/88/);
    // The badges are the server's breakdown.
    expect(screen.getByText('+10 tier harmony')).toBeTruthy();
    const [url, body] = scorePosts()[0];
    expect(url).toBe('/api/v1/wardrobe/outfit-score/ep-1');
    expect(body).toEqual({ wardrobe_ids: ['w1'], event_id: 'ev-1' });
  });

  test('a burst of slot changes sends one debounced request, for the last outfit', async () => {
    await renderGame();
    fireEvent.click(screen.getByText('Sage Corset Midi'));
    fireEvent.click(screen.getByText('Rose Gown'));
    fireEvent.click(screen.getByText('Ivory Slip'));
    expect(scorePosts()).toHaveLength(0); // nothing before the debounce
    await waitFor(() => expect(scorePosts()).toHaveLength(1));
    await act(() => wait(500));
    expect(scorePosts()).toHaveLength(1);
    expect(scorePosts()[0][1]).toEqual({ wardrobe_ids: ['w3'], event_id: 'ev-1' });
    expect(await screen.findByText(/This could work/)).toBeTruthy();
  });

  test('a stale response is ignored', async () => {
    const pending = [];
    api.post.mockImplementation((url, body) => {
      if (url === '/api/v1/wardrobe/browse-pool') return Promise.resolve({ data: { pool: POOL, pool_breakdown: {} } });
      if (isScoreUrl(url)) return new Promise((res) => pending.push({ body, res }));
      return Promise.resolve({ data: { success: true } });
    });
    await renderGame();
    fireEvent.click(screen.getByText('Sage Corset Midi'));
    await waitFor(() => expect(pending).toHaveLength(1));
    fireEvent.click(screen.getByText('Rose Gown'));
    await waitFor(() => expect(pending).toHaveLength(2));
    expect(pending[0].body.wardrobe_ids).toEqual(['w1']);
    expect(pending[1].body.wardrobe_ids).toEqual(['w2']);

    // The newer answer arrives first; the older one arrives late.
    await act(async () => { pending[1].res({ data: serverScore(72, 'Confident') }); });
    expect(await screen.findByText(/I feel good about this/)).toBeTruthy();
    await act(async () => { pending[0].res({ data: serverScore(12, 'Nervous') }); });
    await act(() => wait(50));
    expect(screen.queryByText(/I don't know about this/)).toBeNull();
    expect(screen.getByTestId('synergy-score').textContent).toMatch(/72/);
  });

  test('the hover preview is gone', async () => {
    await renderGame();
    fireEvent.click(screen.getByText('Sage Corset Midi'));
    const card = screen.getByAltText('Rose Gown').closest('[style*="border-radius: 12px"]');
    fireEvent.mouseEnter(card);
    expect(within(card).queryByText(/→/)).toBeNull();
    expect(screen.queryByText(/^[+-]\d+ → \d+$/)).toBeNull();
  });

  test('a locked outfit shows the same server score before and after a reload', async () => {
    const DRESS = { ...base, id: 'w1', name: 'Locked Gown', match_score: 50 };
    const SHOES = { ...base, id: 's1', name: 'Canvas Sneakers', clothing_category: 'shoes', match_score: 20 };
    window.localStorage.setItem('wardrobe_draft_ep-1', JSON.stringify({ body: DRESS, shoes: SHOES }));
    let linked = [];
    api.post.mockImplementation((url) => {
      if (url === '/api/v1/wardrobe/browse-pool') return Promise.resolve({ data: { pool: POOL, pool_breakdown: {} } });
      if (isScoreUrl(url)) return Promise.resolve({ data: serverScore(85, 'Slaying') });
      if (url === '/api/v1/wardrobe/lock-outfit-atomic') {
        // The link rows come back from GET /outfit without match_score.
        linked = [DRESS, SHOES].map(({ match_score: _m, can_select: _c, ...row }) => row);
        return Promise.resolve({ data: { success: true, locked: [{ id: 'w1' }, { id: 's1' }] } });
      }
      return Promise.resolve({ data: { success: true } });
    });
    api.get.mockImplementation((url) => {
      if (url.startsWith('/api/v1/wardrobe/outfit/')) return Promise.resolve({ data: { items: linked } });
      if (isScoreUrl(url)) return Promise.resolve({ data: serverScore(85, 'Slaying') });
      if (url.startsWith('/api/v1/wardrobe/outfit-history/')) return Promise.resolve({ data: { history: [] } });
      if (url.endsWith('/todo')) return Promise.resolve({ data: { data: null } });
      return Promise.resolve({ data: { data: [] } });
    });
    const onOutfitComplete = vi.fn();

    const first = await renderGame({ onOutfitComplete });
    fireEvent.click(await screen.findByRole('button', { name: /Lock Outfit/ }));
    expect(await screen.findByText('Synergy: 85/100 — 👑 Slaying')).toBeTruthy();
    expect(scoreGets()[0][0]).toBe('/api/v1/wardrobe/outfit-score/ep-1?event_id=ev-1');
    await waitFor(() => expect(onOutfitComplete).toHaveBeenCalledTimes(1));
    expect(onOutfitComplete.mock.calls[0][0].synergy.total).toBe(85);
    first.unmount();

    // Reload: the outfit is restored from GET /outfit and scored by the server again.
    const getsBefore = scoreGets().length;
    await renderGame({ onOutfitComplete }, 'Outfit Locked');
    expect(await screen.findByText('Synergy: 85/100 — 👑 Slaying')).toBeTruthy();
    expect(scoreGets().length).toBe(getsBefore + 1);
    // A reload is not a lock.
    expect(onOutfitComplete).toHaveBeenCalledTimes(1);
  });

  test('restored pieces in alias categories fill their slots, and a re-lock keeps all of them', async () => {
    // As GET /outfit returns them: raw rows, no can_select, no match_score.
    const LINKED = [
      { id: 'r-dress', name: 'Linked Gown', clothing_category: 'dress', tier: 'luxury' },
      { id: 'r-heels', name: 'Linked Heels', clothing_category: 'heels', tier: 'luxury' },
      { id: 'r-bag', name: 'Linked Clutch', clothing_category: 'handbag', tier: 'mid' },
      { id: 'r-ear', name: 'Linked Earrings', clothing_category: 'earrings', tier: 'mid' },
    ];
    api.get.mockImplementation((url) => {
      if (url.startsWith('/api/v1/wardrobe/outfit/')) return Promise.resolve({ data: { items: LINKED } });
      if (isScoreUrl(url)) return Promise.resolve({ data: serverScore(64, 'Okay') });
      if (url.startsWith('/api/v1/wardrobe/outfit-history/')) return Promise.resolve({ data: { history: [] } });
      if (url.endsWith('/todo')) return Promise.resolve({ data: { data: null } });
      return Promise.resolve({ data: { data: [] } });
    });
    await renderGame({}, 'Outfit Locked');
    expect(await screen.findByText('Synergy: 64/100 — 🙂 Okay')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Unlock/ }));
    for (const name of ['Linked Gown', 'Linked Heels', 'Linked Clutch', 'Linked Earrings']) {
      expect(await screen.findByText(name)).toBeTruthy();
    }
    fireEvent.click(await screen.findByRole('button', { name: /Lock Outfit/ }));
    await waitFor(() => expect(api.post.mock.calls.filter(([url]) => url === '/api/v1/wardrobe/lock-outfit-atomic')).toHaveLength(1));
    const [, body] = api.post.mock.calls.find(([url]) => url === '/api/v1/wardrobe/lock-outfit-atomic');
    expect([...body.wardrobe_ids].sort()).toEqual(['r-bag', 'r-dress', 'r-ear', 'r-heels']);
    expect(await screen.findByText('Outfit Locked')).toBeTruthy();
  });

  test('a locked outfit with pieces awaiting approval says they are not counted yet', async () => {
    const LINKED = [
      { id: 'r-dress', name: 'Linked Gown', clothing_category: 'dress', tier: 'luxury' },
      { id: 'r-shoes', name: 'Library Heels', clothing_category: 'shoes', tier: 'luxury' },
    ];
    api.get.mockImplementation((url) => {
      if (url.startsWith('/api/v1/wardrobe/outfit/')) return Promise.resolve({ data: { items: LINKED } });
      if (isScoreUrl(url)) return Promise.resolve({ data: { ...serverScore(64, 'Okay'), pending: [{ id: 'r-shoes', name: 'Library Heels' }] } });
      if (url.startsWith('/api/v1/wardrobe/outfit-history/')) return Promise.resolve({ data: { history: [] } });
      if (url.endsWith('/todo')) return Promise.resolve({ data: { data: null } });
      return Promise.resolve({ data: { data: [] } });
    });
    await renderGame({}, 'Outfit Locked');
    expect(await screen.findByText('Synergy: 64/100 — 🙂 Okay')).toBeTruthy();
    const note = await screen.findByTestId('pending-note');
    expect(note.textContent).toBe("1 piece awaiting approval isn't counted yet");
    expect(note.getAttribute('title')).toBe('Library Heels');
  });

  test('no pending pieces: no note', async () => {
    api.get.mockImplementation((url) => {
      if (url.startsWith('/api/v1/wardrobe/outfit/')) return Promise.resolve({ data: { items: [{ id: 'r-dress', name: 'Linked Gown', clothing_category: 'dress' }] } });
      if (isScoreUrl(url)) return Promise.resolve({ data: { ...serverScore(64, 'Okay'), pending: [] } });
      if (url.startsWith('/api/v1/wardrobe/outfit-history/')) return Promise.resolve({ data: { history: [] } });
      if (url.endsWith('/todo')) return Promise.resolve({ data: { data: null } });
      return Promise.resolve({ data: { data: [] } });
    });
    await renderGame({}, 'Outfit Locked');
    expect(await screen.findByText('Synergy: 64/100 — 🙂 Okay')).toBeTruthy();
    expect(screen.queryByTestId('pending-note')).toBeNull();
  });

  test('an unscorable draft says so instead of inventing a tier', async () => {
    api.post.mockImplementation((url) => {
      if (url === '/api/v1/wardrobe/browse-pool') return Promise.resolve({ data: { pool: POOL, pool_breakdown: {} } });
      if (isScoreUrl(url)) return Promise.resolve({ data: { success: true, hasOutfit: false, score: 0, items: [], breakdown: {}, confidence: { label: 'No outfit' } } });
      return Promise.resolve({ data: { success: true } });
    });
    await renderGame();
    fireEvent.click(screen.getByText('Sage Corset Midi'));
    expect(await screen.findByText('None of these pieces could be scored.')).toBeTruthy();
    expect(screen.getByTestId('synergy-score').textContent).toBe('—');
  });
});

// ─── Task #2377: the Full Closet shows every category, bottoms included ───

describe('EpisodeWardrobeGameplay — Full Closet categories (Task #2377)', () => {
  const own = { ...base, is_owned: true, lock_type: 'none', coin_cost: 0, can_select: undefined, pool_role: undefined };
  const FULL = [
    { ...own, id: 'k-dress', name: 'Closet Dress', clothing_category: 'dress' },
    { ...own, id: 'k-top', name: 'Closet Blouse', clothing_category: 'top' },
    { ...own, id: 'k-bottom', name: 'Closet Trousers', clothing_category: 'bottom' },
    { ...own, id: 'k-skirt', name: 'Closet Mini Skirt', clothing_category: 'Mini Skirt' },
    { ...own, id: 'k-shoes', name: 'Closet Pumps', clothing_category: 'shoes' },
    { ...own, id: 'k-acc', name: 'Closet Scarf', clothing_category: 'accessories' },
    { ...own, id: 'k-jewel', name: 'Closet Pearls', clothing_category: 'jewelry' },
    { ...own, id: 'k-perf', name: 'Closet Scent', clothing_category: 'perfume' },
    { ...own, id: 'k-coat', name: 'Closet Trench', clothing_category: 'outerwear' },
    { ...own, id: 'k-odd', name: 'Closet Mystery', clothing_category: 'costume piece' },
  ];
  // Two pages: 200 filler dresses first, then the real pieces — the old single
  // limit=200 request never saw page 2.
  const FILLER = Array.from({ length: 200 }, (_, i) => ({ ...own, id: `f${i}`, name: `Filler ${i}`, clothing_category: 'dress' }));
  const ALL = [...FILLER, ...FULL];

  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    window.localStorage.clear();
    mockApi();
    const poolGet = api.get.getMockImplementation();
    api.get.mockImplementation((url) => {
      if (url.startsWith('/api/v1/wardrobe?show_id=')) {
        const q = new URLSearchParams(url.split('?')[1]);
        const limit = Number(q.get('limit'));
        const page = Number(q.get('page') || 1);
        return Promise.resolve({ data: { success: true, data: ALL.slice((page - 1) * limit, page * limit), pagination: { page, limit, total: ALL.length } } });
      }
      return poolGet(url);
    });
  });

  const EXPECT = [
    ['Top', 'Closet Blouse'], ['Bottom', 'Closet Trousers'], ['Bottom', 'Closet Mini Skirt'],
    ['Shoes', 'Closet Pumps'], ['Accessories', 'Closet Scarf'], ['Jewelry', 'Closet Pearls'],
    ['Perfume', 'Closet Scent'], ['Other', 'Closet Trench'], ['Other', 'Closet Mystery'],
  ];

  test('pages past 200 items and shows every category, bottoms and Other included', async () => {
    await renderGame();
    fireEvent.click(screen.getByRole('button', { name: 'Full Closet' }));
    await screen.findByText('Closet Dress');
    for (const [tab, name] of EXPECT) {
      fireEvent.click(screen.getByRole('button', { name: tab }));
      expect(await screen.findByText(name)).toBeTruthy();
    }
  });

  // W3 (Evoni, 2026-10-01): "Full Closet still doesn't show all my pieces".
  test('W3: the Full Closet opens on All: every piece at once, each with its stored category, and the count of the whole closet', async () => {
    await renderGame();
    fireEvent.click(screen.getByRole('button', { name: 'Full Closet' }));
    expect(await screen.findByText('Closet Mystery')).toBeTruthy();
    for (const [, name] of EXPECT) expect(screen.getByText(name)).toBeTruthy();
    expect(screen.getByText('Closet Dress')).toBeTruthy();
    expect(screen.getByTestId('closet-count').textContent).toBe(`${ALL.length} of ${ALL.length} pieces`);
    expect(screen.getByTestId('closet-category-k-odd').textContent).toBe('costume piece · Other');
    expect(screen.getByTestId('closet-category-k-skirt').textContent).toBe('Mini Skirt · Bottom');
    // The group switches carry their counts.
    expect(screen.getByRole('button', { name: 'Other' }).textContent).toContain('2');
    expect(screen.getByRole('button', { name: 'All' }).textContent).toContain(String(ALL.length));
  });

  test('W3: reopening the Full Closet reloads it, so a piece added since appears', async () => {
    await renderGame();
    fireEvent.click(screen.getByRole('button', { name: 'Full Closet' }));
    await screen.findByText('Closet Mystery');
    ALL.push({ ...own, id: 'k-new', name: 'Closet Newcomer', clothing_category: 'top' });
    try {
      fireEvent.click(screen.getByRole('button', { name: 'For This Event' }));
      fireEvent.click(screen.getByRole('button', { name: 'Full Closet' }));
      expect(await screen.findByText('Closet Newcomer')).toBeTruthy();
    } finally {
      ALL.pop();
    }
  });

  test('W3: a closet that fails to load says so, instead of showing an empty group', async () => {
    const poolGet = api.get.getMockImplementation();
    api.get.mockImplementation((url) => (url.startsWith('/api/v1/wardrobe?show_id=')
      ? Promise.reject(new Error('network down')) : poolGet(url)));
    await renderGame();
    fireEvent.click(screen.getByRole('button', { name: 'Full Closet' }));
    expect((await screen.findByTestId('closet-error')).textContent).toMatch(/couldn't load the closet/i);
  });

  test('W3: fewer pieces loaded than the closet holds is flagged', async () => {
    const poolGet = api.get.getMockImplementation();
    api.get.mockImplementation((url) => (url.startsWith('/api/v1/wardrobe?show_id=')
      ? Promise.resolve({ data: { success: true, data: FULL, pagination: { page: 1, limit: 200, total: FULL.length + 3 } } })
      : poolGet(url)));
    await renderGame();
    fireEvent.click(screen.getByRole('button', { name: 'Full Closet' }));
    expect((await screen.findByTestId('closet-count')).textContent).toBe(`${FULL.length} of ${FULL.length + 3} pieces — some did not load`);
  });

  test('the Bottom tab stays reachable with a dress equipped', async () => {
    await renderGame();
    fireEvent.click(screen.getByRole('button', { name: 'Full Closet' }));
    fireEvent.click(await screen.findByText('Closet Dress'));
    await waitFor(() => expect(screen.getAllByText('Closet Dress').length).toBe(2));
    fireEvent.click(screen.getByRole('button', { name: 'Bottom' }));
    expect(await screen.findByText('Closet Trousers')).toBeTruthy();
    expect(screen.getByText('Closet Mini Skirt')).toBeTruthy();
  });
});

// ─── W2 (Evoni, 2026-10-01): "Accessories and jewellery allow several
// pieces at once; body (dress or top+bottom) and shoes stay single." ───
describe('EpisodeWardrobeGameplay — several accessories and jewellery (W2)', () => {
  const own = { ...base, is_owned: true, lock_type: 'none', coin_cost: 0, can_select: undefined, pool_role: undefined };
  const CLOSET = [
    { ...own, id: 'm-dress', name: 'Silk Gown', clothing_category: 'dress' },
    { ...own, id: 'm-heels', name: 'Gold Heels', clothing_category: 'shoes' },
    { ...own, id: 'm-flats', name: 'Ballet Flats', clothing_category: 'shoes' },
    { ...own, id: 'm-clutch', name: 'Pearl Clutch', clothing_category: 'bag' },
    { ...own, id: 'm-scarf', name: 'Silk Scarf', clothing_category: 'accessory' },
    { ...own, id: 'm-ear', name: 'Drop Earrings', clothing_category: 'earrings' },
    { ...own, id: 'm-neck', name: 'Pearl Necklace', clothing_category: 'necklace' },
  ];

  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    window.localStorage.clear();
    mockApi();
    const poolGet = api.get.getMockImplementation();
    api.get.mockImplementation((url) => (url.startsWith('/api/v1/wardrobe?show_id=')
      ? Promise.resolve({ data: { success: true, data: CLOSET, pagination: { page: 1, limit: 200, total: CLOSET.length } } })
      : poolGet(url)));
  });

  const openCloset = async () => {
    await renderGame();
    fireEvent.click(screen.getByRole('button', { name: 'Full Closet' }));
    await screen.findByText('Pearl Necklace');
  };
  const equip = async (name) => {
    const before = screen.getAllByText(name).length;
    fireEvent.click(screen.getAllByText(name)[0]);
    await waitFor(() => expect(screen.getAllByText(name).length).toBe(before + 1));
  };
  const slotCard = (label) => screen.getByTestId(`slot-${label}`);

  test('two accessories and two jewellery pieces are worn together', async () => {
    await openCloset();
    for (const name of ['Pearl Clutch', 'Silk Scarf', 'Drop Earrings', 'Pearl Necklace']) await equip(name);
    expect(within(slotCard('accessories')).getByText('Pearl Clutch')).toBeTruthy();
    expect(within(slotCard('accessories')).getByText('Silk Scarf')).toBeTruthy();
    expect(within(slotCard('jewelry')).getByText('Drop Earrings')).toBeTruthy();
    expect(within(slotCard('jewelry')).getByText('Pearl Necklace')).toBeTruthy();
  });

  test('shoes stay single: a second pair replaces the first', async () => {
    await openCloset();
    await equip('Gold Heels');
    fireEvent.click(screen.getByText('Ballet Flats'));
    await waitFor(() => expect(within(slotCard('shoes')).getByText('Ballet Flats')).toBeTruthy());
    expect(within(slotCard('shoes')).queryByText('Gold Heels')).toBeNull();
  });

  test('one piece comes off on its own; the lock sends every piece', async () => {
    api.post.mockImplementation((url) => {
      if (url === '/api/v1/wardrobe/browse-pool') return Promise.resolve({ data: { pool: POOL, pool_breakdown: {} } });
      if (url === '/api/v1/wardrobe/lock-outfit-atomic') return Promise.resolve({ data: { success: true, locked: [], coins_after: 500 } });
      if (isScoreUrl(url)) return Promise.resolve({ data: serverScore(55, 'Okay') });
      return Promise.resolve({ data: { success: true } });
    });
    await openCloset();
    for (const name of ['Silk Gown', 'Gold Heels', 'Pearl Clutch', 'Silk Scarf', 'Drop Earrings', 'Pearl Necklace']) await equip(name);
    fireEvent.click(within(slotCard('accessories')).getByRole('button', { name: 'Remove Silk Scarf' }));
    await waitFor(() => expect(within(slotCard('accessories')).queryByText('Silk Scarf')).toBeNull());
    expect(within(slotCard('accessories')).getByText('Pearl Clutch')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Lock Outfit/ }));
    await waitFor(() => expect(api.post.mock.calls.filter(([url]) => url === '/api/v1/wardrobe/lock-outfit-atomic')).toHaveLength(1));
    const [, body] = api.post.mock.calls.find(([url]) => url === '/api/v1/wardrobe/lock-outfit-atomic');
    expect([...body.wardrobe_ids].sort()).toEqual(['m-clutch', 'm-dress', 'm-ear', 'm-heels', 'm-neck']);
  });

  test('a locked outfit restores every jewellery piece, and an older one-piece draft still loads', async () => {
    window.localStorage.setItem('wardrobe_draft_ep-1', JSON.stringify({ jewelry: { ...CLOSET[5], can_select: true } }));
    await renderGame();
    expect(within(slotCard('jewelry')).getByText('Drop Earrings')).toBeTruthy();
  });

  test('a locked outfit with two jewellery pieces shows both', async () => {
    const LINKED = [
      { id: 'r-dress', name: 'Linked Gown', clothing_category: 'dress' },
      { id: 'r-ear', name: 'Linked Earrings', clothing_category: 'earrings' },
      { id: 'r-neck', name: 'Linked Necklace', clothing_category: 'necklace' },
    ];
    const poolGet = api.get.getMockImplementation();
    api.get.mockImplementation((url) => (url.startsWith('/api/v1/wardrobe/outfit/')
      ? Promise.resolve({ data: { items: LINKED } }) : poolGet(url)));
    await renderGame({}, 'Outfit Locked');
    fireEvent.click(screen.getByRole('button', { name: /Unlock/ }));
    await waitFor(() => expect(within(slotCard('jewelry')).getByText('Linked Necklace')).toBeTruthy());
    expect(within(slotCard('jewelry')).getByText('Linked Earrings')).toBeTruthy();
  });
});

// ─── W1 (Evoni, 2026-10-01): "Wardrobe pieces can be linked as a matching
// set; choosing the set equips every piece in its own slot at once, and the
// set shows as one look. Pieces stay individually choosable." ───
describe('EpisodeWardrobeGameplay — matching sets (W1)', () => {
  const own = { ...base, is_owned: true, lock_type: 'none', coin_cost: 0, can_select: undefined, pool_role: undefined };
  const SET = { outfit_set_id: 'set-floral', outfit_set_name: 'Floral Corset Set' };
  const CLOSET = [
    { ...own, id: 'f-top', name: 'Floral Corset', clothing_category: 'top', ...SET },
    { ...own, id: 'f-skirt', name: 'Floral Skirt', clothing_category: 'bottom', ...SET },
    { ...own, id: 'f-ear', name: 'Floral Earrings', clothing_category: 'earrings', ...SET },
    { ...own, id: 'f-neck', name: 'Floral Choker', clothing_category: 'necklace', ...SET },
    { ...own, id: 'x-dress', name: 'Black Gown', clothing_category: 'dress' },
    { ...own, id: 'x-shoes', name: 'Gold Heels', clothing_category: 'shoes' },
  ];

  beforeEach(() => {
    Object.values(api).forEach((fn) => fn?.mockReset?.());
    window.localStorage.clear();
    mockApi();
    const poolGet = api.get.getMockImplementation();
    api.get.mockImplementation((url) => (url.startsWith('/api/v1/wardrobe?show_id=')
      ? Promise.resolve({ data: { success: true, data: CLOSET, pagination: { page: 1, limit: 200, total: CLOSET.length } } })
      : poolGet(url)));
  });

  const openSets = async () => {
    await renderGame();
    fireEvent.click(screen.getByRole('button', { name: 'Full Closet' }));
    await screen.findByText('Black Gown');
    fireEvent.click(screen.getByRole('button', { name: 'Sets' }));
    return screen.findByTestId('matching-set-set-floral');
  };
  const slotCard = (key) => screen.getByTestId(`slot-${key}`);

  test('the Sets group shows the set as one card with its pieces', async () => {
    const card = await openSets();
    expect(within(card).getByText('Floral Corset Set')).toBeTruthy();
    expect(within(card).getByText('4 pieces')).toBeTruthy();
    expect(screen.getByText('1 set · Wear a set to equip every piece')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sets' }).textContent).toContain('1');
  });

  test('choosing the set equips every piece in its own slot at once, and shows the look', async () => {
    const card = await openSets();
    fireEvent.click(within(card).getByRole('button', { name: 'Wear the set' }));
    await waitFor(() => expect(within(slotCard('top')).getByText('Floral Corset')).toBeTruthy());
    expect(within(slotCard('bottom')).getByText('Floral Skirt')).toBeTruthy();
    expect(within(slotCard('jewelry')).getByText('Floral Earrings')).toBeTruthy();
    expect(within(slotCard('jewelry')).getByText('Floral Choker')).toBeTruthy();
    expect(screen.getByTestId('outfit-look').textContent).toBe('Look: Floral Corset Set');
    expect(within(card).getByText('✓ Wearing')).toBeTruthy();
  });

  test('a set replaces a dress with its separates; pieces stay choosable one by one', async () => {
    await renderGame();
    fireEvent.click(screen.getByRole('button', { name: 'Full Closet' }));
    fireEvent.click(await screen.findByText('Black Gown'));
    await waitFor(() => expect(within(slotCard('body')).getByText('Black Gown')).toBeTruthy());
    // One piece of the set on its own, from All.
    fireEvent.click(screen.getByText('Floral Earrings'));
    await waitFor(() => expect(within(slotCard('jewelry')).getByText('Floral Earrings')).toBeTruthy());
    expect(screen.queryByTestId('outfit-look')).toBeNull();
    expect(screen.getByTestId('closet-set-f-ear').textContent).toBe('🔗 Floral Corset Set');

    fireEvent.click(screen.getByRole('button', { name: 'Sets' }));
    fireEvent.click(within(await screen.findByTestId('matching-set-set-floral')).getByRole('button', { name: 'Wear the set' }));
    await waitFor(() => expect(within(slotCard('top')).getByText('Floral Corset')).toBeTruthy());
    expect(screen.queryByTestId('slot-body')).toBeNull(); // separates replace the dress
    expect(within(slotCard('jewelry')).getAllByText('Floral Earrings')).toHaveLength(1);
  });

  test('a locked piece is left out and said so', async () => {
    CLOSET[3] = { ...CLOSET[3], is_owned: false, lock_type: 'coin', coin_cost: 9999, is_visible: true };
    try {
      const card = await openSets();
      fireEvent.click(within(card).getByRole('button', { name: 'Wear the set' }));
      await waitFor(() => expect(within(slotCard('top')).getByText('Floral Corset')).toBeTruthy());
      expect(within(slotCard('jewelry')).queryByText('Floral Choker')).toBeNull();
      expect(await screen.findByText(/1 piece left out \(locked\): Floral Choker/)).toBeTruthy();
    } finally {
      CLOSET[3] = { ...own, id: 'f-neck', name: 'Floral Choker', clothing_category: 'necklace', ...SET };
    }
  });
});
