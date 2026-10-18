'use strict';

/**
 * The LalaVerse brands' personalities and their representatives (Evoni,
 * 2026-10-18; constants/brandPersonalities, constants/lalaverseBrands).
 * Insert-only: nothing that exists is changed (the Brand Canon Protection
 * Rule: established canon is never overwritten).
 *
 * 1. lalaverse_brands gains `personality` JSONB NULL: the approved
 *    personality of the brand (what the brand believes), kept apart from its
 *    established canon columns.
 * 2. A brand of the six not in lalaverse_brands at all (its slug never
 *    stored, deleted or not) is added from its established canon, so the
 *    wardrobe and the writers have them without the seed route being run.
 * 3. Each of the six gets its personality where it has none; one already
 *    there is kept.
 * 4. A registry "The LalaVerse Brands" (in the show of "The LalaVerse Press"
 *    registry, else the first show) holds the six representatives as draft
 *    characters in Lala's world, for Evoni to accept; a representative whose
 *    character_key already exists is left alone. Each is linked to its brand
 *    (extra_fields.brand_id) and the brand to them (personality.representative).
 *
 * down: removes the representatives this added (still draft, as added), the
 * registry when it is then empty, and the personality column. Brands added
 * in step 2 stay (they are the app's own canon, as the seed route adds).
 */

const { LALAVERSE_BRANDS_SEED } = require('../constants/lalaverseBrands');
const { BRAND_PERSONALITIES, BRAND_RELATIONSHIPS, REPRESENTATIVES } = require('../constants/brandPersonalities');

const REGISTRY_TITLE = 'The LalaVerse Brands';
const SUPPORTIVE = new Set(['ori_beauty', 'first_light_studio']);
const MARK = 'migration 20261018140000';

const tableExists = async (sequelize, table, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${table}` }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

function personalityOf(slug) {
  const p = BRAND_PERSONALITIES[slug];
  return {
    ...p,
    relationships: BRAND_RELATIONSHIPS
      .filter((r) => r.brands.includes(slug))
      .map((r) => ({ with: r.brands.find((b) => b !== slug), kind: r.kind, note: r.note })),
  };
}

module.exports = {
  REGISTRY_TITLE,

  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, transaction });
      if (!(await tableExists(sequelize, 'lalaverse_brands', transaction))) return;

      await q('ALTER TABLE lalaverse_brands ADD COLUMN IF NOT EXISTS personality JSONB');

      const brandIds = {};
      for (const b of LALAVERSE_BRANDS_SEED) {
        const [[row]] = await q('SELECT id FROM lalaverse_brands WHERE slug = :slug ORDER BY deleted_at NULLS FIRST LIMIT 1', { slug: b.slug });
        if (row) { brandIds[b.slug] = row.id; continue; }
        const [[added]] = await q(
          `INSERT INTO lalaverse_brands (id, slug, name, type, category, description, aesthetic, niche, founder, press_angle, created_at, updated_at)
           VALUES (gen_random_uuid(), :slug, :name, :type, :category, :description, :aesthetic, :niche, :founder, :press_angle, NOW(), NOW())
           RETURNING id`,
          { ...b });
        brandIds[b.slug] = added.id;
        console.log(`[${MARK}] added the brand ${b.name}`);
      }

      for (const slug of Object.keys(BRAND_PERSONALITIES)) {
        const [, meta] = await q(
          'UPDATE lalaverse_brands SET personality = CAST(:p AS jsonb), updated_at = NOW() WHERE slug = :slug AND personality IS NULL',
          { slug, p: JSON.stringify(personalityOf(slug)) });
        console.log(`[${MARK}] ${slug} personality: ${meta?.rowCount ? 'set' : 'kept'}`);
      }

      if (!(await tableExists(sequelize, 'character_registries', transaction))
        || !(await tableExists(sequelize, 'registry_characters', transaction))) return;

      let [[registry]] = await q('SELECT id FROM character_registries WHERE title = :title AND deleted_at IS NULL LIMIT 1', { title: REGISTRY_TITLE });
      if (!registry) {
        const [[press]] = await q("SELECT show_id FROM character_registries WHERE title = 'The LalaVerse Press' AND deleted_at IS NULL AND show_id IS NOT NULL LIMIT 1");
        const [[show]] = press ? [[{ id: press.show_id }]] : await q('SELECT id FROM shows WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1');
        [[registry]] = await q(
          `INSERT INTO character_registries (id, show_id, title, description, created_at, updated_at)
           VALUES (gen_random_uuid(), :show, :title, :description, NOW(), NOW()) RETURNING id`,
          { show: show?.id || null, title: REGISTRY_TITLE, description: 'The people who speak for the LalaVerse brands. Each represents a brand without being it: what they believe is theirs, what the brand believes is the brand\'s, and only what happened is history.' });
      }

      for (const [i, r] of REPRESENTATIVES.entries()) {
        const [[exists]] = await q('SELECT id FROM registry_characters WHERE character_key = :key AND deleted_at IS NULL LIMIT 1', { key: r.key });
        if (exists) { console.log(`[${MARK}] ${r.name} already exists; left as is`); continue; }
        const brand = LALAVERSE_BRANDS_SEED.find((b) => b.slug === r.brand);
        await q(
          `INSERT INTO registry_characters
             (id, registry_id, character_key, display_name, selected_name, world, role_type, role_label, appearance_mode, status,
              description, personality, core_belief, core_desire, core_fear, signature_trait,
              voice_signature, career_status, extra_fields, sort_order, is_alive, intimate_eligible, created_at, updated_at)
           VALUES
             (gen_random_uuid(), :registry, :key, :name, :name, 'lalaverse', :roleType, :roleLabel, 'on_page', 'draft',
              :description, :personality, :coreBelief, :coreDesire, :coreFear, :signatureTrait,
              CAST(:voice AS jsonb), CAST(:career AS jsonb), CAST(:extra AS jsonb), :sort, true, false, NOW(), NOW())`,
          {
            registry: registry.id, key: r.key, name: r.name,
            roleType: SUPPORTIVE.has(r.brand) ? 'support' : 'pressure',
            roleLabel: `${r.title}, ${brand.name}`,
            description: r.description, personality: r.personality, coreBelief: r.core_belief,
            coreDesire: r.core_desire, coreFear: r.core_fear, signatureTrait: r.signature_trait,
            voice: JSON.stringify(r.voice), career: JSON.stringify(r.career),
            extra: JSON.stringify({
              representative_of: r.brand, brand_id: brandIds[r.brand] || null, brand_name: brand.name, title: r.title,
              pronouns: r.pronouns, authority: r.authority, earns_respect: r.earns_respect, damages_trust: r.damages_trust,
              how_treats_lala: r.how_treats_lala, sample_line: r.sample_line, added_by: MARK,
            }),
            sort: i,
          });
        console.log(`[${MARK}] added ${r.name} (${r.title}, ${brand.name}) as a draft character`);
      }
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, transaction });
      if (await tableExists(sequelize, 'registry_characters', transaction)) {
        await q(`DELETE FROM registry_characters WHERE status = 'draft' AND extra_fields->>'added_by' = :mark`, { mark: MARK });
        await q(`DELETE FROM character_registries cr WHERE cr.title = :title
                   AND NOT EXISTS (SELECT 1 FROM registry_characters rc WHERE rc.registry_id = cr.id)`, { title: REGISTRY_TITLE });
      }
      if (await tableExists(sequelize, 'lalaverse_brands', transaction)) {
        await q('ALTER TABLE lalaverse_brands DROP COLUMN IF EXISTS personality');
      }
    });
  },
};
