'use strict';
const { DataTypes } = require('sequelize');

/**
 * AssetRole Model
 * Show-level role registry defining semantic slots for assets
 */
module.exports = (sequelize) => {
  const AssetRole = sequelize.define(
    'AssetRole',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      show_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'shows',
          key: 'id',
        },
      },
      role_key: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Immutable identifier (HOST, GUEST_1, etc.)',
      },
      role_label: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Editable display name',
      },
      category: {
        type: DataTypes.STRING(100),
        comment: 'Characters, UI Icons, UI Chrome, Branding, Background',
      },
      icon: {
        type: DataTypes.STRING(50),
        comment: 'Emoji or icon code for UI display',
      },
      color: {
        type: DataTypes.STRING(20),
        comment: 'Hex color for UI display',
      },
      is_required: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Must be filled for composer export',
      },
      sort_order: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      description: {
        type: DataTypes.TEXT,
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: 'asset_roles',
      timestamps: false,
      indexes: [
        {
          unique: true,
          fields: ['show_id', 'role_key'],
        },
        {
          fields: ['show_id'],
        },
        {
          fields: ['role_key'],
        },
      ],
    }
  );

  // Default role set (17 canonical roles)
  AssetRole.DEFAULT_ROLES = [
    // CHARACTERS
    {
      role_key: 'HOST',
      role_label: 'Host (Lala)',
      category: 'Characters',
      icon: '👩',
      color: '#ec4899',
      is_required: true,
      sort_order: 1,
      description: 'Primary show host',
    },
    {
      role_key: 'CO_HOST',
      role_label: 'Co-Host',
      category: 'Characters',
      icon: '👤',
      color: '#f472b6',
      is_required: false,
      sort_order: 2,
      description: 'Secondary host or regular guest',
    },
    {
      role_key: 'GUEST_1',
      role_label: 'Guest 1',
      category: 'Characters',
      icon: '🎤',
      color: '#a855f7',
      is_required: false,
      sort_order: 3,
      description: 'Featured guest slot 1',
    },
    {
      role_key: 'GUEST_2',
      role_label: 'Guest 2',
      category: 'Characters',
      icon: '🎤',
      color: '#a855f7',
      is_required: false,
      sort_order: 4,
      description: 'Featured guest slot 2',
    },
    {
      role_key: 'GUEST_3',
      role_label: 'Guest 3',
      category: 'Characters',
      icon: '🎤',
      color: '#a855f7',
      is_required: false,
      sort_order: 5,
      description: 'Featured guest slot 3',
    },

    // UI ICONS
    {
      role_key: 'ICON_CLOSET',
      role_label: 'Closet Icon',
      category: 'UI Icons',
      icon: '👗',
      color: '#3b82f6',
      is_required: false,
      sort_order: 10,
      description: 'Wardrobe/closet UI element',
    },
    {
      role_key: 'ICON_JEWELRY',
      role_label: 'Jewelry Box Icon',
      category: 'UI Icons',
      icon: '💎',
      color: '#3b82f6',
      is_required: false,
      sort_order: 11,
      description: 'Jewelry/accessories UI element',
    },
    {
      role_key: 'ICON_SHOES',
      role_label: 'Shoes Icon',
      category: 'UI Icons',
      icon: '👠',
      color: '#3b82f6',
      is_required: false,
      sort_order: 12,
      description: 'Footwear UI element',
    },
    {
      role_key: 'ICON_MAKEUP',
      role_label: 'Makeup Icon',
      category: 'UI Icons',
      icon: '💄',
      color: '#3b82f6',
      is_required: false,
      sort_order: 13,
      description: 'Beauty/makeup UI element',
    },

    // UI CHROME
    {
      role_key: 'CHROME_CURSOR',
      role_label: 'Cursor/Pointer',
      category: 'UI Chrome',
      icon: '👆',
      color: '#6b7280',
      is_required: false,
      sort_order: 20,
      description: 'Custom cursor design',
    },
    {
      role_key: 'CHROME_EXIT',
      role_label: 'Exit Button',
      category: 'UI Chrome',
      icon: '❌',
      color: '#6b7280',
      is_required: false,
      sort_order: 21,
      description: 'Exit/close button',
    },
    {
      role_key: 'CHROME_MINIMIZE',
      role_label: 'Minimize Button',
      category: 'UI Chrome',
      icon: '➖',
      color: '#6b7280',
      is_required: false,
      sort_order: 22,
      description: 'Minimize button',
    },

    // BRANDING
    {
      role_key: 'BRAND_SHOW_TITLE',
      role_label: 'Show Title Logo',
      category: 'Branding',
      icon: '✨',
      color: '#8b5cf6',
      is_required: true,
      sort_order: 30,
      description: 'Main show title/logo',
    },
    {
      role_key: 'BRAND_SUBTITLE',
      role_label: 'Episode Subtitle',
      category: 'Branding',
      icon: '📝',
      color: '#8b5cf6',
      is_required: false,
      sort_order: 31,
      description: 'Episode-specific subtitle',
    },
    {
      role_key: 'BRAND_WATERMARK',
      role_label: 'Watermark',
      category: 'Branding',
      icon: '🔖',
      color: '#8b5cf6',
      is_required: false,
      sort_order: 32,
      description: 'Brand watermark overlay',
    },

    // BACKGROUND
    {
      role_key: 'BACKGROUND_MAIN',
      role_label: 'Background',
      category: 'Background',
      icon: '🌄',
      color: '#10b981',
      is_required: true,
      sort_order: 40,
      description: 'Primary background image',
    },
    {
      role_key: 'BACKGROUND_OVERLAY',
      role_label: 'Background Overlay',
      category: 'Background',
      icon: '🎨',
      color: '#10b981',
      is_required: false,
      sort_order: 41,
      description: 'Background texture/overlay',
    },
  ];

  return AssetRole;
};
