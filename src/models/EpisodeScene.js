const { DataTypes } = require('sequelize');

/**
 * EpisodeScene Model
 * Links library scenes to episodes with episode-specific context
 * Allows same library scene to be used in multiple episodes
 */
module.exports = (sequelize) => {
  const EpisodeScene = sequelize.define(
    'EpisodeScene',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      episode_id: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'episode_id',
        comment: 'Episode this scene is assigned to',
      },
      episodeId: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('episode_id');
        },
        set(value) {
          this.setDataValue('episode_id', value);
        },
      },
      scene_library_id: {
        type: DataTypes.UUID,
        allowNull: true, // Changed to nullable for note support
        field: 'scene_library_id',
        comment: 'Reference to the scene in the library',
      },
      sceneLibraryId: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('scene_library_id');
        },
        set(value) {
          this.setDataValue('scene_library_id', value);
        },
      },
      scene_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'scene_order',
        comment: 'Order/sequence of scene in episode',
      },
      sceneOrder: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('scene_order');
        },
        set(value) {
          this.setDataValue('scene_order', value);
        },
      },
      trim_start: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: true,
        field: 'trim_start',
        comment: 'Episode-specific trim start time in seconds',
      },
      trimStart: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('trim_start');
        },
        set(value) {
          this.setDataValue('trim_start', value);
        },
      },
      trim_end: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: true,
        field: 'trim_end',
        comment: 'Episode-specific trim end time in seconds',
      },
      trimEnd: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('trim_end');
        },
        set(value) {
          this.setDataValue('trim_end', value);
        },
      },
      scene_type: {
        type: DataTypes.ENUM('intro', 'main', 'transition', 'outro'),
        allowNull: true,
        defaultValue: 'main',
        field: 'scene_type',
        comment: 'Episode-specific scene type/context',
      },
      sceneType: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('scene_type');
        },
        set(value) {
          this.setDataValue('scene_type', value);
        },
      },
      episode_notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'episode_notes',
        comment: 'Episode-specific notes for this scene',
      },
      episodeNotes: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('episode_notes');
        },
        set(value) {
          this.setDataValue('episode_notes', value);
        },
      },
      // New fields for clip sequence manager
      type: {
        type: DataTypes.ENUM('clip', 'note'),
        allowNull: false,
        defaultValue: 'clip',
        field: 'type',
        comment: 'Type of sequence item: clip from library or manual note',
      },
      manual_duration_seconds: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: true,
        field: 'manual_duration_seconds',
        comment: 'Manual duration for notes or missing clips',
      },
      manualDurationSeconds: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('manual_duration_seconds');
        },
        set(value) {
          this.setDataValue('manual_duration_seconds', value);
        },
      },
      title_override: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: 'title_override',
        comment: 'Override title for this sequence item',
      },
      titleOverride: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('title_override');
        },
        set(value) {
          this.setDataValue('title_override', value);
        },
      },
      note_text: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'note_text',
        comment: 'Text content for note-type items',
      },
      noteText: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('note_text');
        },
        set(value) {
          this.setDataValue('note_text', value);
        },
      },
      added_by: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'added_by',
        comment: 'User who added this item to the sequence',
      },
      addedBy: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('added_by');
        },
        set(value) {
          this.setDataValue('added_by', value);
        },
      },
      last_edited_at: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_edited_at',
        comment: 'Last time this item was edited',
      },
      lastEditedAt: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('last_edited_at');
        },
        set(value) {
          this.setDataValue('last_edited_at', value);
        },
      },
      // Virtual computed fields
      clipStatus: {
        type: DataTypes.VIRTUAL,
        get() {
          if (this.type === 'note') return 'note';
          const libraryScene = this.libraryScene || this.getDataValue('libraryScene');
          if (!libraryScene) return 'missing';
          const status = libraryScene.processingStatus || libraryScene.processing_status;
          return status || 'ready';
        },
      },
      displayTitle: {
        type: DataTypes.VIRTUAL,
        get() {
          if (this.title_override) return this.title_override;
          if (this.type === 'note') return this.note_text ? this.note_text.substring(0, 50) : 'Note';
          const libraryScene = this.libraryScene || this.getDataValue('libraryScene');
          if (!libraryScene) return 'Missing Clip';
          return libraryScene.title || 'Untitled Clip';
        },
      },
      effectiveDuration: {
        type: DataTypes.VIRTUAL,
        get() {
          if (this.manual_duration_seconds) return parseFloat(this.manual_duration_seconds);
          if (this.type === 'note') return 0;
          const libraryScene = this.libraryScene || this.getDataValue('libraryScene');
          if (!libraryScene) return 0;
          const trimStart = parseFloat(this.trim_start || 0);
          const trimEnd = parseFloat(this.trim_end || libraryScene.duration || libraryScene.duration_seconds || 0);
          return trimEnd - trimStart;
        },
      },
      // production_status: {
      //   type: DataTypes.ENUM('draft', 'storyboarded', 'recorded', 'edited', 'complete'),
      //   allowNull: false,
      //   defaultValue: 'draft',
      //   field: 'production_status',
      //   comment: 'Production status of this scene in the episode',
      // },
      // productionStatus: {
      //   type: DataTypes.VIRTUAL,
      //   get() {
      //     return this.getDataValue('production_status');
      //   },
      //   set(value) {
      //     this.setDataValue('production_status', value);
      //   },
      // },
      // created_by: {
      //   type: DataTypes.STRING(255),
      //   allowNull: true,
      //   field: 'created_by',
      //   comment: 'User who added this scene to the episode',
      // },
      // createdBy: {
      //   type: DataTypes.VIRTUAL,
      //   get() {
      //     return this.getDataValue('created_by');
      //   },
      //   set(value) {
      //     this.setDataValue('created_by', value);
      //   },
      // },
      // updated_by: {
      //   type: DataTypes.STRING(255),
      //   allowNull: true,
      //   field: 'updated_by',
      //   comment: 'User who last updated this episode scene',
      // },
      // updatedBy: {
      //   type: DataTypes.VIRTUAL,
      //   get() {
      //     return this.getDataValue('updated_by');
      //   },
      //   set(value) {
      //     this.setDataValue('updated_by', value);
      //   },
      // },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at',
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'updated_at',
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'deleted_at',
      },
    },
    {
      tableName: 'episode_scenes',
      timestamps: true,
      paranoid: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
      underscored: true,
      indexes: [
        {
          fields: ['episode_id'],
        },
        {
          fields: ['scene_library_id'],
        },
        {
          fields: ['episode_id', 'scene_order'],
        },
        {
          fields: ['production_status'],
        },
      ],
    }
  );

  EpisodeScene.associate = (models) => {
    // Belongs to Episode
    EpisodeScene.belongsTo(models.Episode, {
      foreignKey: 'episode_id',
      as: 'episode',
    });

    // Belongs to SceneLibrary
    EpisodeScene.belongsTo(models.SceneLibrary, {
      foreignKey: 'scene_library_id',
      as: 'libraryScene',
    });
  };

  return EpisodeScene;
};
