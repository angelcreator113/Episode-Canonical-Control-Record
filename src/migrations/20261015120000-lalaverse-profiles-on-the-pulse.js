'use strict';

/**
 * A LalaVerse feed profile's social is The Pulse (Evoni, 2026-10-15: "they
 * don't get social medias like [Instagram]; instead their social is The
 * Pulse"; LalaVerse only, every existing profile moved, the hidden second
 * account kept as a private Pulse account).
 *
 *   1. social_profiles.platform gains 'pulse'. Enum values are added
 *      outside a transaction.
 *   2. social_profiles.former_platforms (JSONB) keeps what each moved
 *      profile had: { platform, front_platform, real_platform,
 *      platform_presences }. Down restores from it.
 *   3. Every LalaVerse profile (feed_layer 'lalaverse') moves to The Pulse:
 *      platform 'pulse'; its public account becomes platform_presences.pulse,
 *      a hidden or "real money" account platform_presences.pulse_private;
 *      front_platform / real_platform name those two.
 *
 * JustAWoman's feed (feed_layer 'real_world') is not touched. The transform
 * is a frozen copy of utils/pulsePlatform toPulsePresences at this date.
 */

const TYPE = 'enum_social_profiles_platform';
const OLD_PLATFORMS = ['tiktok', 'instagram', 'youtube', 'twitter', 'onlyfans', 'twitch', 'substack', 'multi'];
const PULSE = 'pulse';
const PULSE_PRIVATE = 'pulse_private';
const HIDDEN = /discreet|hidden|private|secret|alt/i;
const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

function toPulsePresences({ platform_presences: presences, front_platform: front, real_platform: real, platform, handle }) {
  const map = isObject(presences) ? presences : {};
  const keys = Object.keys(map).filter((k) => isObject(map[k]));
  const publicKey = [front, platform].find((k) => k && keys.includes(k))
    || keys.find((k) => !HIDDEN.test(map[k].visibility || ''))
    || keys[0]
    || null;
  const hasHiddenAccount = !!(real && front && real !== front);
  const privateKey = (real && real !== publicKey && keys.includes(real) ? real : null)
    || keys.find((k) => k !== publicKey && HIDDEN.test(map[k].visibility || ''))
    || null;
  const out = {};
  if (publicKey) out[PULSE] = { ...map[publicKey], visibility: 'public', is_primary: true };
  else if (handle) out[PULSE] = { handle, visibility: 'public', is_primary: true };
  if (privateKey || hasHiddenAccount) {
    const { is_primary: _primary, ...rest } = privateKey ? map[privateKey] : {};
    out[PULSE_PRIVATE] = { ...rest, visibility: 'private' };
  }
  return {
    platform_presences: out,
    front_platform: front || publicKey ? PULSE : null,
    real_platform: out[PULSE_PRIVATE] && (real || privateKey) ? PULSE_PRIVATE : (real ? PULSE : null),
  };
}

const exists = async (sequelize, sql, replacements) => (await sequelize.query(sql, { replacements }))[0].length > 0;
const tableExists = (sequelize, name) => exists(sequelize, 'SELECT 1 FROM pg_class WHERE relname = :name', { name });
const columnExists = (sequelize, table, column) => exists(sequelize,
  'SELECT 1 FROM information_schema.columns WHERE table_name = :table AND column_name = :column', { table, column });

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    if (!(await tableExists(sequelize, 'social_profiles'))) return;
    if (await exists(sequelize, 'SELECT 1 FROM pg_type WHERE typname = :name', { name: TYPE })) {
      await sequelize.query(`ALTER TYPE "${TYPE}" ADD VALUE IF NOT EXISTS '${PULSE}'`);
    }

    await sequelize.transaction(async (transaction) => {
      if (!(await columnExists(sequelize, 'social_profiles', 'former_platforms'))) {
        await queryInterface.addColumn('social_profiles', 'former_platforms', { type: Sequelize.JSONB, allowNull: true }, { transaction });
      }
      const [rows] = await sequelize.query(
        `SELECT id, handle, platform::text AS platform, front_platform, real_platform, platform_presences
           FROM social_profiles
          WHERE feed_layer::text = 'lalaverse' AND platform::text <> '${PULSE}'
          ORDER BY id`, { transaction });
      for (const r of rows) {
        const next = toPulsePresences(r);
        const former = {
          platform: r.platform, front_platform: r.front_platform, real_platform: r.real_platform,
          platform_presences: r.platform_presences || {},
        };
        await sequelize.query(
          `UPDATE social_profiles
              SET platform = '${PULSE}', former_platforms = CAST(:former AS jsonb),
                  platform_presences = CAST(:presences AS jsonb),
                  front_platform = :front, real_platform = :real, updated_at = NOW()
            WHERE id = :id`,
          { replacements: {
            id: r.id, former: JSON.stringify(former), presences: JSON.stringify(next.platform_presences),
            front: next.front_platform, real: next.real_platform,
          }, transaction });
      }
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (!(await tableExists(sequelize, 'social_profiles'))) return;
    const hasColumn = await columnExists(sequelize, 'social_profiles', 'former_platforms');
    // A profile made on The Pulse after this migration has nothing to go back
    // to: down stops before changing anything.
    const [[left]] = await sequelize.query(
      `SELECT COUNT(*)::int AS n FROM social_profiles
        WHERE platform::text = '${PULSE}' ${hasColumn ? 'AND former_platforms IS NULL' : ''}`);
    if (left.n) {
      throw new Error(`${left.n} feed profile(s) were made on The Pulse and have no former platform; give them one before undoing this migration.`);
    }
    await sequelize.transaction(async (transaction) => {
      if (hasColumn) {
        await sequelize.query(
          `UPDATE social_profiles
              SET platform = (former_platforms->>'platform')::"${TYPE}",
                  front_platform = former_platforms->>'front_platform',
                  real_platform = former_platforms->>'real_platform',
                  platform_presences = COALESCE(former_platforms->'platform_presences', '{}'::jsonb),
                  updated_at = NOW()
            WHERE former_platforms IS NOT NULL`, { transaction });
        await queryInterface.removeColumn('social_profiles', 'former_platforms', { transaction });
      }
      await sequelize.query(`ALTER TYPE "${TYPE}" RENAME TO "${TYPE}_old"`, { transaction });
      await sequelize.query(`CREATE TYPE "${TYPE}" AS ENUM (${OLD_PLATFORMS.map((p) => `'${p}'`).join(', ')})`, { transaction });
      await sequelize.query(
        `ALTER TABLE social_profiles ALTER COLUMN platform TYPE "${TYPE}" USING platform::text::"${TYPE}"`, { transaction });
      await sequelize.query(`DROP TYPE "${TYPE}_old"`, { transaction });
    });
  },
};
