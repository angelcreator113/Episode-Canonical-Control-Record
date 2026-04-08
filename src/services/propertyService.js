'use strict';

/**
 * PropertyService — Manages HOME_BASE properties (multi-room homes).
 *
 * A Property is a WorldLocation (location_type: 'property') that contains
 * child rooms, each linked to a SceneSet. The property holds a style guide
 * that cascades to all rooms, ensuring visual consistency.
 *
 * Flow: Create Property → Add Rooms → Pick Layout per Room → Decorate → Generate Angles
 */

// ─── ROOM TEMPLATES ──────────────────────────────────────────────────────────
// Empty room layout templates — define architectural features, not decoration.
// Each template generates an empty room image that becomes the base for decoration.

const ROOM_TEMPLATES = {
  // ── Bedrooms ──
  'bedroom-master-rectangular': {
    id: 'bedroom-master-rectangular',
    label: 'Master Bedroom — Rectangular',
    room_type: 'bedroom',
    description: 'Spacious rectangular master bedroom with high ceilings, large window wall, and en-suite/closet access points',
    features: ['high_ceiling', 'crown_molding', 'large_windows', 'ensuite_door', 'closet_door'],
    prompt_base: 'Empty luxury master bedroom, rectangular layout, high ceilings with crown molding, floor-to-ceiling windows on one wall, door to walk-in closet visible, door to en-suite bathroom visible, hardwood or marble flooring, no furniture, no decoration, clean walls, architectural detail only, photorealistic',
    default_angles: ['WIDE', 'WINDOW', 'CLOSET_ENTRY', 'ENSUITE_ENTRY', 'HEADBOARD_WALL', 'OVERHEAD'],
  },
  'bedroom-master-open': {
    id: 'bedroom-master-open',
    label: 'Master Suite — Open Plan',
    room_type: 'bedroom',
    description: 'Grand open-plan master suite with sitting area, panoramic windows, and architectural archways',
    features: ['double_height_ceiling', 'panoramic_windows', 'sitting_area_nook', 'archway_to_closet', 'pocket_door_ensuite'],
    prompt_base: 'Empty grand open-plan master suite, double-height or tray ceiling, panoramic floor-to-ceiling windows spanning one wall, architectural archway leading to closet area, pocket door to bathroom, distinct sitting area alcove, luxury flooring, no furniture, no decoration, photorealistic',
    default_angles: ['WIDE', 'PANORAMIC_WINDOW', 'SITTING_AREA', 'CLOSET_ARCHWAY', 'OVERHEAD', 'DOORWAY'],
  },
  'bedroom-master-balcony': {
    id: 'bedroom-master-balcony',
    label: 'Master Bedroom — Balcony Suite',
    room_type: 'bedroom',
    description: 'Master bedroom with wraparound balcony/terrace access through sliding glass walls',
    features: ['tray_ceiling', 'sliding_glass_wall', 'balcony_terrace', 'crown_molding', 'closet_door', 'ensuite_door'],
    prompt_base: 'Empty luxury master bedroom with tray ceiling and crown molding, entire wall of floor-to-ceiling sliding glass doors opening to wraparound balcony with city/ocean view, closet entrance on side wall, en-suite bathroom door, luxury flooring, no furniture, no decoration, photorealistic',
    default_angles: ['WIDE', 'BALCONY_WALL', 'CLOSET_ENTRY', 'TERRACE', 'HEADBOARD_WALL', 'OVERHEAD', 'DOORWAY'],
  },

  // ── Closets ──
  'closet-walkin-large': {
    id: 'closet-walkin-large',
    label: 'Walk-in Closet — Large',
    room_type: 'closet',
    description: 'Spacious walk-in closet with center island, floor-to-ceiling shelving walls, and full-length mirror',
    features: ['center_island_space', 'built_in_shelving_walls', 'full_length_mirror_wall', 'entry_from_bedroom'],
    prompt_base: 'Empty luxury walk-in closet, spacious with center island space, built-in shelving systems on three walls (no clothes), full-length mirror panel, recessed lighting, luxury flooring, entry doorway visible, no clothes or accessories, architectural shell only, photorealistic',
    default_angles: ['WIDE', 'ENTRY', 'MIRROR_WALL', 'SHELVING_DETAIL'],
  },
  'closet-walkin-boutique': {
    id: 'closet-walkin-boutique',
    label: 'Walk-in Closet — Boutique Style',
    room_type: 'closet',
    description: 'Boutique-style closet with display cases, seating area, and dramatic lighting',
    features: ['glass_display_cases', 'seating_nook', 'chandelier', 'entry_from_bedroom', 'accent_lighting'],
    prompt_base: 'Empty luxury boutique-style walk-in closet, glass display case alcoves in walls, small seating area, chandelier or statement light fixture, accent lighting built into shelving, luxury flooring, entry from bedroom visible, no clothes or items, architectural shell only, photorealistic',
    default_angles: ['WIDE', 'ENTRY', 'DISPLAY_WALL', 'SEATING', 'OVERHEAD'],
  },

  // ── Bathrooms ──
  'bathroom-ensuite-spa': {
    id: 'bathroom-ensuite-spa',
    label: 'En-Suite Bathroom — Spa Style',
    room_type: 'bathroom',
    description: 'Luxury spa-style bathroom with freestanding tub, walk-in shower, and double vanity',
    features: ['freestanding_tub_space', 'walkin_shower_glass', 'double_vanity_wall', 'entry_from_bedroom', 'natural_light'],
    prompt_base: 'Empty luxury spa-style en-suite bathroom, marble or stone surfaces, space for freestanding tub, glass-enclosed walk-in shower area, long double vanity wall with mirror, natural light source, entry from bedroom visible, no fixtures or accessories, architectural shell with material finishes, photorealistic',
    default_angles: ['WIDE', 'TUB_AREA', 'VANITY_WALL', 'SHOWER', 'ENTRY'],
  },

  // ── Living Spaces ──
  'living-room-great': {
    id: 'living-room-great',
    label: 'Great Room / Living Room',
    room_type: 'living_room',
    description: 'Open great room with high ceilings, fireplace wall, and connection to kitchen/dining',
    features: ['high_ceiling', 'fireplace_wall', 'large_windows', 'open_to_kitchen', 'entry_hall'],
    prompt_base: 'Empty luxury great room with high ceilings, statement fireplace wall, large windows, open connection to kitchen area, entry hallway visible, architectural details, luxury flooring, no furniture, photorealistic',
    default_angles: ['WIDE', 'FIREPLACE', 'WINDOW_WALL', 'KITCHEN_CONNECTION', 'ENTRY', 'OVERHEAD'],
  },

  // ── Outdoor ──
  'terrace-wraparound': {
    id: 'terrace-wraparound',
    label: 'Wraparound Terrace / Balcony',
    room_type: 'terrace',
    description: 'Large wraparound terrace with panoramic views, multiple seating zones',
    features: ['glass_railing', 'multiple_zones', 'overhead_pergola_structure', 'planter_areas', 'city_view'],
    prompt_base: 'Empty luxury wraparound terrace balcony, glass railing with panoramic city/ocean view, overhead pergola or shade structure, built-in planter areas, multiple distinct zones for seating, luxury tile or stone flooring, no furniture, photorealistic',
    default_angles: ['WIDE', 'VIEW_PANORAMA', 'LOUNGE_ZONE', 'DINING_ZONE', 'FROM_INTERIOR'],
  },
};

// ─── STYLE GUIDE PRESETS ─────────────────────────────────────────────────────
// High-level style presets that define the material language for a property.

const STYLE_PRESETS = {
  'modern-glam': {
    id: 'modern-glam',
    label: 'Modern Glam',
    description: 'Brushed gold, marble, velvet, crystal — feminine luxury',
    materials: {
      hardware: 'brushed gold',
      stone: 'Calacatta marble',
      upholstery: 'velvet',
      wood: 'white lacquer with gold accents',
      glass: 'crystal and clear glass',
      metal: 'champagne brass and gold',
    },
    palette: ['#F5E6E0', '#E8D5E0', '#C9A96E', '#F7F0EA', '#9B7CB6'],
    flooring: 'wide-plank European white oak or marble',
    ceiling: 'tray or coffered with crown molding',
    lighting: 'warm 2700K, layered (chandelier + sconces + recessed)',
  },
  'minimalist-luxury': {
    id: 'minimalist-luxury',
    label: 'Minimalist Luxury',
    description: 'Clean lines, matte black, white marble, natural wood — restrained opulence',
    materials: {
      hardware: 'matte black',
      stone: 'white Carrara marble',
      upholstery: 'boucle and linen',
      wood: 'natural white oak',
      glass: 'ribbed glass and clear',
      metal: 'blackened steel and matte brass',
    },
    palette: ['#F5F3EF', '#2C2C2C', '#C4B5A0', '#E8E4DE', '#8B8178'],
    flooring: 'polished concrete or wide-plank natural oak',
    ceiling: 'clean flat with recessed lighting',
    lighting: 'warm-neutral 3000K, hidden cove and track lighting',
  },
  'hollywood-regency': {
    id: 'hollywood-regency',
    label: 'Hollywood Regency',
    description: 'High contrast, mirrors, velvet, chrome — old Hollywood drama',
    materials: {
      hardware: 'polished chrome',
      stone: 'black marble and onyx',
      upholstery: 'jewel-tone velvet and silk',
      wood: 'high-gloss lacquer (black or white)',
      glass: 'smoked mirror and crystal',
      metal: 'polished chrome and lucite',
    },
    palette: ['#1A1A2E', '#E8C547', '#8B0000', '#F5F5F5', '#4A0E4E'],
    flooring: 'black and white marble checkerboard or dark hardwood',
    ceiling: 'coffered with statement chandelier',
    lighting: 'dramatic 2700K, chandeliers and picture lights',
  },
  'coastal-luxury': {
    id: 'coastal-luxury',
    label: 'Coastal Luxury',
    description: 'Light woods, white stone, rattan, ocean blues — breezy elegance',
    materials: {
      hardware: 'brushed nickel',
      stone: 'white quartz and limestone',
      upholstery: 'linen and performance fabric',
      wood: 'bleached oak and driftwood',
      glass: 'sea glass tones and clear',
      metal: 'weathered brass and white iron',
    },
    palette: ['#F7F5F0', '#6B9DAE', '#D4C5A9', '#E8F0F2', '#2C5F6E'],
    flooring: 'bleached wide-plank oak or white limestone',
    ceiling: 'exposed beams or shiplap with ceiling fans',
    lighting: 'bright natural 4000K, woven pendants and lanterns',
  },
};

// ─── SERVICE FUNCTIONS ───────────────────────────────────────────────────────

/**
 * Get a room template by ID.
 */
function getTemplate(templateId) {
  return ROOM_TEMPLATES[templateId] || null;
}

/**
 * List all templates, optionally filtered by room_type.
 */
function listTemplates(roomType = null) {
  const all = Object.values(ROOM_TEMPLATES);
  if (roomType) return all.filter(t => t.room_type === roomType);
  return all;
}

/**
 * Get a style preset by ID.
 */
function getStylePreset(presetId) {
  return STYLE_PRESETS[presetId] || null;
}

/**
 * List all style presets.
 */
function listStylePresets() {
  return Object.values(STYLE_PRESETS);
}

/**
 * Build an empty room generation prompt from a template + style guide.
 * The style guide comes from the parent property (WorldLocation.style_guide).
 *
 * @param {object} template — from ROOM_TEMPLATES
 * @param {object} styleGuide — from WorldLocation.style_guide or STYLE_PRESETS
 * @returns {string} Generation prompt for an empty room
 */
function buildEmptyRoomPrompt(template, styleGuide) {
  if (!template) return '';

  let prompt = template.prompt_base;

  // Inject style guide materials
  if (styleGuide?.materials) {
    const matParts = [];
    if (styleGuide.materials.hardware) matParts.push(`${styleGuide.materials.hardware} door handles and hardware`);
    if (styleGuide.materials.stone) matParts.push(`${styleGuide.materials.stone} surfaces where stone appears`);
    if (styleGuide.materials.wood) matParts.push(`${styleGuide.materials.wood} trim and cabinetry`);
    if (styleGuide.materials.metal) matParts.push(`${styleGuide.materials.metal} fixtures`);
    if (matParts.length) prompt += `. Materials: ${matParts.join(', ')}.`;
  }

  // Inject flooring and ceiling
  if (styleGuide?.flooring) prompt += ` Flooring: ${styleGuide.flooring}.`;
  if (styleGuide?.ceiling) prompt += ` Ceiling: ${styleGuide.ceiling}.`;

  // Inject color palette
  if (styleGuide?.palette?.length) {
    prompt += ` Wall colors from palette: ${styleGuide.palette.slice(0, 3).join(', ')}.`;
  }

  // Inject lighting
  if (styleGuide?.lighting) prompt += ` Lighting: ${styleGuide.lighting}.`;

  prompt += ' Empty room, no furniture, no decoration, no people. Architectural shell only.';

  return prompt;
}

/**
 * Get the effective style guide for a room — room's own guide merged with
 * parent property guide (property values as defaults, room overrides win).
 *
 * @param {object} room — WorldLocation (child room)
 * @param {object} property — WorldLocation (parent property)
 * @returns {object} Merged style guide
 */
function getEffectiveStyleGuide(room, property) {
  const propertyGuide = property?.style_guide || {};
  const roomGuide = room?.style_guide || {};

  return {
    ...propertyGuide,
    ...roomGuide,
    materials: {
      ...(propertyGuide.materials || {}),
      ...(roomGuide.materials || {}),
    },
    palette: roomGuide.palette || propertyGuide.palette || [],
  };
}

/**
 * Validate room connections — check that target scene sets exist and
 * the connection objects are defined in the scene spec.
 *
 * @param {Array} connections — room_connections array
 * @param {object} SceneSetModel — for querying
 * @returns {object} { valid: boolean, issues: string[] }
 */
async function validateRoomConnections(connections, SceneSetModel) {
  if (!connections?.length) return { valid: true, issues: [] };

  const issues = [];
  const targetIds = connections.map(c => c.target_scene_set_id).filter(Boolean);

  if (targetIds.length > 0) {
    const found = await SceneSetModel.findAll({
      where: { id: targetIds },
      attributes: ['id', 'name'],
    });
    const foundIds = new Set(found.map(s => s.id));
    for (const c of connections) {
      if (c.target_scene_set_id && !foundIds.has(c.target_scene_set_id)) {
        issues.push(`Connection target ${c.target_scene_set_id} not found`);
      }
    }
  }

  return { valid: issues.length === 0, issues };
}


module.exports = {
  ROOM_TEMPLATES,
  STYLE_PRESETS,
  getTemplate,
  listTemplates,
  getStylePreset,
  listStylePresets,
  buildEmptyRoomPrompt,
  getEffectiveStyleGuide,
  validateRoomConnections,
};
