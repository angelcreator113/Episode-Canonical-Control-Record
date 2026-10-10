/**
 * Wardrobe real-world fields (Task #2872): the real-world source of a piece
 * (brand, store, product, colour, size, price paid, list price, links, order
 * date, where the record came from), stored alongside its LalaVerse fields.
 *
 * - createWardrobeItem and updateWardrobeItem accept the eleven fields and
 *   pass them to the row; an update that sends none leaves them alone, and
 *   one that sends them leaves the in-world price, brand and coin cost alone;
 * - a bad price or date is refused with 400 before anything is written;
 * - the model declares the eleven, and the migration adds and removes
 *   exactly them, all nullable;
 * - no wardrobe route is public, so no public response carries them.
 *
 * No database: the models module is replaced with jest mocks for the
 * controller tests, and the model is loaded into a Sequelize instance that
 * never connects.
 */
const fs = require('fs');
const path = require('path');

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

const REAL = [
  'real_brand', 'real_retailer', 'real_product_name', 'real_color', 'real_size',
  'real_price_paid', 'real_list_price', 'real_product_url', 'affiliate_url',
  'real_order_date', 'real_source',
];

const SENT = {
  real_brand: '  Khaite ',
  real_retailer: 'Net-a-Porter',
  real_product_name: 'Bria cropped cashmere cardigan',
  real_color: 'Oxblood',
  real_size: 'S',
  real_price_paid: '1180.5',
  real_list_price: 1480,
  real_product_url: 'https://www.net-a-porter.com/en-us/shop/product/khaite/123',
  affiliate_url: 'https://go.example.com/abc',
  real_order_date: '2026-09-14',
  real_source: 'gmail',
};
const STORED = {
  real_brand: 'Khaite',
  real_retailer: 'Net-a-Porter',
  real_product_name: 'Bria cropped cashmere cardigan',
  real_color: 'Oxblood',
  real_size: 'S',
  real_price_paid: 1180.5,
  real_list_price: 1480,
  real_product_url: 'https://www.net-a-porter.com/en-us/shop/product/khaite/123',
  affiliate_url: 'https://go.example.com/abc',
  real_order_date: '2026-09-14',
  real_source: 'gmail',
};

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));

describe('wardrobe real-world fields (Task #2872)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.REMOVEBG_API_KEY;
  });

  describe('create', () => {
    test('createWardrobeItem stores all eleven', async () => {
      mockWardrobe.create.mockResolvedValue({ id: 'w-new' });
      const res = makeRes();
      await wardrobeController.createWardrobeItem({ body: { character: 'Lala', name: 'Cardigan', ...SENT } }, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(pick(mockWardrobe.create.mock.calls[0][0], REAL)).toEqual(STORED);
    });

    test('the in-world price, brand and coin cost are not taken from the real ones', async () => {
      mockWardrobe.create.mockResolvedValue({ id: 'w-new' });
      await wardrobeController.createWardrobeItem({ body: { character: 'Lala', name: 'Cardigan', ...SENT } }, makeRes());
      const row = mockWardrobe.create.mock.calls[0][0];
      expect(row.price).toBeNull();
      expect(row.brand).toBeNull();
      expect(row.coin_cost).toBeUndefined();
    });

    test('a piece with no real-world fields stores none', async () => {
      mockWardrobe.create.mockResolvedValue({ id: 'w-new' });
      await wardrobeController.createWardrobeItem({ body: { character: 'Lala', name: 'Cardigan' } }, makeRes());
      expect(pick(mockWardrobe.create.mock.calls[0][0], REAL)).toEqual({});
    });
  });

  describe('update', () => {
    const itemFor = () => {
      const item = { id: 'w-1', character: 'Lala', update: jest.fn().mockResolvedValue() };
      mockWardrobe.findOne.mockResolvedValue(item);
      return item;
    };

    test('updateWardrobeItem stores all eleven and leaves the in-world price alone', async () => {
      const item = itemFor();
      const res = makeRes();
      await wardrobeController.updateWardrobeItem({ params: { id: 'w-1' }, body: SENT }, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
      const saved = item.update.mock.calls[0][0];
      expect(pick(saved, REAL)).toEqual(STORED);
      expect(saved).not.toHaveProperty('price');
      expect(saved).not.toHaveProperty('brand');
      expect(saved).not.toHaveProperty('coin_cost');
    });

    test('an update that sends none of them keeps what is stored', async () => {
      const item = itemFor();
      await wardrobeController.updateWardrobeItem({ params: { id: 'w-1' }, body: { name: 'Cardigan' } }, makeRes());
      expect(pick(item.update.mock.calls[0][0], REAL)).toEqual({});
    });

    test('an empty value or null clears a field', async () => {
      const item = itemFor();
      await wardrobeController.updateWardrobeItem({
        params: { id: 'w-1' },
        body: { real_brand: '', real_price_paid: null, real_order_date: '', affiliate_url: '   ' },
      }, makeRes());
      expect(pick(item.update.mock.calls[0][0], REAL)).toEqual({
        real_brand: null, real_price_paid: null, real_order_date: null, affiliate_url: null,
      });
    });
  });

  describe('a bad price or date is refused before anything is written', () => {
    test.each([
      ['a negative price', { real_price_paid: -5 }, 'real_price_paid must be a number of zero or more'],
      ['a price that is not a number', { real_list_price: 'about 200' }, 'real_list_price must be a number of zero or more'],
      ['a date that does not exist', { real_order_date: '2026-02-30' }, 'real_order_date must be a date, YYYY-MM-DD'],
      ['a month that does not exist', { real_order_date: '2026-13-01' }, 'real_order_date must be a date, YYYY-MM-DD'],
      ['a date in another format', { real_order_date: '09/14/2026' }, 'real_order_date must be a date, YYYY-MM-DD'],
    ])('%s', async (_label, body, message) => {
      const item = { id: 'w-1', character: 'Lala', update: jest.fn() };
      mockWardrobe.findOne.mockResolvedValue(item);
      let res = makeRes();
      await wardrobeController.createWardrobeItem({ body: { character: 'Lala', name: 'x', ...body } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid real-world fields', details: [message] });
      expect(mockWardrobe.create).not.toHaveBeenCalled();

      res = makeRes();
      await wardrobeController.updateWardrobeItem({ params: { id: 'w-1' }, body }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(item.update).not.toHaveBeenCalled();
    });
  });
});

describe('the model and the migration (Task #2872)', () => {
  const { Sequelize, DataTypes } = jest.requireActual('sequelize');
  const sequelize = new Sequelize('postgres://u:p@127.0.0.1:1/none', { logging: false });
  const Wardrobe = jest.requireActual('../../../src/models/Wardrobe')(sequelize, DataTypes);

  test('the model declares the eleven, all nullable, with the issue\'s types', () => {
    const attrs = Wardrobe.rawAttributes;
    const types = Object.fromEntries(REAL.map((k) => [k, attrs[k] && attrs[k].type.key]));
    expect(types).toEqual({
      real_brand: 'STRING', real_retailer: 'STRING', real_product_name: 'STRING', real_color: 'STRING', real_size: 'STRING',
      real_price_paid: 'DECIMAL', real_list_price: 'DECIMAL', real_product_url: 'TEXT', affiliate_url: 'TEXT',
      real_order_date: 'DATEONLY', real_source: 'STRING',
    });
    for (const k of REAL) expect({ k, allowNull: attrs[k].allowNull }).toEqual({ k, allowNull: true });
    expect([attrs.real_price_paid.type.options.precision, attrs.real_price_paid.type.options.scale]).toEqual([10, 2]);
    // The in-world columns are still there, unrenamed.
    for (const k of ['brand', 'price', 'purchase_link', 'website', 'color', 'size', 'deleted_at']) expect(attrs[k]).toBeDefined();
    expect(Wardrobe.options.paranoid).toBeFalsy();
  });

  test('a row with them inserts every one', () => {
    const qg = sequelize.getQueryInterface().queryGenerator;
    const q = qg.insertQuery('wardrobe', { name: 'n', clothing_category: 'top', ...STORED }, Wardrobe.rawAttributes, {});
    for (const k of REAL) expect(q.query).toContain(`"${k}"`);
  });

  const migrationFile = fs.readdirSync(path.join(__dirname, '../../../src/migrations')).filter((f) => f.endsWith('-add-real-fields-to-wardrobe.js'));
  const migration = jest.requireActual(`../../../src/migrations/${migrationFile[0]}`);
  const fakeQueryInterface = (existing) => {
    const qi = {
      added: [], removed: [],
      sequelize: { transaction: async (fn) => fn({}) },
      describeTable: jest.fn(async () => ({ ...existing })),
      addColumn: jest.fn(async (table, name, spec) => { qi.added.push([table, name, spec]); }),
      removeColumn: jest.fn(async (table, name) => { qi.removed.push([table, name]); }),
    };
    return qi;
  };

  test('there is exactly one such migration', () => {
    expect(migrationFile).toHaveLength(1);
  });

  test('up adds the eleven to wardrobe, nullable, with no ENUM; down removes exactly them', async () => {
    const qi = fakeQueryInterface({ id: {}, deleted_at: {} });
    await migration.up(qi, Sequelize);
    expect(qi.added.map(([t, n]) => `${t}.${n}`)).toEqual(REAL.map((k) => `wardrobe.${k}`));
    for (const [, name, spec] of qi.added) {
      expect({ name, allowNull: spec.allowNull }).toEqual({ name, allowNull: true });
      expect(spec.type.key).not.toBe('ENUM');
    }
    expect(qi.added.find(([, n]) => n === 'deleted_at')).toBeUndefined();

    const withAll = fakeQueryInterface(Object.fromEntries([['id', {}], ['deleted_at', {}], ...REAL.map((k) => [k, {}])]));
    await migration.down(withAll, Sequelize);
    expect(withAll.removed.map(([t, n]) => `${t}.${n}`).sort()).toEqual(REAL.map((k) => `wardrobe.${k}`).sort());
  });

  test('up adds nothing twice', async () => {
    const qi = fakeQueryInterface(Object.fromEntries([['id', {}], ['deleted_at', {}], ...REAL.map((k) => [k, {}])]));
    await migration.up(qi, Sequelize);
    expect(qi.added).toEqual([]);
  });
});

describe('no wardrobe route is public (Task #2872)', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../../src/routes/wardrobe.js'), 'utf8');

  test('wardrobe.js has no optionalAuth and no // PUBLIC: marker, so no public response carries the real fields', () => {
    expect(src).not.toMatch(/\boptionalAuth\b/);
    expect(src).not.toMatch(/\/\/ PUBLIC:/);
  });

  test('every item create and update route keeps requireAuth', () => {
    expect(src).toMatch(/router\.post\('\/', requireAuth, upload\.single\('image'\), asyncHandler\(wardrobeController\.createWardrobeItem\)\)/);
    expect(src).toMatch(/router\.put\('\/:id', requireAuth, upload\.single\('image'\), asyncHandler\(wardrobeController\.updateWardrobeItem\)\)/);
  });
});
