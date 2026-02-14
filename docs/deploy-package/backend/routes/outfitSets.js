const express = require('express');
const router = express.Router();
const outfitSetController = require('../controllers/outfitSetController');

// List all outfit sets
router.get('/', outfitSetController.listOutfitSets);

// Get a specific outfit set
router.get('/:id', outfitSetController.getOutfitSet);

// Create a new outfit set
router.post('/', outfitSetController.createOutfitSet);

// Update an outfit set
router.put('/:id', outfitSetController.updateOutfitSet);

// Delete an outfit set
router.delete('/:id', outfitSetController.deleteOutfitSet);

module.exports = router;
