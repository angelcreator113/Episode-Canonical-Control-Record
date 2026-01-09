const express = require('express');
const router = express.Router();
const { Show } = require('../models');

/**
 * GET /api/v1/shows
 * Get all shows
 */
router.get('/', async (req, res) => {
  try {
    const shows = await Show.findAll({
      order: [['name', 'ASC']],
    });

    res.json({
      status: 'SUCCESS',
      data: shows,
      count: shows.length,
    });
  } catch (error) {
    console.error('Failed to get shows:', error);
    res.status(500).json({
      error: 'Failed to get shows',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/shows
 * Create a new show
 */
router.post('/', async (req, res) => {
  try {
    const { name, description, icon, color, status } = req.body;

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const show = await Show.create({
      name,
      slug,
      description,
      icon,
      color,
      status,
    });

    res.status(201).json({
      status: 'SUCCESS',
      data: show,
    });
  } catch (error) {
    console.error('Failed to create show:', error);
    res.status(500).json({
      error: 'Failed to create show',
      message: error.message,
    });
  }
});

/**
 * PUT /api/v1/shows/:id
 * Update a show
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const show = await Show.findByPk(id);
    if (!show) {
      return res.status(404).json({ error: 'Show not found' });
    }

    await show.update(updates);

    res.json({
      status: 'SUCCESS',
      data: show,
    });
  } catch (error) {
    console.error('Failed to update show:', error);
    res.status(500).json({
      error: 'Failed to update show',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/v1/shows/:id
 * Delete a show
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const show = await Show.findByPk(id);
    if (!show) {
      return res.status(404).json({ error: 'Show not found' });
    }

    await show.destroy();

    res.json({
      status: 'SUCCESS',
      message: 'Show deleted',
    });
  } catch (error) {
    console.error('Failed to delete show:', error);
    res.status(500).json({
      error: 'Failed to delete show',
      message: error.message,
    });
  }
});

module.exports = router;