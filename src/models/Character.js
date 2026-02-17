module.exports = (sequelize, DataTypes) => {
  const Character = sequelize.define('Character', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    show_id: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false },
    role: { type: DataTypes.STRING(50), allowNull: false },
    display_name: { type: DataTypes.STRING(255) },
    avatar_asset_id: { type: DataTypes.UUID },
    metadata: { type: DataTypes.JSONB, defaultValue: {} }
  }, {
    tableName: 'characters',
    underscored: true,
    timestamps: true,
    paranoid: false
  });

  Character.associate = (models) => {
    Character.belongsTo(models.Show, { foreignKey: 'show_id', as: 'show' });
    Character.hasMany(models.Wardrobe, { foreignKey: 'character_id', as: 'wardrobeItems' });
  };

  return Character;
};
