'use strict';
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');

function getDb() {
  return require('../models');
}

/* ───── LIST ───── */
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const where = {};
    if (req.query.layer)   where.layer   = req.query.layer;
    if (req.query.show_id) where.show_id = req.query.show_id;
    if (req.query.book_id) where.book_id = req.query.book_id;
    const rows = await db.CharacterRelationship.findAll({ where, order: [['created_at', 'ASC']] });
    res.json(rows);
  } catch (err) {
    console.error('Relationships list error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ───── CREATE ───── */
router.post('/', async (req, res) => {
  try {
    const db = getDb();
    const row = await db.CharacterRelationship.create(req.body);
    res.status(201).json(row);
  } catch (err) {
    console.error('Relationships create error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ───── BATCH SAVE POSITIONS (before /:id to avoid param clash) ───── */
router.put('/positions', async (req, res) => {
  try {
    const db = getDb();
    const { positions } = req.body; // [{ id, source_x, source_y, target_x, target_y }]
    if (!Array.isArray(positions)) return res.status(400).json({ error: 'positions array required' });
    await Promise.all(positions.map(p =>
      db.CharacterRelationship.update(
        { source_x: p.source_x, source_y: p.source_y, target_x: p.target_x, target_y: p.target_y },
        { where: { id: p.id } }
      )
    ));
    res.json({ saved: positions.length });
  } catch (err) {
    console.error('Positions save error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ───── SEED BOOK 1 (before /:id to avoid param clash) ───── */
router.post('/seed/book1', async (req, res) => {
  try {
    const db = getDb();
    const seeds = [
      // Real-world layer
      { layer:'real_world', source_name:'Marcus Whitfield', target_name:'Anika Patel', relationship_type:'romantic', direction:'both', label:'childhood sweethearts', status:'active', intensity:5 },
      { layer:'real_world', source_name:'Marcus Whitfield', target_name:'DeShawn Holloway', relationship_type:'friendship', direction:'both', label:'best friends / brothers', status:'active', intensity:4 },
      { layer:'real_world', source_name:'Anika Patel', target_name:'Yuki Tanaka', relationship_type:'friendship', direction:'both', label:'college roommates', status:'active', intensity:3 },
      { layer:'real_world', source_name:'Marcus Whitfield', target_name:'Victor Harmon', relationship_type:'rivalry', direction:'both', label:'corporate rivals', status:'active', intensity:4 },
      // Lalaverse layer
      { layer:'lalaverse', source_name:'Lux', target_name:'Nightshade', relationship_type:'rivalry', direction:'both', label:'foil / shadow self', status:'active', intensity:5, source_knows:'Nightshade is a mirror', target_knows:'Lux is destined to fail', reader_knows:'They once shared the same soul' },
      { layer:'lalaverse', source_name:'Lux', target_name:'Sable', relationship_type:'mentor', direction:'source_to_target', label:'guide', status:'active', intensity:3 },
      { layer:'lalaverse', source_name:'Nightshade', target_name:'The Weave', relationship_type:'serves', direction:'source_to_target', label:'bound servant', status:'secret', intensity:4, source_knows:'Must obey', target_knows:'Everything', reader_knows:'Nightshade is trapped' },
      { layer:'lalaverse', source_name:'Sable', target_name:'Nightshade', relationship_type:'sibling', direction:'both', label:'twin flames', status:'dormant', intensity:4 },
      { layer:'lalaverse', source_name:'The Weave', target_name:'Lux', relationship_type:'unknown', direction:'target_to_source', label:'unseen thread', status:'secret', intensity:5, reader_knows:'The Weave has been watching since page one' },
    ];
    const created = await db.CharacterRelationship.bulkCreate(seeds);
    res.status(201).json({ seeded: created.length });
  } catch (err) {
    console.error('Seed error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ───── UPDATE ───── */
router.put('/:id', async (req, res) => {
  try {
    const db = getDb();
    const [updated] = await db.CharacterRelationship.update(req.body, { where: { id: req.params.id } });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    const row = await db.CharacterRelationship.findByPk(req.params.id);
    res.json(row);
  } catch (err) {
    console.error('Relationships update error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ───── DELETE ───── */
router.delete('/:id', async (req, res) => {
  try {
    const db = getDb();
    const deleted = await db.CharacterRelationship.destroy({ where: { id: req.params.id } });
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('Relationships delete error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
