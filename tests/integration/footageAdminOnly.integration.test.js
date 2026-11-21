/**
 * Footage and the episode edit are an ADMIN's (Evoni, 2026-11-16), against
 * the test database.
 *
 * The nine footage routes other than the delete (the list, the one-request
 * upload, the upload in parts, relabelling a take, starting and stopping
 * green removal) and the seven reads of the episode edit (the edit, its
 * layout, mix plan, findings, sources and versions) asked for a sign-in only.
 * So a viewer or an editor could read an episode's footage and edit (with
 * voice storage keys), upload to it, and start a green removal, which is
 * hours of CPU on the API server.
 *
 * Now: no token 401; a viewer or an editor 403, refused before the handler,
 * so nothing is stored, no row is written and no job is queued; an ADMIN as
 * before. The S3 client is stubbed and every call recorded.
 */
jest.unmock('uuid');
process.env.S3_PRIMARY_BUCKET = process.env.S3_PRIMARY_BUCKET || 'test-bucket';

const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => {
  const real = jest.requireActual('@aws-sdk/client-s3');
  const command = (name) => class { constructor(input) { this.input = input; this.name = name; } };
  const out = {};
  for (const k of Object.keys(real)) out[k] = /Command$/.test(k) ? command(k.replace(/Command$/, '')) : real[k];
  out.S3Client = class { send(cmd) { return mockSend(cmd); } };
  return out;
});
jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: jest.fn(async () => 'https://bucket.example/signed-link') }));

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const media = require('../../src/services/rawClipMedia');
const clips = require('../../src/services/rawClipsService');
const multipart = require('../../src/services/rawClipMultipart');
const edit = require('../../src/services/episodeEditService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

(shouldSkip ? describe.skip : describe)('footage and the episode edit are an ADMIN\'s', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  const show = crypto.randomUUID();
  const ep = crypto.randomUUID();
  const clip = crypto.randomUUID();
  const MARK = `ZZFOOT-${tag}`;
  const tokens = {};
  let savedSwitch;
  let ipN = 0;
  const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
  const as = (who, r) => {
    ipN += 1;
    const sent = r.set('X-Forwarded-For', `198.51.180.${(ipN % 200) + 1}`);
    return tokens[who] ? sent.set('Authorization', `Bearer ${tokens[who]}`) : sent;
  };
  const CLIPS = `/api/v1/episode-clips/${ep}`;
  const EDIT = `/api/v1/episodes/${ep}/edit`;
  const START = { performer: 'lala', filename: 'take.mp4', content_type: 'video/mp4', size: 1024 };

  // The nine footage routes other than the delete, and the delete.
  const footage = () => [
    ['get', CLIPS],
    ['post', CLIPS, { performer: 'lala' }],
    ['post', `${CLIPS}/uploads`, START],
    ['put', `${CLIPS}/uploads/${crypto.randomUUID()}/parts/1`],
    ['post', `${CLIPS}/uploads/${crypto.randomUUID()}/complete`, {}],
    ['delete', `${CLIPS}/uploads/${crypto.randomUUID()}`],
    ['patch', `${CLIPS}/${clip}`, { label: 'changed', is_favorite: true }],
    ['post', `${CLIPS}/${clip}/remove-green`, {}],
    ['post', `${CLIPS}/${clip}/stop-green`, {}],
    ['delete', `${CLIPS}/${clip}`],
  ];
  const editReads = () => ['', '/layout?t=0', '/mix', '/findings', '/sources', '/versions', `/versions/${crypto.randomUUID()}`].map((p) => ['get', `${EDIT}${p}`]);
  const send = (who, [method, path, body]) => {
    const r = as(who, request(app)[method](path));
    return body ? r.send(body) : r;
  };
  // Everything a refused request could have changed.
  const state = async () => (await run('SELECT id, label, is_favorite, key_status, deleted_at, updated_at FROM episode_raw_clips WHERE episode_id = :ep ORDER BY id', { ep }))[0];
  const spies = () => [
    jest.spyOn(clips, 'listClips'), jest.spyOn(clips, 'updateClip'), jest.spyOn(clips, 'removeClip'),
    jest.spyOn(multipart, 'begin'), jest.spyOn(media, 'enqueueKey'), jest.spyOn(media, 'cancelKey'),
    jest.spyOn(edit, 'loadEdit'), jest.spyOn(edit, 'mixPlanOf'), jest.spyOn(edit, 'reviewReadiness'), jest.spyOn(edit, 'listVersions'),
  ];

  beforeAll(async () => {
    savedSwitch = process.env.EPISODE_EDIT;
    process.env.EPISODE_EDIT = 'on';
    const token = (id, groups, role) => TokenService.generateTokenPair({ id, email: `${id}@footage.dev`, name: id, groups, role }).accessToken;
    tokens.viewer = token(`viewer-${tag}`, ['viewer'], 'USER');
    tokens.editor = token(`editor-${tag}`, ['USER', 'EDITOR'], 'USER');
    tokens.admin = token(`admin-${tag}`, ['ADMIN'], 'ADMIN');
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :n, :n, NOW(), NOW())', { show, n: `footage-${tag}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Footage', 1, 'draft', NOW(), NOW())`, { ep, show });
    await run(`INSERT INTO episode_raw_clips (id, episode_id, show_id, performer, label, original_filename, s3_key_raw, url_raw, key_status, created_at, updated_at)
               VALUES (:clip, :ep, :show, 'lala', :label, 'take.mp4', :key, :url, 'none', NOW(), NOW())`,
    { clip, ep, show, label: `${MARK} take`, key: `episodes/${ep}/raw-clips/${clip}/original.mp4`, url: `https://test-bucket.s3.amazonaws.com/${MARK}/original.mp4` });
  });

  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockImplementation(async (cmd) => (cmd.name === 'CreateMultipartUpload' ? { UploadId: `up-${crypto.randomUUID()}` } : {}));
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    if (savedSwitch === undefined) delete process.env.EPISODE_EDIT; else process.env.EPISODE_EDIT = savedSwitch;
    for (const table of ['episode_edit_state', 'voice_footage_jobs', 'episode_raw_clips']) {
      // eslint-disable-next-line no-await-in-loop
      await run(`DELETE FROM ${table} WHERE episode_id = :ep`, { ep }).catch((err) => console.error(`[cleanup] ${table}:`, err.message));
    }
    await run('DELETE FROM episodes WHERE id = :ep', { ep }).catch((err) => console.error('[cleanup] episodes:', err.message));
    await run('DELETE FROM shows WHERE id = :show', { show }).catch((err) => console.error('[cleanup] shows:', err.message));
  });

  test('there are ten footage routes and seven reads of the edit, and neither file holds a route without the ADMIN pair', () => {
    expect(footage()).toHaveLength(10);
    expect(editReads()).toHaveLength(7);
    const fs = require('fs');
    const path = require('path');
    for (const file of ['rawClipRoutes.js', 'episodeEditRoutes.js']) {
      const src = fs.readFileSync(path.join(__dirname, '../../src/routes', file), 'utf8');
      expect(src).toMatch(/const admin = \[requireAuth, authorize\(\['ADMIN'\]\)\];/);
      const routes = src.split('\n').filter((l) => /^router\.(get|post|put|patch|delete)\(/.test(l));
      expect(routes.length).toBeGreaterThanOrEqual(10);
      for (const line of routes) expect([file, line.slice(0, 60), /^router\.\w+\('[^']*', \.\.\.admin, /.test(line)]).toEqual([file, line.slice(0, 60), true]);
    }
    // The edit's routes written in a loop carry the pair as well.
    const editSrc = fs.readFileSync(path.join(__dirname, '../../src/routes/episodeEditRoutes.js'), 'utf8');
    for (const line of editSrc.split('\n').filter((l) => /^\s*router\.(post|patch|put|delete)\(/.test(l) && !/^router\./.test(l))) expect(line).toMatch(/\.\.\.admin/);
  });

  test('no token: 401 on every one; nothing is read, stored, written or queued', async () => {
    const watched = spies();
    const before = await state();
    for (const route of [...footage(), ...editReads()]) {
      const res = await send('anon', route);
      expect([route[0], route[1], res.status]).toEqual([route[0], route[1], 401]);
      expect(JSON.stringify(res.body)).not.toContain(MARK);
    }
    for (const spy of watched) expect(spy).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
    expect(await state()).toEqual(before);
  });

  describe.each(['viewer', 'editor'])('%s', (who) => {
    test('403 on every one, however often; nothing is read, stored, written or queued', async () => {
      const watched = spies();
      const before = await state();
      for (let i = 0; i < 2; i += 1) {
        for (const route of [...footage(), ...editReads()]) {
          const res = await send(who, route);
          expect([route[0], route[1], res.status]).toEqual([route[0], route[1], 403]);
          expect(res.body.data).toBeUndefined();
          expect(res.body.success).not.toBe(true);
          expect(JSON.stringify(res.body)).not.toContain(MARK);
        }
      }
      for (const spy of watched) expect(spy).not.toHaveBeenCalled();
      expect(mockSend).not.toHaveBeenCalled();
      expect(await state()).toEqual(before);
      expect((await run('SELECT COUNT(*)::int AS n FROM episode_raw_clips WHERE episode_id = :ep', { ep }))[0][0].n).toBe(1);
    });

    test('a one-request upload with a file is refused before the file is taken: nothing reaches storage', async () => {
      const res = await as(who, request(app).post(CLIPS)).field('performer', 'lala').attach('file', Buffer.from('not a real video'), { filename: 'take.mp4', contentType: 'video/mp4' });
      expect(res.status).toBe(403);
      expect(mockSend).not.toHaveBeenCalled();
      expect((await run('SELECT COUNT(*)::int AS n FROM episode_raw_clips WHERE episode_id = :ep', { ep }))[0][0].n).toBe(1);
    });
  });

  describe('an ADMIN: as before', () => {
    test('lists the footage', async () => {
      const res = await as('admin', request(app).get(CLIPS));
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).toContain(`${MARK} take`);
    });

    test('relabels and stars a take', async () => {
      const res = await as('admin', request(app).patch(`${CLIPS}/${clip}`)).send({ label: `${MARK} best`, is_favorite: true });
      expect(res.status).toBe(200);
      const [[row]] = await run('SELECT label, is_favorite FROM episode_raw_clips WHERE id = :clip', { clip });
      expect(row).toEqual({ label: `${MARK} best`, is_favorite: true });
    });

    test('starts an upload in parts: storage is asked for one', async () => {
      const res = await as('admin', request(app).post(`${CLIPS}/uploads`)).send(START);
      expect([200, 201]).toContain(res.status);
      expect(mockSend.mock.calls.map(([c]) => c.name)).toContain('CreateMultipartUpload');
    });

    test('starts a green removal: the job is queued', async () => {
      const queued = jest.spyOn(media, 'enqueueKey').mockImplementation(() => true);
      const res = await as('admin', request(app).post(`${CLIPS}/${clip}/remove-green`)).send({});
      expect([401, 403]).not.toContain(res.status);
      if (res.status < 300) expect(queued).toHaveBeenCalled();
      await run(`UPDATE episode_raw_clips SET key_status = 'none', key_error = NULL WHERE id = :clip`, { clip });
    });

    test('reads the edit, its layout, mix plan, findings, sources and versions', async () => {
      for (const [, path] of editReads().slice(0, 6)) {
        const res = await as('admin', request(app).get(path));
        expect([path, res.status]).toEqual([path, 200]);
        expect(res.body.success).toBe(true);
      }
      const missing = await as('admin', request(app).get(`${EDIT}/versions/${crypto.randomUUID()}`));
      expect([401, 403]).not.toContain(missing.status);
    });

    // The delete was an ADMIN's already and is not changed; what it checks first is rawClipDeleteSafe's.
    test('is let through to the delete, as before', async () => {
      const res = await as('admin', request(app).delete(`${CLIPS}/${clip}`));
      expect([401, 403]).not.toContain(res.status);
    });
  });
});
