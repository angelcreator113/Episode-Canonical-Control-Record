/**
 * The thumbnail Studio's picture cache (pictureCache; Evoni, 2026-10-21:
 * make it faster): a picture read lately is not fetched again; callers
 * asking at once share one load; the oldest-used go first past the size;
 * a picture kept too long is fetched afresh; a failed load is not kept.
 */
const { createCache } = require('../../../src/services/pictureCache');

const buf = (n, fill = 1) => Buffer.alloc(n, fill);

describe('pictureCache', () => {
  test('a second ask is served from the cache; asks at once share one load', async () => {
    const cache = createCache({ maxBytes: 100 });
    const load = jest.fn(async () => buf(10));
    const [a, b] = await Promise.all([cache.get('k', load), cache.get('k', load)]);
    expect(a).toBe(b);
    await cache.get('k', load);
    expect(load).toHaveBeenCalledTimes(1);
    expect(cache.size()).toBe(10);
  });

  test('past the size, the oldest-used go first; one bigger than the whole cache is not kept', async () => {
    const cache = createCache({ maxBytes: 30 });
    await cache.get('a', async () => buf(10));
    await cache.get('b', async () => buf(10));
    await cache.get('c', async () => buf(10));
    await cache.get('a', async () => buf(10)); // a used again: b is now the oldest
    await cache.get('d', async () => buf(10));
    expect(cache.peek('b')).toBeNull();
    expect(cache.peek('a')).not.toBeNull();
    expect(cache.size()).toBe(30);
    await cache.get('huge', async () => buf(31));
    expect(cache.peek('huge')).toBeNull();
  });

  test('kept too long, it is fetched afresh; a failed load is not kept and is tried again', async () => {
    let t = 0;
    const cache = createCache({ ttlMs: 1000, now: () => t });
    const load = jest.fn(async () => buf(5));
    await cache.get('k', load);
    t = 1500;
    await cache.get('k', load);
    expect(load).toHaveBeenCalledTimes(2);
    const failing = jest.fn().mockRejectedValueOnce(new Error('S3 down')).mockResolvedValueOnce(buf(5));
    await expect(cache.get('x', failing)).rejects.toThrow('S3 down');
    await expect(cache.get('x', failing)).resolves.toHaveLength(5);
  });
});
