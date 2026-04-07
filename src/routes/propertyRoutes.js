'use strict';

/**
 * Property Routes — Multi-room HOME_BASE management.
 *
 * A Property is a WorldLocation (location_type: 'property') that contains
 * child room WorldLocations, each linked to a SceneSet.
 *
 * Routes:
 *   GET    /properties                  — list all properties
 *   POST   /properties                  — create a property
 *   GET    /properties/:id              — get property with rooms
 *   PATCH  /properties/:id              — update property
 *   DELETE /properties/:id              — delete property
 *   POST   /properties/:id/rooms        — add a room to property
 *   PATCH  /properties/:id/rooms/:roomId — update room
 *   DELETE /properties/:id/rooms/:roomId — delete room
 *   GET    /properties/templates         — list room layout templates
 *   GET    /properties/style-presets     — list style guide presets
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const propertyService = require('../services/propertyService');

// Lazy-load models to avoid circular dependency
let models;
function getModels() {
  if (!models) models = require('../models');
  return models;
}

// ─── TEMPLATES & PRESETS ─────────────────────────────────────────────────────

// GET /api/v1/properties/templates — list room layout templates
router.get('/templates', (req, res) => {
  const roomType = req.query.room_type || null;
  const templates = propertyService.listTemplates(roomType);
  res.json({ success: true, data: templates });
});

// GET /api/v1/properties/style-presets — list style guide presets
router.get('/style-presets', (req, res) => {
  const presets = propertyService.listStylePresets();
  res.json({ success: true, data: presets });
});

// ─── PROPERTIES ──────────────────────────────────────────────────────────────

// GET /api/v1/properties — list all properties
router.get('/', async (req, res) => {
  try {
    const { WorldLocation, SceneSet, SceneAngle } = getModels();
    const properties = await WorldLocation.findAll({
      where: { location_type: 'property' },
      include: [{
        model: WorldLocation,
        as: 'childLocations',
        include: [{
          model: SceneSet,
          as: 'sceneSets',
          include: [{
            model: SceneAngle,
            as: 'angles',
            attributes: ['id', 'angle_label', 'still_image_url', 'generation_status'],
          }],
        }],
      }],
      order: [['created_at', 'DESC']],
    });

    res.json({ success: true, data: properties });
  } catch (err) {
    console.error('GET /properties error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/properties — create a property
router.post('/', async (req, res) => {
  try {
    const { WorldLocation } = getModels();
    const { name, description, property_type, style_preset_id, style_guide, universe_id } = req.body;

    if (!name) return res.status(400).json({ success: false, error: 'name is required' });

    // Start with a style preset if provided, override with custom style_guide
    let mergedGuide = null;
    if (style_preset_id) {
      mergedGuide = propertyService.getStylePreset(style_preset_id);
    }
    if (style_guide) {
      mergedGuide = mergedGuide ? { ...mergedGuide, ...style_guide } : style_guide;
    }

    const property = await WorldLocation.create({
      id: uuidv4(),
      name,
      description: description || `${name} — a luxury property in the LalaVerse`,
      location_type: 'property',
      property_type: property_type || 'penthouse',
      style_guide: mergedGuide,
      universe_id: universe_id || null,
    });

    res.status(201).json({ success: true, data: property });
  } catch (err) {
    console.error('POST /properties error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/properties/:id — get property with rooms + scene sets
router.get('/:id', async (req, res) => {
  try {
    const { WorldLocation, SceneSet, SceneAngle } = getModels();
    const property = await WorldLocation.findByPk(req.params.id, {
      include: [{
        model: WorldLocation,
        as: 'childLocations',
        include: [{
          model: SceneSet,
          as: 'sceneSets',
          include: [{
            model: SceneAngle,
            as: 'angles',
          }],
        }],
      }],
    });

    if (!property) return res.status(404).json({ success: false, error: 'Property not found' });
    if (property.location_type !== 'property') {
      return res.status(400).json({ success: false, error: 'This location is not a property' });
    }

    res.json({ success: true, data: property });
  } catch (err) {
    console.error('GET /properties/:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/v1/properties/:id — update property (name, style_guide, floor_plan)
router.patch('/:id', async (req, res) => {
  try {
    const { WorldLocation } = getModels();
    const property = await WorldLocation.findByPk(req.params.id);
    if (!property) return res.status(404).json({ success: false, error: 'Property not found' });

    const allowed = ['name', 'description', 'property_type', 'style_guide', 'floor_plan', 'metadata'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    await property.update(updates);
    res.json({ success: true, data: property });
  } catch (err) {
    console.error('PATCH /properties/:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── ROOMS ───────────────────────────────────────────────────────────────────

// POST /api/v1/properties/:id/rooms — add a room to property
router.post('/:id/rooms', async (req, res) => {
  try {
    const { WorldLocation, SceneSet } = getModels();
    const property = await WorldLocation.findByPk(req.params.id);
    if (!property) return res.status(404).json({ success: false, error: 'Property not found' });

    const { name, room_type, template_id, scene_type } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'name is required' });

    // Resolve template
    const template = template_id ? propertyService.getTemplate(template_id) : null;
    const resolvedRoomType = room_type || template?.room_type || 'bedroom';

    // Map room_type to scene_type
    const sceneType = scene_type || (resolvedRoomType === 'closet' ? 'CLOSET' : 'HOME_BASE');

    // Create room as child WorldLocation
    const room = await WorldLocation.create({
      id: uuidv4(),
      name,
      description: template?.description || `${name} in ${property.name}`,
      location_type: 'interior',
      parent_location_id: property.id,
      universe_id: property.universe_id,
    });

    // Create associated SceneSet
    const sceneSet = await SceneSet.create({
      id: uuidv4(),
      name,
      scene_type: sceneType,
      world_location_id: room.id,
      universe_id: property.universe_id,
      room_type: resolvedRoomType,
      room_layout_template: template_id || null,
      generation_status: 'pending',
    });

    res.status(201).json({
      success: true,
      data: {
        room,
        sceneSet,
        template: template || null,
      },
    });
  } catch (err) {
    console.error('POST /properties/:id/rooms error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/v1/properties/:id/rooms/:roomId — update room
router.patch('/:id/rooms/:roomId', async (req, res) => {
  try {
    const { WorldLocation } = getModels();
    const room = await WorldLocation.findOne({
      where: { id: req.params.roomId, parent_location_id: req.params.id },
    });
    if (!room) return res.status(404).json({ success: false, error: 'Room not found in this property' });

    const allowed = ['name', 'description', 'style_guide', 'metadata'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    await room.update(updates);
    res.json({ success: true, data: room });
  } catch (err) {
    console.error('PATCH /properties/:id/rooms/:roomId error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/properties/:id/rooms/:roomId/generate-empty — generate empty room from template
router.post('/:id/rooms/:roomId/generate-empty', async (req, res) => {
  try {
    const { WorldLocation, SceneSet } = getModels();
    const property = await WorldLocation.findByPk(req.params.id);
    if (!property) return res.status(404).json({ success: false, error: 'Property not found' });

    const room = await WorldLocation.findOne({
      where: { id: req.params.roomId, parent_location_id: req.params.id },
    });
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });

    const sceneSet = await SceneSet.findOne({
      where: { world_location_id: room.id },
    });
    if (!sceneSet) return res.status(404).json({ success: false, error: 'No scene set for this room' });

    const template = propertyService.getTemplate(sceneSet.room_layout_template);
    if (!template) {
      return res.status(400).json({ success: false, error: 'No room layout template selected' });
    }

    // Build the effective style guide (property + room overrides)
    const styleGuide = propertyService.getEffectiveStyleGuide(room, property);

    // Build the empty room prompt
    const prompt = propertyService.buildEmptyRoomPrompt(template, styleGuide);

    // Return the prompt + template info — the actual generation uses the existing
    // scene set generation pipeline (DALL-E / Runway)
    res.json({
      success: true,
      data: {
        prompt,
        template,
        style_guide: styleGuide,
        scene_set_id: sceneSet.id,
        message: 'Use this prompt to generate the empty room base image via the scene set generation endpoint',
      },
    });
  } catch (err) {
    console.error('POST /properties/:id/rooms/:roomId/generate-empty error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
