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
 * A profile with ledger rows in more than one show takes the main show's
 * count (Evoni, 2026-10-19: "Styling Adventures with Lala is the main show;
 * any other show is bouncing off it"). The shows table has no main-show
 * marker, so the main show is the one show whose slug is
 * styling-adventures-with-lala (or the older seed slug styling-adventure-lala)
 * or whose name is Styling Adventures with Lala, as the franchise-knowledge
 * scope migration finds it. No such show, more than one, or no accepted row
 * in it for that profile: the profile is left alone and logged. One with no
 * accepted row at all is left alone too.
 *
 * Before changing a profile its old values are kept in
 * follower_label_backups, so down() puts them back and drops the table.
 * Running up() again changes nothing: the labels already agree.
 */

const BACKUPS = 'follower_label_backups';
const MAIN_SHOW_SLUGS = ['styling-adventures-with-lala', 'styling-adventure-lala'];
const MAIN_SHOW_NAME = 'Styling Adventures with Lala';

// The main show's id, or null when no single show matches.
const mainShowId = async (sequelize, transaction) => {
  const [shows] = await sequelize.query(
    `SELECT id FROM shows
      WHERE deleted_at IS NULL AND (slug IN (:slugs) OR name ILIKE :name)
      ORDER BY id LIMIT 2`,
    { replacements: { slugs: MAIN_SHOW_SLUGS, name: MAIN_SHOW_NAME }, transaction });
  return shows.length === 1 ? shows[0].id : null;
};

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

      const mainShow = await mainShowId(sequelize, transaction);
      if (!mainShow) console.log('[backfill-follower-labels] no single main show (Styling Adventures with Lala) found; profiles in more than one show are left alone.');

      // The latest accepted ledger row per profile and show, and how many shows the profile has rows in.
      const [latest] = await sequelize.query(
        `SELECT DISTINCT ON (pf.social_profile_id, pf.show_id) pf.social_profile_id, pf.show_id, pf.count_after,
                (SELECT COUNT(DISTINCT x.show_id) FROM pulse_followers x
                  WHERE x.social_profile_id = pf.social_profile_id AND x.status = 'accepted' AND x.deleted_at IS NULL) AS shows
           FROM pulse_followers pf
          WHERE pf.status = 'accepted' AND pf.deleted_at IS NULL
          ORDER BY pf.social_profile_id, pf.show_id, pf.story_order DESC, pf.decided_at DESC NULLS LAST, pf.created_at DESC`,
        { transaction });

      // One row per profile: its only show's, or the main show's when it has several.
      const byProfile = new Map();
      for (const row of latest) {
        const rows = byProfile.get(row.social_profile_id) || [];
        rows.push(row);
        byProfile.set(row.social_profile_id, rows);
      }
      const chosen = [];
      let fixed = 0; let agreed = 0; let fromMain = 0; let skipped = 0; let missing = 0;
      for (const [profileId, rows] of byProfile) {
        if (rows.length === 1) { chosen.push(rows[0]); continue; }
        const main = mainShow ? rows.find((r) => String(r.show_id) === String(mainShow)) : null;
        if (!main) {
          skipped += 1;
          console.log(`[backfill-follower-labels] profile ${profileId} left alone: ledger rows in ${rows.length} shows, none of them ${mainShow ? 'the main show' : 'a main show found'}.`);
          continue;
        }
        fromMain += 1;
        chosen.push(main);
      }

      for (const row of chosen) {
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
        + `${fromMain} in more than one show took the main show's count; ${skipped} left alone (several shows, no main-show row); `
        + `${missing} ledger profile(s) not found.`);
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
