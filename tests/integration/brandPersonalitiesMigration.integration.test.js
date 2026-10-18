/**
 * The LalaVerse brands' personalities and representatives (Evoni,
 * 2026-10-18; 20261018140000-brand-personalities.js), against the test
 * database. Insert-only (the Brand Canon Protection Rule): a brand's
 * established canon is never changed, an existing personality is kept, a
 * missing brand is added from its canon, the representatives are added once
 * as draft characters linked to their brands, and one already there is left
 * alone.
 */
jest.unmock('uuid');

const models = require('../../src/models');
const migration = require('../../src/migrations/20261018140000-brand-personalities');
const { LALAVERSE_BRANDS_SEED } = require('../../src/constants/lalaverseBrands');
const { REPRESENTATIVES } = require('../../src/constants/brandPersonalities');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const asJson = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
const qi = () => sequelize.getQueryInterface();
const seedOf = (slug) => LALAVERSE_BRANDS_SEED.find((b) => b.slug === slug);

(shouldSkip ? describe.skip : describe)('brand personalities migration', () => {
  let velourFounder;
  let removedCarte = false;

  beforeAll(async () => {
    await migration.down(qi());
    // Velour exists with a founder line Evoni edited; Carte Blanche is gone.
    const [velour] = await q("SELECT id, founder FROM lalaverse_brands WHERE slug = 'velour_atelier' LIMIT 1");
    if (!velour) {
      const b = seedOf('velour_atelier');
      await run(`INSERT INTO lalaverse_brands (id, slug, name, type, category, description, aesthetic, niche, founder, press_angle, created_at, updated_at)
                 VALUES (gen_random_uuid(), :slug, :name, :type, :category, :description, :aesthetic, :niche, :founder, :press_angle, NOW(), NOW())`, { ...b });
    }
    velourFounder = velour ? velour.founder : seedOf('velour_atelier').founder;
    await run("UPDATE lalaverse_brands SET founder = 'Edited by Evoni.' WHERE slug = 'velour_atelier'");
    const [tagged] = await q(`SELECT 1 AS t FROM wardrobe_brand_tags t JOIN lalaverse_brands b ON b.id = t.brand_id WHERE b.slug = 'carte_blanche' LIMIT 1`).catch(() => [null]);
    if (!tagged) {
      await run("DELETE FROM lalaverse_brands WHERE slug = 'carte_blanche'");
      removedCarte = true;
    }
    await migration.up(qi());
  });

  afterAll(async () => {
    await run('UPDATE lalaverse_brands SET founder = :f WHERE slug = \'velour_atelier\'', { f: velourFounder });
  });

  it('never changes a brand\'s established canon', async () => {
    const [velour] = await q("SELECT founder, niche, aesthetic FROM lalaverse_brands WHERE slug = 'velour_atelier'");
    expect(velour.founder).toBe('Edited by Evoni.');
    expect(velour.niche).toBe(seedOf('velour_atelier').niche);
  });

  it('adds a missing brand from its established canon', async () => {
    if (!removedCarte) return;
    const [carte] = await q("SELECT name, category, description, aesthetic, niche, founder, press_angle FROM lalaverse_brands WHERE slug = 'carte_blanche'");
    const seed = seedOf('carte_blanche');
    for (const k of ['name', 'category', 'description', 'aesthetic', 'niche', 'founder', 'press_angle']) expect(carte[k]).toBe(seed[k]);
  });

  it('gives each of the six its personality, with its relationships, and keeps one already there', async () => {
    const rows = await q('SELECT slug, personality FROM lalaverse_brands WHERE slug IN (:slugs)', { slugs: LALAVERSE_BRANDS_SEED.map((b) => b.slug) });
    const bySlug = Object.fromEntries(rows.map((r) => [r.slug, asJson(r.personality)]));
    expect(bySlug.velour_atelier.defining_principle).toBe('Nothing extraneous');
    expect(bySlug.velour_atelier.relationships.map((r) => r.with)).toEqual(expect.arrayContaining(['carte_blanche', 'the_column']));
    expect(bySlug.first_light_studio.representative).toBe('jordan_ellis');
    expect(bySlug.ori_beauty.beliefs).toMatch(/never guarantees a product suits her/);

    await run(`UPDATE lalaverse_brands SET personality = '{"edited":true}'::jsonb WHERE slug = 'ori_beauty'`);
    await migration.up(qi());
    const [ori] = await q("SELECT personality FROM lalaverse_brands WHERE slug = 'ori_beauty'");
    expect(asJson(ori.personality)).toEqual({ edited: true });
  });

  it('adds the six representatives once, as draft characters in Lala\'s world, linked to their brands', async () => {
    const reps = await q(`SELECT rc.character_key, rc.display_name, rc.status, rc.world, rc.role_label, rc.extra_fields, cr.title, b.id AS brand_id
                            FROM registry_characters rc
                            JOIN character_registries cr ON cr.id = rc.registry_id
                            LEFT JOIN lalaverse_brands b ON b.slug = rc.extra_fields->>'representative_of'
                           WHERE rc.character_key IN (:keys) AND rc.deleted_at IS NULL`, { keys: REPRESENTATIVES.map((r) => r.key) });
    expect(reps).toHaveLength(6);
    for (const r of reps) {
      expect(r.status).toBe('draft');
      expect(r.world).toBe('lalaverse');
      expect(r.title).toBe(migration.REGISTRY_TITLE);
      expect(asJson(r.extra_fields).brand_id).toBe(r.brand_id);
    }
    const jordan = reps.find((r) => r.character_key === 'jordan_ellis');
    expect(jordan.role_label).toBe('Brand Director, First Light Studio');
    expect(asJson(jordan.extra_fields).authority).toMatchObject({ creative: 'propose', financial: 'negotiate', escalates_to: 'founder' });
    const nia = reps.find((r) => r.character_key === 'nia_bennett');
    expect(asJson(nia.extra_fields).authority).toMatchObject({ financial: 'full', escalates_to: null });
  });

  it('leaves a representative already there alone', async () => {
    await run("UPDATE registry_characters SET description = 'Edited by Evoni.' WHERE character_key = 'nia_bennett' AND deleted_at IS NULL");
    await migration.up(qi());
    const nias = await q("SELECT description FROM registry_characters WHERE character_key = 'nia_bennett' AND deleted_at IS NULL");
    expect(nias).toEqual([{ description: 'Edited by Evoni.' }]);
  });

  it('down removes the draft representatives it added and the personality column', async () => {
    await migration.down(qi());
    const reps = await q("SELECT 1 FROM registry_characters WHERE character_key IN (:keys) AND status = 'draft' AND extra_fields->>'added_by' = 'migration 20261018140000'", { keys: REPRESENTATIVES.map((r) => r.key) });
    expect(reps).toHaveLength(0);
    const [col] = await q("SELECT COUNT(*)::int AS n FROM information_schema.columns WHERE table_name = 'lalaverse_brands' AND column_name = 'personality'");
    expect(col.n).toBe(0);
    await migration.up(qi());
  });
});
