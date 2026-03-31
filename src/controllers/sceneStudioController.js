'use strict';

/**
 * Scene Studio Controller
 * Handles canvas save/load, object CRUD, and variant management
 * for the Canva-like Scene Studio editor.
 */

const { Scene, SceneSet, SceneAngle, SceneAsset, Asset, SceneObjectVariant, sequelize } = require('../models');
const { v4: uuidv4, validate: uuidValidate } = require('uuid');
const objectGenerationService = require('../services/objectGenerationService');
const depthEstimationService = require('../services/depthEstimationService');
const imageRestyleService = require('../services/imageRestyleService');
const inpaintingService = require('../services/inpaintingService');

// ── Migration check (cached per process) ──
// Detects once whether Scene Studio columns exist, avoiding per-request describeTable calls.
let _studioMigrated = null;
async function isStudioMigrated() {
  if (_studioMigrated !== null) return _studioMigrated;
  try {
    const cols = await sequelize.getQueryInterface().describeTable('scene_assets');
    _studioMigrated = !!cols.rotation;
  } catch {
    _studioMigrated = false;
  }
  return _studioMigrated;
}

let _hasCanvasSettings = null;
async function hasCanvasSettingsColumn() {
  if (_hasCanvasSettings !== null) return _hasCanvasSettings;
  try {
    const cols = await sequelize.getQueryInterface().describeTable('scenes');
    _hasCanvasSettings = !!cols.canvas_settings;
  } catch {
    _hasCanvasSettings = false;
  }
  return _hasCanvasSettings;
}

// ── Canvas Load ──

exports.getCanvas = async (req, res) => {
  try {
    const { id } = req.params;

    const studioMigrated = await isStudioMigrated();

    // Always try to include canvas_settings — use try/catch fallback instead
    // of describeTable, which can return stale results with connection pooling.
    const sceneInclude = [
      {
        model: SceneAngle,
        as: 'sceneAngle',
        attributes: ['id', 'still_image_url', 'video_clip_url', 'thumbnail_url', 'enhanced_still_url'],
        required: false,
      },
      {
        model: SceneSet,
        as: 'sceneSet',
        attributes: ['id', 'name', 'base_still_url', 'cover_angle_id'],
        required: false,
      },
    ];
    const baseSceneAttrs = [
      'id', 'title', 'episode_id', 'scene_number', 'description',
      'duration_seconds', 'background_url', 'layout', 'scene_type', 'production_status',
      'scene_set_id', 'scene_angle_id',
    ];

    let scene;
    try {
      // Try with canvas_settings first
      scene = await Scene.findByPk(id, {
        attributes: [...baseSceneAttrs, 'canvas_settings'],
        include: sceneInclude,
      });
    } catch (colErr) {
      // canvas_settings column may not exist yet — retry without it
      console.log('Scene Studio getCanvas: canvas_settings column not available, falling back');
      scene = await Scene.findByPk(id, {
        attributes: baseSceneAttrs,
        include: sceneInclude,
      });
    }

    if (!scene) {
      return res.status(404).json({ success: false, error: 'Scene not found' });
    }

    // Base SceneAsset attributes
    const objectAttrs = [
      'id', 'scene_id', 'scene_set_id', 'scene_angle_id', 'asset_id',
      'usage_type', 'start_timecode', 'end_timecode', 'layer_order',
      'opacity', 'position', 'metadata', 'asset_role', 'character_name',
      'position_x', 'position_y', 'scale', 'z_index',
      'created_at', 'updated_at', 'deleted_at',
    ];
    if (studioMigrated) {
      objectAttrs.push(
        'rotation', 'width', 'height', 'is_visible', 'is_locked',
        'object_type', 'object_label', 'flip_x', 'flip_y',
        'crop_data', 'style_data', 'group_id',
        'variant_group_id', 'variant_label', 'is_active_variant'
      );
    }

    const objects = await SceneAsset.findAll({
      where: { scene_id: id },
      attributes: objectAttrs,
      include: [{
        model: Asset,
        as: 'asset',
        attributes: [
          'id', 's3_url_raw', 's3_url_processed', 'content_type',
          'width', 'height', 'category', 'asset_type',
          'character_name', 'outfit_name', 'location_name',
        ],
      }],
      order: [['layer_order', 'ASC']],
    });

    let variantGroups = [];
    if (studioMigrated) {
      try {
        variantGroups = await SceneObjectVariant.findAll({
          where: { scene_id: id },
          include: [{
            model: SceneAsset,
            as: 'activeVariant',
            attributes: ['id', 'object_label', 'variant_label'],
          }],
          order: [['created_at', 'ASC']],
        });
      } catch (variantErr) {
        if (!variantErr.message.includes('does not exist')) throw variantErr;
      }
    }

    const sceneJSON = scene.toJSON();
    console.log('Scene Studio getCanvas: canvas_settings is', sceneJSON.canvas_settings ? 'SET (' + Object.keys(sceneJSON.canvas_settings).join(', ') + ')' : 'NULL/not loaded', 'for scene:', id);

    res.json({
      success: true,
      data: {
        scene: sceneJSON,
        objects: objects.map((o) => o.toJSON()),
        variantGroups: variantGroups.map((vg) => vg.toJSON()),
      },
    });
  } catch (error) {
    console.error('Scene Studio getCanvas error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── Canvas Save (bulk) ──

exports.saveCanvas = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { objects, canvas_settings } = req.body;
    let idMap = {};

    const scene = await Scene.findByPk(id, { transaction });
    if (!scene) {
      await transaction.rollback();
      return res.status(404).json({ success: false, error: 'Scene not found' });
    }

    // Merge canvas settings (preserve server-set fields like depth_map_url)
    // Use raw SQL to guarantee the write — bypasses Sequelize's JSONB
    // deep-equality check AND avoids column-existence issues with the ORM.
    if (canvas_settings !== undefined) {
      const merged = { ...(scene.canvas_settings || {}), ...canvas_settings };
      console.log('Scene Studio saveCanvas: writing canvas_settings keys:', Object.keys(merged), 'for scene:', id);
      try {
        const [, meta] = await sequelize.query(
          `UPDATE scenes SET canvas_settings = :settings, updated_at = NOW() WHERE id = :id AND deleted_at IS NULL`,
          {
            replacements: { settings: JSON.stringify(merged), id },
            transaction,
          }
        );
        console.log('Scene Studio saveCanvas: canvas_settings update affected', meta?.rowCount ?? 'unknown', 'rows');
      } catch (settingsErr) {
        // canvas_settings column may not exist — log and continue (objects still save)
        console.warn('Scene Studio saveCanvas: canvas_settings write failed:', settingsErr.message);
      }
    }

    if (objects !== undefined && !Array.isArray(objects)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, error: 'objects must be an array' });
    }

    if (Array.isArray(objects)) {
      // Validate asset_ids exist for objects that reference them
      const assetIds = [...new Set(objects.filter((o) => o.asset_id).map((o) => o.asset_id))];
      if (assetIds.length > 0) {
        const foundAssets = await Asset.findAll({ where: { id: assetIds }, attributes: ['id'], transaction });
        const foundIds = new Set(foundAssets.map((a) => a.id));
        const missing = assetIds.filter((aid) => !foundIds.has(aid));
        if (missing.length > 0) {
          await transaction.rollback();
          return res.status(400).json({ success: false, error: `Invalid asset_ids: ${missing.join(', ')}` });
        }
      }

      // Get existing objects for this scene
      const existing = await SceneAsset.findAll({
        where: { scene_id: id },
        attributes: ['id', 'asset_id', 'usage_type', 'deleted_at'],
        paranoid: false,
        transaction,
      });
      const _activeExisting = existing.filter((e) => !e.deleted_at);
      const existingById = new Map(existing.map((e) => [e.id, e]));
      const existingByComposite = new Map(
        existing
          .filter((e) => e.asset_id)
          .map((e) => [`${e.asset_id}::${e.usage_type}`, e])
      );
      const keptExistingIds = new Set();

      // Upsert each object
      for (const obj of objects) {
        const data = {
          scene_id: id,
          asset_id: obj.asset_id,
          usage_type: obj.usage_type || 'overlay',
          position_x: obj.x != null ? Math.round(obj.x) : null,
          position_y: obj.y != null ? Math.round(obj.y) : null,
          width: obj.width != null ? Math.round(obj.width) : null,
          height: obj.height != null ? Math.round(obj.height) : null,
          rotation: obj.rotation || 0,
          scale: obj.scale || 1.0,
          opacity: obj.opacity != null ? obj.opacity : 1.0,
          layer_order: obj.layer_order != null ? obj.layer_order : 0,
          z_index: obj.z_index != null ? obj.z_index : 0,
          is_visible: obj.is_visible !== false,
          is_locked: obj.is_locked === true,
          object_type: obj.object_type || 'image',
          object_label: obj.object_label || null,
          flip_x: obj.flip_x === true,
          flip_y: obj.flip_y === true,
          crop_data: obj.crop_data || null,
          style_data: obj.style_data || null,
          group_id: obj.group_id || null,
          variant_group_id: obj.variant_group_id || null,
          variant_label: obj.variant_label || null,
          is_active_variant: obj.is_active_variant !== false,
          asset_role: obj.asset_role || null,
          character_name: obj.character_name || null,
          start_timecode: obj.start_timecode || null,
          end_timecode: obj.end_timecode || null,
          position: obj.position || null,
          metadata: obj.metadata || {},
        };

        if (obj.id && existingById.has(obj.id)) {
          const match = existingById.get(obj.id);
          if (match.deleted_at) {
            await SceneAsset.restore({ where: { id: match.id }, transaction });
          }
          // Update existing
          await SceneAsset.update(data, {
            where: { id: obj.id, scene_id: id },
            transaction,
          });
          keptExistingIds.add(obj.id);
        } else if (obj.asset_id && existingByComposite.has(`${obj.asset_id}::${data.usage_type}`)) {
          // Fallback for clients that temporarily omit/purge object IDs during autosave.
          // Updating in place avoids unique-index collisions on soft-deleted rows.
          const match = existingByComposite.get(`${obj.asset_id}::${data.usage_type}`);
          if (match.deleted_at) {
            await SceneAsset.restore({ where: { id: match.id }, transaction });
          }
          await SceneAsset.update(data, {
            where: { id: match.id, scene_id: id },
            transaction,
          });
          keptExistingIds.add(match.id);
          // Map client ID → server ID so frontend can update stale references
          if (obj.id && obj.id !== match.id) {
            idMap[obj.id] = match.id;
          }
        } else {
          // Create new
          const serverId = (obj.id && uuidValidate(obj.id)) ? obj.id : uuidv4();
          data.id = serverId;
          await SceneAsset.create(data, { transaction });
          // Map client ID → server ID so frontend can update stale references
          if (obj.id && obj.id !== serverId) {
            idMap[obj.id] = serverId;
          }
        }
      }

      // Delete objects removed from canvas (after upsert).
      // This ordering avoids soft-delete + recreate collisions on unique indexes.
      const toDelete = existing
        .filter((e) => !e.deleted_at)
        .map((e) => e.id)
        .filter((eid) => !keptExistingIds.has(eid));
      if (toDelete.length > 0) {
        await SceneAsset.destroy({
          where: { id: toDelete, scene_id: id },
          transaction,
        });
      }
    }

    await transaction.commit();

    res.json({ success: true, message: 'Canvas saved', idMap });
  } catch (error) {
    await transaction.rollback();
    console.error('Scene Studio saveCanvas error:', error);
    if (error?.name === 'SequelizeValidationError' || error?.name === 'SequelizeUniqueConstraintError') {
      const details = Array.isArray(error.errors)
        ? error.errors.map((e) => `${e.path}: ${e.message}`)
        : [];
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details,
      });
    }
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── Add Object ──

exports.addObject = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      asset_id, object_type, object_label, asset_role, usage_type,
      x, y, width, height, rotation, layer_order, style_data,
    } = req.body;

    const scene = await Scene.findByPk(id);
    if (!scene) {
      return res.status(404).json({ success: false, error: 'Scene not found' });
    }

    // For text/shape objects, asset_id is optional
    if (asset_id) {
      const asset = await Asset.findByPk(asset_id);
      if (!asset) {
        return res.status(404).json({ success: false, error: 'Asset not found' });
      }
    }

    // Get highest layer_order for this scene
    const maxLayer = await SceneAsset.max('layer_order', { where: { scene_id: id } });

    const obj = await SceneAsset.create({
      id: uuidv4(),
      scene_id: id,
      asset_id: asset_id || null,
      object_type: object_type || 'image',
      object_label: object_label || null,
      asset_role: asset_role || null,
      usage_type: usage_type || 'overlay',
      position_x: x != null ? Math.round(x) : 0,
      position_y: y != null ? Math.round(y) : 0,
      width: width || null,
      height: height || null,
      rotation: rotation || 0,
      layer_order: layer_order != null ? layer_order : (maxLayer || 0) + 1,
      opacity: 1.0,
      scale: 1.0,
      is_visible: true,
      is_locked: false,
      style_data: style_data || null,
    });

    // Reload with asset data
    const created = await SceneAsset.findByPk(obj.id, {
      include: [{
        model: Asset,
        as: 'asset',
        attributes: [
          'id', 's3_url_raw', 's3_url_processed', 'content_type',
          'width', 'height', 'category',
        ],
      }],
    });

    res.status(201).json({ success: true, data: created.toJSON() });
  } catch (error) {
    console.error('Scene Studio addObject error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── Helper: find object belonging to either a scene or scene set ──

async function findOwnedObject(objectId, parentId) {
  // Try scene_id first, then scene_set_id
  let obj = await SceneAsset.findOne({ where: { id: objectId, scene_id: parentId } });
  if (!obj) {
    obj = await SceneAsset.findOne({ where: { id: objectId, scene_set_id: parentId } });
  }
  return obj;
}

// ── Update Object ──

exports.updateObject = async (req, res) => {
  try {
    const { id, objectId } = req.params;
    const updates = req.body;

    const obj = await findOwnedObject(objectId, id);
    if (!obj) {
      return res.status(404).json({ success: false, error: 'Object not found' });
    }

    // Allowlist of updatable fields
    const allowed = [
      'position_x', 'position_y', 'width', 'height', 'rotation', 'scale',
      'opacity', 'layer_order', 'z_index', 'is_visible', 'is_locked',
      'object_type', 'object_label', 'flip_x', 'flip_y', 'crop_data',
      'style_data', 'group_id', 'variant_group_id', 'variant_label',
      'is_active_variant', 'asset_role', 'character_name', 'usage_type',
      'start_timecode', 'end_timecode', 'position', 'metadata',
    ];

    const filtered = {};
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        filtered[key] = updates[key];
      }
    }

    // Also accept shorthand x/y
    if (updates.x !== undefined) filtered.position_x = Math.round(updates.x);
    if (updates.y !== undefined) filtered.position_y = Math.round(updates.y);

    await obj.update(filtered);

    res.json({ success: true, data: obj.toJSON() });
  } catch (error) {
    console.error('Scene Studio updateObject error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── Delete Object ──

exports.deleteObject = async (req, res) => {
  try {
    const { id, objectId } = req.params;

    const obj = await findOwnedObject(objectId, id);
    if (!obj) {
      return res.status(404).json({ success: false, error: 'Object not found' });
    }

    await obj.destroy();

    res.json({ success: true, message: 'Object deleted' });
  } catch (error) {
    console.error('Scene Studio deleteObject error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── Duplicate Object ──

exports.duplicateObject = async (req, res) => {
  try {
    const { id, objectId } = req.params;

    const obj = await findOwnedObject(objectId, id);
    if (!obj) {
      return res.status(404).json({ success: false, error: 'Object not found' });
    }

    const data = obj.toJSON();
    delete data.created_at;
    delete data.updated_at;
    delete data.deleted_at;

    const duplicate = await SceneAsset.create({
      ...data,
      id: uuidv4(),
      position_x: (data.position_x || 0) + 20,
      position_y: (data.position_y || 0) + 20,
      object_label: data.object_label ? `${data.object_label} (copy)` : null,
      layer_order: (data.layer_order || 0) + 1,
    });

    const created = await SceneAsset.findByPk(duplicate.id, {
      include: [{
        model: Asset,
        as: 'asset',
        attributes: [
          'id', 's3_url_raw', 's3_url_processed', 'content_type',
          'width', 'height', 'category',
        ],
      }],
    });

    res.status(201).json({ success: true, data: created.toJSON() });
  } catch (error) {
    console.error('Scene Studio duplicateObject error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── Create Variant ──

exports.createVariant = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id, objectId } = req.params;
    const { variant_label, variant_group_name, new_asset_id } = req.body;

    const sourceObj = await SceneAsset.findOne({
      where: { id: objectId, scene_id: id },
      transaction,
    });
    if (!sourceObj) {
      await transaction.rollback();
      return res.status(404).json({ success: false, error: 'Source object not found' });
    }

    // Create or get variant group
    let variantGroupId = sourceObj.variant_group_id;
    let variantGroup;

    if (!variantGroupId) {
      // First time creating a variant — set up the group
      variantGroupId = uuidv4();

      // Mark source as part of the variant group
      await sourceObj.update({
        variant_group_id: variantGroupId,
        variant_label: sourceObj.variant_label || 'Default',
        is_active_variant: true,
      }, { transaction });

      // Create the variant group record
      variantGroup = await SceneObjectVariant.create({
        scene_id: id,
        variant_group_name: variant_group_name || sourceObj.object_label || 'Variant Group',
        active_variant_id: sourceObj.id,
        metadata: {},
      }, { transaction });
    } else {
      variantGroup = await SceneObjectVariant.findOne({
        where: { scene_id: id, active_variant_id: sourceObj.id },
        transaction,
      });
      if (!variantGroup) {
        // Find by checking any variant in this group
        const anyVariant = await SceneAsset.findOne({
          where: { scene_id: id, variant_group_id: variantGroupId, is_active_variant: true },
          transaction,
        });
        if (anyVariant) {
          variantGroup = await SceneObjectVariant.findOne({
            where: { scene_id: id, active_variant_id: anyVariant.id },
            transaction,
          });
        }
      }
      if (!variantGroup) {
        // Variant group record is missing — recreate it
        variantGroup = await SceneObjectVariant.create({
          scene_id: id,
          variant_group_name: sourceObj.object_label || 'Variant Group',
          active_variant_id: sourceObj.id,
          metadata: {},
        }, { transaction });
      }
    }

    // Clone the source as a new variant (inactive)
    const data = sourceObj.toJSON();
    delete data.created_at;
    delete data.updated_at;
    delete data.deleted_at;

    const newVariant = await SceneAsset.create({
      ...data,
      id: uuidv4(),
      asset_id: new_asset_id || data.asset_id,
      variant_group_id: variantGroupId,
      variant_label: variant_label || 'New Variant',
      is_active_variant: false,
    }, { transaction });

    const created = await SceneAsset.findByPk(newVariant.id, {
      include: [{
        model: Asset,
        as: 'asset',
        attributes: [
          'id', 's3_url_raw', 's3_url_processed', 'content_type',
          'width', 'height', 'category',
        ],
      }],
      transaction,
    });

    await transaction.commit();

    res.status(201).json({
      success: true,
      data: {
        variant: created.toJSON(),
        variantGroupId,
        variantGroup: variantGroup ? variantGroup.toJSON() : null,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Scene Studio createVariant error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── Activate Variant ──

exports.activateVariant = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id, groupId } = req.params;
    const { variant_id } = req.body;

    if (!variant_id) {
      await transaction.rollback();
      return res.status(400).json({ success: false, error: 'variant_id is required' });
    }

    // Find the variant group
    const variantGroup = await SceneObjectVariant.findOne({
      where: { id: groupId, scene_id: id },
      transaction,
    });

    if (!variantGroup) {
      await transaction.rollback();
      return res.status(404).json({ success: false, error: 'Variant group not found' });
    }

    // Get the variant group ID from the group's current active variant
    const currentActive = await SceneAsset.findByPk(variantGroup.active_variant_id, { transaction });
    const varGroupId = currentActive ? currentActive.variant_group_id : null;

    if (!varGroupId) {
      await transaction.rollback();
      return res.status(400).json({ success: false, error: 'Variant group has no linked objects' });
    }

    // Deactivate all variants in group
    await SceneAsset.update(
      { is_active_variant: false },
      { where: { scene_id: id, variant_group_id: varGroupId }, transaction }
    );

    // Activate the chosen variant
    const targetVariant = await SceneAsset.findOne({
      where: { id: variant_id, scene_id: id, variant_group_id: varGroupId },
      transaction,
    });

    if (!targetVariant) {
      await transaction.rollback();
      return res.status(404).json({ success: false, error: 'Target variant not found in this group' });
    }

    await targetVariant.update({ is_active_variant: true }, { transaction });

    // Update the variant group's active pointer
    await variantGroup.update({ active_variant_id: variant_id }, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      data: {
        activatedVariantId: variant_id,
        variantGroupId: varGroupId,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Scene Studio activateVariant error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── Get Variant Group Details ──

exports.getVariantGroup = async (req, res) => {
  try {
    const { id, groupId } = req.params;

    const variantGroup = await SceneObjectVariant.findOne({
      where: { id: groupId, scene_id: id },
    });

    if (!variantGroup) {
      return res.status(404).json({ success: false, error: 'Variant group not found' });
    }

    // Get all variants in this group — find variant_group_id from active variant or any member
    const currentActive = await SceneAsset.findByPk(variantGroup.active_variant_id);
    let varGroupId = currentActive ? currentActive.variant_group_id : null;

    // Fallback: if active variant was deleted, find any remaining member
    if (!varGroupId) {
      const anyMember = await SceneAsset.findOne({
        where: { scene_id: id },
        attributes: ['variant_group_id'],
        order: [['created_at', 'ASC']],
      });
      varGroupId = anyMember?.variant_group_id || null;
    }

    let variants = [];
    if (varGroupId) {
      variants = await SceneAsset.findAll({
        where: { scene_id: id, variant_group_id: varGroupId },
        include: [{
          model: Asset,
          as: 'asset',
          attributes: ['id', 's3_url_raw', 's3_url_processed', 'content_type', 'width', 'height'],
        }],
        order: [['created_at', 'ASC']],
      });
    }

    res.json({
      success: true,
      data: {
        variantGroup: variantGroup.toJSON(),
        variants: variants.map((v) => v.toJSON()),
      },
    });
  } catch (error) {
    console.error('Scene Studio getVariantGroup error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ══════════════════════════════════════════════════════════════════════
// SCENE SET Studio endpoints
// ══════════════════════════════════════════════════════════════════════

// ── Scene Set Canvas Load ──

exports.getSceneSetCanvas = async (req, res) => {
  try {
    const { id } = req.params;
    const { angle_id } = req.query;

    const sceneSet = await SceneSet.findByPk(id, {
      include: [{
        model: SceneAngle,
        as: 'angles',
        order: [['sort_order', 'ASC']],
      }],
    });

    if (!sceneSet) {
      return res.status(404).json({ success: false, error: 'Scene set not found' });
    }

    // Build query — objects can belong to the set globally OR to a specific angle
    const where = { scene_set_id: id };

    const objects = await SceneAsset.findAll({
      where,
      include: [{
        model: Asset,
        as: 'asset',
        attributes: [
          'id', 's3_url_raw', 's3_url_processed', 'content_type',
          'width', 'height', 'category', 'asset_type',
          'character_name', 'outfit_name', 'location_name',
        ],
      }],
      order: [['layer_order', 'ASC']],
    });

    const variantGroups = await SceneObjectVariant.findAll({
      where: { scene_id: null },
      include: [{
        model: SceneAsset,
        as: 'activeVariant',
        where: { scene_set_id: id },
        required: false,
        attributes: ['id', 'object_label', 'variant_label'],
      }],
    });

    // Filter variant groups to only those related to this scene set
    const setVariantGroupIds = new Set(
      objects.filter((o) => o.variant_group_id).map((o) => o.variant_group_id)
    );

    res.json({
      success: true,
      data: {
        sceneSet: sceneSet.toJSON(),
        angles: sceneSet.angles?.map((a) => a.toJSON()) || [],
        activeAngleId: angle_id || sceneSet.cover_angle_id || sceneSet.angles?.[0]?.id || null,
        objects: objects.map((o) => o.toJSON()),
        variantGroups: variantGroups
          .filter((vg) => {
            const av = vg.activeVariant;
            return av && setVariantGroupIds.has(av.variant_group_id);
          })
          .map((vg) => vg.toJSON()),
      },
    });
  } catch (error) {
    console.error('Scene Studio getSceneSetCanvas error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── Scene Set Canvas Save (bulk) ──

exports.saveSceneSetCanvas = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { objects, canvas_settings } = req.body;
    let idMap = {};

    const sceneSet = await SceneSet.findByPk(id, { transaction });
    if (!sceneSet) {
      await transaction.rollback();
      return res.status(404).json({ success: false, error: 'Scene set not found' });
    }

    // Merge canvas settings (preserve server-set fields like depth_map_url)
    if (canvas_settings !== undefined) {
      const merged = { ...(sceneSet.canvas_settings || {}), ...canvas_settings };
      await SceneSet.update(
        { canvas_settings: merged },
        { where: { id }, transaction }
      );
    }

    if (objects !== undefined && !Array.isArray(objects)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, error: 'objects must be an array' });
    }

    if (Array.isArray(objects)) {
      // Validate asset_ids exist for objects that reference them
      const assetIds = [...new Set(objects.filter((o) => o.asset_id).map((o) => o.asset_id))];
      if (assetIds.length > 0) {
        const foundAssets = await Asset.findAll({ where: { id: assetIds }, attributes: ['id'], transaction });
        const foundIds = new Set(foundAssets.map((a) => a.id));
        const missing = assetIds.filter((aid) => !foundIds.has(aid));
        if (missing.length > 0) {
          await transaction.rollback();
          return res.status(400).json({ success: false, error: `Invalid asset_ids: ${missing.join(', ')}` });
        }
      }

      const existing = await SceneAsset.findAll({
        where: { scene_set_id: id },
        attributes: ['id', 'asset_id', 'usage_type'],
        transaction,
      });
      const existingIds = new Set(existing.map((e) => e.id));
      const existingByComposite = new Map(
        existing
          .filter((e) => e.asset_id)
          .map((e) => [`${e.asset_id}::${e.usage_type}`, e])
      );
      const keptExistingIds = new Set();

      // Upsert each object (before deleting, to avoid losing data on ID mismatches)
      for (const obj of objects) {
        const data = {
          scene_id: null,
          scene_set_id: id,
          scene_angle_id: obj.scene_angle_id || null,
          asset_id: obj.asset_id || null,
          usage_type: obj.usage_type || 'overlay',
          position_x: obj.x != null ? Math.round(obj.x) : null,
          position_y: obj.y != null ? Math.round(obj.y) : null,
          width: obj.width != null ? Math.round(obj.width) : null,
          height: obj.height != null ? Math.round(obj.height) : null,
          rotation: obj.rotation || 0,
          scale: obj.scale || 1.0,
          opacity: obj.opacity != null ? obj.opacity : 1.0,
          layer_order: obj.layer_order != null ? obj.layer_order : 0,
          z_index: obj.z_index != null ? obj.z_index : 0,
          is_visible: obj.is_visible !== false,
          is_locked: obj.is_locked === true,
          object_type: obj.object_type || 'image',
          object_label: obj.object_label || null,
          flip_x: obj.flip_x === true,
          flip_y: obj.flip_y === true,
          crop_data: obj.crop_data || null,
          style_data: obj.style_data || null,
          group_id: obj.group_id || null,
          variant_group_id: obj.variant_group_id || null,
          variant_label: obj.variant_label || null,
          is_active_variant: obj.is_active_variant !== false,
          asset_role: obj.asset_role || null,
          character_name: obj.character_name || null,
          start_timecode: obj.start_timecode || null,
          end_timecode: obj.end_timecode || null,
          position: obj.position || null,
          metadata: obj.metadata || {},
        };

        if (obj.id && existingIds.has(obj.id)) {
          // Match by primary key
          await SceneAsset.update(data, {
            where: { id: obj.id, scene_set_id: id },
            transaction,
          });
          keptExistingIds.add(obj.id);
        } else if (obj.asset_id && existingByComposite.has(`${obj.asset_id}::${data.usage_type}`)) {
          // Fallback: match by asset_id + usage_type for client-generated IDs
          const match = existingByComposite.get(`${obj.asset_id}::${data.usage_type}`);
          await SceneAsset.update(data, {
            where: { id: match.id, scene_set_id: id },
            transaction,
          });
          keptExistingIds.add(match.id);
          if (obj.id && obj.id !== match.id) {
            idMap[obj.id] = match.id;
          }
        } else {
          const serverId = (obj.id && uuidValidate(obj.id)) ? obj.id : uuidv4();
          data.id = serverId;
          await SceneAsset.create(data, { transaction });
          if (obj.id && obj.id !== serverId) {
            idMap[obj.id] = serverId;
          }
        }
      }

      // Delete objects removed from canvas (after upsert to avoid losing data)
      const toDelete = [...existingIds].filter((eid) => !keptExistingIds.has(eid));
      if (toDelete.length > 0) {
        await SceneAsset.destroy({
          where: { id: toDelete, scene_set_id: id },
          transaction,
        });
      }
    }

    await transaction.commit();
    res.json({ success: true, message: 'Scene set canvas saved', idMap });
  } catch (error) {
    await transaction.rollback();
    console.error('Scene Studio saveSceneSetCanvas error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── Add Object to Scene Set ──

exports.addSceneSetObject = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      asset_id, object_type, object_label, asset_role, usage_type,
      x, y, width, height, rotation, layer_order, style_data, scene_angle_id,
    } = req.body;

    const sceneSet = await SceneSet.findByPk(id);
    if (!sceneSet) {
      return res.status(404).json({ success: false, error: 'Scene set not found' });
    }

    const maxLayer = await SceneAsset.max('layer_order', { where: { scene_set_id: id } });

    const obj = await SceneAsset.create({
      id: uuidv4(),
      scene_id: null,
      scene_set_id: id,
      scene_angle_id: scene_angle_id || null,
      asset_id: asset_id || null,
      object_type: object_type || 'image',
      object_label: object_label || null,
      asset_role: asset_role || null,
      usage_type: usage_type || 'overlay',
      position_x: x != null ? Math.round(x) : 0,
      position_y: y != null ? Math.round(y) : 0,
      width: width || null,
      height: height || null,
      rotation: rotation || 0,
      layer_order: layer_order != null ? layer_order : (maxLayer || 0) + 1,
      opacity: 1.0,
      scale: 1.0,
      is_visible: true,
      is_locked: false,
      style_data: style_data || null,
    });

    const created = await SceneAsset.findByPk(obj.id, {
      include: [{
        model: Asset,
        as: 'asset',
        attributes: [
          'id', 's3_url_raw', 's3_url_processed', 'content_type',
          'width', 'height', 'category',
        ],
      }],
    });

    res.status(201).json({ success: true, data: created.toJSON() });
  } catch (error) {
    console.error('Scene Studio addSceneSetObject error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ── AI Object Generation ──

exports.generateObject = async (req, res) => {
  try {
    const { id } = req.params;
    const { prompt, style_hints, remove_background } = req.body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ success: false, error: 'prompt is required' });
    }

    // Get show_id from the scene for asset association
    let showId = null;
    try {
      const scene = await Scene.findByPk(id, { attributes: ['id', 'episode_id'] });
      if (scene?.episode_id) {
        const { Episode } = require('../models');
        const ep = await Episode.findByPk(scene.episode_id, { attributes: ['show_id'] });
        showId = ep?.show_id || null;
      }
    } catch { /* non-critical */ }

    const options = await objectGenerationService.generateObject(prompt.trim(), {
      sceneId: id,
      styleHints: style_hints || null,
      count: 2,
      removeBackground: remove_background === true,
      userId: req.user?.id || null,
      showId,
      Asset,
    });

    res.json({ success: true, data: { options } });
  } catch (error) {
    console.error('Scene Studio generateObject error:', error);
    // Rate limit errors return 429
    const status = error.message.includes('limit') || error.message.includes('in progress') ? 429 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
};

// ── AI Object Generation (Scene Sets) ──

exports.generateSceneSetObject = async (req, res) => {
  try {
    const { id } = req.params;
    const { prompt, style_hints, remove_background } = req.body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ success: false, error: 'prompt is required' });
    }

    // Scene sets have show_id directly
    let showId = null;
    try {
      const sceneSet = await SceneSet.findByPk(id, { attributes: ['id', 'show_id'] });
      showId = sceneSet?.show_id || null;
    } catch { /* non-critical */ }

    const options = await objectGenerationService.generateObject(prompt.trim(), {
      sceneId: id,
      styleHints: style_hints || null,
      count: 2,
      removeBackground: remove_background === true,
      userId: req.user?.id || null,
      showId,
      Asset,
    });

    res.json({ success: true, data: { options } });
  } catch (error) {
    console.error('Scene Studio generateSceneSetObject error:', error);
    const status = error.message.includes('limit') || error.message.includes('in progress') ? 429 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
};

// ── Background Regeneration ──

exports.regenerateBackground = async (req, res) => {
  try {
    const { id } = req.params;
    const { mood, time_of_day, current_background_url } = req.body;

    const scene = await Scene.findByPk(id, { attributes: ['id', 'background_url', 'description', 'mood', 'episode_id'] });
    if (!scene) {
      return res.status(404).json({ success: false, error: 'Scene not found' });
    }

    const bgUrl = current_background_url || scene.background_url;
    if (!bgUrl) {
      return res.status(400).json({ success: false, error: 'No background to restyle' });
    }

    // Use img2img restyling — transforms the EXISTING photo's lighting/mood
    // instead of generating a completely new image from text
    const result = await imageRestyleService.restyleBackground(bgUrl, id, {
      timeOfDay: time_of_day || null,
      mood: mood || null,
      strength: 0.45, // Moderate change — preserves composition
      userId: req.user?.id || null,
    });

    // Update scene mood + background_url using raw SQL to guarantee persistence.
    const setClauses = [];
    const replacements = { id };
    if (mood) { setClauses.push('mood = :mood'); replacements.mood = mood; }
    if (result.restyled_url) { setClauses.push('background_url = :url'); replacements.url = result.restyled_url; }
    if (setClauses.length > 0) {
      setClauses.push('updated_at = NOW()');
      await sequelize.query(
        `UPDATE scenes SET ${setClauses.join(', ')} WHERE id = :id AND deleted_at IS NULL`,
        { replacements }
      );
    }

    res.json({
      success: true,
      data: {
        restyled_url: result.restyled_url,
        mood,
        time_of_day,
      },
    });
  } catch (error) {
    console.error('Scene Studio regenerateBackground error:', error);
    const status = error.message.includes('limit') || error.message.includes('in progress') ? 429 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
};

// ── Smart Suggestions ──

exports.suggestObjects = async (req, res) => {
  try {
    const { id } = req.params;

    const scene = await Scene.findByPk(id, {
      attributes: ['id', 'description', 'mood', 'canvas_settings', 'characters'],
    });
    if (!scene) {
      return res.status(404).json({ success: false, error: 'Scene not found' });
    }

    // Check cache in canvas_settings
    const cached = scene.canvas_settings?.suggestions;
    if (cached && cached.timestamp && (Date.now() - cached.timestamp < 3600000)) {
      return res.json({ success: true, data: { suggestions: cached.items } });
    }

    // Get existing objects to understand what's already placed
    const existingObjects = await SceneAsset.findAll({
      where: { scene_id: id },
      attributes: ['object_label', 'object_type', 'asset_role'],
    });
    const existingLabels = existingObjects.map((o) => o.object_label).filter(Boolean);

    const sceneDesc = scene.description || 'a scene';
    const mood = scene.mood || 'warm';
    const existing = existingLabels.length > 0
      ? `Already placed: ${existingLabels.join(', ')}.`
      : 'The scene is empty.';

    // Use Claude for suggestions — gracefully skip if API key missing
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.json({ success: true, data: { suggestions: [] } });
    }

    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `You are a scene design assistant for a luxury lifestyle show. Given this scene, suggest 6 objects to add.

Scene: ${sceneDesc}
Mood: ${mood}
${existing}

Return ONLY a JSON array of 6 objects, each with "label" (2-3 words) and "prompt" (10-15 word generation prompt). Focus on decor, props, and atmosphere items. No people.

Example: [{"label": "Gold Mirror", "prompt": "ornate gold-framed mirror with soft reflection, baroque style"}]`,
      }],
    });

    let suggestions = [];
    try {
      const text = response.content[0]?.text || '[]';
      const match = text.match(/\[[\s\S]*\]/);
      suggestions = match ? JSON.parse(match[0]) : [];
    } catch { suggestions = []; }

    // Cache in canvas_settings
    if (suggestions.length > 0) {
      const merged = { ...(scene.canvas_settings || {}), suggestions: { items: suggestions, timestamp: Date.now() } };
      await scene.update({ canvas_settings: merged });
    }

    res.json({ success: true, data: { suggestions } });
  } catch (error) {
    console.error('Scene Studio suggestObjects error:', error.message);
    // Return empty suggestions instead of 500 — suggestions are non-critical
    res.json({ success: true, data: { suggestions: [] } });
  }
};

// ── Inpainting (Object Removal) ──

exports.inpaint = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      image_url,
      is_background: isBackground,
      mask_data_url,
      prompt,
      strength,
      mode: requestedMode,
      strict_remove: strictRemove,
      mask_expand: maskExpand,
      mask_feather: maskFeather,
      reference_image_url: referenceImageUrl,
      remove_reference_bg: removeReferenceBg,
    } = req.body;

    if (!mask_data_url) {
      return res.status(400).json({ success: false, error: 'mask_data_url is required — paint over the area to remove' });
    }

    const scene = await Scene.findByPk(id, { attributes: ['id', 'background_url'] });
    if (!scene) {
      return res.status(404).json({ success: false, error: 'Scene not found' });
    }

    const sourceUrl = image_url || scene.background_url;
    if (!sourceUrl) {
      return res.status(400).json({ success: false, error: 'No source image available' });
    }

    const normalizedMode = String(requestedMode || '').toLowerCase();
    const mode = normalizedMode === 'fill'
      ? 'fill'
      : normalizedMode === 'remove'
        ? 'remove'
        : (prompt ? 'fill' : 'remove');
    const result = await inpaintingService.inpaintImage(
      sourceUrl,
      mask_data_url,
      prompt || null,
      id,
      {
        userId: req.user?.id || null,
        strength: strength || 0.85,
        mode,
        strictRemove: strictRemove === true || strictRemove === 'true',
        maskExpand: Number.isFinite(Number(maskExpand)) ? Number(maskExpand) : undefined,
        maskFeather: Number.isFinite(Number(maskFeather)) ? Number(maskFeather) : undefined,
        referenceImageUrl: referenceImageUrl || undefined,
        removeReferenceBg: removeReferenceBg === true || removeReferenceBg === 'true',
      }
    );

    // Persist the inpaint result as background_url when the user inpainted the
    // background (not a selected overlay object). The frontend sends is_background
    // to distinguish — the old URL-matching logic failed when the displayed URL
    // was a fallback (sceneAngle/sceneSet) that didn't match scene.background_url.
    if (result.inpainted_url && isBackground !== false) {
      await sequelize.query(
        `UPDATE scenes SET background_url = :url, updated_at = NOW() WHERE id = :id AND deleted_at IS NULL`,
        { replacements: { url: result.inpainted_url, id } }
      );
      console.log('Scene Studio inpaint: saved background_url for scene:', id);
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Scene Studio inpaint error:', error);
    const status = Number.isFinite(Number(error?.status))
      ? Number(error.status)
      : (error.message.includes('limit') || error.message.includes('in progress') ? 429 : 500);
    const retryAfter = Number.parseInt(String(error?.retryAfter || ''), 10);
    if (status === 429 && retryAfter > 0) {
      res.setHeader('Retry-After', String(retryAfter));
    }
    res.status(status).json({
      success: false,
      error: error.message,
      retry_after: status === 429 && retryAfter > 0 ? retryAfter : undefined,
    });
  }
};

// ── Smart Select (SAM Segmentation) ──

exports.segmentObject = async (req, res) => {
  try {
    const { id } = req.params;
    const { image_url, point_x, point_y, point_label, text_prompt, points, labels, image_width, image_height } = req.body;
    const knownDims = (image_width > 0 && image_height > 0) ? { width: Number(image_width), height: Number(image_height) } : null;

    const normalizedPoints = Array.isArray(points)
      ? points
          .map((p, idx) => ({
            x: Number(p?.x),
            y: Number(p?.y),
            label: Number.isFinite(Number(p?.label))
              ? Number(p.label)
              : (Array.isArray(labels) && Number.isFinite(Number(labels[idx])) ? Number(labels[idx]) : 1),
          }))
          .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
      : [];

    const fallbackPointX = Number(point_x);
    const fallbackPointY = Number(point_y);
    const fallbackLabel = Number.isFinite(Number(point_label)) ? Number(point_label) : 1;

    const hasTextPrompt = Boolean(text_prompt && String(text_prompt).trim());
    if (!hasTextPrompt && !normalizedPoints.length && (!Number.isFinite(fallbackPointX) || !Number.isFinite(fallbackPointY))) {
      return res.status(400).json({ success: false, error: 'Provide text_prompt, points[], or point_x/point_y (0-1 normalized coordinates)' });
    }

    const effectivePoints = normalizedPoints.length
      ? normalizedPoints
      : (Number.isFinite(fallbackPointX) && Number.isFinite(fallbackPointY)
          ? [{ x: fallbackPointX, y: fallbackPointY, label: fallbackLabel }]
          : []);

    console.log('[Segment] Coords received:', JSON.stringify({
      point_x, point_y, points: points?.length, image_width, image_height,
      effectivePoints: effectivePoints.map(p => ({ x: p.x?.toFixed?.(4), y: p.y?.toFixed?.(4) })),
    }));

    const Scene = require('../models').Scene;
    const scene = await Scene.findByPk(id, { attributes: ['id', 'background_url'] });
    if (!scene) {
      return res.status(404).json({ success: false, error: 'Scene not found' });
    }

    const sourceUrl = image_url || scene.background_url;
    if (!sourceUrl) {
      return res.status(400).json({ success: false, error: 'No source image available' });
    }

    const segmentationService = require('../services/segmentationService');
    let result;
    if (text_prompt) {
      result = await segmentationService.segmentByText(sourceUrl, text_prompt.trim(), id);
    } else if (effectivePoints.length > 1) {
      result = await segmentationService.segmentMultiPoint(
        sourceUrl,
        effectivePoints.map(p => ({ x: p.x, y: p.y })),
        effectivePoints.map(p => p.label),
        id, knownDims
      );
    } else {
      result = await segmentationService.segmentAtPoint(
        sourceUrl, effectivePoints[0].x, effectivePoints[0].y, id, knownDims
      );
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Scene Studio segment error:', error?.message || error, error?.stack?.split('\n').slice(0, 3).join('\n'));
    const status = Number.isFinite(Number(error?.status)) ? Number(error.status) : 500;
    const retryAfter = Number.parseInt(String(error?.retryAfter || ''), 10);
    if (status === 429 && retryAfter > 0) {
      res.setHeader('Retry-After', String(retryAfter));
    }
    res.status(status).json({
      success: false,
      error: error.message,
      retry_after: status === 429 && retryAfter > 0 ? retryAfter : undefined,
    });
  }
};

// ── Scene Animation (Runway Image-to-Video) ──

exports.animateScene = async (req, res) => {
  try {
    const { id } = req.params;
    const { image_url, prompt, duration, camera_motion } = req.body;

    if (!prompt) {
      return res.status(400).json({ success: false, error: 'Animation prompt is required' });
    }

    const scene = await Scene.findByPk(id, { attributes: ['id', 'background_url', 'description'] });
    if (!scene) {
      return res.status(404).json({ success: false, error: 'Scene not found' });
    }

    const sourceUrl = image_url || scene.background_url;
    if (!sourceUrl) {
      return res.status(400).json({ success: false, error: 'No source image to animate' });
    }

    const sceneGenService = require('../services/sceneGenerationService');
    const { jobId } = await sceneGenService.startImageToVideo(prompt, sourceUrl, {
      duration: duration || 5,
      cameraMotion: camera_motion || 'static',
    });

    // Poll for completion
    const result = await sceneGenService.pollTask(jobId);

    if (result.status === 'SUCCEEDED' && result.outputUrl) {
      res.json({
        success: true,
        data: {
          video_url: result.outputUrl,
          duration: duration || 5,
          job_id: jobId,
        },
      });
    } else {
      res.status(500).json({ success: false, error: result.error || 'Animation failed' });
    }
  } catch (error) {
    console.error('Scene Studio animateScene error:', error);
    const status = error.message.includes('limit') || error.message.includes('429') ? 429 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
};

// ── Depth Estimation (Scenes) ──

exports.generateDepth = async (req, res) => {
  try {
    const { id } = req.params;
    const { image_url } = req.body;

    // Detect available columns — canvas_settings / scene_angle_id may not exist pre-migration
    const sceneCols = await sequelize.getQueryInterface().describeTable('scenes');
    const sceneAttrs = ['id', 'background_url'];
    const hasCanvasSettings = !!sceneCols.canvas_settings;
    const hasAngleFK = !!sceneCols.scene_angle_id;
    if (hasCanvasSettings) sceneAttrs.push('canvas_settings');

    const includeOpts = [];
    if (hasAngleFK) {
      includeOpts.push({
        model: SceneAngle,
        as: 'sceneAngle',
        attributes: ['id', 'still_image_url', 'enhanced_still_url'],
        required: false,
      });
    }

    const scene = await Scene.findByPk(id, {
      attributes: sceneAttrs,
      include: includeOpts,
    });

    if (!scene) {
      return res.status(404).json({ success: false, error: 'Scene not found' });
    }

    // Determine source image: explicit URL > angle still > scene background
    const sourceUrl = image_url
      || scene.sceneAngle?.enhanced_still_url
      || scene.sceneAngle?.still_image_url
      || scene.background_url;

    if (!sourceUrl) {
      return res.status(400).json({ success: false, error: 'No source image available for depth estimation' });
    }

    const result = await depthEstimationService.generateDepthMap(sourceUrl, {
      entityId: id,
      userId: req.user?.id || null,
    });

    // Store depth map URL in scene's canvas_settings JSONB (if column exists)
    if (hasCanvasSettings) {
      const settings = scene.canvas_settings || {};
      settings.depth_map_url = result.depth_map_url;
      settings.depth_model_used = result.model_used;
      await scene.update({ canvas_settings: settings });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Scene Studio generateDepth error:', error);
    let status = 500;
    if (error.message.includes('limit') || error.message.includes('in progress')) status = 429;
    if (error.message.includes('not configured')) status = 503;
    res.status(status).json({ success: false, error: error.message });
  }
};

// ── Depth Estimation (Scene Set Angles) ──

exports.generateAngleDepth = async (req, res) => {
  try {
    const { id, angleId } = req.params;

    // Check if depth columns exist on scene_angles
    const angleCols = await sequelize.getQueryInterface().describeTable('scene_angles');
    const hasDepthCols = !!angleCols.depth_map_url;

    const angle = await SceneAngle.findOne({
      where: { id: angleId, scene_set_id: id },
    });

    if (!angle) {
      return res.status(404).json({ success: false, error: 'Scene angle not found' });
    }

    const sourceUrl = angle.enhanced_still_url || angle.still_image_url;
    if (!sourceUrl) {
      return res.status(400).json({ success: false, error: 'No still image available for this angle. Generate a still first.' });
    }

    // Mark as generating (if column exists)
    if (hasDepthCols) {
      await angle.update({ depth_status: 'generating' });
    }

    try {
      const result = await depthEstimationService.generateDepthMap(sourceUrl, {
        entityId: angleId,
        userId: req.user?.id || null,
      });

      if (hasDepthCols) {
        await angle.update({
          depth_map_url: result.depth_map_url,
          depth_status: 'complete',
        });
      }

      res.json({ success: true, data: result });
    } catch (depthError) {
      if (hasDepthCols) {
        await angle.update({ depth_status: 'failed' });
      }
      throw depthError;
    }
  } catch (error) {
    console.error('Scene Studio generateAngleDepth error:', error);
    let status = 500;
    if (error.message.includes('limit') || error.message.includes('in progress')) status = 429;
    if (error.message.includes('not configured')) status = 503;
    res.status(status).json({ success: false, error: error.message });
  }
};

// ── Depth Map Proxy ──
// Proxies S3 depth map images through the backend to avoid CORS issues.
// The browser needs crossOrigin pixel access (getImageData) for parallax,
// but the S3 bucket may not have CORS headers configured.

const axios = require('axios');

// Generic S3 image proxy — validates URL belongs to our S3 bucket
function proxyS3Image(req, res, depthUrl) {
  const S3_BUCKET = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME || '';
  if (!depthUrl || !depthUrl.includes('.s3.') || !S3_BUCKET || !depthUrl.includes(S3_BUCKET)) {
    return res.status(404).json({ success: false, error: 'No depth map found' });
  }

  axios.get(depthUrl, { responseType: 'stream', timeout: 15000 })
    .then((response) => {
      res.set('Content-Type', response.headers['content-type'] || 'image/png');
      res.set('Cache-Control', 'public, max-age=86400');
      res.set('Access-Control-Allow-Origin', '*');
      response.data.pipe(res);
    })
    .catch((error) => {
      console.error('Depth map proxy error:', error.message);
      res.status(502).json({ success: false, error: 'Failed to fetch depth map' });
    });
}

exports.proxyDepthMap = async (req, res) => {
  try {
    const { id } = req.params;

    // First try DB lookup, then fall back to ?url= query param
    let depthUrl = null;

    const sceneCols = await sequelize.getQueryInterface().describeTable('scenes');
    if (sceneCols.canvas_settings) {
      const scene = await Scene.findByPk(id, { attributes: ['id', 'canvas_settings'] });
      depthUrl = scene?.canvas_settings?.depth_map_url;
    }

    // Allow ?url= fallback for freshly generated depth maps not yet saved
    if (!depthUrl && req.query.url) {
      const S3_BUCKET = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME || '';
      const allowed = S3_BUCKET && req.query.url.includes('.s3.') && req.query.url.includes(S3_BUCKET);
      if (allowed) depthUrl = req.query.url;
    }

    proxyS3Image(req, res, depthUrl);
  } catch (error) {
    console.error('Depth map proxy error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch depth map' });
  }
};

exports.proxyAngleDepthMap = async (req, res) => {
  try {
    const { id, angleId } = req.params;

    // First try DB lookup, then fall back to ?url= query param
    let depthUrl = null;

    const angle = await SceneAngle.findOne({
      where: { id: angleId, scene_set_id: id },
      attributes: ['id', 'depth_map_url'],
    });
    depthUrl = angle?.depth_map_url;

    // Allow ?url= fallback for freshly generated depth maps not yet saved
    if (!depthUrl && req.query.url) {
      const S3_BUCKET = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME || '';
      const allowed = S3_BUCKET && req.query.url.includes('.s3.') && req.query.url.includes(S3_BUCKET);
      if (allowed) depthUrl = req.query.url;
    }

    proxyS3Image(req, res, depthUrl);
  } catch (error) {
    console.error('Depth map proxy error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch depth map' });
  }
};
