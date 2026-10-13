/**
 * Shop the Look on the public website (Task 3022): /shop-the-look lists the
 * published looks; /shop-the-look/:key shows one with the disclosure first
 * and its links (rel="sponsored" on affiliate links); none yet, not found
 * and a failed read each say so. Plain fetches of the public endpoints only.
 */
import React from 'react';
import { vi, describe, beforeEach, afterEach, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
import api from '../services/api';
import PublicShopLook, { PUBLIC_LOOKS_URL, publishedLabel, relFor } from './PublicShopLook';

const DISCLOSURE = 'Some links are affiliate links; I may earn a commission.';
const LIST = [
  { key: 'Ab3_k9-Zq1Lm', title: 'Episode 2: The Gala', published_at: '2026-10-12T20:00:00.000Z' },
  { key: 'Pq7-x2_Rt8Ns', title: 'Episode 1: Wearable Experiments', published_at: '2026-10-05T20:00:00.000Z' },
];
const LOOK = { look: {
  key: 'Ab3_k9-Zq1Lm', title: 'Episode 2: The Gala', published_at: '2026-10-12T20:00:00.000Z',
  caption: 'Every look tells a story.', disclosure: DISCLOSURE,
  links: [
    { label: 'Maison Rouge Satin Ballet Pump', retailer: 'Nordstrom', url: 'https://shop.example/pump', affiliate: false },
    { label: 'Bloom Studs', retailer: null, url: 'https://aff.example/studs?ref=lala', affiliate: true },
  ],
} };
const reply = (status, body) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
let fetchMock;

const renderAt = (url) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes><Route path="/shop-the-look" element={<PublicShopLook />} /><Route path="/shop-the-look/:key" element={<PublicShopLook />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  fetchMock = vi.fn((url) => {
    if (url === PUBLIC_LOOKS_URL) return reply(200, { looks: LIST });
    if (url === `${PUBLIC_LOOKS_URL}/Ab3_k9-Zq1Lm`) return reply(200, LOOK);
    return reply(404, { error: 'Look not found' });
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('the public Shop the Look page', () => {
  test('publishedLabel and relFor', () => {
    expect(publishedLabel('2026-10-12T20:00:00.000Z')).toBe('12 October 2026');
    expect(relFor({ affiliate: true })).toBe('sponsored noopener');
    expect(relFor({ affiliate: false })).toBe('noopener');
  });

  test('the list: each published look, newest first, links to its page; only the public endpoint', async () => {
    renderAt('/shop-the-look');
    const list = await screen.findByTestId('site-shop-list');
    const links = [...list.querySelectorAll('a')].map((a) => [a.textContent, a.getAttribute('href')]);
    expect(links).toEqual([['Episode 2: The Gala', '/shop-the-look/Ab3_k9-Zq1Lm'], ['Episode 1: Wearable Experiments', '/shop-the-look/Pq7-x2_Rt8Ns']]);
    expect(fetchMock.mock.calls.map(([u]) => u)).toEqual([PUBLIC_LOOKS_URL]);
    expect(api.get).not.toHaveBeenCalled();
  });

  test('one look: the disclosure first, the caption, each link in a new tab; sponsored on the affiliate one', async () => {
    renderAt('/shop-the-look/Ab3_k9-Zq1Lm');
    expect(await screen.findByRole('heading', { level: 1, name: 'Episode 2: The Gala' })).toBeTruthy();
    const article = screen.getByTestId('site-shop-look');
    const disclosure = screen.getByTestId('site-shop-disclosure');
    expect(disclosure.textContent).toBe(DISCLOSURE);
    const firstLink = screen.getAllByTestId('site-shop-link')[0];
    expect(disclosure.compareDocumentPosition(firstLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(article.textContent).toContain('Every look tells a story.');
    const anchors = screen.getAllByTestId('site-shop-link').map((li) => li.querySelector('a'));
    expect(anchors.map((a) => [a.textContent, a.getAttribute('href'), a.getAttribute('rel'), a.getAttribute('target')])).toEqual([
      ['Maison Rouge Satin Ballet Pump', 'https://shop.example/pump', 'noopener', '_blank'],
      ['Bloom Studs', 'https://aff.example/studs?ref=lala', 'sponsored noopener', '_blank'],
    ]);
    expect(screen.getByText('Affiliate link')).toBeTruthy();
    expect(fetchMock.mock.calls.map(([u]) => u)).toEqual([`${PUBLIC_LOOKS_URL}/Ab3_k9-Zq1Lm`]);
  });

  test('a look with no affiliate link shows no disclosure', async () => {
    fetchMock.mockImplementation(() => reply(200, { look: { ...LOOK.look, disclosure: null, links: [LOOK.look.links[0]] } }));
    renderAt('/shop-the-look/Ab3_k9-Zq1Lm');
    await screen.findByTestId('site-shop-look');
    expect(screen.queryByTestId('site-shop-disclosure')).toBeNull();
  });

  test('none yet, not found, and a failed read each say so', async () => {
    fetchMock.mockImplementation(() => reply(200, { looks: [] }));
    const first = renderAt('/shop-the-look');
    expect(await screen.findByRole('heading', { level: 1, name: 'No looks yet.' })).toBeTruthy();
    first.unmount();

    fetchMock.mockImplementation(() => reply(404, { error: 'Look not found' }));
    const second = renderAt('/shop-the-look/nope');
    expect(await screen.findByRole('heading', { level: 1, name: 'That look is not here.' })).toBeTruthy();
    second.unmount();

    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockImplementation(() => reply(500, {}));
    renderAt('/shop-the-look');
    expect(await screen.findByRole('heading', { level: 1, name: 'The looks could not be loaded.' })).toBeTruthy();
  });

  test('"Every look" goes back to the list', async () => {
    renderAt('/shop-the-look/Ab3_k9-Zq1Lm');
    await screen.findByTestId('site-shop-look');
    fireEvent.click(screen.getByRole('link', { name: 'Every look' }));
    expect(await screen.findByTestId('site-shop-list')).toBeTruthy();
  });

  test('the look strip shows above the caption, and as a thumbnail in the list; none, none shown (Task 3120)', async () => {
    const image = { url: 'https://site.cdn.test/site-public/looks/Ab3_k9-Zq1Lm/strip.png', alt: 'The look: Episode 2: The Gala' };
    fetchMock.mockImplementation((url) => (url === PUBLIC_LOOKS_URL
      ? reply(200, { looks: [{ ...LIST[0], image }, { ...LIST[1], image: null }] })
      : reply(200, { look: { ...LOOK.look, image } })));
    const list = renderAt('/shop-the-look');
    await screen.findByTestId('site-shop-list');
    const thumbs = screen.getAllByTestId('site-shop-thumb');
    expect(thumbs.map((t) => t.getAttribute('src'))).toEqual([image.url]);
    expect(thumbs[0].getAttribute('alt')).toBe('');
    list.unmount();

    const one = renderAt('/shop-the-look/Ab3_k9-Zq1Lm');
    const img = await screen.findByTestId('site-shop-image');
    expect([img.getAttribute('src'), img.getAttribute('alt')]).toEqual([image.url, image.alt]);
    const look = screen.getByTestId('site-shop-look');
    const order = [...look.children].map((el) => el.className || el.tagName);
    expect(order.indexOf('site-shop__image')).toBeLessThan(order.indexOf('site-shop__caption'));
    one.unmount();

    fetchMock.mockImplementation(() => reply(200, { look: { ...LOOK.look, image: null } }));
    renderAt('/shop-the-look/Ab3_k9-Zq1Lm');
    await screen.findByTestId('site-shop-look');
    expect(screen.queryByTestId('site-shop-image')).toBeNull();
  });
});
