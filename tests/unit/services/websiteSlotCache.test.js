/**
 * How long caches may keep what the website stores (Evoni, 2026-11-15).
 * Site media (slots, posters, captions, recap images) is written as it
 * always was: a year, immutable. A Shop the Look image is written for one
 * hour and without "immutable", so a copy she withdraws ages out of the CDN
 * and browsers within the hour. A shorter cache does not revoke access: an
 * object that can still be fetched is still public.
 */
const mockSend = jest.fn().mockResolvedValue({});
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

const slots = require('../../../src/services/websiteSlotService');

const CFG = { bucket: 'site-test-bucket', prefix: 'site-public', region: 'us-east-1' };
const sent = () => mockSend.mock.calls.map(([command]) => command.input);

describe('what caches may keep of the website\'s stored media', () => {
  beforeEach(() => mockSend.mockClear());

  test('the two lifetimes', () => {
    expect(slots.CACHE_IMMUTABLE).toBe('public, max-age=31536000, immutable');
    expect(slots.CACHE_LOOK_IMAGE).toBe('public, max-age=3600');
    expect(slots.CACHE_LOOK_IMAGE).not.toMatch(/immutable/);
  });

  test('site media is stored as before when nothing is said: a year, immutable', async () => {
    await slots.putObject(CFG, 'site-public/hero/a.png', Buffer.from('x'), 'image/png');
    await slots.putObject(CFG, 'site-public/hero/b.png', Buffer.from('x'), 'image/png', {});
    expect(sent().map((i) => i.CacheControl)).toEqual([slots.CACHE_IMMUTABLE, slots.CACHE_IMMUTABLE]);
    expect(sent()[0]).toMatchObject({ Bucket: 'site-test-bucket', Key: 'site-public/hero/a.png', ContentType: 'image/png' });
  });

  test('a look image is stored for one hour', async () => {
    await slots.putObject(CFG, 'site-public/looks/k/a.png', Buffer.from('x'), 'image/png', { cacheControl: slots.CACHE_LOOK_IMAGE });
    expect(sent()[0].CacheControl).toBe('public, max-age=3600');
  });

  test('the look image is the only caller that asks for the shorter lifetime', () => {
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(__dirname, '../../../src');
    const hits = [];
    const walk = (d) => {
      for (const name of fs.readdirSync(d)) {
        const p = path.join(d, name);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (name.endsWith('.js') && fs.readFileSync(p, 'utf8').includes('CACHE_LOOK_IMAGE')) hits.push(path.relative(dir, p));
      }
    };
    walk(dir);
    expect(hits.sort()).toEqual(['services/styleSheetDistributionService.js', 'services/websiteSlotService.js']);
  });
});
