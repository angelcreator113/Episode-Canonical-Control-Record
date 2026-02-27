/**
 * ════════════════════════════════════════════════════════════════════════
 * THE LALAVERSE PRESS — Complete System
 * ════════════════════════════════════════════════════════════════════════
 *
 * FILE: src/routes/press.js
 *
 * WHAT THIS FILE CONTAINS:
 *   — The four LalaVerse Press character profiles (seed data)
 *   — Career stage definitions for each character
 *   — 6 routes:
 *       POST /seed-characters        seed all 4 press characters into registry
 *       GET  /characters             list all press characters with career state
 *       GET  /characters/:id         single character full profile
 *       POST /advance-career         advance a character to next career stage
 *       POST /generate-post          generate blog content in character's voice
 *       POST /generate-scene         generate the scene where coverage of Lala lands
 *
 * ════════════════════════════════════════════════════════════════════════
 */

'use strict';

const express = require('express');
const router  = express.Router();

/* ── Lazy model loader ── */
let _models = null;
function getModels() {
  if (!_models) _models = require('../models');
  return _models;
}

let optionalAuth;
try {
  const m = require('../middleware/auth');
  optionalAuth = m.optionalAuth || m.authenticate || ((q,r,n)=>n());
} catch { optionalAuth = (q,r,n) => n(); }

let anthropic;
try {
  const Anthropic = require('@anthropic-ai/sdk');
  anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
} catch { anthropic = null; }

async function safeAI(systemPrompt, userPrompt, maxTokens = 800) {
  if (!anthropic) return null;
  try {
    const res = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    });
    return res.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
  } catch (err) {
    console.error('Press AI call failed:', err.message);
    return null;
  }
}

// ════════════════════════════════════════════════════════════════════════
// PRESS CHARACTER PROFILES — canonical seed data
// ════════════════════════════════════════════════════════════════════════

const PRESS_CHARACTERS = [

  {
    // ── REYNA VOSS ──────────────────────────────────────────────────────
    slug:         'reyna_voss',
    name:         'Reyna Voss',
    publication:  'The Real Rate',
    tagline:      'What the beauty economy actually pays.',
    age:          32,
    background:   'Dominican-American. Grew up in Miami. Six years on the brand side of beauty before leaving to start the publication.',
    type:         'press_business',

    nature:       'Moves toward clarity. Cannot tolerate vague. Under pressure she gets quieter and more precise \u2014 the emotional temperature drops while the analytical temperature rises.',
    wound:        'She negotiated a deal she was proud of \u2014 got a creator double the opening offer. Found out later the brand had budgeted four times that. The information gap cost someone real money. She has never forgiven herself for not knowing.',
    unsayable:    'She built The Real Rate to fix the information gap for other people. She has never fully admitted she is also trying to retroactively fix it for herself.',
    primary_defense: 'rationalize',
    emotional_state: { anger: 2, fear: 3, grief: 2, longing: 4, shame: 4, hope: 5, betrayal: 3, confusion: 2 },
    baseline:        { anger: 1, fear: 2, grief: 1, longing: 3, shame: 3, hope: 4, betrayal: 2, confusion: 1 },

    voice: {
      tone:       'Precise, dry, occasionally sharp. No inspiration content. All receipts.',
      sentence:   'Short and declarative. Numbers are load-bearing. Never padded.',
      opens_with: 'A specific fact, a data point, or a question that sounds simple and is not.',
      avoids:     'Vague claims, unverified numbers, anything that sounds like a press release, motivational framing',
      sounds_like: 'A forensic accountant who happens to write beautifully.',
    },

    sources: [
      'Beauty industry M&A reporters and analysts',
      'Founders of Black-owned beauty brands who publish revenue numbers',
      'Entertainment and brand lawyers who work with creator talent',
      'Creator economy researchers \u2014 real data, not surveys',
      'Operators who built, sold, or invested in beauty brands',
    ],

    career_stages: [
      {
        stage:       1,
        label:       'Credible and niche',
        description: 'Three years in. Small audience, high trust. Readers use her work to make money.',
        unlocks:     null,
      },
      {
        stage:       2,
        label:       'First viral piece',
        description: 'A breakdown of a brand deal structure exposes something brands don\'t want published. Audience doubles. Brands start to notice her.',
        unlocks:     'Brands begin offering exclusives to manage coverage. She declines.',
      },
      {
        stage:       3,
        label:       'Inside the table',
        description: 'She gets invited to the room she used to write about from outside. Has to decide what she becomes when she\'s inside.',
        unlocks:     'Access to information she couldn\'t get before. The question of what she does with it.',
      },
      {
        stage:       4,
        label:       'Network voice',
        description: 'The LalaVerse Press gives her reach she couldn\'t build alone. She becomes the financial voice of the network.',
        unlocks:     'Coverage of Lala\'s brand deal. The case study that changes both their trajectories.',
      },
    ],

    lala_coverage: {
      trigger:     'Lala negotiates her own brand deal \u2014 no agent, no manager \u2014 and gets terms that shouldn\'t be possible without years of experience.',
      angle:       'Business case study. Creator leverage. Lala is evidence, not subject.',
      why_it_matters: 'It\'s the first time Lala sees herself from the outside \u2014 through numbers. She finds out what she actually did.',
      scene_beat:  'Lala reads the piece alone. Reyna got the terms exactly right. Nobody told her. Lala sits with that.',
    },
  },

  {
    // ── SOL\u00c8NE BEAUMONT ─────────────────────────────────────────────────
    slug:         'solene_beaumont',
    name:         'Sol\u00e8ne Beaumont',
    publication:  'Undressed',
    tagline:      'On beauty, identity, and the decision to take up space.',
    age:          27,
    background:   'French-Haitian. Grew up between Port-au-Prince and Paris. Has lived in London for four years.',
    type:         'press_style',

    nature:       'Moves toward meaning. Cannot let a surface stay surface. A conversation about moisturizer becomes a conversation about her grandmother\'s hands. Under pressure she over-reads \u2014 finds significance in everything, sometimes correctly.',
    wound:        'She spent years in Paris being told \u2014 subtly, with great politeness \u2014 that her natural hair was beaucoup but perhaps a bit too much for certain rooms. She straightened it for three years. The day she stopped is the day Undressed started.',
    unsayable:    'She is still learning what she actually likes \u2014 independent of reaction, independent of resistance. Some of her aesthetic choices are still defined by what she\'s refusing rather than what she loves.',
    primary_defense: 'intellectualize',
    emotional_state: { anger: 3, fear: 3, grief: 4, longing: 5, shame: 3, hope: 6, betrayal: 2, confusion: 4 },
    baseline:        { anger: 2, fear: 2, grief: 3, longing: 4, shame: 2, hope: 5, betrayal: 1, confusion: 3 },

    voice: {
      tone:       'Literary, intimate, culturally specific. Reads like a letter from someone who has thought carefully about something you\'ve been feeling vaguely.',
      sentence:   'Long and layered. She earns the length. Paragraphs that open into something unexpected.',
      opens_with: 'A specific sensory detail \u2014 a texture, a smell, a remembered image \u2014 that opens into the larger idea.',
      avoids:     'Trend coverage, shopping guides, anything that reduces beauty to product, generic empowerment language',
      sounds_like: 'Zadie Smith writing about getting dressed.',
    },

    sources: [
      'Natural hair community founders and educators',
      'Black beauty historians and cultural critics',
      'Perfumers and skincare formulators who discuss craft and intention',
      'Women writers who write about the body as a site of meaning',
      'Photographers documenting Black beauty on its own terms',
    ],

    career_stages: [
      {
        stage:       1,
        label:       'Necessary and small',
        description: 'Two years in. Her readers find her and feel found. Not yet large. Intensely loyal.',
        unlocks:     null,
      },
      {
        stage:       2,
        label:       'Viral and complicated',
        description: 'A personal piece about the natural hair journey goes viral. Not her most polished work \u2014 her most true. She has feelings about that.',
        unlocks:     'Invitations to beauty events she previously had no access to.',
      },
      {
        stage:       3,
        label:       'In the room',
        description: 'She starts covering events. She takes notes about the room, not the products. She is developing her eye for the thing underneath the thing.',
        unlocks:     'The moment she sees Lala. Before she knows who Lala is.',
      },
      {
        stage:       4,
        label:       'The profile',
        description: 'She writes the Lala profile. It is the best thing she has ever published. Her audience triples. She is now a voice, not just a writer.',
        unlocks:     'The LalaVerse Press network. A column that becomes the aesthetic conscience of the franchise.',
      },
    ],

    lala_coverage: {
      trigger:     'Lala walks into an event dressed like she\'s already decided who she is. Sol\u00e8ne notices the specificity \u2014 the conviction in the choice, not the clothes.',
      angle:       'Interior portrait. Who does a woman have to become to dress like that? Where does that certainty come from?',
      why_it_matters: 'The first piece that documents Lala as a person rather than a phenomenon. Lala reads it and recognizes herself in it more clearly than she ever has.',
      scene_beat:  'Sol\u00e8ne introduces herself after the event. Asks if she can write about her. Lala says: what would you write about? Sol\u00e8ne says: the decision. Lala says yes.',
    },
  },

  {
    // ── TAYE OKAFOR ─────────────────────────────────────────────────────
    slug:         'taye_okafor',
    name:         'Taye Okafor',
    publication:  'First Look',
    tagline:      'Who\'s worth watching. Before everyone knows it.',
    age:          35,
    background:   'British-Nigerian. Born in Lagos, raised in London. In New York for five years. Has been embedded in creative communities on three continents.',
    type:         'press_culture',

    nature:       'Moves toward signal. His entire operating system is tuned to the frequency of things that matter before they matter. Under pressure he goes quiet and observes while everyone else reacts. He is always processing. It looks like stillness. It is not.',
    wound:        'He championed a Black creator early \u2014 wrote the piece that put her on the map. She blew up. The mainstream got involved. He watched the thing that made her matter get smoothed out in exchange for brand access. He felt complicit. He has been more careful since. He does not cover people to make them famous. He covers them because they deserve to be documented.',
    unsayable:    'He is afraid that his talent for seeing what\'s next is a way of never fully arriving anywhere. Always looking forward as a way of never being present in what\'s now. He has been in every room. He has felt at home in very few of them.',
    primary_defense: 'withdraw',
    emotional_state: { anger: 2, fear: 4, grief: 3, longing: 5, shame: 2, hope: 4, betrayal: 4, confusion: 2 },
    baseline:        { anger: 1, fear: 3, grief: 2, longing: 4, shame: 1, hope: 3, betrayal: 3, confusion: 1 },

    voice: {
      tone:       'Observational, authoritative, cool. Never fan behavior. Informed perspective with the confidence of someone who has been right before.',
      sentence:   'Economical. Each sentence earns its place. Nothing performative.',
      opens_with: 'An observation \u2014 something he noticed that other people in the room missed.',
      avoids:     'Breathlessness, superlatives, anything that sounds like hype, the word "iconic"',
      sounds_like: 'A music critic who moved to beauty and culture and brought all his standards with him.',
    },

    sources: [
      'Community connectors \u2014 people who know everyone worth knowing',
      'Event photographers documenting Black creative culture',
      'Founders and operators in the Black beauty economy',
      'The people his subjects are watching \u2014 the influences of the interesting',
      'The quiet ones \u2014 the people in the room who aren\'t performing for the room',
    ],

    career_stages: [
      {
        stage:       1,
        label:       'Already authoritative',
        description: 'First Look has been running for three years when LalaVerse begins. In the community it is the record of record. He built the authority before the story starts.',
        unlocks:     null,
      },
      {
        stage:       2,
        label:       'More visible than he wants',
        description: 'Someone he covered early becomes one of the biggest names in LalaVerse beauty. He is suddenly being credited for it. He dislikes this.',
        unlocks:     'Brands trying to court him. He declines all of it.',
      },
      {
        stage:       3,
        label:       'Deciding what it becomes',
        description: 'The platform is bigger than he intended. He has to decide what First Look is at scale \u2014 and whether that changes what it is.',
        unlocks:     'The moment someone he respects mentions Lala in passing.',
      },
      {
        stage:       4,
        label:       'The Lala piece',
        description: 'He has been watching for three months. The piece is not breathless. It is precise. It changes her trajectory more than any viral moment has.',
        unlocks:     'A scene: Lala reads it and understands for the first time that she is being documented, not promoted. The difference matters to her.',
      },
    ],

    lala_coverage: {
      trigger:     'Someone Taye respects mentions Lala in passing \u2014 not as a recommendation, as a reference. He files it. Starts watching. Waits three months.',
      angle:       'Who she is, specifically. What she\'s building, specifically. Not breathless. Not a profile. A precise document.',
      why_it_matters: 'First time Lala is covered by someone whose coverage has weight. Not follower weight \u2014 credibility weight. The community takes his word seriously.',
      scene_beat:  'He doesn\'t tell her he\'s writing the piece. She finds out when it publishes. She reads it twice. The second time she is looking for what he got wrong. He got nothing wrong.',
    },
  },

  {
    // ── ASHA BRENNAN ────────────────────────────────────────────────────
    slug:         'asha_brennan',
    name:         'Asha Brennan',
    publication:  'The Cost of Wanting More',
    tagline:      'On ambition, visibility, and the interior life of women who build.',
    age:          29,
    background:   'British-Indian. Parents from Kerala. Grew up in Birmingham. Has been in New York for two years.',
    type:         'press_interior',

    nature:       'Moves toward truth. Cannot write anything she doesn\'t fully believe. It makes her slow. It makes her incapable of content for content\'s sake. Under pressure she goes interior \u2014 disappears into processing \u2014 and comes out with something worth reading.',
    wound:        'She was told for years by people who loved her that wanting more was ingratitude. That what she had was enough. That a first-generation woman should be grateful, not ambitious. She believed them for longer than she should have. The publication is her disagreement, published weekly.',
    unsayable:    'She worries that writing about wanting more has become a way of not doing the thing she actually wants. That the blog is the sublimation of the ambition, not the ambition itself. She has started a different project three times and stopped each time.',
    primary_defense: 'intellectualize',
    emotional_state: { anger: 3, fear: 5, grief: 3, longing: 7, shame: 4, hope: 5, betrayal: 2, confusion: 4 },
    baseline:        { anger: 2, fear: 4, grief: 2, longing: 6, shame: 3, hope: 4, betrayal: 1, confusion: 3 },

    voice: {
      tone:       'Intimate, rigorous, specific. Reads like someone who has thought carefully about something you\'ve been feeling vaguely and named it more accurately than you could.',
      sentence:   'Builds. Starts with the specific and opens into the universal. Never starts with the universal.',
      opens_with: 'Something that happened \u2014 a specific moment, a specific feeling \u2014 that becomes the entry point for the larger argument.',
      avoids:     'Motivational framing, silver linings, resolution, anything that closes rather than opens, the phrase "you\'ve got this"',
      sounds_like: 'A therapist who decided to write instead of practice, and is better for it.',
    },

    sources: [
      'Psychologists and researchers studying visibility, comparison, and ambition in women of color',
      'Women writers writing honestly about the interior experience of building',
      'Therapists who publish about patterns they see in ambitious women',
      'Founders in the Black beauty economy who talk about psychological cost, not just strategy',
      'Her own comments section \u2014 the women who write "I thought I was the only one"',
    ],

    career_stages: [
      {
        stage:       1,
        label:       'Necessary and small',
        description: 'Two years in. Open rates extraordinary. People forward her pieces to the specific friend who needs it. Not large. Intensely necessary.',
        unlocks:     null,
      },
      {
        stage:       2,
        label:       'Visibility gap goes viral',
        description: 'A piece about the visibility gap is shared by someone with real reach. She triples overnight. She has feelings about going viral while writing about not being seen. She writes about that too.',
        unlocks:     'An audience that includes people who don\'t know LalaVerse \u2014 they find her first and follow her back in.',
      },
      {
        stage:       3,
        label:       'Lala says the true thing',
        description: 'Lala says something publicly about what it cost her to keep going when she wasn\'t being seen. Asha recognizes it. Writes about it the same week. Their audiences find each other.',
        unlocks:     'A relationship between their readerships. Lala\'s audience discovers interiority. Asha\'s audience discovers Lala.',
      },
      {
        stage:       4,
        label:       'She finds the book',
        description: 'Asha finds JustAWoman\'s book Before Lala. The moment of recognition \u2014 that someone else named all of this, from the inside, before she did \u2014 is a scene in the story.',
        unlocks:     'The two worlds touch. The reader has been holding both sides. This is the moment they feel the full weight of it.',
      },
    ],

    lala_coverage: {
      trigger:     'Lala says something true in public about what it cost her to keep going when she wasn\'t being seen. Honest in a way that performance never is.',
      angle:       'Lala as a case study in wanting more without apologizing for it. Not a profile \u2014 an argument, illustrated.',
      why_it_matters: 'Asha\'s audience finds Lala. Lala\'s audience finds Asha. Two communities that needed each other discover they were already living in adjacent rooms.',
      scene_beat:  'Lala reads the piece and messages Asha privately. Just: "how did you know." Asha doesn\'t answer for a day. When she does she says: "because I\'m still living it."',
    },
  },
];

// ── CAREER STAGE HELPERS ──────────────────────────────────────────────────

function getCurrentStage(character, careerData) {
  const current = careerData?.current_stage || 1;
  return character.career_stages.find(s => s.stage === current) || character.career_stages[0];
}

function getNextStage(character, careerData) {
  const current = careerData?.current_stage || 1;
  return character.career_stages.find(s => s.stage === current + 1) || null;
}

function isLalaStageReached(character, careerData) {
  const lalaStage = character.career_stages.length;
  return (careerData?.current_stage || 1) >= lalaStage;
}

// ════════════════════════════════════════════════════════════════════════
// ROUTE 1: POST /seed-characters
// ════════════════════════════════════════════════════════════════════════

router.post('/seed-characters', optionalAuth, async (req, res) => {
  try {
    let { show_id, registry_id } = req.body || {};
    const models = getModels();
    const { RegistryCharacter, CharacterRegistry, Show } = models;

    // If no show_id provided, look up the first available show
    if (!show_id && !registry_id && Show) {
      const defaultShow = await Show.findOne({ order: [['created_at', 'ASC']] });
      if (defaultShow) show_id = defaultShow.id;
    }

    let registry;
    if (registry_id) {
      registry = await CharacterRegistry.findByPk(registry_id);
    } else {
      // Find existing press registry — try with show_id first, then by title alone
      const whereClause = show_id
        ? { show_id, title: 'The LalaVerse Press' }
        : { title: 'The LalaVerse Press' };
      registry = await CharacterRegistry.findOne({ where: whereClause });
      if (!registry) {
        registry = await CharacterRegistry.create({
          show_id:     show_id || null,
          title:       'The LalaVerse Press',
          description: 'Four independent bloggers in LalaVerse. Each has a career, a wound, a publication, and a limited perspective on the world. They don\'t know each other at launch. They don\'t know Lala yet. They find her the way anyone finds someone worth covering \u2014 because she earns it.',
        });
      }
    }

    const seeded = [];

    for (const pc of PRESS_CHARACTERS) {
      const existing = await RegistryCharacter.findOne({
        where: { registry_id: registry.id, character_key: pc.slug },
      });
      if (existing) { seeded.push(existing); continue; }

      const char = await RegistryCharacter.create({
        registry_id:       registry.id,
        character_key:     pc.slug,
        display_name:      pc.name,
        selected_name:     pc.name,
        role_type:         'pressure',
        role_label:        `Publisher of ${pc.publication} \u2014 "${pc.tagline}"`,
        appearance_mode:   'on_page',
        core_belief:       pc.unsayable,

        personality:       pc.nature,
        core_wound:        pc.wound,
        pressure_type:     pc.primary_defense,

        personality_matrix: {
          tone:       pc.voice.tone,
          sentence:   pc.voice.sentence,
          opens_with: pc.voice.opens_with,
          avoids:     pc.voice.avoids,
          sounds_like: pc.voice.sounds_like,
        },

        extra_fields: {
          publication:   pc.publication,
          tagline:       pc.tagline,
          background:    pc.background,
          sources:       pc.sources,
          lala_coverage: pc.lala_coverage,
          career_stages: pc.career_stages,
        },

        description: `Documents ${['the business', 'the aesthetics', 'the culture', 'the interior life'][PRESS_CHARACTERS.indexOf(pc)]} of the LalaVerse world. Covers Lala when she earns it. Each coverage moment is a story beat and a real-world publication.`,

        status: 'accepted',
      });

      seeded.push(char);
    }

    res.json({
      ok:         true,
      registry_id: registry.id,
      seeded:     seeded.length,
      characters: seeded.map(c => ({ id: c.id, name: c.selected_name })),
    });

  } catch (err) {
    console.error('POST /press/seed-characters error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════
// ROUTE 2: GET /characters
// ════════════════════════════════════════════════════════════════════════

router.get('/characters', optionalAuth, async (req, res) => {
  try {
    const models  = getModels();
    const careers = await models.PressCareer?.findAll() || [];

    const result = PRESS_CHARACTERS.map(pc => {
      const career = careers.find(c => c.character_slug === pc.slug);
      const stage  = getCurrentStage(pc, career);
      const next   = getNextStage(pc, career);
      return {
        slug:         pc.slug,
        name:         pc.name,
        publication:  pc.publication,
        tagline:      pc.tagline,
        type:         pc.type,
        current_stage: {
          number:      stage.stage,
          label:       stage.label,
          description: stage.description,
        },
        next_stage: next ? {
          number:      next.stage,
          label:       next.label,
        } : null,
        lala_covered:  isLalaStageReached(pc, career),
        sessions_completed: career?.sessions_completed || 0,
        // Pass full career stages for the dashboard
        career_stages: pc.career_stages,
        // Pass profile data for overview tab
        nature: pc.nature,
        wound:  pc.wound,
      };
    });

    res.json(result);

  } catch (err) {
    console.error('GET /press/characters error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════
// ROUTE 3: GET /characters/:slug
// ════════════════════════════════════════════════════════════════════════

router.get('/characters/:slug', optionalAuth, async (req, res) => {
  try {
    const pc = PRESS_CHARACTERS.find(c => c.slug === req.params.slug);
    if (!pc) return res.status(404).json({ error: 'Character not found' });

    const models = getModels();
    const career = await models.PressCareer?.findOne({
      where: { character_slug: pc.slug },
    });

    res.json({
      ...pc,
      current_stage:     career?.current_stage || 1,
      stage_history:     career?.stage_history || [],
      lala_covered:      isLalaStageReached(pc, career),
      therapy_sessions:  career?.sessions_completed || 0,
      content_generated: career?.content_generated || 0,
    });

  } catch (err) {
    console.error('GET /press/characters/:slug error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════
// ROUTE 4: POST /advance-career
// ════════════════════════════════════════════════════════════════════════

router.post('/advance-career', optionalAuth, async (req, res) => {
  try {
    const { character_slug, trigger_event, chapter_id } = req.body;

    const pc = PRESS_CHARACTERS.find(c => c.slug === character_slug);
    if (!pc) return res.status(404).json({ error: 'Character not found' });

    const models = getModels();

    let career = await models.PressCareer?.findOne({
      where: { character_slug },
    });

    const currentStage = career?.current_stage || 1;
    const nextStage    = currentStage + 1;

    if (nextStage > pc.career_stages.length) {
      return res.json({
        ok:      true,
        message: `${pc.name} is already at their final career stage.`,
        stage:   currentStage,
      });
    }

    const newStageData = pc.career_stages.find(s => s.stage === nextStage);

    const historyEntry = {
      from_stage:    currentStage,
      to_stage:      nextStage,
      trigger_event: trigger_event || 'Manual advance',
      chapter_id:    chapter_id || null,
      timestamp:     new Date().toISOString(),
    };

    if (career && models.PressCareer) {
      await models.PressCareer.update(
        {
          current_stage: nextStage,
          stage_history: [...(career.stage_history || []), historyEntry],
        },
        { where: { character_slug } }
      );
    } else if (models.PressCareer) {
      await models.PressCareer.create({
        character_slug,
        current_stage: nextStage,
        stage_history: [historyEntry],
        sessions_completed:  0,
        content_generated:   0,
      });
    }

    const lalaUnlocked = nextStage === pc.career_stages.length;

    res.json({
      ok:            true,
      character:     pc.name,
      previous_stage: currentStage,
      new_stage:     nextStage,
      stage_label:   newStageData.label,
      unlocks:       newStageData.unlocks,
      lala_coverage_unlocked: lalaUnlocked,
      lala_coverage: lalaUnlocked ? pc.lala_coverage : null,
    });

  } catch (err) {
    console.error('POST /press/advance-career error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════
// ROUTE 5: POST /generate-post
// ════════════════════════════════════════════════════════════════════════

router.post('/generate-post', optionalAuth, async (req, res) => {
  try {
    const { character_slug, topic, hook, format = 'newsletter', lala_reference } = req.body;

    const pc = PRESS_CHARACTERS.find(c => c.slug === character_slug);
    if (!pc) return res.status(404).json({ error: 'Character not found' });

    const FORMAT_SPECS = {
      newsletter: 'A full newsletter post. 400\u2013600 words. Opens with a specific detail. Builds to an argument. Ends open \u2014 not resolved.',
      short:      'A short post. 150\u2013200 words. One idea. One argument. Dense.',
      social:     'A social media caption. 80\u2013120 words. The voice compressed to its essence. Ends with a question or an observation that invites response.',
    };

    const systemPrompt = `You are ${pc.name}, publisher of ${pc.publication} \u2014 "${pc.tagline}".

WHO YOU ARE:
${pc.background}

YOUR NATURE:
${pc.nature}

YOUR WOUND (shapes what you notice and avoid):
${pc.wound}

YOUR VOICE:
Tone: ${pc.voice.tone}
Sentence style: ${pc.voice.sentence}
You open with: ${pc.voice.opens_with}
You never: ${pc.voice.avoids}
You sound like: ${pc.voice.sounds_like}

YOUR SOURCES \u2014 you cite these kinds of sources, not opinions:
${pc.sources.join('\n')}

THE WORLD:
You exist in LalaVerse \u2014 a world built on Black beauty culture, brand building, ownership, and economics. The aesthetic of your world is clean and elevated \u2014 quiet luxury with cultural roots. Everyone lives here.

CRITICAL:
\u2014 Write as ${pc.name}, not as an AI assistant.
\u2014 Your wound shapes your lens \u2014 it shows in what you notice, not in what you say.
\u2014 You do not write inspiration content. You do not write for engagement. You write because you have something specific to say.
\u2014 Never use: "iconic", "game-changing", "empowering", "journey" (as a metaphor), "authentic" (as a descriptor).`;

    const lalaContext = lala_reference
      ? `\n\nNOTE: This piece references Lala, a rising creator in LalaVerse. The reference should feel natural \u2014 Lala is evidence or example, never the whole point, unless this is specifically her coverage piece.`
      : '';

    const userPrompt = `Write a ${format} post for ${pc.publication}.

TOPIC: ${topic}
${hook ? `NEWS HOOK / TRIGGER: ${hook}` : ''}
${lalaContext}

FORMAT: ${FORMAT_SPECS[format]}

Write only the post. No preamble. No explanation. Start immediately with the content.`;

    const content = await safeAI(systemPrompt, userPrompt, 900)
      || `[${pc.name} has something to say about this. The generation failed \u2014 check the AI connection and try again.]`;

    try {
      const models = getModels();
      if (models.PressCareer) {
        await models.PressCareer.increment('content_generated', {
          where: { character_slug },
        });
      }
    } catch {}

    res.json({
      character:   pc.name,
      publication: pc.publication,
      topic,
      format,
      content,
      word_count:  content.split(/\s+/).filter(Boolean).length,
    });

  } catch (err) {
    console.error('POST /press/generate-post error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════
// ROUTE 6: POST /generate-scene
// ════════════════════════════════════════════════════════════════════════

router.post('/generate-scene', optionalAuth, async (req, res) => {
  try {
    const {
      character_slug,
      chapter_brief,
      lala_context,
      pov = 'lala',
    } = req.body;

    const pc = PRESS_CHARACTERS.find(c => c.slug === character_slug);
    if (!pc) return res.status(404).json({ error: 'Character not found' });

    const blogSystemPrompt = `You are ${pc.name}, publisher of ${pc.publication}.
${pc.voice.tone}
${pc.voice.sentence}
You open with: ${pc.voice.opens_with}
You never: ${pc.voice.avoids}`;

    const blogUserPrompt = `Write the piece that covers Lala.

THE TRIGGER: ${pc.lala_coverage.trigger}
YOUR ANGLE: ${pc.lala_coverage.angle}
WHAT IT MEANS: ${pc.lala_coverage.why_it_matters}
${lala_context ? `ADDITIONAL CONTEXT: ${lala_context}` : ''}

Write the actual piece \u2014 300\u2013400 words. This is what gets published.
Start immediately. No preamble.`;

    const blogPiece = await safeAI(blogSystemPrompt, blogUserPrompt, 600);

    const sceneSystemPrompt = `You are writing a scene for the book "Before Lala" \u2014 
a literary memoir by JustAWoman about building Lala and trying to be seen.

The scene: Lala (as a character in the LalaVerse story) 
encounters coverage by ${pc.name} of ${pc.publication}.

The beat: ${pc.lala_coverage.scene_beat}

Writing style: First person close. Interior and exterior simultaneously.
The prose knows things the character doesn't know yet about what this moment means.
Warm parchment \u2014 literary, specific, earned.`;

    const sceneUserPrompt = `Write the scene where Lala encounters ${pc.name}'s coverage.

CHAPTER CONTEXT: ${chapter_brief || 'Lala is building her presence in LalaVerse. She is not yet famous. She is being seen for the first time by someone whose word carries weight.'}

THE PIECE THAT WAS PUBLISHED:
---
${blogPiece || '[The blog piece would appear here]'}
---

THE SCENE BEAT: ${pc.lala_coverage.scene_beat}

Write the scene \u2014 200\u2013350 words of prose. 
Lines should be import-ready for the Book Editor (not formatted as LINE markers \u2014 just clean prose paragraphs).
The scene ends open. Something has changed. She doesn't fully know what yet.`;

    const sceneProse = await safeAI(sceneSystemPrompt, sceneUserPrompt, 700);

    res.json({
      character:      pc.name,
      publication:    pc.publication,
      blog_piece:     blogPiece,
      blog_word_count: blogPiece?.split(/\s+/).filter(Boolean).length || 0,
      scene_prose:    sceneProse,
      scene_beat:     pc.lala_coverage.scene_beat,
      import_hint:    `This scene can be imported into the chapter using the Bulk Import tool. The blog piece can be published on ${pc.publication} simultaneously.`,
    });

  } catch (err) {
    console.error('POST /press/generate-scene error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
