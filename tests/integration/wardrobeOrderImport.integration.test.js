/**
 * Amazon order history onto wardrobe pieces (Task #3102; Evoni, 2026-10-13),
 * against the test database:
 * - the preview reads both Amazon exports by their headers, adds up a
 *   line split over rows, leaves out cancelled lines, suggests a piece (by
 *   ASIN, else by name), and stores nothing;
 * - confirm stores the lines; a matched line fills only the piece's empty
 *   real-world fields; an unmatched line is kept for later; the same file
 *   again is all duplicates; nothing touches coins or ownership;
 * - the file's addresses, payment details and emails are never stored;
 * - an unmatched line is matched later; ADMIN only.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const orders = require('../../src/services/wardrobeOrderImport');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

// Retail.OrderHistory.1.csv (Request your data), with the columns that must never be stored.
const RETAIL = (n) => [
  '"Website","Order ID","Order Date","Currency","Unit Price","ASIN","Quantity","Payment Instrument Type","Order Status","Shipping Address","Billing Address","Product Name"',
  `"Amazon.com","111-${n}001-0000001","2026-09-14T18:22:11Z","USD","48.99","B0SATIN001","1","Visa - 4242","Closed","Evoni Foster 1 Secret Lane","Evoni Foster 1 Secret Lane","Women's Pink Satin Slip Dress, Midi"`,
  `"Amazon.com","111-${n}001-0000001","2026-09-14T18:22:11Z","USD","48.99","B0SATIN001","1","Visa - 4242","Closed","Evoni Foster 1 Secret Lane","","Women's Pink Satin Slip Dress, Midi"`,
  `"Amazon.com","111-${n}002-0000002","2026-09-20T09:00:00Z","USD","$1,129.00","B0GOLDHEEL","1","Visa - 4242","Closed","Evoni Foster 1 Secret Lane","","Gold Strappy Heel Sandal"`,
  `"Amazon.com","111-${n}003-0000003","2026-09-21T09:00:00Z","USD","12.00","B0PHONECAS","1","Visa - 4242","Closed","Evoni Foster 1 Secret Lane","","Phone case, clear"`,
  `"Amazon.com","111-${n}004-0000004","2026-09-22T09:00:00Z","USD","30.00","B0CANCELED","1","Visa - 4242","Cancelled","Evoni Foster 1 Secret Lane","","Cancelled scarf"`,
].join('\r\n');

// The older Order History Report (items), dates as MM/DD/YY.
const REPORT = [
  'Order Date,Order ID,Title,Category,ASIN/ISBN,List Price Per Unit,Purchase Price Per Unit,Quantity,Ordering Customer Email,Website,Currency',
  '09/02/26,112-7770001-0000009,"Black Velvet Blazer, ""Night"" cut",Apparel,B0VELVET01,$89.00,$64.50,1,evoni@example.com,Amazon.com,USD',
].join('\n');

(shouldSkip ? describe.skip : describe)('Amazon order import (Task #3102)', () => {
  const tag = uuid().slice(0, 8);
  const n = String(Math.floor(Math.random() * 9000) + 1000);
  const ids = { show: uuid() };
  const pieces = {};
  let admin;
  let editor;
  const as = (token, req) => req.set('Authorization', `Bearer ${token}`);
  const upload = (csv, token = admin) => as(token, request(app).post('/api/v1/wardrobe-orders/preview'))
    .field('show_id', ids.show).attach('file', Buffer.from(csv), { filename: 'orders.csv', contentType: 'text/csv' });
  const piece = async (key, values) => {
    const [[row]] = await run(`INSERT INTO wardrobe (name, clothing_category, show_id, coin_cost, is_owned, real_product_url, real_brand, real_price_paid, real_source)
      VALUES (:name, 'dress', :show, :coin, :owned, :url, :brand, :paid, :source) RETURNING id`, {
      name: `${values.name}`, show: ids.show, coin: values.coin ?? 500, owned: values.owned ?? false,
      url: values.url ?? null, brand: values.brand ?? null, paid: values.paid ?? null, source: values.source ?? null,
    });
    pieces[key] = row.id;
  };
  const pieceRow = async (key) => (await run('SELECT * FROM wardrobe WHERE id = :id', { id: pieces[key] }))[0][0];

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-orders', email: 'evoni@orders.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-editor-orders', email: 'ed@orders.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Orders ${tag}`, slug: `orders-${tag}` });
    await piece('slip', { name: 'Pink Satin Slip Dress' });
    // Already has a manual price and brand: those stay (fill empty only).
    await piece('heel', { name: 'Gala Heels', url: 'https://www.amazon.com/dp/B0GOLDHEEL?ref=x', brand: 'Maison Or', paid: 99, source: 'manual', owned: true, coin: 1200 });
    await piece('blazer', { name: 'Black Velvet Blazer' });
  });

  afterAll(async () => {
    await run('DELETE FROM wardrobe_order_lines WHERE show_id = :show', ids);
    await run('DELETE FROM wardrobe WHERE show_id = :show', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('the preview reads the file, suggests pieces and stores nothing; an editor and a non-order file are refused', async () => {
    const res = await upload(RETAIL(n));
    expect(res.status).toBe(200);
    expect(res.body.cancelled).toBe(1);
    const byAsin = Object.fromEntries(res.body.lines.map((l) => [l.asin, l]));
    expect(Object.keys(byAsin).sort()).toEqual(['B0GOLDHEEL', 'B0PHONECAS', 'B0SATIN001']);
    expect(byAsin.B0SATIN001).toMatchObject({
      order_id: `111-${n}001-0000001`, order_date: '2026-09-14', price_paid: 48.99, quantity: 2, currency: 'USD', website: 'amazon.com',
      title: "Women's Pink Satin Slip Dress, Midi", status: 'new', suggestion: { wardrobe_id: pieces.slip, reason: 'name' },
    });
    expect(byAsin.B0GOLDHEEL).toMatchObject({ price_paid: 1129, suggestion: { wardrobe_id: pieces.heel, reason: 'asin' } });
    expect(byAsin.B0PHONECAS.suggestion).toBeNull();
    expect(JSON.stringify(res.body)).not.toMatch(/Secret Lane|Visa|4242/);
    const [[{ count }]] = await run('SELECT COUNT(*)::int AS count FROM wardrobe_order_lines WHERE show_id = :show', ids);
    expect(count).toBe(0);

    const report = await upload(REPORT);
    expect(report.body.lines[0]).toMatchObject({
      order_id: '112-7770001-0000009', order_date: '2026-09-02', asin: 'B0VELVET01', title: 'Black Velvet Blazer, "Night" cut',
      price_paid: 64.5, list_price: 89, suggestion: { wardrobe_id: pieces.blazer },
    });
    expect(JSON.stringify(report.body)).not.toContain('evoni@example.com');

    expect((await upload(RETAIL(n), editor)).status).toBe(403);
    const wrong = await upload('name,email\nEvoni,e@x.dev');
    expect(wrong.status).toBe(400);
    expect(wrong.body.error).toMatch(/Amazon order history/);
  });

  test('confirm fills only empty fields, keeps unmatched lines for later, never touches coins; the same file again is all duplicates', async () => {
    const preview = (await upload(RETAIL(n))).body.lines;
    const lines = preview.map((l) => ({ ...l, wardrobe_id: l.suggestion?.wardrobe_id || null }));
    const res = await as(admin, request(app).post('/api/v1/wardrobe-orders/confirm')).send({ show_id: ids.show, lines });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ matched: 2, unmatched: 1, duplicates: 0, invalid: 0 });

    const slip = await pieceRow('slip');
    expect(slip).toMatchObject({
      real_product_name: "Women's Pink Satin Slip Dress, Midi", real_retailer: 'Amazon', real_price_paid: '48.99',
      real_product_url: 'https://www.amazon.com/dp/B0SATIN001', real_source: 'amazon_export',
    });
    expect(slip.real_order_date).toBe('2026-09-14');
    // The heel had a manual price, brand, link and source: kept; only the empty fields are filled.
    const heel = await pieceRow('heel');
    expect(heel).toMatchObject({
      real_price_paid: '99.00', real_brand: 'Maison Or', real_source: 'manual', real_product_url: 'https://www.amazon.com/dp/B0GOLDHEEL?ref=x',
      real_product_name: 'Gold Strappy Heel Sandal', real_retailer: 'Amazon',
    });
    // Coins and ownership are never written.
    expect({ coin: Number(heel.coin_cost), owned: heel.is_owned }).toEqual({ coin: 1200, owned: true });
    expect({ coin: Number(slip.coin_cost), owned: slip.is_owned }).toEqual({ coin: 500, owned: false });

    // Nothing from the file but the order fields is stored.
    const [rows] = await run('SELECT * FROM wardrobe_order_lines WHERE show_id = :show', ids);
    expect(rows).toHaveLength(3);
    expect(JSON.stringify(rows)).not.toMatch(/Secret Lane|Visa|4242/);

    const again = await upload(RETAIL(n));
    expect(again.body.lines.map((l) => l.status)).toEqual(['duplicate', 'duplicate', 'duplicate']);
    const twice = await as(admin, request(app).post('/api/v1/wardrobe-orders/confirm')).send({ show_id: ids.show, lines });
    expect(twice.body).toMatchObject({ matched: 0, unmatched: 0, duplicates: 3 });
  });

  test('an unmatched line is listed and matched later; a matched line cannot be matched again', async () => {
    const list = await as(admin, request(app).get(`/api/v1/wardrobe-orders?show_id=${ids.show}&status=unmatched`));
    expect(list.status).toBe(200);
    expect(list.body.lines.map((l) => l.asin)).toEqual(['B0PHONECAS']);
    const line = list.body.lines[0];
    expect((await as(editor, request(app).put(`/api/v1/wardrobe-orders/${line.id}`)).send({ wardrobe_id: pieces.blazer })).status).toBe(403);
    expect((await as(admin, request(app).put(`/api/v1/wardrobe-orders/${line.id}`)).send({ wardrobe_id: uuid() })).status).toBe(400);
    const done = await as(admin, request(app).put(`/api/v1/wardrobe-orders/${line.id}`)).send({ wardrobe_id: pieces.blazer });
    expect(done.status).toBe(200);
    expect(done.body.piece.filled).toEqual(expect.arrayContaining(['real_product_name', 'real_price_paid', 'real_source']));
    expect((await pieceRow('blazer')).real_product_name).toBe('Phone case, clear');
    expect((await as(admin, request(app).put(`/api/v1/wardrobe-orders/${line.id}`)).send({ wardrobe_id: pieces.blazer })).status).toBe(409);
    expect((await as(admin, request(app).get(`/api/v1/wardrobe-orders?show_id=${ids.show}&status=unmatched`))).body.lines).toEqual([]);
  });

  test('readOrders: quoted commas and newlines, a byte-order mark, and a file with no order lines', () => {
    const { lines } = orders.readOrders('Order ID,ASIN,Product Name,Order Date\n"113-1-1","B0QUOTE001","A ""quoted"", multi\nline name",2026-01-02\n');
    expect(lines[0]).toMatchObject({ order_id: '113-1-1', title: 'A "quoted", multi\nline name', order_date: '2026-01-02', quantity: 1 });
    expect(() => orders.readOrders('Order ID,ASIN,Product Name\n')).toThrow('That file has no order lines.');
    // A file saved with a byte-order mark (Excel) reads the same.
    expect(orders.readOrders('\uFEFFOrder ID,ASIN,Product Name\n111-1-1,B0BOMBOM01,Bom hat\n').lines[0].asin).toBe('B0BOMBOM01');
  });
});
