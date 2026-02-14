/**
 * Icon Slot Controller
 * Manages icon slot mappings
 */

const { pool } = require('../db');

/**
 * Get all icon slot mappings
 */
exports.getAllMappings = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM icon_slot_mappings ORDER BY slot_id, asset_role'
    );
    
    res.json({
      success: true,
      data: result.rows,
      meta: {
        count: result.rows.length,
      },
    });
    
  } catch (error) {
    console.error('[IconSlotController] Error getting all mappings:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get icon slot mappings',
        details: error.message,
      },
    });
  }
};

/**
 * Get mapping for specific asset role
 */
exports.getMappingByRole = async (req, res) => {
  const { assetRole } = req.params;
  
  try {
    const result = await pool.query(
      'SELECT * FROM icon_slot_mappings WHERE asset_role = $1',
      [assetRole]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Icon slot mapping not found' },
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
    });
    
  } catch (error) {
    console.error('[IconSlotController] Error getting mapping by role:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get icon slot mapping',
        details: error.message,
      },
    });
  }
};

/**
 * Get all icons for specific slot
 */
exports.getIconsBySlot = async (req, res) => {
  const { slotId } = req.params;
  
  try {
    const result = await pool.query(
      'SELECT * FROM icon_slot_mappings WHERE slot_id = $1 ORDER BY asset_role',
      [slotId]
    );
    
    res.json({
      success: true,
      data: result.rows,
      meta: {
        count: result.rows.length,
        slot_id: slotId,
      },
    });
    
  } catch (error) {
    console.error('[IconSlotController] Error getting icons by slot:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to get icons for slot',
        details: error.message,
      },
    });
  }
};

/**
 * Create new icon slot mapping (admin only)
 */
exports.createMapping = async (req, res) => {
  const {
    asset_role,
    slot_id,
    slot_category,
    icon_type,
    display_position,
    is_persistent = false,
    supports_states = false,
    state_metadata,
    default_position,
    metadata,
    notes,
  } = req.body;
  
  try {
    if (!asset_role || !slot_id || !slot_category || !icon_type) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Missing required fields: asset_role, slot_id, slot_category, icon_type',
        },
      });
    }
    
    const result = await pool.query(
      `INSERT INTO icon_slot_mappings (
        asset_role, slot_id, slot_category, icon_type,
        display_position, is_persistent, supports_states,
        state_metadata, default_position, metadata, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        asset_role, slot_id, slot_category, icon_type,
        display_position, is_persistent, supports_states,
        state_metadata ? JSON.stringify(state_metadata) : null,
        default_position ? JSON.stringify(default_position) : null,
        metadata ? JSON.stringify(metadata) : null,
        notes,
      ]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
    
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({
        success: false,
        error: { message: 'Icon slot mapping already exists for this asset role' },
      });
    }
    
    console.error('[IconSlotController] Error creating mapping:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to create icon slot mapping',
        details: error.message,
      },
    });
  }
};

/**
 * Update icon slot mapping (admin only)
 */
exports.updateMapping = async (req, res) => {
  const { assetRole } = req.params;
  const updates = req.body;
  
  try {
    const allowedFields = [
      'slot_id', 'slot_category', 'icon_type', 'display_position',
      'is_persistent', 'supports_states', 'state_metadata',
      'default_position', 'metadata', 'notes',
    ];
    
    const setClause = [];
    const params = [];
    let paramIndex = 1;
    
    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        setClause.push(`${key} = $${paramIndex}`);
        
        if (['state_metadata', 'default_position', 'metadata'].includes(key)) {
          params.push(JSON.stringify(updates[key]));
        } else {
          params.push(updates[key]);
        }
        paramIndex++;
      }
    });
    
    if (setClause.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'No valid fields to update' },
      });
    }
    
    setClause.push(`updated_at = NOW()`);
    params.push(assetRole);
    
    const query = `
      UPDATE icon_slot_mappings
      SET ${setClause.join(', ')}
      WHERE asset_role = $${paramIndex}
      RETURNING *
    `;
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Icon slot mapping not found' },
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
    });
    
  } catch (error) {
    console.error('[IconSlotController] Error updating mapping:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update icon slot mapping',
        details: error.message,
      },
    });
  }
};

/**
 * Delete icon slot mapping (admin only)
 */
exports.deleteMapping = async (req, res) => {
  const { assetRole } = req.params;
  
  try {
    const result = await pool.query(
      'DELETE FROM icon_slot_mappings WHERE asset_role = $1 RETURNING asset_role',
      [assetRole]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Icon slot mapping not found' },
      });
    }
    
    res.json({
      success: true,
      data: { asset_role: result.rows[0].asset_role, deleted: true },
    });
    
  } catch (error) {
    console.error('[IconSlotController] Error deleting mapping:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete icon slot mapping',
        details: error.message,
      },
    });
  }
};
