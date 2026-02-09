const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const LayerAsset = sequelize.define('LayerAsset', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    layer_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'layers',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    asset_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'assets',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    position_x: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'X coordinate in pixels'
    },
    position_y: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Y coordinate in pixels'
    },
    width: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Width in pixels, null for original size'
    },
    height: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Height in pixels, null for original size'
    },
    rotation: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0.00,
      validate: {
        min: 0.00,
        max: 360.00
      },
      comment: 'Rotation in degrees (0-360)'
    },
    scale_x: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 1.00,
      validate: {
        min: 0.01,
        max: 10.00
      },
      comment: 'Horizontal scale multiplier'
    },
    scale_y: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 1.00,
      validate: {
        min: 0.01,
        max: 10.00
      },
      comment: 'Vertical scale multiplier'
    },
    opacity: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 1.00,
      validate: {
        min: 0.00,
        max: 1.00
      },
      comment: 'Asset-level opacity override'
    },
    start_time: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: true,
      comment: 'When asset appears in timeline (seconds)'
    },
    duration: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: true,
      comment: 'How long asset shows (seconds)'
    },
    order_index: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Order within layer for rendering sequence'
    },
    in_point_seconds: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      comment: 'When asset appears in timeline (seconds)'
    },
    out_point_seconds: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'When asset disappears from timeline (seconds)'
    },
    transition_in: {
      type: DataTypes.STRING(50),
      defaultValue: 'none',
      comment: 'Fade-in, slide-in, zoom-in, none'
    },
    transition_out: {
      type: DataTypes.STRING(50),
      defaultValue: 'none',
      comment: 'Fade-out, slide-out, zoom-out, none'
    },
    animation_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Pan, zoom, rotate, none'
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: 'Crop, filters, effects, animations, etc.'
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
    }
  }, {
    tableName: 'layer_assets',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['layer_id']
      },
      {
        fields: ['asset_id']
      },
      {
        fields: ['layer_id', 'order_index']
      }
    ]
  });

  // Associations will be defined in models/index.js
  LayerAsset.associate = (models) => {
    LayerAsset.belongsTo(models.Layer, {
      foreignKey: 'layer_id',
      as: 'layer'
    });

    LayerAsset.belongsTo(models.Asset, {
      foreignKey: 'asset_id',
      as: 'asset'
    });
  };

  return LayerAsset;
};
