module.exports = (sequelize, DataTypes) => {
  const CharacterProfile = sequelize.define('CharacterProfile', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    show_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    character_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    
    // Editing style per character
    editing_style: {
      type: DataTypes.JSONB,
      defaultValue: {
        pacing: 'medium',           // fast, medium, slow
        preferred_framing: 'medium', // close, medium, wide
        reaction_frequency: 0.5,     // 0-1 scale
        overlay_behavior: 'minimal', // minimal, moderate, heavy
        cut_on_emphasis: true,       // cut on gesture peaks
        cut_on_breath: false         // cut on breath pauses
      },
      comment: 'Per-character editing style preferences'
    },
    
    // Voice/face IDs for recognition
    voice_embedding: {
      type: DataTypes.JSONB,
      comment: 'Voice signature for diarization'
    },
    face_embeddings: {
      type: DataTypes.JSONB,
      comment: 'Face signatures for recognition'
    }
  }, {
    tableName: 'character_profiles',
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['show_id'] },
      { fields: ['character_name'] }
    ]
  });

  CharacterProfile.associate = (models) => {
    CharacterProfile.belongsTo(models.Show, { 
      foreignKey: 'show_id',
      onDelete: 'CASCADE'
    });
  };

  return CharacterProfile;
};
