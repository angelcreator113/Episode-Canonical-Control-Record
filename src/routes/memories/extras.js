'use strict';

const router = require('express').Router();

const Anthropic = require('@anthropic-ai/sdk');
const { v4: uuidv4 } = require('uuid');

let optionalAuth;
try {
  const authModule = require('../../middleware/auth');
  optionalAuth = authModule.optionalAuth || authModule.authenticate || ((req, res, next) => next());
} catch (e) {
  optionalAuth = (req, res, next) => next();
}

const db = require('../../models');
const { StorytellerMemory, StorytellerLine, StorytellerBook, StorytellerChapter, RegistryCharacter } = db;
const { buildUniverseContext } = require('../../utils/universeContext');

require('dotenv').config({ override: !process.env.ANTHROPIC_API_KEY });
const anthropic = new Anthropic();

// ─── Prose style anchor cache ────────────────────────────────────────────────
// Stores author's prose sample per world/universe for voice matching
const seProseStyleCache = new Map();

// ─── POST /prose-style-anchor ────────────────────────────────────────────────
// Save a prose style sample for a character/world to guide story voice matching.
router.post('/prose-style-anchor', optionalAuth, async (req, res) => {
  const { characterKey, proseSample } = req.body;

  if (!characterKey || !proseSample?.trim()) {
    return res.status(400).json({ error: 'characterKey and proseSample required' });
  }

  try {
    // Upsert — find existing or create new
    const existing = await StorytellerMemory.findOne({
      where: { type: 'prose_style_anchor', source_ref: characterKey },
    });

    if (existing) {
      existing.statement = proseSample.trim();
      await existing.save();
    } else {
      await StorytellerMemory.create({
        type: 'prose_style_anchor',
        statement: proseSample.trim(),
        confidence: 1.0,
        confirmed: true,
        protected: true,
        source_ref: characterKey,
        source_type: 'manual',
        tags: JSON.stringify(['prose_style']),
      });
    }

    // Clear cache so next story uses the new sample
    seProseStyleCache.delete(`prose_${characterKey}`);

    return res.json({ success: true, message: 'Prose style anchor saved.' });
  } catch (err) {
    console.error('[prose-style-anchor] error:', err?.message);
    return res.status(500).json({ error: 'Failed to save prose style anchor.' });
  }
});

// ─── GET /prose-style-anchor/:characterKey ───────────────────────────────────
router.get('/prose-style-anchor/:characterKey', optionalAuth, async (req, res) => {
  try {
    const anchor = await StorytellerMemory.findOne({
      where: { type: 'prose_style_anchor', source_ref: req.params.characterKey },
    });
    return res.json({ success: true, prose_sample: anchor?.statement || null });
  } catch (err) {
    return res.json({ success: false, prose_sample: null });
  }
});

// ─── GET /dramatic-irony/:characterKey ───────────────────────────────────────
// Get all dramatic irony, open mysteries, and foreshadowing seeds for a character.
router.get('/dramatic-irony/:characterKey', optionalAuth, async (req, res) => {
  try {
    const { characterKey } = req.params;
    const items = await StorytellerMemory.findAll({
      where: {
        source_ref: characterKey,
        type: ['dramatic_irony', 'open_mystery', 'foreshadow_seed'],
      },
      order: [['created_at', 'DESC']],
      limit: 50,
    });

    const irony = items.filter(i => i.type === 'dramatic_irony');
    const mysteries = items.filter(i => i.type === 'open_mystery');
    const seeds = items.filter(i => i.type === 'foreshadow_seed');

    return res.json({
      success: true,
      dramatic_irony: irony.map(i => ({ id: i.id, statement: i.statement, from_story: i.category, confirmed: i.confirmed })),
      open_mysteries: mysteries.map(m => ({ id: m.id, question: m.statement, planted_story: m.category, confirmed: m.confirmed })),
      foreshadow_seeds: seeds.map(s => ({ id: s.id, detail: s.statement, from_story: s.category, confirmed: s.confirmed })),
    });
  } catch (err) {
    console.error('[dramatic-irony] error:', err?.message);
    return res.json({ success: false, dramatic_irony: [], open_mysteries: [], foreshadow_seeds: [] });
  }
});

// ─── POST /dramatic-irony/resolve ────────────────────────────────────────────
// Mark a mystery as resolved or a foreshadowing seed as paid off.
router.post('/dramatic-irony/resolve', optionalAuth, async (req, res) => {
  const { memoryId, resolvedInStory, resolutionNote } = req.body;

  if (!memoryId) {
    return res.status(400).json({ error: 'memoryId required' });
  }

  try {
    const item = await StorytellerMemory.findByPk(memoryId);
    if (!item) return res.status(404).json({ error: 'Not found' });

    // Mark as resolved by updating the statement and unconfirming so it drops out of active feed
    item.confirmed = false;
    item.statement = `[RESOLVED in story ${resolvedInStory || '?'}] ${item.statement}${resolutionNote ? ` — ${resolutionNote}` : ''}`;
    await item.save();

    return res.json({ success: true, message: 'Marked as resolved.' });
  } catch (err) {
    console.error('[dramatic-irony/resolve] error:', err?.message);
    return res.status(500).json({ error: 'Failed to resolve.' });
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   POST /generate-intimate-scene
   Generates intimate scene in three beats (approach → scene → aftermath)
   + morning-after continuation. Logs to intimate_scenes, updates tension.
   Migrated from memoriesRoutes-intimate-patch.js
═══════════════════════════════════════════════════════════════════════════ */

const INTIMATE_WORD_TARGETS = {
  one_night_stand:  { min: 300, max: 700 },
  charged_moment:   { min: 300, max: 700 },
  first_encounter:  { min: 500, max: 900 },
  hook_up:          { min: 500, max: 900 },
  recurring:        { min: 900, max: 1400 },
};

function intimateWordTarget(sceneType) {
  return INTIMATE_WORD_TARGETS[sceneType] || { min: 500, max: 900 };
}

function intimateCareerVoiceNote(careerStage) {
  switch (careerStage) {
    case 'early_career':  return "Lala is still discovering her power. She's drawn in, slightly unsure, but curious.";
    case 'rising':        return "Lala is gaining confidence. She knows what she wants but still second-guesses herself in intimate moments.";
    case 'peak':          return "Lala takes what she wants without explanation. Her power is fully inhabited.";
    case 'established':   return "Lala moves with the quiet certainty of someone who has been here before.";
    default:              return '';
  }
}

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

  const sequelize = db.sequelize;

  try {
    // 1. Fetch world character profile
    const [charRows] = await sequelize.query(
      `SELECT * FROM world_characters WHERE id = :id LIMIT 1`,
      { replacements: { id: character_id }, type: sequelize.QueryTypes.SELECT }
    ).then(rows => [rows]);
    if (!charRows.length) return res.status(404).json({ error: 'Character not found' });
    const char = charRows[0];

    // 2. Build generation prompt
    const target = intimateWordTarget(scene_type);
    const voiceNote = intimateCareerVoiceNote(career_stage);

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

    const MODELS = ['claude-sonnet-4-6'];
    let fullText = '';
    for (const model of MODELS) {
      try {
        const response = await anthropic.messages.create({
          model,
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        });
        fullText = response.content.find(b => b.type === 'text')?.text || '';
        break;
      } catch (err) {
        console.error(`[intimate-scene] model ${model} failed:`, err?.message);
      }
    }

    // 3. Split into beats, then paragraphs → pending lines
    const beats      = fullText.split(/===BEAT===/);
    const beatLabels = ['approach', 'scene', 'aftermath'];
    const lines      = [];
    let   lineOrder  = (recent_lines.length || 0) + 1;

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

    // 4. Morning-after continuation (2-3 lines)
    const morningPrompt = `Continue this intimate scene with a brief morning-after moment (2-3 short paragraphs).
The scene just ended: ${beats[2]?.slice(0, 300) || ''}
Lala's career stage: ${career_stage}. ${voiceNote}
Be emotionally specific. No grand revelations. Just one real moment — something observed, something not said, someone leaving.`;

    let morningText = '';
    try {
      const morningResp = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        messages: [{ role: 'user', content: morningPrompt }],
      });
      morningText = morningResp.content.find(b => b.type === 'text')?.text || '';
    } catch (err) { console.warn('[intimate-scene] morning-after generation error:', err?.message); }

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

    // 5. Log metadata to intimate_scenes table
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
    } catch (err) { console.warn('[intimate-scene] intimate_scenes insert error:', err?.message); }

    // 6. Update character tension
    try {
      await sequelize.query(
        `UPDATE world_characters SET current_tension = 'Unresolved', updated_at = NOW()
         WHERE id = :id`,
        { replacements: { id: character_id }, type: sequelize.QueryTypes.UPDATE }
      );
    } catch (err) { console.warn('[intimate-scene] tension update error:', err?.message); }

    res.json({
      lines,
      scene_meta_id: metaId,
      word_count: wordCount,
      beats: beatLabels.slice(0, beats.length),
    });

  } catch (err) {
    console.error('generate-intimate-scene error:', err);
    res.json({
      lines: [],
      error: err.message,
      fallback: true,
    });
  }
});

// ════════════════════════════════════════════════════════════════════════
// POST /ai/enhance-prompt
// Enhance a user's object description into a more detailed, effective prompt
// Used by Scene Studio GenerateTab for DALL-E object generation
// ════════════════════════════════════════════════════════════════════════

router.post('/ai/enhance-prompt', optionalAuth, async (req, res) => {
  try {
    const { prompt, context = 'scene_studio_object' } = req.body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ success: false, error: 'prompt is required' });
    }

    // Context-specific enhancement instructions
    const contextInstructions = {
      scene_studio_object: `You are enhancing object descriptions for AI image generation (DALL-E 3).
The style is "Pinterest-core femininity, Final Fantasy softness, magical realism" for a luxury aesthetic.

Rules:
- Keep it under 50 words
- Add specific materials (velvet, silk, crystal, gold, marble)
- Add specific style details (ornate, art deco, rococo, mid-century)
- Include color palette hints (warm neutrals, blush, champagne, rose gold)
- Do NOT add background or room context — objects must be isolated
- Do NOT add people or characters
- Return ONLY the enhanced prompt, no explanation`,
    };

    const systemPrompt = contextInstructions[context] || contextInstructions.scene_studio_object;

    const MODELS = ['claude-sonnet-4-6'];
    let enhanced = null;

    for (const model of MODELS) {
      try {
        const aiResponse = await anthropic.messages.create({
          model,
          max_tokens: 150,
          system: systemPrompt,
          messages: [
            { role: 'user', content: `Enhance this object description: "${prompt.trim()}"` },
          ],
        });

        enhanced = aiResponse.content?.[0]?.text?.trim();
        if (enhanced) break;
      } catch (err) {
        console.warn(`[enhance-prompt] ${model} failed:`, err.message);
      }
    }

    if (!enhanced) {
      // Fallback: return original prompt
      return res.json({ success: true, enhanced: prompt.trim(), fallback: true });
    }

    res.json({ success: true, enhanced });
  } catch (err) {
    console.error('[enhance-prompt] error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
