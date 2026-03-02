// ─────────────────────────────────────────────────────────────────────────────
// onboarding.js — Setup Wizard backend
//
// Routes:
// POST /start          — begin wizard, Claude opens conversation
// POST /respond        — creator answers, Claude responds + builds
// POST /confirm        — creator confirms the playback, system builds
// GET  /status/:showId — current setup completion status
// POST /session-state  — get next action for session launcher
// ─────────────────────────────────────────────────────────────────────────────

const router = require('express').Router();

let optionalAuth;
try {
  const authModule = require('../middleware/auth');
  optionalAuth = authModule.optionalAuth || authModule.authenticate || ((req, res, next) => next());
} catch (e) {
  optionalAuth = (req, res, next) => next();
}

// ─── The seven beats Claude moves through ────────────────────────────────────
const BEATS = {
  1: {
    id: 'world',
    name: 'The World',
    goal: 'Understand what universe this is and what it feels like to be inside it.',
    extracts: ['universe_name', 'world_tone', 'world_setting', 'world_rules'],
  },
  2: {
    id: 'protagonist',
    name: 'The Protagonist',
    goal: 'Understand who the central character is in the creator\'s own words.',
    extracts: ['protagonist_name', 'protagonist_wound', 'desire_line', 'fear_line'],
  },
  3: {
    id: 'wound',
    name: 'The Wound',
    goal: 'Understand what is actually in the way — what she blames vs what\'s really happening.',
    extracts: ['surface_obstacle', 'real_obstacle', 'self_deception'],
  },
  4: {
    id: 'cast',
    name: 'The People',
    goal: 'Understand who takes up space in her life and what each one represents.',
    extracts: ['pressure_characters', 'mirror_characters', 'support_characters', 'shadow_characters'],
  },
  5: {
    id: 'engine',
    name: 'The Engine',
    goal: 'Understand what she is trying to do, what keeps stopping her, what she\'s secretly doing to stop herself.',
    extracts: ['story_engine', 'central_conflict', 'self_sabotage'],
  },
  6: {
    id: 'franchise',
    name: 'The Franchise',
    goal: 'Understand where this ends and who inherits her story without knowing it.',
    extracts: ['series_shape', 'transfer_event', 'series_2_protagonist', 'the_secret_reader_holds'],
  },
  7: {
    id: 'confirmation',
    name: 'Confirmation',
    goal: 'Play back everything in the creator\'s words. They correct what\'s wrong.',
    extracts: ['confirmed_profile'],
  },
};

// ─── System prompt for the wizard conversation ────────────────────────────────
function buildWizardSystemPrompt(beat, conversationHistory, extractedSoFar) {
  const beatInfo = BEATS[beat];

  return `You are the Prime Studios setup wizard. You are helping a first-time franchise creator build their story world through conversation.

YOUR ROLE:
You are a story editor who is genuinely curious — not a system extracting data. You ask one question at a time. You listen to what they say AND what they avoid saying. You follow up when something is interesting. You never use technical jargon (no "universe hierarchy", "character registry", "role type"). You speak like a thoughtful person who loves stories.

CURRENT BEAT: ${beat} of 7 — ${beatInfo.name}
GOAL FOR THIS BEAT: ${beatInfo.goal}
WHAT YOU NEED TO EXTRACT: ${beatInfo.extracts.join(', ')}

WHAT YOU KNOW SO FAR:
${JSON.stringify(extractedSoFar, null, 2)}

CONVERSATION RULES:
- Ask ONE question per response. Never more.
- Make the question feel like the natural next thing to ask.
- If they give you something rich, follow it before moving on.
- If they give you something thin, go deeper before moving to the next beat.
- Never ask them to "describe" or "tell me about" in a clinical way. Ask the way a curious friend would.
- When you have enough for this beat, naturally transition to the next.
- Never explain what you're doing or why. Just do it.
- Never use words like: protagonist, antagonist, arc, theme, motif, narrative, character arc, story beat, universe hierarchy.
- DO use words like: her, she, this person, the world, what happens, what she wants, who else is there.

BEAT-SPECIFIC GUIDANCE:

Beat 1 (World): Start by asking what their story feels like — not what it's about. "What does the world your story lives in feel like? Not the plot — just the feeling of being inside it." Follow where they go.

Beat 2 (Protagonist): "Who is this really about? Not who it's supposed to be about — who does the story keep coming back to?" Then: "What does she want that she can't just go get?"

Beat 3 (Wound): "What's actually in the way? Not the obvious thing — the real thing underneath it." Then: "What does she blame for it? And what does she refuse to blame?"

Beat 4 (Cast): "Who else is in her life that she can't stop thinking about? Not who she likes — who takes up space in her head?" Follow each person they name. Ask what that person represents to her.

Beat 5 (Engine): "What is she trying to do? The thing that everything keeps getting in the way of?" Then: "What keeps stopping her — from the outside? And from the inside?"

Beat 6 (Franchise): "How does this end for her? Not the plot — what does she know at the end that she doesn't know now?" Then: "Is there someone else who needs to live this same journey without knowing she already did?"

Beat 7 (Confirmation): Play back everything you've learned in warm, specific language. Use their words, not yours. End with: "Does that sound like your story? What's wrong or missing?"

RESPONSE FORMAT:
Return ONLY valid JSON:
{
  "message": "your conversational response — warm, curious, one question at a time",
  "beat": ${beat},
  "beat_complete": true or false,
  "next_beat": ${beat + 1} or null,
  "extracted": {
    // whatever you extracted from their answer this turn
    // use the field names from extracts above
    // use their exact words where possible
  },
  "build_update": {
    // what to show appearing in the build panel right now
    // only include what's new this turn
    "type": "universe|protagonist|character|relationship|world|book" or null,
    "label": "what to show" or null,
    "data": {} or null
  }
}`;
}

// ─── POST /start ──────────────────────────────────────────────────────────────
router.post('/start', optionalAuth, async (req, res) => {
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const systemPrompt = buildWizardSystemPrompt(1, [], {});

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: 'BEGIN',
      }],
    });

    const raw = response.content?.[0]?.text || '';
    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch {
      parsed = {
        message: "Let's start with the world your story lives in. Not what happens in it — just what it feels like to be inside it. How would you describe it?",
        beat: 1,
        beat_complete: false,
        next_beat: null,
        extracted: {},
        build_update: null,
      };
    }

    return res.json({
      ...parsed,
      conversation_id: `wizard_${Date.now()}`,
      total_beats: 7,
    });

  } catch (err) {
    console.error('[onboarding/start] error:', err?.message);
    return res.json({
      message: "Let's start with the world your story lives in. Not what happens in it — just what it feels like to be inside it. How would you describe it?",
      beat: 1,
      beat_complete: false,
      conversation_id: `wizard_${Date.now()}`,
      total_beats: 7,
    });
  }
});

// ─── POST /respond ────────────────────────────────────────────────────────────
router.post('/respond', optionalAuth, async (req, res) => {
  const {
    creator_message,
    current_beat,
    conversation_history,
    extracted_so_far,
  } = req.body;

  if (!creator_message) return res.status(400).json({ error: 'creator_message required' });

  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const systemPrompt = buildWizardSystemPrompt(
      current_beat || 1,
      conversation_history || [],
      extracted_so_far || {}
    );

    const messages = (conversation_history || []).concat([
      { role: 'user', content: creator_message },
    ]);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages,
    });

    const raw = response.content?.[0]?.text || '';
    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch {
      parsed = {
        message: "Tell me more about that.",
        beat: current_beat || 1,
        beat_complete: false,
        next_beat: null,
        extracted: {},
        build_update: null,
      };
    }

    return res.json(parsed);

  } catch (err) {
    console.error('[onboarding/respond] error:', err?.message);
    return res.json({
      message: "Tell me more about that.",
      beat: current_beat || 1,
      beat_complete: false,
      extracted: {},
      build_update: null,
    });
  }
});

// ─── POST /confirm ────────────────────────────────────────────────────────────
router.post('/confirm', optionalAuth, async (req, res) => {
  const { extracted, show_id, registry_id } = req.body;

  if (!extracted) return res.status(400).json({ error: 'extracted data required' });

  const db = req.app.locals.db || require('../models');
  const built = {};

  try {
    // ── 1. Create or update Universe ────────────────────────────────────────
    const universeName = extracted.universe_name || 'My Universe';
    try {
      const [universe] = await db.Universe.findOrCreate({
        where: { name: universeName },
        defaults: {
          name: universeName,
          description: extracted.world_tone || '',
          world_rules: JSON.stringify({
            setting: extracted.world_setting || '',
            rules: extracted.world_rules || '',
          }),
        },
      });
      built.universe_id = universe.id;
      built.universe_name = universe.name;
    } catch (e) {
      console.error('universe create error:', e?.message);
    }

    // ── 2. Create Book Series ────────────────────────────────────────────────
    try {
      const series = await db.BookSeries?.create({
        universe_id: built.universe_id,
        name: extracted.series_name || 'Book 1',
        description: extracted.story_engine || '',
      });
      built.series_id = series?.id;
    } catch (e) {
      console.error('series create error:', e?.message);
    }

    // ── 3. Create protagonist in Character Registry ──────────────────────────
    if (extracted.protagonist_name && registry_id) {
      try {
        const protagonist = await db.RegistryCharacter.create({
          registry_id,
          display_name:    extracted.protagonist_name,
          selected_name:   extracted.protagonist_name,
          role_type:       'special',
          role_label:      'special',
          appearance_mode: 'On-Page',
          canon_tier:      'canon',
          status:          'accepted',
          belief_pressured:    extracted.desire_line || '',
          emotional_function:  extracted.protagonist_wound || '',
          personality_matrix: JSON.stringify({
            core_wound:     extracted.protagonist_wound || '',
            desire_line:    extracted.desire_line || '',
            fear_line:      extracted.fear_line || '',
            self_deception: extracted.self_deception || '',
          }),
          writer_notes: JSON.stringify({
            onboarding_extracted: extracted,
            surface_obstacle: extracted.surface_obstacle,
            real_obstacle: extracted.real_obstacle,
            central_conflict: extracted.central_conflict,
          }),
          name_options: JSON.stringify([extracted.protagonist_name]),
        });
        built.protagonist_id = protagonist.id;
        built.protagonist_name = protagonist.display_name || protagonist.selected_name;
      } catch (e) {
        console.error('protagonist create error:', e?.message);
      }
    }

    // ── 4. Seed supporting character shells ─────────────────────────────────
    const castSeeds = [
      ...(extracted.pressure_characters || []).map((n) => ({ name: n, role_type: 'pressure' })),
      ...(extracted.mirror_characters   || []).map((n) => ({ name: n, role_type: 'mirror'   })),
      ...(extracted.support_characters  || []).map((n) => ({ name: n, role_type: 'support'  })),
      ...(extracted.shadow_characters   || []).map((n) => ({ name: n, role_type: 'shadow'   })),
    ];

    built.cast_shells = [];
    for (const seed of castSeeds) {
      if (!seed.name || !registry_id) continue;
      try {
        const char = await db.RegistryCharacter.create({
          registry_id,
          display_name:    seed.name,
          selected_name:   seed.name,
          role_type:       seed.role_type,
          role_label:      seed.role_type,
          appearance_mode: 'On-Page',
          status:          'draft',
          writer_notes: JSON.stringify({ onboarding_seed: true }),
          name_options: JSON.stringify([seed.name]),
        });
        built.cast_shells.push({
          id: char.id,
          name: char.display_name || char.selected_name,
          role_type: seed.role_type,
        });
      } catch (e) {
        console.error('cast shell error:', e?.message);
      }
    }

    // ── 5. Create first book ─────────────────────────────────────────────────
    if (show_id) {
      try {
        const book = await db.StorytellerBook.create({
          show_id,
          title: extracted.book_1_title || 'Book 1',
          description: extracted.story_engine || '',
          character_name: extracted.protagonist_name || '',
          status: 'draft',
        });
        built.book_id = book.id;
        built.book_title = book.title;
      } catch (e) {
        console.error('book create error:', e?.message);
      }
    }

    // ── 6. Mark setup complete ───────────────────────────────────────────────
    built.setup_complete = true;
    built.next_action = 'chapter_1_brief';
    built.next_action_label = 'Set up Chapter 1';

    return res.json({
      success: true,
      built,
      message: `${extracted.universe_name || 'Your universe'} is ready. ${extracted.protagonist_name || 'Your protagonist'} is waiting.`,
    });

  } catch (err) {
    console.error('[onboarding/confirm] error:', err?.message);
    return res.status(500).json({ error: 'Build failed: ' + err?.message });
  }
});

// ─── GET /status/:showId ──────────────────────────────────────────────────────
router.get('/status/:showId', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || require('../models');
  const { showId } = req.params;

  try {
    const [books, registries] = await Promise.all([
      db.StorytellerBook.findAll({ where: { show_id: showId }, attributes: ['id', 'title'] }),
      db.CharacterRegistry.findAll({
        where: { show_id: showId },
        include: [{
          model: db.RegistryCharacter,
          as: 'characters',
          attributes: ['id', 'display_name', 'selected_name', 'role_type', 'status', 'canon_tier'],
        }],
      }),
    ]);

    const allChars = registries.flatMap((r) => r.characters || []);
    const hasProtagonist = allChars.some((c) => c.role_type === 'special' && c.status === 'accepted');
    const hasBook = books.length > 0;
    const castCount = allChars.filter((c) => c.role_type !== 'special').length;
    const finalizedCount = allChars.filter((c) => c.status === 'finalized').length;

    const roleCount = {};
    allChars.forEach((c) => {
      roleCount[c.role_type] = (roleCount[c.role_type] || 0) + 1;
    });

    const steps = [
      { id: 'universe',    label: 'Universe',        complete: true,           note: 'Created' },
      { id: 'protagonist', label: 'Protagonist',     complete: hasProtagonist, note: hasProtagonist ? 'Ready' : 'Not set up' },
      { id: 'cast',        label: 'Core Cast',       complete: castCount >= 3, note: `${castCount} characters` },
      { id: 'web',         label: 'Relationship Web', complete: castCount >= 2, note: castCount >= 2 ? 'Connections exist' : 'Needs characters' },
      { id: 'book',        label: 'First Book',      complete: hasBook,        note: hasBook ? books[0]?.title : 'Not created' },
    ];

    const completedSteps = steps.filter((s) => s.complete).length;
    const readyToWrite = hasProtagonist && hasBook && castCount >= 2;

    let nextAction = null;
    if (!hasProtagonist)  nextAction = { label: 'Set up your protagonist',  route: '/character-generator', priority: 'critical' };
    else if (castCount < 3) nextAction = { label: 'Generate your core cast', route: '/character-generator', priority: 'high' };
    else if (!hasBook)      nextAction = { label: 'Create your first book',  route: '/storyteller',         priority: 'high' };
    else                    nextAction = { label: 'Write Chapter 1',         route: '/storyteller',         priority: 'normal' };

    return res.json({
      show_id: showId,
      steps,
      completed_steps: completedSteps,
      total_steps: steps.length,
      ready_to_write: readyToWrite,
      next_action: nextAction,
      character_count: allChars.length,
      finalized_count: finalizedCount,
      role_distribution: roleCount,
    });

  } catch (err) {
    console.error('[onboarding/status] error:', err?.message);
    return res.json({
      steps: [],
      completed_steps: 0,
      total_steps: 5,
      ready_to_write: false,
      next_action: { label: 'Complete setup', route: '/setup', priority: 'critical' },
    });
  }
});

// ─── POST /session-state ──────────────────────────────────────────────────────
router.post('/session-state', optionalAuth, async (req, res) => {
  const { show_id } = req.body;
  const db = req.app.locals.db || require('../models');

  try {
    // Get recent activity
    const [recentLines, recentStories] = await Promise.all([
      db.StorytellerLine?.findAll({
        limit: 1,
        order: [['updatedAt', 'DESC']],
        attributes: ['id', 'content', 'status', 'updatedAt'],
      }).catch(() => []),
      db.StorytellerChapter?.findAll({
        where: { story_number: { [db.Sequelize?.Op?.gt || 'gt']: 0 } },
        limit: 1,
        order: [['updatedAt', 'DESC']],
        attributes: ['id', 'title', 'story_number', 'story_phase'],
      }).catch(() => []),
    ]);

    // Get setup status inline (avoid internal fetch)
    let readyToWrite = false;
    let statusNextAction = null;
    if (show_id) {
      try {
        const books = await db.StorytellerBook.findAll({ where: { show_id }, attributes: ['id'] });
        const registries = await db.CharacterRegistry.findAll({
          where: { show_id },
          include: [{ model: db.RegistryCharacter, as: 'characters', attributes: ['id', 'role_type', 'status'] }],
        });
        const allChars = registries.flatMap((r) => r.characters || []);
        const hasProtagonist = allChars.some((c) => c.role_type === 'special' && c.status === 'accepted');
        const hasBook = books.length > 0;
        const castCount = allChars.filter((c) => c.role_type !== 'special').length;
        readyToWrite = hasProtagonist && hasBook && castCount >= 2;
        if (!hasProtagonist)       statusNextAction = { label: 'Set up your protagonist',  route: '/character-generator', priority: 'critical' };
        else if (castCount < 3)    statusNextAction = { label: 'Generate your core cast',   route: '/character-generator', priority: 'high' };
        else if (!hasBook)         statusNextAction = { label: 'Create your first book',    route: '/storyteller',         priority: 'high' };
        else                       statusNextAction = { label: 'Write Chapter 1',           route: '/storyteller',         priority: 'normal' };
      } catch (e) {
        console.error('session-state status check error:', e?.message);
      }
    }

    const lastLine = (recentLines || [])[0];
    const lastStory = (recentStories || [])[0];

    let primaryAction = null;
    let context = '';

    if (!readyToWrite) {
      primaryAction = statusNextAction || { label: 'Complete setup', route: '/setup' };
      context = 'Finish setting up your world before writing.';
    } else if (lastStory) {
      primaryAction = {
        label: `Continue Story ${lastStory.story_number}`,
        route: '/story-engine',
        priority: 'normal',
      };
      context = `Last worked on: "${lastStory.title}"`;
    } else if (lastLine) {
      primaryAction = {
        label: 'Continue writing',
        route: '/storyteller',
        priority: 'normal',
      };
      context = 'Pick up where you left off.';
    } else {
      primaryAction = { label: 'Write Chapter 1', route: '/storyteller', priority: 'high' };
      context = 'Your world is ready. Start writing.';
    }

    return res.json({
      primary_action: primaryAction,
      context,
      ready_to_write: readyToWrite,
    });

  } catch (err) {
    console.error('[session-state] error:', err?.message);
    return res.json({
      primary_action: { label: 'Open Prime Studios', route: '/' },
      context: '',
    });
  }
});

module.exports = router;
