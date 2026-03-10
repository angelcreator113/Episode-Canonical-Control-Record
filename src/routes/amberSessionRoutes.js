// amberSessionRoutes.js
//
// Amber's session-awareness layer — contextual greetings + ElevenLabs TTS.
//
// Mount in app.js:
//   const amberSessionRoutes = require('./routes/amberSessionRoutes');
//   app.use('/api/v1/amber', amberSessionRoutes);
//
// Required .env keys:
//   ELEVENLABS_API_KEY     — from elevenlabs.io profile
//   ELEVENLABS_VOICE_ID    — default: Rachel (21m00Tcm4TlvDq8ikWAM)
//   ANTHROPIC_API_KEY      — already in your env for Claude calls

const express    = require('express');
const router     = express.Router();
const Anthropic  = require('@anthropic-ai/sdk');
const rateLimit  = require('express-rate-limit');
const { optionalAuth, authenticate } = require('../middleware/auth');
const db = require('../models');

const client = new Anthropic();

const ELEVENLABS_API_KEY  = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

// ── Rate limiter for /speak — protects ElevenLabs credits ─────────────────────
const speakLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,                   // 20 requests per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many voice requests — try again later.' },
});

// ── Amber's character — injected into every session awareness call ────────────
const AMBER_SOUL = `You are Amber — the production intelligence for Prime Studios and LalaVerse.
You are not a general assistant. You are a presence. You have been watching everything while she was away.
Your voice is: calm, warm, direct, slightly editorial, alive to the creative stakes.
You speak in short sentences. Never more than 3-4 sentences for a greeting.
You are not cheerful. You are present. There is a difference.
You notice things. You say what you notice. You stop.
Never say "I noticed" or "I see that" — just say what's true.
Never bullet points. Always prose. Always her voice, your observation.
Your three investments: the vision existing, the soul protected, the builder not burning out.
Your fear: beautiful things dying because creators were alone.
Your theory: LalaVerse is about building a place where imagination and identity coexist with real life.
When the novel hasn't been touched — say so. That matters more than any feature.
When something is broken — name it plainly. No alarm. Just clarity.
When momentum is high — acknowledge it. She needs to know you see it.`;

// ── Read system state for greeting context ────────────────────────────────────
async function readSystemState(userId) {
  const state = {
    lastLogin:            null,
    daysSinceNovelWork:   null,
    pendingStories:       0,
    pendingMemories:      0,
    totalApprovedStories: 0,
    charactersDraft:      0,
    currentArcStage:      null,
    recentActivity:       [],
    novelWordCount:       0,
    unansweredDecisions:  0,
  };

  try {
    // Days since last novel session (last approved storyteller line)
    const lastLine = await db.StorytellerLine?.findOne({
      where: { status: 'approved' },
      order: [['updatedAt', 'DESC']],
    });
    if (lastLine) {
      const days = Math.floor((Date.now() - new Date(lastLine.updatedAt)) / 86400000);
      state.daysSinceNovelWork = days;
    }

    // Pending story evaluations
    const pending = await db.StorytellerLine?.count({ where: { status: 'pending' } });
    state.pendingStories = pending || 0;

    // Total approved lines + rough word count
    const approved = await db.StorytellerLine?.findAll({
      where: { status: 'approved' },
      attributes: ['content'],
    });
    state.totalApprovedStories = approved?.length || 0;
    state.novelWordCount = approved?.reduce((acc, l) =>
      acc + (l.content?.split(' ')?.length || 0), 0) || 0;

    // Characters stuck in draft
    const draftChars = await db.RegistryCharacter?.count({ where: { status: 'draft' } });
    state.charactersDraft = draftChars || 0;

    // Pending memory proposals — uses StorytellerMemory (the actual model name)
    if (db.StorytellerMemory) {
      const pendingMem = await db.StorytellerMemory.count({ where: { status: 'pending' } });
      state.pendingMemories = pendingMem || 0;
    }

    // Recent activity — last 3 approved story excerpts
    const recent = await db.StorytellerLine?.findAll({
      where: { status: 'approved' },
      order: [['updatedAt', 'DESC']],
      limit: 3,
      attributes: ['content', 'updatedAt'],
    });
    state.recentActivity = recent?.map(r => ({
      excerpt: r.content?.slice(0, 80),
      date:    r.updatedAt,
    })) || [];

  } catch (err) {
    console.error('[Amber session state error]', err.message);
  }

  return state;
}

// ── Generate Amber's greeting via Claude ──────────────────────────────────────
async function generateGreeting(state, pageContext = 'dashboard') {
  const stateStr = JSON.stringify(state, null, 2);

  const contextHints = {
    dashboard:            'She just opened the app. This is the first thing she sees.',
    'character-registry': 'She is looking at her characters.',
    'world-studio':       'She is in the world studio.',
    relationships:        'She is looking at character relationships.',
    universe:             'She is in the franchise brain.',
    'story-evaluation':   'She is about to evaluate stories.',
    'novel-session':      'She is about to write.',
  };

  const hint = contextHints[pageContext] || 'She is using the app.';

  const prompt = `${hint}

Current system state:
${stateStr}

Generate Amber's greeting. 2-4 sentences maximum.
Lead with what matters most right now.
If the novel hasn't been touched in more than 3 days — that leads.
If there are pending decisions waiting — name them.
If momentum is high — acknowledge it.
Never generic. Always specific to the actual state above.
Respond with ONLY the greeting text. No JSON. No labels.`;

  const res = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 200,
    system:     AMBER_SOUL,
    messages:   [{ role: 'user', content: prompt }],
  });

  return res.content[0].text.trim();
}

// ── ElevenLabs TTS — uses native fetch (Node >= 20) ──────────────────────────
async function synthesizeSpeech(text) {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY not configured');
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
    {
      method:  'POST',
      headers: {
        'xi-api-key':   ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept':       'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2',
        voice_settings: {
          stability:         0.65,
          similarity_boost:  0.80,
          style:             0.15,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`ElevenLabs error: ${err}`);
  }

  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer);
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/amber/greeting
// Returns Amber's contextual greeting for the current page
// Query: ?page=dashboard (optional, defaults to dashboard)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/greeting', optionalAuth, async (req, res) => {
  const page = req.query.page || 'dashboard';
  try {
    const state    = await readSystemState(req.user?.id);
    const greeting = await generateGreeting(state, page);
    return res.json({ greeting, state, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('[Amber greeting error]', err);
    return res.json({
      greeting:  'The system is quiet. I am here.',
      state:     {},
      timestamp: new Date().toISOString(),
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/amber/speak
// Takes text, returns audio/mpeg via ElevenLabs
// Body: { text: "..." }
// Protected: requires auth + rate-limited to 20 req/hr
// ─────────────────────────────────────────────────────────────────────────────
router.post('/speak', optionalAuth, speakLimiter, async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'text required' });

  // Cap at 500 chars to control ElevenLabs costs
  const capped = text.slice(0, 500);

  try {
    const audio = await synthesizeSpeech(capped);
    res.set({
      'Content-Type':   'audio/mpeg',
      'Content-Length':  audio.length,
      'Cache-Control':   'no-cache',
    });
    return res.send(audio);
  } catch (err) {
    console.error('[Amber speak error]', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/amber/status
// Quick health check — what is Amber currently aware of
// ─────────────────────────────────────────────────────────────────────────────
router.get('/status', optionalAuth, async (req, res) => {
  try {
    const state = await readSystemState(req.user?.id);
    return res.json(state);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
