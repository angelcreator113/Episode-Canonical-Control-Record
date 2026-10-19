'use strict';

/**
 * Brings every profile's stored follower label to its ledger count, once
 * (Evoni, 2026-10-19: the profile audit's "three follower numbers for one
 * person"; the follow-up's one-time fix).
 *
 * Since the profile audit, deciding a ledger change refreshes the stored
 * copies (pulseFollowers.decide / override → characterFacts.syncFollowerCopies).
 * A profile whose copies already disagreed is corrected here instead of at
 * its next change: follower_count_approx and follower_tier, and with them
 * the copies in full_profile and the primary platform presence, are set
 * with characterFacts.followerCopies (pure; it loads no models) from the
 * latest accepted ledger row, the count pulseFollowers.countAt reads.
 *
 * A profile with ledger rows in more than one show is left alone: which
 * show's count is "the" count is not this migration's to choose. One with
 * no accepted row is left alone too.
 *
 * Before changing a profile its old values are kept in
 * follower_label_backups, so down() puts them back and drops the table.
 * Running up() again changes nothing: the labels already agree.
 */

const BACKUPS = 'follower_label_backups';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;
    const { followerCopies } = require('../services/characterFacts');
    await sequelize.transaction(async (transaction) => {
      const [[has]] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${BACKUPS}` }, transaction });
      if (!has.reg) {
        await queryInterface.createTable(BACKUPS, {
          id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
          social_profile_id: { type: Sequelize.INTEGER, allowNull: false },
          follower_count_approx: { type: Sequelize.STRING(50), allowNull: true },
          follower_tier: { type: Sequelize.STRING(20), allowNull: true },
          full_profile: { type: Sequelize.JSONB, allowNull: true },
          platform_presences: { type: Sequelize.JSONB, allowNull: true },
          ledger_count: { type: Sequelize.BIGINT, allowNull: false },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
          deleted_at: { type: Sequelize.DATE, allowNull: true },
        }, { transaction });
        await queryInterface.addIndex(BACKUPS, ['social_profile_id'], {
          unique: true, where: { deleted_at: null }, name: 'follower_label_backups_one_live', transaction,
        });
      }

      // The latest accepted ledger row per profile, and how many shows it has rows in.
      const [latest] = await sequelize.query(
        `SELECT DISTINCT ON (pf.social_profile_id) pf.social_profile_id, pf.count_after,
                (SELECT COUNT(DISTINCT x.show_id) FROM pulse_followers x
                  WHERE x.social_profile_id = pf.social_profile_id AND x.status = 'accepted' AND x.deleted_at IS NULL) AS shows
           FROM pulse_followers pf
          WHERE pf.status = 'accepted' AND pf.deleted_at IS NULL
          ORDER BY pf.social_profile_id, pf.story_order DESC, pf.decided_at DESC NULLS LAST, pf.created_at DESC`,
        { transaction });

      let fixed = 0; let agreed = 0; let several = 0; let missing = 0;
      for (const row of latest) {
        if (Number(row.shows) > 1) { several += 1; continue; }
        const [[profile]] = await sequelize.query(
          `SELECT id, platform, follower_count_approx, follower_tier, full_profile, platform_presences
             FROM social_profiles WHERE id = :id AND deleted_at IS NULL`,
          { replacements: { id: row.social_profile_id }, transaction });
        if (!profile) { missing += 1; continue; }
        const count = Number(row.count_after);
        const changes = followerCopies(profile, count);
        if (profile.follower_count_approx === changes.follower_count_approx && profile.follower_tier === changes.follower_tier) {
          agreed += 1;
          continue;
        }
        await sequelize.query(
          `INSERT INTO ${BACKUPS} (social_profile_id, follower_count_approx, follower_tier, full_profile, platform_presences, ledger_count)
           VALUES (:id, :label, :tier, CAST(:full AS JSONB), CAST(:presences AS JSONB), :count)
           ON CONFLICT (social_profile_id) WHERE deleted_at IS NULL DO NOTHING`,
          { replacements: {
            id: profile.id, label: profile.follower_count_approx, tier: profile.follower_tier,
            full: profile.full_profile == null ? null : JSON.stringify(profile.full_profile),
            presences: profile.platform_presences == null ? null : JSON.stringify(profile.platform_presences),
            count,
          }, transaction });
        const sets = ['follower_count_approx = :label', 'follower_tier = :tier', 'updated_at = NOW()'];
        const replacements = { id: profile.id, label: changes.follower_count_approx, tier: changes.follower_tier };
        if (changes.full_profile) { sets.push('full_profile = CAST(:full AS JSONB)'); replacements.full = JSON.stringify(changes.full_profile); }
        if (changes.platform_presences) { sets.push('platform_presences = CAST(:presences AS JSONB)'); replacements.presences = JSON.stringify(changes.platform_presences); }
        await sequelize.query(`UPDATE social_profiles SET ${sets.join(', ')} WHERE id = :id`, { replacements, transaction });
        fixed += 1;
      }
      console.log(`[backfill-follower-labels] ${fixed} profile(s) brought to their ledger count; ${agreed} already agreed; `
        + `${several} left alone (ledger rows in more than one show); ${missing} ledger profile(s) not found.`);
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const [[has]] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: `public.${BACKUPS}` }, transaction });
      if (!has.reg) return;
      const [, meta] = await sequelize.query(
        `UPDATE social_profiles sp
            SET follower_count_approx = b.follower_count_approx,
                follower_tier = b.follower_tier::text::enum_social_profiles_follower_tier,
                full_profile = COALESCE(b.full_profile, sp.full_profile),
                platform_presences = COALESCE(b.platform_presences, sp.platform_presences),
                updated_at = NOW()
           FROM ${BACKUPS} b
          WHERE b.social_profile_id = sp.id AND b.deleted_at IS NULL`,
        { transaction });
      console.log(`[backfill-follower-labels] down: ${meta?.rowCount ?? 0} profile(s) given back their old labels.`);
      await queryInterface.dropTable(BACKUPS, { transaction });
    });
  },
};
