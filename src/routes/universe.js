'use strict';

/**
 * src/routes/universe.js
 *
 * Universe API routes for the PNOS world-building layer.
 *
 * Base path: /api/v1/universe  (register in app.js)
 *
 * Routes:
 *   GET    /                  — list all universes
 *   POST   /                  — create universe
 *   GET    /:id               — get universe with series
 *   PUT    /:id               — update universe fields
 *   GET    /series            — list all book series (optionally ?universe_id=)
 *   POST   /series            — create book series
 *   PUT    /series/:id        — update series
 *   DELETE /series/:id        — delete series
 */

const express = require('express');
const router  = express.Router();

let optionalAuth;
try {
  const authModule = require('../middleware/auth');
  optionalAuth = authModule.optionalAuth || authModule.authenticate || ((req, res, next) => next());
} catch (e) {
  optionalAuth = (req, res, next) => next();
}

const db = require('../models');
const { Universe, BookSeries } = db;

// ── List universes ─────────────────────────────────────────────────────────
router.get('/', optionalAuth, async (req, res) => {
  try {
    const universes = await Universe.findAll({ order: [['created_at', 'ASC']] });
    res.json({ universes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Create universe ────────────────────────────────────────────────────────
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { name, slug, description, core_themes, world_rules, pnos_beliefs, narrative_economy } = req.body;
    const universe = await Universe.create({
      name, slug, description,
      core_themes: core_themes || [],
      world_rules, pnos_beliefs, narrative_economy,
    });
    res.status(201).json({ universe });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── List book series (MUST be before /:id to avoid param conflict) ─────────
router.get('/series', optionalAuth, async (req, res) => {
  try {
    const where = req.query.universe_id ? { universe_id: req.query.universe_id } : {};
    const series = await BookSeries.findAll({
      where,
      include: [{ model: Universe, as: 'universe', attributes: ['id', 'name'] }],
      order: [['order_index', 'ASC']],
    });
    res.json({ series });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Create book series ─────────────────────────────────────────────────────
router.post('/series', optionalAuth, async (req, res) => {
  try {
    const { universe_id, show_id, name, description, order_index } = req.body;
    const series = await BookSeries.create({ universe_id, show_id, name, description, order_index });
    res.status(201).json({ series });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Update book series ─────────────────────────────────────────────────────
router.put('/series/:id', optionalAuth, async (req, res) => {
  try {
    const series = await BookSeries.findByPk(req.params.id);
    if (!series) return res.status(404).json({ error: 'Series not found' });
    await series.update(req.body);
    res.json({ series });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Delete book series ─────────────────────────────────────────────────────
router.delete('/series/:id', optionalAuth, async (req, res) => {
  try {
    const series = await BookSeries.findByPk(req.params.id);
    if (!series) return res.status(404).json({ error: 'Series not found' });
    await series.destroy();
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get universe with series ───────────────────────────────────────────────
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const universe = await Universe.findByPk(req.params.id, {
      include: [{ model: BookSeries, as: 'series', order: [['order_index', 'ASC']] }],
    });
    if (!universe) return res.status(404).json({ error: 'Universe not found' });
    res.json({ universe });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Update universe ────────────────────────────────────────────────────────
router.put('/:id', optionalAuth, async (req, res) => {
  try {
    const universe = await Universe.findByPk(req.params.id);
    if (!universe) return res.status(404).json({ error: 'Universe not found' });
    await universe.update(req.body);
    res.json({ universe });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
