const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Layer = sequelize.define('Layer', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    episode_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'episodes',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    layer_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 5
      },
      comment: '1-5 (bottom to top)'
    },
    layer_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        isIn: [['background', 'main', 'overlay', 'text', 'audio']]
      }
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    is_visible: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    is_locked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    opacity: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 1.00,
      validate: {
        min: 0.00,
        max: 1.00
      }
    },
    blend_mode: {
      type: DataTypes.STRING(50),
      defaultValue: 'normal',
      validate: {
        isIn: [['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light']]
      }
    },
    z_index: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Fine-tuned ordering within same layer_number'
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: 'Flexible storage for layer-specific settings'
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'created_at'
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'updated_at'
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'deleted_at'
    }
  }, {
    tableName: 'layers',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    paranoid: true,
    deletedAt: 'deleted_at',
    indexes: [
      {
        fields: ['episode_id']
      },
      {
        fields: ['deleted_at'],
        where: {
          deleted_at: null
        }
      },
      {
        fields: ['episode_id', 'layer_number']
      }
    ]
  });

  // Associations will be defined in models/index.js
  Layer.associate = (models) => {
    Layer.belongsTo(models.Episode, {
      foreignKey: 'episode_id',
      as: 'episode'
    });

    Layer.hasMany(models.LayerAsset, {
      foreignKey: 'layer_id',
      as: 'assets'
    });
  };

  return Layer;
};
