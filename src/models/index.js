'use strict';

/**
 * Database Configuration and Model Initialization
 *
 * This file:
 * 1. Loads database configuration from config/sequelize.js
 * 2. Initializes all Sequelize models
 * 3. Sets up model associations
 * 4. Exports models and helper functions
 */

const { Sequelize } = require('sequelize');
// const _path = require('path'); // Removed: unused import
require('dotenv').config();

// Load database configuration
const config = require('../config/sequelize');
const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

if (!dbConfig) {
  throw new Error(`Database configuration not found for environment: ${env}`);
}

/**
 * Initialize Sequelize with environment-specific config
 */
const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
  host: dbConfig.host,
  port: dbConfig.port,
  dialect: dbConfig.dialect,
  logging: dbConfig.logging,
  pool: dbConfig.pool,
  dialectOptions: {
    ...dbConfig.dialectOptions,
    // Force UTF-8 encoding
    client_encoding: 'UTF8',
  },
  define: dbConfig.define,
  retry: dbConfig.retry,
});

// Set UTF-8 encoding on connection
sequelize.afterConnect((connection, _config) => {
  return connection.query('SET CLIENT_ENCODING TO UTF8;');
});

/**
 * Import Models
 * Each model is a function that takes sequelize instance
 */
let Episode, MetadataStorage, Thumbnail, ProcessingQueue, ActivityLog;
let FileStorage, Asset, ThumbnailComposition, ThumbnailTemplate, EpisodeTemplate;
let Show, Scene, AssetLabel, EpisodeAsset, SceneAsset, SceneTemplate, ShowAsset;
let Wardrobe, EpisodeWardrobe, OutfitSet;
let WardrobeLibrary, OutfitSetItems, WardrobeUsageHistory, WardrobeLibraryReferences;
let SceneLibrary, EpisodeScene;
let CompositionAsset, CompositionOutput;
let TimelinePlacement;
let AIEditPlan, EditingDecision, AIRevision, VideoProcessingJob;
let AITrainingData, ScriptMetadata, SceneLayerConfiguration, LayerPreset, Layer, LayerAsset;
let SceneFootageLink;
let UserDecision, DecisionPattern;

try {
  // Core models
  Episode = require('./Episode')(sequelize);
  MetadataStorage = require('./MetadataStorage')(sequelize);
  Thumbnail = require('./Thumbnail')(sequelize);
  ProcessingQueue = require('./ProcessingQueue')(sequelize);
  ActivityLog = require('./ActivityLog')(sequelize);

  // Phase 2 models
  FileStorage = require('./FileStorage')(sequelize);
  Asset = require('./Asset')(sequelize);

  // Phase 2.5 models
  ThumbnailComposition = require('./ThumbnailComposition')(sequelize);
  ThumbnailTemplate = require('./ThumbnailTemplate')(sequelize);
  EpisodeTemplate = require('./EpisodeTemplate')(sequelize);
  CompositionAsset = require('./CompositionAsset')(sequelize);
  CompositionOutput = require('./CompositionOutput')(sequelize);

  // Phase 6 models
  Show = require('./Show')(sequelize);
  Scene = require('./Scene')(sequelize);
  SceneTemplate = require('./SceneTemplate')(sequelize);

  // Asset enhancement models
  AssetLabel = require('./AssetLabel')(sequelize);
  // AssetUsage = require('./AssetUsage')(sequelize); // Table doesn't exist
  EpisodeAsset = require('./EpisodeAsset')(sequelize);
  SceneAsset = require('./SceneAsset')(sequelize);
  ShowAsset = require('./ShowAsset')(sequelize);

  // Wardrobe models
  Wardrobe = require('./Wardrobe')(sequelize);
  EpisodeWardrobe = require('./EpisodeWardrobe')(sequelize);

  // Outfit sets model
  OutfitSet = require('./OutfitSet')(sequelize);

  // Wardrobe Library models
  WardrobeLibrary = require('./WardrobeLibrary')(sequelize);
  OutfitSetItems = require('./OutfitSetItems')(sequelize);
  WardrobeUsageHistory = require('./WardrobeUsageHistory')(sequelize);
  WardrobeLibraryReferences = require('./WardrobeLibraryReferences')(sequelize);

  // Scene Library models (new system)
  SceneLibrary = require('./SceneLibrary')(sequelize);
  EpisodeScene = require('./EpisodeScene')(sequelize);

  // Timeline system models
  TimelinePlacement = require('./TimelinePlacement')(sequelize);

  // AI Editing Models
  AIEditPlan = require('./AIEditPlan')(sequelize);
  EditingDecision = require('./EditingDecision')(sequelize);
  AIRevision = require('./AIRevision')(sequelize);
  VideoProcessingJob = require('./VideoProcessingJob')(sequelize);
  AITrainingData = require('./AITrainingData')(sequelize);
  ScriptMetadata = require('./ScriptMetadata')(sequelize);
  SceneLayerConfiguration = require('./SceneLayerConfiguration')(sequelize);
  LayerPreset = require('./LayerPreset')(sequelize);
  Layer = require('./Layer')(sequelize);
  LayerAsset = require('./LayerAsset')(sequelize);
  SceneFootageLink = require('./SceneFootageLink')(sequelize);

  // Decision Logging models
  UserDecision = require('./UserDecision')(sequelize);
  DecisionPattern = require('./DecisionPattern')(sequelize);

  console.log('✅ All models loaded successfully');
} catch (error) {
  console.error('❌ Error loading models:', error.message);
  throw error;
}

/**
 * Validate Required Models
 */
const requiredModels = {
  Episode,
  MetadataStorage,
  Thumbnail,
  ProcessingQueue,
  ActivityLog,
  FileStorage,
  Asset,
  ThumbnailComposition,
  ThumbnailTemplate,
  EpisodeTemplate,
  Show,
  Scene,
  SceneTemplate,
  AssetLabel,
  // AssetUsage, // Table doesn't exist
  EpisodeAsset,
  SceneAsset,
  ShowAsset,
  Wardrobe,
  EpisodeWardrobe,
  OutfitSet,
  WardrobeLibrary,
  OutfitSetItems,
  WardrobeUsageHistory,
  WardrobeLibraryReferences,
  SceneLibrary,
  EpisodeScene,
  TimelinePlacement,
  AIEditPlan,
  EditingDecision,
  AIRevision,
  VideoProcessingJob,
  AITrainingData,
  ScriptMetadata,
  SceneLayerConfiguration,
  LayerPreset,
  Layer,
  LayerAsset,
  UserDecision,
  DecisionPattern,
  SceneFootageLink,
};

Object.entries(requiredModels).forEach(([name, model]) => {
  if (!model) {
    throw new Error(`Required model not loaded: ${name}`);
  }
});

// Call associate methods for models
if (SceneFootageLink && SceneFootageLink.associate) {
  SceneFootageLink.associate(requiredModels);
}
if (UserDecision && UserDecision.associate) {
  UserDecision.associate(requiredModels);
}
if (DecisionPattern && DecisionPattern.associate) {
  DecisionPattern.associate(requiredModels);
}

/**
 * Define Model Associations
 * Order matters: define associations after all models are loaded
 */

// ==================== EPISODE ASSOCIATIONS ====================

// Episode → MetadataStorage (1:N)
Episode.hasMany(MetadataStorage, {
  foreignKey: 'episode_id',
  as: 'metadata',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

MetadataStorage.belongsTo(Episode, {
  foreignKey: 'episode_id',
  as: 'episode',
});

// Episode → Thumbnail (1:N)
Episode.hasMany(Thumbnail, {
  foreignKey: 'episode_id',
  as: 'thumbnails',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

Thumbnail.belongsTo(Episode, {
  foreignKey: 'episode_id',
  as: 'episode',
});

// Episode → ProcessingQueue (1:N)
Episode.hasMany(ProcessingQueue, {
  foreignKey: 'episode_id',
  as: 'processingJobs',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

ProcessingQueue.belongsTo(Episode, {
  foreignKey: 'episode_id',
  as: 'episode',
});

// Episode → FileStorage (1:N)
Episode.hasMany(FileStorage, {
  foreignKey: 'episode_id',
  as: 'files',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

FileStorage.belongsTo(Episode, {
  foreignKey: 'episode_id',
  as: 'episode',
});

// Episode → Show (N:1)
Episode.belongsTo(Show, {
  foreignKey: 'show_id',
  as: 'show',
});

Show.hasMany(Episode, {
  foreignKey: 'show_id',
  as: 'episodes',
});

// Episode → ThumbnailComposition (1:N)
Episode.hasMany(ThumbnailComposition, {
  foreignKey: 'episode_id',
  as: 'compositions',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

ThumbnailComposition.belongsTo(Episode, {
  foreignKey: 'episode_id',
  as: 'episode',
});

// Episode → Scene (1:N)
Episode.hasMany(Scene, {
  foreignKey: 'episode_id',
  as: 'scenes',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

Scene.belongsTo(Episode, {
  foreignKey: 'episode_id',
  as: 'episode',
});

// Scene → Thumbnail (N:1)
Scene.belongsTo(Thumbnail, {
  foreignKey: 'thumbnail_id',
  as: 'thumbnail',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
});

Thumbnail.hasMany(Scene, {
  foreignKey: 'thumbnail_id',
  as: 'scenes',
});

// Scene ↔ Asset (M:N through SceneAsset)
Scene.belongsToMany(Asset, {
  through: SceneAsset,
  foreignKey: 'scene_id',
  otherKey: 'asset_id',
  as: 'linkedAssets', // Changed from 'assets' to avoid conflict with JSONB field
});

Asset.belongsToMany(Scene, {
  through: SceneAsset,
  foreignKey: 'asset_id',
  otherKey: 'scene_id',
  as: 'scenes',
});

// Direct associations for junction table access
Scene.hasMany(SceneAsset, {
  foreignKey: 'scene_id',
  as: 'sceneAssets',
});

SceneAsset.belongsTo(Scene, {
  foreignKey: 'scene_id',
  as: 'scene',
});

Asset.hasMany(SceneAsset, {
  foreignKey: 'asset_id',
  as: 'sceneAssets',
});

SceneAsset.belongsTo(Asset, {
  foreignKey: 'asset_id',
  as: 'asset',
});

// ==================== PROCESSING QUEUE ASSOCIATIONS ====================

// ProcessingQueue → FileStorage (1:1)
ProcessingQueue.hasOne(FileStorage, {
  foreignKey: 'processing_job_id',
  as: 'file',
});

FileStorage.belongsTo(ProcessingQueue, {
  foreignKey: 'processing_job_id',
  as: 'processingJob',
});

// ==================== THUMBNAIL COMPOSITION ASSOCIATIONS ====================

// ThumbnailComposition → ThumbnailTemplate
ThumbnailComposition.belongsTo(ThumbnailTemplate, {
  foreignKey: 'template_id',
  as: 'template',
});

ThumbnailTemplate.hasMany(ThumbnailComposition, {
  foreignKey: 'template_id',
  as: 'compositions',
});

// ThumbnailTemplate → Show (N:1)
ThumbnailTemplate.belongsTo(Show, {
  foreignKey: 'show_id',
  as: 'show',
});

Show.hasMany(ThumbnailTemplate, {
  foreignKey: 'show_id',
  as: 'thumbnailTemplates',
});

// CompositionAsset junction table associations
CompositionAsset.belongsTo(ThumbnailComposition, {
  foreignKey: 'composition_id',
  as: 'composition',
});

CompositionAsset.belongsTo(Asset, {
  foreignKey: 'asset_id',
  as: 'asset',
});

ThumbnailComposition.hasMany(CompositionAsset, {
  foreignKey: 'composition_id',
  as: 'compositionAssets',
});

Asset.hasMany(CompositionAsset, {
  foreignKey: 'asset_id',
  as: 'compositionAssets',
});

// CompositionOutput associations
CompositionOutput.belongsTo(ThumbnailComposition, {
  foreignKey: 'composition_id',
  as: 'composition',
});

ThumbnailComposition.hasMany(CompositionOutput, {
  foreignKey: 'composition_id',
  as: 'outputs',
});

// ThumbnailComposition → Assets (multiple relationships - LEGACY, kept for backwards compatibility)
ThumbnailComposition.belongsTo(Asset, {
  foreignKey: 'lala_asset_id',
  as: 'lalaAsset',
});

ThumbnailComposition.belongsTo(Asset, {
  foreignKey: 'guest_asset_id',
  as: 'guestAsset',
});

ThumbnailComposition.belongsTo(Asset, {
  foreignKey: 'justawomen_asset_id',
  as: 'justawomanAsset',
});

ThumbnailComposition.belongsTo(Asset, {
  foreignKey: 'background_frame_asset_id',
  as: 'backgroundAsset',
});

// Reverse associations for Assets
Asset.hasMany(ThumbnailComposition, {
  foreignKey: 'lala_asset_id',
  as: 'lalaCompositions',
});

Asset.hasMany(ThumbnailComposition, {
  foreignKey: 'guest_asset_id',
  as: 'guestCompositions',
});

Asset.hasMany(ThumbnailComposition, {
  foreignKey: 'justawomen_asset_id',
  as: 'justawomanCompositions',
});

Asset.hasMany(ThumbnailComposition, {
  foreignKey: 'background_frame_asset_id',
  as: 'backgroundCompositions',
});

// ==================== ASSET LABEL ASSOCIATIONS ====================

// Asset ←→ AssetLabel (Many-to-Many) - Sequelize will auto-create asset_asset_labels junction table
Asset.belongsToMany(AssetLabel, {
  through: 'asset_asset_labels',
  foreignKey: 'asset_id',
  otherKey: 'label_id',
  as: 'labels',
});

AssetLabel.belongsToMany(Asset, {
  through: 'asset_asset_labels',
  foreignKey: 'label_id',
  otherKey: 'asset_id',
  as: 'assets',
});

// NOTE: AssetUsage associations commented out since asset_usage table doesn't exist
// Asset → AssetUsage (1:N)
// Asset.hasMany(AssetUsage, {
//   foreignKey: 'asset_id',
//   as: 'usages',
//   onDelete: 'CASCADE',
// });

// AssetUsage.belongsTo(Asset, {
//   foreignKey: 'asset_id',
//   as: 'asset',
// });

// ==================== WARDROBE ASSOCIATIONS ====================

// Episode ←→ Wardrobe (Many-to-Many through EpisodeWardrobe)
Episode.belongsToMany(Wardrobe, {
  through: EpisodeWardrobe,
  foreignKey: 'episode_id',
  otherKey: 'wardrobe_id',
  as: 'wardrobeItems',
});

Wardrobe.belongsToMany(Episode, {
  through: EpisodeWardrobe,
  foreignKey: 'wardrobe_id',
  otherKey: 'episode_id',
  as: 'episodes',
});

// Episode → EpisodeWardrobe (1:N)
Episode.hasMany(EpisodeWardrobe, {
  foreignKey: 'episode_id',
  as: 'wardrobeLinks',
});

EpisodeWardrobe.belongsTo(Episode, {
  foreignKey: 'episode_id',
  as: 'episode',
});

// Wardrobe → EpisodeWardrobe (1:N)
Wardrobe.hasMany(EpisodeWardrobe, {
  foreignKey: 'wardrobe_id',
  as: 'episodeLinks',
});

EpisodeWardrobe.belongsTo(Wardrobe, {
  foreignKey: 'wardrobe_id',
  as: 'wardrobeItem',
});

// EpisodeWardrobe → Scene (N:1) - Use 'sceneDetails' to avoid collision with 'scene' text field
EpisodeWardrobe.belongsTo(Scene, {
  foreignKey: 'scene_id',
  as: 'sceneDetails',
});

// Wardrobe → WardrobeLibrary (N:1)
Wardrobe.belongsTo(WardrobeLibrary, {
  foreignKey: 'library_item_id',
  as: 'libraryItem',
});

WardrobeLibrary.hasMany(Wardrobe, {
  foreignKey: 'library_item_id',
  as: 'wardrobeItems',
});

// ==================== WARDROBE LIBRARY ASSOCIATIONS ====================

// WardrobeLibrary → Show (N:1)
WardrobeLibrary.belongsTo(Show, {
  foreignKey: 'show_id',
  as: 'show',
});

Show.hasMany(WardrobeLibrary, {
  foreignKey: 'show_id',
  as: 'libraryItems',
});

// WardrobeLibrary → WardrobeUsageHistory (1:N)
WardrobeLibrary.hasMany(WardrobeUsageHistory, {
  foreignKey: 'library_item_id',
  as: 'usageHistory',
});

WardrobeUsageHistory.belongsTo(WardrobeLibrary, {
  foreignKey: 'library_item_id',
  as: 'libraryItem',
});

// WardrobeUsageHistory → Episode (N:1)
WardrobeUsageHistory.belongsTo(Episode, {
  foreignKey: 'episode_id',
  as: 'episode',
});

// WardrobeUsageHistory → Scene (N:1)
WardrobeUsageHistory.belongsTo(Scene, {
  foreignKey: 'scene_id',
  as: 'scene',
});

// WardrobeUsageHistory → Show (N:1)
WardrobeUsageHistory.belongsTo(Show, {
  foreignKey: 'show_id',
  as: 'show',
});

// WardrobeLibrary → WardrobeLibraryReferences (1:N)
WardrobeLibrary.hasMany(WardrobeLibraryReferences, {
  foreignKey: 'library_item_id',
  as: 's3References',
});

WardrobeLibraryReferences.belongsTo(WardrobeLibrary, {
  foreignKey: 'library_item_id',
  as: 'libraryItem',
});

// WardrobeLibrary self-referential: Outfit sets contain items (M:N through OutfitSetItems)
WardrobeLibrary.belongsToMany(WardrobeLibrary, {
  through: OutfitSetItems,
  foreignKey: 'outfit_set_id',
  otherKey: 'wardrobe_item_id',
  as: 'items',
});

// ==================== SCENE LIBRARY ASSOCIATIONS ====================

// SceneLibrary → Show (N:1)
SceneLibrary.belongsTo(Show, {
  foreignKey: 'show_id',
  as: 'show',
});

Show.hasMany(SceneLibrary, {
  foreignKey: 'show_id',
  as: 'sceneLibrary',
});

// SceneLibrary → EpisodeScene (1:N) - one library scene can be used in many episodes
SceneLibrary.hasMany(EpisodeScene, {
  foreignKey: 'scene_library_id',
  as: 'episodeScenes',
});

EpisodeScene.belongsTo(SceneLibrary, {
  foreignKey: 'scene_library_id',
  as: 'libraryScene',
});

// EpisodeScene → Episode (N:1)
EpisodeScene.belongsTo(Episode, {
  foreignKey: 'episode_id',
  as: 'episode',
});

Episode.hasMany(EpisodeScene, {
  foreignKey: 'episode_id',
  as: 'episodeScenes',
});

// ==================== TIMELINE PLACEMENT ASSOCIATIONS ====================

// TimelinePlacement → Episode (N:1)
TimelinePlacement.belongsTo(Episode, {
  foreignKey: 'episode_id',
  as: 'episode',
});

Episode.hasMany(TimelinePlacement, {
  foreignKey: 'episode_id',
  as: 'timelinePlacements',
});

// TimelinePlacement → EpisodeScene (N:1) - scene-attached placements
TimelinePlacement.belongsTo(EpisodeScene, {
  foreignKey: 'scene_id',
  as: 'scene',
});

EpisodeScene.hasMany(TimelinePlacement, {
  foreignKey: 'scene_id',
  as: 'placements',
});

// TimelinePlacement → Asset (N:1) - asset placements
TimelinePlacement.belongsTo(Asset, {
  foreignKey: 'asset_id',
  as: 'asset',
});

Asset.hasMany(TimelinePlacement, {
  foreignKey: 'asset_id',
  as: 'timelinePlacements',
});

// TimelinePlacement → Wardrobe (N:1) - wardrobe placements
TimelinePlacement.belongsTo(Wardrobe, {
  foreignKey: 'wardrobe_item_id',
  as: 'wardrobeItem',
});

Wardrobe.hasMany(TimelinePlacement, {
  foreignKey: 'wardrobe_item_id',
  as: 'timelinePlacements',
});

// ==================== EXISTING ASSOCIATIONS ====================

WardrobeLibrary.belongsToMany(WardrobeLibrary, {
  through: OutfitSetItems,
  foreignKey: 'wardrobe_item_id',
  otherKey: 'outfit_set_id',
  as: 'outfitSets',
});

// Direct associations for OutfitSetItems
OutfitSetItems.belongsTo(WardrobeLibrary, {
  foreignKey: 'outfit_set_id',
  as: 'outfitSet',
});

OutfitSetItems.belongsTo(WardrobeLibrary, {
  foreignKey: 'wardrobe_item_id',
  as: 'wardrobeItem',
});

WardrobeLibrary.hasMany(OutfitSetItems, {
  foreignKey: 'outfit_set_id',
  as: 'outfitItems',
});

WardrobeLibrary.hasMany(OutfitSetItems, {
  foreignKey: 'wardrobe_item_id',
  as: 'itemMemberships',
});

// Episode ↔ Asset (M:N via EpisodeAsset)
Episode.belongsToMany(Asset, {
  through: EpisodeAsset,
  foreignKey: 'episode_id',
  otherKey: 'asset_id',
  as: 'assets',
});

Asset.belongsToMany(Episode, {
  through: EpisodeAsset,
  foreignKey: 'asset_id',
  otherKey: 'episode_id',
  as: 'episodes',
});

// Direct associations for easier querying
Episode.hasMany(EpisodeAsset, {
  foreignKey: 'episode_id',
  as: 'episodeAssets',
});

EpisodeAsset.belongsTo(Episode, {
  foreignKey: 'episode_id',
  as: 'episode',
});

Asset.hasMany(EpisodeAsset, {
  foreignKey: 'asset_id',
  as: 'assetUsages',
});

EpisodeAsset.belongsTo(Asset, {
  foreignKey: 'asset_id',
  as: 'asset',
});

// Show ↔ Asset (M:N via ShowAsset)
Show.belongsToMany(Asset, {
  through: ShowAsset,
  foreignKey: 'show_id',
  otherKey: 'asset_id',
  as: 'assets',
});

Asset.belongsToMany(Show, {
  through: ShowAsset,
  foreignKey: 'asset_id',
  otherKey: 'show_id',
  as: 'shows',
});

// Direct associations for easier querying
Show.hasMany(ShowAsset, {
  foreignKey: 'show_id',
  as: 'showAssets',
});

ShowAsset.belongsTo(Show, {
  foreignKey: 'show_id',
  as: 'show',
});

Asset.hasMany(ShowAsset, {
  foreignKey: 'asset_id',
  as: 'showAssetUsages',
});

ShowAsset.belongsTo(Asset, {
  foreignKey: 'asset_id',
  as: 'asset',
});

// ==================== AI EDITING ASSOCIATIONS ====================

// Episode → AIEditPlan (1:N)
Episode.hasMany(AIEditPlan, {
  foreignKey: 'episode_id',
  as: 'aiEditPlans',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});
AIEditPlan.belongsTo(Episode, {
  foreignKey: 'episode_id',
  as: 'episode',
});

// Episode → Current AI Edit Plan (1:1)
Episode.belongsTo(AIEditPlan, {
  foreignKey: 'current_ai_edit_plan_id',
  as: 'currentAIEditPlan',
  onDelete: 'SET NULL',
});

// Episode → EditingDecision (1:N)
Episode.hasMany(EditingDecision, {
  foreignKey: 'episode_id',
  as: 'editingDecisions',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});
EditingDecision.belongsTo(Episode, {
  foreignKey: 'episode_id',
  as: 'episode',
});

// Scene → EditingDecision (1:N)
Scene.hasMany(EditingDecision, {
  foreignKey: 'scene_id',
  as: 'editingDecisions',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
});
EditingDecision.belongsTo(Scene, {
  foreignKey: 'scene_id',
  as: 'scene',
});

// AIEditPlan → AIRevision (1:N)
AIEditPlan.hasMany(AIRevision, {
  foreignKey: 'original_plan_id',
  as: 'revisions',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});
AIRevision.belongsTo(AIEditPlan, {
  foreignKey: 'original_plan_id',
  as: 'originalPlan',
});

// Episode → VideoProcessingJob (1:N)
Episode.hasMany(VideoProcessingJob, {
  foreignKey: 'episode_id',
  as: 'videoProcessingJobs',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});
VideoProcessingJob.belongsTo(Episode, {
  foreignKey: 'episode_id',
  as: 'episode',
});

// AIEditPlan → VideoProcessingJob (1:N)
AIEditPlan.hasMany(VideoProcessingJob, {
  foreignKey: 'edit_plan_id',
  as: 'processingJobs',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});
VideoProcessingJob.belongsTo(AIEditPlan, {
  foreignKey: 'edit_plan_id',
  as: 'editPlan',
});

// Scene → SceneLayerConfiguration (1:1)
Scene.hasOne(SceneLayerConfiguration, {
  foreignKey: 'scene_id',
  as: 'layerConfiguration',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});
SceneLayerConfiguration.belongsTo(Scene, {
  foreignKey: 'scene_id',
  as: 'scene',
});

// ==================== DECISION LOGGING ASSOCIATIONS ====================

// UserDecision → Episode (N:1)
UserDecision.belongsTo(Episode, {
  foreignKey: 'episode_id',
  as: 'episode',
});

Episode.hasMany(UserDecision, {
  foreignKey: 'episode_id',
  as: 'decisions',
});

// UserDecision → Scene (N:1)
UserDecision.belongsTo(Scene, {
  foreignKey: 'scene_id',
  as: 'scene',
});

Scene.hasMany(UserDecision, {
  foreignKey: 'scene_id',
  as: 'decisions',
});

// ============================================================================
// LAYER MANAGEMENT ASSOCIATIONS
// ============================================================================

// Episode → Layers (1:Many)
Episode.hasMany(Layer, {
  foreignKey: 'episode_id',
  as: 'layers',
  onDelete: 'CASCADE',
});

Layer.belongsTo(Episode, {
  foreignKey: 'episode_id',
  as: 'episode',
  onDelete: 'CASCADE',
});

// Layer → LayerAssets (1:Many)
Layer.hasMany(LayerAsset, {
  foreignKey: 'layer_id',
  as: 'assets',
  onDelete: 'CASCADE',
});

LayerAsset.belongsTo(Layer, {
  foreignKey: 'layer_id',
  as: 'layer',
  onDelete: 'CASCADE',
});

// Asset → LayerAssets (1:Many)
Asset.hasMany(LayerAsset, {
  foreignKey: 'asset_id',
  as: 'layerPlacements',
  onDelete: 'CASCADE',
});

LayerAsset.belongsTo(Asset, {
  foreignKey: 'asset_id',
  as: 'asset',
  onDelete: 'CASCADE',
});

console.log('✅ Model associations defined');

/**
 * Database Helper Functions
 */
const db = {
  // Sequelize instance and class
  sequelize,
  Sequelize,

  // All models
  models: {
    Episode,
    MetadataStorage,
    Thumbnail,
    ProcessingQueue,
    ActivityLog,
    FileStorage,
    Asset,
    ThumbnailComposition,
    ThumbnailTemplate,
    EpisodeTemplate,
    CompositionAsset,
    CompositionOutput,
    Show,
    Scene,
    AssetLabel,
    // AssetUsage, // Table doesn't exist
    EpisodeAsset,
    ShowAsset,
    SceneAsset,
    SceneTemplate,
    Wardrobe,
    EpisodeWardrobe,
    OutfitSet,
    WardrobeLibrary,
    OutfitSetItems,
    WardrobeUsageHistory,
    WardrobeLibraryReferences,
    SceneLibrary,
    EpisodeScene,
    TimelinePlacement,
    AIEditPlan,
    EditingDecision,
    AIRevision,
    VideoProcessingJob,
    AITrainingData,
    ScriptMetadata,
    SceneLayerConfiguration,
    LayerPreset,
    UserDecision,
    DecisionPattern,
  },

  /**
   * Test database connection
   */
  authenticate: async () => {
    try {
      await sequelize.authenticate();
      console.log('✅ Database connection authenticated');
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);

      // Provide helpful error messages
      if (error.message.includes('ECONNREFUSED')) {
        console.error('💡 Is PostgreSQL running?');
        console.error(`💡 Check: ${dbConfig.host}:${dbConfig.port}`);
      } else if (error.message.includes('password authentication failed')) {
        console.error('💡 Check database credentials in .env');
      } else if (error.message.includes('database') && error.message.includes('does not exist')) {
        console.error('💡 Create database first:');
        console.error(`   createdb ${dbConfig.database}`);
      }

      throw error;
    }
  },

  /**
   * Sync database schema with models
   * @param {Object} options - Sequelize sync options
   */
  sync: async (options = {}) => {
    try {
      const defaultOptions = {
        alter: process.env.NODE_ENV === 'development',
        force: false,
        logging: dbConfig.logging,
      };

      console.log(`🔄 Syncing database (${env} mode)...`);
      await sequelize.sync({ ...defaultOptions, ...options });
      console.log('✅ Database schema synchronized');
      return true;
    } catch (error) {
      console.error('❌ Database sync failed:', error.message);
      throw error;
    }
  },

  /**
   * Close database connection gracefully
   */
  close: async () => {
    try {
      await sequelize.close();
      console.log('✅ Database connection closed');
      return true;
    } catch (error) {
      console.error('❌ Error closing database:', error.message);
      throw error;
    }
  },

  /**
   * Drop all tables (DANGER! Development only)
   */
  drop: async () => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('🚨 Cannot drop database in production!');
    }

    const confirmed = process.env.CONFIRM_DROP === 'true';
    if (!confirmed) {
      throw new Error('Set CONFIRM_DROP=true to drop database');
    }

    try {
      console.log('⚠️  Dropping all tables...');
      await sequelize.drop();
      console.log('✅ All tables dropped');
      return true;
    } catch (error) {
      console.error('❌ Error dropping tables:', error.message);
      throw error;
    }
  },

  /**
   * Get database statistics
   */
  getStats: async () => {
    try {
      const [
        episodes,
        metadata,
        thumbnails,
        processingJobs,
        activities,
        files,
        assets,
        compositions,
      ] = await Promise.all([
        Episode.count(),
        MetadataStorage.count(),
        Thumbnail.count(),
        ProcessingQueue.count(),
        ActivityLog.count(),
        FileStorage.count(),
        Asset.count(),
        ThumbnailComposition.count(),
      ]);

      return {
        episodes,
        metadata,
        thumbnails,
        processingJobs,
        activities,
        files,
        assets,
        compositions,
        total:
          episodes +
          metadata +
          thumbnails +
          processingJobs +
          activities +
          files +
          assets +
          compositions,
      };
    } catch (error) {
      console.error('❌ Error getting stats:', error.message);
      throw error;
    }
  },

  /**
   * Check database health
   */
  healthCheck: async () => {
    try {
      await sequelize.authenticate();
      const stats = await db.getStats();

      return {
        status: 'healthy',
        database: dbConfig.database,
        host: dbConfig.host,
        port: dbConfig.port,
        environment: env,
        stats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  },
};

// Export models individually for convenience
module.exports = db;
module.exports.Episode = Episode;
module.exports.MetadataStorage = MetadataStorage;
module.exports.Thumbnail = Thumbnail;
module.exports.ProcessingQueue = ProcessingQueue;
module.exports.ActivityLog = ActivityLog;
module.exports.FileStorage = FileStorage;
module.exports.Asset = Asset;
module.exports.ThumbnailComposition = ThumbnailComposition;
module.exports.ThumbnailTemplate = ThumbnailTemplate;
module.exports.EpisodeTemplate = EpisodeTemplate;
module.exports.CompositionAsset = CompositionAsset;
module.exports.CompositionOutput = CompositionOutput;
module.exports.Show = Show;
module.exports.Scene = Scene;
module.exports.SceneTemplate = SceneTemplate;
module.exports.Wardrobe = Wardrobe;
module.exports.EpisodeWardrobe = EpisodeWardrobe;
module.exports.OutfitSet = OutfitSet;
module.exports.EpisodeWardrobe = EpisodeWardrobe;
module.exports.WardrobeLibrary = WardrobeLibrary;
module.exports.OutfitSetItems = OutfitSetItems;
module.exports.SceneLibrary = SceneLibrary;
module.exports.EpisodeScene = EpisodeScene;
module.exports.WardrobeUsageHistory = WardrobeUsageHistory;
module.exports.WardrobeLibraryReferences = WardrobeLibraryReferences;
module.exports.AssetLabel = AssetLabel;
// module.exports.AssetUsage = AssetUsage; // Table doesn't exist
module.exports.EpisodeAsset = EpisodeAsset;
module.exports.SceneAsset = SceneAsset;
module.exports.TimelinePlacement = TimelinePlacement;
module.exports.AIEditPlan = AIEditPlan;
module.exports.EditingDecision = EditingDecision;
module.exports.AIRevision = AIRevision;
module.exports.VideoProcessingJob = VideoProcessingJob;
module.exports.AITrainingData = AITrainingData;
module.exports.ScriptMetadata = ScriptMetadata;
module.exports.SceneLayerConfiguration = SceneLayerConfiguration;
module.exports.LayerPreset = LayerPreset;
module.exports.Layer = Layer;
module.exports.LayerAsset = LayerAsset;
module.exports.UserDecision = UserDecision;
module.exports.DecisionPattern = DecisionPattern;
module.exports.SceneFootageLink = SceneFootageLink;
