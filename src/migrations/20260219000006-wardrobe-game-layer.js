/**
 * Migration: Wardrobe Game Layer
 * 
 * Adds narrative/game fields to existing wardrobe + wardrobe_library tables.
 * These fields power the "visible but not owned" system, tier unlocking,
 * era alignment, and event matching for the evaluation formula.
 */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {

    // ─── WARDROBE TABLE (per-show items) ───
    const wTable = await queryInterface.describeTable('wardrobe').catch(() => null);
    if (!wTable) {
      console.log('⚠️ wardrobe table not found. Skipping wardrobe columns.');
    } else {
      const addIfMissing = async (col, def) => {
        if (!wTable[col]) await queryInterface.addColumn('wardrobe', col, def);
      };

      await addIfMissing('tier', {
        type: Sequelize.STRING(20),
        defaultValue: 'basic',
        comment: 'basic | mid | luxury | elite',
      });
      await addIfMissing('lock_type', {
        type: Sequelize.STRING(30),
        defaultValue: 'none',
        comment: 'none | coin | reputation | brand_exclusive | dream_fund | season_drop | influence',
      });
      await addIfMissing('unlock_requirement', {
        type: Sequelize.JSONB,
        defaultValue: {},
        comment: '{"coins":2500} or {"reputation_min":7} or {"episode_min":12}',
      });
      await addIfMissing('is_owned', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Does Lala currently own this item?',
      });
      await addIfMissing('is_visible', {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: 'Is this visible in the closet (even if locked)?',
      });
      await addIfMissing('era_alignment', {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'foundation | glow_up | luxury | prime | legacy',
      });
      await addIfMissing('aesthetic_tags', {
        type: Sequelize.JSONB,
        defaultValue: [],
        comment: '["romantic","soft","elegant","bold","edgy","cozy","couture"]',
      });
      await addIfMissing('event_types', {
        type: Sequelize.JSONB,
        defaultValue: [],
        comment: '["gala","brand_shoot","casual","garden","editorial"]',
      });
      await addIfMissing('outfit_match_weight', {
        type: Sequelize.INTEGER,
        defaultValue: 5,
        comment: 'How much this contributes to outfit match score (1-10)',
      });
      await addIfMissing('coin_cost', {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Cost in Prime Coins to purchase/unlock',
      });
      await addIfMissing('reputation_required', {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Minimum reputation to unlock',
      });
      await addIfMissing('influence_required', {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Minimum influence to unlock',
      });
      await addIfMissing('season_unlock_episode', {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Episode number when this item drops (season_drop lock)',
      });
      await addIfMissing('lala_reaction_own', {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'What Lala says when she owns it and selects it',
      });
      await addIfMissing('lala_reaction_locked', {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'What Lala says when she sees it but can\'t have it',
      });
      await addIfMissing('lala_reaction_reject', {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'What Lala says when she rejects it during browse',
      });

      // Indexes
      await queryInterface.addIndex('wardrobe', ['tier'], { name: 'idx_wardrobe_tier' }).catch(() => {});
      await queryInterface.addIndex('wardrobe', ['lock_type'], { name: 'idx_wardrobe_lock_type' }).catch(() => {});
      await queryInterface.addIndex('wardrobe', ['is_owned'], { name: 'idx_wardrobe_is_owned' }).catch(() => {});
      await queryInterface.addIndex('wardrobe', ['era_alignment'], { name: 'idx_wardrobe_era' }).catch(() => {});
    }

    // ─── WARDROBE_LIBRARY TABLE (same game fields) ───
    const wlTable = await queryInterface.describeTable('wardrobe_library').catch(() => null);
    if (!wlTable) {
      console.log('⚠️ wardrobe_library table not found. Skipping library columns.');
    } else {
      const addIfMissing = async (col, def) => {
        if (!wlTable[col]) await queryInterface.addColumn('wardrobe_library', col, def);
      };

      await addIfMissing('tier', {
        type: Sequelize.STRING(20),
        defaultValue: 'basic',
      });
      await addIfMissing('lock_type', {
        type: Sequelize.STRING(30),
        defaultValue: 'none',
      });
      await addIfMissing('unlock_requirement', {
        type: Sequelize.JSONB,
        defaultValue: {},
      });
      await addIfMissing('era_alignment', {
        type: Sequelize.STRING(50),
        allowNull: true,
      });
      await addIfMissing('aesthetic_tags', {
        type: Sequelize.JSONB,
        defaultValue: [],
      });
      await addIfMissing('event_types', {
        type: Sequelize.JSONB,
        defaultValue: [],
      });
      await addIfMissing('outfit_match_weight', {
        type: Sequelize.INTEGER,
        defaultValue: 5,
      });
      await addIfMissing('coin_cost', {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      });
      await addIfMissing('reputation_required', {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      });
      await addIfMissing('lala_reaction_own', { type: Sequelize.TEXT, allowNull: true });
      await addIfMissing('lala_reaction_locked', { type: Sequelize.TEXT, allowNull: true });
      await addIfMissing('lala_reaction_reject', { type: Sequelize.TEXT, allowNull: true });
    }

    console.log('✅ Wardrobe game layer fields added');
  },

  async down(queryInterface) {
    const gameCols = [
      'tier', 'lock_type', 'unlock_requirement', 'is_owned', 'is_visible',
      'era_alignment', 'aesthetic_tags', 'event_types', 'outfit_match_weight',
      'coin_cost', 'reputation_required', 'influence_required', 'season_unlock_episode',
      'lala_reaction_own', 'lala_reaction_locked', 'lala_reaction_reject',
    ];
    for (const col of gameCols) {
      await queryInterface.removeColumn('wardrobe', col).catch(() => {});
      await queryInterface.removeColumn('wardrobe_library', col).catch(() => {});
    }
  },
};
