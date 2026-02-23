/**
 * Continuity Engine Routes
 * CRUD for timelines, beats, characters, and conflict detection
 * Location: src/routes/continuityEngine.js
 */

'use strict';

const express = require('express');
const router = express.Router();

/* ------------------------------------------------------------------ */
/*  Lazy model loader                                                  */
/* ------------------------------------------------------------------ */
let models = null;
function getModels() {
  if (!models) { models = require('../models'); }
  return models;
}

/* ------------------------------------------------------------------ */
/*  Auto-create continuity tables if missing (runs once)               */
/* ------------------------------------------------------------------ */
let tablesChecked = false;
async function ensureTables() {
  if (tablesChecked) return;
  try {
    const m = getModels();
    const qi = m.sequelize.getQueryInterface();
    const tables = await qi.showAllTables();
    const tableSet = new Set(tables.map(t => (typeof t === 'string' ? t : t.tablename || t)));
    if (!tableSet.has('continuity_timelines')) {
      console.log('[ContinuityEngine] Creating continuity tables...');
      await m.ContinuityTimeline.sync();
      await m.ContinuityCharacter.sync();
      await m.ContinuityBeat.sync();
      if (m.ContinuityBeatCharacter) await m.ContinuityBeatCharacter.sync();
      console.log('[ContinuityEngine] ✅ Continuity tables created');
    }
  } catch (err) {
    console.error('[ContinuityEngine] Table check/create warning:', err.message);
  }
  tablesChecked = true;
}

/* ================================================================== */
/*  TIMELINES                                                          */
/* ================================================================== */

/** GET /timelines — list all timelines */
router.get('/timelines', async (req, res) => {
  try {
    await ensureTables();
    const { ContinuityTimeline, ContinuityBeat, ContinuityCharacter } = getModels();
    const timelines = await ContinuityTimeline.findAll({
      include: [
        { model: ContinuityCharacter, as: 'characters', attributes: ['id', 'name', 'character_key', 'role', 'color', 'sort_order'] },
        { model: ContinuityBeat, as: 'beats', attributes: ['id'] },
      ],
      order: [['created_at', 'DESC']],
    });
    return res.json({ success: true, timelines });
  } catch (err) {
    console.error('[ContinuityEngine] GET /timelines error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/** GET /timelines/:id — full timeline with beats + characters */
router.get('/timelines/:id', async (req, res) => {
  try {
    const { ContinuityTimeline, ContinuityBeat, ContinuityCharacter } = getModels();
    const timeline = await ContinuityTimeline.findByPk(req.params.id, {
      include: [
        { model: ContinuityCharacter, as: 'characters', order: [['sort_order', 'ASC']] },
        {
          model: ContinuityBeat, as: 'beats',
          include: [{ model: ContinuityCharacter, as: 'characters', through: { attributes: [] } }],
          order: [['sort_order', 'ASC']],
        },
      ],
      order: [
        [{ model: ContinuityCharacter, as: 'characters' }, 'sort_order', 'ASC'],
        [{ model: ContinuityBeat, as: 'beats' }, 'sort_order', 'ASC'],
      ],
    });
    if (!timeline) return res.status(404).json({ success: false, error: 'Timeline not found' });
    return res.json({ success: true, timeline });
  } catch (err) {
    console.error('[ContinuityEngine] GET /timelines/:id error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/** POST /timelines — create a new timeline */
router.post('/timelines', async (req, res) => {
  try {
    const { ContinuityTimeline } = getModels();
    const { title, description, season_tag, show_id } = req.body;
    const timeline = await ContinuityTimeline.create({
      title: title || 'Untitled Timeline',
      description: description || null,
      season_tag: season_tag || null,
      show_id: show_id || null,
      status: 'draft',
    });
    return res.status(201).json({ success: true, timeline });
  } catch (err) {
    console.error('[ContinuityEngine] POST /timelines error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/** PUT /timelines/:id — update timeline metadata */
router.put('/timelines/:id', async (req, res) => {
  try {
    const { ContinuityTimeline } = getModels();
    const timeline = await ContinuityTimeline.findByPk(req.params.id);
    if (!timeline) return res.status(404).json({ success: false, error: 'Timeline not found' });
    const { title, description, season_tag, status } = req.body;
    await timeline.update({
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(season_tag !== undefined && { season_tag }),
      ...(status !== undefined && { status }),
    });
    return res.json({ success: true, timeline });
  } catch (err) {
    console.error('[ContinuityEngine] PUT /timelines/:id error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/** DELETE /timelines/:id */
router.delete('/timelines/:id', async (req, res) => {
  try {
    const { ContinuityTimeline } = getModels();
    const timeline = await ContinuityTimeline.findByPk(req.params.id);
    if (!timeline) return res.status(404).json({ success: false, error: 'Timeline not found' });
    await timeline.destroy();
    return res.json({ success: true, deleted: true });
  } catch (err) {
    console.error('[ContinuityEngine] DELETE /timelines/:id error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* ================================================================== */
/*  CHARACTERS (per-timeline)                                          */
/* ================================================================== */

/** POST /timelines/:id/characters — add a character to a timeline */
router.post('/timelines/:id/characters', async (req, res) => {
  try {
    const { ContinuityTimeline, ContinuityCharacter } = getModels();
    const timeline = await ContinuityTimeline.findByPk(req.params.id);
    if (!timeline) return res.status(404).json({ success: false, error: 'Timeline not found' });

    const { character_key, name, role, color, sort_order } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'name is required' });

    const key = character_key || name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const character = await ContinuityCharacter.create({
      timeline_id: req.params.id,
      character_key: key,
      name,
      role: role || null,
      color: color || '#5b7fff',
      sort_order: sort_order ?? 0,
    });
    return res.status(201).json({ success: true, character });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ success: false, error: 'Character key already exists in this timeline' });
    }
    console.error('[ContinuityEngine] POST characters error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/** PUT /characters/:id — update a character */
router.put('/characters/:id', async (req, res) => {
  try {
    const { ContinuityCharacter } = getModels();
    const character = await ContinuityCharacter.findByPk(req.params.id);
    if (!character) return res.status(404).json({ success: false, error: 'Character not found' });
    const { name, role, color, sort_order } = req.body;
    await character.update({
      ...(name !== undefined && { name }),
      ...(role !== undefined && { role }),
      ...(color !== undefined && { color }),
      ...(sort_order !== undefined && { sort_order }),
    });
    return res.json({ success: true, character });
  } catch (err) {
    console.error('[ContinuityEngine] PUT characters/:id error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/** DELETE /characters/:id */
router.delete('/characters/:id', async (req, res) => {
  try {
    const { ContinuityCharacter } = getModels();
    const char = await ContinuityCharacter.findByPk(req.params.id);
    if (!char) return res.status(404).json({ success: false, error: 'Character not found' });
    await char.destroy();
    return res.json({ success: true, deleted: true });
  } catch (err) {
    console.error('[ContinuityEngine] DELETE characters/:id error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* ================================================================== */
/*  BEATS                                                              */
/* ================================================================== */

/** POST /timelines/:id/beats — add a beat with character assignments */
router.post('/timelines/:id/beats', async (req, res) => {
  try {
    const { ContinuityTimeline, ContinuityBeat, ContinuityCharacter, ContinuityBeatCharacter, sequelize } = getModels();
    const timeline = await ContinuityTimeline.findByPk(req.params.id);
    if (!timeline) return res.status(404).json({ success: false, error: 'Timeline not found' });

    const { name, location, time_tag, note, character_ids } = req.body;
    if (!name || !location) return res.status(400).json({ success: false, error: 'name and location are required' });

    // Auto-number
    const maxBeat = await ContinuityBeat.max('beat_number', { where: { timeline_id: req.params.id } });
    const beatNumber = (maxBeat || 0) + 1;
    const maxSort = await ContinuityBeat.max('sort_order', { where: { timeline_id: req.params.id } });

    const beat = await ContinuityBeat.create({
      timeline_id: req.params.id,
      beat_number: beatNumber,
      name,
      location,
      time_tag: time_tag || null,
      note: note || null,
      sort_order: (maxSort || 0) + 1,
    });

    // Assign characters
    if (character_ids && character_ids.length > 0) {
      const rows = character_ids.map(cid => ({ beat_id: beat.id, character_id: cid }));
      await ContinuityBeatCharacter.bulkCreate(rows);
    }

    // Re-fetch with characters
    const full = await ContinuityBeat.findByPk(beat.id, {
      include: [{ model: ContinuityCharacter, as: 'characters', through: { attributes: [] } }],
    });

    return res.status(201).json({ success: true, beat: full });
  } catch (err) {
    console.error('[ContinuityEngine] POST beats error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/** PUT /beats/:id — update a beat + optionally reassign characters */
router.put('/beats/:id', async (req, res) => {
  try {
    const { ContinuityBeat, ContinuityCharacter, ContinuityBeatCharacter } = getModels();
    const beat = await ContinuityBeat.findByPk(req.params.id);
    if (!beat) return res.status(404).json({ success: false, error: 'Beat not found' });

    const { name, location, time_tag, note, sort_order, character_ids } = req.body;
    await beat.update({
      ...(name !== undefined && { name }),
      ...(location !== undefined && { location }),
      ...(time_tag !== undefined && { time_tag }),
      ...(note !== undefined && { note }),
      ...(sort_order !== undefined && { sort_order }),
    });

    // Reassign characters if provided
    if (character_ids !== undefined) {
      await ContinuityBeatCharacter.destroy({ where: { beat_id: beat.id } });
      if (character_ids.length > 0) {
        await ContinuityBeatCharacter.bulkCreate(
          character_ids.map(cid => ({ beat_id: beat.id, character_id: cid }))
        );
      }
    }

    const full = await ContinuityBeat.findByPk(beat.id, {
      include: [{ model: ContinuityCharacter, as: 'characters', through: { attributes: [] } }],
    });
    return res.json({ success: true, beat: full });
  } catch (err) {
    console.error('[ContinuityEngine] PUT beats/:id error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/** DELETE /beats/:id */
router.delete('/beats/:id', async (req, res) => {
  try {
    const { ContinuityBeat } = getModels();
    const beat = await ContinuityBeat.findByPk(req.params.id);
    if (!beat) return res.status(404).json({ success: false, error: 'Beat not found' });
    await beat.destroy();
    return res.json({ success: true, deleted: true });
  } catch (err) {
    console.error('[ContinuityEngine] DELETE beats/:id error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/** POST /beats/reorder — bulk-update sort_order */
router.post('/beats/reorder', async (req, res) => {
  try {
    const { ContinuityBeat } = getModels();
    const { order } = req.body; // [{ id, sort_order }, ...]
    if (!Array.isArray(order)) return res.status(400).json({ success: false, error: 'order array required' });
    for (const item of order) {
      await ContinuityBeat.update({ sort_order: item.sort_order }, { where: { id: item.id } });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('[ContinuityEngine] POST beats/reorder error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* ================================================================== */
/*  CONFLICT DETECTION                                                 */
/* ================================================================== */

/** GET /timelines/:id/conflicts — detect all continuity conflicts */
router.get('/timelines/:id/conflicts', async (req, res) => {
  try {
    const { ContinuityBeat, ContinuityCharacter } = getModels();

    const beats = await ContinuityBeat.findAll({
      where: { timeline_id: req.params.id },
      include: [{ model: ContinuityCharacter, as: 'characters', through: { attributes: [] } }],
      order: [['sort_order', 'ASC']],
    });

    const conflicts = [];
    const seen = new Set();

    for (let i = 0; i < beats.length; i++) {
      const beat = beats[i];
      // Find other beats with the same time_tag
      const sameTime = beats.filter(
        (b) => b.id !== beat.id && b.time_tag && beat.time_tag && b.time_tag === beat.time_tag
      );

      for (const other of sameTime) {
        // Find characters appearing in both beats
        const beatCharIds = beat.characters.map((c) => c.id);
        const overlap = other.characters.filter((c) => beatCharIds.includes(c.id));

        for (const char of overlap) {
          // Only if locations differ
          if (beat.location !== other.location) {
            const key = [char.id, beat.id, other.id].sort().join('|');
            if (!seen.has(key)) {
              seen.add(key);
              conflicts.push({
                character_id: char.id,
                character_name: char.name,
                character_color: char.color,
                beat1_id: beat.id,
                beat1_name: beat.name,
                beat1_location: beat.location,
                beat2_id: other.id,
                beat2_name: other.name,
                beat2_location: other.location,
                time_tag: beat.time_tag,
                message: `${char.name} can't be at ${beat.location} and ${other.location} at the same time (${beat.time_tag}).`,
              });
            }
          }
        }
      }
    }

    return res.json({ success: true, conflict_count: conflicts.length, conflicts });
  } catch (err) {
    console.error('[ContinuityEngine] GET conflicts error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* ================================================================== */
/*  SEED — Preloads demo data matching the mockup                      */
/* ================================================================== */

router.post('/timelines/:id/seed-demo', async (req, res) => {
  try {
    const { ContinuityTimeline, ContinuityCharacter, ContinuityBeat, ContinuityBeatCharacter } = getModels();

    const timeline = await ContinuityTimeline.findByPk(req.params.id);
    if (!timeline) return res.status(404).json({ success: false, error: 'Timeline not found' });

    // Characters
    const charData = [
      { character_key: 'frankie', name: 'Frankie', role: 'Protagonist',  color: '#a78bfa', sort_order: 0 },
      { character_key: 'sarah',   name: 'Sarah',   role: 'The Witness',  color: '#fb923c', sort_order: 1 },
      { character_key: 'jake',    name: 'Jake',    role: 'Supporting',   color: '#34d399', sort_order: 2 },
      { character_key: 'will',    name: 'Will',    role: 'The Fan',      color: '#60a5fa', sort_order: 3 },
      { character_key: 'marcus',  name: 'Marcus',  role: 'The Husband',  color: '#f472b6', sort_order: 4 },
    ];

    const chars = {};
    for (const cd of charData) {
      const [c] = await ContinuityCharacter.findOrCreate({
        where: { timeline_id: timeline.id, character_key: cd.character_key },
        defaults: { ...cd, timeline_id: timeline.id },
      });
      chars[cd.character_key] = c;
    }

    // Beats
    const beatData = [
      {
        beat_number: 1, name: "Frankie & Sarah at Mond's", location: "Mond's Café",
        time_tag: "Ep 03 · Evening · 7:00pm",
        note: "They arrive together. Low-key catch-up session.",
        chars: ['frankie', 'sarah'],
      },
      {
        beat_number: 2, name: "Jake meets Sarah — private talk", location: "Jake's Studio",
        time_tag: "Ep 03 · Evening · 7:15pm",
        note: "Sarah slips away to meet Jake — CONFLICT: Sarah is already at Mond's with Frankie at this time.",
        chars: ['sarah', 'jake'],
      },
      {
        beat_number: 3, name: "Will runs into Frankie", location: "Mond's Café",
        time_tag: "Ep 03 · Evening · 7:30pm",
        note: "Will the fan spots Frankie alone at Mond's.",
        chars: ['frankie', 'will'],
      },
      {
        beat_number: 4, name: "Marcus calls Frankie", location: "Phone / Home",
        time_tag: "Ep 03 · Night · 9:00pm",
        note: "Check-in call. Frankie is already home by this point.",
        chars: ['marcus', 'frankie'],
      },
    ];

    for (const bd of beatData) {
      const beat = await ContinuityBeat.create({
        timeline_id: timeline.id,
        beat_number: bd.beat_number,
        name: bd.name,
        location: bd.location,
        time_tag: bd.time_tag,
        note: bd.note,
        sort_order: bd.beat_number,
      });
      for (const ck of bd.chars) {
        await ContinuityBeatCharacter.create({ beat_id: beat.id, character_id: chars[ck].id });
      }
    }

    return res.json({ success: true, message: 'Demo data seeded', characters: Object.keys(chars).length, beats: beatData.length });
  } catch (err) {
    console.error('[ContinuityEngine] POST seed-demo error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
