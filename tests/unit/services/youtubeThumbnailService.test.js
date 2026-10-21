/**
 * YouTube thumbnails (Evoni, 2026-10-17): the show's style, where images
 * may come from, the picture lists and folders, the Come Style Me
 * suggestions, uploads, the show's style, and saving as the episode's
 * primary thumbnail. (Drawing is thumbnailLayers.test.) No database (sequelize.query is mocked) and
 * no S3 (the client is mocked).
 */

const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: (...a) => mockSend(...a) })),
  PutObjectCommand: jest.fn((input) => ({ input })),
  ListObjectsV2Command: jest.fn((input) => ({ input, list: true })),
}));

// The upload bucket comes from the server's settings (src/services/assetBucket.js).
process.env.S3_PRIMARY_BUCKET = process.env.S3_PRIMARY_BUCKET || 'test-bucket';

const sharp = require('sharp');
const yt = require('../../../src/services/youtubeThumbnailService');

describe('readStyle', () => {
  test('a missing or odd style falls back to the defaults', () => {
    expect(yt.readStyle(undefined)).toEqual(yt.DEFAULT_STYLE);
    expect(yt.readStyle({ layout: 'sideways', accent: 'pink', dim: 5 })).toMatchObject({ layout: 'lala-left', accent: '#E0689F', dim: 0.8 });
    expect(yt.readStyle({ layout: 'center', accent: '#b8962e', lalaUrl: 'https://b.s3.amazonaws.com/l.png' }))
      .toMatchObject({ layout: 'center', accent: '#B8962E', lalaUrl: 'https://b.s3.amazonaws.com/l.png' });
  });
});

describe('allowedImageUrl', () => {
  test('https S3 images only', () => {
    expect(yt.allowedImageUrl('https://primepisodes-assets.s3.us-east-1.amazonaws.com/a.png')).toBe(true);
    expect(yt.allowedImageUrl('https://bucket.s3.amazonaws.com/a.png')).toBe(true);
    expect(yt.allowedImageUrl('http://bucket.s3.amazonaws.com/a.png')).toBe(false);
    expect(yt.allowedImageUrl('https://169.254.169.254/latest/meta-data')).toBe(false);
    expect(yt.allowedImageUrl('https://evil.example.com/s3.amazonaws.com.png')).toBe(false);
    expect(yt.allowedImageUrl('not a url')).toBe(false);
  });

  test('fetchImage refuses anything else before any request', async () => {
    await expect(yt.fetchImage('https://example.com/a.png')).rejects.toMatchObject({ status: 400 });
  });
});

describe('database work', () => {
  const seq = (...results) => {
    const query = jest.fn();
    results.forEach((r) => query.mockResolvedValueOnce(r));
    return { query, transaction: jest.fn(async (fn) => fn({ id: 'tx' })) };
  };

  test('sources: the episode, its show and style, and only S3 pictures', async () => {
    const s = seq(
      [[{ id: 'ep-1', title: 'Studio by Sable', episode_number: 1, show_id: 'show-1' }]],
      [[{ id: 'show-1', name: 'Styling Adventures', cover_image_url: 'https://b.s3.amazonaws.com/cover.jpg', metadata: { youtube_thumbnail: { layout: 'center' } } }]],
      [[{ url: 'https://b.s3.amazonaws.com/wide.jpg', angle: 'Wide', set_name: 'Bedroom' }, { url: 'https://elsewhere.com/x.jpg', angle: 'X' }]],
      [[{ id: 'a1', name: 'Lala cut-out', url: 'https://b.s3.amazonaws.com/lala.png' }]],
      [[{ reg: 'episode_character_poses' }]],
      [[
        { id: 'p1', character_key: 'lala', pose: 'front', is_default: true, url: 'https://b.s3.amazonaws.com/p1.png' },
        { id: 'p2', character_key: 'justawoman', pose: 'glamour', is_default: false, url: 'https://b.s3.amazonaws.com/p2.png' },
        { id: 'p3', character_key: 'lala', pose: 'side', is_default: false, url: 'https://elsewhere.com/p3.png' },
      ]],
      [[{ name: 'Lala red', asset_group: 'LALA', asset_type: 'PROMO_LALA', url: 'https://b.s3.amazonaws.com/lala.png' }]],
      [[{ reg: 'episode_wardrobe' }]],
      [[{ name: 'Sweater dress', category: 'dress', url: 'https://b.s3.amazonaws.com/d.png' }]],
      [[{ theme: 'gala', canon_consequences: { documents: { shopping_list: { items: [{ slot: 'dress' }, { slot: 'shoes' }, { slot: 'item_3' }, { slot: 'accessories' }] } } } }]],
      [[{ reg: null }]], // no named templates table yet, and no template in the show's metadata
      [[{ reg: null }]], // no drafts table yet: no draft
    );
    const out = await yt.sources(s, 'ep-1');
    expect(out.poses).toEqual({
      lala: [{ id: 'p1', url: 'https://b.s3.amazonaws.com/p1.png', pose: 'front', label: 'Front ★', isDefault: true }],
      justawoman: [{ id: 'p2', url: 'https://b.s3.amazonaws.com/p2.png', pose: 'glamour', label: 'Glamour', isDefault: false }],
    });
    expect(s.query.mock.calls[5][0]).toMatch(/status = 'ready' AND final_url IS NOT NULL/);
    expect(out.episode).toEqual({ id: 'ep-1', title: 'Studio by Sable', episode_number: 1 });
    expect(out.show).toEqual({ id: 'show-1', name: 'Styling Adventures' });
    expect(out.style.layout).toBe('center');
    expect(out.backgrounds).toEqual([
      { url: 'https://b.s3.amazonaws.com/wide.jpg', label: 'Bedroom · Wide' },
      { url: 'https://b.s3.amazonaws.com/cover.jpg', label: 'Show cover' },
    ]);
    expect(out.cutouts).toEqual([{ id: 'a1', url: 'https://b.s3.amazonaws.com/lala.png', label: 'Lala cut-out' }]);
    expect(s.query.mock.calls[3][0]).not.toMatch(/s3_url_no_bg/);
    expect(s.query.mock.calls[3][0]).toMatch(/asset_type IS DISTINCT FROM 'DOCUMENT_OVERLAY'/);
    expect(out.folders.map((f) => f.key)).toEqual(['scene-sets', 'poses', 'outfit', 'library']);
    // The "Come Style Me" suggestions: the shopping list's slots, the dress's edition, the pieces.
    expect(out.suggest).toEqual({
      // The main piece by its name, the rest by their kind.
      checklist: [{ text: 'Sweater dress', checked: true }, { text: 'Shoes', checked: true }, { text: 'Accessories', checked: true }],
      edition: 'Sweater Dress Edition',
      pieces: [{ url: 'https://b.s3.amazonaws.com/d.png', label: 'Sweater dress' }],
      logoUrl: null,
    });
    expect(out.draft).toBeNull();
    expect(out.templates).toEqual([]);
    expect(out.template).toBeNull();
  });

  test('uploads: the name rides in the key and comes back as the label; listed newest first; a listing that fails is empty', async () => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({});
    const up = await yt.uploadPicture('ep-1', await sharp({ create: { width: 8, height: 8, channels: 3, background: '#123456' } }).png().toBuffer(), 'Red Sweater (final).PNG');
    expect(up.url).toMatch(/\/episodes\/ep-1\/thumbnail-pictures\/\d+-\w+--red-sweater-final\.png$/);
    expect(up.label).toBe('Red sweater final');
    expect(yt.labelOfUpload('episodes/e/thumbnail-pictures/1-abc.png')).toBe('Upload');
    mockSend.mockResolvedValueOnce({ Contents: [
      { Key: 'episodes/ep-1/thumbnail-pictures/1-a--old-one.png', LastModified: '2026-10-01T00:00:00Z' },
      { Key: 'episodes/ep-1/thumbnail-pictures/2-b--new-one.jpg', LastModified: '2026-10-21T00:00:00Z' },
      { Key: 'episodes/ep-1/thumbnail-pictures/notes.txt', LastModified: '2026-10-22T00:00:00Z' },
    ] });
    const list = await yt.listUploads('ep-1');
    expect(list.map((u) => u.label)).toEqual(['New one', 'Old one']);
    expect(mockSend.mock.calls.at(-1)[0].input).toMatchObject({ Prefix: 'episodes/ep-1/thumbnail-pictures/' });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockSend.mockRejectedValueOnce(new Error('AccessDenied'));
    await expect(yt.listUploads('ep-1')).resolves.toEqual([]);
    mockSend.mockReset();
  });

  test('layoutSuggestions: from the outfit, then the defaults; the event\'s theme names the edition; the show\'s logo', async () => {
    const outfit = [{ url: 'https://b.s3.amazonaws.com/b.png', label: 'chain bag', category: 'handbag' }];
    const noEvent = await yt.layoutSuggestions(seq([[]]), 'ep-1', outfit, { metadata: { logo: { url: 'https://b.s3.amazonaws.com/logo.png' } } });
    expect(noEvent.checklist.map((r) => r.text)).toEqual(['Handbag', 'Hair', 'Vibe']);
    expect(noEvent.edition).toBe('Chain Bag Edition');
    expect(noEvent.logoUrl).toBe('https://b.s3.amazonaws.com/logo.png');
    const bare = await yt.layoutSuggestions(seq([[{ theme: 'garden_party', canon_consequences: null }]]), 'ep-1', [], null);
    expect(bare).toEqual({
      checklist: ['Outfit', 'Accessories', 'Hair', 'Vibe'].map((text) => ({ text, checked: true })),
      edition: 'Garden Party Edition', pieces: [], logoUrl: null,
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const broken = { query: jest.fn().mockRejectedValue(new Error('no table')) };
    expect((await yt.layoutSuggestions(broken, 'ep-1', [], null)).checklist).toHaveLength(4);
  });

  test('pictureFolders: by where each picture comes from; empty folders left out; only S3 pictures', () => {
    const tree = yt.pictureFolders({
      angles: [
        { url: 'https://b.s3.amazonaws.com/w.jpg', angle: 'Wide', set_name: 'Library' },
        { url: 'https://b.s3.amazonaws.com/c.jpg', angle: 'Close', set_name: 'Library' },
        { url: 'https://b.s3.amazonaws.com/b.jpg', angle: 'Wide', set_name: 'Bedroom' },
        { url: 'https://elsewhere.com/x.jpg', angle: 'X', set_name: 'Elsewhere' },
      ],
      cover: 'https://b.s3.amazonaws.com/cover.jpg',
      poses: { lala: [{ url: 'https://b.s3.amazonaws.com/p1.png', pose: 'glamour', label: 'Glamour ★', isDefault: true }], justawoman: [] },
      outfit: [
        { url: 'https://b.s3.amazonaws.com/d.png', label: 'Sweater dress', category: 'dress' },
        { url: 'https://b.s3.amazonaws.com/bag.png', label: 'Chain bag', category: 'handbag' },
        { url: 'https://b.s3.amazonaws.com/o.png', label: 'Thing', category: null },
      ],
      library: [
        { url: 'https://b.s3.amazonaws.com/l.png', label: 'Lala red', asset_group: 'LALA', asset_type: 'PROMO_LALA' },
        { url: 'https://b.s3.amazonaws.com/g.png', label: 'Guest', asset_group: 'GUEST', asset_type: 'PROMO_GUEST' },
        { url: 'https://b.s3.amazonaws.com/list.png', label: 'Shopping list', asset_group: 'EPISODE', asset_type: 'DOCUMENT_OVERLAY' },
      ],
    });
    const shape = (f) => [f.label, ...(f.folders ? [f.folders.map(shape)] : []), ...(f.items ? [f.items.map((i) => i.label)] : [])];
    expect(tree.map(shape)).toEqual([
      ['Scene sets', [['Library', ['Wide', 'Close']], ['Bedroom', ['Wide']], ['Show', ['Show cover']]]],
      ['Character poses', [['Lala', [['Glamour', ['Glamour ★']]]]]],
      ["This episode's outfit", [['Dress', ['Sweater dress']], ['Handbag', ['Chain bag']], ['Other', ['Thing']]]],
      ['Asset library', [['Lala', ['Lala red']], ['Guests', ['Guest']]]],
      ['Documents', ['Shopping list']],
    ]);
    expect(tree[1].folders[0].folders[0]).toEqual({ key: 'poses/lala/glamour', label: 'Glamour', items: [{ url: 'https://b.s3.amazonaws.com/p1.png', label: 'Glamour ★', isDefault: true }] });
    expect(tree[0].folders[0].key).toBe('scene-sets/library');
    expect(yt.pictureFolders({})).toEqual([]);
  });

  test('readyPoses: empty lists until the poses table exists, with no query of it', async () => {
    const s = seq([[{ reg: null }]]);
    await expect(yt.readyPoses(s, 'ep-1')).resolves.toEqual({ lala: [], justawoman: [] });
    expect(s.query).toHaveBeenCalledTimes(1);
  });

  test('sources: an unknown episode is a 404', async () => {
    await expect(yt.sources(seq([[]]), 'nope')).rejects.toMatchObject({ status: 404 });
  });

  test('saveStyle merges into the show\'s metadata; a foreign Lala image is refused', async () => {
    const s = seq([[{ id: 'show-1' }]]);
    await expect(yt.saveStyle(s, 'show-1', { layout: 'lala-right', accent: '#B8962E' })).resolves.toMatchObject({ layout: 'lala-right', accent: '#B8962E' });
    expect(s.query.mock.calls[0][0]).toMatch(/jsonb_set\(COALESCE\(metadata::jsonb/);
    await expect(yt.saveStyle(seq(), 'show-1', { lalaUrl: 'https://example.com/l.png' })).rejects.toMatchObject({ status: 400 });
    await expect(yt.saveStyle(seq([[]]), 'gone', {})).rejects.toMatchObject({ status: 404 });
  });

  test('saveAsPrimary uploads the PNG, turns the old primary into a cover, and adds the new one with migrated columns only', async () => {
    mockSend.mockResolvedValue({});
    const s = seq([[]], [[{ id: 42 }]], [[]]);
    const out = await yt.saveAsPrimary(s, 'ep-1', Buffer.from('png'));
    expect(mockSend.mock.calls[0][0].input).toMatchObject({ Key: expect.stringMatching(/^episodes\/ep-1\/thumbnails\/youtube-\d+\.png$/), ContentType: 'image/png' });
    expect(s.query.mock.calls[0][0]).toMatch(/SET "thumbnailType" = 'cover'/);
    const insert = s.query.mock.calls[1][0];
    expect(insert).toMatch(/INSERT INTO thumbnails/);
    expect(insert).not.toMatch(/isPrimary|publishStatus/);
    // format is the migration's enum (thumbnail, poster, cover): 'png' is refused there.
    expect(insert).toMatch(/'thumbnail', 'primary'/);
    expect(out).toMatchObject({ id: 42, url: expect.stringContaining(out.key), type: 'png', bytes: 3 });
    expect(s.query.mock.calls[2][0]).toMatch(/UPDATE episodes SET thumbnail_url = :url/);
    expect(s.query.mock.calls[2][1].replacements).toEqual({ episodeId: 'ep-1', url: out.url });
  });

  // YouTube refuses a custom thumbnail over 2 MB (Evoni, 2026-10-21).
  const noise = (w, h) => sharp(require('crypto').randomBytes(w * h * 3), { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();

  test('forYouTube: a PNG within 2 MB stays a PNG; a bigger one becomes the best JPEG under 2 MB', async () => {
    const small = await sharp({ create: { width: 1280, height: 720, channels: 3, background: '#336699' } }).png().toBuffer();
    expect(await yt.forYouTube(small)).toMatchObject({ type: 'png', mime: 'image/png', ext: 'png', bytes: small.length });
    const big = await noise(1280, 720);
    expect(big.length).toBeGreaterThan(yt.YOUTUBE_MAX_BYTES);
    const out = await yt.forYouTube(big);
    expect(out).toMatchObject({ type: 'jpeg', mime: 'image/jpeg', ext: 'jpg', pngBytes: big.length });
    expect(out.bytes).toBeLessThanOrEqual(yt.YOUTUBE_MAX_BYTES);
    expect(await sharp(out.buffer).metadata()).toMatchObject({ format: 'jpeg', width: 1280, height: 720 });
  });

  test('saveAsPrimary saves a PNG over 2 MB as a JPEG, with its own type and size', async () => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({});
    const s = seq([[]], [[{ id: 43 }]], [[]]);
    const out = await yt.saveAsPrimary(s, 'ep-1', await noise(1280, 720));
    expect(mockSend.mock.calls[0][0].input).toMatchObject({ Key: expect.stringMatching(/\.jpg$/), ContentType: 'image/jpeg' });
    expect(out).toMatchObject({ type: 'jpeg', bytes: expect.any(Number) });
    expect(out.bytes).toBeLessThanOrEqual(yt.YOUTUBE_MAX_BYTES);
    expect(s.query.mock.calls[1][1].replacements).toMatchObject({ mime: 'image/jpeg', size: out.bytes });
  });

  test('listSaved: the current one first, with a URL from the S3 key when the row has none', async () => {
    const s = seq([[
      { id: 9, s3Bucket: 'b', s3Key: 'episodes/ep-1/thumbnails/a.png', url: null, thumbnailType: 'primary', widthPixels: 1280, heightPixels: 720, generatedAt: '2026-10-20' },
      { id: 8, s3Bucket: 'b', s3Key: 'k', url: 'https://b.s3.amazonaws.com/old.png', thumbnailType: 'cover' },
    ]]);
    const out = await yt.listSaved(s, 'ep-1');
    expect(out[0]).toMatchObject({ id: 9, isPrimary: true, url: 'https://b.s3.us-east-1.amazonaws.com/episodes/ep-1/thumbnails/a.png', width: 1280 });
    expect(out[1]).toMatchObject({ id: 8, isPrimary: false, url: 'https://b.s3.amazonaws.com/old.png' });
    expect(s.query.mock.calls[0][0]).toMatch(/ORDER BY \("thumbnailType" = 'primary'\) DESC/);
    expect(s.query.mock.calls[0][0]).not.toMatch(/isPrimary|publishStatus/);
  });

  test('makePrimary: the old one becomes a cover, this one primary, and the episode points at it', async () => {
    const s = seq([[{ id: 8, s3Bucket: 'b', s3Key: 'k', url: 'https://b.s3.amazonaws.com/old.png', thumbnailType: 'cover' }]], [[]], [[]], [[]]);
    await expect(yt.makePrimary(s, 'ep-1', '8')).resolves.toEqual({ id: 8, url: 'https://b.s3.amazonaws.com/old.png' });
    expect(s.transaction).toHaveBeenCalled();
    expect(s.query.mock.calls[1][0]).toMatch(/SET "thumbnailType" = 'cover'[\s\S]*id <> :thumbnailId/);
    expect(s.query.mock.calls[2][0]).toMatch(/SET "thumbnailType" = 'primary' WHERE id = :thumbnailId/);
    expect(s.query.mock.calls[3][0]).toMatch(/UPDATE episodes SET thumbnail_url/);
  });

  test('makePrimary: another episode\'s thumbnail is a 404, and a non-number id a 400', async () => {
    await expect(yt.makePrimary(seq([[]]), 'ep-1', '8')).rejects.toMatchObject({ status: 404 });
    await expect(yt.makePrimary(seq(), 'ep-1', '8; DROP')).rejects.toMatchObject({ status: 400 });
  });

  test('removeSaved deletes an older one and refuses the current one', async () => {
    const older = seq([[{ id: 8, thumbnailType: 'cover' }]], [[]]);
    await expect(yt.removeSaved(older, 'ep-1', '8')).resolves.toEqual({ id: 8 });
    expect(older.query.mock.calls[1][0]).toMatch(/DELETE FROM thumbnails WHERE id = :thumbnailId AND "episodeId" = :episodeId/);
    const current = seq([[{ id: 9, thumbnailType: 'primary' }]]);
    await expect(yt.removeSaved(current, 'ep-1', '9')).rejects.toMatchObject({ status: 409 });
    expect(current.query).toHaveBeenCalledTimes(1);
  });
});
