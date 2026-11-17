/**
 * Drafting platform copy keeps what is not copy (Evoni, 2026-11-16), against
 * the test database.
 *
 * POST /api/v1/world/:showId/episodes/:episodeId/generate-distribution built a
 * new record from the platforms it was asked for and wrote it over
 * episodes.distribution_metadata. A published platform went back to "draft"
 * with no link, a schedule and a thumbnail were blanked, the on/off switch
 * and the caption were dropped, and a platform that was not asked for was
 * deleted. Only the style sheet entry was kept.
 *
 * Now the stored record is read and the draft is merged into it
 * (services/distributionService mergeGeneratedCopy): on a platform that has
 * an entry, only the drafted words and the show's account change; everything
 * else, and every other key, stays. The AI is stood in for.
 */
jest.unmock('uuid');
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key-not-real';

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { GENERATED_COPY_FIELDS, mergeGeneratedCopy } = require('../../src/services/distributionService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

(shouldSkip ? describe.skip : describe)('drafting platform copy keeps what is not copy', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  const ids = { show: crypto.randomUUID(), ep: crypto.randomUUID() };
  let admin;
  let ipN = 0;
  const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
  const as = (req) => { ipN += 1; return req.set('Authorization', `Bearer ${admin}`).set('X-Forwarded-For', `198.51.180.${(ipN % 200) + 1}`); };
  const url = `/api/v1/world/${ids.show}/episodes/${ids.ep}`;
  const generate = (body = {}) => as(request(app).post(`${url}/generate-distribution`)).send(body);
  const stored = async () => {
    const [[row]] = await run('SELECT distribution_metadata AS meta FROM episodes WHERE id = :ep', ids);
    return typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta;
  };
  const store = (meta) => run('UPDATE episodes SET distribution_metadata = CAST(:meta AS jsonb) WHERE id = :ep', { ...ids, meta: JSON.stringify(meta) });
  // What the AI answers: copy for each platform, marked with the draft's number.
  const draft = (n, platforms = ['youtube', 'tiktok', 'instagram', 'facebook']) => ({
    content: [{ type: 'text', text: JSON.stringify(Object.fromEntries(platforms.map((p) => [p, {
      title: `Draft ${n} title ${p}`, description: `Draft ${n} description ${p}`, hashtags: [`#draft${n}`, `#${p}`], tags: [`tag${n}`],
    }]))) }],
    usage: { input_tokens: 1, output_tokens: 1 },
  });

  const YOUTUBE = {
    enabled: true, title: 'Old title', description: 'Old description', hashtags: ['#old'], tags: ['old'],
    status: 'published', scheduled_time: '2026-11-02T18:00', platform_url: `https://youtube.test/watch?v=${tag}`,
    thumbnail_url: `https://img.test/${tag}/thumb.png`, generated_at: '2026-10-01T00:00:00.000Z', notes_for_me: 'pin the first comment',
  };
  const TIKTOK = { enabled: true, title: 'Old tiktok', description: 'Old', hashtags: [], status: 'scheduled', scheduled_time: '2026-11-20T17:30', platform_url: null, thumbnail_url: null };
  const INSTAGRAM = { enabled: true, title: '', caption: `My own caption ${tag}`, description: 'Old ig', hashtags: ['#mine'], status: 'draft', scheduled_time: null };
  const STYLE_SHEET = { sent_at: '2026-11-01T00:00:00.000Z', sheet_hash: `hash-${tag}`, caption: 'Sheet caption', items: [{ size: 'square' }], site: { key: 'AAAAAAAAAAAA', links: [] }, rev: 4 };
  const SEED = { youtube: YOUTUBE, tiktok: TIKTOK, instagram: INSTAGRAM, style_sheet: STYLE_SHEET, something_else: { kept: true } };
  const notCopy = (entry) => Object.fromEntries(Object.entries(entry).filter(([k]) => !GENERATED_COPY_FIELDS.includes(k)));

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: `admin-${tag}`, email: `admin-${tag}@dist.dev`, name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { ...ids, name: `Dist ${tag}`, slug: `dist-${tag}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep, :show, 'Gala Night', 1, 'published', NOW(), NOW())`, ids);
  });

  beforeEach(async () => { mockCreate.mockReset(); await store(SEED); });

  afterAll(async () => {
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('the rule: a platform with an entry takes only the copy fields; a new one is created; every other key stays', () => {
    const fresh = (p) => ({ title: `t ${p}`, description: `d ${p}`, hashtags: ['#n'], tags: ['n'], status: 'draft', scheduled_time: null, thumbnail_url: null, platform_url: null, generated_at: 'now', account_name: 'acct', account_url: 'url' });
    const out = mergeGeneratedCopy(SEED, { youtube: fresh('youtube'), facebook: fresh('facebook') });
    expect(notCopy(out.youtube)).toEqual(notCopy(YOUTUBE));
    expect(out.youtube).toMatchObject({ title: 't youtube', description: 'd youtube', hashtags: ['#n'], tags: ['n'], generated_at: 'now', account_name: 'acct', account_url: 'url' });
    expect(out.facebook).toEqual(fresh('facebook'));
    expect(out.tiktok).toBe(SEED.tiktok);
    expect(out.instagram).toBe(SEED.instagram);
    expect(out.style_sheet).toBe(SEED.style_sheet);
    expect(out.something_else).toEqual({ kept: true });
    // Nothing stored: the draft is the record. Something unreadable: treated as nothing.
    expect(mergeGeneratedCopy(null, { youtube: fresh('youtube') })).toEqual({ youtube: fresh('youtube') });
    expect(mergeGeneratedCopy('not an object', { youtube: fresh('youtube') })).toEqual({ youtube: fresh('youtube') });
    // An entry that is not an object is replaced by the draft.
    expect(mergeGeneratedCopy({ youtube: 'broken' }, { youtube: fresh('youtube') }).youtube).toEqual(fresh('youtube'));
  });

  test('all four: published YouTube, scheduled TikTok and Instagram\'s switch and caption are kept; Facebook is created as a draft', async () => {
    mockCreate.mockResolvedValue(draft(1));
    const res = await generate();
    expect(res.status).toBe(200);
    const after = await stored();

    // YouTube: published, with its link, schedule and thumbnail, and a field of her own.
    expect(notCopy(after.youtube)).toEqual(notCopy(YOUTUBE));
    expect(after.youtube).toMatchObject({ status: 'published', platform_url: YOUTUBE.platform_url, thumbnail_url: YOUTUBE.thumbnail_url, scheduled_time: YOUTUBE.scheduled_time, enabled: true, notes_for_me: 'pin the first comment' });
    expect(after.youtube).toMatchObject({ title: 'Draft 1 title youtube', description: 'Draft 1 description youtube', hashtags: ['#draft1', '#youtube'], tags: ['tag1'] });
    expect(after.youtube.generated_at).not.toBe(YOUTUBE.generated_at);

    // TikTok: scheduled, with its time.
    expect(notCopy(after.tiktok)).toEqual(notCopy(TIKTOK));
    expect(after.tiktok).toMatchObject({ status: 'scheduled', scheduled_time: '2026-11-20T17:30', title: 'Draft 1 title tiktok' });

    // Instagram: on, with the caption she wrote; the draft's words replace the drafted fields only.
    expect(notCopy(after.instagram)).toEqual(notCopy(INSTAGRAM));
    expect(after.instagram).toMatchObject({ enabled: true, caption: `My own caption ${tag}`, description: 'Draft 1 description instagram', hashtags: ['#draft1', '#instagram'] });

    // Facebook: never saved, so it is made as before: a draft with nothing set.
    expect(after.facebook).toMatchObject({ title: 'Draft 1 title facebook', status: 'draft', scheduled_time: null, platform_url: null, thumbnail_url: null });
    expect(after.facebook).not.toHaveProperty('enabled');

    // The answer is what is stored now, for the platforms asked for.
    expect(Object.keys(res.body.data.platforms).sort()).toEqual(['facebook', 'instagram', 'tiktok', 'youtube']);
    expect(res.body.data.platforms.youtube).toEqual(after.youtube);
    expect(res.body.data.platforms.tiktok).toEqual(after.tiktok);

    // Not a platform: untouched.
    expect(after.something_else).toEqual({ kept: true });
  });

  test('already published: drafting twice leaves the status and the link both times, and the words are the latest', async () => {
    mockCreate.mockResolvedValueOnce(draft(1)).mockResolvedValueOnce(draft(2));
    expect((await generate()).status).toBe(200);
    const once = await stored();
    expect((await generate()).status).toBe(200);
    const twice = await stored();
    for (const after of [once, twice]) {
      expect(after.youtube).toMatchObject({ status: 'published', platform_url: YOUTUBE.platform_url, thumbnail_url: YOUTUBE.thumbnail_url });
      expect(after.tiktok).toMatchObject({ status: 'scheduled', scheduled_time: '2026-11-20T17:30' });
    }
    expect(twice.youtube.title).toBe('Draft 2 title youtube');
    // Facebook, created by the first draft, is a platform with an entry by the second: only its words change.
    expect(notCopy(twice.facebook)).toEqual(notCopy(once.facebook));
    expect(twice.facebook.title).toBe('Draft 2 title facebook');
    expect(Object.keys(twice).sort()).toEqual(Object.keys(once).sort());
  });

  test('scheduled: the earliest platform schedule, which the release board reads, is the same before and after', async () => {
    const earliest = (meta) => Object.entries(meta).filter(([k]) => k !== 'style_sheet').map(([, v]) => v && v.scheduled_time).filter(Boolean).sort()[0];
    const before = earliest(await stored());
    mockCreate.mockResolvedValue(draft(1));
    await generate();
    expect(earliest(await stored())).toBe(before);
    expect(before).toBe('2026-11-02T18:00');
  });

  test('a subset: drafting for YouTube only leaves every other platform exactly as stored', async () => {
    mockCreate.mockResolvedValue(draft(3, ['youtube']));
    const res = await generate({ platforms: ['youtube'] });
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data.platforms)).toEqual(['youtube']);
    const after = await stored();
    expect(after.tiktok).toEqual(TIKTOK);
    expect(after.instagram).toEqual(INSTAGRAM);
    expect(after).not.toHaveProperty('facebook');
    expect(after.youtube.title).toBe('Draft 3 title youtube');
    expect(notCopy(after.youtube)).toEqual(notCopy(YOUTUBE));
  });

  test('the style sheet entry is the same before and after, key for key', async () => {
    mockCreate.mockResolvedValue(draft(1));
    await generate();
    expect((await stored()).style_sheet).toEqual(STYLE_SHEET);
    // And an episode that has only the style sheet keeps it and gains the platforms.
    await store({ style_sheet: STYLE_SHEET });
    await generate();
    const after = await stored();
    expect(after.style_sheet).toEqual(STYLE_SHEET);
    expect(Object.keys(after).sort()).toEqual(['facebook', 'instagram', 'style_sheet', 'tiktok', 'youtube']);
  });

  test('first use: an episode with no record gets a draft for each platform, as before', async () => {
    await run('UPDATE episodes SET distribution_metadata = NULL WHERE id = :ep', ids);
    mockCreate.mockResolvedValue(draft(1));
    const res = await generate();
    expect(res.status).toBe(200);
    const after = await stored();
    expect(Object.keys(after).sort()).toEqual(['facebook', 'instagram', 'tiktok', 'youtube']);
    for (const p of Object.keys(after)) expect(after[p]).toMatchObject({ status: 'draft', scheduled_time: null, platform_url: null, thumbnail_url: null });
    expect(after.youtube.title).toBe('Draft 1 title youtube');
  });

  test('the AI fails, or answers with no JSON: 500, and the stored record is not touched', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const before = await run('SELECT distribution_metadata AS meta, updated_at FROM episodes WHERE id = :ep', ids);
    mockCreate.mockRejectedValueOnce(new Error('the AI is unreachable'));
    expect((await generate()).status).toBe(500);
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: 'Sorry, I cannot.' }], usage: { input_tokens: 1, output_tokens: 1 } });
    expect((await generate()).status).toBe(500);
    expect(await run('SELECT distribution_metadata AS meta, updated_at FROM episodes WHERE id = :ep', ids)).toEqual(before);
  });

  test('a save made while the AI is drafting is kept: the record is read after the answer, just before the write', async () => {
    // She marks TikTok published, with its link, and saves, while the draft is still being written.
    mockCreate.mockImplementationOnce(async () => {
      const mine = { ...SEED, tiktok: { ...TIKTOK, status: 'published', platform_url: `https://tiktok.test/${tag}` }, style_sheet: undefined };
      const saved = await as(request(app).put(`${url}/distribution`)).send({ distribution_metadata: mine });
      expect(saved.status).toBe(200);
      return draft(1);
    });
    expect((await generate()).status).toBe(200);
    const after = await stored();
    expect(after.tiktok).toMatchObject({ status: 'published', platform_url: `https://tiktok.test/${tag}`, scheduled_time: '2026-11-20T17:30', title: 'Draft 1 title tiktok' });
    expect(after.youtube).toMatchObject({ status: 'published', platform_url: YOUTUBE.platform_url });
    expect(after.style_sheet).toEqual(STYLE_SHEET);
  });
});
