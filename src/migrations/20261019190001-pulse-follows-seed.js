'use strict';

/**
 * The first follows on The Pulse (Evoni, 2026-10-19), from what the world
 * already says. Idempotent: a follow that is already live is left alone.
 *
 *   seed_friends  every LalaVerse profile Lala calls a friend
 *                 (social_profiles.lala_relationship = 'direct', the old
 *                 friends list) follows Lala and Lala follows them, so
 *                 nobody leaves her friends list now that friends are the
 *                 people who follow each other.
 *   auto_feed     every LalaVerse profile that came from the feed (crossed:
 *                 status 'crossed' or a crossed_at) follows Lala. One way:
 *                 Lala does not follow them back. (The crossing's
 *                 metadata.source is not stored: registry_characters has no
 *                 metadata column, so the profile's crossing is the record.)
 *
 * Lala's profile is found the way services/lalaFeedProfile finds it (her
 * registry character's feed_profile_id, else the LalaVerse handle 'lala').
 * With no Lala profile nothing is added. The JustAWoman record is never
 * part of The Pulse's follows. down removes only the rows made here.
 */

const BY = 'migration:20261019190001';

const lalaIdSql = `
  SELECT COALESCE(
    (SELECT sp.id FROM registry_characters rc JOIN social_profiles sp ON sp.id = rc.feed_profile_id AND sp.deleted_at IS NULL
      WHERE rc.character_key = 'lala' AND rc.deleted_at IS NULL ORDER BY rc.updated_at DESC LIMIT 1),
    (SELECT id FROM social_profiles WHERE deleted_at IS NULL AND feed_layer = 'lalaverse' AND LOWER(handle) = 'lala' ORDER BY id LIMIT 1)
  ) AS id`;

const PULSE_PEOPLE = `sp.deleted_at IS NULL AND sp.feed_layer = 'lalaverse' AND COALESCE(sp.is_justawoman_record, false) = false`;

const insert = (select) => `
  INSERT INTO pulse_follows (follower_profile_id, followed_profile_id, source, created_by)
  ${select}
  ON CONFLICT (follower_profile_id, followed_profile_id) WHERE deleted_at IS NULL DO NOTHING`;

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const [[lala]] = await sequelize.query(lalaIdSql, { transaction });
      if (!lala || lala.id == null) {
        console.log('[pulse-follows-seed] no Lala profile; nothing added');
        return;
      }
      const replacements = { lala: lala.id, by: BY };
      const run = async (sql) => {
        const [, meta] = await sequelize.query(sql, { replacements, transaction });
        return meta?.rowCount ?? 0;
      };
      const friendsIn = await run(insert(`
        SELECT sp.id, :lala, 'seed_friends', :by FROM social_profiles sp
         WHERE ${PULSE_PEOPLE} AND sp.lala_relationship = 'direct' AND sp.id <> :lala`));
      const friendsOut = await run(insert(`
        SELECT :lala, sp.id, 'seed_friends', :by FROM social_profiles sp
         WHERE ${PULSE_PEOPLE} AND sp.lala_relationship = 'direct' AND sp.id <> :lala`));
      const fromFeed = await run(insert(`
        SELECT sp.id, :lala, 'auto_feed', :by FROM social_profiles sp
         WHERE ${PULSE_PEOPLE} AND sp.id <> :lala
           AND (sp.status = 'crossed' OR sp.crossed_at IS NOT NULL)`));
      console.log(`[pulse-follows-seed] Lala's friends: ${friendsIn} follow her, she follows ${friendsOut}; from the feed: ${fromFeed} follow her`);
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DELETE FROM pulse_follows WHERE created_by = :by', { replacements: { by: BY } });
  },
};
