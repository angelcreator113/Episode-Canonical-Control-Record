'use strict';

/**
 * Scene Studio Controller
 * Handles canvas save/load, object CRUD, and variant management
 * for the Canva-like Scene Studio editor.
 */

const { Scene, SceneAsset, Asset, SceneObjectVariant, sequelize } = require('../models');
const { v4: uuidv4 } = require('uuid');

// ── Canvas Load ──

exports.getCanvas = async (req, res) => {
  try {
    const { id } = req.params;

    const scene = await Scene.findByPk(id, {
      attributes: [
        'id', 'title', 'episode_id', 'scene_number', 'description',
        'duration_seconds', 'background_url', 'canvas_settings',
        'layout', 'scene_type', 'production_status',
      ],
    });

    if (!scene) {
      return res.status(404).json({ success: false, error: 'Scene not found' });
    }

    const objects = await SceneAsset.findAll({
      where: { scene_id: id },
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
      where: { scene_id: id },
      include: [{
        model: SceneAsset,
        as: 'activeVariant',
        attributes: ['id', 'object_label', 'variant_label'],
      }],
      order: [['created_at', 'ASC']],
    });

    res.json({
      success: true,
      data: {
        scene: scene.toJSON(),
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

    const scene = await Scene.findByPk(id, { transaction });
    if (!scene) {
      await transaction.rollback();
      return res.status(404).json({ success: false, error: 'Scene not found' });
    }

    // Update canvas settings on scene
    if (canvas_settings !== undefined) {
      await scene.update({ canvas_settings }, { transaction });
    }

    if (Array.isArray(objects)) {
      // Get existing object IDs for this scene
      const existing = await SceneAsset.findAll({
        where: { scene_id: id },
        attributes: ['id'],
        transaction,
      });
      const existingIds = new Set(existing.map((e) => e.id));
      const incomingIds = new Set(objects.filter((o) => o.id).map((o) => o.id));

      // Delete objects removed from canvas
      const toDelete = [...existingIds].filter((eid) => !incomingIds.has(eid));
      if (toDelete.length > 0) {
        await SceneAsset.destroy({
          where: { id: toDelete, scene_id: id },
          transaction,
        });
      }

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

        if (obj.id && existingIds.has(obj.id)) {
          // Update existing
          await SceneAsset.update(data, {
            where: { id: obj.id, scene_id: id },
            transaction,
          });
        } else {
          // Create new
          data.id = obj.id || uuidv4();
          await SceneAsset.create(data, { transaction });
        }
      }
    }

    await transaction.commit();

    res.json({ success: true, message: 'Canvas saved' });
  } catch (error) {
    await transaction.rollback();
    console.error('Scene Studio saveCanvas error:', error);
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

// ── Update Object ──

exports.updateObject = async (req, res) => {
  try {
    const { id, objectId } = req.params;
    const updates = req.body;

    const obj = await SceneAsset.findOne({ where: { id: objectId, scene_id: id } });
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

    const obj = await SceneAsset.findOne({ where: { id: objectId, scene_id: id } });
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

    const obj = await SceneAsset.findOne({ where: { id: objectId, scene_id: id } });
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

    await transaction.commit();

    const created = await SceneAsset.findByPk(newVariant.id, {
      include: [{
        model: Asset,
        as: 'asset',
        attributes: [
          'id', 's3_url_raw', 's3_url_processed', 'content_type',
          'width', 'height', 'category',
        ],
      }],
    });

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

    // Get all variants in this group
    const currentActive = await SceneAsset.findByPk(variantGroup.active_variant_id);
    const varGroupId = currentActive ? currentActive.variant_group_id : null;

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
