/**
 * YouTube thumbnails (Evoni, 2026-10-17): the style and request checks,
 * where images may come from, the title fitting, a real render (sharp,
 * 1280x720), the picture lists, the show's style, and saving as the
 * episode's primary thumbnail. No database (sequelize.query is mocked) and
 * no S3 (the client is mocked).
 */

const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: (...a) => mockSend(...a) })),
  PutObjectCommand: jest.fn((input) => ({ input })),
}));

// The upload bucket comes from the server's settings (src/services/assetBucket.js).
process.env.S3_PRIMARY_BUCKET = process.env.S3_PRIMARY_BUCKET || 'test-bucket';

const sharp = require('sharp');
const yt = require('../../../src/services/youtubeThumbnailService');

describe('readStyle and readSpec', () => {
  test('a missing or odd style falls back to the defaults', () => {
    expect(yt.readStyle(undefined)).toEqual(yt.DEFAULT_STYLE);
    expect(yt.readStyle({ layout: 'sideways', accent: 'pink', dim: 5 })).toMatchObject({ layout: 'lala-left', accent: '#E0689F', dim: 0.8 });
    expect(yt.readStyle({ layout: 'center', accent: '#b8962e', lalaUrl: 'https://b.s3.amazonaws.com/l.png' }))
      .toMatchObject({ layout: 'center', accent: '#B8962E', lalaUrl: 'https://b.s3.amazonaws.com/l.png' });
  });

  test('a request needs a title, a known layout and real colours', () => {
    expect(yt.readSpec({ title: '  Studio   by Sable ', badge: 'EP 1', kicker: 'Styling Adventures' }))
      .toMatchObject({ title: 'Studio by Sable', badge: 'EP 1', kicker: 'Styling Adventures', layout: 'lala-left' });
    expect(() => yt.readSpec({})).toThrow(/needs a title/);
    expect(() => yt.readSpec({ title: 'x', layout: 'diagonal' })).toThrow(/layout must be one of/);
    expect(() => yt.readSpec({ title: 'x', accent: 'red' })).toThrow(/accent must be a colour/);
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

describe('title fitting', () => {
  test('short titles stay big; long ones shrink to three lines, and only the longest are cut', () => {
    expect(yt.fitTitle('Day One', 610)).toEqual({ size: 112, lines: ['Day One'] });
    const mid = yt.fitTitle('Studio by Sable: The Creative Atelier', 610);
    expect(mid.lines.length).toBeLessThanOrEqual(3);
    expect(mid.lines.join(' ')).toBe('Studio by Sable: The Creative Atelier');
    const long = yt.fitTitle('Lala Meets the Host Who Changes Everything About Her Style Forever and Ever', 610);
    expect(long.size).toBe(54);
    expect(long.lines).toHaveLength(3);
    expect(long.lines[2].endsWith('…')).toBe(true);
  });

  test('the show name shrinks to fit its column', () => {
    expect(yt.kickerSize('Lala', 610)).toBe(34);
    expect(yt.kickerSize('Styling Adventures with Lala', 610)).toBeLessThan(34);
  });

  test('text is escaped in the SVG', () => {
    const svg = yt.textSvg(yt.readSpec({ title: 'Tea & <Toast>', kicker: 'A "show"' }));
    expect(svg).toContain('Tea &amp;');
    expect(svg).toContain('&lt;Toast&gt;');
    expect(svg).toContain('A &quot;SHOW&quot;');
    expect(svg).not.toContain('<Toast>');
  });
});

describe('render', () => {
  test('a 1280x720 PNG, with and without pictures', async () => {
    const bg = await sharp({ create: { width: 1600, height: 900, channels: 3, background: '#7A2A6A' } }).jpeg().toBuffer();
    const lala = await sharp({ create: { width: 400, height: 800, channels: 4, background: { r: 224, g: 104, b: 159, alpha: 1 } } }).png().toBuffer();
    for (const layout of yt.LAYOUTS) {
      const png = await yt.render(yt.readSpec({ layout, title: 'Studio by Sable', badge: 'EP 1', kicker: 'Styling Adventures' }), { background: bg, lala });
      const meta = await sharp(png).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual(['png', 1280, 720]);
    }
    const plain = await sharp(await yt.render(yt.readSpec({ title: 'No pictures' }), {})).metadata();
    expect([plain.width, plain.height]).toEqual([1280, 720]);
  });

  test('Lala stands on her side: left layout fills the bottom-left, not the bottom-right', async () => {
    const lala = await sharp({ create: { width: 300, height: 600, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 1 } } }).png().toBuffer();
    const png = await yt.render(yt.readSpec({ layout: 'lala-left', title: 'x', dim: 0 }), { lala });
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    const px = (x, y) => { const i = (y * info.width + x) * info.channels; return [data[i], data[i + 1], data[i + 2]]; };
    expect(px(150, 650)[1]).toBeGreaterThan(200);
    expect(px(1130, 650)[1]).toBeLessThan(200);
  });

  test('with JustAWoman too, both stand on the figure side: her toward the edge, Lala in front; the text side stays clear', async () => {
    const solid = (r, g, b, w, h) => sharp({ create: { width: w, height: h, channels: 4, background: { r, g, b, alpha: 1 } } }).png().toBuffer();
    const lala = await solid(0, 255, 0, 300, 600);
    const jaw = await solid(0, 0, 255, 300, 600);
    for (const [layout, mirror] of [['lala-left', (x) => x], ['lala-right', (x) => 1279 - x]]) {
      const png = await yt.render(yt.readSpec({ layout, title: 'x', dim: 0, jawUrl: null }), { lala, jaw });
      const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
      const px = (x, y) => { const i = (y * info.width + mirror(x)) * info.channels; return [data[i], data[i + 1], data[i + 2]]; };
      expect(px(60, 650)[2]).toBeGreaterThan(200); // JustAWoman at the edge
      expect(px(390, 650)[1]).toBeGreaterThan(200); // Lala in front, in her column
      expect(px(800, 650)[1]).toBeLessThan(200); // nobody on the text side
      expect(px(800, 650)[2]).toBeLessThan(200);
    }
  });

  test('JustAWoman alone stands where Lala would; in Title only nobody stands', async () => {
    const jaw = await sharp({ create: { width: 300, height: 600, channels: 4, background: { r: 0, g: 0, b: 255, alpha: 1 } } }).png().toBuffer();
    const left = await sharp(await yt.render(yt.readSpec({ layout: 'lala-left', title: 'x', dim: 0 }), { jaw })).raw().toBuffer({ resolveWithObject: true });
    const at = ({ data, info }, x, y) => data[(y * info.width + x) * info.channels + 2];
    expect(at(left, 150, 650)).toBeGreaterThan(200);
    const center = await sharp(await yt.render(yt.readSpec({ layout: 'center', title: 'x', dim: 0 }), { jaw })).raw().toBuffer({ resolveWithObject: true });
    expect(at(center, 150, 650)).toBeLessThan(200);
  });

  test('duoPositions keeps both inside the frame, mirrored on the right', () => {
    const left = yt.duoPositions('left', { width: 360, height: 690 }, { width: 340, height: 640 });
    expect(left).toEqual({ lala: { left: 210, top: 30 }, jaw: { left: 20, top: 80 } });
    const right = yt.duoPositions('right', { width: 360, height: 690 }, { width: 340, height: 640 });
    expect(right).toEqual({ lala: { left: 1280 - 210 - 360, top: 30 }, jaw: { left: 1280 - 20 - 340, top: 80 } });
  });

  test('readSpec keeps jawUrl, and the show style never does', () => {
    expect(yt.readSpec({ title: 'x', jawUrl: 'https://b.s3.amazonaws.com/j.png' }).jawUrl).toBe('https://b.s3.amazonaws.com/j.png');
    expect(yt.readSpec({ title: 'x' }).jawUrl).toBeNull();
    expect(yt.readStyle({ jawUrl: 'https://b.s3.amazonaws.com/j.png' })).not.toHaveProperty('jawUrl');
  });

  test('an unreadable picture is a 400', async () => {
    await expect(yt.render(yt.readSpec({ title: 'x' }), { background: Buffer.from('nope') })).rejects.toMatchObject({ status: 400 });
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
      checklist: [{ text: 'Dress', checked: true }, { text: 'Shoes', checked: true }, { text: 'Accessories', checked: true }],
      edition: 'Sweater Dress Edition',
      pieces: [{ url: 'https://b.s3.amazonaws.com/d.png', label: 'Sweater dress' }],
      logoUrl: null,
    });
    expect(out.draft).toBeNull();
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
    expect(out).toMatchObject({ id: 42, url: expect.stringContaining(out.key) });
    expect(s.query.mock.calls[2][0]).toMatch(/UPDATE episodes SET thumbnail_url = :url/);
    expect(s.query.mock.calls[2][1].replacements).toEqual({ episodeId: 'ep-1', url: out.url });
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
