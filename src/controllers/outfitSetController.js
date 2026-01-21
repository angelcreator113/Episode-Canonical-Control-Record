const { OutfitSet } = require('../models');

/**
 * List all outfit sets
 */
const listOutfitSets = async (req, res) => {
  try {
    const outfitSets = await OutfitSet.findAll({
      order: [['created_at', 'DESC']],
    });

    res.json({
      success: true,
      data: outfitSets,
    });
  } catch (error) {
    console.error('Error listing outfit sets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list outfit sets',
      error: error.message,
    });
  }
};

/**
 * Get a single outfit set by ID
 */
const getOutfitSet = async (req, res) => {
  try {
    const { id } = req.params;
    const outfitSet = await OutfitSet.findByPk(id);

    if (!outfitSet) {
      return res.status(404).json({
        success: false,
        message: 'Outfit set not found',
      });
    }

    res.json({
      success: true,
      data: outfitSet,
    });
  } catch (error) {
    console.error('Error getting outfit set:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get outfit set',
      error: error.message,
    });
  }
};

/**
 * Create a new outfit set
 */
const createOutfitSet = async (req, res) => {
  try {
    const { name, description, character, occasion, season, items } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Name is required',
      });
    }

    const outfitSet = await OutfitSet.create({
      name,
      description,
      character,
      occasion,
      season,
      items: items || [],
    });

    res.status(201).json({
      success: true,
      data: outfitSet,
    });
  } catch (error) {
    console.error('Error creating outfit set:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create outfit set',
      error: error.message,
    });
  }
};

/**
 * Update an existing outfit set
 */
const updateOutfitSet = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, character, occasion, season, items } = req.body;

    const outfitSet = await OutfitSet.findByPk(id);

    if (!outfitSet) {
      return res.status(404).json({
        success: false,
        message: 'Outfit set not found',
      });
    }

    await outfitSet.update({
      name: name !== undefined ? name : outfitSet.name,
      description: description !== undefined ? description : outfitSet.description,
      character: character !== undefined ? character : outfitSet.character,
      occasion: occasion !== undefined ? occasion : outfitSet.occasion,
      season: season !== undefined ? season : outfitSet.season,
      items: items !== undefined ? items : outfitSet.items,
    });

    res.json({
      success: true,
      data: outfitSet,
    });
  } catch (error) {
    console.error('Error updating outfit set:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update outfit set',
      error: error.message,
    });
  }
};

/**
 * Delete an outfit set
 */
const deleteOutfitSet = async (req, res) => {
  try {
    const { id } = req.params;

    const outfitSet = await OutfitSet.findByPk(id);

    if (!outfitSet) {
      return res.status(404).json({
        success: false,
        message: 'Outfit set not found',
      });
    }

    await outfitSet.destroy();

    res.json({
      success: true,
      message: 'Outfit set deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting outfit set:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete outfit set',
      error: error.message,
    });
  }
};

module.exports = {
  listOutfitSets,
  getOutfitSet,
  createOutfitSet,
  updateOutfitSet,
  deleteOutfitSet,
};
