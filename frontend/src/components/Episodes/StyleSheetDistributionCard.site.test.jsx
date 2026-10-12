/**
 * Distribution → Style sheet → Show on the website (Task 3022; the server is
 * #3021): the switch is off and says why until the Shop the Look links are
 * included and a piece has one; on publishes, off takes down; a published
 * look links to its page, and says it is hidden while the links are off.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import api from '../../services/api';
import StyleSheetDistributionCard, { siteBlocker } from './StyleSheetDistributionCard';

const EP = 'ep-1';
const SITE_URL = `/api/v1/episodes/${EP}/style-sheet/distribution/site`;
const LINKS = [{ piece_id: 'w1', label: 'Pump', retailer: null, url: 'https://shop.example/pump', affiliate: false }];
const entry = (over = {}) => ({
  sent: true, sent_at: '2026-10-10T20:00:00.000Z', out_of_date: false, items: [], caption: 'Hi', caption_max: 2200,
  include_shop_links: true, shop_links: LINKS, disclosure: null, disclosure_locked: false, post_text: 'Hi',
  site: { published: false }, ...over,
});
const PUBLISHED = { published: true, published_at: '2026-10-12T20:00:00.000Z', key: 'Ab3_k9-Zq1Lm', path: '/shop-the-look/Ab3_k9-Zq1Lm', showing: true };

const renderCard = async (data) => {
  api.get.mockResolvedValue({ data: { data } });
  render(<StyleSheetDistributionCard episodeId={EP} episodeNumber={1} />);
  return within(await screen.findByTestId('ssd-site'));
};
const theSwitch = (site) => site.getByRole('switch', { name: 'Show on the website' });

beforeEach(() => { vi.clearAllMocks(); });

describe('Show on the website', () => {
  test('siteBlocker: links off, then no link, then nothing in the way', () => {
    expect(siteBlocker(entry({ include_shop_links: false }))).toMatch(/Include the Shop the Look links/);
    expect(siteBlocker(entry({ shop_links: [] }))).toMatch(/Add a real-world link/);
    expect(siteBlocker(entry())).toBeNull();
  });

  test('off and disabled, with the reason, until the links are included and there is one', async () => {
    const site = await renderCard(entry({ include_shop_links: false }));
    expect(theSwitch(site).checked).toBe(false);
    expect(theSwitch(site).disabled).toBe(true);
    expect(site.getByText('Include the Shop the Look links to put this look on the website.')).toBeTruthy();
  });

  test('on publishes the look and then links to its page', async () => {
    api.post.mockResolvedValue({ data: { data: entry({ site: PUBLISHED }) } });
    const site = await renderCard(entry());
    expect(theSwitch(site).disabled).toBe(false);
    fireEvent.click(theSwitch(site));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(SITE_URL));
    const link = await site.findByRole('link', { name: '/shop-the-look/Ab3_k9-Zq1Lm' });
    expect(link.getAttribute('href')).toBe('/shop-the-look/Ab3_k9-Zq1Lm');
    expect(theSwitch(site).checked).toBe(true);
  });

  test('off takes it down', async () => {
    api.delete.mockResolvedValue({ data: { data: entry() } });
    const site = await renderCard(entry({ site: PUBLISHED }));
    expect(theSwitch(site).checked).toBe(true);
    fireEvent.click(theSwitch(site));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith(SITE_URL));
    await waitFor(() => expect(theSwitch(site).checked).toBe(false));
  });

  test('published but hidden while the links are off; it can still be taken down', async () => {
    const site = await renderCard(entry({ include_shop_links: false, site: { ...PUBLISHED, showing: false } }));
    expect(site.getByText('Hidden on the website while the Shop the Look links are off.')).toBeTruthy();
    expect(site.queryByRole('link')).toBeNull();
    expect(theSwitch(site).disabled).toBe(false);
  });

  test("a refusal shows the server's message", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    api.post.mockRejectedValue({ response: { status: 409, data: { error: "None of the look's pieces has a real-world link yet.", code: 'NO_LINKS' } } });
    const site = await renderCard(entry());
    fireEvent.click(theSwitch(site));
    expect((await screen.findByRole('alert')).textContent).toMatch(/real-world link/);
  });
});
