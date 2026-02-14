'use strict';
const { DataTypes } = require('sequelize');

/**
 * WardrobeLibraryReferences Model
 * Track S3 file references to prevent deletion of in-use files
 */
module.exports = (sequelize) => {
  const WardrobeLibraryReferences = sequelize.define(
    'WardrobeLibraryReferences',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      libraryItemId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'library_item_id',
        references: {
          model: 'wardrobe_library',
          key: 'id',
        },
      },
      s3Key: {
        type: DataTypes.STRING(500),
        allowNull: false,
        field: 's3_key',
      },
      referenceCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        field: 'reference_count',
      },
      fileSize: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: 'file_size',
      },
      contentType: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'content_type',
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'created_at',
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'updated_at',
      },
    },
    {
      tableName: 'wardrobe_library_references',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        {
          unique: true,
          fields: ['library_item_id', 's3_key'],
          name: 'unique_library_s3_key',
        },
        { fields: ['s3_key'] },
      ],
    }
  );

  // Instance methods
  WardrobeLibraryReferences.prototype.incrementReference = async function () {
    this.referenceCount += 1;
    await this.save();
    return this;
  };

  WardrobeLibraryReferences.prototype.decrementReference = async function () {
    this.referenceCount -= 1;
    if (this.referenceCount <= 0) {
      await this.destroy();
    } else {
      await this.save();
    }
    return this;
  };

  // Associations will be defined in models/index.js
  WardrobeLibraryReferences.associate = function (models) {
    // Belongs to library item
    WardrobeLibraryReferences.belongsTo(models.WardrobeLibrary, {
      foreignKey: 'library_item_id',
      as: 'libraryItem',
    });
  };

  return WardrobeLibraryReferences;
};
