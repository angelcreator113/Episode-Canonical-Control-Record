'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add follow motivation & auto-generated tracking columns
    await queryInterface.addColumn('social_profile_followers', 'follow_motivation', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'identity|aspiration|entertainment|information|social_proof|personal|parasocial',
    });

    await queryInterface.addColumn('social_profile_followers', 'follow_probability', {
      type: Sequelize.FLOAT,
      allowNull: true,
      comment: '0.0-1.0 — computed probability this character would follow this creator',
    });

    await queryInterface.addColumn('social_profile_followers', 'auto_generated', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false,
      comment: 'Whether this follow was auto-assigned by the follow engine vs manual',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('social_profile_followers', 'follow_motivation');
    await queryInterface.removeColumn('social_profile_followers', 'follow_probability');
    await queryInterface.removeColumn('social_profile_followers', 'auto_generated');
  },
};
