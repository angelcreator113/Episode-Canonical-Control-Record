const express = require('express');
const router = express.Router();
const outfitSetController = require('../controllers/outfitSetController');
const { requireAuth } = require('../middleware/auth');

// List all outfit sets
router.get('/', requireAuth, outfitSetController.listOutfitSets);

// Get a specific outfit set
router.get('/:id', requireAuth, outfitSetController.getOutfitSet);

// Create a new outfit set
router.post('/', requireAuth, outfitSetController.createOutfitSet);

// Update an outfit set
router.put('/:id', requireAuth, outfitSetController.updateOutfitSet);

// Delete an outfit set
router.delete('/:id', requireAuth, outfitSetController.deleteOutfitSet);

module.exports = router;
