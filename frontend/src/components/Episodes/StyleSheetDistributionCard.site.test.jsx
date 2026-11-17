/**
 * Distribution → Style sheet → Show on the website (Task 3022; the server is
 * #3021): the switch is off and says why until the Shop the Look links are
 * included and a piece has one; on publishes, off takes down; a published
 * look links to its page, and says it is hidden while the links are off.
 */
import { vi, describe, beforeEach, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';

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
  site: { published: false },
  // What she reviews before publishing: the piece (the studio's name for it) and its real product as Wardrobe has it.
  site_review: [{ piece_id: 'w1', piece: 'Crimson Pump', category: 'shoes', real_brand: 'Maison Rouge', real_product_name: 'Satin Ballet Pump', retailer: 'Nordstrom', url: 'https://shop.example/pump', affiliate: false, missing: [] }],
  ...over,
});
const CONFIRMED = [{ piece_id: 'w1', real_brand: 'Maison Rouge', real_product_name: 'Satin Ballet Pump', retailer: 'Nordstrom', url: 'https://shop.example/pump', affiliate: false, match: 'exact', confirmed: true }];
/** Tick "I opened this link and it is the right product" on every product in the review, then publish. */
const confirmAndPublish = (site, name = 'Put on the website') => {
  for (const box of site.getAllByRole('checkbox', { name: 'I opened this link and it is the right product' })) fireEvent.click(box);
  fireEvent.click(site.getByRole('button', { name }));
};
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
    // The switch opens her review; nothing is published until she has checked each product.
    fireEvent.click(theSwitch(site));
    expect(api.post).not.toHaveBeenCalled();
    expect(site.getByRole('button', { name: 'Put on the website' }).disabled).toBe(true);
    expect(site.getByTestId('ssd-review-blocker').textContent).toMatch(/Crimson Pump: open the link/);
    confirmAndPublish(site);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(SITE_URL, { links: CONFIRMED, image_rights: { category: 'unknown' } }));
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
    confirmAndPublish(site);
    expect((await screen.findByRole('alert')).textContent).toMatch(/real-world link/);
    // Refused: the review stays open with what she entered.
    expect(site.getByTestId('ssd-site-review')).toBeTruthy();
  });

  test('the look image: on the site says nothing; failed or none says so and publishing again tries (Task 3120)', async () => {
    const onSite = await renderCard(entry({ site: { ...PUBLISHED, image: 'on_site' } }));
    expect(onSite.queryByTestId('ssd-site-image')).toBeNull();
    cleanup();

    api.post.mockResolvedValue({ data: { data: entry({ site: { ...PUBLISHED, image: 'on_site' } }) } });
    const failed = await renderCard(entry({ site: { ...PUBLISHED, image: 'failed' } }));
    expect(failed.getByText('The look image could not be copied to the website.')).toBeTruthy();
    fireEvent.click(failed.getByRole('button', { name: 'Try the look image again' }));
    confirmAndPublish(failed, 'Publish again');
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(SITE_URL, { links: CONFIRMED, image_rights: { category: 'unknown' } }));
    await waitFor(() => expect(failed.queryByTestId('ssd-site-image')).toBeNull());
    expect(theSwitch(failed).checked).toBe(true);
    cleanup();

    const none = await renderCard(entry({ site: { ...PUBLISHED, image: 'none' } }));
    expect(none.getByText('No look image on the website yet; it needs the website storage set up.')).toBeTruthy();
    expect(none.getByRole('button', { name: 'Add the look image' })).toBeTruthy();
  });
  test('published before its episode is released: no link to the page, it says it is waiting (Evoni, 2026-11-15)', async () => {
    const waiting = await renderCard(entry({ site: { ...PUBLISHED, released: false } }));
    expect(theSwitch(waiting).checked).toBe(true);
    expect(waiting.getByTestId('ssd-site-waiting').textContent).toBe('Ready for the website. It appears there once this episode is published.');
    expect(waiting.queryByRole('link', { name: '/shop-the-look/Ab3_k9-Zq1Lm' })).toBeNull();
    cleanup();
    const out = await renderCard(entry({ site: { ...PUBLISHED, released: true } }));
    expect(out.getByRole('link', { name: '/shop-the-look/Ab3_k9-Zq1Lm' })).toBeTruthy();
    expect(out.queryByTestId('ssd-site-waiting')).toBeNull();
  });
  test('the review: a product needs its real brand, product, retailer, an https link and her tick; a piece left out is not sent', async () => {
    api.post.mockResolvedValue({ data: { data: entry({ site: PUBLISHED }) } });
    const two = entry({ site_review: [
      ...entry().site_review,
      { piece_id: 'w2', piece: 'Bloom Studs', category: 'jewelry', real_brand: null, real_product_name: null, retailer: null, url: null, affiliate: false, missing: ['real_brand', 'real_product_name', 'retailer', 'url'] },
    ] });
    const site = await renderCard(two);
    fireEvent.click(theSwitch(site));
    const pump = within(site.getByTestId('ssd-review-w1'));
    const studs = within(site.getByTestId('ssd-review-w2'));
    // The piece with no product starts left out: no fields, nothing made up for it.
    expect(studs.getByRole('checkbox', { name: 'It can be bought' }).checked).toBe(false);
    expect(studs.queryByLabelText('Link (https)')).toBeNull();

    fireEvent.change(pump.getByLabelText('Link (https)'), { target: { value: 'http://shop.example/pump' } });
    expect(site.getByTestId('ssd-review-blocker').textContent).toMatch(/must start with https/);
    fireEvent.change(pump.getByLabelText('Link (https)'), { target: { value: 'https://zappos.example/felicia' } });
    fireEvent.change(pump.getByLabelText('Real brand'), { target: { value: '' } });
    expect(site.getByTestId('ssd-review-blocker').textContent).toMatch(/add the real brand/);
    fireEvent.change(pump.getByLabelText('Real brand'), { target: { value: 'Sam Edelman' } });
    fireEvent.change(pump.getByLabelText('This product is'), { target: { value: 'similar' } });
    fireEvent.click(pump.getByRole('checkbox', { name: 'I opened this link and it is the right product' }));
    // Changing a product after ticking un-ticks it: she confirms what is sent.
    fireEvent.change(pump.getByLabelText('Retailer'), { target: { value: 'Zappos' } });
    expect(site.getByRole('button', { name: 'Put on the website' }).disabled).toBe(true);
    confirmAndPublish(site);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(SITE_URL, { links: [
      { piece_id: 'w1', real_brand: 'Sam Edelman', real_product_name: 'Satin Ballet Pump', retailer: 'Zappos', url: 'https://zappos.example/felicia', affiliate: false, match: 'similar', confirmed: true },
    ], image_rights: { category: 'unknown' } }));
  });

  test('published: what differs is said, with the review again; a product is marked no longer available, and back', async () => {
    const links = [
      { piece_id: 'w1', label: 'Sam Edelman Felicia Flat', real_brand: 'Sam Edelman', real_product_name: 'Felicia Flat', retailer: 'Zappos', url: 'https://zappos.example/felicia', affiliate: false, match: 'similar', status: 'available', available: true },
      { piece_id: 'w2', label: 'Jewelry', real_brand: null, real_product_name: null, retailer: null, url: null, affiliate: false, match: null, status: 'unavailable', available: false },
    ];
    api.patch.mockResolvedValue({ data: { data: entry({ site: { ...PUBLISHED, links: [{ ...links[0], status: 'unavailable', available: false }, links[1]], differs: [] } }) } });
    const site = await renderCard(entry({ site: { ...PUBLISHED, links, differs: ['pieces', 'image'] } }));
    expect(site.getByTestId('ssd-site-differs').textContent).toMatch(/still shows the look as you published it\. The look has different pieces now\. The image is of an earlier sheet\./);
    const list = within(site.getByTestId('ssd-site-links'));
    expect(list.getByText('Similar')).toBeTruthy();
    // The piece published without a product has nothing to switch.
    expect(list.getAllByRole('button')).toHaveLength(1);
    fireEvent.click(list.getByRole('button', { name: 'Mark as no longer available' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(`${SITE_URL}/links`, { piece_id: 'w1', available: false }));
    expect(await site.findByRole('button', { name: 'Available again' })).toBeTruthy();
    expect(site.queryByTestId('ssd-site-differs')).toBeNull();

    // The review starts from what is published, unconfirmed.
    cleanup();
    const again = await renderCard(entry({ site: { ...PUBLISHED, links, differs: ['links'] } }));
    fireEvent.click(again.getByRole('button', { name: 'Review and publish again' }));
    const pump = within(again.getByTestId('ssd-review-w1'));
    expect(pump.getByLabelText('Real brand').value).toBe('Sam Edelman');
    expect(pump.getByLabelText('This product is').value).toBe('similar');
    expect(pump.getByRole('checkbox', { name: 'I opened this link and it is the right product' }).checked).toBe(false);
  });
  test('the look image: not cleared unless she says so; a cleared category is sent with its note; the choice never carries over', async () => {
    api.post.mockResolvedValue({ data: { data: entry({ site: { ...PUBLISHED, image: 'on_site', image_rights: { category: 'licensed', label: 'Licensed image — permission held', cleared: true, declared_by: 'evoni@site.dev', stale: false } } }) } });
    const site = await renderCard(entry());
    fireEvent.click(theSwitch(site));
    const image = within(site.getByTestId('ssd-review-image'));
    const choice = image.getByLabelText('This image is');
    // Five categories, and it starts on the one that publishes no image.
    expect([...choice.options].map((o) => [o.value, o.textContent])).toEqual([
      ['unknown', 'Unknown / not cleared'],
      ['original', 'Original photograph — owned or controlled'],
      ['licensed', 'Licensed image — permission held'],
      ['retailer', 'Retailer image — permission held'],
      ['ai_cleared', 'AI-generated image — cleared for public use'],
    ]);
    expect(choice.value).toBe('unknown');
    expect(image.getByTestId('ssd-review-image-hint').textContent).toBe('The look will be published without its image: text and links only.');
    expect(image.queryByLabelText(/Where the permission is held/)).toBeNull();

    // Her own photograph needs no note; a licensed, retailer or AI image may carry where the permission is held.
    fireEvent.change(choice, { target: { value: 'original' } });
    expect(image.queryByLabelText(/Where the permission is held/)).toBeNull();
    expect(image.getByTestId('ssd-review-image-hint').textContent).toMatch(/You are declaring that this image may be shown publicly/);
    for (const category of ['retailer', 'ai_cleared', 'licensed']) {
      fireEvent.change(choice, { target: { value: category } });
      expect(image.getByLabelText(/Where the permission is held/)).toBeTruthy();
    }
    fireEvent.change(image.getByLabelText(/Where the permission is held/), { target: { value: '  Licence LIC-2291  ' } });
    confirmAndPublish(site);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(SITE_URL, { links: CONFIRMED, image_rights: { category: 'licensed', note: 'Licence LIC-2291' } }));
    expect((await site.findByTestId('ssd-site-image-rights')).textContent).toMatch(/Image on the website: Licensed image — permission held, declared by evoni@site\.dev\./);

    // Reviewing again starts from "not cleared": the next image needs its own declaration.
    fireEvent.click(site.getByRole('button', { name: 'Review and publish again' }));
    expect(within(site.getByTestId('ssd-review-image')).getByLabelText('This image is').value).toBe('unknown');
  });

  test('published without a cleared image says so; a declaration the poses have outgrown says to review', async () => {
    const plain = await renderCard(entry({ site: { ...PUBLISHED, image: 'not_cleared', image_rights: null } }));
    expect(plain.getByTestId('ssd-site-image').textContent).toMatch(/on the website without its image: the image has not been cleared for public use\./);
    expect(plain.queryByTestId('ssd-site-image-rights')).toBeNull();
    cleanup();
    const stale = await renderCard(entry({ site: { ...PUBLISHED, image: 'on_site', image_rights: { category: 'original', label: 'Original photograph — owned or controlled', cleared: true, declared_by: 'evoni@site.dev', stale: true } } }));
    expect(stale.getByTestId('ssd-site-image-rights').textContent).toMatch(/The poses or the sheet have changed since: review and publish again to show the new image\./);
  });
});
