'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // registry_character_id on social_profiles — UUID to match RegistryCharacter PK
    await queryInterface.addColumn('social_profiles', 'registry_character_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'registry_characters', key: 'id' },
      comment: 'Auto-set when Feed profile is created from a registry character.',
    }).catch(() => {});

    // feed_profile_id on registry_characters — INTEGER to match SocialProfile PK
    await queryInterface.addColumn('registry_characters', 'feed_profile_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'social_profiles', key: 'id' },
      comment: 'Auto-set on character creation. Null if Feed cap was reached.',
    }).catch(() => {});
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('social_profiles', 'registry_character_id').catch(() => {});
    await queryInterface.removeColumn('registry_characters', 'feed_profile_id').catch(() => {});
  },
};
