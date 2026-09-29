/**
 * T4 (§8(bb); Task #2300): generateCareerList creates the Career List asset
 * only when the episode has none, and otherwise updates it in place.
 * Models, S3 and the AI client are mocked; the PNG renders for real.
 */
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: jest.fn().mockResolvedValue({}) })),
  PutObjectCommand: jest.fn((input) => input),
}));
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({
  messages: { create: jest.fn().mockResolvedValue({ content: [{ text: '[{"slot":"content_main","label":"Film the arrival","goal":true}]' }] }) },
})));

const { generateCareerList } = require('../../../src/services/todoListService');

function fakeModels({ existingAsset }) {
  const calls = [];
  const query = jest.fn(async (sql, opts = {}) => {
    calls.push({ sql, opts });
    if (/FROM world_events WHERE used_in_episode_id/.test(sql)) return [{ id: 'ev-1', name: 'Gala', event_type: 'invite' }];
    if (/FROM episode_todo_lists/.test(sql)) return [{ id: 'todo-1', social_tasks: [] }];
    if (/FROM event_deliverables/.test(sql)) return [[]];
    if (/FROM assets/.test(sql)) return existingAsset ? [existingAsset] : [];
    return [[], 0];
  });
  const create = jest.fn(async (row) => ({ id: row.id }));
  return { models: { sequelize: { query, QueryTypes: { SELECT: 'SELECT' } }, Asset: { create } }, calls, create };
}

describe('generateCareerList: one Career List asset per episode (T4)', () => {
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  test('no asset yet: one is created', async () => {
    const { models, create, calls } = fakeModels({ existingAsset: null });
    const out = await generateCareerList('ep-1', 'show-1', models);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({ asset_role: 'UI.OVERLAY.CAREER_LIST', episode_id: 'ep-1', asset_type: 'TODO_LIST' });
    expect(out.assetId).toBe(create.mock.calls[0][0].id);
    expect(calls.some((c) => /UPDATE assets/.test(c.sql))).toBe(false);
  });

  test('an asset exists: it is updated in place and none is created', async () => {
    const { models, create, calls } = fakeModels({ existingAsset: { id: 'asset-9', metadata: { kept: 'yes' } } });
    const out = await generateCareerList('ep-1', 'show-1', models);
    expect(create).not.toHaveBeenCalled();
    expect(out.assetId).toBe('asset-9');
    const update = calls.find((c) => /UPDATE assets/.test(c.sql));
    expect(update.opts.replacements).toMatchObject({ id: 'asset-9', url: out.assetUrl });
    expect(JSON.parse(update.opts.replacements.metadata)).toMatchObject({ kept: 'yes', list_type: 'career', event_id: 'ev-1' });
  });
});
