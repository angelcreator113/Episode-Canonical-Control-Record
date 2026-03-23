'use strict';

/**
 * Scene-Type Priors — shared by sceneIdentityService (extraction) and
 * sceneGenerationService (prompt building).
 *
 * Each prior grounds Claude extraction and negative-prompt assembly
 * with scene-type-specific expectations.
 */

const SCENE_TYPE_PRIORS = {
  HOME_BASE: {
    spatial_logic: 'intimate personal space, lived-in with personal objects',
    composition_bias: 'warm depth, layered textures, focal intimacy',
    common_anchors: 'bed/seating, personal items, window, lighting fixture',
    common_avoid: 'dorm-room clutter, random extra furniture, warped mirrors',
  },
  CLOSET: {
    spatial_logic: 'storage and display, organized collection, vertical surfaces',
    composition_bias: 'grid patterns, texture repetition, directional light on surfaces',
    common_anchors: 'garment racks, shelving, mirror, organized accessories',
    common_avoid: 'duplicated garments, impossible shelving, melted hangers',
  },
  EVENT_LOCATION: {
    spatial_logic: 'social staging, scale and grandeur, designed for gathering',
    composition_bias: 'wide depth, architectural framing, designed focal points',
    common_anchors: 'seating arrangements, lighting fixtures, stage/focal area',
    common_avoid: 'empty dead space, banquet randomness, warped tables, floating objects',
  },
  TRANSITION: {
    spatial_logic: 'movement corridor, passage between spaces, directional flow',
    composition_bias: 'leading lines, vanishing point, journey composition',
    common_anchors: 'doorways, corridor walls, lighting along path',
    common_avoid: 'impossible vanishing points, asymmetric wall geometry, dead ends',
  },
  OTHER: {
    spatial_logic: 'unique space with its own architectural logic',
    composition_bias: 'whatever best reveals the space identity',
    common_anchors: 'defining architectural features',
    common_avoid: 'generic anonymous space, visual noise',
  },
};

module.exports = { SCENE_TYPE_PRIORS };
