/**
 * Template Studio Routes - Thumbnail Template Designer
 * GET /api/v1/template-studio - List all templates (with filters)
 * GET /api/v1/template-studio/:id - Get template by ID
 * POST /api/v1/template-studio - Create new template
 * PUT /api/v1/template-studio/:id - Update template (draft only)
 * DELETE /api/v1/template-studio/:id - Delete template (draft only)
 * POST /api/v1/template-studio/:id/clone - Clone template to new version
 * POST /api/v1/template-studio/:id/publish - Publish template
 * POST /api/v1/template-studio/:id/lock - Lock template (prevent edits)
 * POST /api/v1/template-studio/:id/archive - Archive template
 */

const express = require('express');
const { Sequelize } = require('sequelize');
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false
});

const router = express.Router();

/**
 * GET /api/v1/template-studio
 * List templates with optional filters
 * Query params: status, locked, format, name
 */
router.get('/', async (req, res) => {
  try {
    const { status, locked, format, name, limit = 50, offset = 0 } = req.query;

    let whereClause = '';
    const params = [];
    const conditions = [];

    if (status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(status.toUpperCase());
    }

    if (locked !== undefined) {
      conditions.push(`locked = $${params.length + 1}`);
      params.push(locked === 'true');
    }

    if (format) {
      conditions.push(`$${params.length + 1} = ANY(formats_supported)`);
      params.push(format.toUpperCase());
    }

    if (name) {
      conditions.push(`name ILIKE $${params.length + 1}`);
      params.push(`%${name}%`);
    }

    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }

    params.push(parseInt(limit, 10));
    params.push(parseInt(offset, 10));

    const query = `
      SELECT 
        id, name, description, version, status, locked,
        canvas_config, role_slots, safe_zones,
        required_roles, optional_roles, formats_supported,
        created_by, published_at, locked_at, parent_template_id,
        created_at, updated_at
      FROM template_studio
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const [templates] = await sequelize.query(query, { bind: params });

    const countQuery = `
      SELECT COUNT(*) as total
      FROM template_studio
      ${whereClause}
    `;

    const [countResult] = await sequelize.query(countQuery, { 
      bind: params.slice(0, -2) 
    });

    res.json({
      status: 'SUCCESS',
      data: templates,
      count: templates.length,
      total: parseInt(countResult[0].total, 10),
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    });
  } catch (error) {
    console.error('Failed to list templates:', error);
    res.status(500).json({
      error: 'Failed to list templates',
      message: error.message
    });
  }
});

/**
 * GET /api/v1/template-studio/:id
 * Get single template by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [templates] = await sequelize.query(`
      SELECT * FROM template_studio WHERE id = $1
    `, { bind: [id] });

    if (templates.length === 0) {
      return res.status(404).json({
        error: 'Template not found'
      });
    }

    res.json({
      status: 'SUCCESS',
      data: templates[0]
    });
  } catch (error) {
    console.error('Failed to get template:', error);
    res.status(500).json({
      error: 'Failed to get template',
      message: error.message
    });
  }
});

/**
 * POST /api/v1/template-studio
 * Create new template (always starts as DRAFT)
 */
router.post('/', async (req, res) => {
  try {
    const {
      name,
      description,
      canvas_config,
      role_slots,
      safe_zones,
      required_roles,
      optional_roles,
      formats_supported
    } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({
        error: 'Validation failed',
        details: ['name is required']
      });
    }

    if (!canvas_config || !canvas_config.width || !canvas_config.height) {
      return res.status(400).json({
        error: 'Validation failed',
        details: ['canvas_config with width and height is required']
      });
    }

    if (!Array.isArray(role_slots) || role_slots.length === 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: ['role_slots array is required and must not be empty']
      });
    }

    const [result] = await sequelize.query(`
      INSERT INTO template_studio (
        name, description, version, status, locked,
        canvas_config, role_slots, safe_zones,
        required_roles, optional_roles, formats_supported
      ) VALUES (
        $1, $2, 1, 'DRAFT', false,
        $3::jsonb, $4::jsonb, $5::jsonb,
        $6::text[], $7::text[], $8::text[]
      )
      RETURNING *
    `, {
      bind: [
        name,
        description || null,
        JSON.stringify(canvas_config),
        JSON.stringify(role_slots),
        JSON.stringify(safe_zones || {}),
        required_roles || [],
        optional_roles || [],
        formats_supported || ['YOUTUBE']
      ]
    });

    res.status(201).json({
      status: 'SUCCESS',
      message: 'Template created',
      data: result[0]
    });
  } catch (error) {
    console.error('Failed to create template:', error);
    res.status(500).json({
      error: 'Failed to create template',
      message: error.message
    });
  }
});

/**
 * PUT /api/v1/template-studio/:id
 * Update template (only DRAFT templates can be edited)
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      canvas_config,
      role_slots,
      safe_zones,
      required_roles,
      optional_roles,
      formats_supported
    } = req.body;

    // Check if template exists and is editable
    const [existing] = await sequelize.query(`
      SELECT id, status, locked FROM template_studio WHERE id = $1
    `, { bind: [id] });

    if (existing.length === 0) {
      return res.status(404).json({
        error: 'Template not found'
      });
    }

    if (existing[0].locked) {
      return res.status(403).json({
        error: 'Template is locked and cannot be edited'
      });
    }

    if (existing[0].status !== 'DRAFT') {
      return res.status(403).json({
        error: 'Only DRAFT templates can be edited. Use clone endpoint to create new version.'
      });
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }

    if (canvas_config !== undefined) {
      updates.push(`canvas_config = $${paramIndex++}::jsonb`);
      values.push(JSON.stringify(canvas_config));
    }

    if (role_slots !== undefined) {
      updates.push(`role_slots = $${paramIndex++}::jsonb`);
      values.push(JSON.stringify(role_slots));
    }

    if (safe_zones !== undefined) {
      updates.push(`safe_zones = $${paramIndex++}::jsonb`);
      values.push(JSON.stringify(safe_zones));
    }

    if (required_roles !== undefined) {
      updates.push(`required_roles = $${paramIndex++}::text[]`);
      values.push(required_roles);
    }

    if (optional_roles !== undefined) {
      updates.push(`optional_roles = $${paramIndex++}::text[]`);
      values.push(optional_roles);
    }

    if (formats_supported !== undefined) {
      updates.push(`formats_supported = $${paramIndex++}::text[]`);
      values.push(formats_supported);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No fields to update'
      });
    }

    values.push(id);

    const [result] = await sequelize.query(`
      UPDATE template_studio
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, { bind: values });

    res.json({
      status: 'SUCCESS',
      message: 'Template updated',
      data: result[0]
    });
  } catch (error) {
    console.error('Failed to update template:', error);
    res.status(500).json({
      error: 'Failed to update template',
      message: error.message
    });
  }
});

/**
 * DELETE /api/v1/template-studio/:id
 * Delete template (only DRAFT templates)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await sequelize.query(`
      SELECT id, status, locked FROM template_studio WHERE id = $1
    `, { bind: [id] });

    if (existing.length === 0) {
      return res.status(404).json({
        error: 'Template not found'
      });
    }

    if (existing[0].status !== 'DRAFT') {
      return res.status(403).json({
        error: 'Only DRAFT templates can be deleted. Use archive endpoint instead.'
      });
    }

    await sequelize.query(`
      DELETE FROM template_studio WHERE id = $1
    `, { bind: [id] });

    res.json({
      status: 'SUCCESS',
      message: 'Template deleted'
    });
  } catch (error) {
    console.error('Failed to delete template:', error);
    res.status(500).json({
      error: 'Failed to delete template',
      message: error.message
    });
  }
});

/**
 * POST /api/v1/template-studio/:id/clone
 * Clone template to new version (creates DRAFT copy)
 */
router.post('/:id/clone', async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await sequelize.query(`
      SELECT * FROM template_studio WHERE id = $1
    `, { bind: [id] });

    if (existing.length === 0) {
      return res.status(404).json({
        error: 'Template not found'
      });
    }

    const original = existing[0];

    // Get next version number for this template name
    const [versionCheck] = await sequelize.query(`
      SELECT MAX(version) as max_version
      FROM template_studio
      WHERE name = $1
    `, { bind: [original.name] });

    const nextVersion = (versionCheck[0].max_version || 0) + 1;

    const [result] = await sequelize.query(`
      INSERT INTO template_studio (
        name, description, version, status, locked,
        canvas_config, role_slots, safe_zones,
        required_roles, optional_roles, formats_supported,
        parent_template_id
      ) VALUES (
        $1, $2, $3, 'DRAFT', false,
        $4::jsonb, $5::jsonb, $6::jsonb,
        $7::text[], $8::text[], $9::text[],
        $10
      )
      RETURNING *
    `, {
      bind: [
        original.name,
        original.description,
        nextVersion,
        JSON.stringify(original.canvas_config),
        JSON.stringify(original.role_slots),
        JSON.stringify(original.safe_zones),
        original.required_roles,
        original.optional_roles,
        original.formats_supported,
        id
      ]
    });

    res.status(201).json({
      status: 'SUCCESS',
      message: 'Template cloned',
      data: result[0]
    });
  } catch (error) {
    console.error('Failed to clone template:', error);
    res.status(500).json({
      error: 'Failed to clone template',
      message: error.message
    });
  }
});

/**
 * POST /api/v1/template-studio/:id/publish
 * Publish template (DRAFT → PUBLISHED)
 */
router.post('/:id/publish', async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await sequelize.query(`
      SELECT id, status FROM template_studio WHERE id = $1
    `, { bind: [id] });

    if (existing.length === 0) {
      return res.status(404).json({
        error: 'Template not found'
      });
    }

    if (existing[0].status !== 'DRAFT') {
      return res.status(400).json({
        error: 'Only DRAFT templates can be published'
      });
    }

    const [result] = await sequelize.query(`
      UPDATE template_studio
      SET status = 'PUBLISHED', published_at = NOW()
      WHERE id = $1
      RETURNING *
    `, { bind: [id] });

    res.json({
      status: 'SUCCESS',
      message: 'Template published',
      data: result[0]
    });
  } catch (error) {
    console.error('Failed to publish template:', error);
    res.status(500).json({
      error: 'Failed to publish template',
      message: error.message
    });
  }
});

/**
 * POST /api/v1/template-studio/:id/lock
 * Lock template (prevents any further edits)
 */
router.post('/:id/lock', async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await sequelize.query(`
      SELECT id, locked FROM template_studio WHERE id = $1
    `, { bind: [id] });

    if (existing.length === 0) {
      return res.status(404).json({
        error: 'Template not found'
      });
    }

    if (existing[0].locked) {
      return res.status(400).json({
        error: 'Template is already locked'
      });
    }

    const [result] = await sequelize.query(`
      UPDATE template_studio
      SET locked = true, locked_at = NOW()
      WHERE id = $1
      RETURNING *
    `, { bind: [id] });

    res.json({
      status: 'SUCCESS',
      message: 'Template locked',
      data: result[0]
    });
  } catch (error) {
    console.error('Failed to lock template:', error);
    res.status(500).json({
      error: 'Failed to lock template',
      message: error.message
    });
  }
});

/**
 * POST /api/v1/template-studio/:id/archive
 * Archive template (PUBLISHED → ARCHIVED)
 */
router.post('/:id/archive', async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await sequelize.query(`
      SELECT id, status FROM template_studio WHERE id = $1
    `, { bind: [id] });

    if (existing.length === 0) {
      return res.status(404).json({
        error: 'Template not found'
      });
    }

    if (existing[0].status === 'ARCHIVED') {
      return res.status(400).json({
        error: 'Template is already archived'
      });
    }

    const [result] = await sequelize.query(`
      UPDATE template_studio
      SET status = 'ARCHIVED'
      WHERE id = $1
      RETURNING *
    `, { bind: [id] });

    res.json({
      status: 'SUCCESS',
      message: 'Template archived',
      data: result[0]
    });
  } catch (error) {
    console.error('Failed to archive template:', error);
    res.status(500).json({
      error: 'Failed to archive template',
      message: error.message
    });
  }
});

module.exports = router;
