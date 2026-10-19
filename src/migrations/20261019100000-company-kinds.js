'use strict';

/**
 * Brands and companies (Evoni, 2026-10-18: "yes start the brand and company
 * profile pages"; constants/companyKinds). Additive only.
 *
 * 1. lalaverse_brands gains `kind` VARCHAR(20) NOT NULL DEFAULT 'brand':
 *    brand | outlet | agency | venue. Every row there now is a fashion brand.
 * 2. opportunities gains `company_id` UUID NULL, pointing at the company a
 *    deal is with (ON DELETE SET NULL). brand_or_company stays as typed.
 * 3. The four publications the press characters run (The Real Rate,
 *    Undressed, First Look, The Cost of Wanting More) are added as 'outlet'
 *    companies where no company of that name exists (deleted or not) and the
 *    slug is free. Nothing that exists is changed.
 * 4. A deal with no company is linked to the one company whose name matches
 *    its brand_or_company, compared trimmed, one space, any case. A name two
 *    companies share, or none, stays as typed and unlinked.
 *
 * down: drops company_id, removes the outlets step 3 added that are still as
 * added (same slug, description and founder), and drops kind.
 */

const { PRESS_OUTLETS } = require('../constants/companyKinds');

const tableExists = async (sequelize, table, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${table}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

// SQL for a name compared as constants/companyKinds normalizeName does.
const norm = (col) => `LOWER(TRIM(REGEXP_REPLACE(${col}, '\\s+', ' ', 'g')))`;

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, transaction });
      const brands = await tableExists(sequelize, 'lalaverse_brands', transaction);
      const deals = await tableExists(sequelize, 'opportunities', transaction);
      if (brands) {
        await q("ALTER TABLE lalaverse_brands ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'brand'");
        for (const o of PRESS_OUTLETS) {
          await q(`INSERT INTO lalaverse_brands (id, slug, name, kind, type, category, description, founder, created_at, updated_at)
            SELECT gen_random_uuid(), :slug, :name, 'outlet', 'lalaverse', :category, :tagline, :publisher, NOW(), NOW()
            WHERE NOT EXISTS (SELECT 1 FROM lalaverse_brands WHERE slug = :slug OR ${norm('name')} = ${norm(':name')})`, o);
        }
      }
      if (deals) {
        await q('ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS company_id UUID NULL');
        if (brands) {
          await q(`DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'opportunities_company_id_fkey') THEN
              ALTER TABLE opportunities ADD CONSTRAINT opportunities_company_id_fkey
                FOREIGN KEY (company_id) REFERENCES lalaverse_brands(id) ON DELETE SET NULL;
            END IF;
          END $$`);
          await q('CREATE INDEX IF NOT EXISTS idx_opportunities_company_id ON opportunities (company_id)');
          await q(`UPDATE opportunities o SET company_id = m.id
            FROM (
              SELECT ${norm('name')} AS key, (ARRAY_AGG(id))[1] AS id
                FROM lalaverse_brands WHERE deleted_at IS NULL
               GROUP BY ${norm('name')} HAVING COUNT(*) = 1
            ) m
            WHERE o.company_id IS NULL AND o.brand_or_company IS NOT NULL AND ${norm('o.brand_or_company')} = m.key`);
        }
      }
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, transaction });
      if (await tableExists(sequelize, 'opportunities', transaction)) {
        await q('DROP INDEX IF EXISTS idx_opportunities_company_id');
        await q('ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_company_id_fkey');
        await q('ALTER TABLE opportunities DROP COLUMN IF EXISTS company_id');
      }
      if (await tableExists(sequelize, 'lalaverse_brands', transaction)) {
        for (const o of PRESS_OUTLETS) {
          await q(`DELETE FROM lalaverse_brands WHERE slug = :slug AND kind = 'outlet' AND description = :tagline AND founder = :publisher
            AND NOT EXISTS (SELECT 1 FROM wardrobe_brand_tags t WHERE t.brand_id = lalaverse_brands.id)`, o);
        }
        await q('ALTER TABLE lalaverse_brands DROP COLUMN IF EXISTS kind');
      }
    });
  },
};
