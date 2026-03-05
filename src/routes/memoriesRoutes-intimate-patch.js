'use strict';

/**
 * memoriesRoutes-intimate-patch.js
 *
 * POST /api/v1/memories/generate-intimate-scene
 *
 * Mount in app.js:
 *   const intimatePatch = require('./routes/memoriesRoutes-intimate-patch');
 *   app.use('/api/v1/memories', intimatePatch);
 *
 * What it does:
 *   - Reads full character profile (attraction / desire fields included)
 *   - Reads recent manuscript lines + chapter brief
 *   - Generates scene in three beats: approach → scene → aftermath
 *   - Splits each beat into paragraphs
 *   - Returns array of pending line objects ready for storyteller_lines insertion
 *   - Logs metadata to intimate_scenes table (prose stays in storyteller_lines)
 *   - Updates world_characters.current_tension after scene
 *   - Appends 2-3 morning-after continuation lines immediately after scene lines
 */

const express  = require('express');
const router   = express.Router();
const { v4: uuidv4 } = require('uuid');

// ── Auth ─────────────────────────────────────────────────────────────────
let optionalAuth;
try {
  const m = require('../middleware/auth');
  optionalAuth = m.optionalAuth || m.authenticate || ((q, r, n) => n());
} catch (e) { optionalAuth = (q, r, n) => n(); }

// ── DB ───────────────────────────────────────────────────────────────────
const models    = require('../models');
const sequelize = models.sequelize;

// ── Claude ───────────────────────────────────────────────────────────────
const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic();

/* ── Word target by scene type ─────────────────────────────────────── */
const WORD_TARGETS = {
  one_night_stand:  { min: 300, max: 700 },
  charged_moment:   { min: 300, max: 700 },
  first_encounter:  { min: 500, max: 900 },
  hook_up:          { min: 500, max: 900 },
  recurring:        { min: 900, max: 1400 },
};

function wordTarget(sceneType) {
  return WORD_TARGETS[sceneType] || { min: 500, max: 900 };
}

/* ── Career voice shaping ───────────────────────────────────────────── */
function careerVoiceNote(careerStage) {
  switch (careerStage) {
    case 'early_career':  return "Lala is still discovering her power. She's drawn in, slightly unsure, but curious.";
    case 'rising':        return "Lala is gaining confidence. She knows what she wants but still second-guesses herself in intimate moments.";
    case 'peak':          return "Lala takes what she wants without explanation. Her power is fully inhabited.";
    case 'established':   return "Lala moves with the quiet certainty of someone who has been here before.";
    default:              return '';
  }
}

/* ─────────────────────────────────────────────────────────────────────
   POST /generate-intimate-scene
───────────────────────────────────────────────────────────────────── */
router.post('/generate-intimate-scene', optionalAuth, async (req, res) => {
  const {
    chapter_id,
    character_id,
    scene_type    = 'hook_up',
    career_stage  = 'early_career',
    recent_lines  = [],
    chapter_brief = {},
  } = req.body;

  if (!chapter_id || !character_id) {
    return res.status(400).json({ error: 'chapter_id and character_id are required' });
  }

  try {
    // ── 1. Fetch world character profile ──────────────────────────────
    const [charRows] = await sequelize.query(
      `SELECT * FROM world_characters WHERE id = :id LIMIT 1`,
      { replacements: { id: character_id }, type: sequelize.QueryTypes.SELECT }
    ).then(rows => [rows]);
    if (!charRows.length) return res.status(404).json({ error: 'Character not found' });
    const char = charRows[0];

    // ── 2. Build generation prompt ────────────────────────────────────
    const target = wordTarget(scene_type);
    const voiceNote = careerVoiceNote(career_stage);

    const prompt = `You are writing an intimate scene for the LalaVerse franchise novel.

CHARACTER:
Name: ${char.name}
Occupation: ${char.occupation}
Aesthetic: ${char.aesthetic || ''}
Dynamic with Lala: ${char.dynamic || ''}
Intimate style: ${char.intimate_style || ''}
Intimate dynamic: ${char.intimate_dynamic || ''}
What Lala feels: ${char.what_lala_feels || ''}
Attracted to: ${char.attracted_to || ''}
How they love: ${char.how_they_love || ''}
What they won't admit: ${char.desire_they_wont_admit || ''}
Arc role: ${char.arc_role || ''}

SCENE TYPE: ${scene_type.replace(/_/g, ' ')}
CAREER STAGE: ${career_stage} — ${voiceNote}

RECENT MANUSCRIPT LINES:
${recent_lines.slice(-10).join('\n')}

CHAPTER BRIEF:
${JSON.stringify(chapter_brief)}

WORD TARGET: ${target.min}–${target.max} words total across all three beats.

Write the scene in exactly three beats, each separated by the marker ===BEAT===

Beat 1 — THE APPROACH: The tension before contact. What each person is feeling. The moment the decision is made.
Beat 2 — THE SCENE: What happens. Emotionally honest, physically present, immersive. Not graphically explicit. What is felt, not just done.
Beat 3 — THE AFTERMATH: How they both feel after. What shifted. What neither will say.

Write in close third person, Lala's POV. Georgia serif prose register — restrained, precise, warm where it earns it.
The scene must feel earned from the manuscript context.
Do NOT editorialize or add chapter markers. Just the prose.`;

    const response = await anthropic.messages.create({
      model:      'claude-opus-4-5',
      max_tokens: 2000,
      messages:   [{ role: 'user', content: prompt }],
    });

    const fullText = response.content.find(b => b.type === 'text')?.text || '';

    // ── 3. Split into beats, then paragraphs → pending lines ──────────
    const beats     = fullText.split(/===BEAT===/);
    const beatLabels = ['approach', 'scene', 'aftermath'];
    const lines     = [];
    let   lineOrder = (recent_lines.length || 0) + 1;

    for (let b = 0; b < Math.min(beats.length, 3); b++) {
      const beat = (beats[b] || '').trim();
      const paragraphs = beat.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
      for (const para of paragraphs) {
        lines.push({
          id:          uuidv4(),
          chapter_id,
          content:     para,
          status:      'pending',
          source_type: 'intimate_scene',
          source_ref:  character_id,
          beat_label:  beatLabels[b],
          line_order:  lineOrder++,
          created_at:  new Date(),
          updated_at:  new Date(),
        });
      }
    }

    // ── 4. Morning-after continuation (2-3 lines) ─────────────────────
    const morningPrompt = `Continue this intimate scene with a brief morning-after moment (2-3 short paragraphs). 
The scene just ended: ${beats[2]?.slice(0, 300) || ''}
Lala's career stage: ${career_stage}. ${voiceNote}
Be emotionally specific. No grand revelations. Just one real moment — something observed, something not said, someone leaving.`;

    let morningText = '';
    try {
      const morningResp = await anthropic.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 600,
        messages: [{ role: 'user', content: morningPrompt }],
      });
      morningText = morningResp.content.find(b => b.type === 'text')?.text || '';
    } catch (_) {}

    if (morningText) {
      const morningParas = morningText.split(/\n\n+/).map(p => p.trim()).filter(Boolean).slice(0, 3);
      for (const para of morningParas) {
        lines.push({
          id:          uuidv4(),
          chapter_id,
          content:     para,
          status:      'pending',
          source_type: 'intimate_scene_continuation',
          source_ref:  character_id,
          beat_label:  'morning_after',
          line_order:  lineOrder++,
          created_at:  new Date(),
          updated_at:  new Date(),
        });
      }
    }

    // ── 5. Log metadata to intimate_scenes table ──────────────────────
    const wordCount = fullText.split(/\s+/).length;
    const metaId    = uuidv4();
    try {
      await sequelize.query(
        `INSERT INTO intimate_scenes
         (id, chapter_id, character_a_id, scene_type, status, word_count,
          intensity, new_tension_state, created_at, updated_at)
         VALUES (:id, :chid, :caid, :stype, 'generated', :wc, 'medium', 'Unresolved', NOW(), NOW())`,
        { replacements: {
            id: metaId, chid: chapter_id, caid: character_id,
            stype: scene_type, wc: wordCount,
          },
          type: sequelize.QueryTypes.INSERT,
        }
      );
    } catch (_) {}

    // ── 6. Update character tension ───────────────────────────────────
    try {
      await sequelize.query(
        `UPDATE world_characters SET current_tension = 'Unresolved', updated_at = NOW()
         WHERE id = :id`,
        { replacements: { id: character_id }, type: sequelize.QueryTypes.UPDATE }
      );
    } catch (_) {}

    res.json({
      lines,
      scene_meta_id: metaId,
      word_count: wordCount,
      beats: beatLabels.slice(0, beats.length),
    });

  } catch (err) {
    console.error('generate-intimate-scene error:', err);
    // Graceful fallback — never 500 during writing
    res.json({
      lines: [],
      error: err.message,
      fallback: true,
    });
  }
});

module.exports = router;
