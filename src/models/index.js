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

const { Sequelize, DataTypes } = require('sequelize');
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
let EpisodeWardrobeDefault, AssetUsageLog;
let WardrobeLibrary, OutfitSetItems, WardrobeUsageHistory, WardrobeLibraryReferences;
let SceneLibrary, EpisodeScene;
let CompositionAsset, CompositionOutput;
let TimelinePlacement, Marker;
let AIEditPlan, EditingDecision, AIRevision, VideoProcessingJob;
let AITrainingData, ScriptMetadata, SceneLayerConfiguration, LayerPreset, Layer, LayerAsset;
let SceneFootageLink;
let UserDecision, DecisionPattern, DecisionLog;
let ShowConfig, ScriptTemplate, ScriptLearningProfile, ScriptEditHistory, ScriptSuggestion;
let EditMap, CharacterProfile, RawFootage;
let Character; // Characters model
let Beat, CharacterClip, AudioClip; // Phase 2.5 Animatic System models
let TimelineData; // Scene Composer & Timeline Editor integration
let StorytellerBook, StorytellerChapter, StorytellerLine; // StoryTeller Book Editor models
let StorytellerMemory; // StoryTeller Memory Bank model
let StorytellerEcho; // StoryTeller Decision Echo model
let StorytellerStory; // Story Engine persistence model
let SocialMediaImport; // Social media import pipeline model
let NovelAssembly; // Novel assembler model
let Universe, BookSeries; // Universe + Book Series models
let CharacterRegistry, RegistryCharacter; // PNOS Character Registry models
let ContinuityTimeline, ContinuityCharacter, ContinuityBeat, ContinuityBeatCharacter; // Continuity Engine models
let LalaEmergenceScene; // Lala Emergence Scene Detection model
let CharacterRelationship; // Character Relationship Map model
let CharacterTherapyProfile; // Character Therapy Psychological Narrative Engine model
let PressCareer; // LalaVerse Press career tracking model
let LalaverseBrand; // LalaVerse brand registry model
let WardrobeBrandTag; // Wardrobe brand tag model
let TherapyPendingSession; // Therapy pending session model
let WardrobeContentAssignment; // Wardrobe content assignment model
let CharacterSpark; // Character Spark (3-field fast entry) model
let SceneProposal; // Scene Intelligence Engine proposals
let CharacterGrowthLog; // Character Growth Engine logs
let FranchiseKnowledge; // Franchise story knowledge brain
let FranchiseTechKnowledge; // Franchise tech knowledge (build assistant only)
let SessionBrief; // Session brief generation
let PostGenerationReview; // Post-generation franchise review
let WritingRhythm; // Writing rhythm tracking
let WritingGoal; // Writing goals
let MultiProductContent; // Multi-product content generation
let VoiceSignal; // Novel Intelligence: voice pattern signals
let VoiceRule; // Novel Intelligence: confirmed voice rules
let ManuscriptMetadata; // Novel Intelligence: book metadata cascade
let BrainFingerprint; // Novel Intelligence: brain dedup fingerprints
let SocialProfile; // The Feed: social media creator profiles
let SocialProfileFollower; // The Feed: character-follows-profile join table
let CharacterFollowProfile; // Consumer follow system: character consumption affinities
let SocialProfileRelationship; // The Feed: creator-to-creator relationships (drama, collabs, couples)
let CharacterEntanglement; // Entanglement Layer: character ↔ influencer links
let EntanglementEvent; // Entanglement Layer: ripple log — state changes + content events
let EntanglementUnfollow; // Entanglement Layer: unfollow as narrative event
let BulkImportJob; // The Feed: background bulk import job queue
let RelationshipEvent; // Relationship timeline turning points
let StoryRevision; // Revision history for edited stories
let WorldTimelineEvent; // World calendar/timeline events
let WorldLocation; // Location/geography database
let WorldStateSnapshot; // World-state snapshots per chapter
let PipelineTracking; // End-to-end pipeline status tracking
let StoryThread; // Story thread / subplot tracking
let AmberFinding; // Amber Diagnostic Engine — findings
let AmberScanRun; // Amber Diagnostic Engine — scan runs
let AmberTaskQueue; // Amber Diagnostic Engine — task queue
let HairLibrary; // Hair style asset library
let MakeupLibrary; // Makeup look asset library
let StoryClockMarker; // Story Calendar: named story positions with calendar dates
let StoryCalendarEvent; // Story Calendar: events in LalaVerse time
let CalendarEventAttendee; // Story Calendar: per-character event experience
let CalendarEventRipple; // Story Calendar: event propagation / ripple threads
let FeedProfileRelationship; // Feed Relationship Map: influencer-to-influencer
let CharacterCrossing; // Character Crossings: interior → public transition
let AuthorNote; // Author Layer: polymorphic creative decision notes
let PageContent; // Page Content: editable page data (JSONB)
let AssetRole; // Asset role registry (semantic slots)
let UniverseCharacter; // Universe-level promoted characters
let WorldCharacter; // LalaVerse world characters (real people in Lala's world)
let BrainDocument; // Brain Documents: stores full ingested document text
let AIUsageLog; // AI API cost/token tracking
let CharacterArc; // Arc tracking: wound clock, stakes, visibility, David silence
let StoryTexture; // Texture layer: inner thought, conflict, body narrator, private moment, post, bleed
let StoryTaskArc; // Story Engine: persisted 50-story task arc per character

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

  // Characters model
  Character = require('./Character')(sequelize, DataTypes);

  // Wardrobe models
  Wardrobe = require('./Wardrobe')(sequelize);
  EpisodeWardrobe = require('./EpisodeWardrobe')(sequelize);

  // Outfit sets model
  OutfitSet = require('./OutfitSet')(sequelize);

  // Asset wardrobe system models
  EpisodeWardrobeDefault = require('./EpisodeWardrobeDefault')(sequelize);
  AssetUsageLog = require('./AssetUsageLog')(sequelize);

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
  
  // Phase 2 Timeline Markers
  Marker = require('./Marker')(sequelize);
  
  // Phase 2.5 Animatic System models
  Beat = require('./Beat')(sequelize);
  CharacterClip = require('./CharacterClip')(sequelize);
  AudioClip = require('./AudioClip')(sequelize);

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
  DecisionLog = require('./DecisionLog')(sequelize);

  // Script Generator models
  ShowConfig = require('./ShowConfig')(sequelize);
  ScriptTemplate = require('./ScriptTemplate')(sequelize);
  ScriptLearningProfile = require('./ScriptLearningProfile')(sequelize);
  ScriptEditHistory = require('./ScriptEditHistory')(sequelize);
  ScriptSuggestion = require('./ScriptSuggestion')(sequelize);
  
  // Try to load optional models (may not exist yet)
  let RawFootage;
  try {
    RawFootage = require('./RawFootage')(sequelize);
  } catch (e) {
    console.log('⚠️  RawFootage model not found, creating minimal stub');
    RawFootage = sequelize.define('RawFootage', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      episode_id: DataTypes.UUID,
      s3_key: DataTypes.STRING,
      file_size: DataTypes.BIGINT,
      upload_purpose: DataTypes.STRING,
      character_visible: DataTypes.JSON,
      intended_scene_id: DataTypes.UUID,
      recording_context: DataTypes.JSON,
      created_at: { type: DataTypes.DATE, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DataTypes.DATE, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
    }, { tableName: 'raw_footage', timestamps: false });
  }

  // Video Analysis Models
  EditMap = require('./EditMap')(sequelize, DataTypes);
  CharacterProfile = require('./CharacterProfile')(sequelize, DataTypes);

  // Scene Composer & Timeline Editor integration
  TimelineData = require('./TimelineData')(sequelize);

  // StoryTeller Book Editor models
  StorytellerBook = require('./StorytellerBook')(sequelize);
  StorytellerChapter = require('./StorytellerChapter')(sequelize);
  StorytellerLine = require('./StorytellerLine')(sequelize);

  // StoryTeller Memory Bank model
  StorytellerMemory = require('./StorytellerMemory')(sequelize);

  // StoryTeller Decision Echo model
  StorytellerEcho = require('./StorytellerEcho')(sequelize);

  // Universe + Book Series models
  Universe = require('./Universe')(sequelize);
  BookSeries = require('./BookSeries')(sequelize);

  // PNOS Character Registry models
  CharacterRegistry = require('./CharacterRegistry')(sequelize);
  RegistryCharacter = require('./RegistryCharacter')(sequelize);

  // Continuity Engine models
  ContinuityTimeline = require('./ContinuityTimeline')(sequelize);
  ContinuityCharacter = require('./ContinuityCharacter')(sequelize);
  ContinuityBeat = require('./ContinuityBeat')(sequelize);
  ContinuityBeatCharacter = require('./ContinuityBeatCharacter')(sequelize);

  // Lala Emergence Scene Detection model
  LalaEmergenceScene = require('./LalaEmergenceScene')(sequelize);

  // Character Relationship Map model
  CharacterRelationship = require('./CharacterRelationship')(sequelize);

  // Character Therapy — Psychological Narrative Engine model
  CharacterTherapyProfile = require('./CharacterTherapyProfile')(sequelize);

  // LalaVerse Press career tracking model
  PressCareer = require('./PressCareer')(sequelize);

  // LalaVerse brand registry + wardrobe brand tags + therapy pending sessions
  LalaverseBrand = require('./LalaverseBrand')(sequelize);
  WardrobeBrandTag = require('./WardrobeBrandTag')(sequelize);
  TherapyPendingSession = require('./TherapyPendingSession')(sequelize);
  WardrobeContentAssignment = require('./WardrobeContentAssignment')(sequelize);

  // Story Engine persistence + Social Import + Novel Assembler
  StorytellerStory = require('./StorytellerStory')(sequelize);
  SocialMediaImport = require('./SocialMediaImport')(sequelize);
  NovelAssembly = require('./NovelAssembly')(sequelize);

  // Character Spark (3-field fast entry)
  CharacterSpark = require('./CharacterSpark')(sequelize);

  // Scene Intelligence + Character Growth
  SceneProposal = require('./SceneProposal')(sequelize);
  CharacterGrowthLog = require('./CharacterGrowthLog')(sequelize);

  // Upgrade tables — tech knowledge, session briefs, reviews, rhythm, goals, multi-product
  FranchiseKnowledge = require('./FranchiseKnowledge')(sequelize, DataTypes);
  FranchiseTechKnowledge = require('./FranchiseTechKnowledge')(sequelize, DataTypes);
  BrainDocument = require('./BrainDocument')(sequelize, DataTypes);
  AIUsageLog = require('./AIUsageLog')(sequelize, DataTypes);

  // Arc Tracking model (wound clock, stakes, visibility, David silence)
  CharacterArc = require('./CharacterArc')(sequelize);

  // Texture Layer model (inner thought, conflict, body narrator, private moment, post, bleed)
  StoryTexture = require('./StoryTexture')(sequelize);
  StoryTaskArc = require('./StoryTaskArc')(sequelize);

  SessionBrief = require('./SessionBrief')(sequelize, DataTypes);
  PostGenerationReview = require('./PostGenerationReview')(sequelize, DataTypes);
  WritingRhythm = require('./WritingRhythm')(sequelize, DataTypes);
  WritingGoal = require('./WritingGoal')(sequelize, DataTypes);
  MultiProductContent = require('./MultiProductContent')(sequelize, DataTypes);

  // Novel Intelligence Engine models
  VoiceSignal = require('./VoiceSignal')(sequelize, DataTypes);
  VoiceRule = require('./VoiceRule')(sequelize, DataTypes);
  ManuscriptMetadata = require('./ManuscriptMetadata')(sequelize, DataTypes);
  BrainFingerprint = require('./BrainFingerprint')(sequelize, DataTypes);

  // The Feed: Social Profile Generator
  SocialProfile = require('./SocialProfile')(sequelize, DataTypes);
  SocialProfileFollower = require('./SocialProfileFollower')(sequelize, DataTypes);
  CharacterFollowProfile = require('./CharacterFollowProfile')(sequelize, DataTypes);
  SocialProfileRelationship = require('./SocialProfileRelationship')(sequelize, DataTypes);
  CharacterEntanglement = require('./CharacterEntanglement')(sequelize, DataTypes);
  EntanglementEvent = require('./EntanglementEvent')(sequelize, DataTypes);
  EntanglementUnfollow = require('./EntanglementUnfollow')(sequelize, DataTypes);
  BulkImportJob = require('./BulkImportJob')(sequelize, DataTypes);

  // Tier feature models
  RelationshipEvent = require('./RelationshipEvent')(sequelize);
  StoryRevision = require('./StoryRevision')(sequelize);
  WorldTimelineEvent = require('./WorldTimelineEvent')(sequelize);
  WorldLocation = require('./WorldLocation')(sequelize);
  WorldStateSnapshot = require('./WorldStateSnapshot')(sequelize);
  PipelineTracking = require('./PipelineTracking')(sequelize);
  StoryThread = require('./StoryThread')(sequelize);

  // Amber Diagnostic Engine models
  AmberFinding = require('./AmberFinding')(sequelize, DataTypes);
  AmberScanRun = require('./AmberScanRun')(sequelize, DataTypes);
  AmberTaskQueue = require('./AmberTaskQueue')(sequelize, DataTypes);

  // Hair & Makeup asset libraries
  HairLibrary = require('./HairLibrary')(sequelize);
  MakeupLibrary = require('./MakeupLibrary')(sequelize);

  // Feed Nervous System models
  StoryClockMarker = require('./StoryClockMarker')(sequelize, DataTypes);
  StoryCalendarEvent = require('./StoryCalendarEvent')(sequelize, DataTypes);
  CalendarEventAttendee = require('./CalendarEventAttendee')(sequelize, DataTypes);
  CalendarEventRipple = require('./CalendarEventRipple')(sequelize, DataTypes);
  FeedProfileRelationship = require('./FeedProfileRelationship')(sequelize, DataTypes);
  CharacterCrossing = require('./CharacterCrossing')(sequelize, DataTypes);
  AuthorNote = require('./AuthorNote')(sequelize, DataTypes);
  PageContent = require('./PageContent')(sequelize, DataTypes);
  AssetRole = require('./AssetRole')(sequelize, DataTypes);
  UniverseCharacter = require('./UniverseCharacter')(sequelize, DataTypes);
  WorldCharacter = require('./WorldCharacter')(sequelize, DataTypes);

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
  EpisodeWardrobeDefault,
  AssetUsageLog,
  WardrobeLibrary,
  OutfitSetItems,
  WardrobeUsageHistory,
  WardrobeLibraryReferences,
  SceneLibrary,
  EpisodeScene,
  TimelinePlacement,
  Marker,
  Beat, // Phase 2.5
  CharacterClip, // Phase 2.5
  AudioClip, // Phase 2.5
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
  EditMap,
  CharacterProfile,
  Character,
  StorytellerBook,
  StorytellerChapter,
  StorytellerLine,
  StorytellerMemory,
  StorytellerEcho,
  Universe,
  BookSeries,
  CharacterRegistry,
  RegistryCharacter,
  ContinuityTimeline,
  ContinuityCharacter,
  ContinuityBeat,
  ContinuityBeatCharacter,
  LalaEmergenceScene,
  CharacterRelationship,
  CharacterTherapyProfile,
  PressCareer,
  StorytellerStory,
  SocialMediaImport,
  NovelAssembly,
  SceneProposal,
  CharacterGrowthLog,
  FranchiseKnowledge,
  DecisionLog,
  ShowConfig,
  ScriptTemplate,
  ScriptLearningProfile,
  ScriptEditHistory,
  ScriptSuggestion,
  TimelineData,
  LalaverseBrand,
  WardrobeBrandTag,
  TherapyPendingSession,
  WardrobeContentAssignment,
  CharacterSpark,
  FranchiseTechKnowledge,
  SessionBrief,
  PostGenerationReview,
  WritingRhythm,
  WritingGoal,
  MultiProductContent,
  VoiceSignal,
  VoiceRule,
  ManuscriptMetadata,
  BrainFingerprint,
  SocialProfile,
  SocialProfileFollower,
  CharacterFollowProfile,
  SocialProfileRelationship,
  CharacterEntanglement,
  EntanglementEvent,
  EntanglementUnfollow,
  BulkImportJob,
  RelationshipEvent,
  StoryRevision,
  WorldTimelineEvent,
  WorldLocation,
  WorldStateSnapshot,
  PipelineTracking,
  StoryThread,
  AmberFinding,
  AmberScanRun,
  AmberTaskQueue,
  HairLibrary,
  MakeupLibrary,
  StoryClockMarker,
  StoryCalendarEvent,
  CalendarEventAttendee,
  CalendarEventRipple,
  FeedProfileRelationship,
  CharacterCrossing,
  AuthorNote,
  PageContent,
  AssetRole,
  UniverseCharacter,
  WorldCharacter,
  BrainDocument,
  AIUsageLog,
  CharacterArc,
  StoryTexture,
  StoryTaskArc,
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
if (Marker && Marker.associate) {
  Marker.associate(requiredModels);
}
if (Beat && Beat.associate) {
  Beat.associate(requiredModels);
}
if (CharacterClip && CharacterClip.associate) {
  CharacterClip.associate(requiredModels);
}
if (AudioClip && AudioClip.associate) {
  AudioClip.associate(requiredModels);
}
if (Character && Character.associate) {
  Character.associate(requiredModels);
}

// Universe + BookSeries associations
if (Universe && Universe.associate) {
  Universe.associate(requiredModels);
}
if (BookSeries && BookSeries.associate) {
  BookSeries.associate(requiredModels);
}

// StoryTeller associations
if (StorytellerBook && StorytellerBook.associate) {
  StorytellerBook.associate(requiredModels);
}
if (StorytellerChapter && StorytellerChapter.associate) {
  StorytellerChapter.associate(requiredModels);
}
if (StorytellerLine && StorytellerLine.associate) {
  StorytellerLine.associate(requiredModels);
}
if (StorytellerMemory && StorytellerMemory.associate) {
  StorytellerMemory.associate(requiredModels);
}
if (StorytellerEcho && StorytellerEcho.associate) {
  StorytellerEcho.associate(requiredModels);
}

// StorytellerLine → StorytellerMemory (1:N) — line has many memories
StorytellerLine.hasMany(StorytellerMemory, {
  foreignKey: 'line_id',
  as: 'memories',
});

// RegistryCharacter → StorytellerMemory (1:N) — character has many memories
RegistryCharacter.hasMany(StorytellerMemory, {
  foreignKey: 'character_id',
  as: 'memories',
});

// LalaEmergenceScene associations
LalaEmergenceScene.belongsTo(StorytellerLine,    { foreignKey: 'line_id',    as: 'line' });
LalaEmergenceScene.belongsTo(StorytellerChapter, { foreignKey: 'chapter_id', as: 'chapter' });
LalaEmergenceScene.belongsTo(StorytellerBook,    { foreignKey: 'book_id',    as: 'book' });

// Character Registry associations
if (CharacterRegistry && CharacterRegistry.associate) {
  CharacterRegistry.associate(requiredModels);
}
if (RegistryCharacter && RegistryCharacter.associate) {
  RegistryCharacter.associate(requiredModels);
}

// Continuity Engine associations
if (ContinuityTimeline && ContinuityTimeline.associate) {
  ContinuityTimeline.associate(requiredModels);
}
if (ContinuityCharacter && ContinuityCharacter.associate) {
  ContinuityCharacter.associate(requiredModels);
}
if (ContinuityBeat && ContinuityBeat.associate) {
  ContinuityBeat.associate(requiredModels);
}

// Scene Intelligence + Character Growth associations
if (SceneProposal && SceneProposal.associate) {
  SceneProposal.associate(requiredModels);
}
if (CharacterGrowthLog && CharacterGrowthLog.associate) {
  CharacterGrowthLog.associate(requiredModels);
}
if (VoiceSignal && VoiceSignal.associate) {
  VoiceSignal.associate(requiredModels);
}
if (VoiceRule && VoiceRule.associate) {
  VoiceRule.associate(requiredModels);
}

// Tier feature associations
if (RelationshipEvent && RelationshipEvent.associate) {
  RelationshipEvent.associate(requiredModels);
}
if (WorldTimelineEvent && WorldTimelineEvent.associate) {
  WorldTimelineEvent.associate(requiredModels);
}
if (WorldLocation && WorldLocation.associate) {
  WorldLocation.associate(requiredModels);
}

// CharacterRelationship → RelationshipEvent (1:N)
CharacterRelationship.hasMany(RelationshipEvent, {
  foreignKey: 'relationship_id',
  as: 'events',
});

// SocialProfile → RegistryCharacter association
if (SocialProfile && SocialProfile.associate) {
  SocialProfile.associate(requiredModels);
}
RegistryCharacter.hasMany(SocialProfile, {
  foreignKey: 'registry_character_id',
  as: 'socialProfiles',
});

// Amber Diagnostic Engine associations
if (AmberFinding && AmberFinding.associate) {
  AmberFinding.associate(requiredModels);
}
if (AmberScanRun && AmberScanRun.associate) {
  AmberScanRun.associate(requiredModels);
}

// Hair & Makeup Library associations
if (HairLibrary && HairLibrary.associate) {
  HairLibrary.associate(requiredModels);
}
if (MakeupLibrary && MakeupLibrary.associate) {
  MakeupLibrary.associate(requiredModels);
}

// SocialProfile ↔ SocialProfileFollower (1:N) — characters following a profile
SocialProfile.hasMany(SocialProfileFollower, {
  foreignKey: 'social_profile_id',
  as: 'followers',
});
if (SocialProfileFollower && SocialProfileFollower.associate) {
  SocialProfileFollower.associate(requiredModels);
}
if (CharacterFollowProfile && CharacterFollowProfile.associate) {
  CharacterFollowProfile.associate(requiredModels);
}
if (RegistryCharacter && CharacterFollowProfile) {
  RegistryCharacter.hasMany(CharacterFollowProfile, {
    foreignKey: 'registry_character_id',
    as: 'followProfiles',
  });
}

// SocialProfile ↔ SocialProfileRelationship associations are defined
// inside SocialProfile.associate() and SocialProfileRelationship.associate()
// so we only need to call associate() on the relationship model here.
if (SocialProfileRelationship && SocialProfileRelationship.associate) {
  SocialProfileRelationship.associate(requiredModels);
}

// Entanglement Layer associations
if (CharacterEntanglement && CharacterEntanglement.associate) {
  CharacterEntanglement.associate(requiredModels);
}
if (EntanglementEvent && EntanglementEvent.associate) {
  EntanglementEvent.associate(requiredModels);
}
if (EntanglementUnfollow && EntanglementUnfollow.associate) {
  EntanglementUnfollow.associate(requiredModels);
}

// Feed Nervous System associations
if (StoryClockMarker && StoryClockMarker.associate) {
  StoryClockMarker.associate(requiredModels);
}
if (StoryCalendarEvent && StoryCalendarEvent.associate) {
  StoryCalendarEvent.associate(requiredModels);
}
if (CalendarEventAttendee && CalendarEventAttendee.associate) {
  CalendarEventAttendee.associate(requiredModels);
}
if (CalendarEventRipple && CalendarEventRipple.associate) {
  CalendarEventRipple.associate(requiredModels);
}
if (FeedProfileRelationship && FeedProfileRelationship.associate) {
  FeedProfileRelationship.associate(requiredModels);
}
if (CharacterCrossing && CharacterCrossing.associate) {
  CharacterCrossing.associate(requiredModels);
}
if (AuthorNote && AuthorNote.associate) {
  AuthorNote.associate(requiredModels);
}
if (UniverseCharacter && UniverseCharacter.associate) {
  UniverseCharacter.associate(requiredModels);
}
if (WorldCharacter && WorldCharacter.associate) {
  WorldCharacter.associate(requiredModels);
}
if (EditMap && EditMap.associate) {
  EditMap.associate(requiredModels);
}
if (CharacterArc && CharacterArc.associate) {
  CharacterArc.associate(requiredModels);
}

console.log('✅ Model associations defined');

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
  foreignKey: 'episodeId',
  as: 'thumbnails',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

Thumbnail.belongsTo(Episode, {
  foreignKey: 'episodeId',
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

// ==================== EPISODE WARDROBE DEFAULTS ====================

// Episode ↔ EpisodeWardrobeDefault (1:N)
Episode.hasMany(EpisodeWardrobeDefault, {
  foreignKey: 'episode_id',
  as: 'wardrobeDefaults',
});

EpisodeWardrobeDefault.belongsTo(Episode, {
  foreignKey: 'episode_id',
  as: 'episode',
});

// Asset ↔ EpisodeWardrobeDefault (1:N)
Asset.hasMany(EpisodeWardrobeDefault, {
  foreignKey: 'default_outfit_asset_id',
  as: 'wardrobeDefaultUsages',
});

EpisodeWardrobeDefault.belongsTo(Asset, {
  foreignKey: 'default_outfit_asset_id',
  as: 'outfit',
});

// ==================== ASSET USAGE LOG ====================

AssetUsageLog.belongsTo(Asset, { foreignKey: 'asset_id', as: 'asset' });
AssetUsageLog.belongsTo(Episode, { foreignKey: 'episode_id', as: 'episode' });
AssetUsageLog.belongsTo(Scene, { foreignKey: 'scene_id', as: 'scene' });

Asset.hasMany(AssetUsageLog, { foreignKey: 'asset_id', as: 'usageLogs' });
Episode.hasMany(AssetUsageLog, { foreignKey: 'episode_id', as: 'assetUsageLogs' });
Scene.hasMany(AssetUsageLog, { foreignKey: 'scene_id', as: 'assetUsageLogs' });

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
    Marker,
    Beat, // Phase 2.5
    CharacterClip, // Phase 2.5
    AudioClip, // Phase 2.5
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
    DecisionLog,
    TimelineData,
    LalaverseBrand,
    WardrobeBrandTag,
    TherapyPendingSession,
    WardrobeContentAssignment,
    CharacterSpark,
    HairLibrary,
    MakeupLibrary,
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
module.exports.Marker = Marker;
module.exports.Beat = Beat;
module.exports.CharacterClip = CharacterClip;
module.exports.AudioClip = AudioClip;
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
module.exports.DecisionLog = DecisionLog;
module.exports.SceneFootageLink = SceneFootageLink;
module.exports.ShowConfig = ShowConfig;
module.exports.ScriptTemplate = ScriptTemplate;
module.exports.ScriptLearningProfile = ScriptLearningProfile;
module.exports.ScriptEditHistory = ScriptEditHistory;
module.exports.ScriptSuggestion = ScriptSuggestion;
module.exports.EpisodeWardrobeDefault = EpisodeWardrobeDefault;
module.exports.AssetUsageLog = AssetUsageLog;
module.exports.TimelineData = TimelineData;
module.exports.Character = Character;
module.exports.StorytellerBook = StorytellerBook;
module.exports.StorytellerChapter = StorytellerChapter;
module.exports.StorytellerLine = StorytellerLine;
module.exports.StorytellerMemory = StorytellerMemory;
module.exports.StorytellerEcho = StorytellerEcho;
module.exports.Universe = Universe;
module.exports.BookSeries = BookSeries;
module.exports.CharacterRegistry = CharacterRegistry;
module.exports.RegistryCharacter = RegistryCharacter;
module.exports.ContinuityTimeline = ContinuityTimeline;
module.exports.ContinuityCharacter = ContinuityCharacter;
module.exports.ContinuityBeat = ContinuityBeat;
module.exports.ContinuityBeatCharacter = ContinuityBeatCharacter;
module.exports.LalaEmergenceScene = LalaEmergenceScene;
module.exports.CharacterRelationship = CharacterRelationship;
module.exports.PressCareer = PressCareer;
module.exports.LalaverseBrand = LalaverseBrand;
module.exports.WardrobeBrandTag = WardrobeBrandTag;
module.exports.TherapyPendingSession = TherapyPendingSession;
module.exports.WardrobeContentAssignment = WardrobeContentAssignment;
module.exports.StorytellerStory = StorytellerStory;
module.exports.SocialMediaImport = SocialMediaImport;
module.exports.NovelAssembly = NovelAssembly;
module.exports.CharacterSpark = CharacterSpark;
module.exports.SceneProposal = SceneProposal;
module.exports.CharacterGrowthLog = CharacterGrowthLog;
module.exports.FranchiseKnowledge = FranchiseKnowledge;
module.exports.ShowAsset = ShowAsset;
module.exports.EditMap = EditMap;
module.exports.CharacterProfile = CharacterProfile;
module.exports.CharacterTherapyProfile = CharacterTherapyProfile;
module.exports.FranchiseTechKnowledge = FranchiseTechKnowledge;
module.exports.SessionBrief = SessionBrief;
module.exports.PostGenerationReview = PostGenerationReview;
module.exports.WritingRhythm = WritingRhythm;
module.exports.WritingGoal = WritingGoal;
module.exports.MultiProductContent = MultiProductContent;
module.exports.VoiceSignal = VoiceSignal;
module.exports.VoiceRule = VoiceRule;
module.exports.ManuscriptMetadata = ManuscriptMetadata;
module.exports.BrainFingerprint = BrainFingerprint;
module.exports.SocialProfile = SocialProfile;
module.exports.SocialProfileFollower = SocialProfileFollower;
module.exports.CharacterFollowProfile = CharacterFollowProfile;
module.exports.CharacterEntanglement = CharacterEntanglement;
module.exports.EntanglementEvent = EntanglementEvent;
module.exports.EntanglementUnfollow = EntanglementUnfollow;
module.exports.BulkImportJob = BulkImportJob;
module.exports.RelationshipEvent = RelationshipEvent;
module.exports.StoryRevision = StoryRevision;
module.exports.WorldTimelineEvent = WorldTimelineEvent;
module.exports.WorldLocation = WorldLocation;
module.exports.WorldStateSnapshot = WorldStateSnapshot;
module.exports.PipelineTracking = PipelineTracking;
module.exports.StoryThread = StoryThread;
module.exports.AmberFinding = AmberFinding;
module.exports.AmberScanRun = AmberScanRun;
module.exports.AmberTaskQueue = AmberTaskQueue;
module.exports.HairLibrary = HairLibrary;
module.exports.MakeupLibrary = MakeupLibrary;
module.exports.StoryClockMarker = StoryClockMarker;
module.exports.StoryCalendarEvent = StoryCalendarEvent;
module.exports.CalendarEventAttendee = CalendarEventAttendee;
module.exports.CalendarEventRipple = CalendarEventRipple;
module.exports.FeedProfileRelationship = FeedProfileRelationship;
module.exports.CharacterCrossing = CharacterCrossing;
module.exports.AuthorNote = AuthorNote;
module.exports.PageContent = PageContent;
module.exports.AssetRole = AssetRole;
module.exports.UniverseCharacter = UniverseCharacter;
module.exports.WorldCharacter = WorldCharacter;
module.exports.SocialProfileRelationship = SocialProfileRelationship;
module.exports.AIUsageLog = AIUsageLog;
module.exports.CharacterArc = CharacterArc;
module.exports.StoryTexture = StoryTexture;
