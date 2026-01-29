const { DataTypes } = require('sequelize');

/**
 * Scene Model
 * Represents individual scenes within an episode
 */
module.exports = (sequelize) => {
  const Scene = sequelize.define(
    'Scene',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      episode_id: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'episode_id',
      },
      // CamelCase alias for episode_id
      episodeId: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('episode_id');
        },
        set(value) {
          this.setDataValue('episode_id', value);
        },
      },
      scene_number: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'scene_number',
        validate: {
          min: 1,
        },
      },
      // CamelCase alias for scene_number
      sceneNumber: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('scene_number');
        },
        set(value) {
          this.setDataValue('scene_number', value);
        },
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: true,
        validate: {
          len: [1, 255],
        },
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      duration_seconds: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'duration_seconds',
        validate: {
          min: 0,
        },
      },
      // CamelCase alias for duration_seconds
      durationSeconds: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('duration_seconds');
        },
        set(value) {
          this.setDataValue('duration_seconds', value);
        },
      },
      location: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      scene_type: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'scene_type',
        validate: {
          isIn: [['intro', 'main', 'outro', 'transition']],
        },
      },
      // CamelCase alias for scene_type
      sceneType: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('scene_type');
        },
        set(value) {
          this.setDataValue('scene_type', value);
        },
      },
      production_status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'draft',
        field: 'production_status',
        validate: {
          isIn: [['draft', 'storyboarded', 'recorded', 'edited', 'complete']],
        },
      },
      // CamelCase alias for production_status
      productionStatus: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('production_status');
        },
        set(value) {
          this.setDataValue('production_status', value);
        },
      },
      mood: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      script_notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'script_notes',
      },
      // CamelCase alias for script_notes
      scriptNotes: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('script_notes');
        },
        set(value) {
          this.setDataValue('script_notes', value);
        },
      },
      start_timecode: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'start_timecode',
      },
      // CamelCase alias for start_timecode
      startTimecode: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('start_timecode');
        },
        set(value) {
          this.setDataValue('start_timecode', value);
        },
      },
      end_timecode: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'end_timecode',
      },
      // CamelCase alias for end_timecode
      endTimecode: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('end_timecode');
        },
        set(value) {
          this.setDataValue('end_timecode', value);
        },
      },
      is_locked: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_locked',
      },
      // CamelCase alias for is_locked
      isLocked: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('is_locked');
        },
        set(value) {
          this.setDataValue('is_locked', value);
        },
      },
      locked_at: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'locked_at',
      },
      // CamelCase alias for locked_at
      lockedAt: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('locked_at');
        },
        set(value) {
          this.setDataValue('locked_at', value);
        },
      },
      locked_by: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'locked_by',
      },
      // CamelCase alias for locked_by
      lockedBy: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('locked_by');
        },
        set(value) {
          this.setDataValue('locked_by', value);
        },
      },
      characters: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      created_by: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'created_by',
      },
      // CamelCase alias for created_by
      createdBy: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('created_by');
        },
        set(value) {
          this.setDataValue('created_by', value);
        },
      },
      updated_by: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'updated_by',
      },
      // CamelCase alias for updated_by
      updatedBy: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('updated_by');
        },
        set(value) {
          this.setDataValue('updated_by', value);
        },
      },
      thumbnail_id: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'thumbnail_id',
        references: {
          model: 'thumbnails',
          key: 'id',
        },
      },
      // CamelCase alias for thumbnail_id
      thumbnailId: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('thumbnail_id');
        },
        set(value) {
          this.setDataValue('thumbnail_id', value);
        },
      },
      assets: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
        validate: {
          isValidAssets(value) {
            if (value && typeof value !== 'object') {
              throw new Error('Assets must be a JSON object');
            }
          },
        },
      },
    },
    {
      sequelize,
      modelName: 'Scene',
      tableName: 'scenes',
      timestamps: true,
      underscored: true,
      paranoid: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
    }
  );

  // Static helper methods
  Scene.getEpisodeScenes = async function (episodeId) {
    return await this.findAll({
      where: { episode_id: episodeId },
      order: [['scene_number', 'ASC']],
    });
  };

  Scene.getNextSceneNumber = async function (episodeId) {
    const lastScene = await this.findOne({
      where: { episode_id: episodeId },
      order: [['scene_number', 'DESC']],
    });

    return lastScene ? lastScene.scene_number + 1 : 1;
  };

  // Reorder scenes for an episode
  Scene.reorderScenes = async function (episodeId, sceneIds, transaction) {
    const scenes = [];
    for (let i = 0; i < sceneIds.length; i++) {
      const scene = await this.findByPk(sceneIds[i], { transaction });
      if (scene && scene.episode_id === episodeId) {
        scene.scene_number = i + 1;
        await scene.save({ transaction });
        scenes.push(scene);
      }
    }
    return scenes;
  };

  // Instance methods
  Scene.prototype.lock = async function (userId) {
    this.is_locked = true;
    this.locked_at = new Date();
    this.locked_by = userId;
    await this.save();
    return this;
  };

  Scene.prototype.unlock = async function () {
    this.is_locked = false;
    this.locked_at = null;
    this.locked_by = null;
    await this.save();
    return this;
  };

  Scene.prototype.updateStatus = async function (status) {
    const validStatuses = ['draft', 'storyboarded', 'recorded', 'edited', 'complete'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
    }
    this.production_status = status;
    await this.save();
    return this;
  };

  Scene.prototype.addCharacter = async function (characterName) {
    if (!this.characters) {
      this.characters = [];
    }
    if (!this.characters.includes(characterName)) {
      this.characters = [...this.characters, characterName];
      await this.save();
    }
    return this;
  };

  Scene.prototype.removeCharacter = async function (characterName) {
    if (this.characters && this.characters.includes(characterName)) {
      this.characters = this.characters.filter((c) => c !== characterName);
      await this.save();
    }
    return this;
  };

  Scene.prototype.setThumbnail = async function (thumbnailId, userId) {
    if (this.is_locked) {
      throw new Error('Cannot modify thumbnail on locked scene');
    }
    this.thumbnail_id = thumbnailId;
    this.updated_by = userId;
    await this.save();
    return this;
  };

  Scene.prototype.updateAssets = async function (assetData, userId) {
    if (this.is_locked) {
      throw new Error('Cannot modify assets on locked scene');
    }
    this.assets = {
      ...this.assets,
      ...assetData,
    };
    this.updated_by = userId;
    await this.save();
    return this;
  };

  Scene.prototype.toJSON = function () {
    return {
      id: this.id,
      episodeId: this.episode_id,
      sceneNumber: this.scene_number,
      title: this.title,
      description: this.description,
      sceneType: this.scene_type,
      location: this.location,
      characters: this.characters,
      mood: this.mood,
      startTimecode: this.start_timecode,
      endTimecode: this.end_timecode,
      durationSeconds: this.duration_seconds,
      productionStatus: this.production_status,
      scriptNotes: this.script_notes,
      isLocked: this.is_locked,
      lockedAt: this.locked_at,
      lockedBy: this.locked_by,
      thumbnailId: this.thumbnail_id,
      thumbnail: this.thumbnail,
      assets: this.assets,
      createdAt: this.created_at,
      updatedAt: this.updated_at,
      createdBy: this.created_by,
      updatedBy: this.updated_by,
    };
  };

  return Scene;
};
