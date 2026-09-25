'use strict';
const { DataTypes } = require('sequelize');

/**
 * ThumbnailComposition Model
 * Stores composition metadata for generated thumbnails with versioning support
 * Schema matches migrations with versioning columns: current_version, version_history, last_modified_by, modification_timestamp
 */
module.exports = (sequelize) => {
  const ThumbnailComposition = sequelize.define(
    'ThumbnailComposition',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
      },
      episode_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      template_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      background_frame_asset_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      lala_asset_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      guest_asset_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      justawomen_asset_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      justawomaninherprime_asset_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      // Task #1870: these three are in the 2026-09-17 canon capture
      // (boolean NOT NULL / jsonb / varchar) but were undeclared, so
      // CompositionService.createComposition's values were dropped.
      // Task #1884 retired that writer (the legacy POST format); the
      // columns stay declared because canon has them.
      include_justawomaninherprime: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      justawomaninherprime_position: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      approval_status: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      // Task #1897: canon has both (2026-09-17 capture: approved_by
      // character varying, approved_at timestamp without time zone, both
      // nullable) but they were undeclared, so approveComposition's
      // instance update dropped who approved and when. No migration in
      // src/migrations/ creates either column (step 2 of the checker).
      approved_by: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      approved_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      // Task #1909: canon has it (2026-09-17 capture: timestamp without time
      // zone, nullable); POST /:id/generate-thumbnails' instance update in
      // src/routes/compositions.js wrote it and Sequelize dropped it. No
      // migration in src/migrations/ creates it (step 2 baseline).
      published_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      selected_formats: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
      },
      status: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: 'draft',
      },
      created_by: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
      },
      // Versioning columns
      current_version: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 1,
      },
      version_history: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
      },
      last_modified_by: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      modification_timestamp: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
      },
      is_primary: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
        comment: 'Whether this is the primary/canonical composition for the episode',
      },
      composition_config: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Stores visibility toggles, text field values, and per-composition overrides',
      },
      // Task #1909: the Layout Editor's draft columns, written by
      // save-draft / apply-draft in src/routes/compositions.js. Canon lacks
      // all five until 20260925000000-add-draft-columns-to-thumbnail-
      // compositions.js runs; run it BEFORE deploying this declaration, or
      // every ThumbnailComposition query names columns the table lacks.
      // Until then the two routes answer 501
      // (src/services/compositionDraftColumns.js).
      draft_overrides: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      draft_updated_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      draft_updated_by: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      has_unsaved_changes: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      layout_overrides: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
    },
    {
      tableName: 'thumbnail_compositions',
      timestamps: false,
      underscored: true,
    }
  );

  /**
   * Get visibility config for a role
   */
  ThumbnailComposition.prototype.getRoleVisibility = function (role) {
    return this.composition_config?.visibility?.[role] ?? null;
  };

  /**
   * Get text field value for a role
   */
  ThumbnailComposition.prototype.getTextField = function (role) {
    return this.composition_config?.text_fields?.[role] ?? null;
  };

  /**
   * Validate composition config structure
   */
  ThumbnailComposition.prototype.validateConfig = function () {
    const config = this.composition_config || {};
    const errors = [];

    // Validate structure
    if (config.visibility && typeof config.visibility !== 'object') {
      errors.push('visibility must be an object');
    }
    if (config.text_fields && typeof config.text_fields !== 'object') {
      errors.push('text_fields must be an object');
    }
    if (config.overrides && typeof config.overrides !== 'object') {
      errors.push('overrides must be an object');
    }

    return errors.length > 0 ? errors : null;
  };

  return ThumbnailComposition;
};
