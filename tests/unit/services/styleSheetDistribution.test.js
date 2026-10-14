/**
 * The caption draft and the post text for the style sheet in Distribution
 * (Task #2878): only what canon holds, nothing invented; the disclosure
 * leads, then her caption, then the Shop the Look links.
 */
jest.mock('../../../src/services/episodeLookbookService', () => ({ LookbookError: class extends Error {} }));

const {
  captionDraft, postText, parseMetadata, DISCLOSURE, AMAZON_DISCLOSURE, isAmazonUrl, disclosureFor,
} = require('../../../src/services/styleSheetDistributionService');

describe('style sheet in Distribution: text', () => {
  test('the caption draft is the episode, the event and its host, the tagline', () => {
    expect(captionDraft({
      episode: { number: 1, title: 'Wearable Experiments' },
      event: { name: 'Wearable Experiments Studio Session', host: 'STUDIO BY SABLE' },
      tagline: 'Dressed for the experiment.',
    })).toBe('Episode 01: Wearable Experiments\n\nWearable Experiments Studio Session · STUDIO BY SABLE\n\nDressed for the experiment.');
  });

  test('a value canon does not hold is left out, never invented', () => {
    expect(captionDraft({ episode: { number: 3, title: null }, event: null, tagline: '  ' })).toBe('Episode 03');
    expect(captionDraft({ episode: {}, event: { name: 'Gala', host: null }, tagline: null })).toBe('Gala');
    expect(captionDraft({})).toBe('');
  });

  test('the post text: disclosure, caption, then the links', () => {
    const links = [{ label: 'Satin Pump', url: 'https://shop.example/pump' }, { label: 'Studs', url: 'https://aff.example/studs' }];
    expect(postText('Studio night.', links, DISCLOSURE)).toBe(
      `${DISCLOSURE}\n\nStudio night.\n\nShop the Look\nSatin Pump: https://shop.example/pump\nStuds: https://aff.example/studs`);
    expect(postText('Studio night.', [], null)).toBe('Studio night.');
    expect(postText('', links.slice(0, 1), null)).toBe('Shop the Look\nSatin Pump: https://shop.example/pump');
  });

  test('Amazon links by hostname: Amazon country sites, subdomains and short links; never a substring', () => {
    for (const u of ['https://www.amazon.com/dp/B0?tag=lala-20', 'https://amazon.co.uk/x', 'https://smile.amazon.com/x',
      'https://www.amazon.com.au/x', 'https://AMAZON.DE/x', 'https://amzn.to/3abc', 'https://amzn.eu/d/x', 'https://a.co/d/x']) {
      expect([u, isAmazonUrl(u)]).toEqual([u, true]);
    }
    for (const u of ['https://notamazon.com/x', 'https://amazon.example.com/x', 'https://shop.example/amazon',
      'https://shop.example/?r=amazon.com', 'https://amazon.com.evil.example/x', 'not a url', '', null]) {
      expect([u, isAmazonUrl(u)]).toEqual([u, false]);
    }
  });

  test('the disclosure: the affiliate sentence whenever links are included, then the Amazon one (Task #3170)', () => {
    const plain = { label: 'Pump', url: 'https://shop.example/pump', affiliate: false };
    const amazon = { label: 'Studs', url: 'https://www.amazon.com/dp/B0', affiliate: false };
    expect(disclosureFor([])).toBeNull();
    expect(disclosureFor([plain])).toBe(DISCLOSURE);
    expect(disclosureFor([plain, amazon])).toBe(`${DISCLOSURE} ${AMAZON_DISCLOSURE}`);
    expect(AMAZON_DISCLOSURE).toBe('As an Amazon Associate I earn from qualifying purchases.');
    expect(postText('Studio night.', [plain, amazon], disclosureFor([plain, amazon]))).toBe(
      `${DISCLOSURE} ${AMAZON_DISCLOSURE}\n\nStudio night.\n\nShop the Look\nPump: https://shop.example/pump\nStuds: https://www.amazon.com/dp/B0`);
  });

  test('the stored record reads as an object, also when saved as a JSON string', () => {
    expect(parseMetadata({ youtube: {} })).toEqual({ youtube: {} });
    expect(parseMetadata(JSON.stringify({ tiktok: { enabled: true } }))).toEqual({ tiktok: { enabled: true } });
    expect(parseMetadata(JSON.stringify(JSON.stringify({ a: 1 })))).toEqual({ a: 1 });
    expect(parseMetadata(null)).toEqual({});
    expect(parseMetadata([1])).toEqual({});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(parseMetadata('{not json')).toEqual({});
  });
});
