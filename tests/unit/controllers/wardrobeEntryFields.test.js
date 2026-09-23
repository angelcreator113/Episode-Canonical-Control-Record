/**
 * Wardrobe entry fields — description and tags survive create and update.
 *
 * Task #1743. No database: the models module is replaced with jest mocks for
 * the controller tests, and the tag-shape tests load the real Wardrobe model
 * into a Sequelize instance that never connects, then read the SQL and bind
 * values the query generator produces.
 */

const mockWardrobe = {
  create: jest.fn(),
  findOne: jest.fn(),
};

jest.mock('../../../src/models', () => ({
  models: {
    Wardrobe: mockWardrobe,
    EpisodeWardrobe: {},
    Episode: {},
  },
  sequelize: {},
  Sequelize: {},
}));
jest.mock('../../../src/services/wardrobeImageService', () => ({}));
jest.mock('../../../src/services/removeBgParams', () => ({ applyRemoveBgParams: jest.fn() }));

const wardrobeController = require('../../../src/controllers/wardrobeController');

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe('wardrobe entry fields (Task #1743)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.REMOVEBG_API_KEY;
  });

  describe('description', () => {
    test('updateWardrobeItem saves description', async () => {
      const item = { id: 'w-1', character: 'Lala', update: jest.fn().mockResolvedValue() };
      mockWardrobe.findOne.mockResolvedValue(item);
      const res = makeRes();

      await wardrobeController.updateWardrobeItem(
        { params: { id: 'w-1' }, body: { name: 'Silk slip', description: 'Bias-cut champagne silk' } },
        res
      );

      expect(item.update).toHaveBeenCalledTimes(1);
      expect(item.update.mock.calls[0][0]).toEqual(
        expect.objectContaining({ name: 'Silk slip', description: 'Bias-cut champagne silk' })
      );
      expect(res.status).not.toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    test('updateWardrobeItem saves the WorldAdmin edit-form payload description', async () => {
      // Shape sent by saveWardrobeItem in frontend/src/pages/WorldAdmin.jsx
      const item = { id: 'w-2', character: 'Lala', update: jest.fn().mockResolvedValue() };
      mockWardrobe.findOne.mockResolvedValue(item);

      await wardrobeController.updateWardrobeItem(
        {
          params: { id: 'w-2' },
          body: {
            name: 'Gold cuff',
            description: 'Hammered gold cuff',
            itemType: 'jewelry',
            vendor: 'Maison Lumière',
            defaultSeason: 'all-season',
            defaultOccasion: 'gala',
            defaultCharacter: 'Lala',
            tags: ['gold', 'statement'],
            price: 120,
          },
        },
        makeRes()
      );

      const saved = item.update.mock.calls[0][0];
      expect(saved.description).toBe('Hammered gold cuff');
      expect(saved.clothing_category).toBe('jewelry');
      expect(saved.brand).toBe('Maison Lumière');
      expect(saved.tags).toEqual(['gold', 'statement']);
    });

    test('updateWardrobeItem leaves description untouched when the body omits it', async () => {
      const item = { id: 'w-3', character: 'Lala', update: jest.fn().mockResolvedValue() };
      mockWardrobe.findOne.mockResolvedValue(item);

      await wardrobeController.updateWardrobeItem({ params: { id: 'w-3' }, body: { is_favorite: true } }, makeRes());

      expect(item.update.mock.calls[0][0]).not.toHaveProperty('description');
      expect(item.update.mock.calls[0][0]).not.toHaveProperty('tags');
    });

    test('createWardrobeItem saves description', async () => {
      mockWardrobe.create.mockResolvedValue({ id: 'w-new' });
      const res = makeRes();

      await wardrobeController.createWardrobeItem(
        { body: { character: 'Lala', name: 'Opera gloves', description: 'Elbow-length satin' } },
        res
      );

      expect(mockWardrobe.create).toHaveBeenCalledTimes(1);
      expect(mockWardrobe.create.mock.calls[0][0].description).toBe('Elbow-length satin');
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('tags reach Wardrobe as an array of strings', () => {
    test.each([
      ['comma-separated string (upload FormData)', 'elegant, evening , silk', ['elegant', 'evening', 'silk']],
      ['JSON array string', '["elegant","evening"]', ['elegant', 'evening']],
      ['array', ['elegant', 'evening'], ['elegant', 'evening']],
      ['absent', undefined, []],
    ])('createWardrobeItem with %s', async (_label, tags, expected) => {
      mockWardrobe.create.mockResolvedValue({ id: 'w-new' });

      await wardrobeController.createWardrobeItem({ body: { character: 'Lala', name: 'x', tags } }, makeRes());

      expect(mockWardrobe.create.mock.calls[0][0].tags).toEqual(expected);
    });

    test.each([
      ['array', ['a', 'b'], ['a', 'b']],
      ['empty array (field cleared)', [], []],
      ['JSON array string', '["a","b"]', ['a', 'b']],
      // Before Task #1743 this JSON.parse threw and the PUT returned 500.
      ['comma-separated string', 'a, b', ['a', 'b']],
    ])('updateWardrobeItem with %s', async (_label, tags, expected) => {
      const item = { id: 'w-4', character: 'Lala', update: jest.fn().mockResolvedValue() };
      mockWardrobe.findOne.mockResolvedValue(item);
      const res = makeRes();

      await wardrobeController.updateWardrobeItem({ params: { id: 'w-4' }, body: { tags } }, res);

      expect(res.status).not.toHaveBeenCalledWith(500);
      expect(item.update.mock.calls[0][0].tags).toEqual(expected);
    });
  });
});

describe('Wardrobe.tags binds as a Postgres array, not a JSON string (Task #1743)', () => {
  const { Sequelize, DataTypes } = jest.requireActual('sequelize');
  // Never connects: only the model definition and the query generator are used.
  const sequelize = new Sequelize('postgres://u:p@127.0.0.1:1/none', { logging: false });
  const Wardrobe = jest.requireActual('../../../src/models/Wardrobe.js')(sequelize);
  const qg = sequelize.getQueryInterface().queryGenerator;
  const pgUtils = jest.requireActual('pg/lib/utils');

  const bindFor = (query, column) => {
    const cols = query.query.match(/\(([^)]*)\) VALUES/)[1].split(',').map((c) => c.replace(/"/g, ''));
    return query.bind[cols.indexOf(column)];
  };

  test('model declares tags as ARRAY(TEXT) with an empty-array default', () => {
    const attr = Wardrobe.rawAttributes.tags;
    expect(attr.type).toBeInstanceOf(DataTypes.ARRAY);
    expect(attr.type.type).toBeInstanceOf(DataTypes.TEXT);
    expect(attr.defaultValue).toEqual([]);
  });

  test.each([
    [[], '{}'],
    [['elegant', 'evening'], '{"elegant","evening"}'],
  ])('INSERT binds %j as a JS array that node-postgres sends as %s', (tags, wire) => {
    const q = qg.insertQuery('wardrobe', { name: 'n', clothing_category: 'top', tags }, Wardrobe.rawAttributes, {});
    const bound = bindFor(q, 'tags');
    expect(Array.isArray(bound)).toBe(true);
    expect(bound).toEqual(tags);
    // What goes on the wire: a Postgres array literal, which a text[] column accepts.
    // (The old JSONB attribute bound the string '[]' / '["elegant","evening"]',
    // which Postgres rejects for an array column: malformed array literal.)
    expect(pgUtils.prepareValue(bound)).toBe(wire);
  });

  test('UPDATE binds tags as a JS array', () => {
    const q = qg.updateQuery('wardrobe', { tags: ['a', 'b'] }, { id: 'w-1' }, {}, Wardrobe.rawAttributes);
    expect(q.query).toContain('"tags"=$1');
    expect(q.bind[0]).toEqual(['a', 'b']);
    expect(pgUtils.prepareValue(q.bind[0])).toBe('{"a","b"}');
  });

  test('a created instance reads tags back as the same array', () => {
    const built = Wardrobe.build({ name: 'n', clothing_category: 'top', tags: ['a', 'b'] });
    expect(built.get('tags')).toEqual(['a', 'b']);
    expect(built.toJSON().tags).toEqual(['a', 'b']);
    expect(Wardrobe.build({ name: 'n', clothing_category: 'top' }).get('tags')).toEqual([]);
  });

  afterAll(() => sequelize.close());
});
