const router = require('express').Router();
const { Character } = require('../models');

// GET /api/v1/characters?show_id=xxx
router.get('/', async (req, res) => {
  try {
    const where = {};
    if (req.query.show_id) where.show_id = req.query.show_id;
    if (req.query.role) where.role = req.query.role;
    const characters = await Character.findAll({ where, order: [['role', 'ASC']] });
    res.json({ success: true, data: characters });
  } catch (error) {
    console.error('❌ Error listing characters:', error.message);
    res.status(500).json({ success: false, error: 'Failed to list characters', message: error.message });
  }
});

// GET /api/v1/characters/:id
router.get('/:id', async (req, res) => {
  try {
    const character = await Character.findByPk(req.params.id);
    if (!character) return res.status(404).json({ success: false, message: 'Character not found' });
    res.json({ success: true, data: character });
  } catch (error) {
    console.error('❌ Error getting character:', error.message);
    res.status(500).json({ success: false, error: 'Failed to get character', message: error.message });
  }
});

module.exports = router;
