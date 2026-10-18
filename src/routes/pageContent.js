'use strict';
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

function getModels(req) {
  return req.app.get('models') || require('../models');
}

// GET /api/v1/page-content/:pageName — all saved constants for a page
router.get('/:pageName', async (req, res) => {
  const { PageContent } = getModels(req);
  try {
    const rows = await PageContent.findAll({
      where: { page_name: req.params.pageName },
    });
    const result = {};
    rows.forEach(r => { result[r.constant_key] = r.data; });
    res.json(result);
  } catch (err) {
    console.error('[PageContent] GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/v1/page-content/:pageName/:constantKey — upsert one constant
router.put('/:pageName/:constantKey', requireAuth, async (req, res) => {
  const { PageContent } = getModels(req);
  const { pageName, constantKey } = req.params;
  const { data } = req.body;
  if (!data) return res.status(400).json({ error: 'data field required' });
  try {
    // The Dream Cities list: the cities whose image or story bubble changes get their teasers cut again (Task #3052).
    const cities = pageName === 'world_infrastructure' && constantKey === 'DREAM_CITIES';
    const before = cities ? (await PageContent.findOne({ where: { page_name: pageName, constant_key: constantKey } }))?.data : null;
    const [row] = await PageContent.upsert({
      page_name: pageName,
      constant_key: constantKey,
      data,
    }, {
      conflictFields: ['page_name', 'constant_key'],
      returning: true,
    });
    if (cities) {
      // The writers read the saved cities' words (services/dreamCityText).
      require('../services/dreamCityText').forgetCityCultures();
      const teasers = require('../services/pulseTeasers');
      const keys = teasers.changedCityKeys(before, row.data);
      if (keys.length) {
        const { Op } = require('sequelize');
        await teasers.recutFor(getModels(req), { item_type: 'image', image_kind: { [Op.in]: ['city', 'city_bubble'] }, item_id: { [Op.in]: keys } });
      }
    }
    res.json({ saved: true, constant_key: constantKey, data: row.data });
  } catch (err) {
    console.error('[PageContent] PUT error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v1/page-content/:pageName/:constantKey — revert to default
router.delete('/:pageName/:constantKey', requireAuth, async (req, res) => {
  const { PageContent } = getModels(req);
  try {
    const deleted = await PageContent.destroy({
      where: {
        page_name: req.params.pageName,
        constant_key: req.params.constantKey,
      },
    });
    if (req.params.pageName === 'world_infrastructure' && req.params.constantKey === 'DREAM_CITIES') require('../services/dreamCityText').forgetCityCultures();
    res.json({ deleted: deleted > 0 });
  } catch (err) {
    console.error('[PageContent] DELETE error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
