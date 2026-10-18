/**
 * The quick wins (Evoni, 2026-10-18), against the test database:
 *   - a wardrobe piece naming a LalaVerse brand is tagged with it, once; a
 *     brand change moves an untouched tag and keeps one with coverage; a
 *     name that is no brand leaves no untouched tag
 *   - a book's Memory Bank lists the memories of its show's characters that
 *     have no line, alongside the line ones
 */
jest.unmock('uuid');

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { sequelize } = require('../../src/models');
const { linkItemBrand } = require('../../src/services/wardrobeBrandLink');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const tagsOf = (item) => q('SELECT brand_id, coverage_status FROM wardrobe_brand_tags WHERE wardrobe_item_id = :item AND deleted_at IS NULL ORDER BY created_at', { item });

(shouldSkip ? describe.skip : describe)('quick wins', () => {
  const ids = { a: uuid(), b: uuid(), item: uuid(), item2: uuid(), show: uuid(), reg: uuid(), char: uuid(), book: uuid(), mem: uuid() };
  const tag = `${ids.a.slice(0, 6)}`;

  beforeAll(async () => {
    await run(`INSERT INTO lalaverse_brands (id, slug, name, category, created_at, updated_at)
               VALUES (:a, :sa, :na, 'fashion', NOW(), NOW()), (:b, :sb, :nb, 'fashion', NOW(), NOW())`,
    { ...ids, sa: `qa_${tag}`, na: `Quiet Atelier ${tag}`, sb: `qb_${tag}`, nb: `Bold House ${tag}` });
    await run(`INSERT INTO wardrobe (id, name, character, clothing_category, created_at, updated_at)
               VALUES (:item, 'Ivory coat', 'lala', 'outerwear', NOW(), NOW()), (:item2, 'Tee', 'lala', 'top', NOW(), NOW())`, ids);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, 'Quick wins show', :slug, NOW(), NOW())`, { ...ids, slug: `qw-${tag}` });
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'QW registry', :show, NOW(), NOW())", ids);
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, created_at, updated_at)
               VALUES (:char, :reg, :key, 'QW Lala', NOW(), NOW())`, { ...ids, key: `qw-${tag}` });
    await run('INSERT INTO storyteller_books (id, title, show_id, created_at, updated_at) VALUES (:book, \'QW book\', :show, NOW(), NOW())', ids);
    await run(`INSERT INTO storyteller_memories (id, line_id, character_id, type, statement, confidence, confirmed, protected, created_at, updated_at)
               VALUES (:mem, NULL, :char, 'belief', 'She wants approval more than she admits.', 0.8, false, false, NOW(), NOW())`, ids);
  });

  afterAll(async () => {
    await run('DELETE FROM wardrobe_brand_tags WHERE wardrobe_item_id IN (:item, :item2)', ids);
    await run('DELETE FROM wardrobe WHERE id IN (:item, :item2)', ids);
    await run('DELETE FROM lalaverse_brands WHERE id IN (:a, :b)', ids);
    await run('DELETE FROM storyteller_memories WHERE id = :mem', ids);
    await run('DELETE FROM storyteller_books WHERE id = :book', ids);
    await run('DELETE FROM registry_characters WHERE id = :char', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  it('a piece naming a brand (any case) is tagged with it, once', async () => {
    expect(await linkItemBrand(sequelize, { id: ids.item, name: 'Ivory coat', brand: `  quiet atelier ${tag} ` })).toBe(ids.a);
    await linkItemBrand(sequelize, { id: ids.item, name: 'Ivory coat', brand: `Quiet Atelier ${tag}` });
    expect(await tagsOf(ids.item)).toEqual([{ brand_id: ids.a, coverage_status: 'uncovered' }]);
  });

  it('a brand change moves an untouched tag, and keeps one with coverage', async () => {
    await linkItemBrand(sequelize, { id: ids.item, name: 'Ivory coat', brand: `Bold House ${tag}` });
    expect((await tagsOf(ids.item)).map((t) => t.brand_id)).toEqual([ids.b]);
    await run("UPDATE wardrobe_brand_tags SET coverage_status = 'covered', coverage_content = 'A piece.' WHERE wardrobe_item_id = :item AND brand_id = :b", ids);
    await linkItemBrand(sequelize, { id: ids.item, name: 'Ivory coat', brand: `Quiet Atelier ${tag}` });
    expect((await tagsOf(ids.item)).map((t) => t.brand_id).sort()).toEqual([ids.a, ids.b].sort());
  });

  it('a name that is no LalaVerse brand links nothing and removes an untouched tag', async () => {
    await linkItemBrand(sequelize, { id: ids.item2, name: 'Tee', brand: `Quiet Atelier ${tag}` });
    expect(await linkItemBrand(sequelize, { id: ids.item2, name: 'Tee', brand: 'Some Label' })).toBeNull();
    expect(await tagsOf(ids.item2)).toEqual([]);
  });

  it('the Memory Bank lists a memory of the show\'s character that has no line', async () => {
    const token = TokenService.generateTokenPair({ id: 'test-qw', email: 'evoni@qw.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    const res = await request(app).get(`/api/v1/memories/books/${ids.book}/memories/pending?confirmed=false`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const mem = res.body.memories.find((m) => m.id === ids.mem);
    expect(mem).toBeTruthy();
    expect(mem.unplaced).toBe(true);
    expect(mem.chapter_title).toBeNull();
    expect(mem.character.display_name).toBe('QW Lala');
  });
});
