/**
 * Show Model
 * Represents a TV show with episodes
 */

module.exports = (sequelize, DataTypes = require('sequelize').DataTypes) => {
  const Show = sequelize.define(
    'Show',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: 'Unique show identifier',
      },

      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'Show name',
        validate: {
          len: [1, 255],
          notEmpty: true,
        },
      },

      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Show description/synopsis',
      },

      slug: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'URL-friendly show identifier',
        validate: {
          len: [1, 255],
        },
      },

      genre: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Show genre (comma-separated)',
      },

      status: {
        type: DataTypes.ENUM('active', 'archived', 'cancelled', 'in_development'),
        defaultValue: 'active',
        allowNull: false,
        comment: 'Current show status',
      },

      creatorName: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'creator_name',
        comment: 'Creator or producer name',
      },

      network: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Network or platform name',
      },

      episodeCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'episode_count',
        comment: 'Total number of episodes',
      },

      seasonCount: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        field: 'season_count',
        comment: 'Number of seasons',
      },

      premiereDate: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'premiere_date',
        comment: 'Show premiere date',
      },

      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: {},
        comment: 'Additional metadata (ratings, awards, etc)',
      },

      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_active',
        comment: 'Whether the show is active',
      },
    },
    {
      sequelize,
      tableName: 'shows',
      timestamps: true,
      paranoid: true, // Enable soft deletes
      underscored: true,
      indexes: [
        {
          fields: ['slug'],
          unique: true,
        },
        {
          fields: ['status'],
        },
        {
          fields: ['is_active'],
        },
        {
          fields: ['created_at'],
        },
      ],
      comment: 'Stores TV show information',
    }
  );

  /**
   * Instance Methods
   */
  Show.prototype.toJSON = function () {
    const values = Object.assign({}, this.get());
    return values;
  };

  /**
   * Static Methods
   */
  Show.getActive = async function () {
    return this.findAll({
      where: { isActive: true, status: 'active' },
      order: [['createdAt', 'DESC']],
    });
  };

  Show.getBySlug = async function (slug) {
    return this.findOne({
      where: { slug, isActive: true },
    });
  };

  Show.getPopular = async function (limit = 10) {
    return this.findAll({
      where: { isActive: true },
      order: [['episodeCount', 'DESC']],
      limit,
    });
  };

  /**
   * Hooks
   */
  Show.beforeCreate((show) => {
    if (!show.slug) {
      show.slug = show.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }
  });

  Show.beforeUpdate((show) => {
    if (show.changed('name') && !show.changed('slug')) {
      show.slug = show.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }
  });

  return Show;
};
