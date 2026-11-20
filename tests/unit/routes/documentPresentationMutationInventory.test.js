/**
 * A document presentation is kept by its document (V2-2a-1, Evoni
 * 2026-11-20). Three things are pinned here, by reading the source:
 *
 *  1. every route of the asset API that changes something carries the
 *     rule, or is on the short list of ones that cannot reach an existing
 *     asset, each with its reason;
 *  2. the routes outside it that find an asset by its id still carry it;
 *  3. the places that update an assets row by its id with no condition on
 *     its type are the ones looked at and listed below.
 *
 * (3) is a list to keep honest, not a ban: a new place fails this test
 * with what to decide (is the id the caller's? then put the rule on its
 * route; is it the code's own? then add it to the list with why), and then
 * one line here records the answer. Updates that name a type or role in
 * their own WHERE are not counted, and nothing here limits new asset
 * writers that create rows or work on their own type.
 *
 * The rule's middleware itself is exercised at the end; its behaviour
 * through the routes, against real Postgres, is in
 * tests/integration/documentPresentationAssetApi.integration.test.js and
 * documentPresentationProtections.integration.test.js.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const RULE = /presentationById|presentationAmongIds|presentationByAssetId|protectDocumentPresentations\(/;

/** Each `router.<method>('<path>', …` of a file, with the text up to its handler. */
function routes(file) {
  const source = read(file);
  const found = [];
  const re = /router\.(post|put|patch|delete)\(\s*'([^']+)'([\s\S]*?)(?:async\s*\(|asyncHandler\()/g;
  let m;
  while ((m = re.exec(source))) found.push({ method: m[1].toUpperCase(), path: m[2], middleware: m[3] });
  return found;
}

describe('the asset API: every route that changes something', () => {
  // Routes that cannot change an existing asset, and why.
  const NOT_AN_EXISTING_ASSET = {
    'POST /labels': 'makes a label; names no asset',
    'POST /search': 'reads; document presentations are left out unless asked for by type (AssetService.searchAssets)',
    'POST /': 'uploads a new asset; its type must be one of the upload types (validateAssetUpload), and a document presentation is never the copy it reuses',
  };
  const all = routes('src/routes/assets.js');

  test('the routes are found (the reading of the file still works)', () => {
    expect(all.length).toBeGreaterThanOrEqual(15);
    expect(all.map((r) => `${r.method} ${r.path}`)).toEqual(expect.arrayContaining(['PUT /:id', 'DELETE /:id', 'POST /bulk/delete', 'POST /bulk/change-type']));
  });

  test.each(all.map((r) => [`${r.method} ${r.path}`, r]))('%s carries the rule, or is listed with its reason', (name, route) => {
    if (NOT_AN_EXISTING_ASSET[name]) return expect(route.middleware).not.toMatch(RULE);
    return expect(route.middleware).toMatch(RULE);
  });

  test('the two that can set a type refuse this one', () => {
    const typed = all.filter((r) => /refuseDocumentPresentationType\(/.test(r.middleware)).map((r) => `${r.method} ${r.path}`);
    expect(typed.sort()).toEqual(['POST /bulk/change-type', 'PUT /:id']);
  });

  test('the rule comes after the sign-in check, so who may call each is as it was', () => {
    for (const route of all.filter((r) => RULE.test(r.middleware))) {
      const auth = route.middleware.search(/requireAuth/);
      expect(auth).toBeGreaterThanOrEqual(0);
      expect(route.middleware.search(RULE)).toBeGreaterThan(auth);
    }
  });
});

describe('routes outside the asset API that find an asset by its id', () => {
  const GUARDED = [
    ['src/routes/imageProcessing.js', ['POST /:id/remove-background', 'POST /:id/enhance', 'POST /:id/reset-processing']],
    ['src/routes/roles.js', ['POST /bulk-assign']],
    ['src/routes/uiOverlayRoutes.js', [
      'PUT /:showId/category/:assetId', 'PUT /:showId/image-fit/:assetId', 'PUT /:showId/screen-links/:assetId',
      'POST /:showId/screen-links/:assetId/icon', 'PUT /:showId/content-zones/:assetId', 'DELETE /:showId/asset/:assetId',
    ]],
    ['src/routes/worldEvents/overlays.js', ['POST /world/:showId/events/:eventId/reject-overlay']],
    ['src/routes/episodes.js', ['DELETE /:id/assets/:assetId']],
  ];

  test.each(GUARDED.flatMap(([file, names]) => names.map((name) => [file, name])))('%s: %s carries the rule', (file, name) => {
    const route = routes(file).find((r) => `${r.method} ${r.path}` === name);
    expect(route).toBeDefined();
    expect(route.middleware).toMatch(RULE);
  });

  test("the phone's two routes that already ask for their own type are left as they are", () => {
    // remove-bg and stats-panel find the asset WHERE asset_type = 'UI_OVERLAY'.
    expect(read('src/services/uiOverlayService.js')).toMatch(/asset_type = 'UI_OVERLAY'/);
    expect(read('src/services/statsPanelService.js')).toMatch(/asset_type = 'UI_OVERLAY'/);
  });
});

describe('updates of an assets row by its id, with no condition on its type', () => {
  /**
   * file → how many, and why each is not a way to a document presentation.
   * A raw `UPDATE assets … WHERE id =` (or `id IN`) that names no type or
   * role, and a call of Asset.update / Asset.destroy / Asset.restore.
   */
  const LOOKED_AT = {
    'src/routes/assets.js': [1, 'the upload route, on the asset it has just made'],
    'src/routes/imageProcessing.js': [2, 'inside the three routes that carry the rule'],
    'src/routes/shows.js': [1, "ids from its own read of the show's UI_OVERLAY assets"],
    'src/routes/todoListRoutes.js': [1, 'the id from its own read by the wardrobe-list role'],
    'src/routes/uiOverlayRoutes.js': [6, 'five inside routes that carry the rule; one on ids from its own read of UI_OVERLAY screens'],
    'src/routes/worldEvents/inject.js': [1, "the event's own approved invitation (invitation_asset_id)"],
    'src/routes/worldEvents/overlays.js': [1, 'inside reject-overlay, which carries the rule'],
    'src/services/AssetRoleService.js': [1, 'called only by POST /roles/bulk-assign, which carries the rule'],
    'src/services/AssetService.js': [1, 'bulkDeleteAssets, called only by the two delete routes, which carry the rule'],
    'src/services/ImageProcessingService.js': [3, "the image-processing routes' own service"],
    'src/services/eventDocumentsService.js': [1, "the document's own canonical overlay (doc.overlay.asset_id)"],
    'src/services/invitationGeneratorService.js': [1, 'a version loaded by its type (INVITATION_LETTER) and event'],
    'src/services/todoListService.js': [1, 'the id from its own read by role'],
    'src/services/uiOverlayService.js': [1, "after its own read WHERE asset_type = 'UI_OVERLAY'"],
  };

  const walk = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const at = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'migrations' ? [] : walk(at);
    return entry.name.endsWith('.js') ? [at] : [];
  });
  const count = (source) => {
    let n = 0;
    const sql = /UPDATE assets\b[\s\S]{0,600}?(?:`|'\s*,|"\s*,)/g;
    let m;
    while ((m = sql.exec(source))) {
      const text = m[0];
      const byId = /WHERE\s+(a\.)?id\s*(=|IN)/i.test(text);
      const ownKind = /asset_type|asset_role|NOT_DOCUMENT_PRESENTATION|\$\{live\}|\$\{where\}/.test(text);
      if (byId && !ownKind) n += 1;
    }
    return n + (source.match(/\bAsset\.(destroy|update|restore)\(/g) || []).length;
  };
  const found = Object.fromEntries(walk('src').map((file) => [file, count(read(file))]).filter(([, n]) => n > 0));

  test('the reading finds the known places (so it would find a new one)', () => {
    expect(Object.keys(found).length).toBeGreaterThanOrEqual(10);
    expect(found['src/services/AssetService.js']).toBeGreaterThanOrEqual(1);
  });

  test('no file has more of them than were looked at, and no new file has any', () => {
    const more = Object.entries(found)
      .filter(([file, n]) => n > (LOOKED_AT[file] ? LOOKED_AT[file][0] : 0))
      .map(([file, n]) => `${file}: ${n} now, ${LOOKED_AT[file] ? LOOKED_AT[file][0] : 0} looked at`);
    // A new one? Decide whose id it is. The caller's: put
    // protectDocumentPresentations on its route. The code's own (read by a
    // type or role first, or a row it has just made): add it to LOOKED_AT
    // with why. An update that names its type in its own WHERE is not counted.
    expect(more).toEqual([]);
  });

  test('every listed place has its reason', () => {
    for (const [file, [n, why]] of Object.entries(LOOKED_AT)) {
      expect(n).toBeGreaterThan(0);
      expect(why.length).toBeGreaterThan(10);
      expect(fs.existsSync(path.join(ROOT, file))).toBe(true);
    }
  });
});

describe('the indirect ways are closed in the code that makes them', () => {
  test('Start Episode leaves them out of its two reads and of its update', () => {
    const source = read('src/services/episodeGeneratorService.js');
    const linking = source.slice(source.indexOf('Auto-link all event assets'), source.indexOf('Auto-link all event assets') + 2500);
    expect(linking).toMatch(/where: exceptDocumentPresentations\(/);
    expect(linking).toMatch(/metadata->>'event_id' = :eventId AND deleted_at IS NULL AND \$\{NOT_DOCUMENT_PRESENTATION_SQL\}/);
    expect(linking).toMatch(/UPDATE assets SET episode_id = :episodeId WHERE id = :assetId AND \$\{NOT_DOCUMENT_PRESENTATION_SQL\}/);
  });

  test('the Thumbnail Studio leaves them out of its cut-outs and its library', () => {
    const source = read('src/services/youtubeThumbnailService.js');
    expect(source.match(/\$\{NOT_DOCUMENT_PRESENTATION_SQL\}/g)).toHaveLength(2);
  });
});

describe('global search (its request, with the database stood in for)', () => {
  test('asks for assets with document presentations left out', async () => {
    jest.resetModules();
    const queries = [];
    jest.doMock('../../../src/config/database', () => ({ getPool: () => ({ query: jest.fn(async (sql, params) => { queries.push([sql, params]); return { rows: [] }; }) }) }));
    const controller = require('../../../src/controllers/searchController');
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    await controller.globalSearch({ query: { q: 'gala', type: 'asset' }, user: { id: 'u', groups: ['USER'] } }, res);
    const assetQuery = queries.map(([sql]) => sql).find((sql) => /FROM assets/.test(sql));
    expect(assetQuery).toMatch(/AND asset_type IS DISTINCT FROM 'DOCUMENT_PRESENTATION'/);
    expect(assetQuery).toMatch(/name ILIKE \$1 OR asset_type ILIKE \$1/);
    jest.dontMock('../../../src/config/database');
  });
});

describe("the rule's middleware", () => {
  const PRESENTATION = '11111111-1111-4111-8111-111111111111';
  const ORDINARY = '22222222-2222-4222-8222-222222222222';
  let rule;
  let query;

  beforeEach(() => {
    jest.resetModules();
    query = jest.fn(async (_sql, { replacements }) => [replacements.ids.includes(PRESENTATION) ? [{ one: 1 }] : [], 0]);
    jest.doMock('../../../src/models', () => ({ sequelize: { query } }));
    rule = require('../../../src/utils/documentPresentationAssets');
  });
  afterEach(() => jest.dontMock('../../../src/models'));

  const call = async (middleware, req) => {
    const res = { statusCode: null, body: null };
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (body) => { res.body = body; return res; };
    const next = jest.fn();
    await middleware(req, res, next);
    return { res, next };
  };

  test('lets an ordinary asset through to the handler, and answers nothing itself', async () => {
    const { res, next } = await call(rule.protectDocumentPresentations((req) => req.params.id), { params: { id: ORDINARY } });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBeNull();
  });

  test('refuses a document presentation, alone or among others, however its id is written; the handler is not reached', async () => {
    for (const ids of [PRESENTATION, [ORDINARY, PRESENTATION], [ORDINARY, PRESENTATION.replace(/-/g, '').toUpperCase()], [`{${PRESENTATION}}`]]) {
      const { res, next } = await call(rule.protectDocumentPresentations((req) => req.body.assetIds), { body: { assetIds: ids } });
      expect(next).not.toHaveBeenCalled();
      expect([res.statusCode, res.body]).toEqual([409, { success: false, error: rule.MANAGED_MESSAGE, code: rule.MANAGED_CODE }]);
    }
  });

  test('a request that names no asset id asks nothing and goes on (the handler says what is missing, as before)', async () => {
    for (const ids of [undefined, null, [], 'not-an-id', [7, {}]]) {
      const { next } = await call(rule.protectDocumentPresentations((req) => req.body.assetIds), { body: { assetIds: ids } });
      expect(next).toHaveBeenCalledTimes(1);
    }
    expect(query).not.toHaveBeenCalled();
  });

  test('when the asset cannot be checked, the request is refused and the handler is not reached', async () => {
    query.mockRejectedValue(new Error('connection terminated unexpectedly'));
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { res, next } = await call(rule.protectDocumentPresentations((req) => req.params.id), { params: { id: ORDINARY } });
    expect(next).not.toHaveBeenCalled();
    expect([res.statusCode, res.body]).toEqual([500, { success: false, error: rule.CHECK_FAILED_MESSAGE }]);
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });

  test('the type itself, however it is cased or padded, and nothing else', async () => {
    for (const yes of ['DOCUMENT_PRESENTATION', 'document_presentation', ' Document_Presentation ']) expect(rule.isDocumentPresentationType(yes)).toBe(true);
    for (const no of ['DOCUMENT_OVERLAY', 'DOCUMENT PRESENTATION', '', null, undefined, 7, ['DOCUMENT_PRESENTATION']]) expect(rule.isDocumentPresentationType(no)).toBe(false);
    const refuse = rule.refuseDocumentPresentationType((req) => req.body.assetType);
    expect((await call(refuse, { body: { assetType: 'document_presentation' } })).res.statusCode).toBe(409);
    expect((await call(refuse, { body: { assetType: 'EPISODE_FRAME' } })).next).toHaveBeenCalledTimes(1);
    expect((await call(refuse, { body: {} })).next).toHaveBeenCalledTimes(1);
  });

  test('leaving them out of a where keeps everything the where already had', () => {
    const { Op } = require('sequelize');
    const where = rule.exceptDocumentPresentations({ show_id: 's', [Op.or]: [{ a: 1 }], [Op.and]: [{ b: 2 }] });
    expect(where.show_id).toBe('s');
    expect(where[Op.or]).toEqual([{ a: 1 }]);
    expect(where[Op.and]).toEqual([{ b: 2 }, { asset_type: { [Op.ne]: 'DOCUMENT_PRESENTATION' } }]);
    expect(rule.exceptDocumentPresentations()[Op.and]).toEqual([{ asset_type: { [Op.ne]: 'DOCUMENT_PRESENTATION' } }]);
  });
});
