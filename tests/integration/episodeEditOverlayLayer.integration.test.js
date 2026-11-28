/**
 * A still picture over the frame (Gate 2b, PR 1; Evoni, 2026-11-27): the
 * `overlay` item kind, the layer layersAt draws for it, and the image the
 * render manifest resolves it to.
 *
 * What this proves, in the order Evoni asked for it:
 *   1 a saved snapshot is not touched by any of this;
 *   2 a manifest with no overlay in it is the one it always was;
 *   3 an overlay can be added, changed, reordered and removed;
 *   4 a picture from another show or another episode is refused;
 *   5 a picture that is gone is the existing asset_missing finding;
 *   6 timing and order are the same on every read;
 *   7 the kinds that wait for Gate 2b are still refused.
 *
 * Nothing here renders, uploads, places anything on a beat, or writes to
 * timeline_placements.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const Sequelize = require('sequelize');
const models = require('../../src/models');
const svc = require('../../src/services/episodeEditService');
const tl = require('../../src/utils/editTimeline');
const { manifestOf } = require('../../src/services/renderManifestService');
const c1b = require('../../src/migrations/20261102120000-add-episode-edit-c1b-kinds');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await run(sql, replacements))[0];
const EDIT_TABLES = ['edit_versions', 'timeline_audio_items', 'timeline_items', 'episode_pip_visibility',
  'episode_pip_settings', 'episode_prime_segments', 'episode_scene_clips', 'episode_beat_production', 'episode_edit_state'];

(shouldSkip ? describe.skip : describe)('A still picture on the edit (PR 1, Postgres)', () => {
  const showA = uuid();
  const showB = uuid();
  const episodes = [];
  const assets = [];
  const USER = 'test-overlay-admin';
  const flag = process.env.EPISODE_EDIT;

  beforeAll(async () => {
    process.env.EPISODE_EDIT = 'on';
    await c1b.up(sequelize.getQueryInterface(), Sequelize);
    for (const [id, n] of [[showA, 'ovl-a'], [showB, 'ovl-b']]) {
      await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :n, :n, NOW(), NOW())',
        { id, n: `${n}-${id.slice(0, 8)}` });
    }
  });

  afterAll(async () => {
    process.env.EPISODE_EDIT = flag;
    if (episodes.length) {
      const e = { e: episodes };
      for (const table of EDIT_TABLES) await run(`DELETE FROM ${table} WHERE episode_id IN (:e)`, e);
      await run('DELETE FROM episodes WHERE id IN (:e)', e);
    }
    if (assets.length) await run('DELETE FROM assets WHERE id IN (:a)', { a: assets });
    await run('DELETE FROM shows WHERE id IN (:s)', { s: [showA, showB] });
    await sequelize.close();
  });

  /** An episode on a show, with an edit ready to take items. */
  const world = async (show = showA) => {
    const ep = uuid();
    episodes.push(ep);
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, created_at, updated_at)
      VALUES (:ep, :show, 'Overlay', :n, 'draft', '', NOW(), NOW())`, { ep, show, n: 9700 + episodes.length });
    return { ep, show };
  };

  /**
   * A picture in the asset table. `meta` is the row's metadata, which is
   * where the drawer of a picture records transparency; the real title
   * overlay service writes no content_type at all, which `type: null`
   * reproduces.
   */
  const image = async ({ show = showA, episode = null, hash = 'a'.repeat(64), type = 'image/png', meta = null } = {}) => {
    const id = uuid();
    assets.push(id);
    await run(`INSERT INTO assets (id, name, asset_type, asset_role, show_id, episode_id, s3_key_raw, s3_url_raw,
        s3_url_processed, content_type, width, height, file_size_bytes, file_hash, metadata, created_at, updated_at)
      VALUES (:id, 'Title overlay', 'UI_OVERLAY', 'title_overlay', :show, :episode, :key, :url, :url,
        :type, 1920, 1080, 4242, :hash, :meta, NOW(), NOW())`,
    { id, show, episode, key: `overlays/${id}.png`, url: `https://example.invalid/${id}.png`, type, hash,
      meta: meta === null ? null : JSON.stringify(meta) });
    return id;
  };

  const rev = async (ep) => (await svc.loadEdit(sequelize, { episodeId: ep })).edit_revision;
  const as = async (ep, extra = {}) => ({ episodeId: ep, editRevision: await rev(ep), userId: USER, ...extra });
  const add = async (w, body) => svc.addItem(sequelize, await as(w.ep, { body: { anchor_kind: 'edit_start', offset_ms: 0, ...body } }));
  const refused = (p, status, code) => expect(p).rejects.toMatchObject({ status, ...(code ? { code } : {}) });
  const overlay = (assetId, over = {}) => ({ kind: 'overlay', duration_ms: 2000, values: { asset_id: assetId, ...over } });
  /**
   * The manifest draws frames, and frames only exist inside a beat that has
   * a length, so a world used for a manifest is given one. Nothing else
   * about the edit is needed: an overlay anchors to the edit's start.
   */
  const withLength = async (w, ms = 4000) => {
    await svc.setBeatDuration(sequelize, await as(w.ep, { beatNumber: 1, durationMs: ms }));
    return w;
  };

  // ── 3 · added, changed, reordered, removed ──────────────────────────────
  test('an overlay is added with its box, fit, opacity and order, and the whole frame by default', async () => {
    const w = await world();
    const a = await image({ episode: w.ep });
    const r = await add(w, overlay(a));
    expect(r.duration_ms).toBe(2000);

    const { edit } = await svc.loadEdit(sequelize, { episodeId: w.ep });
    const item = edit.items.find((i) => i.kind === 'overlay');
    // No box given: the frame's own size, from editTimeline, never a literal.
    expect(item.values.layout).toEqual({ x: 0, y: 0, w: tl.FRAME_W, h: tl.FRAME_H });
    expect(item.values.fit).toBe('contain');
    expect(item.values.layer).toBe(0);

    // Changed: a new box, with the length left alone.
    await svc.updateItem(sequelize, await as(w.ep, {
      itemId: item.id, body: { values: { layout: { x: 100, y: 50, w: 600, h: 400, opacity: 0.5 }, fit: 'cover' } },
    }));
    const after = (await svc.loadEdit(sequelize, { episodeId: w.ep })).edit.items.find((i) => i.kind === 'overlay');
    expect(after.values.layout).toEqual({ x: 100, y: 50, w: 600, h: 400, opacity: 0.5 });
    expect(after.values.fit).toBe('cover');
    expect(after.duration_ms).toBe(2000);           // kept, not wiped

    // Removed.
    await svc.removeRow(sequelize, await as(w.ep, { what: 'item', id: item.id }));
    expect((await svc.loadEdit(sequelize, { episodeId: w.ep })).edit.items.filter((i) => i.kind === 'overlay')).toHaveLength(0);
  });

  // ── 6 · deterministic timing and order ──────────────────────────────────
  test('two overlays draw in layer order, over everything, the same on every read', async () => {
    const w = await world();
    const top = await image({ episode: w.ep });
    const under = await image({ episode: w.ep });
    await add(w, overlay(under, { layer: 1 }));
    await add(w, overlay(top, { layer: 5 }));

    const { edit } = await svc.loadEdit(sequelize, { episodeId: w.ep });
    const read = () => tl.layersAt(edit, 500).layers.filter((l) => l.kind === 'overlay').map((l) => l.asset_id);
    expect(read()).toEqual([under, top]);           // by layer, low to high
    expect(read()).toEqual(read());                 // and the same every time
    // Last of all: a picture is over every other layer at that moment.
    const kinds = tl.layersAt(edit, 500).layers.map((l) => l.kind);
    expect(kinds.lastIndexOf('overlay')).toBe(kinds.length - 1);
    // Outside its length it is not drawn.
    expect(tl.layersAt(edit, 5000).layers.filter((l) => l.kind === 'overlay')).toHaveLength(0);
  });

  // ── 4 · ownership ───────────────────────────────────────────────────────
  test("a picture from another show, another episode, or no picture at all, is refused", async () => {
    const w = await world();
    await refused(add(w, overlay(await image({ show: showB }))), 409, 'WRONG_SHOW');
    const otherEpisode = await world();
    await refused(add(w, overlay(await image({ episode: otherEpisode.ep }))), 409, 'WRONG_EPISODE');
    await refused(add(w, overlay(uuid())), 404, 'NOT_FOUND');
    // A malformed id is "not found", as checkId answers for every other kind.
    await refused(add(w, overlay('not-a-uuid')), 404, 'NOT_FOUND');
    // A show-wide picture — a phone screen, say — is allowed on any of its episodes.
    const shared = await image({ episode: null });
    await expect(add(w, overlay(shared))).resolves.toMatchObject({ duration_ms: 2000 });
  });

  test('a bad fit, a bad opacity or no length is refused', async () => {
    const w = await world();
    const a = await image({ episode: w.ep });
    await refused(add(w, overlay(a, { fit: 'stretch' })), 400, 'BAD_VALUE');
    await refused(add(w, overlay(a, { layout: { x: 0, y: 0, w: 10, h: 10, opacity: 4 } })), 400, 'BAD_LAYOUT');
    await refused(add(w, { kind: 'overlay', values: { asset_id: a } }), 400);
    await refused(add(w, overlay(a, { nonsense: true })), 400);
  });

  // ── 7 · the kinds that still wait ───────────────────────────────────────
  test('phone screens and gameplay actions are still refused', async () => {
    const w = await world();
    for (const kind of ['phone_screen', 'gameplay_action']) {
      await refused(add(w, { kind, duration_ms: 1000, values: {} }), 409, 'KIND_NOT_BUILT');
    }
  });

  // ── 1, 2, 5 · versions, manifests and the missing picture ───────────────
  test('a version saved without overlays keeps its snapshot and its manifest', async () => {
    const w = await withLength(await world());
    const before = await svc.createVersion(sequelize, await as(w.ep, { name: 'before' }));
    const first = await manifestOf(sequelize, { episodeId: w.ep, versionId: before.version_id, purpose: 'preview', range: {} });

    // An overlay is added to the LIVE edit afterwards.
    await add(w, overlay(await image({ episode: w.ep })));

    const row = (await rows('SELECT snapshot_sha256 FROM edit_versions WHERE id = :v', { v: before.version_id }))[0];
    expect(row.snapshot_sha256).toBe(before.snapshot_sha256);      // 1 · untouched
    const again = await manifestOf(sequelize, { episodeId: w.ep, versionId: before.version_id, purpose: 'preview', range: {} });
    expect(again.manifest_sha256).toBe(first.manifest_sha256);      // 2 · unchanged
    expect(JSON.stringify(again)).toBe(JSON.stringify(first));
    expect(Object.values(again.assets || {}).some((a) => a.kind === 'image')).toBe(false);
  });

  // ── transparency, as the row records it (PR 1 correction) ──────────────
  test('transparency is the drawer\'s own record, a format fact, or not established', async () => {
    const w = await withLength(await world());
    // Known transparent: the title overlay service draws on a fresh canvas
    // and writes this with the row.
    const drawn = await image({ episode: w.ep, type: null, meta: { source: 'episode-title-overlay', transparent: true } });
    // Known opaque: a JPEG has no alpha channel to carry.
    const flat = await image({ episode: w.ep, type: 'image/jpeg' });
    // Not established: a PNG, which says nothing about its own pixels.
    const plain = await image({ episode: w.ep, type: 'image/png' });
    for (const id of [drawn, flat, plain]) await add(w, overlay(id));
    const saved = await svc.createVersion(sequelize, await as(w.ep, { name: 'three pictures' }));

    const m = await manifestOf(sequelize, { episodeId: w.ep, versionId: saved.version_id, purpose: 'preview', range: {} });
    expect(m.assets[`image:${drawn}`].has_alpha).toBe(true);
    expect(m.assets[`image:${flat}`].has_alpha).toBe(false);
    expect(m.assets[`image:${plain}`].has_alpha).toBe(null);
    // The row's metadata is read for that one answer and goes no further.
    expect(JSON.stringify(m)).not.toContain('episode-title-overlay');
  });

  test('a saved overlay reaches the manifest as a pinned image, and a lost one is reported', async () => {
    const w = await withLength(await world());
    const a = await image({ episode: w.ep, hash: 'b'.repeat(64), meta: { source: 'episode-title-overlay', transparent: true } });
    await add(w, overlay(a));
    const saved = await svc.createVersion(sequelize, await as(w.ep, { name: 'with overlay' }));

    const m = await manifestOf(sequelize, { episodeId: w.ep, versionId: saved.version_id, purpose: 'preview', range: {} });
    const entry = Object.entries(m.assets).find(([ref]) => ref === `image:${a}`);
    expect(entry).toBeTruthy();
    const [, asset] = entry;
    expect(asset).toMatchObject({ kind: 'image', record_id: a, sha256: 'b'.repeat(64), identity: 'pinned', has_alpha: true, width: 1920, height: 1080 });
    expect(m.manifest_sha256).toBe((await manifestOf(sequelize, { episodeId: w.ep, versionId: saved.version_id, purpose: 'preview', range: {} })).manifest_sha256);

    // 5 · the picture goes; the saved version still names it.
    await run('UPDATE assets SET deleted_at = NOW() WHERE id = :id', { id: a });
    const after = await manifestOf(sequelize, { episodeId: w.ep, versionId: saved.version_id, purpose: 'preview', range: {} });
    expect(after.readiness.technical.ready).toBe(false);
    expect(after.readiness.technical.blocking.some((f) => f.code === 'asset_missing' && f.asset === `image:${a}`)).toBe(true);
  });
});
