/**
 * SceneLibrary — the afterFind presign hook must never leak into a save
 * (Task #1657).
 *
 * Confirmed at this basis, against the real Sequelize internals in
 * node_modules/sequelize (v6.37.8), not assumed:
 *   - The afterFind hook's old form (`scene.thumbnail_url = signedUrl`,
 *     a normal property assignment) goes through Model#set, which marks
 *     the attribute dirty (Model#changed('thumbnail_url', true)) — proven
 *     below in "the old assignment form would have left it dirty".
 *   - `updateLibraryScene`'s `scene.update(updateData)` — the call this
 *     task's issue named as the leak — does NOT actually include an
 *     already-dirty-before-the-call attribute in what it saves: Sequelize's
 *     Model#update computes `ignoreChanged` (fields dirty before the call)
 *     and excludes them from `options.fields` unless a beforeUpdate/
 *     beforeSave hook re-touches them during the save; SceneLibrary
 *     declares no such hook. Proven below in "update() with the old
 *     assignment form" — the presign does NOT reach the UPDATE even
 *     without this task's fix.
 *   - `scene.destroy()` (the paranoid soft-delete `deleteLibraryScene`
 *     uses) has no such protection — Model#destroy's own internal save()
 *     call has no `fields` restriction, so it persists everything
 *     `changed()` reports, including whatever the afterFind hook already
 *     dirtied. Proven below in "destroy() with the old assignment form"
 *     — this is the one call this task's fix (writing into
 *     `scene.dataValues` directly instead of through the property setter)
 *     had to close.
 *
 * All four scenarios run against the real `SceneLibrary.js` model factory
 * on a real, unconnected Sequelize instance (`.define()` never opens a
 * connection); only the outermost `queryInterface.select`/`update`
 * methods are replaced, to capture exactly what Sequelize would send to
 * the database without needing a live connection.
 */
const path = require('path');
const { Sequelize } = require('sequelize');

jest.mock('../../../src/services/S3Service', () => ({
  getPreSignedUrl: jest.fn(async (bucket, key) =>
    `https://${bucket}.s3.us-east-1.amazonaws.com/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=deadbeef`
  ),
}));

function defineRealSceneLibrary(sequelize) {
  const defineSceneLibrary = require(path.join('..', '..', '..', 'src', 'models', 'SceneLibrary.js'));
  return defineSceneLibrary(sequelize);
}

const RAW_ROW = {
  id: '11111111-1111-1111-1111-111111111111',
  show_id: '22222222-2222-2222-2222-222222222222',
  video_asset_url: 'shows/22222222-2222-2222-2222-222222222222/scene-library/scene-1/clip.mp4',
  thumbnail_url: 'shows/22222222-2222-2222-2222-222222222222/scene-library/scene-1/thumbnail.jpg',
  title: 'Old Title',
  description: null,
  characters: [],
  tags: [],
  duration_seconds: null,
  resolution: null,
  file_size_bytes: null,
  processing_status: 'ready',
  processing_error: null,
  s3_key: 'shows/22222222-2222-2222-2222-222222222222/scene-library/scene-1/clip.mp4',
  created_by: 'system',
  updated_by: 'system',
  created_at: new Date('2026-01-01T00:00:00Z'),
  updated_at: new Date('2026-01-01T00:00:00Z'),
  deleted_at: null,
};

// No connection is ever opened — .define() is pure in-memory; only an
// actual query (which we intercept below) would touch the network.
function freshUnconnectedSequelize() {
  return new Sequelize('postgres://unused:unused@localhost:1/unused', { logging: false });
}

describe('SceneLibrary — afterFind presign does not persist back (Task #1657)', () => {
  test('the fixed hook: findByPk returns a usable presigned link, with nothing marked changed', async () => {
    const sequelize = freshUnconnectedSequelize();
    const SceneLibrary = defineRealSceneLibrary(sequelize);
    sequelize.getQueryInterface().select = async (model, tableName, opts) => {
      const built = model.bulkBuild([{ ...RAW_ROW }], { isNewRecord: false, raw: true });
      return opts.plain ? (built[0] || null) : built;
    };

    const scene = await SceneLibrary.findByPk(RAW_ROW.id);

    // The response still carries a usable (signed) link — every existing
    // frontend reader (SceneLibrary.jsx, SceneDetail.jsx,
    // SceneLibraryPicker.jsx, via normalizeSceneThumbnail/normalizeSceneVideo
    // in frontend/src/utils/urlUtils.js) keeps working unchanged.
    expect(scene.thumbnail_url).toMatch(/^https:\/\//);
    expect(scene.thumbnail_url).toContain('X-Amz-Signature=');
    expect(scene.video_asset_url).toMatch(/^https:\/\//);
    expect(scene.get('thumbnail_url')).toBe(scene.thumbnail_url);
    expect(scene.toJSON().thumbnail_url).toBe(scene.thumbnail_url);
    expect(scene.toJSON().video_asset_url).toBe(scene.video_asset_url);

    // But nothing is dirtied — a stored key, once presigned for display,
    // is not implicitly staged for a later save.
    expect(scene.changed()).toBe(false);
  });

  test('a read then an edit (updateLibraryScene\'s explicit-fields update) leaves the stored key unchanged', async () => {
    const sequelize = freshUnconnectedSequelize();
    const SceneLibrary = defineRealSceneLibrary(sequelize);
    sequelize.getQueryInterface().select = async (model, tableName, opts) => {
      const built = model.bulkBuild([{ ...RAW_ROW }], { isNewRecord: false, raw: true });
      return opts.plain ? (built[0] || null) : built;
    };

    let capturedFields = null;
    let capturedValues = null;
    sequelize.getQueryInterface().update = async (instance, tableName, values, where, options) => {
      capturedFields = options.fields;
      capturedValues = { ...values }; // snapshot now — save() mutates the same `values` object again after this call, via Object.assign(values, result.dataValues)
      return [instance, 1]; // the real queryInterface.update returns the live instance, not a fresh object
    };

    const scene = await SceneLibrary.findByPk(RAW_ROW.id);
    const updateData = { title: 'New Title' };
    await scene.update(updateData, { fields: Object.keys(updateData) });

    expect(capturedFields).not.toContain('thumbnail_url');
    expect(capturedFields).not.toContain('video_asset_url');
    expect(capturedValues.thumbnail_url).toBeUndefined();
    expect(capturedValues.video_asset_url).toBeUndefined();
    expect(capturedValues.title).toBe('New Title');
  });

  test('a read then a soft delete (deleteLibraryScene) leaves the stored key unchanged — the confirmed leak path', async () => {
    const sequelize = freshUnconnectedSequelize();
    const SceneLibrary = defineRealSceneLibrary(sequelize);
    sequelize.getQueryInterface().select = async (model, tableName, opts) => {
      const built = model.bulkBuild([{ ...RAW_ROW }], { isNewRecord: false, raw: true });
      return opts.plain ? (built[0] || null) : built;
    };

    let capturedFields = null;
    let capturedValues = null;
    sequelize.getQueryInterface().update = async (instance, tableName, values, where, options) => {
      capturedFields = options.fields;
      capturedValues = { ...values }; // snapshot now — save() mutates the same `values` object again after this call, via Object.assign(values, result.dataValues)
      return [instance, 1]; // the real queryInterface.update returns the live instance, not a fresh object
    };

    const scene = await SceneLibrary.findByPk(RAW_ROW.id);
    await scene.destroy();

    expect(capturedFields).not.toContain('thumbnail_url');
    expect(capturedFields).not.toContain('video_asset_url');
    expect(capturedValues.thumbnail_url).toBeUndefined();
    expect(capturedValues.video_asset_url).toBeUndefined();
    expect(capturedFields).toContain('deleted_at');
  });
});

describe('SceneLibrary — the old (pre-fix) assignment form, for contrast', () => {
  // These do not exercise src/models/SceneLibrary.js — they rebuild the
  // hook's previous, buggy form inline (plain property assignment instead
  // of a direct dataValues write) against the same real Sequelize model
  // shape, to demonstrate which call sites the bug actually reached. This
  // is the evidence for this file's own header comment, not a regression
  // test of shipped code — there is nothing left in the real model for it
  // to protect.
  function defineSceneLibraryWithOldHook(sequelize) {
    const { DataTypes } = require('sequelize');
    return sequelize.define('SceneLibraryOld', {
      id: { type: DataTypes.UUID, primaryKey: true },
      thumbnail_url: { type: DataTypes.TEXT, allowNull: true, field: 'thumbnail_url' },
      video_asset_url: { type: DataTypes.TEXT, allowNull: true, field: 'video_asset_url' },
      title: { type: DataTypes.STRING(255), allowNull: true },
      updated_at: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
      deleted_at: { type: DataTypes.DATE, allowNull: true, field: 'deleted_at' },
    }, {
      tableName: 'scene_library', timestamps: true, paranoid: true,
      createdAt: false, updatedAt: 'updated_at', deletedAt: 'deleted_at', underscored: true,
      hooks: {
        afterFind: async (result) => {
          const scene = Array.isArray(result) ? result[0] : result;
          if (scene?.thumbnail_url?.startsWith('shows/')) {
            scene.thumbnail_url = 'https://bucket.s3.amazonaws.com/signed-thumb?X-Amz-Signature=old';
          }
          if (scene?.video_asset_url?.startsWith('shows/')) {
            scene.video_asset_url = 'https://bucket.s3.amazonaws.com/signed-video?X-Amz-Signature=old';
          }
        },
      },
    });
  }

  test('the old assignment form would have left it dirty', async () => {
    const sequelize = freshUnconnectedSequelize();
    const Model = defineSceneLibraryWithOldHook(sequelize);
    sequelize.getQueryInterface().select = async (model, tableName, opts) => {
      const built = model.bulkBuild([{ ...RAW_ROW }], { isNewRecord: false, raw: true });
      return opts.plain ? (built[0] || null) : built;
    };

    const scene = await Model.findByPk(RAW_ROW.id);
    expect(scene.changed()).toEqual(expect.arrayContaining(['thumbnail_url', 'video_asset_url']));
  });

  test('update() with the old assignment form: the presign does not leak even without this fix', async () => {
    const sequelize = freshUnconnectedSequelize();
    const Model = defineSceneLibraryWithOldHook(sequelize);
    sequelize.getQueryInterface().select = async (model, tableName, opts) => {
      const built = model.bulkBuild([{ ...RAW_ROW }], { isNewRecord: false, raw: true });
      return opts.plain ? (built[0] || null) : built;
    };
    let capturedFields = null;
    sequelize.getQueryInterface().update = async (instance, tableName, values, where, options) => {
      capturedFields = options.fields;
      return [instance, 1]; // the real queryInterface.update returns the live instance, not a fresh object
    };

    const scene = await Model.findByPk(RAW_ROW.id);
    await scene.update({ title: 'New Title' }); // no explicit `fields` — the pre-fix call shape

    expect(capturedFields).not.toContain('thumbnail_url');
    expect(capturedFields).not.toContain('video_asset_url');
  });

  test('destroy() with the old assignment form: the presign DOES leak — this is the real bug', async () => {
    const sequelize = freshUnconnectedSequelize();
    const Model = defineSceneLibraryWithOldHook(sequelize);
    sequelize.getQueryInterface().select = async (model, tableName, opts) => {
      const built = model.bulkBuild([{ ...RAW_ROW }], { isNewRecord: false, raw: true });
      return opts.plain ? (built[0] || null) : built;
    };
    let capturedFields = null;
    let capturedValues = null;
    sequelize.getQueryInterface().update = async (instance, tableName, values, where, options) => {
      capturedFields = options.fields;
      capturedValues = { ...values }; // snapshot now — save() mutates the same `values` object again after this call, via Object.assign(values, result.dataValues)
      return [instance, 1]; // the real queryInterface.update returns the live instance, not a fresh object
    };

    const scene = await Model.findByPk(RAW_ROW.id);
    await scene.destroy();

    expect(capturedFields).toEqual(expect.arrayContaining(['thumbnail_url', 'video_asset_url']));
    expect(capturedValues.thumbnail_url).toContain('X-Amz-Signature=old');
    expect(capturedValues.video_asset_url).toContain('X-Amz-Signature=old');
  });
});
