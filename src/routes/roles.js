const express = require('express');
const router = express.Router();
const AssetRoleService = require('../services/AssetRoleService');

/**
 * GET /api/v1/roles
 * Get all roles for show
 */
router.get('/', async (req, res) => {
  try {
    const showId = req.query.show_id || req.user?.show_id;

    if (!showId) {
      return res.status(400).json({
        error: 'show ID required',
      });
    }

    const roles = await AssetRoleService.getRolesForshow(showId);

    res.json({
      status: 'SUCCESS',
      data: roles,
      count: roles.length,
    });
  } catch (error) {
    console.error('Failed to fetch roles:', error);
    res.status(500).json({
      error: 'Failed to fetch roles',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/roles/stats
 * Get role usage statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const showId = req.query.show_id || req.user?.show_id;

    if (!showId) {
      return res.status(400).json({
        error: 'show ID required',
      });
    }

    const stats = await AssetRoleService.getRoleUsageStats(showId);

    res.json({
      status: 'SUCCESS',
      data: stats,
    });
  } catch (error) {
    console.error('Failed to fetch role stats:', error);
    res.status(500).json({
      error: 'Failed to fetch role stats',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/roles/:roleKey
 * Get specific role
 */
router.get('/:roleKey', async (req, res) => {
  try {
    const { roleKey } = req.params;
    const showId = req.query.show_id || req.user?.show_id;

    const role = await AssetRoleService.getRoleByKey(showId, roleKey);

    if (!role) {
      return res.status(404).json({
        error: 'Role not found',
      });
    }

    res.json({
      status: 'SUCCESS',
      data: role,
    });
  } catch (error) {
    console.error('Failed to fetch role:', error);
    res.status(500).json({
      error: 'Failed to fetch role',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/roles
 * Create custom role
 */
router.post('/', async (req, res) => {
  try {
    const showId = req.body.show_id || req.user?.show_id;

    if (!showId) {
      return res.status(400).json({
        error: 'show ID required',
      });
    }

    const role = await AssetRoleService.createRole(showId, req.body);

    res.status(201).json({
      status: 'SUCCESS',
      message: 'Role created',
      data: role,
    });
  } catch (error) {
    console.error('Failed to create role:', error);
    res.status(400).json({
      error: 'Failed to create role',
      message: error.message,
    });
  }
});

/**
 * PUT /api/v1/roles/:roleKey
 * Update role (label, required flag, etc.)
 */
router.put('/:roleKey', async (req, res) => {
  try {
    const { roleKey } = req.params;
    const showId = req.body.show_id || req.user?.show_id;

    const role = await AssetRoleService.updateRole(showId, roleKey, req.body);

    res.json({
      status: 'SUCCESS',
      message: 'Role updated',
      data: role,
    });
  } catch (error) {
    console.error('Failed to update role:', error);
    res.status(400).json({
      error: 'Failed to update role',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/v1/roles/:roleKey
 * Delete role (only if unused)
 */
router.delete('/:roleKey', async (req, res) => {
  try {
    const { roleKey } = req.params;
    const showId = req.query.show_id || req.user?.show_id;

    const result = await AssetRoleService.deleteRole(showId, roleKey);

    res.json({
      status: 'SUCCESS',
      message: 'Role deleted',
      data: result,
    });
  } catch (error) {
    console.error('Failed to delete role:', error);
    res.status(400).json({
      error: 'Failed to delete role',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/roles/bulk-assign
 * Bulk assign roles to assets
 */
router.post('/bulk-assign', async (req, res) => {
  try {
    const { assignments } = req.body; // [{ assetId, roleKey }, ...]

    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({
        error: 'Assignments array required',
      });
    }

    const result = await AssetRoleService.bulkAssignRoles(assignments);

    res.json({
      status: 'SUCCESS',
      message: `Assigned roles: ${result.succeeded} succeeded, ${result.failed} failed`,
      data: result,
    });
  } catch (error) {
    console.error('Bulk role assignment failed:', error);
    res.status(500).json({
      error: 'Bulk role assignment failed',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/roles/:roleKey/assets
 * Get assets assigned to a role
 */
router.get('/:roleKey/assets', async (req, res) => {
  try {
    const { roleKey } = req.params;
    const showId = req.query.show_id || req.user?.show_id;
    const approved = req.query.approved === 'true';
    const limit = parseInt(req.query.limit) || 100;

    const assets = await AssetRoleService.getAssetsByRole(roleKey, {
      showId,
      approved,
      limit,
    });

    res.json({
      status: 'SUCCESS',
      data: assets,
      count: assets.length,
    });
  } catch (error) {
    console.error('Failed to fetch assets by role:', error);
    res.status(500).json({
      error: 'Failed to fetch assets',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/roles/validate-required
 * Validate required roles for composer export
 */
router.post('/validate-required', async (req, res) => {
  try {
    const { providedRoles } = req.body; // { HOST: assetId, ... }
    const showId = req.body.show_id || req.user?.show_id;

    const validation = await AssetRoleService.validateRequiredRoles(showId, providedRoles);

    res.json({
      status: 'SUCCESS',
      data: validation,
    });
  } catch (error) {
    console.error('Role validation failed:', error);
    res.status(500).json({
      error: 'Role validation failed',
      message: error.message,
    });
  }
});

module.exports = router;
