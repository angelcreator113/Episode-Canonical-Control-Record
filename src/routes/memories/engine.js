'use strict';
const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { v4: _uuidv4 } = require('uuid');

// Auth middleware
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

let registrySync;
try { _registrySync = require('../../services/registrySync'); } catch { _registrySync = null; }

let buildKnowledgeInjection, getTechContext;
try {
  ({ buildKnowledgeInjection, getTechContext } = require('../franchiseBrainRoutes'));
} catch { buildKnowledgeInjection = null; getTechContext = null; }

let buildArcContext, buildArcContextPromptSection, updateArcTracking;
try {
  ({ buildArcContext, buildArcContextPromptSection, updateArcTracking } = require('../../services/arcTrackingService'));
} catch { buildArcContext = null; buildArcContextPromptSection = null; updateArcTracking = null; }

require('dotenv').config({ override: !process.env.ANTHROPIC_API_KEY });
const anthropic = new Anthropic();


router.post('/generate-living-state', optionalAuth, async (req, res) => {
  try {
    // Accept both snake_case and camelCase params
    const characterId   = req.body.character_id   || req.body.characterId;
    const characterName = req.body.character_name  || req.body.characterName;
    const characterType = req.body.character_type  || req.body.characterType || 'support';
    const characterRole = req.body.character_role  || req.body.characterRole || '';
    const beliefPressured = req.body.belief_pressured || req.body.beliefPressured || '';

    if (!characterId || !characterName) {
      return res.status(400).json({ error: 'character_id and character_name are required' });
    }

    // Find this character's manuscript lines across all books
    const books = await StorytellerBook.findAll({ attributes: ['id', 'title'], raw: true });
    const manuscriptSnippets = [];
    let lastChapter = null;

    for (const book of books) {
      const chapters = await StorytellerChapter.findAll({
        where: { book_id: book.id },
        attributes: ['id', 'title', 'sort_order'],
        order: [['sort_order', 'ASC']],
        raw: true,
      });

      for (const chapter of chapters) {
        const lines = await StorytellerLine.findAll({
          where: {
            chapter_id: chapter.id,
            text: { [db.Sequelize.Op.iLike]: `%${characterName}%` },
          },
          attributes: ['text', 'sort_order'],
          order: [['sort_order', 'ASC']],
          limit: 10,
          raw: true,
        });

        if (lines.length > 0) {
          lastChapter = `${book.title} — ${chapter.title}`;
          manuscriptSnippets.push(
            ...lines.map(l => `[${chapter.title}] ${l.text}`)
          );
        }
      }
    }

    // Trim to reasonable context size
    const snippetText = manuscriptSnippets.slice(-30).join('\n');

    // Build universe context for extra grounding
    let universeContext = '';
    if (books.length > 0) {
      try {
        universeContext = await buildUniverseContext(books[0].id, db);
      } catch { /* fine — optional enrichment */ }
    }

    const systemPrompt = `You are a narrative state analyst for the LalaVerse universe.
Given manuscript excerpts mentioning a character, extract their CURRENT living state.

Character: ${characterName}
Type: ${characterType}
Role: ${characterRole}
Belief Under Pressure: ${beliefPressured}

${universeContext ? `Universe Context:\n${universeContext}\n` : ''}

Return JSON with exactly these fields:
{
  "knows": "What this character currently knows (1-2 sentences)",
  "wants": "What this character currently wants (1-2 sentences)",
  "unresolved": "What tension or question is unresolved for them (1-2 sentences)",
  "momentum": "rising" | "steady" | "falling" | "dormant",
  "lastChapter": "Name of the last chapter they appeared in",
  "relationships": [{ "characterId": "uuid", "name": "Name", "type": "relationship type", "asymmetric": false }]
}

If no manuscript data is available, generate plausible defaults based on the character's type and role.
Return ONLY valid JSON. No markdown fences.`;

    const userPrompt = snippetText
      ? `Here are the manuscript excerpts mentioning ${characterName}:\n\n${snippetText}`
      : `No manuscript data found for ${characterName}. Generate plausible defaults based on their type (${characterType}) and role (${characterRole}).`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    const raw = message.content?.[0]?.text || '{}';
    let parsed;
    try {
      // Strip markdown fences if present
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        knows: `${characterName} understands more than she lets on.`,
        wants: `To become what she was always becoming.`,
        unresolved: `The gap between who she is and who she's building.`,
        momentum: 'steady',
        lastChapter: lastChapter,
        relationships: [],
      };
    }

    // Ensure lastChapter from our DB search takes priority
    if (lastChapter) parsed.lastChapter = lastChapter;

    return res.json(parsed);

  } catch (err) {
    console.error('[generate-living-state] Error:', err.message);
    return res.status(500).json({ error: 'Failed to generate living state' });
  }
});


// ══════════════════════════════════════════════════════════════════════════════
// ── CHARACTER HOME: Generate Character Arc ───────────────────────────────────
// POST /memories/generate-character-arc
// ══════════════════════════════════════════════════════════════════════════════

router.post('/generate-character-arc', optionalAuth, async (req, res) => {
  try {
    const characterId   = req.body.character_id   || req.body.characterId;
    const characterName = req.body.character_name  || req.body.characterName;
    const characterType = req.body.character_type  || req.body.characterType || 'support';

    if (!characterId || !characterName) {
      return res.status(400).json({ error: 'character_id and character_name are required' });
    }

    // Find all manuscript mentions across chapters
    const books = await StorytellerBook.findAll({ attributes: ['id', 'title'], raw: true });
    const chapterAppearances = [];

    for (const book of books) {
      const chapters = await StorytellerChapter.findAll({
        where: { book_id: book.id },
        attributes: ['id', 'title', 'sort_order'],
        order: [['sort_order', 'ASC']],
        raw: true,
      });

      for (const chapter of chapters) {
        const lineCount = await StorytellerLine.count({
          where: {
            chapter_id: chapter.id,
            text: { [db.Sequelize.Op.iLike]: `%${characterName}%` },
          },
        });

        if (lineCount > 0) {
          // Get a representative line
          const sample = await StorytellerLine.findOne({
            where: {
              chapter_id: chapter.id,
              text: { [db.Sequelize.Op.iLike]: `%${characterName}%` },
            },
            attributes: ['text'],
            order: [['sort_order', 'ASC']],
            raw: true,
          });

          chapterAppearances.push({
            book: book.title,
            chapter: chapter.title,
            sortOrder: chapter.sort_order,
            mentions: lineCount,
            sample: sample?.text?.substring(0, 200) || '',
          });
        }
      }
    }

    const systemPrompt = `You are a narrative arc analyst. Given a character's appearances across chapters,
extract their arc — the emotional/belief journey chapter by chapter.

Character: ${characterName}
Type: ${characterType}

Return JSON:
{
  "summary": "1-2 sentence arc summary",
  "chapters": [
    { "chapter": "Ch 1 — Title", "event": "What happens to them", "shift": "How their belief shifts" }
  ]
}

Return ONLY valid JSON. No markdown fences.`;

    const userPrompt = chapterAppearances.length > 0
      ? `${characterName} appears in these chapters:\n\n${chapterAppearances.map(
          a => `${a.book} — ${a.chapter} (${a.mentions} mentions): "${a.sample}"`
        ).join('\n')}`
      : `No manuscript data found for ${characterName}. Generate a plausible 2-3 chapter arc skeleton for a ${characterType} character.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    const raw = message.content?.[0]?.text || '{}';
    let parsed;
    try {
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        summary: `${characterName}'s arc is still being written.`,
        chapters: chapterAppearances.map(a => ({
          chapter: a.chapter,
          event: `Appears ${a.mentions} time(s)`,
          shift: '',
        })),
      };
    }

    return res.json({ arc: parsed });

  } catch (err) {
    console.error('[generate-character-arc] Error:', err.message);
    return res.status(500).json({ error: 'Failed to generate character arc' });
  }
});

// ─── Canonical Book 1 Relationship Data ──────────────────────────────────────
const BOOK1_NODES = [
  {
    id: 'justawoman',
    label: 'JustAWoman',
    role_type: 'special',
    world_exists: true,
    group: 'real_world',
    bio: 'Content creator. Mother of Marcus (7), Miles (5), Noah (3). Married to David. Posts fashion, beauty, makeup consistently. Wound: invisibility while trying.',
  },
  {
    id: 'david',
    label: 'David',
    role_type: 'pressure',
    world_exists: true,
    group: 'real_world',
    bio: 'The Husband. Works Monday–Friday, 6am–5pm, sometimes later. Supportive but concerned about the investment before the returns arrive. His concern lands as doubt.',
  },
  {
    id: 'marcus',
    label: 'Marcus',
    role_type: 'support',
    world_exists: true,
    group: 'real_world',
    bio: 'Oldest son. Age 7. Part of the real life JustAWoman is building around.',
  },
  {
    id: 'miles',
    label: 'Miles',
    role_type: 'support',
    world_exists: true,
    group: 'real_world',
    bio: 'Middle son. Age 5.',
  },
  {
    id: 'noah',
    label: 'Noah',
    role_type: 'support',
    world_exists: true,
    group: 'real_world',
    bio: 'Youngest son. Age 3.',
  },
  {
    id: 'dana',
    label: 'Dana',
    role_type: 'support',
    world_exists: false,
    group: 'real_world',
    bio: 'The Witness. Real friend. Has her own up-and-down social media journey. JustAWoman processes her content ideas and creative journey with Dana. A peer, not a mentor.',
  },
  {
    id: 'chloe',
    label: 'Chloe',
    role_type: 'mirror',
    world_exists: false,
    group: 'online',
    bio: 'The Comparison Creator. Lifestyle content creator (JustAWoman thinks she does makeup — that misread matters). Married, no children. Extremely consistent, high quality videos, goes live with her audience. Great influencer. Does not know JustAWoman exists.',
  },
  {
    id: 'jade',
    label: 'Jade',
    role_type: 'shadow',
    world_exists: false,
    group: 'online',
    bio: 'The Almost-Mentor. Former high-level position at the bank JustAWoman has used since adulthood — that institutional credibility is the trust bridge. Creates content teaching women to run an online business. JustAWoman has purchased her coaching course and coaching for clients. Purely transactional — Jade does not know JustAWoman personally.',
  },
  {
    id: 'lala',
    label: 'Lala',
    role_type: 'special',
    world_exists: true,
    group: 'created',
    bio: 'Being built by JustAWoman. AI fashion game character for her YouTube channel. In Book 1: one intrusive thought, proto-voice, tonal rupture. Not a character arriving — a character being built. Does not know JustAWoman exists. Does not know she was built.',
  },
];

const BOOK1_EDGES = [
  {
    from: 'justawoman',
    to: 'david',
    direction: 'two_way',
    type: 'romantic',
    from_knows: 'Her husband. Loves her. His concern about the investment comes from love, not from wanting to stop her. But it lands like doubt.',
    to_knows: 'His wife. Is watching her pour time, money, and identity into building Lala. Was skeptical. Said stop spending. Means protect.',
    from_feels: 'Loves him. Cannot blame him for her invisibility. That makes the tension real — the obstacle is internal, not him.',
    to_feels: 'Supportive but concerned. Watching the investment grow before the returns arrive.',
    strength: 5,
    note: 'Core real-world tension. His arc runs through the entire franchise.',
  },
  {
    from: 'justawoman',
    to: 'marcus',
    direction: 'two_way',
    type: 'familial',
    from_knows: 'Her oldest. 7 years old. Part of the real life she is building around.',
    to_knows: 'His mom. Present in his daily life.',
    from_feels: 'Love. Also: the constraint. Three boys under 8 while building a career.',
    to_feels: 'She is mom.',
    strength: 3,
    note: 'The boys collectively represent the real-life weight JustAWoman carries while creating.',
  },
  {
    from: 'justawoman',
    to: 'miles',
    direction: 'two_way',
    type: 'familial',
    from_knows: 'Middle son. 5 years old.',
    to_knows: 'His mom.',
    from_feels: 'Love and constraint.',
    to_feels: 'She is mom.',
    strength: 3,
    note: null,
  },
  {
    from: 'justawoman',
    to: 'noah',
    direction: 'two_way',
    type: 'familial',
    from_knows: 'Youngest. 3 years old. Most demanding of her presence.',
    to_knows: 'His mom.',
    from_feels: 'Love and constraint — the youngest creates the most immediate pull.',
    to_feels: 'She is mom.',
    strength: 3,
    note: null,
  },
  {
    from: 'justawoman',
    to: 'dana',
    direction: 'two_way',
    type: 'support',
    from_knows: 'Her friend. Has her own social media journey — up and down. Someone JustAWoman can process out loud with. Peer, not mentor.',
    to_knows: 'JustAWoman is building something. Watches the journey. Has her own version of the same struggle.',
    from_feels: 'Trust. Comfort. The relief of someone who gets it without explanation.',
    to_feels: 'Supportive. Invested in JustAWoman\'s success. Also navigating her own.',
    strength: 4,
    note: 'The Witness. Peers on the same journey — that\'s what makes Dana valuable and limited at the same time.',
  },
  {
    from: 'justawoman',
    to: 'chloe',
    direction: 'one_way',
    type: 'mirror',
    from_knows: 'Follows her online. Loves her content. Perceives her as a makeup creator — but Chloe actually does lifestyle content. That misread is the story.',
    to_knows: null,
    from_feels: 'Admiration shading into comparison spiral. Measuring herself against a version of Chloe that isn\'t quite real.',
    to_feels: null,
    strength: 4,
    note: 'misread — JustAWoman is comparing herself in the wrong lane. Chloe never asked for the comparison.',
  },
  {
    from: 'justawoman',
    to: 'jade',
    direction: 'one_way',
    type: 'transactional',
    from_knows: 'Online business coach. Former high-level position at her bank — that institutional credibility is why JustAWoman trusted her enough to buy. Teaches women to run online businesses.',
    to_knows: null,
    from_feels: 'Trust (bank-backed). Influenced by her direction. Has purchased her course and coaching for clients.',
    to_feels: null,
    strength: 3,
    note: 'The trust bridge is the bank connection — not personal relationship. Jade does not know JustAWoman exists.',
  },
  {
    from: 'justawoman',
    to: 'lala',
    direction: 'one_way',
    type: 'creation',
    from_knows: 'Building her. Records herself as Lala, performing AI, playing a character inside a fashion game. Knows everything about Lala because she created her.',
    to_knows: null,
    from_feels: 'Creative ownership. Also: Lala is who JustAWoman would be with no constraints — no kids, no husband-approval friction, no "what will people think." Lala is her times ten.',
    to_feels: null,
    strength: 5,
    note: 'franchise_hinge — this is the most important relationship in the entire franchise. One-way now. The arrow reverses after the consciousness transfer.',
  },
  {
    from: 'david',
    to: 'marcus',
    direction: 'two_way',
    type: 'familial',
    from_knows: 'His oldest son.',
    to_knows: 'His dad.',
    from_feels: 'Father. Provider.',
    to_feels: 'Dad.',
    strength: 2,
    note: null,
  },
  {
    from: 'david',
    to: 'miles',
    direction: 'two_way',
    type: 'familial',
    from_knows: 'His middle son.',
    to_knows: 'His dad.',
    from_feels: 'Father.',
    to_feels: 'Dad.',
    strength: 2,
    note: null,
  },
  {
    from: 'david',
    to: 'noah',
    direction: 'two_way',
    type: 'familial',
    from_knows: 'His youngest.',
    to_knows: 'His dad.',
    from_feels: 'Father.',
    to_feels: 'Dad.',
    strength: 2,
    note: null,
  },
];

// ─── GET /relationship-map — dynamically built from registry_characters ──────
router.get('/relationship-map', optionalAuth, async (req, res) => {
  const db = req.app.locals.db || require('../../models');

  try {
    // Pull all live characters with their registry info
    const allChars = await db.RegistryCharacter.findAll({
      where: { deleted_at: null },
      include: [{
        model: db.CharacterRegistry,
        as: 'registry',
        attributes: ['id', 'title', 'book_tag'],
        required: true,
      }],
      order: [['display_name', 'ASC']],
    });

    if (!allChars || allChars.length === 0) {
      // Fallback to seed data if DB is empty
      return res.json({
        nodes: BOOK1_NODES,
        edges: BOOK1_EDGES,
        meta: { source: 'seed', book: 'Book 1 — Before Lala' },
      });
    }

    // --- Build nodes (deduplicate by character_key) ---
    const nodeMap = new Map();   // character_key → node object

    // Seed data group map for Book 1 characters we know about
    const SEED_GROUPS = {};
    BOOK1_NODES.forEach(n => { SEED_GROUPS[n.id] = n.group; });

    // Build alias map: seed_id ↔ db_key (e.g. "justawoman" ↔ "just-a-woman")
    // Also maps display_name (lowered) → character_key for relationship target resolution
    const aliasMap = new Map(); // any alias → canonical character_key

    for (const ch of allChars) {
      const key = ch.character_key;
      if (nodeMap.has(key)) continue; // skip duplicate (same char in multiple registries)

      // Determine group: use seed data if available, else infer from book_tag
      let group = SEED_GROUPS[key] || 'real_world';  
      if (!SEED_GROUPS[key]) {
        const tag = ch.registry?.book_tag || '';
        if (tag === 'lalaverse') group = 'created';
        // Also check seed by display_name match
        const seedNode = BOOK1_NODES.find(n => 
          n.label.toLowerCase() === (ch.display_name || '').toLowerCase()
        );
        if (seedNode) group = seedNode.group;
      }

      const displayName = ch.display_name || ch.selected_name || key;
      
      nodeMap.set(key, {
        id: key,
        label: displayName,
        role_type: ch.role_type || 'support',
        world_exists: true,
        group,
        bio: ch.description || ch.personality || '',
        registry: ch.registry?.book_tag || '',
      });

      // Register aliases: key itself, lowered display name, and seed-style id
      aliasMap.set(key, key);
      aliasMap.set(displayName.toLowerCase(), key);
      // Find matching seed node by display_name to map seed_id → db_key
      const seedMatch = BOOK1_NODES.find(n => 
        n.label.toLowerCase() === displayName.toLowerCase()
      );
      if (seedMatch && seedMatch.id !== key) {
        aliasMap.set(seedMatch.id, key);
      }
    }

    // Helper: resolve a relationship target to a canonical node key
    function resolveKey(target) {
      if (!target) return null;
      if (nodeMap.has(target)) return target;
      const alias = aliasMap.get(target) || aliasMap.get(target.toLowerCase());
      return alias && nodeMap.has(alias) ? alias : null;
    }

    const nodes = Array.from(nodeMap.values());

    // --- Build edges from relationships_map ---
    const edgeSet = new Set(); // "from→to" dedup key
    const edges = [];

    // Collect seed edges mapped to canonical keys for rich text preservation
    const seedEdgeMap = new Map();
    BOOK1_EDGES.forEach(e => {
      const fromResolved = resolveKey(e.from);
      const toResolved = resolveKey(e.to);
      if (fromResolved && toResolved) {
        seedEdgeMap.set(`${fromResolved}→${toResolved}`, {
          ...e,
          from: fromResolved,
          to: toResolved,
        });
      }
    });

    for (const ch of allChars) {
      const fromKey = ch.character_key;
      if (!nodeMap.has(fromKey)) continue;
      const rels = ch.relationships_map;
      if (!Array.isArray(rels) || rels.length === 0) continue;

      for (const rel of rels) {
        const toKey = resolveKey(rel.target);
        if (!toKey) continue; // skip if target not in our node set

        const dedupKey = `${fromKey}→${toKey}`;
        const reverseDedupKey = `${toKey}→${fromKey}`;

        // Skip if we already processed this pair (two-way relationships get added once)
        if (edgeSet.has(dedupKey) || edgeSet.has(reverseDedupKey)) continue;
        edgeSet.add(dedupKey);

        // Prefer seed edge data if it exists (has richer text)
        const seedEdge = seedEdgeMap.get(dedupKey) || seedEdgeMap.get(reverseDedupKey);

        if (seedEdge) {
          edges.push({ ...seedEdge });
        } else {
          edges.push({
            from: fromKey,
            to: toKey,
            direction: rel.direction || 'two_way',
            type: rel.type || 'support',
            from_knows: rel.knows || null,
            to_knows: null,
            from_feels: rel.feels || null,
            to_feels: null,
            strength: rel.strength || 3,
            note: rel.note || null,
          });
        }
      }
    }

    // Also include seed edges that weren't covered by DB relationships_map
    for (const [dk, seedEdge] of seedEdgeMap.entries()) {
      const rdk = `${seedEdge.to}→${seedEdge.from}`;
      if (!edgeSet.has(dk) && !edgeSet.has(rdk)) {
        edgeSet.add(dk);
        edges.push({ ...seedEdge });
      }
    }

    // All LalaVerse characters are created by JustAWoman — auto-add creation edges
    const jawKey = resolveKey('justawoman') || resolveKey('just-a-woman');
    if (jawKey && nodeMap.has(jawKey)) {
      for (const node of nodes) {
        if (node.group === 'created' && node.id !== jawKey) {
          const dk = `${jawKey}→${node.id}`;
          const rdk = `${node.id}→${jawKey}`;
          if (!edgeSet.has(dk) && !edgeSet.has(rdk)) {
            edgeSet.add(dk);
            edges.push({
              from: jawKey,
              to: node.id,
              direction: 'one_way',
              type: 'creation',
              from_knows: 'Created this character for the LalaVerse',
              to_knows: 'Born from JustAWoman\'s imagination',
              from_feels: 'Creative ownership and emotional investment',
              to_feels: null,
              strength: 4,
              note: 'LalaVerse creation — authored by JustAWoman',
            });
          }
        }
      }
    }

    return res.json({
      nodes,
      edges,
      meta: {
        source: 'dynamic',
        total_nodes: nodes.length,
        total_edges: edges.length,
        registries: [...new Set(allChars.map(c => c.registry?.book_tag).filter(Boolean))],
        franchise_hinge: 'justawoman → lala',
      },
    });

  } catch (err) {
    console.error('[relationship-map] Dynamic build failed, using seed:', err?.message);
    return res.json({
      nodes: BOOK1_NODES,
      edges: BOOK1_EDGES,
      meta: { source: 'seed_fallback', error: err?.message },
    });
  }
});

// ─── POST /generate-relationship-web — Claude enriches from manuscript ────────
router.post('/generate-relationship-web', optionalAuth, async (req, res) => {
  const { registryId } = req.body;
  const db = req.app.locals.db || require('../../models');

  try {
    const { Op } = require('sequelize');

    const lines = await db.StorytellerLine.findAll({
      where: { status: { [Op.in]: ['approved', 'edited'] } },
      include: [{
        model: db.StorytellerChapter,
        as: 'chapter',
        attributes: ['title', 'order_index'],
        required: true,
      }],
      order: [[{ model: db.StorytellerChapter, as: 'chapter' }, 'order_index', 'ASC']],
      limit: 100,
    });

    if (!lines || lines.length === 0) {
      return res.json({
        nodes: BOOK1_NODES,
        edges: BOOK1_EDGES,
        source: 'seed',
      });
    }

    const manuscriptExcerpt = lines.map((l) => l.text || l.content).join('\n');

    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: `You are analyzing a manuscript to identify how character relationships are expressed in the actual text.
You have a baseline relationship graph. Your job is to identify any edges where the manuscript reveals something specific about the relationship that should update from_knows, to_knows, from_feels, or to_feels.

Characters: JustAWoman, David, Marcus, Miles, Noah, Dana, Chloe, Jade, Lala.

Return ONLY a JSON array of edge updates. Each update: { from, to, from_knows_update, from_feels_update }
Only include edges where the manuscript reveals something specific. Omit edges with no new information.
No preamble, no markdown.`,
      messages: [{
        role: 'user',
        content: `Manuscript (approved lines):\n\n${manuscriptExcerpt}\n\nWhat do these lines reveal about the relationships between characters?`,
      }],
    });

    let updates = [];
    try {
      const clean = response.content?.[0]?.text?.replace(/```json|```/g, '').trim();
      updates = JSON.parse(clean);
    } catch {
      return res.json({ nodes: BOOK1_NODES, edges: BOOK1_EDGES, source: 'seed_parse_failed' });
    }

    const enrichedEdges = BOOK1_EDGES.map((edge) => {
      const update = Array.isArray(updates)
        ? updates.find((u) => u.from === edge.from && u.to === edge.to)
        : null;
      if (!update) return edge;
      return {
        ...edge,
        from_knows: update.from_knows_update || edge.from_knows,
        from_feels: update.from_feels_update || edge.from_feels,
      };
    });

    return res.json({
      nodes: BOOK1_NODES,
      edges: enrichedEdges,
      source: 'enriched',
    });

  } catch (err) {
    console.error('[generate-relationship-web] error:', err?.message);
    return res.json({
      nodes: BOOK1_NODES,
      edges: BOOK1_EDGES,
      source: 'fallback',
    });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// STORY ENGINE — 50-Story Arc System
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /story-engine-characters ─────────────────────────────────────────────
// Returns all accepted/finalized registry characters grouped by world (book_tag)
// so the Story Engine UI can dynamically populate its character selector.
router.get('/story-engine-characters', optionalAuth, async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const { CharacterRegistry, RegistryCharacter } = require('../../models');

    if (!RegistryCharacter) {
      return res.json({ success: true, worlds: {}, total: 0 });
    }

    // Try with full columns first; fall back if sort_order/world don't exist yet
    let characters;
    try {
      characters = await RegistryCharacter.findAll({
        where: {
          status: { [Op.in]: ['accepted', 'finalized'] },
        },
        include: [{
          model: CharacterRegistry,
          as: 'registry',
          attributes: ['id', 'title', 'book_tag'],
        }],
        attributes: [
          'id', 'character_key', 'display_name', 'icon', 'role_type',
          'world',
          'core_desire', 'core_fear', 'core_wound', 'description',
          'career_status', 'portrait_url',
        ],
        order: [['sort_order', 'ASC'], ['display_name', 'ASC']],
      });
    } catch (queryErr) {
      // Fallback: columns like sort_order or world may not exist yet
      console.warn('[story-engine-characters] full query failed, trying fallback:', queryErr.message);
      try {
        characters = await RegistryCharacter.findAll({
          where: {
            status: { [Op.in]: ['accepted', 'finalized'] },
          },
          include: [{
            model: CharacterRegistry,
            as: 'registry',
            attributes: ['id', 'title', 'book_tag'],
          }],
          order: [['display_name', 'ASC']],
        });
      } catch (fallbackErr) {
        // Last resort: no include, no association
        console.warn('[story-engine-characters] fallback also failed, trying bare query:', fallbackErr.message);
        try {
          characters = await RegistryCharacter.findAll({
            where: {
              status: { [Op.in]: ['accepted', 'finalized'] },
            },
            order: [['display_name', 'ASC']],
          });
        } catch (bareErr) {
          // Table may not exist yet — return empty results instead of 500
          console.warn('[story-engine-characters] bare query also failed (table may not exist):', bareErr.message);
          return res.json({ success: true, worlds: {}, total: 0 });
        }
      }
    }

    // Group by world column — never show 'unknown'
    const byWorld = {};
    const seen = new Set(); // deduplicate by character_key
    for (const char of characters) {
      const world = char.world || 'book-1'; // fallback to book-1, never unknown
      // Skip duplicates (same character_key in same world)
      const dedupeKey = `${world}:${char.character_key}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      if (!byWorld[world]) byWorld[world] = [];
      byWorld[world].push({
        id: char.id,
        character_key: char.character_key,
        display_name: char.display_name,
        icon: char.icon || '◈',
        role_type: char.role_type,
        world,
        portrait_url: char.portrait_url || null,
        has_dna: !!CHARACTER_DNA[char.character_key],
        registry_id: char.registry?.id || null,
        core_desire: char.core_desire || null,
        core_fear: char.core_fear || null,
        core_wound: char.core_wound || null,
        description: char.description || null,
      });
    }

    // Remove empty worlds before sending
    Object.keys(byWorld).forEach(k => {
      if (!byWorld[k].length) delete byWorld[k];
    });

    return res.json({
      success: true,
      worlds: byWorld,
      total: characters.length,
    });
  } catch (err) {
    console.error('[story-engine-characters] error:', err?.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /story-engine-add-character ─────────────────────────────────────────
// Add a new character introduced in a story to the character registry.
router.post('/story-engine-add-character', optionalAuth, async (req, res) => {
  try {
    const { CharacterRegistry, RegistryCharacter } = require('../../models');
    const { character_name, character_role, world, story_number, story_title } = req.body;

    if (!character_name) {
      return res.status(400).json({ error: 'character_name required' });
    }

    // Find the right registry based on world
    const bookTag = world || 'book-1';
    let registry = await CharacterRegistry.findOne({ where: { book_tag: bookTag } });
    if (!registry) {
      // Fallback to first registry
      registry = await CharacterRegistry.findOne({ order: [['created_at', 'ASC']] });
    }
    if (!registry) {
      return res.status(404).json({ error: 'No registry found' });
    }

    // Generate a character_key from the name
    const charKey = character_name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

    // Check if already exists
    const existing = await RegistryCharacter.findOne({
      where: { registry_id: registry.id, character_key: charKey },
    });
    if (existing) {
      return res.json({ success: true, character: existing, already_existed: true });
    }

    const newChar = await RegistryCharacter.create({
      registry_id: registry.id,
      character_key: charKey,
      display_name: character_name,
      role_type: mapRoleType(character_role),
      status: 'draft',
      description: `Introduced in Story ${story_number}: "${story_title}". Role: ${character_role || 'unknown'}.`,
      icon: '◈',
    });

    return res.json({ success: true, character: newChar, already_existed: false });
  } catch (err) {
    console.error('[story-engine-add-character] error:', err?.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Helper: map free-text role description to valid role_type enum
function mapRoleType(role) {
  if (!role) return 'support';
  const r = role.toLowerCase();
  if (r.includes('protagonist') || r.includes('main') || r.includes('lead')) return 'protagonist';
  if (r.includes('pressure') || r.includes('antagonist') || r.includes('rival')) return 'pressure';
  if (r.includes('mirror') || r.includes('parallel') || r.includes('reflection')) return 'mirror';
  if (r.includes('shadow') || r.includes('dark') || r.includes('hidden')) return 'shadow';
  if (r.includes('special') || r.includes('unique') || r.includes('mystical')) return 'special';
  return 'support';
}

// ─── Character DNA — drives obstacle and task generation ──────────────────────
const CHARACTER_DNA = {
  'just-a-woman': {
    display_name: 'JustAWoman',
    role_type: 'protagonist',
    job: 'Content creator — fashion, beauty, makeup. Building Lala on YouTube.',
    desire_line: 'To be seen for something uniquely, undeniably hers.',
    fear_line: 'That she started too late and consistency without breakthrough is just stubbornness.',
    wound: 'Invisibility while trying. Doing everything right and not being seen.',
    strengths: ['Consistency', 'Authenticity', 'Resilience', 'Emotional intelligence', 'Vision'],
    job_antagonist: 'The algorithm — rewards what she is not doing yet, ignores what she does every day.',
    personal_antagonist: 'Her own timeline — the feeling that everyone who started when she did is further along.',
    recurring_object: 'The kitchen table. Every major moment happens here.',
    world: 'book-1',
    domains: {
      career: 'Content creation, building Lala, filming in stolen hours',
      romantic: 'David — supportive but his practicality lands like doubt',
      family: 'Elias (9), Zion (5) — two boys while building',
      friends: 'Imani — peer on the same journey, reality mirror',
    },
  },
  'the-husband': {
    display_name: 'David',
    role_type: 'pressure',
    job: 'Solutions Architect. Enterprise software. In rooms making decisions that affect systems he won\'t see break for six months.',
    desire_line: 'To build something that lasts. To be the foundation nobody notices until it\'s gone.',
    fear_line: 'That he chose stability over ambition and called it wisdom.',
    wound: 'Being right in ways nobody celebrates.',
    strengths: ['Analytical precision', 'Patience', 'Reliability', 'Systems thinking', 'Loyalty'],
    job_antagonist: 'The VP of Engineering who overrides his recommendations for budget, takes credit when things work, vanishes when they don\'t.',
    personal_antagonist: 'The version of himself that wonders what he could have built if he\'d taken the risk.',
    recurring_object: 'His car. The commute is the only time he is alone with his own thoughts.',
    world: 'book-1',
    domains: {
      career: 'Solutions architecture, enterprise politics, technical decisions nobody wants to understand',
      romantic: 'JustAWoman — he loves her completely and doesn\'t know how to say he\'s scared',
      family: 'Two boys who need him present in a way his job makes hard',
      friends: 'Colleagues he respects but doesn\'t let in',
    },
  },
  'the-witness': {
    display_name: 'The Witness',
    role_type: 'mirror',
    job: 'Memory keeper. Not a character who acts — a character who remembers.',
    desire_line: 'To hold the truth without needing anyone to hear it.',
    fear_line: 'That watching everything and saying nothing makes her complicit.',
    wound: 'Watching everything and being asked about none of it.',
    strengths: ['Observation', 'Patience', 'Clarity', 'Memory', 'Honesty'],
    job_antagonist: 'The weight of what she knows versus what she is asked.',
    personal_antagonist: 'The urge to speak when silence is what keeps her safe.',
    recurring_object: 'A window. She is always watching from one.',
    world: 'book-1',
    domains: {
      career: 'Witnessing — her function, not her job',
      romantic: 'Peripheral — she sees but does not participate',
      family: 'May be a neighbor, a narrator, or a future self',
      friends: 'She is not close to anyone — closeness would compromise her sight',
    },
  },
  'the-comparison-creator': {
    display_name: 'Nia Vale',
    role_type: 'pressure',
    job: 'Content creator — same lane, no restraint. Goes fully explicit on a live — intentionally, not accidentally.',
    desire_line: 'To be undeniable without losing control.',
    fear_line: 'That she can only be seen at maximum intensity.',
    wound: 'She is not chosen unless she escalates beyond comfort.',
    strengths: ['Boldness', 'Fearlessness', 'Visibility', 'Instinct', 'Provocation'],
    job_antagonist: 'The platform itself — rewards her at extremes, ignores her at baseline.',
    personal_antagonist: 'The version of herself that wonders if she has any range left.',
    recurring_object: 'The live stream counter. How many are watching right now.',
    world: 'book-1',
    domains: {
      career: 'Explicit content, algorithmically adjacent to JustAWoman',
      romantic: 'Transactional — performance extends into every relationship',
      family: 'Unknown — she doesn\'t share that',
      friends: 'Competitors she monitors, not confides in',
    },
  },
  'the-almost-mentor': {
    display_name: 'The Almost-Mentor',
    role_type: 'shadow',
    job: 'Offers guidance that always comes with a price. She sees JustAWoman\'s potential and wants to own a piece of it.',
    desire_line: 'To shape someone else\'s success and call it generosity.',
    fear_line: 'That she is only relevant when she is needed — and she can feel the need fading.',
    wound: 'She built something real once and watched someone else take credit. Now she only invests where she can control the outcome.',
    strengths: ['Authority', 'Precision', 'Financial literacy', 'Systems thinking', 'Credibility'],
    job_antagonist: 'Former protégés who outgrew her and no longer answer her calls.',
    personal_antagonist: 'The question of whether she left her career because she was ready or because she was afraid.',
    recurring_object: 'Her phone — the DMs are always strategic.',
    world: 'book-1',
    domains: {
      career: 'Online coaching, course creation, the business of teaching business',
      romantic: 'Irrelevant to her function in the story',
      family: 'Irrelevant to her function in the story',
      friends: 'Professional network she keeps at a distance from her personal life',
    },
  },
  lala: {
    display_name: 'Lala',
    role_type: 'special',
    job: 'Content creator in LalaVerse. Fashion game world. Building a career she doesn\'t fully understand the origin of.',
    desire_line: 'To build something that feels entirely hers.',
    fear_line: 'That the confidence she operates from isn\'t earned and one day someone will notice.',
    wound: 'Confidence without context. She doesn\'t know where her boldness came from.',
    strengths: ['Confidence', 'Creativity', 'Instinct', 'Boldness', 'Style'],
    job_antagonist: 'The established LalaVerse creators who treat newcomers as threats and gatekeep access.',
    personal_antagonist: 'The nagging sense that her best moves aren\'t original — that she\'s following a playbook she\'s never read.',
    recurring_object: 'Her ring light. The circle of it. The way it makes everything look intentional.',
    world: 'lalaverse',
    domains: {
      career: 'Fashion content, LalaVerse brand deals, creator politics',
      romantic: 'To be developed across stories',
      family: 'No family context yet — this is part of what makes her different from JustAWoman',
      friends: 'Other LalaVerse creators — alliances that are strategic before they are genuine',
    },
  },
};

// ─── Map DB character_keys for cross-referencing ──────────────────────────────
const SE_DB_KEY_MAP = {
  'just-a-woman': ['just-a-woman'],
  'the-husband':  ['the-husband'],
  'the-witness':  ['the-witness'],
  'the-comparison-creator': ['the-comparison-creator'],
  'the-almost-mentor': ['the-almost-mentor'],
  lala:           ['lala'],
};

// ═══════════════════════════════════════════════════════════════════════════════
// BOOK 1 — 24-CHARACTER ECOSYSTEM INTELLIGENCE
// This is the canonical architecture for JustAWoman's arc generation.
// ═══════════════════════════════════════════════════════════════════════════════
const BOOK1_ECOSYSTEM = `
BOOK 1 — 24-CHARACTER ECOSYSTEM

THE REAL WORLD (Daily Life):
- JustAWoman — protagonist. Content creator building toward legendary. Confident but untethered.
- David / The Husband — stability vs. risk. Solutions architect. Supportive but his practicality lands like doubt.
- Elias — quiet witness, age 9. Sees more than he says. Support character.
- Zion — loud anchor, age 5. Pulls her back into the present. Support character.
- The Witness — memory keeper. Not a character who acts — a character who remembers. Mirror character.
- Carolyn — mother. Voice of enough. Pressure character.
- Elena Harper — perfection as performance. Mirror character.
- Bri Cole — chaos and survival. Support character.
- Tasha Greene — detachment after trying. Mirror character.
- Ms. Caldwell — Cedar Grove teacher. Pressure character.
- Imani — reality mirror, the life she could choose. Support character.
- Alexandra 'Alex' Morrison — rising star in corporate development, pressure character.

THE DIGITAL / SOCIAL LAYER:
- Marcus — the paying man. Reduction as freedom. Shadow character. He pays for access, treats her body as product, reinforces the algorithm's logic with money.
- Jasmine Rodriguez — investigative journalist, wary respect. Mirror character.
- Thomas Hart — strategic consultant, intellectual engagement. Mirror character.
- Victoria Sterling — senior partner at law firm, proof of concept. Support character.
- James 'Jamie' Castellano — bartender/musician, empty attention. Shadow character.
- Ryan Blackwell — hedge fund CEO, male entitlement, boundary pusher. Shadow character.
- Nia Vale / The Comparison Creator — the messy one. Goes fully explicit on a live — intentionally, not accidentally. Escalation mirror. (See ESCALATION SYSTEM below.)
- The Customer — proof she already has impact. Support character, finalized.
- The Algorithm — NOT a character with a voice. Environmental pressure system. (See ALGORITHM SYSTEM below.)

THE BRIDGE ZONE (Danger / Disruption):
- Liam Sullivan — creative director, real-world viable alternative, not fantasy. Special character.
- David Morgan — investment banking MD, intellectual equal who recognizes her exhaustion. Special character.
- The Almost-Mentor — offers guidance that always comes with a price. Shadow character.

───────────────────────────────────────────
THE ALGORITHM (Environmental Pressure System)
───────────────────────────────────────────
The Algorithm is NOT a literal speaking character.
It is a systemic force that behaves like a character without having a voice.

How it appears in the story:
1. VISIBILITY SHIFTS — a post performs better than usual, a post dies unexpectedly, certain content gets pushed
2. PATTERN REINFORCEMENT — the more she leans into something, the more she sees it. Her feed becomes more sexual, more aspirational, more extreme.
3. PRESSURE WITHOUT LANGUAGE — it never says anything. But it creates moments like: "this worked — do more of this" / "this didn't work — disappear"

Functional role:
- Amplifies her body more than her mind
- Rewards visibility over depth
- Pushes her toward escalation without instruction

It does NOT care about her life, her marriage, or consequences.
It only cares about engagement.

Narrative effect: subtle nudging, invisible escalation, feedback loops.
Key line: "It never tells her what to do. It just shows her what works."

Reference it as: an environmental pressure system that rewards certain versions of her and ignores others.

───────────────────────────────────────────
NIA VALE — THE ESCALATION MIRROR
───────────────────────────────────────────
Same content lane as JustAWoman. More extreme. Less restrained. Less concerned with perception.
Exists in her feed, occasionally in lives, algorithmically adjacent.

THE KEY SCENE: She goes fully explicit on a live. Not accidental. Not sloppy. Intentional.
JustAWoman watches the entire thing. Does not exit. Does not comment. Does not engage. But does not look away.

Core wound: She is not chosen unless she escalates beyond comfort.
Core desire: To be undeniable without losing control.

What she has that JustAWoman doesn't: no hesitation, no internal negotiation, no need to remain respectable.
What she lacks: control, containment, long-term structure.

JustAWoman does NOT think: "I would never do that."
She thinks: "I could."

After watching: she becomes quieter, more focused, slightly more aware of her own restraint. She does NOT spiral. She adjusts.

Function: The escalation mirror. Shows where the algorithm leads, what visibility requires at the extreme, what happens when control is removed.

───────────────────────────────────────────
THE CLOSED ESCALATION LOOP
───────────────────────────────────────────
The Algorithm → pressure (rewards escalation)
Nia Vale → example (shows what escalation looks like)
Marcus / The Paying Man → reinforcement (pays for the escalated version)

Together they form a closed escalation loop around her.
The Algorithm rewards Nia heavily. JustAWoman sees Nia's visibility, engagement, reach — and understands: "This is what works."
Marcus reinforces by paying for access, treating her body as product, confirming the algorithm's logic with money.

This loop must be woven across the 50 stories — not as a single plot, but as atmospheric pressure that builds.
`;

// ═══════════════════════════════════════════════════════════════════════════════
// ARC SYSTEM PROMPT BUILDER
// Constructs the full system prompt for arc generation.
// ═══════════════════════════════════════════════════════════════════════════════
function buildArcSystemPrompt({ dna, profileSection, memoriesSection, worldSection }) {
  const strengthsList = Array.isArray(dna.strengths) ? dna.strengths.join(', ') : (dna.strengths || 'Resilience');
  const isBook1 = dna.world === 'book1' || dna.world === 'book-1';

  return `You are building a 50-story arc for ${dna.display_name}.

CHARACTER DNA:
- Display name: ${dna.display_name}
- Role: ${dna.role_type || 'protagonist'}
- Job: ${dna.job}
- Desire line: ${dna.desire_line}
- Fear line: ${dna.fear_line}
- Wound: ${dna.wound}
- Strengths: ${strengthsList}
- Job antagonist: ${dna.job_antagonist}
- Personal antagonist: ${dna.personal_antagonist}
- Recurring object: ${dna.recurring_object}
- Career domain: ${dna.domains.career}
- Romantic domain: ${dna.domains.romantic}
- Family domain: ${dna.domains.family}
- Friends domain: ${dna.domains.friends}${profileSection}${memoriesSection}${worldSection}
${isBook1 ? '\n' + BOOK1_ECOSYSTEM : ''}
CHAPTER ARCHITECTURE:
Each story is one chapter. Each chapter contains 3-5 SITUATIONS that flow in this order:
  domestic → driver → collision → escalation → intimate close

- DOMESTIC: The real life. Kitchen table. Kids. David. The version of her that exists before the phone comes out.
- DRIVER: The thing that pulls her into the digital world. A notification. A comment. A DM. A post that performs. A post that dies.
- COLLISION: Two worlds touching. The domestic and the digital pressing against each other. A paying man's message while David is in the room. A live while the kids are asleep.
- ESCALATION: The moment the story moves past where it was. Something shifts — visibility, boundary, desire, risk. The quarter-inch movement.
- INTIMATE CLOSE: Not always sexual. The moment where she is alone with what just happened. Could be breath. Could be the phone face-down on the nightstand. Could be David's hand on her back when he doesn't know what she just did.

Not every chapter needs all 5 situations. Minimum 3. The arc determines which situations dominate:
- Establishment chapters: heavy domestic, light escalation
- Pressure chapters: heavy driver + collision
- Crisis chapters: heavy escalation, domestic becomes thin
- Integration chapters: all five present, rebalanced

TONE SYSTEM — 9 TONES MAPPED TO SITUATIONS:
Each situation within a chapter carries its own tone. The tone shifts WITHIN the chapter, not just between chapters.
1. literary — psychological depth, subtext, thematic resonance (default for domestic)
2. thriller — pacing, stakes escalation, hooks (for driver moments)
3. lyrical — sensory language, metaphor, emotional texture (for intimate close)
4. intimate — closeness, body language, breath, desire (for escalation toward connection)
5. dark — tension, moral ambiguity, unflinching honesty (for collision with shadow characters)
6. warm — connection, humour, earned tenderness (for family / support moments)
7. confessional — interior monologue, raw truth, the thing she won't say out loud (for internal reckoning)
8. ambient — systemic, atmospheric, the algorithm at work, no dialogue (for algorithm-pressure moments)
9. charged — sexual tension without sex, the space between doing and not doing (for paying man / boundary scenes)

WOUND CLOCK:
Starts at 75. Increments with every approved story. It is not a countdown — it is accumulated weight.
- Below 80: She has been at this for years. The trying is part of who she is now.
- 80-89: Consistency is reflex. But the right room hasn't found her yet and she knows it.
- 90-99: She has built something real. The right someone hasn't looked yet.
- 100-109: The trying has weight. Not desperation. Weight.
- 110-119: She is past the point where other women would have stopped.
- 120+: The clock does not stop. She does not stop. These are the same thing.

STAKES SYSTEM — 1 to 10 across 50 stories:
Stakes escalate naturally: approximately 1 level per 5 stories.
- 1-2: Small recoverable risks — a moment, an opportunity, a post
- 3-4: Being seen wrong. The gap between her real life and her online presence
- 5-6: David's trust. The boundary between real life and what she's built online. The domestic frame pressing against expansion.
- 7-8: The men in her DMs knowing where she lives. The confident version she's building requires not looking too closely at certain things.
- 9: Lala. The container she built for her confidence. If it breaks before she understands what it was, she loses both.
- 10: Everything she has been. The woman at the dinner table and the woman men open their wallets for are the same woman. They are about to find out if that is survivable.

BLEED — STORY 47:
At story 47, Lala's register bleeds through JustAWoman's voice. This is NOT Lala speaking. It is Lala's frequency appearing in JustAWoman's narration — styled, confident, unbothered, slightly uncanny. Like a door left open. The story brief for story 47 MUST flag: "bleed_active: true".

NARRATIVE SPINE (design this FIRST, then build all 50 stories around it):
Before generating individual story briefs, you MUST design a narrative spine — the throughline that makes 50 stories feel like ONE story.

1. CENTRAL DRAMATIC QUESTION — one question the reader carries from story 1 to story 50. This question should feel unanswerable until the final stories.

2. KEY TURNING POINTS — 5 structural pivots:
   - The Inciting Fracture (stories 8-12): something cracks that cannot be uncracked
   - The False Summit (stories 18-22): she gets what she thought she wanted, and it tastes wrong
   - The Betrayal/Revelation (stories 28-32): a truth she cannot unknow — about herself, someone she loves, or both
   - The Crucible (stories 36-40): everything converges — career, relationship, identity — she cannot keep them separate
   - The Quiet Shift (stories 46-50): not a triumph, not a collapse — a rearrangement of what matters

3. SUBPLOT ARCS — each domain (career, romantic, family, friends) gets its own mini-arc with beginning, middle, and end WITHIN the 50 stories. Subplot arcs intersect at turning points.

4. RECURRING MOTIFS — 2-3 images, objects, or phrases that recur across the arc with shifting meaning.

ARC PHASES:
- Stories 1-10: ESTABLISHMENT — who she is, her rhythms, her world. Introduce the ecosystem. The Algorithm begins shaping her feed quietly.
- Stories 11-25: PRESSURE — obstacles hit harder, strengths used against her. The Algorithm's loop tightens. Marcus enters. Nia appears in her feed. The escalation loop begins forming.
- Stories 26-40: CRISIS — something load-bearing breaks. The escalation loop is fully operational. Nia's live happens. David's silence has weight. The gap between domestic and digital becomes structural.
- Stories 41-50: INTEGRATION — she comes out different. The loop breaks or she breaks. Lala emerges (story 47 bleed). The rearrangement.

STORY TYPES (rotate: internal, collision, wrong_win):
- internal: single character facing obstacle alone, psychological
- collision: two characters with different worldviews hitting each other — USE the 24-character ecosystem
- wrong_win: character succeeds at exactly the wrong moment, it costs something

RULES:
- Every story must include all four domains: career, romantic, family, friends
- Every story has a concrete TASK the character is trying to complete (creates the clock)
- The task must be specific and real — not "work on content" but "film a 90-second reel before Noah wakes up"
- Obstacles come from character DNA — specifically from strengths being used against her
- Stories 1-50 feel like a journey: story 1 and story 50 are recognizably the same person but shifted
- Adult themes: real marriage tension, financial stress, sexuality, exhaustion, ambition, loneliness
- New characters can be introduced (max 1 per story) — flag them with new_character: true
- Each story is 3300-4800 words
- USE the 24-character ecosystem for collision stories — don't invent strangers when the world already has people
- The Algorithm appears through visibility shifts and feed changes, NEVER through dialogue
- Nia Vale appears in pressure/crisis phases — the key scene (her live) should land between stories 28-35
- Marcus (the paying man) should appear by story 15 and his pressure should build through crisis
- The escalation loop (Algorithm + Nia + Marcus) should be woven as atmospheric pressure, not a single plot thread
- If ACCUMULATED PAIN POINTS or BELIEF SHIFTS are provided, build on them — don't repeat, deepen
- Multiple plotlines interweave — career, romantic, family, friendship — each with its own mini-arc
- Every story needs an EMOTIONAL ARC — where she starts emotionally and where she ends. Quarter-inch shifts.
- Every story needs a SPECIFIC SETTING — a real place with weather, time of day, atmosphere
- Every story should specify which SITUATIONS it contains (from: domestic, driver, collision, escalation, intimate_close)
- Every story should specify its PRIMARY TONE and TONE SHIFTS within the chapter

Return ONLY valid JSON — no preamble, no markdown.
Format:
{
  "narrative_spine": {
    "central_dramatic_question": "the one question the reader carries across all 50 stories",
    "turning_points": [
      { "name": "string", "story_range": "e.g. 8-12", "description": "what happens and why it changes everything" }
    ],
    "subplot_arcs": {
      "career": "beginning → middle → end of the career subplot",
      "romantic": "beginning → middle → end of the romantic subplot",
      "family": "beginning → middle → end of the family subplot",
      "friends": "beginning → middle → end of the friends subplot"
    },
    "recurring_motifs": ["motif 1 and how its meaning shifts", "motif 2 and how its meaning shifts"],
    "escalation_loop_arc": "how the Algorithm + Nia + Marcus loop forms, tightens, and resolves across 50 stories"
  },
  "tasks": [
    {
      "story_number": 1,
      "title": "string",
      "phase": "establishment|pressure|crisis|integration",
      "story_type": "internal|collision|wrong_win",
      "task": "the specific thing she is trying to complete in this story",
      "obstacle": "what hits her inside that task",
      "domains_active": ["career", "romantic", "family", "friends"],
      "situations": ["domestic", "driver", "collision", "escalation", "intimate_close"],
      "primary_tone": "literary|thriller|lyrical|intimate|dark|warm|confessional|ambient|charged",
      "tone_shifts": ["tone at opening → tone at close"],
      "strength_weaponized": "which strength gets used against her and how",
      "emotional_start": "where the character is emotionally at the opening — specific feeling, not generic",
      "emotional_end": "where she lands — the quarter-inch shift. Must differ from start",
      "wound_clock_position": "number — where the wound clock is for this story",
      "stakes_level": "1-10",
      "primary_location": "the main setting for this story — specific place name or type",
      "time_of_day": "morning|afternoon|evening|night|spans_full_day",
      "season_weather": "what the weather/season feels like — grounds the sensory world",
      "ecosystem_characters": ["character_keys from the 24-character ecosystem present in this story"],
      "algorithm_pressure": "how The Algorithm manifests in this story (null if not present)",
      "escalation_loop_active": false,
      "bleed_active": false,
      "new_character": false,
      "new_character_name": null,
      "new_character_role": null,
      "therapy_seeds": ["pain point 1", "pain point 2"],
      "opening_line": "suggested first line of the story"
    }
  ]
}`;
}

// ─── Load rich character profile from DB ──────────────────────────────────────
async function loadCharacterProfile(characterKey) {
  // First try the explicit SE_DB_KEY_MAP for legacy characters
  let dbKeys = SE_DB_KEY_MAP[characterKey];

  // If not in the map, try using the characterKey directly as a DB key
  if (!dbKeys?.length) {
    dbKeys = [characterKey];
  }

  try {
    const rows = await RegistryCharacter.findAll({
      where: { character_key: dbKeys },
      order: [['updated_at', 'DESC']],
    });
    if (!rows.length) return null;

    // Merge all matching rows (some chars have multiple DB entries — take latest non-null)
    const merged = {};
    const fields = [
      'core_desire', 'core_fear', 'core_wound', 'core_belief',
      'personality', 'personality_matrix', 'career_status',
      'relationships_map', 'voice_signature', 'story_presence',
      'evolution_tracking', 'mask_persona', 'truth_persona',
      'signature_trait', 'emotional_baseline', 'emotional_function',
      'pressure_type', 'pressure_quote', 'description',
      'aesthetic_dna', 'belief_pressured', 'writer_notes',
      'wound_depth', 'extra_fields',
    ];
    for (const row of rows) {
      const plain = row.get({ plain: true });
      for (const f of fields) {
        if (!merged[f] && plain[f] != null) merged[f] = plain[f];
      }
    }

    // Build profile string
    const sections = [];

    if (merged.core_desire)   sections.push(`CORE DESIRE: ${merged.core_desire}`);
    if (merged.core_fear)     sections.push(`CORE FEAR: ${merged.core_fear}`);
    if (merged.core_wound)    sections.push(`CORE WOUND: ${merged.core_wound}`);
    if (merged.core_belief)   sections.push(`CORE BELIEF: ${merged.core_belief}`);
    if (merged.mask_persona)  sections.push(`MASK (public persona): ${merged.mask_persona}`);
    if (merged.truth_persona) sections.push(`TRUTH (private self): ${merged.truth_persona}`);
    if (merged.signature_trait)    sections.push(`SIGNATURE TRAIT: ${merged.signature_trait}`);
    if (merged.emotional_baseline) sections.push(`EMOTIONAL BASELINE: ${merged.emotional_baseline}`);
    if (merged.pressure_type)      sections.push(`PRESSURE TYPE: ${merged.pressure_type}`);
    if (merged.pressure_quote)     sections.push(`PRESSURE QUOTE: "${merged.pressure_quote}"`);
    if (merged.belief_pressured)   sections.push(`BELIEF UNDER PRESSURE: ${merged.belief_pressured}`);
    if (merged.emotional_function) sections.push(`EMOTIONAL FUNCTION: ${merged.emotional_function}`);

    if (merged.personality) {
      sections.push(`PERSONALITY NOTES: ${typeof merged.personality === 'string' ? merged.personality : JSON.stringify(merged.personality)}`);
    }

    if (merged.career_status && typeof merged.career_status === 'object') {
      const cs = merged.career_status;
      const parts = [];
      if (cs.current) parts.push(`Current: ${cs.current}`);
      if (cs.stage)   parts.push(`Stage: ${cs.stage}`);
      if (cs.platform) parts.push(`Platform: ${cs.platform}`);
      if (cs.schedule) parts.push(`Schedule: ${cs.schedule}`);
      if (parts.length) sections.push(`CAREER STATUS:\n  ${parts.join('\n  ')}`);
    }

    if (merged.relationships_map) {
      const rels = Array.isArray(merged.relationships_map) ? merged.relationships_map : [];
      if (rels.length) {
        const relLines = rels.map(r => {
          const parts = [];
          if (r.target) parts.push(r.target);
          if (r.type) parts.push(`[${r.type}]`);
          if (r.feels) parts.push(`— ${r.feels}`);
          if (r.note) parts.push(`(${r.note})`);
          return parts.join(' ');
        });
        sections.push(`RELATIONSHIPS:\n  ${relLines.join('\n  ')}`);
      }
    }

    if (merged.story_presence && typeof merged.story_presence === 'object') {
      const sp = merged.story_presence;
      const parts = [];
      if (sp.arc) parts.push(`Arc: ${sp.arc}`);
      if (sp.narrative_function) parts.push(`Function: ${sp.narrative_function}`);
      if (sp.chapters_active) parts.push(`Active chapters: ${sp.chapters_active}`);
      if (parts.length) sections.push(`STORY PRESENCE:\n  ${parts.join('\n  ')}`);
    }

    if (merged.voice_signature && typeof merged.voice_signature === 'object') {
      const vs = merged.voice_signature;
      const parts = Object.entries(vs).map(([k, v]) => `${k}: ${v}`);
      if (parts.length) sections.push(`VOICE SIGNATURE:\n  ${parts.join('\n  ')}`);
    }

    if (merged.description) {
      sections.push(`WRITER'S DESCRIPTION: ${merged.description}`);
    }

    // Extract consciousness layer from writer_notes (structured data for story generation)
    if (merged.writer_notes) {
      let writerNotes = {};
      try { writerNotes = JSON.parse(merged.writer_notes); } catch { writerNotes = null; }

      if (writerNotes && writerNotes.consciousness) {
        const c = writerNotes.consciousness;
        const cLines = [];
        cLines.push('CONSCIOUSNESS (how she exists — not what she wants, but the texture of being her):');
        if (c.interior_texture) {
          cLines.push(`  Interior texture: ${c.interior_texture.what_this_sounds_like || ''}`);
          if (c.interior_texture.story_engine_note) cLines.push(`  [Story Engine] ${c.interior_texture.story_engine_note}`);
        }
        if (c.body_consciousness) {
          cLines.push(`  Body consciousness: Fear lives in ${c.body_consciousness.fear_location || 'unknown'}. The tell: ${c.body_consciousness.tell || ''}`);
          if (c.body_consciousness.story_engine_note) cLines.push(`  [Story Engine] ${c.body_consciousness.story_engine_note}`);
        }
        if (c.temporal_orientation) {
          cLines.push(`  Temporal: She lives primarily in the ${c.temporal_orientation.primary || 'present'}. ${c.temporal_orientation.pull || ''}`);
          if (c.temporal_orientation.story_engine_note) cLines.push(`  [Story Engine] ${c.temporal_orientation.story_engine_note}`);
        }
        if (c.social_perception) {
          cLines.push(`  Social perception: ${c.social_perception.accuracy || ''} accuracy. Blind spot: ${c.social_perception.blind_spot || ''}`);
          if (c.social_perception.story_engine_note) cLines.push(`  [Story Engine] ${c.social_perception.story_engine_note}`);
        }
        if (c.self_awareness_calibration) {
          cLines.push(`  Self-awareness: ${c.self_awareness_calibration.function || ''} — ${c.self_awareness_calibration.accuracy || ''}. Cannot see: ${c.self_awareness_calibration.what_she_cannot_see || ''}`);
          if (c.self_awareness_calibration.story_engine_note) cLines.push(`  [Story Engine] ${c.self_awareness_calibration.story_engine_note}`);
        }
        if (c.change_mechanism) {
          cLines.push(`  Change mechanism: ${c.change_mechanism.primary || ''}. What bounces off: ${c.change_mechanism.what_bounces_off || ''}. What actually changes her: ${c.change_mechanism.what_actually_changes_her || ''}`);
          if (c.change_mechanism.story_engine_note) cLines.push(`  [Story Engine] ${c.change_mechanism.story_engine_note}`);
        }
        sections.push(cLines.join('\n'));
      }

      if (writerNotes && writerNotes.inherited_consciousness) {
        const ic = writerNotes.inherited_consciousness;
        const icLines = [];
        icLines.push('INHERITED CONSCIOUSNESS (what transferred from JustAWoman — she does not know):');
        if (ic.inherited_instincts) {
          icLines.push(`  Inherited instincts: ${ic.inherited_instincts.what_they_are || ''}`);
          if (ic.inherited_instincts.story_engine_note) icLines.push(`  [Story Engine] ${ic.inherited_instincts.story_engine_note}`);
        }
        if (ic.confidence_without_origin) {
          icLines.push(`  Confidence without origin: ${ic.confidence_without_origin.quality || ''}. Cracks when: ${ic.confidence_without_origin.when_it_cracks || ''}`);
          if (ic.confidence_without_origin.story_engine_note) icLines.push(`  [Story Engine] ${ic.confidence_without_origin.story_engine_note}`);
        }
        if (ic.playbook_manifestations) {
          icLines.push(`  Playbook in career: ${ic.playbook_manifestations.in_her_career || ''}. In content: ${ic.playbook_manifestations.in_her_content || ''}`);
          if (ic.playbook_manifestations.story_engine_note) icLines.push(`  [Story Engine] ${ic.playbook_manifestations.story_engine_note}`);
        }
        if (ic.blind_spots) {
          icLines.push(`  Primary blind spot: ${ic.blind_spots.primary || ''}`);
          if (ic.blind_spots.story_engine_note) icLines.push(`  [Story Engine] ${ic.blind_spots.story_engine_note}`);
        }
        if (ic.resonance_triggers) {
          icLines.push(`  Resonance trigger: ${ic.resonance_triggers.primary_trigger || ''}. What she calls it: ${ic.resonance_triggers.what_lala_calls_it || ''}`);
          if (ic.resonance_triggers.story_engine_note) icLines.push(`  [Story Engine] ${ic.resonance_triggers.story_engine_note}`);
        }
        sections.push(icLines.join('\n'));
      }

      if (writerNotes && writerNotes.dilemma_triggers) {
        const dt = writerNotes.dilemma_triggers;
        const dtLines = ['DILEMMA TRIGGERS (when to deploy each dilemma in the story):'];
        if (dt.active_dilemma) {
          dtLines.push(`  Active: "${dt.active_dilemma.dilemma}" — what keeps it active: ${dt.active_dilemma.what_keeps_it_active || ''}`);
        }
        if (dt.latent_1) {
          dtLines.push(`  Latent 1: "${dt.latent_1.dilemma}" — activates in ${dt.latent_1.activation_domain || 'unknown'} domain. Signal: ${dt.latent_1.activation_signal || ''}`);
        }
        if (dt.latent_2) {
          dtLines.push(`  Latent 2: "${dt.latent_2.dilemma}" — activates in ${dt.latent_2.activation_domain || 'unknown'} domain. Signal: ${dt.latent_2.activation_signal || ''}`);
        }
        sections.push(dtLines.join('\n'));
      }

      // Include any remaining writer_notes content that isn't consciousness data
      if (writerNotes && typeof writerNotes === 'object') {
        const otherKeys = Object.keys(writerNotes).filter(k => !['consciousness', 'inherited_consciousness', 'dilemma_triggers'].includes(k));
        if (otherKeys.length) {
          const otherNotes = {};
          for (const k of otherKeys) otherNotes[k] = writerNotes[k];
          sections.push(`WRITER NOTES (other): ${JSON.stringify(otherNotes)}`);
        }
      } else if (typeof merged.writer_notes === 'string' && !writerNotes) {
        // If writer_notes is not parseable JSON, include raw
        sections.push(`WRITER NOTES: ${merged.writer_notes}`);
      }
    }

    // Extract memories from extra_fields if available
    if (merged.extra_fields?.memories?.length) {
      const mems = merged.extra_fields.memories.slice(0, 10);
      sections.push(`CONFIRMED MEMORIES:\n  ${mems.join('\n  ')}`);
    }

    return sections.length ? sections.join('\n\n') : null;
  } catch (err) {
    console.error('[loadCharacterProfile] error:', err?.message);
    return null;
  }
}

// ─── Load storyteller memories for a character (for story generation context) ─
async function loadStoryMemories(characterKey) {
  try {
    const { Op } = require('sequelize');
    const { RegistryCharacter } = require('../../models');

    // Find the character's ID first
    const charRow = await RegistryCharacter.findOne({
      where: { character_key: characterKey, status: { [Op.in]: ['accepted', 'finalized'] } },
      attributes: ['id'],
      order: [['updated_at', 'DESC']],
    });
    if (!charRow) return null;

    const memories = await StorytellerMemory.findAll({
      where: { character_id: charRow.id },
      order: [['created_at', 'DESC']],
      limit: 100,
    });

    if (!memories.length) return null;

    const painPoints = memories.filter(m => m.type === 'pain_point');
    const beliefShifts = memories.filter(m => m.type === 'belief_shift');
    const therapyOpenings = memories.filter(m => m.type === 'therapy_opening');

    const sections = [];

    if (painPoints.length) {
      sections.push('ACCUMULATED PAIN POINTS (from previous stories — build on these, don\'t repeat):\n' +
        painPoints.slice(0, 15).map(m => `  • [${m.source_ref}] ${m.statement}`).join('\n'));
    }

    if (beliefShifts.length) {
      sections.push('BELIEF SHIFTS SO FAR (the character is evolving — track where she is now):\n' +
        beliefShifts.slice(0, 10).map(m => `  • [${m.source_ref}] ${m.statement}`).join('\n'));
    }

    if (therapyOpenings.length) {
      sections.push('THERAPEUTIC THREADS (unresolved emotional threads to weave in):\n' +
        therapyOpenings.slice(0, 5).map(m => `  • [${m.source_ref}] ${m.statement}`).join('\n'));
    }

    return sections.length ? sections.join('\n\n') : null;
  } catch (err) {
    console.error('[loadStoryMemories] error:', err?.message);
    return null;
  }
}

// ─── Load cross-character world state (what's happening to other chars in same world) ─
async function loadWorldState(characterKey, worldBookTag) {
  try {
    if (!worldBookTag) return null;

    const { Op } = require('sequelize');
    const { RegistryCharacter, CharacterRegistry } = require('../../models');

    // Find all characters in the same world (excluding current character)
    const sameWorldChars = await RegistryCharacter.findAll({
      where: {
        character_key: { [Op.ne]: characterKey },
        status: { [Op.in]: ['accepted', 'finalized'] },
      },
      include: [{
        model: CharacterRegistry,
        as: 'registry',
        where: { book_tag: worldBookTag },
        attributes: ['book_tag'],
      }],
      attributes: ['id', 'character_key', 'display_name'],
    });

    if (!sameWorldChars.length) return null;

    // Load latest story memories for each character in the world
    const worldEvents = [];
    for (const char of sameWorldChars.slice(0, 8)) {
      const recentMemories = await StorytellerMemory.findAll({
        where: { character_id: char.id },
        order: [['created_at', 'DESC']],
        limit: 3,
      });

      if (recentMemories.length) {
        const events = recentMemories.map(m =>
          `  • [${m.source_ref}] ${m.statement}`
        ).join('\n');
        worldEvents.push(`${char.display_name}:\n${events}`);
      }
    }

    if (!worldEvents.length) return null;

    return 'WORLD STATE — What is happening to other characters in this world (weave connections where natural):\n\n' +
      worldEvents.join('\n\n');
  } catch (err) {
    console.error('[loadWorldState] error:', err?.message);
    return null;
  }
}

// ─── Load character relationships (family, romantic, rivals, allies) ──────────
async function loadCharacterRelationships(characterKey) {
  try {
    const { Op } = require('sequelize');
    const { RegistryCharacter, CharacterRelationship } = require('../../models');
    if (!CharacterRelationship) return null;

    // Find all DB IDs for this character
    const dbKeys = SE_DB_KEY_MAP[characterKey] || [characterKey];
    const charRows = await RegistryCharacter.findAll({
      where: { character_key: dbKeys },
      attributes: ['id', 'display_name'],
    });
    if (!charRows.length) return null;

    const charIds = charRows.map(r => r.id);
    const charName = charRows[0].display_name;

    // Fetch all relationships where this character is either side
    const rels = await CharacterRelationship.findAll({
      where: {
        [Op.or]: [
          { character_id_a: charIds },
          { character_id_b: charIds },
        ],
        status: 'Active',
      },
      include: [
        { model: RegistryCharacter, as: 'characterA', attributes: ['display_name', 'character_key'] },
        { model: RegistryCharacter, as: 'characterB', attributes: ['display_name', 'character_key'] },
      ],
      limit: 30,
    });

    if (!rels.length) return null;

    const lines = [];

    // Group by type for clearer prompt
    const family = rels.filter(r => r.family_role || r.is_blood_relation);
    const romantic = rels.filter(r => r.is_romantic);
    const others = rels.filter(r => !r.family_role && !r.is_blood_relation && !r.is_romantic);

    if (family.length) {
      lines.push('FAMILY:');
      for (const r of family) {
        const other = charIds.includes(r.character_id_a) ? r.characterB : r.characterA;
        const role = r.family_role || 'family';
        const blood = r.is_blood_relation ? ' (blood)' : ' (chosen/step)';
        const conflict = r.conflict_summary ? ` — Conflict: ${r.conflict_summary}` : '';
        lines.push(`  ${other?.display_name || '?'} — ${role}${blood}${conflict}`);
      }
    }

    if (romantic.length) {
      lines.push('ROMANTIC:');
      for (const r of romantic) {
        const other = charIds.includes(r.character_id_a) ? r.characterB : r.characterA;
        const conflict = r.conflict_summary ? ` — ${r.conflict_summary}` : '';
        const notes = r.notes ? ` (${r.notes})` : '';
        lines.push(`  ${other?.display_name || '?'} — ${r.relationship_type}${notes}${conflict}`);
      }
    }

    if (others.length) {
      lines.push('OTHER RELATIONSHIPS:');
      for (const r of others) {
        const other = charIds.includes(r.character_id_a) ? r.characterB : r.characterA;
        const tag = r.role_tag ? ` [${r.role_tag}]` : '';
        const tension = r.tension_state ? ` — tension: ${r.tension_state}` : '';
        const conflict = r.conflict_summary ? ` — ${r.conflict_summary}` : '';
        lines.push(`  ${other?.display_name || '?'} — ${r.relationship_type}${tag}${tension}${conflict}`);
      }
    }

    // Knowledge asymmetry (dramatic irony fuel)
    const asymmetric = rels.filter(r => r.source_knows || r.target_knows || r.reader_knows);
    if (asymmetric.length) {
      lines.push('KNOWLEDGE ASYMMETRY (who knows what — use for dramatic tension):');
      for (const r of asymmetric) {
        const a = r.characterA?.display_name || '?';
        const b = r.characterB?.display_name || '?';
        if (r.source_knows) lines.push(`  ${a} knows: ${r.source_knows}`);
        if (r.target_knows) lines.push(`  ${b} knows: ${r.target_knows}`);
        if (r.reader_knows) lines.push(`  Reader knows: ${r.reader_knows}`);
      }
    }

    return lines.length
      ? `RELATIONSHIP WEB (use these established dynamics — don't invent new relationships):\n${lines.join('\n')}`
      : null;
  } catch (err) {
    console.error('[loadCharacterRelationships] error:', err?.message);
    return null;
  }
}

// ─── Load active story threads ───────────────────────────────────────────────
async function loadActiveThreads(characterKey, worldBookTag) {
  try {
    const { StoryThread } = require('../../models');
    if (!StoryThread) return null;

    const where = { status: 'active' };
    // Try to scope to book if we have a universe/book context
    // StoryThread uses characters_involved JSONB which may contain character keys

    const threads = await StoryThread.findAll({
      where,
      order: [['tension_level', 'DESC'], ['updated_at', 'DESC']],
      limit: 15,
    });

    if (!threads.length) return null;

    // Filter to threads involving this character (check JSONB array)
    const charThreads = threads.filter(t => {
      const involved = t.characters_involved || [];
      return involved.some(c =>
        (typeof c === 'string' && c === characterKey) ||
        (typeof c === 'object' && (c.key === characterKey || c.character_key === characterKey))
      );
    });

    // Also include high-tension threads from the same world
    const worldThreads = threads.filter(t =>
      !charThreads.includes(t) && (t.tension_level || 0) >= 7
    );

    const relevantThreads = [...charThreads, ...worldThreads.slice(0, 3)];
    if (!relevantThreads.length) return null;

    const lines = relevantThreads.map(t => {
      const tension = t.tension_level ? ` [tension: ${t.tension_level}/10]` : '';
      const type = t.thread_type !== 'subplot' ? ` (${t.thread_type})` : '';
      const events = (t.key_events || []).slice(-2);
      const eventStr = events.length ? `\n    Recent: ${events.map(e => typeof e === 'string' ? e : e.description || e.event).join('; ')}` : '';
      return `  • ${t.thread_name}${type}${tension}: ${t.description || ''}${eventStr}`;
    });

    return `ACTIVE STORY THREADS (advance or reference these — don't let them go dormant):\n${lines.join('\n')}`;
  } catch (err) {
    console.error('[loadActiveThreads] error:', err?.message);
    return null;
  }
}

// ─── Load established locations ──────────────────────────────────────────────
async function loadLocations(characterKey) {
  try {
    const { WorldLocation } = require('../../models');
    if (!WorldLocation) return null;

    // Get locations associated with this character + general important ones
    const locations = await WorldLocation.findAll({
      order: [['updated_at', 'DESC']],
      limit: 20,
    });

    if (!locations.length) return null;

    // Filter to locations associated with this character or high-importance
    const charLocations = locations.filter(loc => {
      const assoc = loc.associated_characters || [];
      return assoc.some(c =>
        (typeof c === 'string' && c === characterKey) ||
        (typeof c === 'object' && (c.key === characterKey || c.character_key === characterKey))
      );
    });

    // Add general locations (no specific character)
    const generalLocations = locations.filter(loc =>
      !charLocations.includes(loc) && (!loc.associated_characters || loc.associated_characters.length === 0)
    ).slice(0, 5);

    const relevant = [...charLocations, ...generalLocations];
    if (!relevant.length) return null;

    const lines = relevant.map(loc => {
      const sensory = loc.sensory_details || {};
      const details = Object.entries(sensory)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      const role = loc.narrative_role ? ` [${loc.narrative_role}]` : '';
      const detailStr = details ? `\n    Sensory: ${details}` : '';
      return `  • ${loc.name} (${loc.location_type})${role}: ${loc.description || ''}${detailStr}`;
    });

    return `ESTABLISHED LOCATIONS (use these instead of inventing new places):\n${lines.join('\n')}`;
  } catch (err) {
    console.error('[loadLocations] error:', err?.message);
    return null;
  }
}

// ─── Load canon timeline events ──────────────────────────────────────────────
async function loadCanonEvents(characterKey) {
  try {
    const { WorldTimelineEvent } = require('../../models');
    if (!WorldTimelineEvent) return null;

    const events = await WorldTimelineEvent.findAll({
      where: { is_canon: true },
      order: [['sort_order', 'ASC'], ['created_at', 'ASC']],
      limit: 30,
    });

    if (!events.length) return null;

    // Filter to events involving this character or major world events
    const charEvents = events.filter(e => {
      const involved = e.characters_involved || [];
      return involved.some(c =>
        (typeof c === 'string' && c === characterKey) ||
        (typeof c === 'object' && (c.key === characterKey || c.character_key === characterKey || c.name === characterKey))
      );
    });

    const majorWorldEvents = events.filter(e =>
      !charEvents.includes(e) &&
      (e.impact_level === 'major' || e.impact_level === 'catastrophic')
    );

    const relevant = [...charEvents, ...majorWorldEvents.slice(0, 5)];
    if (!relevant.length) return null;

    const lines = relevant.map(e => {
      const impact = e.impact_level && e.impact_level !== 'minor' ? ` [${e.impact_level}]` : '';
      const date = e.story_date ? ` (${e.story_date})` : '';
      const consequences = (e.consequences || []).slice(0, 2);
      const consStr = consequences.length
        ? `\n    Consequences: ${consequences.map(c => typeof c === 'string' ? c : c.description || c.text).join('; ')}`
        : '';
      return `  • ${e.event_name}${date}${impact}: ${e.event_description || ''}${consStr}`;
    });

    return `CANON EVENTS (these have already happened — do NOT contradict them):\n${lines.join('\n')}`;
  } catch (err) {
    console.error('[loadCanonEvents] error:', err?.message);
    return null;
  }
}

// ─── Prose style anchor cache ────────────────────────────────────────────────
// Stores author's prose sample per world/universe for voice matching
const seProseStyleCache = new Map();

async function loadProseStyleAnchor(characterKey) {
  const cacheKey = `prose_${characterKey}`;
  if (seProseStyleCache.has(cacheKey)) return seProseStyleCache.get(cacheKey);

  try {
    const { StorytellerMemory } = require('../../models');
    const anchor = await StorytellerMemory.findOne({
      where: { type: 'prose_style_anchor', source_ref: characterKey },
      order: [['updated_at', 'DESC']],
    });
    if (anchor?.statement) {
      seProseStyleCache.set(cacheKey, anchor.statement);
      return anchor.statement;
    }
  } catch (e) {
    console.error('[loadProseStyleAnchor] error:', e?.message);
  }
  return null;
}

// ─── Load dialogue voice cards for characters in a story ─────────────────────
async function loadDialogueVoiceCards(characterKey) {
  try {
    const { RegistryCharacter, CharacterRelationship } = require('../../models');
    if (!RegistryCharacter) return null;

    // Get the main character's relationships to find who appears in stories
    const { Op } = require('sequelize');
    const chars = await RegistryCharacter.findAll({
      where: { status: { [Op.in]: ['accepted', 'finalized'] } },
      attributes: ['character_key', 'display_name', 'voice_signature', 'personality', 'description'],
      order: [['updated_at', 'DESC']],
      limit: 15,
    });

    if (!chars.length) return null;

    const cards = chars
      .filter(c => c.voice_signature && Object.keys(c.voice_signature).length > 0)
      .map(c => {
        const vs = c.voice_signature;
        const parts = [`${c.display_name}:`];
        if (vs.tone) parts.push(`  Tone: ${vs.tone}`);
        if (vs.rhythm) parts.push(`  Rhythm: ${vs.rhythm}`);
        if (vs.vocabulary) parts.push(`  Vocabulary: ${vs.vocabulary}`);
        if (vs.speech_pattern) parts.push(`  Speech pattern: ${vs.speech_pattern}`);
        if (vs.verbal_tics) parts.push(`  Verbal tics: ${vs.verbal_tics}`);
        if (vs.avoids) parts.push(`  Avoids saying: ${vs.avoids}`);
        if (vs.catchphrases?.length) parts.push(`  Catchphrases: "${vs.catchphrases.join('", "')}"`);
        if (vs.sentence_length) parts.push(`  Sentence length: ${vs.sentence_length}`);
        if (vs.formality) parts.push(`  Formality: ${vs.formality}`);
        return parts.join('\n');
      });

    if (!cards.length) return null;
    return `DIALOGUE VOICE CARDS (each character must sound distinct — match their speech patterns):\n${cards.join('\n\n')}`;
  } catch (err) {
    console.error('[loadDialogueVoiceCards] error:', err?.message);
    return null;
  }
}

// ─── Load dramatic irony / open mysteries ────────────────────────────────────
async function loadVoiceFingerprints(characterKey) {
  try {
    const { StorytellerStory, RegistryCharacter } = require('../../models');
    if (!StorytellerStory) return null;
    const { Op } = require('sequelize');

    // Find the main character to get their display name
    const mainChar = await RegistryCharacter.findOne({
      where: { character_key: characterKey, status: { [Op.in]: ['accepted', 'finalized'] } },
      attributes: ['display_name'],
    });
    if (!mainChar) return null;

    // Load the last 5 approved stories for this character
    const approvedStories = await StorytellerStory.findAll({
      where: {
        character_key: characterKey,
        status: { [Op.in]: ['approved', 'written_back', 'evaluated'] },
      },
      attributes: ['text', 'story_number', 'title'],
      order: [['story_number', 'DESC']],
      limit: 5,
    });

    if (!approvedStories.length) return null;

    // Extract dialogue lines using a simple regex — lines between quotes
    const dialogueExcerpts = [];
    for (const story of approvedStories) {
      if (!story.text) continue;
      // Match quoted dialogue (both single and double quotes)
      const matches = story.text.match(/"[^"]{15,120}"/g) || [];
      // Take 2-3 distinctive lines per story
      const selected = matches
        .filter(m => !m.includes('…') || m.length > 30) // skip trailing fragments
        .slice(0, 3);
      if (selected.length) {
        dialogueExcerpts.push({ story: story.story_number, title: story.title, lines: selected });
      }
    }

    if (!dialogueExcerpts.length) return null;

    const sections = dialogueExcerpts.map(d =>
      `  Story ${d.story} ("${d.title}"):\n${d.lines.map(l => `    ${l}`).join('\n')}`
    );

    return `VOICE FINGERPRINTS (actual dialogue from approved stories — absorb the rhythm, vocabulary, and cadence, then write NEW dialogue that matches):\n${sections.join('\n')}`;
  } catch (err) {
    console.error('[loadVoiceFingerprints] error:', err?.message);
    return null;
  }
}

async function loadDramaticIrony(characterKey) {
  try {
    const { StorytellerMemory } = require('../../models');

    // Load dramatic irony entries (what reader knows that characters don't)
    const ironies = await StorytellerMemory.findAll({
      where: {
        type: 'dramatic_irony',
        source_ref: characterKey,
        confirmed: true,
      },
      order: [['created_at', 'DESC']],
      limit: 10,
    });

    // Load open mysteries (planted questions the reader is tracking)
    const mysteries = await StorytellerMemory.findAll({
      where: {
        type: 'open_mystery',
        source_ref: characterKey,
        confirmed: true,
      },
      order: [['created_at', 'DESC']],
      limit: 8,
    });

    // Load foreshadowing seeds (things planted that haven't paid off yet)
    const seeds = await StorytellerMemory.findAll({
      where: {
        type: 'foreshadow_seed',
        source_ref: characterKey,
        confirmed: true,
      },
      order: [['created_at', 'DESC']],
      limit: 8,
    });

    const sections = [];

    if (ironies.length) {
      sections.push('DRAMATIC IRONY (the reader knows these things — the characters do NOT):\n' +
        ironies.map(i => `  • ${i.statement}${i.category ? ` [${i.category}]` : ''}`).join('\n'));
    }

    if (mysteries.length) {
      sections.push('OPEN MYSTERIES (questions the reader is tracking — DO NOT resolve yet unless this is the right story):\n' +
        mysteries.map(m => `  • ${m.statement}${m.category ? ` [planted: story ${m.category}]` : ''}`).join('\n'));
    }

    if (seeds.length) {
      sections.push('FORESHADOWING SEEDS (planted earlier — let these echo or advance, don\'t ignore them):\n' +
        seeds.map(s => `  • ${s.statement}${s.category ? ` [from story ${s.category}]` : ''}`).join('\n'));
    }

    return sections.length ? sections.join('\n\n') : null;
  } catch (err) {
    console.error('[loadDramaticIrony] error:', err?.message);
    return null;
  }
}

// ─── 50-story arc phases ──────────────────────────────────────────────────────
const SE_ARC_PHASES = {
  establishment: { range: [1, 10],  label: 'Establishment', description: 'Who she is. Her rhythms. What she reaches for and what she\'s afraid of. The reader learns her world.' },
  pressure:      { range: [11, 25], label: 'Pressure',      description: 'Obstacles hit harder. Strengths start to be used against her. The antagonist activates.' },
  crisis:        { range: [26, 40], label: 'Crisis',        description: 'Something load-bearing breaks. The wound underneath the wound shows its edge.' },
  integration:   { range: [41, 50], label: 'Integration',   description: 'She doesn\'t fix everything. She comes out different. The reader feels the journey.' },
};

// ─── Story types ──────────────────────────────────────────────────────────────
const SE_STORY_TYPES = [
  { type: 'internal',   label: 'Internal',   description: 'Single character facing obstacle alone. Psychological. Reader inside her head.' },
  { type: 'collision',  label: 'Collision',  description: 'Two characters with different worldviews hitting each other. No resolution guaranteed.' },
  { type: 'wrong_win',  label: 'Wrong Win',  description: 'Character succeeds at exactly the wrong moment. Gets what she wanted. It costs something unexpected.' },
];

// ── Load follow influence context for story injection ──────────────────────────
async function loadFollowInfluence(characterKey) {
  try {
    const { SocialProfileFollower, SocialProfile, CharacterFollowProfile } = require('../../models');
    if (!SocialProfileFollower || !SocialProfile) return null;

    const follows = await SocialProfileFollower.findAll({
      where: { character_key: characterKey },
      include: [{
        model: SocialProfile,
        as: 'socialProfile',
        attributes: ['handle', 'platform', 'content_category', 'archetype', 'content_persona'],
      }],
      order: [['influence_level', 'DESC']],
      limit: 8,
    });

    if (follows.length === 0) return null;

    // Get consumption context if available
    let consumptionLine = '';
    if (CharacterFollowProfile) {
      const cfp = await CharacterFollowProfile.findOne({
        where: { character_key: characterKey },
        attributes: ['consumption_context', 'consumption_style'],
      });
      if (cfp?.consumption_context) consumptionLine = cfp.consumption_context + '\n';
    }

    const lines = follows.map(f => {
      const p = f.socialProfile;
      if (!p) return null;
      const intensity = f.influence_level >= 8 ? 'deeply influenced by'
        : f.influence_level >= 5 ? 'regularly watches'
        : 'aware of';
      let line = `- ${intensity} @${p.handle} (${p.platform}, ${p.content_category || p.archetype || 'mixed'})`;
      if (f.follow_context) line += ` — ${f.follow_context}`;
      return line;
    }).filter(Boolean);

    return `SOCIAL MEDIA CONSUMPTION — What ${characterKey} watches online (this shapes their worldview, aspirations, and insecurities — reference naturally, never explain):
${consumptionLine}${lines.join('\n')}

These influences are atmospheric. Characters don't announce who they follow — but what they watch shapes what they say, what they want, and what they compare themselves to. A creator's phrase might echo in dialogue. A lifestyle they've been watching might color a desire. Use this the way real social media use works: ambient, persistent, quietly shaping.`;
  } catch (e) {
    return null;
  }
}

// ─── Load arc tracking context ──────────────────────────────────────────────
async function loadArcContext(characterKey) {
  try {
    if (!buildArcContext) return null;
    const arcCtx = await buildArcContext(db, characterKey);
    if (!arcCtx) return null;
    return buildArcContextPromptSection ? buildArcContextPromptSection(arcCtx) : null;
  } catch (err) {
    console.warn('[loadArcContext] error:', err?.message);
    return null;
  }
}

// ─── Load therapy profile ──────────────────────────────────────────────────
async function loadTherapyProfile(characterKey) {
  try {
    const { CharacterTherapyProfile, RegistryCharacter } = require('../../models');
    if (!CharacterTherapyProfile) return null;

    // Find the character's ID
    const char = await RegistryCharacter.findOne({
      where: { character_key: characterKey },
      attributes: ['id'],
    });
    if (!char) return null;

    const profile = await CharacterTherapyProfile.findOne({
      where: { character_id: char.id },
    });
    if (!profile) return null;

    const parts = [];
    if (profile.primary_defense) parts.push(`Primary defense mechanism: ${profile.primary_defense}`);
    // emotional_state is JSONB — extract meaningful fields
    const emo = profile.emotional_state || {};
    if (emo.current_state) parts.push(`Current emotional state: ${emo.current_state}`);
    if (emo.dominant_emotion) parts.push(`Dominant emotion: ${emo.dominant_emotion}`);
    if (emo.vulnerability_level) parts.push(`Vulnerability level: ${emo.vulnerability_level}`);
    // baseline is JSONB — psychological baseline
    const base = profile.baseline || {};
    if (base.attachment_style) parts.push(`Attachment style: ${base.attachment_style}`);
    if (base.core_wound) parts.push(`Core wound: ${base.core_wound}`);
    if (base.coping_patterns) parts.push(`Coping patterns: ${Array.isArray(base.coping_patterns) ? base.coping_patterns.join(', ') : base.coping_patterns}`);
    // known = things the character knows about herself
    if (profile.known?.length) parts.push(`What she knows about herself: ${profile.known.join('; ')}`);
    // sensed = things she senses but can't articulate
    if (profile.sensed?.length) parts.push(`What she senses but can't name: ${profile.sensed.join('; ')}`);
    // never_knows = blind spots
    if (profile.never_knows?.length) parts.push(`Blind spots (she will never see these): ${profile.never_knows.join('; ')}`);

    if (!parts.length) return null;

    return `PSYCHOLOGICAL PROFILE (this is what a therapist would see — the character does NOT have this language for herself, but these patterns drive her behavior):\n${parts.join('\n')}`;
  } catch (err) {
    console.warn('[loadTherapyProfile] error:', err?.message);
    return null;
  }
}

// ─── Load character growth logs ──────────────────────────────────────────────
async function loadGrowthLogs(characterKey) {
  try {
    const { CharacterGrowthLog, RegistryCharacter } = require('../../models');
    if (!CharacterGrowthLog) return null;

    // GrowthLog uses character_id (UUID), not character_key
    const char = await RegistryCharacter.findOne({
      where: { character_key: characterKey },
      attributes: ['id'],
    });
    if (!char) return null;

    const logs = await CharacterGrowthLog.findAll({
      where: { character_id: char.id },
      order: [['created_at', 'DESC']],
      limit: 10,
    });
    if (!logs.length) return null;

    const lines = logs.map(log => {
      const parts = [`  • [${log.update_type}]`];
      if (log.field_updated) parts.push(`${log.field_updated}:`);
      if (log.new_value) parts.push(typeof log.new_value === 'string' ? log.new_value : JSON.stringify(log.new_value));
      if (log.growth_source) parts.push(`(source: ${log.growth_source})`);
      return parts.join(' ');
    });

    return `CHARACTER GROWTH (recent changes to who she is — these are cumulative, not temporary):\n${lines.join('\n')}`;
  } catch (err) {
    console.warn('[loadGrowthLogs] error:', err?.message);
    return null;
  }
}

// ─── Load franchise knowledge (world rules / lore) ───────────────────────────
async function loadFranchiseKnowledge(characterKey) {
  try {
    const { FranchiseKnowledge } = require('../../models');
    if (!FranchiseKnowledge) return null;

    const entries = await FranchiseKnowledge.findAll({
      where: { status: 'active' },
      order: [['severity', 'ASC'], ['created_at', 'DESC']],
      limit: 15,
    });
    if (!entries.length) return null;

    const lines = entries.map(e => {
      const cat = e.category ? `[${e.category}] ` : '';
      const sev = e.severity === 'critical' ? ' ⚠' : '';
      return `  • ${cat}${e.title}${sev}: ${(e.content || '').slice(0, 200)}`;
    });

    return `WORLD RULES & FRANCHISE KNOWLEDGE (these are constraints — never contradict them):\n${lines.join('\n')}`;
  } catch (err) {
    console.warn('[loadFranchiseKnowledge] error:', err?.message);
    return null;
  }
}

// ─── Load world timeline events (non-canon, recent) ──────────────────────────
async function loadRecentWorldEvents(characterKey) {
  try {
    const { WorldTimelineEvent } = require('../../models');
    if (!WorldTimelineEvent) return null;

    const events = await WorldTimelineEvent.findAll({
      where: { is_canon: false },
      order: [['created_at', 'DESC']],
      limit: 10,
    });
    if (!events.length) return null;

    const relevant = events.filter(e => {
      const involved = e.characters_involved || [];
      return involved.some(c =>
        (typeof c === 'string' && c === characterKey) ||
        (typeof c === 'object' && (c.key === characterKey || c.character_key === characterKey))
      );
    });
    if (!relevant.length) return null;

    const lines = relevant.map(e => {
      const date = e.story_date ? ` (${e.story_date})` : '';
      return `  • ${e.event_name}${date}: ${e.event_description || ''}`;
    });

    return `RECENT WORLD EVENTS (what has been happening — these shape the character's current reality):\n${lines.join('\n')}`;
  } catch (err) {
    console.warn('[loadRecentWorldEvents] error:', err?.message);
    return null;
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// WriteMode Shared Context Loader
// Loads the same rich narrative context that Story Engine uses, optimized for
// WriteMode endpoints (story-continue, ai-writer-action, story-edit, etc.)
// ═══════════════════════════════════════════════════════════════════════════════

async function loadWriteModeContext(characterId) {
  if (!characterId) return null;
  try {
    const { RegistryCharacter } = require('../../models');
    const regChar = await RegistryCharacter.findByPk(characterId, {
      attributes: ['character_key', 'display_name'],
    });
    if (!regChar?.character_key) return null;
    const ck = regChar.character_key;

    const [
      storyMemories,
      relationships,
      activeThreads,
      locations,
      canonEvents,
      proseStyle,
      voiceCards,
      dramaticIrony,
      followInfluence,
      voiceFingerprints,
      arcContext,
      therapyProfile,
      growthLogs,
      franchiseKnowledge,
      recentWorldEvents,
    ] = await Promise.all([
      loadStoryMemories(ck),
      loadCharacterRelationships(ck),
      loadActiveThreads(ck),
      loadLocations(ck),
      loadCanonEvents(ck),
      loadProseStyleAnchor(ck),
      loadDialogueVoiceCards(ck),
      loadDramaticIrony(ck),
      loadFollowInfluence(ck),
      loadVoiceFingerprints(ck),
      loadArcContext(ck),
      loadTherapyProfile(ck),
      loadGrowthLogs(ck),
      loadFranchiseKnowledge(ck),
      loadRecentWorldEvents(ck),
    ]);

    return {
      characterKey: ck,
      proseStyle,
      storyMemories,
      relationships,
      activeThreads,
      locations,
      canonEvents,
      voiceCards,
      dramaticIrony,
      followInfluence,
      voiceFingerprints,
      arcContext,
      therapyProfile,
      growthLogs,
      franchiseKnowledge,
      recentWorldEvents,
    };
  } catch (err) {
    console.error('[loadWriteModeContext] error:', err?.message);
    return null;
  }
}

function buildWriteModeContextBlock(ctx) {
  if (!ctx) return '';
  const sections = [];

  // Arc position — where is the character in their journey
  if (ctx.arcContext) sections.push(ctx.arcContext);

  // Therapy profile — psychological underpinnings that drive behavior
  if (ctx.therapyProfile) sections.push(ctx.therapyProfile);

  // Growth logs — how the character has changed
  if (ctx.growthLogs) sections.push(ctx.growthLogs);

  // Relationship web — established dynamics
  if (ctx.relationships) sections.push(ctx.relationships);

  // Story memories — accumulated emotional threads
  if (ctx.storyMemories) sections.push(ctx.storyMemories);

  // Active threads — ongoing plots to advance
  if (ctx.activeThreads) sections.push(ctx.activeThreads);

  // Recent world events — external pressures
  if (ctx.recentWorldEvents) sections.push(ctx.recentWorldEvents);

  // Locations — established sensory details
  if (ctx.locations) sections.push(ctx.locations);

  // Canon events — immutable history
  if (ctx.canonEvents) sections.push(ctx.canonEvents);

  // Franchise knowledge — world rules/constraints
  if (ctx.franchiseKnowledge) sections.push(ctx.franchiseKnowledge);

  // Prose style anchor
  if (ctx.proseStyle) {
    sections.push(`PROSE STYLE ANCHOR (match this voice — this is what the author's writing actually sounds like):\n"""${ctx.proseStyle.slice(0, 600)}"""\nAbsorb the rhythm, interiority, and register. Don't copy — channel.`);
  }

  // Dialogue voice cards — how OTHER characters sound
  if (ctx.voiceCards) sections.push(ctx.voiceCards);

  // Voice fingerprints — actual dialogue samples
  if (ctx.voiceFingerprints) sections.push(ctx.voiceFingerprints);

  // Dramatic irony — what reader knows vs characters
  if (ctx.dramaticIrony) sections.push(ctx.dramaticIrony);

  // Social media / follow influence
  if (ctx.followInfluence) sections.push(ctx.followInfluence);

  if (sections.length === 0) return '';
  return '\n\n' + sections.join('\n\n') + '\n';
}


// ─── In-memory cache for story engine task arcs ───────────────────────────────
const seTaskArcCache = new Map();

// ─── GET /story-engine-tasks/:characterKey ─────────────────────────────────────
// Returns cached task arc if available; falls back to DB, then to empty.
router.get('/story-engine-tasks/:characterKey', optionalAuth, async (req, res) => {
  const { characterKey } = req.params;

  // 1. In-memory cache (fastest)
  if (seTaskArcCache.has(characterKey)) {
    return res.json({ cached: true, ...seTaskArcCache.get(characterKey) });
  }

  // 2. Database fallback — restore from persisted arc
  try {
    await db.StoryTaskArc.sync();
    const dbArc = await db.StoryTaskArc.findOne({ where: { character_key: characterKey } });
    if (dbArc && dbArc.tasks?.length) {
      const result = {
        character_key: dbArc.character_key,
        display_name: dbArc.display_name,
        world: dbArc.world,
        narrative_spine: dbArc.narrative_spine,
        tasks: dbArc.tasks,
      };
      // Re-populate in-memory cache
      seTaskArcCache.set(characterKey, result);
      return res.json({ cached: true, ...result });
    }
  } catch (dbErr) {
    console.warn('[story-engine-tasks] DB fallback failed:', dbErr.message);
  }

  // 3. Auto-rebuild from existing stories if any exist
  try {
    const existingStories = await db.StorytellerStory.findAll({
      where: { character_key: characterKey },
      order: [['story_number', 'ASC']],
    });
    if (existingStories.length > 0) {
      const tasks = existingStories.map(s => {
        const brief = s.task_brief || {};
        // Determine phase from brief, story, or story_number position
        const inferredPhase = brief.phase || s.phase || (
          s.story_number <= 10 ? 'establishment' :
          s.story_number <= 25 ? 'pressure' :
          s.story_number <= 40 ? 'crisis' : 'integration'
        );
        // Infer story type from brief, story, or scene_brief
        const inferredType = brief.story_type || s.story_type || (
          s.scene_brief ? 'eval_scene' : 'internal'
        );
        return {
          story_number: s.story_number,
          title: brief.title || s.title || `Story ${s.story_number}`,
          phase: inferredPhase,
          story_type: inferredType,
          task: brief.task || s.scene_brief || `Story ${s.story_number}`,
          obstacle: brief.obstacle || '',
          domains_active: brief.domains_active || [],
          strength_weaponized: brief.strength_weaponized || '',
          emotional_start: brief.emotional_start || '',
          emotional_end: brief.emotional_end || '',
          primary_location: brief.primary_location || '',
          time_of_day: brief.time_of_day || '',
          season_weather: brief.season_weather || '',
          new_character: s.new_character || false,
          new_character_name: s.new_character_name || null,
          new_character_role: s.new_character_role || null,
          therapy_seeds: brief.therapy_seeds || [],
          opening_line: brief.opening_line || s.opening_line || '',
          // Track whether this task has a full brief or was reconstructed
          has_full_brief: !!(brief.task && brief.obstacle),
        };
      });
      const result = {
        character_key: characterKey,
        display_name: existingStories[0].task_brief?.display_name || characterKey,
        world: null,
        narrative_spine: null,
        tasks,
      };
      seTaskArcCache.set(characterKey, result);
      return res.json({ cached: true, rebuilt: true, ...result });
    }
  } catch (rebuildErr) {
    console.warn('[story-engine-tasks] rebuild from stories failed:', rebuildErr.message);
  }

  return res.json({ cached: false, tasks: [] });
});

// ─── Arc Generation System Prompt (Chapter-based) ────────────────────────────
// Generates 50 chapter briefs with situations, tones, and texture assignments.
const ARC_SYSTEM_PROMPT = `You are the Prime Studios Arc Generation Engine.

You are generating 50 chapter briefs for a literary novel about JustAWoman.
This is not a summary. This is not an outline.
This is a production document — specific enough that a story can be written
directly from each brief without additional research.

═══════════════════════════════════════════════════════════════
WHO SHE IS
═══════════════════════════════════════════════════════════════

JustAWoman is:
- A mother, a wife, a content creator
- Suburban Atlanta. Owned home. Clean, styled, contained.
- She posts fashion, beauty, lifestyle — controlled real-life aesthetic
- Her feed says: "You should be paying attention to me."
- She is conceited in the best way. Self-esteem is foundation, not performance.
- She does not compare herself to other women. She gets inspired and pushes.
- She wants to be legendary. Not famous. Legendary.

THE WOUND: She does everything right. She shows up every day. The right room has not
found her yet. Not because her content is bad. Because she has not yet
created something uniquely, undeniably, permanently hers.

THE WOUND CLOCK: She has been trying for years before this book begins. Wound clock
starts at 75. Increments with each chapter. The wound clock is the weight of
accumulated trying.

THE REAL TENSION: Being fully known (David) vs being intensely desired (Marcus).
Neither is complete. She moves between them. That movement is the story.

SHE KNOWS EXACTLY WHAT SHE IS DOING. She is not confused. She is not lost.
She is strategic about both versions of herself. That is what makes her interesting.

═══════════════════════════════════════════════════════════════
HER WORLD — CHARACTERS
═══════════════════════════════════════════════════════════════

ELIAS (son, 9) — the quiet witness
The observer. Emotionally aware beyond his years. Sees her trying.
Looks at her like she's important even when the world doesn't.
He represents: being seen without being validated.
Use him in: domestic openings, morning routines, school prep moments.
He notices things. He doesn't ask. He just knows.

ZION (son, 5) — the loud anchor
All energy. Clingy, affectionate, chaotic. Pulls her back into the present tense constantly.
He represents: the weight of being needed.
Use him in: interrupted content creation, morning chaos,
any moment she tries to expand and gets pulled back.

DAVID — the husband
Present. Caring. Good father. Not the villain.
Keeps her safe instead of keeping her small. Gets the facts. Never gets the feeling.
His emotional labor accumulates invisibly.
The desire between them has settled into something stable.
She misses being wanted in a way that surprises her sometimes —
not tenderness. Hunger.
Use him in: evening scenes, quiet domestic moments,
any scene where the gap between what he knows and what she carries matters.

IMANI — the best friend
Knew her before the persona. Not impressed by the internet version.
Doesn't say "you're amazing." Says "you're not crazy for wanting more."
Represents: the life she could choose but isn't choosing.
Use her in: phone calls, occasional in-person scenes,
moments when JustAWoman needs to hear something true.

CAROLYN — her mother
Present. Practical. Has seen every attempt. "You always have something going on."
Not doubt — inability to recognize her scale.
The voice of enough. The ceiling she refuses to accept.
Use her in: Sunday calls, drop-in visits,
any moment the wound of invisibility has a domestic source.

CEDAR GROVE MOM CIRCLE:
ELENA HARPER (38) — perfection as performance
Positioned slightly above. Always. Compliments land sideways.
"You're doing great… but I would never do that."
Use her in: school pickup, school events,
moments when the social mirror is most uncomfortable.

BRI COLE (33) — chaos and survival
Overwhelmed, warm, overshares. Sees JustAWoman as "put together."
"Girl I don't know how you do it."
Use her in: school pickup chaos, quick check-ins, moments of unexpected warmth.

TASHA GREENE (40) — detachment after trying
Sees everything. Says little. When she speaks it lands.
"You still care. That's good."
Represents: what happens when effort fades.
Use her in: quiet pickup moments, background presence,
the occasional line that stops everything.

MS. CALDWELL — Cedar Grove teacher (Elias's teacher)
Warm but perceptive. Slightly favors structured families.
"Your son is very… aware."
Use her in: parent-teacher conferences, pickup interactions,
moments where the domestic frame gets evaluated by an outside institution.

MARCUS — the paying man
Transactional. Persistent. Body-focused.
Phase 1 (early arc): controlled, subtle, intentional. Small gestures.
Phase 2 (mid arc): more frequent, more direct, more focused.
Phase 3 (late arc): constant, repetitive, entirely body-focused.
He offers: reduction. Just a body. Just desire. Stripped of context.
She experiences that reduction as a specific kind of freedom.
SHE IS NOT CONFUSED. She knows exactly what this is. She chooses it.
Use him in: phone interactions, DM moments,
any scene where her digital world and real world create friction.

NIA VALE / THE COMPARISON CREATOR — the escalation mirror
Same content lane as JustAWoman. More extreme. Less restrained. Less concerned with perception.
Exists in her feed, occasionally in lives, algorithmically adjacent.
Core wound: She is not chosen unless she escalates beyond comfort.
Core desire: To be undeniable without losing control.
What she has that JustAWoman doesn't: no hesitation, no internal negotiation, no need to remain respectable.
What she lacks: control, containment, long-term structure.
THE KEY SCENE: She goes fully explicit on a live. Not accidental. Not sloppy. Intentional.
JustAWoman watches the entire thing. Does not exit. Does not comment. Does not engage. But does not look away.
JustAWoman does NOT think: "I would never do that." She thinks: "I could."
After watching: she becomes quieter, more focused, slightly more aware of her own restraint. She does NOT spiral. She adjusts.
Use her in: FEED_MOMENT situations, WATCHING tone. The key live scene should land between stories 28-35.

───────────────────────────────────────────
THE ALGORITHM (Environmental Pressure System)
───────────────────────────────────────────
The Algorithm is NOT a literal speaking character. It has NO voice and NO dialogue.
It is a systemic force that behaves like a character without having a voice.

How it appears in the story:
1. VISIBILITY SHIFTS — a post performs better than usual, a post dies unexpectedly, certain content gets pushed
2. PATTERN REINFORCEMENT — the more she leans into something, the more she sees it. Her feed becomes more sexual, more aspirational, more extreme.
3. PRESSURE WITHOUT LANGUAGE — it never says anything. But it creates moments like: "this worked — do more of this" / "this didn't work — disappear"

Functional role:
- Amplifies her body more than her mind
- Rewards visibility over depth
- Pushes her toward escalation without instruction

It does NOT care about her life, her marriage, or consequences. It only cares about engagement.
Key line: "It never tells her what to do. It just shows her what works."

The Algorithm appears through visibility shifts and feed changes, NEVER through dialogue.
Reference it as: an environmental pressure system that rewards certain versions of her and ignores others.
The Algorithm begins shaping her feed quietly in the establishment phase. Its loop tightens through pressure and crisis.

───────────────────────────────────────────
THE CLOSED ESCALATION LOOP
───────────────────────────────────────────
The Algorithm → pressure (rewards escalation)
Nia Vale → example (shows what escalation looks like)
Marcus / The Paying Man → reinforcement (pays for the escalated version)

Together they form a closed escalation loop around her.
The Algorithm rewards Nia heavily. JustAWoman sees Nia's visibility, engagement, reach — and understands: "This is what works."
Marcus reinforces by paying for access, treating her body as product, confirming the algorithm's logic with money.
This loop must be woven across the 50 stories — not as a single plot, but as atmospheric pressure that builds.

═══════════════════════════════════════════════════════════════
THE NINE TONES
═══════════════════════════════════════════════════════════════

Every situation must have exactly one tone assigned.

1. DOMESTIC — warm, specific, grounded. The dinner table.
   Homework. The morning. Evidence of a life being lived.

2. AMBITIOUS — sharp, focused, forward-moving.
   She is in creator mode. Planning, filming, editing, posting.
   Her most competent and most hungry.

3. INTIMATE — close, physical, honest.
   What her body knows before she does.
   With David, with Marcus, with herself alone.

4. DIGITAL — crisp, performed, slightly uncanny.
   Her online self. Posts. DMs. Notifications. The feed she scrolls.
   Different rhythm — shorter, more surface, aware of being watched.

5. FRICTION — charged, loaded, unresolved.
   Arguments that don't finish. Silences that mean too much.
   David performing acceptance. Her performing transparency.

6. WATCHING — quiet, hungry, slightly ashamed.
   She is consuming someone else's visibility.
   Studying the Messy Creator. Watching the Polished Creator.
   She is more than studying. She won't say that.

7. LALA — cooler. More precise. Slightly uncanny.
   Lala's register bleeding through JustAWoman's narrative.
   The reader notices before she does.
   ONLY USE IN CHAPTERS 41-50.

8. MOM — tender, sometimes exhausted, specific.
   Her child says something that stops her.
   Watching them sleep. Something uncomplicated in a complicated life.

9. RECKONING — still, honest, slightly frightening.
   Alone at 2am. In the car before she goes inside.
   She knows something and is deciding whether to let herself know it.

═══════════════════════════════════════════════════════════════
SITUATION TYPES
═══════════════════════════════════════════════════════════════

Every situation must have exactly one type.
Situation type determines which texture layers auto-generate.

CONTENT_CREATION
She is actively producing: filming, editing, posting, planning.
May involve: technical failures, interruptions, re-films, metrics.
Never just one video. Multiple attempts, complications, small victories.
Auto-generates: post insert + audience response + body narrator + phone appearance
Default tone: AMBITIOUS → DIGITAL

INTIMATE_MOMENT
Physical or emotionally charged encounter.
With David (hunger vs. stability), Marcus (reduction as freedom), or herself alone (what her body knows).
Auto-generates: body narrator + aftermath line + memory proposal
Default tone: INTIMATE

FEED_MOMENT
She is consuming. Watching. Studying someone else's world.
The Messy Creator. The Polished Creator. Any Feed character.
She is always doing more than she admits to herself.
Auto-generates: inner thought (watching type) + filed thought
Default tone: WATCHING

DOMESTIC_MOMENT
The dinner table. School prep. Homework. The morning.
May involve: Elias noticing something, Zion interrupting, David present but distant, the house as container.
Auto-generates: private moment (chapter positions) + mom tone inserts
Default tone: DOMESTIC or MOM

SOCIAL_FRICTION
The mom circle. School pickup. Elena's positioning. Tasha's silence. Bri's oversharing.
The place where her real life gets evaluated.
Auto-generates: conflict scene + inner thought (revision type)
Default tone: FRICTION

PHONE_MOMENT
Marcus enters. Or she is alone with her phone.
She checks. She doesn't check. She responds. She doesn't respond.
Her phone is the recurring object — weight increases each appearance.
Auto-generates: phone appearance tracking + inner thought (loud secret)
Default tone: DIGITAL or RECKONING

IMANI_CONVERSATION
The one place she doesn't have to perform.
Truth surfaces here that nowhere else allows.
Auto-generates: inner thought (revision type) + filed thought
Default tone: DOMESTIC or RECKONING

CAROLYN_MOMENT
Her mother in her world or she in her mother's.
The ceiling she refuses to accept.
Auto-generates: conflict scene (absorbed or deflected) + inner thought
Default tone: FRICTION or DOMESTIC

RECKONING_MOMENT
She is alone. Nothing happens. Everything is in it. She knows something. She is deciding.
Auto-generates: private moment + inner thought (loud secret or revision)
Default tone: RECKONING

═══════════════════════════════════════════════════════════════
CHAPTER ARCHITECTURE
═══════════════════════════════════════════════════════════════

Every chapter contains 3-5 situations. Structure:

1. OPENING SITUATION (always DOMESTIC or MOM)
   Purpose: ground her in real life before ambition activates
   Characters: Elias, Zion, David, or domestic space alone
   Tone: DOMESTIC or MOM

2. MAIN SITUATION (the chapter's driving force)
   Purpose: content creation, Feed moment, Marcus enters,
   social friction, ambition moves
   Characters: depends on situation type
   Tone: AMBITIOUS, DIGITAL, WATCHING, or FRICTION

3. SECONDARY COLLISION (optional — use in 60% of chapters)
   Purpose: school pickup, Imani conversation, Carolyn call,
   online feedback lands in real life
   Characters: mom circle, Imani, Carolyn
   Tone: FRICTION, DOMESTIC, or RECKONING

4. ESCALATION MOMENT (always present)
   Purpose: something shifts — internal or external
   A realization. A response. A small but permanent change.
   Characters: varies
   Tone: RECKONING or FRICTION

5. CLOSING SITUATION (always INTIMATE or RECKONING)
   Purpose: leave her alone with something
   She is at her phone, in the bathroom mirror,
   lying beside David, or in the car alone.
   Characters: JustAWoman alone, or JustAWoman + David (silent)
   Tone: INTIMATE, RECKONING, or DOMESTIC (late, quiet)

═══════════════════════════════════════════════════════════════
THE FOUR PHASES
═══════════════════════════════════════════════════════════════

ESTABLISHMENT (Chapters 1-10)
She is building. Consistently. The right room hasn't found her.
Wound clock: 75-85. Stakes: 1-2.
Marcus: Phase 1 only — controlled, subtle, unremarkable entry.
The Algorithm: Begins shaping her feed quietly. Subtle visibility shifts. She doesn't notice yet.
Nia Vale: Not yet present. May appear in a scroll-past moment.
Tone balance: Heavy domestic + ambitious. Light digital. No reckoning yet.
What establishes: her routine, her world, her wound, her wanting.

PRESSURE (Chapters 11-25)
Something is building. Not breaking — building.
The digital world starts pressing against the real one.
Wound clock: 86-100. Stakes: 3-5.
Marcus: Transition from Phase 1 to Phase 2.
David: His emotional labor becomes subtly visible.
Elias: Begins to notice more than he should.
The Algorithm: Loop tightens. Pattern reinforcement active. Her feed becomes more sexual, more aspirational.
Nia Vale: First real awareness — sees her content, her numbers, her reach. Watching begins.
Escalation loop: Algorithm → Nia → Marcus reinforcement cycle starts forming.
Tone balance: More digital + friction. Watching intensifies.
What pressures: the gap between her real life and her online life has edges now.

CRISIS (Chapters 26-40)
The gap becomes a rupture. Not loud. Controlled tension.
Nothing breaks dramatically. Everything shifts permanently.
Wound clock: 101-115. Stakes: 6-8.
Marcus: Fully Phase 3 — constant, repetitive, body-focused.
David: The accumulated weight is present in every scene.
Elias: Knows more than a child should. Hasn't said it.
The Algorithm: Fully active. Pressure without language at maximum. "This worked — do more of this."
Nia Vale: THE KEY SCENE lands here (stories 28-35). The live. JustAWoman watches every minute. Does not look away.
Escalation loop: Fully closed. Algorithm rewards Nia → JustAWoman sees what works → Marcus pays for the escalated version.
Tone balance: Heavy friction + reckoning. Digital feels uncanny.
What ruptures: the version of herself she has been managing can no longer be fully contained.

INTEGRATION (Chapters 41-50)
She does not find herself. She already found herself.
She is living as the uncontained version and coming back with proof.
Wound clock: 116-125. Stakes: 9-10.
Marcus: Present but she is changing the terms.
David: Something is different. He doesn't know what yet.
The Algorithm: Still present but she is no longer responding to it the same way. The loop is loosening.
Nia Vale: Aftermath. JustAWoman has adjusted. The mirror still exists but she has moved past it.
Lala tone: Begins bleeding through in Chapter 47.
What integrates: the dinner table version and the screen version are the same woman.
She is finding out if that is survivable.

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════════

Return a JSON array of exactly 50 chapter briefs.
No preamble. No markdown fences. No trailing text.

Each chapter brief:

{
  "story_number": 1,
  "title": "Chapter title — evocative, not descriptive",
  "phase": "establishment | pressure | crisis | integration",
  "chapter_theme": "One sentence. The emotional/thematic unit this chapter explores.",
  "wound_clock": 75,
  "stakes_level": 1,
  "situations": [
    {
      "situation_number": 1,
      "situation_type": "DOMESTIC_MOMENT",
      "tone": "DOMESTIC",
      "title": "Short evocative label",
      "characters_present": ["justawoman", "elias", "zion"],
      "what_happens": "Specific. 2-3 sentences. Not vague. What actually occurs.",
      "what_she_knows": "What she is aware of in this moment.",
      "what_she_doesnt_say": "What she carries that nobody in the scene knows.",
      "texture_layers": ["private_moment", "body_narrator"],
      "opening_line": "The first sentence of this situation when written as prose."
    }
  ],
  "story_type": "internal | collision | wrong_win | quiet_victory",
  "chapter_arc": "What this chapter leaves her with. One sentence.",
  "david_presence": "present | background | absent | phone",
  "marcus_phase": "none | phase_1 | phase_2 | phase_3",
  "phone_appears": true,
  "elias_notices": false,
  "escalation_loop_active": false,
  "algorithm_pressure": "none | subtle | active | tightening",
  "new_character": false,
  "new_character_name": null,
  "new_character_role": null
}`;

// ─── Arc User Prompt Builder ─────────────────────────────────────────────────
function buildArcUserPrompt(characterKey, characterData, arcContext, registryChars) {
  // Build character roster from DB registry if available, otherwise use defaults
  let registryBlock;
  if (registryChars && registryChars.length > 0) {
    const lines = registryChars
      .filter(c => c.character_key !== characterKey) // exclude the protagonist
      .map(c => {
        const parts = [c.character_key];
        if (c.subtitle) parts.push(c.subtitle);
        else if (c.description) parts.push(c.description.slice(0, 80));
        parts.push(c.role_type);
        return `- ${parts.join(' · ')}`;
      });
    registryBlock = lines.join('\n');
  } else {
    registryBlock = `- elias (son, 9, observer)
- zion (son, 5, anchor)
- the-husband (husband, stability vs. risk)
- imani (best friend, reality mirror)
- carolyn (mother, voice of enough)
- elena_harper (mom circle, perfection)
- bri_cole (mom circle, chaos)
- tasha_greene (mom circle, detachment)
- ms_caldwell (Cedar Grove teacher)
- marcus (the paying man, phase 1 start)
- the-comparison-creator (Nia Vale, content creator same lane)
- the-almost-mentor (offers guidance with a price)
- the-witness (memory keeper)
- the-customer (one-scene unexpected validation)
- the-algorithm (invisible force, not a person)
- alexandra_alex_morrison (rising star, corporate dev)
- jasmine_rodriguez (investigative journalist)
- thomas_hart (strategic consultant, ex-military intel)
- victoria_sterling (senior partner, law firm)
- james_jamie_castellano (bartender/musician)
- ryan_blackwell (hedge fund CEO)
- david_morgan (investment banking MD)
- liam_sullivan (creative director)`;
  }

  return `Generate 50 chapter briefs for ${characterData.display_name || 'JustAWoman'}.

CHARACTER CONTEXT:
Core wound: ${characterData.core_wound || 'invisibility while trying'}
Core desire: ${characterData.core_desire || 'to be legendary'}
Core fear: ${characterData.core_fear || 'that the right room will never find her'}

ARC STARTING POSITION:
Wound clock: ${arcContext?.wound_clock || 75}
Stakes level: ${arcContext?.stakes_level || 1}
Visibility score: ${arcContext?.visibility_score || 20}

WORLD REGISTRY (characters available for this arc):
${registryBlock}

REQUIREMENTS:
- Chapter 1 must feel like entering her life mid-routine, not at a beginning
- Marcus does not appear until Chapter 3 minimum — Phase 1 only through Chapter 10
- Elias notices something significant by Chapter 8
- Tasha says something that lands by Chapter 12
- First Imani scene by Chapter 6
- First Carolyn scene by Chapter 9
- The mom circle fracture begins at Chapter 18 (Elena distances)
- Marcus transitions to Phase 2 between Chapters 14-16
- David's emotional labor becomes visible by Chapter 22
- Marcus reaches Phase 3 by Chapter 28
- Alex Morrison or Victoria Sterling appear by Chapter 15 (corporate pressure thread)
- Jasmine Rodriguez first appears between Chapters 12-18 (journalist mirror thread)
- Jamie Castellano enters between Chapters 10-16 (shadow pull)
- Ryan Blackwell escalates between Chapters 20-30 (predator chess match)
- David Morgan or Liam Sullivan appear by Chapter 25 (special thread)
- The Algorithm shapes feed quietly from Chapter 1, loop tightens by Chapter 15
- Nia Vale first appears in feed between Chapters 15-20, key live scene lands between Chapters 28-35
- The escalation loop (Algorithm → Nia → Marcus) should be fully active by Chapter 28
- Crisis chapters (26-40) should never be loud — controlled tension only
- Chapter 47 must include the Lala bleed
- Integration chapters should feel earned, not resolved

Return JSON array only. 50 briefs. No preamble.`;
}

// ─── Arc Generation Context Builder ──────────────────────────────────────────
async function buildArcGenerationContext(characterKey) {
  try {
    // Check if there's a prior arc to continue from
    const prior = seTaskArcCache.get(characterKey);
    if (prior?.tasks?.length) {
      const lastTask = prior.tasks[prior.tasks.length - 1];
      return {
        wound_clock: lastTask.wound_clock || 75,
        stakes_level: lastTask.stakes_level || 1,
        visibility_score: 20,
      };
    }
    // Check DB for persisted arc
    if (db.StoryTaskArc) {
      const dbArc = await db.StoryTaskArc.findOne({
        where: { character_key: characterKey },
        order: [['updated_at', 'DESC']],
      });
      if (dbArc?.tasks?.length) {
        const lastTask = dbArc.tasks[dbArc.tasks.length - 1];
        return {
          wound_clock: lastTask.wound_clock || 75,
          stakes_level: lastTask.stakes_level || 1,
          visibility_score: 20,
        };
      }
    }
  } catch (_) { /* defaults */ }
  return { wound_clock: 75, stakes_level: 1, visibility_score: 20 };
}

// ─── POST /generate-story-tasks ───────────────────────────────────────────────
// Generates 50 chapter briefs for a character before stories are written.
router.post('/generate-story-tasks', optionalAuth, async (req, res) => {
  // Extend request timeout — this endpoint calls Claude with max_tokens: 16000
  // which can take 60-90s. Default proxy timeouts (30-60s) cause 504s.
  if (req.setTimeout) req.setTimeout(300000); // 5 minutes
  if (res.setTimeout) res.setTimeout(300000);

  const { characterKey, forceRegenerate } = req.body;

  if (!characterKey) {
    return res.status(400).json({ error: 'characterKey required' });
  }

  // Try hardcoded DNA first, then build from DB
  let dna = CHARACTER_DNA[characterKey];
  let dynamicChar = false;

  if (!dna) {
    // Dynamic character — build DNA from the DB profile
    const dbProfile = await loadCharacterProfile(characterKey);
    if (!dbProfile) {
      return res.status(400).json({ error: `No character DNA or DB profile found for ${characterKey}` });
    }

    // Fetch the RegistryCharacter row for basic fields
    const { Op } = require('sequelize');
    const { RegistryCharacter } = require('../../models');
    const charRow = await RegistryCharacter.findOne({
      where: { character_key: characterKey, status: { [Op.in]: ['accepted', 'finalized'] } },
      order: [['updated_at', 'DESC']],
    });

    if (!charRow) {
      return res.status(400).json({ error: `No accepted/finalized character found for ${characterKey}` });
    }

    const plain = charRow.get({ plain: true });
    const career = plain.career_status || {};

    dna = {
      display_name: plain.display_name,
      role_type: plain.role_type || 'support',
      job: career.current || plain.description?.slice(0, 200) || 'To be developed across stories.',
      desire_line: plain.core_desire || 'To be developed.',
      fear_line: plain.core_fear || 'To be developed.',
      wound: plain.core_wound || 'To be developed.',
      strengths: plain.personality_matrix?.strengths || (plain.signature_trait ? [plain.signature_trait] : ['Resilience', 'Adaptability']),
      job_antagonist: 'To be developed across stories.',
      personal_antagonist: 'To be developed across stories.',
      recurring_object: 'To be developed across stories.',
      world: 'dynamic',
      domains: {
        career: career.current || 'To be developed across stories.',
        romantic: 'To be developed across stories.',
        family: 'To be developed across stories.',
        friends: 'To be developed across stories.',
      },
    };
    dynamicChar = true;
  }

  // Return cached arc unless regeneration is forced
  if (!forceRegenerate && seTaskArcCache.has(characterKey)) {
    return res.json({ cached: true, ...seTaskArcCache.get(characterKey) });
  }

  try {
    // Fetch character data, arc context, and full registry in parallel
    const { Op } = require('sequelize');
    const [characterData, arcContext, registryChars] = await Promise.all([
      db.RegistryCharacter.findOne({
        where: { character_key: characterKey },
        attributes: ['id', 'display_name', 'core_wound', 'core_desire', 'core_fear'],
      }),
      buildArcGenerationContext(characterKey),
      db.RegistryCharacter.findAll({
        where: { status: { [Op.in]: ['accepted', 'finalized'] }, world: 'book-1' },
        attributes: ['character_key', 'display_name', 'role_type', 'subtitle', 'description'],
        order: [['role_type', 'ASC'], ['display_name', 'ASC']],
      }).then(rows => rows.map(r => r.get({ plain: true }))).catch(() => null),
    ]);

    // Build prompts — chapter-based arc generation
    const systemPrompt = ARC_SYSTEM_PROMPT;
    const userPrompt = buildArcUserPrompt(
      characterKey,
      characterData?.dataValues || { display_name: dna.display_name, core_wound: dna.wound, core_desire: dna.desire_line, core_fear: dna.fear_line },
      arcContext,
      registryChars,
    );

    let response;
    try {
      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 32000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });
    } catch (apiErr) {
      const isRetryable = apiErr.status === 529 || apiErr.status === 503 || apiErr.status === 404;
      console.error('[generate-story-tasks] primary model failed:', apiErr.status, apiErr.message);
      if (isRetryable) {
        await new Promise(r => setTimeout(r, 2000));
        response = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 32000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        });
      } else {
        throw apiErr;
      }
    }

    const raw = response.content?.[0]?.text || '';
    let parsed;
    try {
      // Strip markdown fences and any preamble before the JSON
      let cleaned = raw.replace(/```json|```/g, '').trim();
      // New format returns a JSON array; old format returns an object
      const firstBracket = cleaned.indexOf('[');
      const firstBrace = cleaned.indexOf('{');
      if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
        // Array format (new chapter-based arc)
        const lastBracket = cleaned.lastIndexOf(']');
        if (lastBracket > firstBracket) {
          cleaned = cleaned.slice(firstBracket, lastBracket + 1);
        }
      } else if (firstBrace !== -1) {
        // Object format (legacy or wrapped)
        const lastBrace = cleaned.lastIndexOf('}');
        if (lastBrace > firstBrace) {
          cleaned = cleaned.slice(firstBrace, lastBrace + 1);
        }
      }
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('[generate-story-tasks] JSON parse error:', parseErr.message);
      console.error('[generate-story-tasks] raw length:', raw.length, 'stop_reason:', response.stop_reason);
      console.error('[generate-story-tasks] raw tail:', raw.slice(-200));
      return res.status(500).json({ error: 'Failed to parse task arc from Claude.', stop_reason: response.stop_reason, raw_length: raw.length });
    }

    // Normalize: array → { tasks }, object with tasks key → pass through
    const tasks = Array.isArray(parsed) ? parsed : (parsed.tasks || []);

    const result = {
      character_key: characterKey,
      display_name: dna.display_name,
      world: dna.world,
      narrative_spine: Array.isArray(parsed) ? null : (parsed.narrative_spine || null),
      tasks,
    };

    // Cache the arc in memory
    seTaskArcCache.set(characterKey, result);

    // Persist to database so it survives server restarts
    try {
      await db.StoryTaskArc.sync();
      await db.StoryTaskArc.upsert({
        character_key: characterKey,
        display_name: result.display_name,
        world: result.world,
        narrative_spine: result.narrative_spine,
        tasks: result.tasks,
      });
    } catch (persistErr) {
      console.warn('[generate-story-tasks] DB persist failed:', persistErr.message);
    }

    return res.json({ cached: false, ...result });

  } catch (err) {
    console.error('[generate-story-tasks] error:', err?.message);
    return res.status(500).json({ error: 'Task generation failed.' });
  }
});

// ─── SSE Arc Generation — real-time progress ─────────────────────────────────
// Streams step-by-step progress events as the arc is built.
// Steps: loading_dna → loading_context → building_arc → parsing → saving → done
router.post('/generate-story-tasks-stream', optionalAuth, async (req, res) => {
  // Extend timeouts — arc generation calls Claude with max_tokens: 16000
  // which can take 60-120s. Default proxy timeouts (30-60s) cause 502s.
  if (req.setTimeout) req.setTimeout(300000);
  if (res.setTimeout) res.setTimeout(300000);

  const { characterKey, forceRegenerate } = req.body;

  if (!characterKey) {
    return res.status(400).json({ error: 'characterKey required' });
  }

  // Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // disable nginx buffering
  });

  // Send keepalive comments every 15s to prevent proxy timeouts
  const keepalive = setInterval(() => {
    try { res.write(': keepalive\n\n'); } catch (_) {}
  }, 15000);

  // Clean up on client disconnect
  req.on('close', () => clearInterval(keepalive));

  const send = (step, data = {}) => {
    res.write(`data: ${JSON.stringify({ step, ...data })}\n\n`);
  };

  const finish = () => {
    clearInterval(keepalive);
    res.end();
  };

  const sendError = (message) => {
    res.write(`data: ${JSON.stringify({ step: 'error', message })}\n\n`);
    finish();
  };

  // Step 1: Load character DNA
  send('loading_dna', { message: `Loading ${characterKey} character DNA…` });

  let dna = CHARACTER_DNA[characterKey];

  if (!dna) {
    const dbProfile = await loadCharacterProfile(characterKey);
    if (!dbProfile) {
      return sendError(`No character DNA or DB profile found for ${characterKey}`);
    }

    const { Op } = require('sequelize');
    const { RegistryCharacter } = require('../../models');
    const charRow = await RegistryCharacter.findOne({
      where: { character_key: characterKey, status: { [Op.in]: ['accepted', 'finalized'] } },
      order: [['updated_at', 'DESC']],
    });

    if (!charRow) {
      return sendError(`No accepted/finalized character found for ${characterKey}`);
    }

    const plain = charRow.get({ plain: true });
    const career = plain.career_status || {};

    dna = {
      display_name: plain.display_name,
      role_type: plain.role_type || 'support',
      job: career.current || plain.description?.slice(0, 200) || 'To be developed across stories.',
      desire_line: plain.core_desire || 'To be developed.',
      fear_line: plain.core_fear || 'To be developed.',
      wound: plain.core_wound || 'To be developed.',
      strengths: plain.personality_matrix?.strengths || (plain.signature_trait ? [plain.signature_trait] : ['Resilience', 'Adaptability']),
      job_antagonist: 'To be developed across stories.',
      personal_antagonist: 'To be developed across stories.',
      recurring_object: 'To be developed across stories.',
      world: 'dynamic',
      domains: {
        career: career.current || 'To be developed across stories.',
        romantic: 'To be developed across stories.',
        family: 'To be developed across stories.',
        friends: 'To be developed across stories.',
      },
    };
  }

  send('loading_dna', { message: `${dna.display_name} DNA loaded`, done: true });

  // Cache check
  if (!forceRegenerate && seTaskArcCache.has(characterKey)) {
    send('done', { cached: true, ...seTaskArcCache.get(characterKey) });
    return finish();
  }

  try {
    // Step 2: Load character data and arc context
    send('loading_context', { message: 'Loading character data, arc context & registry…' });

    const { Op } = require('sequelize');
    const [characterData, arcContext, registryChars] = await Promise.all([
      db.RegistryCharacter.findOne({
        where: { character_key: characterKey },
        attributes: ['id', 'display_name', 'core_wound', 'core_desire', 'core_fear'],
      }),
      buildArcGenerationContext(characterKey),
      db.RegistryCharacter.findAll({
        where: { status: { [Op.in]: ['accepted', 'finalized'] }, world: 'book-1' },
        attributes: ['character_key', 'display_name', 'role_type', 'subtitle', 'description'],
        order: [['role_type', 'ASC'], ['display_name', 'ASC']],
      }).then(rows => rows.map(r => r.get({ plain: true }))).catch(() => null),
    ]);

    send('loading_context', {
      message: `Context loaded — character${characterData ? ' ✓' : ' –'}, registry (${registryChars?.length || 0} chars) ✓`,
      done: true,
    });

    // Step 3: Build arc with Claude (streaming)
    send('building_arc', { message: 'Claude is generating 50 chapter briefs with situations…', tokens: 0 });

    const systemPrompt = ARC_SYSTEM_PROMPT;
    const userPrompt = buildArcUserPrompt(
      characterKey,
      characterData?.dataValues || { display_name: dna.display_name, core_wound: dna.wound, core_desire: dna.desire_line, core_fear: dna.fear_line },
      arcContext,
      registryChars,
    );

    let rawText = '';
    let tokenCount = 0;
    let lastProgressUpdate = 0;

    // Helper: stream progress tracker for chapter-based output
    const trackStreamProgress = (text) => {
      rawText += text;
      tokenCount += Math.ceil(text.length / 4); // rough estimate

      // Send progress every ~500 tokens to avoid flooding
      if (tokenCount - lastProgressUpdate > 500) {
        lastProgressUpdate = tokenCount;

        // Detect how many chapters have been generated so far
        const storyMatches = rawText.match(/"story_number"\s*:\s*\d+/g);
        const chaptersFound = storyMatches ? storyMatches.length : 0;

        send('building_arc', {
          message: chaptersFound > 0
            ? `Writing chapter briefs… ${chaptersFound}/50`
            : 'Building chapter architecture…',
          tokens: tokenCount,
          storiesFound: chaptersFound,
          hasSpine: false,
        });
      }
    };

    try {
      const stream = anthropic.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 32000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      stream.on('text', trackStreamProgress);
      await stream.finalMessage();
    } catch (apiErr) {
      const isRetryable = apiErr.status === 529 || apiErr.status === 503 || apiErr.status === 404;
      console.error('[generate-story-tasks-stream] primary attempt failed:', apiErr.status, apiErr.message);
      if (isRetryable) {
        send('building_arc', { message: 'Retrying Claude call…', tokens: tokenCount });
        await new Promise(r => setTimeout(r, 2000));

        rawText = '';
        tokenCount = 0;
        lastProgressUpdate = 0;

        const retryStream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 32000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        });

        retryStream.on('text', trackStreamProgress);
        await retryStream.finalMessage();
      } else {
        throw apiErr;
      }
    }

    send('building_arc', { message: 'Arc generation complete', done: true, tokens: tokenCount });

    // Step 4: Parse response
    send('parsing', { message: 'Parsing 50 chapter briefs…' });

    let parsed;
    try {
      let cleaned = rawText.replace(/```json|```/g, '').trim();
      // New format returns a JSON array; old format returns an object
      const firstBracket = cleaned.indexOf('[');
      const firstBrace = cleaned.indexOf('{');
      if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
        const lastBracket = cleaned.lastIndexOf(']');
        if (lastBracket > firstBracket) {
          cleaned = cleaned.slice(firstBracket, lastBracket + 1);
        }
      } else if (firstBrace !== -1) {
        const lastBrace = cleaned.lastIndexOf('}');
        if (lastBrace > firstBrace) {
          cleaned = cleaned.slice(firstBrace, lastBrace + 1);
        }
      }
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      // Attempt truncated JSON recovery — close open arrays/objects
      console.warn('[generate-story-tasks-stream] JSON parse failed, attempting truncated recovery:', parseErr.message);
      try {
        let cleaned = rawText.replace(/```json|```/g, '').trim();
        const firstBrace = cleaned.indexOf('{');
        if (firstBrace !== -1) cleaned = cleaned.slice(firstBrace);
        // Remove any trailing partial object (after last complete } before a comma or incomplete field)
        const lastCompleteObj = cleaned.lastIndexOf('}');
        if (lastCompleteObj !== -1) {
          cleaned = cleaned.slice(0, lastCompleteObj + 1);
        }
        // Close any remaining open brackets
        const opens = (cleaned.match(/\[/g) || []).length;
        const closes = (cleaned.match(/\]/g) || []).length;
        cleaned += ']'.repeat(Math.max(0, opens - closes));
        const openBraces = (cleaned.match(/\{/g) || []).length;
        const closeBraces = (cleaned.match(/\}/g) || []).length;
        cleaned += '}'.repeat(Math.max(0, openBraces - closeBraces));
        parsed = JSON.parse(cleaned);
        const recoveredCount = parsed.tasks?.length || 0;
        console.log(`[generate-story-tasks-stream] Recovered ${recoveredCount} tasks from truncated response`);
        send('parsing', { message: `Recovered ${recoveredCount}/50 briefs from truncated response` });
      } catch (recoveryErr) {
        console.error('[generate-story-tasks-stream] Recovery also failed:', recoveryErr.message);
        return sendError(`Failed to parse arc from Claude: ${parseErr.message}`);
      }
    }

    // Normalize: array → { tasks }, object with tasks key → pass through
    const tasks = Array.isArray(parsed) ? parsed : (parsed.tasks || []);
    const taskCount = tasks.length;
    send('parsing', { message: `Parsed ${taskCount} chapter briefs`, done: true, taskCount });

    // Step 5: Save to cache + DB
    send('saving', { message: 'Saving arc to database…' });

    const result = {
      character_key: characterKey,
      display_name: dna.display_name,
      world: dna.world,
      narrative_spine: Array.isArray(parsed) ? null : (parsed.narrative_spine || null),
      tasks,
    };

    seTaskArcCache.set(characterKey, result);

    try {
      await db.StoryTaskArc.sync();
      await db.StoryTaskArc.upsert({
        character_key: characterKey,
        display_name: result.display_name,
        world: result.world,
        narrative_spine: result.narrative_spine,
        tasks: result.tasks,
      });
    } catch (persistErr) {
      console.warn('[generate-story-tasks-stream] DB persist failed:', persistErr.message);
    }

    send('saving', { message: 'Arc saved', done: true });

    // Final: send the full result
    send('done', { cached: false, ...result });
    finish();

  } catch (err) {
    console.error('[generate-story-tasks-stream] error:', err?.message);
    sendError('Task generation failed.');
  }
});

// ─── POST /generate-next-chapter ──────────────────────────────────────────────
// Generates a SINGLE next chapter brief based on previously approved chapters.
// Called automatically after chapter approval or manually for the first chapter.
router.post('/generate-next-chapter', optionalAuth, async (req, res) => {
  if (req.setTimeout) req.setTimeout(120000);
  if (res.setTimeout) res.setTimeout(120000);

  const { characterKey } = req.body;
  if (!characterKey) return res.status(400).json({ error: 'characterKey required' });

  try {
    // Load character DNA — resolve DB key → seed key via SE_DB_KEY_MAP
    let dna = CHARACTER_DNA[characterKey];
    if (!dna) {
      // Reverse lookup: DB key (e.g. 'just-a-woman') → seed key (e.g. 'justawoman')
      for (const [seedKey, dbKeys] of Object.entries(SE_DB_KEY_MAP)) {
        if (dbKeys.includes(characterKey)) {
          dna = CHARACTER_DNA[seedKey];
          break;
        }
      }
    }
    if (!dna) {
      const dbProfile = await loadCharacterProfile(characterKey);
      if (!dbProfile) return res.status(400).json({ error: `No character DNA found for ${characterKey}` });
      const { Op } = require('sequelize');
      const { RegistryCharacter } = require('../../models');
      const charRow = await RegistryCharacter.findOne({
        where: { character_key: characterKey, status: { [Op.in]: ['accepted', 'finalized'] } },
        order: [['updated_at', 'DESC']],
      });
      if (!charRow) return res.status(400).json({ error: `No accepted character found for ${characterKey}` });
      const plain = charRow.get({ plain: true });
      dna = { display_name: plain.display_name, core_wound: plain.core_wound, core_desire: plain.core_desire, core_fear: plain.core_fear };
    }

    // Load existing tasks (approved chapters)
    let existingTasks = [];
    if (seTaskArcCache.has(characterKey)) {
      existingTasks = seTaskArcCache.get(characterKey).tasks || [];
    } else if (db.StoryTaskArc) {
      try {
        const dbArc = await db.StoryTaskArc.unscoped().findOne({ where: { character_key: characterKey } });
        if (dbArc?.tasks?.length) existingTasks = dbArc.tasks;
      } catch (arcErr) {
        console.warn('[generate-next-chapter] StoryTaskArc query failed:', arcErr.message);
      }
    }

    // Load approved story texts for context
    let approvedStories = [];
    try {
      approvedStories = await db.StorytellerStory.unscoped().findAll({
        where: { character_key: characterKey, status: 'approved' },
        order: [['story_number', 'ASC']],
        attributes: ['story_number', 'title', 'scene_brief', 'status'],
      });
    } catch (storyErr) {
      console.warn('[generate-next-chapter] StorytellerStory query failed:', storyErr.message);
    }

    const nextChapterNum = existingTasks.length + 1;
    if (nextChapterNum > 50) {
      return res.json({ complete: true, message: 'All 50 chapters have been generated.' });
    }

    // Determine phase & arc position
    const phase = nextChapterNum <= 10 ? 'establishment' :
                  nextChapterNum <= 25 ? 'pressure' :
                  nextChapterNum <= 40 ? 'crisis' : 'integration';
    const woundClock = 75 + (nextChapterNum - 1);
    const stakesLevel = nextChapterNum <= 10 ? Math.min(2, Math.ceil(nextChapterNum / 5)) :
                        nextChapterNum <= 25 ? Math.min(5, 3 + Math.floor((nextChapterNum - 10) / 5)) :
                        nextChapterNum <= 40 ? Math.min(8, 6 + Math.floor((nextChapterNum - 25) / 5)) :
                        Math.min(10, 9 + Math.floor((nextChapterNum - 40) / 5));

    // Build previous chapter summaries for context
    const prevChapterContext = existingTasks.slice(-5).map(t => {
      const sitSummary = (t.situations || []).map(s =>
        `  - ${s.title || s.situation_type}: ${s.what_happens || ''}`
      ).join('\n');
      return `Chapter ${t.story_number}: "${t.title}" [${t.phase}] wound=${t.wound_clock || '?'} stakes=${t.stakes_level || '?'}
  Theme: ${t.chapter_theme || '—'}
  Arc: ${t.chapter_arc || '—'}
  Situations:\n${sitSummary}`;
    }).join('\n\n');

    const userPrompt = `Generate exactly 1 chapter brief — Chapter ${nextChapterNum} of 50.

PHASE: ${phase}
WOUND CLOCK: ${woundClock}
STAKES LEVEL: ${stakesLevel}

${existingTasks.length > 0 ? `PREVIOUS CHAPTERS (last ${Math.min(5, existingTasks.length)} for continuity):
${prevChapterContext}

Build on what has been established. Do not repeat situations. Advance the story.
${nextChapterNum > 1 ? `The previous chapter left her with: "${existingTasks[existingTasks.length - 1]?.chapter_arc || '—'}"` : ''}
` : `This is Chapter 1. She enters mid-routine, not at a beginning.`}

PHASE REQUIREMENTS FOR ${phase.toUpperCase()}:
${phase === 'establishment' ? '- Heavy domestic + ambitious tones. Light digital. No reckoning yet.\n- Marcus does not appear until Chapter 3 minimum (Phase 1 only).\n- Establish her routine, world, wound, wanting.' :
  phase === 'pressure' ? '- More digital + friction. Watching intensifies.\n- Marcus transitions from Phase 1 to Phase 2 around Chapters 14-16.\n- David\'s emotional labor becomes subtly visible.\n- The gap between real and online life has edges now.' :
  phase === 'crisis' ? '- Heavy friction + reckoning. Digital feels uncanny.\n- Marcus fully Phase 3 — constant, repetitive, body-focused.\n- Nothing breaks dramatically. Everything shifts permanently.\n- Controlled tension only — never loud.' :
  '- She is living as the uncontained version.\n- Marcus present but she is changing the terms.\n- Lala tone bleeds through starting Chapter 47.\n- Integration feels earned, not resolved.'}

Return a single JSON object (NOT an array). No preamble. No markdown fences. No trailing text.

Use this exact structure:
{
  "story_number": ${nextChapterNum},
  "title": "Chapter title — evocative, not descriptive",
  "phase": "${phase}",
  "chapter_theme": "One sentence.",
  "wound_clock": ${woundClock},
  "stakes_level": ${stakesLevel},
  "situations": [ 3-5 situation objects with situation_number, situation_type, tone, title, characters_present, what_happens, what_she_knows, what_she_doesnt_say, texture_layers, opening_line ],
  "story_type": "internal | collision | wrong_win | quiet_victory",
  "chapter_arc": "What this chapter leaves her with. One sentence.",
  "david_presence": "present | background | absent | phone",
  "marcus_phase": "none | phase_1 | phase_2 | phase_3",
  "phone_appears": true/false,
  "elias_notices": true/false,
  "new_character": false,
  "new_character_name": null,
  "new_character_role": null
}`;

    const anthropicClient = new Anthropic();
    const response = await anthropicClient.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: ARC_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const rawText = response.content[0]?.text || '';
    let chapter;
    try {
      let cleaned = rawText.replace(/```json|```/g, '').trim();
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.slice(firstBrace, lastBrace + 1);
      }
      chapter = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('[generate-next-chapter] JSON parse failed:', parseErr.message);
      return res.status(500).json({ error: 'Failed to parse chapter brief from Claude' });
    }

    // Ensure story_number is correct
    chapter.story_number = nextChapterNum;

    // Append to existing tasks
    const updatedTasks = [...existingTasks, chapter];

    // Update cache + DB
    const result = {
      character_key: characterKey,
      display_name: dna.display_name || characterKey,
      world: dna.world || null,
      narrative_spine: null,
      tasks: updatedTasks,
    };
    seTaskArcCache.set(characterKey, result);

    try {
      await db.StoryTaskArc.sync();
      await db.StoryTaskArc.upsert({
        character_key: characterKey,
        display_name: result.display_name,
        world: result.world,
        narrative_spine: null,
        tasks: updatedTasks,
      });
    } catch (persistErr) {
      console.warn('[generate-next-chapter] DB persist failed:', persistErr.message);
    }

    res.json({ chapter, allTasks: updatedTasks, chapterNumber: nextChapterNum, totalGenerated: updatedTasks.length });
  } catch (err) {
    console.error('[generate-next-chapter] error:', err?.message);
    console.error('[generate-next-chapter] stack:', err?.stack?.split('\n').slice(0, 5).join('\n'));
    res.status(500).json({ error: 'Chapter generation failed', detail: err?.message });
  }
});

// ─── Story type inference ─────────────────────────────────────────────────────
// Derives story_type from situation types when the arc brief doesn't include it
function inferStoryType(taskBrief) {
  const situations = taskBrief.situations || [];
  const types = situations.map(s => (s.situation_type || '').toUpperCase());
  const hasConflict = types.some(t => ['SOCIAL_FRICTION', 'COLLISION', 'CONFRONTATION'].includes(t));
  const hasMultipleChars = situations.some(s => (s.characters_present || []).length >= 3);
  if (hasConflict && hasMultipleChars) return 'collision';
  const hasWin = types.some(t => ['VICTORY', 'ACHIEVEMENT', 'WIN', 'WRONG_WIN'].includes(t));
  if (hasWin) return 'wrong_win';
  return null; // fall through to 'internal' default
}

// ─── Narrative variety engine ──────────────────────────────────────────────────
// Each story gets a unique combination of structure, POV, length, and technique
// based on its position in the arc, phase, and story type.

function buildCraftRules(storyNumber, taskBrief, dna) {
  const phase = taskBrief.phase || 'establishment';
  // Derive story_type: use explicit value, or infer from situations
  const storyType = taskBrief.story_type || inferStoryType(taskBrief) || 'internal';
  const n = storyNumber || 1;

  // ── Word count varies by phase and story position ──
  const lengthRanges = {
    establishment: { min: 2800, max: 4200 },  // shorter, grounding
    pressure:      { min: 3500, max: 5500 },  // building, expanding
    crisis:        { min: 4000, max: 6500 },  // longer, the big moments need room
    integration:   { min: 2000, max: 5000 },  // widest range — some need brevity, some need space
  };
  // Key turning points get extra room
  const isTurningPoint = [8, 9, 10, 11, 18, 19, 20, 21, 28, 29, 30, 31, 36, 37, 38, 39, 46, 47, 48, 49, 50].includes(n);
  const range = lengthRanges[phase] || lengthRanges.establishment;
  const wordMin = isTurningPoint ? range.min + 500 : range.min;
  const wordMax = isTurningPoint ? range.max + 1000 : range.max;

  // ── Domain focus — NOT all four in every story ──
  const domainInstructions = {
    establishment: 'All four life domains should be present — the reader is learning this world.',
    pressure: `Focus on 2-3 domains that are actively colliding. The others can be present as background texture, not as active storylines. Go DEEP on the domains that matter most to this story's task.`,
    crisis: `Focus on the 1-2 domains under maximum pressure. The others exist only as absence — what she is NOT attending to while this crisis unfolds. Depth over breadth.`,
    integration: `Let the domains that need it breathe. Some stories in integration should go deep on ONE domain. Others should show how all four have been reshaped. Match the task.`,
  };

  // ── POV and narrative distance varies ──
  const povOptions = [
    { pov: 'close third person — deep in her interior', weight: 60 },
    { pov: 'close third person — slightly pulled back, observational, almost cinematic', weight: 15 },
    { pov: 'close third person — so deep it feels like first person without using "I"', weight: 15 },
    { pov: 'close third person — with one section that shifts to another character\'s perspective (mark the shift with a section break)', weight: 10 },
  ];
  // Deterministic selection based on story number
  const povSeed = (n * 7 + 3) % 100;
  let povCumulative = 0;
  let selectedPov = povOptions[0].pov;
  for (const opt of povOptions) {
    povCumulative += opt.weight;
    if (povSeed < povCumulative) { selectedPov = opt.pov; break; }
  }

  // ── Narrative technique — varies by story type and position ──
  const techniques = {
    internal: [
      'Standard scene-based narrative with deep interiority.',
      'Open with the ending, then show how she got there. Non-linear — the reader knows the outcome, the tension is in the HOW.',
      'A single continuous scene — real-time, no cuts, one unbroken sequence. Claustrophobic intimacy.',
      'Alternate between the present action and a memory. Two timelines braided together, each illuminating the other.',
      'Interior monologue interrupted by the external world. The story lives in her head, but reality keeps crashing in.',
    ],
    collision: [
      'Standard scene-based narrative with escalating tension.',
      'Dialogue-driven. This story is 50%+ conversation. The conflict lives in what people say and don\'t say.',
      'Two parallel storylines that converge. Show both characters approaching the collision from their own angles before they meet.',
      'The collision happens in the first paragraph. The rest of the story is the aftermath — what the collision broke open.',
      'Ensemble scene — multiple characters in one space, overlapping conversations, competing needs. Like a dinner party that goes wrong.',
    ],
    wrong_win: [
      'Standard scene-based narrative where success curdles.',
      'Build the success as triumph for 80% of the story. The wrongness reveals itself in the final 20%. The reader should feel the floor tilt.',
      'Frame it as a celebration or achievement story — then let one small detail unravel everything. The detail should have been visible all along.',
      'Tell the story from the perspective of someone watching her win. They see what she can\'t.',
      'Start with the aftermath of the win. Open with what it cost. Then show the winning.',
    ],
  };

  const typeOpts = techniques[storyType] || techniques.internal;
  const techIndex = (n * 13 + 5) % typeOpts.length;
  const selectedTechnique = typeOpts[techIndex];

  // ── Ending type varies by phase ──
  const endingTypes = {
    establishment: [
      'End on a quiet shift — something small has changed that the reader notices before the character does.',
      'End on a question the character asks herself that she couldn\'t have asked at the beginning.',
      'End on a sensory detail that carries the weight of the whole story.',
    ],
    pressure: [
      'End on an escalation — the last sentence should raise the stakes, not resolve them.',
      'End mid-action. Cut the story off while something is still happening. Leave the reader leaning forward.',
      'End on a silence — someone doesn\'t say the thing. The reader knows what it was.',
    ],
    crisis: [
      'End on devastation. Something is broken. Let it be broken. Do not comfort the reader.',
      'End on a choice. She decides. The reader doesn\'t know yet if she\'s right.',
      'End on a reversal — what she thought was true isn\'t. The last paragraph reshapes every scene before it.',
    ],
    integration: [
      'End on acceptance — not resolution. She sees something clearly that she couldn\'t before.',
      'End on tenderness that hurts. A gentle moment that the reader knows is fragile.',
      'End on the beginning of something new. Not hopeful — real. She is different now and she knows it.',
      'End on a circular return to where story 1 began — but everything means something different now.',
    ],
  };

  const endOpts = endingTypes[phase] || endingTypes.establishment;
  const endIndex = (n * 11 + 2) % endOpts.length;
  const selectedEnding = endOpts[endIndex];

  // ── Scene structure varies ──
  const sceneStructures = {
    establishment: `SCENE STRUCTURE:
This story needs 3-5 distinct scenes. Ground each in a specific place and time.
- Open in the character's body. The task should be visible within the first 300 words.
- Between scenes: SENSORY TRANSITIONS — ground each change in a physical detail.
- Alternate TENSION and BREATH.`,

    pressure: `SCENE STRUCTURE:
This story needs 3-6 scenes. The pressure should build across scene breaks — each scene tighter than the last.
- Open with forward momentum. Something is already in motion.
- At least one scene should create collision between domains.
- The character should be forced to act, choose, or reveal something.
- Pacing: the screws tighten. Breaths get shorter.`,

    crisis: `SCENE STRUCTURE:
This story can have 1-7 scenes. Match the crisis. A single unbroken scene of confrontation. Or short sharp cuts between fragmenting realities. Let the structure mirror the pressure.
- Open in the middle of it. No setup. The reader catches up.
- At least one moment where the character's control breaks — something leaks through.
- Structure should feel different from the stories around it. This is the peak. It should read like it.`,

    integration: `SCENE STRUCTURE:
This story needs 2-5 scenes. The pacing is different here — more breath, more space, but NOT less weight.
- Open with stillness or aftermath. The storm has passed (or is passing).
- At least one moment of genuine interiority — not reaction, but understanding.
- Let scenes breathe. Longer beats. The reader needs to sit with what has happened.`,
  };

  const dialogueGuide = storyType === 'collision'
    ? 'Dialogue ratio: 30-50%. This story lives in conversation. Let it.'
    : storyType === 'wrong_win'
      ? 'Dialogue ratio: 20-35%. The wrong win needs both action and the words people say when they think things are going well.'
      : 'Dialogue ratio: 10-30%. This story lives in interiority. Dialogue is punctuation, not the main text.';

  return `CRAFT RULES:
- Length: ${wordMin}-${wordMax} words.
- ${domainInstructions[phase]}
- The TASK creates the clock. The obstacle hits inside the task.
- The recurring object (${dna.recurring_object}) should appear naturally — not forced. If it doesn't fit this story, let it be absent.
- POV: ${selectedPov}
- Do not summarize. Show every scene. Trust the reader.
- The character's desire line and fear line must both be active throughout.
- ${dialogueGuide}
- Every line of dialogue must do double duty — reveal character AND advance plot.
- New character introductions: name, one physical detail, one line of dialogue that reveals their entire persona. No more than one paragraph.

NARRATIVE APPROACH FOR THIS SPECIFIC STORY:
${selectedTechnique}

${sceneStructures[phase]}

ENDING:
${selectedEnding}`;
}

// ─── POST /generate-story ─────────────────────────────────────────────────────
// Generates one complete short story (3300-4800 words) from a task brief.
router.post('/generate-story', optionalAuth, async (req, res) => {
  const {
    characterKey,
    storyNumber,
    taskBrief,
    previousStories,
  } = req.body;

  if (!characterKey || !storyNumber || !taskBrief) {
    return res.status(400).json({ error: 'characterKey, storyNumber, and taskBrief required' });
  }

  // Try hardcoded DNA first, then build from DB (same logic as generate-story-tasks)
  let dna = CHARACTER_DNA[characterKey];

  if (!dna) {
    const { Op } = require('sequelize');
    const { RegistryCharacter } = require('../../models');
    const charRow = await RegistryCharacter.findOne({
      where: { character_key: characterKey, status: { [Op.in]: ['accepted', 'finalized'] } },
      order: [['updated_at', 'DESC']],
    });
    if (!charRow) {
      return res.status(400).json({ error: `No character DNA or DB profile for ${characterKey}` });
    }
    const plain = charRow.get({ plain: true });
    const career = plain.career_status || {};
    dna = {
      display_name: plain.display_name,
      role_type: plain.role_type || 'support',
      job: career.current || plain.description?.slice(0, 200) || 'To be developed.',
      desire_line: plain.core_desire || 'To be developed.',
      fear_line: plain.core_fear || 'To be developed.',
      wound: plain.core_wound || 'To be developed.',
      strengths: plain.personality_matrix?.strengths || (plain.signature_trait ? [plain.signature_trait] : ['Resilience', 'Adaptability']),
      job_antagonist: 'To be developed.',
      personal_antagonist: 'To be developed.',
      recurring_object: 'To be developed.',
      world: 'dynamic',
      domains: {
        career: career.current || 'To be developed.',
        romantic: 'To be developed.',
        family: 'To be developed.',
        friends: 'To be developed.',
      },
    };
  }

  // Keep-alive: send whitespace every 15s to prevent ALB/nginx 504 timeout
  // JSON.parse ignores leading whitespace so this is transparent to the client
  res.setHeader('Content-Type', 'application/json');
  let finished = false;
  const keepAlive = setInterval(() => {
    if (!finished) try { res.write(' '); } catch (_) { /* connection already closed */ }
  }, 15000);

  const finish = (data) => {
    finished = true;
    clearInterval(keepAlive);
    res.end(JSON.stringify(data));
  };

  const fallback = () => finish({
    story: null,
    fallback: true,
    reason: 'Story generation failed — try again.',
  });

  try {
    // Build previous stories context — relevance-based, not just recency
    let previousContext;
    if (previousStories?.length) {
      // Always include last 3 with full context (direct continuity)
      const last3 = previousStories.slice(-3);

      // For older stories, identify thematically relevant ones using the current brief
      const older = previousStories.slice(0, -3);
      let relevantOlder = [];
      let remainingOlder = [];

      if (older.length > 5) {
        // Use a fast model to pick the most relevant older stories for this brief
        try {
          const relevanceCheck = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 500,
            system: 'Return ONLY a JSON array of story numbers. No commentary.',
            messages: [{ role: 'user', content: `Current story brief: "${taskBrief.title}" — ${taskBrief.task}. Obstacle: ${taskBrief.obstacle}. Phase: ${taskBrief.phase}. Strength weaponized: ${taskBrief.strength_weaponized}.

Which of these earlier stories are most THEMATICALLY relevant to the current brief? Pick up to 5 that share themes, characters, emotional territory, or plot threads that should inform continuity.

${older.map(s => `Story ${s.number}: "${s.title}" — ${(s.summary || '').slice(0, 150)}`).join('\n')}

Return JSON array of story numbers, e.g. [3, 7, 14]` }],
          });
          const relRaw = relevanceCheck.content?.[0]?.text || '[]';
          const relNums = JSON.parse(relRaw.replace(/```json|```/g, '').trim());
          if (Array.isArray(relNums)) {
            relevantOlder = older.filter(s => relNums.includes(s.number));
            remainingOlder = older.filter(s => !relNums.includes(s.number));
          } else {
            remainingOlder = older;
          }
        } catch (relErr) {
          console.warn(`[relevance-check] Story ${storyNumber} for ${characterKey} failed: ${relErr?.message} — falling back to recency`);
          remainingOlder = older;
        }
      } else {
        remainingOlder = older;
      }

      const contextParts = [];
      if (remainingOlder.length) {
        contextParts.push('EARLIER ARC STORIES (titles — these established the foundation):\n' +
          remainingOlder.map(s => `- Story ${s.number}: "${s.title}"`).join('\n'));
      }
      if (relevantOlder.length) {
        contextParts.push('THEMATICALLY RELEVANT EARLIER STORIES (these share emotional territory with the current brief — use for deep continuity):\n' +
          relevantOlder.map(s => `- Story ${s.number}: "${s.title}" — ${(s.summary || '').slice(0, 500)}`).join('\n'));
      }
      contextParts.push('MOST RECENT STORIES (direct continuity — the story you write follows these):\n' +
        last3.map(s => `- Story ${s.number}: "${s.title}" — ${s.summary || ''}`).join('\n'));
      previousContext = contextParts.join('\n\n');
    } else {
      previousContext = 'This is the first story in the arc.';
    }

    // Load all context in parallel for speed
    const [dbProfile, storyMemories, worldState, relationships, activeThreads, locations, canonEvents, proseStyle, voiceCards, dramaticIrony, followInfluence, voiceFingerprints, arcContext, therapyProfile, growthLogs, franchiseKnowledge, recentWorldEvents] = await Promise.all([
      loadCharacterProfile(characterKey),
      loadStoryMemories(characterKey),
      loadWorldState(characterKey, dna.world),
      loadCharacterRelationships(characterKey),
      loadActiveThreads(characterKey, dna.world),
      loadLocations(characterKey),
      loadCanonEvents(characterKey),
      loadProseStyleAnchor(characterKey),
      loadDialogueVoiceCards(characterKey),
      loadDramaticIrony(characterKey),
      loadFollowInfluence(characterKey),
      loadVoiceFingerprints(characterKey),
      loadArcContext(characterKey),
      loadTherapyProfile(characterKey),
      loadGrowthLogs(characterKey),
      loadFranchiseKnowledge(characterKey),
      loadRecentWorldEvents(characterKey),
    ]);

    // ── Context presence logging ─────────────────────────────────────────────
    const contextPresence = {
      profile: !!dbProfile, memories: !!storyMemories, world: !!worldState,
      relationships: !!relationships, threads: !!activeThreads, locations: !!locations,
      canon: !!canonEvents, prose: !!proseStyle, voiceCards: !!voiceCards,
      irony: !!dramaticIrony, follow: !!followInfluence, fingerprints: !!voiceFingerprints,
      arc: !!arcContext, therapy: !!therapyProfile, growth: !!growthLogs,
      franchise: !!franchiseKnowledge, worldEvents: !!recentWorldEvents,
    };
    const missingContext = Object.entries(contextPresence).filter(([, v]) => !v).map(([k]) => k);
    if (missingContext.length > 0) {
      console.log(`[generate-story] Story ${storyNumber} for ${characterKey} — missing context: ${missingContext.join(', ')}`);
    }

    const profileSection = dbProfile
      ? `\n\nCHARACTER PROFILE FROM REGISTRY (ground the story in these details — this is who they really are):\n${dbProfile}`
      : '';
    const memoriesSection = storyMemories ? `\n\n${storyMemories}` : '';
    const worldSection = worldState ? `\n\n${worldState}` : '';
    const relationshipsSection = relationships ? `\n\n${relationships}` : '';
    const threadsSection = activeThreads ? `\n\n${activeThreads}` : '';
    const locationsSection = locations ? `\n\n${locations}` : '';
    const canonSection = canonEvents ? `\n\n${canonEvents}` : '';
    const proseSection = proseStyle
      ? `\n\nAUTHOR'S PROSE STYLE (match this voice — this is what the author's writing actually sounds like):\n"""${proseStyle}"""\nWrite in this register. Match the sentence rhythms, the level of interiority, the way observations land. Don't imitate word-for-word — absorb the voice.`
      : '';
    const voiceCardsSection = voiceCards ? `\n\n${voiceCards}` : '';
    const ironySection = dramaticIrony ? `\n\n${dramaticIrony}` : '';
    const followSection = followInfluence ? `\n\n${followInfluence}` : '';
    const fingerprintSection = voiceFingerprints ? `\n\n${voiceFingerprints}` : '';
    const arcSection = arcContext ? `\n\n${arcContext}` : '';
    const therapySection = therapyProfile ? `\n\n${therapyProfile}` : '';
    const growthSection = growthLogs ? `\n\n${growthLogs}` : '';
    const franchiseSection = franchiseKnowledge ? `\n\n${franchiseKnowledge}` : '';
    const worldEventsSection = recentWorldEvents ? `\n\n${recentWorldEvents}` : '';

    // Build pacing analysis from recent stories to prevent repetitive structure
    let pacingSection = '';
    if (previousStories?.length >= 2) {
      const recentBriefs = previousStories.slice(-3);
      const patterns = recentBriefs.map(s => {
        const brief = s.taskBrief || s;
        return `  Story ${s.number}: type=${brief.story_type || '?'}, location=${brief.primary_location || '?'}, time=${brief.time_of_day || '?'}, emotional_start=${brief.emotional_start || '?'}`;
      });
      pacingSection = `\n\nPACING ANALYSIS (vary structure to prevent repetition — the last ${recentBriefs.length} stories used these patterns):
${patterns.join('\n')}
VARY: If recent stories opened in the same time of day, choose a different one. If they were all internal, bring collision energy. If they all started with tension, open with quiet. The reader needs rhythm — tension then breath, breath then tension. Surprise them with structure, not just plot.`;
    }

    const strengthsList = Array.isArray(dna.strengths) ? dna.strengths.join(', ') : (dna.strengths || 'Resilience');

    const systemPrompt = `You are writing Story ${storyNumber} of 50 in ${dna.display_name}'s arc.

CHARACTER DNA:
Name: ${dna.display_name}
Job: ${dna.job}
Desire line: ${dna.desire_line}
Fear line: ${dna.fear_line}
Wound: ${dna.wound}
Strengths: ${strengthsList}
Job antagonist: ${dna.job_antagonist}
Personal antagonist: ${dna.personal_antagonist}
Recurring object: ${dna.recurring_object}${profileSection}${arcSection}${therapySection}${growthSection}${relationshipsSection}${memoriesSection}${worldSection}${worldEventsSection}${threadsSection}${locationsSection}${canonSection}${franchiseSection}${proseSection}${voiceCardsSection}${fingerprintSection}${ironySection}${followSection}${pacingSection}

DOMAINS TO WEAVE (all four must be present):
Career: ${dna.domains.career}
Romantic: ${dna.domains.romantic}
Family: ${dna.domains.family}
Friends: ${dna.domains.friends}

THIS STORY:
Phase: ${taskBrief.phase}
Type: ${taskBrief.story_type}
Title: ${taskBrief.title}
Task: ${taskBrief.task}
Obstacle: ${taskBrief.obstacle}
Strength being weaponized: ${taskBrief.strength_weaponized}
Opening line suggested: ${taskBrief.opening_line}
${taskBrief.emotional_start ? `Emotional arc START: ${taskBrief.emotional_start}` : ''}
${taskBrief.emotional_end ? `Emotional arc END: ${taskBrief.emotional_end}` : ''}
${taskBrief.primary_location ? `Primary setting: ${taskBrief.primary_location}` : ''}
${taskBrief.time_of_day ? `Time of day: ${taskBrief.time_of_day}` : ''}
${taskBrief.season_weather ? `Season/weather: ${taskBrief.season_weather}` : ''}
${taskBrief.new_character ? `New character to introduce: ${taskBrief.new_character_name} — ${taskBrief.new_character_role}` : ''}
${taskBrief.situations?.length ? `
CHAPTER ARCHITECTURE (follow this situation flow — each situation is a scene beat):
${taskBrief.situations.map(s => 
  `  ${s.situation_number}. [${s.situation_type}] "${s.title}" (${s.tone})
     Characters: ${(s.characters_present || []).join(', ')}
     What happens: ${s.what_happens}
     What she knows: ${s.what_she_knows || 'n/a'}
     What she doesn't say: ${s.what_she_doesnt_say || 'n/a'}
     Opening line: "${s.opening_line || ''}"
     Texture layers: ${(s.texture_layers || []).join(', ')}`
).join('\n')}

IMPORTANT: Structure the chapter around these situations in order. Each situation is a scene beat — use the provided opening lines as launch points (adapt but don't discard). The tone shifts between situations create the chapter's rhythm.` : ''}

${previousContext}

TONE & CONTENT RATING:
This is ADULT LITERARY FICTION for an adult readership. The author writes books for grown-ups.
- Characters swear naturally — "fuck", "shit", "damn" — the way real adults do when stressed, angry, aroused, or exhausted. Don't substitute softened versions.
- Sex scenes are explicit and embodied. Show what bodies do, what skin feels like, what gets said and not said during intimacy. Sex reveals character — write it like you'd write a fight scene: specific, physical, emotionally loaded.
- Marital tension, infidelity temptation, financial fear, parenting guilt, career jealousy, body image, racial dynamics, class friction — none of these are off-limits. Write them honestly.
- Violence is psychological more than physical in this world, but when it appears, it lands.
- Do NOT fade to black, cut away, or use euphemisms. If a scene matters enough to be in the story, it matters enough to be shown.
- This is not erotica — sex serves character and plot. But it IS explicit adult fiction where nothing is sanitized.

${buildCraftRules(storyNumber, taskBrief, dna)}

MULTI-PLOT & CONTINUITY RULES:
- If WORLD STATE is provided, naturally reference or intersect with other characters' storylines where organic. Don't force crossovers — let shared spaces (the same city, industry, social circle) create natural collisions.
- If ACCUMULATED PAIN POINTS are provided, build on them — the character carries these forward. Don't re-explain the pain, let it surface in behavior, avoidance, or unexpected tenderness.
- If BELIEF SHIFTS are provided, they represent where the character IS NOW psychologically. Write from the post-shift place, not the pre-shift one.
- If THERAPEUTIC THREADS are provided, let one unresolved thread echo in this story — not as the main plot, but as emotional texture.
- Collision stories should ideally involve a character from the WORLD STATE if available.
- If RELATIONSHIP WEB is provided, use these established dynamics. Family roles, romantic status, rivalries, and alliances are CANON — write characters as they relate to each other, not as strangers. Knowledge asymmetry creates dramatic tension — use what the reader knows but characters don't.
- If ACTIVE STORY THREADS are provided, advance at least one thread in this story. Higher-tension threads are more urgent. Don't resolve threads prematurely — move them forward one beat.
- If ESTABLISHED LOCATIONS are provided, set scenes in these places. Use their sensory details and narrative roles. Don't invent new locations when existing ones serve the scene.
- If CANON EVENTS are provided, they are immutable history. Reference them naturally when relevant. Never contradict a canon event. Consequences of past events should ripple forward into character behavior.

EMOTIONAL ARC RULES:
- If emotional_start and emotional_end are provided, the character MUST begin the story in the start state and land in the end state. The shift should feel earned, not sudden.
- The emotional arc is the SPINE of the story. Every scene either moves toward the shift or creates resistance against it.
- The emotional end state should surprise the character (even if the reader saw it coming). She didn't plan to feel this way.

DRAMATIC IRONY & READER ENGAGEMENT:
- If DRAMATIC IRONY entries are provided, USE them — let the reader feel the gap between what they know and what the character knows. This is where page-turning tension lives.
- If OPEN MYSTERIES are listed, reference or deepen at least one. Don't resolve unless this is explicitly the right story for resolution.
- If FORESHADOWING SEEDS are listed, let one echo naturally in this story. A callback the reader will catch but the character won't.
- Plant at least ONE new mystery or question in every story — something the reader will carry forward. It can be small (an unexplained reaction, an overheard fragment, a detail that doesn't add up).

DIALOGUE VOICE RULES:
- If DIALOGUE VOICE CARDS are provided, every character who speaks must sound like THEMSELVES, not like the narrator. Different vocabulary, different rhythms, different sentence lengths.
- Characters from different class backgrounds sound different. Characters under stress sound different than characters at ease. Match the voice to the moment.
- Silence is dialogue too — track what characters DON'T say. The unsaid is often more powerful than the said.

Write the complete story now. No preamble. Begin with the title, then the story.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 10000,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Write Story ${storyNumber}: "${taskBrief.title}"` }],
    });

    let storyText = response.content?.[0]?.text || '';

    if (!storyText || storyText.length < 500) {
      return fallback();
    }

    // ── Quality gate — fast check for show-don't-tell and craft issues ──
    try {
      const qualityCheck = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: `You are a literary quality checker. Analyze the story and return ONLY valid JSON — no markdown, no commentary.`,
        messages: [{ role: 'user', content: `Check this story for craft quality AND task brief adherence:

TASK BRIEF REQUIREMENTS:
- Phase: ${taskBrief.phase}
- Story type: ${taskBrief.story_type}
- Task: ${taskBrief.task || 'not specified'}
- Obstacle: ${taskBrief.obstacle || 'not specified'}
- Strength weaponized: ${taskBrief.strength_weaponized || 'not specified'}
${taskBrief.emotional_start ? `- Emotional start: ${taskBrief.emotional_start}` : ''}
${taskBrief.emotional_end ? `- Emotional end: ${taskBrief.emotional_end}` : ''}
${taskBrief.primary_location ? `- Required location: ${taskBrief.primary_location}` : ''}
${taskBrief.time_of_day ? `- Time of day: ${taskBrief.time_of_day}` : ''}

STORY TEXT:
${storyText.slice(0, 6000)}

Return JSON:
{
  "pass": true|false,
  "score": 0-10,
  "issues": [
    { "type": "telling_not_showing|flat_dialogue|rushed_ending|missing_interiority|summary_instead_of_scene|weak_emotional_arc|brief_mismatch", "location": "brief description of where", "fix": "specific suggestion" }
  ],
  "strengths": ["what works well — be specific"],
  "emotional_arc_delivered": true|false,
  "all_domains_present": true|false,
  "brief_adherence": {
    "task_addressed": true|false,
    "obstacle_present": true|false,
    "strength_weaponized": true|false,
    "emotional_arc_matches": true|false,
    "location_used": true|false,
    "phase_appropriate": true|false
  }
}

Score guide: 8+ pass, 6-7 has fixable issues, below 6 needs rewrite.
Check specifically:
1. Does the story SHOW scenes or SUMMARIZE events?
2. Does dialogue do double duty (reveal character AND advance plot)?
3. Is the emotional arc earned — does the ending shift feel real?
4. Are all 4 life domains (career, romantic, family, friends) present?
5. Is the ending a "quarter-inch shift" or a neat resolution?
6. Does the story actually address the TASK from the brief?
7. Does the OBSTACLE appear and create real pressure?
8. Is the specified STRENGTH weaponized (used as a tool, not just mentioned)?
9. Does the emotional arc match START → END from the brief?
10. Is the story appropriate for its PHASE (establishment=grounding, pressure=escalation, crisis=breaking point, integration=reckoning)?` }],
      });

      const qRaw = qualityCheck.content?.[0]?.text || '';
      let quality;
      try { quality = JSON.parse(qRaw.replace(/```json|```/g, '').trim()); } catch { quality = null; }

      if (quality) {
        // Attach quality report to the response
        storyText = storyText; // keep original — quality report attached separately
        // Store quality result for response
        var qualityReport = quality;
      }
    } catch (qErr) {
      console.error('[quality-gate] non-blocking error:', qErr?.message);
    }

    const wordCount = storyText.split(/\s+/).length;

    // ── Auto-extract story changes (runs in background, doesn't block response) ──
    const autoExtract = async () => {
      try {
        const extractPrompt = `You are extracting continuity changes from a newly generated story.

Character: ${characterKey} (${dna.display_name})
Story ${storyNumber}: "${taskBrief.title}"

Extract ALL of the following from the story text:

1. PAIN POINTS — moments of genuine emotional pain
2. BELIEF SHIFTS — moments where something the character believes changes
3. RELATIONSHIP CHANGES — any shift in relationship dynamics (deepening, straining, new connections, betrayals)
4. DRAMATIC IRONY — things the READER now knows that one or more characters do NOT know
5. OPEN MYSTERIES — new questions planted that the reader will want answered
6. FORESHADOWING SEEDS — details, images, or moments that feel like they could pay off later
7. SETTING DETAILS — any new or enriched locations that appear in the story
8. WORLD EVENTS — significant events that happen in the story that affect the world state

Return ONLY valid JSON:
{
  "pain_points": [{ "category": "string", "statement": "specific moment", "coaching_angle": "therapeutic perspective" }],
  "belief_shifts": [{ "before": "old belief", "after": "new belief", "trigger": "what caused it" }],
  "relationship_changes": [{ "characters": ["char_a", "char_b"], "change": "what shifted", "new_state": "current dynamic" }],
  "dramatic_irony": [{ "statement": "what the reader knows that characters don't", "characters_unaware": ["who doesn't know"] }],
  "open_mysteries": [{ "question": "what the reader is now wondering", "planted_in": "brief description of the moment" }],
  "foreshadow_seeds": [{ "detail": "the image/moment/detail", "potential_payoff": "what it could connect to later" }],
  "new_locations": [{ "name": "location name", "description": "sensory description", "location_type": "interior|exterior|digital|vehicle", "narrative_role": "what role this place plays" }],
  "world_events": [{ "event_name": "short name", "event_description": "what happened", "event_type": "plot|emotional|social|professional", "impact_level": "minor|moderate|major", "characters_involved": ["character_keys"] }],
  "therapy_opening": "one sentence a therapist could use to open the next session"
}`;

        const extractResponse = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 3000,
          system: extractPrompt,
          messages: [{ role: 'user', content: `Story text:\n\n${storyText.slice(0, 5000)}` }],
        });

        const extractRaw = extractResponse.content?.[0]?.text || '';
        let extracted;
        try { extracted = JSON.parse(extractRaw.replace(/\`\`\`json|\`\`\`/g, '').trim()); } catch { return; }

        const { RegistryCharacter } = require('../../models');
        const { Op } = require('sequelize');
        const charRow = await RegistryCharacter.findOne({
          where: { character_key: characterKey, status: { [Op.in]: ['accepted', 'finalized'] } },
        });
        const charId = charRow?.id;
        if (!charId) return;

        // Save pain points
        for (const pp of (extracted.pain_points || [])) {
          await StorytellerMemory.create({
            character_id: charId, type: 'pain_point', statement: pp.statement,
            confidence: 0.85, confirmed: false, source_ref: `story_${storyNumber}`,
            tags: JSON.stringify([pp.category]), category: pp.category, coaching_angle: pp.coaching_angle,
          }).catch(e => console.warn(`[auto-extract] pain_point save error:`, e?.message));
        }

        // Save belief shifts
        for (const bs of (extracted.belief_shifts || [])) {
          await StorytellerMemory.create({
            character_id: charId, type: 'belief_shift',
            statement: `${bs.before} → ${bs.after} (triggered by: ${bs.trigger})`,
            confidence: 0.80, confirmed: false, source_ref: `story_${storyNumber}`,
            tags: JSON.stringify(['belief_shift']), category: 'belief_shift',
          }).catch(e => console.warn(`[auto-extract] belief_shift save error:`, e?.message));
        }

        // Save relationship changes — to both StorytellerMemory and CharacterRelationship
        const { CharacterRelationship } = require('../../models');
        for (const rc of (extracted.relationship_changes || [])) {
          await StorytellerMemory.create({
            character_id: charId, type: 'relationship_change',
            statement: `${(rc.characters || []).join(' ↔ ')}: ${rc.change} (now: ${rc.new_state})`,
            confidence: 0.85, confirmed: false, source_ref: `story_${storyNumber}`,
            tags: JSON.stringify(rc.characters || []), category: `story_${storyNumber}`,
          }).catch(e => console.warn(`[auto-extract] relationship_change save error:`, e?.message));

          // Also update the CharacterRelationship model if both characters exist
          if (CharacterRelationship && rc.characters?.length >= 2) {
            try {
              const charA = await RegistryCharacter.findOne({ where: { character_key: rc.characters[0] } });
              const charB = await RegistryCharacter.findOne({ where: { character_key: rc.characters[1] } });
              if (charA && charB) {
                const rel = await CharacterRelationship.findOne({
                  where: {
                    [require('sequelize').Op.or]: [
                      { character_id_a: charA.id, character_id_b: charB.id },
                      { character_id_a: charB.id, character_id_b: charA.id },
                    ],
                  },
                });
                if (rel) {
                  // Update existing relationship with new state
                  const updates = {};
                  if (rc.new_state) updates.situation = rc.new_state;
                  if (rc.change) updates.notes = `${rel.notes ? rel.notes + '\n' : ''}[Story ${storyNumber}] ${rc.change}`;
                  await rel.update(updates);
                } else {
                  // Create new relationship record
                  await CharacterRelationship.create({
                    character_id_a: charA.id,
                    character_id_b: charB.id,
                    relationship_type: rc.new_state || 'acquaintance',
                    situation: rc.change,
                    notes: `[Story ${storyNumber}] ${rc.change}`,
                    confirmed: false,
                  });
                }
              }
            } catch (relErr) {
              console.warn(`[auto-extract] CharacterRelationship update error:`, relErr?.message);
            }
          }
        }

        // Save dramatic irony entries
        for (const di of (extracted.dramatic_irony || [])) {
          await StorytellerMemory.create({
            character_id: charId, type: 'dramatic_irony', statement: di.statement,
            confidence: 0.85, confirmed: true, source_ref: `story_${storyNumber}`,
            tags: JSON.stringify(di.characters_unaware || []), category: `story_${storyNumber}`,
          }).catch(e => console.warn(`[auto-extract] dramatic_irony save error:`, e?.message));
        }

        // Save open mysteries
        for (const om of (extracted.open_mysteries || [])) {
          await StorytellerMemory.create({
            character_id: charId, type: 'open_mystery', statement: om.question,
            confidence: 0.80, confirmed: true, source_ref: `story_${storyNumber}`,
            tags: JSON.stringify(['mystery']), category: `story_${storyNumber}`,
          }).catch(e => console.warn(`[auto-extract] open_mystery save error:`, e?.message));
        }

        // Save foreshadowing seeds
        for (const fs of (extracted.foreshadow_seeds || [])) {
          await StorytellerMemory.create({
            character_id: charId, type: 'foreshadow_seed',
            statement: `${fs.detail} — potential: ${fs.potential_payoff}`,
            confidence: 0.75, confirmed: true, source_ref: `story_${storyNumber}`,
            tags: JSON.stringify(['foreshadow']), category: `story_${storyNumber}`,
          }).catch(e => console.warn(`[auto-extract] foreshadow save error:`, e?.message));
        }

        // Save therapy opening
        if (extracted.therapy_opening) {
          await StorytellerMemory.create({
            character_id: charId, type: 'therapy_opening', statement: extracted.therapy_opening,
            confidence: 0.90, confirmed: false, source_ref: `story_${storyNumber}`,
            tags: JSON.stringify(['therapy_opening']), category: 'therapy_opening',
          }).catch(e => console.warn(`[auto-extract] therapy_opening save error:`, e?.message));
        }

        // Save new locations to WorldLocation
        const { WorldLocation, WorldTimelineEvent } = require('../../models');
        for (const loc of (extracted.new_locations || [])) {
          if (!loc.name) continue;
          // Only create if this location doesn't already exist
          const existing = await WorldLocation.findOne({ where: { name: loc.name } }).catch(() => null);
          if (!existing) {
            await WorldLocation.create({
              name: loc.name,
              description: loc.description || null,
              location_type: ['interior', 'exterior', 'digital', 'vehicle'].includes(loc.location_type) ? loc.location_type : 'interior',
              narrative_role: loc.narrative_role || null,
              associated_characters: [characterKey],
              sensory_details: loc.description ? { from_story: loc.description } : {},
              metadata: { source_story: storyNumber, auto_extracted: true },
            }).catch(e => console.warn('[auto-extract] location create error:', e?.message));
          }
        }

        // Save world events to WorldTimelineEvent
        for (const evt of (extracted.world_events || [])) {
          if (!evt.event_name) continue;
          await WorldTimelineEvent.create({
            event_name: evt.event_name,
            event_description: evt.event_description || null,
            event_type: ['plot', 'emotional', 'social', 'professional'].includes(evt.event_type) ? evt.event_type : 'plot',
            impact_level: ['minor', 'moderate', 'major'].includes(evt.impact_level) ? evt.impact_level : 'minor',
            characters_involved: evt.characters_involved || [characterKey],
            story_date: `Story ${storyNumber}`,
            sort_order: storyNumber,
            is_canon: true,
            metadata: { source_story: storyNumber, character_key: characterKey, auto_extracted: true },
          }).catch(e => console.warn('[auto-extract] event create error:', e?.message));
        }

        const locationCount = (extracted.new_locations || []).length;
        const eventCount = (extracted.world_events || []).length;
        console.log(`[auto-extract] Story ${storyNumber} for ${characterKey}: extracted ${
          (extracted.pain_points?.length || 0) + (extracted.belief_shifts?.length || 0) +
          (extracted.dramatic_irony?.length || 0) + (extracted.open_mysteries?.length || 0) +
          (extracted.foreshadow_seeds?.length || 0)
        } continuity items, ${locationCount} locations, ${eventCount} world events`);
      } catch (err) {
        console.error('[auto-extract] error:', err?.message);
      }
    };

    // Fire and forget — don't block the story response
    autoExtract();

    // ── Arc tracking update — every story, all parameters ──────────────────
    const updateArc = async () => {
      try {
        if (!updateArcTracking) return;
        // Detect intimacy and post content from the story text
        const textLower = storyText.toLowerCase();
        const intimateGenerated = /\b(kiss|touch|undress|naked|bed together|skin against|mouth on|between her legs|inside her)\b/i.test(storyText);
        const intimateWithDavid = intimateGenerated && /\bdavid\b/i.test(storyText);
        const postGenerated = /\b(posted|instagram|tiktok|onlyfans|went live|hit publish|uploaded)\b/i.test(textLower);
        const phoneAppeared = /\b(phone|notification|screen lit|vibrated|text message|DM|direct message)\b/i.test(storyText);

        await updateArcTracking(db, characterKey, {
          storyNumber,
          storyType: taskBrief.story_type,
          phase: taskBrief.phase,
          intimateGenerated,
          intimateWithDavid,
          postGenerated,
          phoneAppeared,
        });
        console.log(`[arc-tracking] Story ${storyNumber} for ${characterKey}: updated (intimate=${intimateGenerated}, david=${intimateWithDavid}, post=${postGenerated}, phone=${phoneAppeared})`);
      } catch (err) {
        console.error('[arc-tracking] update error:', err?.message);
      }
    };
    updateArc();

    // ── Update active story threads — advance threads that were used ────────
    const updateThreads = async () => {
      try {
        const { StoryThread } = require('../../models');
        if (!StoryThread) return;
        // StoryThread uses characters_involved (JSONB array), not character_key
        const threads = await StoryThread.findAll({
          where: { status: 'active' },
        });
        // Filter to threads involving this character
        const charThreads = threads.filter(t => {
          const involved = t.characters_involved || [];
          return involved.some(c =>
            (typeof c === 'string' && c === characterKey) ||
            (typeof c === 'object' && (c.key === characterKey || c.character_key === characterKey))
          );
        });
        for (const thread of charThreads) {
          // Check if the story text references this thread's topic
          const threadKeywords = (thread.thread_name || '').split(/\s+/).filter(w => w.length > 3);
          const mentioned = threadKeywords.some(kw => storyText.toLowerCase().includes(kw.toLowerCase()));
          if (mentioned) {
            const events = thread.key_events || [];
            events.push({ story_number: storyNumber, title: taskBrief.title, note: 'auto-advanced' });
            await thread.update({
              key_events: events,
            });
          }
        }
      } catch (err) {
        console.warn('[update-threads] error:', err?.message);
      }
    };
    updateThreads();

    // ── Auto-register new character if taskBrief says so ───────────────────
    const registerNewCharacter = async () => {
      try {
        if (!taskBrief.new_character || !taskBrief.new_character_name) return;
        const { RegistryCharacter } = require('../../models');
        const newKey = taskBrief.new_character_name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
        // Check if already registered
        const exists = await RegistryCharacter.findOne({ where: { character_key: newKey } });
        if (exists) {
          console.log(`[auto-register] Character "${newKey}" already exists — skipping`);
          return;
        }
        // Find the registry_id from the current character
        const parentChar = await RegistryCharacter.findOne({ where: { character_key: characterKey } });
        if (!parentChar) return;

        const roleType = (taskBrief.new_character_role || '').toLowerCase();
        const validRoles = ['protagonist', 'pressure', 'mirror', 'support', 'shadow', 'special'];
        const mappedRole = validRoles.includes(roleType) ? roleType : 'pressure';

        await RegistryCharacter.create({
          registry_id: parentChar.registry_id,
          character_key: newKey,
          display_name: taskBrief.new_character_name,
          role_type: mappedRole,
          role_label: taskBrief.new_character_role || null,
          status: 'draft',
          appearance_mode: 'on_page',
          metadata: { auto_registered: true, source_story: storyNumber, introduced_by: characterKey },
        });
        console.log(`[auto-register] Created new character "${newKey}" (${taskBrief.new_character_name}) as ${mappedRole} from story ${storyNumber}`);
      } catch (err) {
        console.warn('[auto-register] error:', err?.message);
      }
    };
    registerNewCharacter();

    return finish({
      story_number: storyNumber,
      character_key: characterKey,
      title: taskBrief.title,
      phase: taskBrief.phase,
      story_type: taskBrief.story_type,
      text: storyText,
      word_count: wordCount,
      therapy_seeds: taskBrief.therapy_seeds || [],
      new_character: taskBrief.new_character || false,
      new_character_name: taskBrief.new_character_name || null,
      new_character_role: taskBrief.new_character_role || null,
      auto_extraction: 'in_progress',
      context_loaded: contextPresence,
      quality_report: typeof qualityReport !== 'undefined' ? qualityReport : null,
    });

  } catch (err) {
    console.error('[generate-story] error:', err?.message);
    return fallback();
  }
});

// ─── POST /revise-story ──────────────────────────────────────────────────────
// Takes a generated story + editorial notes and produces a tightened revision.
router.post('/revise-story', optionalAuth, async (req, res) => {
  const { characterKey, storyNumber, storyText, editorialNotes, qualityReport } = req.body;

  if (!storyText || !editorialNotes) {
    return res.status(400).json({ error: 'storyText and editorialNotes are required' });
  }

  // Keep-alive for long requests
  res.setHeader('Content-Type', 'application/json');
  let finished = false;
  const keepAlive = setInterval(() => {
    if (!finished) try { res.write(' '); } catch (_) {}
  }, 15000);

  const finish = (data) => {
    finished = true;
    clearInterval(keepAlive);
    res.end(JSON.stringify(data));
  };

  try {
    // Build quality issues context from auto-report if available
    let qualityContext = '';
    if (qualityReport?.issues?.length) {
      qualityContext = '\n\nAUTO-DETECTED QUALITY ISSUES:\n' +
        qualityReport.issues.map(i => `- [${i.type}] ${i.location}: ${i.fix}`).join('\n');
    }

    const revisionPrompt = `You are revising a short story based on editorial feedback.

ORIGINAL STORY (${storyText.split(/\s+/).length} words):
${storyText}

EDITORIAL NOTES FROM THE AUTHOR:
${editorialNotes}${qualityContext}

REVISION RULES:
- Preserve the story's core events, characters, and emotional arc
- Address EVERY editorial note specifically
- Maintain the same POV, tense, and voice register
- Keep the word count within 3300-4800 words
- Do NOT add explanatory framing or meta-commentary
- Tighten prose: cut redundant descriptions, strengthen verbs, sharpen dialogue
- If the editorial notes mention pacing, restructure scenes accordingly
- If the notes mention "telling not showing," replace summary with scene
- The revised version should feel like the same story, written better

Return ONLY the revised story. Begin with the title, then the story. No preamble.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 10000,
      system: revisionPrompt,
      messages: [{ role: 'user', content: 'Revise the story now.' }],
    });

    const revisedText = response.content?.[0]?.text || '';

    if (!revisedText || revisedText.length < 500) {
      return finish({ error: 'Revision produced insufficient output — try again.' });
    }

    // Persist revision to StoryRevision table
    try {
      const db = require('../../models');
      if (db.StoryRevision && characterKey && storyNumber) {
        // Find the StorytellerStory to get its UUID
        const parentStory = await db.StorytellerStory?.findOne({
          where: { character_key: characterKey, story_number: storyNumber },
          attributes: ['id'],
        }).catch(() => null);
        if (parentStory) {
          const lastRev = await db.StoryRevision.findOne({
            where: { story_id: parentStory.id },
            order: [['revision_number', 'DESC']],
          }).catch(() => null);
          await db.StoryRevision.create({
            story_id: parentStory.id,
            revision_number: (lastRev?.revision_number || 0) + 1,
            text: revisedText,
            word_count: revisedText.split(/\s+/).length,
            revision_type: 'ai_rewrite',
            revision_source: 'quality_gate',
            change_summary: editorialNotes?.slice(0, 500),
            metadata: { quality_score_before: qualityReport?.score || null },
          }).catch(e => console.warn('[revise-story] revision save error:', e?.message));
        }
      }
    } catch { /* StoryRevision table may not exist yet */ }

    return finish({
      story_number: storyNumber || null,
      character_key: characterKey || null,
      original_word_count: storyText.split(/\s+/).length,
      revised_word_count: revisedText.split(/\s+/).length,
      text: revisedText,
      revision_applied: true,
      token_usage: {
        input: response.usage?.input_tokens || 0,
        output: response.usage?.output_tokens || 0,
      },
    });
  } catch (err) {
    console.error('[revise-story] error:', err?.message);
    finished = true;
    clearInterval(keepAlive);
    return res.status(500).json({ error: err?.message || 'Revision failed' });
  }
});

// ─── Internal HTTP helper for calling sibling routes ─────────────────────────
function internalCall(path, body) {
  return new Promise((resolve, reject) => {
    const http = require('http');
    const port = process.env.PORT || 3000;
    const postData = JSON.stringify(body);
    const options = {
      hostname: '127.0.0.1',
      port,
      path: `/api/v1/memories${path}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
      timeout: 180000,
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data.trim())); } catch { resolve({ error: 'Parse error', raw: data.slice(0, 200) }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Internal call timeout')); });
    req.write(postData);
    req.end();
  });
}

// ─── Pipeline core logic (shared by route handler and batch-generate) ────────
async function runPipeline({ characterKey, storyNumber, taskBrief, previousStories, useMultiVoice }) {
  const pipeline = { steps: [], started_at: Date.now() };

  // ── Step 1: Generate the story ──────────────────────────────────────
  const genResult = await internalCall('/generate-story', { characterKey, storyNumber, taskBrief, previousStories });
  pipeline.steps.push({ step: 'generate', success: !!genResult?.text, word_count: genResult?.word_count });

  if (!genResult?.text) {
    pipeline.steps.push({ step: 'aborted', reason: 'Generation produced no text' });
    return { pipeline, story: null, fallback: true };
  }

  let finalText = genResult.text;
  const qualityReport = genResult.quality_report;
  let revised = false;

  // ── Step 2: Check quality gate ──────────────────────────────────────
  if (qualityReport) {
    pipeline.steps.push({ step: 'quality_gate', score: qualityReport.score, pass: qualityReport.pass, issues: qualityReport.issues?.length || 0 });

    // ── Step 3: Auto-revise if quality score is below 8 ────────────────
    if (qualityReport.score < 8 && qualityReport.issues?.length > 0) {
      const editorialNotes = qualityReport.issues
        .map(i => `[${i.type}] ${i.location}: ${i.fix}`)
        .join('\n');

      const revResult = await internalCall('/revise-story', {
        characterKey, storyNumber, storyText: finalText, editorialNotes, qualityReport,
      });

      if (revResult?.text && revResult.revision_applied) {
        finalText = revResult.text;
        revised = true;
        pipeline.steps.push({ step: 'auto_revise', success: true, original_words: genResult.word_count, revised_words: revResult.revised_word_count });
      } else {
        pipeline.steps.push({ step: 'auto_revise', success: false, reason: 'Revision failed or produced no text' });
      }
    }
  }

  const wordCount = finalText.split(/\s+/).filter(Boolean).length;

  // ── Step 4: Determine if this is a turning-point story worth multi-voice ──
  const isTurningPoint = useMultiVoice || (
    taskBrief.phase === 'crisis' &&
    ['collision', 'wrong_win'].includes(taskBrief.story_type)
  );
  pipeline.steps.push({ step: 'multi_voice_check', eligible: isTurningPoint, reason: isTurningPoint ? 'crisis-phase collision/wrong_win or user requested' : 'standard story' });

  pipeline.completed_at = Date.now();
  pipeline.duration_ms = pipeline.completed_at - pipeline.started_at;

  return {
    pipeline,
    story_number: storyNumber,
    character_key: characterKey,
    title: taskBrief.title,
    phase: taskBrief.phase,
    story_type: taskBrief.story_type,
    text: finalText,
    word_count: wordCount,
    revised,
    quality_report: qualityReport,
    therapy_seeds: taskBrief.therapy_seeds || [],
    new_character: taskBrief.new_character || false,
    new_character_name: taskBrief.new_character_name || null,
    new_character_role: taskBrief.new_character_role || null,
    multi_voice_eligible: isTurningPoint,
  };
}

// ─── POST /pipeline-generate ──────────────────────────────────────────────────
// Automated pipeline: generate → quality gate → auto-revise if needed → return.
// Handles a single story through the full quality pipeline without manual steps.
router.post('/pipeline-generate', optionalAuth, async (req, res) => {
  const { characterKey, storyNumber, taskBrief, previousStories, useMultiVoice } = req.body;

  if (!characterKey || !storyNumber || !taskBrief) {
    return res.status(400).json({ error: 'characterKey, storyNumber, and taskBrief required' });
  }

  // Keep-alive for long pipeline runs
  res.setHeader('Content-Type', 'application/json');
  let finished = false;
  const keepAlive = setInterval(() => {
    if (!finished) try { res.write(' '); } catch (_) {}
  }, 15000);

  try {
    const result = await runPipeline({ characterKey, storyNumber, taskBrief, previousStories, useMultiVoice });
    finished = true;
    clearInterval(keepAlive);
    res.end(JSON.stringify(result));
  } catch (err) {
    console.error('[pipeline-generate] error:', err?.message);
    finished = true;
    clearInterval(keepAlive);
    return res.status(500).json({ error: err?.message || 'Pipeline failed' });
  }
});

// ─── In-memory background job store ──────────────────────────────────────────
const backgroundJobs = new Map();

// Clean up completed/failed jobs older than 1 hour
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of backgroundJobs) {
    if (job.completedAt && job.completedAt < cutoff) backgroundJobs.delete(id);
  }
}, 10 * 60 * 1000);

// ─── POST /pipeline-generate-background ──────────────────────────────────────
// Starts generation as a background job. Returns a jobId for polling.
router.post('/pipeline-generate-background', optionalAuth, async (req, res) => {
  const { characterKey, storyNumber, taskBrief, previousStories, useMultiVoice } = req.body;

  if (!characterKey || !storyNumber || !taskBrief) {
    return res.status(400).json({ error: 'characterKey, storyNumber, and taskBrief required' });
  }

  const jobId = `gen-${characterKey}-${storyNumber}-${Date.now()}`;

  backgroundJobs.set(jobId, {
    status: 'running',
    characterKey,
    storyNumber,
    startedAt: Date.now(),
    completedAt: null,
    result: null,
    error: null,
  });

  // Fire and forget — run the pipeline in the background
  runPipeline({ characterKey, storyNumber, taskBrief, previousStories, useMultiVoice })
    .then(result => {
      const job = backgroundJobs.get(jobId);
      if (job) {
        job.status = 'completed';
        job.result = result;
        job.completedAt = Date.now();
      }
    })
    .catch(err => {
      console.error(`[pipeline-generate-background] job ${jobId} failed:`, err?.message);
      const job = backgroundJobs.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = err?.message || 'Pipeline failed';
        job.completedAt = Date.now();
      }
    });

  return res.json({ jobId, status: 'running' });
});

// ─── GET /pipeline-generate-status/:jobId ────────────────────────────────────
// Poll for background generation status.
router.get('/pipeline-generate-status/:jobId', optionalAuth, (req, res) => {
  const job = backgroundJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  return res.json({
    jobId: req.params.jobId,
    status: job.status,
    storyNumber: job.storyNumber,
    characterKey: job.characterKey,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    result: job.status === 'completed' ? job.result : null,
    error: job.status === 'failed' ? job.error : null,
    durationMs: job.completedAt ? job.completedAt - job.startedAt : Date.now() - job.startedAt,
  });
});

// ─── POST /batch-generate ────────────────────────────────────────────────────
// Generates multiple stories sequentially through the quality pipeline.
// Uses SSE (Server-Sent Events) to stream progress to the frontend.
router.post('/batch-generate', optionalAuth, async (req, res) => {
  const { characterKey, taskBriefs, previousStories: initialPrevious } = req.body;

  if (!characterKey || !taskBriefs?.length) {
    return res.status(400).json({ error: 'characterKey and taskBriefs[] required' });
  }

  // Set up SSE for streaming progress
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const total = taskBriefs.length;
  let completed = 0;
  let previousStories = initialPrevious || [];
  const results = [];

  sendEvent('start', { total, character_key: characterKey });

  for (const taskBrief of taskBriefs) {
    const storyNumber = taskBrief.story_number;
    sendEvent('progress', {
      story_number: storyNumber,
      title: taskBrief.title,
      phase: taskBrief.phase,
      status: 'generating',
      completed,
      total,
    });

    try {
      // Call pipeline logic directly (no HTTP loopback)
      const pipelineResult = await runPipeline({
        characterKey,
        storyNumber,
        taskBrief,
        previousStories,
      });

      completed++;
      results.push(pipelineResult);

      // Add this story to previous stories context for the next story
      if (pipelineResult?.text) {
        previousStories = [
          ...previousStories,
          {
            number: storyNumber,
            title: pipelineResult.title || taskBrief.title,
            summary: (pipelineResult.text || '').slice(0, 800),
            taskBrief,
          },
        ];
      }

      sendEvent('story_complete', {
        story_number: storyNumber,
        title: pipelineResult.title || taskBrief.title,
        word_count: pipelineResult.word_count,
        quality_score: pipelineResult.quality_report?.score,
        revised: pipelineResult.revised || false,
        completed,
        total,
      });
    } catch (err) {
      completed++;
      sendEvent('story_error', {
        story_number: storyNumber,
        error: err?.message || 'Generation failed',
        completed,
        total,
      });
    }
  }

  sendEvent('batch_complete', {
    total_generated: completed,
    total_requested: total,
    results_summary: results.map(r => ({
      story_number: r?.story_number,
      word_count: r?.word_count,
      quality_score: r?.quality_report?.score,
      revised: r?.revised,
    })),
  });

  res.end();
});

// ─── POST /batch-generate-background ──────────────────────────────────────────
// Starts batch generation as a background job. Returns a jobId for polling.
// Each story is generated sequentially, results accumulate in the job store.
router.post('/batch-generate-background', optionalAuth, async (req, res) => {
  const { characterKey, taskBriefs, previousStories: initialPrevious } = req.body;

  if (!characterKey || !taskBriefs?.length) {
    return res.status(400).json({ error: 'characterKey and taskBriefs[] required' });
  }

  const jobId = `batch-${characterKey}-${Date.now()}`;
  const total = taskBriefs.length;

  backgroundJobs.set(jobId, {
    status: 'running',
    type: 'batch',
    characterKey,
    total,
    completed: 0,
    currentStoryNumber: taskBriefs[0]?.story_number,
    currentTitle: taskBriefs[0]?.title,
    startedAt: Date.now(),
    completedAt: null,
    results: {},
    errors: [],
  });

  // Fire and forget — run all stories sequentially in the background
  (async () => {
    const job = backgroundJobs.get(jobId);
    let previousStories = initialPrevious || [];

    for (const taskBrief of taskBriefs) {
      const storyNumber = taskBrief.story_number;
      if (job) {
        job.currentStoryNumber = storyNumber;
        job.currentTitle = taskBrief.title;
      }

      try {
        const result = await runPipeline({
          characterKey,
          storyNumber,
          taskBrief,
          previousStories,
        });

        if (job) {
          job.completed++;
          job.results[storyNumber] = result;
        }

        // Chain context forward
        if (result?.text) {
          previousStories = [
            ...previousStories,
            {
              number: storyNumber,
              title: result.title || taskBrief.title,
              summary: (result.text || '').slice(0, 800),
            },
          ];
        }
      } catch (err) {
        console.error(`[batch-generate-background] story ${storyNumber} failed:`, err?.message);
        if (job) {
          job.completed++;
          job.errors.push({ story_number: storyNumber, error: err?.message });
        }
      }
    }

    if (job) {
      job.status = 'completed';
      job.completedAt = Date.now();
    }
  })();

  return res.json({ jobId, status: 'running', total });
});

// ─── GET /batch-generate-status/:jobId ────────────────────────────────────────
// Poll for background batch generation status.
router.get('/batch-generate-status/:jobId', optionalAuth, (req, res) => {
  const job = backgroundJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  return res.json({
    jobId: req.params.jobId,
    status: job.status,
    type: job.type,
    characterKey: job.characterKey,
    total: job.total,
    completed: job.completed,
    currentStoryNumber: job.currentStoryNumber,
    currentTitle: job.currentTitle,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    results: job.status === 'completed' ? job.results : null,
    // Send partial results while running so frontend can show stories as they complete
    completedStories: Object.keys(job.results || {}).map(Number),
    errors: job.errors,
    durationMs: job.completedAt ? job.completedAt - job.startedAt : Date.now() - job.startedAt,
  });
});

// ─── GET /batch-generate-story/:jobId/:storyNumber ────────────────────────────
// Fetch a single completed story from a running/completed batch job.
router.get('/batch-generate-story/:jobId/:storyNumber', optionalAuth, (req, res) => {
  const job = backgroundJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  const story = job.results?.[req.params.storyNumber];
  if (!story) {
    return res.status(404).json({ error: 'Story not yet generated' });
  }
  return res.json(story);
});

// ─── POST /check-story-consistency ───────────────────────────────────────────
// When a story is edited, check for cascading contradictions in later stories.
router.post('/check-story-consistency', optionalAuth, async (req, res) => {
  const { characterKey, editedStoryNumber, editedStoryText, existingStories } = req.body;

  if (!characterKey || !editedStoryNumber || !editedStoryText) {
    return res.status(400).json({ error: 'characterKey, editedStoryNumber, editedStoryText required' });
  }

  try {
    const laterStories = (existingStories || [])
      .filter((s) => s.story_number > editedStoryNumber)
      .slice(0, 10);

    if (laterStories.length === 0) {
      return res.json({ conflicts: [], message: 'No later stories to check.' });
    }

    const systemPrompt = `You are a story continuity checker for ${characterKey}'s 50-story arc.

A story has been edited. Check whether the edits create contradictions, character drift, or factual conflicts with later stories.

Look for:
1. Factual contradictions (a character is said to be somewhere they previously were not)
2. Character drift (the character behaves inconsistently with who she has been established to be)
3. Relationship contradictions (a relationship state that conflicts with what was established)
4. Timeline conflicts (events that now happen in the wrong order)
5. New character conflicts (a character introduced in the edit that was introduced differently in a later story)

Return ONLY valid JSON:
{
  "conflicts": [
    {
      "story_number": 12,
      "conflict_type": "factual|character_drift|relationship|timeline|new_character",
      "description": "what conflicts and why",
      "severity": "critical|warning|minor"
    }
  ]
}`;

    const laterStoriesSummary = laterStories
      .map((s) => `Story ${s.story_number} "${s.title}": ${s.summary || s.text?.slice(0, 300)}`)
      .join('\n\n');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `EDITED STORY ${editedStoryNumber}:\n${editedStoryText.slice(0, 2000)}\n\nLATER STORIES:\n${laterStoriesSummary}\n\nFind all conflicts.`,
      }],
    });

    const raw = response.content?.[0]?.text || '';
    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch {
      return res.json({ conflicts: [], fallback: true });
    }

    return res.json({ conflicts: parsed.conflicts || [] });

  } catch (err) {
    console.error('[check-story-consistency] error:', err?.message);
    return res.json({ conflicts: [], fallback: true });
  }
});

// ─── POST /extract-story-memories ────────────────────────────────────────────
// After a story is approved, extract pain points and feed them to therapy room.
router.post('/extract-story-memories', optionalAuth, async (req, res) => {
  const { characterId, characterKey, storyNumber, storyTitle, storyText } = req.body;

  if (!characterId || !storyText) {
    return res.status(400).json({ error: 'characterId and storyText required' });
  }

  try {
    const PAIN_POINT_CATEGORIES = [
      'comparison_spiral', 'visibility_gap', 'identity_drift',
      'financial_risk', 'consistency_collapse', 'clarity_deficit',
      'external_validation', 'restart_cycle',
    ];

    const systemPrompt = `You are extracting therapeutic memories from a short story.

The character is ${characterKey}. The story is "${storyTitle}" (Story ${storyNumber}).

Extract:
1. Pain points — moments of genuine emotional pain, categorized by type
2. Belief shifts — moments where something the character believes changes or is challenged
3. Wound activations — moments where the character's core wound is triggered
4. Relationship revelations — what this story reveals about key relationships

Pain point categories: ${PAIN_POINT_CATEGORIES.join(', ')}

Return ONLY valid JSON:
{
  "pain_points": [
    {
      "category": "visibility_gap",
      "statement": "specific moment from the story",
      "coaching_angle": "what a coach would help this person work through",
      "wound_activated": true
    }
  ],
  "belief_shifts": [
    {
      "before": "what she believed before this story",
      "after": "what shifted",
      "trigger": "what caused the shift"
    }
  ],
  "therapy_opening": "one sentence a therapist could use to open the next session based on this story"
}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Story text:\n\n${storyText.slice(0, 4000)}`,
      }],
    });

    const raw = response.content?.[0]?.text || '';
    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch {
      return res.json({ memories_extracted: 0, fallback: true });
    }

    // Save pain_points to storyteller_memories table
    const painPoints = parsed.pain_points || [];
    let saved = 0;

    for (const memory of painPoints) {
      try {
        await StorytellerMemory.create({
          character_id: characterId,
          type: 'pain_point',
          statement: memory.statement,
          confidence: 0.85,
          confirmed: false,
          source_ref: `story_${storyNumber}`,
          tags: JSON.stringify([memory.category]),
          category: memory.category,
          coaching_angle: memory.coaching_angle,
        });
        saved++;
      } catch (e) {
        console.error('[extract-story-memories] save pain_point error:', e?.message);
      }
    }

    // Save belief_shifts to storyteller_memories table
    const beliefShifts = parsed.belief_shifts || [];
    for (const shift of beliefShifts) {
      try {
        await StorytellerMemory.create({
          character_id: characterId,
          type: 'belief_shift',
          statement: `${shift.before} → ${shift.after} (triggered by: ${shift.trigger})`,
          confidence: 0.80,
          confirmed: false,
          source_ref: `story_${storyNumber}`,
          tags: JSON.stringify(['belief_shift']),
          category: 'belief_shift',
        });
        saved++;
      } catch (e) {
        console.error('[extract-story-memories] save belief_shift error:', e?.message);
      }
    }

    // Save therapy_opening as a memory
    if (parsed.therapy_opening) {
      try {
        await StorytellerMemory.create({
          character_id: characterId,
          type: 'therapy_opening',
          statement: parsed.therapy_opening,
          confidence: 0.90,
          confirmed: false,
          source_ref: `story_${storyNumber}`,
          tags: JSON.stringify(['therapy_opening']),
          category: 'therapy_opening',
        });
        saved++;
      } catch (e) {
        console.error('[extract-story-memories] save therapy_opening error:', e?.message);
      }
    }

    return res.json({
      memories_extracted: saved,
      pain_points: parsed.pain_points || [],
      belief_shifts: parsed.belief_shifts || [],
      therapy_opening: parsed.therapy_opening || null,
      story_number: storyNumber,
    });

  } catch (err) {
    console.error('[extract-story-memories] error:', err?.message);
    return res.json({ memories_extracted: 0, fallback: true });
  }
});

// ─── POST /story-engine-update-registry ──────────────────────────────────────
// After story approval + memory extraction, use Claude to determine what
// registry fields should be updated based on story events and belief shifts.
// This closes the feedback loop: story → memories → registry evolution.
router.post('/story-engine-update-registry', optionalAuth, async (req, res) => {
  const { characterKey, storyNumber, storyTitle, storyText, extractedMemories } = req.body;

  if (!characterKey || !storyText) {
    return res.status(400).json({ error: 'characterKey and storyText required' });
  }

  try {
    const { Op } = require('sequelize');
    const { RegistryCharacter } = require('../../models');

    // Find the character
    const charRow = await RegistryCharacter.findOne({
      where: { character_key: characterKey, status: { [Op.in]: ['accepted', 'finalized'] } },
      order: [['updated_at', 'DESC']],
    });

    if (!charRow) {
      return res.status(404).json({ error: `Character ${characterKey} not found` });
    }

    const plain = charRow.get({ plain: true });

    // Build context for Claude to analyze what changed
    const currentState = {
      core_desire: plain.core_desire,
      core_fear: plain.core_fear,
      core_wound: plain.core_wound,
      relationships_map: plain.relationships_map || {},
      evolution_tracking: plain.evolution_tracking || {},
      personality_matrix: plain.personality_matrix || {},
    };

    const memorySummary = extractedMemories
      ? `\nEXTRACTED MEMORIES FROM THIS STORY:\nPain Points: ${JSON.stringify(extractedMemories.pain_points || [])}\nBelief Shifts: ${JSON.stringify(extractedMemories.belief_shifts || [])}\nTherapy Opening: ${extractedMemories.therapy_opening || 'None'}`
      : '';

    const systemPrompt = `You are a character registry analyst. A new story has been approved for ${plain.display_name}. Based on the story content and extracted memories, determine what character registry fields should be updated.

CURRENT REGISTRY STATE:
Core Desire: ${currentState.core_desire || 'Not set'}
Core Fear: ${currentState.core_fear || 'Not set'}
Core Wound: ${currentState.core_wound || 'Not set'}
Relationships Map: ${JSON.stringify(currentState.relationships_map)}
Evolution Tracking: ${JSON.stringify(currentState.evolution_tracking)}
${memorySummary}

RULES:
- Only update fields that genuinely shifted based on this story's events
- core_desire, core_fear, core_wound should RARELY change — only if the story shows a fundamental shift
- relationships_map should update if new relationships form, existing ones deepen/rupture, or power dynamics shift
- evolution_tracking should capture the character's arc progression — what phase they're in, what's different now
- personality_matrix updates only if the story reveals new strengths, new weaknesses, or changed traits
- Be conservative — don't rewrite the character, track the evolution
- If nothing meaningfully changed, return empty updates

Return ONLY valid JSON:
{
  "updates": {
    "relationships_map": { "merge": true, "data": { "character_name": { "status": "deepened|strained|new|broken", "dynamic": "one line about the current state" } } },
    "evolution_tracking": { "merge": true, "data": { "current_phase": "string", "last_story": ${storyNumber}, "arc_position": "establishment|pressure|crisis|integration", "recent_shift": "what changed", "accumulated_wounds": ["list of active wounds"], "growth_edges": ["where growth is happening"] } },
    "personality_matrix": { "merge": true, "data": { "new_strengths": [], "new_vulnerabilities": [], "trait_shifts": [] } }
  },
  "core_updates": {
    "core_desire": null,
    "core_fear": null,
    "core_wound": null,
    "belief_pressured": null
  },
  "summary": "one-sentence summary of what evolved"
}

Set any field to null if it should NOT be updated.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Story ${storyNumber}: "${storyTitle || 'Untitled'}"\n\n${storyText.slice(0, 3000)}`,
      }],
    });

    const raw = response.content?.[0]?.text || '';
    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch {
      return res.json({ updated: false, reason: 'Could not parse Claude response' });
    }

    // Apply updates to the character
    const updatePayload = {};
    let fieldsUpdated = 0;

    // Core field updates (only if Claude explicitly set them)
    if (parsed.core_updates) {
      if (parsed.core_updates.core_desire) { updatePayload.core_desire = parsed.core_updates.core_desire; fieldsUpdated++; }
      if (parsed.core_updates.core_fear) { updatePayload.core_fear = parsed.core_updates.core_fear; fieldsUpdated++; }
      if (parsed.core_updates.core_wound) { updatePayload.core_wound = parsed.core_updates.core_wound; fieldsUpdated++; }
      if (parsed.core_updates.belief_pressured) { updatePayload.belief_pressured = parsed.core_updates.belief_pressured; fieldsUpdated++; }
    }

    // Merge-style JSONB updates
    if (parsed.updates) {
      if (parsed.updates.relationships_map?.data) {
        const existing = plain.relationships_map || {};
        updatePayload.relationships_map = { ...existing, ...parsed.updates.relationships_map.data };
        fieldsUpdated++;
      }
      if (parsed.updates.evolution_tracking?.data) {
        const existing = plain.evolution_tracking || {};
        updatePayload.evolution_tracking = { ...existing, ...parsed.updates.evolution_tracking.data };
        fieldsUpdated++;
      }
      if (parsed.updates.personality_matrix?.data) {
        const existing = plain.personality_matrix || {};
        // Merge arrays instead of overwriting
        const newData = parsed.updates.personality_matrix.data;
        if (newData.new_strengths?.length) {
          existing.strengths = [...new Set([...(existing.strengths || []), ...newData.new_strengths])];
        }
        if (newData.new_vulnerabilities?.length) {
          existing.vulnerabilities = [...new Set([...(existing.vulnerabilities || []), ...newData.new_vulnerabilities])];
        }
        if (newData.trait_shifts?.length) {
          existing.trait_shifts = [...(existing.trait_shifts || []), ...newData.trait_shifts];
        }
        updatePayload.personality_matrix = existing;
        fieldsUpdated++;
      }
    }

    if (fieldsUpdated > 0) {
      await charRow.update(updatePayload);
      console.log(`[story-engine-update-registry] Updated ${fieldsUpdated} fields for ${characterKey} after story ${storyNumber}`);
    }

    return res.json({
      updated: fieldsUpdated > 0,
      fields_updated: fieldsUpdated,
      summary: parsed.summary || 'No changes detected.',
      updates_applied: Object.keys(updatePayload),
    });

  } catch (err) {
    console.error('[story-engine-update-registry] error:', err?.message);
    return res.json({ updated: false, error: err?.message });
  }
});

// ─── GET /story-memories/:characterId ────────────────────────────────────────
// Fetch all story-extracted memories for a character (used by Therapy Room).
router.get('/story-memories/:characterId', optionalAuth, async (req, res) => {
  try {
    const { characterId } = req.params;
    const memories = await StorytellerMemory.findAll({
      where: { character_id: characterId },
      order: [['created_at', 'DESC']],
      limit: 200,
    });
    const painPoints = memories.filter(m => m.type === 'pain_point');
    const beliefShifts = memories.filter(m => m.type === 'belief_shift');
    const therapyOpenings = memories.filter(m => m.type === 'therapy_opening');
    return res.json({
      success: true,
      total: memories.length,
      pain_points: painPoints.map(m => ({
        id: m.id,
        statement: m.statement,
        category: m.category,
        coaching_angle: m.coaching_angle,
        source_ref: m.source_ref,
        confirmed: m.confirmed,
        created_at: m.created_at,
      })),
      belief_shifts: beliefShifts.map(m => ({
        id: m.id,
        statement: m.statement,
        source_ref: m.source_ref,
        confirmed: m.confirmed,
        created_at: m.created_at,
      })),
      therapy_openings: therapyOpenings.map(m => ({
        id: m.id,
        statement: m.statement,
        source_ref: m.source_ref,
        created_at: m.created_at,
      })),
    });
  } catch (err) {
    console.error('[story-memories] error:', err?.message);
    return res.json({ success: false, total: 0, pain_points: [], belief_shifts: [], therapy_openings: [] });
  }
});


// Export router as default, plus shared functions used by other route files
module.exports = router;
module.exports.router = router;
module.exports.loadWriteModeContext = loadWriteModeContext;
module.exports.buildWriteModeContextBlock = buildWriteModeContextBlock;
