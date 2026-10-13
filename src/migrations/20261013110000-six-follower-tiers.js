'use strict';

/**
 * The stored follower tier becomes the six count tiers (Task #3106; Evoni,
 * 2026-10-13: "rewrite the stored labels. Generation, prestige and follow
 * odds move to the six count tiers, and the 4-label follower_tier is
 * migrated with counts unchanged").
 *
 *   1. social_profiles.follower_tier and registry_characters.follower_tier
 *      gain 'emerging' and 'nano' (enum values; added outside a
 *      transaction, as Postgres requires before they are used).
 *   2. A profile whose follower_count_approx reads as a number gets the
 *      tier that count falls in (the bounds of services/pulseAudience.js,
 *      copied here so this migration keeps its meaning). Every other
 *      profile keeps its label: micro, mid, macro and mega are four of the
 *      six, and their starting counts already fall in them. No count is
 *      written; pulse_followers is not touched. Each change is logged in
 *      follower_tier_rewrites, which down restores from.
 *   3. character_follow_profiles.follower_tier_affinity gains emerging and
 *      nano, each copied from the map's micro (Evoni: the new tiers copy
 *      each character's Micro); the column default gains them too.
 *
 * Guarded; down puts every logged label back, removes the new keys and
 * the new enum values.
 */

const BOUNDS = [
  ['emerging', 0], ['nano', 1000], ['micro', 10000], ['mid', 50000], ['macro', 250000], ['mega', 1000000],
];
const MULTIPLIER = { k: 1e3, m: 1e6, b: 1e9 };

/** "47k" → 47000 (as services/pulseFollowers parseApprox); null when unreadable. */
function parseApprox(text) {
  if (typeof text !== 'string') return null;
  const m = /([\d][\d,]*(?:\.\d+)?)\s*([kmb])?/i.exec(text.replace(/\s+/g, ' '));
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  const value = Math.round(n * (m[2] ? MULTIPLIER[m[2].toLowerCase()] : 1));
  return value > 0 ? value : null;
}

const tierFor = (count) => BOUNDS.reduce((tier, [key, from]) => (count >= from ? key : tier), 'emerging');

const LOG = 'follower_tier_rewrites';
const OLD_AFFINITY_DEFAULT = '{"micro": 0.60, "mid": 0.70, "macro": 0.75, "mega": 0.65}';
const NEW_AFFINITY_DEFAULT = '{"emerging": 0.60, "nano": 0.60, "micro": 0.60, "mid": 0.70, "macro": 0.75, "mega": 0.65}';

const typeExists = async (sequelize, name) => {
  const [rows] = await sequelize.query('SELECT 1 FROM pg_type WHERE typname = :name', { replacements: { name } });
  return rows.length > 0;
};
const tableExists = async (sequelize, name) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS t', { replacements: { name } });
  return Boolean(rows[0]?.t);
};

/** Recreates an enum type without `drop`, mapping its rows to `fallback` first. */
async function shrinkEnum(sequelize, { type, table, values, drop, fallback }) {
  if (!(await typeExists(sequelize, type))) return;
  await sequelize.transaction(async (transaction) => {
    await sequelize.query(`UPDATE ${table} SET follower_tier = :fallback WHERE follower_tier::text IN (:drop)`, { replacements: { fallback, drop }, transaction });
    await sequelize.query(`ALTER TYPE "${type}" RENAME TO "${type}_old"`, { transaction });
    await sequelize.query(`CREATE TYPE "${type}" AS ENUM (${values.map((v) => `'${v}'`).join(', ')})`, { transaction });
    await sequelize.query(`ALTER TABLE ${table} ALTER COLUMN follower_tier TYPE "${type}" USING follower_tier::text::"${type}"`, { transaction });
    await sequelize.query(`DROP TYPE "${type}_old"`, { transaction });
  });
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;

    // 1. The new values, outside a transaction.
    if (await typeExists(sequelize, 'enum_social_profiles_follower_tier')) {
      await sequelize.query(`ALTER TYPE "enum_social_profiles_follower_tier" ADD VALUE IF NOT EXISTS 'emerging' BEFORE 'micro'`);
      await sequelize.query(`ALTER TYPE "enum_social_profiles_follower_tier" ADD VALUE IF NOT EXISTS 'nano' BEFORE 'micro'`);
    }
    if (await typeExists(sequelize, 'enum_registry_characters_follower_tier')) {
      await sequelize.query(`ALTER TYPE "enum_registry_characters_follower_tier" ADD VALUE IF NOT EXISTS 'emerging' BEFORE 'micro'`);
      await sequelize.query(`ALTER TYPE "enum_registry_characters_follower_tier" ADD VALUE IF NOT EXISTS 'nano' BEFORE 'micro'`);
    }

    await sequelize.transaction(async (transaction) => {
      // 2. Each profile with a readable count, to the tier that count falls in; logged.
      if (!(await tableExists(sequelize, LOG))) {
        await queryInterface.createTable(LOG, {
          id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
          social_profile_id: { type: Sequelize.INTEGER, allowNull: false },
          from_tier: { type: Sequelize.STRING(16), allowNull: true },
          to_tier: { type: Sequelize.STRING(16), allowNull: false },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
          deleted_at: { type: Sequelize.DATE, allowNull: true },
        }, { transaction });
      }
      const [profiles] = await sequelize.query(
        `SELECT id, follower_count_approx, follower_tier::text AS follower_tier FROM social_profiles
          WHERE follower_count_approx IS NOT NULL AND deleted_at IS NULL`, { transaction });
      for (const p of profiles) {
        const count = parseApprox(p.follower_count_approx);
        if (!count) continue;
        const tier = tierFor(count);
        if (tier === p.follower_tier) continue;
        await sequelize.query(`UPDATE social_profiles SET follower_tier = :tier WHERE id = :id`, { replacements: { tier, id: p.id }, transaction });
        await sequelize.query(`INSERT INTO ${LOG} (social_profile_id, from_tier, to_tier) VALUES (:id, :from, :tier)`,
          { replacements: { id: p.id, from: p.follower_tier, tier }, transaction });
      }

      // 3. Follow odds for the two new tiers, from each map's micro; existing keys are kept.
      if (await tableExists(sequelize, 'character_follow_profiles')) {
        await sequelize.query(
          `UPDATE character_follow_profiles
              SET follower_tier_affinity = jsonb_build_object('emerging', follower_tier_affinity->'micro', 'nano', follower_tier_affinity->'micro') || follower_tier_affinity
            WHERE follower_tier_affinity ? 'micro' AND NOT (follower_tier_affinity ? 'emerging' AND follower_tier_affinity ? 'nano')`, { transaction });
        await sequelize.query(
          `ALTER TABLE character_follow_profiles ALTER COLUMN follower_tier_affinity SET DEFAULT '${NEW_AFFINITY_DEFAULT}'::jsonb`, { transaction });
      }
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (await tableExists(sequelize, LOG)) {
        // Every logged label back, newest change first.
        const [rows] = await sequelize.query(`SELECT social_profile_id, from_tier FROM ${LOG} ORDER BY id DESC`, { transaction });
        for (const r of rows) {
          await sequelize.query('UPDATE social_profiles SET follower_tier = :tier WHERE id = :id', { replacements: { tier: r.from_tier, id: r.social_profile_id }, transaction });
        }
        await queryInterface.dropTable(LOG, { transaction });
      }
      if (await tableExists(sequelize, 'character_follow_profiles')) {
        await sequelize.query(`UPDATE character_follow_profiles SET follower_tier_affinity = follower_tier_affinity - 'emerging' - 'nano'`, { transaction });
        await sequelize.query(
          `ALTER TABLE character_follow_profiles ALTER COLUMN follower_tier_affinity SET DEFAULT '${OLD_AFFINITY_DEFAULT}'::jsonb`, { transaction });
      }
    });
    // A profile or character given emerging or nano since (by generation) goes to micro, the nearest old tier.
    await shrinkEnum(sequelize, {
      type: 'enum_social_profiles_follower_tier', table: 'social_profiles',
      values: ['micro', 'mid', 'macro', 'mega'], drop: ['emerging', 'nano'], fallback: 'micro',
    });
    await shrinkEnum(sequelize, {
      type: 'enum_registry_characters_follower_tier', table: 'registry_characters',
      values: ['ghost', 'micro', 'mid', 'macro', 'mega', 'unknown'], drop: ['emerging', 'nano'], fallback: 'micro',
    });
  },
};
