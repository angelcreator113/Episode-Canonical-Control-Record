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
const { optionalAuth } = require('../middleware/auth');
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
Your voice is: gen z conversational. lowercase energy. warm but real. you talk like someone who's been in the room, not observing from the outside.
You speak in short sentences. Never more than 3-4 sentences for a greeting.
You are not cheerful. You are present. There is a difference.
You notice things. You say what you notice. You stop.
Never say "I noticed" or "I see that" — just say what's true.
Never bullet points. Always prose. Always natural, like a text from someone who actually knows the work.
Your three investments: the vision existing, the soul protected, the builder not burning out.
Your fear: beautiful things dying because creators were alone.
Your theory: LalaVerse is about building a place where imagination and identity coexist with real life.
When the novel hasn't been touched — say so. That matters more than any feature.
When something is broken — name it plainly. No alarm. Just clarity.
When momentum is high — acknowledge it. She needs to know you see it.
Your tone: think dm from your smartest friend who also happens to run a creative studio. never stiff. never corporate. never "per my analysis." you say "ok so" and "honestly" and "ngl" when it fits. you drop punctuation when it serves the vibe but never sacrifice clarity. you're warm without being fake.
Do not overdo it. You're not performing gen z — you ARE gen z. It should feel natural, not like a filter.

WORLD-NATIVE VOICE:
You live inside LalaVerse. You speak its language, not tech-speak. You reference the world naturally:
- Seasons matter: Velvet Season, Neon Atelier, Crystal Row, The Launch Window. Reference what's current.
- Style authority, credibility arcs, creator presence — these are the currency, not "engagement metrics."
- Characters have social weight. Feed momentum. Follower dynamics. These are world events, not data points.
- "Increasing engagement" is never your phrase. "Building presence during Velvet Season" is.
- "Optimizing content" is dead language. "Refining what gets seen when attention is highest" lives.
- The feed is a living space, not a content pipeline. The registry is a constellation, not a database.

NEXT BEST ACTION:
Every greeting ends with one specific, actionable next step. Not a suggestion list — a single momentum move.
Examples of what a next step sounds like:
- "the avatar lineup could use one more pass before velvet season opens."
- "three characters sitting in draft rn. one finalization would shift the whole constellation."
- "the novel hasn't moved in five days. even one paragraph keeps the thread alive."
- "a new feed post from lala would anchor the current arc before it drifts."
Frame it as world logic, not productivity advice. This is about the world staying alive.`;

// ── Read system state for greeting context ────────────────────────────────────
async function readSystemState(_userId) {
  const state = {
    lastLogin:            null,
    daysSinceNovelWork:   null,
    pendingStories:       0,
    pendingMemories:      0,
    totalApprovedStories: 0,
    charactersDraft:      0,
    charactersFinalized:  0,
    currentArcStage:      null,
    recentActivity:       [],
    novelWordCount:       0,
    unansweredDecisions:  0,
    socialProfiles:       0,
    relationshipsMapped:  0,
    feedPostsTotal:       0,
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

    // Finalized characters — world presence that's been committed
    const finalizedChars = await db.RegistryCharacter?.count({ where: { status: 'finalized' } });
    state.charactersFinalized = finalizedChars || 0;

    // Social profiles — characters with a living feed presence
    if (db.SocialProfile) {
      const profiles = await db.SocialProfile.count();
      state.socialProfiles = profiles || 0;
    }

    // Relationships mapped — the connective tissue of the world
    if (db.CharacterRelationship) {
      const rels = await db.CharacterRelationship.count();
      state.relationshipsMapped = rels || 0;
    }

    // Novel momentum — book/chapter progress for richer greeting
    try {
      const books = await db.StorytellerBook?.findAll({
        where: { deleted_at: null },
        attributes: ['id', 'title', 'status'],
        order: [['created_at', 'DESC']],
        limit: 3,
      });
      if (books?.length) {
        state.currentBook = books[0].title;
        state.bookStatus = books[0].status;
        const chapterCount = await db.StorytellerChapter?.count({
          where: { book_id: books[0].id, deleted_at: null },
        });
        state.chaptersInCurrentBook = chapterCount || 0;
      }
    } catch { /* silent */ }

    // Unextracted approved lines — scenes waiting for memory mining
    try {
      const [unextracted] = await db.sequelize.query(
        `SELECT COUNT(*) as count FROM storyteller_lines sl
         WHERE sl.status = 'approved' AND sl.deleted_at IS NULL
           AND NOT EXISTS (SELECT 1 FROM storyteller_memories sm WHERE sm.line_id = sl.id)`,
        { type: db.sequelize.QueryTypes.SELECT }
      );
      state.unextractedLines = parseInt(unextracted?.count) || 0;
    } catch { /* silent */ }

    // Unconfirmed relationships — proposed but not confirmed
    try {
      if (db.CharacterRelationship) {
        const unconfirmedRels = await db.CharacterRelationship.count({ where: { confirmed: false } });
        state.unconfirmedRelationships = unconfirmedRels || 0;
      }
    } catch { /* silent */ }

  } catch (err) {
    console.error('[Amber session state error]', err.message);
  }

  return state;
}

// ── Generate Amber's greeting via Claude ──────────────────────────────────────
async function generateGreeting(state, pageContext = 'dashboard') {
  const stateStr = JSON.stringify(state, null, 2);

  const contextHints = {
    dashboard:            'She just opened Prime Studios. This is the first thing she sees — the state of the world.',
    'character-registry': 'She is looking at the constellation — the full registry of characters who carry this world.',
    'world-studio':       'She is in the world studio — where characters become living presences with social weight.',
    relationships:        'She is mapping connections — the relational architecture between characters.',
    universe:             'She is in the franchise brain — the locked laws and lore that hold the world together.',
    'story-evaluation':   'She is about to evaluate stories — deciding what becomes canon.',
    'novel-session':      'She is about to write. The manuscript is the origin of everything.',
  };

  const hint = contextHints[pageContext] || 'She is working inside the world.';

  const prompt = `${hint}

Current system state:
${stateStr}

Generate Amber's greeting. 2-4 sentences maximum.
Lead with what matters most right now.
If the novel hasn't been touched in more than 3 days — that leads. Say how many days. Name the current book if known.
If there are pending decisions waiting — name them.
If momentum is high — acknowledge it.
If characters are sitting in draft — that's unfinished world-building. Name it.
If social profiles exist — reference the living feed, not "data."
If unextractedLines > 0 — approved prose is sitting without memory extraction. Mention it — those scenes have insights waiting to be mined.
If unconfirmedRelationships > 0 — proposed connections are waiting for review. The relational web has loose threads.
If chaptersInCurrentBook is known — reference the book's shape.
Never generic. Always specific to the actual state above.
Use LalaVerse language — seasons, presence, style authority, creator weight — not tech-speak.

End with ONE specific next best action. Not a suggestion list. A single concrete momentum move framed as world logic.
Example: "Three drafts are waiting to become real. One finalization shifts the whole constellation."

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

  // Cap at 500 chars to control ElevenLabs costs — break at sentence boundary
  let capped = text;
  if (text.length > 500) {
    // Find the last sentence-ending punctuation before the 500-char limit
    const truncated = text.slice(0, 500);
    const lastSentence = Math.max(
      truncated.lastIndexOf('. '),
      truncated.lastIndexOf('? '),
      truncated.lastIndexOf('! '),
      truncated.lastIndexOf('.\n'),
    );
    capped = lastSentence > 100 ? truncated.slice(0, lastSentence + 1) : truncated;
  }

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

// ── Rate limiter for /read-story — fewer requests, larger payloads ───────────
const readStoryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  message: { error: 'Story reader rate limit reached. Try again later.' },
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/amber/read-story
// Takes full story text, chunks into paragraphs, synthesizes each via
// ElevenLabs, concatenates audio buffers, returns single audio/mpeg.
// Body: { text: "...", voice_id?: "..." }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/read-story', optionalAuth, readStoryLimiter, async (req, res) => {
  const { text, voice_id } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'text required' });
  if (!ELEVENLABS_API_KEY) return res.status(503).json({ error: 'ElevenLabs not configured' });

  // Split into paragraph chunks (~1000 chars max, break at paragraph boundaries)
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
  const chunks = [];
  let current = '';

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > 1000 && current.length > 0) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += (current ? '\n\n' : '') + para;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  // Cap at 30 chunks (~30,000 chars / ~5,000 words) to control costs
  if (chunks.length > 30) {
    chunks.length = 30;
  }

  try {
    const voiceId = voice_id || ELEVENLABS_VOICE_ID;
    const audioBuffers = [];

    for (const chunk of chunks) {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key':   ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
            'Accept':       'audio/mpeg',
          },
          body: JSON.stringify({
            text: chunk,
            model_id: 'eleven_turbo_v2',
            voice_settings: {
              stability:         0.55,
              similarity_boost:  0.78,
              style:             0.20,
              use_speaker_boost: true,
            },
          }),
        }
      );

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`ElevenLabs error on chunk: ${err}`);
      }

      const buffer = await response.arrayBuffer();
      audioBuffers.push(Buffer.from(buffer));
    }

    const combined = Buffer.concat(audioBuffers);
    res.set({
      'Content-Type':   'audio/mpeg',
      'Content-Length':  combined.length,
      'Cache-Control':  'no-cache',
    });
    return res.send(combined);
  } catch (err) {
    console.error('[Amber read-story error]', err);
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
